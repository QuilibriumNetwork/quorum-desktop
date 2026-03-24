---
type: doc
title: "DM Receipts (Delivery & Read)"
status: done
ai_generated: true
created: 2026-03-23
updated: 2026-03-24
related_docs:
  - .agents/docs/features/messages/message-sending-indicator.md
related_tasks:
  - .agents/tasks/2026-03-18-dm-delivery-receipts-design.md
  - .agents/tasks/2026-03-18-dm-delivery-receipts-plan.md
  - .agents/tasks/2026-03-22-dm-read-receipts-design.md
  - .agents/tasks/2026-03-22-dm-read-receipts-plan.md
  - .agents/bugs/2026-03-22-read-receipts-testing-blocked.md
---

# DM Receipts (Delivery & Read)

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

DM receipts provide two levels of confirmation for sent messages:

| Receipt | Indicator | Meaning |
|---|---|---|
| **Delivery** (Phase 1) | ✓ | Recipient's device received and decrypted the message |
| **Read** (Phase 2) | ✓✓ | Recipient visually saw the message (50%+ visible, 1s dwell, tab focused) |

Both have separate privacy toggles (OFF by default), with read receipts nested under delivery receipts (read requires delivery to be enabled).

**Delivery receipts** buffer individual message IDs and ack them in batches — piggybacking on outgoing DMs when possible, or sending standalone acks after a 10-second timeout via the Action Queue.

**Read receipts** use a **high-water mark** approach — instead of acking individual messages, they send "I've read up to message X (timestamp Y)". One ack can mark dozens of messages as read. Uses a 5-second debounce.

## Architecture

### End-to-End Flow — Delivery Receipts (✓)

```
RECIPIENT SIDE (sending delivery acks):

1. MessageService decrypts incoming DM
   └─ processDeliveryReceiptData(): deliveryReceipts ON? → buffer messageId

2. ReceiptService.onMessageReceived(address, messageId)
   └─ Adds to Set<string> buffer per address, resets 10s timer

3. Ack leaves the device (one of three paths):
   a. PIGGYBACK: Recipient sends a DM → ackMessageIds attached to envelope
      └─ MessageService: flushForPiggyback() before encryption
   b. STANDALONE: 10s timer fires → Action Queue → encrypt → send
      └─ ActionQueueHandlers.ts: sendDeliveryAck handler
   c. BACKGROUND: Tab hide / beforeunload → flushAll()

SENDER SIDE (receiving delivery acks):

4. MessageService decrypts incoming message
   └─ processDeliveryReceiptData(): intercepts type === 'delivery-ack'
   └─ Also extracts piggybacked ackMessageIds from regular messages
   └─ deliveryReceipts ON? → process; OFF? → silently drop

5. ReceiptService.onAckReceived() → onAckProcessed callback

6. React Query cache updated (deliveredAt on matching messageIds)
   └─ MessageDB.tsx: setQueriesData across all ['Messages'] queries

7. IndexedDB persisted (survives app restart)
   └─ messages.ts: updateMessageDeliveredAt() per messageId

8. UI re-renders: ✓ appears
   └─ Message.tsx: receiptIndicator checks deliveredAt
```

### End-to-End Flow — Read Receipts (✓✓)

```
RECIPIENT SIDE (sending read acks):

1. Message renders in viewport
   └─ Message.tsx: useReadReceipt hook attached (if enabled + incoming + new)

2. IntersectionObserver detects 50%+ visibility
   └─ useReadReceipt.ts: starts 1-second dwell timer (if tab focused)

3. Dwell timer fires (message still visible, tab still focused)
   └─ useReadReceipt.ts: calls reportRead(messageId, createdDate)
   └─ DirectMessage.tsx: reportRead callback → receiptService.onMessageRead()

4. Service buffers high-water mark (keeps only highest timestamp per address)
   └─ ReceiptService.ts: resetReadTimer() → 5-second debounce

5. Ack leaves the device (one of two paths):
   a. PIGGYBACK: Recipient sends a DM → readAckUpTo attached to envelope
      └─ MessageService.ts: flushReadForPiggyback() before encryption
   b. STANDALONE: 5s debounce fires → Action Queue → encrypt → send
      └─ ActionQueueHandlers.ts: sendReadAck handler

SENDER SIDE (receiving read acks):

6. MessageService decrypts incoming message
   └─ processDeliveryReceiptData(): intercepts type === 'read-ack'
   └─ Also extracts piggybacked readAckUpTo from regular messages
   └─ readReceipts ON? → process; OFF? → silently drop

7. ReceiptService.onReadAckReceived() → onReadAckProcessed callback

8. React Query cache updated (readAt + deliveredAt on own messages up to timestamp)
   └─ MessageDB.tsx: scoped to specific conversation key

9. IndexedDB persisted (survives app restart)
   └─ messages.ts: updateMessagesReadAt() via by_conversation_time index

10. UI re-renders: ✓ upgrades to ✓✓
    └─ Message.tsx: receiptIndicator logic checks readAt
```

