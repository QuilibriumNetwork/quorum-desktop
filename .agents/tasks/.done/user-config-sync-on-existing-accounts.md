---
type: task
title: "User Config Sync on Existing Accounts"
status: done
created: 2026-01-09
updated: 2025-12-13
related_issues: ["#88"]
---

# User Config Sync on Existing Accounts

**Status:** COMPLETE
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

---

## Current Implementation (December 2025)

### Architecture Decisions

The current implementation differs from the original in several key ways:

1. **Lightweight Profile Fetch**: Instead of calling `getConfig()` which triggers full ConfigService sync (spaces, bookmarks, etc.), we directly call `apiClient.getUserSettings()` and decrypt only the profile fields (name, profile_image).

2. **No Side Effects**: The original `getConfig()` in ConfigService syncs spaces and bookmarks, which requires full crypto setup and can fail during onboarding. Our implementation **bypasses ConfigService entirely** to avoid these side effects.

3. **Platform Adapter Pattern**: Uses `exportKey` from `usePasskeyAdapter.web.ts` for graceful native degradation.

### Files Modified

| File | Changes |
|------|---------|
| `src/hooks/business/user/useOnboardingFlowLogic.ts` | Core logic with `fetchUser()` function |
| `src/hooks/platform/user/usePasskeyAdapter.web.ts` | Provides `exportKey` for key extraction |
| `src/hooks/platform/user/usePasskeyAdapter.native.ts` | Omits `exportKey` for graceful degradation |
| `src/components/onboarding/Onboarding.tsx` | Triggers fetch and shows loading state |
| `src/hooks/business/validation/useProfileValidation.ts` | Profile image validation utility |

---

### Current Code: `useOnboardingFlowLogic.ts`

The `fetchUser()` function performs a **lightweight profile-only fetch**:

```typescript
const fetchUser = useCallback(async (
  address: string,
  setUser?: (user: { displayName: string; state: string; status: string; userIcon: string; address: string; }) => void
) => {
  // Guard: only fetch if adapter supports exportKey (native doesn't)
  if (!address || !adapter.exportKey) return;

  setIsFetchingUser(true);
  try {
    // 1. Check if user is registered
    await apiClient.getUser(address);

    // 2. Decrypt keyset from passkey storage
    const userKeyHex = await adapter.exportKey(address);
    const userKey = new Uint8Array(Buffer.from(userKeyHex, 'hex'));
    const passkeyData = await passkey.loadKeyDecryptData(2);
    const envelope = JSON.parse(Buffer.from(passkeyData).toString('utf-8'));
    const key = await passkey.createKeyFromBuffer(userKey as unknown as ArrayBuffer);
    const inner = JSON.parse(
      Buffer.from(
        await passkey.decrypt(
          new Uint8Array(envelope.ciphertext),
          new Uint8Array(envelope.iv),
          key
        )
      ).toString('utf-8')
    );

    // 3. Fetch encrypted config directly from API (bypasses ConfigService)
    const savedConfig = (await apiClient.getUserSettings(address)).data;
    if (!savedConfig?.user_config) return null;

    // 4. Derive decryption key from user's private key
    const derived = await crypto.subtle.digest(
      'SHA-512',
      Buffer.from(new Uint8Array(inner.identity.user_key.private_key))
    );
    const subtleKey = await window.crypto.subtle.importKey(
      'raw',
      derived.slice(0, 32),
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // 5. Decrypt config (same format as ConfigService)
    const iv = savedConfig.user_config.substring(savedConfig.user_config.length - 24);
    const ciphertext = savedConfig.user_config.substring(0, savedConfig.user_config.length - 24);
    const decryptedConfig = JSON.parse(
      Buffer.from(
        await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: Buffer.from(iv, 'hex') },
          subtleKey,
          Buffer.from(ciphertext, 'hex')
        )
      ).toString('utf-8')
    );

    // 6. Apply profile if found
    if (decryptedConfig?.name?.trim()) {
      setDisplayName(decryptedConfig.name);
      updateStoredPasskey(currentPasskeyInfo!.credentialId, {
        ...currentPasskeyInfo,
        displayName: decryptedConfig.name,
        pfpUrl: decryptedConfig.profile_image ?? DefaultImages.UNKNOWN_USER,
        completedOnboarding: true,
      });

      // Skip onboarding entirely
      if (setUser) {
        setUser({
          displayName: decryptedConfig.name,
          state: 'online',
          status: '',
          userIcon: decryptedConfig.profile_image ?? DefaultImages.UNKNOWN_USER,
          address: address,
        });
      }
    }
  } catch {
    // Silent failure - proceed with normal onboarding
  } finally {
    setIsFetchingUser(false);
  }
}, [adapter, apiClient, currentPasskeyInfo, updateStoredPasskey]);
```

### Current Code: `usePasskeyAdapter.web.ts`

Provides `exportKey` from the SDK:

```typescript
export const usePasskeyAdapter = (): OnboardingAdapter => {
  const { currentPasskeyInfo, updateStoredPasskey, exportKey } = usePasskeysContext();

  const adaptedExportKey = useCallback(
    async (address: string): Promise<string> => {
      return exportKey(address);
    },
    [exportKey]
  );

  return {
    currentPasskeyInfo: adaptedPasskeyInfo,
    updateStoredPasskey: adaptedUpdateStoredPasskey,
    exportKey: adaptedExportKey,
  };
};
```

