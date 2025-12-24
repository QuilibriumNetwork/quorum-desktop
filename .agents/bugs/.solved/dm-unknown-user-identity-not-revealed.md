# DM Shows "Unknown User" After Conversation Starts

> **✅ FIXED**: 2025-12-18

## Symptoms

1. **Non-deterministic behavior** - Sometimes DM recipients show as "Unknown User" even after conversation is established
2. **Both parties affected** - Both sender and recipient may see each other as "Unknown User"
3. **Observed after starting conversation** - Initially user shows as account address (expected), but after messages are exchanged they may show as "Unknown User" instead of revealing identity
4. **Avatar also affected** - Default avatar (?) shown instead of user's actual avatar

### Expected Behavior
- Before first message: Recipient shows as "Unknown User" with default avatar
- After recipient REPLIES: Sender should see recipient's real displayName and avatar
- Vice versa: Recipient should see sender's real displayName and avatar after receiving their first message

### Actual Behavior (observed after recent changes)
- Before first message: Recipient shows as **account address** (truncated) instead of "Unknown User"
- After conversation starts, one or both parties may still see "Unknown User" or account address
- Identity is not revealed even when it should be
- This behavior was NOT present before the work done in this branch

## Environment

- **Branch**: cross-platform_action-queue
- **Observed**: 2025-12-18
- **Confirmed regression**: Introduced in commit `94d51813` (2025-10-13) "Translate and compile - fix some ts errors"

## Root Cause Found

### Issue 1: Changed Fallback Pattern (Address shown instead of "Unknown User")

**Develop branch** used `mapSenderToUser()` with built-in fallback:
```typescript
const mapSenderToUser = (senderId: string) => {
  return members[senderId] || {
    displayName: 'Unknown User',  // Always "Unknown User" if not in members
    userIcon: '/unknown.png',
  };
};
// Usage: mapSenderToUser(address).displayName
```

**Current branch** uses `otherUser` with address fallback:
```typescript
const otherUser = members[address!] || {
  displayName: t`Unknown User`,
  userIcon: DefaultImages.UNKNOWN_USER,
  address: address!,
};
// Usage: otherUser.displayName ?? otherUser.address  ← Falls back to ADDRESS!
```

The problem is **line 650, 770, etc.** in DirectMessage.tsx:
```typescript
{otherUser.displayName ?? otherUser.address}
```

When `conversation.conversation.displayName` is `undefined` (not the string "Unknown User"), the `??` operator falls back to showing the **address** instead of "Unknown User".

### Why displayName becomes undefined

In the current branch, `NewDirectMessageModal` explicitly saves the conversation with `displayName: t"Unknown User"`. However, the issue occurs when:

1. User navigates to DM before the conversation is saved
2. Or conversation exists but `displayName` field is missing/undefined
3. The `members` map uses `conversation.conversation.displayName` directly without fallback

## Initial Analysis

### How DM Identity Revelation Should Work

1. **Sender initiates DM** → Creates conversation with `displayName: "Unknown User"` in IndexedDB
2. **Recipient receives message** → `envelope.display_name` contains sender's real name
3. **`updatedUserProfile` is set** in MessageService.ts when `envelope.user_address != self_address`
4. **`addOrUpdateConversation()` called** with `updatedUserProfile` → Updates React Query cache
5. **UI renders** with revealed identity

### Potential Issue Areas

