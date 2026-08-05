// A one-shot gate the on-connect space announce waits on.
//
// The announce reads our own per-space override off the roster row and re-sends it.
// If it runs before the legacy-override clear has landed, it re-announces the stale
// value with a fresh timestamp and repoisons the row — the mechanism that made those
// names permanent in the first place. The announce fires from a startup timer AND
// from setResubscribe, and that path has raced app initialisation before.
//
// Deliberately dependency-free: both MessageService and the migration hook import
// it, and anything heavier here would close an import cycle between them.

let release: (() => void) | undefined;

/** Resolves once the clear has run, been skipped, or failed. */
export const legacySpaceOverrideClearDone: Promise<void> = new Promise<void>(
  (resolve) => {
    release = resolve;
  }
);

/**
 * Let the announce proceed. Safe to call more than once.
 *
 * Call it even when the clear FAILS: a migration that threw must not silence the
 * identity announce for the rest of the session — that would trade a stale name for
 * an invisible member, which is worse.
 */
export function releaseLegacySpaceOverrideClearGate(): void {
  release?.();
}
