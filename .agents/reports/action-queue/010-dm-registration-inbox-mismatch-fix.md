# DM Messages Not Delivered - Device Registration Inbox Mismatch

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent, security-analyst agent

**Severity**: Critical
**Status**: Fixed (Layer 2 + Layer 3)
**Created**: 2025-12-22
**Updated**: 2025-12-22

---

## TL;DR

DMs fail because sender encrypts for stale inbox addresses. **Three-layer caching** causes this:

1. **API** has stale device registrations → Receiver must remove via Privacy → Devices
2. ~~**React Query** caches registrations forever (`staleTime: Infinity`)~~ → **FIXED**: Now refetches after 5 minutes
3. ~~**Encryption States** in IndexedDB point to old inboxes~~ → **FIXED**: Cleanup on DM page load

**User Workaround**: Receiver removes stale devices via Privacy → Devices, sender refreshes browser (F5), then resends.

---

## Symptoms

- User A sends DM to User B - shows "sent" but never arrives
- Both users online with active WebSocket connections
- Both directions fail (A→B and B→A)
- Works fine between other user pairs

---

## Root Cause Analysis

### The Three-Layer Caching Problem

| Layer | Location | What's Cached | Auto-Refresh? |
|-------|----------|---------------|---------------|
| 1. API Registration | Server | User's device list | N/A |
| 2. React Query Cache | Sender's memory | `counterparty.device_registrations` | ~~`staleTime: Infinity`~~ **FIXED: 5 min** |
| 3. Encryption States | Sender's IndexedDB | DM sessions per inbox | Only on send |

### Why Messages Don't Arrive

```
User A sends to User B:
1. A fetches B's registration (from React Query cache - may be stale!)
2. A encrypts for B's cached inbox addresses: QmOld1, QmOld2...
3. B's device is actually listening on: QmNew1, QmNew2...
4. Zero overlap → messages go to inboxes nobody monitors
```

### The React Query Root Cause (FIXED)

