---
type: inventory
title: "Port to Mobile — candidates (features + convergence)"
status: living
created: 2026-06-12
updated: 2026-06-12
---

# Port-to-mobile candidates

> The inverse of [port-from-mobile/candidates.md](../port-from-mobile/candidates.md). This is the running list of **desktop → mobile** work: things mobile should get from desktop, not yet turned into a task.

> **What we do NOT do here.** We do **not** push code to `quorum-mobile`. Mobile is read-only context for this effort (same rule as [port-from-mobile/workflow.md](../port-from-mobile/workflow.md)). This doc is a curated reference for the lead dev + future sessions. When a candidate becomes a concrete dropped task, write the task file in the **mobile** repo and track it there (mobile's `STATUS.md` / the file's frontmatter); [quorum-shared-migration/mobile-tasks-pending.md](../quorum-shared-migration/mobile-tasks-pending.md) is just a signpost to those homes (see [Lifecycle](#lifecycle) below).

## The two kinds of candidate (the `Type` column)

This doc deliberately merges what used to be two separate files (the old `desktop-better-than-mobile.md` was folded in here on 2026-06-12). The distinction is now a **column, not a file**:

| Type | Meaning | Example |
|---|---|---|
| **feature-port** | Mobile lacks the capability entirely. A true port. | Desktop has X; mobile has nothing equivalent. |
| **convergence** | Both apps have the capability, but desktop's implementation is materially better (more correct, more maintainable, respects more settings). Mobile could converge architecturally. | Both have reply counts; desktop's is derived-from-store, mobile's is a drift-prone cache. |

The line between them matters for **cost**: a `feature-port` is net-new mobile code; a `convergence` often needs mobile to *replace* working infrastructure (storage layer, type system), so it usually carries a lead-dev architecture call.

## Lifecycle

```
candidate (here)  →  concrete task dropped on mobile  →  mobile PR  →  done
   feature-port /         (task file in the mobile repo,
   convergence            tracked in mobile's STATUS.md /
   observation            its own frontmatter)
```

A candidate lives here as an **observation**. The moment it becomes a concrete, scoped task, write the task file in the **mobile** repo (`quorum-mobile/.agents/tasks/…`) and track its status there (frontmatter + mobile's `STATUS.md`). The desktop [`mobile-tasks-pending.md`](../quorum-shared-migration/mobile-tasks-pending.md) is a signpost to those mobile-side homes — it's not a list you add the task to.

## Status board

Legend: 📋 noted (observation only) · 🟢 ready to scope · 🚧 task dropped (now tracked) · ⏸️ deprioritized · ❌ won't port

> **Audit pass 2026-06-12.** Rows 3–25 added from a structured cross-repo audit (desktop ↔ mobile ↔ shared) of the 5 user-named features + a broad sweep. Method: reversed capability-verification (verify the concept on mobile, not a name-grep). Each entry below cites desktop source, mobile state, and shared involvement. **A recurring finding: most of these have their shared types/logic ALREADY in `@quilibrium/quorum-shared@2.1.0-29`** — the gap is mobile wiring + a version bump (mobile is pinned to `2.1.0-26`), not new shared work. Verified the uncertain `UserConfig` fields directly: `nonRepudiable`, `deliveryReceipts`, `readReceipts`, `typingIndicatorsDM`, `typingIndicatorsSpaces`, `generateYouTubePreviews`, `deviceNames`, `userNotes`, `spaceTagId` all exist in shared source.

### Feature-ports (mobile lacks it entirely / scaffolded-not-wired)

| # | Capability | Cost | Shared involvement | Status |
|---|---|---|---|---|
| 3 | **Threads in spaces** (side-panel threaded replies on a channel message) | HIGH | types ALREADY-EXIST; `StorageAdapter` needs thread query methods; `ThreadService`/`channelThreadHelpers` are promotion candidates | 📋 noted — biggest gap |
| 4 | **Markdown rendering in messages** (bold/italic/lists/blockquote/tables + **fenced code blocks + inline code** + spoilers) | MED-HIGH | parse/strip ALREADY-EXISTS (incl. `.native.ts`); RENDER must be RN-specific; preprocessing pipeline is ADDITIVE promotion | 📋 noted |
| 5 | **YouTube facade** (thumbnail-first click-to-load, sender embeds base64 thumb; privacy) | MED | utils ALREADY-EXIST (`fetchYouTubeThumbnailAsBase64`, `extractStandaloneYouTubeVideoIds`); mobile dupes parsing locally | 📋 noted |
| 6 | **"Generate YouTube previews" setting** (Privacy toggle gating sender-side thumb fetch) | SMALL | `UserConfig.generateYouTubePreviews` ALREADY in shared | 📋 noted |
| 7 | **Typing indicators** (broadcast + render "X is typing…" in channel/thread/DM) | MED | `TypingService` + types + tests ALREADY COMPLETE in shared; desktop ships a `TypingIndicator.native.tsx` null-stub w/ "follow-up in mobile" comment | 📋 noted — shared-ready |
| 8 | **@everyone / @role mentions** (compose + send-metadata + render + notify) | MED | `extractMentionsFromText` handles both; ALREADY-EXISTS, mobile never calls it | 📋 noted (part of mentions cluster) |
| 9 | **DM delivery & read receipts** (✓/✓✓ + privacy toggles) | HIGH | `deliveryReceipts`/`readReceipts` in `UserConfig` ALREADY-EXIST; wire types need shared migration (desktop has a task) | 📋 noted |
| 10 | **"New messages" separator + jump-to-first-unread** | MED | NONE (UI/scroll) | 📋 noted |
| 11 | **Space tags** (4-char tag badge next to sender name + tag picker in settings) | MED | types ALREADY-EXIST; `spaceTagId` in `UserConfig` | 📋 noted |
| 12 | **User notes** (private per-user annotations, synced) | MED | `UserConfig.userNotes`/`deletedUserNoteAddresses` ALREADY-EXIST | 📋 noted |
| 13 | **Encrypted DM data backup** (export/import `.qmbak`) | LARGE | NONE (format could be promoted, ADDITIVE) | 📋 noted |
| 14 | **Device renaming** (label authorized devices) | MED | `UserConfig.deviceNames` ALREADY-EXISTS | 📋 noted |
| 15 | **"Always sign DMs" (nonRepudiable) toggle** | SMALL | `UserConfig.nonRepudiable` ALREADY-EXISTS (mobile hardcodes `true`) | 📋 noted |
| 16 | **Global typing-indicator toggles** (send in DMs / Spaces) | SMALL | `typingIndicatorsDM`/`typingIndicatorsSpaces` ALREADY-EXIST | 📋 noted (pairs with #7) |
| 17 | **Space Settings "Fixes" section** (auto-repair tools, conditional) | SMALL | NONE | 📋 noted (low value) |
| 18 | **Emoji skin-tone preference** (remembered Fitzpatrick modifier) | SMALL-MED | NONE | 📋 noted (low value) |
| 19 | **In-app i18n / language switcher** (full Lingui 26-lang support + locale picker; mobile has ZERO i18n) | MED | NONE (app-level i18n) | 📋 noted — detailed plan exists (see entry below) |
| 20 | **"Restore Missing Spaces" recovery tool** | SMALL | NONE | 📋 noted (mobile's hub-log sync may reduce need) |
| 21 | **Per-message signing toggle** (lock button in composer when repudiable mode on) | LOW | NONE (UI-only) | 📋 noted |

### Convergence (mobile has it, desktop's is better / safer)

| # | Capability | Cost | Shared involvement | Status |
|---|---|---|---|---|
| 1 | Reply notification counts (derived, settings-aware, thread-aware) | HIGH | none short-term | 📋 noted (2026-06-01) |
| 2 | Per-space notification preferences (event-type granularity + cross-device sync + reinstall-survival) | HIGH | additive (types exist) | 📋 noted (2026-06-07) |
| 22 | **User mentions — autocomplete + pill render** (mobile's exist but use WRONG wire format — see cross-cutting note) | MED | extract `USER_MENTION_REGEX` as named export (ADDITIVE); migrate to shared `useMentionInput` optional | 🔴 noted — wire-format mismatch breaks cross-platform mentions |
| 23 | **Mention notification counts/highlights** (mobile relies on server-vended count; no client logic) | MED | `isMentionedWithSettings`, `SpaceNotificationSettings`, `formatMentionCount` ALREADY-EXIST | 📋 noted (pairs with rows 1/2) |
| 24 | **Channel mute → hide/dim muted channels** (mobile mutes notifications only) | LOW-MED | `showMutedChannels` in `UserConfig` ALREADY-EXISTS | 📋 noted |
| 25 | **Space folders UI** (data round-trips on mobile; list view ignores folders — no folder UI/DnD) | HIGH | `NavItem`/`FolderColor`/`validateItems` ALREADY-EXIST | 📋 noted (data layer done, UX absent) |
| 28 | **Scroll-to-first-unread on channel/DM entry** (desktop jumps to first unread if ≥5 unread or ≥5min old; mobile always lands at bottom) | MED | NONE (UI/scroll; reads shared `Conversation.lastReadTimestamp`) | 📋 noted (pairs with #10 separator) |
| 29 | **Message highlight on link/notification/bookmark jump** (scroll + timed flash; mobile PARTIAL — only pinned/bookmark, loaded-window only, wrong color/duration, no notification deep-link, no pagination fallback) | LOW-MED | NONE | 📋 noted |
| 30 | **Mention viewport highlight** (unread @-you messages auto-flash on entry, 61s vs 8s link-jump timing; mobile ABSENT) | MED | NONE (needs `lastReadTimestamp` plumbed to list) | 📋 noted (pairs with #23/#30) |
| 31 | **Channel icon picker — feature parity + EXPAND the set** (mobile: 20 icons vs desktop's 49; NO outline/filled variant; raw-hex vs named-color) — and the shared task also EXPANDS the curated set beyond 49 (183 whitelisted icons eligible; new ones can be added to the map) + needs a picker scroll/layout fix so it doesn't overflow | LOW-MED | promote + expand `ICON_OPTIONS` in shared (ADDITIVE) | 🚧 task-dropped (mobile 7.2 + shared task) |
| 32 | **GROUP icon + color** (desktop `GroupEditorModal` has full picker; mobile group header has NO icon affordance — `updateGroup` accepts `icon`/`iconColor` but UI never calls it) | LOW | `Group.icon`/`iconColor`/`iconVariant` ALREADY in shared | 🚧 task-dropped (mobile 7.2) |
| 33 | **🐛 Channel-list icons render default** (BUG — see bug section) | LOW | none | 🚧 task-dropped (mobile 7.1, bug) |
| 34 | **Avatar initials — display-name-based + shared logic** (mobile derives initials from the raw ADDRESS → opaque "AC"; desktop derives from the display name, emoji-aware, deterministic color — and the logic is ALREADY in shared) | MED | NONE — `getInitials` + `getColorFromDisplayName` ALREADY in `@quilibrium/quorum-shared` (`src/utils/avatar.ts`); mobile just never imports them | 🚧 task-dropped (mobile task file written 2026-06-14) |

### 🔴 Correctness / permission bugs on mobile (not "missing features" — broken invariants)

These surfaced during the 2026-06-12 parity deep-dive. Mobile reimplements permission logic locally instead of consuming shared's helpers, and three enforcement gaps result. **Higher priority than most feature-ports** because they silently break access-control that desktop enforces.

> **🚧 TASK DROPPED 2026-06-12.** Rows 26a–c + 27 are now an actionable mobile task: `quorum-mobile/.agents/tasks/2026-06-12-permission-enforcement-wave-0.md` (= "Wave 0" in the sequencing section). Tracked desktop-side as row 0 in [mobile-tasks-pending.md](../quorum-shared-migration/mobile-tasks-pending.md). No shared work / no version bump (helpers already in mobile's installed `2.1.0-26`).

| # | Bug | Mobile evidence | Root cause | Shared fix available |
|---|---|---|---|---|
| 26a | **`@everyone` unenforced** — any member can `@everyone` regardless of role | `SpaceChatArea.tsx` send path never checks `'mention:everyone'`; desktop checks at `Channel.tsx:1129` + `MessageService.ts:4626` | mobile doesn't call shared `hasPermission` | `hasPermission` ALREADY-EXISTS |
| 26b | **`user:mute` unenforced** — mute is local-only MMKV; any member can mute anyone | `useUserMuting.ts` no guard; `UserProfileModal.tsx:271` shows button unconditionally; `createChannelPermissionChecker` unused on mobile | same | `createChannelPermissionChecker` ALREADY-EXISTS |
| 27 | **Read-only channels unenforced** — a channel set read-only on desktop shows mobile users a live composer; they can post | `SpaceChatArea.tsx:722-746` renders `MessageInput` with no `canPost` gate; `canManageReadOnlyChannel` unused; SET UI also absent in `SpaceSettingsModal` | same | `canManageReadOnlyChannel` + `Channel.isReadOnly`/`managerRoleIds` ALREADY-EXIST |
| 26c | **Owner-permission masking** (latent) — mobile's `useHasPermission`/`useUserPermissions`/`useUserRoles` omit the `isSpaceOwner` short-circuit; masked at the one current caller, breaks any future caller | `useRoleManagement.ts:56-111` | partial open task `2026-05-29-mobile-adopt-shared-permission-helpers.md` (doesn't cover 26a/26b/27) | delegating to shared fixes it |

**Roles CRUD parity** (separate from enforcement): mobile's role create/edit/delete/assign/permission-toggle UI is substantially COMPLETE and matches desktop (neither has role color-picker or reordering). The gap is purely enforcement (26a–c, 27), not management.

### 🐛 Channel-list icons render the default (live bug, row 33)

**Symptom (user-reported 2026-06-12):** a channel's icon is set in mobile settings (saves correctly, shows in the settings modal), but the **channels list** always shows the default hashtag icon.

**Root cause (verified):** `quorum-mobile/app/(tabs)/spaces/[id]/index.tsx:118` hardcodes the icon in the channel-list row:
```tsx
<IconSymbol name="number" size={18} color={theme.colors.textMuted} />
```
`channel` is in scope (the same row uses `channel.channelId` / `channel.channelName`) but `channel.icon` / `channel.iconColor` are never read. So even a correctly-saved mobile icon won't appear here.

**Fix (one line):** `name={channel.icon || 'number'}` + `color={channel.iconColor || theme.colors.textMuted}`. Independent of the Tabler/SF icon-set mismatch (row 31) — that's a *separate* reason a desktop-set icon name may not resolve on mobile, but THIS bug hits even mobile-set icons. **Cost: trivial.** Worth fixing alongside row 31/32 (the icon-parity work).

## Recommended sequencing (2026-06-12, with user priorities)

User-stated interest (2026-06-12), roughly in their priority order: user mentions (first), @everyone/role mentions, roles parity check, read-only channels, YouTube facade + setting, image+caption single-message, DM read receipts, scroll-to-last-seen, message highlighting, space tags, user notes, markdown. Below is the recommended ORDER, which front-loads the correctness bugs and the highest-leverage shared-consumption work.

**Wave 0 — permission enforcement (correctness, do first).** The mention/roles/read-only items the user named are entangled: rows 26a–c + 27 are live access-control bugs sharing one root cause — mobile reimplements permissions instead of consuming shared. Fix by routing mobile through shared `hasPermission` / `createChannelPermissionChecker` / `canManageReadOnlyChannel` (extends the two existing open mobile tasks). This single change enforces `@everyone` (26a), `user:mute` (26b), read-only-channel posting (27), and removes the owner-masking footgun (26c). **High leverage: one consumption fix closes four gaps.** Read-only channel SET UI (#27 second half) and @role *send-metadata* (#8) ride along naturally.

**Wave 1 — user mentions, done right (the user's #1).** Decide the wire format (🔴 cross-cutting note): align mobile to desktop's `@<address>`. Then: call `extractMentionsFromText` on mobile's send path (fixes empty `mentions` + @everyone/@role metadata — #8), align `MentionableText` regex to parse `@<address>` (#22 pill render), add roles/@everyone to autocomplete (#22). Mention notification counts (#23) + mention viewport highlight (#30) are the follow-on once `lastReadTimestamp` is plumbed. **Do Wave 0 first** — mention enforcement depends on the permission fix.

**Wave 2 — high-value standalone ports (independent, pick by appetite).**
- **YouTube facade (#5) + setting (#6)** — ship together (the setting gates the facade). Utils already in shared. MED + SMALL.
- **DM delivery/read receipts (#9)** — HIGH but high user value; needs the receipts wire-type shared migration first (desktop task exists).
- **Scroll-to-first-unread (#28) + new-messages separator (#10)** — ship together, pure UI/scroll, no shared work.
- **Message-highlight parity (#29)** — small polish on mobile's existing partial impl (fix color/duration, add notification deep-link + pagination fallback).

**Wave 3 — the rest, by value.** Space tags (#11), user notes (#12), markdown (#4, MED-HIGH, RN renderer), then the smaller settings/UX items (#15, #16, #24, accent/theme toggles), then threads (#3, HIGH, biggest single effort — worth its own planning pass).

**Image + caption single message — CONVERGENCE, desktop half SHIPPED 2026-06-13 ([#201](https://github.com/QuilibriumNetwork/quorum-desktop/pull/201)).** ⚠️ The earlier "NO PORT NEEDED / minor cosmetic" framing was WRONG — the 2026-06-13 cross-repo review found this is a **live cross-platform bug**: mobile sends image+text as `EmbedMessage` with an informal `text?` cast, but mobile **never reads `embeddedMedia` on render**, so a desktop photo+caption (`PostMessage` + `embeddedMedia` + text) shows on mobile as **caption text only — the image is dropped**. Convergence decision (settled): both apps use `PostMessage` + `embeddedMedia` (NOT "add `text?` to `EmbedMessage`"); `embed` becomes receive-only legacy. **Desktop side is now done** (#201: image-only sends moved off `embed` onto `post`+`embeddedMedia`; GIF playback ported; send-button active-on-attach). **Mobile side still open**: read `embeddedMedia` on render (fixes the bug) + send `post`+`embeddedMedia`. Tracked as [mobile-tasks-pending row 1.7](../quorum-shared-migration/mobile-tasks-pending.md) + mobile task `2026-06-13-converge-image-caption-to-post-embeddedmedia.md`. Two-repo, no shared change.

### Already tracked on mobile (cross-ref, NOT new candidates)

| Capability | Mobile task | Status |
|---|---|---|
| DM profile sync (`dm-update-profile` broadcast/receive) | `quorum-mobile/.agents/tasks/2026-06-09-port-dm-update-profile-from-desktop.md` | 🚧 BLOCKED on shared publish (`DMUpdateProfileMessage` not in `2.1.0-26` dist) |
| Config→user read-back (bio, isProfilePublic, primaryUsername) | `quorum-mobile/.agents/tasks/2026-06-10-primary-username-sync-and-publish.md` + 2 bugs | 🚧 in progress; ties to QNS publish (see [[project_qns_username_broadcast_pending]]) |

### Not a meaningful port (desktop-chrome-specific — recorded, won't port)

Toast system (mobile has `ToastContext`) · web modal/overlay system (mobile uses native sheets) · ReactTooltip (no pointer on mobile) · responsive layout / sidebar drag (mobile is single-column native) · browser push permission UI (mobile has native push) · "Show QR for mobile import" (bootstraps mobile, irrelevant) · keyboard-shortcuts help (no keyboard chrome). Mobile-AHEAD (not a gap): onboarding privacy-level picker.

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

## 🔴 Cross-cutting finding: the mention wire-format mismatch (read before scoping #8 / #22 / #23)

The single most important finding of the 2026-06-12 audit. Desktop and mobile **store mentions in incompatible formats**, so cross-platform mentions silently break TODAY:

| Platform | Compose inserts | Storage format | Render parses |
|---|---|---|---|
| Desktop | `@<QmAbc123>` | `@<QmAbc123>` (angle-bracketed) | `/@<([^>]+)>/g` |
| Mobile | `@QmAbc123 ` (bare) | `@QmAbc123` (no brackets) | `/@([a-zA-Z0-9_.\-]+)/g` |

- A desktop→mobile message renders as literal text `@<QmAbc123>` on mobile (its regex can't match the brackets).
- A mobile→desktop message doesn't highlight on desktop (desktop expects brackets).
- Shared's `extractMentionsFromText` (`quorum-shared/src/utils/mentions.ts:393`, uses `/@<[^>]+>/g`) is the canonical extractor. **Mobile never calls it** — `quorum-mobile/services/space/spaceMessageService.ts` sets `mentions: { memberIds: [], roleIds: [], channelIds: [] }` to empty on every send path (lines ~285/402/562/630), and `quorum-mobile/components/Chat/MentionableText.tsx:43` uses a third, incompatible regex.

**This means the mentions cluster (#8, #22, #23) is not "nice to have" — it's a correctness bug across platforms.** The root fix is small in surface (one `extractMentionsFromText` call on send + a regex alignment on render) but needs a deliberate format decision with the lead dev (align mobile to `@<address>`, or change both). Flagged 🔴 in the status board. Likely belongs as a coordinated shared + mobile + desktop item.

---

## 3. Threads in spaces — feature-port

**Mobile:** ABSENT. No `threadId`/`threadMeta`/`isThreadReply` on `DisplayMessage` (`components/Chat/types.ts`), no "Create Thread" in `MessageActionSheet.tsx`, no `ThreadIndicator`, no thread hooks, no thread route. Mobile HAS flat inline-reply (`isReply`/`replyToMessageId`) — a different feature. (The `CastThreadModal` is Farcaster, unrelated.) No mobile `.agents/` planning exists.
**Desktop:** `src/components/thread/` (`ThreadPanel.tsx`, `ThreadIndicator.tsx`, `ThreadsListPanel.tsx`, `ThreadListItem.tsx`), `src/components/context/ThreadContext.tsx`, `src/hooks/business/threads/` (`useThreadMessages`, `useChannelThreads`, `useThreadStats`), `src/services/ThreadService.ts`, `src/services/channelThreadHelpers.ts`.
**Wire/storage format:** control message `type:'thread'`, `action: create|updateTitle|close|reopen|updateSettings|remove`, carrying `ThreadMeta { threadId, createdBy, customTitle?, isClosed?, ... }`. Replies carry `threadId` + client-side `isThreadReply`. Aggregated `ChannelThread` row persisted locally. Thread typing scope `th:<spaceId>:<channelId>:<threadId>`.
**Why mobile needs it:** Threads are a core space-collaboration primitive on desktop; mobile users in the same space can't see or participate in threaded conversations at all.
**Mobile cost:** HIGH — new thread route/view, `ThreadIndicator`, action-sheet entry, three hooks, `ThreadService` processing in the receive path, `StorageAdapter` thread query methods.
**Shared-package involvement:** types ALREADY-EXIST (`ThreadMeta`, `ThreadMessage`, `ChannelThread`, `Message.isThreadReply`, thread `TypingScope` all in `quorum-shared/src/types/message.ts` + `typing.ts`). `StorageAdapter` (shared `src/storage/adapter.ts`) has NO thread query methods → ADDITIVE. `ThreadService`/`channelThreadHelpers` are promotion candidates (currently `MessageDB`-coupled on desktop).
**Status:** noted (2026-06-12) — the largest single gap.

## 4. Markdown rendering in messages (code blocks, inline code, spoilers) — feature-port

**Mobile:** ABSENT for markdown. All message text routes through `components/Chat/MentionableText.tsx`, a custom tokenizer that only knows `@mention`/`#channel`/`:emoji:`/URL — **zero markdown awareness**. `**bold**`, `` `code` ``, fenced blocks, `||spoiler||` all render as literal characters. No markdown library in `package.json`. No mobile `.agents/` task.
**Desktop:** `src/components/message/MessageMarkdownRenderer.tsx` — `react-markdown` + `remark-gfm` + `remark-breaks` + custom `remarkTwemoji`. Bold/italic/strike/H3/blockquote/lists/tables, inline code, fenced code blocks (monospace, `bg-surface-4`, scroll-wrapped >10 lines, floating copy button — **no syntax-color highlighting**), spoilers (`||text||` → click/keyboard reveal, accessible).
**Why mobile needs it:** desktop users send formatted messages (and code) that mobile users see as raw syntax noise.
**Mobile cost:** MED-HIGH — add an RN markdown lib (e.g. `react-native-markdown-display`; `react-markdown` is DOM-only and can't be reused), build `MessageMarkdownRenderer.native.tsx` with `code`/`fence`/spoiler/mention overrides, wire `MessagesList.renderPostMessage` to it.
**Shared-package involvement:** parse/strip ALREADY-EXISTS — `quorum-shared/src/utils/markdownStripping.ts` + **`.native.ts`** (Metro-safe regex variant) + `markdownFormatting.ts` (compose-toolbar helpers) + `codeFormatting.ts` (DOM/RN-neutral). **Key split: PARSE is shareable, RENDER (DOM vs RN component tree) is not.** The desktop preprocessing pipeline (`processMentions`/`processURLs`/`fixUnclosedCodeBlocks`/`convertHeadersToH3`/…) lives inline in the renderer and is a strong ADDITIVE promotion candidate (`prepareMessageContent(content, opts)`) so both platforms share tokenization.
**Status:** noted (2026-06-12).

## 5. YouTube facade (lite embed) — feature-port

**Mobile:** ABSENT in chat. Mobile HAS a `react-native-youtube-iframe`-backed `YouTubeEmbed` (`components/SocialFeed/media/YouTubeEmbed.tsx`) but it's (a) Farcaster-social-feed only, (b) loads the player immediately (no thumbnail-first facade → no privacy/perf benefit), (c) doesn't consume message `embeddedMedia` thumbnails, (d) re-implements YouTube URL parsing locally instead of using shared. Chat-message YouTube links aren't embedded at all on mobile.
**Desktop:** `src/components/ui/YouTubeFacade.tsx` (+ `YouTubeEmbed.tsx` wrapper) — renders the sender-embedded base64 thumbnail with a play overlay; click swaps in the iframe. Sender embeds the thumb at send time in `useMessageComposer.ts` (gated by `generateYouTubePreviews`). `MessageMarkdownRenderer.tsx` detects standalone YT URLs → facade.
**Why mobile needs it:** privacy (receivers never hit YouTube) + perf, plus chat-parity (YT links currently inert in mobile chat).
**Mobile cost:** MED — RN facade (`Pressable` + thumbnail `Image` + play overlay → WebView on tap), wire the chat renderer to read `embeddedMedia.youtube-thumbnail`, gate send-side embedding on the setting (#6).
**Shared-package involvement:** ALREADY-EXISTS — `quorum-shared/src/utils/youtubeUtils.ts` exports `fetchYouTubeThumbnailAsBase64`, `extractStandaloneYouTubeVideoIds`, `extractYouTubeVideoId`, etc. Mobile should consume these (and drop its local dupes — cleanup bonus).
**Status:** noted (2026-06-12). Pairs with #6 (the setting).

## 6. "Generate YouTube previews" setting — feature-port

**Mobile:** ABSENT. No toggle in mobile settings; `useUserConfig` exposes no setter; composer never embeds a thumbnail. The shared `UserConfig.generateYouTubePreviews` field is imported (via the type) but never read/written.
**Desktop:** `src/components/modals/UserSettingsModal/Privacy.tsx:261-283` toggle; `useUserSettings.ts` read/write; stored in synced `UserConfig`.
**Why mobile needs it:** it's the privacy gate for #5 — without it the user can't control sender-side thumbnail fetching (an IP-leak vector).
**Mobile cost:** SMALL — toggle row in mobile Privacy settings + `updateYouTubePreviews` on `useUserConfig` + gate the composer.
**Shared-package involvement:** `UserConfig.generateYouTubePreviews` ALREADY-EXISTS in shared `src/types/user.ts:51`. No new exports.
**Status:** noted (2026-06-12).

## 7. Typing indicators — feature-port (shared-ready)

**Mobile:** ABSENT both sides. No `TypingService` instantiation, no broadcast from `MessageInput.tsx`, no `<TypingIndicator>`, and `context/WebSocketContext.tsx` has zero `typing-start`/`typing-stop` intercept (incoming typing msgs are silently dropped). No mobile `.agents/` task.
**Desktop:** `src/components/message/TypingIndicator.tsx`, `src/hooks/business/messages/useTypingIndicator.ts` + `useTypingNotifier.ts`, wired via `MessageDB.tsx` → `MessageService` (intercepts `typing-start/stop` in DM + space paths, never persists them). Sends via `sendEphemeralDMControl`/`sendEphemeralSpaceControl`. Notably ships `TypingIndicator.native.tsx` as a **null-stub with an explicit "mobile follow-up" comment**.
**Wire format:** `TypingMessage { type:'typing-start'|'typing-stop', senderId, scope:'dm'|'space', spaceId?, channelId?, threadId?, timestamp }`.
**Why mobile needs it:** presence parity; mobile users currently can't see desktop users typing and vice-versa.
**Mobile cost:** MED — WebSocket intercept → `typingService.onTypingReceived()`, instantiate `TypingService`, broadcast from `MessageInput` (+ auto-stop on send/unmount/`AppState` background), RN `TypingIndicator` component, privacy-gate wiring.
**Shared-package involvement:** ALREADY-COMPLETE — `quorum-shared/src/typing/` ships `TypingService` (throttle, 8s TTL, privacy gate, reorder protection, freshness filter) + types + a 483-line test suite, all public via `src/index.ts`. Constructor is platform-agnostic. Nothing new to publish.
**Status:** noted (2026-06-12) — lowest-friction medium feature; shared does the heavy lifting. Pairs with #16 (the send toggles).

## User mentions cluster (#8, #22, #23) — see cross-cutting note above first

**Desktop (the full system):** `src/hooks/business/mentions/` (`useMentionInput` tiered autocomplete, `useChannelMentionCounts`, `useSpaceMentionCounts`, `useAllMentions`, `useMentionNotificationSettings`, `useViewportMentionHighlight`), `MentionDropdown.tsx`, pill render in `MessageMarkdownRenderer.tsx` + `src/utils/mentionPillDom.ts`. Wire format `@<address>`; `@everyone` permission-gated; `@role` → `message.mentions.roleIds[]`.

**#22 Autocomplete + pill render — convergence (mobile's exist but worse + wrong format):** mobile `components/Chat/MessageInput.tsx` has @member/#channel autocomplete (inserts bare `@address` — wrong), caps at 6, no roles/@everyone, no QNS-awareness; `MentionableText.tsx` render regex can't parse `@<address>`. **Shared:** extract a named `USER_MENTION_REGEX` export (ADDITIVE); optionally migrate to a shared `useMentionInput`.

**#8 @everyone / @role — feature-port (ABSENT):** not in compose, send-metadata, render, or notify on mobile. **Shared:** `extractMentionsFromText` ALREADY handles both — mobile just never calls it.

**#23 Mention notification counts/highlights — convergence (scaffolded):** `DisplayChannel.mentionCount` plumbing exists but is server-vended; no client counting (`useChannelMentionCounts` et al. absent), no per-space notif settings UI, no unified inbox. **Shared:** `isMentionedWithSettings`, `SpaceNotificationSettings`, `formatMentionCount` ALREADY-EXIST. Pairs with convergence rows #1/#2.

**Status:** noted (2026-06-12). The format fix (cross-cutting note) is the prerequisite and the highest-value sub-item.

---

## Sweep findings (rows 9–25) — condensed

Each verified against desktop source + mobile state; full evidence in the 2026-06-12 audit. Listed shortest-path-first within tier.

- **#9 DM delivery/read receipts** (feature-port, HIGH) — desktop `ReceiptService.ts` + `useReadReceipt.ts` + Privacy toggles; mobile ABSENT (no `deliveredAt`/`readAt`). `UserConfig.deliveryReceipts`/`readReceipts` ALREADY in shared; wire types (`DeliveryAckMessage`/`ReadAckMessage`) need shared migration (desktop task `2026-05-19-receipts-shared-migration.md`). Read-receipt observer → RN `useInView`/`onLayout`.
- **#10 New-messages separator + jump-to-first-unread** (feature-port, MED) — desktop `NewMessagesSeparator.tsx` + Channel/DirectMessage scroll logic; mobile ABSENT. Shared NONE. FlashList `scrollToIndex` differs from Virtuoso.
- **#11 Space tags** (feature-port, MED) — desktop `src/components/space/SpaceTag/` + `Message.tsx` badge + General-tab picker + startup refresh; mobile ABSENT (never reads `sender.spaceTag`). Types + `UserConfig.spaceTagId` ALREADY in shared.
- **#12 User notes** (feature-port, MED) — desktop `user_notes` store + `UserProfile`/`DMUserProfileSidebar` UI; mobile ABSENT. `UserConfig.userNotes` ALREADY in shared (sync handling needed).
- **#13 Encrypted DM backup `.qmbak`** (feature-port, LARGE) — desktop `BackupService.ts` + Security tab; mobile ABSENT entirely. Shared NONE (format could be promoted). Needs `expo-file-system`/`expo-document-picker`.
- **#14 Device renaming** (feature-port, MED) — desktop `Security.tsx` inline rename; mobile shows device list but no rename. `UserConfig.deviceNames` ALREADY in shared.
- **#15 "Always sign DMs" toggle** (feature-port, SMALL) — desktop `Privacy.tsx:101-119`; mobile hardcodes `nonRepudiable:true` (`configService.ts:168`), no UI. Field ALREADY in shared.
- **#16 Global typing toggles (DM/Spaces)** (feature-port, SMALL) — desktop `Privacy.tsx:215-261`; mobile ABSENT. `typingIndicatorsDM`/`typingIndicatorsSpaces` ALREADY in shared. Pairs with #7.
- **#17 Space Settings "Fixes" section** (feature-port, SMALL, low value) — desktop `SpaceSettingsModal/General.tsx:231-256` auto-repair; mobile ABSENT.
- **#18 Emoji skin-tone preference** (feature-port, SMALL-MED, low value) — desktop `emoji-picker/useSkinTone.ts`; mobile ABSENT. localStorage → MMKV.
- **#19 In-app language switcher** (feature-port, MED) — desktop `Appearance.tsx:67-93` (Lingui); mobile has no UI locale switcher (verify it doesn't just follow system locale). Shared NONE.
- **#20 "Restore Missing Spaces"** (feature-port, SMALL) — desktop `Help.tsx:68-92`; mobile ABSENT (hub-log sync may reduce need).
- **#21 Per-message signing toggle** (feature-port, LOW) — desktop composer lock button (`skipSigning`); mobile has conversation/space-level repudiable toggles but no per-message override. Shared NONE (UI-only).
- **#24 Channel mute → hide/dim** (convergence, LOW-MED) — desktop `useChannelMute.ts` `showMutedChannels` + dimmed rows; mobile mutes notifications only, never reads `showMutedChannels` (ALREADY in shared `UserConfig`).
- **#25 Space folders UI** (convergence/feature-port hybrid, HIGH) — see the detailed entry below (UX needs a decision: port desktop's DnD vs a Telegram-style pill bar).
- **#31 Channel icon picker parity** / **#32 group icon+color** / **#33 channel-list icon bug** — see the "Channel & group icons" detailed entry below.

**Lower-confidence (flagged for manual check, not yet rows):** (a) bidirectional deep-link message loading — mobile `scrollToMessage` only searches the loaded window, so bookmarks/pins to old messages may silently no-op (this is the cause of the #29 partial state); (b) explicit "jump to present" button — present on desktop, not found on mobile.

## 25. Space folders — detailed (UX decision needed)

**Desktop:** `src/components/space/SpacesSidebar.tsx` + `SpacesSidebarFolder.tsx` + `FolderButton.tsx`; `src/hooks/business/folders/` (`useFolderDragAndDrop`, `useFolderManagement`, `useDeleteFolder`, `useFolderStates`); `src/components/modals/FolderEditorModal.tsx`. Create-by-drag (drop a space onto another), collapsible named+colored folders, reorder within/across folders.
**Mobile:** data layer round-trips correctly (`configService.ts` validates + reads/writes the `items`/`NavItem` array; `validateItems`, MAX_FOLDERS, MAX_SPACES_PER_FOLDER all enforced), but the Spaces tab (`app/(tabs)/spaces/index.tsx`) renders a **flat sorted list that ignores the `items` field** — folders synced from desktop are silently flattened. No folder UI, no editor, no DnD.
**Shared:** `NavItem`, `FolderColor`, `validateItems` ALREADY-EXIST. No new shared work for the data; this is purely a mobile UX build.

**UX decision (the crux — raised by user 2026-06-12):** desktop's create-by-drag-and-drop is questionable on touch. Two directions:
- **Option A — Telegram-style pill bar (recommended to evaluate first).** A horizontally-scrolling row of folder "pills" at the top of the Spaces list; tapping a pill filters the list to that folder's spaces. Add/remove a space to a folder via a long-press menu or an edit sheet (no drag). Far more native/usable on touch, much less to build than DnD, and it reads the SAME `items` data desktop writes — so cross-device folders Just Work. Trade-off: not 1:1 with desktop's nested-collapsible model (it's filter-by-folder, not show-all-grouped), and a space in multiple folders / "uncategorized" needs a defined behavior.
- **Option B — port desktop's DnD model.** Collapsible folder groups + drag-to-create/reorder. Full parity but DnD on mobile lists is finicky (gesture conflicts with scroll, accessibility), higher build cost, arguably worse UX than the pill bar.
**Recommendation:** prototype Option A; it's the lower-cost, more-native path and still honors the shared data model. Confirm the multi-folder / uncategorized semantics with the lead before building. **Not yet scoped — needs the UX call.**

## Channel & group icons — detailed (rows 31/32 + bug 33)

**Desktop:** both `ChannelEditorModal.tsx:130-140` and `GroupEditorModal.tsx:79-86` use a shared-on-desktop `<IconPicker>` (`src/components/space/IconPicker/`) with: **50 Tabler icons** (9 tiers), an **`iconVariant: 'outline' | 'filled'` toggle** (34 icons have filled variants), and an **8-color named palette** stored as enum strings (`'blue'`, `'green'`, …). Fields live on both `Channel` and `Group`.
**Shared:** `Channel.icon`/`iconColor`/`iconVariant` AND `Group.icon`/`iconColor`/`iconVariant` ALREADY-EXIST (`quorum-shared/src/types/space.ts`). BUT the icon SET + color palette are **desktop-local** (`IconPicker/types.ts`), not shared — that's why mobile drifted.

**#31 Channel icon picker — PARTIAL (under-featured).** Mobile HAS a channel icon picker (`components/ui/IconPicker.tsx`, used in `SpaceSettingsModal.tsx`), but: only **20 icons** (old SF-Symbol names like `star.fill`, not Tabler names), **no outline/filled variant** concept at all, and colors stored as **raw hex** (`'#3b82f6'`) instead of desktop's named enums → a color/icon set on one platform may not match the other. The icon-set drift is already noted in mobile task `2026-06-09-migrate-iconsymbol-to-shared-icon-primitive.md` (deferred Phase 2b). **Real fix = promote the icon SET + color palette + variant concept into `quorum-shared`** so both apps offer the same picker vocabulary (ADDITIVE shared work).

**#32 Group icon + color — ABSENT on mobile.** Desktop has a full group picker (`GroupEditorModal`). Mobile's group header row (`SpaceSettingsModal.tsx:1824-1879`) has **no icon affordance** — and the `useUpdateGroup` mutation already *accepts* `icon`/`iconColor` (interface lines ~389-394, honored in the mutation fn), the UI just never calls that path. Low cost to wire once an icon picker exists.

**#33 Channel-list icon bug — LIVE.** `app/(tabs)/spaces/[id]/index.tsx:118` hardcodes `<IconSymbol name="number" …>` and ignores `channel.icon`/`channel.iconColor`. One-line fix. See the bug callout above. (This is why icons "show default in the channels list" even when set.)

> **Mobile settings UX note (user, 2026-06-12):** mobile currently crams all channel/group settings into the inline channels list, which is tight. Worth considering a **per-item mobile drawer** (open a drawer for a given channel OR group → all its settings inside, including the icon picker, read-only toggle, rename, delete). This would give the icon picker (and the read-only SET UI from #27, and group icon #32) a proper home instead of inline affordances on a cramped row. A design call, not yet scoped — but it's the natural container for several of these channel/group gaps at once.

## 🔴 Permission enforcement bugs (rows 26–27) — detailed

Full parity deep-dive 2026-06-12. **Mobile's role CRUD is fine; enforcement is not.** Root cause: mobile reimplements `hasPermission`/`getUserPermissions`/`getUserRoles` locally (`quorum-mobile/hooks/chat/useRoleManagement.ts:56-111`) and never uses `createChannelPermissionChecker`/`canManageReadOnlyChannel` — so several checks desktop performs simply don't happen on mobile.

**Permission flags (parity OK):** both define the same four — `message:delete`, `message:pin`, `mention:everyone`, `user:mute` (`quorum-shared/src/types/space.ts:14`). Kick is owner-only at the protocol level on both (no flag).

**26a — `@everyone` unenforced.** Desktop gates at `Channel.tsx:1129-1136` + re-checks at send `MessageService.ts:4626-4630`. Mobile's `SpaceChatArea.tsx` send path has zero `hasPermission(..., 'mention:everyone')` call. Any member can `@everyone`. Fix: gate compose + send on the shared helper.

**26b — `user:mute` unenforced.** Desktop: `UserProfile.tsx:77-89` via `createChannelPermissionChecker().canMuteUser()` (no owner bypass — owners must self-assign the role). Mobile: `useUserMuting.ts` is a local MMKV toggle with no permission check; `UserProfileModal.tsx:271` shows the mute button unconditionally. (Note: mobile's mute is *local-only* anyway — a separate convergence question vs desktop's role-gated mute.)

**26c — owner-permission masking (latent).** Mobile's `useHasPermission`/`useUserPermissions`/`useUserRoles` don't take/check `isSpaceOwner`. The sole caller (`[channelId].tsx:56-59`) ORs `isSpaceOwner` back in, masking it for pin/delete — but any new caller (or the two zero-caller hooks) silently returns false for owners. Partially covered by open task `2026-05-29-mobile-adopt-shared-permission-helpers.md` (which does NOT cover 26a/26b/27).

**Shared involvement (all ALREADY-EXIST):** `hasPermission`, `getUserPermissions`, `getUserRoles` (`quorum-shared/src/utils/permissions.ts`), `createChannelPermissionChecker`/`UnifiedPermissionSystem`/`canManageReadOnlyChannel` (`channelPermissions.ts`), `toggleRolePermission`/`setRolePermissions` (`roleUtils.ts`). Desktop consumes them; mobile duplicates a partial copy. Two open mobile tasks cover the hook + mutation-helper adoption but **not** the enforcement gaps above.

## 27. Read-only channels — feature-port (with correctness urgency)

**Mobile:** SET = ABSENT in UI (the hook layer `useChannelManagement.ts:40,80,131,159` persists `isReadOnly`/`managerRoleIds`, but `SpaceSettingsModal.tsx` channel editor exposes no toggle/role-picker). ENFORCE = ABSENT entirely — `SpaceChatArea.tsx:722-746` renders `MessageInput` with no `canPost` gate; `canManageReadOnlyChannel` unused; no locked-composer banner. **A read-only channel synced from desktop shows mobile users a live composer and they can post** — silent access-control break.
**Desktop:** SET via `ChannelEditorModal.tsx:158-211` (Switch + manager-role multi-select). ENFORCE via `Channel.tsx:67-96` (`canPostInReadOnlyChannel`) → `canPost` → `<MessageComposer disabled>` (lock-icon banner) at `1730-1738`; also suppresses typing broadcasts + shows a lock channel-icon.
**Storage:** `Channel.isReadOnly?: boolean` + `managerRoleIds?: string[]` (`quorum-shared/src/types/space.ts:56-57`).
**Mobile cost:** ENFORCE-only minimal fix ~2-4h (compute `canManageReadOnlyChannel` in `[channelId].tsx`, thread `canPost` → `MessageInput disabled`, add banner). Full SET parity ~1-2 days (toggle + role picker in settings). Both ~2-3 days.
**Shared:** ALREADY-EXISTS (`canManageReadOnlyChannel` + the `Channel` fields). No new exports.
**Status:** noted (2026-06-12) — enforcement half is a correctness item; bundle with Wave 0.

## 28. Scroll-to-first-unread on channel/DM entry — feature-port

**Mobile:** ABSENT. `MessagesList.tsx` always renders from bottom (FlashList `maintainVisibleContentPosition` + `startRenderingFromBottom`); has stay-at-bottom-on-new-message but no first-unread query. No `lastReadTimestamp`/`scrollToMessageId` prop plumbed from `SpaceChatArea`/`DMChatArea`.
**Desktop:** `Channel.tsx:916-1033` — on entry, `messageDB.getFirstUnreadMessage({ afterTimestamp: lastReadTimestamp })`, jumps if `unreadCount >= 5` OR oldest unread `>= 5min` old; sets `scrollToMessageId` → `MessageList.tsx:530-563` scrolls via Virtuoso `scrollToIndex`. (Note: it's jump-to-first-unread, NOT raw scroll-position restore.) Related β work: `useScrollAnchor.ts` / task `2026-05-24-virtuoso-application-owned-scroll-anchoring`.
**Mobile cost:** MED — plumb `lastReadTimestamp` into the chat areas, add a `scrollToMessageId`-style prop + first-unread query, use FlashList `scrollToIndex` (already available). Pairs naturally with #10 (new-messages separator).
**Shared:** NONE (reads shared `Conversation.lastReadTimestamp`, already there).
**Status:** noted (2026-06-12).

## 29 / 30. Message highlighting — #29 link-jump (convergence), #30 mention viewport (feature-port)

**Desktop:**
- Link/notification/bookmark/pinned jump → `MessageList.tsx:482-528` scroll + `highlightMessage(id, {duration:8000})` (`useMessageHighlight.ts`), CSS `flash-highlight` 8s (4s hold + 4s fade), `rgb(var(--warning)/0.2)`.
- Mention viewport entry → `useViewportMentionHighlight.ts:29-90` IntersectionObserver (threshold 0.5), guard `isMentioned && isUnread`, fires `highlightMessage(id, {duration:61000, variant:'mention'})`, CSS `flash-highlight-mention` 61s (~57s hold + 4s fade), `rgb(var(--warning)/0.1)`. **The "different timing depending on mention" = 8s for link-jumps vs 61s for unread mentions.**

**#29 Link-jump highlight — convergence (mobile PARTIAL):** `MessagesList.tsx:374-383` `scrollToMessageWithHighlight` exists for pinned (`SpaceChatArea:756`) + bookmark (`:770`, DM `:496`) nav. But: searches only the loaded window (silent no-op if target not loaded — see lower-confidence note), ~1.7s blurple Reanimated fade (NOT desktop's 8s yellow), no notification deep-link path, no pagination-to-find fallback. Fix: align color/duration, add notification deep-link, add load-more-until-found. Cost LOW-MED. Shared NONE.

**#30 Mention viewport highlight — feature-port (ABSENT):** no viewport-entry trigger, no `IntersectionObserver`/`onViewableItemsChanged` equivalent, no `lastReadTimestamp` at list level. RN path: `onViewableItemsChanged` on the FlashList + `isMentioned && isUnread` per item → existing Reanimated highlight. Cost MED (animation infra exists; trigger missing). Shared NONE. Pairs with #28 (both need `lastReadTimestamp` plumbed) and #23.

## 34. Avatar initials — display-name-based + shared logic — convergence

**Mobile:** [`quorum-mobile/components/ui/DefaultAvatar.tsx`](../../../../quorum-mobile/components/ui/DefaultAvatar.tsx) — derives initials from the **address** string, not the display name: `address.startsWith('@') ? address.slice(1,3) : address.slice(0,2)`, uppercased (lines ~32-42). So a user's fallback avatar shows an opaque hex/base58 prefix like `"AC"` — meaningless to a human. Background color is a local djb2 hash over the address (`hashToColor`). Used at ~13 call sites (DM lists, message bubbles, call screens, profile/reaction modals, space lists). Space avatars are inconsistent: two list screens pass the *space address* into `DefaultAvatar` (→ address-prefix initials), three other spots inline their own `space.name.charAt(0)` monogram (`ApexSubscribeModal.tsx:361`, `InviteLinkCard.tsx:197`), and a couple show an SF Symbol instead.

**Desktop:** initials + color logic lives in **`quorum-shared/src/utils/avatar.ts`** (`getInitials`, `getColorFromDisplayName`, `lightenColor`/`darkenColor`) — pure, exported publicly. `getInitials(displayName)` = first letters of the first two whitespace words, uppercased; emoji-aware (returns the leading emoji); `''`/`"Unknown User"` → `'?'`. Both **user** avatars (`src/components/user/UserAvatar`) and **space** avatars (`src/components/space/SpaceAvatar`, `SpaceIcon.tsx`) route through ONE `UserInitials` component that calls these shared functions — zero duplication. A `UserInitials.native.tsx` already exists in the shared component stack (uses `expo-linear-gradient` + RN `<Text>`).

**Why desktop is better / why mobile needs it:**
1. **Meaningful initials.** Desktop shows `NA` for "Niccolò Angeli"; mobile shows address junk (`AC`). The desktop fallback is human-recognizable.
2. **One system for users AND spaces.** Desktop's space avatars reuse the exact same logic; mobile's space monograms are scattered across 3 inline copies + 2 address-based + 2 icon-only — inconsistent and drift-prone.
3. **The logic is already shared and battle-tested.** `getInitials`/`getColorFromDisplayName` are pure, in the published dist mobile already pins, emoji-aware, with a stable color palette. Mobile reimplements a worse version locally for no reason.

**Mobile cost:** **MED.** The algorithm ports for free (already in shared) — the work is component-side: (a) `DefaultAvatar` gains a `displayName` prop and calls shared `getInitials`/`getColorFromDisplayName` instead of its local address logic; (b) ~13 call sites pass a display name (in addition to / instead of the address); (c) extract a `SpaceIcon` to replace the scattered `charAt(0)` space monograms + address-based space avatars; (d) one RN wrinkle — `expo-image` (mobile's photo loader, `CachedAvatar.tsx`) can't fall back to a React node on load-error the way web `<img onError>` can, so the "show initials when the photo fails" path needs a small `useState`+`onError` wrapper (mobile's generic `Avatar.tsx` already implements this pattern correctly — copy it).

**Shared-package involvement:** **NONE.** `getInitials`, `getColorFromDisplayName`, `lightenColor`, `darkenColor` all already export from `@quilibrium/quorum-shared` (`src/utils/avatar.ts` → `utils/index.ts` → `index.ts`) and are in the dist mobile pins. No shared work, no version bump.

**Status:** 🚧 task-dropped (2026-06-14) — mobile task file `quorum-mobile/.agents/tasks/2026-06-14-avatar-initials-display-name-from-shared.md`. Also fixes two existing mobile inconsistencies (address-junk initials; scattered space monograms) as a side effect, so it's a cleanup win on top of the parity win.

### 19. Mobile i18n / language switcher — feature-port (detailed plan exists)

**Mobile:** ABSENT entirely — `quorum-mobile` has no `@lingui/react` dependency and no i18n directory; the app is English-only.
**Desktop:** fully shipped — `@lingui/react ^5.3.3`, 32 `.po` locale files in `src/i18n/`, `dynamicActivate()` loading, `useLocaleSettings` hook, locale picker in `Appearance.tsx:67-93`.
**Why mobile needs it:** full language parity (26+ langs) with the web app; non-English users get an English-only mobile app today.
**Mobile cost:** MED (4-6h estimate in the original plan). RN-specific concerns: Metro dynamic-import handling (3 options: `@lingui/metro-transformer` / static import map / native dynamic imports), `AsyncStorage` for the locale pref (vs web `localStorage`), `react-native-localize` for device-locale detection, a `LanguageSelector.native` + settings entry.
**Shared:** NONE (app-level i18n; the `.po` translation *content* is shared by copying the same keys, not by an npm export).
**Detailed plan:** preserved at [`../mobile-dev/.archived/2026-01-09-internationalization-i18n-implementation-plan.md`](../mobile-dev/.archived/2026-01-09-internationalization-i18n-implementation-plan.md) (written 2026-01-09 for the old single-repo playground, but the technical substance — Metro options, AsyncStorage, locale detection, the 3 loading strategies, success criteria — maps directly onto standalone `quorum-mobile`; ignore its `mobile/` playground path references).
**Status:** noted (2026-06-12) — should be re-homed as a `quorum-mobile` task when picked up.

### Theme tab items (rows 10/11 in the settings sweep) — scaffolded, tiny

Mobile's `ThemeProvider` already exposes `setAccentColor` and `setIsDark`/`toggleTheme`, but `ProfileModal` Appearance section surfaces neither. Accent-color picker (6 swatches) and Light/Dark/System toggle are both SCAFFOLDED-NOT-WIRED → tiny UI-only adds. Also tiny: typed-"RESET" Danger Zone confirmation (mobile uses a plain `Alert`), and display-name inline validation (mobile has `maxLength` only; `validateDisplayName` ALREADY in shared).

---

*Last updated: 2026-06-14 — added row **34** (Avatar initials, convergence): mobile derives avatar initials from the raw address (opaque "AC") while desktop derives from the display name (emoji-aware, deterministic color) using `getInitials`/`getColorFromDisplayName` that ALREADY live in `@quilibrium/quorum-shared` (`src/utils/avatar.ts`) — both user AND space avatars route through one shared `UserInitials`, no duplication. Mobile never imports them. MED cost (component rewire: `DefaultAvatar` + ~13 call sites + extract `SpaceIcon` + an `expo-image` error-fallback wrapper), NONE shared (logic already published). Also fixes two existing mobile inconsistencies (address-junk initials; scattered `charAt(0)` space monograms). Task-dropped: mobile task file `2026-06-14-avatar-initials-display-name-from-shared.md`.*

*Previously: 2026-06-12 (pass 3b) — dropped tasks for the icon cluster. Rows 31/32/33 → 🚧 task-dropped: mobile task `quorum-mobile/.agents/tasks/2026-06-12-channel-group-icon-and-settings.md` (sub-task 0 = the bug fix; 1 = per-item settings drawer + gear-opens-channel-drawer; 2 = channel icon parity; 3 = group icon+color; 4 = DnD reorder, second pass) + shared task `quorum-shared-migration/2026-06-12-promote-icon-picker-vocabulary-to-shared.md` (move `ICON_OPTIONS`/`ICON_COLORS`/`FILLED_ICONS`/`getIconColorHex` into quorum-shared so both apps share one picker vocabulary). Tracker rows 7.1/7.2/7.3 added.*

*Previously: 2026-06-12 (pass 3) — channel/group icon parity + space-folders UX. Added rows 31 (channel icon picker under-featured: 20 vs 50 icons, no outline/filled variant, hex-vs-named-color), 32 (group icon+color entirely absent on mobile), and 🐛 33 (LIVE BUG — `app/(tabs)/spaces/[id]/index.tsx:118` hardcodes the default channel-list icon, ignoring `channel.icon`; root cause of "icons show default in the list"). Enriched the #25 space-folders entry with a UX decision: Telegram-style pill bar (recommended to prototype) vs porting desktop's drag-and-drop. Added a mobile-settings-UX note: consider per-channel/per-group drawers (cramped inline settings today). NOTE on read-only channels (#27): only a TASK PLAN exists (Wave 0) — no mobile code written yet.*

*Previously: 2026-06-12 (pass 2) — added a parity deep-dive on 5 user-flagged items: roles/permissions (found 3 live enforcement bugs 26a–c + read-only-channels #27, all rooted in mobile not consuming shared permission helpers), scroll-to-first-unread (#28), message highlighting (#29 link-jump convergence + #30 mention-viewport feature-port). Added a **Recommended sequencing** section (Wave 0 permission fix → Wave 1 mentions → Wave 2 standalone ports → Wave 3 rest). **Image+caption single-message: verified NO PORT NEEDED** — mobile already sends one message (logged as minor wire-format convergence only).*

*Previously: 2026-06-12 (pass 1) — added rows 3–25 + the cross-cutting mention-format finding + 5 detailed named-feature entries (threads, markdown, YouTube facade + setting, typing indicators, mentions cluster) from a structured cross-repo audit. Verified the uncertain `UserConfig` fields directly against shared `2.1.0-29` source (all present). Cross-referenced two findings already tracked as mobile tasks (DM profile sync; config read-back). Recorded desktop-chrome-specific exclusions.*

*Previously: 2026-06-12 — file created. Folded in the two entries from the former `port-from-mobile/desktop-better-than-mobile.md` (reply notification counts; per-space notification preferences) as `convergence`-type candidates, and reframed the doc to also hold `feature-port` candidates via a `Type` column. The standalone `desktop-better-than-mobile.md` was retired in the same change — its distinction is now a column here, not a separate file.*
