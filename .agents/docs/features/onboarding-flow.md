---
title: Onboarding Flow
description: Complete documentation of the Quorum onboarding and account creation flow, including passkey creation, fallback mode, import flow, and returning user detection.
updated: 2026-04-14
---

# Onboarding Flow

## Architecture Overview

The entire onboarding experience is driven by a single hook: `useUnifiedOnboardingFlow` ([src/hooks/business/user/useUnifiedOnboardingFlow.ts](../../src/hooks/business/user/useUnifiedOnboardingFlow.ts)). It composes:

- `usePasskeyFlow` (from `@quilibrium/quilibrium-js-sdk-channels`) — manages all WebAuthn and key storage logic
- `usePasskeyAdapter` — platform abstraction over the SDK's passkey context
- `useKeyBackup` — handles key file download
- `useUploadRegistration` / `useQuorumApiClient` — server-side registration and profile fetch

The orchestrator is `OnboardingFlow.tsx` ([src/components/onboarding/OnboardingFlow.tsx](../../src/components/onboarding/OnboardingFlow.tsx)), which renders the current step from a `STEP_MAP`. Each step is a self-contained component under `src/components/onboarding/steps/`.

There is **no separate passkey modal** — passkey creation is fully inline inside the step flow.

---

## Step Definitions

```typescript
type OnboardingStep =
  | 'loading'           // Initial mount / async operations
  | 'welcome'           // Entry point
  | 'import-key'        // File drop for existing account
  | 'create-passkey-1a' // Step 1: create WebAuthn credential
  | 'save-key-to-passkey' // Step 2: store private key in credential
  | 'backup-key'        // Download .key file
  | 'security-warning'  // Acknowledge backup warning
  | 'display-name'      // Enter display name
  | 'profile-photo'     // Upload profile photo
  | 'complete'          // Final screen
```

Progress bar dot mapping (5 dots total):

| Step(s)                              | Dot |
|--------------------------------------|-----|
| `loading`, `welcome`, `import-key`  | none |
| `create-passkey-1a`, `save-key-to-passkey` | 1 |
| `backup-key`, `security-warning`    | 2   |
| `display-name`                      | 3   |
| `profile-photo`                     | 4   |
| `complete`                          | none |

---

## Flow 1: New Account

### Happy path (passkeys supported)

```
welcome
  └─ startNewAccount()
       ├─ isPasskeySupported = true  → create-passkey-1a
       └─ isPasskeySupported = false → proceedWithoutPasskey() → backup-key
```

**create-passkey-1a** (`CreatePasskeyStep`)
- Shows "Create Passkey" with a primary button
- User clicks → `createPasskey()` → `passkeyFlow.startRegistration()`
- SDK calls `navigator.credentials.create()` (first device biometric/PIN prompt)
- On SDK step `awaiting_completion` → outer hook advances to `save-key-to-passkey`

**save-key-to-passkey** (`SaveKeyToPasskeyStep`)
- Shows "Save Your Account Key" with a primary button
- User clicks → `saveToPasskey()` → `passkeyFlow.completeRegistration()`
- SDK calls `navigator.credentials.get()` with write extension (second device prompt)
- On SDK step `success` (and not import mode) → outer hook advances to `backup-key`

**backup-key → security-warning → display-name → profile-photo → complete**
- Standard profile setup steps (see section below)

### Electron / passkeys not supported

`startNewAccount()` detects `isPasskeySupported = false` (set by the SDK on Electron or when `localStorage['quorum-master-prf-incompatibility']` exists), calls `proceedWithoutPasskey()` directly, then goes straight to `backup-key`.

### Error handling on create-passkey-1a

When `passkeyFlow.startRegistration()` throws, the SDK sets its step to `error` and the outer hook's `onError` callback fires. The component shows an inline error with:

| Error code        | Message shown |
|-------------------|---------------|
| `user_cancelled`  | "You cancelled the passkey setup. You can try again, or continue without Passkey." |
| `not_supported`   | "Passkeys aren't supported on this browser. You'll need to continue without Passkey." |
| `timeout`         | "The passkey setup timed out. You can try again, or continue without Passkey." |
| `unknown`         | "Passkey setup failed. You can try again, or continue without Passkey." |

Buttons shown on error:
- **Try Again** (if `canRetry`) → `retryPasskey()` — safe because no credential was written yet
- **Continue without passkey** → `continueWithoutPasskey()` → fallback mode

### Error handling on save-key-to-passkey

When `completeRegistration()` throws, the `onError` callback fires and `stepRef.current === 'save-key-to-passkey'` triggers an automatic fall-through to `backup-key` (see `onError` in the hook). There is **no retry** — at this point a WebAuthn credential exists in the authenticator but has no data stored in it (an orphan). Retrying would create a second orphan credential. The fallback is used instead.

---

