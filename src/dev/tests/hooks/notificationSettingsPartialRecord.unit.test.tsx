/**
 * A PARTIALLY-WRITTEN per-space notification record must not crash the channel.
 *
 * Production symptom (app.quorummessenger.com, 2026-08-21): opening one
 * specific space showed "the channel could not be loaded", with
 * `TypeError: Cannot read properties of undefined (reading 'filter')` caught by
 * the route error boundary, plus repeated
 * `[ReplyCounts]/[SpaceReplyCounts] ... (reading 'includes')` in the console.
 *
 * Cause: `UserConfig.notificationSettings[spaceId]` existed but had no
 * `enabledNotificationTypes`. quorum-mobile's `setSpaceMuted` persists
 * `{ ...(prev[spaceId] ?? {}), isMuted }`, so for a space with no prior settings
 * it writes a bare `{ isMuted }` — which then syncs to desktop. The old
 * `config?.notificationSettings?.[spaceId] ?? getDefaultNotificationSettings()`
 * could not catch that: the record is truthy, so the fallback never fired and
 * `selectedTypes` came out `undefined`. NotificationPanel then did
 * `selectedTypes.filter(...)` during render and took the whole route down. The
 * panel is mounted unconditionally in Channel.tsx (`isOpen` is only a prop), so
 * the user never had to open it.
 *
 * This exercises the REAL hook against the REAL shared normalizer. The existing
 * NotificationPanel test mocks `useMentionNotificationSettings` wholesale, so it
 * could never have caught this.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const SPACE_ID = 'space-1';
const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const ALL_TYPES = ['mention-you', 'mention-everyone', 'mention-roles', 'reply'];

const mocks = vi.hoisted(() => ({
  config: undefined as unknown,
  enqueue: vi.fn(),
  getUserConfig: vi.fn(),
}));

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  usePasskeysContext: () => ({ currentPasskeyInfo: { address: ADDR } }),
}));

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { getUserConfig: (...a: unknown[]) => mocks.getUserConfig(...a) },
    actionQueueService: { enqueue: (...a: unknown[]) => mocks.enqueue(...a) },
    keyset: {},
  }),
}));

vi.mock('@/hooks/queries/config', () => ({
  useConfig: () => ({ data: mocks.config }),
  buildConfigKey: ({ userAddress }: { userAddress: string }) => ['config', userAddress],
}));

vi.mock('@/utils/toast', () => ({ showError: vi.fn() }));

import { useMentionNotificationSettings } from '@/hooks/business/mentions/useMentionNotificationSettings';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
};

const renderWithConfig = (config: unknown) => {
  mocks.config = config;
  // saveSettings re-reads the config cache-first and falls back to
  // messageDB.getUserConfig. The mocked useConfig doesn't populate the query
  // cache, so the fallback is the leg that runs here — it must return the same
  // config the hook rendered from, or Save sees `undefined` and no-ops for
  // reasons that have nothing to do with the behaviour under test.
  mocks.getUserConfig.mockResolvedValue(config);
  return renderHook(() => useMentionNotificationSettings({ spaceId: SPACE_ID }), {
    wrapper,
  });
};

/** Exactly what quorum-mobile's setSpaceMuted writes for a fresh space. */
const mobileMuteOnlyConfig = (isMuted: boolean) => ({
  address: ADDR,
  spaceIds: [SPACE_ID],
  notificationSettings: { [SPACE_ID]: { isMuted } },
});

beforeEach(() => {
  mocks.config = undefined;
  mocks.enqueue.mockReset().mockResolvedValue(undefined);
  mocks.getUserConfig.mockReset().mockResolvedValue(undefined);
});

/** The per-space record a Save actually enqueued, or undefined if it no-opped. */
const enqueuedRecord = () => {
  if (mocks.enqueue.mock.calls.length === 0) return undefined;
  const [, payload] = mocks.enqueue.mock.calls[0] as [
    string,
    { config: { notificationSettings: Record<string, unknown> } },
  ];
  return payload.config.notificationSettings[SPACE_ID] as
    | { spaceId?: string; enabledNotificationTypes?: string[]; isMuted?: boolean }
    | undefined;
};

describe('useMentionNotificationSettings with a partial stored record', () => {
  it('yields an ARRAY of selected types, never undefined', () => {
    // The load-bearing assertion. `undefined` here is what reached
    // NotificationPanel's `selectedTypes.filter(...)` and killed the route.
    const { result } = renderWithConfig(mobileMuteOnlyConfig(false));

    expect(Array.isArray(result.current.selectedTypes)).toBe(true);
    expect(result.current.selectedTypes).toEqual(ALL_TYPES);
  });

  it('survives the render + re-sync effect without throwing', () => {
    // The effect calls sameTypes(prev, persistedTypes), which read `.length`
    // off the missing array — a second crash site behind the first.
    expect(() => renderWithConfig(mobileMuteOnlyConfig(false))).not.toThrow();
  });

  it('reproduces the exact NotificationPanel expression that crashed', () => {
    const { result } = renderWithConfig(mobileMuteOnlyConfig(false));
    const selected = result.current.selectedTypes;

    // Verbatim from NotificationPanel.tsx: the .filter and the .includes.
    expect(() => selected.filter((t) => t.startsWith('mention-'))).not.toThrow();
    expect(selected.filter((t) => t.startsWith('mention-'))).toEqual([
      'mention-you',
      'mention-everyone',
      'mention-roles',
    ]);
    expect(selected.includes('reply')).toBe(true);
  });

  it('keeps the space muted while healing the missing array', () => {
    // Filling in defaults must not quietly unmute a space the user muted on
    // their phone. isMuted is the whole reason the partial record exists.
    const { result } = renderWithConfig(mobileMuteOnlyConfig(true));

    expect(result.current.settings.isMuted).toBe(true);
    expect(result.current.settings.enabledNotificationTypes).toEqual(ALL_TYPES);
  });

  it('backfills spaceId onto the partial record', () => {
    const { result } = renderWithConfig(mobileMuteOnlyConfig(false));
    expect(result.current.settings.spaceId).toBe(SPACE_ID);
  });
});

