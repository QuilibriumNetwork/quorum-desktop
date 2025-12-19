# Action Queue vs Legacy Space Message Implementation - Code Comparison Audit

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Purpose

Deep dive comparison of the Action Queue Space message handler (`send-channel-message`) vs the legacy path to identify any potential issues introduced by the Action Queue implementation.

## Classification

| Label | Applies | Notes |
|-------|---------|-------|
| `action-queue-bug` | ❌ No | No new bugs introduced |
| `pre-existing` | ⚠️ Yes | Critical bug found in legacy edit/pin path |
| `network-issue` | N/A | Not applicable |
| `test-environment` | N/A | Not applicable |

---

## Code Locations

| Implementation | File | Lines |
|----------------|------|-------|
| New post entry point | `MessageService.ts` | 3467-3491 |
| `send-channel-message` handler (full impl) | `ActionQueueHandlers.ts` | 341-532 |
| edit/pin/delete handlers (thin wrappers) | `ActionQueueHandlers.ts` | 226-325 |
| `submitChannelMessage()` edit/pin path | `MessageService.ts` | 3494-3760 |

### Handler Flow Clarification

The Action Queue has two types of Space message handlers:

#### 1. `send-channel-message` (new post messages) - Full Implementation

Handler does encryption itself:
```
User sends new message in Space
    │
    ▼
MessageService.submitChannelMessage() (line 3467-3491)
    ├─► Sign message
    ├─► Add to cache (optimistic)
    └─► actionQueueService.enqueue('send-channel-message', ...)
            │
            ▼
ActionQueueHandlers.sendChannelMessage (line 341-532)
    ├─► TripleRatchetEncrypt()
    ├─► sendHubMessage()
    ├─► saveEncryptionState()  ← ✅ CORRECTLY SAVES
    └─► Update cache status
```

#### 2. `edit-message`, `pin-message`, `unpin-message`, `delete-message` - Thin Wrappers

These handlers delegate to `submitChannelMessage()` which does the encryption:
```
User edits/pins/deletes message
    │
    ▼
Component/Hook
    └─► actionQueueService.enqueue('edit-message', ...)
            │
            ▼
ActionQueueHandlers.editMessage (line 267-301)
    └─► messageService.submitChannelMessage(editMessage)
            │
            ▼
MessageService.submitChannelMessage() (line 3494-3760)
    └─► enqueueOutbound(async () => {
            ├─► TripleRatchetEncrypt()
            ├─► sendHubMessage()
            ├─► saveMessage()
            └─► ❌ NO saveEncryptionState()  ← BUG
        })
```

**Key distinction**: This is NOT a fallback path - it's the actual implementation.
The Action Queue handlers add persistence/retry benefits but delegate encryption
to `submitChannelMessage()`, which has always had this bug.

---

## Comparison Summary

### ✅ IDENTICAL: Core Encryption Logic

Both implementations use the same Triple Ratchet encryption flow:

```
1. Get encryption states from IndexedDB
2. TripleRatchetEncrypt with ratchet_state + message
3. Send encrypted envelope via sendHubMessage
4. Save message to IndexedDB
```

### ✅ IDENTICAL: Message Signing

Both implementations:
```typescript
// Action Queue (line 3453-3465) and Legacy (line 3571-3583)
if (!space?.isRepudiable || (space?.isRepudiable && !skipSigning)) {
  const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
  message.publicKey = inboxKey.publicKey;
  message.signature = Buffer.from(
    JSON.parse(ch.js_sign_ed448(...))
  ).toString('hex');
}
```

---

## Differences Found

### 1. 🚨 CRITICAL: Encryption State Persistence Bug

**`send-channel-message` handler (ActionQueueHandlers.ts:414-424):**
```typescript
// Save the updated Triple Ratchet state
const newEncryptionState = {
  state: JSON.stringify({
    state: result.ratchet_state,
  }),
  timestamp: Date.now(),
  inboxId: spaceId,
  conversationId: spaceId + '/' + spaceId,
  sentAccept: false,
};
await this.deps.messageDB.saveEncryptionState(newEncryptionState, true);
```

**`submitChannelMessage()` edit path (MessageService.ts:3585-3620):**
```typescript
const msg = secureChannel.TripleRatchetEncrypt(...);
const result = JSON.parse(msg);
// Send message
outbounds.push(await this.sendHubMessage(...));
// Save message
await this.saveMessage(...);
await this.addMessage(...);
return outbounds;
// ⚠️ NO saveEncryptionState() call!
```

