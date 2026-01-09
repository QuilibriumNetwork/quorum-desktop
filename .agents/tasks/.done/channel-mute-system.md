---
type: task
title: Channel Mute System
status: done
complexity: medium
ai_generated: true
created: 2025-12-26T00:00:00.000Z
updated: '2026-01-09'
---

# Channel Mute System

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent


**Files**:
- `src/components/space/ChannelItem.tsx` (context menu integration)
- `src/components/space/ChannelList.tsx` (filtering logic)
- `src/components/modals/SpaceSettingsModal/Account.tsx` (hide/show toggle)
- `src/components/ui/ContextMenu.tsx` (requires dm-conversation-context-menu.md completion)
- `src/services/ConfigService.ts` (persistence)
- `src/db/messages.ts` (UserConfig type)
- `src/hooks/business/mentions/useChannelMentionCounts.ts` (notification filtering)
- `src/hooks/business/replies/useReplyNotificationCounts.ts` (notification filtering)
- `src/utils/channelUtils.ts` (new utility functions)

## What & Why

Users currently cannot mute channels they don't want to see or receive notifications from. This creates notification fatigue and clutters the channel list. This feature adds per-user channel muting with three capabilities: (1) mute/unmute channels via context menu, (2) suppress all notifications from muted channels, and (3) optionally hide muted channels from the channel list entirely (default: visible with 60% opacity). The feature uses the existing config sync system to persist preferences across devices.

## Context

- **Notification system**: Channels display mention and reply counts (see `.agents/docs/features/mention-notification-system.md`)
- **Config sync pattern**: User preferences sync via `ConfigService.ts` and `UserConfig` type (see `.agents/docs/config-sync-system.md`)
- **Context menu dependency**: Requires unified `ContextMenu` component from `.agents/tasks/dm-conversation-context-menu.md`
- **Touch interaction**: ChannelItem currently uses `useLongPressWithDefaults` for space owner long-press to open ChannelEditorModal
- **Current channel interactions**:
  - Desktop: Click → navigate, Gear icon (owners only) → ChannelEditorModal
  - Touch: Tap → navigate, Long-press (owners only) → ChannelEditorModal
- **Permissions**: Channel muting is user-specific (no role requirements), but notifications already respect role-based mention filtering

## Prerequisites

- [ ] Review `.agents/docs/features/mention-notification-system.md` for notification architecture
- [ ] Review `.agents/docs/config-sync-system.md` for persistence patterns
- [ ] Review `.agents/tasks/dm-conversation-context-menu.md` for ContextMenu component API
- [ ] Complete `.agents/tasks/dm-conversation-context-menu.md` task (ContextMenu component must exist)
- [ ] Branch created from `develop`

## Implementation

### Phase 1: Data Model & Persistence (foundation)

- [ ] **Add mutedChannels to UserConfig type** (`src/db/messages.ts`)
  - Done when: `UserConfig` includes `mutedChannels?: { [spaceId: string]: string[] }` (maps spaceId to array of channelIds)
  - Structure example: `{ "space-123": ["channel-abc", "channel-xyz"] }`
  - Rationale: Per-space organization mirrors `notificationSettings` pattern
  - **Size consideration**: Each space with 10 muted channels adds ~500 bytes. Total expected impact: 5-50KB for typical users (well within 1MB UserConfig limit). See config sync size limits in `.agents/docs/config-sync-system.md:330-337`

- [ ] **Add showMutedChannels preference to UserConfig** (`src/db/messages.ts`)
  - Done when: `UserConfig` includes `showMutedChannels?: boolean` (default: true)
  - Global preference (not per-space) since it's a UI visibility preference

- [ ] **Create channel mute utility functions** (`src/utils/channelUtils.ts`)
  - Done when: Helper functions exist for mute/unmute operations
  - Functions needed:
    ```typescript
    export const isChannelMuted = (
      spaceId: string,
      channelId: string,
      mutedChannels?: UserConfig['mutedChannels']
    ): boolean

    export const getMutedChannelsForSpace = (
      spaceId: string,
      mutedChannels?: UserConfig['mutedChannels']
    ): string[]
    ```
  - Reference: Similar pattern to `notificationSettingsUtils.ts`

