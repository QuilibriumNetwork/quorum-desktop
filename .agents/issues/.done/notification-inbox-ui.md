---
type: task
title: "Notification Dropdown/Inbox UI Implementation"
status: done
created: 2026-01-09
updated: 2026-01-09
---

# Notification Dropdown/Inbox UI Implementation

## Overview

Implement a comprehensive notification dropdown/inbox UI that displays all unread mentions across all channels in the current space. This feature builds on the existing mention notification system (Phases 1 & 2) and integrates with the established highlight and navigation patterns used in pinned messages and search results.


**Priority**: Medium
**Related**: [Mention Notification System](../docs/features/mention-notification-system.md)

---

## Requirements Summary

### Core Features
- Dropdown panel showing all unread mentions across all channels in current space
- Filter by mention type (you, role, everyone) with multiselect UI
- Message truncation matching search results layout
- Click-to-navigate functionality with message highlighting
- "Mark all as read" functionality
- Keyboard navigation support
- Auto-clear notifications when viewing messages

### UI Integration
- Bell icon in channel header (left of "users" icon)
- Visual notification dot when unread mentions exist
- Follow SearchResults layout for mention items

---

## Architecture Analysis

### Existing Infrastructure to Leverage

#### 1. Message Display & Truncation
**File**: `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/components/search/SearchResults.tsx`

The search results component provides the exact pattern we need:
- Uses `SearchResultItem` for individual items
- Implements message truncation via `useSearchResultHighlight` hook
- Displays: channel name - message author - message date - truncated message
- Uses `DropdownPanel` for container

**Pattern to follow**:
```tsx
// SearchResultItem displays:
<FlexRow className="result-meta">
  <Icon name="hashtag" className="result-type-icon" />
  <Text className="result-channel mr-2">{channelName}</Text>
  <Icon name="user" className="result-user-icon" />
  <Text className="result-sender">{displayName}</Text>
</FlexRow>
<FlexRow className="result-meta">
  <Icon name="calendar-alt" className="result-date-icon" />
  <Text className="result-date">{formattedDate}</Text>
</FlexRow>
<Container className="result-content">
  <Container className="result-text" dangerouslySetInnerHTML={{__html: highlightTerms(contextualSnippet)}} />
</Container>
```

#### 2. Message Highlighting & Navigation
**Files**:
- `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/hooks/business/messages/useMessageHighlight.ts`
- `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/components/message/PinnedMessagesPanel.tsx`

**Existing pattern from PinnedMessagesPanel** (lines 189-215):
```tsx
const handleJumpToMessage = useCallback(
  (messageId: string) => {
    // Close the panel
    onClose();

    // Navigate to the message with hash (for URL state consistency)
    const currentPath = window.location.pathname;
    navigate(`${currentPath}#msg-${messageId}`);

    // Use React state-based highlighting instead of DOM manipulation
    setTimeout(() => {
      // Scroll to the message using the appropriate method
      scrollToMessage(messageId, virtuosoRef, messageList);

      // Highlight the message using React state (triggers re-render with highlight class)
      highlightMessage(messageId, { duration: 2000 });
    }, 100);
  },
  [navigate, onClose, scrollToMessage, highlightMessage, virtuosoRef, messageList]
);
```

**Key insight**:
- Use existing `useMessageHighlight` hook
- Duration: 6000ms for mention highlights (matches auto-highlight behavior)
- Requires access to `virtuosoRef` and `messageList` from Channel component

#### 3. Mention Count Tracking
**Files**:
- `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/hooks/business/mentions/useChannelMentionCounts.ts`
- `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/hooks/business/mentions/useSpaceMentionCounts.ts`

**Existing infrastructure**:
- `useChannelMentionCounts`: Returns `{ [channelId]: mentionCount }`
- Uses React Query with 30s stale time
- Respects user notification settings (enabledMentionTypes)
- Query key: `['mention-counts', 'channel', spaceId, userAddress, ...channelIds]`

#### 4. UI Primitives Available
**Files**:
- `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/components/ui/DropdownPanel.tsx`
- `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/components/primitives/Icon/`
- `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/components/primitives/Select/`
- `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/components/primitives/Tooltip/`

**Available icons** (from iconMapping.ts):
- `bell`: Notification bell icon
- `check`: Single check mark
- `check-circle`: Check with circle (better for "mark read" action)
- `filter`: Filter icon (alternative to select icon)

---

## Implementation Plan

### Phase 1: Core Hook - useAllMentions

**File**: `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/hooks/business/mentions/useAllMentions.ts`

**Purpose**: Fetch all unread mentions across all channels in a space, supporting filter by mention type.

**Implementation**:
```tsx
import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { isMentionedWithSettings } from '../../../utils/mentionUtils';
import { getDefaultMentionSettings } from '../../../utils/notificationSettingsUtils';
import type { Message } from '../../../api/quorumApi';
import type { MentionTypeId } from '../../../types/notifications';

