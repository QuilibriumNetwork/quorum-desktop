---
type: bug
title: "A typing-indicator frame returns before the inbox ack, so the relay is never told to drop it — and may redeliver it on every reconnect, forever"
status: done
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

## ✅ CONFIRMED AND FIXED — desktop #308, 2026-08-03

It was not just plausible; it was measured. `yarn harness space-typing` runs both
arms in one run, one reconnect, with an ordinary post as the control:

| | POST (control) | TYPING | total frames redelivered |
|---|---|---|---|
| before | 0x | **2x** | 1 |
| after | 0x | **0x** | **0** |

The control arm is what makes it conclusive: it proves the harness models acking
correctly, so the typing result is not an artefact of the instrument.

**Fix:** ack before returning, via a new `MessageService.ackSpaceFrame` helper.
It was extracted rather than inlined precisely because the ack had ONE call site
and every early return past it leaked a frame permanently — which is how this
survived. Guarded by a unit test (confirmed load-bearing) plus the harness
scenario above.

⚠️ **The remaining open question is scope, not existence.** This fixed the typing
path. Nothing has systematically audited the space receive path for OTHER early
returns that skip the ack — the audit that found this one covered the bare
`return;` statements in `handleNewMessage` and cleared the rest, but that was a
manual pass, not a proof. See "Cross-repo" below for the mobile angle.

## Cross-repo: mobile is exposed on the space path only

`quorum-mobile/.agents/issues/.open/2026-07-24-typing-indicators-and-toggles-port.md`
is ready for implementation and **its slice 3 would reproduce this bug**.

- **Slice 2 (DM) is safe.** It extends `handleDmReceipt`, and every call site
  already does `deleteProcessedEnvelope(...)` immediately before returning
  (`context/WebSocketContext.tsx:2983-2986`, `:3330-3333`).
- **Slice 3 (space) is exposed.** It adds a NEW intercept at the space
  decrypt/parse sites and the task text says only "intercept … before the message
  is treated as a post". Mobile acks per-branch rather than in one tail, so an
  intercept that returns early without `deleteProcessedEnvelope` leaks exactly
  the way desktop did.

That task has been annotated with this requirement.

---

# Original report

> **Deliberately ungraded.** The code path is CONFIRMED; whether the relay
> actually retains these frames is NOT, and that is the whole question. Until it
> is answered this is trivial if typing frames are not retained, and significant
> if they are — a permanent, ever-growing reconnect backlog for every active
> user. Carrying no `priority:` is the honest state, not an oversight: grade it
> once the question below is settled.

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

## 🔴 UPGRADED 2026-08-03 — the send path is the same as an ordinary post

The open question below was "does the relay retain typing frames?". Reading the
SEND path answers it as far as client code can:

```ts
// MessageService.ts:605-614 — "Broadcast an ephemeral control message to a space"
async sendEphemeralSpaceControl(spaceId: string, msg: TypingMessage) {
  await this.encryptAndSendToSpace(spaceId, msg as unknown as Message);
}
```

`encryptAndSendToSpace` is **the same function ordinary posts use**. On the wire a
typing frame is an ordinary space hub broadcast, landing in every member's space
inbox exactly like a message.

⚠️ **"Ephemeral" in that comment describes LOCAL PERSISTENCE** — "never calls
saveMessage… no local persistence and never enters the sync manifest". It says
nothing about relay retention, and there is no separate ephemeral transport.

So the chain is: sent like a post → never acked (the early `return` at
`MessageService.ts:4682`) → and the relay retains until acked. **Typing frames
accumulate.**

### Why this may be the dominant backlog source

`TypingService` sends **one `typing-start` per 5 s per scope** while someone is
typing, plus a `typing-stop`. In a busy 79-member space that is hundreds of
frames per hour, from ordinary conversation, with nobody doing anything unusual.

For comparison, the largest MEASURED backlog in this investigation was ~352
retained `announce-keys` frames — enough to block a client for minutes. A week's
worth of typing indicators across several active spaces would dwarf that.

**If confirmed, this is upstream of everything.** Queue depth is the variable
that decides whether a perishable frame is read in time (see the FALSIFIED
section of the sync-requests issue: the wait is the number of frames AHEAD, and
nothing about scheduling changes that). A permanent, unbounded, ever-growing
source of queue depth beats every scheduling fix under discussion.

### Still not proven

The relay is not in these repos, so "retained and redelivered" remains INFERRED —
strongly, from an identical send path and a documented retain-until-acked model,
but inferred. The experiment below still settles it.

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
