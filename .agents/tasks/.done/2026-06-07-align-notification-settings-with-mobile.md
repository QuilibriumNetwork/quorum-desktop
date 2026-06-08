---
type: task
title: Align desktop notification settings UX with mobile
status: planning
created: 2026-06-07
updated: 2026-06-07
branch: feat/align-notification-settings-with-mobile
scope: desktop-only
related:
  - .agents/reports/2026-05-28-notification-architecture-divergence.md
  - .agents/tasks/port-from-mobile/desktop-better-than-mobile.md
  - .agents/bugs/2026-06-07-mention-type-filter-not-synced.md
deferred_followups:
  - "Rich shared notification model + cross-device sync (Decision 3): tracked in desktop-better-than-mobile.md entry"
  - "Bug #2 (mention-type filter sync) — filed as standalone bug"
  - "Bug #3 (mobile sign-out push) — for lead dev; NOT filed in this repo"
---

# Align notification settings UX between desktop and mobile

## Problem (user's framing)

> "In the mobile app space settings, the notifications for the space and channel seem to work backwards compared to the web app. On the web app we have *Mute space* and *Mute channel*; on the mobile app we have *notifications on/off* switches for space and channels. I think the mobile ones are for mobile (push) notifications, not for the in-app notifications panel. Actually mobile does have an in-app notifications screen, but I'm not sure if it's plugged into spaces/channels or just Farcaster. We should analyze the situation and align the UI/UX."

## Findings (verified against latest `main`/`master` 2026-06-07)

The prior architecture report (`2026-05-28-notification-architecture-divergence.md`) covers the data-model divergence in depth. This task focuses on the **user-facing UX** implications.

### Mobile — what the toggles really do

| Surface | Label | What it controls |
|---|---|---|
| Profile → Settings | "Push Notifications" / *Receive notifications on your device* | Gates **both** OS push notifications **and** the in-app notification log via `shouldNotifyForContext()` in [`notificationPrefs.ts:99-111`](D:/GitHub/Quilibrium/quorum-mobile/services/notifications/notificationPrefs.ts) |
| Space Settings → Notifications | "Notify me when messages are posted in this space." | Same dual-surface gate, scoped to space |
| Space Settings → channel rows | `# channelName` | Same dual-surface gate, scoped to channel |

**Key insight #1:** the user's hypothesis ("mobile toggles are push-only") is **incorrect**. The mobile toggles gate the in-app notification log too — because every in-app entry is written by the same `showMessageNotification()` function that schedules the OS push, and both paths share the same `shouldNotifyForContext` filter.

**Key insight #2:** the mobile in-app notifications screen (Profile → Notifications tab) is **NOT Farcaster-only**. It's a unified feed combining:
- Chat/space notifications (from the MMKV `quorum-notifications` log)
- Farcaster notifications (polled from Warpcast API)

merged by `useUnifiedNotifications` hook. So mobile *does* surface space/channel events in-app, and those entries ARE filtered by the space/channel mute switches.

### Desktop — what the toggles really do

| Surface | Label | What it controls |
|---|---|---|
| Space Settings → Account tab → Notifications section | "Mute this Space" | Suppresses badge counts, in-app notification panel content, **and** OS notifications |
| Space Settings → Account → Notifications section | Multi-select dropdown (`@you` / `@everyone` / `@roles` / `Replies`) | Fine-grained: which event TYPES count toward badges & fire OS notifications |
| Right-click on space → "Mute Space" | (context menu) | Same as the Switch above |
| Right-click on channel → "Mute Channel" | (context menu) | Suppresses badge counts and in-app notification panel content. **Does NOT suppress OS notifications** — see Bug #1 below |
| User Settings → Notifications | "Desktop Notifications" toggle | Wrapper around browser `Notification.permission` — not a stored flag |

The desktop in-app notification panel (`NotificationPanel.tsx`) is **per-space**, not global. It shows mentions + replies from the current space's channels only. It fully respects the space-mute and channel-mute settings.

### Bugs surfaced by this analysis

