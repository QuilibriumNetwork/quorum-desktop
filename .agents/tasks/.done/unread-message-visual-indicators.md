---
type: task
title: Unread Message Visual Indicators Implementation
status: done
complexity: medium
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Unread Message Visual Indicators Implementation


**Priority**: High

**Estimated Time**: 4-6 hours

## Overview

Implement Discord-style unread message indicators that show when there are new messages (not just mentions) in spaces and channels. Both spaces and channels should show a colored dot indicator (not bold text) for unread messages. The visual infrastructure already exists - we just need to implement the hooks that count unread messages and wire them into the existing UI components.

**Visual Requirements:**

- **Spaces**: Show colored dot (accent color) to the left of space icon when unread messages exist
- **Channels**: Show colored dot (NOT bold text) next to channel name when unread messages exist
- **Direct Messages**: Already implemented for individual DMs, just need aggregated count for NavMenu icon

## Background

The current system has a robust mention/reply notification system but lacks general "unread messages" indicators. Users want to see when there are new messages in a space or channel, regardless of whether those messages contain mentions.

### Current State Analysis

✅ **Already Implemented:**

- `SpaceIcon` component supports `notifs` prop with visual dot indicator (`.space-icon-has-notifs-toggle`)
- `ChannelItem` component supports `unreads` prop (currently shows bold text, needs dot styling)
- `lastReadTimestamp` tracking infrastructure in conversations
- Database queries for efficient unread message counting
- Message read-time tracking via `useUpdateReadTime` hook
- **Direct Messages unread logic**: Individual DM conversations already show unread dots using `(c.lastReadTimestamp ?? 0) < c.timestamp`

❌ **Missing:**

- Hooks to count unread messages (non-mention/reply) for spaces and channels
- Data flow to populate `space.notifs` and `channel.unreads` properties
- Dot styling for channels (currently uses bold text, needs to match space dots)
- Aggregated DM unread count for NavMenu Direct Messages icon

## Technical Requirements

### New Hooks to Create

1. **`useSpaceUnreadCounts`** - Similar to `useSpaceMentionCounts`
   - Location: `src/hooks/business/messages/useSpaceUnreadCounts.ts`
   - Query key: `['unread-counts', 'space', userAddress, ...spaceIds]`
   - Returns: `Record<string, number>` (spaceId → unread count)

2. **`useChannelUnreadCounts`** - Similar to `useChannelMentionCounts`
   - Location: `src/hooks/business/messages/useChannelUnreadCounts.ts`
   - Query key: `['unread-counts', 'channel', spaceId, userAddress, ...channelIds]`
   - Returns: `Record<string, number>` (channelId → unread count)

3. **`useDirectMessageUnreadCount`** - Aggregate DM unread count for NavMenu
   - Location: `src/hooks/business/messages/useDirectMessageUnreadCount.ts`
   - Leverages existing `useConversations` and unread logic: `(c.lastReadTimestamp ?? 0) < c.timestamp`
   - Query key: `['unread-counts', 'direct-messages', userAddress]`
   - Returns: `number` (total unread DM conversations)

### Database Methods (Optimization Strategy)

**Preferred Approach**: Create optimized database method for performance:

```typescript
// New method in src/db/messages.ts
async hasUnreadMessages({ spaceId, channelId, afterTimestamp }): Promise<boolean> {
  // Use IndexedDB cursor to find first message where createdDate > afterTimestamp
  // Return immediately when found (no need to count all)
  // Much faster than getMessages() + filtering for large channels
}
```

**Fallback**: If database optimization is complex, use existing `getMessages` with `limit: 1` and filter client-side.

### Integration Points

**NavMenu (`src/components/navbar/NavMenu.tsx:91-102`)**:

```typescript
const spaceUnreadCounts = useSpaceUnreadCounts({ spaces: mappedSpaces });

{mappedSpaces.map((space) => {
  const unreadCount = spaceUnreadCounts[space.spaceId] || 0;
  return (
    <SpaceButton
      key={space.spaceId}
      space={{ ...space, notifs: unreadCount }} // Populate notifs
      mentionCount={mentionCount + replyCount}
    />
  );
})}
```

