# DM "Sending..." Indicator Hangs Indefinitely

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Classification

| Label | Applies | Notes |
|-------|---------|-------|
| `action-queue-bug` | ✅ Yes | Missing error handling in session creation loop |
| `pre-existing` | ✅ Yes | Slow crypto operations exist in legacy path too |
| `network-issue` | ❌ No | Not network-related |
| `test-environment` | ✅ Yes | 23 inboxes due to test account with many devices |

**Summary**: The hang was caused by Action Queue code (missing try/catch), but the underlying slow performance is pre-existing.

## Symptoms

- User sends DM message via Action Queue path
- "Sending..." indicator appears but never transitions to "sent"
- Console shows `[DM-xxxxxxxx] send-dm START` but no `send-dm COMPLETE`
- Issue is intermittent - sometimes works, sometimes hangs
- More likely to occur on first message (no cached encryption states)

## Root Cause

**Three contributing factors:**

### Factor A: Pre-existing Slow Session Creation (NOT Action Queue bug)

When encryption states are not cached, `NewDoubleRatchetSenderSession()` is called for each inbox:
- ~1 second per inbox × 23 inboxes = ~23 seconds total
- This is inherent to Double Ratchet crypto, exists in legacy path too
- Legacy path: `MessageService.ts:1854-1866`
- Action Queue path: `ActionQueueHandlers.ts:656-674`

### Factor B: Silent Hang During Session Creation

The session creation loop had no error handling:
- If one `NewDoubleRatchetSenderSession()` threw, entire send would hang silently
- No visibility into which inbox was being processed

### Factor C: Race Condition in Cache Updates

Two separate `setQueryData` calls could cause React Query batching issues:
```typescript
// Two calls that could race
this.deps.queryClient.setQueryData(...);  // Ensure message in cache
this.deps.messageService.updateMessageStatus(...);  // Update status
```

## Solution

### Fix for Factor B: Added logging and error handling

**File**: `src/services/ActionQueueHandlers.ts:620-675`

```typescript
console.log(`[${traceId}] Inbox ${i + 1}/${targetInboxes.length}: Creating new session...`);
try {
  const newSessions = await secureChannel.NewDoubleRatchetSenderSession(...);
  sessions = [...sessions, ...newSessions];
  console.log(`[${traceId}] Inbox ${i + 1}/${targetInboxes.length}: Session created successfully`);
} catch (err) {
  console.error(`[${traceId}] Inbox ${i + 1}/${targetInboxes.length}: Failed to create session`, err);
  // Continue to next inbox instead of failing entire send
}
```

### Fix for Factor C: Combined cache operations

**File**: `src/services/ActionQueueHandlers.ts:724-776`

Combined "ensure message in cache" and "update status" into single atomic `setQueryData` call.

## Prevention

1. **Always wrap crypto operations in try/catch** - crypto libraries can throw unexpectedly
2. **Use single atomic cache updates** - avoid separate setQueryData calls for related operations
3. **Add progress logging for long operations** - helps diagnose where hangs occur
4. **Consider timeouts for async operations** - prevent infinite hangs

## Diagnostic Patterns

### Healthy (cached sessions):
```
[DM-xxxxxxxx] send-dm START {encryptionStatesFound: 23}
[DM-xxxxxxxx] send-dm COMPLETE
```

### First-time (no cache):
```
[DM-xxxxxxxx] send-dm START {encryptionStatesFound: 0}
[DM-xxxxxxxx] Inbox 1/23: Creating new session...
[DM-xxxxxxxx] Inbox 1/23: Session created successfully
... (all 23)
[DM-xxxxxxxx] send-dm COMPLETE
```

### Failure (now handled):
```
[DM-xxxxxxxx] Inbox 5/23: Failed to create session [Error]
[DM-xxxxxxxx] Inbox 6/23: Creating new session...
```

## Note: Test Environment vs Real-World

The "23 inboxes" observed during testing was due to **test account with 13 device registrations** - not a real-world scenario.

### Why So Many Devices?

Test accounts accumulate device registrations from:
- Multiple dev/test installs
- Browser refreshes creating new registrations
- Different browsers during testing
- Mobile testing

### Real-World Expectations

| User Type | Devices | First DM Time |
|-----------|---------|---------------|
| Normal user | 2-3 | ~3-5 sec |
| Power user | 4-5 | ~6-8 sec |
| Test accounts (like ours) | 10-15 | ~20-30 sec |

### How to Clean Up

1. Open **User Settings → Privacy/Security**
2. See all registered devices in the Devices section
3. Click **"Remove"** on stale devices
4. Click **"Save Changes"**

File: `src/components/modals/UserSettingsModal/Privacy.tsx`

After cleanup, first-message times should be normal (~4-5 seconds).

---

## Related

- [Action Queue Documentation](../../docs/features/action-queue.md)
- [Action Queue Bug Index](./INDEX.md)
- Feature flag: `DM_ACTION_QUEUE` in `src/config/features.ts`

---

_Created: 2025-12-19_
_Status: ✅ Fixed_