describe('useMentionNotificationSettings with well-formed input (non-regression)', () => {
  // These already passed before the fix. They are here so the fix cannot be
  // the thing that started making them pass, and so normalization cannot
  // silently override a real stored choice.
  it('respects an explicit stored selection', () => {
    const { result } = renderWithConfig({
      address: ADDR,
      spaceIds: [SPACE_ID],
      notificationSettings: {
        [SPACE_ID]: { spaceId: SPACE_ID, enabledNotificationTypes: ['reply'] },
      },
    });
    expect(result.current.selectedTypes).toEqual(['reply']);
  });

  it('respects an explicitly empty selection rather than resetting it', () => {
    // "Notify me about nothing" is a real choice and must not be mistaken for
    // missing data.
    const { result } = renderWithConfig({
      address: ADDR,
      spaceIds: [SPACE_ID],
      notificationSettings: {
        [SPACE_ID]: { spaceId: SPACE_ID, enabledNotificationTypes: [] },
      },
    });
    expect(result.current.selectedTypes).toEqual([]);
  });

  it('falls back to all-enabled defaults when the space has no record', () => {
    const { result } = renderWithConfig({
      address: ADDR,
      spaceIds: [SPACE_ID],
      notificationSettings: {},
    });
    expect(result.current.selectedTypes).toEqual(ALL_TYPES);
  });
});

describe('saveSettings never invents a selection the user did not make', () => {
  // Normalizing on READ fixes the crash but does not converge the stored record.
  // Writing the normalized value back to converge it was implemented and then
  // REVERTED, because the value written is the all-enabled DEFAULT — not a user
  // choice — and config sync is last-write-wins over the whole blob
  // (ConfigService compares timestamps; no per-field merge). A repair write
  // therefore races a real selection made on another device that hasn't synced
  // down yet and silently reverts it, reopening the exact data-loss class the
  // 2026-06-23 clobber guard exists to close. See that issue.
  //
  // These tests pin the reverted behaviour. If a future change reintroduces a
  // repair write, the first three go red.

  it('does NOT write on a no-op Save when the stored record is partial', async () => {
    // The tempting case: the record is visibly broken and Save is right there.
    // Writing here would assert ALL_TYPES over a selection the user may have
    // just made on their phone.
    const { result } = renderWithConfig(mobileMuteOnlyConfig(false));

    await act(async () => {
      await result.current.saveSettings();
    });

    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('does NOT write on a no-op Save for a healthy record', async () => {
    const { result } = renderWithConfig({
      address: ADDR,
      spaceIds: [SPACE_ID],
      notificationSettings: {
        [SPACE_ID]: { spaceId: SPACE_ID, enabledNotificationTypes: ALL_TYPES },
      },
    });

    await act(async () => {
      await result.current.saveSettings();
    });

    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('does NOT write when a healthy record holds a narrowed selection', async () => {
    // The exact shape the June bug was about: another device set
    // ['mention-roles'] and desktop must not POST its own default over it.
    const { result } = renderWithConfig({
      address: ADDR,
      spaceIds: [SPACE_ID],
      notificationSettings: {
        [SPACE_ID]: { spaceId: SPACE_ID, enabledNotificationTypes: ['mention-roles'] },
      },
    });

    await act(async () => {
      await result.current.saveSettings();
    });

    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('does NOT write for a space that has no record at all', async () => {
    const { result } = renderWithConfig({
      address: ADDR,
      spaceIds: [SPACE_ID],
      notificationSettings: {},
    });

    await act(async () => {
      await result.current.saveSettings();
    });

    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});

describe('a genuine edit still converges a partial record', () => {
  // This is why declining to repair is acceptable rather than merely cheap: the
  // record heals itself the first time the user actually chooses something,
  // because that write goes out complete. No separate repair path is needed.

  it('writes a COMPLETE record when the user changes the selection', async () => {
    const { result } = renderWithConfig(mobileMuteOnlyConfig(false));

    act(() => {
      result.current.setSelectedTypes(['reply']);
    });
    await act(async () => {
      await result.current.saveSettings();
    });

    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    const written = enqueuedRecord()!;
    expect(written.enabledNotificationTypes).toEqual(['reply']);
    expect(written.spaceId).toBe(SPACE_ID);
  });

  it('carries isMuted through that convergence write', async () => {
    // Healing on a real edit must not unmute a space muted on another device.
    const { result } = renderWithConfig(mobileMuteOnlyConfig(true));

    act(() => {
      result.current.setSelectedTypes(['mention-you']);
    });
    await act(async () => {
      await result.current.saveSettings();
    });

    expect(enqueuedRecord()!.isMuted).toBe(true);
  });
});
