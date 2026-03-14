---
type: doc
title: "Profile Sync on Returning User Login"
status: done
ai_generated: true
created: 2026-03-14
updated: 2026-03-14
related_docs:
  - ".agents/docs/config-sync-system.md"
  - ".agents/docs/features/user-config-sync.md"
related_tasks:
  - ".agents/tasks/.done/user-config-sync-on-existing-accounts.md"
---

# Profile Sync on Returning User Login

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

When a returning user imports their existing private key on a new device or fresh browser, the onboarding flow automatically fetches their saved profile data (display name, profile image) from the remote encrypted config. If successful, onboarding is skipped entirely and the user enters the app with their profile intact.

This feature was originally implemented by Tyler Sturos, reverted due to a mobile crash, and re-implemented with a lightweight direct-decryption approach that bypasses `ConfigService` to avoid side effects during onboarding.

## Architecture

### Key Components

| File | Purpose |
|------|---------|
| `src/hooks/business/user/useOnboardingFlowLogic.ts` | Core `fetchUser()` function — decrypts remote config, validates profile, calls `setUser()` to skip onboarding |
| `src/hooks/platform/user/usePasskeyAdapter.web.ts` | Web adapter — provides `exportKey` from SDK's `usePasskeysContext()` |
| `src/hooks/platform/user/usePasskeyAdapter.native.ts` | Native adapter — omits `exportKey` for graceful mobile degradation |
| `src/hooks/business/user/useOnboardingFlow.ts` | Composition hook — wires adapter into flow logic |
| `src/components/onboarding/Onboarding.tsx` | UI — triggers `fetchUser` on mount via `useEffect`, shows loading spinner |
| `src/hooks/business/validation/useProfileValidation.ts` | Zero-trust validation of profile image (size, MIME type) |
| `src/hooks/business/validation/index.ts` | Exports `validateDisplayName()` for XSS/injection prevention |

### Complete Data Flow

```
App.tsx renders condition tree:
  user && currentPasskeyInfo         → Main app (with RegistrationProvider)
  landing && !currentPasskeyInfo     → Login page
  landing && currentPasskeyInfo      → Onboarding component ← THIS IS WHERE SYNC HAPPENS

Onboarding.tsx
  └─ useEffect([currentPasskeyInfo?.address])
     └─ fetchUser(address, setUser)

fetchUser() flow:
  1. Guard: !address || !adapter.exportKey → return early
  2. apiClient.getUser(address) → verify user is registered
     └─ If 404/error → return null silently (new user)
  3. adapter.exportKey(address) → get raw private key hex
     └─ SDK authenticate() → for "not-passkey" users: loadKeyDecryptData(1)
     └─ For passkey users: triggers navigator.credentials.get() dialog
  4. passkey.loadKeyDecryptData(2) → load encrypted keyset envelope from IndexedDB
  5. passkey.createKeyFromBuffer(userKey) → derive decryption key
  6. passkey.decrypt(envelope) → get identity keyset {identity, device}
  7. apiClient.getUserSettings(address) → fetch encrypted remote config
     └─ If error or no user_config → return null silently
  8. Derive AES-256-GCM key: SHA-512(private_key)[0:32]
  9. Decrypt config: AES-GCM with IV from last 24 hex chars of user_config
  10. Validate decrypted fields (zero-trust):
      - validateDisplayName(name) → reject XSS, reserved names
      - validateProfileImage(profile_image) → reject >2MB, invalid MIME
  11. If valid name exists:
      - setDisplayName(name)
      - updateStoredPasskey({..., completedOnboarding: true})
      - setUser({displayName, userIcon, ...}) → SKIPS ONBOARDING
  12. If no valid name → proceed with normal onboarding flow
```

### SDK Internal Flow ("Proceed Without Passkeys")

When the user chose "Proceed Without Passkeys", the SDK sets `localStorage['quorum-master-prf-incompatibility'] = 'true'`. This changes how `exportKey` and `authenticate` work:

```
authenticate(fqAppPrefix, { credentialId: address })
  └─ Checks localStorage for master-prf-incompatibility
  └─ If true: loadKeyDecryptData(1) → raw private key bytes → hex string
     (NO passkey dialog, NO user interaction needed)
  └─ If false: navigator.credentials.get() → passkey dialog → largeBlob
```

Key data stored in IndexedDB by the SDK:
- **Key 1**: Raw private key bytes (via `encryptDataSaveKey(1, ...)`)
- **Key 2**: Encrypted envelope containing `{identity: UserKeyset, device: DeviceKeyset}` (via `encryptDataSaveKey(2, ...)`)

### How Profile Data Gets Into Remote Config

Profile data is included in the encrypted config via `useUserSettings.ts` `saveChanges()`:

```typescript
// src/hooks/business/user/useUserSettings.ts:223-231
const newConfig = {
  ...existingConfig.current!,
  allowSync,
  nonRepudiable,
  name: displayName,           // ← Profile name
  profile_image: profileImageUrl, // ← Profile image data URI
  bio: bio.trim() || undefined,
  spaceTagId: spaceTagId || undefined,
};
```

This config object is serialized via `JSON.stringify()`, encrypted with AES-GCM, signed with Ed448, and posted to `POST /users/{address}/config`. The `name` and `profile_image` fields are part of the `UserConfig` type defined in `src/db/messages.ts:47-95`.

### App.tsx Rendering Conditions

The rendering in `App.tsx` determines whether Onboarding is shown:

```typescript
// src/App.tsx:85-96
useEffect(() => {
  if (currentPasskeyInfo && currentPasskeyInfo.completedOnboarding && !user) {
    setUser({
      displayName: currentPasskeyInfo.displayName ?? currentPasskeyInfo.address,
      state: 'online',
      status: '',
      userIcon: currentPasskeyInfo.pfpUrl ?? DefaultImages.UNKNOWN_USER,
      address: currentPasskeyInfo.address,
    });
  }
}, [currentPasskeyInfo, passkeyRegistrationComplete, setUser, user]);
```

- If `completedOnboarding: true` → sets user immediately, Onboarding never mounts
- If `completedOnboarding: false` → Onboarding mounts → `fetchUser` runs

### Interaction with RegistrationPersister

`RegistrationPersister.tsx` also calls `exportKey` and decrypts the keyset, but it only mounts when `user` is set (line 119-131 in App.tsx). Since `fetchUser` in Onboarding is what sets `user`, there is no race condition — RegistrationPersister runs after Onboarding completes.

However, for passkey users, this means **three passkey dialogs** in sequence:
1. Passkey registration (SDK PasskeyModal)
2. `fetchUser` → `exportKey` → `authenticate` → passkey dialog
3. `RegistrationPersister` → `exportKey` → passkey dialog

## Security Controls

All remote config data is treated as untrusted (zero-trust model):

| Control | Implementation | File |
|---------|----------------|------|
| Display name validation | `validateDisplayName()` — rejects XSS, reserved names, oversized | `src/hooks/business/validation/index.ts` |
| Profile image validation | `validateProfileImage()` — rejects >2MB, non-image MIME types | `src/hooks/business/validation/useProfileValidation.ts` |
| Silent failures for new users | No warning toast if user is not registered | `useOnboardingFlowLogic.ts:268-283` |
| Warning toasts for registered users | Shows appropriate warning if keyset or config decryption fails | `useOnboardingFlowLogic.ts:270-280` |
| No PII in logs | All debug logging removed, only structured error handling | Throughout |

## Platform Behavior

| Platform | Behavior |
|----------|----------|
| **Web (Passkey)** | Full sync — but requires user to interact with passkey dialog during fetch |
| **Web (No Passkeys)** | Full sync — transparent, no user interaction needed |
| **Mobile (Native)** | Graceful degradation — `exportKey` undefined in adapter, `fetchUser` returns early |

## Error Handling

| Scenario | Behavior | Toast? |
|----------|----------|--------|
| User not registered (404 from `getUser`) | Silent — proceed with normal onboarding | No |
| `exportKey` not available (native) | Silent — `fetchUser` returns early | No |
| `exportKey` fails (passkey dismissed) | Warning toast if registered user | Yes |
| No remote config (`getUserSettings` fails) | Silent — proceed with onboarding | No |
| Remote config has no `user_config` field | Silent — proceed with onboarding | No |
| Keyset decryption fails | Warning: "Couldn't load your saved profile" | Yes |
| Config decryption fails | Warning: "Couldn't decrypt your saved profile" | Yes |
| Decrypted name fails validation | Silent — proceed with onboarding (no valid profile) | No |
| Decrypted image fails validation | Image set to default, name still applied if valid | No |

## Known Limitations

- **Existing users migration**: Users who enabled sync before the profile sync feature (Dec 2025) must save their profile once in User Settings for `name` and `profile_image` to be included in the remote config
- **Web-only**: Mobile lacks Web Crypto APIs needed for decryption — adapter omits `exportKey`
- **Passkey users face multiple dialogs**: Each `exportKey` call triggers a browser passkey prompt
- **Silent failure modes**: Several failure paths proceed silently to normal onboarding with no user feedback

## Related Documentation

- [Config Sync System](.agents/docs/config-sync-system.md) — Full config encryption/sync architecture
- [User Config Sync Feature Doc](.agents/docs/features/user-config-sync.md) — Earlier documentation
- [Completed Task](.agents/tasks/.done/user-config-sync-on-existing-accounts.md) — Original implementation details
- [Config Save Stale Cache Bug](.agents/bugs/.solved/config-save-stale-cache-allowsync.md) — Related React Query cache bug

---

_Created: 2026-03-14_
