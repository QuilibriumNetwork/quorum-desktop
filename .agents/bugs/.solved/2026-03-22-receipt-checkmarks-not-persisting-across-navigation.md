---
type: bug
title: "Receipt checkmarks disappear on page refresh and conversation navigation"
status: done
priority: high
ai_generated: true
created: 2026-03-22
updated: 2026-03-23
resolved: 2026-03-23
---

# Receipt checkmarks disappear on page refresh and conversation navigation

> **AI-Generated**: May contain errors. Verify before use.

## Symptoms

Delivery receipt checkmarks (✓) and read receipt checkmarks (✓✓) disappear when:
1. The page is refreshed (F5 / Ctrl+R)
2. The user navigates away from a DM conversation and returns

**Key user observation**: All checkmarks (including old ones) reappear when the other user sends a new message. This strongly suggests checkmarks only show when ack data arrives live via WebSocket — not when loaded from IndexedDB.

Additionally, if a user toggles their delivery/read receipts privacy setting OFF, **all previously received checkmarks disappear** from the UI, even though the data is still in IndexedDB. The expectation is that once a receipt is received, it should remain visible regardless of the current setting — the setting should only control *sending* new acks, not hiding already-received ones.

## Root Cause

Three separate issues contribute to this bug:

### Issue 1: React Query cache returns stale data without `deliveredAt`/`readAt`

`src/hooks/queries/messages/useMessages.ts:23` configures the messages query with:

```typescript
staleTime: 5 * 60 * 1000,  // 5 minutes
gcTime: 10 * 60 * 1000,     // 10 minutes
```

There is no `refetchOnMount: 'always'` setting. The flow on page refresh:

1. **Initial load**: React Query calls `buildMessagesFetcher` → `messageDB.getMessages()` → IndexedDB `cursor.value` — this should include `deliveredAt`/`readAt` if persisted
2. **Cache retained**: The loaded data is cached for 5 min (stale) / 10 min (GC)
3. **Navigation back**: React Query returns cached snapshot without re-fetching from IndexedDB

The `onAckProcessed` callback (`MessageDB.tsx:986-1014`) uses `queryClient.setQueriesData({ queryKey: ['Messages'] })` which only updates **active/cached queries**. If a conversation's cache was GC'd or the message wasn't in cached pages, the update is silently lost.

### Issue 2: "Reappear on new message" — piggybacked acks restore state

When the other user sends a new message, it may carry **piggybacked ack data** (`ackMessageIds` field) or trigger a new standalone ack exchange. The `processDeliveryReceiptData` method (`MessageService.ts:207-273`) processes these acks and calls `onAckReceived()`, which updates the React Query cache live — making all checkmarks reappear at once.

This explains the user-reported behavior: checkmarks aren't truly "persisted and loaded" — they only show when ack data arrives via WebSocket during the current session. On page refresh, the cache starts empty and no ack re-delivery occurs (Double Ratchet messages are consumed on decrypt and not replayed).

**Needs verification**: Whether `deliveredAt`/`readAt` are actually present in IndexedDB after receiving acks. The `updateMessageDeliveredAt()` call at `MessageDB.tsx:1013` is fire-and-forget (no `await`). If the write fails silently or the page refreshes before the IndexedDB transaction commits, the data is lost. This can be verified by inspecting IndexedDB in DevTools after receiving an ack.

### Issue 3: Privacy setting gates display of already-received receipts

In `src/components/message/Message.tsx:946-954`, the rendering logic gates checkmark display on the **current** `showDeliveryReceipts` / `showReadReceipts` props:

```typescript
if (showReadReceipts && msgAny.readAt) {
  // Show ✓✓
} else if (msgAny.deliveredAt && (showDeliveryReceipts || showReadReceipts)) {
  // Show ✓
}
```

Additionally, these props are initialized to `false` in `DirectMessage.tsx:77-78` (`useState<boolean>(false)`) and only set to `true` asynchronously via `useEffect` when the user config loads from IndexedDB (`DirectMessage.tsx:131-155`). This creates a brief render where messages display without checkmarks even when the data is available.

