---
type: task
title: Space/Channel Message Deletion Placeholders
status: on-hold
complexity: low
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Space/Channel Message Deletion Placeholders

Could create a messy situation when mods delete many spam messages at the same time.

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

Add deletion placeholders to Space/Channel messages to improve UX and conversation context preservation. Currently, when messages are deleted in Channels, they disappear completely with no indication.


**Priority**: Medium

**Type**: UX Enhancement
**Depends On**: None (can be implemented independently or alongside DM deletion placeholders)

**Related Files**:
- `src/services/MessageService.ts:192-268` (saveMessage deletion logic)
- `src/services/MessageService.ts:414-503` (handleNewMessage cache update)
- `src/hooks/business/channels/useChannelMessages.ts:73-119` (permission check)
- `src/components/message/Message.tsx` (rendering - will reuse DM placeholder if implemented)

---

## Context

### Current Behavior (Spaces/Channels)

Users can delete messages in Channels if:
1. **Own messages** - Always allowed
2. **Others' messages** - If they have `message:delete` permission (moderators/admins)
3. **Read-only channels** - Only channel managers can delete

**Current deletion**: Messages are **hard deleted** - completely removed from IndexedDB with no trace.

```typescript
// Current implementation (MessageService.ts:212, 234, 253)
await messageDB.deleteMessage(messageId);
// Message disappears forever - no placeholder
```

### Problem

**Confusing UX:**
```
Alice: What time is the meeting tomorrow?
Bob: 3pm in Conference Room A
Charlie: Perfect, see you there!

[Moderator deletes Bob's message]

Alice: What time is the meeting tomorrow?
Charlie: Perfect, see you there!
```
❌ Users are confused - "Perfect for what? What did I miss?"

---

## Proposed Solution

### Goal: Add Permanent Placeholders (Like WhatsApp/Telegram)

Replace hard deletion with placeholder markers:
- Message **content is permanently removed** (privacy maintained)
- **Placeholder remains** to preserve conversation context
- Placeholder **cannot be deleted** (permanent marker)
- Same behavior for all deletion types (own message, moderator, space owner)

**With Placeholder:**
```
Alice: What time is the meeting tomorrow?
[This message was deleted]
Charlie: Perfect, see you there!
```
✅ Clear context - user knows something was removed

---

## Implementation Details

### 1. Add Deletion Metadata to Message Type

**File**: `src/api/quorumApi.ts`

**Add optional deletion fields to Message type** (if not already added by DM task):
```typescript
export type Message = {
  channelId: string;
  spaceId: string;
  messageId: string;
  // ... existing fields ...
  content: PostMessage | EventMessage | ...;
  reactions: Reaction[];
  mentions: Mentions;

  // NEW: Deletion metadata
  isDeleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;
};
```

**Note**: If DM deletion task is implemented first, this step is already done.

---

### 2. Modify Backend Deletion Logic (3 Locations)

**File**: `src/services/MessageService.ts`

Replace all `deleteMessage()` calls with placeholder creation:

#### **Location 1: Own Message Deletion (Line 209-213)**

**Current**:
```typescript
if (targetMessage.content.senderId === decryptedContent.content.senderId) {
  await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
  return;
}
```

**Change to**:
```typescript
if (targetMessage.content.senderId === decryptedContent.content.senderId) {
  // Hard delete content, keep placeholder
  const deletedMessage = {
    ...targetMessage,
    isDeleted: true,
    deletedAt: Date.now(),
    deletedBy: decryptedContent.content.senderId,
    // Clear all sensitive content for privacy
    content: {
      ...targetMessage.content,
      text: '', // Clear text
      imageUrl: undefined, // Clear images
      videoUrl: undefined, // Clear videos
      // Keep type and senderId for rendering placeholder
    } as typeof targetMessage.content,
    // Clear reactions
    reactions: [],
    // Unpin if pinned
    isPinned: false,
  };

  await messageDB.saveMessage(
    deletedMessage,
    0,
    spaceId,
    conversationType,
    updatedUserProfile.user_icon!,
    updatedUserProfile.display_name!
  );
  return;
}
```

#### **Location 2: Manager Deletion in Read-Only Channels (Line 233-237)**

**Current**:
```typescript
if (isManager) {
  await messageDB.deleteMessage(
    decryptedContent.content.removeMessageId
  );
  return;
}
```