- [ ] **Add mute persistence methods to ConfigService** (`src/services/ConfigService.ts`)
  - Done when: Methods exist to save/load muted channels with cache invalidation
  - Methods needed:
    ```typescript
    async muteChannel(spaceId: string, channelId: string): Promise<void>
    async unmuteChannel(spaceId: string, channelId: string): Promise<void>
    async toggleShowMutedChannels(show: boolean): Promise<void>
    ```
  - Implementation:
    1. Load config → modify `mutedChannels` → save config (triggers sync if enabled)
    2. **Immediately invalidate React Query caches** to update UI:
       ```typescript
       // After save completes
       this.queryClient.invalidateQueries(['mention-counts', 'channel', spaceId]);
       this.queryClient.invalidateQueries(['reply-counts', 'channel', spaceId]);
       this.queryClient.invalidateQueries(['mention-notifications', spaceId]);
       this.queryClient.invalidateQueries(['reply-notifications', spaceId]);
       ```
    3. Optional: Add config size warning if total exceeds 800KB (80% of 1MB safe limit)
  - Reference: Follow `notificationSettings` persistence pattern in ConfigService

### Phase 2: Context Menu Integration (requires Phase 1 + ContextMenu component)

- [ ] **Add context menu to ChannelItem (desktop & touch)** (`src/components/space/ChannelItem.tsx`)
  - Done when: Right-click (desktop) or long-press (touch) opens ContextMenu with role-aware items
  - **Desktop**: Right-click handler opens context menu at mouse position
  - **Touch**: Long-press handler opens same context menu at touch position (with haptic feedback)
  - Context menu items (role-aware):
    ```typescript
    const menuItems = [];

    // Space owners get Channel Settings option
    if (isSpaceOwner) {
      menuItems.push({
        icon: 'settings',
        label: t`Channel Settings`,
        onClick: () => openChannelEditor(spaceId, groupName, channel.channelId)
      });

      // Pin/Unpin option (owners only)
      // Note: Pin functionality verified in ChannelEditorModal.tsx:132-145 (isPinned state, handlePinChange handler)
      menuItems.push({
        icon: channel.isPinned ? 'pin-slash' : 'pin',
        label: channel.isPinned ? t`Unpin Channel` : t`Pin Channel`,
        onClick: () => handlePinChange(!channel.isPinned) // Extract from useChannelManagement hook
      });
    }

    // Everyone gets Mute/Unmute option
    menuItems.push({
      icon: isMuted ? 'bell' : 'bell-slash',
      label: isMuted ? t`Unmute Channel` : t`Mute Channel`,
      onClick: () => toggleMute(spaceId, channel.channelId)
    });
    ```
  - Header config:
    ```typescript
    header: {
      type: 'channel',
      channelName: channel.channelName,
      icon: channel.icon || 'hashtag',
      iconColor: channel.iconColor,
      iconVariant: channel.iconVariant
    }
    ```
  - Note: ContextMenu component needs new header type `'channel'` added to discriminated union
  - Reference: Follow pattern from dm-conversation-context-menu.md Phase 2

- [ ] **Update ContextMenu to support channel header** (`src/components/ui/ContextMenu.tsx`)
  - Done when: ContextMenu accepts `type: 'channel'` in header discriminated union
  - Add to HeaderConfig:
    ```typescript
    | {
        type: 'channel';
        channelName: string;
        icon: string;
        iconColor?: string;
        iconVariant?: 'outline' | 'filled';
      }
    ```
  - Rendering: `<Icon>` with color + truncated channel name (use `truncate-channel-name` class)

- [ ] **Implement unified long-press behavior** (`src/components/space/ChannelItem.tsx`)
  - Done when: Long-press opens ContextMenu for all users (replaces direct ChannelEditorModal for owners)
  - **Old behavior**: Long-press → ChannelEditorModal (owners only), nothing (regular users)
  - **New behavior**: Long-press → ContextMenu with role-aware items (all users)
    - **Space owners see**: "Channel Settings" + "Pin/Unpin Channel" + "Mute/Unmute Channel"
    - **Regular users see**: "Mute/Unmute Channel" only
  - Implementation notes:
    - Remove direct `openChannelEditor` call from long-press handler
    - Add `openContextMenu` call with role-aware menu items
    - Keep `hapticMedium()` feedback on long-press trigger
    - Owners can still access ChannelEditorModal via "Channel Settings" menu item
    - Pin/unpin functionality already exists (currently in ChannelEditorModal), just expose in context menu
  - Reference: Same pattern as DM contacts and spaces in dm-conversation-context-menu.md

### Phase 3: Channel List Filtering (requires Phase 1)

