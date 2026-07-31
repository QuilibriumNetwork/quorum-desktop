import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * The two cleanups this hook performs fail independently and are reported
 * independently. Both bugs this file exists to prevent lived in the
 * composition, not in either piece: the flush barrier's answer was computed and
 * then discarded, and a slow revoke leg overwrote a hub write that had already
 * succeeded. Testing planDeviceDeregistration and flushOutbound in isolation
 * caught neither.
 */

const mocks = vi.hoisted(() => ({
  address: 'user-address',
  keyset: {
    userKeyset: { user_key: { public_key: [1, 2, 3], private_key: [4, 5, 6] } },
    deviceKeyset: { inbox_keyset: { inbox_address: 'this-device' } },
  } as any,
  refetch: vi.fn(),
  upload: vi.fn(),
  broadcast: vi.fn(),
  flush: vi.fn(),
  construct: vi.fn(),
}));

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  usePasskeysContext: () => ({ currentPasskeyInfo: { address: mocks.address } }),
  channel: {
    ConstructUserRegistration: (...args: unknown[]) => mocks.construct(...args),
  },
}));

vi.mock('@/hooks/queries', () => ({
  useRegistration: () => ({ refetch: mocks.refetch }),
}));

vi.mock('@/components/context/useRegistrationContext', () => ({
  useRegistrationContext: () => ({ keyset: mocks.keyset }),
}));

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({ broadcastDeviceRevocations: mocks.broadcast }),
}));

vi.mock('@/components/context/WebsocketProvider', () => ({
  useWebSocket: () => ({ flushOutbound: mocks.flush }),
}));

vi.mock('@/hooks/mutations/useUploadRegistration', () => ({
  useUploadRegistration: () => mocks.upload,
}));

import { useDeregisterThisDevice } from '@/hooks/business/user/useDeregisterThisDevice';

const device = (inbox: string) => ({ inbox_registration: { inbox_address: inbox } });

const hubReturns = (...devices: ReturnType<typeof device>[]) => {
  mocks.refetch.mockResolvedValue({
    data: { registration: { device_registrations: devices } },
    error: null,
  });
};

const runDeregister = async () => {
  const { result } = renderHook(() => useDeregisterThisDevice());
  let outcome: Awaited<ReturnType<typeof result.current>>;
  await act(async () => {
    outcome = await result.current();
  });
  return outcome!;
};

describe('useDeregisterThisDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.keyset = {
      userKeyset: { user_key: { public_key: [1, 2, 3], private_key: [4, 5, 6] } },
      deviceKeyset: { inbox_keyset: { inbox_address: 'this-device' } },
    };
    hubReturns(device('this-device'), device('other-device'));
    mocks.construct.mockResolvedValue({ signed: true });
    mocks.upload.mockResolvedValue(undefined);
    mocks.broadcast.mockResolvedValue(undefined);
    mocks.flush.mockResolvedValue(true);
  });

  it('removes this device from the hub list and confirms the revoke on the wire', async () => {
    const outcome = await runDeregister();

    expect(outcome).toEqual({ hub: 'ok', spaces: 'ok' });
    // Re-signed with only the other device left.
    const [, remaining, added] = mocks.construct.mock.calls[0];
    expect(remaining).toEqual([device('other-device')]);
    expect(added).toEqual([]);
    expect(mocks.broadcast).toHaveBeenCalledWith(['this-device']);
  });

  it('reports the spaces leg failed when the flush is not confirmed', async () => {
    // The bug this guards: flushOutbound's answer was awaited and discarded, so
    // frames that never left the machine were reported as a clean goodbye.
    mocks.flush.mockResolvedValue(false);

    const outcome = await runDeregister();

    expect(outcome.spaces).toBe('failed');
  });

  it('does not let a failing spaces leg mask a successful hub write', async () => {
    // The bug this guards: one shared budget meant a slow revoke resolved the
    // whole thing to 'failed', so the user was told the device might still be
    // listed when it had already been removed.
    mocks.flush.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(false), 50))
    );

    const outcome = await runDeregister();

    expect(outcome).toEqual({ hub: 'ok', spaces: 'failed' });
    expect(mocks.upload).toHaveBeenCalled();
  });

  it('does not let a failing hub leg mask a successful revoke', async () => {
    mocks.upload.mockRejectedValue(new Error('hub unreachable'));

    const outcome = await runDeregister();

    expect(outcome).toEqual({ hub: 'failed', spaces: 'ok' });
  });

  it('skips both legs, and every network call, when the keyset is not ready', async () => {
    // RegistrationPersister fills the keyset ~200ms after mount; typing RESET
    // faster than that must not crash or sign with a half-built keyset.
    mocks.keyset = { userKeyset: undefined, deviceKeyset: undefined };

    const outcome = await runDeregister();

    expect(outcome).toEqual({ hub: 'skipped', spaces: 'skipped' });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.broadcast).not.toHaveBeenCalled();
  });

  it('does not write a stale device list when the list cannot be re-read', async () => {
    // Uploading replaces the list wholesale, so acting on a stale snapshot
    // would silently delete a device registered elsewhere since then.
    mocks.refetch.mockResolvedValue({ data: undefined, error: new Error('offline') });

    const outcome = await runDeregister();

    expect(outcome.hub).toBe('failed');
    expect(mocks.construct).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('still revokes in spaces when the hub list no longer lists this device', async () => {
    // Another device already removed it. Signing admissions are anchored to the
    // master key, not the device list, so the two can be out of step.
    hubReturns(device('other-device'));

    const outcome = await runDeregister();

    expect(outcome).toEqual({ hub: 'ok', spaces: 'ok' });
    expect(mocks.upload).not.toHaveBeenCalled(); // nothing to write
    expect(mocks.broadcast).toHaveBeenCalledWith(['this-device']);
  });

  it('aborts the hub upload at its own deadline rather than leaving it in flight', async () => {
    await runDeregister();

    // A request outliving the page is how the write silently went missing.
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: expect.any(Number) })
    );
  });
});
