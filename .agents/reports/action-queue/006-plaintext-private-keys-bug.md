# 006: Action Queue Stores Identity Keys in Plaintext

> **AI-Generated**: May contain errors. Verify before use.

**Severity**: Critical (passkey users) / High (fallback mode users)
**Type**: Security Regression
**Status**: Open
**Classification**: `action-queue-bug` - New vulnerability introduced by Action Queue
**Created**: 2025-12-20
**Discovered During**: DM offline registration persistence analysis
**Fix**: See [007-plaintext-private-keys-fix.md](007-plaintext-private-keys-fix.md)

---

## TL;DR

The SDK encrypts DeviceKeyset and UserKeyset at IndexedDB id=2 using AES-GCM. The action queue stores the **exact same keys** in plaintext, bypassing this encryption.

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
export type Ed448Keypair = {
    type: 'ed448';
    public_key: number[];
    private_key: number[];  // <-- PRIVATE KEY
};

export type X448Keypair = {
    type: 'x448';
    public_key: number[];
    private_key: number[];  // <-- PRIVATE KEY
};

export type DeviceKeyset = {
    identity_key: X448Keypair;      // Contains private_key
    pre_key: X448Keypair;           // Contains private_key
    inbox_keyset: InboxKeyset;      // Contains multiple private_keys
};

export type InboxKeyset = {
    inbox_address: string;
    inbox_key: Ed448Keypair;           // Contains private_key
    inbox_encryption_key: X448Keypair; // Contains private_key
};

export type UserKeyset = {
    user_key: Ed448Keypair;   // Contains private_key
    peer_key: X448Keypair;    // Contains private_key
};
```

### 2. Action Queue Handler Receives Full Keysets

From `src/services/ActionQueueHandlers.ts:504-511`:

```typescript
const signedMessage = context.signedMessage as Message;
const messageId = context.messageId as string;
const self = context.self as secureChannel.UserRegistration;
const counterparty = context.counterparty as secureChannel.UserRegistration;
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

  // Plaintext context - browser sandbox provides sufficient isolation
  // See "Why No Encryption-at-Rest?" in task doc
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

The action queue was designed with the assumption that browser sandbox provides sufficient isolation (per comment in `actionQueue.ts`). However:

1. **IndexedDB is not encrypted** - data is stored as plaintext JSON
2. **Electron apps have file system access** - IndexedDB files are in `%APPDATA%` (Windows) or `~/Library/Application Support/` (macOS)
3. **No TTL or cleanup** - queued actions with private keys can persist indefinitely if they fail
4. **Private keys are the crown jewels** - they enable:
   - Impersonation of the user
   - Decryption of past and future messages
   - Signing messages as the user

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

## Comparison with Other Stores

| Store | Contains | Encrypted | Risk |
|-------|----------|-----------|------|
| `space_keys` | Space private keys | No | High (but required for decryption) |
| `action_queue` | User's device/user private keys | No | **Critical** (identity theft) |
| `encryption_states` | Double Ratchet state | No | Medium (session keys) |
| Proposed `user_registrations` | Counterparty public keys | No (proposed) | Medium (social graph) |

The `action_queue` is arguably the **most sensitive** store because it contains the user's identity keys, not just session or space keys.

---

## Potential Solutions

### Option 1: Encrypt Context at Rest (Recommended)

Encrypt the `context` field using AES-GCM with a key derived from the user's private key.

**Good news**: This pattern already exists in the codebase! The `ConfigService.ts` already implements this exact approach for config sync:

```typescript
// From src/services/ConfigService.ts - EXISTING PATTERN

// 1. Key derivation (already implemented)
const derived = await crypto.subtle.digest(
  'SHA-512',
  Buffer.from(new Uint8Array(userKey.user_key.private_key))
);
const aesKey = derived.slice(0, 32);  // AES-256 key

// 2. AES-GCM encryption (already implemented)
const iv = crypto.getRandomValues(new Uint8Array(12));
const encrypted = await window.crypto.subtle.encrypt(
  { name: 'AES-GCM', iv: iv },
  subtleKey,
  Buffer.from(JSON.stringify(context), 'utf-8')
);
```

**Updated interface:**

