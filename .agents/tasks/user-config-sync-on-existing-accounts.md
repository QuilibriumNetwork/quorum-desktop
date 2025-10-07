# User Config Sync on Existing Accounts

**Status:** TODO
**Priority:** Medium
**Complexity:** Medium
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

## Current Architecture Context

Since the original implementation, the codebase has undergone **significant refactoring**:

### ✅ MessageDB Refactoring Complete (Phase 2)

**Status**: MessageDB has been fully refactored into specialized services (see `.agents/tasks/.done/DONE_messagedb-refactoring.md`)

**New Service Architecture**:
- **ConfigService** (`src/services/ConfigService.ts`) - Handles user config get/save
- **MessageService** (`src/services/MessageService.ts`) - Message operations
- **SpaceService** (`src/services/SpaceService.ts`) - Space management
- **EncryptionService** (`src/services/EncryptionService.ts`) - Encryption/keys
- **SyncService** (`src/services/SyncService.ts`) - Data synchronization
- **InvitationService** (`src/services/InvitationService.ts`) - Invites

**Key Changes**:
- MessageDB.tsx now delegates to specialized services
- Business logic extracted from monolithic context
- Each service has clear, focused responsibilities
- Services are properly dependency-injected

### ⚠️ Cross-Platform Storage Issue

**Status**: **NOT YET RESOLVED** (as of 2025-10-04)

The underlying cross-platform storage issue that caused the original revert still exists:

- **Web**: Uses IndexedDB via `src/db/messages.ts`
- **Mobile**: Needs AsyncStorage equivalent (not yet implemented)
- **Issue**: ConfigService uses `window.crypto` and browser-specific APIs (lines 71-86, 116-123)

**Critical Code in ConfigService.ts**:
```typescript
// Line 71-75: Browser-only crypto API
const derived = await crypto.subtle.digest(
  'SHA-512',
  Buffer.from(new Uint8Array(userKey.user_key.private_key))
);

// Line 76-85: window.crypto.subtle (browser-only)
const subtleKey = await window.crypto.subtle.importKey(
  'raw',
  derived.slice(0, 32),
  { name: 'AES-GCM', length: 256 },
  false,
  ['decrypt']
);

// Line 116-123: window.crypto.subtle.decrypt (browser-only)
const config = JSON.parse(
  Buffer.from(
    await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(iv, 'hex') },
      subtleKey,
      Buffer.from(ciphertext, 'hex')
    )
  ).toString('utf-8')
) as UserConfig;
```

## Implementation Plan

### Phase 1: Platform-Agnostic Crypto Abstraction

**Goal**: Make ConfigService work on both web and mobile platforms

**Tasks**:

1. **Create crypto utilities abstraction** (`src/utils/crypto.ts` already exists but may need extension)
   - [ ] Audit existing `src/utils/crypto.ts` for platform compatibility
   - [ ] Create `src/utils/platform/crypto.web.ts` - Web implementation using `window.crypto.subtle`
   - [ ] Create `src/utils/platform/crypto.native.ts` - React Native implementation using `expo-crypto`
   - [ ] Export unified API: `deriveKey()`, `encrypt()`, `decrypt()`, `importKey()`
   - [ ] Test both implementations have identical behavior

2. **Refactor ConfigService to use crypto abstractions**
   - [ ] Replace direct `crypto.subtle` calls with platform-agnostic utilities
   - [ ] Replace direct `window.crypto.subtle` calls with platform-agnostic utilities
   - [ ] Update ConfigService constructor to inject crypto utilities if needed
   - [ ] Verify ConfigService TypeScript compiles for both platforms
   - [ ] Test ConfigService works identically on web and mobile

**Validation Criteria**:
- ✅ ConfigService has no direct references to `window.crypto` or browser-specific APIs
- ✅ TypeScript compiles without errors for both web and mobile
- ✅ Crypto operations produce identical results on both platforms

### Phase 2: Implement Config Fetch on Login

**Goal**: Auto-fetch user config when logging into existing account

**Original Implementation Reference** (from commit a51ea3f6):

**File**: `src/hooks/business/user/useOnboardingFlowLogic.ts`