- [ ] **Add mute state to ChannelList logic** (`src/components/space/ChannelList.tsx`)
  - Done when: ChannelList filters out muted channels when `showMutedChannels: false`
  - Load user config using `useUserConfig()` hook
  - Filter logic:
    ```typescript
    const mutedChannelIds = getMutedChannelsForSpace(spaceId, userConfig?.mutedChannels);
    const visibleGroups = showMutedChannels
      ? groupsWithMentionCounts
      : groupsWithMentionCounts.map(group => ({
          ...group,
          channels: group.channels.filter(ch => !mutedChannelIds.includes(ch.channelId))
        })).filter(group => group.channels.length > 0); // Remove empty groups
    ```
  - Reference: Similar filtering pattern in DirectMessageContactsList

- [ ] **Add visual indicator for muted channels** (`src/components/space/ChannelItem.tsx`)
  - Done when: Muted channels show reduced opacity (when `showMutedChannels: true`)
  - **Visual treatment**: 60% opacity on entire channel item
  - CSS implementation:
    ```scss
    .channel-name-muted {
      opacity: 0.6;
    }
    ```
  - Apply class conditionally: `className={isMuted ? 'channel-name-muted' : ''}`
  - Location: Add to `ChannelList.scss` or `ChannelItem.scss`

- [ ] **Add "Show/Hide Muted Channels" toggle to Account settings** (`src/components/modals/SpaceSettingsModal/Account.tsx`)
  - Done when: Toggle controls visibility of muted channels in channel list
  - **Default state**: `showMutedChannels: true` (muted channels visible with 60% opacity)
  - Add after notification settings section:
    ```tsx
    <Spacer size="md" direction="vertical" borderTop={true} />
    <div className="text-subtitle-2">
      <Trans>Other Settings</Trans>
    </div>
    <div className="pt-4">
      <FlexRow className="items-center justify-between">
        <div className="text-label-strong">
          <Trans>Hide muted channels</Trans>
        </div>
        <Switch
          value={!showMutedChannels}
          onChange={handleShowMutedToggle}
          accessibilityLabel={t`Hide muted channels in list`}
        />
      </FlexRow>
    </div>
    ```
  - Use ConfigService.toggleShowMutedChannels() for persistence
  - Reference: Similar toggle pattern for other account preferences

### Phase 4: Notification Suppression (requires Phase 1)

- [ ] **Filter muted channels from mention counts** (`src/hooks/business/mentions/useChannelMentionCounts.ts`)
  - Done when: Muted channels return 0 mention count regardless of actual mentions
  - Implementation:
    ```typescript
    const userConfig = useUserConfig();
    const mutedChannelIds = getMutedChannelsForSpace(spaceId, userConfig?.mutedChannels);

    // In count calculation:
    const mentionCount = mutedChannelIds.includes(channelId)
      ? 0
      : actualMentionCount;
    ```
  - Reference: Similar filtering in useChannelUnreadCounts

- [ ] **Filter muted channels from reply counts** (`src/hooks/business/replies/useReplyNotificationCounts.ts`)
  - Done when: Muted channels return 0 reply count regardless of actual replies
  - Implementation: Same pattern as mention counts above

- [ ] **Exclude muted channels from NotificationPanel** (`src/components/notifications/NotificationPanel.tsx`)
  - Done when: NotificationPanel doesn't show notifications from muted channels
  - Filter notifications before rendering:
    ```typescript
    const mutedChannelIds = getMutedChannelsForSpace(spaceId, userConfig?.mutedChannels);
    const filteredNotifications = allNotifications.filter(
      n => !mutedChannelIds.includes(n.channelId)
    );
    ```
  - Apply filter after combining mentions and replies, before sorting

- [ ] **Verify space-level notification counts exclude muted channels** (`src/hooks/business/mentions/useSpaceMentionCounts.ts`)
  - Done when: Space icon badge doesn't include counts from muted channels
  - Implementation: Should automatically work if channel-level counts return 0 for muted channels
  - Verification: Mute a channel with notifications → space badge count decreases

### Phase 5: Space-Level Muting (requires Phase 1 + Phase 4)

Allows users to mute an entire space with a single action. This is a **user intent** stored separately from individual channel mutes, so:
- When space is muted, ALL channels (including future ones) are muted
- User can still unmute individual channels within a muted space if desired
- Unmuting the space restores individual channel preferences

