---
type: report
title: Passkey Authentication Flow Analysis
status: done
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Passkey Authentication Flow Analysis

**Date:** 2025-11-23
**Diagrams:** See `./diagrams/` folder

---

## Overview

Quorum uses WebAuthn passkeys to securely store user private keys in hardware-backed credentials (Face ID, Touch ID, Windows Hello, security keys). When passkeys aren't supported, a software-based fallback stores keys in the browser's IndexedDB.

---

## Key Concepts

### What is a Passkey?
A passkey is a WebAuthn credential stored in your device's secure element (hardware chip). It requires biometric or PIN verification to access. The private key never leaves the hardware.

### Why Two Prompts?
WebAuthn requires **two separate authenticator interactions**:
1. **Create credential** - Registers a new passkey with the authenticator
2. **Store data** - Writes the private key into the credential's "largeBlob" or encrypts it with PRF

This is a WebAuthn limitation, not a design choice. However, the current UI shows two separate "Continue" buttons - this **could be combined into a single click** where both prompts fire back-to-back.

### Browser Support
| Browser | Storage Method | Notes |
|---------|---------------|-------|
| Chrome 131+ | PRF Extension | Key encrypted with hardware-derived secret |
| Safari 17+ | LargeBlob Extension | Key stored directly in credential |
| Firefox | Not supported | Falls back to IndexedDB |
| Older browsers | Not supported | Falls back to IndexedDB |
| Electron app | Skipped entirely | Always uses IndexedDB |

---

## Flow 1: New Account Creation

### Happy Path

1. **Login Screen** → User clicks **[Create New Account]**

2. **Passkey Modal Opens**
   - Header: "Create Passkey"
   - Text: "This will require two round-trips with your authenticator..."
   - Button: [Continue]

3. **User Clicks Continue (First Time)**
   - App generates Ed448 keypair
   - App derives address from public key (SHA-256 → Base58)
   - Browser triggers **Authenticator Prompt #1**
   - User authenticates (Face ID / Touch ID / PIN)
   - Empty passkey credential is created
   - `credentialId` is saved in state

4. **Modal Updates**
   - Text: "One more passkey interaction. Tap continue to complete."
   - Button: [Continue]

5. **User Clicks Continue (Second Time)**
   - Browser triggers **Authenticator Prompt #2**
   - User authenticates again
   - Private key is stored in the passkey credential
   - User/device keysets are created
   - Registration is uploaded to server

6. **Success**
   - Text: "Your passkey has been successfully created."
   - Button: [Continue] → Proceeds to Onboarding

### What Gets Created
- **Passkey credential** in authenticator (contains private key)
- **localStorage `passkeys-list`** - Quick lookup info (address, credentialId, etc.)
- **IndexedDB id=2** - Encrypted device keysets
- **Server registration** - Public keys for other users to message you

---

## Flow 2: Import Existing Key

### Happy Path

1. **Login Screen** → User clicks **[Import Existing Key]**

2. **Passkey Modal Opens (Import Mode)**
   - Header: "Import Existing Key"
   - Text: "Import your existing key file..."
   - Shows file dropzone

3. **User Drops/Selects .key File**
   - App parses file (supports: raw binary 57 bytes, hex string 114 chars, JSON format)
   - App derives public key from private key
   - Keypair is stored in state

4. **User Clicks Continue**
   - Same two-prompt flow as new account
   - Uses imported keypair instead of generating new one

5. **Success** → Proceeds to Onboarding

### File Validation
- Must be exactly 57 bytes (binary) or 114 hex characters
- Invalid files show error: "Corrupted key file, try a different file or cancel"

---

## Flow 3: Error Handling & Fallback

### When Errors Occur

Errors can happen at:
- **Prompt #1 fails** - Browser/authenticator doesn't support passkeys
- **Prompt #2 fails** - LargeBlob/PRF write fails
- **User cancels** - User dismisses the authenticator prompt

### Error State UI
- Header: "Create Passkey"
- Icon: Red exclamation mark
- Text: "An error was encountered while attempting to register the passkey."
- Error message from browser displayed
- Buttons: **[Proceed Without Passkeys]** and **[Cancel]**

### "Proceed Without Passkeys" Flow

This is **NOT creating a passkey** - it's a completely different storage mechanism:

1. Sets flag: `localStorage['quorum-master-prf-incompatibility'] = 'true'`
2. Generates keypair (or uses existing from import)
3. Encrypts private key with auto-generated AES-256 key
4. Stores in **IndexedDB** at id=1
5. Sets `credentialId = 'not-passkey'` (marker for fallback mode)
6. Creates user/device keysets and uploads registration
7. Proceeds to Onboarding

### Security Comparison

| Aspect | With Passkey | Without Passkey (Fallback) |
|--------|--------------|---------------------------|
| Private key location | Hardware secure element | Browser IndexedDB |
| Protection | Biometric + hardware | Software AES encryption |
| Vulnerable to | Physical device theft | XSS, browser exploits, disk access |
| Credential ID | Base64 WebAuthn ID | Literal string `'not-passkey'` |

---

## Edge Case: Prompt #1 Succeeds, Prompt #2 Fails

### What Happens
1. User completes first authenticator prompt → Empty passkey created
2. Second prompt fails (user cancels, or storage fails)
3. Error UI shown with [Proceed Without Passkeys]

### The Problem
An **orphaned empty passkey** exists in the user's authenticator:
- It was created in step 1
- It has no private key stored (step 2 never completed)
- It's useless and sits there forever unless manually deleted

### User Options
1. **[Proceed Without Passkeys]** → Key stored in IndexedDB, orphan ignored
2. **[Cancel]** → Back to login, orphan remains

### No Retry Option
Currently there's no way to retry step 2 with the existing credential. The only options are fallback or start over.

