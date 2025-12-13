# User Config Sync on Existing Accounts

**Status:** TODO
**Priority:** Medium
**Complexity:** Low (Web-Only) / Medium (Full Cross-Platform)
**Original Feature By:** tjsturos (Tyler Sturos)
**Original Commit:** `a51ea3f663e43957a6b1f477eabe5ae1100c3616`
**Reverted In:** `ab82d8e6e12386a0700511a664700c5eaa8aa467`
**Created:** 2025-10-04


https://github.com/QuilibriumNetwork/quorum-desktop/issues/88

## Problem Statement

When a user logs into an existing account (returning user with saved config), the onboarding flow does not automatically fetch and load their saved profile information (display name, profile image) from the remote config. This creates a poor UX where:

1. **Returning users must re-enter profile info**: Even though their settings are saved remotely
2. **Inconsistent profile data**: Local vs remote config can become desynchronized
3. **No "Resync Settings" option**: Users can't manually trigger a config refresh

## Original Feature (Reverted)

The original implementation by tjsturos added:

1. **Auto-fetch on login**: When a user logged in with an existing account, the onboarding flow would automatically call `getConfig()` to fetch remote settings
2. **Profile pre-population**: Display name and profile image were automatically populated from remote config
3. **Resync button**: Users could manually trigger a config refresh from User Settings modal
4. **Loading state**: Showed "Initializing your profile..." while fetching config

### Why It Was Reverted

The feature was reverted due to **bug `.agents/bugs/messagedb-cross-platform-storage-issue.md`**:

- **Root Cause**: Added `useMessageDB` import to `useOnboardingFlowLogic.ts`, which imported IndexedDB code
- **Impact**: Crashed mobile app on startup with `TypeError: window.addEventListener is not a function`
- **Problem**: IndexedDB APIs don't exist in React Native environment
- **Timing**: Occurred before MessageDB refactoring was completed

## Implementation Strategy

### Chosen Approach: Web-Only with Adapter Pattern (Option A)

Instead of blocking on the full cross-platform crypto abstraction, we use the existing adapter pattern to implement config sync for web only, with mobile gracefully degrading to standard onboarding.

**Why this approach:**
- Delivers value immediately for web users (majority use case)
- Follows established adapter patterns in the codebase (`usePasskeyAdapter.web.ts` / `usePasskeyAdapter.native.ts`)
- Mobile gracefully degrades (skips auto-fetch, proceeds with normal onboarding)
- No risk of mobile crashes - native adapter returns `null`
- Can be enhanced later when crypto abstraction is complete

**Key insight:** `useUserSettings.ts` already successfully imports `useMessageDB` and calls `getConfig()` on web. The same pattern works if we route through the adapter.

---

## Security Requirements

> ⚠️ **Critical**: These security measures must be implemented. Remote config data must be treated as untrusted.

### Input Validation (Zero-Trust)

**Profile Image Validation** - Add `validateProfileImage()` utility:
```typescript
// src/hooks/business/validation/useProfileValidation.ts
const MAX_PROFILE_IMAGE_SIZE = 500 * 1024; // 500KB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateProfileImage(dataUri: string | undefined): boolean {
  if (!dataUri) return false;
  if (!dataUri.startsWith('data:image/')) return false;

  // Estimate base64 decoded size
  const sizeEstimate = (dataUri.length * 3) / 4;
  if (sizeEstimate > MAX_PROFILE_IMAGE_SIZE) return false;

  // Validate MIME type
  const mimeMatch = dataUri.match(/^data:(image\/[^;]+);/);
  if (!mimeMatch || !ALLOWED_IMAGE_TYPES.includes(mimeMatch[1])) return false;

  return true;
}
```

**Display Name Re-validation** - Must re-validate after decryption:
```typescript
// In fetchUserConfig - ALWAYS re-validate remote data
const nameError = validateDisplayName(config.name || '');
const imageValid = validateProfileImage(config.profile_image);

return {
  name: nameError ? undefined : config.name,
  profile_image: imageValid ? config.profile_image : undefined,
};
```

### Session Integrity

**Address Verification** - Verify session owns the requested address:
```typescript
// In usePasskeyAdapter.web.ts fetchUserConfig
if (address !== keyset.userKeyset.user_key.address) {
  console.error('Address mismatch: session hijacking attempt detected');
  return null;
}
```

### Rate Limiting

