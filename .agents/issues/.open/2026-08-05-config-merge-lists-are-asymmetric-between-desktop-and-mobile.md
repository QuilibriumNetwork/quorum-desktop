---
type: bug
title: "Desktop merges four config fields per entry, mobile merges two — a device rename can revert between your own devices"
status: open
priority: medium
created: 2026-08-05
updated: 2026-08-09
severity: a device rename can silently revert; the worse half (user-note tombstones) was measured and fixed in #323 — see Status
area: config sync / getConfig merge / desktop-mobile parity
repos: quorum-desktop + quorum-mobile
source: found by independent review during the 2026-08-04 stale-display-name investigation
related:
  - ".agents/docs/config-sync-system.md"
  - ".agents/issues/.done/2026-07-20-sync-per-conversation-dm-settings-cross-repo.md"
---

# The two clients do not merge the same config fields

## Status

**2026-08-09 — verified against current code. This file was wrong in both
directions, and the real bug it was hiding is now fixed.** Stays open for what
remains.

### What was wrong here

**`userNotes` content was never at risk.** `UserNote` carries `updatedAt`, and
desktop's merge is true per-address last-write-wins (`n.updatedAt > existing.updatedAt`,
`ConfigService.ts:318-323`). A stale note carried by another client **cannot**
overwrite a fresher one. The table below listing it as clobbered is incorrect.

**The genuine defect was in its tombstones, not its content**, and it was worse
than anything described here. MEASURED before the fix: mobile has **zero**
`userNotes` references anywhere, so it carries the field without implementing it
and never clears the tombstone array. It republished the same tombstone in every
later save, forever, and desktop applied incoming tombstones unconditionally — so
a note the user re-created was deleted again on the very next adopt, permanently
and with no error.

Fixed in **desktop #323** with **shared 2.1.0-42** (`deletedUserNotes`, carrying
`deletedAt`). A tombstone now only beats a note older than itself; the legacy
`deletedUserNoteAddresses` is still published for older clients but ignored on
receipt. Five tests, both failure modes revert-checked.

### What is still open, and it is only one field

**`deviceNames`.** No per-entry timestamp, and `mergeDeviceNames` resolves a key
conflict as `remote wins` (see the comment in `configMergeHelpers.ts`). So a
stale carried value beats a fresh local one: rename a device on desktop, save
anything on mobile, and the rename reverts.

Deliberately **not** fixed alongside #323. Same cost — it needs per-entry
timestamps too — but the symptom is a label reverting to its previous value.
Visible, recoverable, nothing destroyed. Worth doing when something else is
already in this code, not on its own.

### The general shape, worth keeping

**Mobile carries four `UserConfig` fields it does not implement** (zero
references outside `configService.ts`): `userNotes`, `deviceNames`, `favoriteDMs`,
`spaceTagId`. The two with tombstone arrays are the two that could poison. Any
future field mobile carries blind inherits the same risk, which is the argument
for §3's symmetry test.

**Porting user notes to mobile is not the fix**, and should not be re-proposed as
one. It would have resolved the tombstone bug incidentally while leaving
`deviceNames` — the same defect, with no port planned — completely untouched, at
the cost of a whole feature on the platform that is hardest to verify.

**§4.3's open design question is settled:** a declared list in `quorum-shared`,
not mirrored tests. Shared-first is the standing convention, and a single
declaration is what makes drift impossible rather than merely unlikely.

## §1. The asymmetry

`getConfig` resolves the config blob by a single top-level timestamp and applies
the winner **verbatim**, except for fields it explicitly merges. Those lists differ:

| field | desktop | mobile |
|---|---|---|
| `bookmarks` / `deletedBookmarkIds` | ✅ merged | ✅ merged |
| `conversationSettings` | ✅ per-entry LWW | ✅ per-entry LWW |
| `deviceNames` / `deletedDeviceNameAddresses` | ✅ union + tombstones | ❌ **verbatim** |
| `userNotes` / `deletedUserNoteAddresses` | ✅ per-address LWW | ❌ **verbatim** |

Everything else on both sides is verbatim by design.

> ⚠️ **Read the Status section above before acting on this table.** Mobile not
> merging `userNotes` turned out to be harmless — the per-entry `updatedAt`
> already protects the content. The damage was in the tombstones, and that is
> fixed. `deviceNames` is the only row still live.

## §2. What it costs today

Rename a device on desktop, then save anything on mobile: mobile republishes the
blob carrying the `deviceNames` map it last pulled, wholesale. Any device name or
user note written elsewhere since mobile's last pull is **silently overwritten**.

The fields' own type comments in `quorum-shared/src/types/user.ts` say they need
exactly this treatment — "Tombstones so deleted device names don't resurrect via
sync" — so this is not an intentional asymmetry. One side implemented it and the
other did not, and nothing caught it.

## §3. The part that matters beyond these two fields

**There is no test on either side asserting the two merge lists agree.** That gap
is why this diverged silently, and it will let the next per-entry field diverge
the same way. Any future map-shaped config field (a per-space profile map is a
live candidate) inherits the same risk.

A cross-platform merge-symmetry test is the durable fix. The two field
implementations are the immediate one.

## §4. Fix

1. Port `mergeDeviceNames` and the user-notes per-address merge to mobile's
   `getConfig`, beside its existing `mergeConversationSettings` call.
2. Add both fields to mobile's explicit inbound-preservation list — the
   `conversationSettings` migration called this out as a required belt-and-braces
   step, because a later refactor can silently drop an unlisted field.
3. Add a test that fails when one client merges a field the other does not.
   Whether that lives in `quorum-shared` (a declared list both import) or as
   mirrored tests in each repo is the design question worth answering first — a
   single shared declaration is harder to let drift than two tests.

Merging helpers into `quorum-shared` is additive, so it ships alone; mobile picks
it up on its next publish + bump.

---

*Last updated: 2026-08-09*

## Updates
- **2026-08-09 12:15**: Verified against current code. userNotes CONTENT was never at risk (per-entry updatedAt LWW protects it) — this file was wrong. The real defect was its tombstones: mobile carries userNotes with zero implementation, never clears the tombstone array, and republished it forever, so a re-created note was deleted on every adopt. Measured, then fixed in #323 + shared 2.1.0-42. deviceNames is the only row still live and is deliberately deferred (label reverts, recoverable). Stays open.
