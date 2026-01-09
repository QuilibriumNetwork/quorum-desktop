---
type: task
title: Fix False Desktop Notifications in Background Tabs
status: done
complexity: low
ai_generated: true
created: 2025-01-04T00:00:00.000Z
updated: '2026-01-09'
---

# Fix False Desktop Notifications in Background Tabs

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent


**Reported by**: User (browser web app)

## What & Why

**Current state**: Users receive constant "new message" desktop notifications while the browser tab is in the background, even when there are no actual new unread messages. This is because the app notifies for ALL WebSocket messages including space messages, sync messages, and the user's own messages.

**Desired state**: Desktop notifications should only appear for new DM messages from other users.

**Value**: Eliminates notification spam. Users currently disable notifications entirely due to false positives.

## Root Cause Analysis

The notification system at [WebsocketProvider.tsx:104-127](src/components/context/WebsocketProvider.tsx#L104-L127) counts **every** WebSocket message and triggers a notification:

```typescript
let totalNewMessages = 0;
for (const [_, messages] of inboxMap) {
  totalNewMessages += messages.length;  // Counts ALL messages
}
if (totalNewMessages > 0) {
  showNotificationForNewMessages(totalNewMessages);
}
```

This includes:
- Space/channel messages (even without mentions)
- Sync control messages
- User's own messages from other tabs/devices
- Reactions, edits, and other non-post content

## Implementation Plan

### Step 1: Add Pending Count Methods to NotificationService

**File**: `src/services/NotificationService.ts`

Add after line 22 (after `private readonly quorumIcon`):

```typescript
private pendingNotificationCount = 0;

/**
 * Resets the pending notification count to 0.
 * Called at the start of each WebSocket message batch.
 */
public resetPendingNotificationCount(): void {
  this.pendingNotificationCount = 0;
}

/**
 * Increments the pending notification count by 1.
 * Called by MessageService when a DM post from another user is received.
 */
public incrementPendingNotificationCount(): void {
  this.pendingNotificationCount++;
}

/**
 * Returns the current pending notification count.
 * Valid only within a single WebSocket message batch.
 */
public getPendingNotificationCount(): number {
  return this.pendingNotificationCount;
}
```

### Step 2: Track DM Posts in MessageService

**File**: `src/services/MessageService.ts`

**Add import** (around line 46):
```typescript
import { notificationService } from './NotificationService';
```

**Location 1: New DM conversation path** (after line ~2085, after `saveMessage`):

```typescript
// After this existing code:
await this.saveMessage(
  decryptedContent,
  this.messageDB,
  session.user_address,
  session.user_address,
  'direct',
  updatedUserProfile ?? {...}
);

// ADD THIS:
// Only notify for DM posts from other users
if (session.user_address !== self_address &&
    decryptedContent?.content?.type === 'post') {
  notificationService.incrementPendingNotificationCount();
}
```

**Location 2: Existing DM conversation path** (after line ~2212, after `DoubleRatchetInboxDecrypt`):

```typescript
// After this existing code:
decryptedContent = JSON.parse(result.message);

// ADD THIS:
// Only notify for DM posts from other users
// keys.sending_inbox confirms this is a DM (Double Ratchet)
if (keys.sending_inbox &&
    maybeInit.user_profile?.user_address !== self_address &&
    decryptedContent?.content?.type === 'post') {
  notificationService.incrementPendingNotificationCount();
}
```

**DM Detection**: DMs use Double Ratchet encryption which has `keys.sending_inbox`. Space messages use Triple Ratchet and don't have this field.

### Step 3: Update WebsocketProvider to Use Service Count

**File**: `src/components/context/WebsocketProvider.tsx`

**Add import** (around line 12):
```typescript
import { notificationService } from '../../services/NotificationService';
```

**Replace lines 103-127** with:

```typescript
const allPromises = [] as Promise<void>[];

// Reset count before processing batch
notificationService.resetPendingNotificationCount();

for (const [_, messages] of inboxMap) {
  allPromises.push(
    new Promise(async (resolve) => {
      for (const message of messages) {
        try {
          await handlerRef.current!(message);
        } catch (error) {
          console.error(t`Error processing inbound:`, error);
        }
      }
      resolve();
    })
  );
}

await Promise.allSettled(allPromises);

// Show notification only for DM posts from other users
const notificationCount = notificationService.getPendingNotificationCount();
if (notificationCount > 0) {
  showNotificationForNewMessages(notificationCount);
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/NotificationService.ts` | Add 3 pending count methods (~15 lines) |
| `src/services/MessageService.ts` | Add import + increment at 2 locations (~10 lines) |
| `src/components/context/WebsocketProvider.tsx` | Add import + use filtered count (~5 lines) |

## Verification

✅ **DM notifications work**
   - Background the app tab
   - Have another user send you a DM
   - Verify notification appears

✅ **Space messages don't trigger notifications**
   - Background the app tab
   - Have activity in a space you're a member of
   - Verify NO notification appears

✅ **Own messages don't trigger notifications**
   - Open app in two tabs
   - Send a DM from Tab A
   - Verify Tab B (if backgrounded) does NOT show notification

✅ **DM edits/reactions don't trigger notifications**
   - Background the app tab
   - Have another user react to or edit a DM
   - Verify NO notification appears

✅ **Sync doesn't trigger notifications**
   - Disconnect network briefly
   - Reconnect
   - Verify sync process doesn't spam notifications

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

## Definition of Done

- [ ] NotificationService has pending count methods
- [ ] MessageService import added
- [ ] MessageService increments at new DM path (~line 2086)
- [ ] MessageService increments at existing DM path (~line 2212)
- [ ] WebsocketProvider uses filtered count
- [ ] All verification tests pass
- [ ] No TypeScript errors
- [ ] User confirms fix resolves their issue

## Future Enhancements

Once this basic fix is in place, we can later add:
- Notifications for @mentions in spaces
- Notifications for replies to your messages
- Per-space notification settings (already partially implemented)

---