**Changes Made**:
```typescript
// Added imports
import { passkey } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/MessageDB';
import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';

// Added state
const [isFetchingUser, setIsFetchingUser] = useState<boolean>(false);
const { getConfig } = useMessageDB();
const { apiClient } = useQuorumApiClient();

// Added loading step to state machine
export type OnboardingStep = 'loading' | 'key-backup' | 'display-name' | 'profile-photo' | 'complete';

// New function: fetchUser
const fetchUser = useCallback(async (
  address: string,
  setUser?: (user: {...}) => void
) => {
  // ... 78 lines of logic (see commit for full implementation)
}, []);

// Updated getCurrentStep to handle loading state
const getCurrentStep = useCallback((): OnboardingStep => {
  if (isFetchingUser) return 'loading';
  // ... rest of logic
}, [isFetchingUser, ...]);
```

**File**: `src/components/onboarding/Onboarding.tsx`

**Changes Made**:
```typescript
// Added loading state display
const [isConfigLoading, setIsConfigLoading] = useState<boolean>(false);

// Added useEffect to auto-fetch config on mount when user has address
useEffect(() => {
  if (onboardingFlow.currentPasskeyInfo?.address) {
    const { address } = onboardingFlow.currentPasskeyInfo;
    setIsConfigLoading(true);
    (async () => {
      try {
        await onboardingFlow.fetchUser(address, setUser);
      } finally {
        setIsConfigLoading(false);
      }
    })();
  }
}, [onboardingFlow.currentPasskeyInfo?.address]);

// Updated UI to show loading state
{isConfigLoading
  ? t`Initializing your profile...`
  : // ... rest of onboarding UI
}

// Wrapped all onboarding steps with loading check
{!isConfigLoading && onboardingFlow.currentStep === 'key-backup' && ...}
{!isConfigLoading && onboardingFlow.currentStep === 'display-name' && ...}
```

**File**: `src/db/messages.ts`

**Changes Made**:
```typescript
export type UserConfig = {
  // ... existing fields
  name?: string;              // NEW
  profile_image?: string;     // NEW
};
```

**File**: `src/hooks/business/user/useUserSettings.ts`

**Changes Made**:
```typescript
// In saveChanges function, persist name and profile_image to UserConfig
await saveConfig({
  config: {
    ...existingConfig.current!,
    address: currentPasskeyInfo.address,
    name: displayName,                                    // NEW
    profile_image: profileImageUrl ?? DefaultImages.UNKNOWN_USER,  // NEW
    allowSync,
    nonRepudiable: nonRepudiable,
  },
  keyset,
});
```

**Tasks**:

1. **Update UserConfig type** (✅ Easy - no cross-platform issues)
   - [ ] Add `name?: string` field to UserConfig in `src/db/messages.ts`
   - [ ] Add `profile_image?: string` field to UserConfig
   - [ ] Update default config in `src/utils.ts` to include empty name/profile_image

2. **Update useUserSettings to persist profile to config** (✅ Easy)
   - [ ] Modify `src/hooks/business/user/useUserSettings.ts`
   - [ ] In `saveChanges`, add `name` and `profile_image` to config before calling `saveConfig()`
   - [ ] Ensure changes are backward compatible (existing configs without these fields)

3. **Create platform-agnostic config fetch logic** (⚠️ Requires careful platform handling)
   - [ ] Extract `fetchUser` logic from original commit into separate utility
   - [ ] Create `src/hooks/business/user/useConfigFetch.ts` (platform-agnostic business logic)
   - [ ] Handle platform-specific passkey loading:
     - Web: Use `passkey.loadKeyDecryptData()` and `passkey.createKeyFromBuffer()`
     - Mobile: May need different approach - investigate React Native passkey storage
   - [ ] Call ConfigService's `getConfig()` with proper keyset
   - [ ] Return profile data (name, profile_image) if available
   - [ ] Handle errors gracefully (network issues, malformed config, etc.)

4. **Update OnboardingAdapter interface** (✅ Easy)
   - [ ] Add `fetchUserConfig: (address: string) => Promise<UserConfig | null>` to `OnboardingAdapter`
   - [ ] Implement in `src/hooks/platform/user/usePasskeyAdapter.web.ts`
   - [ ] Create `src/hooks/platform/user/usePasskeyAdapter.native.ts` (mobile implementation)

5. **Update useOnboardingFlowLogic** (⚠️ Must avoid direct MessageDB import)
   - [ ] **DO NOT** import `useMessageDB` directly (this caused the original bug!)
   - [ ] Add `fetchUserConfig` prop from OnboardingAdapter
   - [ ] Add `isFetchingUser` state
   - [ ] Add 'loading' state to OnboardingStep type
   - [ ] Create `fetchUser()` function that:
     - Calls `adapter.fetchUserConfig(address)`
     - Updates `displayName` and profile photo if config exists
     - Handles loading state properly
   - [ ] Update `getCurrentStep()` to return 'loading' when `isFetchingUser === true`
   - [ ] Export `fetchUser` function in return object

