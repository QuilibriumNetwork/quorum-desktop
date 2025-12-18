# Add DM-Specific Action Queue Handlers

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Status**: Pending
**Complexity**: High
**Created**: 2025-12-18
**Related Report**: [action-queue-dm-verification_2025-12-18.md](../reports/action-queue-dm-verification_2025-12-18.md)

**Files**:
- `src/types/actionQueue.ts`
- `src/services/ActionQueueHandlers.ts`
- `src/hooks/business/messages/useMessageActions.ts`
- `src/components/message/MessageEditTextarea.tsx`

## What & Why

**Current State**: DM reactions and deletes are broken - they route through action queue handlers that call `submitChannelMessage`, which crashes because DM addresses have no space keys. DM edits work online but have no offline support.

**Desired State**: All DM secondary actions (reactions, deletes, edits) work both online and offline using proper Double Ratchet encryption via action queue handlers.

**Value**: Users can react to, delete, and edit DM messages while offline, with changes syncing when back online - matching the behavior of sending new DM messages.

## Context

- **Existing pattern**: The `send-dm` handler in `ActionQueueHandlers.ts:548-770` correctly implements Double Ratchet encryption for DMs
- **Constraints**: Must use Double Ratchet (not Triple Ratchet) and WebSocket transport (not Hub)
- **Dependencies**: Requires `self`, `counterparty`, `keyset` context

## Shared Types & Helpers

### DM Action Context Type

Define a shared context type for all DM handlers:

```typescript
interface DmActionContext {
  address: string;
  self: secureChannel.UserRegistration;
  counterparty: secureChannel.UserRegistration;
  keyset: { deviceKeyset: any; userKeyset: any };
  senderDisplayName?: string;  // Optional for secondary actions
  senderUserIcon?: string;     // Optional for secondary actions
}
```

### Context Acquisition Helper

Add to `useMessageActions.ts`:

```typescript
// Helper to get DM context for action queue
const getDmContext = useCallback(async (address: string): Promise<DmActionContext | null> => {
  const registration = messageDB.getRegistration(address);
  if (!registration?.self || !registration?.counterparty) {
    console.warn('Missing DM registration context');
    return null;
  }
  const keyset = await messageDB.getKeyset(address);
  if (!keyset) {
    console.warn('Missing DM keyset');
    return null;
  }
  return {
    address,
    self: registration.self,
    counterparty: registration.counterparty,
    keyset,
    senderDisplayName: currentPasskeyInfo?.displayName,
    senderUserIcon: currentPasskeyInfo?.pfpUrl,
  };
}, [messageDB, currentPasskeyInfo]);
```

### Deduplication Keys

| Action Type | Dedupe Key Format |
|-------------|-------------------|
| `reaction-dm` | `reaction-dm:${address}:${messageId}:${emoji}` |
| `delete-dm` | `delete-dm:${address}:${messageId}` |
| `edit-dm` | `edit-dm:${address}:${messageId}` |

## Implementation

### Phase 1: Add Action Types

- [ ] **Add new action types** (`src/types/actionQueue.ts`)
  - Done when: Types compile without errors
  - Add after line 11:
    ```typescript
    | 'reaction-dm'
    | 'delete-dm'
    | 'edit-dm'
    ```

### Phase 2: Create DM Handlers

**Key Decision**: Extract shared Double Ratchet encryption logic into a reusable private method `encryptAndSendDm()` that all 4 DM handlers can use. This avoids duplicating 200+ lines of encryption boilerplate.

- [ ] **Extract `encryptAndSendDm()` helper method** (`src/services/ActionQueueHandlers.ts`)
  - Done when: Method extracted from `sendDm` handler and reusable
  - Contains: Double Ratchet encryption per inbox, stale state cleanup, WebSocket transport
  - Signature: `encryptAndSendDm(address, message, context: DmActionContext): Promise<void>`

- [ ] **Create `reactionDm` handler** (`src/services/ActionQueueHandlers.ts`)
  - Done when: Handler added to `getHandler()` map
  - Uses: `encryptAndSendDm()` helper
  - Context: `DmActionContext` + `reactionMessage: ReactionMessage | RemoveReactionMessage`
  - Idempotency: Re-adding same reaction is safe no-op
  - Message structure:
    ```typescript
    { type: 'reaction' | 'remove-reaction', senderId, messageId, reaction }
    ```

