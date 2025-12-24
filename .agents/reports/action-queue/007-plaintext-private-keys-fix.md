# 007: Fix - Don't Store Keys in Action Queue

> **AI-Generated**: May contain errors. Verify before use.

**Related Bug**: [006-plaintext-private-keys-bug.md](006-plaintext-private-keys-bug.md)
**Effort**: ~30 lines of code
**Risk**: Low
**Approach**: Wait for auth, pull keyset from service state - no keys stored

---

## Summary

Remove keyset from queue context entirely. The queue waits for auth to complete, then handlers pull keyset from service state at processing time.

This is simpler and more secure than the original proposal (encrypting stored keys).

---

## Why This Works

1. **Auth always happens on app open** - the user must authenticate to use the app
2. **Keyset is in memory after auth** - available in React state (`MessageDB.tsx`)
3. **Queue already has gating** - waits for `setHandlers()` before processing
4. **Just add one more gate** - `setUserKeyset()` after auth

```
App opens
    ↓
Passkey auth (already happens)
    ↓
setKeyset() in MessageDB (already happens)
    ↓
actionQueueService.setUserKeyset(keyset)  ← NEW
    ↓
Queue starts processing (pulls keyset from service)
```

**No extra prompts. No UX change. Keys never on disk.**

---

## Scenarios

| Scenario | Behavior |
|----------|----------|
| User online, sends DM | Queued without keys, processed immediately (keyset in memory) |
| User goes offline, sends DM | Queued without keys, waits for online |
| User comes back online | Processed (keyset still in memory from earlier auth) |
| User closes app while offline | Queue persists, keys don't |
| User reopens app | Auth happens, keyset in memory, queue processes |
| Auth fails/cancelled | Queue waits (correct - can't process without keys) |

---

## Files to Modify

1. **`src/services/ActionQueueService.ts`** - Add `setUserKeyset()` and keyset gate
2. **`src/services/ActionQueueHandlers.ts`** - Pull keyset from deps, not context
3. **`src/components/context/MessageDB.tsx`** - Wire up `setUserKeyset()` after auth
4. **Enqueue call sites** - Remove keyset from context

---

## Implementation

### 1. ActionQueueService - Add Keyset Gate

```typescript
// ActionQueueService.ts

private userKeyset: {
  deviceKeyset: DeviceKeyset;
  userKeyset: UserKeyset;
} | null = null;

/**
 * Set keyset after passkey auth completes.
 * Queue waits for this before processing tasks that need keys.
 */
setUserKeyset(keyset: { deviceKeyset: DeviceKeyset; userKeyset: UserKeyset }): void {
  this.userKeyset = keyset;
}

getUserKeyset(): { deviceKeyset: DeviceKeyset; userKeyset: UserKeyset } | null {
  return this.userKeyset;
}

clearUserKeyset(): void {
  this.userKeyset = null;
}
```

### 2. ActionQueueService - Gate in processQueue()

```typescript
async processQueue(): Promise<void> {
  if (this.isProcessing) return;
  if (!this.isOnline()) return;
  if (!this.handlers) return;

  // NEW: Wait for keyset for tasks that need it
  // (Could be more granular - only gate DM/config/kick tasks)
  if (!this.userKeyset) {
    return;  // Auth not complete yet
  }

  // ... rest of processing
}
```

### 3. ActionQueueHandlers - Pull from Deps

```typescript
// Before
const keyset = context.keyset as { deviceKeyset, userKeyset };

// After
const keyset = this.deps.actionQueueService.getUserKeyset();
if (!keyset) {
  throw new Error('Keyset not available');
}
```

Update all 6 affected handlers:
- `send-dm` (line ~508)
- `reaction-dm` (line ~913)
- `delete-dm` (line ~957)
- `edit-dm` (line ~1009)
- `save-user-config` (line ~64)
- `kick-user` (line ~123)

### 4. Wire Up After Auth

```typescript
// In MessageDB.tsx, after setKeyset()
useEffect(() => {
  if (keyset.userKeyset && keyset.deviceKeyset) {
    actionQueueService.setUserKeyset(keyset);
  }
}, [keyset]);
```

Or in `RegistrationPersister.tsx` right after `setKeyset()`:

```typescript
setKeyset({ deviceKeyset: senderDevice, userKeyset: senderIdent });
actionQueueService.setUserKeyset({
  deviceKeyset: senderDevice,
  userKeyset: senderIdent
});
```

### 5. Remove Keyset from Enqueue Calls

Update all enqueue call sites to not include keyset in context:

**DM actions** (`MessageService.ts`, `useMessageActions.ts`, etc.):
```typescript
// Before
context: { signedMessage, self, counterparty, keyset, ... }

// After
context: { signedMessage, self, counterparty, ... }  // No keyset
```

**save-user-config** (`useUserSettings.ts`, etc.):
```typescript
// Before
context: { config, keyset }

// After
context: { config }  // No keyset
```

**kick-user** (`useUserKicking.ts`):
```typescript
// Before
context: { spaceId, userAddress, user_keyset, device_keyset, registration }

// After
context: { spaceId, userAddress, registration }  // No keysets
```

---

## Web Worker Compatibility

If we add a web worker later, this approach still works:

```
Main thread: passkey auth → keyset in memory
Main thread: postMessage({ type: 'setKeyset', keyset }) → Worker
Worker: Stores keyset in its own memory, processes queue
```

No keys on disk either way.

---

## Verification Checklist

- [ ] TypeScript compiles: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
- [ ] Inspect IndexedDB in DevTools - confirm no `keyset` in `action_queue` tasks
- [ ] DM sending works (online)
- [ ] DM sending works (offline → online)
- [ ] Config save works
- [ ] Kick user works
- [ ] App restart with pending queue tasks works
- [ ] Auth failure doesn't process queue (correct behavior)

---

## Comparison with Original Proposal

| Aspect | Original (encrypt keys) | New (don't store keys) |
|--------|------------------------|------------------------|
| Keys on disk | Yes (encrypted) | No |
| Code changes | ~50 lines | ~30 lines |
| Complexity | Add encryption utils | Just wiring |
| Web worker ready | Need to pass decryption key | Just postMessage keyset |
| Security model | Encrypted at rest | Not stored at all |

The new approach is simpler and more secure.

---

## Related

- **Bug**: [006-plaintext-private-keys-bug.md](006-plaintext-private-keys-bug.md)
- **Old fix proposal**: [007-plaintext-private-keys-fix-old.md](007-plaintext-private-keys-fix-old.md)
- **Doc**: [Action Queue Feature](../../docs/features/action-queue.md)

---

_Created: 2025-12-20_
_Last Updated: 2025-12-20_