**`submitChannelMessage()` pin path (MessageService.ts:3719-3754):**
```typescript
const msg = secureChannel.TripleRatchetEncrypt(...);
const result = JSON.parse(msg);
// Send message
outbounds.push(await this.sendHubMessage(...));
// Save message
await this.saveMessage(...);
await this.addMessage(...);
return outbounds;
// ⚠️ NO saveEncryptionState() call!
```

**Classification**: `pre-existing bug` - `submitChannelMessage()` has always had this bug

**Impact**:
- Triple Ratchet state advances on encrypt but isn't saved
- Next message uses stale ratchet state
- Could cause decryption failures or message loss
- Affects edit/pin/delete messages (which use `submitChannelMessage()`)
- New post messages use `send-channel-message` handler (which saves correctly)

**Risk Assessment**:
| Factor | Level |
|--------|-------|
| Likelihood | High - happens on every edit/pin |
| Impact | High - ratchet desync can cause decryption failures |
| Mitigation | Partial - server may resync, but not guaranteed |

**Recommendation**: Either:
1. Update `edit-message`/`pin-message`/`unpin-message`/`delete-message` handlers to do encryption themselves (like `send-channel-message` does)
2. OR add `saveEncryptionState()` to `submitChannelMessage()` in MessageService.ts after the edit/pin encryption

---

### 2. ✅ IMPROVEMENT: Space/Channel Existence Validation

**Action Queue (ActionQueueHandlers.ts:348-378):**
```typescript
// Check if space/channel still exists
const space = await this.deps.messageDB.getSpace(spaceId);
if (!space) {
  console.log(`[ActionQueue] Discarding message for deleted space: ${spaceId}`);
  this.deps.messageService.updateMessageStatus(..., 'failed', 'Space was deleted');
  return;
}

const channel = space.groups?.flatMap((g) => g.channels).find((c) => c.channelId === channelId);
if (!channel) {
  console.log(`[ActionQueue] Discarding message for deleted channel: ${channelId}`);
  this.deps.messageService.updateMessageStatus(..., 'failed', 'Channel was deleted');
  return;
}
```

**Legacy (MessageService.ts:3494-3760):**
- No existence validation before processing
- Would fail with cryptic error if space/channel deleted

**Classification**: `improvement` - Action Queue provides better UX and error handling.

---

### 3. ✅ IMPROVEMENT: Error Handling & Retry Classification

**Action Queue (ActionQueueHandlers.ts:507-532):**
```typescript
isPermanentError: (error) => {
  return (
    error.message.includes('400') ||
    error.message.includes('403') ||
    error.message.includes('Space was deleted') ||
    error.message.includes('Channel was deleted')
  );
},
onFailure: (context, error) => {
  this.deps.messageService.updateMessageStatus(
    ..., 'failed', this.sanitizeError(error)
  );
},
```

**Legacy (MessageService.ts:3494-3760):**
- Errors thrown inside `enqueueOutbound` callback
- No classification of permanent vs transient errors
- No user-facing error messages

**Classification**: `improvement` - Action Queue has better error UX.

---

### 4. ✅ IMPROVEMENT: Cache Re-Add Logic

**Action Queue (ActionQueueHandlers.ts:445-486):**
```typescript
// Ensure message is in React Query cache (may have been removed by refetch)
this.deps.queryClient.setQueryData(messagesKey, (oldData) => {
  // Check if message already exists in cache
  const messageExists = oldData.pages.some((page) =>
    page.messages.some((m) => m.messageId === messageId)
  );

  if (messageExists) {
    return oldData; // Will be updated by updateMessageStatus
  }

  // Message not in cache - re-add it (only for post messages)
  if (signedMessage.content.type !== 'post') {
    return oldData;
  }

  return {
    ...oldData,
    pages: oldData.pages.map((page, index) => {
      if (index === oldData.pages.length - 1) {
        const newMessages = [...page.messages, messageToEncrypt as Message];
        newMessages.sort((a, b) => a.createdDate - b.createdDate);
        return { ...page, messages: newMessages };
      }
      return page;
    }),
  };
});
```

**Legacy (MessageService.ts:3618, 3752):**
```typescript
await this.addMessage(queryClient, spaceId, channelId, message);
// No handling for message evicted from cache
```

**Classification**: `improvement` - Action Queue handles offline/refetch edge case.

---

### 5. ✅ IMPROVEMENT: Reply Cache Invalidation

**Action Queue (ActionQueueHandlers.ts:497-505):**
```typescript
// Invalidate reply notification caches if this is a reply
if ((context.replyMetadata as any)?.parentAuthor) {
  await this.deps.queryClient.invalidateQueries({
    queryKey: ['reply-counts', 'channel', spaceId],
  });
  await this.deps.queryClient.invalidateQueries({
    queryKey: ['reply-notifications', spaceId],
  });
}
```