## Flow 2: Import Existing Account

```
welcome
  └─ startImportAccount() → import-key
       └─ user uploads .key file
            └─ importKeyFile() → SDK ready_with_keypair
                 └─ onStepChange('ready_with_keypair') → create-passkey-1a
                      ├─ passkey flow succeeds → SDK 'success' → loading (profile sync)
                      │    ├─ remote profile found → setUser() → main app (skips all remaining steps)
                      │    └─ no remote profile → backup-key → ... → complete
                      └─ continue without passkey → proceedWithoutPasskey() → SDK 'success' → loading (profile sync)
                           ├─ remote profile found → setUser() → main app
                           └─ no remote profile → backup-key → ... → complete
```

### File parsing

`importKeyFile()` in the SDK accepts three formats:

| Format | Detection | Notes |
|--------|-----------|-------|
| Raw binary 57 bytes | `data.byteLength === 57` | Standard export format |
| Hex string 114 chars | `keyHex.length === 114` | UTF-8 encoded hex |
| JSON `{ private_key: number[] }` | Starts with `{` | Legacy/debug format |

Invalid files show an inline error in the `import-key` step.

### Passkey creation with imported key

After the file is parsed, the SDK stores the parsed keypair in a ref (`keypairRef`). All subsequent calls — `startRegistration()`, `completeRegistration()`, `proceedWithoutPasskey()` — use `getOrGenerateKeypair()` which returns the stored ref value rather than generating a new one. This ensures the imported private key ends up stored in the passkey (or IndexedDB), not a freshly generated key.

### Remote profile sync (syncImportedProfile)

After the passkey step completes in import mode, the outer hook sets `step = 'loading'` and a `useEffect` runs `syncImportedProfile`:

1. Reads `adapter.currentPasskeyInfo` to get the stored address
2. Calls `adapter.exportKey(address)` to get the private key hex
3. Loads encrypted device keysets from IndexedDB (`passkey.loadKeyDecryptData(2)`)
4. Decrypts the keyset using the private key as AES input
5. Fetches `apiClient.getUserSettings(address)` — the encrypted config stored server-side
6. Decrypts the config using a key derived from `SHA-512(identity.user_key.private_key).slice(0, 32)`
7. Validates the `name` field from the decrypted config
8. **If valid name found**: calls `adapter.updateStoredPasskey(...)` with `completedOnboarding: true`, then `setUser(...)` → enters main app immediately
9. **If no name / decryption fails / network error**: advances to `backup-key` for full onboarding

This means **returning users who import their key skip the entire profile setup** (name, photo, complete steps) and land directly in the app.

---

## Flow 3: Fallback Mode (No Passkey)

Triggered by:
- User chooses "Continue without passkey" after a passkey error
- `completeRegistration()` fails (auto-fallback via `onError`)
- Electron app (auto-detected at mount, `isPasskeySupported = false`)
- Browser previously flagged incompatible (`localStorage['quorum-master-prf-incompatibility'] = 'true'`)

### What `proceedWithoutPasskey()` does

1. Sets `localStorage['quorum-master-prf-incompatibility'] = 'true'`
2. Calls `getOrGenerateKeypair()` — reuses imported key if in import mode
3. Derives address from public key (SHA-256 → Base58)
4. Encrypts private key with a random AES key, saves to `IndexedDB id=1` via `encryptDataSaveKey(1, ...)`
5. Calls `updateStoredPasskey('not-passkey', { ... })` — credential ID is the literal string `'not-passkey'`
6. Builds and uploads user registration to the server
7. Sets SDK step to `success`

The outer hook's `continueWithoutPasskey` action then calls `setStep('backup-key')` (new account) or lets the `syncImportedProfile` effect handle it (import mode).

### Security comparison

| Aspect | Passkey mode | Fallback mode |
|--------|-------------|---------------|
| Private key location | Hardware secure element | Browser IndexedDB |
| Protection | Biometric + hardware chip | AES-256 software encryption |
| Vulnerable to | Physical device theft | XSS, browser exploits, disk access |
| Credential ID | Base64 WebAuthn ID | Literal `'not-passkey'` |
| Login prompt | Device biometric/PIN | None (automatic) |

---

## Flow 4: Returning User (Initial Mount)

On mount, the `loading` step triggers `checkReturningUser`:

1. Reads `adapter.currentPasskeyInfo` from localStorage
2. **No credentials** → `welcome` (new user)
3. **Credentials with `completedOnboarding: true`** → `setUser(...)` → main app immediately (safety net; `App.tsx` normally handles this before the orchestrator mounts)
4. **Credentials with `completedOnboarding: false`** → attempts remote profile fetch (same decrypt logic as `syncImportedProfile`)
   - Valid profile found → `setUser(...)` → main app
   - No profile / error → `welcome` (with a toast warning if decryption threw)

---

