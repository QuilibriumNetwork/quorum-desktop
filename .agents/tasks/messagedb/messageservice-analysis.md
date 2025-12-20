# MessageService.ts Analysis

**Last Updated**: 2025-12-20
**File**: `src/services/MessageService.ts`
**Current Size**: 4,350 lines
**Status**: Large but well-structured - new duplication patterns identified

> **AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent (partial - see notes below)

---

## Current State

### Size & Growth

| Period | Lines | Change | Cause |
|--------|-------|--------|-------|
| Oct 2025 | 2,314 | - | Initial extraction from MessageDB |
| Dec 14, 2025 | 3,527 | +52% | Feature growth |
| Dec 16, 2025 | 4,337 | +23% | Message sending indicator |
| Dec 18, 2025 (AM) | 4,397 | +1.4% | Action Queue integration |
| Dec 18, 2025 (PM) | 4,148 | -5.7% | Removed dead fallback code |
| Dec 19, 2025 | **4,350** | **+4.9%** | Restored update-profile handler |

**Growth rate**: +88% since initial extraction (Oct 2025)

### Method Breakdown (11 methods)

| Method | Lines | Change | Description |
|--------|-------|--------|-------------|
| `saveMessage()` | 472 | 0 | Save message to DB (handles 7 message types) |
| `updateMessageStatus()` | 44 | 0 | Optimistic status updates in cache |
| `addMessage()` | 750 | **+5** | React Query cache updates (added update-profile handling) |
| `submitMessage()` | 521 | 0 | DM submission via Action Queue |
| `handleNewMessage()` | 1,354 | 0 | Incoming message handler |
| `sanitizeError()` | 20 | 0 | Private helper for error sanitization |
| `submitChannelMessage()` | 568 | **+117** | Space/channel submission (added update-profile handler) |
| `retryMessage()` | 122 | 0 | Retry failed channel messages |
| `retryDirectMessage()` | 196 | 0 | Retry failed direct messages |
| `deleteConversation()` | 101 | 0 | Cleanup operations |
| `setActionQueueService()` | 7 | 0 | Setter for ActionQueue dependency injection |

---

## Dec 19, 2025: Update Profile Handler Restored

**Commit**: `49c19aeb845bc83257bf6a9556a2a82c506da340`
**Change**: +122 lines (net)

The `update-profile` handler was lost during the message sending indicator refactor and has been restored. This handler allows users to update their display name and avatar within a space.

### New Code Added

**Location**: `submitChannelMessage()` lines 3791-3908

The handler:
1. Generates message ID using SHA-256
2. Creates message structure with `UpdateProfileMessage` content
3. Retrieves encryption state for Triple Ratchet
4. **Always signs** (required for profile updates - no repudiability option)
5. Encrypts with Triple Ratchet
6. Saves encryption state
7. Sends to hub
8. **Updates local database immediately** (optimistic update)
9. **Updates React Query cache** for instant UI refresh

---

## Duplication Patterns Found

### 1. Triple Ratchet Encryption Pattern (~85 lines duplicated 5x)

The same encryption pattern is repeated in:
- `submitChannelMessage()` for **edit-message** (lines 3593-3625)
- `submitChannelMessage()` for **pin-message** (lines 3740-3772)
- `submitChannelMessage()` for **update-profile** (lines 3843-3875)
- `retryMessage()` (lines 3970-4002)
- `ActionQueueHandlers.ts` for **send-channel-message** (lines 393-424)

**Pattern structure** (identical in all locations):
```typescript
// 1. Get encryption states
const response = await this.messageDB.getEncryptionStates({
  conversationId: spaceId + '/' + spaceId,
});
const sets = response.map((e) => JSON.parse(e.state));

// 2. Triple Ratchet encrypt
const msg = secureChannel.TripleRatchetEncrypt(
  JSON.stringify({
    ratchet_state: sets[0].state,
    message: [...new Uint8Array(Buffer.from(JSON.stringify(message), 'utf-8'))],
  })
);
const result = JSON.parse(msg);

// 3. Save updated state
const newEncryptionState = {
  state: JSON.stringify({ state: result.ratchet_state }),
  timestamp: Date.now(),
  inboxId: spaceId,
  conversationId: spaceId + '/' + spaceId,
  sentAccept: false,
};
await this.messageDB.saveEncryptionState(newEncryptionState, true);

// 4. Send to hub
outbounds.push(await this.sendHubMessage(spaceId, JSON.stringify({
  type: 'message',
  message: JSON.parse(result.envelope),
})));
```

