/**
 * Desktop's store for the last config publish outcome.
 *
 * Before this existed, a device could not tell whether its config reached the
 * server, for any reason. Sync being off, a refuse-to-publish hold and a genuine
 * successful upload all write the local row and all look identical, so "my
 * setting saved" was never evidence that it synced.
 *
 * The shape lives in quorum-shared; only the storage is per-platform
 * (localStorage here, MMKV on mobile). The record is device-local and never
 * enters UserConfig — in the synced blob it would broadcast a per-device fact to
 * every other device, rewrite the blob on every save, and grow the very payload
 * this instrument exists to watch.
 * See .agents/issues/.open/2026-08-08-record-and-show-what-the-last-config-publish-actually-did.md
 */

import type { PublishOutcome, LastPublish } from '@quilibrium/quorum-shared';

export type { PublishOutcome, LastPublish };

const KEY = 'quorum:sync:lastPublish';

/**
 * A rejection whose message says the request never completed rather than that
 * the server disliked it. Worth separating because the two mean opposite things
 * to a user: a timeout is "will retry", a rejection is "this will not work".
 */
export function classifyPublishError(error: unknown): 'rejected' | 'timeout' {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|ETIMEDOUT|ECONNABORTED|aborted|network error/i.test(
    message
  )
    ? 'timeout'
    : 'rejected';
}

/**
 * Never throws. An instrument that can break the path it measures is worse than
 * no instrument — the whole point is that config sync keeps working.
 */
export function recordLastPublish(
  outcome: PublishOutcome,
  details: Omit<LastPublish, 'at' | 'outcome'> = {}
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const entry: LastPublish = { at: Date.now(), outcome, ...details };
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // Quota, private mode, a serialisation edge — losing one reading is fine.
  }
}

/** Returns null when nothing has been recorded yet, or the stored value is unusable. */
export function readLastPublish(): LastPublish | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as LastPublish).at !== 'number' ||
      typeof (parsed as LastPublish).outcome !== 'string'
    ) {
      return null;
    }
    return parsed as LastPublish;
  } catch {
    return null;
  }
}