### Key Components

| File | Responsibility |
|---|---|
| `src/types/deliveryReceipt.ts` | `DeliveryAckMessage`, `ReadAckMessage` control types, `MessageWithDelivery` intersection type |
| `src/services/ReceiptService.ts` | Delivery ack buffer (Set per address, 10s timer) + read high-water mark (per address, 5s debounce) + piggyback coordination |
| `src/services/MessageService.ts` | `processDeliveryReceiptData()` — intercepts both delivery-ack and read-ack at both DM decrypt paths, piggybacks on outgoing DMs |
| `src/services/ActionQueueHandlers.ts` | `send-delivery-ack` and `send-read-ack` handlers for standalone acks via Double Ratchet |
| `src/components/context/MessageDB.tsx` | Wires all callbacks (`onFlush`, `onAckProcessed`, `onReadFlush`, `onReadAckProcessed`), updates React Query cache + IndexedDB |
| `src/hooks/business/messages/useReadReceipt.ts` | Per-message IntersectionObserver with 1s dwell timer and tab focus check (read receipts only) |
| `src/components/message/Message.tsx` | ✓ vs ✓✓ display logic, useReadReceipt hook wiring, ref attachment |
| `src/components/direct/DirectMessage.tsx` | Config loading, `reportRead` callback, baseline snapshot |
| `src/components/message/MessageList.tsx` | Threads `showDeliveryReceipts`, `showReadReceipts`, `reportRead`, `readReceiptBaseline` to Message |
| `src/db/messages.ts` | `updateMessageDeliveredAt()`, `updateMessagesReadAt()`, `deliveryReceipts`/`readReceipts` in UserConfig |
| `src/types/actionQueue.ts` | `send-delivery-ack` and `send-read-ack` action types |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Delivery + Read receipts toggle UI |
| `src/types/deliveryReceipt.ts` | `ReadAckMessage` control type, `readAt`/`readAckUpTo` extensions |
| `src/types/actionQueue.ts` | `send-read-ack` action type |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Read receipts toggle UI |
| `src/hooks/business/user/useUserSettings.ts` | `readReceipts` state and config persistence |

### Types

```typescript
// src/types/deliveryReceipt.ts

// Control message — intercepted before saveMessage, never stored or displayed
type ReadAckMessage = {
  senderId: string;
  type: 'read-ack';
  upToMessageId: string;    // high-water mark
  upToTimestamp: number;     // createdDate of that message
};

// Extended fields on Message (local intersection type, migrates to quorum-shared later)
type DeliveryReceiptMessageExtensions = {
  ackMessageIds?: string[];                                    // piggybacked delivery acks (stripped)
  deliveredAt?: number;                                        // persisted
  readAckUpTo?: { messageId: string; timestamp: number };      // piggybacked read acks (stripped)
  readAt?: number;                                             // persisted
};
```

## The useReadReceipt Hook

The hook follows the same IntersectionObserver pattern as `useViewportMentionHighlight.ts`. It attaches to each incoming message element and detects when the user has actually looked at it.

### Eligibility

