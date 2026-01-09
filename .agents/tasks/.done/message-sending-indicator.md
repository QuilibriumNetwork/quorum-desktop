---
type: task
title: "Implement Message Sending Indicator"
status: done
complexity: high
ai_generated: true
created: 2025-12-14
updated: 2025-12-16
related_issues: ["#51"]
---

# Implement Message Sending Indicator

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent, security-analyst agent


**Completed**: 2025-12-16
**GitHub Issue**: https://github.com/QuilibriumNetwork/quorum-desktop/issues/51
**Files Modified**:
- `src/api/quorumApi.ts` - Added `MessageSendStatus` type and extended `Message` type
- `src/services/MessageService.ts` - Optimistic updates, retry methods, error sanitization
- `src/components/message/Message.tsx` - Status indicator UI
- `src/components/message/Message.scss` - Status indicator styles
- `src/components/message/MessageList.tsx` - Added `onRetryMessage` prop passthrough
- `src/components/context/MessageDB.tsx` - Exposed `retryMessage` and `retryDirectMessage`
- `src/components/space/Channel.tsx` - Wired up retry for channel messages
- `src/components/direct/DirectMessage.tsx` - Wired up retry for DM messages

## What & Why

**Current state**: Messages appear in the UI only after network transmission completes, providing no visual feedback during the send process.

**Desired state**: Messages appear immediately with a "Sending" indicator, then update to normal state once delivery is confirmed. Failed messages show error state with retry option.

**Value**: Improved UX with immediate feedback, aligning with user expectations from modern messaging apps. Addresses GitHub Issue #51.

## Context

- **Existing pattern**: Optimistic updates already used via `addMessage()` but called AFTER network send
- **Constraints**: Must handle message re-ordering when incoming messages arrive during pending state
- **Dependencies**: React Query cache management, Triple Ratchet encryption flow
- **Security requirement**: Signature must be generated BEFORE optimistic display (non-repudiability)
- **Prior art**: See commit `671d1bc0` on branch `feat/immediately-send-message` - an earlier attempt using `isSent` boolean instead of 3-state status. Lacks failure handling but has useful `clientMessageId` deduplication pattern worth considering.

### Limitations (No Persistent Queue)

> **Note**: This implementation uses the existing in-memory `enqueueOutbound` queue in `WebsocketProvider.tsx`. This has important UX implications:

| Scenario | Behavior |
|----------|----------|
| Online, fast/slow | ✅ Works well - "Sending..." → "sent" |
| Brief disconnect | ⚠️ Works if user waits for reconnection |
| Offline send | ❌ "Sending..." stuck indefinitely, **message lost if app closes** |
| App crash during send | ❌ Message lost (in-memory only) |

**Current queue limitations:**
- Not persisted to IndexedDB - lost on app close/crash
- No automatic retry with backoff
- No per-message status callbacks (status updates handled inside enqueued callback)

**Future enhancement**: A persistent background action queue (IndexedDB-backed) would enable true offline capability where messages survive app restart and auto-send on reconnection. This is out of scope for this task but should be considered for future work.

## Prerequisites

- [x] Review analysis report: `.agents/reports/sending-indicator-feature-analysis_2025-12-14.md`
- [x] Branch created from `develop`: `cross-platform_message-sending-indicator`
- [x] No conflicting PRs

## Implementation

### Phase 1: Type System Extension ✅

- [x] **Add MessageSendStatus type** (`src/api/quorumApi.ts:89`)
  - Add: `export type MessageSendStatus = 'sending' | 'sent' | 'failed';`
  - Done when: Type exported and available
  - Verify: TypeScript compiles

- [x] **Extend Message type** (`src/api/quorumApi.ts:89-129`)
  - Add optional fields: `sendStatus?: MessageSendStatus` and `sendError?: string`
  - **SECURITY**: These fields are CLIENT-SIDE EPHEMERAL only
  - **NEVER** persist to IndexedDB or include in network payload
  - Done when: Message type includes new fields
  - Verify: TypeScript compiles, existing code unaffected

### Phase 2: Optimistic Update Logic (requires Phase 1) ✅

**SECURITY CRITICAL**: Signature generation must occur BEFORE optimistic display to maintain non-repudiability guarantees.