**Client-side Throttling** - Prevent API spam:
```typescript
const lastFetchTime = useRef<number>(0);
const MIN_FETCH_INTERVAL = 5000; // 5 seconds

const fetchUserConfig = useCallback(async (address: string) => {
  const now = Date.now();
  if (now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
    console.warn('Config fetch throttled');
    return null;
  }
  lastFetchTime.current = now;
  // ... rest of function
}, []);
```

### Privacy Protection

**Remove PII from Logs** - Update `ConfigService.ts` line 374:
```typescript
// BEFORE (exposes PII):
console.log('syncing config', config);

// AFTER (safe):
console.log('syncing config', {
  address: config.address,
  timestamp: config.timestamp,
  spaceCount: config.spaceIds?.length,
  // DO NOT log: name, profile_image, bookmarks
});
```

### Error Handling Strategy

| Context | Behavior |
|---------|----------|
| Auto-fetch (onboarding) | Silent failure with `console.warn`, return `null` |
| Manual resync (settings) | Show user-friendly toast/error message |
| Crypto/signature errors | Generic message in production, detailed in dev |

---

## Implementation Plan

### Phase 1: Update UserConfig Type and Persistence

**Goal**: Add profile fields to UserConfig and persist them on save

**Files to modify:**
- `src/db/messages.ts`
- `src/utils.ts`
- `src/hooks/business/user/useUserSettings.ts`
- `src/hooks/business/validation/useProfileValidation.ts` (NEW)

**Tasks:**

1. **Update UserConfig type** in `src/db/messages.ts`
   - [ ] Add `name?: string` field
   - [ ] Add `profile_image?: string` field

2. **Update default config** in `src/utils.ts`
   - [ ] Add empty `name` and `profile_image` to `getDefaultUserConfig()`

