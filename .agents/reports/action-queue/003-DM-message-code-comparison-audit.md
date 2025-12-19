# Action Queue vs Legacy DM Message Implementation - Code Comparison Audit

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Purpose

Deep dive comparison of the Action Queue DM handler (`send-dm`) vs the legacy path to identify any potential issues introduced by the Action Queue implementation.

---

## Background: Why DMs Work Differently Than Space Messages

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

DMs require special handling for sender identity revelation. The `senderDisplayName` and `senderUserIcon` parameters are passed to Double Ratchet encryption functions, ensuring recipients can see sender identity before accepting the conversation.

## Classification

| Label | Applies | Notes |
|-------|---------|-------|
| `action-queue-bug` | ⚠️ Potential | See findings below |
| `pre-existing` | N/A | This is an audit, not a bug report |
| `network-issue` | N/A | Not applicable |
| `test-environment` | N/A | Not applicable |

---

## Code Locations

| Implementation | File | Lines |
|----------------|------|-------|
| Action Queue Entry Point | `MessageService.ts` | 1448-1535 |
| Action Queue Handler | `ActionQueueHandlers.ts` | 548-811 |
| Legacy Path | `MessageService.ts` | 1538-1930 |

---

## Comparison Summary

### ✅ IDENTICAL: Core Encryption Logic

Both implementations use the same encryption flow:

```
1. Get encryption states from IndexedDB
2. Clean up stale encryption states (inboxes no longer valid)
3. For each target inbox:
   - If encryption state exists with empty sending_inbox.inbox_public_key:
     → Use DoubleRatchetInboxEncryptForceSenderInit()
   - If encryption state exists with valid sending_inbox:
     → Use DoubleRatchetInboxEncrypt()
   - If no encryption state:
     → Use NewDoubleRatchetSenderSession()
4. Save updated encryption states to IndexedDB
5. Send listen + direct messages via WebSocket
6. Save message to IndexedDB
```

### ✅ IDENTICAL: Inbox Collection Logic

Both implementations:
```typescript
const inboxes = self.device_registrations
  .map((d) => d.inbox_registration.inbox_address)
  .concat(counterparty.device_registrations.map((d) => d.inbox_registration.inbox_address))
  .sort();
```

### ✅ IDENTICAL: Outbound Message Format

Both implementations:
```typescript
outbounds.push(JSON.stringify({ type: 'listen', inbox_addresses: [session.receiving_inbox.inbox_address] }));
outbounds.push(JSON.stringify({ type: 'direct', ...session.sealed_message }));
```

---

## Differences Found

### 1. ⚠️ DIFFERENCE: Null Safety on Device Registrations

**Legacy (MessageService.ts:1787-1794):**
```typescript
const inboxes = self.device_registrations
  .map((d) => d.inbox_registration.inbox_address)
  .concat(
    counterparty.device_registrations.map(
      (d) => d.inbox_registration.inbox_address
    )
  )
  .sort();
```

**Action Queue (ActionQueueHandlers.ts:580-588):**
```typescript
const inboxes = (self?.device_registrations ?? [])
  .filter((d) => d.inbox_registration)  // ← EXTRA SAFETY
  .map((d) => d.inbox_registration.inbox_address)
  .concat(
    (counterparty?.device_registrations ?? [])
      .filter((d) => d.inbox_registration)  // ← EXTRA SAFETY
      .map((d) => d.inbox_registration.inbox_address)
  )
  .sort();
```

**Classification**: `improvement` - Action Queue is MORE defensive, not a bug.

---

### 2. ⚠️ DIFFERENCE: Error Handling in NewDoubleRatchetSenderSession

**Legacy (MessageService.ts:1854-1866):**
```typescript
sessions = [
  ...sessions,
  ...(await secureChannel.NewDoubleRatchetSenderSession(
    keyset.deviceKeyset,
    self.user_address,
    self.device_registrations
      .concat(counterparty.device_registrations)
      .find((d) => d.inbox_registration.inbox_address === inbox)!,  // ← ! assertion
    JSON.stringify(message),
    currentPasskeyInfo!.displayName,
    currentPasskeyInfo?.pfpUrl
  )),
];
```
- No try/catch
- Uses `!` assertion (can crash if device not found)
- If any inbox fails, entire send would fail

**Action Queue (ActionQueueHandlers.ts:646-674):**
```typescript
const targetDevice = self.device_registrations
  .concat(counterparty.device_registrations)
  .filter((d) => d.inbox_registration)
  .find((d) => d.inbox_registration.inbox_address === inbox);

if (!targetDevice) {
  console.warn(`[${traceId}] Inbox ${i + 1}/${targetInboxes.length}: No device registration found`);
  continue; // Skip this inbox
}

console.log(`[${traceId}] Inbox ${i + 1}/${targetInboxes.length}: Creating new session...`);
try {
  const newSessions = await secureChannel.NewDoubleRatchetSenderSession(...);
  sessions = [...sessions, ...newSessions];
  console.log(`[${traceId}] Inbox ${i + 1}/${targetInboxes.length}: Session created successfully`);
} catch (err) {
  console.error(`[${traceId}] Inbox ${i + 1}/${targetInboxes.length}: Failed to create session`, err);
  // Continue to next inbox instead of failing entire send
}
```

**Classification**: `improvement` - Action Queue is MORE resilient:
- Graceful handling of missing devices
- Try/catch prevents entire send from failing
- Progress logging for debugging

---

### 3. ⚠️ DIFFERENCE: Message Signing Location

**Legacy Path:**
- Message is created inside `enqueueOutbound` callback
- Signing happens inside the outbound queue callback
- Message is UNSIGNED when it enters the queue

