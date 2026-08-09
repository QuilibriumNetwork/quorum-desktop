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

**Porting user notes to mobile was not the fix for the tombstone bug**, and should
not be re-proposed as one. It would have resolved it incidentally while leaving
`deviceNames` — the same defect, with no port planned — completely untouched, at
the cost of a whole feature on the platform that is hardest to verify.

**The port itself is planned and wanted.** It just has requirements attached: see
§4.4. Mobile carrying `userNotes` without implementing them is what makes the
current asymmetry harmless, so implementing them is exactly what makes it bite.

**The open design question is settled** (now §4.1): a declared list in
`quorum-shared`, not mirrored tests. Shared-first is the standing convention, and
a single declaration is what makes drift impossible rather than merely unlikely.

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
blob carrying the `deviceNames` map it last pulled, wholesale. Any device name
written elsewhere since mobile's last pull is **silently overwritten**.

> The original text said "device name or user note" here. The user-note half is
> wrong — `updatedAt` per-entry LWW already protects note content, and always did.
> It becomes a live risk only when mobile implements the feature; see §4.4.

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

> Rewritten 2026-08-09. The original three steps described work that does not fix
> the reported symptom, and omitted the one that does. Kept in git history.

### 4.1 The symmetry test — do this first

**Highest value of anything here, because it protects work not yet written.**

Declare, once in `quorum-shared`, which `UserConfig` fields need per-entry merge
rather than verbatim adoption. Both clients import that list, and each has a test
asserting it handles every entry.

Not mirrored tests in each repo: two tests are two things to forget. A single
declaration makes drift a build failure instead of a code-review hope.

Why it comes first: nothing today would catch a client shipping a field's feature
without its merge. That is exactly how this diverged in the first place, and §4.4
is a live opportunity to repeat it.

### 4.2 `deviceNames` needs per-entry timestamps — the actual remaining fix

Not in the original list, and it is the only thing that fixes §2.

`mergeDeviceNames` resolves a key conflict with `remote wins` and has nothing to
compare, so a **stale** carried value beats a **fresh** local one. Union semantics
protect additions; they do nothing for an update to an existing key, which is
what a rename is.

Add `deviceNameTimestamps?: { [inboxAddress: string]: number }` to shared
(additive, mirroring what `conversationSettings` and `UserNote` already do), write
it on rename, and let the newer write win. Same shape as the `deletedUserNotes`
fix in #323.

Deliberately deferred for now: the symptom is a label reverting to its previous
value. Visible, recoverable, nothing destroyed.

### 4.3 Port `mergeDeviceNames` to mobile — keep, but for a different reason

The original step is worth doing and its stated justification is wrong. It does
**not** fix rename-reverting.

What it fixes is narrower: when two desktops know different device names, mobile
adopts one map verbatim and republishes it, dropping the other's entry until that
desktop's own merge restores it. Merging on mobile stops it narrowing the map.

Also add the field to mobile's explicit inbound-preservation list, so a later
refactor cannot silently drop it — the belt-and-braces step the
`conversationSettings` migration called for.

### 4.4 When mobile implements user notes, four things ship WITH it

**Dormant today, mandatory the day the port lands.** Mobile is currently a pure
carrier for `userNotes`, which is why not merging costs nothing. The moment mobile
holds notes desktop has not seen, verbatim adoption starts destroying them, and
§1's table becomes correct as originally written.

This file is therefore a **prediction** about `userNotes`, not a description. Do
not read the table as current behaviour.

The port is planned and wanted. It simply has to carry these, or it lands with two
data-loss bugs built in:

- [ ] **Per-address LWW merge on adopt**, matching `ConfigService.ts:310-330`.
      Without it mobile clobbers notes written on another device.
- [ ] **Write timestamped tombstones** (`deletedUserNotes`, with `deletedAt`) on
      delete. The legacy array may be written alongside for older clients.
- [ ] **Honour timestamped tombstones only; ignore `deletedUserNoteAddresses`.**
      Same rule desktop follows since #323.
- [ ] **Clear both tombstone lists after a successful publish.** Omitting this is
      precisely what made mobile poison desktop's notes, so mobile would end up
      poisoning its own.

§4.1 is what turns this checklist from something to remember into something the
build enforces.

---

*Last updated: 2026-08-09*

## Updates
- **2026-08-09 12:15**: Verified against current code. userNotes CONTENT was never at risk (per-entry updatedAt LWW protects it) — this file was wrong. The real defect was its tombstones: mobile carries userNotes with zero implementation, never clears the tombstone array, and republished it forever, so a re-created note was deleted on every adopt. Measured, then fixed in #323 + shared 2.1.0-42. deviceNames is the only row still live and is deliberately deferred (label reverts, recoverable). Stays open.
- **2026-08-09 12:20**: Rewrote section 4. The original three steps described work that does not fix the reported symptom and omitted the one that does. Now: 4.1 symmetry test first (a shared declared list, since nothing today would catch a client shipping a field's feature without its merge), 4.2 deviceNames per-entry timestamps (the actual fix for section 2, previously absent), 4.3 mergeDeviceNames on mobile kept but relabelled (stops map narrowing across two desktops; does NOT fix rename-reverting), 4.4 a four-item checklist the user-notes port must carry. Flagged that this file is a PREDICTION about userNotes rather than a description: harmless while mobile is a pure carrier, correct as written the day mobile implements the feature.