**Bug #1 — Desktop channel mute doesn't suppress OS notifications.**
[`MessageService.ts:4298`](d:/GitHub/Quilibrium/quorum-desktop/src/services/MessageService.ts#L4298) checks `settings?.isMuted` (space mute) but not `config?.mutedChannels?.[spaceId]?.includes(channelId)`. Channel mute removes the channel from badges and the in-app panel, but the browser `Notification` will still fire. The `channelId` is available at line 4280; the fix is a one-line addition to the suppression check.

**Bug #2 — Desktop `enabledNotificationTypes` sync regression.**
The Save button in the Space Settings → Account tab calls `messageDB.saveUserConfig()` directly instead of going through the action queue. This means the mention-type filter doesn't sync across devices, while every other notification setting does. Inconsistent.

**Bug #3 — Mobile sign-out doesn't unregister push token.**
`AuthContext.signOut` clears MMKV but never calls `unregisterPushTokenFromQuorum`. A device that the user signed out from could still receive pushes until keys are torn down.

These three are worth fixing but are **outside the scope of this UX-alignment task** — file them separately or tackle them as follow-ups.

### The core UX mismatch

| Aspect | Desktop | Mobile |
|---|---|---|
| **Default state** | Notifications ON (mute = opt-out) | Notifications ON (toggle off = opt-out) |
| **Framing** | "Mute" (action language, implies suppression) | "Notifications" (state language, implies on/off) |
| **Granularity** | Mute is binary + separate event-type filter (`@you`, `@everyone`, etc.) | Single boolean per scope, no event-type filter |
| **Sync** | Synced cross-device via UserConfig | Local-only (MMKV) |
| **What it gates** | Badges + in-app panel + OS notification (space-level only — see Bug #1) | OS push + in-app log entry (both, always) |
| **Discoverability** | Mute lives in Account tab + context menu | Toggles live in dedicated "Notifications" section of Space Settings |
| **Channel-level UI** | Context menu only (no settings UI) | Switch row per channel in Space Settings |

So the user's intuition that they "work backwards" is partially right: **desktop frames it as suppression** ("mute"), **mobile frames it as activation** ("notifications on"). They achieve the same end state but the semantic direction is opposite.

## Alignment options

Three viable directions, with tradeoffs:

### Option A — Desktop adopts mobile's framing (Recommended ✨)

Replace "Mute Space" / "Mute Channel" with **"Notifications"** toggles (default ON, off = muted).

**Pros:**
- "Notifications on/off" is more discoverable than "Mute" (users searching settings for "notifications" find it)
- Aligns with how every consumer chat app frames this (Slack, Discord, WhatsApp all use Notifications, not Mute, in the primary settings UI)
- Mobile-first framing matches the broader product direction
- Channel-level UI gets a real home (currently desktop has no channel settings UI, only a context menu)

**Cons:**
- Loses the "mute" verb in context menus, which is more concise for right-click ("Mute Channel" vs. "Turn off Notifications")
- Need to reconcile the event-type filter (`@you`, `@everyone`, etc.) — does it live under "Notifications", or get split off?

**Compromise that addresses the con:** keep "Mute / Unmute" in **context menus** (action verb fits there), use "Notifications" in **settings panels** (state framing fits there). Slack does exactly this.

### Option B — Mobile adopts desktop's framing

Replace mobile's "Notifications" switches with "Mute Space" / "Mute Channel" toggles.

**Pros:**
- Reuses desktop's existing copy, less i18n churn
- "Mute" as a state-of-being is a known idiom (Slack channel list shows muted channels at low opacity)

**Cons:**
- Goes against mobile platform conventions (iOS/Android both use "Notifications" as the noun in settings, "Mute" as a swipe action)
- Mobile users would find a "Mute Space" switch confusing (a switch labeled with an action verb is odd UX)
- Loses the clear "I want notifications for this space: YES/NO" mental model

### Option C — Both apps unify around a third, richer model

Build a shared notification settings UI that exposes:
- Master toggle (on/off, the existing mobile-style switch)
- AND event-type filter (the existing desktop-style multi-select) — only shown when toggle is on
- Available at space level AND channel level on both platforms

Backed by the existing `SpaceNotificationSettings` type from `quorum-shared` (which already models both `isMuted` and `enabledNotificationTypes`).

**Pros:**
- Best long-term UX — gives users granular control on both platforms
- Uses the existing shared type, no schema changes
- Solves the data-model divergence too: mobile starts writing to `UserConfig.notificationSettings`, gets cross-device sync for free

**Cons:**
- Largest scope by far — touches mobile pref storage, mobile UI, desktop UI, and the iOS NSE Swift code
- Mobile's MMKV-based gate currently runs in the iOS NSE (native Swift) which reads MMKV directly; switching to UserConfig means the NSE would need to read the encrypted config or rely on a mirror
- Existing mobile architecture report (May 28) calls out that the mobile choice was **intentional**, not unfinished — moving to synced config means revisiting that decision

## Agreed scope (this PR)

**Decision confirmed 2026-06-07: Option A, desktop-only PR, no mobile changes.**

Rationale:
- "Notifications" wins on **discoverability** — users searching settings for "notifications" find it; users searching for "mute" only do if they already know the app's word. Slack and Discord both use "Notifications" as the noun in settings modals and "Mute" in menus/quick actions.
- The cross-platform-confusion problem the user wants to solve is fixed entirely by the desktop rename (mobile already uses "Notifications"). No need to touch mobile.
- Keeping "Mute / Unmute" verbs in desktop context menus is fine — different surface, different framing, no confusion. The bar is "no confusion when switching platforms", not "literally identical UI".

### In scope for this PR

1. **Rename in `SpaceSettingsModal/Account.tsx`**:
   - "Mute this Space" toggle → "Space notifications" toggle, inverted semantics (on by default, off = muted).
   - The event-type multi-select dropdown (`@you` / `@everyone` / `@roles` / `Replies`) becomes a sub-control, only enabled when the master toggle is on.
   - Rename "Hide muted channels" toggle to a label that's consistent with the new framing (exact wording TBD during implementation — see Open Question #1 below).
2. **Add a per-channel settings UI on desktop** with the same "Channel notifications" toggle. Currently desktop has no channel settings modal at all — channel mute is right-click-only. This is the biggest discoverability gap and the rename only makes full sense if there's a settings surface for it. (Open Question #2 below: confirm no existing modal.)
3. **Keep `Mute Space` / `Mute Channel` / `Unmute Space` / `Unmute Channel` labels in desktop right-click context menus** — unchanged.
4. **Fix Bug #1 (in this PR):** [`MessageService.ts:4298`](../../src/services/MessageService.ts#L4298) — the OS notification suppression check reads `settings?.isMuted` (space mute) but not `config?.mutedChannels?.[spaceId]?.includes(channelId)`. Add the channel-mute check so "Channel notifications: off" actually turns off OS notifications too. The `channelId` is available on `decryptedContent.channelId` at line 4280.
5. **i18n**: update keys, run lingui extract, verify English. Italian + other locales can be left to the translator step.
6. **Verification**: manually verify in the running Electron app — toggle space notifications off → no badges, no in-app entries, no OS pop-ups. Toggle channel notifications off → same. Re-toggle on → everything works.

### Explicitly out of scope (filed elsewhere)

| Item | Where it's tracked | Why deferred |
|---|---|---|
| Decision 3: rich shared notification model + cross-device sync + event-type filter on mobile | [`port-from-mobile/desktop-better-than-mobile.md`](port-from-mobile/desktop-better-than-mobile.md) — new entry | Multi-repo scope (shared + mobile + desktop), needs lead-dev convergence work. Architecturally non-trivial. Recorded as a "desktop is better, mobile should converge" item per that folder's convention. |
| Bug #2: mention-type filter not synced cross-device | [`.agents/bugs/2026-06-07-mention-type-filter-not-synced.md`](../bugs/2026-06-07-mention-type-filter-not-synced.md) | Sync bug, not a UX rename. Can ship independently. |
| Bug #3: mobile sign-out doesn't unregister push token | Mobile-side, not tracked in this repo | We don't push to `quorum-mobile`. Mention to lead dev verbally / via issue when convenient. |
| Adding "Mute / Unmute" to mobile context menus | Not filed | Nice-to-have shortcut, not part of fixing cross-platform confusion. Lead dev can decide later. |

## Open questions for implementation

1. **"Hide muted channels" rename:** stay as-is, or rename to "Hide channels with notifications off"? Recommend the rename for consistency, but it's a longer label — check it doesn't break the layout.
2. **Channel settings UI:** does a per-channel settings modal exist on desktop? If yes, where; if no, this PR has to add one. **Verify during implementation planning before scoping the effort.**
3. **Default state for the new "Channel notifications" toggle:** ON by default (matching the implicit current behavior — unmuted unless user explicitly mutes). No migration needed; the underlying `mutedChannels` array's emptiness already represents "all on".
4. **Should the event-type multi-select be visible-but-disabled or hidden when notifications are off?** Recommend disabled-with-tooltip — more discoverable than hidden, makes the relationship visible. Confirm during implementation.

## Next step

Write the implementation plan: file-by-file edits, the new channel settings UI design (after verifying Q2), i18n key list, verification checklist.

---
*Last updated: 2026-06-07*
