---
type: inventory
title: "Port to Mobile — candidates (features + convergence)"
status: living
created: 2026-06-12
updated: 2026-06-12
---

# Port-to-mobile candidates

> The inverse of [port-from-mobile/candidates.md](../port-from-mobile/candidates.md). This is the running list of **desktop → mobile** work: things mobile should get from desktop, not yet turned into a task.

> **What we do NOT do here.** We do **not** push code to `quorum-mobile`. Mobile is read-only context for this effort (same rule as [port-from-mobile/workflow.md](../port-from-mobile/workflow.md)). This doc is a curated reference for the lead dev + future sessions. When a candidate becomes a concrete dropped task, it graduates into the unified tracker → [quorum-shared-migration/mobile-tasks-pending.md](../quorum-shared-migration/mobile-tasks-pending.md) (see [Lifecycle](#lifecycle) below).

## The two kinds of candidate (the `Type` column)

This doc deliberately merges what used to be two separate files (the old `desktop-better-than-mobile.md` was folded in here on 2026-06-12). The distinction is now a **column, not a file**:

| Type | Meaning | Example |
|---|---|---|
| **feature-port** | Mobile lacks the capability entirely. A true port. | Desktop has X; mobile has nothing equivalent. |
| **convergence** | Both apps have the capability, but desktop's implementation is materially better (more correct, more maintainable, respects more settings). Mobile could converge architecturally. | Both have reply counts; desktop's is derived-from-store, mobile's is a drift-prone cache. |

The line between them matters for **cost**: a `feature-port` is net-new mobile code; a `convergence` often needs mobile to *replace* working infrastructure (storage layer, type system), so it usually carries a lead-dev architecture call.

## Lifecycle

```
candidate (here)  →  concrete task dropped on mobile  →  row in mobile-tasks-pending.md  →  mobile PR  →  done
   feature-port /         (mobile task file +              (the unified tracker;
   convergence            desktop-side bookkeeping)         Category = feature-port / convergence /
   observation                                              shared-migration)
```

A candidate lives here as an **observation**. The moment it becomes a concrete, scoped task we've handed to the mobile side, it gets a row in the [unified tracker](../quorum-shared-migration/mobile-tasks-pending.md) with `Category` matching its `Type` here. The two docs use the same vocabulary on purpose.

## Status board

Legend: 📋 noted (observation only) · 🟢 ready to scope · 🚧 task dropped (now tracked) · ⏸️ deprioritized · ❌ won't port

| # | Capability | Type | Cost | Shared involvement | Status |
|---|---|---|---|---|---|
| 1 | Reply notification counts (derived, settings-aware, thread-aware) | convergence | HIGH | none short-term | 📋 noted (2026-06-01) |
| 2 | Per-space notification preferences (event-type granularity + cross-device sync + reinstall-survival) | convergence | HIGH | additive (types exist) | 📋 noted (2026-06-07) |

*(feature-port candidates go here as they're identified — e.g. desktop-only features mobile lacks. None catalogued yet; add rows as the desktop→mobile diff surfaces them.)*

## Format for each entry

```
### N. <Capability name>  — [feature-port | convergence]

**Mobile:** `path/to/mobile/file.ts` — one-line summary of mobile's approach (or "absent" for feature-port)
**Desktop:** `path/to/desktop/file.ts` — one-line summary of desktop's approach
**Why desktop is better / why mobile needs it:** the concrete reasons
**Mobile cost:** low / medium / high — what mobile would need to change
**Shared-package involvement:** none / additive / would need new exports
**Status:** noted / task-dropped (→ tracker row) / deprioritized
```

---

## 1. Reply notification counts — convergence

**Mobile:** [`quorum-mobile/hooks/chat/useReplyTracking.ts`](../../../../quorum-mobile/hooks/chat/useReplyTracking.ts) — MMKV-backed counter. WebSocket handler calls `incrementReplyCount` on every incoming reply where `replyMetadata.parentAuthor === currentUser`. A separate "active channel" module-level singleton suppresses bumps while the user is viewing the channel; `clearReplyCount` is called on entry.

**Desktop:** [`src/hooks/business/replies/useReplyNotificationCounts.ts`](../../../src/hooks/business/replies/useReplyNotificationCounts.ts) — React Query projection over `MessageDB`. Per render, queries `messageDB.getUnreadReplies()` with the channel's `conversation.lastReadTimestamp` as the cutoff, then filters out replies already read in threads via `threadReadTimes`. No separate "count" state to keep in sync.

**Why desktop is better:**
1. **No state divergence.** Mobile's counter is a cache that can drift from the canonical message store (reconnects, sync catch-up, multi-device sync, app restart mid-sync). Desktop's count is derived from the store, so it can't diverge.
2. **Respects user notification settings.** Desktop checks `notificationSettings[spaceId].isMuted`, per-type enable flags via `isNotificationTypeEnabled(settings, 'reply')`, and per-channel mutes via `mutedChannels`. If the user explicitly muted a channel or disabled reply notifications, desktop returns 0; mobile counts anyway.
3. **Respects per-thread read state.** Desktop excludes thread replies already read by checking against `threadReadTimes[threadId]`. Mobile has no thread-read awareness.
4. **No active-channel side-channel.** Desktop doesn't need mobile's module-level `activeChannelKey` singleton + `setActiveChannel`/`clearActiveChannel` API surface; "did the user read this" is a property of the canonical store, not an ephemeral RAM flag.
5. **Bounded display.** Desktop caps at `DISPLAY_THRESHOLD = 10` ("9+" in UI); mobile counts unboundedly.

**Mobile cost:** **HIGH.** Desktop's implementation assumes a persisted message store with `lastReadTimestamp` per conversation + per-thread read times. Mobile's storage layer (MMKV + `messagesDb.ts`) would need to gain equivalent indexes / queries. The mobile choice to skip a heavier IndexedDB-style store was likely deliberate for mobile constraints (cold boot, app suspension) — convergence requires reconsidering that.

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

## 2. Per-space notification preferences — model richness, sync, and gating fidelity — convergence

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

**Mobile cost:** **HIGH.**
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

*Last updated: 2026-06-12 — file created. Folded in the two entries from the former `port-from-mobile/desktop-better-than-mobile.md` (reply notification counts; per-space notification preferences) as `convergence`-type candidates, and reframed the doc to also hold `feature-port` candidates via a `Type` column. The standalone `desktop-better-than-mobile.md` was retired in the same change — its distinction is now a column here, not a separate file.*
