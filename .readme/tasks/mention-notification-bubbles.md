# Implement Mention Notification Bubbles

Added to GitHub Issues: https://github.com/QuilibriumNetwork/quorum-desktop/issues/76

## Overview
Implement the backend logic to populate channel mention counts and enable notification bubbles in the sidebar when users are mentioned in channels.

**Note:** This analysis was conducted via Claude Code and could be incorrect. Manual verification and testing are required before implementation.

## Current State Analysis

### What Exists ✅
- **UI Components**: `ChannelGroup.tsx` renders mention bubbles when `mentionCount > 0`
- **Styling**: Complete CSS for `.channel-group-channel-name-mentions-you` and `.channel-group-channel-name-mentions-role`
- **Data Types**: Channel interface includes `mentionCount?: number` and `mentions?: string` properties
- **Message Mention Detection**: `useMessageFormatting.ts` has `isMentioned()` function
- **Mention Format**: Users mention with `@<address>` format (e.g., `@<QmV5xWMo5CYSxgAAy6emKFZZPCPKwCsBZKZxXD3mCUZF2n>`)

### What's Missing ❌
- **Backend counting logic** to calculate mention counts per channel
- **Read state tracking** to determine which mentions are "unread"
- **Data population** of `mentionCount` and `mentions` properties on channel objects
- **Real-time updates** when new messages with mentions arrive

## Architecture Analysis

### Current Data Flow
1. `useSpace()` → `buildSpaceFetcher()` → `MessageDB.getSpace(spaceId)`
2. Space data contains `groups[].channels[]` structure
3. Channels have empty `mentionCount`/`mentions` properties
4. UI components expect these properties to be populated

### Message Storage
- Messages stored with `mentions.memberIds[]` containing user addresses
- `useMessageFormatting.ts:68` checks if user is mentioned: `message.mentions?.memberIds.includes(userAddress)`

## Implementation Plan

### Phase 1: Read State Tracking
**Goal**: Track when user last viewed each channel

**Components to create/modify**:
- `src/hooks/business/channels/useChannelReadState.ts` - Track read timestamps per channel
- `src/services/readStateService.ts` - Persist read state to localStorage/IndexedDB
- Integrate with channel navigation to update read timestamps

**Data Structure**:
```typescript
interface ChannelReadState {
  [channelId: string]: {
    lastReadTimestamp: number;
    lastReadMessageId?: string;
  };
}
```

### Phase 2: Mention Counting Logic
**Goal**: Count unread mentions per channel for current user

**Components to create**:
- `src/hooks/business/mentions/useChannelMentionCounts.ts`
- `src/services/mentionCountingService.ts`

**Logic**:
1. For each channel, scan messages newer than `lastReadTimestamp`
2. Use existing `isMentioned()` function to detect mentions
3. Count mentions and categorize as "you" vs "role"
4. Return counts per channel

**Performance Considerations**:
- Cache mention counts to avoid recalculating on every render
- Use message indexes if available for efficient querying
- Consider pagination for channels with large message histories

### Phase 3: Data Integration
**Goal**: Populate channel objects with mention counts

**Components to modify**:
- Enhance space data fetching to include calculated mention counts
- Update `MessageDB.getSpace()` or create wrapper function
- Ensure mention counts are included in space data returned to components

**Integration Points**:
- `buildSpaceFetcher()` - Add mention count calculation
- Space data transformation layer
- Real-time WebSocket message handling

### Phase 4: Real-time Updates
**Goal**: Update mention counts when new messages arrive

**Components to modify**:
- WebSocket message handlers
- Message processing pipeline
- Space data cache invalidation

**Flow**:
1. New message arrives via WebSocket
2. Check if message mentions current user
3. Update mention counts for affected channel
4. Trigger UI refresh

## Technical Considerations

### Performance
- **Indexing**: Consider message indexing by mentions for faster queries
- **Caching**: Cache mention counts and invalidate strategically
- **Batching**: Batch mention count calculations for multiple channels
- **Lazy Loading**: Only calculate counts for visible channels initially

### Data Consistency
- **Race Conditions**: Handle concurrent message arrivals and read state updates
- **Offline/Online**: Sync mention counts when coming back online
- **Message Ordering**: Ensure proper timestamp-based filtering

### Testing Strategy
- **Unit Tests**: Test mention counting logic with various message patterns
- **Integration Tests**: Test end-to-end flow from message to UI bubble
- **Edge Cases**: Multiple mentions, rapid message arrival, large histories
- **Performance Tests**: Test with channels containing thousands of messages

## File Structure

```
src/
├── hooks/business/mentions/
│   ├── useChannelMentionCounts.ts     # New - Main mention counting hook
│   └── useMentionInput.ts             # Existing - Mention input handling
├── hooks/business/channels/
│   └── useChannelReadState.ts         # New - Read state tracking
├── services/
│   ├── mentionCountingService.ts      # New - Core counting logic
│   └── readStateService.ts            # New - Read state persistence
└── components/space/
    ├── ChannelGroup.tsx               # Existing - Already renders bubbles
    └── ChannelGroup.scss              # Existing - Already styled
```

## Dependencies Analysis

### Existing Dependencies to Leverage
- `useMessageFormatting.ts` - Already has mention detection logic
- `MessageDB` - Message storage and querying
- `useSpace()` - Space/channel data fetching
- WebSocket providers - Real-time message handling

### Potential New Dependencies
- Consider if any additional indexing/querying libraries are needed
- Evaluate if current message storage supports efficient mention queries

## Success Criteria

### Functional Requirements
- ✅ Mention bubbles appear next to channel names when user is mentioned
- ✅ Bubble shows correct count of unread mentions
- ✅ Bubbles disappear when user views the channel
- ✅ Real-time updates when new mentions arrive
- ✅ Proper distinction between personal and role mentions

### Performance Requirements
- ✅ Mention counts calculate efficiently for channels with large message histories
- ✅ UI remains responsive during mention count calculations
- ✅ Memory usage remains reasonable with mention count caching

### Cross-Platform Requirements
- ✅ Works on both web and mobile platforms
- ✅ Consistent behavior across Electron desktop and web browsers

## Risk Assessment

### High Risk
- **Performance Impact**: Scanning large message histories could be slow
- **Data Consistency**: Race conditions between message arrival and read state

### Medium Risk
- **Complex State Management**: Managing read state across multiple channels
- **WebSocket Integration**: Ensuring real-time updates work reliably

### Low Risk
- **UI Integration**: Components and styling already exist
- **Message Format**: Mention format is well-established

## Next Steps

1. **Review Existing Code**: Deep dive into `MessageDB`, `useSpace()`, and message handling
2. **Prototype Counting Logic**: Create basic mention counting function and test performance
3. **Design Read State System**: Determine best approach for persisting read timestamps
4. **Implementation Planning**: Break down into smaller, testable increments
5. **Performance Testing**: Test with realistic message volumes

---

*Task created: 2025-09-24*
*Analysis conducted via Claude Code - requires manual verification*