6. **Update Onboarding.tsx component** (✅ Easy once hooks are ready)
   - [ ] Add `useEffect` to call `onboardingFlow.fetchUser()` when address is available
   - [ ] Add loading state display: "Initializing your profile..."
   - [ ] Wrap all onboarding steps with `!isConfigLoading` check
   - [ ] Ensure loading UI is accessible and user-friendly

**Validation Criteria**:
- ✅ When user logs in with existing account, config is auto-fetched
- ✅ Display name and profile photo are auto-populated if saved
- ✅ Loading state shows during config fetch
- ✅ Works on both web and mobile platforms
- ✅ Handles errors gracefully (network failures, missing config, etc.)
- ✅ No crashes on mobile due to IndexedDB/browser API usage

### Phase 3: Add Manual Resync Option

**Goal**: Allow users to manually refresh their config from User Settings

**Original Implementation Reference** (from commit a51ea3f6):

**File**: `src/components/modals/UserSettingsModal.tsx`

**Changes Made**:
```typescript
import { useMessageDB } from '../context/MessageDB';

const { getConfig } = useMessageDB();

const resyncConfig = async () => {
  if (!currentPasskeyInfo) return;
  const cfg = await getConfig({
    address: currentPasskeyInfo.address,
    userKey: keyset.userKeyset,
    preferSaved: true,  // Force fetch from remote
  });
  if (cfg) {
    setAllowSync(cfg.allowSync ?? false);
    setNonRepudiable(cfg.nonRepudiable ?? true);
    if (typeof cfg.name === 'string') setDisplayName(cfg.name);
  }
};

// UI: Added button next to "Save Changes"
{allowSync && (
  <Tooltip content={t`This will override your locally stored settings...`}>
    <Button type="secondary" onClick={resyncConfig}>
      {t`Resync Settings`}
    </Button>
  </Tooltip>
)}
```

**Tasks**:

1. **Update ConfigService.getConfig() API** (✅ Already done in refactor)
   - [x] ConfigService already has `getConfig()` method
   - [ ] Review if `preferSaved` parameter is needed (force remote fetch)
   - [ ] Add `preferSaved?: boolean` parameter if not present
   - [ ] When `preferSaved === true`, skip local cache and always fetch remote

2. **Add resync functionality to UserSettingsModal** (⚠️ Must use proper service)
   - [ ] **DO NOT** import `useMessageDB` directly in the modal
   - [ ] Create hook: `src/hooks/business/user/useConfigResync.ts`
   - [ ] Hook should use MessageDB context to access ConfigService
   - [ ] Implement `resyncConfig()` function:
     - Fetch config with `preferSaved: true`
     - Update local state (allowSync, nonRepudiable, displayName, profile photo)
     - Show success/error toast notifications
   - [ ] Add "Resync Settings" button in UserSettingsModal
   - [ ] Only show button when `allowSync === true` (user has opted into sync)
   - [ ] Add tooltip explaining what resync does
   - [ ] Show loading state during resync
   - [ ] Handle errors gracefully with user-friendly messages

**Validation Criteria**:
- ✅ "Resync Settings" button appears only when sync is enabled
- ✅ Clicking button fetches latest config from remote
- ✅ Local settings are updated to match remote config
- ✅ User sees loading state during resync
- ✅ Success/error messages are shown appropriately
- ✅ Works on both web and mobile platforms

### Phase 4: Testing & Validation

**Goal**: Comprehensive testing to prevent regression

**Tasks**:

1. **Unit Tests**
   - [ ] Test crypto utilities (web and mobile implementations)
   - [ ] Test ConfigService.getConfig() with `preferSaved` parameter
   - [ ] Test useOnboardingFlowLogic.fetchUser() function
   - [ ] Test useConfigResync hook
   - [ ] Test UserConfig type updates are backward compatible

2. **Integration Tests**
   - [ ] Test full onboarding flow with existing account
   - [ ] Test config auto-fetch on login
   - [ ] Test manual resync from User Settings
   - [ ] Test config save with profile info
   - [ ] Test error scenarios (network failures, malformed data)

3. **Cross-Platform Tests**
   - [ ] Test on web (Chrome, Firefox, Safari)
   - [ ] Test on mobile (iOS simulator, Android emulator)
   - [ ] Test crypto operations produce identical results
   - [ ] Test IndexedDB on web, AsyncStorage on mobile
   - [ ] Verify no crashes on mobile startup

