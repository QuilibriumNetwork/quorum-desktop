---
type: status-recap
title: Quorum-shared migration — status recap (mobile access regained)
status: reference
created: 2026-05-28
audience: Kyn (re-orienting after a break)
---

# Where we are with the quorum-shared migration

Plain-English snapshot, written to help re-orient. No decisions, no changes. Read top to bottom.

## The one-line story

> Code that needs to be **identical** on desktop and mobile (wire formats, sync logic, business rules) is being progressively moved from `quorum-desktop` into a shared npm package, `@quilibrium/quorum-shared`, so mobile can import it instead of reimplementing the same logic. About half the work is done. The other half has been waiting for mobile codebase access. **You now have that access.**

## What's already done (✅)

These shipped between March and May 2026. Don't touch them, they work:

1. **Shared types** — Space, Message, Channel, User, Conversation, Bookmark, Receipt, Typing types
2. **Primitives** — 22 cross-platform UI components (PR #2)
3. **Utils** — 22 utility modules (validation, mentions, formatting, etc.) (PR #3)
4. **Util tests** — moved alongside the utils they test
5. **Typing service** — full feature: types + service + tests
6. **Receipts service** — full feature: types + service + tests
7. **UserConfig privacy fields** — deliveryReceipts, readReceipts, typing indicators, YouTube previews (4 PRs, May 2026)
8. **UserNote type** — promoted to a named shared type (PR #17, May 2026)

## What's pending and was blocked on mobile access (⏸️)

This is what's "in your inbox" now that mobile is reachable. **All of these are blocked on the same thing.** Mobile access unblocks them in principle, but each still needs a real decision before code moves.

| Pending work | What "mobile access unblocks" really means |
|---|---|
| **Hooks migration** (~265 files) | Need to see mobile's hook code to design the right storage/crypto abstraction layer so both apps can consume the same business hooks. This is the **big one** — the others mostly depend on it. |
| **ActionQueueService** | Direction unclear without seeing how mobile queues actions (or whether it does). |
| **SearchService + SearchAdapter** | Same — need to see mobile's search code (or lack of it). |
| **channelThreadHelpers** | Same — small helpers, but the API needs to match what mobile would use. |
| **ThreadService** | Blocked behind hooks migration (depends on the abstraction layer). |
| **NotificationSettings / NavItem type alignment** | The task we just unblocked. Small, contained, no abstraction layer needed. |

## What stays per-app forever (❌)

Don't migrate these. They're tightly coupled to one platform's storage, crypto, UI framework, or i18n. Listed here just so you know to leave them alone:

- MessageService (~2000 lines, deeply coupled)
- ConfigService, EncryptionService, SpaceService, InvitationService, SyncService, NotificationService, ActionQueueHandlers

## What I checked in mobile today (2026-05-28)

Quick scan of the live `quorum-mobile` source. Not a full audit, just enough to confirm mobile codebase is real and reachable:

- **`hooks/`** — 17 files. Almost entirely platform stuff (theme, color scheme, network, animations, Farcaster). Only ~3 share concerns with desktop's business hooks (`useUserConfig.ts`, `useFarcaster*`). Mobile clearly hasn't built out its own copy of desktop's 265-file hook tree.
- **`services/`** — mobile has `api`, `config`, `crypto`, `media`, `miniapp`, `notifications`, `offline`, `onboarding`, `space`, `storage`. Roughly the same shape as desktop but smaller. No `actionQueue` folder visible. No `search` folder visible.
- **`@quilibrium/quorum-shared@2.1.0`** in mobile vs **`2.1.0-16`** in desktop. Mobile is one minor behind. Not blocking.

**Key takeaway from the scan:** mobile is *less built out* than I'd assumed. Many "duplicated" implementations the old design docs feared are probably **not duplicated** because mobile hasn't shipped them yet. This means more of the pending work might be "promote desktop's design to shared, mobile catches up later" rather than "negotiate between two existing designs."

## What I'd suggest as the next 2-3 sessions

**Not asking you to decide now — just laying out the menu.**

### Option 1 — Finish the small thing we already unblocked

Do the `NotificationSettings` + `NavItem` cleanup we walked through in [`2026-05-27-shared-vs-local-type-divergence.md`](../2026-05-27-shared-vs-local-type-divergence.md). It's contained, low-risk, and gets a "win" on the board. **~1-2 sessions.** Good warm-up before tackling hooks.

### Option 2 — Refresh the hooks audit against current mobile

The hooks design doc was written in March 2026 against an older mobile snapshot. Before designing the abstraction layer, **re-audit**: what hooks does mobile actually have today? What patterns does it use for storage and crypto? This produces a refreshed inventory and a real abstraction proposal. **~1 session.** No code changes. Sets up the big migration.

### Option 3 — Do the small services first (ActionQueue, Search, channelThreadHelpers)

Now that mobile is visible: are these even present on mobile? If not, the answer is "promote desktop's, mobile inherits." Each is a small focused PR. **~1-2 sessions each.** Could ship in parallel with Option 2.

### What I would NOT do next

- **Don't start the hooks migration yet.** It's the biggest piece, depends on the abstraction layer, and that layer's design depends on Option 2's audit. Jumping in without the audit risks producing the wrong abstraction.
- **Don't touch the "stays per-app" services.** Easy to forget where the line is.

## My honest recommendation

**Option 1, then Option 2.** Finish the type-divergence task we just unblocked (a contained win), then refresh the hooks audit against live mobile (positions you for the real big move). Option 3 services can slot in opportunistically.

This sequencing minimizes the chance of you losing track again — each session has one focused goal, with a clear "done" state.

## How to use this doc

- This is a **status snapshot**, not a plan. The plan is the per-task files in this folder.
- The master tracker is [`README.md`](README.md) — that's authoritative for what's in flight. This doc is the friendly summary.
- Re-read this if you come back to the migration after another break.

---

## Addendum (2026-05-28, same session): upstream `quorum-shared` also has new work

After writing the recap above, Kyn flagged that the `quorum-shared` repo had probably been updated too. Verified by fetching `origin/master` on the local `quorum-shared` clone — confirmed **3 new commits ahead of local**:

1. `2.1.0-2` version bump + small sync utility changes.
2. **Big rollup commit** — adds a complete `src/farcaster/` module (16 files: hypersnap client, legacy fallback, signers, 11 React Query hooks for Farcaster casts/feeds/profiles), plus two new `UserConfig` fields: `isProfilePublic?: boolean` and `farcasterLink?: FarcasterLink` (new type).
3. A merge commit.

**The `NotificationSettings` placeholder shape on `origin/master` is unchanged**, so the notifications migration plan in this folder still applies cleanly — no upstream conflict.

### What this adds to the menu

Add one more small "ready" item to Option 1:

- **Desktop `UserConfig` mirror catch-up** — `src/db/messages.ts` doesn't have `isProfilePublic` or `farcasterLink` yet. Same drift pattern as the receipts/typing fields fixed in PR #16. Trivial 5-line addition. Could be bundled with the notifications work or shipped standalone.

### What this DOESN'T change

- The bigger Farcaster module integration is a **separate workstream**, not part of this migration's scope. Mobile already has its own `useFarcaster*` hooks; eventually those should point at shared, but that's a future effort.
- The hooks audit plan in Option 2 is unchanged — the new Farcaster module doesn't affect how the existing business hooks should be migrated.

### Pre-flight action before any migration PR

Before starting any of the work in this folder, run:

```bash
cd D:\GitHub\Quilibrium\quorum-shared && git pull
cd D:\GitHub\Quilibrium\quorum-desktop && yarn install
cd D:\GitHub\Quilibrium\quorum-mobile && yarn install
```

This brings your local shared clone up to date and refreshes the `link:` symlink dependencies in both consumers. Otherwise migration branches build on a stale base and produce confusing diffs.

---

*Created: 2026-05-28 — after Kyn cloned latest quorum-mobile locally. Written as a re-orientation aid, not a decision document.*

*Addendum 2026-05-28 (same session) — after Kyn flagged upstream shared activity. Confirmed 3 new commits on shared `origin/master` including the major Farcaster module addition and two new `UserConfig` fields. Notifications migration plan unaffected; one small desktop mirror catch-up added to the menu.*
