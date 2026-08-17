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

Found while fixing the `onclose` bug, and deliberately left out of that change to
keep it reviewable. That fix is a prerequisite for this one.

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
    if ((err as DOMException)?.name !== 'InvalidStateError') throw err;
    this.db = null;      // the handle is closing or closed
    await this.init();   // reopen, then let this attempt stand or fail honestly
    return this.db!.transaction(stores, mode);
  }
}
```

There are **104** `this.db!.transaction(...)` call sites, which is why this wants
a helper and its own review pass rather than being folded into the `onclose`
change.

## Testing notes

`fake-indexeddb`'s `forceCloseDatabase()` makes this reproducible — see
`src/dev/tests/db/messageDbForcedClose.test.ts` for the working pattern.

Hitting the window deterministically is the hard part: it only exists while a
transaction is unfinished, so the test needs a write in flight at the moment of
the forced close. Do not reach for a fixed `setTimeout` to arrange it; that is
exactly what made the first version of the sibling test flaky under load.

---
*Last updated: 2026-08-17*
