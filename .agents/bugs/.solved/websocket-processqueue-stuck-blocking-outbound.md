# WebSocket processQueue Stuck - Blocking Outbound Messages

> **AI-Generated**: May contain errors. Verify before use.

## Symptoms

- Space profile updates (avatar, display name) never sync to server
- Outbound messages queue up but never execute
- Console shows repeated `[WebSocket] processQueue early return - processing: true handler: true`
- `processingRef.current` lock never releases
- Actions using `enqueueOutbound` silently fail (no error, just never execute)

## Root Cause

The `WebSocketProvider.processQueue()` function in `src/components/context/WebsocketProvider.tsx` can get stuck indefinitely:

1. **Processing lock acquired** (line ~81): `processingRef.current = true`
2. **Inbound messages grouped and processed** (lines ~88-118): Messages are wrapped in Promises and processed via `Promise.allSettled(allPromises)`
3. **Handler blocks/hangs**: If `handlerRef.current!(message)` at line ~108 never returns (hangs indefinitely), the Promise wrapping it never settles
4. **Promise.allSettled waits forever**: Line ~118 `await Promise.allSettled(allPromises)` blocks indefinitely waiting for the hung promise
5. **Execution never reaches finally block**: Since `Promise.allSettled` never completes, the finally block (line ~160-163) that releases the lock is never reached
6. **Outbound queue starves**: Lines 125-157 (outbound processing) never execute because the function is stuck at `Promise.allSettled`

**Key Issue**: There's no timeout or recovery mechanism for hung handlers. A single slow/stuck inbound message blocks ALL outbound messages indefinitely.

**Note**: The issue is NOT that errors prevent the finally block from executing (errors are caught). The issue is that if a handler **never returns** (infinite loop, deadlock, unresolved Promise), `Promise.allSettled` waits forever and execution never reaches the finally block.

**Code Location**: `src/components/context/WebsocketProvider.tsx:74-164`

```typescript
const processQueue = async () => {
  if (processingRef.current || !handlerRef.current) {
    return;  // <-- All subsequent calls return here while stuck
  }

  processingRef.current = true;  // <-- Lock acquired (line 81)
  try {
    // Inbound messages wrapped in promises (lines 99-117)
    for (const [_, messages] of inboxMap) {
      allPromises.push(
        new Promise(async (resolve) => {
          for (const message of messages) {
            await handlerRef.current!(message);  // <-- If this hangs, promise never settles
          }
          resolve();
        })
      );
    }
    await Promise.allSettled(allPromises);  // <-- Waits forever if any promise never settles (line 118)
    // ... outbound processing (lines 125-157, never reached if above hangs) ...
  } finally {
    processingRef.current = false;  // <-- Never reached if Promise.allSettled hangs (line 161)
  }
};
```

## Impact