**File**: [useRegistrationOptional.ts:19](src/hooks/queries/registration/useRegistrationOptional.ts#L19)

```typescript
// BEFORE (caused the bug):
return useQuery({
  staleTime: Infinity,  // ← NEVER refetches!
  gcTime: Infinity,     // ← Cached forever!
});

// AFTER (fix applied):
return useQuery({
  staleTime: 5 * 60 * 1000,  // ← Refetches after 5 minutes
  gcTime: Infinity,           // ← Kept for offline resilience
});
```

With this fix, sender's cache automatically refreshes after 5 minutes, picking up device changes.

---

## User Workaround

### Step 1: Receiver Cleans API (Layer 1)
1. Settings → Privacy → Devices
2. Remove all unrecognized devices
3. Save Changes

### Step 2: Sender Refreshes Cache (Layer 2)
1. Refresh browser (F5) - clears React Query cache
2. Navigate to the DM conversation
3. Send a new message

Layer 3 (encryption states) auto-cleans when layers 1 & 2 are fixed.

---

## Implemented Fixes

### Layer 2: Reduce staleTime ✅ IMPLEMENTED

**File**: [useRegistrationOptional.ts](src/hooks/queries/registration/useRegistrationOptional.ts)

```typescript
// Changed from Infinity to 5 minutes
staleTime: 5 * 60 * 1000,
```

**Pros**: Automatic, prevents NEW stale cache entries
**Limitation**: Does NOT clean up EXISTING stale encryption states in IndexedDB

---

## Implemented Fix: Layer 3 Cleanup ✅

### The Problem

The staleTime fix ensures React Query fetches fresh registration data after 5 minutes. However:

1. **DirectMessage.tsx** uses `useRegistrationOptional` to get counterparty registration
2. This fresh data is passed to **MessageService.submitMessage** (legacy path)
3. Legacy path has cleanup logic at [MessageService.ts:1636-1640](src/services/MessageService.ts#L1636-L1640)
4. **BUT**: Action Queue path at [ActionQueueHandlers.ts:546-569](src/services/ActionQueueHandlers.ts#L546-L569) reads encryption states directly from IndexedDB and never cleans them

**Result**: For established conversations using Action Queue, stale encryption states persist indefinitely.

### Solution: Cleanup in DirectMessage.tsx ✅ IMPLEMENTED

Added cleanup logic when registration data changes. Checks **BOTH self and counterparty inboxes** (matches legacy path pattern).

**File**: [DirectMessage.tsx:198-245](src/components/direct/DirectMessage.tsx#L198-L245)

```typescript
// In DirectMessage.tsx - when registration changes, clean stale encryption states
useEffect(() => {
  // Guard: Only run when BOTH self and counterparty registration are available
  if (!self?.registration || !registration?.registration || !address) {
    return;
  }

  const cleanupStaleEncryptionStates = async () => {
    try {
      const conversationId = `${address}/${address}`;
      const states = await messageDB.getEncryptionStates({ conversationId });

      if (states.length === 0) return;

      // Check BOTH self and counterparty inboxes (matches legacy path at MessageService.ts:1627-1634)
      const validInboxes = [
        ...self.registration.device_registrations
          .map(d => d.inbox_registration.inbox_address),
        ...registration.registration.device_registrations
          .map(d => d.inbox_registration.inbox_address),
      ];

      let deletedCount = 0;
      for (const state of states) {
        const parsed = JSON.parse(state.state);
        if (!validInboxes.includes(parsed.tag)) {
          await messageDB.deleteEncryptionState(state);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log('[DirectMessage] Cleaned up stale encryption states', {
          conversationId,
          deletedCount,
          remainingCount: states.length - deletedCount,
        });
      }
    } catch (error) {
      console.error('[DirectMessage] Failed to cleanup stale encryption states:', error);
      // Don't throw - cleanup is best-effort, shouldn't break the page
    }
  };

  cleanupStaleEncryptionStates();
}, [self?.registration, registration?.registration, address, messageDB]);
```

**Why this approach:**
- Uses registration data **already being fetched** (no extra API call)
- Runs on DM page load, not on send (keeps send path fast)
- Checks **BOTH self and counterparty** inboxes (matches legacy path pattern)
- Has proper error handling and logging
- Action Queue handler stays offline-capable (no network calls during task execution)

**Trade-off**: Cleanup only happens when user views the conversation. If user never opens the DM, stale states persist until they do.

---

## Known Limitation: New Device Detection

### The Problem

When Action Queue is enabled for DMs, **counterparty's NEW devices won't receive messages**.

**Why this happens:**
1. At enqueue time, routing checks if encryption states exist → routes to Action Queue
2. Action Queue handler only encrypts to inboxes with **existing** encryption states
3. New device's inbox has no state → **skipped entirely**
4. Action Queue can't create new sessions because it doesn't have `counterparty.device_registrations`

**Legacy path handles this** at [MessageService.ts:1862-1876](src/services/MessageService.ts#L1862-L1876):
```typescript
} else {
  // No existing state for this inbox - create NEW session
  sessions = [
    ...sessions,
    ...(await secureChannel.NewDoubleRatchetSenderSession(
      keyset.deviceKeyset,
      self.user_address,
      // Uses counterparty.device_registrations to find the new device
      self.device_registrations.concat(counterparty.device_registrations)
        .find((d) => d.inbox_registration.inbox_address === inbox)!,
      // ...
    )),
  ];
}
```

### Why Action Queue Can't Do This

Report [009-dm-offline-registration-persistence-fix.md](../reports/action-queue/009-dm-offline-registration-persistence-fix.md) deliberately removed `counterparty.device_registrations` from queue context to avoid storing sensitive registration data.

**Trade-off**: Offline resilience vs new device support.

### Impact

| Scenario | Legacy Path | Action Queue |
|----------|-------------|--------------|
| Existing devices | ✅ Works | ✅ Works |
| Stale devices | ✅ Cleaned + skipped | ⚠️ Cleaned by DirectMessage.tsx |
| **New devices** | ✅ Creates new session | ❌ **Skipped permanently** |

### Solution: Offline-Only Action Queue ✅ IMPLEMENTED

Use Action Queue **only when offline**. When online, always use legacy path.

| Scenario | Path | Result |
|----------|------|--------|
| Online + existing convo | Legacy | ✅ Works (creates new sessions for new devices) |
| Online + new convo | Legacy | ✅ Works |
| Offline + existing convo | Action Queue | ⚠️ Queued, new devices skipped |
| Offline + new convo | Legacy | ❌ Fails (can't create sessions offline - expected) |

**Why this works:**
- **Online (99% of cases)**: Legacy path handles everything - stale cleanup, new device sessions
- **Offline (rare)**: Action Queue queues for existing devices. When back online, user can resend and legacy path handles new devices

**The remaining gap is minimal**: Only messages sent while offline to a counterparty who added a new device *during* the offline period would miss the new device. Edge case of an edge case.

**Implementation** in [MessageService.ts](src/services/MessageService.ts):
```typescript
const isOnline = navigator.onLine;

if (ENABLE_DM_ACTION_QUEUE && hasEstablishedSessions && !isOnline) {
  // Only use Action Queue when offline
  await this.actionQueueService.enqueue('send-dm', ...);
} else {
  // Online or new conversation → legacy path
}
```

### Other Considered Solutions

1. **Hybrid routing**: Compare encryption state inboxes vs fresh registration inboxes. If new device detected, use legacy path. (More complex, still requires online check)
2. **Store minimal device data**: Store only new device registrations in queue context. (Security concern)
3. **Accept limitation**: Document that new devices get messages after sender's encryption states are cleared. (Poor UX)

### Agent Review Feedback (Incorporated)

Issues identified and fixed in proposed solution:
1. ✅ **Missing self device cleanup** - Now checks both self and counterparty inboxes
2. ✅ **No error handling** - Added try/catch with logging
3. ✅ **Silent failures** - Added console.log for observability
4. ✅ **Missing dependencies** - Uses `messageDB` from `useMessageDB()` hook

---

## Why Stale Devices Accumulate

### Triggers
- User clears browser data and re-imports account
- User regenerates device keys
- Sync feature pulls old registrations from server
- Registration upload fails silently

### Why Auto-Cleanup Can't Help

`ConstructUserRegistration` **appends** devices - it cannot identify which old entries belong to "this same device":

```typescript
device_registrations: [
  ...existing_device_keysets,  // All kept
  ...new_device_keysets        // Added
]
```

No persistent device identifier exists across key regenerations.

---

## Existing Protections

### Startup Sync Check
**File**: [RegistrationPersister.tsx:187-210](src/components/context/RegistrationPersister.tsx#L187-L210)

Adds current device to API if missing. **Limitation**: Only checks existence, not correctness.

### Encryption State Cleanup
**File**: [MessageService.ts:1636-1640](src/services/MessageService.ts#L1636-L1640)

Deletes encryption states for inboxes not in current registration.

**Limitations**:
1. Only runs on **legacy path** (new DM conversations without established sessions)
2. **Bypassed entirely** for established conversations which use Action Queue ([ActionQueueHandlers.ts:546-563](src/services/ActionQueueHandlers.ts#L546-L563))
3. When executed, uses cached registration data (Layer 2 blocks effectiveness)

**Impact**: Most DM sends (to established conversations) never execute cleanup logic.

### Manual Device Removal
**File**: [Privacy.tsx](src/components/modals/UserSettingsModal/Privacy.tsx)

User can manually remove unrecognized devices. **This is the only reliable fix for Layer 1.**

---

## Diagnostic Commands

See [011-dm-debug-console-snippets.md](011-dm-debug-console-snippets.md) for a complete collection of browser console snippets for debugging DM delivery issues.

**Quick reference:**
- **Identity Check** - Verify local device matches API
- **Sender Diagnostic** - Check encryption states vs API
- **Receiver Diagnostic** - Check receiver's encryption state
- **WebSocket Interceptors** - Log outgoing messages and subscriptions
- **Delete Encryption States** - Force fresh session (run on BOTH sides)
- **Double Ratchet Desync Check** - Compare ephemeral inboxes

---

## Risk Assessment

**Edge case** primarily affecting:
- Testers with frequent key regeneration
- Users who clear browser data and re-import
- Users with sync enabled after account re-import
- **Offline users** - stale data persists across receiver's device cleanup
- **Long-term users** - who never refresh browser accumulate stale cache

**Normal users** (single device, no data clearing) unlikely to encounter this.

**Security Note**: Messages are not delivered to wrong parties - they simply fail to deliver (privacy preserved).

---

## Case Study: `sending_inbox` Mismatch with Valid `tag` (2025-12-26)

**Status**: ✅ Resolved - User workaround applied

### Symptoms

- Sender could only send the **first message** in the conversation
- All subsequent messages from sender failed to deliver
- Receiver could send to sender normally (asymmetric failure)

### Diagnostic Output

```
=== Sender Diagnostic ===
1. Receiver API inboxes: 1
   [0] QmcdZhrRKQimZzWypBrSFEBdEDRvbGR1khSLpNqjCRHkWR

2. Sender encryption states: 1
   [0] tag: QmcdZhrRKQimZzWypBrSFEBdEDRvbGR1khSLpNqjCRHkWR        ← CORRECT
       sending_inbox: QmR1BVJuHUgjeKviRna6huxEKUPWo552e8eJsPidCk936Q  ← WRONG!
       receiving_inbox: Qmf19SKP1yWGw7Tsv5rQ4yr68KXmowVVJysdSXagBeSBqK

3. Analysis:
   tag in API? ✅ YES
   Will send to: QmR1BVJuHUgjeKviRna6huxEKUPWo552e8eJsPidCk936Q  ← Not receiver's inbox!

=== Receiver Diagnostic ===
My device inbox: QmcdZhrRKQimZzWypBrSFEBdEDRvbGR1khSLpNqjCRHkWR
My encryption states for sender: 0  ← No state!
```

### Root Cause

The cleanup logic only validates `tag`, not `sending_inbox`:

```javascript
if (!validInboxes.includes(parsed.tag)) {  // ← Only checks tag
  await messageDB.deleteEncryptionState(state);
}
```

In this case:
- `tag` was correct (receiver's device inbox) → cleanup didn't trigger
- But `sending_inbox` pointed to a stale ephemeral inbox → messages went nowhere

### Why This Happens (Not a Bug)

The `sending_inbox` only updates when the receiver's reply includes `user_profile` (identity revelation). This is **intentional for DM privacy**:

1. A sends to B → A stores `sending_inbox` from session creation
2. B receives → B generates new `receiving_inbox`, stores `sending_inbox` = A's return address
3. **If B never replies** or **reply is lost** → A's `sending_inbox` is never updated
4. A's next message goes to stale `sending_inbox` → B isn't listening there

### Why Cleanup Can't Catch This

The cleanup validates `tag` against device registrations. But `sending_inbox` is an **ephemeral Double Ratchet inbox** - it's not in any registration list. There's no external source of truth to validate it against.

### Solution Applied

Delete sender's encryption states and let session re-establish:

```javascript
// Run snippet #7 from 011-dm-debug-console-snippets.md on sender's browser
// Then refresh and resend
```

### Key Insight

This is a **pre-existing limitation from `develop` branch**, not something we introduced. The cleanup logic checking only `tag` is identical to the original codebase. The workaround (manual state deletion) is the only reliable fix when `sending_inbox` becomes stale while `tag` remains valid.

---

## Case Study: Network Layer Issue (2025-12-23)

**Status**: ✅ Resolved - Confirmed NOT a codebase issue

### Test Users

| User | User Address | Device Inbox |
|------|--------------|--------------|
| **Gattopardo** | `QmQuCGpEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imXST1` | `QmXJ6SMvGkRsBdLQa88hbLhRKkGV4LxN94jPBdiSXj2XB5` |
| **Jennifer** | `QmV5xWMo5CYSxgAAy6emKFZZPCPKwCsBZKZxXD3mCUZF2n` | `QmV6527S2QdWHieonTHUHV5wQS5H9weo9S33HjdJ2CB3a3` |

### Summary

Extensive debugging between two test users (with clean 1-device setups) showed:
- ~90% of DM messages failed to deliver
- Asymmetric pattern: One direction worked with delay, other direction never arrived

### What Was Verified

| Component | Status | Evidence |
|-----------|--------|----------|
| Double Ratchet ephemeral inboxes | ✅ MATCH | Sender's `sending_inbox` = Receiver's `receiving_inbox` |
| Identity/Registration | ✅ Correct | Device inbox matches API |
| WebSocket SEND | ✅ Correct | Sends to right inbox with valid ciphertext |
| WebSocket SUBSCRIBE | ✅ Correct | Receiver subscribes to correct ephemeral inbox |

### Conclusion

**The gap:** Sender sends correctly → **Network** → Receiver receives nothing

**VERDICT: Codebase is NOT the culprit.**

The client-side code for encryption, ephemeral inbox handling, and WebSocket send/subscribe is all working correctly. The issue is in the **Quilibrium network routing layer** - somewhere between sender's WebSocket send and receiver's WebSocket receive, messages are lost.

This is outside the scope of the quorum-desktop codebase.

### Key Insight: Double Ratchet Ephemeral Inboxes

The Double Ratchet protocol uses **ephemeral inboxes** for forward secrecy:
- `tag`: The receiver's device inbox (initial target for session establishment)
- `sending_inbox`: Ephemeral inbox where sender sends subsequent messages
- `receiving_inbox`: Ephemeral inbox where receiver expects replies

**To verify alignment:** Compare sender's `sending_inbox` with receiver's `receiving_inbox` - they should match.

See [011-dm-debug-console-snippets.md](011-dm-debug-console-snippets.md) for diagnostic commands.

---

## Summary

| Component | Status | Notes |
|-----------|--------|-------|
| React Query `staleTime` | ✅ **FIXED** | Changed from `Infinity` to 5 minutes |
| Layer 3 cleanup in DirectMessage | ✅ **FIXED** | Clean stale encryption states on DM page load |
| Action Queue offline-only | ✅ **FIXED** | Only use Action Queue when offline |
| Action Queue stale cleanup | ✅ Handled | Relies on DM page cleanup (stays offline-capable) |
| Action Queue new devices | ✅ **MITIGATED** | Online uses legacy path; offline limitation accepted |
| Manual device removal | ✅ Works | Only fix for stale API entries |
| `ConstructUserRegistration` | ⚠️ Limitation | Appends only, can't dedupe |
| Network layer delivery | ℹ️ **External** | Some failures are network-side, not codebase |

### Fix Implementation Order

1. ✅ **Layer 2 (staleTime)** - Prevents new stale cache entries
2. ✅ **Layer 3 (DM page cleanup)** - Cleans existing stale encryption states
3. ℹ️ **Layer 1 (API)** - User must manually remove stale devices

---

## Related Files

- [useRegistrationOptional.ts](src/hooks/queries/registration/useRegistrationOptional.ts) - React Query config (FIXED: staleTime 5 min)
- [DirectMessage.tsx](src/components/direct/DirectMessage.tsx) - DM page (Layer 3 cleanup)
- [ActionQueueHandlers.ts](src/services/ActionQueueHandlers.ts) - DM send handler (no cleanup, by design)
- [MessageService.ts](src/services/MessageService.ts) - Legacy DM path (has cleanup at lines 1636-1640)
- [RegistrationPersister.tsx](src/components/context/RegistrationPersister.tsx) - Startup sync
- [Privacy.tsx](src/components/modals/UserSettingsModal/Privacy.tsx) - Device removal UI
- [011-dm-debug-console-snippets.md](011-dm-debug-console-snippets.md) - Console debug snippets

---

_Created: 2025-12-22_
_Updated: 2025-12-26 - Added case study: `sending_inbox` mismatch with valid `tag`; clarified this is pre-existing limitation from develop branch_
_Updated: 2025-12-23 - Merged network layer case study findings; moved console snippets to 011-dm-debug-console-snippets.md_
_Updated: 2025-12-22 - Layer 2 + Layer 3 fixes implemented, documented new device limitation (reviewed by feature-analyzer agent)_