- [ ] **Add isMuted field to NotificationSettings type** (`src/types/notifications.ts`)
  - Done when: `NotificationSettings` includes `isMuted?: boolean` (default: false)
  - Rationale: Integrates with existing per-space notification settings rather than creating parallel system
  - Structure:
    ```typescript
    export interface NotificationSettings {
      spaceId: string;
      enabledNotificationTypes: NotificationTypeId[];
      isMuted?: boolean;  // NEW: When true, suppresses ALL notifications for this space
    }
    ```

- [ ] **Add space mute functions to useChannelMute hook** (`src/hooks/business/channels/useChannelMute.ts`)
  - Done when: Hook exports `isSpaceMuted`, `muteSpace`, `unmuteSpace`, `toggleSpaceMute`
  - Implementation:
    ```typescript
    interface UseChannelMuteReturn {
      // ... existing fields ...
      /** Check if the entire space is muted */
      isSpaceMuted: boolean;
      /** Mute the entire space (all channels, including future ones) */
      muteSpace: () => Promise<void>;
      /** Unmute the space (restores individual channel preferences) */
      unmuteSpace: () => Promise<void>;
      /** Toggle space mute status */
      toggleSpaceMute: () => Promise<void>;
    }
    ```
  - `isSpaceMuted`: Read from `notificationSettings[spaceId]?.isMuted`
  - `muteSpace`: Set `notificationSettings[spaceId].isMuted = true`
  - `unmuteSpace`: Set `notificationSettings[spaceId].isMuted = false`
  - Uses same Action Queue pattern as channel muting for offline support

- [ ] **Update notification hooks to respect space mute**
  - Files: `useChannelMentionCounts.ts`, `useReplyNotificationCounts.ts`, `useAllMentions.ts`, `useAllReplies.ts`
  - Done when: When `isMuted === true`, all notification counts return 0 immediately (O(1) check)
  - Implementation (early return at start of queryFn):
    ```typescript
    // Check if entire space is muted (takes precedence over channel mutes)
    if (settings?.isMuted) {
      return {}; // or [] for arrays - all channels return 0 instantly
    }
    ```
  - Rationale: More efficient than checking individual channels when space is muted

- [ ] **Add Mute/Unmute Space to NavMenu space context menu** (`src/components/navbar/NavMenu.tsx`)
  - Done when: Right-clicking space icon shows "Mute Space" or "Unmute Space" option
  - Location in menu: After "Hide Muted Channels" toggle, before "Leave Space" (for non-owners)
  - Implementation:
    ```typescript
    // In getSpaceContextMenuItems()
    items.push({
      id: 'toggle-space-mute',
      icon: isSpaceMuted ? 'bell' : 'bell-slash',
      label: isSpaceMuted ? t`Unmute Space` : t`Mute Space`,
      onClick: () => toggleSpaceMute(),
    });
    ```
  - Icon logic: `bell-slash` when unmuted (to mute), `bell` when muted (to unmute)

- [ ] **Add Mute/Unmute Space toggle to Account.tsx** (`src/components/modals/SpaceSettingsModal/Account.tsx`)
  - Done when: Toggle in "Other Settings" section controls space mute status
  - Location: After "Hide muted channels" toggle, before "Leave Space" section
  - Implementation:
    ```tsx
    <FlexRow className="items-center justify-between pt-4">
      <div>
        <div className="text-label-strong">
          <Trans>Mute this Space</Trans>
        </div>
        <div className="text-body-subtle text-sm pt-1">
          <Trans>Disable all notifications from this space</Trans>
        </div>
      </div>
      <Switch
        value={isSpaceMuted}
        onChange={toggleSpaceMute}
        accessibilityLabel={t`Mute all notifications from this space`}
      />
    </FlexRow>
    ```
  - Visual feedback: When space is muted, the notification type selector could show a disabled/dimmed state with tooltip explaining space is muted

- [ ] **Update space-level notification count hooks** (`useSpaceMentionCounts.ts`, `useSpaceReplyCounts.ts`)
  - Done when: Muted spaces return 0 for all notification counts
  - Implementation: Check `isMuted` before processing any channels
  - Effect: Space icon in NavMenu won't show notification badge when space is muted

## Verification

✅ **Desktop context menu works**
  - Test: Right-click channel → context menu shows with channel name and mute/unmute option
  - Test: Click "Mute Channel" → channel becomes muted (visual indicator appears if implemented)
  - Test: Right-click muted channel → shows "Unmute Channel" option
  - Test: Click "Unmute Channel" → channel returns to normal state

