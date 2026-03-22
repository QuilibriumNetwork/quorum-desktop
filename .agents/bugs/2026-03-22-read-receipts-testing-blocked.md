---
type: bug
title: "Read receipts (Phase 2) untested — sync issues prevent DM delivery"
status: open
priority: medium
ai_generated: true
created: 2026-03-22
updated: 2026-03-22
---

# Read receipts (Phase 2) untested — sync issues prevent DM delivery

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

Read receipts (Phase 2 — double checkmark ✓✓) implementation is complete but cannot be fully end-to-end tested because DM messages are intermittently failing to deliver between users. The sync/message delivery infrastructure is unreliable during testing, making it impossible to verify the read receipt flow works correctly.

**What we confirmed works:**
- Settings toggle saves and loads correctly (both Delivery receipts and Read receipts)
- `useReadReceipt` hook mounts IntersectionObservers on unread incoming messages
- Observers fire when messages are 50%+ visible in viewport
- `reportRead` callback is called with correct messageId and `createdDate` timestamp
- `DeliveryReceiptService.onMessageRead()` buffers the high-water mark
- 25/25 unit tests pass for the service layer

**What we could NOT test due to sync issues:**
- Standalone read ack sent after 5s debounce → received by sender
- Piggybacked read ack on outgoing DM → received by sender
- `processDeliveryReceiptData` intercepting `read-ack` control message
- `onReadAckProcessed` updating React Query cache with `readAt`
- `updateMessagesReadAt` persisting to IndexedDB
- ✓ upgrading to ✓✓ in the sender's UI
- Privacy toggle enforcement (OFF = no acks sent, no ✓✓ displayed)

## Root Cause

The sync/delivery issue is a separate pre-existing infrastructure problem — not caused by the read receipts implementation. DMs intermittently fail to go through, with console errors like:

```
[MessageService] DM decrypt failed (DoubleRatchetInboxDecrypt) SyntaxError: Unexpected token 'D', "Decryption"... is not valid JSON
```

This suggests occasional Double Ratchet state desync between devices.

## Bugs Found and Fixed During Implementation

Three critical bugs were found via code review and fixed before testing:

1. **`message.timestamp` → `message.createdDate`** (2 locations)
   - `src/components/message/Message.tsx:177,180` — hook received `undefined` timestamp
   - `src/components/context/MessageDB.tsx:1047` — React Query cache update never matched
   - The `Message` type has `createdDate`, not `timestamp`. Plan assumed wrong field name.

2. **IndexedDB compound key mismatch** in `src/db/messages.ts:383-386`
   - Used 2-element key `[conversationId, 0]` but `by_conversation_time` index is 3-element `[spaceId, channelId, createdDate]`
   - Fixed to take separate `spaceId`/`channelId` params: `[spaceId, channelId, 0]`

3. **Missing `lastReadTimestamp` prop** from DirectMessage → MessageList
   - Every message got an IntersectionObserver (not just unread ones)
   - Added `lastReadTimestamp={lastReadTimestamp}` to MessageList JSX

4. **Duplicate `lastReadTimestamp` in Message.tsx** props — appeared twice in type and destructuring, causing Babel "Argument name clash" build error.

## Testing Instructions

When sync issues are resolved, test the following scenarios with two users (both with Read receipts ON in Settings > Privacy):

### Basic Flow
1. User A sends a DM to User B
2. User B opens the conversation and scrolls to see the message
3. After ~1 second of the message being visible + ~5 second debounce → User A should see ✓✓

### Piggyback
1. User A sends messages to User B
2. User B reads them, then replies
3. The read ack should piggyback on User B's reply (check WebSocket — no standalone `read-ack` message should be sent if reply happens within 5s)

### Settings
1. Both ON → ✓✓ visible
2. Recipient OFF, Sender ON → sender sees ✓ only (no ✓✓)
3. Sender OFF → no ✓✓ displayed (even if `readAt` is persisted)
4. Toggle OFF mid-conversation → pending read buffer discarded

### Persistence
1. See ✓✓, close and reopen app → ✓✓ still shows

### Console Logs to Watch
- `[ReadReceipt] Processing incoming read ack` — sender side receives ack
- `[ReadReceipt] Processing piggybacked read ack` — sender receives piggybacked ack
- No `console.log` debug statements should appear (all removed)

## Related Files

| File | Role |
|---|---|
| `src/types/deliveryReceipt.ts` | `ReadAckMessage` type, `readAt`/`readAckUpTo` extensions |
| `src/services/DeliveryReceiptService.ts` | Read high-water mark buffer, timers, flush |
| `src/services/ActionQueueHandlers.ts` | `send-read-ack` handler |
| `src/services/MessageService.ts` | Intercept `read-ack`, piggyback on DM sends |
| `src/hooks/business/messages/useReadReceipt.ts` | IntersectionObserver + 1s dwell timer |
| `src/components/context/MessageDB.tsx` | Service wiring, `onReadAckProcessed` cache update |
| `src/components/message/Message.tsx` | ✓ → ✓✓ display logic, hook wiring |
| `src/components/direct/DirectMessage.tsx` | `reportRead` callback, config loading |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Read receipts toggle |

## Related Docs

- Design spec: `.agents/tasks/2026-03-22-dm-read-receipts-design.md`
- Implementation plan: `.agents/tasks/2026-03-22-dm-read-receipts-plan.md`
- Phase 1 spec: `.agents/tasks/2026-03-18-dm-delivery-receipts-design.md`

## Prevention

- The `message.timestamp` bug class (wrong field name) could be prevented by having the plan verify field names against actual types before writing code. The plan assumed `timestamp` but the actual field is `createdDate`.
- IndexedDB compound key shapes should be verified against the actual index definition, not assumed from the method signature.
