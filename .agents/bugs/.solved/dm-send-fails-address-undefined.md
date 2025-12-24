# DM Send Fails with "Cannot read properties of undefined (reading 'address')"

> **✅ FIXED**: 2025-12-18

## Symptoms

1. **DM messages fail to send** - the "Sending..." indicator persists indefinitely (now shows "Failed to send. Retry" after fix to onFailure callback)
2. **Error message**: `Cannot read properties of undefined (reading 'address')`
3. **Channel/Space messages work fine** - only DMs are affected
4. **Retry sometimes works** - clicking "Retry" on a failed message often succeeds
5. **Error occurs after all encryption sessions are created** - the 16 sessions all have valid `receiving_inbox` addresses, but error happens when processing session 0

## Root Cause (FOUND)

The error was in `SpaceService.sendHubMessage()` at line 1166:
```typescript
async sendHubMessage(spaceId: string, message: string) {
  const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
  const envelope = await secureChannel.SealHubEnvelope(
    hubKey.address!, // <-- ERROR: hubKey is undefined for DMs!
    ...
  );
}
```

**The sendDm handler was incorrectly using `sendHubMessage`** which:
1. Tries to get a "hub" key for the DM address (which doesn't exist)
2. `hubKey` returns `undefined`
3. Accessing `hubKey.address` throws: "Cannot read properties of undefined (reading 'address')"

**Why retry worked**: The retry path in `MessageService.retryDirectMessage()` uses `enqueueOutbound()` to send `{ type: 'direct', ...session.sealed_message }` messages directly through WebSocket - NOT through `sendHubMessage`.

## The Fix

### 1. Added `sendDirectMessages` method to MessageService
```typescript
// src/services/MessageService.ts:163-175
/**
 * Send direct message(s) via WebSocket.
 * Used by ActionQueueHandlers for DM sending.
 */
sendDirectMessages(messages: string[]): Promise<void> {
  return new Promise((resolve) => {
    this.enqueueOutbound(async () => {
      resolve();
      return messages;
    });
  });
}
```

### 2. Updated sendDm handler to use WebSocket instead of sendHubMessage
```typescript
// src/services/ActionQueueHandlers.ts:698-755
// Collect messages to send (listen + direct for each session)
const outboundMessages: string[] = [];

for (const session of sessions) {
  // ... save encryption state ...

  // Collect messages: listen subscription + direct message
  outboundMessages.push(
    JSON.stringify({
      type: 'listen',
      inbox_addresses: [session.receiving_inbox.inbox_address],
    })
  );
  outboundMessages.push(
    JSON.stringify({ type: 'direct', ...session.sealed_message })
  );
}

// Send all messages via WebSocket
await this.deps.messageService.sendDirectMessages(outboundMessages);
```

## Key Difference: Spaces vs DMs

| Aspect | Spaces/Channels | Direct Messages |
|--------|----------------|-----------------|
| Encryption | Triple Ratchet | Double Ratchet |
| Message type | `{ type: 'group', ... }` | `{ type: 'direct', ... }` |
| Routing | Via hub (SealHubEnvelope) | Direct inbox-to-inbox |
| Hub key | Required (per-space) | Not applicable |
| Send method | `sendHubMessage()` | `sendDirectMessages()` |

## Files Modified

- `src/services/MessageService.ts` - Added `sendDirectMessages()` method
- `src/services/ActionQueueHandlers.ts` - Updated sendDm to use WebSocket
- `src/components/message/Message.tsx` - Fixed icon name (`circle-question` → `question-circle`)

## Previous Changes (retained)

### 1. Added `onFailure` callback to TaskHandler interface
```typescript
// src/services/ActionQueueHandlers.ts:41-42
onFailure?: (context: Record<string, unknown>, error: Error) => void;
```

### 2. ActionQueueService calls onFailure on failure
```typescript
// src/services/ActionQueueService.ts:219-231
handler.onFailure?.(task.context, err);
```

### 3. Both sendChannelMessage and sendDm have onFailure callbacks
```typescript
onFailure: (context, error) => {
  this.deps.messageService.updateMessageStatus(
    this.deps.queryClient,
    address, address, messageId,
    'failed',
    this.sanitizeError(error)
  );
}
```

### 4. Added sanitizeError helper
```typescript
private sanitizeError(error: Error): string {
  const msg = error.message.toLowerCase();
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('offline')) {
    return t`Network error`;
  }
  if (msg.includes('encrypt') || msg.includes('ratchet') || msg.includes('key')) {
    return t`Encryption error`;
  }
  if (msg.includes('no target inboxes')) {
    return t`Recipient has no devices`;
  }
  return t`Send failed`;
}
```

## Related

- Feature doc: `.agents/docs/features/messages/message-sending-indicator.md`
- Action Queue doc: `.agents/docs/features/action-queue.md`

---

_Created: 2025-12-18_
_Fixed: 2025-12-18_
