# Comprehensive Privacy & Security Audit - All Features

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Executive Summary

This audit was triggered by the discovery of **plaintext private keys being stored in IndexedDB** (see [006-plaintext-private-keys-bug.md](action-queue/006-plaintext-private-keys-bug.md)). A comprehensive review of all implemented features was conducted to identify similar privacy risks where sensitive data might be stored insecurely.

### Key Findings Summary

| Risk Level | Count | Status |
|------------|-------|--------|
| 🔴 **Critical** | 0 | All resolved |
| 🟠 **High** | 2 | Known issues, documented |
| 🟡 **Medium** | 3 | Acceptable with caveats |
| 🟢 **Low/Informational** | 4 | Design trade-offs |

### Critical Issue (Resolved)
- **Action Queue Private Keys**: Private keys were stored in plaintext in IndexedDB action queue context. **FIXED** in commit `8b23dd54` - keys now pulled from memory at processing time.

---

## Scope & Methodology

### Scope
All features implemented over the past months, as documented in `.agents/docs/`:
- Action Queue system
- Cross-platform key backup
- Config sync system
- User config sync on existing accounts
- Message signing system
- Bookmarks feature
- Kick/Mute user systems
- Offline support
- DM and Space messaging
- All IndexedDB storage patterns
- localStorage usage
- Console logging practices

### Methodology
1. Reviewed all feature documentation in `.agents/docs/`
2. Searched codebase for patterns storing sensitive data
3. Analyzed IndexedDB schema and storage patterns
4. Reviewed localStorage usage
5. Checked for sensitive data in console logs
6. Cross-referenced with cryptographic architecture

---

## Findings

### 🔴 CRITICAL - None Remaining

The only critical issue (plaintext private keys in action queue) has been fixed.

---

### 🟠 HIGH - Known Issues

#### H1: Space Inbox Keys Stored in Plaintext

**Location**: `src/db/messages.ts` - `space_keys` IndexedDB store

**Origin**: ⚠️ **Pre-existing in `develop`** - Present since initial commit (`43f3fa4d`), not introduced by recent feature work.

**Issue**: Space inbox private keys are stored in plaintext in IndexedDB:
```typescript
// space_keys store schema
{
  spaceId: string;
  keyId: string;
  publicKey: string;
  privateKey: string;  // ⚠️ PLAINTEXT
}
```

**Files**:
- `src/db/messages.ts:177` - store creation
- `src/db/messages.ts:938-955` - `saveSpaceKey()` - stores plaintext

**Impact**: If an attacker gains access to IndexedDB (via XSS, physical access, or browser exploit), they can:
- Sign messages as the user in all their spaces
- Decrypt all space message history

**Mitigating Factors**:
- These are per-space keys, not the master identity keys
- Master UserKeyset/DeviceKeyset are encrypted by SDK (double-layer encryption with passkey)
- Space keys are regenerated on certain events (kicks)

