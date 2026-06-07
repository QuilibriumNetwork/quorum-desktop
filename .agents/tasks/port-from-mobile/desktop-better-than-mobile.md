---
type: inventory
title: Capabilities where desktop's implementation is better than mobile's
status: living
created: 2026-06-01
updated: 2026-06-07
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

## 2. Per-space notification preferences — model richness, sync, and gating fidelity

**Mobile:** [`quorum-mobile/services/notifications/notificationPrefs.ts`](../../../../quorum-mobile/services/notifications/notificationPrefs.ts) — three-level boolean tree in MMKV (`global:enabled`, `space:<id>`, `channel:<spaceId>:<channelId>`), AND-resolved by `shouldNotifyForContext()`. Local-only, mirrored to iOS App Group for the NSE to read. No event-type granularity.

**Desktop:** [`src/hooks/business/channels/useChannelMute.ts`](../../../src/hooks/business/channels/useChannelMute.ts) + [`UserConfig.notificationSettings`](../../../../quorum-shared/src/types/user.ts) — per-space `SpaceNotificationSettings` with `isMuted: boolean` AND `enabledNotificationTypes: SpaceNotificationTypeId[]` (`'mention-you' | 'mention-everyone' | 'mention-roles' | 'reply'`). Channel mute lives in separate `mutedChannels[spaceId]: string[]`. Stored in encrypted `UserConfig` blob, synced across devices via `apiClient.postUserSettings()`.

**Why desktop is better:**

1. **Event-type granularity.** Desktop users can opt out of `@everyone` while keeping `@you` notifications on — a real preference in busy spaces. Mobile has no equivalent; it's all-or-nothing per space/channel.
2. **Cross-device sync.** A user who mutes a noisy space on their desktop has it muted on their phone too. Mobile prefs are local to each device, so muting on phone doesn't carry to desktop or to a second phone. This is a real ongoing pain point for multi-device users.
3. **Settings are part of identity-encrypted user config.** Desktop's prefs survive reinstall (they're on the server, key-derived). Mobile's prefs are wiped on app reinstall / device change.
4. **Uses the existing shared type.** `SpaceNotificationSettings` and `SpaceNotificationTypeId` already live in `@quilibrium/quorum-shared/src/types/notifications.ts` — desktop consumes them, mobile imports the types but doesn't use them in UI. The shared schema is the natural target for convergence.

**Why mobile is currently better in two narrow ways (honest accounting):**
- Mobile's NSE-level (Swift) suppression means muted-channel pushes don't even reach the OS notification center on iOS — a privacy + battery win. Desktop's suppression happens in JS only.
- Mobile's simpler model is easier for casual users; the desktop event-type multi-select is denser UI. Convergence has to keep the master toggle prominent and the type filter as progressive disclosure.

**Mobile-port cost:** **HIGH.**
- Mobile would need to write to `UserConfig.notificationSettings` (synced config), replacing or supplementing the MMKV store.
- The iOS NSE currently reads MMKV via App Group mirror. Switching to `UserConfig` means either (a) the NSE reads the encrypted config (heavy; the NSE process needs key access), or (b) the synced settings get mirrored back into the same MMKV store that the NSE already reads. Option (b) is the realistic path: `UserConfig` is the source of truth and writes propagate to MMKV for the NSE.
- New mobile UI to expose the event-type filter (currently doesn't exist as a control on mobile).
- The May 28 architecture report records that mobile's local-only choice was **intentional**, not unfinished — convergence requires revisiting that decision with the lead dev, not just porting.

**Shared-package involvement:** **additive.** The types already exist. What's missing is a shared hook (`useNotificationSettings`) that both apps could consume, plus possibly a shared `shouldNotifyForContext`-equivalent utility that knows about both `isMuted` and `enabledNotificationTypes`. These would replace mobile's `notificationPrefs.ts` and parts of desktop's `useChannelMute.ts`.

**Status:** noted (2026-06-07).

**Related desktop infrastructure (for context):**
- [`quorum-shared/src/types/notifications.ts`](../../../../quorum-shared/src/types/notifications.ts) — shared types already exist (`SpaceNotificationSettings`, `SpaceNotificationTypeId`)
- [`quorum-shared/src/types/user.ts`](../../../../quorum-shared/src/types/user.ts) — `UserConfig.notificationSettings` shape
- [`src/hooks/business/channels/useChannelMute.ts`](../../../src/hooks/business/channels/useChannelMute.ts) — full desktop hook (read sites + writers)
- [`src/hooks/business/mentions/useMentionNotificationSettings.ts`](../../../src/hooks/business/mentions/useMentionNotificationSettings.ts) — event-type filter persistence (has its own sync bug — see [`2026-06-07-mention-type-filter-not-synced.md`](../../bugs/2026-06-07-mention-type-filter-not-synced.md))
- [`.agents/reports/2026-05-28-notification-architecture-divergence.md`](../../reports/2026-05-28-notification-architecture-divergence.md) — full architectural divergence analysis
- [`.agents/tasks/2026-06-07-align-notification-settings-with-mobile.md`](../2026-06-07-align-notification-settings-with-mobile.md) — desktop-side UX rename that left this convergence work deferred to this entry

**Suggested approach when this gets picked up:**
1. Decide the source-of-truth question with the lead dev: `UserConfig.notificationSettings` (cross-device sync) vs. status-quo MMKV (local-only). Recommend the former.
2. If sync is in: mirror `UserConfig` writes into the existing MMKV store so the iOS NSE keeps working without changes to the Swift code.
3. Add event-type filter UI to mobile space settings (progressive disclosure under the master toggle).
4. Promote `useChannelMute` and friends to `quorum-shared` once both apps consume the same shape.

---

*Last updated: 2026-06-07 — added entry #2: per-space notification preferences (richness + sync + gating fidelity).*

*Previously: 2026-06-01 — file created; first entry: reply notification counts.*
