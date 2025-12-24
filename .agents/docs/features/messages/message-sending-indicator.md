# Message Sending Indicator

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent, security-analyst agent

## Overview

The message sending indicator provides immediate visual feedback when users send messages. Instead of waiting for network transmission to complete before showing the message (which can take several seconds), messages appear instantly in the UI with a "Sending..." status indicator. Once the message is successfully delivered, the indicator disappears. If delivery fails, users see a "Failed to send" message with a retry option.

This optimistic UI pattern is standard in modern messaging applications (WhatsApp, Telegram, Slack) and significantly improves perceived responsiveness. The feature works identically for both Channel messages (group chats within Spaces) and Direct Messages (1:1 conversations).

## Architecture

### Type System

The feature extends the existing `Message` type with two optional client-side fields:

```typescript
// src/api/quorumApi.ts:90
export type MessageSendStatus = 'sending' | 'sent' | 'failed';

// Added to Message type (lines 134-137)
export type Message = {
  // ... existing fields ...

  /** Client-side ephemeral - NEVER persist to IndexedDB or transmit */
  sendStatus?: MessageSendStatus;
  /** Client-side ephemeral - sanitized error message for display */
  sendError?: string;
};
```

**Critical security constraint**: These fields exist only in client memory. They are explicitly stripped before:
- Persisting to IndexedDB (`saveMessage()`)
- Encrypting for transmission (`TripleRatchetEncrypt()` / `DoubleRatchetEncrypt()`)

### Data Flow

The optimistic update flow differs from the original synchronous approach:

```
┌─────────────────────────────────────────────────────────────────────┐
│ BEFORE (synchronous)                                                │
│                                                                     │
│ User clicks Send → Encrypt → Network send → Save → Add to UI       │
│                    └──────── 2-5 seconds ────────┘                  │
│ User sees nothing until complete                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ AFTER (optimistic)                                                  │
│                                                                     │
│ User clicks Send                                                    │
│       ↓                                                             │
│ Generate nonce (crypto.randomUUID())                                │
│       ↓                                                             │
│ Calculate messageId (SHA-256 hash)                                  │
│       ↓                                                             │
│ Generate signature (Ed448) ← MUST happen before display             │
│       ↓                                                             │
│ Add to React Query cache with sendStatus: 'sending'                 │
│       ↓                                                             │
│ MESSAGE APPEARS IMMEDIATELY (~50ms)                                 │
│       ↓                                                             │
│ Enqueue background work:                                            │
│   - Encrypt (Triple/Double Ratchet)                                 │
│   - Send to network                                                 │
│   - Persist to IndexedDB (without sendStatus)                       │
│       ↓                                                             │
│ On success: Update cache → remove sendStatus → indicator disappears │
│ On failure: Update cache → sendStatus: 'failed' → show retry option │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Components

#### MessageService (`src/services/MessageService.ts`)

**`updateMessageStatus()`** - Updates a message's send status in the React Query cache without causing duplicates:

```typescript
updateMessageStatus(
  queryClient: QueryClient,
  spaceId: string,
  channelId: string,
  messageId: string,
  status: 'sent' | 'failed',
  error?: string
)
```

The method handles a race condition: if the server's copy of the message arrives via WebSocket before the status update runs, the optimistic message (with `sendStatus`) gets replaced by the server version (without `sendStatus`). The update checks for this and skips if the message no longer has a `sendStatus` field.

**`retryMessage()` / `retryDirectMessage()`** - Re-queues a failed message for another send attempt. The same signed message is reused (safe because the signature only covers the messageId, and encryption creates fresh envelopes).

#### Message Component (`src/components/message/Message.tsx`)

The status indicator renders at the bottom of each message:

```tsx
{message.sendStatus === 'sending' && (
  <FlexRow className="message-status sending">
    <Icon name="clock" size="xs" />
    <Text size="sm" variant="warning">{t`Sending...`}</Text>
  </FlexRow>
)}