## Profile Setup Steps (Shared by All Flows)

### backup-key (`BackupKeyStep`)
- Primary: "Download Key Backup" → `downloadKey()` → downloads `.key` file → `security-warning`
- Link: "I've already saved my key" → `skipKeyBackup()` → `display-name`

> The `.key` file contains the raw Ed448 private key — the user's actual identity. It is independent of the passkey (which is just a storage container). This file is needed to log in on a new device.

### security-warning (`SecurityWarningStep`)
- Acknowledges the backup was saved
- Primary: "I understand" → `acknowledgeSecurityWarning()` → `display-name`

### display-name (`DisplayNameStep`)
- Text input validated by `validateDisplayName()`
- Primary (disabled until valid): → `saveDisplayName()` → stores name in passkey info, advances to `profile-photo`

### profile-photo (`ProfilePhotoStep`)
- Optional image upload
- Primary / Skip: → `saveProfilePhoto(url?)` → advances to `complete`

### complete (`CompleteStep`)
- Primary: "Enter Quorum" → `completeOnboarding()` → sets `completedOnboarding: true` in stored passkey, calls `setUser(...)` → main app

---

## WebAuthn Internals: Why Two Device Prompts

WebAuthn requires two separate operations to store data in a passkey:

**Step 1 — `navigator.credentials.create()`**
Creates an empty WebAuthn credential. The authenticator generates a key pair internally and returns a `credentialId`. No user data is stored yet. The private key used for *signing* stays in the hardware.

**Step 2 — `navigator.credentials.get()` with write extension**
Retrieves the credential and writes data into it via one of two mechanisms:

| Browser | Mechanism | How it works |
|---------|-----------|--------------|
| Chrome 131+ | **PRF extension** | Derives a deterministic AES key from the credential; data encrypted with it and stored in `localStorage['quorum-master']` |
| Safari 17+ | **LargeBlob extension** | Writes raw bytes directly into a storage blob attached to the credential |
| Older/Firefox | **Not supported** | Falls back to IndexedDB |

This two-prompt requirement is a WebAuthn spec constraint, not a design choice.

### Storage locations

| Location | Content | Used by |
|----------|---------|---------|
| `localStorage['passkeys-list']` | Array of `StoredPasskey` objects (address, credentialId, displayName, pfpUrl, completedOnboarding) | Quick lookup; no secrets |
| `localStorage['quorum-master']` | `{ iv, ciphertext }` — private key encrypted with PRF-derived key | Chrome passkey mode |
| `localStorage['quorum-master-prf-incompatibility']` | `'true'` | Signals fallback mode |
| `IndexedDB KeyDB id=1` | Encrypted private key | Fallback mode |
| `IndexedDB KeyDB id=2` | Encrypted `{ identity, device }` keysets | All modes; used for profile sync |
| WebAuthn credential (LargeBlob) | Raw private key bytes | Safari passkey mode |

---

## Known Limitations

### Orphan passkeys
Each time a user imports their account key on a new device or after clearing browser data, a new WebAuthn credential is created in the authenticator. Old credentials accumulate (only the latest works). There is currently no mechanism to detect or clean up prior credentials.

### Orphan from Step 1b failure
If Step 1a succeeds but Step 1b fails, the credential created in Step 1a is left in the authenticator with no data. The user falls back to IndexedDB. The credential is inaccessible and cannot be reused.

### No "sign in with existing passkey"
If a user clears `localStorage` but still has a passkey in their authenticator, there is no flow to use that existing passkey. They must import their `.key` file and create a new passkey.

### No passkey upgrade path
Users in fallback mode cannot later create a passkey. This would require adding a flow in Settings.

---

## Code Map

| File | Role |
|------|------|
| [src/hooks/business/user/useUnifiedOnboardingFlow.ts](../../src/hooks/business/user/useUnifiedOnboardingFlow.ts) | Main orchestrator hook — all step transitions, profile sync, actions |
| [src/components/onboarding/OnboardingFlow.tsx](../../src/components/onboarding/OnboardingFlow.tsx) | Renders current step from STEP_MAP |
| [src/components/onboarding/steps/](../../src/components/onboarding/steps/) | Individual step components |
| [src/hooks/platform/user/usePasskeyAdapter.web.ts](../../src/hooks/platform/user/usePasskeyAdapter.web.ts) | Web adapter wrapping SDK passkey context |
| SDK: `src/hooks/usePasskeyFlow.ts` | WebAuthn flow state machine (register, complete, fallback, import) |
| SDK: `src/passkeys/types.ts` | `register()`, `completeRegistration()`, `encryptDataSaveKey()`, `updateStoredPasskey()` |
| SDK: `src/channel/channel.ts` | `ConstructUserRegistration()`, `NewUserKeyset()`, `NewDeviceKeyset()` |

---

*Updated: 2026-04-14*
