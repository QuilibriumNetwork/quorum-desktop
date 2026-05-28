---
type: report
title: Notification preference architecture — desktop vs mobile divergence
status: complete
created: 2026-05-28
audience: future agents + lead-dev issue draft
verified_against:
  desktop: 701ccd07 (after dedup PR #160 merged)
  mobile: 98d59a4 (catching up public repo, 2026-05-28)
---

# Notification preference architecture — desktop vs mobile

Deep-dive analysis after the type cleanup in `quorum-shared#18` and `quorum-desktop#160`. Purpose: ground the GitHub issue we're about to file in accurate, verified information instead of guesses.

## TL;DR

**The two clients are not just "different shapes for the same thing." They use fundamentally different architectures and store preferences in incompatible places**:

- **Desktop's per-space notification settings live in `UserConfig` (synced cross-device).** They model "which event TYPES fire a notification for this space" (mention-you, mention-everyone, mention-roles, reply) plus a master `isMuted`.
- **Mobile's per-space notification settings live in local MMKV (NOT synced).** They model "should this space notify AT ALL" with three boolean levels (global / space / channel), AND-resolved.
- **Both clients have a global on/off toggle**, but they mean different things: desktop's is a UI mirror of browser permission state, mobile's is an app-level setting in MMKV.
- **Desktop's channel mute** lives in a SEPARATE `UserConfig` field (`mutedChannels[spaceId]: string[]`), synced.
- **Mobile's channel mute** is inlined into the same MMKV tree as global/space.

The mobile codebase contains an **explicit comment** stating per-space prefs are a "local user setting, not a space-wide config" — this is intentional architecture, not unfinished work.

## What each app actually does, in detail

### Desktop (verified against `701ccd07`)

#### Data model

`UserConfig` fields touching notifications/mute:

```ts
notificationSettings?: { [spaceId: string]: SpaceNotificationSettings };
mutedChannels?: { [spaceId: string]: string[] };
showMutedChannels?: boolean;
mutedConversations?: string[];  // DMs only
favoriteDMs?: string[];
// NO global notifications-enabled field
```

Where `SpaceNotificationSettings` (now in `@quilibrium/quorum-shared`) is:

```ts
type SpaceNotificationSettings = {
  spaceId: string;
  enabledNotificationTypes: SpaceNotificationTypeId[];
  // SpaceNotificationTypeId = 'mention-you' | 'mention-everyone' | 'mention-roles' | 'reply'
  isMuted?: boolean;
};
```

All four `UserConfig` fields are synced to other devices via the encrypted config blob.

#### Storage

IndexedDB → encrypted → server → other devices.

#### Where each field is used

| Field | Read sites | Written by | What it gates |
|---|---|---|---|
| `notificationSettings[spaceId].isMuted` | 9+ files: `useChannelMentionCounts`, `useSpaceMentionCounts`, `useAllMentions`, `useChannelMute` (line 267), `useAllReplies`, `useReplyNotificationCounts`, `useSpaceReplyCounts`, `NotificationPanel`, `MessageService` (line 4295) | `useChannelMute.muteSpace/unmuteSpace` (lines 270-355) | Suppresses unread counts, badge bubbles, browser notifications for all events in this space. |
| `notificationSettings[spaceId].enabledNotificationTypes` | Same 9+ files. Each filters which trigger types contribute to the unread count it tracks. | `useMentionNotificationSettings.saveSettings` (line 145ish) | In-app filtering of which event types count toward badges, and which fire `NotificationService.showUnreadMessagesNotification`. Driven by space-settings multi-select dropdown. |
| `mutedChannels[spaceId]: string[]` | `useChannelMute` (`isChannelMuted`), `channelUtils.isChannelMuted`, `ChannelList`, `ChannelItem`, `ChannelGroup` | `useChannelMute.muteChannel/unmuteChannel` | Suppresses unread count + visual treatment (60% opacity unless `showMutedChannels=false`). Does NOT directly suppress `NotificationService` invocation — but mute checks happen upstream in count hooks. |
| `mutedConversations: string[]` (DM mute) | `useDMMute`, `useDirectMessageUnreadCount`, `DirectMessageContact`, `DirectMessageContactsList` | `useDMMute.muteConversation/unmuteConversation` | Hides unread blue dot, removes from NavMenu DM badge count, suppresses notifications. |

#### Global toggle

`useNotificationSettings` (in `hooks/business/user/useNotificationSettings.ts`) exposes `notificationsEnabled` — **but this is not a stored user preference**. It's a wrapper around `Notification.permission` (the browser API permission status). The UI in `UserSettingsModal/Notifications.tsx` doesn't write to `UserConfig` — it triggers `Notification.requestPermission()`. If the user wants to "turn off" notifications, they must do it in the browser settings (which the UI explicitly tells them).

Reason for this design: web apps can't programmatically revoke notification permission; they can only request it. So a `UserConfig`-level boolean would be misleading (the toggle could be "off" but the browser would still allow notifications, or vice versa).

#### Delivery path

`NotificationService.ts` is a singleton (`window.Notification` wrapper) that:
- Tracks permission, handles Safari compat
- Maintains an internal `mutedConversations: Set<string>` for DM muting at notification time
- Tracks pending notification counts + latest metadata for batched notifications
- Called from `MessageService` and `WebsocketProvider` when messages arrive

The decision "should this notification fire" is made in `MessageService.processIncomingMessage` (and similar paths) by reading `config?.notificationSettings?.[spaceId]` and the various mute fields *before* invoking `NotificationService`.

### Mobile (verified against `origin/master` HEAD `98d59a4`, 2026-05-28)

#### Data model

Mobile's notification preference storage lives in `services/notifications/notificationPrefs.ts`:

```ts
// Stored in dedicated MMKV instance 'quorum-notification-prefs'.
// Mirrored to iOS App Group container so the iOS NSE can read them.
// NOT synced via UserConfig.

global:enabled                              → boolean (default true)
space:<spaceId>                             → boolean (default true)
channel:<spaceId>:<channelId>               → boolean (default true)
```

Resolution function:
```ts
shouldNotifyForContext({ spaceId, channelId }): boolean
  // global AND space AND channel must all be true
```

There is **no equivalent** in mobile of desktop's `enabledNotificationTypes` array. Mobile does not let the user filter "only mention-you, not mention-everyone." It's binary per level.

There is **no equivalent** in mobile of desktop's separate `mutedChannels[spaceId]: string[]` field. Channel-level mute is the same data path as global and per-space — all three are booleans in the same MMKV.

#### Storage

MMKV (local, on this device only). NOT synced.

There IS an explicit code comment in `components/SpaceSettingsModal.tsx` (line 307):

> *"Per-space notification preference. Anyone can mute/unmute their own copy of a space — this is a local user setting, not a space-wide config. Persisted in MMKV; gates `showMessageNotification` at presentation time."*

This isn't an unfinished migration; it's an intentional design choice.

#### Where each preference is used

Mobile's preferences are read in the **push delivery decision path**:

`services/notifications/pushReceivedTask.ts` is the Android background-push handler. On a silent push arrival:

```ts
// 1. Global check
if (!getGlobalNotificationsEnabled()) return;  // suppressed

// 2. Per-space check (after resolving hub_address → spaceId)
if (!getSpaceNotificationsEnabled(space.spaceId)) return;  // suppressed

// 3. Decrypt the message envelope via hubLogClassifier
//    to learn its (channelId, contentType)
const cls = await classifyHubLogEntry({ hubAddress, seq, userAddress });

// 4. Per-channel check
if (!getChannelNotificationsEnabled(cls.spaceId, cls.channelId)) return;  // suppressed

// 5. Content-type suppression (update-profile, edit-message, remove-message)
if (SUPPRESSED_CONTENT_TYPES.has(cls.contentType)) return;  // suppressed

// Otherwise: show the notification.
```

For iOS, the same logic runs in a Swift port (`HubLogClassifier.swift` in the Notification Service Extension), reading from the App Group MMKV mirror. The NSE can't talk to JS at notification time, so the MMKV-mirrored-to-App-Group pattern exists specifically to make these checks possible from native code.

#### Global toggle

`ProfileModal.tsx` line 305-311 wires the mobile global notifications toggle to `setGlobalNotificationsEnabled()` in `notificationPrefs.ts`. An earlier comment in that file notes:

> *"Notifications toggle. Backed by MMKV via notificationPrefs so the setting persists across launches AND is read by `showMessageNotification` at presentation time. Previously this was plain React state with no persistence and no gating — the toggle did nothing."*

This was a recent fix. The toggle is now functional and stored in MMKV.

#### Delivery path

- **Foreground:** `services/notifications/NotificationService.ts` (`showMessageNotification`) wraps Expo's `Notifications.scheduleNotificationAsync`. The push handler invokes it after passing all the suppression checks.
- **iOS background lock-screen:** the iOS Notification Service Extension (Swift) reads MMKV directly via the App Group container and decides whether to display the system notification. Runs without JS.
- **Android background:** `pushReceivedTask` as above.

## What's the same vs. different

| Concept | Desktop | Mobile | Compatible? |
|---|---|---|---|
| **Global on/off** | Browser permission API (NOT in `UserConfig`) | MMKV boolean (NOT in `UserConfig`) | No — neither side syncs this. Desktop's is OS-imposed; mobile's is app-level. |
| **Per-space mute** | `UserConfig.notificationSettings[spaceId].isMuted` (synced) | MMKV `space:<id>` boolean (NOT synced) | **Both clients have this concept, but they store it in different places and don't sync to each other.** |
| **Per-channel mute** | `UserConfig.mutedChannels[spaceId]: string[]` (synced, separate field) | MMKV `channel:<spaceId>:<id>` boolean (NOT synced) | Same situation as per-space. |
| **Granular trigger types** (which mention types fire, replies y/n) | `UserConfig.notificationSettings[spaceId].enabledNotificationTypes[]` (synced) | Not modeled at all | Desktop-only concept. |
| **DM mute** | `UserConfig.mutedConversations: string[]` (synced) | Not visible in this analysis; would need separate investigation | Likely desktop-only at this layer. |

## Implications for "cross-device sync of notification prefs"

If the goal is for "mute Space X" set on desktop to take effect on mobile (and vice versa), four things would need to happen:

1. **Decide on a shared on/off model.** Desktop has it baked into `notificationSettings[spaceId].isMuted`. Mobile has it as a standalone MMKV boolean. These could converge by either:
   - Mobile reading `UserConfig.notificationSettings[spaceId].isMuted` and writing through to MMKV (keeping the MMKV path for NSE)
   - Or extending `UserConfig` with a parallel "mute tree" that mobile owns and desktop adapts to

2. **Decide on global toggle storage.** Mobile has an app-level global toggle, desktop reads browser permission. If desktop ever wants the same app-level "I just don't want notifications right now" UX without revoking browser permission, it'd need to add it. If we want global toggle to sync, both clients need to agree on a `UserConfig` field.

3. **Decide on per-channel storage.** Desktop's `mutedChannels[spaceId]: string[]` is a different shape from mobile's `channel:<spaceId>:<channelId>` boolean tree. Either:
   - Mobile reads desktop's `mutedChannels` and mirrors it into MMKV at config load (one-way bridge)
   - Or both adopt a unified shape

4. **Decide whether granular trigger types apply on mobile.** Desktop lets users filter "only mention-you, not mention-everyone." Mobile doesn't. Either:
   - Mobile adopts the granular filter UI (substantial mobile UI work)
   - Desktop's granular filter remains a desktop-only refinement; both clients agree on per-space and per-channel mute, and the granular dropdown is desktop-only

## What `UserConfig` would need to carry

If sync IS the goal, the *minimum viable* unified shape is:

- `notificationSettings[spaceId].isMuted` — already exists. Mobile would need to read this AND mirror into MMKV (since the NSE can only read MMKV).
- `mutedChannels[spaceId]: string[]` — already exists. Same mirror-into-MMKV requirement on mobile.
- (Optional) a top-level `notificationsEnabled?: boolean` for the global toggle — does NOT currently exist anywhere on `UserConfig`. Would be a new field.
- Granular `enabledNotificationTypes` — stays as desktop-only behavior if mobile doesn't want it; or mobile adds granular UI.

## A possible unification path (NOT a recommendation — this is just one shape)

Add NOTHING to shared today. Instead:

1. Mobile changes `notificationPrefs.ts` so that on every `UserConfig` load, it MIRRORS the relevant values from `UserConfig.notificationSettings[spaceId].isMuted` and `UserConfig.mutedChannels[spaceId]` into the local MMKV (so the NSE keeps working). And on every user toggle, it writes back to both MMKV (immediate effect for NSE) AND `UserConfig` (sync to other devices).
2. Global toggle stays mobile-local (MMKV) until both sides agree to add a `UserConfig.notificationsEnabled` field.

This requires mobile-side work but zero shared changes. The current shared types are already sufficient.

## What we know we DON'T know

- Whether the lead has thought about this and has a target architecture in mind.
- Whether mobile's local-only design for per-space prefs is "deliberate forever" or "deliberate for now."
- Whether granular trigger types should be added to mobile eventually.
- What the migration story is for existing desktop users whose `notificationSettings` contains real data.

## What the GitHub issue should ask, precisely

Based on this analysis, the issue should:

1. **State the verified facts** (the table above + the storage locations).
2. **Acknowledge mobile's intentional design choice** (the "local user setting, not a space-wide config" comment).
3. **Ask one focused question:** is mirroring desktop's existing `UserConfig.notificationSettings[spaceId].isMuted` and `UserConfig.mutedChannels[spaceId]` into mobile's MMKV at config-load (and writing back on user toggle) the intended convergence pattern? If so, this is mobile-side work; we wait for the lead. If not, what's the target?
4. **Avoid proposing new `UserConfig` fields** — none are needed for the minimum convergence. The global toggle can stay mobile-local for now.

---

*Verified 2026-05-28 against the post-PR-160 desktop tree and the catching-up-public-repo mobile commit. Both grep paths used real file content, not assumptions.*