export interface MentionNotification {
  message: Message;
  channelId: string;
  channelName: string;
  mentionType: 'you' | 'everyone' | 'roles';
}

interface UseAllMentionsProps {
  spaceId: string;
  channelIds: string[];
  enabledTypes?: MentionTypeId[]; // Filter by mention type
}

/**
 * Hook to fetch all unread mentions across all channels in a space
 *
 * Returns array of MentionNotification objects sorted by date (newest first)
 * Respects user's mention notification settings for the space
 *
 * @example
 * const { mentions, isLoading } = useAllMentions({
 *   spaceId,
 *   channelIds,
 *   enabledTypes: ['you', 'everyone'] // Optional filter
 * });
 */
export function useAllMentions({
  spaceId,
  channelIds,
  enabledTypes,
}: UseAllMentionsProps) {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data, isLoading } = useQuery({
    queryKey: ['mention-notifications', spaceId, userAddress, ...channelIds.sort(), ...(enabledTypes?.sort() || [])],
    queryFn: async () => {
      if (!userAddress) return [];

      const allMentions: MentionNotification[] = [];

      try {
        // Load user's mention notification settings for this space
        const config = await messageDB.getUserConfig({ address: userAddress });
        const settings = config?.mentionSettings?.[spaceId];

        // Determine which mention types to check
        const typesToCheck = enabledTypes || settings?.enabledMentionTypes || getDefaultMentionSettings(spaceId).enabledMentionTypes;

        // If no mention types enabled, return empty
        if (typesToCheck.length === 0) {
          return [];
        }

        // Process each channel
        for (const channelId of channelIds) {
          const conversationId = `${spaceId}/${channelId}`;

          // Get conversation to find last read timestamp
          const { conversation } = await messageDB.getConversation({
            conversationId,
          });

          const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

          // Get all messages after last read (up to 10k for safety)
          const { messages } = await messageDB.getMessages({
            spaceId,
            channelId,
            limit: 10000,
          });

          // Get channel name for display
          const { channel } = await messageDB.getChannel({
            spaceId,
            channelId,
          });

          // Filter messages that mention the user and are unread
          const unreadMentions = messages.filter((message: Message) => {
            if (message.createdDate <= lastReadTimestamp) return false;

            return isMentionedWithSettings(message, {
              userAddress,
              enabledTypes: typesToCheck,
            });
          });

          // Add to results with metadata
          unreadMentions.forEach((message) => {
            allMentions.push({
              message,
              channelId,
              channelName: channel?.channelName || 'Unknown Channel',
              mentionType: getMentionType(message, userAddress),
            });
          });
        }

        // Sort by date (newest first)
        allMentions.sort((a, b) => b.message.createdDate - a.message.createdDate);
      } catch (error) {
        console.error('[AllMentions] Error fetching mentions:', error);
        return [];
      }

      return allMentions;
    },
    enabled: !!userAddress && channelIds.length > 0,
    staleTime: 30000, // 30 seconds - matches useChannelMentionCounts
    refetchOnWindowFocus: true,
  });

  return {
    mentions: data || [],
    isLoading,
  };
}

// Helper to determine mention type
function getMentionType(message: Message, userAddress: string): 'you' | 'everyone' | 'roles' {
  if (message.mentions?.everyone) return 'everyone';
  if (message.mentions?.roleIds?.length > 0) return 'roles';
  if (message.mentions?.memberIds?.includes(userAddress)) return 'you';
  return 'you'; // fallback
}
```

**Dependencies**:
- Uses existing `isMentionedWithSettings` from `mentionUtils.ts`
- Uses existing `getDefaultMentionSettings` from `notificationSettingsUtils.ts`
- Query invalidation: Invalidate `['mention-notifications', spaceId]` when messages change

**Export**: Add to `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/hooks/business/mentions/index.ts`:
```tsx
export { useAllMentions } from './useAllMentions';
```

---

### Phase 2: NotificationItem Component

**File**: `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/components/notifications/NotificationItem.tsx`

**Purpose**: Display a single notification item (similar to SearchResultItem)

**Implementation**:
```tsx
import React from 'react';
import { Icon, FlexBetween, FlexRow, Container, Text } from '../primitives';
import { useSearchResultHighlight, useSearchResultFormatting } from '../../hooks';
import type { MentionNotification } from '../../hooks/business/mentions/useAllMentions';
import './NotificationItem.scss';

