# Ghost Message Appears After Deleting a Message

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

When a user deletes a message:
1. The message is correctly removed from the UI (optimistic delete works)
2. Immediately after, a new empty/ghost message appears at the bottom of the channel
3. The ghost message shows the same author as the deleted message but has no content
4. Refreshing the page makes the ghost message disappear
5. In some cases, these empty messages persist and resist deletion

## Root Cause

**UPDATE**: After verification by exploration agent, the root cause analysis has been refined.

### Original Theory (Partially Correct)

The original theory was that `submitChannelMessage()` at [MessageService.ts:3307-3310](src/services/MessageService.ts#L3307-L3310) didn't exclude `remove-message` from the `isPostMessage` check, causing delete messages to be treated as post messages and cascade into `send-channel-message` handler which re-adds them to cache.

### Verified Root Cause

The `isPostMessage` check at [MessageService.ts:3307-3310](src/services/MessageService.ts#L3307-L3310) does NOT exclude `remove-message`:

```typescript
// Current code (buggy)
const isPostMessage =
  typeof pendingMessage === 'string' ||
  (!isEditMessage && !isPinMessage && !isUpdateProfileMessage);
```

This means `{type: 'remove-message', ...}` passes `isPostMessage = true` and enters the post-message code path.

### The Flow (Without Fix)

1. **User clicks delete** in `useMessageActions.ts`:
   - Optimistic update removes message from React Query cache ✓
   - Message deleted from IndexedDB ✓
   - `delete-message` action queued to ActionQueue

2. **ActionQueueHandlers.deleteMessage** executes:
   - Calls `messageService.submitChannelMessage()` with `{type: 'remove-message', senderId, removeMessageId}`

3. **submitChannelMessage()** misclassifies the delete message:
   - `isPostMessage = true` (because `remove-message` isn't in the exclude list)
   - Code enters the post-message handling block
   - Creates a NEW Message object with `content: {type: 'remove-message', ...}`
   - Calls `addMessage()` - this correctly handles `remove-message` by filtering (not adding)
   - **BUT THEN** enqueues to `send-channel-message` handler (line 3458-3468)

4. **send-channel-message handler** in [ActionQueueHandlers.ts:443-478](src/services/ActionQueueHandlers.ts#L443-L478):
   - Encrypts and sends the message
   - **Then blindly re-adds the message to cache if not present** (line 461-477)
   - This re-add does NOT check message type - adds ANY message including `remove-message`

5. **Ghost message appears**:
   - The Message object with `content.type: 'remove-message'` is now in the React Query cache
   - The renderer doesn't handle `remove-message` type specially
   - It renders as an empty message (no `text` field exists)

### Why Two Action Queue Tasks?

This creates an unintended cascade of two tasks:
1. `delete-message` → calls `submitChannelMessage()`
2. `send-channel-message` → encrypts, sends, and **re-adds ghost to cache**

This double-task pattern is NOT intentional - it's a side effect of the misclassification bug.

## Affected Files

| File | Lines | Issue |
|------|-------|-------|
| [MessageService.ts](src/services/MessageService.ts) | 3307-3310 | `isPostMessage` check doesn't exclude `remove-message`, `reaction`, `mute` |
| [ActionQueueHandlers.ts](src/services/ActionQueueHandlers.ts) | 461-477 | `send-channel-message` re-adds any message to cache without type checking |

## Solution

### Option A: Fix at send-channel-message handler (SIMPLEST) - DONE

Add a type guard in `send-channel-message` handler to only re-add post messages to cache:

```typescript
// At ActionQueueHandlers.ts line ~461
// Only re-add post messages to cache
if (signedMessage.content.type === 'post') {
  // ... existing re-add logic
}
```

**Pros**: Single line change, minimal risk
**Cons**: Doesn't fix the architectural issue (delete still goes through post-message path)

### Option B: Fix at submitChannelMessage (PROPER) - NOT DONE

Exclude `remove-message` from `isPostMessage` check AND add proper handler:

**Step 1**: Update `isPostMessage` check:
```typescript
const isRemoveMessage =
  typeof pendingMessage === 'object' &&
  (pendingMessage as any).type === 'remove-message';

const isPostMessage =
  typeof pendingMessage === 'string' ||
  (!isEditMessage && !isPinMessage && !isUpdateProfileMessage && !isRemoveMessage);
```

**Step 2**: Add handler in `enqueueOutbound` block for `remove-message` (similar to edit/pin handlers)

**Pros**: Clean architecture, proper separation of concerns
**Cons**: More code to write, needs handlers for remove-message, reaction, mute

### Implementation Priority

1. **Option A first** - quick fix to stop ghost messages
2. **Option B second** - proper architecture (can be done in follow-up)

## Prevention

1. **Type-safe message routing**: Consider using TypeScript discriminated unions to ensure message types are handled explicitly
2. **Explicit handler mapping**: Instead of relying on "isPostMessage" fallback, explicitly route each message type to its handler
3. **Cache modification guards**: Any code that adds messages to React Query cache should validate the message type is displayable

## Testing

To reproduce:
1. Send a message in a channel
2. Delete the message
3. Observe ghost message appearing at bottom of channel
4. Refresh page - ghost message disappears

To verify fix:
1. Delete a message - no ghost should appear
2. Add a reaction - no ghost should appear
3. Mute a user - no ghost should appear
4. Check ActionQueue stats - only one task should be created per action

---

_Created: 2025-12-18_
