# 009: Persist DM Registration Data for Full Offline Support

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Status**: Pending
**Complexity**: Medium-High (increased due to security requirements)
**Created**: 2025-12-20
**Last Updated**: 2025-12-21
**Files**:
- `src/db/messages.ts` - Add user_registrations store (schema v8)
- `src/hooks/queries/registration/buildRegistrationFetcher.ts` - Cache-first fetching logic
- `src/hooks/queries/registration/useRegistration.ts` - Save to IndexedDB on fetch
- `src/hooks/queries/registration/useRegistrationOptional.ts` - Load from IndexedDB first
- `src/components/direct/DirectMessage.tsx:226` - Silent fail location
- `src/services/ActionQueueHandlers.ts:501-730` - DM message handling with registration context

## What & Why

**Current State**: DM messages fail silently after page refresh when offline because counterparty registration data (public keys, inbox addresses) is only cached in React Query memory.

**Desired State**: DM messages work fully offline like Space messages - users can send messages, close the app, reopen it offline, and messages will queue and send when back online.

**Value**: Consistent offline UX between Spaces and DMs. Currently, Space messages survive app restart but DM messages don't, which is confusing and can lead to lost messages.

## Context

- **Existing pattern**: Space encryption keys are stored in IndexedDB (`space_keys` store) and survive refresh
- **Current limitation**: `UserRegistration` data is fetched via API and cached only in React Query (memory)
- **Root cause**: Registration data was not prioritized for offline support during initial implementation