#### 1. React Query Cache Only (No Persistence)
The `addOrUpdateConversation` function in [MessageDB.tsx:315-379](src/components/context/MessageDB.tsx#L315-L379) only updates React Query cache, NOT IndexedDB:
```typescript
const addOrUpdateConversation = (
  queryClient: QueryClient,
  address: string,
  timestamp: number,
  lastReadTimestamp: number,
  updatedUserProfile?: Partial<secureChannel.UserProfile>
) => {
  // Only updates queryClient.setQueryData() - NO messageDB.saveConversation()
};
```

This means:
- Identity revealed in memory but not persisted
- On app restart/refresh, conversation loaded from IndexedDB with old "Unknown User" value
- **However**, this doesn't explain why it fails DURING a session

#### 2. Conditional Profile Setting
In [MessageService.ts:2001-2006](src/services/MessageService.ts#L2001-L2006):
```typescript
if (envelope.user_address != self_address) {
  updatedUserProfile = {
    user_address: envelope.user_address,
    user_icon: envelope.user_icon,
    display_name: envelope.display_name,
  };
}
```

The condition `envelope.user_address != self_address` should be correct, but need to verify:
- Is `self_address` always properly set?
- Could there be a race condition where `self_address` is undefined?

#### 3. Multiple Code Paths
DM messages can be received through different paths:
- **New session** (first message): Lines ~1956-2067
- **Existing session** (subsequent messages): Lines ~2079-3240
- **ConfirmDoubleRatchetSenderSession** (reply confirmation): Lines ~2103-2117

Each path has its own `updatedUserProfile` handling - inconsistency could cause issues.

#### 4. Fallback to Existing Values
When `updatedUserProfile` is undefined, code falls back to existing conversation values:
```typescript
updatedUserProfile ?? {
  user_icon: conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
  display_name: conversation?.conversation?.displayName ?? t`Unknown User`,
}
```

If `updatedUserProfile` isn't set correctly, the fallback perpetuates "Unknown User".

## Files Involved

- [src/services/MessageService.ts](src/services/MessageService.ts) - DM message handling, profile extraction
- [src/components/context/MessageDB.tsx](src/components/context/MessageDB.tsx) - `addOrUpdateConversation` function
- [src/components/direct/DirectMessage.tsx](src/components/direct/DirectMessage.tsx) - DM UI, members map creation
- [src/hooks/business/conversations/useDirectMessageData.ts](src/hooks/business/conversations/useDirectMessageData.ts) - DM data hook
- [src/components/modals/NewDirectMessageModal.tsx](src/components/modals/NewDirectMessageModal.tsx) - Initial conversation creation

## Reproduction Steps

1. User A initiates new DM with User B (who User A has never messaged)
2. User A sends a message
3. User B receives and replies
4. **Observe**: Does User A see User B's real name/avatar?
5. **Observe**: Does User B see User A's real name/avatar?

## Investigation TODO

- [ ] Add debug logging to trace `updatedUserProfile` through message receive paths
- [ ] Verify `self_address` is always set when messages are received
- [ ] Check if `envelope.display_name` is actually populated in incoming messages
- [ ] Test with fresh conversation (no existing IndexedDB data)
- [ ] Check React Query cache state before/after message receive
- [ ] Verify `invalidateConversation` is triggering UI re-render

## Partial Fix Applied (Minor Issue)

Fixed the regression where address was shown instead of "Unknown User":

### Files Modified

- **src/components/direct/DirectMessage.tsx:167-168** - Added `?? t"Unknown User"` and `?? DefaultImages.UNKNOWN_USER` fallbacks
- **src/hooks/business/conversations/useDirectMessageData.ts:51-52** - Same fix applied

### Code Change

```typescript
// Before (buggy):
displayName: conversation.conversation!.displayName,
userIcon: conversation.conversation!.icon,

// After (fixed):
displayName: conversation.conversation!.displayName ?? t`Unknown User`,
userIcon: conversation.conversation!.icon ?? DefaultImages.UNKNOWN_USER,
```

This ensures that when `displayName` is `undefined`, we show "Unknown User" instead of the address.

## Main Issue - Root Cause Found & Fixed

**Debug output revealed**:
```
display_name: undefined, user_icon: 'missing'
```

The sender's `display_name` and `user_icon` were NOT being included in the encrypted envelope.

### Root Cause

The Double Ratchet encryption functions accept optional `sender_name` and `sender_photo` parameters, but we were passing `undefined, undefined`:

```typescript
// ActionQueueHandlers.ts - BEFORE (broken)
await secureChannel.NewDoubleRatchetSenderSession(
  keyset.deviceKeyset,
  self.user_address,
  targetDevice,
  JSON.stringify(messageToEncrypt),
  undefined,  // sender_name - NOT PASSED!
  undefined   // sender_photo - NOT PASSED!
)
```

### Fix Applied

1. **MessageService.ts** - Pass `currentPasskeyInfo.displayName` and `currentPasskeyInfo.pfpUrl` in the ActionQueue context
2. **ActionQueueHandlers.ts** - Extract and pass these values to all three Double Ratchet encryption functions:
   - `NewDoubleRatchetSenderSession`
   - `DoubleRatchetInboxEncryptForceSenderInit`
   - `DoubleRatchetInboxEncrypt`

```typescript
// ActionQueueHandlers.ts - AFTER (fixed)
await secureChannel.NewDoubleRatchetSenderSession(
  keyset.deviceKeyset,
  self.user_address,
  targetDevice,
  JSON.stringify(messageToEncrypt),
  senderDisplayName,  // Now passed!
  senderUserIcon      // Now passed!
)
```

## Related

- [dm-send-fails-address-undefined.md](dm-send-fails-address-undefined.md) - Recent DM sending fix (different issue)

---

_Created: 2025-12-18_
_Fixed: 2025-12-18_
