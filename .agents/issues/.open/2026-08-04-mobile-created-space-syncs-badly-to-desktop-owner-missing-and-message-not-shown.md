---
type: bug
title: "A Space created on mobile syncs badly to desktop: the owner is missing from the member list and their first message never appears"
status: open
priority: medium
created: 2026-08-04
severity: medium (observed, reproducible on one Space; scope across Spaces not established)
platforms: quorum-desktop (observed) — origin may be mobile's create/announce path
source: observed on device while testing mobile's join/leave work on 2026-08-04. OBSERVED, not yet traced in source.
related:
  - .agents/docs/features/identity-resolution-and-profile-sync.md (the two-slot per-space/global identity model these symptoms sit on)
  - "the join-handler review from the same session (same handler family; detail held privately)"
---

# A Space created on mobile does not land correctly on desktop

## What was observed

Reported first-hand, three symptoms in one session, all on **one specific Space
created on mobile**. A different, older Space on the same desktop client showed
its owner correctly, so this is **not** "desktop never shows owners".

1. **A message posted from mobile never appeared on desktop.**
2. **The Space owner was absent from desktop's member list entirely**, while the
   same owner was present in mobile's member list for the same Space.
3. **Creating a role on desktop and assigning it to the owner made them appear
   immediately** in the member list — but with **no avatar and no display name**.

## The one strong inference symptom 3 gives us

Desktop builds its roster in `src/hooks/business/channels/useChannelData.ts` as
role sections plus a "No Role" section, and the two filter differently:

```ts
// noRoleMembers
.filter((r) => !activeMembers[r].left)      // left = inbox_address === ''
.filter((r) => !activeMembers[r].isKicked);

// role sections
.filter((s) => !activeMembers[s].isKicked); // NOTE: does not filter `left`
```

So a member with a **blank `inbox_address`** is hidden from "No Role" but
**visible once they hold a role**. That is exactly the transition observed in
symptom 3.

**Therefore: desktop almost certainly holds a member row for the owner with a
blank (or absent) `inbox_address`.** That is the thing to confirm first — it
explains symptoms 2 and 3 together, and it is checkable by inspecting the
`space_members` store for that Space.

Marked INFERRED: the filter asymmetry is READ from source at the lines above;
that the owner's row specifically has a blank anchor is reasoned from the
observed transition, not yet verified in the store.

## Why the owner is the likely victim

The Space creator **never broadcasts a `join`** — the join envelope is what
carries `inboxAddress`, `displayName` and `userIcon` to peers. The creator's own
row is written locally, deliberately blank on both clients:

```ts
// Follow-global: don't stamp the creator's global name/avatar into their
// per-space row (empty = follow global). Peers learn identity from the join
// envelope; this row only records membership.
```

(`quorum-desktop SpaceService.ts` ~`:436`, and the identical comment in
`quorum-mobile services/space/spaceService.ts` ~`:309`.)

So every other member learns the creator's identity through some *other* path —
the space manifest, `sync-members`, or an `update-profile` broadcast. If that
path did not run, or ran without an `inbox_address`, desktop gets exactly what
was observed. Symptom 1 (the missing message) may share the cause or may be
independent; do not assume one root without evidence.

## Note: mobile had the display half of this and it is now fixed

Mobile showed the creator as a bare address in its own roster, for a different
reason worth not confusing with this one: mobile's roster read only the
**per-space** identity slot and never fell back to the **global** slot. Fixed
2026-08-04 on `fix/authenticate-join-ed448-signature` with a resolver
(per-space → global → own live profile → address).

**That fix does not help desktop here**, because desktop's problem is that the
owner is missing from the roster entirely, not mis-rendered — and when made
visible via a role, they had no name *or* avatar, which points at an empty row
rather than an unread slot. Desktop may well *also* want the same fallback
resolver; check that separately after the row question is settled.

## How to investigate

1. **Inspect desktop's `space_members` for the affected Space.** Does a row for
   the owner exist? Does it have an `inbox_address`? A `display_name`? That one
   answer separates "the row was never created" from "the row is blank".
2. **Establish scope.** Reproduce by creating a fresh Space on mobile and
   opening it on desktop. If it reproduces every time, this is a systematic
   mobile-create → desktop-sync gap, not a one-off from a Space created while
   several fixes were mid-flight. **The affected Space was created during active
   testing on 2026-08-04 and may carry state from partially-fixed builds — rule
   that out before treating it as general.**
3. **Treat symptom 1 separately** until evidence links it. A message not
   arriving is a transport/decrypt question; the roster symptoms are a
   member-row question.

## Confidence

- **OBSERVED first-hand:** all three symptoms, plus the control observation that
  another Space on the same client shows its owner correctly.
- **READ:** desktop's roster filter asymmetry, and the deliberately-blank
  creator row on both clients.
- **NOT verified:** the contents of desktop's member row for that owner;
  whether this reproduces on a fresh Space; whether symptom 1 shares a root.

*Last updated: 2026-08-04*
