---
type: task
title: "Reply Notification System"
status: done
complexity: medium
created: 2026-01-09
updated: 2025-10-16
---

# Reply Notification System


**Priority**: Medium

**Related**: [mention-notification-system.md](../docs/features/mention-notification-system.md)

---

## Overview

Add reply notifications to the existing notification system. When a user's message receives a reply (via `repliesToMessageId`), they receive a notification similar to mention notifications, but as a **separate system** from mentions.

**Key Design Decision**: Replies are MESSAGE RELATIONSHIPS, not text-based mentions. Therefore, they should be implemented as a separate system that shares UI components but not data layer infrastructure.

---

## Architecture Analysis

### Why Separate from Mentions?

**Analysis Report**: "Feature analyzer" agent identified critical issues with reusing mention infrastructure:

1. **Semantic Mismatch**: Mentions are TEXT-BASED (`@user` parsing), replies are RELATIONSHIP-BASED (parent-child messages)
2. **Performance**: Original plan would require DB lookup on every reply submission (~2x latency)
3. **Coupling**: Shared cache invalidation causes unnecessary re-renders
4. **Maintainability**: Mixed concerns make debugging harder

**Verdict**: Implement as separate system with independent hooks, queries, and cache keys.

---

## Data Model

### Message Type Update

```typescript
// src/api/quorumApi.ts
export type Message = {
  // ... existing fields
  repliesToMessageId?: string;  // ✅ Already exists
  replyMetadata?: {              // NEW: Store reply context at creation time
    parentAuthor: string;        // Author of replied-to message
    parentChannelId: string;     // Channel of parent (for cross-channel support)
  };
};
```

**Why `replyMetadata`?**
- Avoids database lookup on every reply submission
- Parent message is already in UI context when user clicks "Reply"
- Data is available at message creation time

### Notification Type Update

```typescript
// src/types/notifications.ts
// Rename MentionTypeId to NotificationTypeId
export type NotificationTypeId =
  | 'mention-you'
  | 'mention-everyone'
  | 'mention-roles'
  | 'reply';

export interface NotificationSettings {
  spaceId: string;
  enabledNotificationTypes: NotificationTypeId[]; // Renamed from enabledMentionTypes
}

export interface ReplyNotification {
  message: Message;
  channelId: string;
  channelName: string;
  type: 'reply';
}
```

---

## Implementation Plan

### Phase 1: Data Model (1 file)

**File**: `src/api/quorumApi.ts`

- [ ] Add `replyMetadata` field to `Message` type
- [ ] Update `NotificationTypeId` to include `'reply'`

**Lines**: ~113, ~210

---

### Phase 2: Message Creation (1 file)

**File**: `src/services/MessageService.ts`

**Location**: `submitChannelMessage()` method (~line 2161)

- [ ] When `inReplyToMessageId` exists, populate `replyMetadata`
- [ ] Parent message is **already in UI context** (no DB lookup needed)
- [ ] Handle edge cases:
  - If `parentAuthor === currentUserAddress`: Don't create notification (self-reply)
  - If `parentMessage` not found: Set `replyMetadata: undefined`

**Implementation**:
```typescript
const message = {
  // ... existing fields
  repliesToMessageId: inReplyToMessageId,
  replyMetadata: inReplyToMessageId && parentMessage ? {
    parentAuthor: parentMessage.content.senderId,
    parentChannelId: channelId,
  } : undefined,
};
```

**Cache Invalidation** (after message submission):
```typescript
if (message.replyMetadata) {
  queryClient.invalidateQueries({ queryKey: ['reply-counts', 'channel', spaceId] });
  queryClient.invalidateQueries({ queryKey: ['reply-notifications', spaceId] });
}
```

---

### Phase 3: Database Layer (1 file)

**File**: `src/db/messages.ts`

**Location**: After `getUnreadMentions()` method (~line 1380)

- [ ] Add `getUnreadReplies()` method
- [ ] Use cursor-based filtering (same pattern as `getUnreadMentions`)
- [ ] Support early-exit optimization with `limit` parameter (default: 10)

**Signature**:
```typescript
async getUnreadReplies({
  spaceId,
  channelId,
  userAddress,
  afterTimestamp,
  limit = 10,
}: {
  spaceId: string;
  channelId: string;
  userAddress: string;
  afterTimestamp: number;
  limit?: number;
}): Promise<Message[]>
```

