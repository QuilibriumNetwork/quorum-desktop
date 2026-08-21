---
type: task
title: "Outbound signing is decided in four places, only one of which is the shared rule"
status: open
priority: medium
created: 2026-08-21
updated: 2026-08-21
area: message signing / send path
repos: quorum-desktop, quorum-shared
---

# Outbound signing is decided in four places, only one of which is the shared rule

## What & Why

`shouldSignOutbound` (quorum-shared, added in #87) exists so that the sender and
the receiver ask the **same question** about which frames need a signature. If
they disagree, the sender emits a frame every recipient refuses, and the sender's
own UI reports success. That is a silent failure: the action looks done and is not.

That exact defect shipped and was caught in review on 2026-08-21 — thread frames
were sent unsigned in repudiable spaces because the signing rule lived inside a
branch (`isPostMessage`) that structurally excludes threads. Fixed in
quorum-desktop#359 for the post, pin and thread branches.

**This issue is about the remaining three deciders.** Nothing here is known to be
broken today. The problem is that correctness rests on call-site convention rather
than on a rule, so the next handler added inherits nothing — the same shape that
caused the thread bug.

## MEASURED 2026-08-21 — what was actually checked

Two candidates flagged during review were checked and are **clean**. Recording
this so nobody re-audits them:

- **`update-profile` is NOT affected.** `MessageService.ts:7866-7870` signs it
  unconditionally, ignoring `skipSigning` entirely, with the comment "Enforce
  non-repudiability (required for profile updates to verify sender)". This
  matches the receive side, which drops unsigned `update-profile` outright
  (`MessageService.ts:5484`). The two halves agree.
- **DM control types are currently signed.** `submitMessage` (the DM path,
  `MessageService.ts:3751`) signs at `:4235` under `if (!skipSigning && !preBuiltMessage)`.
  No caller passes `skipSigning` for a control payload:
  `MessageEditTextarea.tsx:748` and `:766` pass no argument at all, and
  `MessageDB.tsx:523` passes an explicit `undefined`. The only caller that ever
  passes `true` is `DirectMessage.tsx:583`/`:596`, and only for text and embed
  content.

So: no live bug found. What follows is the structural gap.

## The four deciders

| # | Where | How it decides | Uses the shared rule? |
|---|---|---|---|
| 1 | `submitChannelMessage` — post, pin, thread branches | `shouldSignOutbound(...)` | ✅ yes, since #359 |
| 2 | `submitChannelMessage` — `update-profile` branch (`:7866`) | always signs, hardcoded | ❌ no, but correct |
| 3 | `submitMessage` (DM path, `:4235`) | raw `!skipSigning` | ❌ no |
| 4 | `DirectMessage.tsx:579` | `nonRepudiable ? false : skipSigning` | ❌ no — a React component holds a signing rule |

Decider 4 is the one worth staring at. It is the DM half of exactly the policy
`shouldSignOutbound` encodes (`if (!isRepudiable) return true`), reimplemented in
the UI layer. Two copies of one rule, one of them in a component, with nothing
tying them together.

Decider 3 is safe only because of what its callers happen to pass. A new DM
control action written by someone who passes `skipSigning` through — a reasonable
thing to do — would be silently unsigned and silently dropped.

## Definition of Done

- [ ] Decider 3 asks `shouldSignOutbound` instead of reading `skipSigning` raw, so
      DM control types are force-signed by rule rather than by call-site habit.
- [ ] Decider 4's repudiability override moves out of `DirectMessage.tsx` and into
      the same shared helper. The component should pass user intent
      (`skipSigning`) and let the helper decide.
- [ ] Decider 2 either calls the helper or gains a comment pointing at it, so the
      hardcoded `always sign` is visibly a deliberate instance of the rule rather
      than an unrelated line.
- [ ] A test asserts a DM control message is signed even when `skipSigning` is
      `true`, and it is confirmed to fail if the force-sign is removed.
- [ ] `edit-message` stays on the inherit rule (`shouldSignEdit`) and does **not**
      route through `shouldSignOutbound`. There is already a source guard for this
      on the channel side; the DM side needs the same protection.

## ⚠️ Do not "fix" this by force-signing everything

`shouldSignOutbound` deliberately excludes `'edit-message'` even though it is on
the signature-required list. An edit is signed iff the message it edits was
signed. Route edits through the generic helper and editing an unsigned message
attaches a signature to it, which destroys deniability — a critical product
feature, not an edge case.

The same caution applies to ordinary posts. Deniability is the point of a
repudiable space; only **control** frames get force-signed, and only because they
are refused without a signature anyway.

## Related

- Send-side rule and its exclusions: `quorum-shared/src/utils/messageAuth.ts`,
  `shouldSignOutbound`
- The incident that motivated this: quorum-desktop#359, quorum-shared#87
- Wider mechanism-level work this belongs to: space-auth hardening, detail held
  privately

---
*Last updated: 2026-08-21*
