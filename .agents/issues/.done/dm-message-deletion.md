---
type: task
title: "Direct Message Deletion Feature"
status: done
complexity: medium
ai_generated: true
created: 2026-01-09
updated: 2025-10-06
---

# Direct Message Deletion Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

Enable users to delete their own messages in private conversations (DirectMessage), matching the existing deletion behavior used in Channels.


**Priority**: Medium

**Type**: Feature parity

**Related Files**:
- `src/hooks/business/conversations/useDirectMessagesList.ts` - Added `canDeleteMessages` function
- `src/components/direct/DirectMessage.tsx` - Enabled deletion UI
- `src/services/MessageService.ts:192-264` - Fixed DM deletion logic

---

## Implementation Summary

### What Was Implemented

✅ Users can delete their own messages in DMs (no time restrictions)
✅ Deletion propagates to receiver in real-time via WebSocket
✅ Message completely disappears for both sender and receiver
✅ Deletion persists after page refresh (IndexedDB + React Query cache)
✅ Works on both web and mobile platforms
✅ Matches Channel deletion behavior

---

## Implementation Steps

### 1. Add `canDeleteMessages` to `useDirectMessagesList` Hook

**File**: `src/hooks/business/conversations/useDirectMessagesList.ts`

Added permission check function to the hook:

```typescript
import { useCallback } from 'react'; // Add to imports

// Add to interface
export interface UseDirectMessagesListReturn {
  // ... existing properties
  canDeleteMessages: (message: MessageType) => boolean;
}

// Add function before return
const canDeleteMessages = useCallback(
  (message: MessageType) => {
    const userAddress = user.currentPasskeyInfo?.address;
    if (!userAddress) return false;

    // Users can always delete their own messages (no time limit)
    if (message.content.senderId === userAddress) {
      return true;
    }

    return false;
  },
  [user.currentPasskeyInfo]
);

// Add to return
return {
  // ... existing properties
  canDeleteMessages,
};
```

**Key Points**:
- Uses `useCallback` to prevent unnecessary re-renders
- Simple logic: only message sender can delete (matches Channel behavior)
- No time restrictions - users can delete old messages

---

### 2. Enable Deletion in DirectMessage Component

**File**: `src/components/direct/DirectMessage.tsx`

**Before**:
```typescript
const { messageList, acceptChat, fetchNextPage, fetchPreviousPage } =
  useDirectMessagesList();

// ...

<MessageList
  canDeleteMessages={() => false}
  // ...
/>
```

**After**:
```typescript
const {
  messageList,
  acceptChat,
  fetchNextPage,
  fetchPreviousPage,
  canDeleteMessages,
} = useDirectMessagesList();

// ...

<MessageList
  canDeleteMessages={canDeleteMessages}
  // ...
/>
```

---

### 3. Fix DM Deletion Bug in MessageService

**File**: `src/services/MessageService.ts:192-264`

#### Bug 1: DM ID Mismatch (Primary Issue)

**Problem**: In DM conversations, each user stores messages with their conversation partner's address as `spaceId/channelId`:
- Sender stores messages with `spaceId/channelId` = receiver's address
- Receiver stores messages with `spaceId/channelId` = sender's address

When deletion message arrives at receiver:
- Deletion request has `spaceId/channelId` = receiver's address
- Stored target message has `spaceId/channelId` = sender's address
- Strict ID match check blocked the deletion ❌

**Solution** (lines 202-216):
```typescript
// For DMs: Both users store messages with their partner's address as spaceId/channelId
// So we can't do a direct comparison. Instead, check if both are DMs (spaceId == channelId)
const isTargetDM = targetMessage.spaceId === targetMessage.channelId;
const isRequestDM = decryptedContent.spaceId === decryptedContent.channelId;

if (isTargetDM && isRequestDM) {
  // Both are DMs - this is valid even if IDs don't match exactly
  // The IDs represent conversation partners' addresses
} else if (
  targetMessage.channelId !== decryptedContent.channelId ||
  targetMessage.spaceId !== decryptedContent.spaceId
) {
  // For Spaces: IDs must match exactly
  return;
}
```

**Key Fix**: Detect DM conversations (where `spaceId == channelId`) and allow ID mismatch since both addresses are valid conversation partners.

#### Bug 2: Early Returns Preventing Cache Updates

**Problem**: After deleting from IndexedDB, the code had early `return` statements that prevented `addMessage()` from running, which meant React Query cache wasn't updated.

**Solution** (lines 218-264): Changed from `if + return` to `if...else if` pattern:

**Before (buggy)**:
```typescript
if (targetMessage.content.senderId === decryptedContent.content.senderId) {
  await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
  return; // ❌ Prevents addMessage() from updating cache
}

if (spaceId != channelId) {
  // Space deletion logic
  await messageDB.deleteMessage(...);
  return; // ❌ Prevents addMessage() from updating cache
}
```

