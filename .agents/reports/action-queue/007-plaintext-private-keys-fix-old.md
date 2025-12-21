# 007: Fix - Encrypt Action Queue Context

> **AI-Generated**: May contain errors. Verify before use.

**Related Bug**: [006-plaintext-private-keys-bug.md](006-plaintext-private-keys-bug.md)
**Effort**: ~50 lines of code
**Risk**: Low
**Pattern**: Already exists in codebase (`ConfigService.ts`)

---

## Summary

Encrypt the `context` field in `QueueTask` before storing to IndexedDB. Only 6 of 17 action types contain private keys and require encryption.

---

## Files to Modify

1. **`src/utils/encryption.ts`** - New shared utility (or add to existing)
2. **`src/services/ActionQueueService.ts`** - Add encrypt/decrypt + `setUserKeyset()`
3. **`src/types/actionQueue.ts`** - Update interface
4. **`src/components/context/RegistrationPersister.tsx`** - Wire up `setUserKeyset()`

---

## Task Types by Security Requirement

| Task Type | Has `keyset` in context? | Contains private keys? | Needs encryption? |
|-----------|--------------------------|------------------------|-------------------|
| **DM Tasks (Double Ratchet)** | | | |
| `send-dm` | ✅ Yes (`keyset`) | ✅ **YES** - DeviceKeyset + UserKeyset | **CRITICAL** |
| `reaction-dm` | ✅ Yes (via `dmActionContext`) | ✅ **YES** - DeviceKeyset + UserKeyset | **CRITICAL** |
| `delete-dm` | ✅ Yes (via `dmActionContext`) | ✅ **YES** - DeviceKeyset + UserKeyset | **CRITICAL** |
| `edit-dm` | ✅ Yes (via `dmActionContext`) | ✅ **YES** - DeviceKeyset + UserKeyset | **CRITICAL** |
| **Config/Settings** | | | |
| `save-user-config` | ✅ Yes (`keyset`) | ✅ **YES** - Full keyset | **CRITICAL** |
| **Moderation (Space)** | | | |
| `kick-user` | ✅ Yes (`user_keyset`, `device_keyset`) | ✅ **YES** - Both keysets | **CRITICAL** |
| `mute-user` | ❌ No (`currentPasskeyInfo`) | ❌ No (just address) | Optional |
| `unmute-user` | ❌ No (`currentPasskeyInfo`) | ❌ No (just address) | Optional |
| **Space Tasks (Triple Ratchet)** | | | |
| `send-channel-message` | ❌ No | ❌ No (signed message) | Optional |
| `reaction` | ❌ No (`currentPasskeyInfo`) | ❌ No (just address) | Optional |
| `pin-message` | ❌ No (`currentPasskeyInfo`) | ❌ No | Optional |
| `unpin-message` | ❌ No (`currentPasskeyInfo`) | ❌ No | Optional |
| `edit-message` | ❌ No (`currentPasskeyInfo`) | ❌ No | Optional |
| `delete-message` | ❌ No (`currentPasskeyInfo`) | ❌ No | Optional |
| `update-space` | ❌ No (just `spaceId`, `space`) | ❌ No | Optional |

**Summary**: 6 task types contain private keys and require encryption:
- `send-dm`, `reaction-dm`, `delete-dm`, `edit-dm` (DM actions)
- `save-user-config` (config sync)
- `kick-user` (moderation with key-based auth)

---

## Implementation

### 1. Encryption Utility

```typescript
// src/utils/encryption.ts (new shared utility)

import { UserKeyset } from '@quilibrium/quilibrium-js-sdk-channels';

// Cache the derived AES key for the tab lifecycle (performance optimization)
// Safe because userKeyset is already in React state for the entire tab lifecycle
let cachedAesKey: CryptoKey | null = null;

export async function getOrDeriveAesKey(userKey: UserKeyset): Promise<CryptoKey> {
  if (cachedAesKey) return cachedAesKey;

  const derived = await crypto.subtle.digest(
    'SHA-512',
    Buffer.from(new Uint8Array(userKey.user_key.private_key))
  );
  cachedAesKey = await crypto.subtle.importKey(
    'raw',
    derived.slice(0, 32),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  return cachedAesKey;
}

// Call on tab close or if user somehow logs out
export function clearCachedAesKey(): void {
  cachedAesKey = null;
}

export async function encryptContext(
  context: Record<string, unknown>,
  aesKey: CryptoKey
): Promise<{ encryptedContext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    Buffer.from(JSON.stringify(context), 'utf-8')
  );
  return {
    encryptedContext: Buffer.from(encrypted).toString('hex'),
    iv: Buffer.from(iv).toString('hex'),
  };
}

export async function decryptContext(
  encryptedContext: string,
  iv: string,
  aesKey: CryptoKey
): Promise<Record<string, unknown>> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(iv, 'hex') },
    aesKey,
    Buffer.from(encryptedContext, 'hex')
  );
  return JSON.parse(Buffer.from(decrypted).toString('utf-8'));
}
```