✅ **Touch interaction works**
  - Test: Long-press channel → ContextMenu opens with haptic feedback
  - Test (as owner): Menu shows "Channel Settings" + "Pin/Unpin Channel" + "Mute Channel"
  - Test (as regular user): Menu shows only "Mute Channel"
  - Test (as owner): Click "Channel Settings" → ChannelEditorModal opens
  - Test (as owner): Click "Pin Channel" → channel pins to top (or unpins if already pinned)
  - Test: Click "Mute Channel" → channel becomes muted with visual indicator

✅ **Channel filtering works**
  - Test: Mute a channel → toggle "Show muted channels" off → channel disappears from list
  - Test: Toggle "Show muted channels" on → muted channel reappears with indicator
  - Test: Mute all channels in a group → group disappears when hiding muted channels
  - Test: Unmute channel → channel returns to normal visibility

✅ **Notification suppression works**
  - Test: Mute channel with unread mentions → mention bubble disappears from channel
  - Test: Mute channel with unread replies → reply bubble disappears
  - Test: Send new mention to muted channel → no bubble appears
  - Test: Check NotificationPanel → muted channel notifications don't appear
  - Test: Check space icon badge → count excludes muted channels
  - Test: Unmute channel → notification counts reappear

✅ **Persistence works**
  - Test: Mute channel → reload app → channel still muted
  - Test: Toggle "Show muted channels" → reload app → setting persists
  - Test: (If sync enabled) Mute on Device A → switch to Device B → channel muted there too
  - Test: Check IndexedDB → `mutedChannels` and `showMutedChannels` saved correctly

✅ **Space muting works (Phase 5)**
  - Test: Right-click space icon → shows "Mute Space" option
  - Test: Click "Mute Space" → space becomes muted, option changes to "Unmute Space"
  - Test: Muted space → no notification badges on space icon
  - Test: Muted space → no notifications in NotificationPanel from that space
  - Test: Mute space → add new channel → new channel is also muted (no notifications)
  - Test: Mute space in Account.tsx → space mutes, toggle shows "on" state
  - Test: Unmute space → individual channel preferences restored
  - Test: Mute space → individually unmute a channel → that channel shows notifications

✅ **TypeScript compiles**
  - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✅ **No console errors**
  - Test: Perform all mute/unmute operations → no errors in console

## Edge Cases

| Scenario | Expected Behavior | Status | Priority | Risk |
|----------|-------------------|--------|----------|------|
| Mute channel user is currently viewing | Channel remains viewable, notifications suppressed, list shows muted state (reduced opacity) | ⚠️ Needs handling | P1 | Low |
| Hide muted channels while viewing muted channel | Channel stays visible in UI until navigation, then filtered from list | ⚠️ Needs handling | P2 | Low |
| Delete muted channel | Remove channelId from mutedChannels config (cleanup) | ⚠️ Needs handling | P2 | Low |
| Mute channel in folder | Folder still shows if it has unmuted channels | ⚠️ Needs verification | P1 | Low |
| All channels in space muted + hidden | Show empty channel list (no special message - user can toggle showMutedChannels to see them) | ⚠️ Needs verification | P2 | Low |
| Mute channel with existing notifications | Notifications disappear immediately from NotificationPanel and counts via cache invalidation | ⚠️ Needs implementation | P1 | Medium |
| Sync conflict (different mute states on different devices) | Last-write-wins per config sync system | ✓ Handled by ConfigService | P1 | Low |
| Channel without icon | Use default hashtag icon in context menu header | ✓ Handled by Icon component | P0 | Low |
| Touch long-press on channel | Opens same ContextMenu as right-click (role-aware items) | ✓ Unified approach decided | P0 | Low |
| Very long channel name in context menu | Truncate with ellipsis using `truncate-channel-name` class | ✓ CSS handles this | P1 | Low |
| Owner long-press channel | Shows ContextMenu with "Channel Settings" + "Pin/Unpin" + "Mute" (replaces direct modal open) | ✓ New pattern decided | P0 | Low |
| Pin/unpin muted channel | Pin state and mute state are independent (can have pinned muted channels) | ⚠️ Needs verification | P1 | Low |
| Mute space with individually muted channels | Space mute takes precedence; individual mutes preserved for when space is unmuted | ✓ Design decided | P1 | Low |
| Unmute channel in muted space | Channel receives notifications even though space is muted (user intent override) | ⚠️ Needs implementation | P1 | Medium |
| New channel added to muted space | Automatically muted (no notifications) since space-level isMuted=true | ✓ Design decided | P0 | Low |
| Mute space from context menu | Sets notificationSettings[spaceId].isMuted=true, shows "Unmute Space" next time | ⚠️ Needs implementation | P0 | Low |
| Mute space from Account.tsx | Same effect as context menu, toggle reflects current state | ⚠️ Needs implementation | P0 | Low |

