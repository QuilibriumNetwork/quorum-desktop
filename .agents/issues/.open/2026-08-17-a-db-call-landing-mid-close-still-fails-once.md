---
type: task
title: "Retry once on InvalidStateError so a DB call landing mid-close recovers instead of failing"
status: open
priority: medium
created: 2026-08-17
updated: 2026-08-17
severity: one failed read or write per forced close, presented to the user as a server outage
area: IndexedDB connection lifecycle
repos: quorum-desktop
related:
  - ".agents/issues/2026-08-06-messagedb-never-recovers-from-an-abnormally-closed-connection.md"
  - ".agents/issues/.open/2026-08-06-a-message-read-failure-is-presented-as-a-server-outage-or-a-redirect-home.md"
---

# A DB call landing mid-close still fails once

Found while fixing the `onclose` bug (shipped in PR #346), and deliberately left
out of that change to keep it reviewable. That fix is a prerequisite for this one.

## ⛔ Do not start this without evidence first

Recommendation made 2026-08-17, when the sizing was looked at properly rather
than assumed. **This is not queued work. It needs a reason before it is built.**

The cost is 104 hand-edits restructuring transaction creation across the whole
storage layer, in a file whose test coverage reaches perhaps a fifth of those
methods. Most edits would land with nothing watching them.

The benefit is narrow. The window is open only for the few milliseconds a dying
connection spends aborting its work, during an event (eviction, corruption, ITP
wipe, cleared site data) that is itself rare. The consequence is bounded and
self-healing: a handful of operations fail, then it recovers. The permanent
session-wide wedge, which was the actual problem, is already fixed.

On the standing rule of scaling rigour to blast radius, a large mechanical
refactor of the storage layer to remove a brief self-healing hiccup is the wrong
trade.

**The instrument now exists.** PR #346 added a `logger.warn` on every forced
close. Once
`.agents/issues/.open/2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md`
is fixed so that signal escapes production, we can see whether forced closes
happen to real users at all, and how often. Build this if that data says it
matters. Do not build it on the reasoning that it is theoretically incomplete.

## The remaining gap

The closing of an IndexedDB connection is not atomic. The connection is marked
as closing **synchronously**, but the `close` event fires only once in-flight
transactions have finished aborting. Both the spec and `fake-indexeddb`'s
`closeConnection` behave this way.

`MessageDB` now clears its handle in `onclose`, so it reopens transparently on
the next call. But a call that lands *inside* that window sees a handle that is
still non-null and a connection that already refuses transactions, so
`this.db!.transaction(...)` throws `InvalidStateError` and that one call fails.

Impact is one failed read or write per forced close, not a wedged session. It
still reaches the user as the misleading "server outage" or redirect-home
presentation tracked in the related issue.

## Suggested fix

Funnel transaction creation through a private helper that retries once:

```ts
private async tx(stores: string | string[], mode: IDBTransactionMode) {
  await this.init();
  try {
    return this.db!.transaction(stores, mode);
  } catch (err) {
    if (!this.isClosedConnectionError(err)) throw err;
    this.db = null;      // the handle is closing or closed
    await this.init();   // reopen, then let this attempt stand or fail honestly
    return this.db!.transaction(stores, mode);
  }
}
```

There are **104** `this.db!.transaction(...)` call sites, which is why this wants
a helper and its own review pass rather than being folded into the `onclose`
change.

## ⚠️ Do not match on `InvalidStateError` alone

The obvious guard — `if (err.name !== 'InvalidStateError') throw err` — is
wrong, and this is the main reason the `onclose` fix was kept as a separate,
independently useful change rather than being replaced by this one.

`IDBDatabase.transaction()` throws `InvalidStateError` for **two unrelated
reasons**, and the error carries nothing that distinguishes them
(READ: `node_modules/fake-indexeddb/build/esm/FDBDatabase.js:129-137`, two
separate throw sites, same error type):

1. the connection is closing or closed — retrying after a reopen is correct;
2. **a versionchange transaction is currently running** — retrying is actively
   harmful. The helper would discard a perfectly healthy connection and reopen
   mid-upgrade, turning a transient wait into a wedged database.

So the retry needs a positive test that the connection is actually gone, not
just that this error name appeared. Options, in preference order:

- track a flag set by the `onclose` handler (which by spec fires *only* on an
  abnormal close, never on our own `close()`) and retry only when it is set;
- track whether an upgrade is in flight and refuse to retry during one.

The first reuses machinery that already exists after the `onclose` change and is
the reason these two fixes are complementary rather than redundant: `onclose`
answers "did the connection really die?" precisely, where the error name cannot.

## Testing notes

`fake-indexeddb`'s `forceCloseDatabase()` makes this reproducible — see
`src/dev/tests/db/messageDbForcedClose.test.ts` for the working pattern.

Hitting the window deterministically is the hard part: it only exists while a
transaction is unfinished, so the test needs a write in flight at the moment of
the forced close. Do not reach for a fixed `setTimeout` to arrange it; that is
exactly what made the first version of the sibling test flaky under load.

---
*Last updated: 2026-08-17*