interface NotificationItemProps {
  notification: MentionNotification;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  displayName: string; // Message author display name
  className?: string;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onNavigate,
  displayName,
  className,
}) => {
  const { message, channelName } = notification;

  // Reuse search result formatting logic
  const { contextualSnippet } = useSearchResultHighlight({
    message,
    searchTerms: [], // No search terms, show from beginning
    contextWords: 12,
    maxLength: 200,
  });

  const { formattedDate, handleClick, handleKeyDown } = useSearchResultFormatting({
    message,
    onNavigate,
  });

  // Get mention type icon
  const mentionIcon = notification.mentionType === 'everyone'
    ? 'bullhorn'
    : notification.mentionType === 'roles'
    ? 'users'
    : 'user';

  return (
    <Container
      className={`notification-item ${className || ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <FlexBetween className="notification-header">
        <FlexRow className="notification-meta">
          <Icon name="hashtag" className="notification-channel-icon" />
          <Text className="notification-channel mr-2">{channelName}</Text>
          <Icon name={mentionIcon} className="notification-mention-type-icon" />
          <Text className="notification-sender">{displayName}</Text>
        </FlexRow>
        <FlexRow className="notification-meta">
          <Icon name="calendar-alt" className="notification-date-icon" />
          <Text className="notification-date">{formattedDate}</Text>
        </FlexRow>
      </FlexBetween>

      <Container className="notification-content">
        <Container className="notification-text">
          {contextualSnippet}
        </Container>
      </Container>
    </Container>
  );
};

export default NotificationItem;
```

**Styling**: `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/components/notifications/NotificationItem.scss`

```scss
// Copy from SearchResultItem.scss and adjust class names
.notification-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-default);
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--color-surface-2);
  }

  &:last-child {
    border-bottom: none;
  }

  .notification-header {
    margin-bottom: 8px;
  }

  .notification-meta {
    gap: 6px;
    align-items: center;
    font-size: 13px;
  }

  .notification-channel {
    color: var(--color-text-strong);
    font-weight: 500;
  }

  .notification-sender {
    color: var(--color-text-subtle);
  }

  .notification-date {
    color: var(--color-text-muted);
    font-size: 12px;
  }

  .notification-channel-icon,
  .notification-mention-type-icon,
  .notification-date-icon {
    color: var(--color-text-subtle);
  }

  .notification-content {
    margin-left: 4px;
  }

  .notification-text {
    color: var(--color-text-main);
    font-size: 14px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
```

---

### Phase 3: NotificationDropdown Component

**File**: `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/components/notifications/NotificationDropdown.tsx`

**Purpose**: Main dropdown panel with filtering and mark-all-read functionality

**Implementation**:
```tsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Container, FlexRow, Text, Icon, Button, Tooltip, FlexCenter, Select } from '../primitives';
import { DropdownPanel } from '../ui';
import { NotificationItem } from './NotificationItem';
import { useAllMentions } from '../../hooks/business/mentions/useAllMentions';
import { useMessageHighlight } from '../../hooks/business/messages/useMessageHighlight';
import { useMessageDB } from '../context/useMessageDB';
import { useQueryClient } from '@tanstack/react-query';
import type { MentionTypeId } from '../../types/notifications';
import './NotificationDropdown.scss';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  channelIds: string[];
  mapSenderToUser: (senderId: string) => any;
  virtuosoRef?: any; // For scrolling to message
  messageList?: any[]; // For scrolling to message
  className?: string;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  spaceId,
  channelIds,
  mapSenderToUser,
  virtuosoRef,
  messageList,
  className,
}) => {
  const navigate = useNavigate();
  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();

  // Filter state (all types enabled by default)
  const [selectedTypes, setSelectedTypes] = useState<MentionTypeId[]>(['you', 'everyone', 'roles']);

  // Fetch mentions with current filter
  const { mentions, isLoading } = useAllMentions({
    spaceId,
    channelIds,
    enabledTypes: selectedTypes,
  });

  // Use the message highlighting system
  const { highlightMessage, scrollToMessage } = useMessageHighlight();

  // Filter options for Select primitive
  const filterOptions = [
    {
      value: 'you' as MentionTypeId,
      label: t`You`,
      subtitle: t`Direct @mentions`,
    },
    {
      value: 'everyone' as MentionTypeId,
      label: t`Everyone`,
      subtitle: t`@everyone mentions`,
    },
    {
      value: 'roles' as MentionTypeId,
      label: t`Roles`,
      subtitle: t`@role mentions`,
    },
  ];

  // Handle filter change - ensure at least one is always selected
  const handleFilterChange = (newValues: string[]) => {
    if (newValues.length === 0) {
      // Don't allow deselecting all
      return;
    }
    setSelectedTypes(newValues as MentionTypeId[]);
  };

  // Handle navigation to message
  const handleNavigate = (spaceId: string, channelId: string, messageId: string) => {
    // Close the dropdown
    onClose();

    // Navigate to the channel
    navigate(`/spaces/${spaceId}/channels/${channelId}`);

    // After navigation, scroll and highlight
    setTimeout(() => {
      scrollToMessage(messageId, virtuosoRef, messageList);
      highlightMessage(messageId, { duration: 6000 }); // 6s for mentions
    }, 100);
  };

  // Handle mark all as read
  const handleMarkAllRead = async () => {
    try {
      // Get current timestamp
      const now = Date.now();

      // Update last read time for all channels with mentions
      const channelsWithMentions = new Set(mentions.map(m => m.channelId));

      for (const channelId of channelsWithMentions) {
        const conversationId = `${spaceId}/${channelId}`;
        await messageDB.saveReadTime({
          conversationId,
          timestamp: now,
        });
      }

      // Invalidate mention count caches
      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'channel', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['mention-notifications', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });

      // Close dropdown
      onClose();
    } catch (error) {
      console.error('[NotificationDropdown] Error marking all as read:', error);
    }
  };

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <FlexCenter className="notification-loading-state">
          <Icon name="spinner" className="loading-icon" spin />
          <Text className="loading-message">{t`Loading notifications...`}</Text>
        </FlexCenter>
      );
    }

    return (
      <FlexCenter className="notification-empty-state">
        <Icon name="bell" className="empty-icon" />
        <Text className="empty-message">{t`No unread mentions`}</Text>
        <Text className="empty-hint">
          {t`You're all caught up!`}
        </Text>
      </FlexCenter>
    );
  };

  return (
    <DropdownPanel
      isOpen={isOpen}
      onClose={onClose}
      position="absolute"
      positionStyle="right-aligned"
      maxWidth={500}
      maxHeight={420}
      className={`notification-dropdown ${className || ''}`}
      showCloseButton={true}
    >
      {/* Header with filter and mark all read */}
      {!isLoading && mentions.length > 0 && (
        <Container className="notification-dropdown__header">
          <FlexRow className="items-center justify-between mb-3">
            <Text className="notification-dropdown__title">
              {mentions.length === 1
                ? t`${mentions.length} unread mention`
                : t`${mentions.length} unread mentions`}
            </Text>
            <Tooltip
              id="mark-all-read-tooltip"
              content={t`Mark all as read`}
              place="top"
            >
              <Button
                type="unstyled"
                onClick={handleMarkAllRead}
                className="notification-dropdown__mark-read"
                iconName="check-circle"
                iconOnly
              />
            </Tooltip>
          </FlexRow>

          {/* Filter dropdown */}
          <FlexRow className="items-center gap-2">
            <Icon name="filter" size="sm" className="text-subtle" />
            <Select
              value={selectedTypes}
              onChange={handleFilterChange}
              options={filterOptions}
              multiple={true}
              placeholder={t`Filter by mention type`}
              size="small"
              variant="filled"
              showSelectAllOption={false} // Custom behavior: at least one must be selected
              className="flex-1"
            />
          </FlexRow>
        </Container>
      )}

      {/* Notification list */}
      {isLoading || mentions.length === 0 ? (
        renderEmptyState()
      ) : (
        <Container className="notification-dropdown__list">
          {mentions.map((notification) => {
            const sender = mapSenderToUser(notification.message.content?.senderId);
            return (
              <NotificationItem
                key={`${notification.message.messageId}-${notification.channelId}`}
                notification={notification}
                onNavigate={handleNavigate}
                displayName={sender?.displayName || t`Unknown User`}
              />
            );
          })}
        </Container>
      )}
    </DropdownPanel>
  );
};

