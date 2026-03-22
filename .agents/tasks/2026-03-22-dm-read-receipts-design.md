# DM Read Receipts Design — Phase 2

**Goal:** Add read receipts to DMs — a double checkmark (✓✓) confirming the recipient has visually seen the message. Builds on top of the Phase 1 delivery receipts system (single ✓ for delivery).

**Phase 1 Spec:** `.agents/tasks/2026-03-18-dm-delivery-receipts-design.md`

**Tech Stack:** React, TypeScript, Double Ratchet encryption (via `@quilibrium/quorum-shared`), IntersectionObserver, Action Queue (IndexedDB persistence), WebSocket transport, Vitest.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Privacy model | Two separate toggles (`deliveryReceipts` + `readReceipts`) | Users may want delivery confirmation without revealing read status. Matches WhatsApp/Signal. |
| "Read" definition | Message 50%+ visible in viewport for 1 second, tab focused | Industry standard. Existing IntersectionObserver pattern in codebase (`useViewportMentionHighlight`). |
| Visual indicator | ✓ → ✓✓, same muted color (`--color-text-muted`, 12px) | Unobtrusive. Icon-only distinction, no color change. *Departs from Phase 1's placeholder note of "distinct color" — deliberate simplification.* |
| Ack buffering | Extend existing `DeliveryReceiptService` | Same buffer/flush/piggyback logic. No new service needed. |
| Ack granularity | High-water mark ("read up to message X") | DM reading is linear. One ack covers all messages up to a point. Much lighter than individual IDs. |
| Toggle independence | `readReceipts` ON + `deliveryReceipts` OFF is valid | Read acks are sent independently. Receiving a read ack sets both `deliveredAt` and `readAt` (reading implies delivery). The toggles are fully independent. |
| Ack persistence vs display | Read acks are always persisted; display is gated on setting | `readAt` is written to IndexedDB regardless of sender's `readReceipts` setting. UI rendering is gated. Toggling ON later reveals historical read status. |

---

## New Types & Data Model

**Note:** New types live locally in `src/types/` first, then migrate to `quorum-shared` once stable — same approach as Phase 1.

### ReadAckMessage (control type)

```typescript
type ReadAckMessage = {
  senderId: string;
  type: 'read-ack';
  upToMessageId: string;    // high-water mark
  upToTimestamp: number;     // timestamp of that message (for range marking)
};
```

Like `DeliveryAckMessage`, this is a control message — intercepted at the decrypt layer before `saveMessage`. Never stored or displayed. **No-ack rule:** `read-ack` messages must never trigger delivery acks or read acks (same as `delivery-ack`). The intercept-before-save pattern prevents this — control messages are returned early before any ack buffering occurs. Extend the existing defense-in-depth check in `processDeliveryReceiptData` to also exclude `read-ack`.

### Extended Message Fields

Add to `DeliveryReceiptMessageExtensions` in `src/types/deliveryReceipt.ts`:

```typescript
export type DeliveryReceiptMessageExtensions = {
  ackMessageIds?: string[];
  deliveredAt?: number;
  readAckUpTo?: { messageId: string; timestamp: number };  // envelope-level piggyback (stripped before persistence)
  readAt?: number;  // persisted to IndexedDB
};
```

### UserConfig

```typescript
readReceipts?: boolean;  // default: false, separate from deliveryReceipts
```

### ActionType

```typescript
| 'send-read-ack'  // added to ActionType union
```

---

## UI State Progression

On own sent messages:

| State | Indicator |
|---|---|
| No `deliveredAt`, no `readAt` | Nothing |
| `deliveredAt` set, no `readAt` | ✓ (single check, `--color-text-muted`, 12px) |
| `readAt` set | ✓✓ (double check, `--color-text-muted`, 12px) |

- `readAt` takes precedence — if both set, show ✓✓ only
- Icon: `check-check` (verify availability at implementation time; fallback: two adjacent `check` icons)
- `readAt` display is gated on sender's `readReceipts` setting. If turned off, existing `readAt` values remain persisted but ✓✓ downgrades to ✓ (delivery only).
- When `readReceipts` is ON, the ✓✓ indicator is shown regardless of the `deliveryReceipts` setting — read status subsumes delivery. The display logic is: if `readReceipts` ON and `readAt` set → ✓✓; else if `deliveredAt` set and (`deliveryReceipts` ON or `readReceipts` ON) → ✓; else → nothing.

---

## Visibility Tracking — `useReadReceipt` Hook

Per-message IntersectionObserver hook, following the existing `useViewportMentionHighlight` pattern.