**Related Documentation**:
- [Action Queue - Offline Support Summary](../../docs/features/action-queue.md#why-space-messages-work-fully-offline-but-dm-messages-dont)
- [Offline Support](../../docs/features/offline-support.md)

**Related Work**:
- [007-plaintext-private-keys-fix.md](007-plaintext-private-keys-fix.md) - Creates shared encryption utilities (`src/utils/encryption.ts`) that this task can reuse

---

## Analysis Complete ✅

### Feature Analysis (2025-12-20)

**Current Infrastructure Assessment:**
- ✅ Action queue infrastructure already handles offline DM message sending
- ✅ Registration hooks (`useRegistration`, `useRegistrationOptional`) work correctly
- ✅ IndexedDB schema (v7) is well-organized with 7 object stores
- ✅ Silent failure handling exists at `DirectMessage.tsx:226-228`
- ❌ NO IndexedDB persistence for UserRegistration data
- ❌ Registration data only lives in React Query cache (memory)
- ❌ Page refresh = data loss when offline

**Data Structure Verification:**
- `UserRegistration` contains: `user_address`, `device_registrations[]`, `user_keyset`
- ✅ No circular references - serializable to JSON
- ✅ Storage size: ~2-5KB per cached registration (negligible)
- ✅ Both `self` and `counterparty` registrations can be cached

**What Currently Works:**
- DM messages queued in action queue include full context with `self` and `counterparty` UserRegistration
- Encryption happens in the handler using queued registration data
- This works for messages queued BEFORE going offline

**What Fails:**
- After page refresh offline, React Query cache is empty
- New messages can't be encrypted without registration data
- Silent `console.warn` with no user feedback

### Security Analysis (2025-12-20)

> **⚠️ CRITICAL SECURITY CONCERNS IDENTIFIED**

The security analyst identified that `user_registrations` is **NOT equivalent** to `space_keys`:

| Aspect | space_keys (Precedent) | user_registrations (Proposed) |
|--------|------------------------|-------------------------------|
| Contains | Private keys (necessary) | Public keys + network IDs |
| Metadata sensitivity | Low (space participation) | **Critical** (social graph) |
| Attack value | Limited | **High** (communication mapping) |

**Critical Issues:**

1. **Unencrypted Public Keys** (High)
   - Enables device fingerprinting and cross-session user correlation
   - Adversary with local access can build social graph of contacts

2. **Inbox Address Metadata Leakage** (Critical)
   - Inbox addresses are persistent network identifiers
   - Creates communication map extractable from device/backups
   - Enables traffic analysis and surveillance

3. **Stale Registration Data Attack Vector** (High)
   - No expiration = key rotation bypass vulnerability
   - Messages sent to old keys silently fail

4. **No Secure Deletion Mechanism** (Medium)
   - Data persists after logout
   - Extractable from device backups

**Threat Model:**

| Adversary | Risk Level |
|-----------|------------|
| Malware on device | **Critical** |
| Physical device access | **Critical** |
| Malicious browser extension | **High** |
| Forensic analysis (backups) | **High** |

**DO NOT follow unencrypted `space_keys` pattern** - different threat model applies.

---

## Security Requirements (Mandatory)

Based on security analysis, these are **non-negotiable** requirements:

### 1. Encryption at Rest (Required)
```typescript
interface EncryptedRegistration {
  user_address: string;     // Index key (unencrypted for lookup)
  encrypted_data: string;   // AES-GCM encrypted payload
  iv: string;               // Initialization vector
  cachedAt: number;         // For expiration checking
}
```
- Encrypt using AES-GCM with passkey-derived key
- Use Web Crypto API (already used for config encryption in codebase)

### 2. Cache Expiration (Required)
- **TTL: 7 days** - automatic expiration
- Prune expired entries on app start
- When online: background refresh before expiry
- When offline: use cached even if stale (with warning)

### 3. Secure Deletion (Required)
- Clear all cached registrations on logout
- Delete specific registration when DM conversation deleted
- Implement `clearAllUserRegistrations()` method

### 4. Minimal Data Storage (Required)
Store only what's needed for offline encryption:
```typescript
// DO store:
- inbox_addresses (for Double Ratchet session)
- user_public_key (for key agreement)

// DO NOT store:
- Full device_registrations detail
- peer_public_key
- signatures
```

---

## Proposed Implementation (Updated)

### Phase 1: Database Schema
- [ ] **Add `user_registrations_encrypted` store to IndexedDB** (`src/db/messages.ts`)
  - Bump schema version to 8
  - Key by `user_address`
  - Store encrypted `EncryptedRegistration` object
  - Add index on `cachedAt` for expiration queries
  ```typescript
  if (event.oldVersion < 8) {
    const registrationCache = db.createObjectStore('user_registrations_encrypted', {
      keyPath: 'user_address',
    });
    registrationCache.createIndex('by_cached_at', 'cachedAt');
  }
  ```

### Phase 2: Encryption Helpers
- [ ] **Reuse shared encryption utilities** from `src/utils/encryption.ts` (created by action queue fix [007](007-plaintext-private-keys-fix.md))
  - `getOrDeriveAesKey(userKeyset)` - derive AES key from user's private key (cached)
  - `encryptContext(data, aesKey)` - AES-GCM encryption
  - `decryptContext(encrypted, iv, aesKey)` - AES-GCM decryption
  - Wrap with registration-specific helpers if needed:
    - `encryptRegistration(registration, userKeyset)` - encrypt before storage
    - `decryptRegistration(encrypted, userKeyset)` - decrypt on load

### Phase 3: Persistence Methods
- [ ] **Add IndexedDB methods** (`src/db/messages.ts`)
  - `saveUserRegistration(address, registration, userKeyset)` - encrypt and store
  - `getUserRegistration(address, userKeyset)` - load and decrypt
  - `deleteUserRegistration(address)` - remove single entry
  - `clearAllUserRegistrations()` - logout cleanup
  - `pruneExpiredRegistrations(cutoffTimestamp)` - remove stale entries

### Phase 4: Update Fetcher
- [ ] **Cache-first logic in fetcher** (`src/hooks/queries/registration/buildRegistrationFetcher.ts`)
  ```typescript
  async function fetchRegistration(address, messageDB, userKeyset) {
    // 1. Try IndexedDB first
    const cached = await messageDB.getUserRegistration(address, userKeyset);

    // 2. Check expiration (7 days)
    if (cached && !isExpired(cached.cachedAt)) {
      return { registration: cached.registration, registered: true, fromCache: true };
    }

    // 3. Try API
    try {
      const response = await apiClient.getUser(address);
      await messageDB.saveUserRegistration(address, response.data, userKeyset);
      return { registration: response.data, registered: true };
    } catch (e) {
      // 4. Offline fallback - use cached even if stale
      if (cached) {
        console.warn(`Using stale cached registration for ${address}`);
        return { registration: cached.registration, registered: true, stale: true };
      }
      if (e.status === 404) return { registered: false };
      throw e;
    }
  }
  ```

### Phase 5: Lifecycle Hooks
- [ ] **Add logout cleanup** (wherever logout is handled)
  - Call `messageDB.clearAllUserRegistrations()` on logout
- [ ] **Add startup cleanup** (app initialization)
  - Call `messageDB.pruneExpiredRegistrations(Date.now() - 7 * 24 * 60 * 60 * 1000)`

### Phase 6: UX Improvement
- [ ] **Replace silent fail with user feedback** (`src/components/direct/DirectMessage.tsx:226`)
  - Show warning toast: "Unable to send messages while offline. Connect to refresh registration data."
  - Consider disabling composer with tooltip when registration unavailable
  - Add visual indicator when using stale cached data

---

## Verification

### Functional Tests
- [ ] **DM sends survive page refresh**
  - Test: Open DM online → go offline → send message → refresh → come back online → message sends

- [ ] **New DM conversations still require online**
  - Test: Starting a conversation with someone you've never messaged still needs network

- [ ] **TypeScript compiles**
  - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

- [ ] **No regression in online behavior**
  - Test: Normal DM flow works unchanged when online

### Security Tests
- [ ] **Encryption verification**
  - Inspect IndexedDB in DevTools - confirm no plaintext keys visible
  - Verify `encrypted_data` field contains ciphertext

- [ ] **Cache expiration**
  - Set short TTL for testing, verify entries are pruned after expiry

- [ ] **Logout cleanup**
  - Logout and verify `user_registrations_encrypted` store is empty

- [ ] **Stale key handling**
  - Test behavior when counterparty rotates keys
  - Verify graceful degradation with user feedback

- [ ] **Malware simulation**
  - Test XSS/extension access to IndexedDB (should only get ciphertext)

### Performance Tests
- [ ] **Memory usage acceptable**
  - UserRegistration is ~2-5KB per user
  - Typical user: 10-50 contacts = 20-250KB total

- [ ] **Query performance**
  - IndexedDB lookup by `user_address` should be O(1)

---

## Definition of Done
- [x] Codebase analysis completed (feature analyzer - 2025-12-20)
- [x] Security analysis completed (security analyst - 2025-12-20)
- [ ] Phase 1: Database schema implemented
- [ ] Phase 2: Encryption helpers implemented
- [ ] Phase 3: Persistence methods implemented
- [ ] Phase 4: Fetcher updated with cache-first logic
- [ ] Phase 5: Lifecycle hooks (logout/startup cleanup)
- [ ] Phase 6: UX improvement (user feedback)
- [ ] All functional tests pass
- [ ] All security tests pass
- [ ] Documentation updated (action-queue.md, offline-support.md)
- [ ] No console errors

---

## Appendix: Security Recommendations Summary

### Mandatory (Must Have)
1. ✅ Encrypt all registration data using AES-GCM with passkey-derived key
2. ✅ Implement 7-day cache TTL with automatic expiration
3. ✅ Add logout handler to clear all cached registrations
4. ✅ Store only minimal data needed (inbox addresses + user public key)
5. ✅ Add cache validation on encryption failures (detect stale keys)

### Recommended (Should Have)
6. Implement secure deletion mechanism
7. Add user-visible cache status in settings
8. Log cache events for security auditing
9. Implement forced refresh on key rotation detection
10. Add warning UI when using cached (potentially stale) data

### Optional (Nice to Have)
11. Device fingerprint minimization (store only active inbox)
12. Differential privacy for cached timestamps
13. Encrypted backup/export functionality
14. Admin console for cache inspection/debugging

---

_Created: 2025-12-20_
_Last Updated: 2025-12-21 - Moved from tasks to action-queue reports_