export default NotificationDropdown;
```

**Styling**: `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/components/notifications/NotificationDropdown.scss`

```scss
.notification-dropdown {
  .notification-dropdown__header {
    padding: 16px;
    border-bottom: 1px solid var(--color-border-default);
  }

  .notification-dropdown__title {
    font-weight: 600;
    color: var(--color-text-strong);
  }

  .notification-dropdown__mark-read {
    color: var(--color-text-subtle);

    &:hover {
      color: var(--accent);
    }
  }

  .notification-dropdown__list {
    max-height: 350px;
    overflow-y: auto;
  }

  .notification-loading-state,
  .notification-empty-state {
    padding: 40px 20px;
    text-align: center;

    .empty-icon,
    .loading-icon {
      font-size: 48px;
      color: var(--color-text-muted);
      margin-bottom: 16px;
    }

    .empty-message,
    .loading-message {
      font-size: 16px;
      font-weight: 500;
      color: var(--color-text-main);
      margin-bottom: 8px;
    }

    .empty-hint {
      font-size: 14px;
      color: var(--color-text-subtle);
    }
  }
}
```

---

### Phase 4: Integration into Channel Header

**File**: `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/components/space/Channel.tsx`

**Changes Required**:

1. **Import notification dropdown**:
```tsx
import { NotificationDropdown } from '../notifications/NotificationDropdown';
```

2. **Add state for notification dropdown**:
```tsx
const [showNotifications, setShowNotifications] = useState(false);
```

3. **Calculate total unread mentions for badge**:
```tsx
// Add after line 126 (after usePinnedMessages)
const { mentions: allMentions } = useAllMentions({
  spaceId,
  channelIds: space?.groups.flatMap(g => g.channels.map(c => c.channelId)) || [],
});
const totalMentions = allMentions.length;
```

4. **Add notification bell button in header** (insert after pinned messages button, before users button):

**Location**: Around line 551-566 (between pinned messages and users button)

```tsx
{/* Notification bell - insert here */}
{totalMentions > 0 && (
  <div className="relative">
    <Tooltip
      id={`notifications-${channelId}`}
      content={t`Notifications`}
      showOnTouch={false}
    >
      <Button
        type="unstyled"
        onClick={() => setShowNotifications(true)}
        className="relative header-icon-button"
        iconName="bell"
        iconOnly
      >
        {/* Notification dot */}
        <span className="absolute top-0 right-0 w-2 h-2 bg-accent rounded-full" />
      </Button>
    </Tooltip>

    {/* Notification Dropdown */}
    <NotificationDropdown
      isOpen={showNotifications}
      onClose={() => setShowNotifications(false)}
      spaceId={spaceId}
      channelIds={space?.groups.flatMap(g => g.channels.map(c => c.channelId)) || []}
      mapSenderToUser={mapSenderToUser}
      virtuosoRef={messageListRef.current?.getVirtuosoRef()}
      messageList={messageList}
    />
  </div>
)}