```typescript
interface EncryptedQueueTask {
  id?: number;
  taskType: ActionType;
  encryptedContext: string;  // AES-GCM encrypted (hex)
  iv: string;                // 12-byte IV (hex)
  key: string;               // Key grouping (unencrypted for queue processing)
  // ... other metadata fields remain unencrypted
}
```

**Implementation approach:**

1. Extract encryption helpers from `ConfigService.ts` into shared utility
2. Encrypt `context` on queue insertion
3. Decrypt `context` on queue processing
4. Keys are already in memory after passkey auth - **no extra prompts needed**

**Pros**:
- Protects against all offline attacks
- Uses existing, tested encryption code
- No UX changes (keys in memory after passkey auth)
- Consistent with config sync security model

**Cons**:
- Adds ~50 lines of code
- Slightly slower queue operations (negligible)

### Option 2: Avoid Storing Private Keys in Queue

Redesign DM actions to not store full keysets:

1. Store only a reference to the keyset (e.g., keyset ID)
2. Retrieve keyset from passkey at processing time
3. Fail gracefully if keyset unavailable

**Pros**: Minimal private key exposure
**Cons**: Requires passkey presence at queue processing time, may break offline-first design

### Option 3: TTL + Secure Deletion

Add aggressive cleanup for queued actions containing keys:

1. Short TTL (e.g., 24 hours) for DM actions
2. Secure overwrite on completion/failure
3. Clear on app close if possible

**Pros**: Limits exposure window
**Cons**: Doesn't protect against immediate extraction, may lose messages

### Option 4: Accept the Risk (Current Approach)

Document that browser sandbox is the security boundary and accept the risk.

**Pros**: No implementation work
**Cons**: Unacceptable for a privacy-focused app, violates user expectations

---

## Questions for Lead Dev

1. **Is browser sandbox considered sufficient?** The current code comments suggest this was an intentional design decision. Is this still the accepted threat model?

2. **Should action queue match passkey security model?** The user's identity is protected by passkey. Should queued private keys have equivalent protection?

3. **What about Electron?** In Electron, IndexedDB is file-based with no additional encryption. Is this acceptable for desktop app?

4. **Consistency concern**: If we require encryption for `user_registrations` (public key metadata), shouldn't `action_queue` (private keys) have at least equivalent protection?

---

## Pre-existing Issues (Before Action Queue)

Analysis of the `develop` branch (original implementation before action queue) reveals that **similar security issues already existed**:

### 1. `space_keys` Store (Schema v2, develop branch)

Stores Space private keys in plaintext:

```typescript
// From develop:src/db/messages.ts
async saveSpaceKey(key: {
  spaceId: string;
  keyId: string;
  address?: string;
  publicKey: string;
  privateKey: string;  // <-- PLAINTEXT PRIVATE KEY
}): Promise<void>
```

**Risk**: Anyone with IndexedDB access can decrypt all Space messages.

### 2. `user_config` Store (Schema v2, develop branch)

Also stores Space keys in plaintext as part of user configuration:

```typescript
// From develop:src/db/messages.ts
export type UserConfig = {
  address: string;
  spaceIds: string[];
  // ...
  spaceKeys?: {
    spaceId: string;
    encryptionState: { /* ... */ };
    keys: {
      keyId: string;
      address?: string;
      publicKey: string;
      privateKey: string;  // <-- PLAINTEXT PRIVATE KEY
      spaceId: string;
    }[];
  }[];
};
```

**Risk**: Duplicate storage of Space private keys.

### 3. `encryption_states` Store (Schema v1, develop branch)

Stores Double Ratchet session state in plaintext:

```typescript
export interface EncryptionState {
  state: string;      // <-- Serialized ratchet state (contains session keys)
  timestamp: number;
  conversationId: string;
  inboxId: string;
  sentAccept?: boolean;
}
```

**Risk**: Session key extraction enables decryption of messages within that session.

### Summary: Action Queue DOES Introduce a New Problem

The action queue **bypasses existing encryption** that was designed to protect identity keys:

| Store | Contains | Encrypted? | Introduced |
|-------|----------|------------|------------|
| `IndexedDB KeyDB id=2` | DeviceKeyset + UserKeyset | ✅ **Yes (AES-GCM)** | develop (SDK) |
| `action_queue` | DeviceKeyset + UserKeyset | ❌ **No (plaintext)** | cross-platform |

The SDK specifically encrypts `{identity, device}` at IndexedDB id=2 using AES-GCM derived from the user's Ed448 key. The action queue stores the **exact same data** in plaintext.

