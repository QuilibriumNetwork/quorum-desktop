# Direct Message Deletion Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

Enable users to delete their own messages in private conversations (DirectMessage), matching the existing deletion behavior used in Channels.

**Status**: Pending
**Priority**: Medium
**Complexity**: Low (~6-8 hours)
**Type**: Feature parity

**Related Files**:
- `src/components/direct/DirectMessage.tsx:483`
- `src/services/MessageService.ts:192-268`
- `src/hooks/business/messages/useMessageActions.ts`
- `src/hooks/business/channels/useChannelMessages.ts` (reference implementation)

---

## Context

Currently, users **cannot delete any messages** in private conversations - the UI hardcodes `canDeleteMessages={() => false}` in DirectMessage.tsx:483.

However:
- ✅ **Backend infrastructure fully supports deletion** (same code path as Channels)
- ✅ **Channels already allow users to delete their own messages**
- ✅ Encryption, WebSocket propagation, IndexedDB deletion all working
- ❌ **Only UI permission check is blocking DM deletions**

This creates **inconsistent UX** - users can delete their own messages in Channels but not in DMs.

---

## Arguments FOR the Feature

### User Experience
1. **Mistake correction**: Fix typos, wrong recipient, accidental sends
2. **Privacy control**: Remove sensitive information sent by mistake
3. **Feature parity**: Users expect this from other messengers (WhatsApp, Telegram, Signal, Discord)
4. **Consistency**: Aligns with existing Channel deletion behavior
5. **User autonomy**: Basic expectation in modern messaging - "my message, my control"

### Technical
6. **Infrastructure exists**: Backend already handles deletion - only need to enable UI permission
7. **Low implementation cost**: Minimal changes required
8. **No new complexity**: Uses existing hard-delete mechanism from Channels

---

## Arguments AGAINST the Feature

### Trust & Security
1. **Immutability philosophy**: Conflicts with Quorum's non-repudiable messaging approach
2. **Evidence removal**: Could delete proof of harassment, threats, or agreements
3. **Shared history**: In E2E encrypted P2P conversations, unilateral deletion breaks trust model
4. **Legal implications**: Deleted messages might be needed for dispute resolution

### UX Concerns
5. **Confusion**: "Why did this message disappear?" - recipient sees gap in conversation
6. **Asymmetric state risk**: If one user is offline or on older client, they won't see deletion
7. **Trust erosion**: Recipient might feel gaslit if messages vanish unexpectedly

### Philosophical
8. **Different from Channels**: DMs lack governance (roles/owners) that provide deletion authority in Channels
9. **P2P permanence**: DMs as permanent record between two equal parties

---

## Proposed Implementation

### Goal: Hard Delete with Placeholder (Better UX)

Improve upon the current Channel deletion behavior by adding placeholders:
- Message **content is permanently removed** (hard delete for privacy)
- **Placeholder remains** to preserve conversation context
- Time-limited deletion window (1 hour)
- Bidirectional: both sender and receiver see placeholder

**Why placeholders improve UX:**
- Prevents confusing gaps in conversation
- Preserves reply chain context
- Honest transparency (user knows something was deleted)
- Matches industry standard (WhatsApp, Telegram, Signal)

**Placeholder is permanent** - cannot be individually deleted, but entire conversation can be deleted (local only)

---

## Implementation Details

### 1. Add Deletion Metadata to Message Type

**File**: `src/api/quorumApi.ts`

**Add optional deletion fields to Message type**:
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

---

### 2. Enable UI Permission Check

**File**: `src/components/direct/DirectMessage.tsx:483`

**Current**:
```typescript
canDeleteMessages={() => false}
```

**Change to**:
```typescript
canDeleteMessages={useCallback((message: MessageType) => {
  const userAddress = user.currentPasskeyInfo?.address;
  if (!userAddress) return false;

  // Cannot delete if already deleted (placeholder)
  if (message.isDeleted) {
    return false;
  }

  // Only allow deleting own messages
  const isOwn = message.content.senderId === userAddress;

  // Time limit: 1 hour (matching typical messenger behavior)
  const age = Date.now() - message.createdDate;
  const ONE_HOUR = 60 * 60 * 1000;
  const withinTimeLimit = age < ONE_HOUR;

  return isOwn && withinTimeLimit;
}, [user.currentPasskeyInfo])}
```

