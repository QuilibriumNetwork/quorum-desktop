---
type: bug
title: "Desktop merges four config fields per entry, mobile merges two — device names and user notes are clobbered between your own devices"
status: open
priority: medium
created: 2026-08-05
updated: 2026-08-05
severity: silent data loss between a user's own devices, for fields whose own type comments say they need merging
area: config sync / getConfig merge / desktop-mobile parity
repos: quorum-desktop + quorum-mobile
source: found by independent review during the 2026-08-04 stale-display-name investigation
related:
  - ".agents/docs/config-sync-system.md"
  - ".agents/issues/.done/2026-07-20-sync-per-conversation-dm-settings-cross-repo.md"
---

# The two clients do not merge the same config fields

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

*Last updated: 2026-08-05*