**Lines saved if extracted**: ~250 lines (5 instances × ~50 lines each)

### 2. Message ID Generation Pattern (~12 lines duplicated 3x)

**Location**: `submitChannelMessage()` - edit, pin, update-profile handlers

```typescript
const messageId = await crypto.subtle.digest(
  'SHA-256',
  Buffer.from(
    nonce +
      'type-name' +
      currentPasskeyInfo.address +
      canonicalize(messageObject),
    'utf-8'
  )
);
```

**Lines saved if extracted**: ~25 lines

### 3. Ed448 Signing Pattern (~15 lines duplicated 3x)

**Location**: edit-message (3578-3591), pin-message (3726-3738), update-profile (3830-3841)

```typescript
const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
message.publicKey = inboxKey.publicKey;
message.signature = Buffer.from(
  JSON.parse(
    ch.js_sign_ed448(
      Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
      Buffer.from(messageId).toString('base64')
    )
  ),
  'base64'
).toString('hex');
```

**Note**: `update-profile` always signs, while edit/pin have a repudiability check.

### 4. Profile Update Cache Logic (~25 lines duplicated 2x)

**Location 1**: `submitChannelMessage()` update-profile handler (lines 3880-3905)
**Location 2**: `addMessage()` update-profile handler (lines 1080-1117)

Both update local DB and React Query cache when a profile update occurs. The difference:
- **submitChannelMessage**: Immediate local update (sender-side)
- **addMessage**: Received message handling (receiver-side)

This is **intentional** parallelism (like reactions) but worth noting.

### 5. Retry Methods Partially Obsolete (~300 lines)

**Location**: `retryMessage()` (122 lines), `retryDirectMessage()` (196 lines)

With ActionQueue's automatic retry mechanism, manual retry methods are now secondary. Still needed for UI-triggered retry of permanently failed messages.

---

## Refactoring Opportunities

> **Research Context**: Academic research strongly supports abstraction for cryptographic code. See [Cryptographic Code Best Practices Report](../../reports/cryptographic-code-best-practices_2025-12-20.md) for detailed findings.

### Feature Analyzer Review Notes

The feature-analyzer agent reviewed these recommendations and raised valid concerns about **implementation differences** between the 5 instances. However, its reasoning that "crypto benefits from explicit duplication" is **not supported by research** (see report above).

**Valid concerns from review:**
- `retryMessage()` strips ephemeral fields (`sendStatus`, `sendError`) before encrypting
- `ActionQueueHandlers.ts` saves encryption state AFTER sending (different order)
- `update-profile` always signs (no repudiability check), while edit/pin have conditional signing

**Invalid concern**: The claim that "explicit repetition is preferable to abstraction in crypto" - research shows the opposite.

### Refactoring Recommendations (Updated)

| Opportunity | Lines Saved | Risk | Verdict |
|-------------|-------------|------|---------|
| Extract `encryptAndSendToSpace()` helper | ~250 | **Medium** | **Recommended** (with options for differences) |
| Extract `generateMessageId()` helper | ~25 | Low | Worth doing |
| Extract `signMessage()` helper | ~30 | **Medium** | Worth doing (needs `forceSign` option) |

#### Recommended: Extract encryptAndSendToSpace()

**Risk: Medium** | **Lines Saved: ~250**

The Triple Ratchet encrypt + save state + send pattern is now repeated **5 times**. Research shows centralized crypto code is easier to audit and less prone to inconsistencies.

**Must handle real differences via options:**

```typescript
private async encryptAndSendToSpace(
  spaceId: string,
  message: Message,
  options: {
    stripEphemeralFields?: boolean;  // For retry scenarios
    saveStateAfterSend?: boolean;    // For ActionQueue handler
  } = {}
): Promise<string> {
  const response = await this.messageDB.getEncryptionStates({
    conversationId: spaceId + '/' + spaceId,
  });
  const sets = response.map((e) => JSON.parse(e.state));

  // Strip ephemeral fields if requested (for retries)
  const messageToEncrypt = options.stripEphemeralFields
    ? (({ sendStatus, sendError, ...rest }) => rest)(message as any)
    : message;

  const msg = secureChannel.TripleRatchetEncrypt(
    JSON.stringify({
      ratchet_state: sets[0].state,
      message: [...new Uint8Array(Buffer.from(JSON.stringify(messageToEncrypt), 'utf-8'))],
    })
  );
  const result = JSON.parse(msg);

  const saveState = async () => {
    await this.messageDB.saveEncryptionState({
      state: JSON.stringify({ state: result.ratchet_state }),
      timestamp: Date.now(),
      inboxId: spaceId,
      conversationId: spaceId + '/' + spaceId,
      sentAccept: false,
    }, true);
  };

  if (!options.saveStateAfterSend) {
    await saveState();
  }

  const outbound = await this.sendHubMessage(spaceId, JSON.stringify({
    type: 'message',
    message: JSON.parse(result.envelope),
  }));

  if (options.saveStateAfterSend) {
    await saveState();
  }

  return outbound;
}
```