<Tooltip
  id={`members-list-${channelId}`}
  content={t`Members List`}
  showOnTouch={false}
>
  <Button
    type="unstyled"
    onClick={() => {
      setShowUsers(!showUsers);
    }}
    className="header-icon-button"
    iconName="users"
    iconOnly
  />
</Tooltip>
```

5. **Auto-clear notification when viewing message**:

The existing read time tracking system (lines 428-467) already handles this. When a user views a channel:
- The interval updates `lastReadTimestamp` every 2 seconds
- This triggers query invalidation for mention counts
- The notification dropdown will automatically update when reopened

**No additional code needed** - the existing infrastructure handles auto-clearing.

---

## Testing Considerations

### Unit Tests
1. **useAllMentions hook**:
   - Test filtering by mention type
   - Test sorting (newest first)
   - Test empty state handling
   - Test respect for user settings

2. **NotificationItem component**:
   - Test message truncation
   - Test navigation on click
   - Test keyboard navigation

3. **NotificationDropdown component**:
   - Test filter interaction (prevent deselecting all)
   - Test mark all as read functionality
   - Test empty state rendering

### Integration Tests
1. Navigate to message from notification dropdown
2. Verify message highlights correctly (6s duration)
3. Verify notification clears when viewing channel
4. Verify badge count updates in real-time
5. Test across multiple channels
6. Test with different mention types

### Manual Testing Checklist
- [ ] Bell icon appears when unread mentions exist
- [ ] Notification dot shows on bell icon
- [ ] Clicking bell opens dropdown
- [ ] Dropdown shows all unread mentions across channels
- [ ] Filter by mention type works correctly
- [ ] Cannot deselect all filter options
- [ ] Mark all as read clears all notifications
- [ ] Clicking notification navigates to message
- [ ] Message highlights for 6 seconds
- [ ] Viewing channel auto-clears its notifications
- [ ] Badge count updates when notifications clear
- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Dropdown closes on outside click
- [ ] Dropdown closes on Escape key

### Mobile Compatibility Tests
- [ ] Dropdown renders correctly on mobile
- [ ] Touch interactions work smoothly
- [ ] Filter select works on mobile
- [ ] Message truncation works on narrow screens
- [ ] Navigation works on mobile

---

## Potential Challenges & Solutions

### Challenge 1: Performance with Many Channels
**Issue**: Fetching messages from 20+ channels could be slow

**Solutions**:
1. Use existing 30s stale time from mention counts
2. Consider paginating notification list (show first 50)
3. Add loading skeleton during initial fetch
4. Implement virtual scrolling if > 100 notifications

**Recommendation**: Start with simple approach, optimize if needed

### Challenge 2: Real-Time Updates
**Issue**: Notifications should update when new mentions arrive

**Solution**:
- Leverage existing React Query invalidation in MessageService
- When new mention arrives, MessageService already invalidates `['mention-counts']`
- Add invalidation for `['mention-notifications', spaceId]` in same location
- File: `/mnt/d/GitHub/Quilibrium/quorum-desktop/src/services/MessageService.ts` (around line 586-593)

```tsx
// Add to existing invalidation logic
queryClient.invalidateQueries({
  queryKey: ['mention-notifications', message.spaceId],
});
```

### Challenge 3: Filter State Persistence
**Issue**: Should filter state persist across dropdown opens?

**Solutions**:
1. **Option A** (Recommended): Reset to "all" on close (simpler UX)
2. **Option B**: Persist in localStorage (more complex but remembers preference)

**Recommendation**: Start with Option A for MVP

### Challenge 4: Cross-Space Notifications
**Issue**: Requirements say "all channels in Space" but what if user is in multiple spaces?

**Solution**:
- Current implementation is per-space (correct based on architecture)
- Bell icon appears in each space's channel header
- Each space has its own notification dropdown
- This matches the architecture of `useChannelMentionCounts` (per-space)

**No change needed** - architecture is correct

### Challenge 5: Notification vs Mention Terminology
**Issue**: Feature called "notifications" but system tracks "mentions"

**Solution**:
- Internal code uses "mentions" (accurate)
- UI shows "notifications" (user-friendly)
- Documentation uses both terms interchangeably

**Keep consistent**: Use "mention" in code, "notification" in UI

---

## Code Patterns to Follow

### 1. Message Truncation
Copy from `SearchResultItem` - use `useSearchResultHighlight` with empty searchTerms:
```tsx
const { contextualSnippet } = useSearchResultHighlight({
  message,
  searchTerms: [],
  contextWords: 12,
  maxLength: 200,
});
```

### 2. Message Navigation
Copy from `PinnedMessagesPanel` - use navigate + highlightMessage:
```tsx
navigate(`${currentPath}#msg-${messageId}`);
setTimeout(() => {
  scrollToMessage(messageId, virtuosoRef, messageList);
  highlightMessage(messageId, { duration: 6000 });
}, 100);
```

### 3. Dropdown Panel
Copy from `SearchResults` - use same props and structure:
```tsx
<DropdownPanel
  isOpen={isOpen}
  onClose={onClose}
  position="absolute"
  positionStyle="right-aligned"
  maxWidth={500}
  maxHeight={420}
  showCloseButton={true}