### Logic

1. Hook receives `messageRef`, `messageId`, `messageTimestamp`, and a `reportRead` callback
2. Creates an IntersectionObserver with `threshold: 0.5` (50% visible)
3. When the message enters the viewport at 50%+, starts a 1-second timer
4. If still visible after 1s AND `document.visibilityState === 'visible'` (tab is focused), calls `reportRead(messageId, messageTimestamp)`
5. Disconnects the observer — this message is done
6. If the message leaves the viewport before 1s, cancels the timer
7. If the tab loses focus during the timer, cancels the timer (restarts when tab regains focus)

### Who Gets Observed

- Only messages from the other person (not your own)
- Only messages newer than the conversation's `lastReadTimestamp` (the existing unread tracking timestamp from the `Conversation` model in IndexedDB, already used for the "New Messages" separator and unread counts — persisted across sessions)
- Once a message triggers `reportRead`, its observer disconnects permanently
- When Virtuoso unmounts the element, `useEffect` cleanup handles teardown

### Guard

The hook checks `readReceipts` setting before mounting observers. If off, no observers are created — no data leaves the device.

---

## DeliveryReceiptService Extension

The existing service is extended to handle read acks alongside delivery acks. No new service.

### New State

```typescript
private readHighWaterMarks = new Map<string, { messageId: string; timestamp: number }>();
private readTimers = new Map<string, ReturnType<typeof setTimeout>>();
```

### New Methods

- **`onMessageRead(address, messageId, timestamp)`** — Called by `useReadReceipt` hook's `reportRead` callback. Updates the high-water mark if the new timestamp is higher than the current one. Resets a 5-second debounce timer (shorter than delivery's 10s because the user is actively reading — more reads likely incoming, so flush sooner).
- **`flushReadForPiggyback(address)`** — Drains the current read high-water mark for piggybacking on outgoing DMs. Returns `{ messageId, timestamp } | null`.
- **`flushAll()`** — Extended to also flush read high-water marks (app backgrounding).

### Flush Callback

When the debounce fires or `flushAll` is called, queues a `send-read-ack` action via Action Queue. Dedup key: `read-ack:${address}` (one pending read ack per conversation).

### Key Difference from Delivery Acks

Delivery acks buffer individual message IDs (a `Set`). Read acks track one high-water mark per address — each `onMessageRead` call either replaces (higher timestamp) or is ignored (lower). Much lighter.

---

## Integration — Recipient Side (Sending Read Acks)

### Wiring the Hook to the Service

In `DirectMessage.tsx`, create a `reportRead` callback:
1. Check `userConfig.readReceipts` — if off, no-op
2. Call `deliveryReceiptService.onMessageRead(address, messageId, timestamp)`

This callback is passed down: `DirectMessage.tsx` → `MessageList.tsx` → `Message.tsx` → `useReadReceipt` hook.

### Piggybacking on Outgoing DMs

Same integration point as delivery acks in `MessageService.ts` — before sending any DM, call `flushReadForPiggyback(address)` and attach the result as `readAckUpTo` on the message envelope. Stripped before persistence, same as `ackMessageIds`.

### Standalone Read Ack via Action Queue

New `send-read-ack` handler, nearly identical to `send-delivery-ack`:
- Encrypts a `ReadAckMessage` via Double Ratchet
- Best-effort, no `onFailure` callback
- Dedup key: `read-ack:${address}`
- Classifies 400/403 as permanent errors

---

## Integration — Sender Side (Processing Read Acks)

### Intercepting Read Acks in MessageService

Same two decrypt paths as delivery acks. When `decryptedContent.content?.type === 'read-ack'`:
1. Intercept before `saveMessage` — don't save, don't display
2. Extract `upToMessageId` and `upToTimestamp`
3. Call `onReadAckReceived` handler

When piggybacked: extract `readAckUpTo` from envelope, process, then strip.

### `onReadAckReceived` Handler (Wired in MessageDB.tsx)

Uses `upToTimestamp` to mark all own sent messages in that conversation up to that timestamp:

1. **React Query cache** — iterate messages in the conversation's query data, set `readAt = now` on all messages where `content.senderId === ownAddress` (the local user's address) AND `timestamp <= upToTimestamp` AND `readAt` is not already set
2. **IndexedDB** — new `updateMessagesReadAt(conversationId, ownAddress, upToTimestamp, readAt)` method. `ownAddress` is the **local user's address** (the original message author, NOT the address of the person who sent the read-ack). Opens a cursor on the conversation+time index, filters to messages where `content.senderId === ownAddress`, walks up to the timestamp, sets `readAt` on each

