---
type: bug
title: "A typing-indicator frame returns before the inbox ack, so the relay is never told to drop it — and may redeliver it on every reconnect, forever"
status: open — the code path is CONFIRMED; whether the relay actually retains these frames is NOT, and that is the whole question
priority: unknown until the one open question is answered — trivial if typing frames are not retained, significant if they are (a permanent, ever-growing reconnect backlog for every active user)
created: 2026-08-03
severity: potentially a permanent backlog source, which is upstream of every perishable-control-frame problem in the transport work
area: space message receive path / inbox ack / typing indicators
repos: quorum-desktop
related_bugs:
  - "2026-08-03-a-space-frame-that-fails-to-decrypt-is-deleted-from-the-relay.md (same ack path, opposite failure — that one over-deletes, this one may never delete)"
  - "2026-08-02-sync-requests-arrive-four-minutes-late-and-every-peer-rejects-them.md (if confirmed, this feeds the backlog that issue is about)"
  - "2026-07-20-announce-keys-flooding-unbounded-admissions.md (the other known backlog source)"
---

# A typing frame returns before the ack

## What is CONFIRMED (READ)

`handleNewMessage` intercepts typing control messages and returns immediately:

```js
// src/services/MessageService.ts:4675-4683
const isTypingMessage = … (innerMsg.type === 'typing-start' || innerMsg.type === 'typing-stop');
if (isTypingMessage) {
  if (this.typingService) {
    this.typingService.onTypingReceived(innerMsg as TypingMessage);
  }
  return;                       // ← exits handleNewMessage entirely
}
```

That `return` is **before** the inbox-cleanup tail (~`:6400`), which is the only
place a space frame is acked. The relay's model is retain-until-the-client-deletes,
and **the delete IS the ack**.

So: a typing frame is processed, and the relay is never told we are done with it.

## What is NOT confirmed — and it decides everything

**Does the relay actually retain typing frames?**

If it does, every `typing-start` / `typing-stop` ever sent in any of your spaces
accumulates in your inbox and is redelivered on **every** subsequent `listen`.
For an active user that is a large, permanently growing backlog that no amount
of client-side scheduling work can fix — and it would sit upstream of the entire
perishable-control-frame investigation.

If it does not — if typing frames are ephemeral, or never enter the retained
inbox at all — this is a harmless dead branch and the issue can be closed in a
line.

⚠️ **Do not guess.** The relay is not in this repo or in `quorum-shared`, so this
cannot be settled by reading client code.

## How to answer it cheaply

The harness can measure it directly, and this is the reason to do it there rather
than by hand:

1. Two bots in a shared space. Bot A sends typing indicators; B receives them.
2. B disconnects and reconnects.
3. Read `B.transport.arrived` and count typing frames before vs after.

**Redelivered after a reconnect ⇒ retained ⇒ this is real and probably serious.**
Absent after a reconnect ⇒ not retained ⇒ close this.

The harness has no typing support today, so this needs a small addition — but it
is a bounded one, and the answer is binary.

## If it is confirmed

The fix is likely one line in shape: ack the frame before returning, the same way
every other processed frame is. The care needed is in not regressing the
interception itself (typing messages are sealed hub-envelope-only, with no Triple
Ratchet wrap, which is why the early return exists at all — see the comment above
it).

Check the same file for **other** early returns that bypass the ack tail while
you are there. This one was found incidentally during #305; nothing has
systematically audited that path for the same shape.