---

## Electron Desktop App Behavior

On Electron, the app automatically sets:
```javascript
localStorage['quorum-master-prf-incompatibility'] = 'true'
```

This means:
- Passkey prompts are **skipped entirely**
- User clicks [Continue] once
- Key is stored directly in IndexedDB
- No authenticator interaction at all

The "Create Passkey" modal still shows, but the flow is simplified to a single click.

---

## Onboarding Flow (After Passkey)

After passkey creation (or fallback), user enters the onboarding flow:

### Step 1: Key Backup
- Text explains importance of backing up keys
- **[Save User Key]** → Downloads `.key` file
- "I already saved mine" → Skip option

> **Important:** "Save User Key" exports the **private key (Ed448)**, NOT the passkey.
> The passkey is just a storage mechanism. The `.key` file contains the actual identity.

### Step 2: Display Name
- Text input for display name
- **[Set Display Name]** → Saves to localStorage

### Step 3: Profile Photo
- File upload for profile image (PNG, JPG, JPEG, max 25MB)
- **[Save Contact Photo]** or "Skip Adding Photo"

### Step 4: Complete
- "You're all set. Welcome to Quorum!"
- **[Let's gooooooooo]** → Enters main app

---

## Returning User Authentication

When the app loads:
1. Reads `localStorage['passkeys-list']`
2. If credentials exist:
   - If `completedOnboarding: true` → Main app
   - If `completedOnboarding: false` → Resume onboarding

### Key Retrieval (When Signing/Exporting)

**Fallback mode** (credentialId = 'not-passkey'):
- Reads from IndexedDB, decrypts with stored AES key
- No user interaction required

**Passkey mode** (real credentialId):
- Browser triggers authenticator prompt
- User authenticates (Face ID / Touch ID / PIN)
- Key returned from hardware credential

---

## Key Export & Multi-Device Login

### Key Export Works for BOTH Passkey and Fallback Users

The "Export" button in Settings → Privacy/Security works identically for both modes:

| Mode | What Happens | User Experience |
|------|--------------|-----------------|
| **Passkey** | `authenticate()` triggers biometric prompt → retrieves key from credential | User must authenticate |
| **Fallback** | `authenticate()` reads directly from IndexedDB | No prompt, instant export |

The exported `.key` file contains the **Ed448 private key** - the user's actual identity. This is the same key regardless of storage mechanism.

### Logging Into Another Device

**Both passkey and fallback users follow the same process:**

1. **Device A:** Export key (Settings → Privacy/Security → Export)
2. **Device B:** Click **[Import Existing Key]** on login screen
3. **Device B:** Drop/select the `.key` file
4. **Device B:** Complete passkey creation (or use fallback if unsupported)
5. **Result:** Same identity on both devices

```
Device A (any mode)          Device B (any mode)
┌──────────────────┐         ┌──────────────────┐
│ Private Key      │         │ Private Key      │
│ (stored in       │  .key   │ (stored in       │
│  passkey OR      │ ─────▶  │  passkey OR      │
│  IndexedDB)      │  file   │  IndexedDB)      │
└──────────────────┘         └──────────────────┘
         │                            │
         └────── Same Identity ───────┘
```

### Important Distinction

| Term | What It Is | Portable? |
|------|------------|-----------|
| **Private Key** | Ed448 keypair - your actual identity | ✅ Yes - via `.key` file |
| **Passkey** | WebAuthn credential - a storage container | ❌ No - device-specific |

The passkey is just a secure vault to hold the private key. When you export, you're exporting the **private key**, not the passkey. Each device creates its own passkey (or uses fallback) to store the same private key.

---

## Data Storage Locations

| Location | Contents | Purpose |
|----------|----------|---------|
| `localStorage['passkeys-list']` | Array of stored passkey info | Quick lookup of address, credentialId, displayName, pfpUrl |
| `localStorage['quorum-master']` | `{iv, ciphertext}` | PRF-encrypted private key (Chrome only) |
| `localStorage['quorum-master-prf-incompatibility']` | `'true'` | Flag indicating fallback mode |
| `IndexedDB KeyDB id=1` | Encrypted private key | Fallback storage when passkeys unavailable |
| `IndexedDB KeyDB id=2` | Encrypted `{identity, device}` | User identity + device keysets |
| WebAuthn Credential | Private key in largeBlob | Hardware-backed storage (Safari/Chrome with passkeys) |

---

## Current UX Issues

1. **Button always says "Continue"** - No distinction between create/store steps
2. **Header never changes** - Always "Create Passkey" even after creation
3. **No progress indicator** - User doesn't know they're at step 1 of 2
4. **Two clicks required** - Could be combined into single click with back-to-back prompts
5. **No retry for step 2** - If storage fails, only option is fallback or restart
6. **Orphaned passkeys** - Failed step 2 leaves empty credential in authenticator

---

## Code References

### SDK (`@quilibrium/quilibrium-js-sdk-channels`)
- `src/components/modals/PasskeyModal.tsx` - Modal UI and flow logic
- `src/components/context/PasskeysContext.tsx` - React context for passkey state
- `src/passkeys/types.ts` - Core functions: `register()`, `completeRegistration()`, `authenticate()`
- `src/channel/channel.ts` - Cryptographic operations, keyset creation

### Quorum Desktop
- `src/components/onboarding/Login.tsx` - Login screen with account buttons
- `src/components/onboarding/Onboarding.tsx` - Post-passkey onboarding flow
- `src/hooks/business/user/useAuthenticationFlow.ts` - Auth state management
- `src/hooks/business/user/useOnboardingFlowLogic.ts` - Onboarding state machine
- `src/hooks/business/files/useKeyBackupLogic.ts` - Key export functionality

---