3. **Create profile validation utility** in `src/hooks/business/validation/useProfileValidation.ts`
   - [ ] Add `validateProfileImage(dataUri)` - 500KB max, image/* MIME only
   - [ ] Export for use in config loading and saving paths

4. **Update useUserSettings to persist profile to config**
   - [ ] In `saveChanges()`, add `name` and `profile_image` to config:
     ```typescript
     await saveConfig({
       config: {
         ...existingConfig.current!,
         allowSync,
         nonRepudiable: nonRepudiable,
         name: displayName,                    // ADD
         profile_image: profileImageUrl,       // ADD
       },
       keyset: keyset,
     });
     ```
   - [ ] Ensure backward compatibility (existing configs without these fields)

**Validation:**
- ✅ TypeScript compiles without errors
- ✅ Existing configs without new fields still work
- ✅ New configs include profile data
- ✅ `validateProfileImage()` rejects oversized/invalid images

---

### Phase 2: Extend OnboardingAdapter Interface

**Goal**: Add config fetch capability to the adapter pattern with security controls

**Files to modify:**
- `src/hooks/business/user/useOnboardingFlowLogic.ts` (interface only)
- `src/hooks/platform/user/usePasskeyAdapter.web.ts`
- `src/hooks/platform/user/usePasskeyAdapter.native.ts`

**Tasks:**

1. **Extend OnboardingAdapter interface** in `useOnboardingFlowLogic.ts`
   ```typescript
   export interface OnboardingAdapter {
     currentPasskeyInfo: PasskeyInfo | null;
     updateStoredPasskey: (credentialId: string, updates: Partial<PasskeyInfo>) => void;
     // NEW: Optional config fetch - returns null if not supported (mobile)
     fetchUserConfig?: (address: string) => Promise<{ name?: string; profile_image?: string } | null>;
   }
   ```

2. **Implement in web adapter** (`usePasskeyAdapter.web.ts`)
   - [ ] Import `useMessageDB` to access `getConfig`
   - [ ] Import `useRegistrationContext` to access `keyset`
   - [ ] Import `validateDisplayName` and `validateProfileImage`
   - [ ] Add rate limiting ref
   - [ ] Implement `fetchUserConfig()` with security controls:
     ```typescript
     import { useMessageDB } from '../../../components/context/useMessageDB';
     import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
     import { validateDisplayName } from '../../business/validation/useDisplayNameValidation';
     import { validateProfileImage } from '../../business/validation/useProfileValidation';

     // Inside hook:
     const { getConfig } = useMessageDB();
     const { keyset } = useRegistrationContext();
     const lastFetchTime = useRef<number>(0);
     const MIN_FETCH_INTERVAL = 5000;

     const fetchUserConfig = useCallback(async (address: string) => {
       // Rate limiting
       const now = Date.now();
       if (now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
         return null;
       }
       lastFetchTime.current = now;

       // Session integrity check
       if (address !== keyset.userKeyset?.user_key?.address) {
         console.error('Address mismatch detected');
         return null;
       }

       try {
         const config = await getConfig({ address, userKey: keyset.userKeyset });
         if (config?.name || config?.profile_image) {
           // CRITICAL: Re-validate all remote data (zero-trust)
           const nameError = validateDisplayName(config.name || '');
           const imageValid = validateProfileImage(config.profile_image);

           return {
             name: nameError ? undefined : config.name,
             profile_image: imageValid ? config.profile_image : undefined,
           };
         }
         return null;
       } catch (error) {
         console.warn('Failed to fetch user config');
         return null;
       }
     }, [getConfig, keyset.userKeyset]);
     ```
   - [ ] Add to returned adapter object

3. **Implement stub in native adapter** (`usePasskeyAdapter.native.ts`)
   - [ ] Add `fetchUserConfig: async () => null` (no-op, graceful degradation)

**Validation:**
- ✅ Web adapter can fetch config and return profile data
- ✅ Native adapter returns null without errors
- ✅ No IndexedDB/browser API imports in native adapter
- ✅ Rate limiting prevents rapid re-fetches
- ✅ Address verification prevents session hijacking
- ✅ XSS/injection attacks blocked by re-validation

---

### Phase 3: Update Onboarding Flow Logic

**Goal**: Add loading state and config fetch to onboarding state machine

**Files to modify:**
- `src/hooks/business/user/useOnboardingFlowLogic.ts`

**UX Design Decision**: The `'loading'` step is a **transitional state** that:
- Shows "Initializing your profile..." during fetch
- Immediately transitions to `'key-backup'` when fetch completes (success or failure)
- Should NOT block the user if fetch fails or returns null

**Tasks:**

1. **Add loading step to state machine**
   ```typescript
   export type OnboardingStep =
     | 'loading'        // NEW: Fetching user config (transitional)
     | 'key-backup'
     | 'display-name'
     | 'profile-photo'
     | 'complete';
   ```

2. **Add state for config fetching**
   - [ ] Add `isFetchingConfig` state (boolean)
   - [ ] Add `configFetched` state (boolean, prevents re-fetching)

3. **Create fetchUserConfig function**
   ```typescript
   const fetchUserConfig = useCallback(async () => {
     // Guard: only fetch if adapter supports it, we have an address, and haven't fetched yet
     if (!adapter.fetchUserConfig || !currentPasskeyInfo?.address || configFetched) {
       setConfigFetched(true); // Mark as "attempted" even if skipped
       return;
     }

     setIsFetchingConfig(true);
     try {
       const config = await adapter.fetchUserConfig(currentPasskeyInfo.address);
       if (config) {
         if (config.name) setDisplayName(config.name);
         if (config.profile_image) {
           updateStoredPasskey(currentPasskeyInfo.credentialId, {
             ...currentPasskeyInfo,
             displayName: config.name || currentPasskeyInfo.displayName,
             pfpUrl: config.profile_image,
           });
         }
       }
     } catch (error) {
       // Silent failure - proceed with normal onboarding
       console.warn('Config fetch failed, proceeding with onboarding');
     } finally {
       setIsFetchingConfig(false);
       setConfigFetched(true);
     }
   }, [adapter, currentPasskeyInfo, configFetched, updateStoredPasskey]);
   ```

4. **Update getCurrentStep to handle loading**
   ```typescript
   const getCurrentStep = useCallback((): OnboardingStep => {
     if (isFetchingConfig) return 'loading';
     // ... rest of existing logic
   }, [isFetchingConfig, exported, currentPasskeyInfo?.displayName, currentPasskeyInfo?.pfpUrl]);
   ```

5. **Export new values**
   - [ ] Export `fetchUserConfig` function
   - [ ] Export `isFetchingConfig` state
   - [ ] Export `configFetched` state

**Validation:**
- ✅ Loading state shown during config fetch
- ✅ Profile data pre-populated when available
- ✅ Graceful fallback when fetch fails or returns null
- ✅ No re-fetching after initial attempt
- ✅ Immediate transition to key-backup if fetch fails/skipped

---

### Phase 4: Update Onboarding UI Component

**Goal**: Integrate config fetch into onboarding UI

**Files to modify:**
- `src/components/onboarding/Onboarding.tsx`

**Tasks:**

1. **Trigger config fetch on mount with guards**
   ```typescript
   useEffect(() => {
     // Only fetch at the start of onboarding, when we have an address
     if (
       onboardingFlow.currentPasskeyInfo?.address &&
       !onboardingFlow.configFetched &&
       !onboardingFlow.isFetchingConfig &&
       onboardingFlow.currentStep === 'key-backup' // Only at start
     ) {
       onboardingFlow.fetchUserConfig();
     }
   }, [
     onboardingFlow.currentPasskeyInfo?.address,
     onboardingFlow.configFetched,
     onboardingFlow.isFetchingConfig,
     onboardingFlow.currentStep
   ]);
   ```

2. **Add loading UI**
   ```typescript
   {onboardingFlow.currentStep === 'loading' && (
     <LoadingState message={t`Initializing your profile...`} />
   )}
   ```

3. **Wrap existing steps with loading check**
   - [ ] Only render step content when not loading

**Validation:**
- ✅ Loading message displayed during fetch
- ✅ Smooth transition to next step after fetch
- ✅ Works correctly for both new and returning users
- ✅ No race conditions - fetch only triggers once at start

---

### Phase 5: Add Manual Resync Option (Optional Enhancement)

**Goal**: Allow users to manually refresh their config from User Settings

**Files to modify:**
- `src/hooks/business/user/useUserSettings.ts`
- `src/components/modals/UserSettingsModal.tsx`

**Tasks:**

1. **Add resync function to useUserSettings**
   - [ ] Create `resyncConfig()` function
   - [ ] Fetch remote config with `getConfig()`
   - [ ] Re-validate fetched data (zero-trust)
   - [ ] Update local state (allowSync, nonRepudiable, displayName)
   - [ ] Add `isResyncing` loading state

2. **Add Resync button to UserSettingsModal**
   - [ ] Only show when `allowSync === true`
   - [ ] Add tooltip: "This will override your locally stored settings with remote config"
   - [ ] Show loading state during resync
   - [ ] Handle errors with user-friendly toast messages (NOT silent like auto-fetch)

**Validation:**
- ✅ Button appears only when sync is enabled
- ✅ Clicking button refreshes settings from remote
- ✅ Loading state shown during operation
- ✅ Success toast on completion
- ✅ Error toast with user-friendly message on failure

---

### Phase 6: Security Hardening

**Goal**: Address remaining security concerns

**Files to modify:**
- `src/services/ConfigService.ts`

**Tasks:**

1. **Remove PII from logs** (line 374)
   - [ ] Redact `name`, `profile_image`, `bookmarks` from console.log

2. **Improve error handling** (lines 53-62)
   - [ ] Differentiate between 404 (no config) vs network/other errors
   - [ ] Log appropriate context without exposing crypto internals

3. **Add security tests**
   - [ ] Test: Reject oversized profile images (>500KB)
   - [ ] Test: Reject non-image data URIs
   - [ ] Test: Reject XSS in display name from remote config
   - [ ] Test: Rate limiting prevents rapid fetches
   - [ ] Test: Address mismatch is rejected

---

## Future Enhancement: Full Cross-Platform Support (Option B)

When mobile parity is needed, implement cross-platform crypto abstraction:

### Prerequisites
- Create `src/utils/platform/crypto.web.ts` using `window.crypto.subtle`
- Create `src/utils/platform/crypto.native.ts` using `expo-crypto` / `react-native-crypto`
- Unified API: `deriveKey()`, `encrypt()`, `decrypt()`, `importKey()`
- Refactor `ConfigService.ts` to use crypto abstraction

### Tasks
1. **Audit ConfigService.ts crypto usage**
   - Lines 73-87: `crypto.subtle.digest()` and `window.crypto.subtle.importKey()`
   - Lines 120-125: `window.crypto.subtle.decrypt()`
   - Lines 380-395: `crypto.subtle.digest()` and `window.crypto.subtle.importKey()`
   - Lines 452-458: `window.crypto.subtle.encrypt()`

2. **Create platform-agnostic crypto utilities**
   - Mobile already has `react-native-crypto` and `react-native-get-random-values` installed
   - Create unified abstraction layer

3. **Update native adapter**
   - Implement full `fetchUserConfig()` using cross-platform crypto
   - Remove no-op stub

### Estimated Effort
- Crypto abstraction: 4-6 hours
- ConfigService refactor: 2-3 hours
- Native adapter implementation: 2-3 hours
- Testing: 3-4 hours
- **Total: 11-16 hours**

---

## Summary

| Phase | Description | Scope | Effort |
|-------|-------------|-------|--------|
| **Phase 1** | Update UserConfig type & persistence + validation utility | Shared | ~45 min |
| **Phase 2** | Extend OnboardingAdapter interface with security | Web + Native stub | ~1.5 hours |
| **Phase 3** | Update onboarding flow logic | Shared | ~1 hour |
| **Phase 4** | Update onboarding UI | Shared | ~30 min |
| **Phase 5** | Manual resync option (optional) | Web | ~1 hour |
| **Phase 6** | Security hardening + tests | Shared | ~1 hour |
| **Total (Web-Only)** | | | **~6 hours** |
| **Future: Option B** | Full cross-platform | Web + Native | **~12-16 hours** |

---

## Validation Checklist

### Web - Functional
- [ ] Returning user sees "Initializing your profile..." on login
- [ ] Display name pre-populated from remote config
- [ ] Profile image pre-populated from remote config
- [ ] New user completes normal onboarding flow
- [ ] Config save includes name and profile_image
- [ ] Resync button works in User Settings (if implemented)

### Web - Security
- [ ] Oversized profile images (>500KB) are rejected
- [ ] Non-image data URIs are rejected
- [ ] XSS in display name from remote config is sanitized/rejected
- [ ] Rapid refresh attempts are rate-limited (5s minimum)
- [ ] Address mismatch triggers error, not data fetch
- [ ] Console logs do not contain PII (name, profile_image)

### Mobile (Graceful Degradation)
- [ ] App launches without crash
- [ ] `fetchUserConfig` returns null immediately (no async delay)
- [ ] No "Initializing your profile..." shown (skips fetch)
- [ ] Onboarding proceeds directly to key-backup step
- [ ] Normal onboarding flow works
- [ ] No console errors related to IndexedDB/crypto

---

## Security Risk Assessment

| Risk | Level | Status |
|------|-------|--------|
| Data URI Injection (oversized/malicious images) | 🔴 Critical | Mitigated by `validateProfileImage()` |
| XSS via display name bypass | 🟠 High | Mitigated by re-validation after decryption |
| Session hijacking via address mismatch | 🟠 High | Mitigated by address verification |
| Privacy leakage in logs | 🟠 High | Mitigated by PII redaction |
| API spam / DoS | 🟡 Medium | Mitigated by rate limiting |
| Information disclosure via errors | 🟢 Low | Mitigated by generic error messages |

---

## References

### Original Commit Details

**Commit**: `a51ea3f663e43957a6b1f477eabe5ae1100c3616`
**Author**: Tyler Sturos <55340199+tjsturos@users.noreply.github.com>
**Date**: Wed Aug 13 19:24:26 2025 -0800
**Message**: "load user settings/config for existing accounts"

**Files Changed** (8 files, 186 insertions, 31 deletions):
- `src/components/context/MessageDB.tsx` (+7, -2)
- `src/components/modals/UserSettingsModal.tsx` (+35, -1)
- `src/components/onboarding/Onboarding.tsx` (+53, -18)
- `src/db/messages.ts` (+2, 0)
- `src/hooks/business/user/useOnboardingFlowLogic.ts` (+101, -7)
- `src/hooks/business/user/useUserSettings.ts` (+5, -1)
- `src/hooks/platform/user/usePasskeyAdapter.web.ts` (+12, -2)
- `src/utils.ts` (+2, 0)

### Revert Commit Details

**Commit**: `ab82d8e6e12386a0700511a664700c5eaa8aa467`
**Author**: lamat1111 <65860122+lamat1111@users.noreply.github.com>
**Date**: Mon Sep 1 10:23:32 2025 +0200
**Message**: "Revert 'load user settings/config for existing accounts'"
**Reason**: Mobile app crash due to IndexedDB usage in cross-platform code

### Architecture Documentation

- `.agents/docs/data-management-architecture-guide.md` - Current MessageDB architecture
- `.agents/tasks/.done/DONE_messagedb-refactoring.md` - Refactoring details
- `.agents/bugs/messagedb-cross-platform-storage-issue.md` - Cross-platform storage bug

### Security Analysis

This task was reviewed by the security-analyst agent on 2025-12-13. Key findings:
- ✅ Existing crypto (Ed448 + AES-GCM) is solid
- ⚠️ Data validation needed for remote config (zero-trust)
- ⚠️ PII logging must be removed
- ⚠️ Rate limiting recommended

---

_Created: 2025-10-04_
_Last Updated: 2025-12-13_
_Security Review: 2025-12-13_
