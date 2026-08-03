---
type: bug
title: "A space frame that fails to decrypt is deleted from the relay anyway, so the message is lost permanently and silently"
status: done
priority: high
created: 2026-08-03
severity: a space message that fails to decrypt for ANY reason is destroyed rather than retried — the relay is the only copy
area: space message receive path / inbox ack / frame retention
repos: quorum-desktop
related_bugs:
  - "2026-08-02-sync-requests-arrive-four-minutes-late-and-every-peer-rejects-them.md (found during its §0d security review)"
  - "2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md (why this is silent in production)"
---

# A space frame that fails to decrypt is deleted from the relay anyway

## ✅ FIXED — desktop #305, 2026-08-03

An `opened` flag flips the moment the envelope is unsealed. Only a failure
**before** that point retains the frame; anything throwing during application
handling would throw identically on a retry, so those are still deleted exactly
as before. Retention reuses the DM path's existing `UndecryptableFrameTracker`
(40 attempts / 5 min TTL), so a genuinely poisonous frame still cannot linger.

**What was verified:**

- Four unit tests in `src/dev/tests/services/MessageService.spaceFrameRetention.unit.test.ts`,
  asserting the property that matters — `deleteInboxMessages` **not** being
  called — rather than "it didn't crash", since a frame can be lost with no
  error at all.
- **Confirmed load-bearing**: with the fix reverted, 3 of 4 fail and the old code
  deletes on **all 40** delivery attempts. The fourth is the regression guard
  (normal frames must still be acked) and passes either way by design.
- Full suite 61 files / 924 tests green. `yarn harness space-basic` passes live
  against production, so the real space receive path still works end to end.

⚠️ **What was NOT verified:** the retention path itself has only been exercised
with a mocked unseal. No live test forces a real space frame to fail to open. The
change is a guarded early return so integration risk is low, but that gap is
real — do not read "924 tests green" as covering it.

## How this was found

During an independent security review of the inbound-scheduling design in
`2026-08-02-sync-requests-arrive-four-minutes-late-…` §0d. It is **not** caused
by that proposal — it exists today, on `main`, and would remain if that proposal
were never built. It is recorded separately because it is independently
actionable and arguably outranks the latency work it was found under.

## The defect

The relay holds a frame until the client explicitly deletes it. That delete is
the ack. So a client that deletes a frame it did not successfully process has
destroyed the only copy.

The space branch of `handleNewMessage` wraps its whole unseal/decrypt block in
`try { … } catch (e) { console.error(…) }` with **no `return`**, then falls
through and unconditionally calls `dispatchInboxDelete` for the space inbox at
the end of the function (`src/services/MessageService.ts:6346-6378`).

So on any decrypt failure:

1. the error goes to `console.error` — **invisible in production builds**, because
   `logger` is a no-op there (see the related issue), and
2. the frame is deleted from the relay in the same pass.

No redelivery. No retry. No user-visible signal. The message is simply gone.

## The DM path already does this correctly

`retainOrDropUndecryptableFrame` (`src/services/MessageService.ts:4426-4439`)
exists for precisely this case, and its own comment states the principle:

> *a single bad/duplicate/out-of-order frame does not mean the session is broken*

The DM path keeps such a frame on the relay so it can be delivered again once the
session that owns the inbox is re-established. **The space path has no
equivalent.** This is an asymmetry, not a deliberate design difference — nothing
found so far argues space frames are safe to destroy on failure.

## Why it matters more than it looks

Decrypt failures on the space path are not exotic. Known and plausible causes:

- a config-key rotation applied before an older frame encrypted under the old key
  (see the §0d security review — this is the mechanism that made the finding
  urgent, and it needs no code change to occur, only unlucky ordering)
- a frame arriving before the session or key that opens it exists
- transient corruption or a partially-written envelope

In every one of these, the correct behaviour is "leave it and try again later",
which is exactly what the relay's retain-until-acked model is built to support
and what the DM path already does.

## Fix shape

Give the space path the DM path's retention discipline: on decrypt failure,
**retain** the frame rather than delete it, so it is redelivered on the next
`listen`.

Two things to get right, both already solved on the DM side and worth reading
there first:

- **A poison frame must not be retained forever.** A frame that can never decrypt
  would otherwise be redelivered on every reconnect for the lifetime of the
  account, which is its own denial of service. `retainOrDropUndecryptableFrame`
  is named for the fact that it does BOTH — read how it decides.
- **Distinguish "cannot decrypt yet" from "will never decrypt".** Retaining the
  first is repair; retaining the second is a leak.

## Verification

⚠️ Do not accept a green harness run as proof. The natural test is a space frame
that fails to decrypt, and it must assert **the frame is still on the relay
afterwards**, not merely that the client did not crash. The harness can construct
this — it already injects malformed frames for the failure-counter self-test in
`src/dev/tests/harness/space-create.scenario.test.ts`.