**Direct Messages (`src/components/navbar/NavMenu.tsx:71-79`)**:

```typescript
// Use new hook to aggregate DM unread count
const dmUnreadCount = useDirectMessageUnreadCount();

<SpaceIcon
  notifs={dmUnreadCount > 0} // Change from hardcoded false
  size="regular"
  selected={location.pathname.startsWith('/messages')}
  spaceName={t`Direct Messages`}
  iconUrl="/quorum-symbol-bg-blue.png"
  spaceId="direct-messages"
  highlightedTooltip={true}
/>
```

**ChannelList (`src/components/space/ChannelList.tsx:67-80`)**:

```typescript
const unreadCounts = useChannelUnreadCounts({ spaceId, channelIds });

channels: group.channels.map((channel) => ({
  ...channel,
  unreads: unreadCounts[channel.channelId] || 0, // Populate unreads
  mentionCount: mentions + replies,
}));
```

**Channel Styling Update**: Need to modify ChannelItem to show dot instead of bold text for unreads.

## Design Decisions

### 1. Relationship to Existing Notification System

**Approach**: **Separate but Complementary**

- Unread indicators are **independent** from mention/reply notifications
- Different purpose: General awareness vs specific notifications
- Different visual treatment: Dots vs numbered badges
- Different cache keys to avoid conflicts with mention system

**Cache Key Strategy**:

```
Mentions: ['mention-counts', ...]
Replies:  ['reply-counts', ...]
Unreads:  ['unread-counts', ...]  (NEW)
```

### 2. Performance Considerations

**Early Exit Threshold**: Stop counting at 1 (we only need boolean indicator)

- Unlike mentions which show counts, unreads are binary (read/unread)
- Massive performance improvement for large channels
- UI only needs to know "has unreads" vs exact count

**Stale Time**: Use 60-90 seconds like mention system

- Balances real-time updates with performance
- Refetches on window focus for immediate updates

### 3. Read State Logic

**Channel Read Logic**: Use existing `lastReadTimestamp` from conversations

- Message is unread if: `message.createdDate > conversation.lastReadTimestamp`
- Leverage existing read-time tracking (no new infrastructure needed)

**Space Read Logic**: Space has unreads if ANY channel in space has unreads

- Aggregate across all channels in space
- Early exit when first unread channel found

### 4. Integration with Existing System

**No Conflicts**: Designed to work alongside mention system

- Separate React Query caches
- Independent invalidation patterns
- Additive changes to existing components (no breaking changes)

**Invalidation**: Reuse existing read-time invalidation

- `useUpdateReadTime` already invalidates conversation cache
- Add unread-counts cache to existing invalidation list
- Ensures consistent state across all notification types

## Implementation Plan

### Phase 1: Create Unread Count Hooks (2-3 hours)

1. **Create `useChannelUnreadCounts.ts`**
   - Model after `useChannelMentionCounts.ts`
   - Query messages where `createdDate > lastReadTimestamp`
   - Early exit at count = 1 (boolean indicator)
   - Return `{ [channelId]: hasUnreads ? 1 : 0 }`

2. **Create `useSpaceUnreadCounts.ts`**
   - Model after `useSpaceMentionCounts.ts`
   - Aggregate unread status across all channels in space
   - Early exit when first unread channel found
   - Return `{ [spaceId]: hasUnreads ? 1 : 0 }`

3. **Add to hooks index exports**
   - `src/hooks/business/messages/index.ts`
   - `src/hooks/index.ts`

### Phase 2: Wire Into UI Components (1-2 hours)

1. **Update NavMenu.tsx**
   - Import `useSpaceUnreadCounts`
   - Pass unread count to `space.notifs` property
   - Test space icon dot indicators appear

2. **Update ChannelList.tsx**
   - Import `useChannelUnreadCounts`
   - Pass unread count to `channel.unreads` property
   - Test channel bold text styling appears

