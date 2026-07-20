---
type: doc
title: Security Architecture
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# Security Architecture

This document provides a comprehensive overview of the security mechanisms implemented in the Quorum Desktop application. It covers client-side protections, defense-in-depth validation, and cryptographic security.

---

## Executive Summary

Quorum Desktop implements a **multi-layered security architecture** designed for a decentralized, privacy-focused messaging platform.

### Security Posture (as of 2026-07-19)

| Category | Status |
|----------|--------|
| **Critical vulnerabilities** | None identified |
| **High-risk gaps** | None - all fixes applied |
| **Defense-in-depth** | Fully implemented |
| **Client validation bypass risk** | LOW - receiving-side validation protects honest clients |

> **2026-07-19 — control-message authorization hardened.** Receive-side
> authorization for **space** control messages (`remove-message`,
> `edit-message`, `pin`, `mute`) and for `@everyone` no longer trusts the
> plaintext payload `senderId` (which a modified client can forge). It now
> authorizes against the **cryptographically verified ed448 signer**, derived
> from the message's signing key by reverse lookup in `space_members`, failing
> closed when the signer isn't a known member. This closes a spoofing bypass
> where a space member on a modified client could impersonate a moderator (or a
> message's author) to delete/edit/pin/mute anyone's content. The DM equivalent
> was fixed earlier (PR #220, session-anchored). See "Control-Message
> Authorization (verified signer)" below and
> [messages/message-signing-system.md](messages/message-signing-system.md).
> Mobile's matching receive-side verification is still pending.

### Key Security Principles

1. **Defense-in-Depth**: Multiple validation layers (UI → Service → Receiving)
2. **Fail-Secure**: When uncertain, reject rather than allow
3. **Privacy-First**: End-to-end encryption, minimal metadata exposure
4. **Decentralized Trust**: No central authority - clients validate independently
5. **Authorize on proven identity, not claimed identity**: security-relevant
   receive-side decisions key on the cryptographically verified sender (session
   for DMs, ed448 signature for spaces), never on the sender-written `senderId`.

---

## Open Source Security Context

Quorum is **open-source software**, which has important security implications:

### Why Custom Clients are a Threat Vector

Since the source code is publicly available, anyone can:
- Build a **modified client** that bypasses UI validation
- Use **browser DevTools** to call internal functions directly
- Create **automated scripts** to spam or abuse the system

This means **client-side validation alone is never sufficient** for security-critical features.

### Web/Desktop App vs Native Mobile App

| Platform | Custom Client Risk | Why |
|----------|-------------------|-----|
| **Web App (Browser)** | Higher | Browser DevTools accessible, code easily inspectable |
| **Desktop App (Electron)** | Higher | Same as web - DevTools accessible, JavaScript inspectable |
| **Native Mobile App** | Lower | Compiled code, no DevTools, separate codebase |

> **Note**: This repository contains the **Web App** and **Electron Desktop App** code. The native mobile apps (iOS/Android) are in a separate repository with compiled native code, which is inherently harder to modify at runtime.

All platforms benefit from **receiving-side validation** because malicious messages can originate from any client on the network - a modified web client can send messages that native app users receive.

### Our Security Response

Rather than treating open-source as a vulnerability, we embrace it:

1. **Assume all clients are potentially hostile** - Receiving validation protects honest users
2. **Never trust sender claims** - Validate permissions independently
3. **Silent rejection** - Don't reveal what was blocked to attackers
4. **Transparent security model** - This documentation helps security researchers audit our approach

> **Note**: The open-source nature also means security researchers can verify our claims and report vulnerabilities, making the system more secure over time.

---

## Defense-in-Depth Architecture

In a decentralized P2P messaging system, there is no central server to enforce rules. Security relies on **each client validating independently**.

### Three Validation Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     SENDING CLIENT                               │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: UI Validation                                          │
│  - Prevents honest users from attempting unauthorized actions    │
│  - Shows helpful error messages                                  │
│  - Example: "You're sending messages too quickly"               │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Service Validation                                     │
│  - Strips unauthorized data before broadcast                     │
│  - Example: @everyone removed if user lacks permission          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Encrypted message broadcast
                              │ via DHT network
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RECEIVING CLIENT                              │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Receiving Validation                                   │
│  - Validates ALL incoming messages before displaying            │
│  - Rejects unauthorized/malformed content silently              │
│  - Protects against malicious custom clients                    │
│  - Example: Oversized messages dropped, rate limits enforced    │
└─────────────────────────────────────────────────────────────────┘
```

### Why Receiving Validation is Critical

- **Custom clients** can bypass UI and service validation entirely
- **DevTools manipulation** can call internal functions directly
- **Only receiving validation** protects honest clients from malicious senders
- **Silent rejection** prevents attackers from learning what was blocked

---

## Client-Side Validation Summary

The following table summarizes all client-side limitations and their security status:

| Limitation | Risk | Affects Official Client? | Bypass Status |
|------------|------|--------------------------|---------------|
| **XSS Prevention** | **LOW** | ❌ No - 3-layer defense | ❌ No - input sanitized |
| **Delete others' messages** | **LOW** | ❌ No - rejected on receive | ⚠️ Sends, but rejected |
| **Mute users** | **LOW** | ❌ No - rejected on receive | ⚠️ Sends, but rejected |
| **Read-only channel posting** | **LOW** | ❌ No - rejected on receive | ⚠️ Sends, but rejected |
| **Pin messages** | **LOW** | ❌ No - rejected on receive | ⚠️ Sends, but rejected |
| **@everyone mention** | **LOW** | ❌ No - stripped before broadcast | ❌ No - service layer |
| **Message rate limiting** | **LOW** | ❌ No - 2-layer rate limiting | ⚠️ Sends, but rejected |
| **Regex DoS Prevention** | **LOW** | ❌ No - bounded quantifiers | ❌ No - length limits |
| **Message length (2500 chars)** | **LOW** | ❌ No - rejected on receive | ⚠️ Sends, but rejected |
| **Mentions per message (20)** | **LOW** | ❌ No - rejected on receive | ⚠️ Sends, but rejected |
| **Space owner kick users** | **NONE** | N/A - protocol feature | ❌ No - ED448 signed |
| **Kick space owner (by others)** | **NONE** | N/A - protocol feature | ❌ No - ED448 signed |
| **Bookmarks limit (200)** | **NONE** | N/A - private data | ❌ No - DB validation |
| **Folders limit (20/100)** | **NONE** | N/A - private data | ⚠️ Auto-truncated |
| **Role visibility** | **NONE** | N/A - cosmetic | ✅ Yes, trivial |

**Legend:**
- **Risk**: Security risk level if bypassed
- **Affects Official Client?**: Whether honest users see malicious content
- **Bypass Status**: How bypass attempts are handled

---

## Security Mechanisms

### 1. XSS (Cross-Site Scripting) Prevention

**Defense Type**: Input validation + output encoding
**Risk Level**: LOW (fully mitigated)

#### Overview

Implemented a **defense-in-depth** approach using three layers:

1. **Input Validation** - Block dangerous HTML characters (`< > " '`) at data entry points
2. **Placeholder Token System** - Safely render mentions without parsing user HTML
3. **React Auto-Escaping** - Built-in JSX attribute escaping as a safety net

#### Attack Vectors Mitigated

- HTML injection in messages (e.g., `<script>alert('XSS')</script>`)
- Attribute injection via display names (e.g., `"><script>alert('XSS')</script>`)
- Attribute injection via space names
- Attribute injection via role names
- Phishing links via HTML tags
- UI spoofing via injected elements

#### Implementation Files

**Core Utilities:**
- `src/utils/validation.ts` - Core validation functions (`validateNameForXSS`, `sanitizeNameForXSS`)

**Validation Hooks:**
- `src/hooks/business/validation/useDisplayNameValidation.ts` - Display name validation
- `src/hooks/business/validation/useSpaceNameValidation.ts` - Space name validation

**Applied In:**
- `src/components/onboarding/Onboarding.tsx` - Onboarding display name
- `src/components/modals/UserSettingsModal/UserSettingsModal.tsx` - User settings
- `src/components/modals/CreateSpaceModal.tsx` - Space creation
- `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` - Space settings

**Placeholder Token System:**
- `src/components/message/MessageMarkdownRenderer.tsx` - Safe mention rendering

#### Security Guarantees

- ✅ Users **cannot** inject `<script>`, `<img>`, `<iframe>`, or other HTML tags
- ✅ Users **cannot** use dangerous characters (`< > " '`) in display/space names
- ✅ Markdown formatting still works (**bold**, *italic*, links, code blocks)
- ✅ YouTube embeds work securely without allowing arbitrary HTML

---

### 2. Regex DoS (Denial of Service) Prevention

**Defense Type**: Bounded quantifiers + input sanitization
**Risk Level**: LOW (fully mitigated)

#### Overview

Protection against **Regular Expression Denial of Service** attacks targeting catastrophic backtracking in mention token parsing.

#### Attack Vector

Malicious input with long strings causes exponential regex processing time:
```javascript
// Attack: 1000+ character display name
@[aaaaaaaaaaaaaaaa...1000 chars...]<QmValidAddress>
```

#### Implementation

**File**: `src/components/message/MessageMarkdownRenderer.tsx`

**Regex Limits:**
- Display names: max 200 characters
- Role tags: max 50 characters
- Channel names: max 200 characters

**Input Sanitization:**
```typescript
const sanitizeDisplayName = (name: string) => {
  return name
    .replace(/>>>/g, '')  // Remove token-breaking chars
    .substring(0, 200)    // Enforce length limit
    .trim();
};
```

#### Security Guarantees

- ✅ Regex processing **bounded to finite time** regardless of input
- ✅ Token-breaking characters **automatically removed**
- ✅ Protection works against **all input sources** (UI, API, network)

---

### 3. Receiving-Side Message Validation

**Defense Type**: Defense-in-depth validation
**Risk Level**: LOW (all bypasses blocked)

#### Overview

All incoming messages are validated **before being added to the UI cache**, protecting honest clients from malicious senders.

#### Validations Performed

| Check | Limit | Location |
|-------|-------|----------|
| Read-only channel | Permission required | `MessageService.ts:821-878` |
| Message length | 2500 characters max | `MessageService.ts:897-917` |
| Mention count | 20 mentions max | `MessageService.ts:921-937` |
| Rate limiting | 10 msgs/10 sec per sender | `MessageService.ts:939-957` |
| Pin messages | Permission + 50 max pins | `MessageService.ts:448-523, 882-978` |

#### Implementation Pattern

```typescript
// Example: Message length validation (receiving side)
if (isPostMessage) {
  const text = (decryptedContent.content as PostMessage).text;
  const messageText = Array.isArray(text) ? text.join('') : text;

  if (messageText && messageText.length > MAX_MESSAGE_LENGTH) {
    console.log(`🔒 Rejecting oversized message from ${senderId}`);
    return; // Drop silently
  }
}
```

#### Security Guarantees

- ✅ Oversized messages **never displayed** to honest users
- ✅ Excessive mentions **never trigger notifications**
- ✅ Read-only channel spam **never visible**
- ✅ Message flooding **automatically rate limited**
- ✅ Unauthorized pins **never displayed** to honest users
- ✅ Attackers only see their own malicious content

---

### 4. Message Rate Limiting

**Defense Type**: 2-layer throttling (UI + receiving)
**Risk Level**: LOW (fully mitigated)

#### Overview

Prevents message flooding/spam via sliding window rate limiting at two layers.

#### Implementation

| Layer | Limit | Feedback | Location |
|-------|-------|----------|----------|
| **UI** | 5 msgs / 5 sec | Toast warning | `useMessageComposer.ts:52-57` |
| **Receiving** | 10 msgs / 10 sec | Silent rejection | `MessageService.ts:939-957` |

**Rate Limiter Utility**: `src/utils/rateLimit.ts`

```typescript
export class SimpleRateLimiter {
  private timestamps: number[] = [];

  canSend(): { allowed: boolean; waitMs: number } {
    const now = Date.now();
    // Sliding window: remove expired timestamps
    this.timestamps = this.timestamps.filter(t => t > now - this.windowMs);

    if (this.timestamps.length < this.maxMessages) {
      this.timestamps.push(now);
      return { allowed: true, waitMs: 0 };
    }
    return { allowed: false, waitMs: /* calculated */ };
  }
}
```

#### Security Guarantees

- ✅ UI prevents accidental rapid clicking with user feedback
- ✅ Receiving layer blocks DevTools/custom client bypass
- ✅ Flooded messages **only visible to attacker**
- ✅ Per-sender tracking prevents multi-account abuse

---

### 5. Permission-Based Security

**Defense Type**: Role-based access control + receiving validation
**Risk Level**: LOW (crypto-verified where critical)

#### Space Owner Protection

Space owner identity is cryptographically tied to space creation keys:
- **Location**: `src/services/SpaceService.ts:660-679`
- **Verification**: Protocol verifies via `owner_public_keys`
- **Bypass**: Requires forging cryptographic signatures

> **Control-Message Authorization (verified signer) — 2026-07-19.** For SPACE
> control messages the receiving side no longer keys authorization on the
> payload `senderId` (forgeable by a modified client). It resolves the
> **verified ed448 signer** and authorizes against that. Mechanism (shared
> `messageAuth.ts`, consumed by `MessageService.ts`):
> 1. The message's signature is verified against a canonical fingerprint
>    (`buildMessageFingerprint`: `nonce + content.type + senderId +
>    spaceId+channelId (control types) + canonicalize(content)`). Control
>    messages are verified **regardless of space repudiability**.
> 2. `resolveVerifiedSender` maps the verified signing key → inbox address
>    (`base58btc(sha256(publicKey))`) → the `space_members` row with that
>    inbox address (REVERSE lookup). No match / kicked member → `null` → drop
>    (fail closed). This is NOT a lookup by claimed `senderId`.
> 3. `authorizeControlMessage` returns the allow/drop verdict (own-message /
>    role / manager checks against the verified sender), applied identically in
>    the DB (`saveMessage`) and cache (`addMessage`) handlers.
>
> Covers `remove-message`, `edit-message`, `pin`, `mute`, and `@everyone`.
> **Read-only-channel content acceptance** is also verified-signer, now on BOTH
> the live (`addMessage`) and durable (`saveMessage`) paths and for `post` +
> `embed` + `sticker` (a shared `isReadOnlyPostAuthorized` gate: verify the
> signature → authorize the verified signer as a channel manager; unsigned
> dropped). The durable path fail-opens on missing space/channel data (drops
> only when the channel is confirmed read-only and the signer isn't a manager)
> so a legit signed manager message isn't lost during sync/replay. Read-only
> posts are also **force-signed on send** (overriding the repudiable
> "send unsigned" toggle) so a manager's own post is never dropped, and the
> composer hides the toggle for read-only channels (#242).
> DMs stay session-anchored (PR #220). A branded `VerifiedSender` type makes
> passing a raw `senderId` into these checks a compile error.
>
> **Multi-device:** verified-signer auth resolves a member from a single bound
> key (the join key), so a second device — which generates its own per-space key
> — would have all its control messages dropped. Space messages are therefore
> signed with a per-user **signing** key shared across a user's devices
> (`getSigningKey` = `signing` ?? `inbox`), while the per-device `inbox` key
> stays the mailbox. Details + the desktop/mobile divergence + the durable
> per-device-key follow-up: `cryptographic-architecture.md` → "Multi-Device
> Signing".

#### @everyone Mention Permission

Two layers:
- **Send side** — `hasPermission(address, 'mention:everyone', space)` (role-only;
  the former `isSpaceOwner` bypass was removed in shared `permissions.ts`).
- **Receive side (2026-07-19)** — `@everyone` is honored for notification ONLY if
  the **verified signer** holds `mention:everyone`. `@everyone`-bearing posts are
  signature-verified even in repudiable spaces so the signer is proven. A forged
  `mentions.everyone` from a modified client no longer notifies the space.

#### Delete Message Permission

Receiving clients validate permissions independently, authorizing the **verified
signer** (not payload `senderId`) as own-author / `message:delete` role holder /
read-only manager. See "Control-Message Authorization" above.
- **Location**: `src/services/MessageService.ts` — `isSpaceControlAuthorized` in
  the `remove-message` handlers (`saveMessage` + `addMessage`).
- **Behavior**: Unauthorized/unsigned deletes silently dropped (fail closed).

#### Profile-Update Authorization (protects the reverse-lookup — 2026-07-19)

`update-profile` used to select the member row by the spoofable payload
`senderId` and then overwrite that row's `inbox_address` with the signing key's
derived address. Because the upstream check skips the key↔member binding for
`update-profile`, an attacker could claim a victim's `senderId`, sign with their
own key, and repoint the victim's `inbox_address` onto the attacker's key. That
**poisons the `resolveVerifiedSender` reverse-lookup** control-message auth
relies on, escalating a display spoof into remove/edit/pin/mute impersonation of
the victim.

- **Fix**: `isUpdateProfileAuthorized` authorizes against the **verified signer**
  — a key already registered to a member may only update THAT member; a key
  matching no member is accepted as a rotation/bootstrap announcement. The
  handler **never writes the announced key onto the member row** (creates
  display-only rows with an empty `inbox_address`; leaves existing
  `inbox_address` untouched). Authoritative `inbox_address` comes only from the
  verified join control.
- **Location**: `src/services/MessageService.ts` — `isUpdateProfileAuthorized`,
  used by both `update-profile` handlers (`saveMessage` + `addMessage`).
- **Residual (accepted, mobile parity)**: an unregistered key can still set a
  claimed sender's display name/avatar (needed for the missing-join-row
  bootstrap) — cosmetic only, no `inbox_address` poisoning, so no control
  authority.

#### Pin Message Permission

Pin/unpin actions broadcast with full defense-in-depth validation:
- **Sending**: `src/services/MessageService.ts:3100-3232`
- **Receiving (saveMessage)**: `src/services/MessageService.ts:448-523`
- **Receiving (addMessage)**: `src/services/MessageService.ts:882-978`
- **Security Features**:
  - ✅ DMs rejected (pins are Space-only)
  - ✅ Authorized against the **verified ed448 signer**, not payload `senderId` (2026-07-19)
  - ✅ Read-only channel managers can pin
  - ✅ Regular channels require explicit `message:pin` role permission
  - ✅ NO `isSpaceOwner` bypass on receiving side
  - ✅ Pin limit (50) enforced on both sending and receiving sides
  - ✅ Rate limiting via existing message throttle
- **Behavior**: Unauthorized pins silently rejected, attacker only sees their own pin

#### Mute User Permission

Mute/unmute actions with full defense-in-depth validation (added 2025-12-15):
- **Sending**: `src/hooks/business/user/useUserMuting.ts`
- **Receiving**: `src/services/MessageService.ts` (mute/unmute message handlers)
- **Security Features**:
  - ✅ DMs rejected (mute is Space-only)
  - ✅ Self-mute rejected (prevents self-DoS)
  - ✅ Authorized against the **verified ed448 signer**, not payload `senderId` (2026-07-19)
  - ✅ Requires explicit `user:mute` role permission
  - ✅ NO `isSpaceOwner` bypass on receiving side
  - ✅ Replay protection via `muteId` deduplication
  - ✅ Timestamp-based conflict resolution for concurrent mute/unmute
  - ✅ Fail-secure: reject when space data unavailable
- **Behavior**: Unauthorized mutes silently rejected, muted users' messages hidden from honest clients

---

## Cryptographic Security

### End-to-End Encryption

All messages are encrypted using the Quilibrium secure channel protocol:

- **Algorithm**: Ed448 signatures + AES-GCM encryption
- **Key Exchange**: Per-conversation key derivation
- **Forward Secrecy**: Ratcheting key updates
- **Metadata Protection**: Encrypted DHT storage

### Config Key Encryption Layer (Dec 2025)

Hub and sync envelopes support an additional **config key parameter** (X448) for envelope-level encryption:

```typescript
// Sealing hub/sync envelopes with config key
await secureChannel.SealHubEnvelope(
  hubKey.address,
  payload,
  configKey ? {
    type: 'x448',
    public_key: [...hexToSpreadArray(configKey.publicKey)],
    private_key: [...hexToSpreadArray(configKey.privateKey)],
  } : undefined
);

// Unsealing with config key
await secureChannel.UnsealSyncEnvelope(hubKey, envelope, configKey);
await secureChannel.UnsealHubEnvelope(hubKey, envelope, configKey);
```

**Use Cases**:
- **Space operations**: Manifest updates, member notifications
- **Kick operations**: Uses **old** config key so recipients can decrypt before key rotation
- **Sync protocol**: Peer-to-peer sync envelopes include config key encryption

This provides an additional encryption layer on top of the hub key encryption, ensuring only space members with the config key can decrypt certain messages.

### Passkey Authentication

User identity secured via WebAuthn passkeys:
- **No passwords**: Phishing-resistant authentication
- **Device-bound**: Private keys never leave device
- **Biometric**: Optional fingerprint/face unlock

---

## Security Testing

### Attack Scenarios Tested

1. **XSS injection** - HTML/script tags in messages and names
2. **Regex DoS** - Long strings causing catastrophic backtracking
3. **Message flooding** - Rapid message submission
4. **Permission bypass** - DevTools/custom client manipulation
5. **Read-only channel posting** - Unauthorized posts to restricted channels
6. **Mention spam** - Excessive @mentions for notification abuse

### Test Resources

- XSS test snippets: `.agents/tasks/.done/xss-security-test-snippets.txt`
- Security audit: `.temp/client-side-limitations-bypass-audit_2025-12-11.md`

---

## References

### Internal Documentation

- [Input Validation Reference](./input-validation-reference.md) - Detailed validation rules, limits, and implementation patterns

### External Resources

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP Regular Expression DoS](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
- [ReactMarkdown Security](https://github.com/remarkjs/react-markdown#security)

---

**Document Created**: 2025-11-08
**Last Updated**: 2026-07-19
**Major Updates**:
- 2026-07-19: Multi-device — space messages signed with a per-user `signing` key (shared across a user's devices) so verified-signer auth works from second devices; `inbox` stays the per-device mailbox key. See crypto-architecture "Multi-Device Signing"
- 2026-07-19: `update-profile` authorized by verified signer + never writes the announced key onto a member row (closes inbox_address poisoning → control-message impersonation) (#243)
- 2026-07-19: Read-only-channel enforcement completed — verified-signer gate on the durable path and for embed/sticker, plus force-signed read-only sends and composer toggle-hide (#242)
- 2026-07-19: Space control-message + @everyone authorization now keyed on the verified ed448 signer (not payload senderId)
- 2026-01-02: Added config key encryption layer documentation (from qm delta commit)
- 2025-12-15: Added mute user permission with full defense-in-depth validation
- 2025-12-12: Added bookmark limit database-layer validation (defense-in-depth hardening)
- 2025-12-12: Added pin message cross-client synchronization with full defense-in-depth validation
- 2025-12-11: Added receiving-side validation for message length, mentions, read-only channels
- 2025-12-11: Added 2-layer message rate limiting
- 2025-12-11: Restructured as comprehensive security architecture document
