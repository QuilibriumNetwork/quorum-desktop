---
type: bug
title: "MessageDB never recovers from an abnormally closed IndexedDB connection, breaking all persistence for the rest of the session"
status: open
priority: high
created: 2026-08-06
updated: 2026-08-06
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

## Why it was not fixed in the same change

The "channel is empty" fix was scoped to the message read path and its cache
keys. This one changes when the database reopens, which touches every consumer
in the app. It should land on its own, with its own verification.

---
*Last updated: 2026-08-06*
