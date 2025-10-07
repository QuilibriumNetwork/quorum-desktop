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

## Implementation Plan (Simplified per Lead Dev)

### Step 1: Investigate Current Read Status System
**Goal**: Understand if/how message read status is currently tracked

**Tasks**:
- Search codebase for existing read status tracking
- Check MessageDB for read/unread properties
- Document current implementation (if any)
- Determine if we need to implement read status from scratch

### Step 2: Add `isMention` Property to Message
**Goal**: Add boolean flag to messages that mention current user

**Components to modify**:
- `src/types/` - Add `isMention?: boolean` to Message interface
- Message creation/processing logic - Set `isMention` when message contains mention
- Use existing `isMentioned()` function from `useMessageFormatting.ts` to determine value

### Step 3: Database Indexing
**Goal**: Optimize queries for mention counts

**Tasks**:
- Add database index on `isMention` field in messages table
- Verify/add index on `channel` field in messages table (if not existing)
- Test query performance with indexes

### Step 4: Create Mention Count Hook
**Goal**: Query unread mention counts per channel

**Components to create**:
- `src/hooks/business/mentions/useChannelMentionCounts.ts`

**Logic**:
1. Use channel index to filter messages by channel
2. Filter by `isMention === true`
3. Filter by unread status (using read status system from Step 1)
4. Return counts per channel
5. Leverage database indexes for performance

### Step 5: Create Read Status Update Hook
**Goal**: Mark messages as read

**Components to create**:
- Hook to update message read status by space/channel/message IDs
- Integrate into message viewing flow

### Step 6: Integration
**Goal**: Wire everything together

**Tasks**:
- On page load: Run mention count hook to populate initial counts
- On new message: Update mention counts in real-time
- On channel view: Mark messages as read and update counts
- Populate `mentionCount` property on channel objects for UI

## Technical Considerations

### Performance
- **Database Indexes**: Use indexes on `isMention` and `channel` fields for fast queries
- **Efficient Queries**: Let database handle filtering instead of scanning all messages
- **Index Verification**: Ensure indexes exist before implementation

### Data Consistency
- **Race Conditions**: Handle concurrent message arrivals and read state updates
- **Message Processing**: Set `isMention` flag during message creation/receipt
- **Read Status Sync**: Investigate how read status currently works (unknown)

### Testing Strategy
- **Unit Tests**: Test mention counting logic with various message patterns
- **Integration Tests**: Test end-to-end flow from message to UI bubble
- **Edge Cases**: Multiple mentions, rapid message arrival, large histories
- **Performance Tests**: Test with channels containing thousands of messages

## File Structure

```
src/
├── types/
│   └── message.ts                     # Modify - Add isMention property
├── hooks/business/mentions/
│   ├── useChannelMentionCounts.ts     # New - Query mention counts via indexes
│   ├── useMessageReadStatus.ts        # New - Update read status
│   └── useMentionInput.ts             # Existing - Mention input handling
├── db/
│   └── MessageDB.ts                   # Modify - Add indexes for isMention and channel
└── components/space/
    ├── ChannelGroup.tsx               # Existing - Already renders bubbles
    └── ChannelGroup.scss              # Existing - Already styled
```

## Dependencies Analysis

### Existing Dependencies to Leverage
- `useMessageFormatting.ts` - Already has `isMentioned()` function for detection
- `MessageDB` - Message storage, querying, and indexing
- `useSpace()` - Space/channel data fetching
- WebSocket providers - Real-time message handling

### Database Indexing
- Use MessageDB's existing indexing capabilities
- No additional libraries needed - leverage built-in database indexes

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
- **Read Status Unknown**: Need to investigate if read status tracking exists
- **Data Migration**: Existing messages need `isMention` field populated

### Medium Risk
- **Index Performance**: Need to test query performance with indexes
- **WebSocket Integration**: Ensuring real-time updates work reliably

### Low Risk
- **UI Integration**: Components and styling already exist
- **Message Format**: Mention format is well-established
- **Database Capability**: MessageDB supports indexing

## Next Steps

1. **Investigate Read Status** (CRITICAL - UNKNOWN): Search codebase for existing read/unread tracking
2. **Review MessageDB**: Understand indexing capabilities and message schema
3. **Add `isMention` Property**: Update Message type and processing logic
4. **Implement Indexes**: Add database indexes for `isMention` and `channel`
5. **Create Hooks**: Build `useChannelMentionCounts` and `useMessageReadStatus`
6. **Integration**: Wire hooks into page load and real-time flows
7. **Testing**: Test with realistic message volumes and verify index performance



---

*Task created: 2025-09-24*
*Updated: 2025-10-05 - Simplified per lead dev's approach*
*Analysis conducted via Claude Code - requires manual verification*