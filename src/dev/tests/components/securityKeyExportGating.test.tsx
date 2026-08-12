/**
 * Security — the three Account Key actions are all gated.
 *
 * Two problems, both fixed, both guarded here.
 *
 * "Download file" was wired straight to `onClick={downloadKey}`: one click and
 * the unencrypted Ed448 private key was in the downloads folder. It was the
 * only one of the three with no gate at all, and the one whose consequence
 * lasts longest, since a file persists in a directory that is commonly synced
 * to cloud storage.
 *
 * "Copy key" and "Show QR" did warn, but through inline callouts rendered BELOW
 * the button row inside a scrollable panel — so on a short window the warning
 * could be off-screen entirely and the user would agree to something never
 * shown. All three now open a modal, which cannot be scrolled past.
 *
 * This drives the real component rather than asserting on the source, because
 * the failure mode is a one-character edit: swapping a handler back to the bare
 * action would leave every other test green.
 *
 * Both directions are asserted on purpose. "Not called before confirming" is
 * the regression guard; "called after confirming" is what stops that guard
 * passing for the trivial reason that the button is broken and never calls
 * anything.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { messages } from '@/i18n/en/messages';

import Security from '@/components/modals/UserSettingsModal/Security';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

/** Minimal but correctly-shaped: no devices, so the roster renders empty. */
const KEYSET = {
  deviceKeyset: {
    inbox_keyset: { inbox_address: 'QmFixtureInboxAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  },
};

function renderSecurity(overrides: Partial<React.ComponentProps<typeof Security>> = {}) {
  const props = {
    stagedRegistration: { device_registrations: [] },
    keyset: KEYSET,
    removeDevice: vi.fn(),
    downloadKey: vi.fn(),
    exportBackup: vi.fn(async () => {}),
    importBackup: vi.fn(async () => ({}) as never),
    getPrivateKeyHex: vi.fn(async () => 'deadbeef'),
    removedDevices: [],
    deviceNames: {},
    saveDeviceName: vi.fn(async () => {}),
    ...overrides,
  };
  render(
    <I18nProvider i18n={i18n}>
      <Security {...(props as React.ComponentProps<typeof Security>)} />
    </I18nProvider>
  );
  return props;
}

describe('Security — account key export gating', () => {
  it('Download file does not write the key on the first click', async () => {
    const user = userEvent.setup();
    const { downloadKey } = renderSecurity();

    await user.click(screen.getByRole('button', { name: /download file/i }));

    expect(
      downloadKey,
      'Clicking "Download file" wrote the private key to disk with no ' +
        'confirmation. It must go through the confirmation modal, like the ' +
        '"Copy key" and "Show QR" buttons next to it.'
    ).not.toHaveBeenCalled();
  });

  it('Download file writes the key once the user confirms', async () => {
    const user = userEvent.setup();
    const { downloadKey } = renderSecurity();

    await user.click(screen.getByRole('button', { name: /download file/i }));

    // Scoped to the dialog: the confirm button is just "Download", which the
    // trigger button "Download file" would also match.
    const dialog = document.querySelector('.confirmation-modal') as HTMLElement;
    expect(dialog, 'no confirmation modal opened for Download file').toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: /^download$/i }));

    await waitFor(() => expect(downloadKey).toHaveBeenCalledTimes(1));
  });

  it('cancelling the confirmation does not write the key', async () => {
    const user = userEvent.setup();
    const { downloadKey } = renderSecurity();

    await user.click(screen.getByRole('button', { name: /download file/i }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(downloadKey).not.toHaveBeenCalled();
  });

  it('the confirmation says the file is unencrypted and account-identifying', async () => {
    const user = userEvent.setup();
    renderSecurity();

    await user.click(screen.getByRole('button', { name: /download file/i }));

    // Not asserting the exact sentence — that would break on any rewording. The
    // three facts a user needs in order to decide are what must survive edits.
    const dialogText = document.body.textContent ?? '';
    expect(dialogText).toMatch(/unencrypted/i);
    expect(dialogText).toMatch(/account address/i);
    expect(dialogText).toMatch(/cloud/i);
  });

  it('Copy key does not read the key until the user confirms', async () => {
    const user = userEvent.setup();
    const { getPrivateKeyHex } = renderSecurity();

    await user.click(screen.getByRole('button', { name: /copy key/i }));

    expect(
      getPrivateKeyHex,
      'Clicking "Copy key" read the private key with no confirmation.'
    ).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^copy$/i }));
    await waitFor(() => expect(getPrivateKeyHex).toHaveBeenCalledTimes(1));
  });

  it('Show QR does not read the key until the user confirms', async () => {
    const user = userEvent.setup();
    const { getPrivateKeyHex } = renderSecurity();

    await user.click(screen.getByRole('button', { name: /show qr/i }));

    expect(
      getPrivateKeyHex,
      'Clicking "Show QR" read the private key with no confirmation.'
    ).not.toHaveBeenCalled();

    // The confirm button is also labelled "Show QR", so scope to the dialog.
    const dialog = document.querySelector('.confirmation-modal') as HTMLElement;
    expect(dialog, 'no confirmation modal opened for Show QR').toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: /show qr/i }));

    await waitFor(() => expect(getPrivateKeyHex).toHaveBeenCalledTimes(1));
  });

  it('all three Account Key actions are gated the same way', async () => {
    // The point of the redesign: Copy and Show QR used to warn through inline
    // callouts rendered below the buttons inside a scrollable panel, so on a
    // short window the warning could be off-screen when the user agreed to it.
    // If any of these three stops opening a modal, the set has drifted apart
    // again.
    const user = userEvent.setup();
    renderSecurity();

    for (const name of [/download file/i, /copy key/i, /show qr/i]) {
      await user.click(screen.getByRole('button', { name }));
      const dialog = document.querySelector('.confirmation-modal');
      expect(dialog, `"${name}" did not open a confirmation modal`).toBeTruthy();
      await user.click(within(dialog as HTMLElement).getByRole('button', { name: /^cancel$/i }));
    }
  });
});