A message gets an observer if ALL of these are true:
- `showReadReceipts` is `true` (user's setting is ON)
- Message is from the other person (not own messages)
- Message is newer than `readReceiptBaseline` (see Baseline section below)
- `reportRead` callback exists

### Observer Logic

1. `IntersectionObserver` with `threshold: 0.5` watches the message element
2. When 50%+ visible AND `document.visibilityState === 'visible'` → start 1-second timer
3. If message leaves viewport before 1s → cancel timer
4. If tab loses focus during timer → cancel timer
5. If tab regains focus while element is still visible → restart timer
6. After 1s with all conditions met → call `reportRead(messageId, createdDate)`, disconnect observer

### Ref Attachment

The hook returns a ref that merges with the existing mention highlight ref via a callback ref on the outermost message `<Flex>` element.

## The Baseline Snapshot Problem

`lastReadTimestamp` (from the `Conversation` model) updates every 2 seconds while the conversation is open — it tracks "what messages has the user seen" for the unread badge and "New Messages" separator. If used directly for read receipt filtering, ALL messages would appear "already read" within 2 seconds of opening the conversation, and no observers would mount.

The solution is a **baseline snapshot**: `readReceiptBaselineRef` captures `lastReadTimestamp` once when the conversation first loads and never updates. Only messages with `createdDate > baseline` get observers. Messages that were already read before the session are skipped; new messages arriving during the session are observed.

```typescript
// src/components/direct/DirectMessage.tsx
const readReceiptBaselineRef = useRef<number>(0);
if (readReceiptBaselineRef.current === 0 && lastReadTimestamp > 0) {
  readReceiptBaselineRef.current = lastReadTimestamp;
}
```

## High-Water Mark Buffering

The `ReceiptService` tracks one high-water mark per address (conversation partner). Each `onMessageRead()` call either replaces (higher timestamp) or is ignored (lower/equal). This is fundamentally different from delivery acks, which buffer a `Set<string>` of individual message IDs.

**Debounce**: 5 seconds (vs 10s for delivery acks). Shorter because the user is actively reading — more reads are likely incoming, so flush sooner.

**Flush paths**:
- **Piggyback**: When the user sends a DM, `flushReadForPiggyback()` drains the mark and attaches it as `readAckUpTo` on the message envelope. Stripped before persistence.
- **Standalone**: If no outgoing message within 5s, the debounce timer fires, queuing a `send-read-ack` action via Action Queue. Dedup key: `read-ack:${address}`.
- **Background**: `flushAll()` (on tab hide / beforeunload) includes read marks.
- **Toggle OFF**: `clearReadBuffer()` discards all pending marks without flushing.

## Sender-Side Processing

When the sender receives a read ack (standalone or piggybacked), `processDeliveryReceiptData()` intercepts it at the decrypt layer — the same method that handles delivery acks, at both DM decrypt paths.

**Key difference from delivery acks**: Read ack processing is gated on the sender's `readReceipts` setting — if OFF, incoming read acks are silently dropped (not persisted). This ensures users who opt out never accumulate `readAt` data. However, `readAt` values that were persisted while the setting was ON are **never retroactively removed** — toggling OFF only affects future acks, not historical ones.

**Cache update**: The `onReadAckProcessed` callback in MessageDB.tsx updates the React Query cache scoped to the specific conversation (using `buildMessagesKeyPrefix`), not all conversations. It sets `readAt` and backfills `deliveredAt` (reading implies delivery) on all own messages where `createdDate <= upToTimestamp`.

**IndexedDB persistence**: `updateMessagesReadAt(spaceId, channelId, ownAddress, upToTimestamp, readAt)` uses the `by_conversation_time` compound index `[spaceId, channelId, createdDate]` to walk own messages up to the timestamp.

## UI Rendering

The receipt indicator in `Message.tsx` follows this priority:

| Condition | Display |
|---|---|
| `readAt` set | ✓✓ (two `<Icon name="check">` with `-6px` margin overlap) |
| `deliveredAt` set | ✓ (single `<Icon name="check">`) |
| Otherwise | Nothing |

**Settings gate persistence, not display.** Once `deliveredAt` or `readAt` is persisted to IndexedDB, the checkmark is always visible — even if the user later turns the setting OFF. This means past receipts (received while the setting was ON) remain visible. Turning the setting OFF only stops new acks from being processed and persisted.

Both ✓ and ✓✓ use the same `.delivered` CSS class with `color: var(--color-text-muted)` and 12px icons. The `.read` modifier adds the negative margin to overlap the two check icons.

`readAt`, `deliveredAt`, `showDeliveryReceipts`, and `showReadReceipts` are all included in the `React.memo` comparison to trigger re-renders when they change.

## Privacy Model

Two toggles in Settings > Privacy, with read receipts nested under delivery receipts:

| Toggle | Default | Controls |
|---|---|---|
| Delivery receipts | OFF | Sending delivery acks + persisting incoming `deliveredAt` |
| └ Read receipts | OFF | Sending read acks + persisting incoming `readAt` (requires delivery receipts ON) |

Both toggles are also available as per-conversation overrides in Conversation Settings.

**Hard boundary**: OFF = no data leaves the device, and no incoming ack data is persisted. The `useReadReceipt` hook doesn't mount observers, `reportRead` is a no-op, no acks are buffered or sent. Incoming acks from the other party are silently dropped at the `processDeliveryReceiptData` layer.

**Settings gate persistence, not display**: Once `deliveredAt`/`readAt` is written (while the setting was ON), the checkmark is permanently visible even if the setting is later turned OFF. This provides a natural UX: the setting controls *future* behavior, not retroactive erasure of already-received data.

**Reciprocal sending**: The other person must also have their setting ON for acks to be sent (sending gating). Neither party learns the other's preference — reciprocity emerges from independent local enforcement.

**Hierarchical dependency**: Read receipts requires delivery receipts to be enabled. The UI enforces this: the read toggle is disabled and dimmed when delivery is OFF. Turning delivery OFF auto-cascades read to OFF. The service layer also enforces this: `DirectMessage.tsx` forces `effectiveReadReceipts = false` when delivery is OFF, regardless of stored config. The *protocol* still tolerates `readReceipts ON + deliveryReceipts OFF` (a read ack backfills `deliveredAt`), but this combination cannot be reached through the UI.

**Known privacy limitation**: The privacy model is a social contract between cooperating clients, not a cryptographic enforcement. A user with a modified client could set their own receipts OFF (preventing ack sending) while still processing incoming acks from the other party. This is an inherent limitation of client-side settings in E2E encrypted messaging — the same trade-off exists in Signal, WhatsApp, etc. The impact is low: the "attacker" only gains delivery/read timing for messages they themselves sent, and the other party already opted in to sharing that data.

## Technical Decisions

- **High-water mark vs individual IDs**: DM reading is linear. One "read up to X" ack covers all messages before it. Much lighter than acking each message individually (what delivery acks do).

- **5s debounce (shorter than delivery's 10s)**: The user is actively reading. More messages will likely become visible soon. Flushing sooner means the sender sees ✓✓ faster.

- **Baseline snapshot instead of live lastReadTimestamp**: The live timestamp updates every 2s while the conversation is open, making all messages appear "already read". A one-time snapshot captures what was read before the session.

- **Gate persistence, not display**: Both delivery and read acks are only persisted when the user's respective setting is ON. Once persisted, checkmarks are always visible (even after toggling OFF). This preserves the user's past receipts while preventing new ones from accumulating when the setting is OFF.

- **Two check icons instead of IconChecks**: The `IconChecks` Tabler icon exists in quorum-shared's icon map but renders too small at `xs` size. Two adjacent `<Icon name="check">` with `-6px` margin overlap gives better visual clarity.

- **No-ack rule**: `read-ack` control messages (like `delivery-ack`) are intercepted before `saveMessage` and never trigger delivery or read ack buffering. The `type === 'post'` guard in the defense-in-depth check prevents infinite ack loops.

## Known Limitations

- **No retroactive read acking**: When read receipts are toggled ON, only messages received after the toggle are acked. Messages received before are not retroactively acked.
- **Crash before flush**: If the app crashes before the 5s debounce fires, pending read marks are lost. The next time the user opens the conversation, new marks are established.
- **Observer overhead**: Every incoming message from the other person that's newer than the baseline gets an IntersectionObserver. For very long active conversations, this could mean many observers. The browser optimizes them internally (shared scroll listener), but it's worth noting.
- **Sync issues**: Intermittent DM delivery failures (Double Ratchet state desync) can prevent read acks from arriving. This is a pre-existing infrastructure issue, not specific to read receipts.

## Related Documentation

- [Message Sending Indicator](.agents/docs/features/messages/message-sending-indicator.md) — Message status lifecycle (Sending → Sent → ✓ → ✓✓ → Failed)
- [Delivery Receipts Design Spec](.agents/tasks/2026-03-18-dm-delivery-receipts-design.md) — Phase 1 design
- [Delivery Receipts Implementation Plan](.agents/tasks/2026-03-18-dm-delivery-receipts-plan.md) — Phase 1 task breakdown
- [Read Receipts Design Spec](.agents/tasks/2026-03-22-dm-read-receipts-design.md) — Phase 2 design
- [Read Receipts Implementation Plan](.agents/tasks/2026-03-22-dm-read-receipts-plan.md) — Phase 2 task breakdown
- [Read Receipts Testing Bug](.agents/bugs/2026-03-22-read-receipts-testing-blocked.md) — Testing progress and bugs found
- [Receipt Persistence Bug](.agents/bugs/.solved/2026-03-22-receipt-checkmarks-not-persisting-across-navigation.md) — Fixed: checkmarks disappearing on refresh
- [Action Queue](.agents/docs/features/action-queue.md) — Persistent queue used for standalone acks

---

*Updated: 2026-03-24 — Renamed DeliveryReceiptService → ReceiptService*