**After (fixed)**:
```typescript
if (targetMessage.content.senderId === decryptedContent.content.senderId) {
  await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
  // Don't return early - allow addMessage() to update React Query cache
} else if (spaceId != channelId) {
  // Space deletion logic with proper if...else structure
  if (channel?.isReadOnly) {
    if (isManager) {
      await messageDB.deleteMessage(...);
      // Don't return early - allow addMessage() to update React Query cache
    } else {
      return; // Only return if unauthorized
    }
  } else {
    if (!hasPermission) {
      return; // Only return if unauthorized
    }
    await messageDB.deleteMessage(...);
    // Don't return early - allow addMessage() to update React Query cache
  }
}
```

**Key Fix**: Removed early returns after successful deletions to ensure both `saveMessage()` (IndexedDB) and `addMessage()` (React Query cache) are called.

---

## How It Works

### Deletion Flow

1. **User deletes message** (sender or receiver for their own messages)
   - `useMessageActions` hook creates `remove-message` object
   - Confirmation modal appears (or Shift+click bypass on desktop)

2. **Deletion message sent** via WebSocket
   - `submitMessage()` called with `{ type: 'remove-message', removeMessageId: '...' }`
   - Message encrypted and sent to all conversation participants

3. **Sender processes deletion locally**
   - `saveMessage()` deletes from IndexedDB
   - `addMessage()` removes from React Query cache
   - UI updates immediately

4. **Receiver gets deletion via WebSocket**
   - `handleNewMessage()` called with deletion message
   - `saveMessage()` deletes from IndexedDB (with DM ID mismatch handling)
   - `addMessage()` removes from React Query cache
   - UI updates immediately

5. **Page refresh**
   - Messages loaded from IndexedDB
   - Deleted message no longer exists ✅

---

## Bug Investigation & Resolution

### Initial Symptoms
- ✅ Sender: Message deleted and stays deleted
- ❌ Receiver: Message disappears immediately but reappears after page refresh

### Root Cause Analysis

**Investigation Steps**:
1. Added debug logging to trace message flow
2. Confirmed deletion message reaches receiver via WebSocket
3. Found target message exists in receiver's IndexedDB
4. Discovered ID mismatch check was blocking deletion

**Root Cause**:
- DM messages are stored with conversation partner's address as `spaceId/channelId`
- Deletion request arrives with current user's address as `spaceId/channelId`
- Strict equality check `targetMessage.spaceId !== decryptedContent.spaceId` returned true
- Code exited early without deleting from IndexedDB

### The Fix

Recognized that DMs use conversation partner addresses as IDs, so we:
1. Detect DM conversations: `spaceId === channelId`
2. Allow ID mismatch for DMs (both addresses are valid)
3. Maintain strict ID matching for Spaces (security requirement)

---

## Testing Checklist

### Core Functionality
- [x] Delete own message in DM (sender side)
- [x] Verify message deleted for receiver in real-time
- [x] Refresh page - message stays deleted for both users
- [x] Cannot delete other user's messages (button doesn't show)
- [x] Shift+click bypass works on desktop
- [x] Touch delete always shows confirmation on mobile

### Edge Cases
- [x] Delete message with replies - reply preview handles missing parent
- [x] Delete message with reactions - message and reactions removed
- [x] Offline deletion - queues and syncs when online
- [x] Recipient offline - deletion applies when they reconnect

### Platform Testing
- [x] Web: Deletion works correctly
- [x] Mobile: Deletion works correctly (via shared code)

---

## Success Criteria

✅ Users can delete their own messages in DMs (no time restrictions)
✅ Deletion propagates to receiver in real-time
✅ Message completely disappears for both sender and receiver
✅ Message content permanently removed (privacy maintained)
✅ Backend validation ensures only sender can delete
✅ Mobile and desktop platforms both work correctly
✅ No TypeScript errors
✅ Offline deletions sync correctly when reconnected
✅ Confirmation modal appears (except Shift+click on desktop)
✅ Reply chains handle missing parent messages gracefully
✅ Behavior matches Channel deletion exactly
✅ **Deletion persists after page refresh** (IndexedDB properly updated)

---

## Key Learnings

### DM Architecture Insight
- Each user stores DM messages with their conversation partner's address as `spaceId/channelId`
- This differs from Spaces where all users share the same `spaceId/channelId`
- Deletion logic must account for this asymmetry

### Dual-Layer Persistence
- `saveMessage()` handles IndexedDB persistence
- `addMessage()` handles React Query cache
- Both must be called for deletions to fully work
- Early returns break this pattern

### WebSocket Message Flow
- Deletion messages propagate to all conversation participants
- Each participant processes deletion independently
- IndexedDB and cache must stay in sync

---

## Future Enhancement: Message Deletion Placeholders

**If we want to improve UX in the future**, consider adding placeholders instead of complete deletion:

### Placeholder Benefits
- Prevents confusing gaps in conversation
- Preserves reply chain context
- Honest transparency (user knows something was deleted)
- Matches industry standard (WhatsApp, Telegram, Signal)
- Prevents gaslighting ("I never said that")

### Implementation for Placeholders (Future)

See original task document for detailed placeholder implementation steps.

---


_Last Updated: 2025-10-06 - Completed implementation with DM ID mismatch fix and cache update fix_