**Change to**:
```typescript
if (isManager) {
  // Hard delete content, keep placeholder
  const deletedMessage = {
    ...targetMessage,
    isDeleted: true,
    deletedAt: Date.now(),
    deletedBy: decryptedContent.content.senderId,
    content: {
      ...targetMessage.content,
      text: '',
      imageUrl: undefined,
      videoUrl: undefined,
    } as typeof targetMessage.content,
    reactions: [],
    isPinned: false,
  };

  await messageDB.saveMessage(
    deletedMessage,
    0,
    spaceId,
    conversationType,
    updatedUserProfile.user_icon!,
    updatedUserProfile.display_name!
  );
  return;
}
```

#### **Location 3: Role-Based Deletion (Line 253)**

**Current**:
```typescript
await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
```

**Change to**:
```typescript
// Hard delete content, keep placeholder
const deletedMessage = {
  ...targetMessage,
  isDeleted: true,
  deletedAt: Date.now(),
  deletedBy: decryptedContent.content.senderId,
  content: {
    ...targetMessage.content,
    text: '',
    imageUrl: undefined,
    videoUrl: undefined,
  } as typeof targetMessage.content,
  reactions: [],
  isPinned: false,
};

await messageDB.saveMessage(
  deletedMessage,
  0,
  spaceId,
  conversationType,
  updatedUserProfile.user_icon!,
  updatedUserProfile.display_name!
);
```

---

### 3. Update UI Permission Check

**File**: `src/hooks/business/channels/useChannelMessages.ts:73-119`

**Add check to prevent deleting placeholders**:

```typescript
const canDeleteMessages = useCallback(
  (message: MessageType) => {
    const userAddress = user.currentPasskeyInfo?.address;
    if (!userAddress) return false;

    // NEW: Cannot delete if already deleted (placeholder)
    if (message.isDeleted) {
      return false;
    }

    // Users can always delete their own messages
    if (message.content.senderId === userAddress) {
      return true;
    }

    // For read-only channels: check if user is a manager
    if (channel?.isReadOnly) {
      const isManager = !!(
        channel.managerRoleIds &&
        roles.some(
          (role) =>
            channel.managerRoleIds?.includes(role.roleId) &&
            role.members.includes(userAddress)
        )
      );
      if (isManager) {
        return true;
      }
    }

    // Use centralized permission utility (handles space owners + role permissions)
    const hasDeletePermission = hasPermission(
      userAddress,
      'message:delete',
      space,
      isSpaceOwner
    );

    return hasDeletePermission;
  },
  [roles, user.currentPasskeyInfo, isSpaceOwner, channel, space]
);
```

---

### 4. Create Placeholder Component (if not exists)

**File**: `src/components/message/DeletedMessagePlaceholder.tsx`

**If DM deletion task is implemented first, reuse that component. Otherwise, create**:

```tsx
import React from 'react';
import { FlexRow, Text, Icon } from '../primitives';
import { t } from '@lingui/core/macro';

interface DeletedMessagePlaceholderProps {
  isOwnMessage: boolean;
}

export const DeletedMessagePlaceholder: React.FC<DeletedMessagePlaceholderProps> = ({
  isOwnMessage,
}) => {
  return (
    <FlexRow className="gap-2 items-center px-4 py-2 rounded bg-surface-2 italic text-subtle">
      <Icon name="trash" size="xs" />
      <Text variant="subtle">
        {isOwnMessage
          ? t`You deleted this message`
          : t`This message was deleted`}
      </Text>
    </FlexRow>
  );
};
```

**Note**:
- Uses primitives for cross-platform compatibility
- Does **not** reveal who deleted (privacy for moderators)
- Shows different text for own vs others' messages

---

### 5. Update Message Component to Render Placeholder

**File**: `src/components/message/Message.tsx`

**If DM deletion task is implemented first, this is already done. Otherwise, add**:

**Add at the beginning of the render logic** (before message type checks):

```tsx
// Check if message is deleted - show placeholder
if (message.isDeleted) {
  const isOwnMessage = message.content.senderId === user.currentPasskeyInfo?.address;

  return (
    <FlexColumn
      id={`msg-${message.messageId}`}
      className="text-base relative"
    >
      <DeletedMessagePlaceholder isOwnMessage={isOwnMessage} />
    </FlexColumn>
  );
}
```

**Import at top**:
```tsx
import { DeletedMessagePlaceholder } from './DeletedMessagePlaceholder';
```

---

### 6. Update Cache Invalidation Logic (Already Handles It)

**File**: `src/services/MessageService.ts:476-500`

The existing `handleNewMessage` logic **already updates the cache** correctly. When a deletion event is processed, it filters messages:

```typescript
messages: [
  ...page.messages.filter(
    (m: Message) => m.messageId !== targetId
  ),
]
```

**This will need to change to**:
```typescript
messages: page.messages.map((m: Message) => {
  // If this is the deleted message, replace with placeholder
  if (m.messageId === targetId) {
    return {
      ...m,
      isDeleted: true,
      deletedAt: Date.now(),
      deletedBy: decryptedContent.content.senderId,
      content: { ...m.content, text: '', imageUrl: undefined, videoUrl: undefined },
      reactions: [],
      isPinned: false,
    };
  }
  return m;
})
```

---

### 7. Update Search to Exclude Deleted Messages

**File**: `src/services/SearchService.ts`

**Ensure deleted messages are not included in search results**:

```typescript
// When indexing messages for search
if (message.isDeleted) {
  continue; // Skip deleted messages
}
```

---

### 8. Add i18n Strings

**File**: `src/i18n/en/messages.po` (auto-generated)

The following strings will be extracted automatically:
```po
msgid "You deleted this message"
msgstr ""

msgid "This message was deleted"
msgstr ""
```

**After implementation, run**:
```bash
yarn lingui:extract
yarn lingui:compile
```

---

## Edge Cases to Handle

| Scenario | Expected Behavior | Implementation Notes |
|----------|-------------------|---------------------|
| **Moderator deletes user's message** | Placeholder shows "This message was deleted" (not who deleted) | Privacy - don't expose moderator identity |
| **Space owner deletes** | Same placeholder - "This message was deleted" | Consistent with moderator behavior |
| **Delete pinned message** | Message unpinned + placeholder shown | Set `isPinned: false` when deleting |
| **Delete message with reactions** | Reactions cleared, placeholder has no reactions | Clear `reactions: []` when deleting |
| **Delete message with replies** | Reply still shows, parent shows placeholder | Reply rendering should handle deleted parent gracefully |
| **Try to delete placeholder** | Delete button not shown | UI check: `if (message.isDeleted) return false` |
| **Delete in read-only channel** | Only managers can delete | Already handled by existing permission system |
| **Search deleted messages** | Not included in search results | Filter out `isDeleted === true` in search |

---

## Implementation Checklist

### Type System & Data Model
- [ ] Add `isDeleted`, `deletedAt`, `deletedBy` fields to `Message` type (skip if DM task already did this)
- [ ] Ensure TypeScript compilation passes with new fields

### Backend Changes
- [ ] Update own-message deletion logic (MessageService.ts:209-213)
- [ ] Update manager deletion logic (MessageService.ts:233-237)
- [ ] Update role-based deletion logic (MessageService.ts:253)
- [ ] Update cache invalidation to replace with placeholder instead of filtering out (lines 476-500)
- [ ] All three locations should clear: text, images, videos, reactions, isPinned

### UI Changes
- [ ] Update `canDeleteMessages` in `useChannelMessages.ts` to prevent deleting placeholders
- [ ] Create `DeletedMessagePlaceholder.tsx` component (skip if DM task already created it)
- [ ] Update `Message.tsx` to render placeholder when `message.isDeleted === true` (skip if DM task already did this)

### Search & Indexing
- [ ] Update `SearchService.ts` to exclude deleted messages from search results
- [ ] Verify search doesn't break with deleted messages

### i18n
- [ ] Run `yarn lingui:extract` to extract translation strings (skip if DM task already did this)
- [ ] Run `yarn lingui:compile` to compile messages
- [ ] Verify placeholder text appears correctly in UI

### Testing
- [ ] Manual test: Delete own message in Channel (should show placeholder)
- [ ] Manual test: Moderator deletes another user's message (placeholder should not reveal moderator)
- [ ] Manual test: Space owner deletes message (same as moderator)
- [ ] Manual test: Try to delete placeholder (delete button should not appear)
- [ ] Manual test: Delete pinned message (should unpin and show placeholder)
- [ ] Manual test: Delete message with reactions (reactions should be cleared)
- [ ] Manual test: Delete message with replies (reply should still show, parent is placeholder)
- [ ] Manual test: Search for deleted message content (should not appear in results)
- [ ] Manual test: Delete in read-only channel (only managers can delete)
- [ ] Test on web platform
- [ ] Test on mobile platform (if applicable)
- [ ] Test offline deletion propagation

### Code Quality
- [ ] Run `cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit"` to verify TypeScript
- [ ] Ensure all three deletion locations use identical placeholder creation logic
- [ ] Add comments explaining placeholder approach