**Key difference from other unencrypted stores**:

| Store | Key Type | Blast Radius |
|-------|----------|--------------|
| `space_keys` | Derived (per-space) | One space |
| `encryption_states` | Derived (per-session) | One conversation |
| `action_queue` | **Identity** | **Complete impersonation** |

### Conclusion

**This IS a bug introduced by the action queue**, not a pre-existing pattern:

1. The SDK encrypts identity keys at id=2 ✅
2. The action queue duplicates these keys in plaintext ❌
3. This bypasses the SDK's security model

**Recommended fix**: Encrypt the action queue context using the same pattern the SDK already uses.

---

## Proof: Pre-Action-Queue Architecture

Analysis of both `develop` branch and `cross-platform` branch (commit `5a2034d0`, December 17, 2025 - just before action queue) confirms that **identity keys were NEVER persisted to disk** before the action queue.

### Branch Comparison

| Branch | `action_queue` store | Queue mechanism | Keys persisted? |
|--------|---------------------|-----------------|-----------------|
| `develop` | ❌ None | `useRef` (memory) | ❌ No |
| `cross-platform` @ 5a2034d0 | ❌ None | `useRef` (memory) | ❌ No |
| `cross-platform` @ HEAD | ✅ IndexedDB | `action_queue` store | ⚠️ **Yes (plaintext)** |

Both `develop` and pre-action-queue `cross-platform` use **identical** memory-only queue implementations.

### Old Architecture: Memory-Only Queue

From `src/components/context/WebsocketProvider.tsx` (identical in both `develop` and pre-action-queue `cross-platform`):

```typescript
// MEMORY-ONLY queue using React useRef
const outboundQueue = useRef<OutboundMessage[]>([]);

// OutboundMessage is a CLOSURE that captures keyset
type OutboundMessage = () => Promise<string[]>;

const enqueueOutbound = (message: OutboundMessage) => {
  outboundQueue.current = [...outboundQueue.current, message];
  processQueue();
};
```

### Key Difference: Closure vs Serialization

| Aspect | Before Action Queue | After Action Queue |
|--------|---------------------|-------------------|
| Queue Storage | `useRef` (memory only) | IndexedDB (`action_queue` store) |
| Queue Persistence | ❌ Lost on page refresh | ✅ Survives page refresh |
| Private Keys | Captured in closure (memory) | Serialized to `context` field (plaintext JSON) |
| Offline Support | ❌ None (queue lost on refresh) | ✅ Full (but keys exposed) |
| Key Exposure Risk | **Low** (volatile, memory-only) | **Critical** (persistent, extractable) |

### Why This Matters

**Before action queue:**
- Keysets passed to `submitMessage()` were captured in JavaScript closures
- Closures lived only in memory (`useRef`)
- Page refresh = queue lost, **keys never written to disk**
- No IndexedDB storage of private keys whatsoever

**After action queue:**
- Keysets must be serialized to JSON for IndexedDB persistence
- Context (including full keysets) persisted to `action_queue` store
- Keys survive page refresh (the feature goal)
- But now **extractable from disk, backups, and forensic analysis**

### Conclusion

The action queue **introduced** plaintext identity key storage to enable offline support. This was not a pre-existing issue - it's a direct consequence of the persistence requirement.

The fix should encrypt the `context` field using the same AES-GCM pattern the SDK uses for `KeyDB id=2`.

---

## Critical Finding: SDK Already Encrypts These Keys

**The DeviceKeyset and UserKeyset ARE encrypted by the SDK** - but the action queue stores them in plaintext, bypassing the SDK's security model.

### How Keys Are Properly Stored (SDK)

From `src/components/context/RegistrationPersister.tsx:129-149`:

```typescript
// 1. Derive AES key from user's Ed448 private key
const key = await passkey.createKeyFromBuffer(user_key);

// 2. Encrypt the identity + device keysets (INNER encryption)
const inner = await passkey.encrypt(
  Buffer.from(
    JSON.stringify({
      identity: senderIdent,   // UserKeyset with private keys
      device: senderDevice,    // DeviceKeyset with private keys
    }),
    'utf-8'
  ),
  key  // ← Key derived from Ed448, which is in hardware for passkey users
);

// 3. Store as encrypted envelope at IndexedDB KeyDB id=2
const envelope = Buffer.from(
  JSON.stringify({
    iv: [...inner.iv],
    ciphertext: [...new Uint8Array(inner.ciphertext)],
  }),
  'utf-8'
);
await passkey.encryptDataSaveKey(2, envelope);  // Adds OUTER encryption layer
```