**Action Queue Path (MessageService.ts:1490-1506):**
- Message is created and SIGNED BEFORE enqueueing
- Signed message is passed to ActionQueue
- ActionQueue handler receives pre-signed message

**Classification**: `improvement` - Action Queue signs earlier, which means:
- Signature is included in the optimistic display
- Message integrity is established before queuing
- Crash during queue processing doesn't lose signature work

---

### 4. ⚠️ DIFFERENCE: Optimistic Update Handling

**Legacy Path:**
- No optimistic update
- Message added to cache AFTER WebSocket send
- User sees no feedback until send completes

**Action Queue Path:**
1. Message added with `sendStatus: 'sending'` (optimistic)
2. User immediately sees message
3. After send completes, `sendStatus` is cleared (message shows as sent)
4. On failure, `sendStatus: 'failed'` with `sendError` message

**Classification**: `feature` - Intentional improvement, not a bug.

---

### 5. ⚠️ DIFFERENCE: Cache Update on Completion

**Legacy (MessageService.ts:1914):**
```typescript
await this.addMessage(queryClient, address, address, message);
```
- Simple add - message wasn't in cache before

**Action Queue (ActionQueueHandlers.ts:731-783):**
```typescript
this.deps.queryClient.setQueryData(messagesKey, (oldData) => {
  // Check if message exists in cache
  const existingPageIndex = oldData.pages.findIndex((page) =>
    page.messages.some((m) => m.messageId === messageId)
  );

  if (existingPageIndex !== -1) {
    // Message exists - clear sendStatus to mark as sent
    return { /* updated pages */ };
  }

  // Message not in cache - re-add it
  return { /* pages with message added */ };
});
```

**Classification**: `necessary` - Action Queue MUST do this because:
- Message is already in cache (from optimistic update)
- Need to update status, not add duplicate
- Handles edge case where optimistic message was evicted

---

### 6. ✅ DIFFERENCE: Conversation Update Timing

**Legacy (MessageService.ts:1915-1926):**
```typescript
this.addOrUpdateConversation(
  queryClient,
  address,
  Date.now(),
  message.createdDate,
  { user_icon: ..., display_name: ... }
);
```

**Action Queue:**
- Does NOT call `addOrUpdateConversation` in the handler

**Classification**: `not-an-issue` ✅

**Verified**: Conversation list timestamps update correctly via Action Queue path.
The update happens through `addMessage()` during optimistic display (MessageService.ts:1509),
which internally updates the conversation list.

**Tested**: 2025-12-19 - Conversation shows correct "11:10 AM" timestamp after DM send.

---

### 7. DIFFERENCE: Sender Identity Revelation

**Legacy:**
```typescript
currentPasskeyInfo!.displayName,
currentPasskeyInfo?.pfpUrl
```

**Action Queue:**
```typescript
senderDisplayName: currentPasskeyInfo.displayName,
senderUserIcon: currentPasskeyInfo.pfpUrl,
// ...then passed to handler
senderDisplayName,
senderUserIcon
```

**Classification**: `identical` - Same values, just passed differently.

---

## Risk Assessment

| Finding | Severity | Risk | Action |
|---------|----------|------|--------|
| 1. Null safety | None | Lower risk | Improvement |
| 2. Error handling | None | Lower risk | Improvement |
| 3. Signing location | None | No difference in result | N/A |
| 4. Optimistic update | None | Feature | N/A |
| 5. Cache update | None | Correctly handles optimistic | N/A |
| 6. Conversation update | None | ✅ Verified working | N/A |
| 7. Sender identity | None | Identical | N/A |

---

## Conclusion

### Action Queue DM Implementation Status: ✅ SAFE

The Action Queue implementation:
1. Uses identical core encryption logic
2. Is MORE defensive with null safety
3. Is MORE resilient with error handling
4. Correctly handles optimistic updates
5. Does not introduce any encryption or security regressions
6. Conversation timestamps update correctly (verified 2025-12-19)

### All Items Verified ✅

No outstanding issues found. The Action Queue DM implementation is safe for production.

---

## DM Action Type Coverage

| Action Type | DM Support | Method Used | Status |
|-------------|------------|-------------|--------|
| `send-dm` | ✅ Full | Action Queue | ✅ Correct - Double Ratchet |
| `send-channel-message` | ❌ N/A | - | Space-only (Triple Ratchet) |
| `reaction-dm` | ✅ Full | Action Queue | ✅ Double Ratchet |
| `delete-dm` | ✅ Full | Action Queue | ✅ Double Ratchet |
| `edit-dm` | ✅ Full | Action Queue | ✅ Double Ratchet |
| `reaction` | ❌ N/A | - | Space-only (Triple Ratchet) |
| `delete-message` | ❌ N/A | - | Space-only (Triple Ratchet) |
| `edit-message` | ❌ N/A | - | Space-only (Triple Ratchet) |

### DM Handler Deduplication Keys

| Action Type | Dedupe Key Format |
|-------------|-------------------|
| `send-dm` | `send-dm:${address}:${messageId}` |
| `reaction-dm` | `reaction-dm:${address}:${messageId}:${emoji}` |
| `delete-dm` | `delete-dm:${address}:${messageId}` |
| `edit-dm` | `edit-dm:${address}:${messageId}` |

---

## Related

- [Action Queue Bug Index](./INDEX.md)
- [DM Sending Indicator Hang (Bug 001)](./001-dm-sending-indicator-hang.md)
- [WebSocket Queue Starvation (Bug 002)](./002-websocket-queue-starvation.md)
- [Space Message Code Comparison Audit (Bug 004)](./004-space-message-code-comparison-audit.md)

---

_Created: 2025-12-19_
_Updated: 2025-12-19 - Integrated content from verification report_
_Status: 📋 Audit Complete_
