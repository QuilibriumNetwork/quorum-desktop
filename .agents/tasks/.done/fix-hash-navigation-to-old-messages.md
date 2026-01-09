---
type: task
title: "Task: Fix Hash Navigation to Old Messages (#msg-messageId Pattern)"
status: done
created: 2025-11-11
updated: 2026-01-09
---

# Task: Fix Hash Navigation to Old Messages (#msg-messageId Pattern)


**Priority**: High
**Type**: Bug Fix
**Component**: MessageList, Channel, useMessages hook
**Affects**: Search results, Pinned messages, Notifications, Direct URL hashes

**Completed**: 2025-11-12

---

## 📚 Documentation

**This task has been completed and moved to comprehensive documentation:**

👉 **See**: `.agents/docs/features/messages/hash-navigation-to-old-messages.md`

The documentation includes:
- Complete architecture and implementation details
- Data flow diagrams
- Code references with line numbers
- Comprehensive manual testing guide
- Performance considerations
- Error handling strategies
- Future enhancement opportunities

⚠️ **Testing Status**: Implementation is complete but requires extensive manual testing before being considered production-ready. See documentation for full testing checklist.

---

## Summary

**Core Issue**: Clicking any link that uses `#msg-{messageId}` navigation fails if the target message is not among the most recent 100 messages loaded by the infinite scroll system.

