---
type: doc
title: Cryptographic Architecture
status: done
created: 2025-12-20T00:00:00.000Z
updated: 2026-07-19T00:00:00.000Z
---

# Cryptographic Architecture

> **AI-Generated**: May contain errors. Verify before use.
> Verified by agent 01-02-2026

This document explains the cryptographic protocols and key management used in Quorum. It focuses on the **mental model** needed to understand how encryption and signing work, rather than implementation details.


**Last Updated**: 2026-07-19

---

## Table of Contents

1. [Key Hierarchy](#key-hierarchy)
2. [Double Ratchet vs Triple Ratchet](#double-ratchet-vs-triple-ratchet)
3. [Message Signing vs Encryption](#message-signing-vs-encryption)
4. [Key Storage Locations](#key-storage-locations)
5. [Key Compromise Impact](#key-compromise-impact)
6. [Inbox Key Rotation](#inbox-key-rotation)
7. [Control-Message Authorization (Verified Signer)](#control-message-authorization-verified-signer)
8. [SDK Functions Reference](#sdk-functions-reference)

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
| **Space Hub Key** | Ed448 | Hub broadcast envelope sealing/unsealing | Per-space, per-user |
| **Space Inbox Key** | Ed448 | Message signing within a Space | Per-space, per-user |
| **Space Config Key** | X448 | Sync envelope encryption (optional layer) | Per-space, per-user |
| **Ratchet State** | Symmetric (derived) | Message encryption state | Per-conversation |

### What Each Key Does

- **UserKeyset**: Your master identity. Used to prove you are "you" across all your devices. The public key is your address.

- **DeviceKeyset**: Your device's capability to encrypt/decrypt DMs. Each device has its own keyset. When you add a new device, a new DeviceKeyset is generated.

- **Space Hub Key**: Generated when you join a Space. Used for sealing/unsealing hub broadcast envelopes that reach all Space members.

- **Space Inbox Key**: Generated when you join a Space. Used for signing messages to prove authorship within that Space. Separate from your UserKeyset for privacy (Spaces don't know your master identity).

- **Space Config Key**: Optional X448 key for additional encryption layer on sync envelopes. Provides forward secrecy for peer-to-peer sync messages.

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
| **space_keys** | Space Hub/Inbox/Config Keys | ❌ Plaintext | keyId: `hub`, `inbox`, or `config` |
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

## Inbox Key Rotation

The **Space Inbox Key** is not permanent. It can change over the lifetime of a member's participation in a Space, and the rest of the system must handle this gracefully.

### What the Inbox Key Is

Each member's inbox key has a corresponding **inbox address** — a base58-encoded public key hash that other members use to identify "the key this member is currently signing with". This address is stored on the `space_members` record for each user.

### When Rotation Happens

A new inbox key (and therefore a new inbox address) is generated whenever:

| Event | Reason |
|-------|--------|
| User leaves and rejoins a Space | Re-join creates a fresh keyset |
| User adds a new device | Device sync may issue new space keys |
| Key sync / recovery events | Backend or client-side key refresh |

After rotation the old `inbox_address` stored in the receiver's `space_members` record is stale — it points to a key the sender no longer uses.

> **⚠️ SUPERSEDED (2026-07-19, #243) — READ FIRST.** The mechanism described in
> the rest of this section (a receiver updating a member's stored `inbox_address`
> from an incoming `update-profile`) has been **removed**, because it was an
> authorization-bypass vector: the receive handler selected the member row by the
> spoofable payload `senderId` and the signature only proves the message was
> signed by *some* key, not that the key belongs to the claimed sender. A member
> could sign an `update-profile` claiming a victim's `senderId` and repoint the
> victim's `inbox_address` onto the attacker's key, poisoning the
> `resolveVerifiedSender` reverse-lookup that control-message auth relies on
> (delete/edit/pin/mute impersonation). See
> `.agents/docs/features/security.md` → "Profile-Update Authorization" and bug
> `.agents/bugs/2026-07-19-update-profile-inbox-poisoning-control-msg-impersonation.md`.
>
> **Current behavior:** `update-profile` is authorized against the verified signer
> (`isUpdateProfileAuthorized`) and is **display-only** — it never writes the
> announced key onto a member row. The authoritative `inbox_address` comes only
> from the cryptographically **verified join control** (`js_verify_point` + ed448).
> The upstream inbox-mismatch guard is still skipped for `update-profile` (so the
> display update isn't dropped after a rotation), but the handler no longer acts
> on the new key.
>
> **⚠️ MULTI-DEVICE — exposed 2026-07-19; sender-side fix implemented.**
> This is more than a rare rotation edge case. Each device generates its OWN
> space signing keypair (`spaceSyncService.ts` `generateEd448()`), so one user
> signs space messages with a different key per device. The verified-signer
> reverse-lookup binds a member to a SINGLE `inbox_address`, and the removed
> `update-profile` rebinding was — accidentally — the only thing that let a
> second device's key get into other members' tables. With it gone, a control
> message (e.g. a delete) sent from a user's second device fails the reverse
> lookup on other clients and is dropped (posts still land, because unverifiable
> post signatures are nulled and processed anyway; control messages fail closed).
> The vulnerable line was genuinely load-bearing for multi-device.
>
> **Fix — signing/mailbox key split (implemented, sender-side).** The per-space
> `inbox` key played two roles with opposite lifetimes: the MAILBOX (per-device
> transport address, correctly regenerated per device) and the SIGNING identity
> (per-user — the join key receivers bound). Space CREATE/JOIN now also store the
> join key under a `signing` slot, the config-sync path preserves it instead of
> letting the fresh per-device keypair overwrite it, and all space-message
> signing uses `getSigningKey(spaceId)` = `signing` ?? `inbox` (the fallback
> covers the join device and pre-migration state). No wire, receive-side, or
> member-table change; the signing key already crossed devices inside the
> E2E-encrypted config payload (and was discarded) — trust is unchanged from DMs
> (all of a user's devices act as the user). Existing pre-fix second devices stay
> broken until they re-add the space (acceptable for beta).
>
> **Durable follow-up (separate task):** a member holds MULTIPLE verified inbox
> keys, new keys admitted only with a proof chained to the **authenticated device
> registration** the DM stack already trusts. That also repairs the lost-join-key
> case and enables true per-device keys. Cross-platform (shared + both apps).
> Full analysis: quorum-mobile bug
> `2026-07-19-multidevice-inbox-key-breaks-verified-signer-auth.md`.

### How Rotation Is Announced: `update-profile` (HISTORICAL — see note above)

The `update-profile` message type is a broadcast that every member sends to the Space when their profile data changes (display name, avatar, or space tag). Critically, **it also carries the sender's current inbox address** via the signed envelope header.

This makes `update-profile` the key rotation announcement. When a receiver processes it:

1. The message arrives sealed with the sender's **new** inbox key.
2. The receiver extracts the new `inboxAddress` from the envelope.
3. `saveSpaceMember` persists the new address, replacing the stale one.

From that point on, signatures from the sender are verified against the new key.

### Why the Inbox Mismatch Guard Must Be Skipped for `update-profile`

The non-repudiability verification block in `MessageService` contains an inbox mismatch check:

```typescript
const inboxMismatch =
  !isUpdateProfile &&            // ← skip for update-profile
  participant.inbox_address !== inboxAddress &&
  participant.inbox_address;
```

If this check were applied to `update-profile`, the very message that announces the new key would be rejected because the stored address is still the old one — a chicken-and-egg deadlock. The sender's profile update (and any space tag selection) would be silently dropped and could never be delivered after any rotation event.

The same logic applies to the inner guard in the `saveMessage` handler path:

```
// update-profile is itself a key rotation announcement — accept inbox address changes.
// Signature was already verified upstream; rejecting on mismatch would permanently
// block profile updates after any key rotation.
```

For all other message types the mismatch check remains fully active: if a non-profile message arrives claiming to be from a sender but signed with an unexpected key, it is correctly rejected.

### Security Properties Preserved

Skipping the inbox mismatch check for `update-profile` does **not** weaken security:

- The **outer envelope** is still unsealed using the space Hub Key — only legitimate Space members can produce a valid envelope.
- The **message ID hash** is still verified (`messageIdMismatch` check) — for regular posts the fingerprint covers `nonce + message_type + senderId + content`; for control messages (`remove-message`, `edit-message`, `pin`, `mute`) it additionally binds `spaceId + channelId` to prevent cross-space replay of a signed control message. A tampered message fails either way.
- The **ed448 signature** is still verified against the extracted public key — the message must be signed by whoever holds the private key matching the envelope's claimed sender.

What changes is only that the receiver now accepts the *new* inbox address from the envelope rather than demanding it match the old stored one.

### Summary

```
Normal message:   stored_inbox == envelope_inbox? → verify signature
                  stored_inbox != envelope_inbox? → REJECT (mismatch)

update-profile:   (current — #243) verify signature, authorize the VERIFIED
                  signer (a known key may only speak for its own member; an
                  unknown key is a display-only bootstrap). NEVER update the
                  stored inbox_address from the announcement — the authoritative
                  value comes only from the verified join control.
```

---

## Control-Message Authorization (Verified Signer)

Space control messages (`remove-message`, `edit-message`, `pin`, `mute`) and `@everyone`-bearing posts are authorized against the **cryptographically verified ed448 signer**, not the spoofable plaintext `content.senderId`. This applies regardless of the space's `isRepudiable` flag.

After the signature verification steps described above, `isSpaceControlAuthorized` in `MessageService` calls `resolveVerifiedSender` and then `authorizeControlMessage` (both in `quorum-shared/src/utils/messageAuth.ts`):

```
verified publicKey
    → resolveVerifiedSender(publicKey, members)
          // REVERSE lookup: publicKey → inbox address → space_members row
          // Returns null if no match or member is kicked (fail closed)
    → VerifiedSender | null
    → authorizeControlMessage({ content, verifiedSender, space, channel, targetMessage })
```

An unsigned or signature-invalid control message resolves to `verifiedSender = null` and is silently dropped (fail closed). The narrow exception: in a repudiable space, an unsigned edit of an unsigned message is accepted when the claimed sender matches the target's author — deniable content stays deniable.

The fingerprint for control messages additionally binds `spaceId + channelId` (see Security Properties Preserved above) so a validly-signed control message cannot be replayed into a different space or channel.

For the full security rationale, cross-space replay protection, and the edit-inherit rule (edits sign iff the original was signed), see:
- [features/security.md](features/security.md) — "Control-Message Authorization (verified signer)"
- [features/messages/message-signing-system.md](features/messages/message-signing-system.md) — "Receive-Side Verification" and "Control-Message Authorization via Verified Signer"
- `.agents/tasks/2026-06-25-MASTER-RECAP-control-message-auth.md`

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

### Envelope Sealing (Space Messages)

Two envelope types are used for Space communication:

**Hub Envelope** - Broadcast to all Space members:

```typescript
// Seal a hub broadcast envelope
secureChannel.SealHubEnvelope(
  hubAddress,         // Space hub address
  hubKey,             // Ed448 hub key { type, public_key, private_key }
  messageJSON,        // Message payload
  configKey?          // Optional X448 config key for additional encryption
)

// Unseal a hub broadcast envelope
secureChannel.UnsealHubEnvelope(
  hubKey,             // Ed448 hub key
  envelope,           // Received envelope
  configKey?          // Optional X448 config key
)
```

**Sync Envelope** - Directed to specific peer:

```typescript
// Seal a sync envelope (directed message)
secureChannel.SealSyncEnvelope(
  targetInbox,        // Recipient's inbox address
  hubAddress,         // Space hub address
  hubKey,             // Ed448 hub key
  inboxKey,           // Ed448 inbox key
  messageJSON,        // Message payload
  configKey?          // Optional X448 config key
)

// Unseal a sync envelope
secureChannel.UnsealSyncEnvelope(
  hubKey,             // Ed448 hub key
  envelope,           // Received envelope
  configKey?          // Optional X448 config key
)
```

**When to use each:**
- **Hub Envelope**: Regular Space messages (broadcast to all members)
- **Sync Envelope**: Peer-to-peer sync messages (`sync-request`, `sync-info`, `sync-initiate`, `sync-manifest`, `sync-delta`)

---

## Related Documentation

- [Security Architecture](features/security.md) - Application security (XSS, permissions, etc.)
- [Data Management Architecture](data-management-architecture-guide.md) - Storage patterns
- [Action Queue](features/action-queue.md) - Background task processing
- [Message Signing System](features/messages/message-signing-system.md) - Non-repudiability hierarchy and receive-side verification

---


_Last Updated: 2026-07-19_