### 2. ActionQueueService Changes

```typescript
// ActionQueueService.ts - Add setUserKeyset() method

private userKeyset: UserKeyset | null = null;

/**
 * Set the user's keyset for encrypting/decrypting queue context.
 * Call this after passkey auth completes (same place as MessageDB.setKeyset).
 */
setUserKeyset(keyset: UserKeyset): void {
  this.userKeyset = keyset;
  // Also cache the derived AES key for performance
  getOrDeriveAesKey(keyset).catch(() => {});
}

clearUserKeyset(): void {
  this.userKeyset = null;
  clearCachedAesKey();
}
```

**Why `setUserKeyset()` is needed**: On `processTask`, the context is encrypted - we can't read `keyset` from it to decrypt! The `setUserKeyset()` approach:
- Follows existing patterns (`setHandlers()`, `setIsOnlineCallback()`)
- Single source of truth for the keyset
- Works for both enqueue and process
- Integrates with AES key caching

### 3. On Enqueue

```typescript
async enqueue(type: ActionType, context: Record<string, unknown>, key: string) {
  // Extract userKeyset from context - different field names for different task types:
  // - DM tasks, save-user-config: context.keyset.userKeyset
  // - kick-user: context.user_keyset (direct UserKeyset)
  const keyset = context.keyset as { userKeyset: UserKeyset } | undefined;
  const userKeyset = keyset?.userKeyset ?? (context.user_keyset as UserKeyset | undefined);

  let taskToStore: QueueTask;

  if (userKeyset) {
    // Tasks with private keys - MUST encrypt
    const aesKey = await getOrDeriveAesKey(userKeyset);
    const { encryptedContext, iv } = await encryptContext(context, aesKey);
    taskToStore = { ...task, encryptedContext, iv, context: undefined };
  } else {
    // Space tasks (mute/unmute, reactions, pins, etc.) - no private keys, store as-is
    taskToStore = { ...task, context, encryptedContext: undefined, iv: undefined };
  }

  // ... store taskToStore
}
```

### 4. On Process

```typescript
async processTask(task: QueueTask) {
  let context: Record<string, unknown>;

  if (task.encryptedContext && task.iv) {
    // Encrypted task - need to decrypt
    if (!this.userKeyset) {
      throw new Error('ActionQueueService: userKeyset not set, cannot decrypt task');
    }
    const aesKey = await getOrDeriveAesKey(this.userKeyset);
    context = await decryptContext(task.encryptedContext, task.iv, aesKey);
  } else {
    // Unencrypted Space task
    context = task.context!;
  }

  // ... pass context to handler
}
```

### 5. Wire Up in Context

```typescript
// In RegistrationPersister.tsx or MessageDB context, after passkey auth:
setKeyset({ deviceKeyset, userKeyset });  // existing
actionQueueService.setUserKeyset(userKeyset);  // new - add this
```

---

## Updated Interface

```typescript
// src/types/actionQueue.ts

export interface QueueTask {
  id?: number;
  taskType: ActionType;

  // For encrypted tasks (DM, config, kick) - mutually exclusive with context
  encryptedContext?: string;  // AES-GCM encrypted
  iv?: string;                // 12-byte IV

  // For unencrypted tasks (Space) - mutually exclusive with encryptedContext
  context?: Record<string, unknown>;

  key: string;
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: number;
  createdAt: number;
  processedAt?: number;
  processingStartedAt?: number;
  error?: string;
}
```

---

## Why This Works

- **Keys already in memory**: After app open, `userKeyset` is in React state for the entire tab lifecycle
- **No UX change**: No additional prompts or auth required
- **Consistent pattern**: Matches `ConfigService.ts` encryption approach
- **True protection for passkey users**: AES key derived from hardware-backed Ed448
- **No performance impact**: Key derived once per tab, cached for all subsequent operations
- **Selective encryption**: Only encrypts tasks that actually contain private keys

---

## Performance Note

The AES key is cached in memory for the tab lifecycle. This is safe because:
- The source `userKeyset` is already stored in React state (`MessageDB.tsx`) for the entire tab
- An attacker who can read the cached AES key can also read the source private key
- Key derivation (~1ms) only happens once per tab, not per action

---

## Verification Checklist

- [ ] TypeScript compiles: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
- [ ] Inspect IndexedDB in DevTools - confirm no plaintext keys in `action_queue`
- [ ] DM sending still works
- [ ] Config save still works
- [ ] Kick user still works
- [ ] Space messages work (unencrypted path)
- [ ] App restart doesn't break queue processing

---

## Related

- **Bug**: [006-plaintext-private-keys-bug.md](006-plaintext-private-keys-bug.md)
- **Existing Pattern**: `src/services/ConfigService.ts` - encryption for config sync
- **Doc**: [Action Queue Feature](../../docs/features/action-queue.md)

---

_Created: 2025-12-20_
_Last Updated: 2025-12-20_
