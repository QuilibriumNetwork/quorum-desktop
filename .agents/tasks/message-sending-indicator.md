# Implement Message Sending Indicator

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent, security-analyst agent

**Status**: Pending
**Complexity**: High
**Created**: 2025-12-14
**GitHub Issue**: https://github.com/QuilibriumNetwork/quorum-desktop/issues/51
**Files**:
- `src/api/quorumApi.ts:89-129`
- `src/services/MessageService.ts:2972-3425`
- `src/components/message/Message.tsx:66-100`
- `src/components/message/Message.scss`
- `src/components/space/Channel.tsx:185-252`

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

## Prerequisites

- [ ] Review analysis report: `.agents/reports/sending-indicator-feature-analysis_2025-12-14.md`
- [ ] Branch created from `develop`
- [ ] No conflicting PRs

## Implementation

### Phase 1: Type System Extension

- [ ] **Add MessageSendStatus type** (`src/api/quorumApi.ts:89`)
  - Add: `export type MessageSendStatus = 'sending' | 'sent' | 'failed';`
  - Done when: Type exported and available
  - Verify: TypeScript compiles

- [ ] **Extend Message type** (`src/api/quorumApi.ts:89-129`)
  - Add optional fields: `sendStatus?: MessageSendStatus` and `sendError?: string`
  - **SECURITY**: These fields are CLIENT-SIDE EPHEMERAL only
  - **NEVER** persist to IndexedDB or include in network payload
  - Done when: Message type includes new fields
  - Verify: TypeScript compiles, existing code unaffected

### Phase 2: Optimistic Update Logic (requires Phase 1)

**SECURITY CRITICAL**: Signature generation must occur BEFORE optimistic display to maintain non-repudiability guarantees.

- [ ] **Refactor submitChannelMessage** (`src/services/MessageService.ts:2972-3425`)
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

- [ ] **Add updateMessageStatus method** (`src/services/MessageService.ts`)
  - Follow existing pattern from reactions (lines 577-627)
  - Use `queryClient.setQueryData()` with message mapping
  - Update ONLY `sendStatus` and `sendError` fields
  - Preserve pagination metadata (`nextCursor`, `prevCursor`)
  - **Validate messageId match** before applying update (atomic)
  - Handle message deduplication using filter before update
  - Parameters: queryClient, spaceId, channelId, messageId, status, error?
  - Done when: Can update message status without duplicates
  - Verify: Status changes reflect in UI, no duplicate messages

- [ ] **Update enqueueOutbound callback** (`src/services/MessageService.ts:2990`)
  - On success: call `updateMessageStatus(..., 'sent')` or remove sendStatus
  - Handle potential duplicates (message may return from server)
  - On failure: call `updateMessageStatus(..., 'failed', sanitizedError)`
  - **SECURITY**: Sanitize error messages (see Phase 6)
  - Done when: Status updates after network operation, no duplicates
  - Verify: Success shows sent once, failure shows failed

- [ ] **Strip sendStatus before persistence** (`src/services/MessageService.ts:3398`)
  - Before `saveMessage()`, explicitly remove `sendStatus` and `sendError`
  - Before `TripleRatchetEncrypt()`, strip ephemeral fields
  - Done when: sendStatus never persisted or transmitted
  - Verify: IndexedDB messages have no sendStatus field

### Phase 3: Message Re-ordering (requires Phase 2)

- [ ] **Implement message sorting in addMessage** (`src/services/MessageService.ts:571`)
  - Add sort to ONLY the last page where new messages are added (line 1146-1158)
  - Pending messages (`sendStatus: 'sending'`) sort to end within that page
  - Preserve existing filter logic (line 1150-1152) for deduplication
  - **Immediately re-sort** when status changes from 'sending' to 'sent'
  - Done when: Pending messages stay at bottom even if older messages arrive
  - Verify: Send message, receive older message from other user, pending stays at end

### Phase 4: UI Components (requires Phase 1)

- [ ] **Create MessageStatusIndicator component** (`src/components/message/Message.tsx`)
  - Position: Bottom of each message (below content)
  - Use `Icon` primitive with outlined icons
  - **Sending state**: `<Icon name="clock-outline" />` + "Sending..." in `--warning` color
  - **Failed state**: `<Icon name="alert-circle-outline" />` + "Failed to send. " + "Retry" (underlined link) all in `--color-text-danger`
  - Show nothing for sent/received messages
  - Done when: Status indicator renders based on sendStatus
  - Verify: Visual indicator appears during send

