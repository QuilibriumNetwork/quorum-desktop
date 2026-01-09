---
type: report
title: '009: DM Offline Support - Conditional Action Queue Routing'
status: done
created: 2025-12-22T00:00:00.000Z
updated: '2026-01-09'
---

# 009: DM Offline Support - Conditional Action Queue Routing

> **AI-Generated**: May contain errors. Verify before use.


**Supersedes**: [009-dm-offline-registration-persistence-fix-old.md](009-dm-offline-registration-persistence-fix-old.md)

---

## Summary

Route DM sending through different paths based on conversation state:

- **New conversation** → Skip action queue, use direct path (would fail offline anyway - requires fresh registration data)
- **Existing conversation** → Use action queue (works offline with existing encryption state)

This follows the same pattern as [007-plaintext-private-keys-fix.md](007-plaintext-private-keys-fix.md) - don't store data that isn't needed.

---

## Why the Previous Fix Was Over-Engineered

The previous proposal (009-old) suggested storing full `self` and `counterparty` UserRegistration objects in IndexedDB with encryption. However, analysis of the SDK code reveals:

### What's Actually Used from `self`:

Looking at `DoubleRatchetInboxEncrypt` and `DoubleRatchetInboxEncryptForceSenderInit` in the SDK:

```typescript
// Only acceptee.user_address is used (lines 882-883, 983 in channel.ts)
user_address: acceptee.user_address,
```

**Only `self.user_address` is needed** - a simple string that identifies the sender.

### What's Already Persisted:

The encryption state (`DoubleRatchetStateAndInboxKeys`) already contains:

```typescript
{
  ratchet_state: string;           // Double Ratchet cryptographic state
  receiving_inbox: InboxKeyset;    // Our inbox keys for receiving replies
  sending_inbox: SendingInbox;     // Counterparty's inbox address + encryption key
  tag: string;                     // Inbox address for routing
  sent_accept?: boolean;
}
```

**For established sessions, the encryption state has everything needed to encrypt and send messages!**

### When `counterparty` Data Is Actually Needed:

Only when creating a NEW Double Ratchet session (first message to a new device):

```typescript
// ActionQueueHandlers.ts:621-625 - Finding target device for new session
const targetDevice = self.device_registrations
  .concat(counterparty.device_registrations)
  .find((d) => d.inbox_registration.inbox_address === inbox);
```

But this only happens when:
1. First message ever to a contact (no encryption state exists)
2. Counterparty added a new device after last contact

**Both are rare edge cases that can gracefully require online.**

---

## Proposed Fix

### Approach: Conditional Routing at Enqueue Time

At the point of enqueueing, check if this is a new conversation:
- **New conversation (no encryption state)** → Don't use action queue, call send directly
- **Existing conversation (has encryption state)** → Use action queue for offline resilience

### Files to Modify

1. **Enqueue call site** - Add condition to check for existing encryption state before enqueueing
2. **`src/services/ActionQueueHandlers.ts`** - Simplify `send-dm` handler (only handles existing conversations)

---

## Implementation

### 1. Conditional Routing at Enqueue Time