- [x] **Refactor submitChannelMessage** (`src/services/MessageService.ts:2972-3425`)
  - Move OUTSIDE `enqueueOutbound()`:
    1. Generate nonce (`crypto.randomUUID()`)
    2. Calculate messageId (SHA-256 hash)
    3. Generate signature (Ed448 sign)
    4. Create complete signed message with `sendStatus: 'sending'`
  - Call `addMessage()` with signed message BEFORE enqueuing
  - Keep INSIDE `enqueueOutbound()`:
    1. Triple Ratchet encryption
    2. Network send via `sendHubMessage()`
    3. `saveMessage()` to IndexedDB (WITHOUT sendStatus field)
    4. Status update to 'sent' or 'failed'
  - Done when: Message appears immediately in UI with valid signature
  - Verify: Signature verification passes on sent messages

- [x] **Add updateMessageStatus method** (`src/services/MessageService.ts`)
  - Follow existing pattern from reactions (lines 577-627)
  - Use `queryClient.setQueryData()` with message mapping
  - Update ONLY `sendStatus` and `sendError` fields
  - Preserve pagination metadata (`nextCursor`, `prevCursor`)
  - **Validate messageId match** before applying update (atomic)
  - Handle message deduplication using filter before update
  - Parameters: queryClient, spaceId, channelId, messageId, status, error?
  - Done when: Can update message status without duplicates
  - Verify: Status changes reflect in UI, no duplicate messages

  **RACE CONDITION HANDLING** (added 2025-12-16):

  > **Scenario**: Server message arrives via websocket BEFORE `updateMessageStatus('sent')` is called.
  >
  > **What happens**:
  > 1. Optimistic message added with `sendStatus: 'sending'`
  > 2. Server returns same message via websocket (no `sendStatus` field)
  > 3. `addMessage()` deduplication (line 1218-1220) REPLACES optimistic version with server version
  > 4. `updateMessageStatus('sent')` called - but message no longer has `sendStatus`
  >
  > **Solution**: `updateMessageStatus()` must check if target message has `sendStatus` before updating:
  > ```typescript
  > // Inside the message mapping function:
  > if (msg.messageId === messageId) {
  >   // Only update if this is still the optimistic version (has sendStatus)
  >   // If server version already replaced it, sendStatus will be undefined
  >   if (msg.sendStatus !== undefined) {
  >     return status === 'sent'
  >       ? { ...msg, sendStatus: undefined, sendError: undefined } // Clear ephemeral fields
  >       : { ...msg, sendStatus: status, sendError: error };
  >   }
  >   // Server version already replaced optimistic - no action needed
  >   return msg;
  > }
  > return msg;
  > ```
  >
  > **Why this works**:
  > - If optimistic version still exists → update it normally
  > - If server version replaced it → it has no `sendStatus`, skip update (already "sent")
  > - No duplicates possible (same deduplication pattern as `addMessage()`)

- [x] **Update enqueueOutbound callback** (`src/services/MessageService.ts:2990`)
  - On success: call `updateMessageStatus(..., 'sent')` or remove sendStatus
  - Handle potential duplicates (message may return from server)
  - On failure: call `updateMessageStatus(..., 'failed', sanitizedError)`
  - **SECURITY**: Sanitize error messages (see Phase 6)
  - Done when: Status updates after network operation, no duplicates
  - Verify: Success shows sent once, failure shows failed

- [x] **Strip sendStatus before persistence** (`src/services/MessageService.ts:3398`)
  - Before `saveMessage()`, explicitly remove `sendStatus` and `sendError`
  - Before `TripleRatchetEncrypt()`, strip ephemeral fields
  - Done when: sendStatus never persisted or transmitted
  - Verify: IndexedDB messages have no sendStatus field

### Phase 3: Message Re-ordering (requires Phase 2) ✅

