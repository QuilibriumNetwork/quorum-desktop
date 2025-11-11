# Bug: Auto-Jump to First Unread Message - Blocked by Virtuoso Scroll Positioning

**Status**: 🔴 Blocked - Feature Not Implementable with Current Architecture  
**Priority**: Medium (UX enhancement, not critical bug)  
**Type**: Feature Request / Technical Limitation  
**Component**: MessageList, Virtuoso, Message Loading  
**Affects**: Channel navigation UX  
**Created**: 2025-11-11  
**Last Updated**: 2025-11-11

---

## Summary

Multiple attempts to implement auto-jump to first unread message have failed due to fundamental conflicts with React Virtuoso's scroll positioning system. While the bidirectional message loading implementation works correctly, positioning the viewport at the first unread message after async data loads is not achievable with Virtuoso's current API.

---

## Desired Feature

When a user enters a channel with unread messages, automatically position the viewport at the **first** unread message (with context messages above) instead of always loading from the bottom.

### Expected Behavior

1. User B enters channel where User A posted 20 new messages
2. System loads ~40 messages before first unread + all unread messages (40-60 total)
3. Viewport positions at first unread message
4. User sees first unread with context above for scrolling up
5. User scrolls down to see remaining unreads

### Current Behavior

1. System loads 100 most recent messages from bottom
2. User lands at bottom of channel
3. User must manually scroll up to find first unread message

---

## Implementation History

### Attempt 1: WIP Commit a63f609f - Message Sync Bug

**Problem**: Initial implementation broke message synchronization. When User A posted multiple messages, User B only saw the first one, requiring multiple refreshes.

**Root Cause**: Attempted to set initial cursor to first unread timestamp, but `getMessages()` is designed for unidirectional pagination, not "jump to middle" behavior.

**Result**: Reverted due to critical functionality break.

**Reference**: `.agents/bugs/.archived/auto-jump-unread-breaks-message-sync.md`

### Attempt 2: Bidirectional Loading + Virtuoso Scroll (2025-11-11)

**Implementation**:

- ✅ Created `loadMessagesAround()` function - loads 40 before + 40 after target (desktop)
- ✅ Integrated with message fetcher for initial load
- ✅ Platform-aware limits (40/40 desktop, 25/25 mobile)
- ✅ Parallel query execution for performance
- ❌ Failed to position viewport at first unread

**5 Different Scroll Positioning Approaches Tried:**

1. **`initialTopMostItemIndex`** - Only works on component mount (before data loads)
2. **Conditional `alignToBottom`** - Viewport still went to bottom
3. **`scrollToIndex()` in useEffect** - Called successfully but had no effect
4. **Disable `followOutput`** - No observable change
5. **Force remount with key change** - Caused "messy behavior" per user

**Console Evidence**: All systems reported correct data loading and index calculations, but viewport was always at/near bottom.

**Result**: Reverted all changes after user confirmation that even hash navigation improvements caused issues.

---

## Technical Analysis

### What Works ✅

**Bidirectional Message Loading**:

```typescript
async function loadMessagesAround({
  messageDB,
  spaceId,
  channelId,
  targetTimestamp,
}) {
  const [olderMessages, newerMessages] = await Promise.all([
    messageDB.getMessages({
      cursor: targetTimestamp,
      direction: 'backward',
      limit: 40,
    }),
    messageDB.getMessages({
      cursor: targetTimestamp,
      direction: 'forward',
      limit: 40,
    }),
  ]);
  return { messages: [...olderMessages.messages, ...newerMessages.messages] };
}
```

- Loads messages around any target timestamp
- Works for both unreads and hash navigation
- Proper cursor management for pagination
- Confirmed working via console logs

**First Unread Detection**:

```typescript
const firstUnread = await messageDB.getFirstUnreadMessage({
  spaceId,
  channelId,
  afterTimestamp: lastReadTimestamp,
});
// Returns: { messageId: string, timestamp: number }
```

- Database method exists and works
- Correctly identifies first unread message
- Uses existing indexed queries

### What Doesn't Work ❌

**Virtuoso Scroll Positioning After Async Load**:

The core issue: Virtuoso's scroll positioning props (`initialTopMostItemIndex`) only work when the component **first mounts**. By the time async data loads, it's too late.

Attempts to scroll programmatically after data loads (`scrollToIndex()`) were either ignored or overridden by Virtuoso's internal state management.

### Root Cause

**Timing Mismatch**:

1. Virtuoso mounts → `initialTopMostItemIndex` applied (messageList is empty, defaults to bottom)
2. Data loads asynchronously → messageList updates with 55 messages
3. Component tries to reposition → Virtuoso ignores, already has internal scroll state

**Conflicting Props**: `alignToBottom`, `followOutput`, and `initialTopMostItemIndex` have complex interactions not fully documented. Disabling them individually or in combination didn't resolve the issue.

---

## Related Issues

### Hash Navigation Bug (Documented but Not Fixed)

**Issue**: Clicking links to old messages (pinned messages, search results, notifications) fails if message is older than the 100 most recent.

**Current Behavior**:

1. System loads 100 recent messages
2. Looks for target message ID in array
3. If not found → no scroll, user sees wrong content

**Example Failures**:

- Admin pins announcement from 2 weeks ago → link doesn't work
- Search for message from last month → click lands at bottom
- Active channels (>100 msgs/day) → almost guaranteed failure

**Why Not Fixed**: Attempted fix using bidirectional loading for hash navigation also caused issues and was reverted per user request.

**Current State**: Known limitation, hash navigation only works for messages within most recent 100.

---

## Current State

### Files Status

**src/hooks/queries/messages/buildMessagesFetcher.ts**:

