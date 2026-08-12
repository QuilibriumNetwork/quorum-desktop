/**
 * DangerZone — the Confirm Reset button really does destroy the key material.
 *
 * The wipe itself is covered in depth by
 * `services/resetAppDataKeyMaterial.test.ts`. This file exists for the gap that
 * unit test cannot see: the wipe lives in a service now, so deleting the call
 * from the component would leave every one of those tests green while the
 * shipped button quietly stopped deleting anything.
 *
 * So this drives the actual UI — type "reset", click the button — and then asks
 * the SDK for the key back.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { Buffer } from 'buffer';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { messages } from '@/i18n/en/messages';
import { passkey } from '@quilibrium/quilibrium-js-sdk-channels';

const deregisterMock = vi.fn(async () => ({ hub: 'ok', spaces: 'ok' }));
vi.mock('@/hooks/business/user/useDeregisterThisDevice', () => ({
  useDeregisterThisDevice: () => deregisterMock,
}));

import DangerZone from '@/components/modals/UserSettingsModal/DangerZone';

const FAKE_MASTER_KEY = new Uint8Array(57).map((_, i) => (i * 7 + 3) & 0xff);

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
  // setup.ts stubs crypto.subtle; the SDK needs real AES-GCM to store anything.
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
  // jsdom throws "Not implemented" on navigation.
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: vi.fn() },
    writable: true,
    configurable: true,
  });
});

beforeEach(async () => {
  const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
  const fdb = new FDBFactory();
  globalThis.indexedDB = fdb;
  (window as unknown as { indexedDB: IDBFactory }).indexedDB = fdb;
  localStorage.clear();
  sessionStorage.clear();
  deregisterMock.mockClear();
});

const renderDangerZone = () =>
  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <DangerZone />
      </QueryClientProvider>
    </I18nProvider>
  );

describe('DangerZone reset wiring', () => {
  it('destroys the stored master key when the user confirms', async () => {
    const user = userEvent.setup();
    await passkey.encryptDataSaveKey(1, Buffer.from(FAKE_MASTER_KEY));
    // Control arm: prove it was actually stored, so a later rejection means
    // "deleted" rather than "never written".
    await expect(passkey.loadKeyDecryptData(1)).resolves.toBeDefined();

    renderDangerZone();

    await user.type(screen.getByPlaceholderText(/type reset to confirm/i), 'reset');
    await user.click(screen.getByRole('button', { name: /confirm reset/i }));

    await waitFor(async () => {
      await expect(passkey.loadKeyDecryptData(1)).rejects.toBe('no data');
    });
  });

  it('deregisters the device before destroying the key', async () => {
    const user = userEvent.setup();
    await passkey.encryptDataSaveKey(1, Buffer.from(FAKE_MASTER_KEY));

    let keyStillReadableAtDeregister: boolean | undefined;
    deregisterMock.mockImplementationOnce(async () => {
      // The deregistration signs with the master key, so it has to still be
      // there at this point. Ordering the wipe first would strand the device's
      // hub entry and its space signing admission.
      keyStillReadableAtDeregister = await passkey
        .loadKeyDecryptData(1)
        .then(() => true)
        .catch(() => false);
      return { hub: 'ok', spaces: 'ok' };
    });

    renderDangerZone();
    await user.type(screen.getByPlaceholderText(/type reset to confirm/i), 'reset');
    await user.click(screen.getByRole('button', { name: /confirm reset/i }));

    await waitFor(() => expect(deregisterMock).toHaveBeenCalled());
    expect(keyStillReadableAtDeregister).toBe(true);
  });

  it('does nothing until the confirmation word is typed', async () => {
    const user = userEvent.setup();
    await passkey.encryptDataSaveKey(1, Buffer.from(FAKE_MASTER_KEY));

    renderDangerZone();
    await user.click(screen.getByRole('button', { name: /confirm reset/i }));

    expect(deregisterMock).not.toHaveBeenCalled();
    await expect(passkey.loadKeyDecryptData(1)).resolves.toBeDefined();
  });
});
