import * as React from 'react';
import { t } from '@lingui/core/macro';
import { Callout } from '../../primitives';
import { hasCurrentBackup } from '../../../utils/lastBackup';

/**
 * Warns when this device is the only copy of the user's data. Renders nothing
 * at all otherwise.
 *
 * Silence means covered, matching `PasskeyStatus` directly above and
 * `SyncStatusLine` in this same folder. A standing "your data is safe" banner
 * would be permanent furniture on the healthy path, and permanent furniture
 * stops being read.
 *
 * ## Why sync-off is the trigger
 *
 * With `allowSync` off — the DEFAULT, and a deliberate product decision — the
 * server holds nothing for this account: no profile, no Spaces, no Space keys.
 * `saveConfig` builds `spaceKeys` and calls `postUserSettings` only inside
 * `if (config.allowSync)` (ConfigService.ts:695, :864), so nothing is ever
 * published. A `.qmbak` file is then the user's entire safety net.
 *
 * Measured, not assumed: `space-wipe-restore` under
 * `src/dev/tests/harness/` evicts two accounts that differ only in this flag.
 * The sync-on account gets its Space, keys and profile back on login; the
 * sync-off account gets nothing. See
 * `.agents/issues/.open/2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md`.
 *
 * A sync-ON user is not warned, because their Spaces and profile do come back.
 * Their DM history still does not, which is a real gap this callout stays quiet
 * about deliberately: warning everyone permanently is how a warning becomes
 * wallpaper, and the sync-off user is the one who loses everything.
 *
 * ## Why there is no dismiss button
 *
 * The condition IS the dismissal: take a backup and this disappears for 30 days
 * (`BACKUP_MAX_AGE_MS`). An X would let someone silence the warning without
 * taking the backup, leaving them equally exposed and no longer told — which is
 * worse than never showing it, because it manufactures the false confidence
 * this whole reminder exists to prevent.
 *
 * ## What the copy does not say
 *
 * It does not name Safari. The risk is identical whether the browser evicts
 * storage on a timer, the user clears site data, or the laptop dies, and naming
 * one cause would let everyone else conclude they are safe.
 *
 * It also does not promise a full restore. A `.qmbak` brings back Spaces, keys
 * and message history, but existing DM conversations resume on a NEW session
 * because ratchet state is deliberately never restored. That caveat belongs
 * next to the export button, not in a two-sentence callout.
 */
const BackupStatus: React.FunctionComponent<{
  /** This device's sync setting. Undefined while the config is still loading. */
  allowSync: boolean | undefined;
  /** Switch the settings modal to the tab holding Data Backup. */
  onGoToBackup: () => void;
  className?: string;
}> = ({ allowSync, onGoToBackup, className }) => {
  // Config still loading. Rendering the warning here would flash it at every
  // sync-ON user on every open, which is the fastest way to teach people to
  // ignore it.
  if (allowSync === undefined) return null;

  // Sync is on: profile, Spaces and Space keys are recoverable from the server.
  if (allowSync) return null;

  // Read at render rather than in state. This only has to be correct when the
  // panel is drawn, and an export elsewhere in the modal re-renders it — the
  // same reason `SyncStatusLine` re-reads its record rather than caching it.
  if (hasCurrentBackup()) return null;

  return (
    <div className={className}>
      {/*
        No <Icon> here. Callout renders its own variant icon, so adding the
        matching one gives two triangles side by side.
      */}
      <Callout variant="warning" size="sm" className="w-full">
        {/*
          `text-sm` on the text AND the link. A bare <button> keeps the UA
          font-size under Tailwind's preflight (`font-size: 100%`), which does
          not resolve to the callout's size, so the link renders visibly larger
          than the sentence it sits in.
        */}
        <div className="text-sm">
          {t`Sync is off, so this device holds the only copy of your messages and Spaces. A backup file is the only way to get them back if this browser loses its data.`}{' '}
          {/*
            `link-inline` (src/styles/_base.scss) takes the size, weight and
            colour of the sentence it sits in. A <button> rather than an <a>
            because it performs an action.
          */}
          <button type="button" onClick={onGoToBackup} className="link-inline">
            {t`Save a backup`}
          </button>
        </div>
      </Callout>
    </div>
  );
};

export default BackupStatus;
