---
type: task
title: Add a real global notifications mute (with optional snooze) to desktop
status: design-questions-open
created: 2026-06-07
scope: desktop, possibly quorum-shared
related:
  - .agents/tasks/2026-06-07-align-notification-settings-with-mobile.md
  - .agents/reports/2026-05-28-notification-architecture-divergence.md
  - .agents/tasks/port-from-mobile/desktop-better-than-mobile.md
---

# Add a real global notifications mute to desktop

## Problem

Desktop currently has a "Desktop Notifications" toggle in [`UserSettingsModal/Notifications.tsx`](../../src/components/modals/UserSettingsModal/Notifications.tsx) — but it's misleading:

- Turning it ON calls `Notification.requestPermission()` (browser prompt).
- Turning it OFF **doesn't actually do anything programmatically** — the browser doesn't let web apps revoke their own notification permission. The UI shows a line telling the user to change the setting in their browser instead.

So there's no real way for a user to say "silence everything for the next hour" without revoking browser permission entirely (and then re-granting later).

**Mobile already has this.** Per [`notificationPrefs.ts`](../../../quorum-mobile/services/notifications/notificationPrefs.ts), there's a real `global:enabled` boolean in MMKV. Toggling it OFF suppresses notifications at multiple layers (JS dispatcher, iOS NSE Swift code, in-app log writer). Push registration with the server is unchanged — the gate is client-side.

Desktop should match this capability, plus add the snooze ergonomics that the desktop form factor invites (focus mode, meetings, etc.).

## Why this is a separate task (not bundled into the notification-settings UX alignment PR)

- That PR already covers a rename + a real bug fix + a new per-channel UI. Adding global mute would expand review scope.
- A useful global mute usually comes with snooze ergonomics (1h, 4h, until tomorrow morning, until manually re-enabled). That's a real product/design decision deserving its own pass.
- It changes the meaning of the existing "Desktop Notifications" toggle in User Settings — likely replaces it. Needs explicit design call.

## Design questions to resolve before implementation

1. **Snooze vs. binary toggle.** Options:
   - **Binary**: just "Notifications: on/off" — simplest, matches mobile exactly.
   - **Snooze menu**: "Mute for 30 min / 1h / 4h / until tomorrow / indefinitely" — Slack-style. Stores an expiration timestamp; client re-enables itself when expiration passes.
   - **Recommend:** snooze menu. Binary is what mobile has but mobile users rarely have hours-long focus sessions on their phone; on a work computer that pattern is much more common.

2. **Where it lives.** Options:
   - **Folded into the existing "Desktop Notifications" toggle in `UserSettingsModal/Notifications.tsx`** — replaces the current toggle entirely, gives it real teeth, drops the misleading browser-permission-only behavior.
   - **A new quick-access surface** (e.g. avatar dropdown menu, with current snooze state shown there) for fast toggling without opening Settings.
   - **Recommend:** both. The full control lives in Settings, the quick toggle lives in the avatar dropdown so it's one-click during a meeting.

3. **What does the existing "Desktop Notifications" toggle become?**
   - If we replace it: users lose the "request browser permission" affordance unless we surface that elsewhere (e.g. a banner when permission is `default`/not yet requested).
   - If we keep both: confusing — two toggles that both look like "all notifications on/off" but only one actually works.
   - **Recommend:** replace it. Surface the browser-permission ask as a separate callout/banner when needed ("Notifications require browser permission — [Enable]"). That's cleaner than a toggle that pretends to control state it can't control.

4. **Sync via UserConfig (cross-device) or local-only?**
   - **Cross-device** is more consistent with how desktop persists every other notification preference, and arguably what users want for a "muted indefinitely" state — if I mute on my laptop, my desktop should also be quiet.
   - **Local-only** is more consistent with how *mobile* currently works (its `global:enabled` is MMKV, not synced).
   - **Recommend:** cross-device. Already discussed as part of the broader "mobile should converge to UserConfig sync" entry in [`desktop-better-than-mobile.md`](port-from-mobile/desktop-better-than-mobile.md#2-per-space-notification-preferences--model-richness-sync-and-gating-fidelity). One more reason to land synced.
   - Snooze expiration timestamps also benefit from sync: "I snoozed for 4 hours from my work computer at 14:00, now I'm on my laptop — the laptop should respect the same expiration."

5. **Interaction with per-space `isMuted` and per-channel `mutedChannels`.**
   - Global mute clearly takes precedence — if global is off, nothing fires regardless of per-space state.
   - When global mute clears (snooze expires or user toggles back on), per-space and per-channel settings resume their normal effect. No state migration needed.
   - **Concrete: add the global check at [`MessageService.ts:4298`](../../src/services/MessageService.ts#L4298) (and the analogous DM-notification block at the equivalent earlier line) as a short-circuit before the existing `isMuted` / `mutedChannels` check.**

6. **Visual indication of "currently muted" state.**
   - Avatar overlay (a small bell-off icon on the user avatar)? Sidebar badge?
   - When snooze is active, show the expiration time prominently so users don't forget they muted themselves.

## Implementation sketch (once design is settled)

Assuming the recommendations above:

1. **`quorum-shared`**: add `globalNotifications` field to `UserConfig`:
   ```ts
   globalNotifications?: {
     enabled: boolean;  // true = notifications on (default)
     snoozeUntil?: number;  // unix ms timestamp, only set when snoozing
   };
   ```
2. **Desktop**: new hook `useGlobalNotifications` (mirrors `useChannelMute` patterns) — reads the config, exposes `isEnabled`, `snoozeUntil`, `toggle()`, `snooze(durationMs)`, `clearSnooze()`. Writes via the action queue (synced).
3. **MessageService**: short-circuit notification fire if `!isEnabled || (snoozeUntil && snoozeUntil > Date.now())`. Add ONCE at the top, before all existing checks.
4. **UI — User Settings → Notifications**: replace the existing "Desktop Notifications" toggle with the new control. Show snooze state explicitly. Surface a separate "Allow browser notifications" affordance when permission isn't granted.
5. **UI — Avatar dropdown**: add "Mute notifications" / "Mute for…" menu item with submenu of snooze durations. Show current state.
6. **Auto-clear on expiration**: a small `useEffect` somewhere central that polls `snoozeUntil` every minute and clears it via `clearSnooze()` when it elapses. Trigger query invalidations downstream.
7. **Mobile follow-up**: this task is desktop-only but lands a `UserConfig` field that mobile could read. File a `port-from-mobile/desktop-better-than-mobile.md` follow-up to converge mobile's `global:enabled` MMKV boolean onto the synced `UserConfig.globalNotifications.enabled`.

## Out of scope for this task

- Per-space snooze (e.g. "mute this space for 1 hour"). Could be a future iteration but starts complicating the UI fast.
- Quiet hours / scheduled mute (e.g. "always mute between 22:00 and 07:00"). Different feature, different design pass.

## Next step

Get user input on the design questions above (especially Q1 binary-vs-snooze and Q3 what-happens-to-current-toggle), then write an implementation plan.

---
*Last updated: 2026-06-07*
