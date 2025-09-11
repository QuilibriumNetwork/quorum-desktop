# Space Owner Delete Permissions Bug

## Issue Description

**Space owners and managers cannot delete other users' messages**, despite having the correct permissions according to our client-side logic. They can only delete their own messages.

## Current Behavior vs Expected Behavior

### ✅ RESOLVED - Final Working Behavior:
- ✅ **Users with delete role permissions**: Can delete ANY message in regular channels 
- ✅ **Space owners**: Can delete ANY message in ALL channels (inherent privilege)
- ✅ **Read-only channel managers**: Can delete ANY message in read-only channels

## Resolution Status: ✅ FULLY RESOLVED

### Key Findings

**This is NOT a regression from our read-only channels implementation.**

Through systematic regression testing, we discovered that **space owners never had delete privileges in the original system architecture**. Even in commit `4b84a8911eda3c500879121e86a1fc46728c4cd3` (before our changes), space owners could only delete their own messages.

### Root Cause Analysis: IDENTIFIED AND RESOLVED

**The issue was in the message processing logic within our own codebase** (`src/components/context/MessageDB.tsx`).

#### The Problem

The delete message processing logic was missing space owner and read-only manager privilege checks. The original logic only allowed:

1. ✅ Users to delete their own messages: `targetMessage.content.senderId === decryptedContent.content.senderId`
2. ✅ Users with role-based delete permissions in the traditional role system
3. ❌ **Missing**: Space owner privileges (inherent delete rights)
4. ❌ **Missing**: Read-only channel manager privileges

#### Investigation Process

Our debugging revealed that the client-side permission chain worked perfectly:

1. **Permission Check**: `useChannelMessages.canDeleteMessages()` correctly returned `true` for space owners
2. **UI Rendering**: Delete button correctly appeared for other users' messages
3. **Click Handling**: Delete action was correctly triggered
4. **Message Submission**: Delete request was correctly processed and sent to MessageDB

But the deletion failed silently in the **message processing logic** within `MessageDB.tsx`.

## ✅ SOLUTION IMPLEMENTED

### The Fix: MessageDB Permission Logic

We identified and fixed the missing permission checks in `src/components/context/MessageDB.tsx` in the `remove-message` processing logic:

#### Before (Broken):
```typescript
// Original logic only checked:
if (targetMessage.content.senderId === decryptedContent.content.senderId) {
  await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
  return;
}

if (spaceId != channelId) {
  const space = await messageDB.getSpace(spaceId);
  if (!space?.roles.find((r) =>
    r.members.includes(decryptedContent.content.senderId) &&
    r.permissions.includes('message:delete')
  )) {
    return;
  }
  await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
}
```

#### After (Fixed):
```typescript
// Users can delete their own messages
if (targetMessage.content.senderId === decryptedContent.content.senderId) {
  await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
  return;
}

if (spaceId != channelId) {
  const space = await messageDB.getSpace(spaceId);
  
  // 🆕 Space owners can always delete messages (inherent privilege)
  let isSpaceOwner = false;
  try {
    const ownerKey = await messageDB.getSpaceKey(spaceId, 'owner');
    isSpaceOwner = !!ownerKey;
  } catch (error) {
    // Ignore error - user is not space owner
  }
  
  if (isSpaceOwner) {
    await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
    return;
  }
  
  // 🆕 For read-only channels: check if user is a manager
  const channel = space?.groups
    ?.find(g => g.channels.find(c => c.channelId === channelId))
    ?.channels.find(c => c.channelId === channelId);
    
  if (channel?.isReadOnly && channel.managerRoleIds) {
    const isManager = space?.roles?.some(role => 
      channel.managerRoleIds?.includes(role.roleId) && 
      role.members.includes(decryptedContent.content.senderId)
    );
    if (isManager) {
      await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
      return;
    }
  }
  
  // Check for role-based delete permissions (existing logic)
  if (!space?.roles.find((r) =>
    r.members.includes(decryptedContent.content.senderId) &&
    r.permissions.includes('message:delete')
  )) {
    return;
  }
  await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
}
```

### Key Implementation Details

1. **Space Owner Check**: Used the same method as `useSpaceOwner` hook - checking for owner key via `messageDB.getSpaceKey(spaceId, 'owner')`
2. **Read-Only Manager Check**: Added lookup of channel data from space groups and checked manager role IDs
3. **Proper Order**: Space owners → Read-only managers → Traditional role permissions

## Files Modified During Implementation

### Core Fix:
- `src/components/context/MessageDB.tsx` - **MAIN FIX**: Added space owner and read-only manager permission checks to `remove-message` processing logic

### Supporting Implementation:
- `src/hooks/business/channels/useChannelMessages.ts` - Simplified client-side delete permission logic using centralized `hasPermission` utility
- `src/hooks/business/messages/useMessageActions.ts` - Simplified delete action logic
- `src/hooks/business/messages/usePinnedMessages.ts` - Applied same permission pattern for consistency

## ✅ Verification & Testing

### Test Cases - ALL PASSING:

#### Space Owner Delete Test
- **Setup**: Space owner tries to delete another user's message
- **Expected**: Message should be deleted
- **Result**: ✅ **WORKING** - Message is deleted successfully

#### Read-Only Channel Manager Delete Test  
- **Setup**: Manager role user tries to delete another user's message in read-only channel
- **Expected**: Message should be deleted
- **Result**: ✅ **WORKING** - Message is deleted successfully

#### Regular Role Delete Test
- **Setup**: User with delete permission tries to delete another user's message in regular channel
- **Expected**: Message should be deleted  
- **Result**: ✅ **WORKING** - Message is deleted successfully (unchanged, working from before)

## Key Lessons Learned

1. **Investigation Method**: Systematic debugging from client-side permission checks → UI rendering → message submission → processing logic was crucial
2. **Root Cause Location**: The issue was in our own message processing logic, not an external "server-side" system
3. **Space Owner Logic**: Space ownership is determined by key possession (`messageDB.getSpaceKey(spaceId, 'owner')`) not by address comparison
4. **Architecture Understanding**: Understanding the full message flow from UI → MessageDB processing was essential

---

**Status**: ✅ **FULLY RESOLVED AND TESTED**  
**Priority**: Complete - Core space management functionality now working correctly  
**Created**: 2025-09-11  
**Resolved**: 2025-09-11