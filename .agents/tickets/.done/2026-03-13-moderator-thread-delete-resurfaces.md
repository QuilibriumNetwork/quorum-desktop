---
type: bug
title: "Moderator thread deletion resurfaces after optimistic removal"
status: done
priority: high
ai_generated: true
created: 2026-03-13
updated: 2026-03-13
---

# Moderator thread deletion resurfaces after optimistic removal

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

When a moderator (user with `message:delete` permission) deletes a thread created by another user:
1. The thread is removed optimistically from the UI (works)
2. The thread immediately resurfaces after the P2P message loops back
3. After a page refresh, the thread is still present

Thread deletion by the thread author works correctly and does not resurface.

**Note**: This moderator can normally delete other users' messages without issues — the problem is specific to thread deletion.

## Root Cause

The receiving-side auth checks in `MessageService.ts` for `action: 'remove'` only allow the **thread creator** to delete threads. Unlike `close`/`reopen`/`updateSettings` actions (which check both authorship AND `message:delete` permission), the `remove` action has a strict creator-only check.

**Three identical checks reject the moderator's delete:**

### 1. `processMessage()` — peer receiving side
`src/services/MessageService.ts:859`:
```typescript
// Thread creator may always delete the thread
if (threadMsg.senderId !== createdBy) return;  // ← Rejects moderators
```

### 2. `addMessage()` — sender's own broadcast loopback
`src/services/MessageService.ts:1483`:
```typescript
// Thread creator may always delete the thread
if (threadMsg.senderId !== createdBy) return;  // ← Rejects moderators
```

### 3. `submitChannelMessage()` — send side (no remove handling)
`src/services/MessageService.ts:4793-4836`: The send-side handler for thread messages has **no special case** for `action: 'remove'`. It treats removal like any other thread action — updating `threadMeta` on the root message instead of deleting. This means:
- The sender's IndexedDB never gets the thread deleted
- The optimistic UI removal in `Channel.tsx:683-715` is not backed by a DB write
- On refresh, the thread reappears from IndexedDB

**Contrast with close/reopen/updateSettings** which correctly check both authorship and permission at `src/services/MessageService.ts:840-849`:
```typescript
const isAuthor = threadMsg.senderId === targetMessage!.threadMeta?.createdBy;
const hasDeletePermission = space?.roles?.some(
  (role) => role.members.includes(threadMsg.senderId) &&
            role.permissions.includes('message:delete')
) ?? false;
if (!isAuthor && !hasDeletePermission) return;
```

## Solution

The fix needs to be applied in all three locations to add `message:delete` permission as an alternative to creator authorship for thread removal:

### 1. `processMessage()` at line 859
Add permission check matching the pattern used for close/reopen (lines 840-848):
```typescript
// Thread creator OR anyone with message:delete permission may delete the thread
const isAuthor = threadMsg.senderId === createdBy;
const space = await messageDB.getSpace(spaceId);
const hasDeletePermission = space?.roles?.some(
  (role) => role.members.includes(threadMsg.senderId) &&
            role.permissions.includes('message:delete')
) ?? false;
if (!isAuthor && !hasDeletePermission) return;
```

### 2. `addMessage()` at line 1483
Same pattern — add `message:delete` permission check.

### 3. `submitChannelMessage()` at line ~4793
Add a dedicated handler for `action: 'remove'` that performs the actual database deletion (matching the logic in `processMessage`), rather than falling through to the generic `threadMeta` update path.

## Additional Notes

- The UI-side fix in `ThreadSettingsModal.tsx` (allowing moderators to see the delete button) has already been applied in this session
- The `Channel.tsx` optimistic update (`handleRemoveThread` at line 669) correctly removes the thread from the UI — the issue is purely that the P2P layer rejects and reverses it
- There may also be a P2P sync dimension to this (message ordering, conflict resolution) but the auth check rejection is the primary and confirmed cause
- The `hasOtherReplies` guard in the UI prevents moderators from deleting threads that still contain other users' messages — they must delete those messages first. This is a deliberate UX decision, not a bug

## Prevention

When adding new thread actions, ensure permission checks are consistent across all three handler paths (`processMessage`, `addMessage`, `submitChannelMessage`). The close/reopen/updateSettings pattern at line 840 is the correct reference for actions that should be available to both thread creators and users with `message:delete` permission.

---

_Created: 2026-03-13_