## Definition of Done

- [ ] All implementation phases complete (including Phase 5: Space-Level Muting)
- [ ] Unified context menu works for desktop (right-click) and touch (long-press)
- [ ] Role-aware menu items (owners see Settings + Pin/Unpin + Mute, regular users see Mute)
- [ ] Pin/unpin functionality works from context menu (owners only)
- [ ] Visual indicator (60% opacity) displays correctly for muted channels
- [ ] Existing notifications disappear immediately when channel muted (cache invalidation verified)
- [ ] All verification tests pass
- [ ] TypeScript compiles without errors
- [ ] No console errors or warnings
- [ ] Mute state persists across sessions
- [ ] Config sync works (if enabled)
- [ ] NotificationPanel excludes muted channels
- [ ] ChannelList filtering works correctly
- [ ] Context menu integration complete
- [ ] **Space muting works from NavMenu context menu** (before "Leave Space" for non-owners)
- [ ] **Space muting works from Account.tsx** (toggle in "Other Settings" section)
- [ ] **New channels in muted space are automatically muted**
- [ ] **Individual channel unmute works within muted space** (override)
- [ ] Edge cases handled appropriately
- [ ] Code follows existing patterns (ConfigService, hooks, utils)

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2025-12-26 - Claude**: Initial task creation with comprehensive phases, context menu integration, notification suppression, and config sync persistence patterns

**2025-12-26 - Claude**: Resolved UX decisions and updated implementation approach:
  - **Touch UX**: Unified ContextMenu approach - same menu for desktop (right-click) and touch (long-press)
  - **Role-aware menu items**: Space owners see "Channel Settings" + "Pin/Unpin" + "Mute", regular users see only "Mute"
  - **Visual indicator**: 60% opacity on muted channels (default: visible)
  - **Empty state**: No special message for all-muted scenario (just empty list)
  - **Breaking change**: Owner long-press now opens ContextMenu instead of directly opening ChannelEditorModal (more consistent with other sidebar items)
  - **Added pin/unpin**: Space owners can now pin/unpin channels directly from context menu (verified exists in ChannelEditorModal.tsx:132-145)

**2025-12-26 - Claude**: Incorporated feature-analyzer feedback:
  - **Config size**: Added size impact documentation (5-50KB expected, well within 1MB limit)
  - **Immediate notification suppression**: Added cache invalidation to muteChannel/unmuteChannel methods for instant UI updates
  - **Pin/unpin verification**: Confirmed functionality exists in useChannelManagement hook
  - **Default behavior**: Muted channels visible by default with 60% opacity (showMutedChannels: true)
  - **Mobile drawer**: Confirmed not relevant - filtering at data level handles all rendering contexts
  - **Toggle location**: Keeping in Account.tsx as space-specific account settings per user preference

**2025-12-26 - User**: Added note about UserConfig payload size limit:
  - **Awaiting confirmation**: Need to verify with lead dev about actual payload size limit for encrypted UserConfig uploads via Quilibrium network
  - Current understanding based on observations: ~1MB works, ~21MB failed (but was due to encryption state bloat bug)
  - No explicit limit enforced in client code - limit appears to be at network/node level
  - Post-bug-fix typical configs should be 10-500KB, this feature adds 5-50KB
  - May need to add client-side validation if actual limit is confirmed

**2025-12-27 - Claude**: Added Phase 5: Space-Level Muting based on feature-analyzer recommendation:
  - **Design decision**: Use `isMuted?: boolean` in existing `NotificationSettings` type (not separate `mutedSpaces` array)
  - **Rationale**: Integrates with existing per-space notification settings rather than creating parallel system
  - **Key behavior**: Space mute is a **user intent** - new channels are automatically muted, but individual channels can be unmuted as override
  - **UI locations**: NavMenu space context menu (before "Leave Space") + Account.tsx "Other Settings" section
  - **Performance**: O(1) check for muted space vs O(n) channel checks
  - **Preserves preferences**: Unmuting space restores individual channel mute states

---
