---
type: inventory
title: Capabilities where desktop's implementation is better than mobile's
status: living
created: 2026-06-01
updated: 2026-06-01
---

# Desktop-better-than-mobile inventory

This folder is conceptually a two-way feature diff between `quorum-desktop` and `quorum-mobile`. The sibling [candidates.md](candidates.md) tracks features mobile has and desktop is missing. **This file tracks the inverse**: capabilities where both apps have the feature, but desktop's implementation is materially better and could inform a future mobile rewrite.

## Why this exists

Several rounds of "is this missing on desktop?" verification surfaced that the same *capability* often exists on both sides under different names and different architectures. When desktop's version is meaningfully better — better design, more correct, more maintainable, respects more user settings — that's not a dead end; it's a candidate for a future port-to-mobile effort. Recording it here gives the lead dev (and future sessions) a curated list of "things mobile could converge toward when there's bandwidth", separate from the active shared-package migration work.

## Scope boundary vs. shared-migration's `mobile-tasks-pending.md`

Two adjacent docs, different abstractions:

| Doc | What it tracks | Shape |
|---|---|---|
| [quorum-shared-migration/mobile-tasks-pending.md](../quorum-shared-migration/mobile-tasks-pending.md) | Shared has new exports; mobile needs to adopt them. Concrete swap tasks. | Bounded, task-shaped, often a small import-swap PR. |
| **This file** | Desktop's *implementation of a capability* is materially better than mobile's. Mobile could converge architecturally. | Broader, capability-shaped. May require new infrastructure on mobile (storage layer, type system, etc.) before any swap is possible. |

If a "desktop-better" finding eventually becomes a concrete shared-promotion task (e.g. desktop's helper goes to shared, then mobile swaps), that's the point where it graduates into a `mobile-tasks-pending.md` row in the shared-migration folder. Until then it lives here as an architectural observation.

## What we do NOT do from this list

- We do NOT push code to `quorum-mobile`. Mobile remains read-only for this effort (same rule as in [workflow.md](workflow.md)).
- We do NOT open mobile PRs based on this inventory. It's a reference doc for the lead dev, not an action list for us.
- We do NOT block on these findings. Desktop-side work proceeds based on [candidates.md](candidates.md).

## Format for each entry

```
### N. <Capability name>

**Mobile:** `path/to/mobile/file.ts` — one-line summary of mobile's approach
**Desktop:** `path/to/desktop/file.ts` — one-line summary of desktop's approach
**Why desktop is better:** the concrete reasons
**Mobile-port cost:** low / medium / high — what mobile would need to change to converge
**Shared-package involvement:** none / additive / would need new exports
**Status:** noted / shared-promotion-queued / mobile-PR-opened
```

---

## 1. Reply notification counts

**Mobile:** [`quorum-mobile/hooks/chat/useReplyTracking.ts`](../../../../quorum-mobile/hooks/chat/useReplyTracking.ts) — MMKV-backed counter. WebSocket handler calls `incrementReplyCount` on every incoming reply where `replyMetadata.parentAuthor === currentUser`. A separate "active channel" module-level singleton suppresses bumps while the user is viewing the channel; `clearReplyCount` is called on entry.

**Desktop:** [`src/hooks/business/replies/useReplyNotificationCounts.ts`](../../../src/hooks/business/replies/useReplyNotificationCounts.ts) — React Query projection over `MessageDB`. Per render, queries `messageDB.getUnreadReplies()` with the channel's `conversation.lastReadTimestamp` as the cutoff, then filters out replies already read in threads via `threadReadTimes`. No separate "count" state to keep in sync.

**Why desktop is better:**
1. **No state divergence.** Mobile's counter is a cache that can drift from the canonical message store (reconnects, sync catch-up, multi-device sync, app restart mid-sync). Desktop's count is derived from the store, so it can't diverge.
2. **Respects user notification settings.** Desktop checks `notificationSettings[spaceId].isMuted`, per-type enable flags via `isNotificationTypeEnabled(settings, 'reply')`, and per-channel mutes via `mutedChannels`. If the user explicitly muted a channel or disabled reply notifications, desktop returns 0; mobile counts anyway.
3. **Respects per-thread read state.** Desktop excludes thread replies already read by checking against `threadReadTimes[threadId]`. Mobile has no thread-read awareness.
4. **No active-channel side-channel.** Desktop doesn't need mobile's module-level `activeChannelKey` singleton + `setActiveChannel`/`clearActiveChannel` API surface; "did the user read this" is a property of the canonical store, not an ephemeral RAM flag.
5. **Bounded display.** Desktop caps at `DISPLAY_THRESHOLD = 10` ("9+" in UI); mobile counts unboundedly.

**Mobile-port cost:** **HIGH.** Desktop's implementation assumes a persisted message store with `lastReadTimestamp` per conversation + per-thread read times. Mobile's storage layer (MMKV + `messagesDb.ts`) would need to gain equivalent indexes / queries. The mobile choice to skip a heavier IndexedDB-style store was likely deliberate for mobile constraints (cold boot, app suspension) — convergence requires reconsidering that.

**Shared-package involvement:** none in the short term. Desktop's hook is tightly coupled to its `MessageDB` interface (which is desktop-specific). If a shared `StorageAdapter` ever grows the methods desktop's hook calls (`getUnreadReplies`, `getThreadReadTimesForChannel`, `getConversation` with `lastReadTimestamp`), then the *logic* of the hook could become shareable — but that's downstream of substantial shared-storage work.

**Status:** noted (2026-06-01).

**Related desktop infrastructure (for context):**
- [`src/hooks/business/replies/useSpaceReplyCounts.ts`](../../../src/hooks/business/replies/useSpaceReplyCounts.ts) — aggregates per-space
- [`src/hooks/business/replies/useAllReplies.ts`](../../../src/hooks/business/replies/useAllReplies.ts) — full replies inbox
- [`src/hooks/business/mentions/useChannelMentionCounts.ts`](../../../src/hooks/business/mentions/useChannelMentionCounts.ts) — parallel mention-count system
- [`src/services/NotificationService.ts`](../../../src/services/NotificationService.ts) — OS-level notifications, typed metadata for `'dm' | 'mention' | 'reply'`
- [`src/components/notifications/NotificationPanel.tsx`](../../../src/components/notifications/NotificationPanel.tsx) — in-app notification panel
- [`.agents/tasks/.done/reply-notification-system.md`](../.done/reply-notification-system.md) — completed architecture task doc
- [`.agents/docs/features/mention-notification-system.md`](../../docs/features/mention-notification-system.md), [`notification-indicators-system.md`](../../docs/features/notification-indicators-system.md) — architecture docs

---

*Last updated: 2026-06-01 — file created; first entry: reply notification counts.*
