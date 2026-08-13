import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import PasskeyStatus from '@/components/modals/UserSettingsModal/PasskeyStatus';

/**
 * The discriminator under test is the SDK's literal `not-passkey` credential
 * id, written when registration takes the fallback path. If the SDK ever
 * changes that sentinel, every account silently reads as protected and this
 * warning disappears for the people who most need it — so the sentinel is
 * asserted here explicitly rather than assumed.
 *
 * "Renders nothing" is a real assertion in this file, not an absence of one:
 * the component is warning-only, and a banner on the protected path is the
 * regression to catch.
 */
const mockPasskeyInfo = vi.hoisted(() => ({ current: null as unknown }));
const mockElectron = vi.hoisted(() => ({ current: false }));

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  usePasskeysContext: () => ({ currentPasskeyInfo: mockPasskeyInfo.current }),
}));

vi.mock('@/utils/platform', () => ({
  isElectron: () => mockElectron.current,
  isWeb: () => true,
}));

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

beforeEach(() => {
  mockPasskeyInfo.current = null;
  mockElectron.current = false;
});

const withCredential = (credentialId: string) => {
  mockPasskeyInfo.current = {
    credentialId,
    address: 'QmPeerA1b2c3d4e5f6',
    publicKey: 'ab12cd34',
    completedOnboarding: true,
  };
};

describe('PasskeyStatus', () => {
  describe('says nothing when there is nothing to warn about', () => {
    it('when a real passkey holds the key', () => {
      withCredential('credential-abc123');
      const { container } = render(<PasskeyStatus />);
      expect(container).toBeEmptyDOMElement();
    });

    it('when onboarding has not stored any credentials yet', () => {
      mockPasskeyInfo.current = null;
      const { container } = render(<PasskeyStatus />);
      expect(container).toBeEmptyDOMElement();
    });

    it('when the stored record has no credential id at all', () => {
      mockPasskeyInfo.current = { credentialId: '', address: 'QmPeerA1b2c3' };
      const { container } = render(<PasskeyStatus />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('warns on the fallback path', () => {
    beforeEach(() => {
      withCredential('not-passkey');
    });

    it('names the consequence rather than only the mechanism', () => {
      render(<PasskeyStatus />);
      expect(
        screen.getByText(/could take over your account/i)
      ).toBeInTheDocument();
    });

    it('offers the explanation without opening it unprompted', () => {
      render(<PasskeyStatus />);
      expect(
        screen.getByRole('button', { name: /how to add a passkey/i })
      ).toBeInTheDocument();
      // The modal body must not be on screen until asked for.
      expect(
        screen.queryByText(/On a device that supports passkeys/i)
      ).toBeNull();
    });
  });

  describe('the explanation modal', () => {
    beforeEach(() => {
      withCredential('not-passkey');
      render(<PasskeyStatus />);
      fireEvent.click(
        screen.getByRole('button', { name: /how to add a passkey/i })
      );
    });

    it('tells the user to back up before resetting', () => {
      const steps = screen.getAllByRole('listitem').map((li) => li.textContent);
      expect(steps.join(' | ')).toMatch(/Data Backup/i);
      expect(steps.join(' | ')).toMatch(/reset the app/i);
      // Order matters more than presence: a reset before the backup loses
      // everything. The backup step must come first.
      const backupAt = steps.findIndex((s) => /Data Backup/i.test(s ?? ''));
      const resetAt = steps.findIndex((s) => /reset the app/i.test(s ?? ''));
      expect(backupAt).toBeLessThan(resetAt);
    });

    it('never tells the user to delete the key file', () => {
      // After the reset the key file is the ONLY way back into the account, so
      // "delete it when you're done" is the most damaging sentence this modal
      // could carry. Asserted as an absence because that is the failure mode.
      const body = document.body.textContent ?? '';
      expect(body).not.toMatch(/delete the (key )?file/i);
    });

    it('says the key file is what gets the account back', () => {
      expect(
        screen.getByText(/the only way back into your account/i)
      ).toBeInTheDocument();
    });

    it('opts in to showing its title inside the settings modal', () => {
      // `.modal-complex-wrapper .quorum-modal-title` is `display: none`, so a
      // modal opened from within settings renders its title into the DOM and
      // shows nothing. The opt-in class is the only thing making it visible,
      // and losing it is invisible to every other assertion here.
      expect(document.querySelector('.modal-keeps-title')).not.toBeNull();
      expect(screen.getByText('Add a passkey')).toBeInTheDocument();
    });
  });

  describe('on Electron, where a passkey is impossible', () => {
    beforeEach(() => {
      mockElectron.current = true;
      withCredential('not-passkey');
      render(<PasskeyStatus />);
      fireEvent.click(
        screen.getByRole('button', { name: /how to add a passkey/i })
      );
    });

    it('says plainly that the desktop app cannot use passkeys', () => {
      expect(
        screen.getByText(/Quorum for desktop cannot use passkeys/i)
      ).toBeInTheDocument();
    });

    it('never advises a reset', () => {
      // The whole reason this branch exists. The SDK forces the fallback on
      // Electron unconditionally, so a reset destroys Space history and still
      // produces no passkey. Advising one here would be actively harmful.
      expect(screen.queryByText(/reset the app/i)).toBeNull();
      expect(screen.queryByText(/Danger Zone/i)).toBeNull();
    });

    it('sends the user to a browser instead', () => {
      const steps = screen.getAllByRole('listitem').map((li) => li.textContent);
      expect(steps.join(' | ')).toMatch(/import that file/i);
      expect(
        screen.getByText(/this desktop app carries on working/i)
      ).toBeInTheDocument();
    });
  });
});