**Legacy:**
- No reply cache invalidation

**Classification**: `improvement` - Reply counts refresh properly.

---

### 6. ⚠️ DIFFERENCE: Status Update Atomicity

**Action Queue (sendChannelMessage):**
```typescript
// Line 448-486: setQueryData for cache re-add
// Line 489-495: Separate updateMessageStatus call
```

**Action Queue (sendDm - for comparison):**
```typescript
// Lines 731-783: Single atomic setQueryData combining both operations
```

**Classification**: `minor improvement opportunity`

**Notes**: The DM handler combines cache re-add and status update into a single atomic operation. The Channel handler uses two separate calls. In practice, React Query batches these, so the risk is low. However, aligning with the DM pattern would be more correct.

---

### 7. ✅ IDENTICAL: Ephemeral Field Stripping

**Action Queue (ActionQueueHandlers.ts:391):**
```typescript
const { sendStatus: _sendStatus, sendError: _sendError, ...messageToEncrypt } = signedMessage;
```

**Legacy (MessageService.ts:3589):**
- Message object doesn't have sendStatus/sendError at this point
- Fields are only added for optimistic display

**Classification**: `no issue` - Both correctly exclude ephemeral fields from encryption.

---

### 8. ✅ IDENTICAL: Message Saving

Both implementations:
```typescript
await this.saveMessage(
  message,
  this.messageDB,
  spaceId,
  channelId,
  'group',
  {
    user_icon: conversation.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
    display_name: conversation.conversation?.displayName ?? 'Unknown User',
  }
);
```

**Classification**: `identical` - Same IndexedDB persistence.

---

## Risk Assessment

| Finding | Severity | Risk | Action |
|---------|----------|------|--------|
| 1. Encryption state (legacy) | 🚨 CRITICAL | Ratchet desync | Fix legacy OR migrate to AQ |
| 2. Space/channel validation | None | Lower risk | Improvement |
| 3. Error handling | None | Lower risk | Improvement |
| 4. Cache re-add | None | Better offline | Improvement |
| 5. Reply invalidation | None | Better UX | Improvement |
| 6. Status atomicity | Low | Minor race | Consider aligning |
| 7. Field stripping | None | Identical | N/A |
| 8. Message saving | None | Identical | N/A |

---

## Conclusion

### Action Queue Space Message Implementation Status: ✅ SAFE

The Action Queue implementation:
1. Uses identical core encryption logic (Triple Ratchet)
2. **Correctly saves encryption state** (unlike legacy edit/pin)
3. Has better error handling and retry classification
4. Handles offline/refetch edge cases
5. Provides better user feedback on failures
6. Does not introduce any encryption or security regressions

### `submitChannelMessage()` Has Critical Bug 🚨

The edit/pin path in `submitChannelMessage()` (`MessageService.ts:3494-3760`) does NOT save the updated Triple Ratchet state after encryption. This is a **pre-existing bug** that could cause:
- Ratchet state desynchronization
- Message decryption failures
- Potential message loss

**Note**: This is NOT a "legacy fallback" - the Action Queue handlers for edit/pin/delete are thin wrappers that call `submitChannelMessage()`. They add persistence/retry/deduplication benefits but delegate the actual encryption to this buggy code path.

**Recommendation**: Either:
1. Refactor edit/pin/delete handlers to do encryption themselves (like `send-channel-message`)
2. Add `saveEncryptionState()` to `submitChannelMessage()` after edit/pin encryption (quick fix)

---

## Action Items

| Priority | Item | Status |
|----------|------|--------|
| 🚨 Critical | Fix encryption state persistence in `submitChannelMessage()` for edit/pin/delete | ✅ Fixed |
| Low | Align channel handler status update with DM atomic pattern | 📋 Optional |

### Fix Applied (2025-12-19)

Added `saveEncryptionState()` calls after `TripleRatchetEncrypt()` in three locations:

1. **Edit-message path** (`MessageService.ts:3597-3607`)
2. **Pin-message path** (`MessageService.ts:3744-3754`)
3. **retryMessage path** (`MessageService.ts:3857-3867`)

---

## Related

- [Action Queue Bug Index](./INDEX.md)
- [DM Code Comparison Audit (Bug 003)](./003-code-comparison-audit.md)
- [DM Sending Indicator Hang (Bug 001)](./001-dm-sending-indicator-hang.md)
- [WebSocket Queue Starvation (Bug 002)](./002-websocket-queue-starvation.md)

---

_Created: 2025-12-19_
_Updated: 2025-12-19_
_Status: ✅ Bug Fixed_