- [ ] **Add status indicator styles** (`src/components/message/Message.scss`)
  - `.message-status` base class - positioned below message content
  - `.message-status.sending` - uses `var(--warning)` color
  - `.message-status.failed` - uses `var(--color-text-danger)` color
  - `.message-status__retry` - underlined text link (not a button), same danger color
  - Done when: Styles match app design system
  - Verify: Looks correct on desktop and mobile

- [ ] **Wire up retry functionality** (`src/components/message/Message.tsx`)
  - Retry button calls retry handler
  - Done when: Clicking retry triggers retryMessage
  - Verify: Failed message shows retry button that works

### Phase 5: Secure Retry Mechanism (requires Phase 2, Phase 4)

**SECURITY CRITICAL**: Retry must create a NEW message to prevent replay attacks.

> **Note**: This security analysis was performed by an AI agent. The replay attack concern should be verified by a security expert before implementation.

- [ ] **Add retryMessage method** (`src/services/MessageService.ts`)
  - Retrieve ONLY content from failed message (text, attachments)
  - Generate **NEW** nonce (`crypto.randomUUID()`)
  - Calculate **NEW** messageId with new nonce
  - Generate **NEW** signature for new messageId
  - Create entirely new message object (not reuse)
  - Remove original failed message from cache
  - Submit new message through normal flow
  - **Implement max retry limit**: 3 attempts per message
  - Done when: Retry creates cryptographically fresh message
  - Verify: Retry generates different messageId and signature

- [ ] **Expose retry via useMessageDB hook** (`src/hooks/business/messages/useMessageDB.ts`)
  - Add retryMessage to hook return value
  - Track retry count per original message
  - Done when: Components can access retry function
  - Verify: Message component can trigger retry

### Phase 6: Security Hardening (requires Phase 2)

- [ ] **Add error sanitization utility** (`src/utils/errorSanitization.ts`)
  - Map network errors to generic "Network error"
  - Map encryption errors to generic "Encryption error"
  - Map all others to "Failed to send message"
  - **NEVER** expose: IP addresses, hostnames, file paths, stack traces
  - Done when: All errors shown to users are generic
  - Verify: Trigger various failures, check UI shows sanitized messages

- [ ] **Implement failed message TTL** (`src/services/MessageService.ts`)
  - Failed messages auto-remove from cache after 15 minutes
  - Provide "Delete unsent message" option in UI
  - Clear all failed messages on app close/logout
  - Done when: Failed messages don't persist indefinitely
  - Verify: Failed message disappears after 15 minutes

- [ ] **Add message integrity validation** (`src/services/MessageService.ts`)
  - Before optimistic display, validate:
    1. messageId is correctly calculated
    2. signature is present and valid
    3. All required fields populated
  - Only display message if validation passes
  - Done when: Invalid messages never shown optimistically
  - Verify: Corrupt message data doesn't display

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

✅ **Retry works (creates new message)**
   - Test: Click retry on failed message
   - Expected: Message re-attempts send with NEW nonce/signature, succeeds

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
- [ ] **Replay prevention**: Verify retry generates new nonce and messageId
- [ ] **Race condition**: Send 10 messages rapidly, verify all status updates apply correctly
- [ ] **Error sanitization**: Trigger various error types, verify no sensitive data in UI
- [ ] **Cache poisoning**: Verify status updates only apply to correct messageId
- [ ] **Metadata leakage**: Verify sendStatus not in encrypted payload or IndexedDB
- [ ] **Failed message cleanup**: Verify failed messages removed after TTL
- [ ] **Concurrent send**: Two messages sending simultaneously, verify signatures don't get swapped

## Edge Cases to Handle

- Multiple messages sent rapidly (queue ordering)
- App backgrounded during send
- Network timeout vs immediate failure
- Retry while another message sending
- Message with attachments (future consideration)
- App crash after optimistic display but before network send

## Definition of Done

- [ ] All phases complete (including Phase 6 security hardening)
- [ ] All verification tests pass
- [ ] All security test cases pass
- [ ] No console errors
- [ ] Works on desktop and mobile
- [ ] Code follows existing patterns
- [ ] i18n: All user-facing strings use `t` macro
- [ ] Signature generated before optimistic display
- [ ] sendStatus never persisted or transmitted

## Related Documentation

- GitHub Issue: https://github.com/QuilibriumNetwork/quorum-desktop/issues/51

---

_Updated: 2025-12-14_