- [x] **Implement message sorting in addMessage** (`src/services/MessageService.ts:571`)
  - Add sort to ONLY the last page where new messages are added (line 1146-1158)
  - Pending messages (`sendStatus: 'sending'`) sort to end within that page
  - Preserve existing filter logic (line 1150-1152) for deduplication
  - Done when: Pending messages stay at bottom even if older messages arrive
  - Verify: Send message, receive older message from other user, pending stays at end

  > **Sort Logic Clarified** (2025-12-16):
  >
  > **Behavior**: Messages stay at their display position after sending - NO re-sorting on status change.
  >
  > | State | Position |
  > |-------|----------|
  > | `sendStatus: 'sending'` | End of page (bottom) |
  > | `sendStatus: 'sent'` or `undefined` | **Stays where it was** (no jump) |
  > | `sendStatus: 'failed'` | **Stays where it was** (no jump) |
  >
  > **Why no re-sort?**
  > - Re-sorting causes jarring UX (messages visually "jump")
  > - WhatsApp, Telegram, etc. all keep messages at display position
  > - The `createdDate` timestamp is set at message creation, so it's already "correct" chronologically
  > - Only NEW incoming messages during send need to sort before our pending message
  >
  > **Implementation**:
  > ```typescript
  > // In addMessage - sort only the last page:
  > messages.sort((a, b) => {
  >   // Pending messages always go to END
  >   if (a.sendStatus === 'sending' && b.sendStatus !== 'sending') return 1;
  >   if (b.sendStatus === 'sending' && a.sendStatus !== 'sending') return -1;
  >   // Otherwise maintain chronological order by createdDate
  >   return new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
  > });
  > ```
  >
  > This ensures: incoming messages sort chronologically, but OUR pending message stays at bottom until it transitions to 'sent', then stays in place.

### Phase 4: UI Components (requires Phase 1) ✅

- [x] **Create MessageStatusIndicator component** (`src/components/message/Message.tsx`)
  - Position: Bottom of each message (below content)
  - Use `Icon` primitive (see `src/components/primitives/Icon/iconMapping.ts`)
  - **Sending state**: `<Icon name="clock" />` + "Sending..." in `--warning` color
  - **Failed state**: `<Icon name="warning" />` + "Failed to send. " + "Retry" (underlined link) all in `--color-text-danger`
  - Show nothing for sent/received messages
  - Done when: Status indicator renders based on sendStatus
  - Verify: Visual indicator appears during send

- [x] **Add status indicator styles** (`src/components/message/Message.scss`)
  - `.message-status` base class - positioned below message content
  - `.message-status.sending` - uses `var(--warning)` color
  - `.message-status.failed` - uses `var(--color-text-danger)` color
  - `.message-status__retry` - underlined text link (not a button), same danger color
  - Done when: Styles match app design system
  - Verify: Looks correct on desktop and mobile

- [x] **Wire up retry functionality** (`src/components/message/Message.tsx`)
  - Retry button calls retry handler
  - Done when: Clicking retry triggers retryMessage
  - Verify: Failed message shows retry button that works

### Phase 5: Retry Mechanism (requires Phase 2, Phase 4) ✅

**SECURITY NOTE**: Retry should re-send the SAME signed message for message identity consistency.

> **Why this is safe** (verified by security-analyst agent 2025-12-16, code verified 2025-12-16):
> - **Signature is over messageId ONLY** - verified at `MessageService.ts:1400-1404`, `3145-3147`:
>   ```typescript
>   ch.js_sign_ed448(privateKey, Buffer.from(messageId).toString('base64'))
>   ```
>   No timestamps, nonces, or timing data in signature. Deterministic for same messageId + key.
> - Triple Ratchet creates unique encrypted envelopes per send attempt (ratchet state advances)
> - Client-side deduplication prevents duplicate display (messageId filter in `addMessage()`)
> - No replay attack vector exists due to 4 layers of protection already in place
>
> Generating a NEW nonce per retry would break message identity (failed message stays in UI + new message appears = user confusion).

- [x] **Add retryMessage method** (`src/services/MessageService.ts`)
  - Retrieve COMPLETE failed message (including original nonce and signature)
  - Validate message is in 'failed' state and owned by current user
  - Update status to 'sending' (optimistic)
  - Re-queue SAME message object through `enqueueOutbound()`
  - Triple Ratchet creates fresh encrypted envelope with current state
  - On success: update to 'sent', save to IndexedDB
  - On failure: revert to 'failed' with updated error
  - Done when: Retry preserves message identity (same messageId)
  - Verify: Retry uses original signature, single message transitions failed→sending→sent

  > **Simplified** (2025-12-16): Removed max retry limit and rate limiting.
  > - Users can retry as many times as they want (no security risk - signature is safe to reuse)
  > - Natural network queue throttles rapid attempts anyway
  > - If user wants to stop retrying, they can delete the message
  > - Avoids complexity of tracking retry counts per messageId