**Recommendation**: Consider encrypting space_keys store with user-derived key (similar to SDK's approach for identity keys).

**Status**: Known limitation, documented in [cryptographic-architecture.md](../docs/cryptographic-architecture.md)

---

#### H2: Encryption States Contain Symmetric Keys in Plaintext

**Location**: `src/db/messages.ts` - `encryption_states` IndexedDB store

**Origin**: ⚠️ **Pre-existing in `develop`** - Present since initial commit (`43f3fa4d`), not introduced by recent feature work.

**Issue**: Ratchet session states contain symmetric encryption keys stored in plaintext:
```typescript
interface EncryptionState {
  state: string;      // ⚠️ Contains ratchet keys (serialized JSON)
  timestamp: number;
  conversationId: string;
  inboxId: string;
}
```

**Files**:
- `src/db/messages.ts:158-160` - store creation
- `src/db/messages.ts:862-885` - `saveEncryptionState()`

**Impact**: If an attacker gains access to IndexedDB, they can:
- Decrypt ongoing DM conversations (with that session's keys)
- Decrypt space messages (with that space's ratchet state)

**Mitigating Factors**:
- Forward secrecy: Ratchet advances with each message, old keys become unrecoverable
- Affects only current sessions, not all historical messages
- Space encryption states are regenerated on kicks

**Recommendation**: Consider encrypting encryption_states with user-derived key.

**Status**: Known limitation, documented in [cryptographic-architecture.md](../docs/cryptographic-architecture.md)

---

### 🟡 MEDIUM - Acceptable with Caveats

#### M1: UserConfig Contains Private Keys (When Sync Enabled)

**Location**: `src/db/messages.ts:45-75` - UserConfig type

**Origin**: ⚠️ **Pre-existing in `develop`** - Present since initial commit (`43f3fa4d`), not introduced by recent feature work.

**Issue**: When `allowSync=true`, the `spaceKeys` field in UserConfig contains private keys:
```typescript
spaceKeys?: {
  spaceId: string;
  encryptionState: {...};
  keys: {
    privateKey: string;  // ⚠️ Private key
    publicKey: string;
    // ...
  }[];
}[];
```

**Security Controls in Place**:
1. ✅ **Encrypted in transit**: AES-GCM encrypted before upload
2. ✅ **Signed**: Ed448 signature prevents tampering
3. ✅ **Key derivation**: AES key derived from user's private key (`SHA-512(private_key)[0:32]`)
4. ✅ **User control**: Only syncs when `allowSync=true`

**Files**:
- `src/services/ConfigService.ts:377-379` - key collection
- `src/services/ConfigService.ts` - encryption before sync

**Recommendation**: Current implementation is acceptable. Keys are properly encrypted before leaving the device.

---

#### M2: Clipboard Key Backup on Old Android

**Location**: `src/hooks/platform/files/useKeyBackup.ts`

**Status**: ⚠️ **Not implemented** - Mobile app is not yet released and this feature may never be implemented. Documented here for completeness based on design docs.

**Issue**: On Android 7.0 and below, private keys would be copied to clipboard as fallback:
```typescript
Alert.alert(/* ... */);
Clipboard.setString(keyData);  // ⚠️ Key in clipboard
```

**Documentation**: [cross-platform-key-backup.md](../docs/features/cross-platform-key-backup.md)

**Security Concerns** (if implemented):
- Clipboard history may retain the key
- Other apps may read clipboard
- No automatic clipboard clearing

**Mitigating Factors**:
- Only would affect Android < 8.0 (increasingly rare)
- One-time operation during onboarding
- User would be warned about security implications

**Recommendation**: If ever implemented, consider:
- Auto-clear clipboard after 60 seconds
- Encrypt key with user-provided password before clipboard

---

#### M3: DM Registration Data Not Persisted (Privacy-Preserving Design)

**Location**: `src/hooks/queries/registration/useRegistrationOptional.ts`

**Issue**: Counterparty registration data (public keys, inbox addresses) is only cached in React Query memory, not persisted to IndexedDB.

**Impact**: DM messages fail silently when offline with no prior cache:
- User goes offline → sends DM → closes app → reopens → message lost
- No visual error feedback

**Documentation**: [offline-support.md](../docs/features/offline-support.md), [action-queue.md](../docs/features/action-queue.md)

**Why This Is Acceptable**:
- Storing counterparty registration would be a **privacy leak** - revealing social graph
- Current behavior is fail-secure rather than fail-open
- Space messages work fully offline (different encryption model)

**Related Fix**: [009-dm-offline-registration-persistence-fix.md](action-queue/009-dm-offline-registration-persistence-fix.md)

**Recommendation**: Add user-visible error when DM fails due to missing registration. Consider optional encrypted local cache for DM contacts (opt-in).

---

### 🟢 LOW/INFORMATIONAL

#### L1: localStorage Contains Only Preferences

**Files Reviewed**:
- `src/components/context/ThemeProvider.tsx:47` - `theme`
- `src/components/primitives/theme/ThemeProvider.web.tsx:53,69` - `theme`, `accent-color`
- `src/hooks/business/folders/useFolderStates.ts:33` - folder collapse states
- `src/hooks/business/conversations/useShowHomeScreen.ts:14` - UI preference
- `src/i18n/i18n.ts:33` - `language`
- `src/hooks/business/ui/useAccentColor.ts:44` - `accent-color`

**Finding**: ✅ All localStorage usage is for non-sensitive UI preferences only. No keys, tokens, or PII stored.

---

#### L2: Console Logging - Keyset References

**Files with keyset logging**:
- `src/services/ActionQueueService.ts:82,95,119,121`
- `src/services/ActionQueueHandlers.ts:67,73,524`

**Finding**: ✅ Logs only reference keyset availability (`hasKeyset: true/false`), not actual key content:
```typescript
console.log('[ActionQueue] setUserKeyset called - keyset now available');
console.log('[ActionQueue] getUserKeyset called, hasKeyset:', !!this.userKeyset);
```

The warning at line 121 is a security check that alerts if keyset is incorrectly placed in context:
```typescript
console.warn('[ActionQueue] WARNING: keyset found in context! This should not happen.');
```

**Recommendation**: No action needed. Logging is security-conscious.

---

#### L3: Bookmarks Contain Message Metadata

**Location**: `src/api/quorumApi.ts` - Bookmark type

**Issue**: Bookmarks store metadata about messages:
```typescript
cachedPreview: {
  senderName: string;
  textSnippet: string;
  sourceName: string;  // "Space Name > #channel"
}
```

**Update (2025-12-21)**: Removed unused `senderAddress` field to reduce privacy exposure. Was never used in UI - only `senderName` is displayed.

**Impact**: If an attacker gains IndexedDB access, they can see:
- Which spaces/channels user participates in
- Message snippets (first ~150 chars)
- Sender display names (but not addresses)

**Mitigating Factors**:
- Already encrypted when synced (if `allowSync=true`)
- Local-only data otherwise
- User explicitly chose to bookmark
- No user addresses stored (removed)

**Recommendation**: Consider encrypting bookmark cache locally for defense-in-depth.

---

#### L4: Conversation Metadata Exposes Social Graph

**Location**: `src/db/messages.ts` - conversations store

**Origin**: ⚠️ **Pre-existing in `develop`** - Present since initial commit (`43f3fa4d`), not introduced by recent feature work.

**Issue**: DM conversations store:
- Counterparty address
- Display names
- Last message timestamps
- User icons

**Impact**: If attacker gains IndexedDB access, they can see user's DM contacts.

**Mitigating Factors**:
- This is fundamental to how the messaging app works
- Messages themselves are encrypted
- Metadata exposure is inherent to any messaging system

**Recommendation**: Document as accepted trade-off. Consider encrypted conversation index for high-security mode.

---

## Positive Security Patterns Observed

### ✅ Action Queue Keyset Handling (After Fix)
- Keys pulled from memory at processing time
- Keyset gate prevents processing before auth
- No keys stored in IndexedDB queue

### ✅ Config Sync Encryption
- AES-GCM encryption with user-derived key
- Ed448 signature for integrity
- Privacy toggle (`allowSync`) gives user control

### ✅ SDK Double-Layer Encryption
- Master identity keys protected by SDK
- Outer layer: convenience encryption
- Inner layer: passkey-derived key protection

### ✅ Defense-in-Depth Validation
- Sending-side, service-layer, and receiving-side validation
- Silent rejection of unauthorized actions
- No PII in error messages

### ✅ Minimal localStorage Usage
- Only UI preferences stored
- No sensitive data in localStorage

### ✅ Security-Conscious Logging
- Keyset availability logged, not content
- Warning when keys found in wrong places
- No private keys logged

---

## Recommendations Summary

### High Priority
1. **Consider encrypting `space_keys` store** with user-derived key
2. **Consider encrypting `encryption_states` store** with user-derived key

### Medium Priority
3. **Improve Android <8 clipboard backup** - auto-clear or encrypt before clipboard
4. **Add user-visible error for offline DM failures** - currently fails silently

### Low Priority / Future Consideration
5. **Consider encrypted bookmark cache** - defense-in-depth
6. **Document metadata exposure trade-offs** - social graph visibility is inherent to messaging

---

## Action Items

- [ ] Create task for space_keys encryption (if prioritized)
- [ ] Create task for encryption_states encryption (if prioritized)
- [ ] Update key-backup documentation with clipboard security notes
- [ ] Add user-facing error for offline DM failures
- [ ] Update security.md with these audit findings

---

## Related Documentation

- [006-plaintext-private-keys-bug.md](action-queue/006-plaintext-private-keys-bug.md) - Original bug discovery
- [007-plaintext-private-keys-fix.md](action-queue/007-plaintext-private-keys-fix.md) - Fix implementation
- [cryptographic-architecture.md](../docs/cryptographic-architecture.md) - Key hierarchy and storage
- [security.md](../docs/features/security.md) - Security architecture
- [config-sync-system.md](../docs/config-sync-system.md) - Sync encryption details
- [cross-platform-key-backup.md](../docs/features/cross-platform-key-backup.md) - Backup methods
- [action-queue.md](../docs/features/action-queue.md) - Queue security section
- [privacy-analysis-quorum-2025-12-03.md](privacy-analysis-quorum-2025-12-03.md) - Previous privacy analysis

---

_Created: 2025-12-21_
_Report Type: Security/Privacy Audit_
_Trigger: Discovery of plaintext private keys in action queue (now fixed)_
