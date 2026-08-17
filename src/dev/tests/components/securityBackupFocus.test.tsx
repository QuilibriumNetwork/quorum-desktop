/**
 * Security — arriving from the backup reminder lands on Data Backup.
 *
 * The reminder on General says "Save a backup" and switches to this tab. Data
 * Backup is the third section down a long panel, so without this the link
 * delivers the user to a tab where the thing they came for is off screen, and
 * the callout's whole job is to get a backup taken.
 *
 * Both directions are asserted deliberately. "Scrolls when asked" is the
 * feature; "does not scroll when reached from the sidebar" is what stops the
 * panel yanking itself around on every ordinary visit. A test file with only
 * the first would pass against a component that scrolls unconditionally.
 *
 * jsdom implements no layout, so `scrollIntoView` does not exist on Element and
 * has to be stubbed. That limits what this can claim: it verifies the component
 * asks the right element to come into view, NOT that the element ends up
 * visible. Whether the scroll lands correctly inside the modal's scroll
 * container is a real-browser question.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { messages } from '@/i18n/en/messages';

import Security from '@/components/modals/UserSettingsModal/Security';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  // Not present in jsdom at all — assigning it is what makes the call
  // observable. Set per test run rather than once, so a mock left dirty by an
  // earlier case cannot read as a fresh call here.
  Element.prototype.scrollIntoView = scrollIntoView;
});

const KEYSET = {
  deviceKeyset: {
    inbox_keyset: { inbox_address: 'QmFixtureInboxAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  },
};

function renderSecurity(
  overrides: Partial<React.ComponentProps<typeof Security>> = {}
) {
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

describe('Security — focusing Data Backup', () => {
  it('brings Data Backup into view when arriving from the reminder', async () => {
    const onBackupFocused = vi.fn();
    renderSecurity({ focusBackup: true, onBackupFocused });

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

    // The element asked to scroll must be the Data Backup heading itself, not
    // merely "something on the page" — scrolling to the wrong section would
    // satisfy a bare call-count assertion while leaving the user lost.
    expect(scrollIntoView.mock.instances[0]).toBe(
      screen.getByText('Data Backup')
    );
  });

  it('moves focus to the heading, not just the scroll position', async () => {
    // A keyboard or screen-reader user who follows the link and lands with
    // focus still on the previous tab has not arrived anywhere.
    renderSecurity({ focusBackup: true, onBackupFocused: vi.fn() });

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText('Data Backup'))
    );
  });

  it('reports back so a later visit does not scroll again', async () => {
    const onBackupFocused = vi.fn();
    renderSecurity({ focusBackup: true, onBackupFocused });

    await waitFor(() => expect(onBackupFocused).toHaveBeenCalledTimes(1));
  });

  it('does NOT scroll when the tab was reached from the sidebar', async () => {
    const onBackupFocused = vi.fn();
    renderSecurity({ focusBackup: false, onBackupFocused });

    // Give the rAF the same chance to fire as the positive case gets.
    await new Promise((r) => setTimeout(r, 50));

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(onBackupFocused).not.toHaveBeenCalled();
  });

  it('defaults to not scrolling when the prop is omitted entirely', async () => {
    renderSecurity();

    await new Promise((r) => setTimeout(r, 50));

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