**Important:** If a read ack arrives before a delivery ack (unlikely but possible), set both `deliveredAt` and `readAt` — reading implies delivery. UI shows ✓✓ directly.

---

## Privacy Settings — Second Toggle

In `Privacy.tsx`, below the existing "Delivery receipts" toggle:

- **Label:** "Read receipts"
- **Tooltip:** "When on, senders see when you've read their messages, and you see when yours are read."
- Same `Switch` + `Tooltip` + `Icon` pattern
- Wired to `userConfig.readReceipts`

### Privacy Enforcement (Hard Boundary)

- OFF = no read acks leave the device, no ✓✓ displayed
- `useReadReceipt` hook checks the setting before observing — if off, no observers mounted
- Reciprocal: you only see ✓✓ on your own messages if *you* have the setting on (your setting gates display, their setting gates sending)

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| User scrolls past 50 messages quickly | Each triggers `onMessageRead`, but only the highest timestamp is kept. One read ack sent. |
| Tab loses focus while reading | Timer cancels. Resumes when tab regains focus. |
| Recipient reads but never replies | Read ack sent standalone after 5s debounce. |
| Recipient has read receipts OFF, delivery ON | Only delivery acks sent. Sender sees ✓ but never ✓✓. |
| Sender turns off read receipts after receiving some | Existing `readAt` values stay persisted but ✓✓ downgrades to ✓ in UI. |
| Read ack arrives before delivery ack | Set both `deliveredAt` and `readAt` — reading implies delivery. Show ✓✓ directly. |
| App crashes before read ack flush | Lost for those messages. Not critical — next time user opens the conversation and scrolls, new high-water mark is established. |
| Virtuoso unmounts message element during 1s timer | `useEffect` cleanup cancels observer + timer. Message re-observed when scrolled back into view. Duplicate `reportRead` calls are harmless — the high-water mark in `DeliveryReceiptService` makes them no-ops if the timestamp is <= current mark. |
| Offline recipient comes back, scrolls through messages | Read acks buffer normally, flush via piggyback or standalone. |
| User toggles `readReceipts` OFF with pending read buffer | Read high-water mark buffer is discarded, timers cancelled. No read acks sent. Mirrors Phase 1 behavior for delivery acks. |

---

## Files Affected

| File | Action | Changes |
|---|---|---|
| `src/types/deliveryReceipt.ts` | Modify | Add `ReadAckMessage` type, `readAt` + `readAckUpTo` to extensions. *Migrate to quorum-shared once stable.* |
| `src/types/actionQueue.ts` | Modify | Add `'send-read-ack'` to `ActionType` union |
| `src/db/messages.ts` | Modify | Add `readReceipts` to `UserConfig`, add `updateMessagesReadAt()` method |
| `src/services/DeliveryReceiptService.ts` | Modify | Add read high-water mark tracking, `onMessageRead()`, `flushReadForPiggyback()`, read debounce timers |
| `src/services/ActionQueueHandlers.ts` | Modify | Add `send-read-ack` handler |
| `src/services/MessageService.ts` | Modify | Intercept `read-ack` control messages, extract piggybacked `readAckUpTo`, piggyback read acks on outgoing DMs |
| `src/hooks/business/messages/useReadReceipt.ts` | Create | IntersectionObserver hook with 1s dwell time + visibility check |
| `src/components/context/MessageDB.tsx` | Modify | Wire `onReadAckReceived` callback, extend service initialization |
| `src/components/message/Message.tsx` | Modify | ✓ → ✓✓ logic, `readAt` in memo, `showReadReceipts` prop |
| `src/components/message/MessageList.tsx` | Modify | Thread `showReadReceipts` + `reportRead` props |
| `src/components/direct/DirectMessage.tsx` | Modify | Load `readReceipts` config, create `reportRead` callback, pass props |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Modify | Add read receipts toggle |
| `src/dev/tests/services/DeliveryReceiptService.unit.test.ts` | Modify | Tests for read ack buffering, high-water mark, debounce |

---

## Security Considerations

- Read acks are end-to-end encrypted via Double Ratchet — same as delivery acks
- No new metadata leakage: read-ack messages look like regular DMs to the network
- Privacy setting is a hard boundary: OFF = no data leaves device
- Read timing can reveal online status — mitigated by 5s debounce window and batching (same concern as delivery acks and regular messages)
- Standalone read-ack messages advance the Double Ratchet state (same as delivery acks)

---

*Created: 2026-03-22*