- [ ] **Create `deleteDm` handler** (`src/services/ActionQueueHandlers.ts`)
  - Done when: Handler added to `getHandler()` map
  - Uses: `encryptAndSendDm()` helper
  - Context: `DmActionContext` + `deleteMessage: RemoveMessage`
  - Idempotency: 404 responses treated as success (already deleted)
  - Message structure:
    ```typescript
    { type: 'remove-message', senderId, removeMessageId }
    ```

- [ ] **Create `editDm` handler** (`src/services/ActionQueueHandlers.ts`)
  - Done when: Handler added to `getHandler()` map
  - Uses: `encryptAndSendDm()` helper
  - Context: `DmActionContext` + `editMessage: EditMessage` + `messageId`
  - Message structure:
    ```typescript
    { type: 'edit', senderId, messageId, content, editedAt }
    ```

### Phase 3: Update Routing

- [ ] **Update `useMessageActions.ts`** for reactions and deletes
  - Done when: DM reactions/deletes route to new handlers
  - Detect DMs: `const isDM = spaceId === channelId`
  - Use `getDmContext()` helper to get context
  - Fallback gracefully if context unavailable (use legacy path)
  - Route to `reaction-dm` / `delete-dm` handlers with full context

  Example routing logic:
  ```typescript
  const isDM = spaceId === channelId;
  if (isDM) {
    const dmContext = await getDmContext(spaceId);
    if (!dmContext) {
      // Fallback to legacy path if context unavailable
      onSubmitMessage({ type: 'reaction', ... });
      return;
    }
    await actionQueueService.enqueue(
      'reaction-dm',
      { ...dmContext, reactionMessage },
      `reaction-dm:${spaceId}:${message.messageId}:${emoji}`
    );
    return;
  }
  // Continue with Space path...
  ```

- [ ] **Update `MessageEditTextarea.tsx`** for edits
  - Done when: DM edits route to `edit-dm` handler
  - Change condition at line 319 from `!isDM` to route DMs to new handler
  - Use similar `getDmContext()` pattern
  - Fallback to legacy path if context unavailable

### Phase 4: Testing

- [ ] **Test online scenarios**
  - Verify DM reaction syncs to other party
  - Verify DM delete syncs to other party
  - Verify DM edit syncs to other party

- [ ] **Test offline scenarios**
  - Go offline, add reaction → action queued
  - Go online → reaction syncs to other party
  - Repeat for delete and edit

## Verification

✅ **DM reactions work offline**
   - Test: Go offline → add reaction → go online → verify other party sees reaction

✅ **DM deletes work offline**
   - Test: Go offline → delete message → go online → verify message gone on other device

✅ **DM edits work offline**
   - Test: Go offline → edit message → go online → verify edit appears on other device

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

✅ **No regressions in Space actions**
   - Test: Space reactions/deletes/edits still work as before

## Definition of Done

- [ ] All 3 new handlers implemented with Double Ratchet encryption
- [ ] `useMessageActions.ts` routes DM reactions/deletes to new handlers
- [ ] `MessageEditTextarea.tsx` routes DM edits to new handler
- [ ] All online tests pass
- [ ] All offline tests pass
- [ ] TypeScript compiles without errors
- [ ] No console errors during DM operations
- [ ] Update `.agents/docs/features/action-queue.md` with new DM action types

## Notes

The key insight is that the existing `send-dm` handler already has all the Double Ratchet logic needed. The new handlers are essentially wrappers that:
1. Build the appropriate message object (reaction/delete/edit)
2. Use the same encryption and transport logic as `send-dm`

## Edge Cases

1. **Counterparty has no active inboxes**: All their device inboxes are stale/unreachable → handled by stale state cleanup (same as `sendDm`)
2. **Queued actions while offline**: If user edits then deletes same message while offline, both actions execute in order when online
3. **Device registration changes**: Handler should include stale encryption state cleanup (same as `sendDm`)
4. **Missing context at queue time**: Fallback to legacy path (works online only)
5. **Missing context at execution time**: Mark as permanent error to avoid infinite retries

## Sender Identity Clarification

Per commit `0c381702`, sender identity (`senderDisplayName`, `senderUserIcon`) is required for:
- **New DM messages**: Yes - recipient needs to see sender identity before accepting
- **Reactions**: Optional - reaction contains sender info, identity already established
- **Deletes**: Optional - no identity revelation needed
- **Edits**: Optional - editing own message, identity already established

Make these parameters optional in `DmActionContext` for flexibility.

---

_Created: 2025-12-18_
_Updated: 2025-12-18 - Added feature analyzer recommendations_
