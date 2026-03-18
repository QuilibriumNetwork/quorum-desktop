# DM Delivery Receipts — Design Spec

## Overview

Add delivery receipts to Direct Messages: a single checkmark (✓) confirming the recipient's device received and decrypted the message. This is Phase 1 of a two-phase plan — Phase 2 (read receipts, ✓✓) is designed for but not implemented here.

## Goals

- Let senders know their DM was delivered to the recipient's device
- Maintain Quorum's privacy-first identity: OFF by default, opt-in, hard privacy boundary
- Zero extra messages in active conversations (piggyback acks on replies)
- Leverage existing infrastructure (Double Ratchet, Action Queue, WebSocket)
- No node/server changes required

## Non-Goals

- Read receipts (Phase 2)
- Channel/space message receipts (DM only)
- Delivery receipts for group DMs (not currently supported)
- Node-level delivery confirmation

---

## Privacy Model

### Hard Privacy Boundary

This is NOT cosmetic. When the setting is OFF, **no ack data leaves the device**. Period.

### User Setting

- **Name**: "Delivery receipts"
- **Location**: User settings modal → Privacy section
- **Default**: OFF
- **Tooltip**: "When on, senders see when their messages reach your device, and you see when yours reach theirs."

### Reciprocal Enforcement

Both parties must have the setting ON for the feature to work:

| My setting | Their setting | I see ✓ on my msgs? | They see ✓ on their msgs? |
|---|---|---|---|
| ON | ON | Yes | Yes |
| ON | OFF | No (they don't send acks) | No (their setting is off) |
| OFF | ON | No (I hide them + don't send) | No (I don't send acks) |
| OFF | OFF | No | No |

**Setting OFF means:**
1. Your client does NOT send acks when you receive messages
2. Your client does NOT display ✓ on your sent messages
3. Your client ignores any incoming acks

**How reciprocity works**: Each client independently enforces its own setting. There is no setting exchange between users — neither party learns the other's preference. If the recipient's setting is OFF, no ack is sent, so the sender never receives one regardless of their own setting. If the sender's setting is OFF, any arriving acks are ignored. The reciprocal behavior emerges from independent local enforcement, not from a negotiation protocol.

---

## Message States

A sent DM message progresses through these states:

| State | Indicator | When |
|---|---|---|
| In flight | "Sending..." + clock icon | Message queued, not yet accepted by network |
| Sent to network | No indicator | Network accepted; no ack yet or recipient has setting off |
| Delivered | ✓ (single checkmark) | Ack received from recipient's device |
| Failed | "Failed to send" + Retry link | Network error |

**Future Phase 2 additions:**

| State | Indicator | When |
|---|---|---|
| Read | ✓✓ (double checkmark, distinct color) | Recipient viewed the message in chat |

---

## Data Model

### New Control Message Type

```typescript
// Lives in src/types/ initially, migrates to quorum-shared once stable.
// This is a CONTROL message — it is NOT added to the MessageContent union.
// It is intercepted at the decrypt layer before entering the saveMessage/addMessage pipeline.
export type DeliveryAckMessage = {
  senderId: string;
  type: 'delivery-ack';
  messageIds: string[];  // batch of acknowledged message IDs
};
```

**Important**: `DeliveryAckMessage` is deliberately kept outside the `MessageContent` union (which lives in quorum-shared). It is a control message — never saved, never displayed, never touches the message rendering pipeline. The decrypt layer in `handleNewMessage()` intercepts it before `saveMessage()` is called.

### Piggybacked Acks

Regular DM messages can carry ack data as an **envelope-level** (Message-level) optional field:

```typescript
// On the Message type (envelope level), NOT on individual MessageContent variants.
// Lives in src/types/ locally, extending the quorum-shared Message type.
ackMessageIds?: string[];
```

The recipient-side processing code extracts `ackMessageIds` from the decrypted message, processes the acks, then strips the field before passing to the standard `saveMessage`/`addMessage` pipeline. This keeps ack data out of persistence and rendering.

This avoids sending standalone ack messages when the recipient is already replying.

### Message Extension

```typescript
// Added to Message type (envelope level) — persisted to IndexedDB
deliveredAt?: number;  // timestamp when SENDER processed the ack (not actual delivery time)
```

Unlike `sendStatus` (ephemeral, memory-only), `deliveredAt` is persisted to IndexedDB so ✓ survives app restarts. Note: this records when the sender's client processed the incoming ack, not the exact moment the recipient's device decrypted the message. For Phase 1 this distinction is irrelevant (the checkmark is binary), but it should be kept in mind for Phase 2.

No new IndexedDB index is needed on `deliveredAt` — it is only read alongside the message, never queried independently.

### User Setting

```typescript
// In UserConfig or privacy settings
deliveryReceipts: boolean;  // default: false
```

---

## Recipient Flow (Sending Acks)

### Ack Buffer

When the recipient's app decrypts incoming DMs:

```
handleNewMessage() decrypts a DM
    ↓
Check: is my deliveryReceipts setting ON?
    → No  → full stop. No buffer, no ack, no data sent.
    → Yes → add messageId to ack buffer
```

### Buffer Design

- Data structure: `Map<address, string[]>` — keyed by conversation partner address, value is array of pending messageIds
- Lives in the delivery receipt service (or MessageService if the code is small enough)
- Deduplicates messageIds before sending

### Flush Strategy (Priority Order)

1. **Piggyback on next outgoing message** — when sending any DM (post, reaction, edit, etc.) to the same address, attach `ackMessageIds` from the buffer. Zero extra messages.
2. **Standalone ack after ~10 second timeout** — per-address timer. If no outgoing message was sent within 10s, flush as a dedicated `delivery-ack` message. Covers the case where recipient reads but doesn't reply.
3. **App backgrounding** — `visibilitychange` event (and `beforeunload` for Electron) flushes all buffers via Action Queue (not direct WebSocket send), ensuring persistence even if the app closes immediately after.

### Sending

On flush, the ack (standalone or piggybacked) is queued via Action Queue as a DM task. This provides:
- Offline resilience (persisted to IndexedDB)
- Automatic retry with exponential backoff
- Crash recovery

### No Ack for Acks

`delivery-ack` messages are NEVER acknowledged. This prevents infinite ack loops.

---

## Sender Flow (Receiving Acks)

```
Incoming DM message arrives
    ↓
Decrypt and process normally (post, reaction, etc.)
    ↓
Does it have ackMessageIds field? OR is it type 'delivery-ack'?
    → No  → done
    → Yes → process ack messageIds
    ↓
Check: is MY deliveryReceipts setting ON?
    → No  → ignore acks completely. No state written, no ✓ displayed.
    → Yes → for each messageId:
        → Find message in React Query cache and IndexedDB
        → Skip if already has deliveredAt (idempotent)
        → Set deliveredAt = Date.now()
        → Persist to IndexedDB
        → UI re-renders with ✓
```

**Key behaviors:**
- `delivery-ack` type messages are never shown in the chat — intercepted and consumed silently
- Piggybacked `ackMessageIds` on regular messages are processed alongside the visible content
- Unknown messageIds are silently skipped (message may have been deleted)
- First ack wins — subsequent acks for same messageId are no-ops

---

## UI Design

### Checkmark Indicator

- Placement: next to the message timestamp, similar to existing "Sending..." indicator
- Style: single ✓ in muted/subtle color (e.g., `text-subtle`, matching timestamp color)
- Only visible on YOUR sent messages, never on received messages
- Small and unobtrusive — not the focus of attention

### Future Phase 2 Extension

- ✓ grey/muted = delivered (Phase 1)
- ✓✓ in a distinct color = read (Phase 2)

---

## Multi-Device Behavior

- Each of the recipient's devices sends acks independently
- Sender sees ✓ as soon as ANY device acks (first ack wins)
- Each device maintains its own ack buffer
- Multiple devices may send redundant acks for the same messageId — this is an accepted trade-off. Coordinating ack suppression across devices would require cross-device sync, adding complexity that contradicts the simplicity goal. Redundant acks are small and idempotent.

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| App crashes before buffer flush | Acks lost for those messages. Not critical — messages were delivered, just confirmation is lost. Next sync acks normally. |
| Recipient changes setting OFF after receiving messages but before ack flush | Buffer is discarded. No acks sent. |
| Recipient turns setting ON | Only future messages (received after enabling) are acked. Messages received before enabling are NOT retroactively acked. |
| Piggybacked acks on a message that fails and retries | Ack IDs are attached at send-time (when the buffer is flushed), not at queue-time. If the message retries via Action Queue, the piggybacked acks ride along with the retry. |
| Sender deletes message before ack arrives | Ack references unknown messageId — silently skipped. |
| 50 messages arrive while offline | All batched into one ack (piggybacked on reply, or single standalone after 10s). |
| Both users sending rapidly | Most acks piggyback on replies. Minimal standalone acks. |

---

## Action Queue Integration

### New Action Type

`send-delivery-ack` — for standalone ack messages only. Piggybacked acks ride along with existing DM action types.

### Context

```typescript
{
  address: string;              // Conversation partner
  messageIds: string[];         // Acked message IDs
  selfUserAddress: string;      // Sender's user address
}
```

### Error Handling

- Permanent errors (400, 403): mark failed, don't retry (ack is best-effort)
- Transient errors (network, 5xx): retry with exponential backoff
- Max retries: same as other DM actions (3)

### Dedup Key

`delivery-ack:${address}` — one pending ack task per conversation partner at a time. If new messages arrive and get buffered while a previous ack task is still pending, the buffer is fully drained into the new task. The handler merges/replaces rather than creating parallel tasks for the same address.

---

## Service Architecture

The ack buffer, flush logic, and piggyback coordination may live in a dedicated `DeliveryReceiptService` or as a contained section within `MessageService`, depending on final code size. Decision deferred to implementation.

**Integration points with MessageService:**
1. `onMessageReceived(address, messageId)` — called on DM decrypt
2. `flushForPiggyback(address)` — called before sending any DM, returns pending ackIds to attach
3. `onAckReceived(messageIds)` — called when ack data arrives (standalone or piggybacked)

---

## Security Considerations

- Acks are end-to-end encrypted via Double Ratchet — network node cannot read ack content
- No new metadata leakage: ack messages look like regular DMs to the network
- Privacy setting is a hard boundary, not cosmetic: OFF = no data leaves device
- Ack timing can theoretically reveal online status — mitigated by the 10s buffer window and batching (same concern exists for regular messages)
- Standalone ack messages advance the Double Ratchet state (they are encrypted DMs). In one-sided conversations where the recipient reads but never replies, the ratchet advances only via acks. This is cryptographically fine but worth noting.
- Error messages in ack failures are sanitized (same as existing DM error sanitization)

---

## Files Likely Affected

| File | Changes |
|---|---|
| `src/types/message.d.ts` (or new file) | `DeliveryAckMessage` type, `ackMessageIds` field, `deliveredAt` field |
| `src/services/MessageService.ts` | Hook into decrypt flow, piggyback coordination, ack processing |
| `src/services/DeliveryReceiptService.ts` (maybe) | Ack buffer, timers, flush logic |
| `src/services/ActionQueueHandlers.ts` | New `send-delivery-ack` handler |
| `src/types/actionQueue.ts` | New action type |
| `src/components/message/Message.tsx` | Render ✓ indicator |
| `src/components/message/Message.scss` | Checkmark styling |
| User settings component | New toggle + tooltip |
| `src/db/messages.ts` | Persist/read `deliveredAt` field |

---

## Phases

### Phase 1 (This Spec)
- Delivery receipts: ✓ = message delivered to recipient's device
- Privacy setting with hard enforcement
- Batched acks with piggyback optimization
- Action Queue integration for offline resilience

### Phase 2 (Future)
- Read receipts: ✓✓ = recipient viewed the message in chat
- Requires tracking scroll position / chat focus / visibility
- Privacy model TBD: may use the same toggle (delivery + read together) or a separate toggle for read receipts. This is a design decision for Phase 2 — users who want delivery receipts but not read receipts are a common use case that should be considered.
- `readAt` field added to Message type

---

*Created: 2026-03-18*