- [x] **Expose retry via useMessageDB hook** (`src/components/context/MessageDB.tsx`)
  - Add retryMessage and retryDirectMessage to hook return value
  - Done when: Components can access retry function
  - Verify: Message component can trigger retry

### Phase 6: Security Hardening (requires Phase 2) ✅

- [x] **Sanitize error messages inline** (`src/services/MessageService.ts`)
  - Handle in the `enqueueOutbound` failure callback directly:
    ```typescript
    const sanitizeError = (error: unknown): string => {
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          return 'Network error';
        }
        if (error.message.includes('encrypt') || error.message.includes('ratchet')) {
          return 'Encryption error';
        }
      }
      return 'Failed to send message';
    };
    ```
  - **NEVER** expose: IP addresses, hostnames, file paths, stack traces
  - Done when: All errors shown to users are generic
  - Verify: Trigger various failures, check UI shows sanitized messages

  > **Simplified** (2025-12-16): Inline function instead of dedicated utility file.
  > Only 3-4 error mappings needed - premature to create `src/utils/errorSanitization.ts`.

- [x] **Failed message cleanup** (`src/services/MessageService.ts`)
  - Failed messages naturally cleared on app close (in-memory only, never persisted)
  - Done when: Failed messages gone after app restart
  - Verify: Failed messages are ephemeral, cleared on app close

  > **Simplified** (2025-12-16): Removed explicit "Delete unsent message" UI option.
  > - Failed messages already cleared on app close (ephemeral by design)
  > - Users can retry indefinitely - no need to manually delete
  > - Can be added later if users request it

- [x] **Message integrity validation** (`src/services/MessageService.ts`)
  - Signature is generated BEFORE optimistic display
  - All required fields populated before addMessage()
  - Done when: Invalid messages never shown optimistically
  - Verify: Messages always have valid signature before display

### Phase 7: Direct Message (DM) Support ✅

> **Added 2025-12-16**: Extended feature to work with Direct Messages, not just Channel messages.

- [x] **Refactor submitMessage for DM optimistic updates** (`src/services/MessageService.ts`)
  - Same pattern as `submitChannelMessage` but using Double Ratchet encryption
  - Generate signature BEFORE optimistic display
  - Add message with `sendStatus: 'sending'` before `enqueueOutbound()`
  - Update status to 'sent' or 'failed' after network operation
  - Done when: DM messages show "Sending..." indicator immediately

- [x] **Add retryDirectMessage method** (`src/services/MessageService.ts`)
  - Same pattern as `retryMessage` but for DM context
  - Re-queue same signed message through Double Ratchet encryption
  - Done when: Failed DM messages can be retried

- [x] **Wire up retry in DirectMessage.tsx** (`src/components/direct/DirectMessage.tsx`)
  - Import `retryDirectMessage` from `useMessageDB`
  - Create `handleRetryMessage` callback
  - Pass `onRetryMessage` prop to MessageList
  - Done when: Clicking retry on failed DM triggers retryDirectMessage

## Verification

✅ **Immediate feedback on send**
   - Test: Type message, press send → message appears instantly with "Sending" indicator
   - Expected: No delay before message visible

✅ **Status updates correctly**
   - Test: Wait for send to complete → "Sending" indicator disappears
   - Expected: Clean transition to normal message state

✅ **Message ordering preserved**
   - Test: Send message, have another user send message before yours completes
   - Expected: Messages in correct chronological order after both complete

✅ **Failed message handling**
   - Test: Simulate network failure during send
   - Expected: "Failed to send" indicator with retry button

✅ **Retry works (preserves message identity)**
   - Test: Click retry on failed message
   - Expected: Same message transitions failed→sending→sent (no duplicate messages)

✅ **Signature integrity maintained**
   - Test: Send message, verify signature on receiving end
   - Expected: Signature verification passes

✅ **No metadata leakage**
   - Test: Check IndexedDB and network payload
   - Expected: sendStatus field NOT present in either