{message.sendStatus === 'failed' && (
  <FlexRow className="message-status failed">
    <Icon name="warning" size="xs" />
    <Text size="sm" variant="danger">
      {t`Failed to send.`}{' '}
      <Text as="span" className="message-status__retry" onClick={handleRetry}>
        {t`Retry`}
      </Text>
    </Text>
  </FlexRow>
)}
```

**React.memo integration**: The `Message` component uses `React.memo` with a custom comparison function. The `sendStatus` field is included in the comparison to ensure the component re-renders when status changes.

#### Styles (`src/components/message/Message.scss`)

```scss
.message-status {
  &.sending {
    color: rgb(var(--warning));
    // Only show after 1s delay - avoids flicker for fast sends
    opacity: 0;
    animation: fadeInSending 0.2s ease-in forwards;
    animation-delay: 1s;
  }

  &.failed {
    color: rgb(var(--danger));
  }

  &__retry {
    text-decoration: underline;
    cursor: pointer;
  }
}
```

The 1-second animation delay is a UX optimization: most messages send in under a second, so showing "Sending..." briefly would create unnecessary visual noise. The indicator only becomes visible if the send takes longer than expected.

### Integration Points

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| Context | `MessageDB.tsx` | Exposes `retryMessage` and `retryDirectMessage` via React hook |
| Page | `Channel.tsx` | Creates `handleRetryMessage` callback for channel messages |
| Page | `DirectMessage.tsx` | Creates `handleRetryMessage` callback for DM messages |
| List | `MessageList.tsx` | Passes `onRetryMessage` prop down to individual messages |
| Item | `Message.tsx` | Renders status indicator, handles retry click |
| Service | `MessageService.ts` | Implements optimistic updates, status transitions, retry logic |

### Message Sorting

When a message is in "sending" state, it sorts to the end of the message list. This prevents a jarring UX where an older message from another user arrives and pushes the pending message up:

```typescript
// In addMessage() - sort logic for last page only
newMessages.sort((a: Message, b: Message) => {
  // Pending messages always go to END
  if (a.sendStatus === 'sending' && b.sendStatus !== 'sending') return 1;
  if (b.sendStatus === 'sending' && a.sendStatus !== 'sending') return -1;
  // Otherwise maintain chronological order
  return a.createdDate - b.createdDate;
});
```

Once the message transitions to "sent", it stays in its chronological position.

## Security Considerations

### Signature Timing

The message signature **must** be generated before the optimistic display. This maintains non-repudiability: the user has cryptographically committed to the message content before seeing it in the UI.

```typescript
// Signature generation (Ed448) - happens OUTSIDE enqueueOutbound()
const signature = ch.js_sign_ed448(
  privateKey,
  Buffer.from(messageId).toString('base64')
);

// Then add to cache and display
addMessage(queryClient, spaceId, channelId, signedMessage);

// THEN enqueue the network operation
enqueueOutbound(async () => { /* encrypt and send */ });
```

### Retry Safety

Retrying a failed message reuses the original signature. This is secure because:

1. **Signature covers only messageId**: No timestamps, nonces, or other timing data. The signature is deterministic for the same messageId + key pair.

2. **Encryption is unique per attempt**: Triple Ratchet (channels) and Double Ratchet (DMs) generate fresh encrypted envelopes for each send attempt as the ratchet state advances.

3. **Client deduplication**: The `addMessage()` function filters by messageId, preventing duplicate messages in the UI.

4. **No replay vulnerability**: The server and other clients have their own deduplication based on messageId.

### Error Sanitization

Error messages shown to users are sanitized to prevent information leakage:

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
  return 'Send failed';
};
```

This ensures users never see: IP addresses, hostnames, file paths, stack traces, or internal error codes.

## Action Queue Integration

Message sending is now integrated with the [Action Queue](../action-queue.md), providing:

| Feature | Description |
|---------|-------------|
| **Crash recovery** | Messages persist to IndexedDB and survive app restarts |
| **Automatic retry** | Failed messages retry with exponential backoff (2s, 4s, 8s) |
| **Offline support** | Messages queue while offline and send when connectivity is restored |
| **Multi-tab safety** | Status-based gating prevents duplicate sends across tabs |

The signing/encryption separation described above enables safe retries - the same signed message can be re-encrypted and sent without creating duplicates.

## Related Documentation

- **Implementation Task**: `.agents/tasks/.done/message-sending-indicator.md` - Full implementation plan with phases
- **Action Queue**: [Action Queue](../action-queue.md) - Persistent queue with retry and offline support

---

*Updated: 2025-12-18*