**Scope**: This task focuses **ONLY on hash navigation** (user-initiated clicks on links). It does NOT include auto-jump to first unread on channel entry (that's a separate, currently blocked feature).

This affects:
- 🔍 **Search results** linking to old messages
- 📌 **Pinned messages** from any date
- 🔔 **Notification links** to old replies/mentions
- 🔗 **Direct URL hashes** (bookmarked/shared links)
- 🔮 **Any future components** using this navigation pattern

**Solution**: Implement bidirectional message loading when hash target is not in currently loaded messages.

---

## Current State Analysis

### Architecture Overview

**Message Loading Flow**:
1. `Channel.tsx` (src/components/space/Channel.tsx:77) - Parent component
2. → `useChannelMessages` hook (src/hooks/business/channels/useChannelMessages.ts:24)
3. → `useMessages` hook (src/hooks/queries/messages/useMessages.ts:7)
4. → React Query `useSuspenseInfiniteQuery` with pagination
5. → `buildMessagesFetcher` → `messageDB.getMessages()`

**Current Hash Navigation** (MessageList.tsx:246-288):
```typescript
// MessageList receives messageList as prop (line 37)
const hash = location.hash;
if (hash.startsWith('#msg-') && !hasProcessedHash) {
  const msgId = hash.replace('#msg-', '');
  const index = messageList.findIndex((m) => m.messageId === msgId);
  if (index !== -1) {
    scrollToMessage(msgId, virtuoso.current, messageList); // ✅ SUCCESS
  } else {
    setHasProcessedHash(true); // ❌ SILENT FAILURE - just marks as processed
    // No attempt to load the message!
  }
}
```

### The Problem

**Root Cause**:
- MessageList is a **presentational component** - receives `messageList` as prop
- React Query infinite scroll loads 100 most recent messages initially
- Hash navigation only searches within currently loaded messages
- When message not found (lines 275-286): **silently gives up**

**Impact**:
- 🔴 **Silent failures** - Users click links, nothing happens
- 🔴 **No user feedback** - Confusing, broken UX
- 🔴 **Affects ALL hash navigation** - Search, Pinned, Notifications, URLs
- 🔴 **Worsens with channel activity** - Active channels guarantee failures

### Documented Issue

Confirmed in `.agents/bugs/auto-jump-unread-virtuoso-scroll-conflict.md:147-165`:
> "Clicking links to old messages (pinned messages, search results, notifications) fails if message is older than the 100 most recent"

**Important Note**: Previous attempts to implement auto-jump to first unread on channel entry caused Virtuoso scroll conflicts. However, **hash navigation is different** because:
- ✅ User-initiated (explicit click) vs automatic
- ✅ Happens after channel already loaded vs during initial load
- ✅ Explicit target vs implicit first unread detection

---

## Proposed Solution

### Approach: Callback-Based Bidirectional Loading

Since MessageList is presentational (receives data as props), the solution requires coordination between MessageList and its parent (Channel.tsx).

**Strategy**:
1. **MessageList detects** hash target not in current messageList
2. **Calls parent callback** with messageId
3. **Parent queries database** for target message
4. **Parent loads messages around target** using bidirectional loading
5. **React Query updates** messageList automatically
6. **MessageList scrolls** to target when it appears in messageList

**Key Design Decisions**:
- ✅ Keeps MessageList presentational (no data loading logic)
- ✅ Leverages React Query for state management
- ✅ User-initiated only (no automatic jumps on channel entry)
- ✅ Works with existing infinite scroll system
- ✅ Provides user feedback during loading

---

## Implementation Plan

### Phase 1: Create Bidirectional Loading Utility (1 day)

**File**: `src/hooks/queries/messages/loadMessagesAround.ts` (new file)

Create standalone utility function:
```typescript
export async function loadMessagesAround({
  messageDB,
  spaceId,
  channelId,
  targetTimestamp,
  beforeLimit = 40,
  afterLimit = 40,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
  targetTimestamp: number;
  beforeLimit?: number;
  afterLimit?: number;
}): Promise<{ messages: Message[]; targetMessage: Message }> {
  // Load messages before and after target in parallel
  // Return combined list sorted by timestamp
}
```

**Why separate utility**: Can be reused for future "jump to message" features without duplicating logic.

### Phase 2: Add Callback to MessageList (1 day)

**File**: `src/components/message/MessageList.tsx`

1. Add new optional prop:
```typescript
interface MessageListProps {
  // ... existing props
  onHashMessageNotFound?: (messageId: string) => Promise<void>;
}
```

2. Update hash navigation (line 275-286):
```typescript
} else {
  // Message not found - call parent callback if provided
  if (onHashMessageNotFound) {
    onHashMessageNotFound(msgId).catch(console.error);
  }
  setHasProcessedHash(true);
}
```

3. Add loading state UI (spinner/indicator when loading external message)

### Phase 3: Implement in Channel.tsx (1-2 days)

**File**: `src/components/space/Channel.tsx`

1. Add handler function:
```typescript
const handleHashMessageNotFound = useCallback(async (messageId: string) => {
  try {
    setIsLoadingHashMessage(true);

    // Get target message
    const message = await messageDB.getMessage({ spaceId, channelId, messageId });
    if (!message) {
      showNotification('Message not found or deleted');
      return;
    }

    // Load messages around target
    const { messages } = await loadMessagesAround({
      messageDB,
      spaceId,
      channelId,
      targetTimestamp: message.createdDate,
    });

    // Update React Query cache to replace current pages with new data
    queryClient.setQueryData(
      buildMessagesKey({ spaceId, channelId }),
      { pages: [{ messages, prevCursor: ..., nextCursor: ... }], pageParams: [...] }
    );
  } catch (error) {
    showNotification('Failed to load message');
  } finally {
    setIsLoadingHashMessage(false);
  }
}, [messageDB, spaceId, channelId]);
```

2. Pass callback to MessageList:
```typescript
<MessageList
  // ... existing props
  onHashMessageNotFound={handleHashMessageNotFound}
/>
```

### Phase 4: Testing & Refinement (1 day)

1. Test all hash navigation sources (search, pinned, notifications)
2. Test edge cases (deleted messages, network errors)
3. Verify no regressions for recent message navigation
4. Test interaction with infinite scroll pagination

---

## Technical Implementation Details

### 1. Bidirectional Loading Utility

**File**: `src/hooks/queries/messages/loadMessagesAround.ts` (new)

```typescript
import { MessageDB } from '../../../db/messages';
import { Message } from '../../../api/quorumApi';

export async function loadMessagesAround({
  messageDB,
  spaceId,
  channelId,
  targetTimestamp,
  beforeLimit = 40,
  afterLimit = 40,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
  targetTimestamp: number;
  beforeLimit?: number;
  afterLimit?: number;
}): Promise<{
  messages: Message[];
  targetMessage: Message;
  prevCursor: number | null;
  nextCursor: number | null;
}> {
  // Load messages before target (older messages)
  const beforeResponse = await messageDB.getMessages({
    spaceId,
    channelId,
    cursor: targetTimestamp,
    direction: 'backward',
    limit: beforeLimit,
  });

  // Load messages after target (newer messages)
  const afterResponse = await messageDB.getMessages({
    spaceId,
    channelId,
    cursor: targetTimestamp,
    direction: 'forward',
    limit: afterLimit,
  });

  // Get the target message itself
  const targetMessage = await messageDB.getMessage({
    spaceId,
    channelId,
    messageId: /* need to derive from timestamp or pass separately */,
  });

  // Combine and sort by timestamp
  const messages = [
    ...beforeResponse.messages,
    targetMessage,
    ...afterResponse.messages,
  ].sort((a, b) => a.createdDate - b.createdDate);

  return {
    messages,
    targetMessage,
    prevCursor: beforeResponse.prevCursor,
    nextCursor: afterResponse.nextCursor,
  };
}
```

**Note**: This function needs refinement - `messageDB.getMessages()` API needs to be verified for bidirectional loading support.

### 2. MessageList Callback Integration

**File**: `src/components/message/MessageList.tsx`

**Add to interface** (around line 36):
```typescript
interface MessageListProps {
  messageList: MessageType[];
  // ... existing props ...
  onHashMessageNotFound?: (messageId: string) => Promise<void>;
  isLoadingHashMessage?: boolean; // Loading state from parent
}
```

**Update hash navigation effect** (replace lines 275-286):
```typescript
} else {
  // Message not found in current list
  if (onHashMessageNotFound && !hasProcessedHash) {
    setHasProcessedHash(true); // Prevent multiple calls
    onHashMessageNotFound(msgId).catch((error) => {
      console.error('Failed to load hash message:', error);
      // Hash will be removed by parent's error handling
    });
  } else if (!onHashMessageNotFound) {
    // Fallback: silently mark as processed if no callback provided
    setHasProcessedHash(true);
    setTimeout(() => {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }, 100);
  }
}
```

**Add loading indicator** (in render section):
```typescript
{isLoadingHashMessage && (
  <div className="message-list-loading-overlay">
    <Spinner />
    <Trans>Loading message...</Trans>
  </div>
)}
```

---

## Benefits: Universal Fix

This solution automatically fixes hash navigation for **all existing components** without any changes to them:

### ✅ No Changes Required in Navigation Sources

1. **Search Results** (`SearchResults.tsx`) - Already uses `#msg-{messageId}`
2. **Pinned Messages** (`PinnedMessagesPanel.tsx`) - Already uses `#msg-{messageId}`
3. **Notifications** (`NotificationPanel.tsx`) - Already uses `#msg-{messageId}`
4. **Direct URL hashes** - Bookmarked/shared links work automatically
5. **Future components** - Any new feature using `#msg-{messageId}` works automatically

**Why**: The fix is centralized in MessageList's hash detection logic, so all navigation paths benefit.

---

## Testing Requirements

1. **Navigation to Recent Messages**:
   - Should work exactly as before (no regression)

2. **Navigation to Old Messages**:
   - Search results from 2 weeks ago → Should load and scroll
   - Pinned messages from 1 month ago → Should load and scroll
   - Notification links to old replies → Should load and scroll
   - Direct URL hashes to old messages → Should load and scroll

3. **Edge Cases**:
   - Deleted messages → Should show "not found" message
   - Non-existent message IDs → Should show error
   - Network errors during loading → Should show error and retry option
   - Messages in different channels/spaces → Should load correct context

4. **Performance**:
   - Loading around target should be fast (< 1 second)
   - No UI blocking during loading
   - Memory usage should be reasonable

---

## Dependencies & Prerequisites

### Existing Infrastructure (Already Available)
- ✅ `messageDB.getMessage()` - src/db/messages.ts:158 (exists)
- ✅ `messageDB.getMessages()` with cursor/direction support (exists)
- ✅ React Query infinite scroll setup (exists)
- ✅ Hash navigation detection in MessageList (exists, lines 246-288)
- ✅ Notification system (exists)

### New Components to Create
- 🔨 `loadMessagesAround()` utility function (Phase 1)
- 🔨 `onHashMessageNotFound` callback prop (Phase 2)
- 🔨 Handler in Channel.tsx (Phase 3)

### Database API Verification Needed
- ⚠️ Confirm `messageDB.getMessages()` supports `direction: 'backward' | 'forward'`
- ⚠️ Verify returned cursor values for bidirectional pagination
- ⚠️ Test limit parameter behavior in both directions

---

## Risk Assessment

### 🟡 Medium Risk

**Potential Issues**:
1. **React Query cache management** - Replacing pages might conflict with ongoing pagination
2. **Virtuoso scroll positioning** - Previous auto-jump attempts had scroll conflicts
3. **Race conditions** - Multiple hash navigations in quick succession
4. **Performance** - Loading 80 messages might be slower than expected

### Mitigation Strategies

**Why Hash Navigation Should Work vs Auto-Jump**:
- ✅ **User-initiated** - User explicitly clicked a link (clear intent)
- ✅ **After channel load** - Channel already rendered and stable
- ✅ **No Virtuoso prop conflicts** - Not changing `initialTopMostItemIndex` or `alignToBottom` on mount
- ✅ **Explicit target** - We know exactly which message to load

**Previous Failures Context**:
- ❌ Auto-jump to first unread failed due to Virtuoso scroll positioning during initial channel load
- ❌ Attempted to set `initialTopMostItemIndex` dynamically, caused conflicts
- ✅ Hash navigation is different: scroll happens AFTER initial load completes

**Safety Measures**:
1. **Graceful degradation** - If callback not provided, silently fail as before
2. **Error boundaries** - Catch all errors, show user-friendly messages
3. **Loading states** - Clear UI feedback during loading
4. **Prevent multiple calls** - `hasProcessedHash` flag prevents race conditions
5. **Maintain compatibility** - Recent message navigation unchanged (no regression risk)
6. **Phased rollout** - Can be feature-flagged if needed

**Testing Focus**:
- Test with various channel sizes (10 msgs, 100 msgs, 10,000+ msgs)
- Test rapid navigation (clicking multiple search results quickly)
- Test interaction with existing infinite scroll
- Monitor performance and memory usage

---

## Success Criteria

1. ✅ **Universal Fix**: Navigation to ANY message (recent or old) works correctly
2. ✅ **User Feedback**: Clear messages for loading, errors, and success states
3. ✅ **No Regression**: Recent message navigation works exactly as before
4. ✅ **Performance**: Target message loading completes in < 1 second
5. ✅ **All Components**: Search, Pinned Messages, Notifications all work with old messages
6. ✅ **Error Handling**: Graceful handling of deleted/missing messages
7. ✅ **Memory Efficient**: Loading around target doesn't cause memory issues
8. ✅ **Future-Proof**: New components using `#msg-{messageId}` work automatically

---

## Follow-up Opportunities

After this core fix is implemented and proven stable:

1. **Context Menu "Jump to Message"**: Add right-click option to jump to any message by ID
2. **Thread Navigation**: Use same mechanism for "view thread" / "jump to parent message"
3. **Permalink UI**: Add "Copy link to message" feature now that links reliably work
4. **Search Performance**: Implement full `.agents/tasks/search-performance-optimization.md`
5. **Revisit Auto-Jump Unread** (Optional, Low Priority): If hash navigation proves stable and doesn't cause Virtuoso issues, carefully reconsider auto-jump to first unread on channel entry as a separate enhancement

**Note**: Auto-jump to first unread is currently blocked (`.agents/bugs/auto-jump-unread-virtuoso-scroll-conflict.md`) and should remain separate from this task.

---

## Key Differences from Previous Failed Attempts

This task is **specifically scoped** to avoid the issues that caused previous auto-jump implementations to fail:

| Aspect | Previous Auto-Jump (Failed) | This Hash Navigation (Should Work) |
|--------|----------------------------|-----------------------------------|
| **Trigger** | Automatic on channel entry | User-initiated click on link |
| **Timing** | During initial channel mount | After channel already loaded |
| **Virtuoso Props** | Modified `initialTopMostItemIndex` at mount | No mount-time prop changes |
| **User Intent** | Implicit (system decides) | Explicit (user clicked something) |
| **Scope** | All channel entries with unreads | Only when clicking hash links |
| **Fallback** | Breaking change if it fails | Graceful degradation (current behavior) |
| **Risk Level** | High (affects all navigation) | Medium (opt-in callback) |

**Why This Should Work**:
1. We're not fighting with Virtuoso's initial render/alignment logic
2. User explicitly requested navigation by clicking a link
3. Channel is already stable when hash navigation happens
4. Callback pattern allows parent to handle loading without MessageList complexity
5. Can be feature-flagged or disabled per-channel if issues arise

---

## Implementation Summary (2025-11-12)

### ✅ Completed Components

#### 1. Bidirectional Loading Utility
**File**: `src/hooks/queries/messages/loadMessagesAround.ts` (new)
- Created standalone utility function for loading messages around a target message
- Uses `messageDB.getMessages()` with `direction: 'forward' | 'backward'`
- Loads 40 messages before and 40 messages after target by default
- Returns combined message list sorted chronologically with cursor values

#### 2. MessageList Callback Integration
**File**: `src/components/message/MessageList.tsx`
- Added `onHashMessageNotFound?: (messageId: string) => Promise<void>` prop
- Added `isLoadingHashMessage?: boolean` prop for loading state
- Updated hash navigation effect (lines 279-298) to call callback when message not found
- Added loading indicator UI (lines 373-383) with spinner and message
- Maintains backward compatibility: gracefully degrades if callback not provided

#### 3. Channel.tsx Handler Implementation
**File**: `src/components/space/Channel.tsx`
- Imported `loadMessagesAround` and `buildMessagesKey` utilities
- Added `queryClient` initialization for React Query cache management
- Added `isLoadingHashMessage` state
- Implemented `handleHashMessageNotFound` callback (lines 292-336):
  - Loads messages around target using bidirectional utility
  - Updates React Query cache with new message page centered on target
  - Shows loading indicator during fetch
  - Handles errors gracefully with console logging and hash removal
- Passed callback and loading state to MessageList component (lines 832-833)

### 🎯 How It Works

1. **User clicks link** with `#msg-{messageId}` (from search, pinned, notification, etc.)
2. **MessageList detects hash** but can't find message in current loaded messages
3. **MessageList calls callback** `onHashMessageNotFound(messageId)`
4. **Channel handler loads data**:
   - Shows loading spinner
   - Fetches target message to get timestamp
   - Loads 40 messages before + target + 40 messages after
   - Updates React Query cache with new page
5. **MessageList re-renders** with new data, finds message, scrolls to it
6. **Existing highlight logic** applies highlight animation to target message

### ✅ Type Safety
- All TypeScript compilation passes for modified files
- No new type errors introduced
- Proper typing for async callbacks and React Query cache updates

### 🔄 What Still Needs Testing

**Manual Testing Required**:
1. Navigation to old messages from search results
2. Navigation to old pinned messages
3. Navigation from notification links
4. Direct URL hashes to old messages
5. Error handling for deleted/missing messages
6. Loading indicator visibility during fetch
7. Interaction with existing infinite scroll

**Edge Cases to Verify**:
- Messages from months ago
- Non-existent message IDs
- Network errors during loading
- Rapid navigation (multiple clicks)
- Recent message navigation (should work as before - no regression)

---

*Task created: 2025-11-11*
*Implementation completed: 2025-11-12*
*Status: Ready for testing*
