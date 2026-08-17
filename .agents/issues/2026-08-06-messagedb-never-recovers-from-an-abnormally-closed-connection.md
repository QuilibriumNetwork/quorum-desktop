---
type: bug
title: "MessageDB never recovers from an abnormally closed IndexedDB connection, breaking all persistence for the rest of the session"
status: in-progress
priority: high
created: 2026-08-06
updated: 2026-08-17
severity: session-wide — one closed connection breaks every read and write in the app (messages, config, space members) until a full page reload
area: IndexedDB connection lifecycle
repos: quorum-desktop
related:
  - ".agents/issues/.open/2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md"
  - ".agents/issues/.open/2026-08-06-a-message-read-failure-is-presented-as-a-server-outage-or-a-redirect-home.md"
---

# MessageDB never recovers from an abnormally closed IndexedDB connection

Found by an error-handling audit while fixing the two "channel shows as empty"
bugs. **Not caused by that change** — this is pre-existing, and it is filed
separately rather than folded in because it alters DB lifecycle behaviour and
deserves its own testing.

## The defect

`MessageDB.init()` ([src/db/messages.ts:230](../../../src/db/messages.ts)) returns
early whenever `this.db` is truthy:

```ts
async init() {
  if (this.db) return;
  ...
}
```

The **only** place `this.db` is ever reset to `null` is the `onversionchange`
handler. There is no `onclose` handler, so when the browser force-closes the
connection — storage eviction, corruption, the Safari 7-day ITP wipe already
tracked separately — `this.db` is left holding a **closed but non-null**
`IDBDatabase`.

Every method in the class then does `this.db!.transaction(store, mode)`, which
throws `InvalidStateError` on a closed connection. And because
`MessageDBProvider` builds the instance once for the whole app lifetime
(`useMemo(() => new MessageDB(), [])`, `src/components/context/MessageDB.tsx:280`),
the fault is not scoped to one read: **every** message, config, space-member and
encryption-state operation fails for the rest of that tab's session.

## Why the user sees something misleading rather than an error

The throw happens inside a `new Promise` executor, so it becomes a rejection
rather than a hang. That rejection then flows into whichever boundary owns the
route, and both of those present it as something it isn't — see the related
issue.

## Suggested fix

```ts
this.db.onclose = () => {
  this.db = null; // let the next init() reopen transparently
};
```

Feature-detect if older Safari is a target. Worth pairing with a test that
force-closes the connection and asserts the next read succeeds — `fake-indexeddb`
may not simulate an abnormal close, so this might need a real-browser check.

## Status

Fixed on branch `fix/messagedb-recover-from-forced-close` (2026-08-17), exactly
the `onclose` handler suggested above, in `MessageDB.init()`.

**`fake-indexeddb` CAN simulate an abnormal close** — the doubt recorded above is
resolved. It ships `forceCloseDatabase()` (exported from the package root and
from `fake-indexeddb/lib/forceCloseDatabase`), which runs the spec's
closing-connection steps with the forced flag set and dispatches a real `close`
event. No real-browser harness was needed to get a regression test.

Verification (MEASURED, `src/dev/tests/db/messageDbForcedClose.test.ts`):

- Without the fix, 2 of 3 tests fail — reproducing `InvalidStateError` thrown
  from `FDBDatabase.transaction`, which is the exact symptom described above.
- With the fix, 3 of 3 pass. Full suite 1479/1479 across 161 files, `tsc
  --noEmit` clean, no new lint (the one warning in `messages.ts` predates this).
- The suite includes a **control arm** (a read with no close at all) that passes
  in both directions, so the red is attributable to the forced close.

### Three further defects found in review, all fixed on the same branch

An independent review pass (correctness, silent-failure and test-coverage
reviewers, fresh context) found three problems. Two were in the `onclose` fix as
first written, one was pre-existing in the same method. All are fixed here, each
with a test verified to fail without its guard.

**1. Handlers bound to the field, not to their own connection.** Found
independently by two reviewers. `onversionchange` and the new `onclose` both did
a bare `this.db = null`, with no check that the connection firing the event was
still the current one. They now capture `const connection = request.result` and
clear only on identity match. Without this, a stale connection's close event
wipes the reference to a healthy one.

**2. `init()` had no in-flight guard, so concurrent callers each opened their own
connection.** The last `onsuccess` won the field and the rest were orphaned:
still open, never closed, and able to block a later `onupgradeneeded`
indefinitely — the exact state the neighbouring `onblocked` handler warns about.
Dozens of React Query fetchers hit the DB in parallel on mount, so this was
routine at cold start rather than exotic. `init()` now shares one in-flight
promise, cleared on both settle paths so a failed open can still be retried.

**3. The recovery was completely silent.** A forced close fires *only* on an
abnormal close (never on our own `close()`), so every occurrence means the
browser destroyed or invalidated the store. Recovering without a trace meant the
app would reopen onto a possibly-wiped database, look empty-but-healthy, and
leave no evidence the user's history had just been lost. This directly concerns
the unmeasured population in
`.agents/issues/.open/2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md`.
Now logged via `logger.warn`, matching the `onblocked` pattern in the same
method. **Caveat:** `logger` is a no-op in production builds
(`.agents/issues/.open/2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md`),
so this buys local diagnosability only. Real field visibility needs that issue
fixed, or a durable breadcrumb outside IndexedDB.

Final verification: 7/7 in this file, **1483/1483** full suite across 161 files,
`tsc --noEmit` clean, no new lint. Reverting the guards turns the three new tests
red for their own specific reasons.

### Known limit: a call landing mid-close still fails once

Not anticipated in the original write-up, found while fixing. `closeConnection`
marks the connection closing **synchronously** but defers the `close` event
whenever a transaction is still unfinished. During that window
`db.transaction()` already throws while `this.db` is still non-null, because the
handler has not run yet. Real browsers have the same window: the spec fires
`close` only after in-flight transactions finish aborting.

So the fix downgrades the fault from *permanent* (every call for the rest of the
session) to *one failed call, then transparent recovery*. That is the intended
scope, and it is a large improvement, but it is not "no user-visible error". A
caller unlucky enough to land in the window still gets the misleading
presentation described in the related issue.

Closing that window fully means retrying once on `InvalidStateError` at the point
transactions are created. There are 104 `this.db!.transaction(...)` call sites,
so it wants a private helper rather than 104 edits — **worth its own issue, not
this one**.

This race is also why the first version of the regression test was flaky: it
waited a fixed `setTimeout(0)`, which passed in isolation and failed under
full-suite CPU load. It now polls for the handler's actual effect.

## Why it was not fixed in the same change

The "channel is empty" fix was scoped to the message read path and its cache
keys. This one changes when the database reopens, which touches every consumer
in the app. It should land on its own, with its own verification.

---
*Last updated: 2026-08-17*
