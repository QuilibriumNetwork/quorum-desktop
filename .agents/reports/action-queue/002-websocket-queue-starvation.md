# WebSocket Queue Starvation Causes DM Delays

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Classification

| Label | Applies | Notes |
|-------|---------|-------|
| `action-queue-bug` | ❌ No | Not caused by Action Queue |
| `pre-existing` | ✅ Yes | Affects legacy path equally |
| `network-issue` | ❌ No | Local queue architecture issue |
| `test-environment` | ⚠️ Partial | Worse with many inboxes to subscribe to |

**Summary**: The WebSocket outbound queue processes items sequentially. Large batches of `listen` requests (e.g., 100+ inboxes) block DM sends for 30-60+ seconds.

## Symptoms

- DM encryption completes quickly (~0-10 sec)
- But "Sending..." indicator hangs for 30-60+ seconds
- Console shows large `listen` requests being processed between START and COMPLETE:
  ```
  [DM-xxx] Sending 20 outbound messages via WebSocket
  [WS-SEND] listen {inboxCount: 106}  <-- This blocks the DM!
  [DM-xxx] WebSocket send completed   <-- 47 seconds later
  ```

## Root Cause

The WebSocket queue in `WebsocketProvider.tsx` is single-threaded and FIFO:

```typescript
// Lines 125-151: Process outbound sequentially
while ((outbound = dequeueOutbound())) {
  const messages = await outbound();
  for (const m of messages) {
    wsRef.current.send(m);
  }
}
```

When sync/resubscribe operations queue large batches of listen requests, DM sends have to wait.

### Timeline Example

| Time | Event |
|------|-------|
| 10:10:35.384 | send-dm START - DM queued |
| 10:10:35.xxx | Encryption complete, 20 messages queued |
| 10:10:35.xxx | Queue already has sync operations ahead |
| 10:11:22.757 | Finally DM's turn - messages sent |
| 10:11:22.763 | send-dm COMPLETE |

**47 seconds blocked by queue!**

## Affected Paths

- ✅ Action Queue DM path
- ✅ Legacy DM path
- ✅ Space message sending
- ✅ Any outbound WebSocket operation

## Potential Solutions (Future)

1. **Priority Queue**: Give DM sends higher priority than sync operations
2. **Parallel Sends**: Process some outbound in parallel (careful with ordering)
3. **Batch Optimization**: Combine multiple listen requests into fewer messages
4. **Separate Channels**: Use separate WebSocket connections for DM vs sync

## Workaround

None currently. This is a known limitation during heavy sync activity.

## Evidence

```
10:10:35.384 - send-dm START
10:10:35.xxx - Encrypting for 10 target inbox(es) {encryptionStatesFound: 10}
10:10:35.xxx - Sending 20 outbound messages via WebSocket {sessionCount: 10}
10:11:22.757 - [WS-SEND] listen {inboxCount: 106}  <-- 47 seconds later!
10:11:22.757 - WebSocket send completed
10:11:22.763 - send-dm COMPLETE
```

---

## Related

- [Action Queue Bug Index](./INDEX.md)
- [WebsocketProvider.tsx](../../../src/components/context/WebsocketProvider.tsx)

---

_Created: 2025-12-19_
_Status: 📋 Documented (pre-existing, not blocking)_