>
```

### 4. React Query Pattern
Copy from `useChannelMentionCounts` - same stale time and invalidation:
```tsx
useQuery({
  queryKey: ['mention-notifications', spaceId, userAddress, ...channelIds.sort()],
  queryFn: async () => { /* ... */ },
  enabled: !!userAddress && channelIds.length > 0,
  staleTime: 30000,
  refetchOnWindowFocus: true,
});
```

### 5. Internationalization
Always wrap user-facing text:
```tsx
import { t } from '@lingui/core/macro';

<Text>{t`No unread mentions`}</Text>
```

---

## Mobile-First Considerations

### Responsive Design
1. **Dropdown width**: Uses `min(500px, calc(100vw - 40px))` (already handled by DropdownPanel)
2. **Touch targets**: Buttons are 44x44px minimum (Icon primitive handles this)
3. **Text truncation**: Message text wraps on mobile, uses ellipsis on overflow
4. **Filter select**: Select primitive already mobile-optimized

### Touch Interactions
1. **Tap to navigate**: NotificationItem uses `onClick` (touch-friendly)
2. **Swipe to dismiss**: Not required for MVP (dropdown closes on outside tap)
3. **Long-press actions**: Not required for this feature

### Platform Detection
Not needed for this feature - all primitives handle cross-platform automatically.

---

## File Structure Summary

```
src/
├── components/
│   ├── notifications/
│   │   ├── NotificationDropdown.tsx         # NEW: Main dropdown component
│   │   ├── NotificationDropdown.scss        # NEW: Dropdown styles
│   │   ├── NotificationItem.tsx             # NEW: Single notification item
│   │   └── NotificationItem.scss            # NEW: Item styles
│   └── space/
│       └── Channel.tsx                       # MODIFIED: Add bell icon + dropdown
├── hooks/
│   └── business/
│       └── mentions/
│           ├── useAllMentions.ts             # NEW: Fetch all mentions hook
│           └── index.ts                      # MODIFIED: Export useAllMentions
└── services/
    └── MessageService.ts                     # MODIFIED: Add query invalidation