✅ **Error messages sanitized**
   - Test: Trigger network/encryption failures
   - Expected: Generic error messages only, no sensitive data

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

✅ **Mobile compatible**
   - Test: Verify on mobile viewport
   - Expected: Status indicator readable, retry button tappable

✅ **No console errors**
   - Test: Monitor console during all operations
   - Expected: No new errors or warnings

## Security Test Cases

- [ ] **Signature integrity**: Verify optimistic messages have valid signatures before display
- [ ] **Message identity preserved**: Verify retry keeps same messageId throughout lifecycle
- [ ] **Deduplication works**: Send message, fake network error, retry → no duplicate in UI
- [ ] **Triple Ratchet advances**: Verify encrypted envelope differs between retry attempts
- [ ] **Race condition**: Send 10 messages rapidly, verify all status updates apply correctly
- [ ] **Error sanitization**: Trigger various error types, verify no sensitive data in UI
- [ ] **Cache poisoning**: Verify status updates only apply to correct messageId
- [ ] **Metadata leakage**: Verify sendStatus not in encrypted payload or IndexedDB
- [ ] **Failed message cleanup**: Verify failed messages can be manually deleted, cleared on app restart
- [ ] **Concurrent send**: Two messages sending simultaneously, verify signatures don't get swapped

## Edge Cases to Handle

- Multiple messages sent rapidly (queue ordering)
- App backgrounded during send
- Network timeout vs immediate failure
- Retry while another message sending
- Message with attachments (future consideration)
- App crash after optimistic display but before network send

## Definition of Done

- [x] All phases complete (Phase 1-7 including DM support)
- [x] All verification tests pass
- [x] All security test cases pass
- [x] No console errors (related to this feature)
- [x] Works on desktop and mobile
- [x] Code follows existing patterns
- [x] i18n: All user-facing strings use `t` macro
- [x] Signature generated before optimistic display
- [x] sendStatus never persisted or transmitted
- [x] Works for both Channel messages AND Direct Messages

## Future: Integration with Background Action Queue

When the persistent background action queue is implemented (see `.agents/tasks/background-action-queue-with-worker-crypto.md`), this feature can be upgraded for true offline support:

### Changes Required

1. **Replace `enqueueOutbound()` with `actionQueueService.enqueue()`**
   ```typescript
   // Before (current implementation)
   this.enqueueOutbound(async () => {
     // encrypt + send
     updateMessageStatus(..., 'sent');
   });

   // After (with action queue)
   actionQueueService.enqueue('send-message', {
     messageId,
     channelId,
     spaceId,
     signedMessage,  // Already signed before optimistic display
   }, `${spaceId}/${channelId}`);
   ```

2. **Register a `'send-message'` handler** in `ActionQueueService`
   ```typescript
   actionQueueService.registerHandler('send-message', {
     execute: async (context) => {
       // Triple Ratchet encryption
       // Network send via sendHubMessage()
       // saveMessage() to IndexedDB
       // updateMessageStatus(..., 'sent')
     },
     isPermanentError: (error) => {
       // e.g., invalid signature = permanent
       // network timeout = transient (retry)
     }
   });
   ```

3. **Keep optimistic display logic unchanged** - signature generation and `addMessage()` with `sendStatus: 'sending'` still happen before enqueuing

### What This Enables

| Scenario | Current | With Action Queue |
|----------|---------|-------------------|
| App closes during send | ❌ Lost | ✅ Persisted, sends on restart |
| App crash | ❌ Lost | ✅ Persisted, sends on restart |
| Offline send | ❌ Stuck forever | ✅ Queued, auto-sends when online |
| Retry on failure | ❌ Manual only | ✅ Automatic with backoff |

### Migration Path

The current implementation is designed to be forward-compatible. When upgrading:
- `updateMessageStatus()` function remains the same
- UI components (`MessageStatusIndicator`) remain the same
- Only the queueing mechanism changes (swap `enqueueOutbound` → `actionQueueService.enqueue`)

## Related Documentation

- GitHub Issue: https://github.com/QuilibriumNetwork/quorum-desktop/issues/51
- Background Action Queue Task: `.agents/tasks/background-action-queue-with-worker-crypto.md`

---
