---
type: task
title: "Exhaustive message-auth policy map in quorum-shared"
status: open
priority: high
created: 2026-08-21
updated: 2026-08-21
area: receive-side authorization / architecture
repos: quorum-shared (new file), quorum-desktop, quorum-mobile
---

# Exhaustive message-auth policy map

> The centrepiece of track 1. Rationale: §2 and §4.2 of the private design doc
> (`.agents/issues/.secret/2026-08-20-sender-authentication-is-opt-in-mechanism-level-fix-design.md`),
> which contains design constraints this brief only summarises. **Read it before
> designing the type.**

## What & why

`CONTROL_MESSAGE_TYPES` is a hand-maintained allow-list. A message type that does
not add itself inherits **no** protection, and nothing fails — no compiler error,
no test, no lint. That is opt-in, and "not opting in" is the default state of
every feature anyone ever writes.

Replace it with a `Record<MessageContent['type'], AuthPolicy>` over the ~25-member
union in `quorum-shared/src/types/message.ts`. It does not compile until every
type — **including the next one someone invents** — has been classified.

## Observable outcome

Add a new message type to the union on a scratch branch without classifying it,
run `tsc --noEmit`, and watch it fail naming the missing key. That artefact *is*
the deliverable: it is what would have caught the last three incidents at build
time. Demonstrating it is part of this brief, not a separate one — on its own it
ships nothing.

## Hard constraints — read these before writing the type

These come from the design doc and from the operator directly. Getting the type
shape wrong makes the map unshippable.

- [ ] **Two axes, not one.** (1) does this type perform a privileged or
      destructive action? (2) is authorship verified? Axis 2's legal values must
      **depend on** axis 1, so a privileged type is never *offered* an unverified
      option. A flat map where `'unverified'` is legal for anything lets a future
      destructive type be classified that way and still compile — which makes a
      gap conspicuous rather than impossible.
- [ ] **The map MUST permit a known, accepted gap.** Ordinary posts are
      deliberately unverified today for genuine cost reasons, and that decision is
      owned elsewhere. If classification silently obliged every type to be
      verified, the build would break or the map would be fudged — and a fudged
      map is worse than none. So there must be a first-class value meaning
      *"deliberately not verified, accepted, here is why and who owns it"*,
      carrying a reason and a pointer to the owning issue. Not a bare `none`.
- [ ] **`'post'` classifies as deliberately-unverified and that is CORRECT**, not
      a regression to fix. Do not absorb the ordinary-post verification decision
      into this work; it is blocked on a real performance question that belongs to
      another issue.
- [ ] **Per-action exhaustiveness where actions carry different rules.**
      `'thread'` has six actions with at least three distinct rules. A map
      satisfied by "`'thread'` has *an* entry" ticks the compile-time box while
      most of its actions stay unchecked. Force exhaustiveness over
      `ThreadMessage['action']` too.
- [ ] **The hub-envelope universe is not in `MessageContent` at all.** `join`,
      `leave`, `kick`, `rekey`, `verify-kicked`, `space-manifest` dispatch off
      `envelope.message.type` in a separate chain. A `Record` over
      `MessageContent['type']` structurally cannot reach them. Either give that
      union its own exhaustive map, or state plainly in the file that this
      mechanism does not cover it — otherwise it looks complete while leaving a
      known class open.

## Steps

- [ ] Design the two-axis policy type. This is the hard part; do it first and get
      it reviewed before filling anything in.
- [ ] Create `quorum-shared/src/utils/messageAuthPolicy.ts`. It must live in
      shared so the two clients cannot classify a type differently.
- [ ] Populate it as a **faithful encoding of today's enforced behaviour**,
      verified against the live gate conditions — not what the behaviour ought to
      be. This slice must change nothing at runtime.
- [ ] Snapshot test pinning the map to today's enforced conditions.
- [ ] The scratch-branch demonstration above. Record the compiler output.

## Definition of done

- [ ] The map exists in shared, is exhaustive, and compiles.
- [ ] **No runtime behaviour changed.** Existing tests green throughout, with no
      test edited to accommodate the map.
- [ ] A privileged type cannot be classified unverified — demonstrated by a
      deliberate attempt that fails to compile.
- [ ] `'post'` carries a legal deliberately-unverified row with a reason and an
      owner pointer.
- [ ] The scratch-branch demo is recorded, with the actual `tsc` error.
- [ ] Independent adversarial review, fresh context.

## Out of scope

- Changing any classification. Reclassification becomes a one-line reviewable
  diff *after* this lands; doing it here hides a behaviour change inside a
  structural one.
- Ordinary-post verification (owned elsewhere, blocked on a cost decision).
- Forcing handlers to consult the map — that is
  [table-driven dispatch](2026-08-21-table-driven-receive-dispatch.md).

---
*Last updated: 2026-08-21*