### Double-Encryption Structure at id=2

The `encryptDataSaveKey` function adds an **outer encryption layer** where the key is stored with the ciphertext. But the **inner layer** is encrypted with a key derived from Ed448:

```
IndexedDB KeyDB id=2:
┌─────────────────────────────────────────────────────────────────┐
│ OUTER LAYER (encryptDataSaveKey)                                │
│ keys: [AES key #1]  ← Stored here, anyone can decrypt outer     │
│ encrypted: {                                                    │
│   iv: [...],                                                    │
│   ciphertext: [                                                 │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ INNER LAYER (passkey.encrypt with Ed448-derived key)   │ │
│     │ {                                                       │ │
│     │   iv: [...],                                            │ │
│     │   ciphertext: [DeviceKeyset + UserKeyset]               │ │
│     │ }                                                       │ │
│     │ ↑ To decrypt this, you need the Ed448 private key      │ │
│     └─────────────────────────────────────────────────────────┘ │
│   ]                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**For true passkey users**: The Ed448 key is in hardware (WebAuthn) or PRF-encrypted. Even if you extract the outer layer from IndexedDB, you CANNOT decrypt the inner layer without biometric authentication.

**For fallback mode users**: The Ed448 key at id=1 is also stored with its encryption key, so both layers are breakable.

### SDK Key Storage Model

| Location | Contents | True Passkey Mode | Fallback Mode |
|----------|----------|-------------------|---------------|
| WebAuthn passkey | Ed448 root private key | ✅ Hardware-backed | N/A |
| `localStorage['quorum-master']` | Ed448 key (Chrome PRF) | ✅ PRF-encrypted | N/A |
| `IndexedDB KeyDB id=1` | Ed448 key (fallback) | N/A | ⚠️ Key with ciphertext |
| `IndexedDB KeyDB id=2` | DeviceKeyset + UserKeyset | ✅ **Inner layer protected by hardware** | ⚠️ Both layers breakable |

---

## Important Nuance: Fallback Mode Security

The app doesn't require authentication on every open. This is because of **fallback mode** used in Electron and browsers without passkey support.

### How Authentication Works

**True Passkey Mode (Safari with LargeBlob, Chrome with PRF):**
```
App opens → Biometric prompt → Hardware returns Ed448 key → Session starts
```
Keys are truly protected by hardware - extraction requires biometric.

**Fallback Mode (Electron, Firefox, older browsers):**
```
App opens → Read IndexedDB KeyDB id=1 → Decrypt with stored key → Session starts
           (no biometric prompt!)
