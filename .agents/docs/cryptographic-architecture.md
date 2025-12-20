# Cryptographic Architecture

> **AI-Generated**: May contain errors. Verify before use.
> Verified by agent 12-20-2025

This document explains the cryptographic protocols and key management used in Quorum. It focuses on the **mental model** needed to understand how encryption and signing work, rather than implementation details.

**Created**: 2025-12-20
**Last Updated**: 2025-12-20

---

## Table of Contents

1. [Key Hierarchy](#key-hierarchy)
2. [Double Ratchet vs Triple Ratchet](#double-ratchet-vs-triple-ratchet)
3. [Message Signing vs Encryption](#message-signing-vs-encryption)
4. [Key Storage Locations](#key-storage-locations)
5. [Key Compromise Impact](#key-compromise-impact)
6. [SDK Functions Reference](#sdk-functions-reference)

---

## Key Hierarchy

Quorum uses a hierarchical key structure with different keys for different purposes:

```
UserKeyset (Master Identity)
    │
    ├── DeviceKeyset (Per-Device)
    │       │
    │       └── Double Ratchet Sessions (Per-DM Contact)
    │
    └── Space Inbox Keys (Per-Space)
            │
            └── Triple Ratchet Sessions (Per-Space)
```

### Key Types

| Key Type | Algorithm | Purpose | Scope |
|----------|-----------|---------|-------|
| **UserKeyset** | Ed448 | Master identity, cross-device | Per-user, all devices |
| **DeviceKeyset** | X448 + Ed448 | Device operations, DM encryption | Per-device |
| **Space Inbox Key** | Ed448 | Message signing within a Space | Per-space, per-user |
| **Ratchet State** | Symmetric (derived) | Message encryption state | Per-conversation |

### What Each Key Does

- **UserKeyset**: Your master identity. Used to prove you are "you" across all your devices. The public key is your address.

- **DeviceKeyset**: Your device's capability to encrypt/decrypt DMs. Each device has its own keyset. When you add a new device, a new DeviceKeyset is generated.

- **Space Inbox Key**: Generated when you join a Space. Used for signing messages to prove authorship within that Space. Separate from your UserKeyset for privacy (Spaces don't know your master identity).

- **Ratchet State**: Not a key itself, but the current state of a session. Contains derived symmetric keys that evolve with each message (forward secrecy).

---

## Double Ratchet vs Triple Ratchet

Quorum uses two different ratchet protocols depending on the conversation type:

| Protocol | Used For | Why |
|----------|----------|-----|
| **Double Ratchet** | DMs (1:1 conversations) | Optimal for two-party communication |
| **Triple Ratchet** | Spaces (group conversations) | Efficient for multi-party groups |

### Double Ratchet (DMs)

```
┌─────────────────────────────────────────────────────────────┐
│                    Double Ratchet (DM)                       │
├─────────────────────────────────────────────────────────────┤
│  At Encrypt Time:                                            │
│    ✅ Requires: deviceKeyset (private key)                   │
│    ✅ Requires: counterparty's registration (public keys)    │
│    ✅ Requires: existing session state (if continuing)       │
│                                                              │
│  Session: Per-inbox (each of your devices has separate       │
│           sessions with each of their devices)               │
├─────────────────────────────────────────────────────────────┤
│  SDK Functions:                                              │
│    - DoubleRatchetInboxEncrypt()                             │
│    - DoubleRatchetInboxEncryptForceSenderInit()              │
│    - NewDoubleRatchetSenderSession()                         │
└─────────────────────────────────────────────────────────────┘
```

**Key Point**: Double Ratchet requires the private key at encryption time because it performs key agreement with the counterparty for each message chain.

### Triple Ratchet (Spaces)

```
┌─────────────────────────────────────────────────────────────┐
│                   Triple Ratchet (Space)                     │
├─────────────────────────────────────────────────────────────┤
│  At Encrypt Time:                                            │
│    ❌ Does NOT require: any private key                      │
│    ✅ Requires: ratchet_state (from IndexedDB)               │
│                                                              │
│  Session: Per-space (all members share the same session      │
│           state, established when joining the Space)         │
├─────────────────────────────────────────────────────────────┤
│  SDK Function:                                               │
│    - TripleRatchetEncrypt()                                  │
└─────────────────────────────────────────────────────────────┘
```

**Key Point**: Triple Ratchet does NOT require private keys at encryption time. The session was established when you joined the Space, and the `ratchet_state` contains all the symmetric keys needed for encryption.

### Why This Matters

This distinction is crucial for security analysis:

1. **Code that handles DM encryption MUST have access to private keys** - there's no way around this
2. **Code that handles Space encryption should NOT need private keys** - if it does, something is wrong
3. **Private keys stored in plaintext are a security issue** - but only for code paths that actually need them

---

## Message Signing vs Encryption

**Signing** and **encryption** are separate operations with different purposes:

### Signing (Authorship Proof)

| Aspect | DMs | Spaces |
|--------|-----|--------|
| **Key Used** | UserKeyset | Space Inbox Key |
| **Key Location** | `KeyDB id=2` (encrypted) | `space_keys` store |
| **Optional?** | Yes (`skipSigning` param) | Depends on `isRepudiable` flag |

**What signing does**:
- Creates Ed448 signature over the `messageId`
- Proves the message came from the claimed sender
- Enables non-repudiation (sender can't deny sending)

**The `isRepudiable` flag** (Space setting):
- `false`: All messages MUST be signed (non-repudiable)
- `true`: Users can toggle signing off in the composer (repudiable/anonymous)

### Encryption (Content Protection)

| Aspect | DMs | Spaces |
|--------|-----|--------|
| **Protocol** | Double Ratchet | Triple Ratchet |
| **Key Used** | DeviceKeyset + session | Ratchet state only |
| **Optional?** | Never - always encrypted | Never - always encrypted |

**What encryption does**:
- Protects message content from eavesdroppers
- Provides forward secrecy (past messages safe if keys compromised)
- Prevents tampering (authenticated encryption)

### The Complete Message Flow

```
1. User types message
2. Generate messageId (SHA-256 of nonce + content)
3. [Optional] Sign messageId with Ed448
4. Encrypt message with ratchet protocol
5. Send encrypted envelope to network
```

---

## Key Storage Locations

All keys are stored in IndexedDB, but with different levels of protection:

| Store | Contents | Encrypted? | Notes |
|-------|----------|------------|-------|
| **KeyDB id=2** | UserKeyset, DeviceKeyset | ✅ AES-GCM | SDK-managed, passkey-derived key |
| **space_keys** | Space Inbox Keys | ❌ Plaintext | Contains private keys |
| **encryption_states** | Ratchet session states | ❌ Plaintext | Contains symmetric keys |
| **user_config** | User preferences | ❌ Plaintext | May contain `spaceKeys` backup |

### The SDK Encryption Pattern

The SDK uses a double-layer encryption for identity keys at `KeyDB id=2`:

```
IndexedDB KeyDB id=2:
┌─────────────────────────────────────────────────────────────┐
│ OUTER LAYER (encryptDataSaveKey)                            │
│ keys: [AES key #1]  ← Stored here, anyone can decrypt outer │
│ encrypted: {                                                │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ INNER LAYER (passkey.encrypt)                       │   │
│   │ iv: [...]                                           │   │
│   │ ciphertext: {                                       │   │
│   │   identity: UserKeyset  ← Protected by Ed448 key    │   │
│   │   device: DeviceKeyset  ← Protected by Ed448 key    │   │
│   │ }                                                   │   │
│   └─────────────────────────────────────────────────────┘   │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
```

- **Outer layer**: Convenience encryption, key stored alongside ciphertext
- **Inner layer**: Real protection, key derived from user's Ed448 private key (passkey-backed)

---

## Key Compromise Impact

Understanding what happens when different keys are compromised:

| Key Compromised | Impact | Severity |
|-----------------|--------|----------|
| **UserKeyset** | Full identity theft, can impersonate across all devices | 🚨 **Critical** |
| **DeviceKeyset** | Can impersonate from that device, decrypt DMs | 🚨 **Critical** |
| **Space Inbox Key** | Can sign messages as you in that Space | ⚠️ **High** |
| **Ratchet State** | Can decrypt messages in that session | ⚠️ **High** |

### Forward Secrecy Protection

Even if keys are compromised:
- **Past messages remain safe** - ratchet advances make old keys unrecoverable
- **Future messages compromised** - until key rotation/new session
- **Other conversations unaffected** - separate session states

---

## SDK Functions Reference

### Double Ratchet (DMs)

```typescript
// Encrypt to an existing session
secureChannel.DoubleRatchetInboxEncrypt(
  deviceKeyset,      // Your device's private key (required!)
  [sessionState],    // Existing session
  messageJSON,       // Message to encrypt
  selfRegistration,  // Your registration
  displayName,
  userIcon
)

// Force new session initialization
secureChannel.DoubleRatchetInboxEncryptForceSenderInit(
  deviceKeyset,      // Your device's private key (required!)
  [sessionState],
  messageJSON,
  selfRegistration,
  displayName,
  userIcon
)

// Create brand new session
secureChannel.NewDoubleRatchetSenderSession(
  deviceKeyset,      // Your device's private key (required!)
  selfAddress,
  targetInbox,
  deviceRegistration,
  messageJSON,
  selfRegistration,
  displayName,
  userIcon
)
```

### Triple Ratchet (Spaces)

```typescript
// Encrypt for Space - NO private key needed!
secureChannel.TripleRatchetEncrypt(
  JSON.stringify({
    ratchet_state: state,  // From IndexedDB encryption_states
    message: messageBytes
  })
)
```

### Signing

```typescript
// Sign a message ID
channel_raw.js_sign_ed448(
  privateKeyBase64,   // From UserKeyset or Space Inbox Key
  messageIdBase64     // SHA-256 hash of message
)

// Verify a signature
channel_raw.js_verify_ed448(
  publicKeyBase64,
  messageIdBase64,
  signatureBase64
)
```

---

## Related Documentation

- [Security Architecture](features/security.md) - Application security (XSS, permissions, etc.)
- [Data Management Architecture](data-management-architecture-guide.md) - Storage patterns
- [Action Queue](features/action-queue.md) - Background task processing

---

_Created: 2025-12-20_
_Last Updated: 2025-12-20_
