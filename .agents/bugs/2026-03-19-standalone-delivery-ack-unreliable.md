---
type: bug
title: "Standalone delivery receipt acks not reliably delivered"
status: open
priority: medium
ai_generated: true
created: 2026-03-19
updated: 2026-03-19
---

# Standalone delivery receipt acks not reliably delivered

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

Delivery receipt checkmarks (✓) appear inconsistently on DM messages. **Piggybacked acks** (riding on the next outgoing DM to the same address) work reliably — the sender sees the ✓ immediately when the recipient replies. However, **standalone acks** (sent after the 10-second timer when the recipient doesn't reply) sometimes fail to reach the sender.

Observable behavior:
- In a rapid back-and-forth conversation, most messages get ✓ (piggybacked acks work)
- When one user sends a message and the other reads but doesn't reply, the ✓ may never appear
- The `onFlush` callback fires and enqueues the `send-delivery-ack` Action Queue task
- No corresponding `[DeliveryReceipt] Processing incoming ack` log appears on the sender's side
- The ack message appears to be lost between Action Queue processing and WebSocket delivery

## Root Cause

Not yet identified. Possible causes to investigate:

1. **Action Queue processing timing**: The `send-delivery-ack` task may not be processed before the page interaction ends, or may be stuck behind other tasks in the queue.

2. **Encryption state issues**: The `sendDeliveryAck` handler in `ActionQueueHandlers.ts` uses `encryptAndSendDm()` which requires valid Double Ratchet encryption states. If the encryption state is stale or being used by another concurrent operation, the encrypt may fail silently.

3. **WebSocket delivery**: The encrypted ack may be sent via WebSocket but not delivered to the recipient's inbox. The standalone ack is a minimal message (`{ senderId, type: 'delivery-ack', messageIds }`) — unlike regular DMs which have full Message structure with `channelId`, `spaceId`, etc. The network node might handle these differently.

4. **Dedup key collision**: The dedup key `delivery-ack:${address}` means only one pending ack task per conversation partner. If a new ack is enqueued while a previous one is still processing, the replacement logic may discard message IDs.

5. **Missing error logging**: The `send-delivery-ack` handler has no `onFailure` callback (by design — best effort). Failures are silently dropped, making debugging harder.

## Key Files

| File | Relevance |
|---|---|
| `src/services/DeliveryReceiptService.ts:65-75` | `flushAll()` / timer flush — triggers `onFlush` callback |
| `src/components/context/MessageDB.tsx:973-984` | `onFlush` callback — enqueues `send-delivery-ack` to Action Queue |
| `src/services/ActionQueueHandlers.ts:1046-1078` | `sendDeliveryAck` handler — encrypts and sends via `encryptAndSendDm` |
| `src/services/ActionQueueHandlers.ts:804-904` | `encryptAndSendDm` shared helper — Double Ratchet encrypt + WebSocket send |
| `src/services/MessageService.ts:207-240` | `processDeliveryReceiptData` — intercepts incoming acks on receiver side |

## Debug Steps

1. Add logging to the `sendDeliveryAck` handler execute method to confirm it runs
2. Add logging after `encryptAndSendDm` completes to confirm encryption succeeds
3. Check Action Queue stats (`window.__actionQueue.getStats()`) for failed `send-delivery-ack` tasks
4. Check if the encrypted ack actually appears in WebSocket traffic (Network tab)
5. On the sender side, check if the ack message arrives at `handleNewMessage` at all

## Solution

Not yet implemented. Pending investigation.

## Prevention

Once fixed:
- Consider adding temporary error logging to `onFailure` for `send-delivery-ack` during development
- Add integration test that verifies standalone ack delivery end-to-end
- Consider a retry mechanism specific to delivery acks (currently relies on Action Queue's generic retry)
