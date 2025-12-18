# Deleted Messages Reappear After Peer Sync

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

When a user deletes a message:
1. The message is correctly removed from the UI (optimistic delete works)
2. The message is correctly deleted from local IndexedDB
3. The delete is correctly broadcast to other peers
4. **BUT** when another peer syncs their message history to you, the deleted message reappears
5. The message comes back with full content (not as a ghost/empty message)
6. Refreshing doesn't help - the message persists because it's now back in IndexedDB

## Pre-existing Issue - CONFIRMED

**Status: Pre-existing** - This bug exists in all three branches: `develop`, `cross-platform`, and current `cross-platform_action-queue`.

### Verification Results

| Branch | sync-messages Location | saveMessage else branch | Tombstone Check |
|--------|------------------------|------------------------|-----------------|
| `develop` | `MessageDB.tsx:1685` | Saves all post messages | ❌ None |
| `cross-platform` | `MessageService.ts:3144` | `MessageService.ts:557-565` | ❌ None |
| `cross-platform_action-queue` | `MessageService.ts:~3070` | `MessageService.ts:~576` | ❌ None |

### The Code Path Is Identical in All Branches

1. Receive `sync-messages` control envelope
2. For each message, call `saveMessage()`
3. `saveMessage()` for `post` type saves to IndexedDB (no tombstone check)
4. Call `refetchQueries()` to reload UI from IndexedDB

### Why Wasn't This Noticed Before?

1. **Single-peer testing**: If testing alone, no one syncs TO you, so deleted messages stay deleted
2. **Space owner testing**: Space owners send syncs OUT but may not receive syncs FROM others in test scenarios
3. **Infrequent sync triggers**: Sync happens on specific events (join, sync-request), not constantly
4. **Delete permission scope in develop**: Only message authors could delete (no `message:delete` role permission) → fewer deletes overall
5. **Small test datasets**: With few messages, the race window between delete and incoming sync is smaller

### What Made It Visible Now?

- Added `message:delete` role permission → more people can delete → more deletes happening
- Action queue makes deletes more reliable and visible
- More active multi-peer testing
- Delete confirmation modal draws attention to the action

## Root Cause

### The Sync Mechanism

When peers sync messages via `sync-messages` control envelope:
1. Peer A has 454 messages in their local DB (including message X)
2. User on Peer B deletes message X
3. Message X is removed from Peer B's IndexedDB
4. Delete broadcast is sent to network
5. **Shortly after**, Peer A sends `sync-messages` with all 454 messages
6. `saveMessage()` re-saves message X to Peer B's IndexedDB (no tombstone check)
7. `refetchQueries()` reloads from IndexedDB → message X reappears

### Code Flow (from console logs)

```
[useMessageActions:handleDelete] Queuing delete-message: {messageId: '09e5...'}
[useMessageActions:handleDelete] Delete queued successfully
[ActionQueue:deleteMessage] Executing delete: {...}
[ActionQueue:deleteMessage] Delete submitted successfully

// Immediately after:
[MessageService:sync-messages] Received sync with 454 messages
[MessageService:sync-messages] Processing message: {messageId: '...', type: 'post', ...}
[MessageService:saveMessage] Saving post message to IndexedDB: {...}
// ... 454 times, including deleted messages
```

### Missing Component: Tombstone Tracking

The system has **no mechanism** to remember which messages were deleted. When `saveMessage()` is called during sync:

```typescript
// MessageService.ts - saveMessage() else branch (line ~576)
} else {
  // This saves ANY post message, including ones we deleted
  await messageDB.saveMessage(
    { ...decryptedContent, channelId, spaceId },
    0, spaceId, conversationType,
    updatedUserProfile.user_icon!,
    updatedUserProfile.display_name!
  );
}
```

There's no check like:
```typescript
// Missing check:
if (await messageDB.isMessageDeleted(message.messageId)) {
  return; // Don't re-add deleted messages
}
```

## Affected Files

| File | Lines | Issue |
|------|-------|-------|
| [MessageService.ts](src/services/MessageService.ts) | ~3070-3140 | `sync-messages` handler saves all messages without checking tombstones |
| [MessageService.ts](src/services/MessageService.ts) | ~576-590 | `saveMessage()` doesn't check if message was previously deleted |
| [messages.ts](src/db/messages.ts) | N/A | No `deleted_messages` table or tombstone tracking |

## Solution - IMPLEMENTED

### Tombstone Tracking (Done)

**Step 1**: Added `deleted_messages` table to IndexedDB (DB_VERSION 7)
- File: [messages.ts](src/db/messages.ts)
- Added `DeletedMessageRecord` interface
- Created `deleted_messages` object store with indices

**Step 2**: Track deletions in `deleteMessage()` (channel messages only)
- File: [messages.ts](src/db/messages.ts)
- Modified `deleteMessage()` to save tombstone before deleting
- **DMs excluded**: Tombstones are only created for channel messages (`spaceId !== channelId`)
- DMs don't need tombstones because they have no sync mechanism that could resurrect deleted messages

**Step 3**: Check tombstones during sync in `saveMessage()`
- File: [MessageService.ts](src/services/MessageService.ts)
- Added `isMessageDeleted()` check before saving post messages

### Future: Tombstone Cleanup (Not Implemented)

To prevent unbounded growth of tombstones:
- Add periodic cleanup of tombstones older than 30 days
- Or limit to last N tombstones per channel
- Or sync tombstones between peers (more complex)

## Testing

**To reproduce:**
1. Have two clients connected to the same space
2. On Client A: Send 3 messages
3. Wait for Client B to receive them
4. On Client B: Delete all 3 messages
5. Observe: Messages may reappear after a few seconds when Client A syncs

**To verify fix:**
1. Delete a message
2. Wait for sync from other peers
3. Message should NOT reappear
4. Check IndexedDB `deleted_messages` table contains the tombstone

## Related Issues

- [ghost-message-after-delete.md](.agents/bugs/ghost-message-after-delete.md) - Different bug where `remove-message` type was misclassified (already fixed with type guard)

---

_Created: 2025-12-18_
_Updated: 2025-12-18 - Fix implemented (tombstone tracking)_
_Updated: 2025-12-18 - DMs excluded from tombstone tracking (no sync mechanism)_
