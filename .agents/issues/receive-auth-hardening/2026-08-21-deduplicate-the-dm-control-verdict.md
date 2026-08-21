---
type: task
title: "Deduplicate the DM control-message verdict into quorum-shared"
status: open
priority: medium
created: 2026-08-21
updated: 2026-08-21
area: receive-side authorization
repos: quorum-shared, quorum-desktop, quorum-mobile
---

# Deduplicate the DM control verdict

> Rationale: §4.5 of the private design doc
> (`.agents/issues/.secret/2026-08-20-sender-authentication-is-opt-in-mechanism-level-fix-design.md`).

## What & why

The two-clause DM authorization rule is **hand-written in at least four places**
across two repos — `MessageService.ts:2557-2558` and `:3198-3199` on desktop,
`WebSocketContext.tsx:3571-3572` and `:5251-5252` on mobile.

Four copies of one rule is four chances for them to drift, and drift here is
silent: each copy keeps working, they just stop agreeing. Extract to a shared
`authorizeDmControlMessage`.

This is the lowest-risk item in the folder and a reasonable first PR for anyone
picking the epic up.

## Observable outcome

DM control messages (delete, reveal, and the rest) behave exactly as they do
today, with one implementation instead of four. Provable by tests, not by
looking — see below.

## Steps

- [ ] **Pinning tests FIRST**, against all four current call sites, before
      touching anything. They must capture today's behaviour including whatever
      is odd about it. If the four copies already disagree, that is a finding —
      stop and report it before refactoring, because then this is not a pure
      refactor and the difference matters.
- [ ] Extract `authorizeDmControlMessage` into `quorum-shared`.
- [ ] Swap desktop's two call sites.
- [ ] Swap mobile's two call sites **only if** coordinating there is in scope for
      the session; otherwise leave mobile untouched and say so plainly in the PR.
      A half-migrated rule with a clear note is fine. A half-migrated rule nobody
      mentions is how the next drift starts.

## Definition of done

- [ ] Pinning tests written before the refactor and green throughout, unedited.
- [ ] One implementation, in shared.
- [ ] Every migrated call site verified to reach the same verdict as before.
- [ ] If mobile was not migrated, the PR says so explicitly and this file is
      updated with what remains.
- [ ] Independent adversarial review, fresh context.

## Out of scope

Changing the rule. This is a pure refactor — **no verdict may change**. If you
believe the rule is wrong, that is a separate issue; recording the belief is
welcome, acting on it here is not, because a behaviour change hidden inside a
refactor is invisible in review.

---
*Last updated: 2026-08-21*
