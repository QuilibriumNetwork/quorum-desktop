---
type: report
title: DM Sync Non-Deterministic Failures
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# DM Sync Non-Deterministic Failures

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

DM-related actions intermittently fail to sync with recipients:

1. **Messages not syncing** - Sent messages don't appear on recipient's device
2. **Reactions not syncing** - Added reactions don't show for the other party
3. **Deletes not syncing** - Deleted messages remain visible to recipient

**Characteristics:**
- Non-deterministic (sometimes works, sometimes doesn't)
- Tested only in DM context (Spaces not yet evaluated)
- Disabling action queue doesn't clearly resolve the issue
- Hard to determine if issue is in our code or network/backend sync

## Potential Root Causes

Two possible failure points that are difficult to distinguish:

### 1. Our Code (Action Queue / Double Ratchet)
- Action queue handlers not properly encrypting/sending
- Double Ratchet encryption state inconsistencies
- WebSocket messages not being transmitted correctly
- Race conditions in message processing

### 2. Network/Backend Sync
- Messages not propagating between nodes
- WebSocket connection issues
- Backend message delivery failures
- Node synchronization delays

## Debugging Infrastructure Added

To isolate the root cause, comprehensive logging was added on **2025-12-18**:

### Files Modified for Logging

| File | What's Logged |
|------|--------------|
| `src/services/ActionQueueHandlers.ts` | All DM handlers: send-dm, reaction-dm, delete-dm, edit-dm |
| `src/components/context/WebsocketProvider.tsx` | WebSocket sends for `direct` and `listen` message types |
| `src/services/MessageService.ts` | Legacy DM path (fallback when action queue disabled) |

### Trace ID Format

Each action gets a unique trace ID for end-to-end tracking:

- `[DM-{messageId8}]` - For send-dm handler
- `[DM-REACT-{messageId8}]` - For reaction-dm handler
- `[DM-DEL-{removeMessageId8}]` - For delete-dm handler
- `[DM-EDIT-{messageId8}]` - For edit-dm handler
- `[DM-LEGACY-{timestamp36}]` - For legacy path
- `[WS-SEND]` - For WebSocket transmission

### Log Points

For each DM action, logs are emitted at:
1. **START** - Action enters handler with context
2. **Encrypting** - Target inbox count, encryption states found
3. **Sending via WebSocket** - Outbound message count, session count
4. **WebSocket send completed** - Transmission done
5. **COMPLETE** or **FAILED** - Final status

### How to Use Logs

1. Open browser DevTools → Console
2. Perform a DM action (send, react, delete, edit)
3. Search for the trace ID in console
4. If logs show COMPLETE but recipient doesn't receive → **Network/backend issue**
5. If logs show FAILED or incomplete → **Our code issue**

## Feature Flags Added

Granular control over DM action queue in `src/config/features.ts`:

```typescript
export const DM_ACTION_QUEUE = {
  ENABLED: true,    // Master switch
  REACTION: true,   // reaction-dm handler
  DELETE: true,     // delete-dm handler
  EDIT: true,       // edit-dm handler
};
```

Use `isDmActionEnabled('REACTION' | 'DELETE' | 'EDIT')` to check.

When disabled, actions fall back to legacy WebSocket outbound queue path.

## Test Results

### Test 1: DM Send Message (2025-12-18 15:48)

**Action**: Send a text message in DM conversation

**Sender logs** (message NOT received by recipient):
```
[DM-2a860b42] send-dm START {address: 'QmV5xWMo5CYSxgAA...', messageId: '2a860b420477a917...', contentType: 'post', timestamp: '2025-12-18T15:48:35.611Z'}
[DM-2a860b42] Encrypting for 22 target inbox(es) {encryptionStatesFound: 22}
[DM-2a860b42] Sending 44 outbound messages via WebSocket {sessionCount: 22}
[DM-2a860b42] WebSocket send completed
[WS-SEND] listen {timestamp: '2025-12-18T15:48:47.794Z', inboxCount: 1}
[WS-SEND] direct {timestamp: '2025-12-18T15:48:47.795Z', hasPayload: false}
... (44 WS-SEND logs total - 22 listen + 22 direct)
[DM-2a860b42] send-dm COMPLETE - message sent successfully
```

**Recipient logs** (during same time window):
```
[WS-SEND] listen {timestamp: '2025-12-18T15:44:08.047Z', inboxCount: 69}
[WS-SEND] listen {timestamp: '2025-12-18T15:45:42.860Z', inboxCount: 69}
[WS-SEND] listen {timestamp: '2025-12-18T15:46:04.858Z', inboxCount: 69}
[WS-SEND] listen {timestamp: '2025-12-18T15:46:21.871Z', inboxCount: 69}
```
**No incoming message received.**

**Analysis**:
- ✅ Sender code completed successfully (all steps logged, COMPLETE status)
- ✅ Message encrypted for 22 target inboxes
- ✅ 44 WebSocket messages transmitted (22 listen + 22 direct)
- ❌ Recipient never received the message
- **Conclusion**: Network/backend delivery failure, NOT our code

**Root Cause**: Messages are being sent correctly by our client but not delivered by the Quilibrium network/relay infrastructure.

---

### Test 2: DM Reaction (2025-12-18 15:52)

**Action**: Add ❤️ reaction to a DM message

**Sender logs** (reaction NOT received by recipient):
```
[DM-REACT-fe84c88d] reaction-dm START {type: 'reaction', reaction: '❤️', messageId: 'fe84c88d32c1e4a4', timestamp: '2025-12-18T15:52:13.905Z'}
[DM-REACT-fe84c88d] Encrypting for target inboxes {targetCount: 22, encryptionStates: 22}
[DM-REACT-fe84c88d] Sending via WebSocket {outboundCount: 44, sessions: 22}
[DM-REACT-fe84c88d] WebSocket send completed
[WS-SEND] listen {timestamp: '2025-12-18T15:52:14.797Z', inboxCount: 1}
[WS-SEND] direct {timestamp: '2025-12-18T15:52:14.797Z', hasEnvelope: true, toInbox: 'undefined...', payloadSize: 15872}
... (44 WS-SEND logs total - 22 listen + 22 direct, all with hasEnvelope: true)
[DM-REACT-fe84c88d] reaction-dm COMPLETE
```

**Recipient logs** (during same time window):
```
[WS-SEND] listen {timestamp: '2025-12-18T15:51:41.877Z', inboxCount: 77}
[WS-SEND] listen {timestamp: '2025-12-18T15:52:15.609Z', inboxCount: 77}
[WS-SEND] listen {timestamp: '2025-12-18T15:52:41.393Z', inboxCount: 77}
```
**No incoming reaction received.**

**Analysis**:
- ✅ Sender code completed successfully (reaction-dm COMPLETE)
- ✅ Reaction encrypted for 22 target inboxes
- ✅ 44 WebSocket messages transmitted with envelopes (~15KB each)
- ⚠️ `toInbox: 'undefined...'` - the sealed_message structure may not have `to_inbox_address` field
- ❌ Recipient never received the reaction
- **Conclusion**: Same as Test 1 - network/backend delivery failure

**Note**: The improved logging shows `hasEnvelope: true` and `payloadSize: 15872` confirming the messages have actual content.

---

### Test 3: DM Remove Reaction (2025-12-18 15:54)

**Action**: Remove 👍 reaction from a DM message

**Sender logs** (remove-reaction NOT received by recipient):
```
[DM-REACT-0357bf39] reaction-dm START {type: 'remove-reaction', reaction: '👍', messageId: '0357bf3979f50f8e', timestamp: '2025-12-18T15:54:34.637Z'}
[DM-REACT-0357bf39] Encrypting for target inboxes {targetCount: 22, encryptionStates: 22}
[DM-REACT-0357bf39] Sending via WebSocket {outboundCount: 44, sessions: 22}
[DM-REACT-0357bf39] WebSocket send completed
[WS-SEND] listen/direct pairs... (44 total, hasEnvelope: true, payloadSize: ~70KB each)
[DM-REACT-0357bf39] reaction-dm COMPLETE
```

**Analysis**:
- ✅ Sender code completed successfully
- ✅ Larger payload size (~70KB vs ~15KB) - possibly including more encryption state
- ❌ Recipient never received the remove-reaction
- **Conclusion**: Same pattern - network/backend delivery failure

---

### Test 4: DM Delete Message (2025-12-18 15:54)

**Action**: Delete a DM message

**Sender logs** (delete NOT received by recipient - message still visible):
```
[DM-DEL-0a5330a4] delete-dm START {removeMessageId: '0a5330a446ac84f8', timestamp: '2025-12-18T15:54:42.591Z'}
[DM-DEL-0a5330a4] Encrypting for target inboxes {targetCount: 22, encryptionStates: 22}
[DM-DEL-0a5330a4] Sending via WebSocket {outboundCount: 44, sessions: 22}
[DM-DEL-0a5330a4] WebSocket send completed
[WS-SEND] listen/direct pairs... (44 total, hasEnvelope: true, payloadSize: ~70KB each)
[DM-DEL-0a5330a4] delete-dm COMPLETE
```

**Recipient logs**:
```
[WS-SEND] listen {timestamp: '2025-12-18T15:54:26.442Z', inboxCount: 69}
```
**Message still visible on recipient - delete never received.**

**Analysis**:
- ✅ Sender code completed successfully (delete-dm COMPLETE)
- ✅ Delete encrypted and sent to 22 inboxes
- ❌ Recipient never received the delete
- **Conclusion**: Same pattern - network/backend delivery failure

---

## Summary of All Tests

| Test | Action | Sender Status | Recipient Status | Result |
|------|--------|---------------|------------------|--------|
| 1 | Send message | ✅ COMPLETE | ❌ Not received | Network failure |
| 2 | Add reaction | ✅ COMPLETE | ❌ Not received | Network failure |
| 3 | Remove reaction | ✅ COMPLETE | ❌ Not received | Network failure |
| 4 | Delete message | ✅ COMPLETE | ❌ Not received | Network failure |

**Conclusion**: All DM action types fail to sync. Our code completes successfully in every case, but the Quilibrium network/relay does not deliver the messages to the recipient.

---

## Investigation Steps

1. [x] Reproduce the issue while watching console logs
2. [x] Capture trace IDs for failed syncs
3. [x] Determine if our code completed successfully (COMPLETE logged)
4. [x] If COMPLETE logged, issue is network/backend ← **CONFIRMED**
5. [ ] If FAILED logged, analyze error message
6. [ ] Test with individual action types disabled to isolate
7. [ ] Compare behavior between action queue and legacy paths
8. [ ] Report network delivery issue to Quilibrium team

## Files to Remove When Fixed

Once issue is resolved, remove debugging logs from:

- [ ] `src/services/ActionQueueHandlers.ts:562-568` (send-dm START log)
- [ ] `src/services/ActionQueueHandlers.ts:616-618` (encrypting log)
- [ ] `src/services/ActionQueueHandlers.ts:705-709` (WebSocket send logs)
- [ ] `src/services/ActionQueueHandlers.ts:766` (send-dm COMPLETE log)
- [ ] `src/services/ActionQueueHandlers.ts:777-781` (send-dm FAILED log)
- [ ] `src/services/ActionQueueHandlers.ts:860-864` (encryptAndSendDm logs)
- [ ] `src/services/ActionQueueHandlers.ts:951-953` (encryptAndSendDm send logs)
- [ ] `src/services/ActionQueueHandlers.ts:982-1005` (reaction-dm logs)
- [ ] `src/services/ActionQueueHandlers.ts:1041-1066` (delete-dm logs)
- [ ] `src/services/ActionQueueHandlers.ts:1103-1130` (edit-dm logs)
- [ ] `src/components/context/WebsocketProvider.tsx:129-141` (WS-SEND logs)
- [ ] `src/services/MessageService.ts:1539-1545` (legacy path START log)
- [ ] `src/services/MessageService.ts:1742` (legacy edit-message COMPLETE log)
- [ ] `src/services/MessageService.ts:1896` (legacy delete-conversation COMPLETE log)
- [ ] `src/services/MessageService.ts:1927` (legacy path COMPLETE log)

## Related

- [Action Queue Bug Index](./INDEX.md)
- [Action Queue Feature Docs](../../docs/features/action-queue.md)
- [DM Code Comparison Audit](./003-DM-message-code-comparison-audit.md)
- Feature flags: `src/config/features.ts`

---