### Documentation
- [ ] Update this task with any deviations or learnings
- [ ] Document that placeholders are permanent (cannot be deleted)
- [ ] Document that moderator identity is not revealed in placeholder

---

## Privacy Considerations

### Who Deleted This Message?

**Design Decision**: **Do NOT reveal who deleted the message**

**Reasoning**:
- Protects moderator privacy
- Prevents targeting of moderators
- Consistent with industry standards (Discord, Slack)

**Implementation**:
```tsx
// Same placeholder for all deletions
<Text>This message was deleted</Text>

// NOT:
<Text>This message was deleted by @Moderator</Text>
```

**Exception**: If user deletes their own message, show:
```tsx
<Text>You deleted this message</Text>
```

### Metadata Retained

- ✅ **Content deleted**: Text, images, videos permanently removed
- ✅ **Reactions cleared**: No reactions on placeholder
- ✅ **Unpinned**: Deleted messages cannot be pinned
- ⚠️ **Metadata kept**: Timestamp, sender address (needed for rendering)

---

## Success Criteria

✅ Users can delete messages in Channels (own messages, moderators, space owners)
✅ **Placeholder appears** for all deleted messages with text "This message was deleted"
✅ **Own deletions** show "You deleted this message"
✅ **Moderator identity hidden** - placeholder doesn't reveal who deleted
✅ Message content permanently removed (privacy maintained)
✅ **Placeholder cannot be deleted** (permanent conversation marker)
✅ Pinned messages are unpinned when deleted
✅ Reactions are cleared when deleted
✅ Deleted messages don't appear in search results
✅ Reply chains still make sense when parent is deleted
✅ Mobile and desktop platforms both work correctly
✅ No TypeScript errors, no crashes

---

## Estimated Timeline

| Task | Time Estimate |
|------|--------------|
| Add deletion metadata to Message type (if needed) | 15 minutes |
| Create DeletedMessagePlaceholder component (if needed) | 30 minutes |
| Update Message.tsx to render placeholder (if needed) | 30 minutes |
| Modify backend deletion logic (3 locations) | 1.5 hours |
| Update cache invalidation logic | 30 minutes |
| Update `canDeleteMessages` permission check | 15 minutes |
| Update SearchService to exclude deleted messages | 15 minutes |
| Add i18n strings and compile (if needed) | 15 minutes |
| Test on web platform | 1 hour |
| Test on mobile platform | 30 minutes |
| Test edge cases (moderators, pins, reactions, search) | 1 hour |
| Code review and TypeScript checks | 30 minutes |
| Documentation updates | 15 minutes |
| **Total (if DM task NOT done)** | **~7-8 hours** |
| **Total (if DM task DONE first)** | **~3-4 hours** |

**Note**: Timeline is shorter if DM deletion placeholders are implemented first, as the component and type changes will be reused.

---

## Coordination with DM Deletion Task

### If DM Task is Implemented First

**Reuse from DM task**:
- ✅ Message type changes (`isDeleted`, `deletedAt`, `deletedBy`)
- ✅ `DeletedMessagePlaceholder` component
- ✅ `Message.tsx` placeholder rendering
- ✅ i18n strings

**Only implement**:
- Backend changes (3 locations in MessageService.ts)
- UI permission update (useChannelMessages.ts)
- Cache invalidation update
- Search exclusion
- Channel-specific testing

**Time savings**: ~4 hours (only ~3-4 hours of work)

### If Implementing Independently

Follow all steps as documented above.

**Total time**: ~7-8 hours

---

## References

- **Backend deletion logic**: `src/services/MessageService.ts:192-268` (saveMessage), `src/services/MessageService.ts:414-503` (handleNewMessage)
- **Channel permission check**: `src/hooks/business/channels/useChannelMessages.ts:73-119`
- **Message rendering**: `src/components/message/Message.tsx`
- **Search service**: `src/services/SearchService.ts`
- **Data architecture guide**: `.agents/docs/data-management-architecture-guide.md`
- **Related task**: `.agents/tasks/dm-message-deletion.md` (DM deletion placeholders)

---

## Design Decisions

**Key decisions made** (2025-10-05):
- ✅ Use placeholders for better UX (prevent confusing gaps)
- ✅ Placeholder is **permanent** - cannot be individually deleted
- ✅ **Hide moderator identity** - privacy protection
- ✅ Clear content but keep message structure for placeholder
- ✅ Unpin deleted messages automatically
- ✅ Clear reactions on deleted messages
- ✅ Exclude from search results
- ✅ Preserve conversation context (reply chains, flow)

---


_Last Updated: 2025-10-05_