When the user turns the setting OFF, all checkmarks vanish — even for messages that already have `deliveredAt`/`readAt` persisted. The setting should only control **sending** acks, not hiding already-received data.

## Key Files

| File | Relevance |
|---|---|
| `src/hooks/queries/messages/useMessages.ts:23` | `staleTime: 5min` with no `refetchOnMount` — stale cache returned on navigation |
| `src/components/context/MessageDB.tsx:986-1014` | `onAckProcessed` callback — fire-and-forget IndexedDB write + React Query cache update |
| `src/components/context/MessageDB.tsx:1029-1070` | `onReadAckProcessed` callback — same pattern for read receipts |
| `src/services/MessageService.ts:207-273` | `processDeliveryReceiptData` — intercepts acks from incoming messages |
| `src/components/message/Message.tsx:946-954` | Receipt indicator rendering — gates on current privacy setting |
| `src/components/direct/DirectMessage.tsx:77-78,131-141` | Privacy settings loaded async, `useState(false)` initial value |
| `src/db/messages.ts:353-409` | `updateMessageDeliveredAt()` / `updateMessagesReadAt()` — IndexedDB write methods |
| `src/db/messages.ts:457-555` | `getMessages()` — returns `cursor.value` directly (no field stripping) |

## Solution

Three fixes applied:

### Fix 1: Force re-fetch from IndexedDB on mount

`src/hooks/queries/messages/useMessages.ts:23` — changed `staleTime` from `5 * 60 * 1000` to `0`. Since this reads from local IndexedDB (not network), every mount now fetches fresh data including persisted `deliveredAt`/`readAt`.

### Fix 2: Show already-received receipts regardless of current setting

`src/components/message/Message.tsx:946-961` — removed the `showDeliveryReceipts`/`showReadReceipts` gate from checkmark rendering. If `deliveredAt` or `readAt` exists on a message, the checkmark always shows. The privacy setting now only controls *sending* acks, not hiding already-received ones.

**Design decision**: The setting controls future behavior, not retroactive erasure. Messages that had receipts while the setting was ON keep their checkmarks even after toggling OFF. No new `deliveredAt`/`readAt` is written when the setting is OFF because:
- Delivery ack processing is gated on `deliveryReceiptsEnabled` (`MessageService.ts:247`)
- Sending acks is gated on `deliveryReceiptsEnabled` (`MessageService.ts:265`)
- Read ack processing is intentionally unconditional (`MessageService.ts:229-231`) to allow toggling ON later to reveal historical read status
- `reportRead` callback is gated on `readReceipts` (`DirectMessage.tsx:291`)

### Fix 3: Add receipt props to React.memo comparison

`src/components/message/Message.tsx:1390-1391` — added `showDeliveryReceipts` and `showReadReceipts` to the memo comparison. This was the sneaky root cause: when the user config loaded async and these props changed from `false` to `true`, the memo blocked re-renders because it didn't compare these props.

## Verification

Verified via IndexedDB console script: 96 out of 200 DM messages have `deliveredAt` persisted. The write path works correctly — the issue was purely React Query cache + memo comparison preventing the persisted data from rendering.

User confirmed checkmarks now persist across page refresh after applying the three fixes.

## Prevention

- When using React Query for IndexedDB-backed data, prefer short `staleTime` or `refetchOnMount: 'always'` since local DB reads are cheap
- UI display of persisted data should not be gated on ephemeral settings — once data is written, it should remain visible
- Await critical IndexedDB writes (or at minimum log failures) rather than fire-and-forget
- Consider adding an integration test that verifies checkmarks survive a page refresh cycle

## Related

- `.agents/bugs/2026-03-19-standalone-delivery-ack-unreliable.md` — related issue with standalone acks not reaching sender
- `.agents/tasks/2026-03-18-dm-delivery-receipts-plan.md` — original delivery receipts implementation plan
- `.agents/tasks/2026-03-22-dm-read-receipts-plan.md` — read receipts implementation plan
