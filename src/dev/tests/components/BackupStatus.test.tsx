import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import BackupStatus from '@/components/modals/UserSettingsModal/BackupStatus';
import { recordLastBackup, BACKUP_MAX_AGE_MS } from '@/utils/lastBackup';

/**
 * A reminder that only fires when the user is genuinely exposed.
 *
 * "Renders nothing" is the load-bearing assertion in this file, not an absence
 * of one. Three separate conditions each have to silence it, and a regression in
 * any of them turns a targeted warning into permanent furniture that everyone
 * learns to ignore — at which point it protects nobody, including the sync-off
 * user it exists for.
 *
 * The inverse matters just as much: the shown-arm test is what stops the whole
 * component being silently dead. A file that only asserted silence would pass
 * against a component that returns null unconditionally.
 */
beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

beforeEach(() => {
  // The component reads its record straight from localStorage, so each case has
  // to start from "nothing recorded" or an earlier case's backup would silence
  // the next one.
  localStorage.clear();
});

const noop = () => {};

describe('BackupStatus', () => {
  describe('says nothing when there is nothing to warn about', () => {
    it('when sync is ON — Spaces, keys and profile come back on login', () => {
      const { container } = render(
        <BackupStatus allowSync={true} onGoToBackup={noop} />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('when the config has not loaded yet', () => {
      // `allowSync` is false before load, which would otherwise read as
      // "sync off" and flash the warning at every sync-ON user on open.
      const { container } = render(
        <BackupStatus allowSync={undefined} onGoToBackup={noop} />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('when sync is off but a recent backup exists', () => {
      recordLastBackup(Date.now());
      const { container } = render(
        <BackupStatus allowSync={false} onGoToBackup={noop} />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('when the backup is just inside the 30-day window', () => {
      recordLastBackup(Date.now() - (BACKUP_MAX_AGE_MS - 60_000));
      const { container } = render(
        <BackupStatus allowSync={false} onGoToBackup={noop} />
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('warns when this device is the only copy', () => {
    it('sync off and no backup ever taken', () => {
      render(<BackupStatus allowSync={false} onGoToBackup={noop} />);
      expect(
        screen.getByText(/only copy of your messages and Spaces/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save a backup/i })
      ).toBeInTheDocument();
    });

    it('sync off and the backup has aged past the window', () => {
      recordLastBackup(Date.now() - (BACKUP_MAX_AGE_MS + 60_000));
      render(<BackupStatus allowSync={false} onGoToBackup={noop} />);
      expect(
        screen.getByText(/only copy of your messages and Spaces/i)
      ).toBeInTheDocument();
    });

    it('a corrupt stored record counts as no backup, not as a valid one', () => {
      // Failing OPEN here would silence the warning for anyone whose record got
      // mangled — the safe direction is to warn.
      localStorage.setItem('quorum:backup:lastBackup', 'not json');
      render(<BackupStatus allowSync={false} onGoToBackup={noop} />);
      expect(
        screen.getByText(/only copy of your messages and Spaces/i)
      ).toBeInTheDocument();
    });

    it('the link routes to the backup section', () => {
      const onGoToBackup = vi.fn();
      render(<BackupStatus allowSync={false} onGoToBackup={onGoToBackup} />);
      fireEvent.click(screen.getByRole('button', { name: /save a backup/i }));
      expect(onGoToBackup).toHaveBeenCalledTimes(1);
    });
  });

  describe('the copy makes no promise the restore cannot keep', () => {
    it('does not name a single browser as the cause', () => {
      // The risk is identical for a cleared site, a dead laptop or an automatic
      // eviction. Naming Safari would let everyone else conclude they are safe.
      const { container } = render(
        <BackupStatus allowSync={false} onGoToBackup={noop} />
      );
      expect(container.textContent).not.toMatch(/safari/i);
    });

    it('does not claim conversations are restored', () => {
      // A .qmbak brings back history and Spaces, but DM ratchet state is
      // deliberately never restored, so existing chats resume on a NEW session.
      const { container } = render(
        <BackupStatus allowSync={false} onGoToBackup={noop} />
      );
      expect(container.textContent).not.toMatch(/restore your conversations/i);
    });
  });
});