4. **Manual QA Scenarios**
   - [ ] **Scenario 1**: New user completes onboarding → config saved with profile
   - [ ] **Scenario 2**: Existing user logs in → profile auto-populated
   - [ ] **Scenario 3**: User enables sync → "Resync" button appears
   - [ ] **Scenario 4**: User clicks "Resync" → settings updated
   - [ ] **Scenario 5**: Network error during fetch → graceful error message
   - [ ] **Scenario 6**: Malformed remote config → falls back to local config

**Validation Criteria**:
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ All cross-platform tests pass
- ✅ All manual QA scenarios verified
- ✅ No crashes on mobile startup
- ✅ No TypeScript compilation errors
- ✅ No console errors or warnings

## Risk Assessment

### High Risk Areas

1. **Cross-Platform Crypto Operations**
   - **Risk**: Crypto API differences between web (window.crypto.subtle) and mobile (expo-crypto)
   - **Mitigation**: Comprehensive crypto abstraction layer with unit tests
   - **Fallback**: Use existing `src/utils/crypto.ts` patterns that already work cross-platform

2. **Passkey Storage Access**
   - **Risk**: Different passkey storage mechanisms on web vs mobile
   - **Mitigation**: Platform-specific adapter pattern (already established)
   - **Fallback**: Skip auto-fetch on platforms where passkey access is problematic

3. **IndexedDB vs AsyncStorage**
   - **Risk**: Storage APIs are fundamentally different
   - **Mitigation**: This is already handled by MessageDB refactor
   - **Note**: ConfigService uses MessageDB which abstracts storage

### Medium Risk Areas

1. **Backward Compatibility**
   - **Risk**: Existing users have configs without `name`/`profile_image` fields
   - **Mitigation**: Make fields optional, provide sensible defaults
   - **Validation**: Test with old config format

2. **Network Failures**
   - **Risk**: Config fetch fails during onboarding
   - **Mitigation**: Graceful error handling, allow user to proceed with onboarding
   - **UX**: Show error but don't block user

### Low Risk Areas

1. **UI Changes**
   - **Risk**: Minimal - just adding loading state and resync button
   - **Mitigation**: Follow existing UI patterns
   - **Validation**: Visual regression testing

## Success Criteria

### Functional Requirements

- ✅ **Auto-fetch on login**: Returning users see their saved profile info
- ✅ **Manual resync**: Users can refresh settings from User Settings modal
- ✅ **Config persistence**: Display name and profile photo saved to UserConfig
- ✅ **Cross-platform**: Works identically on web and mobile
- ✅ **Error handling**: Graceful degradation when network/config issues occur

### Technical Requirements

- ✅ **No mobile crashes**: Zero IndexedDB/browser API usage in mobile code paths
- ✅ **No direct dependencies**: Business logic doesn't import MessageDB directly
- ✅ **Type safety**: All TypeScript code compiles without errors
- ✅ **Test coverage**: >80% coverage on new code
- ✅ **Performance**: Config fetch <2 seconds on average network

### User Experience Requirements

- ✅ **Loading states**: Clear feedback during async operations
- ✅ **Error messages**: User-friendly error messages when things fail
- ✅ **Backward compatible**: Existing users not disrupted
- ✅ **Discoverable**: Resync button visible when sync is enabled
- ✅ **Responsive**: UI remains responsive during config fetch

## Implementation Phases Summary

| Phase | Description | Risk | Estimated Effort |
|-------|-------------|------|------------------|
| **Phase 1** | Platform-agnostic crypto abstraction | High | 4-6 hours |
| **Phase 2** | Auto-fetch config on login | Medium | 6-8 hours |
| **Phase 3** | Manual resync option | Low | 2-3 hours |
| **Phase 4** | Testing & validation | Medium | 4-6 hours |
| **Total** | | | **16-23 hours** |

## Dependencies

### Blockers

- ❌ **Cross-platform storage issue** (`.agents/bugs/messagedb-cross-platform-storage-issue.md`)
  - Must be resolved before Phase 1
  - Requires crypto abstraction layer
  - Affects ConfigService directly

### Prerequisites

- ✅ **MessageDB refactoring complete** (`.agents/tasks/.done/DONE_messagedb-refactoring.md`)
  - ConfigService already extracted
  - Service architecture in place
  - Dependency injection working

### Related Tasks

- **Mobile platform support**: Implementing AsyncStorage equivalent for IndexedDB
- **Crypto utilities**: Cross-platform crypto operations
- **Passkey adapters**: Platform-specific passkey storage access

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

---

_Created: 2025-10-04_
_Last Updated: 2025-10-04_
