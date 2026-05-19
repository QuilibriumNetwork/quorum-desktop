---
type: task
title: handleNewMessage Decomposition — Reconsidered
status: design
created: 2026-05-19
updated: '2026-05-19'
related_docs:
  - .agents/tasks/messagedb/current-state.md
  - .agents/tasks/messagedb/messageservice-deep-dive.md
  - .agents/tasks/messagedb/optimizations-high-risk.md
related_archived:
  - .agents/tasks/.archived/messageservice-handlenewmessage-refactor.md
  - .agents/tasks/.archived/messageservice-handlenewmessage-tests.md
---

# handleNewMessage Decomposition — Reconsidered

## Background

The original `handleNewMessage` decomposition plan (Dec 2025) was archived because:

- The function (~1,850 lines, MessageService.ts:2564) is tightly coupled to the decryption context.
- Comprehensive test coverage was missing and hard to add because the import chain blocked test setup.
- Extracting it as a single decomposed method group looked high-risk for low payoff.

That verdict was correct **under the Dec 2025 plan's approach** of monolithic per-section decomposition.

## What changed: the ThreadService precedent

Between April and May 2026, threads landed via a different pattern:

- **`ThreadService` (607 lines, `src/services/ThreadService.ts`)** was created as a new service with its own dependency-injected constructor (`new ThreadService(this.messageDB)` at MessageService.ts:164).
- ThreadService got its own 700-line unit test file (`ThreadService.unit.test.ts`) with 32 tests, including tests of the thread receive/cache/send flows in isolation.
- MessageService now calls into ThreadService at **9 sites** for the thread message type:
  - `handleThreadReceive` (lines 1132, 1183)
  - `handleThreadDeletedMessageCache` (1533)
  - `handleThreadCache` (1639)
  - `handleThreadReplyCache` (1753)
  - `handleThreadSend` (4848)
  - `handleThreadSendPostBroadcast` (4906)

In other words: **the team did a per-message-type extraction successfully**, and it produced exactly the testability win that the Dec 2025 plan worried was impossible.

## What this implies for `handleNewMessage`

`handleNewMessage` (and its sister cache-update method) dispatches on `decryptedContent.content.type` against 7+ message types. The dispatch sites in MessageService:

**Save path** (around line 729–1199):
- `reaction` (line 729)
- `remove-reaction` (778)
- `remove-message` (822)
- `edit-message` (918)
- `pin` (1053)
- `thread` (1130) ← already delegates to `ThreadService`
- `update-profile` (1143)
- default: regular post (1176, also calls `ThreadService.handleThreadReplyReceive`)

**Cache-update path** (around line 1260–1689):
- `reaction` (1260)
- `remove-reaction` (1319)
- `edit-message` (1372)
- `remove-message` (1437)
- `pin` (1540)
- `thread` (1637) ← already delegates to `ThreadService`
- `update-profile` (1645)
- `mute` (1689)

The shape is now obvious: **`thread` is the precedent, the other 6–7 types can follow it.**

## Proposed approach (high level — design, not implementation)

One service per message type or per logical grouping, each with its own constructor + unit tests:

| Service | Handles message types | Approx. lines extracted |
|---------|----------------------|--------------------------|
| ✅ `ThreadService` (done) | `thread`, thread replies | ~600 |
| `ReactionService` | `reaction`, `remove-reaction` | ~250 |
| `EditService` | `edit-message`, `remove-message` (tombstone), `pin` | ~400 |
| `ProfileService` | `update-profile` | ~150 |
| `ModerationService` | `mute`, `kick` (cache side) | ~100 |

Result: `handleNewMessage` becomes a **dispatch shell** (~200 lines) that delegates to the per-type service. Same for the cache-update method.

**Crucially**, this preserves the Dec 2025 plan's concern that "decryption context is tightly coupled" — because **the decryption + envelope handling stays in `handleNewMessage`**. Only the post-decrypt, per-message-type handling moves out. ThreadService validates this works.

## Why this is now design-worthy, not just "no"

