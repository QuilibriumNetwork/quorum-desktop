[← Back to INDEX](/../../../INDEX.md)

the Onboarding flow# SDK Shim Temporary Solutions Documentation
**Created: August 9, 2025**

## Overview

This document tracks all temporary solutions implemented while using the SDK shim for React Native, making it easier to integrate the real SDK later.

## Components Using SDK Shim

### 1. Onboarding.native.tsx

**Location**: `/src/components/onboarding/Onboarding.native.tsx`

**Temporary Solutions**:

1. **Missing PasskeyModal Component**
   - **Web Version**: Uses `<PasskeyModal>` from SDK which handles:
     - User authentication UI
     - Automatic user registration with API
     - Passkey creation and management
   - **Native Version**: No PasskeyModal (SDK component not React Native compatible)
   - **Workaround**: Manual implementation of registration logic in `handleSaveDisplayName`

2. **Manual User Registration**
   - **Web Version**: PasskeyModal automatically calls `uploadRegistration`
   - **Native Version**: Manually calling `uploadRegistration` in `handleSaveDisplayName`
   - **TODO**: Remove manual call once PasskeyModal is available

3. **Mock Passkey Data**
   - **Web Version**: Real passkey authentication via WebAuthn
   - **Native Version**: Mock data from SDK shim
   - **TODO**: Implement real passkey authentication (biometrics/secure storage)

**Integration Steps When SDK is Ready**:
```typescript
// 1. Import PasskeyModal from real SDK
import { PasskeyModal } from '@quilibrium/quilibrium-js-sdk-channels';

// 2. Add PasskeyModal component (currently commented out in code)
<PasskeyModal
  fqAppPrefix="Quorum"
  getUserRegistration={async (address) => (await apiClient.getUser(address)).data}
  uploadRegistration={uploadRegistration}
/>

// 3. Remove manual uploadRegistration from handleSaveDisplayName
// 4. Remove TODO comments
```

### 2. SDK Shim File

**Location**: `/src/shims/quilibrium-sdk-channels.native.tsx`

**Mock Implementations**:
- `PasskeysProvider` - Provides mock passkey context
- `usePasskeysContext` - Returns mock authentication state
- `updateStoredPasskey` - Updates mock user profile data
- `exportKey` - Returns mock key export data

**Real SDK Requirements**:
1. React Native compatible crypto operations
2. Biometric authentication integration
3. Secure key storage (iOS Keychain / Android Keystore)
4. WebAssembly alternatives for React Native
5. Native passkey/WebAuthn implementation

## Hook Adapters Using SDK Shim

### usePasskeyAdapter.native.ts

**Location**: `/src/hooks/platform/user/usePasskeyAdapter.native.ts`

**Current State**: Uses SDK shim's mock `usePasskeysContext`

**TODO**: When real SDK is available, this adapter will automatically work with real data

## Testing Considerations

When replacing the SDK shim:
1. Test all onboarding flows
2. Verify user registration with backend
3. Test key backup/export functionality
4. Ensure passkey authentication works
5. Verify profile updates persist

## Related Documentation

- SDK Integration Issue: `.readme/tasks/todo/mobile-sdk-integration-issue.md`
- Cross-Platform Hooks Plan: `.readme/tasks/todo/mobile-dev/cross-platform-hooks-refactoring-plan.md`
- Component Architecture: `.readme/tasks/todo/mobile-dev/docs/component-architecture-workflow-explained.md`

---

*This document should be updated whenever new components use the SDK shim, and referenced when implementing the real SDK for React Native.*