**Implementation Notes**:
- Use existing `by_conversation_time` index
- Filter messages where `message.replyMetadata?.parentAuthor === userAddress`
- Early-exit when `messages.length >= limit` (performance optimization)

---

### Phase 4: Reply Notification Hooks (2 NEW files)

#### File 1: `src/hooks/business/replies/useReplyNotificationCounts.ts`

**Purpose**: Calculate unread reply notification counts per channel

**Query Key**: `['reply-counts', 'channel', spaceId, userAddress, ...channelIds]`

**Stale Time**: 30 seconds (matches mention system)

**Features**:
- Early-exit at `DISPLAY_THRESHOLD = 10` (UI shows "9+")
- Uses `getUnreadReplies()` with limit parameter
- Returns `{ [channelId]: count }`

**Dependencies**:
- `usePasskeysContext()` for user address
- `useMessageDB()` for database access
- `@tanstack/react-query` for caching

#### File 2: `src/hooks/business/replies/useAllReplies.ts`

**Purpose**: Fetch all unread reply notifications across channels

**Query Key**: `['reply-notifications', spaceId, userAddress, ...channelIds]`

**Returns**: `{ replies: ReplyNotification[], isLoading: boolean }`

**Features**:
- Fetches from all channels in space
- Sorts by date (newest first)
- Includes channel name metadata
- Respects `lastReadTimestamp` for read tracking

---

### Phase 5: UI Components (3 files)

#### File 1: `src/components/notifications/NotificationPanel.tsx`

**Changes**:
- [ ] Import `useAllReplies` hook
- [ ] Fetch both mentions AND replies
- [ ] Combine into single `notifications` array sorted by date
- [ ] Add "Replies" filter option to `filterOptions`
- [ ] Update default state: `['mention-you', 'mention-everyone', 'reply']`

**Filter Logic**:
```typescript
const notifications = [
  ...mentions.map(m => ({ ...m, type: 'mention' as const })),
  ...(selectedTypes.includes('reply') ? replies.map(r => ({ ...r, type: 'reply' as const })) : []),
].sort((a, b) => b.message.createdDate - a.message.createdDate);
```

**Lines**: ~40, ~53-67

#### File 2: `src/components/notifications/NotificationItem.tsx`

**Changes**:
- [ ] Handle `type: 'reply'` notifications
- [ ] Display reply icon (e.g., `<Icon name="reply" />`)
- [ ] Message preview shows: "replied to your message"

**Lines**: ~199-209

#### File 3: `src/components/space/ChannelItem.tsx`

**Changes**:
- [ ] Import `useReplyNotificationCounts` hook
- [ ] Combine mention counts + reply counts for bubble display
- [ ] Show combined total in notification bubble

**Implementation**:
```typescript
const mentionCounts = useChannelMentionCounts({ spaceId, channelIds });
const replyCounts = useReplyNotificationCounts({ spaceId, channelIds });
const totalCount = (mentionCounts[channelId] || 0) + (replyCounts[channelId] || 0);
```

**Lines**: ~118-125

---

### Phase 6: Settings Integration (2 files)

#### File 1: `src/types/notifications.ts`

**Changes**:
- [ ] Rename `MentionTypeId` → `NotificationTypeId`
- [ ] Rename `MentionNotificationSettings` → `NotificationSettings`
- [ ] Update `enabledMentionTypes` → `enabledNotificationTypes`

**Lines**: 14, 20, 25

#### File 2: `src/components/modals/SpaceSettingsModal/Account.tsx`

**Changes**:
- [ ] Add "Replies" option to Select component
- [ ] Update prop types to use `NotificationTypeId`

**New Option**:
```typescript
{
  value: 'reply',
  label: t`Replies`,
  subtitle: t`When someone replies to your message`,
}
```

**Lines**: ~185-202

---

### Phase 7: Settings Utilities (1 file)

**File**: `src/utils/notificationSettingsUtils.ts`

**Changes**:
- [ ] Update `getDefaultMentionSettings()` to include `'reply'`
- [ ] Rename function to `getDefaultNotificationSettings()`
- [ ] Default: `['mention-you', 'mention-everyone', 'mention-roles', 'reply']`

**Lines**: 22-29

---

## Files Modified Summary

