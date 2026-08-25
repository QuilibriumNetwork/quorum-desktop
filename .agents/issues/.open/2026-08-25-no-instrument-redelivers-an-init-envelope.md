---
type: task
title: 'No harness arm redelivers an init envelope, so the zombie guard is unmeasured'
status: open
priority: medium
created: 2026-08-25
updated: 2026-08-25
---

# No harness arm redelivers an init envelope, so the zombie guard is unmeasured

## Why this exists

The relay redelivers any frame whose ack-by-delete failed (502s observed live),
so a stale or duplicated InitializationEnvelope arriving late is a real event,
not a theoretical one. Two pieces of shipped code exist entirely to handle it:

- `src/utils/initEnvelopeGuard.ts` — refuses an envelope that is not strictly
  newer than the rows it would replace;
- the re-announcement branch in `MessageService.ts` (PR #368) — keeps a session
  when a repeated envelope names the same X3DH ephemeral.

**Neither has ever been exercised by a live arm.** Both are covered only by unit
tests against mocked storage, and the causal claim in
[`2026-07-29-session-replacement-strands-in-flight-frames.md`](.done/2026-07-29-session-replacement-strands-in-flight-frames.md)
was retired in July for exactly this reason: three `dm-session-churn` bench runs
found no loss, and the issue recorded that the missing evidence was "a capture
taken DURING a failure".

PR #368's own value rests on an INFERRED claim, stated as such in the issue it
closed: once we reply, the send path rewrites the row's timestamp, so guard
rule 2 stops matching that envelope and a redelivery inside the 120 s tolerance
is accepted and destroys the session. That should be measurable, and it is not
currently measured either way.

## What to build

A scenario that, after a session is established AND the receiver has replied
(that second half is the load-bearing part — it is what moves the row's
timestamp), re-delivers a previously captured init envelope to the receiver's
device inbox, and asserts:

1. the existing session survives — same receiving inbox, same ratchet;
2. no message sent before or after the redelivery is lost;
3. the payload the envelope carries is not duplicated in the conversation.

`replay-captured.scenario.test.ts` already reads captured frames from disk, so
the machinery for feeding a stored frame back in largely exists.

## Cost and constraints

- **Mints nothing.** It reuses existing bot identities and an existing session.
- Add its identities to `STATE_BY_ARM` in `scripts/verify/mintGuard.mjs`, or the
  gate will refuse to run it (an unlisted arm is assumed to mint).
- Expect it to belong on the per-change live tier once green, since a change to
  the init path is exactly what it exists to observe.

## Related

- [2026-08-24-cross-client-dm-loses-the-first-desktop-to-mobile-message.md](.done/2026-08-24-cross-client-dm-loses-the-first-desktop-to-mobile-message.md)
  — the work that produced this gap, and the measurements behind it.
- [2026-07-29-session-replacement-strands-in-flight-frames.md](.done/2026-07-29-session-replacement-strands-in-flight-frames.md)
  — the July issue whose causal claim this would finally settle.

*Last updated: 2026-08-25*
