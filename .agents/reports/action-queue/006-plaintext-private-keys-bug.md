# 006: Action Queue Stores Identity Keys in Plaintext

> **AI-Generated**: May contain errors. Verify before use.

**Severity**: Critical (passkey users) / High (fallback mode users)
**Type**: Security Regression
**Status**: Open
**Classification**: `action-queue-bug` - New vulnerability introduced by Action Queue
**Created**: 2025-12-20
**Updated**: 2025-12-20
**Discovered During**: DM offline registration persistence analysis
**Fix**: See [007-plaintext-private-keys-fix.md](007-plaintext-private-keys-fix.md)

---

## TL;DR

The SDK encrypts DeviceKeyset and UserKeyset at IndexedDB id=2 using AES-GCM. The action queue stores the **exact same keys** in plaintext, bypassing this encryption.

**Root cause**: When converting from memory-only queue to persistent queue, we serialized everything the handlers needed - including keys that should only exist in memory.

**Fix**: Don't store keys at all. The queue waits for auth, then pulls keyset from service state at processing time.

---

## Symptoms

The action queue (`action_queue` IndexedDB store) persists sensitive cryptographic material in plaintext, including:

1. **User's private keys** (DeviceKeyset, UserKeyset)
2. **Counterparty registration data** (public keys, inbox addresses)
3. **Message content** (signed but unencrypted at rest)
4. **User identity** (display name, profile picture URL)

This data is stored in plaintext and persists until the queued action completes.

---

## Evidence

### 1. SDK Type Definitions Confirm Private Keys

From `node_modules/@quilibrium/quilibrium-js-sdk-channels/dist/channel/channel.d.ts`:

```typescript
export type DeviceKeyset = {
    identity_key: X448Keypair;      // Contains private_key
    pre_key: X448Keypair;           // Contains private_key
    inbox_keyset: InboxKeyset;      // Contains multiple private_keys
};

export type UserKeyset = {
    user_key: Ed448Keypair;   // Contains private_key
    peer_key: X448Keypair;    // Contains private_key
};
```

### 2. Action Queue Handler Receives Full Keysets

From `src/services/ActionQueueHandlers.ts:504-511`:

```typescript
const keyset = context.keyset as {
    deviceKeyset: secureChannel.DeviceKeyset;  // Contains 4+ private keys
    userKeyset: secureChannel.UserKeyset;       // Contains 2 private keys
};
```

### 3. Context Stored as Plaintext in IndexedDB

From `src/types/actionQueue.ts:34-41`:

```typescript
export interface QueueTask {
  id?: number;
  taskType: ActionType;
  context: Record<string, unknown>;  // <-- Stored as plaintext JSON
  // ...
}
```

### 4. Affected Action Types

| Action Type | Private Keys Stored | Location |
|-------------|---------------------|----------|
| `send-dm` | DeviceKeyset + UserKeyset | `ActionQueueHandlers.ts:501-620` |
| `reaction-dm` | DeviceKeyset + UserKeyset | `ActionQueueHandlers.ts:897-940` |
| `delete-dm` | DeviceKeyset + UserKeyset | `ActionQueueHandlers.ts:941-990` |
| `edit-dm` | DeviceKeyset + UserKeyset | `ActionQueueHandlers.ts:991-1040` |
| `save-user-config` | keyset (full) | `ActionQueueHandlers.ts:62-66` |
| `kick-user` | user_keyset + device_keyset | `useUserKicking.ts:40-48` |

---

## Root Cause

The action queue was converted from a memory-only queue (`useRef`) to a persistent queue (IndexedDB) to enable offline support. During this conversion, everything the handlers needed was serialized to the `context` field - including private keys.

**The mistake**: Treating "what the handler needs" as "what must be stored". The keyset is always available in memory after auth - it doesn't need to be persisted.

---

## Threat Model

| Adversary | Access Method | Impact |
|-----------|---------------|--------|
| Malware on device | Direct IndexedDB access | **Critical** - full key extraction |
| Physical access | Copy IndexedDB files | **Critical** - offline key extraction |
| Malicious browser extension | IndexedDB API | **Critical** - runtime key extraction |
| Forensic analysis | Device backup/image | **Critical** - historical key recovery |
| Cloud backup sync | iCloud/Google Drive backup | **High** - cloud-based key extraction |

---

## Why This Is a Regression

### Before Action Queue (Memory-Only)

```typescript
// WebsocketProvider.tsx - MEMORY-ONLY queue
const outboundQueue = useRef<OutboundMessage[]>([]);

// OutboundMessage is a CLOSURE that captures keyset
type OutboundMessage = () => Promise<string[]>;
```

- Keysets captured in closures (memory only)
- Page refresh = queue lost, **keys never written to disk**
- No IndexedDB storage of private keys

### After Action Queue (Persistent)

```typescript
// ActionQueueService.ts - PERSISTENT queue
const task: QueueTask = {
  context: { keyset, ... },  // Serialized to IndexedDB!
};
await this.messageDB.addQueueTask(task);
```

- Keysets serialized to JSON for persistence
- Keys survive page refresh (the feature goal)
- But now **extractable from disk**

---

## SDK Already Encrypts These Keys

The SDK encrypts `{identity, device}` at IndexedDB KeyDB id=2 using AES-GCM. The action queue stores the **exact same data** in plaintext, bypassing the SDK's security model.

| Storage | Data | Encrypted? |
|---------|------|-----------|
| `IndexedDB KeyDB id=2` | DeviceKeyset + UserKeyset | Yes (AES-GCM) |
| `action_queue` context | DeviceKeyset + UserKeyset | **NO - PLAINTEXT** |

---

## Solution

**Don't store keys at all.**

The keyset is always available in memory after passkey auth. The queue can simply wait for auth to complete, then pull the keyset from service state at processing time.

The queue already has gating patterns (waits for `setHandlers()`). We add a similar gate for `setUserKeyset()`.

See: [007-plaintext-private-keys-fix.md](007-plaintext-private-keys-fix.md)

---

## Lesson Learned

**Don't store what you don't need to store.**

When serializing data to persistence:
1. Ask: "Does this data NEED to be persisted, or can it be retrieved from an already-authenticated context?"
2. Ask: "If this data is already stored encrypted elsewhere, am I bypassing that encryption?"

This lesson has been added to the `feature-analyzer` agent instructions.

---

## Related

- **Fix**: [007-plaintext-private-keys-fix.md](007-plaintext-private-keys-fix.md)
- **Old report**: [006-plaintext-private-keys-bug-old.md](006-plaintext-private-keys-bug-old.md)
- **Doc**: [Action Queue Feature](../../docs/features/action-queue.md)

---

_Created: 2025-12-20_
_Last Updated: 2025-12-20_