### New Files (2)
1. ✨ `src/hooks/business/replies/useReplyNotificationCounts.ts`
2. ✨ `src/hooks/business/replies/useAllReplies.ts`

### Modified Files (8)
3. `src/api/quorumApi.ts` - Add `replyMetadata` to Message type
4. `src/types/notifications.ts` - Rename types, add `'reply'`
5. `src/services/MessageService.ts` - Populate `replyMetadata` + cache invalidation
6. `src/db/messages.ts` - Add `getUnreadReplies()` method
7. `src/components/notifications/NotificationPanel.tsx` - Integrate reply notifications
8. `src/components/notifications/NotificationItem.tsx` - Display reply notifications
9. `src/components/space/ChannelItem.tsx` - Combine mention + reply counts
10. `src/components/modals/SpaceSettingsModal/Account.tsx` - Add reply settings toggle

---

## Edge Cases & Error Handling

### 1. Self-Replies
**Scenario**: User replies to their own message

**Handling**:
```typescript
if (parentMessage.content.senderId === currentUserAddress) {
  // Don't populate replyMetadata - no notification needed
  replyMetadata = undefined;
}
```

**Location**: `MessageService.submitChannelMessage()`

---

### 2. Deleted Parent Message
**Scenario**: Original message is deleted before reply is created

**Handling**:
```typescript
if (!parentMessage) {
  // Graceful degradation - no notification
  replyMetadata = undefined;
}
```

**Location**: `MessageService.submitChannelMessage()`

---

### 3. High Reply Volume
**Scenario**: Popular message receives 100+ replies

**Handling**:
- Early-exit at `DISPLAY_THRESHOLD = 10` in count hooks
- UI shows "9+" for counts > 9 (same as mentions)
- Database query stops at limit (no unnecessary scanning)

**Location**: `useReplyNotificationCounts.ts`, `getUnreadReplies()`

---

### 4. Cross-Channel Replies (Future)
**Scenario**: Reply to message from different channel

**Current Handling**: `parentChannelId` stored in `replyMetadata` for future use

**Future Enhancement**:
- Check permissions (can user see parent channel?)
- Display cross-channel indicator in UI
- Filter by channel in notification panel

---

### 5. Missing Parent Context
**Scenario**: UI doesn't have parent message when creating reply

**Handling**: Fail gracefully with `replyMetadata = undefined`

**Note**: This should be rare - reply buttons have message context

---

## Performance Characteristics

### Write Path (Message Creation)
**Original Plan**: ~100-150ms (50ms create + 50-100ms DB lookup)
**This Plan**: ~50ms (no DB lookup, data from UI context)
**Improvement**: **2-3x faster** ✅

### Read Path (Count Calculation)
**Per Channel**: ~50ms (cursor-based filtering with early-exit)
**20 Channels**: ~200ms total (parallelizable)
**Performance**: Same as mention system (reuses patterns)

### Cache Efficiency
**Independent Cache Keys**:
- Reply counts: `['reply-counts', ...]`
- Mention counts: `['mention-counts', ...]`
- **No coupling**: Updating one doesn't invalidate the other ✅

---

## Testing Checklist

### Basic Functionality
- [ ] User A posts message
- [ ] User B replies to User A's message
- [ ] User A receives reply notification
- [ ] Notification count appears in channel bubble
- [ ] Notification appears in NotificationPanel

### Filtering
- [ ] "Replies" filter in NotificationPanel works
- [ ] Filtering out replies removes them from list
- [ ] Combining with mention filters works correctly

### Settings
- [ ] Reply toggle in SpaceSettingsModal/Account.tsx
- [ ] Disabling replies prevents notifications
- [ ] Settings persist across sessions (IndexedDB)
- [ ] Settings sync across devices (if allowSync enabled)

### Actions
- [ ] "Mark all as read" clears reply notifications
- [ ] Clicking reply notification navigates to message
- [ ] Message is highlighted for 6 seconds
- [ ] Opening channel marks replies as read

### Edge Cases
- [ ] Self-replies don't create notifications
- [ ] Deleted parent message doesn't break system
- [ ] 100+ replies to single message performs well
- [ ] Missing parent context handled gracefully

### Performance
- [ ] No DB lookups during message submission
- [ ] Reply count queries complete in <100ms per channel
- [ ] Cache invalidation doesn't affect mention queries
- [ ] Early-exit optimization works (stops at 10)

---