#### Worth Doing: Extract generateMessageId()

```typescript
private async generateMessageId(
  nonce: string,
  type: string,
  senderId: string,
  content: object
): Promise<ArrayBuffer> {
  return crypto.subtle.digest(
    'SHA-256',
    Buffer.from(nonce + type + senderId + canonicalize(content), 'utf-8')
  );
}
```

#### Worth Doing: Extract signMessage()

**Must preserve conditional logic:**

```typescript
private async signMessage(
  spaceId: string,
  message: Message,
  messageId: ArrayBuffer,
  options: { forceSign?: boolean; skipSigning?: boolean; isRepudiable?: boolean } = {}
): Promise<void> {
  // update-profile always signs; edit/pin check repudiability
  const shouldSign = options.forceSign || !options.isRepudiable || (options.isRepudiable && !options.skipSigning);

  if (!shouldSign) return;

  const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
  message.publicKey = inboxKey.publicKey;
  message.signature = Buffer.from(
    JSON.parse(
      ch.js_sign_ed448(
        Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
        Buffer.from(messageId).toString('base64')
      )
    ),
    'base64'
  ).toString('hex');
}
```

### Previous Opportunities (unchanged)

| Opportunity | Lines Saved | Risk | Verdict |
|-------------|-------------|------|---------|
| ~~Remove dead fallback code~~ | ~~249~~ | ~~Low~~ | **DONE** |
| Refactor retry methods to use ActionQueue | ~200 | Medium | Worth considering |
| Extract `setOptimisticSendingStatus()` helper | ~30 | Low | Low priority |

---

## handleNewMessage Refactoring (ON HOLD)

The `handleNewMessage` function (1,354 lines) remains the only meaningful size-reduction opportunity.

**Target**: 1,354 lines → 400-500 lines using Handler Registry Pattern

**Blockers:**
- Requires comprehensive test coverage first
- Import chain issue blocks test creation
- Risk outweighs benefit for current feature velocity

**See**: [messageservice-handlenewmessage-refactor.md](./messageservice-handlenewmessage-refactor.md) for full plan (ON HOLD)

---

## Verdict

**Medium-risk refactoring recommended.**

The `update-profile` handler restoration introduced the 5th instance of the Triple Ratchet encryption pattern (including ActionQueueHandlers.ts). [Research supports](../reports/cryptographic-code-best-practices_2025-12-20.md) extracting crypto code to reduce misuse risk:
- ~250 lines saved
- Centralized crypto code is easier to audit
- Reduces opportunity for inconsistent implementations
- Makes adding future message types safer

### Action Items

1. **Extract `encryptAndSendToSpace()` helper** - High value, medium risk (must handle options)
2. **Extract `generateMessageId()` helper** - Medium value, low risk
3. **Extract `signMessage()` helper** - Medium value, medium risk (must preserve conditional logic)

### Completed

- **Removed dead `enqueueOutbound` fallback paths** — saved 249 lines (Dec 18, 2025)

### Defer

- Retry method refactoring (medium risk, needs careful testing)
- `setOptimisticSendingStatus()` extraction (low value)
- `handleNewMessage` refactoring (blocked by test infrastructure)

---

## Related Files

- [MessageDB Current State](./messagedb-current-state.md) - Overall refactoring status
- [handleNewMessage Refactor Plan](./messageservice-handlenewmessage-refactor.md) - ON HOLD
- [Action Queue](../../docs/features/action-queue.md) - Background task processing system
- [Cryptographic Code Best Practices](../../reports/cryptographic-code-best-practices_2025-12-20.md) - Research on abstraction vs duplication

---

_Last updated: 2025-12-20_
_Next action: Consider extracting encryptAndSendToSpace() helper with proper options to handle implementation differences_
