---
type: task
title: Passkey Import UX Issue
status: open
created: 2025-11-13T00:00:00.000Z
updated: '2026-01-09'
related_issues:
  - '#99'
---

# Passkey Import UX Issue

## Status
🔴 **Blocked** - Requires SDK changes in `quilibrium-js-sdk-channels`

https://github.com/QuilibriumNetwork/quorum-desktop/issues/99

## Priority
Medium

## Problem Description

When a user imports their existing key during onboarding, they are still being prompted to save their passkey through the browser's passkey API. This creates a confusing UX because:

1. The user just imported a key file they already have saved
2. Being prompted to "save" something they already have is contradictory
3. It's unclear to users why they need to go through additional passkey prompts after importing

The prompt to save a passkey should **only** be used when a new user account (and their passkey) is created from scratch, not when importing an existing key.

## Root Cause Analysis

### Location of Issue
The bug is in the **SDK's `PasskeyModal` component**:
- Repository: `quilibrium-js-sdk-channels`
- File: `src/components/modals/PasskeyModal.tsx`
- Lines: 141-211 (import flow after file is loaded)

### Technical Details

1. **Import Mode Recognition**: The `importMode` flag IS being passed correctly from the desktop app:
   - `src/components/onboarding/Login.tsx:72` sets `importMode: true`
   - The modal correctly shows the file upload UI for import mode

2. **The Bug**: After the user successfully imports their key file, the `PasskeyModal` still executes the **full passkey registration flow**:
   ```typescript
   // Lines 156-161 in PasskeyModal.tsx
   await completeRegistration(fqAppPrefix, {
     credentialId: id,
     largeBlob: Buffer.from(p.private_key).toString('hex'),
     publicKey: Buffer.from(p.public_key).toString('hex'),
     address: address,
   });

   // Line 199
   await encryptDataSaveKey(2, envelope);
   ```

   Both `completeRegistration()` and `encryptDataSaveKey()` trigger browser passkey prompts.

3. **Why This Happens**: The modal treats import mode identically to new account creation after the key file is loaded. Both flows:
   - Call `register()` to initiate passkey registration (line 217)
   - Call `completeRegistration()` to save with passkey API (line 156)
   - Call `encryptDataSaveKey()` which triggers passkey storage prompts (line 199)

### Code Flow Comparison

**Current Flow (Both New & Import):**
```
User Action → File Upload (import only) → register() → completeRegistration() → encryptDataSaveKey() → Browser Passkey Prompts
```

**Desired Flow:**
```
New Account: User Action → register() → completeRegistration() → encryptDataSaveKey() → Browser Passkey Prompts ✓
Import Account: User Action → File Upload → Validate Key → Direct Storage → Complete (NO prompts) ✓
```

## Why Desktop App Cannot Fix This

The desktop app (`quorum-desktop`) cannot work around this issue because:

1. **Encapsulation**: The `PasskeyModal` is a self-contained component from the SDK
2. **No Interception Points**: We cannot intercept the modal's internal state machine or event handlers
3. **Passkey Prompts Are Internal**: The browser passkey API calls happen deep inside the modal's onClick handlers
4. **Limited Control**: The desktop app only controls:
   - When to show the modal (`setShowPasskeyPrompt`)
   - Whether to set `importMode: true`
   - The modal's props (`getUserRegistration`, `uploadRegistration`)

The desktop app has no way to prevent the passkey registration calls once the modal's internal flow begins.

## Required Solution

### Changes Needed in SDK (`quilibrium-js-sdk-channels`)

**File**: `src/components/modals/PasskeyModal.tsx`

**Location**: Lines 212-268 (import flow after file validation)

**Approach**: When `importMode` is true, after successfully loading and validating the imported key file:

1. **Skip passkey registration**: Do NOT call `register()` or `completeRegistration()`
2. **Store credentials directly**: Use direct storage mechanisms (localStorage/IndexedDB) without passkey API
3. **Complete registration**: Call `uploadRegistration()` and update context
4. **Close modal**: Set `passkeyRegistrationComplete` and close

**Pseudo-code for the fix:**
```typescript
// In the import flow's onClick handler (around line 141)
if (showPasskeyPrompt.importMode && acceptedFiles.length) {
  // ... existing file validation code ...

  // After keypair is loaded and validated:
  if (keypair && !id) {
    // SKIP: Don't call register() for imports
    // Instead, directly store the credentials

    const p = JSON.parse(keypair);
    const h = await sha256.digest(Buffer.from(p.public_key));
    const address = base58btc.baseEncode(h.bytes);

    // Store without passkey API
    updateStoredPasskey('imported-key-' + Date.now(), {
      credentialId: 'imported-key-' + Date.now(),
      address: address,
      publicKey: Buffer.from(p.public_key).toString('hex'),
      completedOnboarding: false,
    });

    // Store encrypted data directly (without passkey API)
    const senderIdent = secureChannel.NewUserKeyset({...});
    const senderDevice = await secureChannel.NewDeviceKeyset();
    // ... encryption code ...

    // Store locally without passkey prompts
    localStorage.setItem('key-data-2', envelope.toString('base64'));

    // Upload registration
    await uploadRegistration({
      address: address,
      registration: senderRegistration,
    });

    setPasskeyRegistrationComplete(true);
  }
}
```

### Alternative Approach

If the passkey API is required for security reasons, consider:
1. Adding a `skipPasskeyPrompts` parameter to the registration functions
2. Using different storage slots for imported vs. created keys
3. Providing a "silent" registration mode for imports

## Impact

**User Experience**:
- Confusing and redundant UX for users importing keys
- May cause users to question if they're doing something wrong
- Reduces trust in the import process

**Priority**: Medium - Does not block functionality but significantly degrades UX for import flow

## Related Files

### Desktop App (quorum-desktop)
- `src/components/onboarding/Login.tsx:68-77` - Where importMode is set
- `src/components/onboarding/Onboarding.tsx:94-100` - PasskeyModal usage
- `src/hooks/business/user/useAuthenticationFlow.ts` - Auth flow management
- `src/components/context/RegistrationPersister.tsx` - Post-passkey registration logic

### SDK (quilibrium-js-sdk-channels)
- `src/components/modals/PasskeyModal.tsx:137-273` - Import flow implementation
- `src/components/context/PasskeysContext.tsx:101-108` - Passkey context state
- `src/passkeys/types.ts` - Passkey API functions (register, completeRegistration, etc.)

## Next Steps

1. ✅ Create task documentation (this file)
2. ⏳ Discuss fix approach with SDK maintainers
3. ⏳ Implement fix in `quilibrium-js-sdk-channels`
4. ⏳ Test import flow with updated SDK
5. ⏳ Update `quorum-desktop` to use fixed SDK version

## Notes

- The `importMode` flag is already in place and partially working
- The fix should be relatively straightforward - just needs to bypass passkey registration for imports
- Consider adding tests in the SDK to verify import flow doesn't trigger passkey prompts
- May want to add user feedback explaining the difference between "create" and "import" flows

---


**Last Updated**: 2025-11-13
**Assigned To**: SDK Team
**Related Issues**: None yet