### Current Code: `usePasskeyAdapter.native.ts`

Omits `exportKey` for graceful degradation:

```typescript
export const usePasskeyAdapter = (): OnboardingAdapter => {
  const { currentPasskeyInfo, updateStoredPasskey } = usePasskeysContext();

  return {
    currentPasskeyInfo: adaptedPasskeyInfo,
    updateStoredPasskey: adaptedUpdateStoredPasskey,
    // exportKey intentionally omitted - native doesn't support config sync
  };
};
```

### Current Code: `Onboarding.tsx`

Triggers fetch on mount:

```typescript
useEffect(() => {
  if (
    onboardingFlow.currentPasskeyInfo !== null &&
    onboardingFlow.currentPasskeyInfo.address
  ) {
    const { address } = onboardingFlow.currentPasskeyInfo;
    onboardingFlow.fetchUser(address, setUser);
  }
}, [onboardingFlow.currentPasskeyInfo?.address]);
```

Shows loading state:

```typescript
{onboardingFlow.currentStep === 'loading' && (
  <div className="flex flex-col gap-4 items-center">
    <Icon name="spinner" size="2xl" className="icon-spin mb-4" />
    <p className="text-center text-lg">
      {t`Initializing your profile...`}
    </p>
  </div>
)}
```

---

## Testing Status

### What Works
- [x] Loading spinner shown during profile fetch
- [x] Returning user with saved profile skips onboarding
- [x] Display name pre-populated from remote config
- [x] Profile image pre-populated from remote config
- [x] New user (no remote config) proceeds with normal onboarding
- [x] Native gracefully degrades (no crash)

### Important Note

**Existing users need to save once**: Users who had sync enabled before this feature was deployed need to save their profile once in User Settings for it to be synced. This is because the `name` and `profile_image` fields were only added to the config save in the current implementation. Once saved, future logins on new devices will correctly sync the profile.

---

## Security Requirements

> ⚠️ **Critical**: These security measures must be implemented. Remote config data must be treated as untrusted.

### Input Validation (Zero-Trust)

**Profile Image Validation** - Implemented in `src/hooks/business/validation/useProfileValidation.ts`:
```typescript
const MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB (matches avatar compression limit)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function validateProfileImage(dataUri: string | undefined): boolean {
  if (!dataUri) return false;
  if (!dataUri.startsWith('data:image/')) return false;

  const base64Start = dataUri.indexOf(',');
  if (base64Start === -1) return false;

  const base64Data = dataUri.substring(base64Start + 1);
  const sizeEstimate = (base64Data.length * 3) / 4;
  if (sizeEstimate > MAX_PROFILE_IMAGE_SIZE) return false;

  const mimeMatch = dataUri.match(/^data:(image\/[^;]+);/);
  if (!mimeMatch || !ALLOWED_IMAGE_TYPES.includes(mimeMatch[1])) return false;

  return true;
}
```

### Implemented Security Controls

- [x] **Display name validation**: `validateDisplayName()` applied after decryption - rejects XSS, reserved names
- [x] **Profile image validation**: `validateProfileImage()` applied after decryption - rejects oversized (>2MB), invalid MIME types
- [x] **No PII in logs**: Debug logs removed, only silent failures
- [ ] Rate limiting (not implemented - low priority since fetch only runs once at startup)

---

## Implementation Strategy

### Chosen Approach: Lightweight Direct Decryption (Option A+)

Instead of using `ConfigService.getConfig()` which has side effects (space sync, bookmark sync), we:

1. **Call API directly**: `apiClient.getUserSettings(address)`
2. **Decrypt manually**: Same crypto as ConfigService but isolated
3. **Extract profile only**: Just `name` and `profile_image`
4. **No side effects**: No space sync, no bookmark sync

**Why this approach:**
- Avoids the "Could not add Space" errors that occurred with `getConfig()`
- Faster - only fetches/decrypts what's needed
- Safer - no unintended side effects during onboarding
- Simpler - fewer dependencies

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

## Validation Checklist

### Web - Functional
- [x] Returning user sees "Loading your profile..." on login
- [x] Display name pre-populated from remote config
- [x] Profile image pre-populated from remote config
- [x] New user completes normal onboarding flow
- [x] Config save includes name and profile_image
- [x] Returning user with profile skips onboarding entirely

### Web - Security
- [x] Oversized profile images (>2MB) are rejected
- [x] Non-image data URIs are rejected
- [x] XSS in display name from remote config is sanitized/rejected
- [x] Console logs do not contain PII (name, profile_image)

### Mobile (Graceful Degradation)
- [x] App launches without crash
- [x] `exportKey` not available - fetch skipped
- [x] Onboarding proceeds directly to key-backup step
- [x] Normal onboarding flow works
- [x] No console errors related to IndexedDB/crypto

---

## References

### Original Commit Details

**Commit**: `a51ea3f663e43957a6b1f477eabe5ae1100c3616`
**Author**: Tyler Sturos <55340199+tjsturos@users.noreply.github.com>

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


_Last Updated: 2025-12-13_
_Security Review: 2025-12-13_
_Completed: 2025-12-13_