| Dec 2025 blocker | May 2026 status |
|---|---|
| Decryption context coupling | Still real, but no longer the obstacle — extracted services only run post-decrypt |
| Import chain blocks testing | ThreadService demonstrated the test pattern (DI'd dependencies, mocked `messageDB`) |
| Risk outweighs benefit | ThreadService landed without regression and added ~32 unit tests of receive/cache/send flows that didn't exist before |
| No clear seams | The dispatch on `content.type` IS the seam, and it appears in BOTH the save and cache-update methods (a tax that's already paid) |

## What this is NOT

- **Not a single PR.** Each per-type service would be its own incremental PR, like ThreadService.
- **Not handleNewMessage rewriting.** The function stays. Only its branches move out.
- **Not a Tier 1 priority.** This is opportunistic — most valuable when working in one of the affected message types (e.g., adding a new reaction feature, fixing a pin bug). Following the same "opportunistic refactoring" guidance in [optimizations-high-risk.md](./optimizations-high-risk.md).
- **Not a shared-migration enabler today.** The extracted services would inherit the same coupling profile as `ThreadService` (which is the precedent): React Query cache, desktop-specific query key builders, `messageDB` injection. Per the [services-design audit §6](../quorum-shared-migration/designs/2026-05-18-services-design.md), `ThreadService` is classified **Tier 2 deferred** — blocked on the hooks migration that would lift the query key builders (`buildMessagesKeyPrefix`) into shared. The extracted ReactionService/ProfileService/EditService would follow the same trajectory: per-app until the hooks migration lands, then potentially Tier 2 candidates. (This is different from MessageService itself, which is classified per-app forever.)

## Suggested first extraction

`ReactionService` — smallest scope (~250 lines), self-contained (reactions don't cascade across other message types), and reactions are an established feature with clear test cases.

Following ThreadService's structure:

```
src/services/ReactionService.ts                       (~250 lines)
src/dev/tests/services/ReactionService.unit.test.ts   (~250–300 lines)
```

`handleNewMessage` would change from:
```ts
if (decryptedContent.content.type === 'reaction') {
  // ~250 lines inline
} else if (...)
```
to:
```ts
if (decryptedContent.content.type === 'reaction') {
  await this.reactionService.handleReactionReceive({ ... });
} else if (...)
```

Plus the same swap in the cache-update method (~70 lines that goes to `reactionService.handleReactionCache`).

## What to verify before starting

1. **Read ThreadService's structure end-to-end** to mirror its test setup, DI'd dependencies, and naming. It's the reference implementation.
2. **Identify the actual reaction code blocks** (lines 729–820 save path + 1260–1370 cache path) and verify scope before estimating.
3. **Check existing reaction tests** in `src/dev/tests/` to see what coverage already exists.

## Estimated effort (rough)

| Task | Estimate |
|------|----------|
| Verify scope (read + inventory) | 2 hours |
| Extract `ReactionService` with tests | 1 day |
| Wire and verify in MessageService | 0.5 day |
| Manual two-account QA on reactions | 0.5 day |

**Total: ~2 days for ReactionService alone**, smaller for ProfileService (only one type), larger for EditService (3 types).

## Done criteria (per service)

- [ ] New service file with constructor taking `MessageDB` (and any other small deps)
- [ ] Unit tests in `src/dev/tests/services/`
- [ ] Two call sites in MessageService updated (receive path + cache path)
- [ ] All existing tests pass
- [ ] Manual QA: the feature still works end-to-end
- [ ] MessageService line count reduces visibly

## Open questions

1. **Should ProfileService and ModerationService bundle into one "MetadataService"?** ~250 combined lines vs ~150+~100 separate. Bundling reduces ceremony but mixes concerns.
2. **Does `delete-conversation` belong in any extracted service?** It's at MessageService.ts:2525 and has its own logic. Probably stays in MessageService since it's a top-level command, not a content message type.
3. **How to handle `update-profile` ratchet rotation side effects?** Lines 1148–1166 mutate the participant record and touch `inbox_address`. This couples to space-member state and might be harder to extract than it looks.

---

_Created 2026-05-19 — supersedes the Dec 2025 archived plan (`.archived/messageservice-handlenewmessage-refactor.md`). Triggered by re-reading MessageService against the ThreadService extraction pattern during the 2026-05-19 audit. Wording correction in "Not a shared-migration enabler" applied during the same-day cross-check ([shared-migration-cross-check.md §Issue B](./shared-migration-cross-check.md#issue-b-tier-2-extractions--per-app-forever))._