### Affected Features
- **DM sending** (via ActionQueue's `sendDirectMessages`) - CRITICAL
- **DM listen subscriptions** (after processing inbound DM)
- **Space profile updates** (`update-profile` message type) - discovered during investigation
- **Message retries** (both Space and DM retry flows)
- **Any action using `enqueueOutbound`**:
  - Edit messages
  - Pin/unpin messages
  - Profile updates

### Relationship to Action Queue
The Action Queue (`ActionQueueService`) is **not the cause** but is affected:
- Action Queue handlers call `MessageService` methods
- `MessageService.submitChannelMessage()` uses `this.enqueueOutbound()` for certain message types
- `enqueueOutbound` → `WebSocketProvider.enqueueOutbound()` → stuck `processQueue`

Per action-queue.md documentation (lines 354-367):
```
ActionQueueService → MessageService/ConfigService → WebSocketProvider
(Persistence layer)   (Business logic)              (Transport layer)
```

The bug is in the transport layer, affecting both Action Queue path and legacy paths.

## Pre-existing Bug Verification

### Bug Exists in `develop` and `cross-platform` Branches

The WebsocketProvider.tsx has the **identical single-lock architecture** in all branches:

**`develop` branch:**
```bash
$ git show develop:src/components/context/WebsocketProvider.tsx | grep -n "processingRef"
33:  const processingRef = useRef(false);      # Single lock
59:    if (processingRef.current || !handlerRef.current) {
63:    processingRef.current = true;
115:      processingRef.current = false;
```

**`cross-platform` branch:**
```bash
$ git show cross-platform:src/components/context/WebsocketProvider.tsx | grep -n "processingRef"
35:  const processingRef = useRef(false);      # Single lock
75:    if (processingRef.current || !handlerRef.current) {
79:    processingRef.current = true;
139:      processingRef.current = false;
```

**Conclusion**: The bug has existed since the initial implementation (`develop` branch, initial public commit). It is NOT caused by the Action Queue.

### Why Action Queue Makes the Bug More Visible

| Branch | `enqueueOutbound` calls | Key Difference |
|--------|------------------------|----------------|
| `cross-platform` | 7 calls | All triggered by user actions (edit, pin, send message) |
| `action-queue` | 6 calls + **new `sendDirectMessages()`** | ActionQueue calls `sendDirectMessages()` for ALL DM sends |

**The critical difference**: In `cross-platform`, DM sending used a different code path. With Action Queue:
1. ALL DM sends go through `ActionQueueHandlers.sendDmHandler()`
2. Which calls `MessageService.sendDirectMessages()` (line 171)
3. Which calls `this.enqueueOutbound()`

**Before Action Queue**: DM sending didn't use `enqueueOutbound` as heavily, so the bug was less likely to trigger.

**With Action Queue**: Every single DM send now depends on `enqueueOutbound` executing, making the blocking bug affect a core feature (DM communication) rather than just edge cases (edit, pin, profile update).

## Discovery Context

Found while debugging why Space avatar/display name changes weren't persisting:
1. User saves profile in Space Settings modal
2. `useSpaceProfile.onSave()` calls `submitChannelMessage()` with `update-profile` type
3. Message correctly enqueued to outbound queue
4. `processQueue` already stuck processing inbound messages
5. Outbound callback never executes
6. Profile change never sent to server

## Solution

### Chosen: Separate Inbound/Outbound Processing (Option 2)

After analysis by feature-analyzer agent, **Option 2 is the safest and recommended fix**.

#### Why Option 2 (Separate Locks)

| Criteria | Option 1 (Timeout) | Option 2 (Separate) | Option 3 (Bypass) |
|----------|-------------------|---------------------|-------------------|
| Data loss risk | **HIGH** - timeout mid-encryption corrupts state | **NONE** | **MEDIUM** - ordering issues |
| Behavior change | Yes - may skip messages | **No** - same logic, just parallel | Yes - breaks ordering |
| Code complexity | Medium | **Low** - just split function | Low but fragile |
| Fixes bug completely | Partially (still blocks during timeout) | **Yes** | Partially |

#### Verification Results (feature-analyzer)

**All claims confirmed:**
1. **Inbound and outbound are independent** - Only producer-consumer relationship (inbound can enqueue outbound via `MessageService.ts:2037`, but doesn't wait for it)
2. **No hidden dependencies** - They share no state requiring synchronized access
3. **WebSocket API supports concurrent sends** - `send()` is thread-safe
4. **Ordering preserved** - Outbound FIFO maintained, inbound already parallel by inbox

#### Implementation

```typescript
// Separate processing locks
const inboundProcessingRef = useRef(false);
const outboundProcessingRef = useRef(false);

const processInbound = async () => {
  if (inboundProcessingRef.current || !handlerRef.current) return;
  inboundProcessingRef.current = true;
  try {
    // Lines 86-123 (existing inbound logic)
  } finally {
    inboundProcessingRef.current = false;
  }
};

const processOutbound = async () => {
  if (outboundProcessingRef.current) return;
  outboundProcessingRef.current = true;
  try {
    // Lines 125-157 (existing outbound logic)
  } finally {
    outboundProcessingRef.current = false;
  }
};
```

#### Call Site Updates

| Location | Current | After Fix |
|----------|---------|-----------|
| `ws.onopen` (line 173) | `processQueue()` | `processInbound(); processOutbound();` |
| `ws.onmessage` (line 185) | `processQueue()` | `processInbound();` (only inbound needed) |
| `setInterval` (line 204) | `processQueue()` | `processInbound(); processOutbound();` |
| `enqueueOutbound` (line 215) | `processQueue()` | `processOutbound();` (only outbound needed) |
| `setMessageHandler` (line 220) | `processQueue()` | `processInbound();` (only inbound needed) |

### Rejected Options

#### Option 1: Add Timeout (REJECTED - Data Loss Risk)
```typescript
await processWithTimeout(() => handlerRef.current!(message), 30000);
```
**Risk**: If handler times out mid-encryption-state-update (e.g., `MessageService.ts:2037`), state may be corrupted. The handler could still be running after timeout, causing race conditions.

#### Option 3: Non-blocking Outbound (REJECTED - Breaks Guarantees)
```typescript
if (wsRef.current?.readyState === WebSocket.OPEN) {
  wsRef.current.send(message);
}
```
**Risk**: Critical messages jump the queue, breaking ordering guarantees. Inconsistent behavior - some messages queued, some not.

## Prevention

1. ~~**Add handler timeouts**~~ - Not recommended (data loss risk)
2. **Separate concerns**: Inbound and outbound processing should not share a single lock
3. **Add monitoring**: Log when processing takes >5s for debugging
4. **Architecture principle**: Independent operations should have independent locks

## Related Files

- `src/components/context/WebsocketProvider.tsx:74-164` - Bug location
- `src/services/MessageService.ts:171` - `sendDirectMessages()` uses `enqueueOutbound` (ActionQueue path)
- `src/services/MessageService.ts:1563` - `submitMessage()` uses `enqueueOutbound` for DMs
- `src/services/MessageService.ts:2037` - DM listen subscription uses `enqueueOutbound`
- `src/services/MessageService.ts:3513` - `submitChannelMessage()` uses `enqueueOutbound` for edit/pin/update-profile
- `src/services/MessageService.ts:3941` - `retryFailedChannelMessage()` uses `enqueueOutbound`
- `src/services/MessageService.ts:4088` - `retryFailedDirectMessage()` uses `enqueueOutbound`
- `src/hooks/business/spaces/useSpaceProfile.ts` - Affected feature (profile updates)
- `.agents/docs/features/action-queue.md` - Documents WebSocket queue relationship

## Debug Logs Added (To Remove)

During investigation, debug logs were added to these files:
- `src/components/context/WebsocketProvider.tsx` - processQueue flow logging
- `src/services/MessageService.ts` - submitChannelMessage logging
- `src/hooks/business/spaces/useSpaceProfile.ts` - onSave flow logging

These should be removed after the fix is implemented.

---

_Created: 2025-12-19_
_Updated: 2025-12-19_ (corrected blocking mechanism, added all affected features, added feature-analyzer verification, chose Option 2)
_Discovered while: Debugging Space profile avatar not updating_
_Status: Ready for implementation_