**Note**:
- Wrap in `useCallback` to prevent unnecessary re-renders
- Prevent deletion of placeholders (can't delete a deletion)

---

### 3. Modify Backend to Create Placeholder (CRITICAL)

**File**: `src/services/MessageService.ts:209-214`

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
  // Server-side time validation to prevent client-side bypass
  const messageAge = Date.now() - targetMessage.createdDate;
  const ONE_HOUR = 60 * 60 * 1000;

  if (messageAge > ONE_HOUR) {
    console.warn('⚠️ Deletion rejected: Message too old', {
      messageId: targetMessage.messageId,
      age: messageAge,
      limit: ONE_HOUR
    });
    return; // Reject deletion
  }

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

**Why This is Critical**:
- Client-side checks can be bypassed (system time manipulation, code modification)
- Backend validation ensures security even with malicious clients
- Prevents deletion of old messages that should be permanent
- Clears content but preserves message structure for placeholder

---

### 4. Create Deleted Message Placeholder Component

**File**: `src/components/message/DeletedMessagePlaceholder.tsx` (new file)

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

**Note**: Uses primitives (`FlexRow`, `Text`, `Icon`) for cross-platform compatibility.

---

### 5. Update Message Component to Render Placeholder

**File**: `src/components/message/Message.tsx`

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

### 6. Add React Query Cache Invalidation

**File**: `src/components/direct/DirectMessage.tsx` (in handleSubmitMessage or similar)

**Add after deletion message is submitted**:
```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// After submitting remove-message
const isDeletion =
  typeof message === 'object' &&
  'type' in message &&
  message.type === 'remove-message';

if (isDeletion) {
  // Invalidate conversation messages cache
  queryClient.invalidateQueries({
    queryKey: ['messages', conversationId]
  });
}
```

**Note**: Check existing Channel implementation for exact query key pattern used.

---

### 7. Add i18n Strings

**File**: `src/i18n/en/messages.po` (auto-generated by `yarn lingui:extract`)

The following strings will be extracted automatically when you run the extract command:
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

### 8. Verify Existing Mobile Compatibility

**Note**: `DirectMessage.tsx` is currently a **shared component** in `src/components/direct/` (not platform-specific). The deletion logic relies on `useMessageActions` hook which is already shared across platforms.

**What to verify**:
- Deletion confirmation modal works on touch devices (uses existing `ConfirmationModal` primitive)
- `useMessageActions` hook properly handles deletion on both platforms
- No platform-specific issues with `canDeleteMessages` callback

**No changes needed** - the existing architecture handles this through:
1. **Shared DirectMessage component** uses primitives (cross-platform by design)
2. **useMessageActions hook** contains business logic (platform-agnostic)
3. **ConfirmationModal primitive** adapts to platform automatically

**Testing focus**:
- Test deletion on mobile/touch devices to ensure modal appears correctly
- Verify Shift+click bypass only works on desktop (touch devices don't have Shift key)

---

## Edge Cases to Handle

| Scenario | Expected Behavior | Implementation Notes |
|----------|-------------------|---------------------|
| **Offline recipient** | Delete queued, applied when reconnected | Already handled by WebSocket queue |
| **Message older than 1 hour** | Deletion blocked (no delete button shown) | UI check + backend validation |
| **User deletes then goes offline** | Deletion propagates when reconnected | Existing queue mechanism handles this |
| **Both users delete simultaneously** | Both deletions succeed (idempotent) | Message already gone = success |
| **Recipient on old client version** | Old client ignores delete event | Acceptable degradation |
| **Delete message with reactions** | Reactions cleared, placeholder has no reactions | Clear reactions when setting isDeleted |
| **Delete message that was replied to** | Reply still shows, parent shows placeholder | Reply preview should handle deleted parent gracefully |
| **Try to delete placeholder** | Delete button not shown | UI check: `if (message.isDeleted) return false` |
| **Delete conversation after deleting message** | Local: conversation gone. Receiver: conversation with placeholder intact | No conflict - different scopes |
| **Delete pinned message** | Cannot pin DM messages currently | N/A for DMs |

---

## Implementation Checklist

### Type System & Data Model
- [ ] Add `isDeleted`, `deletedAt`, `deletedBy` fields to `Message` type in `src/api/quorumApi.ts`
- [ ] Ensure TypeScript compilation passes with new fields

### Core Functionality
- [ ] Create `DeletedMessagePlaceholder.tsx` component using primitives
- [ ] Update `Message.tsx` to render placeholder when `message.isDeleted === true`
- [ ] Update `canDeleteMessages` in `DirectMessage.tsx` to:
  - Allow own-message deletion with time limit
  - Prevent deletion of already-deleted messages (placeholders)
- [ ] Modify backend in `MessageService.ts` to:
  - Add time validation (CRITICAL - prevent bypass)
  - Save message with `isDeleted: true` instead of deleting
  - Clear sensitive content (text, images, etc.)
- [ ] Add React Query cache invalidation after deletion
- [ ] Test deletion propagates to recipient in real-time
- [ ] Test placeholder appears for both sender and receiver

### UX & Consistency
- [ ] Ensure confirmation modal appears (use existing `ConfirmationModal`)
- [ ] Support Shift+click bypass on desktop (match Channel behavior)
- [ ] Verify mobile/touch devices always show confirmation (no bypass)
- [ ] Test deletion works on both web and mobile platforms

### Edge Cases
- [ ] Test offline deletion (queue + sync when online)
- [ ] Test time limit enforcement (UI and backend)
- [ ] Test deletion when recipient is offline
- [ ] Test deletion with active reply-to references
- [ ] Test rapid deletion of multiple messages

### i18n
- [ ] Run `yarn lingui:extract` to extract new translation strings
- [ ] Run `yarn lingui:compile` to compile messages
- [ ] Verify placeholder text appears correctly in UI

### Testing
- [ ] Manual test: Delete own message in DM (within 1 hour)
- [ ] Manual test: Verify placeholder appears with correct text:
  - Sender sees: "You deleted this message"
  - Receiver sees: "This message was deleted"
- [ ] Manual test: Try to delete message older than 1 hour (should fail)
- [ ] Manual test: Try to delete other user's message (should not show button)
- [ ] Manual test: Try to delete a placeholder (should not show delete button)
- [ ] Manual test: Delete while recipient is offline, verify placeholder appears when they reconnect
- [ ] Manual test: Shift+click delete on desktop (should skip confirmation)
- [ ] Manual test: Touch delete on mobile (should always confirm)
- [ ] Manual test: Delete message with replies - verify reply still shows but parent is placeholder
- [ ] Manual test: Delete message with reactions - verify reactions cleared
- [ ] Manual test: Delete entire conversation - verify local cleanup works (doesn't affect receiver)
- [ ] Test backwards compatibility with older clients (they may not render placeholder correctly)

### Code Quality
- [ ] Run `cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit"` to verify TypeScript
- [ ] Ensure `useCallback` is used properly (no stale closures)
- [ ] Follow existing Channel deletion patterns for consistency
- [ ] Add comments explaining time limit logic

### Documentation
- [ ] Update this task with any deviations or learnings
- [ ] Add user-facing note about 1-hour deletion window (if needed)
- [ ] Document that deletion is bidirectional (deletes for both parties)

---

## Configuration

### Time Limit Constant

**Create a shared constant** for the deletion time window:

**File**: `src/utils/constants.ts` (or create if doesn't exist)

```typescript
// Message deletion constants
export const MESSAGE_DELETION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Alternative: Make configurable
export const getMessageDeletionWindow = () => {
  // Could read from user config in future
  return 60 * 60 * 1000; // 1 hour default
};
```

**Use in both UI and backend**:
```typescript
import { MESSAGE_DELETION_WINDOW_MS } from '../../utils/constants';

const withinTimeLimit = (Date.now() - message.createdDate) < MESSAGE_DELETION_WINDOW_MS;
```

---

## Security Considerations

### Time Limit Bypass Prevention
- ✅ **Client-side check**: Prevents UI clutter (don't show delete button for old messages)
- ✅ **Backend validation**: Prevents malicious clients from bypassing time limit
- ✅ **Server timestamp**: Use server's clock, not client's (prevents time manipulation)

### Privacy
- ✅ **Hard delete content**: Message text/images permanently removed from database
- ✅ **No recovery**: Content cannot be retrieved via API or admin tools
- ✅ **Bidirectional**: Both sender and recipient see placeholder
- ⚠️ **Metadata retained**: Timestamp, sender info kept for placeholder rendering

### Transparency & Audit Trail
- ✅ **Placeholder provides audit trail**: Both parties see deletion occurred
- ✅ **Permanent marker**: Cannot delete the deletion (prevents gaslighting)
- ✅ **Honest UX**: User knows something was removed
- ⚠️ **Detailed logs**: System doesn't log *why* message was deleted

**Conversation vs Message Deletion**:
- **Message deletion**: Bidirectional, shows placeholder to both parties
- **Conversation deletion**: Unilateral, only affects local device (receiver unaffected)

---

## Open Questions

1. **Time limit duration**: 1 hour (WhatsApp), 48 hours (Telegram), or configurable?
   - **Recommendation**: Start with 1 hour, make configurable later if needed

2. **Should we show a toast notification** after successful deletion?
   - **Recommendation**: Yes - "Message deleted" confirmation

3. **Should recipient be notified** when sender deletes a message?
   - **Recommendation**: No - notification would defeat privacy purpose

4. **What if user wants to delete messages older than 1 hour?**
   - **Recommendation**: Not supported - explain in UI tooltip "Messages can only be deleted within 1 hour"

5. **Should we add an "undo" feature** (5-second grace period)?
   - **Recommendation**: Not in v1 - can add later if users request

---

## Success Criteria

✅ Users can delete their own messages in DMs within 1-hour window
✅ Deletion propagates to recipient in real-time
✅ **Placeholder appears** for both sender and receiver with appropriate text
✅ Message content permanently removed (privacy maintained)
✅ **Placeholder cannot be deleted** (permanent conversation marker)
✅ Backend validation prevents time limit bypass
✅ Mobile and desktop platforms both work correctly
✅ No TypeScript errors, no crashes
✅ Offline deletions sync correctly when reconnected
✅ Confirmation modal appears (except Shift+click on desktop)
✅ Reply chains still make sense when parent is deleted
✅ Entire conversation deletion works independently (local only)

---

## Estimated Timeline

| Task | Time Estimate |
|------|--------------|
| Add deletion metadata to Message type | 15 minutes |
| Create DeletedMessagePlaceholder component | 30 minutes |
| Update Message.tsx to render placeholder | 30 minutes |
| Update `canDeleteMessages` UI permission | 30 minutes |
| Modify backend to create placeholder instead of delete | 1.5 hours |
| Add React Query cache invalidation | 45 minutes |
| Add i18n strings and compile | 15 minutes |
| Test on web platform | 1.5 hours |
| Test on mobile platform | 1 hour |
| Test edge cases (placeholders, replies, offline, etc.) | 2 hours |
| Code review and TypeScript checks | 30 minutes |
| Documentation updates | 30 minutes |
| **Total** | **~9-10 hours** |

---

## References

- **Current hardcoded block**: `src/components/direct/DirectMessage.tsx:483`
- **Backend deletion logic**: `src/services/MessageService.ts:192-268`
- **Channel deletion reference**: `src/hooks/business/channels/useChannelMessages.ts:73-119`
- **Delete confirmation system**: `src/hooks/business/messages/useMessageActions.ts:88-113`
- **Data architecture guide**: `.readme/docs/data-management-architecture-guide.md`
- **Feature analyzer report**: See agent analysis for detailed security and architecture review

---

## Notes from Architecture Review

**Feature-analyzer agent findings** (2025-10-05):
- ✅ Backend time validation is CRITICAL to prevent client-side bypass
- ✅ Must include React Query cache invalidation
- ✅ Must test mobile platform compatibility
- ⚠️ Consider privacy implications of bidirectional deletion
- ✅ **Updated decision**: Add placeholders for better UX (permanent markers)

**Key Design Decisions** (2025-10-05):
- ✅ Use placeholders despite "hard delete" - better UX, industry standard
- ✅ Placeholder is **permanent** - cannot be individually deleted
- ✅ Preserve conversation context (reply chains, flow)
- ✅ Clear content but keep message structure for placeholder
- ✅ Conversation deletion (local) doesn't conflict with message deletion (bidirectional)

---

_Created: 2025-10-05 by Claude Code_
_Last Updated: 2025-10-05 - Revised per feature-analyzer recommendations_
