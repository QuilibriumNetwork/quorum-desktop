/**
 * Desktop's store for when a `.qmbak` backup was last taken.
 *
 * Exists so the app can tell "this user has a backup" from "this user has
 * never taken one", which nothing recorded before. That distinction is what
 * lets the reminder in Settings clear itself when the user acts, instead of
 * needing a dismiss button — a dismissed warning would silence the message
 * while leaving the user just as exposed.
 *
 * Deliberately mirrors `lastPublish.ts`: same localStorage shape, same
 * never-throw contract, same device-local scope. It is NOT part of UserConfig.
 * Taking a backup is a per-device act, so syncing it would tell every other
 * device it was covered when it was not, and would rewrite the synced blob on
 * every export.
 *
 * ## The record is destroyed by the event it guards against, and that is correct
 *
 * localStorage is script-writable storage, so the same eviction that removes
 * IndexedDB removes this too (Safari ITP, "clear site data", a new device). The
 * restored user therefore reads "no backup on record" and is warned again —
 * which is right, because the backup file they took is no longer *on* this
 * device and the fresh database is once more the only copy.
 *
 * See .agents/issues/.open/2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md (M4)
 */

const KEY = 'quorum:backup:lastBackup';

/**
 * Local for now rather than in quorum-shared. Mobile has no equivalent reminder
 * yet, and a one-field shape is not worth a cross-repo build to share. Move it
 * when mobile grows the same callout — that is the moment the shape has two
 * consumers and can actually drift.
 */
export interface LastBackup {
  /** Epoch ms of the last SUCCESSFUL export. */
  at: number;
}

/**
 * How long a backup counts as current.
 *
 * Not a safety guarantee, a nagging interval: past this the reminder returns.
 * Short enough that a stale file does not quietly become the plan, long enough
 * that it is not furniture — permanent furniture stops being read, which is the
 * reasoning `PasskeyStatus` already states for rendering nothing on the healthy
 * path.
 */
export const BACKUP_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Never throws. An instrument that can break the path it measures is worse than
 * no instrument, and this one sits on the export path.
 */
export function recordLastBackup(at: number = Date.now()): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const entry: LastBackup = { at };
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // Quota, private mode, a serialisation edge — losing one reading is fine.
    // Worst case the user is reminded again sooner than necessary.
  }
}

/** Returns null when nothing has been recorded yet, or the stored value is unusable. */
export function readLastBackup(): LastBackup | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as LastBackup).at !== 'number' ||
      !Number.isFinite((parsed as LastBackup).at)
    ) {
      return null;
    }
    return parsed as LastBackup;
  } catch {
    return null;
  }
}

/**
 * Is there a backup recent enough to stay quiet about?
 *
 * A future timestamp counts as current rather than stale. It can only come from
 * a clock change, and the failure mode of the alternative — treating it as
 * stale — is nagging someone who just took a backup, which is the one user this
 * feature should never bother.
 */
export function hasCurrentBackup(
  last: LastBackup | null = readLastBackup(),
  now: number = Date.now()
): boolean {
  if (!last) return false;
  return now - last.at < BACKUP_MAX_AGE_MS;
}