In [MessageService.ts:1516-1553](src/services/MessageService.ts#L1516-L1553):

```typescript
// Check if we have existing encryption states for this conversation
// If yes, use action queue (works offline). If no, use legacy path (creates new sessions).
const conversationId = address + '/' + address;
const existingStates = await this.messageDB.getEncryptionStates({ conversationId });
const hasEstablishedSessions = existingStates.length > 0;

if (hasEstablishedSessions) {
  // Add to cache with 'sending' status (optimistic update)
  await this.addMessage(queryClient, address, address, {
    ...message,
    sendStatus: 'sending',
  });

  // Queue to ActionQueue for persistent, crash-resistant delivery
  await this.actionQueueService.enqueue(
    'send-dm',
    {
      address,
      signedMessage: message,
      messageId: messageIdHex,
      selfUserAddress: self.user_address,  // Only store the address string
      senderDisplayName: currentPasskeyInfo.displayName,
      senderUserIcon: currentPasskeyInfo.pfpUrl,
    },
    `send-dm:${address}:${messageIdHex}`
  );

  return; // Post message handling complete via action queue
}

// No established sessions - fall through to legacy path below
// which will create new sessions using full self/counterparty data
```

### 2. Handler Only Handles Existing Conversations

In [ActionQueueHandlers.ts:521-604](src/services/ActionQueueHandlers.ts#L521-L604):

```typescript
// send-dm handler - only handles existing conversations with encryption state
const selfUserAddress = context.selfUserAddress as string;

// Get encryption states - these contain all the inbox info we need for established sessions
const response = await this.deps.messageDB.getEncryptionStates({ conversationId });
const sets = response.map((e) => JSON.parse(e.state));

// For established sessions, we only need selfUserAddress (SDK only uses user_address field)
const minimalSelf = { user_address: selfUserAddress } as secureChannel.UserRegistration;

// Get target inboxes from existing encryption states (excluding our own device)
const targetInboxes = sets
  .map((s) => s.tag as string)
  .filter((tag) => tag !== keyset.deviceKeyset.inbox_keyset.inbox_address);

// Validate we have recipients to send to
if (targetInboxes.length === 0) {
  throw new Error('No established sessions available. Please connect to the internet to initialize the conversation.');
}

// Encrypt for each inbox using existing encryption states (Double Ratchet)
for (const inbox of targetInboxes) {
  const set = sets.find((s) => s.tag === inbox);
  if (!set) continue;

  if (set.sending_inbox.inbox_public_key === '') {
    sessions.push(...secureChannel.DoubleRatchetInboxEncryptForceSenderInit(
      keyset.deviceKeyset, [set], JSON.stringify(messageToEncrypt),
      minimalSelf, senderDisplayName, senderUserIcon
    ));
  } else {
    sessions.push(...secureChannel.DoubleRatchetInboxEncrypt(
      keyset.deviceKeyset, [set], JSON.stringify(messageToEncrypt),
      minimalSelf, senderDisplayName, senderUserIcon
    ));
  }
}
```

### 3. Remove Counterparty/Self from Context

Since the handler only processes existing conversations, it doesn't need:
- `self` UserRegistration - replaced with `selfUserAddress` string
- `counterparty` UserRegistration - not needed (encryption state has everything)

---

## Scenarios

| Scenario | Path | Behavior |
|----------|------|----------|
| New conversation, online | Direct (no queue) | Works - fetches registration, creates session |
| New conversation, offline | Direct (no queue) | Fails immediately (expected - needs network) |
| Existing conversation, online | Action queue | Works - queued, processed, sent |
| Existing conversation, offline | Action queue | **Queued, sent when online** |
| Existing conversation, counterparty new device | Action queue | Sends to known inboxes (new device gets msg when online) |
| App restart with pending DM | Action queue | Works - encryption state persists |

---

## What This Removes

Compared to the old 009 fix, this approach:

- **Removes**: Need for `user_registrations_encrypted` IndexedDB store
- **Removes**: AES-GCM encryption infrastructure for registrations
- **Removes**: 7-day cache TTL and expiration logic
- **Removes**: Logout cleanup for cached registrations
- **Removes**: Storing inbox addresses and public keys (metadata concern)

---

## Verification Checklist

- [x] TypeScript compiles: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
- [ ] DM sending works online (existing conversation)
- [ ] DM sending works offline with existing encryption state
- [ ] New conversation online works (legacy path)
- [ ] New conversation offline fails gracefully (expected - needs network)
- [ ] App restart with pending DM works (encryption state persists)
- [x] No `self` or `counterparty` objects in action queue context (only `selfUserAddress` string)

---

## Comparison with Previous Approach

| Aspect | Old 009 (store registrations) | New 009 (conditional routing) |
|--------|------------------------------|-------------------------------|
| Data stored | Full UserRegistration (encrypted) | Only `selfUserAddress` string |
| Metadata risk | High (social graph, inbox addresses) | None |
| Complexity | ~200 lines new code | ~20 lines conditional logic |
| New conversation offline | Would fail in handler anyway | Fails immediately (clearer UX) |
| Existing conversation offline | Works | Works |
| Security review | Required (encryption at rest) | Not needed |

**The new approach is simpler, more secure (less data stored), and provides clearer UX by failing fast for new conversations instead of queuing something that can't succeed.**

---

## Related

- **Previous approach**: [009-dm-offline-registration-persistence-fix-old.md](009-dm-offline-registration-persistence-fix-old.md)
- **Similar pattern**: [007-plaintext-private-keys-fix.md](007-plaintext-private-keys-fix.md)
- **Action Queue Feature**: [../../docs/features/action-queue.md](../../docs/features/action-queue.md)

---
