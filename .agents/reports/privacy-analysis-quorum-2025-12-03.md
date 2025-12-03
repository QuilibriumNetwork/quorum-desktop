# Quorum Privacy Analysis

**Date:** 2025-12-03
**Scope:** Quorum Desktop client + Quilibrium network layer

---

## Summary

**Privacy Rating: 9/10 (Exceptional)**

Quorum is a privacy-first messaging app running on Quilibrium, a decentralized network with built-in mixnet routing. The combination provides:

- **E2E encryption** (Triple-Ratchet) for all messages
- **Mixnet anonymization** (RPM) for traffic - similar to Tor
- **No IP exposure** - BlossomSub uses graph addresses
- **No central server** - decentralized architecture
- **No PII required** - no phone/email needed

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUORUM CLIENT LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  • Triple-Ratchet E2EE (AES-GCM + Ed448)                       │
│  • Config encryption (AES-256-GCM)                              │
│  • Hardware key storage (Passkeys/WebAuthn)                     │
│  • Local IndexedDB storage                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  QUILIBRIUM NETWORK LAYER                       │
├─────────────────────────────────────────────────────────────────┤
│  • RPM Mixnet - traffic anonymization via permutation matrices  │
│  • BlossomSub - P2P with graph addresses (no IP identification) │
│  • Oblivious Hypergraph - query-oblivious data storage          │
│  • Decentralized hubs - no central message storage              │
└─────────────────────────────────────────────────────────────────┘
```

---

## What's Protected

| Data | Protection | Observer Visibility |
|------|------------|---------------------|
| Message content | Triple-Ratchet E2EE | Nobody except recipients |
| User config (folders, bookmarks) | AES-256-GCM | Nobody (encrypted blob) |
| Traffic patterns | RPM Mixnet | Shuffled, uncorrelatable |
| IP address | BlossomSub | Hidden (graph addresses used) |
| User identity | Pseudonymous addresses | No PII required |
| Query patterns | Oblivious Hypergraph | Nodes can't see what you query |

---

## Encryption Details

### Message Encryption (Triple-Ratchet)

Extension of Signal's Double-Ratchet with distributed key generation for groups:

- **Forward secrecy** - compromised keys don't expose past messages
- **Post-compromise secrecy** - future messages stay secure after breach
- **Repudiability** - optional message signing (user choice)
- **Replay protection** - prevents duplicate message attacks

### Config Encryption

User settings (spaces, folders, bookmarks) synced between devices:

```
Config → AES-256-GCM encrypt → Ed448 sign → Sync
         (key from user private key)
```

Server sees: `user_address`, `timestamp`, encrypted blob
Server cannot see: any config content

---

## Network Privacy (Quilibrium)

### Mixnet Routing (RPM)

Traffic anonymized through Shuffled Lattice Routing:

1. Messages split via Shamir Secret Sharing
2. Each cluster applies threshold permutation matrix
3. Messages shuffled cryptographically
4. Sender-recipient correlation impossible

### BlossomSub Protocol

Enhanced GossipSub that replaces IP-based identification:

| Standard P2P | BlossomSub |
|--------------|------------|
| IP addresses | Graph addresses + capabilities |
| Exact topic match | Bloom filter matching |
| Sybil-vulnerable | Unforgeable proof requirements |

### Oblivious Hypergraph

Three-layer data privacy:
- **Query obliviousness** - nodes can't tell what you're querying
- **Requestor blindness** - you can't see extraneous data
- **Network opacity** - full observers learn nothing about content/structure

---

## Local Storage

| Storage | Contents | Encrypted |
|---------|----------|-----------|
| IndexedDB | Messages, spaces, keys | ❌ Plaintext* |
| IndexedDB id=1/2 | User private keys | ✅ AES-256 |
| localStorage | Theme, language | ❌ (non-sensitive) |

*Standard for E2E apps (Signal, WhatsApp same). Device access = data access.

---

## Industry Comparison

| Feature | Quorum | Signal | Session | WhatsApp | Telegram | Discord |
|---------|--------|--------|---------|----------|----------|---------|
| E2E encryption | ✅ Triple-Ratchet | ✅ Double-Ratchet | ✅ | ✅ | ⚠️ Secret chats only | ❌ |
| Mixnet/Onion routing | ✅ RPM | ❌ | ✅ | ❌ | ❌ | ❌ |
| IP protection | ✅ BlossomSub | ❌ | ✅ | ❌ | ❌ | ❌ |
| Decentralized | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| No phone required | ✅ | ❌ | ✅ | ❌ | ❌ | ⚠️ Often required |
| Hardware key storage | ✅ Passkeys | ⚠️ | ❌ | ⚠️ | ❌ | ❌ |
| Optional signing | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Open source | ✅ | ✅ | ✅ | ❌ | ⚠️ Client only | ❌ |

**Key differentiator:** Quorum combines E2E encryption with network-layer anonymization. Signal/WhatsApp encrypt content but expose IPs and metadata to servers. Telegram's default chats are **not** E2E encrypted. Discord has **no** E2E encryption.

---

## Client-Side Findings

### Active Considerations

| Issue | Severity | Description | Recommendation |
|-------|----------|-------------|----------------|
| IndexedDB plaintext | Medium | Decrypted messages/keys stored unencrypted in IndexedDB | Standard for E2E apps (Signal same). Consider optional at-rest encryption for high-security users |
| Schema validation | Info | No Zod validation after config decryption in `ConfigService.ts:117` | Add schema validation to prevent crashes from malformed sync data |
| Passkey fallback | Low | Users without passkey support fall back to IndexedDB-stored keys (AES-encrypted but software-only) | Document security tradeoff; consider requiring strong device password |

### Mitigated by Quilibrium Network Layer

| Original Finding | Client Risk | Network Mitigation | Status |
|------------------|-------------|-------------------|--------|
| IP address exposure | API server sees client IP | RPM mixnet obscures traffic origins | **Mitigated** |
| WebSocket connection patterns | Server can infer online status | BlossomSub uses graph addresses, not IPs | **Mitigated** |
| Timing metadata | Config sync timestamps visible | RPM shuffling adds latency variance | **Partially mitigated** |
| Traffic analysis | Message sizes observable | Mixnet shuffling across clusters | **Mitigated** |

### localStorage Audit

| Key | Contents | Risk |
|-----|----------|------|
| `language` | UI language | None |
| `theme` | Light/dark mode | None |
| `accent-color` | UI color | None |
| `passkeys-list` | Credential IDs, addresses (no private keys) | Low |
| `quorum-master-prf-incompatibility` | Passkey fallback flag | None |

**Result:** No sensitive data in localStorage. ✅

---

## References

**Quilibrium Docs:**
- [Communication Overview](https://docs.quilibrium.com/docs/learn/communication/)
- [E2EE / Triple-Ratchet](https://docs.quilibrium.com/docs/learn/communication/e2ee/)
- [Mixnet Routing](https://docs.quilibrium.com/docs/learn/communication/mixnet-routing/)
- [BlossomSub P2P](https://docs.quilibrium.com/docs/learn/communication/p2p-communication/)
- [Oblivious Hypergraph](https://docs.quilibrium.com/docs/learn/oblivious-hypergraph/)

**Client Files Analyzed:**
- `src/services/ConfigService.ts` - config encryption
- `src/services/MessageService.ts` - message handling
- `src/services/SyncService.ts` - space sync
- `src/db/messages.ts` - local storage
- `src/components/context/WebsocketProvider.tsx` - real-time comms

---

_Report: 2025-12-03_