## Integration with Existing Systems

### Mention Notification System
**Relationship**: Separate but parallel system

**Shared**:
- UI components (NotificationPanel, NotificationItem)
- Read tracking (`lastReadTimestamp`)
- Settings storage pattern (IndexedDB `user_config`)
- React Query patterns (staleTime, refetch on focus)

**Independent**:
- Data model (`replyMetadata` vs. `mentions`)
- Database queries (`getUnreadReplies` vs. `getUnreadMentions`)
- Cache keys (`reply-counts` vs. `mention-counts`)
- Hooks (`useReplyNotificationCounts` vs. `useChannelMentionCounts`)

---

### Read Tracking System
**Reuses**: Existing `conversations.lastReadTimestamp` in IndexedDB

**Flow**:
```
User opens channel
  ↓
useConversation() fetches lastReadTimestamp
  ↓
getUnreadReplies() filters messages > lastReadTimestamp
  ↓
User views messages for 2s (debounce)
  ↓
useUpdateReadTime() saves new timestamp
  ↓
React Query invalidates reply-counts cache
  ↓
Bubble updates automatically
```

**Integration Point**: `src/hooks/business/conversations/useUpdateReadTime.ts`

**Cache Invalidation** (add to existing):
```typescript
queryClient.invalidateQueries({ queryKey: ['reply-counts', 'channel', spaceId] });
queryClient.invalidateQueries({ queryKey: ['reply-notifications', spaceId] });
```

---

### Message Service
**Integration**: Populate `replyMetadata` during message creation

**Existing Flow**:
```
User submits message
  ↓
MessageService.submitChannelMessage()
  ↓
Extract mentions from text
  ↓
Save message to database
  ↓
Invalidate caches
```

**Updated Flow**:
```
User submits message
  ↓
MessageService.submitChannelMessage()
  ↓
Extract mentions from text
  ↓
Populate replyMetadata (if reply) ← NEW
  ↓
Save message to database
  ↓
Invalidate caches (mentions + replies) ← UPDATED
```

---

## Documentation Updates

### Files to Update
1. `.agents/docs/features/mention-notification-system.md`
   - Add "Reply Notifications" section
   - Document separation from mention system
   - Update architecture diagrams

2. `.agents/AGENTS.md`
   - Add reply notification hooks to reference
   - Update notification panel documentation

3. `CLAUDE.md` (root)
   - Add reply notification system to features list

---

## Future Enhancements

### Phase 2: Advanced Features

1. **Thread View**
   - Display full reply thread in notification panel
   - Navigate to parent message, not just reply
   - Show reply chain context

2. **Cross-Channel Replies**
   - Support replying to messages from different channels
   - Permission checks (can user see parent channel?)
   - UI indicator for cross-channel replies

3. **Bulk Reply Management**
   - "Mark thread as read" (all replies in thread)
   - Group replies by parent message
   - Collapse/expand reply threads

4. **Reply Analytics**
   - Track most-replied messages
   - Show reply count on original message
   - "X replies" indicator in message UI

---

## Success Criteria

✅ **Functional**:
- Users receive notifications when messages are replied to
- Notifications appear in same panel as mentions
- Settings toggle works per-space
- Mark as read clears reply notifications

✅ **Performance**:
- No database lookups on message submission
- Reply count queries complete in <100ms per channel
- System scales to 100+ replies per message

✅ **Architecture**:
- Separate system from mentions (independent caching)
- Clean separation of concerns
- Follows existing patterns (React Query, IndexedDB)

✅ **UX**:
- Seamless integration with existing notification UI
- Clear distinction between mentions and replies
- No confusion with mention system

---

## Related Documentation

- **[Mention Notification System](../docs/features/mention-notification-system.md)** - Base notification system
- **[Data Management Architecture](../docs/data-management-architecture-guide.md)** - React Query patterns
- **[Cross-Platform Architecture](../docs/cross-platform-repository-implementation.md)** - Component structure

---

## Analysis Reference

**Feature Analyzer Report**: Identified critical issues with original plan
- Over-engineering: Reusing mention infrastructure
- Performance: DB lookups on write path
- Architecture: Semantic mismatch between mentions and replies
- Recommendation: Separate system (this implementation)

**Verdict**: **4.8/10** for original plan → **Revised to 8.5/10** with separate architecture

---

*Last updated: 2025-10-16*