```

---

## Acceptance Criteria

### Functional Requirements
- [x] Bell icon appears in channel header (left of users icon)
- [x] Visual notification dot when unread mentions exist
- [x] Dropdown shows all unread mentions across all channels in space
- [x] Mentions sorted by date (newest first)
- [x] Filter by mention type (you, everyone, roles)
- [x] At least one filter option must always be selected
- [x] Message layout matches SearchResults (channel - author - date - message)
- [x] Message text truncated to 200 characters
- [x] Click notification navigates to message and highlights it
- [x] Highlight duration is 6 seconds (matches mention auto-highlight)
- [x] Mark all as read button clears all notifications in list
- [x] Viewing channel automatically clears its notifications
- [x] Keyboard navigation support (Tab, Enter, Escape)

### Non-Functional Requirements
- [x] Uses existing primitives (Icon, Select, Tooltip, Button, DropdownPanel)
- [x] Follows SearchResults layout patterns
- [x] Reuses useMessageHighlight infrastructure
- [x] Respects user notification settings (enabledMentionTypes)
- [x] Mobile-compatible (responsive, touch-friendly)
- [x] Performance: 30s stale time with React Query
- [x] Internationalized (all text wrapped in t``)
- [x] Accessible (keyboard navigation, ARIA roles)

### Code Quality
- [x] TypeScript types defined
- [x] React hooks rules followed
- [x] No console errors or warnings
- [x] SCSS follows project conventions
- [x] Code documented with inline comments
- [x] Query keys follow existing patterns

---

## Future Enhancements (Out of Scope)

1. **Cross-space notifications**: Single dropdown for all spaces
2. **Notification grouping**: Group by channel or time period
3. **Notification persistence**: Store read state per-notification (not per-channel)
4. **Desktop notifications**: System notifications for new mentions
5. **Sound alerts**: Audio notification on new mention
6. **Notification preferences**: Per-channel notification muting
7. **Pagination**: Load more notifications on scroll
8. **Notification actions**: Reply, React, Mark unread from dropdown
9. **Real-time updates**: WebSocket updates without query invalidation

---

## Related Documentation

- [Mention Notification System](../docs/features/mention-notification-system.md)
- [Search Feature (message truncation pattern)](../docs/features/search-feature.md)
- [Pinned Messages (navigation pattern)](../docs/features/messages/pinned-messages.md)
- [DropdownPanel Component](../docs/features/modals.md)
- [Primitives API Reference](../docs/features/primitives/API-REFERENCE.md)
- [Cross-Platform Components Guide](../docs/cross-platform-components-guide.md)

---

**Last updated**: 2025-10-10
