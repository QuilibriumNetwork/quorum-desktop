---
type: task
title: "Fix Own Messages Counted as Unread"
status: done
complexity: medium
ai_generated: true
created: 2026-01-04
updated: 2026-01-09
---

# Fix Own Messages Counted as Unread

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Files**:
- `src/db/messages.ts:741-789`
- `src/services/MessageService.ts:280-330`
- `src/hooks/business/messages/useDirectMessageUnreadCount.ts:37-38`
- `src/hooks/business/messages/useChannelUnreadCounts.ts:70-73`

## What & Why

When a user sends messages, those messages are incorrectly counted as "unread" in both DMs and Channels. This causes false unread indicators (dots and badges) in the sidebar navigation. The root cause: `saveMessage()` updates `conversation.timestamp` but doesn't update `lastReadTimestamp` when the sender is the current user.

## Context

- **Existing pattern**: Unread detection uses `(lastReadTimestamp ?? 0) < timestamp` comparison
- **Current behavior**: `saveMessage()` at `messages.ts:773` updates `timestamp` to message's `createdDate` for ALL messages
- **Missing logic**: `lastReadTimestamp` is only updated when viewing messages (`useUpdateReadTime` hook), not when sending
- **Constraints**: Must not expose sensitive user data; fix should work for both online and offline (ActionQueue) message sending

---

## Implementation

### Phase 1: Core Fix

- [ ] **Add currentUserAddress parameter to MessageDB.saveMessage()** (`src/db/messages.ts:741`)
    - Done when: `saveMessage()` accepts optional `currentUserAddress?: string` parameter
    - Add after existing parameters: `currentUserAddress?: string`

- [ ] **Update lastReadTimestamp when sender is current user** (`src/db/messages.ts:766-775`)
    - Done when: When `message.content.senderId === currentUserAddress`, also set `lastReadTimestamp: message.createdDate`
    - Verify: Send a message → no unread indicator appears for that conversation
    ```typescript
    // Current:
    const request = conversationStore.put({
      ...existingConv,
      // ... other fields
      timestamp: message.createdDate,
    });

    // Change to:
    const isOwnMessage = currentUserAddress && message.content?.senderId === currentUserAddress;
    const request = conversationStore.put({
      ...existingConv,
      // ... other fields
      timestamp: message.createdDate,
      // Update lastReadTimestamp if this is our own message
      ...(isOwnMessage ? { lastReadTimestamp: message.createdDate } : {}),
    });
    ```

### Phase 2: Update All Callers (requires Phase 1)

- [ ] **Update MessageService.saveMessage() to pass currentUserAddress** (`src/services/MessageService.ts:280`)
    - Done when: All `messageDB.saveMessage()` calls include the current user's address
    - Note: MessageService has access to user context, pass it through to messageDB

- [ ] **Update ActionQueueHandlers DM send** (`src/services/ActionQueueHandlers.ts:650`)
    - Done when: `selfUserAddress` from context is passed to `saveMessage()`
    - Context already has `selfUserAddress` at line 532

- [ ] **Update ActionQueueHandlers channel send** (`src/services/ActionQueueHandlers.ts:400`)
    - Done when: User address is passed to `saveMessage()`
    - Get from context or keyset

- [ ] **Update other saveMessage callers**
    - Search for all `saveMessage(` calls in codebase
    - Update each to pass current user address when available
    - For system messages (join/leave/kick), pass undefined (no user context)

---

## Security Considerations

⚠️ **Critical**: The `currentUserAddress` is only used for local comparison - it should:
- NOT be sent over the network
- NOT be stored as a new field
- Only be used to conditionally update `lastReadTimestamp`

The comparison `senderId === currentUserAddress` uses data already present in the message, so no new data exposure occurs.

---

## Verification

✅ **DM: Own messages don't show as unread**
    - Test: Send 5 messages to different contacts → no unread dot on any contact
    - Test: Navigate away and back → still no false unread indicators

✅ **Channel: Own messages don't show as unread**
    - Test: Send message in channel → channel doesn't show unread dot
    - Test: Send in multiple channels → no false unread on any

✅ **Received messages still show as unread**
    - Test: Receive message from another user → unread indicator appears correctly
    - Test: View message → unread indicator clears

✅ **Offline messages work correctly**
    - Test: Go offline → send DM → go online
    - Verify: Message syncs AND no false unread indicator

✅ **TypeScript compiles**
    - Run: `npx tsc --noEmit`

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority | Risk |
|----------|-------------------|--------|----------|------|
| Message with no senderId | Skip lastReadTimestamp update | ⚠️ Needs handling | P0 | Low |
| System messages (join/leave) | Don't update lastReadTimestamp | ⚠️ Needs handling | P1 | Low |
| Reactions/edits | Follow parent message logic | ✅ Already works | P1 | Low |
| Multiple devices same user | Each device updates own local DB | ✅ Already works | P0 | Low |

---

## Definition of Done

- [ ] TypeScript compiles: `npx tsc --noEmit` passes
- [ ] Manual test: send DM → no false unread
- [ ] Manual test: send channel message → no false unread
- [ ] Manual test: receive message → unread appears correctly
- [ ] Manual test: offline send works correctly
- [ ] No console errors or warnings
- [ ] Security review: no new data exposure

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2026-01-04 - Claude**: Initial task creation based on investigation of unread indicator bug
