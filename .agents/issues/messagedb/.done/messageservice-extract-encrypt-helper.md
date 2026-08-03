---
type: task
title: "Extract encryptAndSendToSpace() Helper"
status: done
complexity: medium
created: 2025-12-20
updated: 2026-01-09
---

# Extract encryptAndSendToSpace() Helper

> **AI-Generated**: May contain errors. Verify before use.


**Related**: [MessageService Analysis](./messageservice-analysis.md) | [Crypto Best Practices](../../reports/cryptographic-code-best-practices_2025-12-20.md)

**Files**:
- `src/services/MessageService.ts` (lines 3593-3625, 3740-3772, 3843-3875, 3970-4002)
- `src/services/ActionQueueHandlers.ts` (lines 393-424)

## What & Why

The Triple Ratchet encryption pattern is duplicated 5 times across MessageService and ActionQueueHandlers. [Research shows](../../reports/cryptographic-code-best-practices_2025-12-20.md) that centralizing crypto code reduces misuse risk and makes auditing easier.

**Current state**: 5 near-identical implementations with subtle differences
**Desired state**: Single helper with options to handle context-specific variations
**Value**: ~250 lines saved, consistent encryption, easier to add future message types

## Context

- **Research basis**: IEEE S&P 2017, ACM 2019 studies support crypto abstraction
- **Feature analyzer review**: Raised valid concerns about implementation differences
- **Key differences to preserve**:
  1. `retryMessage()` strips `sendStatus`/`sendError` before encrypting
  2. `ActionQueueHandlers.ts` saves state AFTER sending
  3. All others save state BEFORE sending

## Implementation

### Phase 1: Create Helper Method

- [x] **Add `encryptAndSendToSpace()` to MessageService** (`MessageService.ts`)
  - Done when: Method exists with correct signature and options
  - Location: Near other private helpers (around line 150)

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

### Phase 2: Refactor MessageService Call Sites (one at a time)

- [ ] **Refactor edit-message handler** (`MessageService.ts:3593-3625`)
  - Replace inline encryption with: `outbounds.push(await this.encryptAndSendToSpace(spaceId, message));`
  - Verify: Edit message works in Space channel

- [ ] **Refactor pin-message handler** (`MessageService.ts:3740-3772`)
  - Replace inline encryption with: `outbounds.push(await this.encryptAndSendToSpace(spaceId, message));`
  - Verify: Pin/unpin message works in Space channel

- [ ] **Refactor update-profile handler** (`MessageService.ts:3843-3875`)
  - Replace inline encryption with: `outbounds.push(await this.encryptAndSendToSpace(spaceId, message));`
  - Verify: Profile update (display name, avatar) works in Space

- [ ] **Refactor retryMessage()** (`MessageService.ts:3970-4002`)
  - Replace inline encryption with: `outbounds.push(await this.encryptAndSendToSpace(spaceId, failedMessage, { stripEphemeralFields: true }));`
  - Verify: Retry failed channel message works

### Phase 3: Refactor ActionQueueHandlers

- [ ] **Expose helper or extract to shared location**
  - Option A: Make helper public and call from ActionQueueHandlers
  - Option B: Move helper to shared utility (may need MessageDB access)
  - Done when: ActionQueueHandlers uses the same helper

- [ ] **Refactor send-channel-message handler** (`ActionQueueHandlers.ts:393-424`)
  - Use helper with: `{ saveStateAfterSend: true }`
  - Verify: New channel messages send correctly

## Verification

### Functional Tests (Manual)

✅ **Edit message works**
- Test: In a Space channel, send a message, edit it within 15 min → Edit appears for all members
- Edge case: Edit after 15 min should fail silently

✅ **Pin message works**
- Test: In a Space channel, pin a message → Pin indicator appears, pinned messages list updates
- Test: Unpin a message → Pin removed

✅ **Update profile works**
- Test: In a Space, change display name → Name updates for all members
- Test: In a Space, change avatar → Avatar updates for all members

✅ **Retry failed message works**
- Test: Send message while offline, go online, click retry → Message sends successfully
- Edge case: Multiple retries should work

✅ **New channel messages work**
- Test: Send a new message in Space channel → Message appears for all members
- Edge case: Message with attachments, replies, mentions

### Technical Verification

✅ **TypeScript compiles**
- Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✅ **Encryption state consistency**
- Verify: After each message type, encryption state is saved correctly
- Check: No duplicate state saves, no missed state saves

✅ **No regressions in error handling**
- Verify: Failed encryptions still report errors correctly
- Verify: Network failures don't corrupt encryption state

## Definition of Done

- [ ] Helper method created with correct options
- [ ] All 5 call sites refactored to use helper
- [ ] All functional tests pass
- [ ] TypeScript compiles without errors
- [ ] No console errors during testing
- [ ] Update [messageservice-analysis.md](./messageservice-analysis.md) with completion note

## Rollback Plan

If issues are found:
1. Revert to inline implementations (git revert)
2. Document the specific issue in this task
3. Reassess whether differences require separate implementations

---