3. **Add Direct Messages Support (Phase 2.5)**
   - Create `useDirectMessageUnreadCount` hook
   - Count unread DM conversations using existing `(c.lastReadTimestamp ?? 0) < c.timestamp` logic
   - Update NavMenu Direct Messages icon to use aggregated count

4. **Update Channel Visual Styling (Phase 2.6)**
   - Modify ChannelItem component to show dot instead of bold text for unreads
   - Ensure consistent dot styling across spaces, channels, and DMs

### Phase 3: Update Cache Invalidation (1-2 hours)

1. **Update `useUpdateReadTime.ts`**
   - Add unread-counts cache to invalidation list
   - Ensures unreads clear when channel is read

2. **Update `MessageService.ts`**
   - Invalidate unread-counts when new messages arrive
   - Ensures unreads appear immediately for new messages

3. **Test invalidation scenarios**
   - Reading channel clears unreads
   - New messages show unreads immediately

### Phase 4: Testing & Edge Cases (1 hour)

1. **Test Scenarios**
   - New message arrives → indicators appear
   - User reads channel → indicators disappear
   - Multiple channels with unreads
   - Large channels with many messages
   - Cross-device sync behavior

2. **Performance Validation**
   - Verify early-exit works (check query times)
   - Confirm no regression in mention system
   - Test with React Query DevTools

## Files to Create

```
src/hooks/business/messages/useChannelUnreadCounts.ts    (NEW)
src/hooks/business/messages/useSpaceUnreadCounts.ts      (NEW)
src/hooks/business/messages/useDirectMessageUnreadCount.ts (NEW)
src/db/messages.ts                                       (Add hasUnreadMessages method)
```

## Files to Modify

```
src/components/navbar/NavMenu.tsx                      (Wire space + DM unreads)
src/components/space/ChannelList.tsx                   (Wire channel unreads)
src/components/space/ChannelItem.tsx                   (Update styling: dot instead of bold)
src/hooks/business/conversations/useUpdateReadTime.ts  (Add cache invalidation)
src/services/MessageService.ts                         (Add cache invalidation)
src/hooks/business/messages/index.ts                   (Export new hooks)
src/hooks/index.ts                                     (Export new hooks)
```

## Success Criteria

- [ ] Space icons show colored dot when space has unread messages
- [ ] Channel names show colored dot (not bold text) when channel has unread messages
- [ ] Direct Messages icon shows dot when DM conversations have unreads
- [ ] Indicators disappear after reading the channel (2s debounce)
- [ ] New messages immediately show unread indicators
- [ ] Performance remains good (queries <100ms for large channels)
- [ ] No conflicts with existing mention/reply system
- [ ] Cross-device sync works (indicators sync across devices)
- [ ] Error states handled gracefully (fallback to no indicators)

## Notes

### Alignment with Mention System

This implementation follows the same patterns as the existing mention notification system:

- Similar hook structure and naming conventions
- Same caching and invalidation strategies
- Compatible query key patterns for independent operation
- Leverages existing read-time tracking infrastructure

### TypeScript Considerations

The `Space` interface in `SpaceButton.tsx` already includes `notifs?: number`, and `ChannelItem.tsx` already supports `unreads?: number`. No type definitions need to be changed.

### Mobile Compatibility

The visual indicators (`.space-icon-has-notifs-toggle` for spaces) include mobile-responsive CSS. The hooks will work identically on mobile since they're platform-agnostic. Channel styling will need to be updated from bold text to dot indicators to match the space styling pattern.

### Error Handling & Robustness

**Database Failures**: Hooks should gracefully degrade to empty counts if database queries fail
**Network Issues**: React Query's built-in retry and error handling will manage temporary failures
**Performance**: Early-exit optimization ensures large channels don't cause UI lag
**Race Conditions**: React Query's deduplication prevents multiple simultaneous queries

---

**Related Files:**

- [Mention Notification System Documentation](../docs/features/mention-notification-system.md)
- [Space Icon Mention Bubbles Task](../tasks/.done/space-icon-mention-bubbles.md)
- [Reply Notification System Task](../tasks/.done/reply-notification-system.md)
