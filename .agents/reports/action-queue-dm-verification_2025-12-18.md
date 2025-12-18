# Action Queue DM Implementation Verification Report

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Executive Summary

This report analyzes the action queue implementation for Direct Messages (DMs) to verify correctness and identify any gaps compared to Space message handling.

**Critical Finding**: DM reactions and deletes that go through the action queue **crash** when trying to access space keys that don't exist for DMs. The optimistic UI works, but the actions are never sent to the other party - **both online and offline**.

**Overall Assessment**: 🔴 **Bug Found** - Secondary actions (reactions, deletes) in DMs are routed to action queue handlers that call `submitChannelMessage`. This function tries to get a space key for signing, but DM addresses have no space keys, causing the operation to fail silently.

## Scope & Methodology

- **Scope**: All action queue handlers and their DM vs Space message handling paths
- **Methodology**: Static code analysis of ActionQueueHandlers.ts, MessageService.ts, useMessageActions.ts, MessageEditTextarea.tsx, and DirectMessage.tsx
- **Files Analyzed**:
  - [ActionQueueHandlers.ts](src/services/ActionQueueHandlers.ts)
  - [MessageService.ts](src/services/MessageService.ts)
  - [useMessageActions.ts](src/hooks/business/messages/useMessageActions.ts)
  - [MessageEditTextarea.tsx](src/components/message/MessageEditTextarea.tsx)
  - [DirectMessage.tsx](src/components/direct/DirectMessage.tsx)
  - [actionQueue.ts](src/types/actionQueue.ts)

## Why DMs Work Differently Than Space Messages

### Encryption Differences

| Aspect | Space Messages | DM Messages |
|--------|----------------|-------------|
| **Algorithm** | Triple Ratchet (single state) | Double Ratchet (per-device states) |
| **Encryption States** | 1 per space | N per device inbox |
| **Recipients** | All space members via Hub | Specific device inboxes via WebSocket |
| **Identity Revelation** | Always known (space members) | Hidden until reply (sender params needed) |
| **Publishing** | `sendHubMessage()` | `sendDirectMessages()` with listen+direct pairs |

### ID Structure Differences

- **Space Messages**: `spaceId` + `channelId` (distinct IDs)
- **DM Messages**: `address` used for both `spaceId` and `channelId` fields

### Sender Identity in DMs

DMs require special handling for sender identity revelation. The recent fix (commit `0c381702`) added `senderDisplayName` and `senderUserIcon` parameters to Double Ratchet encryption functions, ensuring recipients can see sender identity before accepting the conversation.

## Findings

### Finding 1: Post Messages - Correctly Use Action Queue

**Status**: ✅ **Correct**