```

### The Fallback Mode Problem

From `quilibrium-js-sdk-channels/src/passkeys/types.ts:65-71`:

```typescript
export async function encryptDataSaveKey(id: number, data: Buffer) {
  var keys = await makeKeys();           // Generate AES key
  var encrypted = await encrypt(data, keys);
  callOnStore((store: IDBObjectStore) => {
    store.put({ id: id, keys: keys, encrypted: encrypted });
    //                  ↑ KEY STORED WITH CIPHERTEXT!
  });
}
```

In fallback mode, IndexedDB KeyDB id=1 contains:
```typescript
{
  id: 1,
  keys: CryptoKey,        // ← AES key stored IN SAME RECORD
  encrypted: {
    iv: Uint8Array,
    ciphertext: ArrayBuffer  // ← Ed448 private key
  }
}
```

**The encryption key is stored alongside the ciphertext** - this is security by obscurity, not true protection.

### Impact on Severity Assessment

| User Type | Existing Protection | Action Queue Impact |
|-----------|--------------------|--------------------|
| **True passkey** (Safari, Chrome PRF) | ✅ Hardware-backed, requires biometric | **Critical regression** - bypasses hardware protection |
| **Fallback mode** (Electron, Firefox) | ⚠️ Obscured but accessible without auth | **Adds redundant exposure** - keys now in 2 places |

### Why Action Queue Is Still a Problem

Even in fallback mode where keys are already technically accessible:

1. **Redundant exposure**: Keys exist in KeyDB id=1/id=2 (obscured) AND action_queue (plaintext)
2. **Easier extraction**: Plaintext JSON is trivially readable vs needing to understand encryption structure
3. **Forensic persistence**: Failed queue tasks may persist indefinitely
4. **Backup exposure**: Cloud backups capture plaintext more easily than encrypted blobs

### Revised Severity

- **For true passkey users**: Action queue is a **Critical** security regression
- **For fallback mode users**: Action queue is a **High** security issue (adds plaintext exposure to already-weak protection)

The fix recommendation remains the same: encrypt the action queue context using AES-GCM derived from the user's key. This provides:
- True protection for passkey users
- Consistent obscurity for fallback users (matching existing pattern)

### The Action Queue Bypass

The action queue stores the **exact same data** that's encrypted at id=2, but in **plaintext**:

```typescript
// ActionQueueHandlers.ts - PLAINTEXT storage of encrypted data
const keyset = context.keyset as {
    deviceKeyset: secureChannel.DeviceKeyset,  // Same as encrypted id=2
    userKeyset: secureChannel.UserKeyset,      // Same as encrypted id=2
};
```

| Storage | Data | Encrypted? |
|---------|------|-----------|
| `IndexedDB KeyDB id=2` | DeviceKeyset + UserKeyset | ✅ Yes |
| `action_queue` context | DeviceKeyset + UserKeyset | ❌ **NO - PLAINTEXT** |

**This is a security regression** - the action queue bypasses the SDK's encryption that was specifically designed to protect these keys.

---

## Pre-existing Unencrypted Stores (Context)

While the action queue bypass is new, some other stores were already unencrypted in the `develop` branch. However, these contain **derived keys** (Space keys, session keys), not identity keys.

| Store | Contains | Encrypted? | Risk Level |
|-------|----------|------------|------------|
| `space_keys` | Space private keys | ❌ No | High (space-specific) |
| `user_config` (local) | Space keys, bookmarks | ❌ No | High (space-specific) |
| `encryption_states` | Session ratchet state | ❌ No | Medium (session-specific) |
| **`action_queue`** | **Identity keys** | ❌ No | **Critical (full identity)** |

### Key Hierarchy & Impact

```
Identity Keys (DeviceKeyset, UserKeyset)
    ↓ compromised = complete identity theft
    ↓
Space Keys (per-space)
    ↓ compromised = access to one space
    ↓
Session Keys (per-DM conversation)
    ↓ compromised = access to one conversation
```

The action queue is the **only store** that exposes identity-level keys in plaintext. All other unencrypted stores contain derived keys with limited blast radius.

### Implementation Leverage

The encryption code in `ConfigService.ts` can be extracted into a shared utility:

```typescript
// Proposed: src/utils/encryption.ts

export async function deriveAesKey(userPrivateKey: number[]): Promise<CryptoKey>;
export async function encryptData(data: unknown, key: CryptoKey): Promise<{encrypted: string, iv: string}>;
export async function decryptData(encrypted: string, iv: string, key: CryptoKey): Promise<unknown>;
```

This would enable consistent encryption across:
- Action queue context
- User registrations cache (proposed)
- Potentially other stores (space_keys, encryption_states)

---

## Impact Summary

**If exploited, an attacker can:**
- Impersonate the user completely
- Decrypt all past DM conversations
- Sign messages as the user
- Access all Spaces the user is a member of
- Map the user's entire social graph

This is not a minor metadata leak - it's a complete identity compromise.

---

## Related

- **Fix**: [007-plaintext-private-keys-fix.md](007-plaintext-private-keys-fix.md)
- **Task**: [DM Offline Registration Persistence](../../tasks/dm-offline-registration-persistence.md) - discovered this issue during analysis
- **Doc**: [Config Sync System](../../docs/config-sync-system.md) - existing encryption implementation
- **Doc**: [Passkey Authentication Flow](../onboarding-flow/passkey-authentication-flow-analysis-2025-11-23.md) - key storage model
- **Store**: `space_keys` - similar unencrypted storage of space private keys
- **Store**: `encryption_states` - Double Ratchet session state (also unencrypted)
- **Doc**: [Action Queue Feature](../../docs/features/action-queue.md)

---

_Created: 2025-12-20_
_Last Updated: 2025-12-20_