```typescript
// Simple, clean baseline - loads 100 messages from bottom
const buildMessagesFetcher = ({ messageDB, spaceId, channelId }) =>
  wrapPaginatedFetcher(async ({ pageParam: cursor }) => {
    const response = await messageDB.getMessages({
      spaceId,
      channelId,
      cursor: cursor?.cursor,
      direction: cursor?.direction,
    });
    return response;
  });
```

**src/components/message/MessageList.tsx**:

- Original hash navigation code intact (works for recent messages)
- No scroll positioning modifications
- Stable, predictable behavior

**src/db/messages.ts**:

- `getFirstUnreadMessage()` method exists (from WIP commit)
- Not currently used but available for future attempts
- No harm in keeping it

### Behavior

✅ **Normal channel entry**: Loads 100 recent messages, positions at bottom  
✅ **Hash navigation**: Works if target message in recent 100  
✅ **No bugs**: Clean, stable, predictable  
⚠️ **No auto-jump**: Users must manually scroll to find unreads  
⚠️ **Hash limitation**: Old message links may not work

---

## Lessons Learned

### Technical Insights

1. **Virtuoso Design**: React Virtuoso is optimized for end-reached (bottom) or start-reached (top) patterns, not mid-list initial positioning with async data.

2. **Scroll Timing**: The gap between component mount and data load is incompatible with Virtuoso's initialization pattern.

3. **Working Pattern**: The existing hash navigation works because:
   - Messages load from bottom first
   - Hash scroll happens AFTER messages are in DOM
   - Uses `scrollToMessage()` which directly manipulates scroll position
   - Only works if message is already in loaded set

4. **Bidirectional Loading**: The implementation is technically sound and could be reused if the scroll positioning problem is solved.

### Attempted Solutions Summary

| Approach                    | Description                 | Result                         |
| --------------------------- | --------------------------- | ------------------------------ |
| `initialTopMostItemIndex`   | Set initial scroll position | ❌ Only works on mount         |
| Conditional `alignToBottom` | Disable bottom alignment    | ❌ Still scrolls to bottom     |
| `scrollToIndex()` useEffect | Scroll after data loads     | ❌ Calls succeed but no effect |
| Disable `followOutput`      | Prevent auto-follow         | ❌ No change                   |
| Remount with key            | Force re-mount              | ❌ Messy behavior              |

---

## Potential Future Approaches

### Option A: Different Virtualization Library

Consider alternatives to react-virtuoso:

- `react-window` - More low-level control over scroll
- `@tanstack/virtual` - Headless virtual, custom scroll logic
- Custom virtualization - Full control but complex

**Tradeoff**: Major refactor required, may introduce new issues.

### Option B: Load Strategy Change

Instead of bidirectional loading around unread:

1. Load from first unread **downward** only (forward direction)
2. Use `startReached` callback to load older on scroll up
3. First unread naturally becomes "top" of loaded set

**Tradeoff**: Different pagination UX, may feel awkward.

### Option C: Accept Limitation

Keep current behavior, add UI hints:

- Show unread count badge
- Add "Jump to first unread" button
- Visual indicator of unread position

**Tradeoff**: No automatic positioning, but explicit user control.

### Option D: Hybrid Approach

For channels with few unreads (<50):

- Load all unreads in initial 100 message fetch
- User sees unreads near bottom naturally

For channels with many unreads:

- Load from bottom as normal
- Show prominent "N unread messages" banner
- Clicking banner scrolls to first unread (may require pagination)

**Tradeoff**: Different behavior based on unread count.

---

## Related Files

### Core Implementation (Reverted)

- `src/hooks/queries/messages/buildMessagesFetcher.ts` - Message loading
- `src/components/message/MessageList.tsx` - Virtuoso scroll logic

### Supporting Code (Working)

- `src/db/messages.ts:getFirstUnreadMessage()` - DB query
- `src/hooks/business/messages/useMessageHighlight.ts` - Hash scroll mechanism
- `src/utils/platform.ts` - Platform detection

### Documentation

- `.agents/tasks/auto-jump-first-unread.md` - Original task (outdated)
- `.agents/bugs/.archived/auto-jump-unread-breaks-message-sync.md` - First attempt

---

## Recommendation

**Do not attempt to implement this feature** without either:

1. **Solving the Virtuoso problem**:
   - Research Virtuoso GitHub issues/discussions
   - Create minimal reproduction case
   - Contact Virtuoso maintainers if needed

2. **Changing virtualization library**:
   - Major refactor with significant risk
   - Would need full testing across platforms

3. **Alternative UX approach**:
   - Manual "jump to unread" button
   - Different behavior that works with Virtuoso's design

The bidirectional loading code is solid and can be reused, but the viewport positioning problem is a blocker.

---

## Questions for Future Investigation

1. Does Virtuoso have any undocumented props/APIs for mid-list initial positioning?
2. Can we delay Virtuoso mount until data is loaded? (May break suspense/loading states)
3. Is there a way to "trick" Virtuoso into thinking it's at the start when positioned at middle?
4. Would using `scrollerRef` to directly manipulate DOM scroll work?
5. Do other apps using Virtuoso have this problem? How do they solve it?

---

**Priority Justification**: Medium priority because:

- ✅ Not a bug - existing functionality works
- ✅ UX enhancement, not critical feature
- ✅ Workarounds exist (manual scrolling)
- ❌ High implementation complexity vs benefit
- ❌ Multiple failed attempts demonstrate technical barriers

**Estimated Effort if Attempted**: 5-10 days (including research, implementation, testing, and potential library migration)

---

_This bug report consolidates all attempts and learnings. The feature is blocked pending solution to the Virtuoso scroll positioning problem._