**Evidence**: [MessageService.ts:1520-1532](src/services/MessageService.ts#L1520-L1532)

```typescript
await this.actionQueueService.enqueue(
  'send-dm',
  {
    address,
    signedMessage: message,
    messageId: messageIdHex,
    self,
    counterparty,
    keyset,
    senderDisplayName: currentPasskeyInfo.displayName,
    senderUserIcon: currentPasskeyInfo.pfpUrl,
  },
  `send-dm:${address}:${messageIdHex}`
);
```

The `send-dm` handler in ActionQueueHandlers.ts correctly:
- Uses Double Ratchet encryption for each target inbox
- Passes sender identity parameters (`senderDisplayName`, `senderUserIcon`)
- Handles multiple device inboxes
- Cleans up stale encryption states
- Saves encryption states after sending

### Finding 2: Reactions - BUG: Wrong Encryption for DMs

**Status**: 🔴 **Bug - Wrong Protocol**

**Evidence**: [useMessageActions.ts:96-106](src/hooks/business/messages/useMessageActions.ts#L96-L106)

The condition `!spaceId || !channelId` is **false** for DMs because:
- `spaceId` = address (from `message.spaceId`)
- `channelId` = address (from `message.channelId`)

So DMs go through the **action queue path**, not the fallback!

**What Actually Happens**:
1. `useMessageActions.handleReaction()` checks `!spaceId || !channelId` → **false** for DMs
2. DMs go to action queue: `actionQueueService.enqueue('reaction', { spaceId: address, channelId: address, ... })`
3. Handler calls `submitChannelMessage(address, address, reactionMessage, ...)`
4. `submitChannelMessage` treats reaction as "post message" (not edit, pin, or update-profile)
5. Tries to get space: `getSpace(address)` → **returns null** (DM address is not a space)
6. Tries to sign: `getSpaceKey(address, 'inbox')` → **returns undefined** (no space key for DMs)
7. **CRASHES**: `inboxKey.publicKey` fails because `inboxKey` is undefined

**Impact**:
- ✅ Optimistic UI works (reaction appears immediately)
- ✅ Action gets queued and shows in offline banner
- ❌ **Execution fails** - no space key exists for DM address
- ❌ **Fails silently** - error caught somewhere, action marked failed
- ❌ **Other party never receives the reaction** - both online AND offline

### Finding 3: Delete Message - BUG: Crashes for DMs

**Status**: 🔴 **Bug - Execution Fails**

**Evidence**: [useMessageActions.ts:227-235](src/hooks/business/messages/useMessageActions.ts#L227-L235)

Same issue as reactions - the condition `!spaceId || !channelId` is **false** for DMs.

**What Actually Happens**:
1. `useMessageActions.handleDelete()` checks `!spaceId || !channelId` → **false** for DMs
2. DMs go to action queue: `actionQueueService.enqueue('delete-message', { spaceId: address, channelId: address, ... })`
3. Handler calls `submitChannelMessage(address, address, deleteMessage, ...)`
4. `submitChannelMessage` treats `remove-message` as "post message" (not edit, pin, or update-profile)
5. Tries to get space key: `getSpaceKey(address, 'inbox')` → **returns undefined**
6. **CRASHES**: accessing `inboxKey.publicKey` on undefined

**Impact**:
- ✅ Optimistic UI works (message disappears immediately)
- ✅ Local DB updated (message deleted locally)
- ✅ Action gets queued and shows in offline banner
- ❌ **Execution fails** - no space key exists for DM address
- ❌ **Other party never receives the delete** - message remains on their device
- ❌ **Broken both online AND offline**

### Finding 4: Edit Message - Explicitly Skips Action Queue for DMs

**Status**: ⚠️ **Intentionally Different**

**Evidence**: [MessageEditTextarea.tsx:318-334](src/components/message/MessageEditTextarea.tsx#L318-L334)

```typescript
// Use action queue for space channels, fallback for DMs
if (actionQueueService && currentPasskeyInfo && !isDM) {
  await actionQueueService.enqueue(
    'edit-message',
    { ... },
    `edit:${currentSpaceId}:${currentChannelId}:${message.messageId}`
  );
} else {
  // Fallback for DMs or missing context
  await submitMessage(editMessage);
}
```

**Explicit Check**: `!isDM` condition explicitly routes DMs away from action queue.

**DM Path**: Uses `submitMessage()` which has inline edit handling at [MessageService.ts:1543-1735](src/services/MessageService.ts#L1543-L1735).

**Impact**:
- DM edits work correctly via Double Ratchet encryption
- No action queue benefits (retry, persistence, crash recovery)

### Finding 5: Pin/Unpin - Not Applicable to DMs

**Status**: ✅ **N/A - Space-Only Feature**

Pin/unpin actions are only used in Space contexts. The handlers call `submitChannelMessage` which uses Triple Ratchet encryption - incompatible with DMs.

### Finding 6: Moderation Actions - Not Applicable to DMs

**Status**: ✅ **N/A - Space-Only Feature**

Kick, mute, and unmute actions are Space-only moderation features.

### Finding 7: Action Queue Handler for DMs is Complete

**Status**: ✅ **Correct**

The `sendDm` handler in [ActionQueueHandlers.ts:548-770](src/services/ActionQueueHandlers.ts#L548-L770) correctly implements:

1. **Multi-device encryption**: Encrypts for all target inboxes
2. **Sender identity**: Passes `senderDisplayName` and `senderUserIcon`
3. **Forced sender init**: Handles `ForceSenderInit` for first messages
4. **Stale state cleanup**: Removes encryption states for deleted devices
5. **Proper error handling**: Distinguishes permanent vs retryable errors
6. **Status updates**: Updates message sendStatus on success/failure
7. **Cache management**: Re-adds messages to React Query cache if removed

## Summary: Action Type Coverage for DMs

| Action Type | DM Support | Method Used | Status |
|-------------|------------|-------------|--------|
| `send-dm` | ✅ Full | Action Queue | ✅ Correct - Double Ratchet |
| `send-channel-message` | ❌ N/A | - | Space-only (Triple Ratchet) |
| `reaction` | 🔴 Broken | Action Queue → `submitChannelMessage` | **BUG: Crashes - no space key** |
| `delete-message` | 🔴 Broken | Action Queue → `submitChannelMessage` | **BUG: Crashes - no space key** |
| `edit-message` | ⚠️ Online only | Legacy `enqueueOutbound` | Works but no offline support |
| `pin-message` | ❌ N/A | - | Space-only feature |
| `unpin-message` | ❌ N/A | - | Space-only feature |
| `kick-user` | ❌ N/A | - | Space-only feature |
| `mute-user` | ❌ N/A | - | Space-only feature |
| `unmute-user` | ❌ N/A | - | Space-only feature |
| `save-user-config` | ✅ Full | Action Queue | Global, not DM-specific |
| `update-space` | ❌ N/A | - | Space-only feature |

## Recommendations

### Fix Options

There are two approaches to fix this bug:

#### Option A: Quick Fix - Route to Legacy Path (No Offline Support)

Route DMs to the legacy `onSubmitMessage` path by adding DM detection:

```typescript
// Current (broken for DMs):
if (!spaceId || !channelId || !currentPasskeyInfo) {

// Fixed (routes DMs to legacy path):
const isDM = spaceId === channelId;
if (!spaceId || !channelId || !currentPasskeyInfo || isDM) {
```

**Pros**: Simple, quick to implement
**Cons**: DM reactions/deletes won't work offline (requires active WebSocket)

#### Option B: Proper Fix - Add DM-Specific Action Queue Handlers (Offline Support)

Create new action queue handlers that use Double Ratchet encryption:
- `reaction-dm` - for DM reactions
- `delete-dm` - for DM message deletion
- `edit-dm` - for DM message editing (currently uses legacy path with no offline support)

These handlers would work like `send-dm` - using Double Ratchet encryption and WebSocket transport.

**Pros**: Full offline support for all DM actions, consistent with `send-dm` behavior
**Cons**: More code, requires passing `self`, `counterparty`, `keyset` context

### Recommended Approach

**Option B is recommended** because:
1. DMs already have `send-dm` handler that works offline - reactions/deletes should too
2. The context needed (`self`, `counterparty`, `keyset`) is available in `useMessageActions` via `useMessageDB`
3. Maintains consistent UX - users expect offline actions to queue and sync later

### Implementation Steps

1. **Add new action types** in `actionQueue.ts`:
   ```typescript
   | 'reaction-dm'
   | 'delete-dm'
   | 'edit-dm'
   ```

2. **Create handlers** in `ActionQueueHandlers.ts`:
   - Copy the Double Ratchet encryption logic from `sendDm` handler
   - Adapt for reaction/delete/edit message types
   - Each handler wraps the message content appropriately and sends via WebSocket

3. **Update `useMessageActions.ts`**:
   - Detect DMs: `const isDM = spaceId === channelId`
   - Route DM reactions to `reaction-dm` handler
   - Route DM deletes to `delete-dm` handler
   - Pass required context: `self`, `counterparty`, `keyset`

4. **Update `MessageEditTextarea.tsx`**:
   - Route DM edits to `edit-dm` handler instead of legacy path
   - Pass required context: `self`, `counterparty`, `keyset`

5. **Add integration tests** for DM action paths

## Action Items

- [ ] **Add `reaction-dm`, `delete-dm`, `edit-dm` action types** - Priority: Critical
- [ ] **Create DM-specific handlers** using Double Ratchet - Priority: Critical
- [ ] **Update useMessageActions.ts** to route DM reactions/deletes to new handlers - Priority: Critical
- [ ] **Update MessageEditTextarea.tsx** to route DM edits to new handler - Priority: Critical
- [ ] **Test fix** - Verify reactions/deletes/edits are received by other DM party (online & offline)
- [ ] **Create integration tests** for DM action paths - Priority: High

## Related Documentation

- [Action Queue Documentation](../.agents/docs/features/action-queue.md)
- [MessageDB Documentation](../.agents/docs/features/messagedb.md)
- Background Action Queue Task: `.agents/tasks/.done/background-action-queue.md`

## Appendix

### Code Flow Diagram: DM Post Message

```
DirectMessage.tsx
  └─> handleSubmitMessage()
      └─> submitMessage() [MessageService.ts:1402]
          └─> isPostMessage = true
              └─> Create signed message
              └─> addMessage() with sendStatus: 'sending' (optimistic)
              └─> actionQueueService.enqueue('send-dm', ...)
                  └─> ActionQueueHandlers.sendDm.execute()
                      └─> Double Ratchet encryption per inbox
                      └─> sendDirectMessages()
                      └─> updateMessageStatus('sent')
```

### Code Flow Diagram: DM Reaction (Legacy)

```
Message.tsx
  └─> handleReaction()
      └─> useMessageActions.handleReaction()
          └─> !spaceId check → true (DM context)
              └─> onSubmitMessage({ type: 'reaction', ... })
                  └─> submitMessage() [MessageService.ts:1402]
                      └─> isReaction = true
                          └─> enqueueOutbound() [legacy flow]
                              └─> Double Ratchet encryption
                              └─> sendDirectMessages()
```

---

_Created: 2025-12-18_
_Report Type: Implementation Verification_
