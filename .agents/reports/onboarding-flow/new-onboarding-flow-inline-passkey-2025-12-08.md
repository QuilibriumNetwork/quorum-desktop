# Quorum Authentication Flows

## New Account Flow

**Visual Progress:** 5 dots (●○○○○)
- Step 0 (Welcome) has no dots
- Steps 1a & 1b share the same dot (both are "Passkey Setup")

---

### Step 0: Welcome (no progress dots)
- **Title:** Sign in into Quorum
- **Text:** Your communities, your rules - no platform can ban you.
- **Buttons:**
  - Primary: `Create New Account` → Step 1a
  - Secondary: `I already have an account` → Import Flow
- **Tooltip:** "Read more about Quorum" → "Quorum is a decentralized messaging platform where you own your identity. No email, no phone number - just a secure key that only you control."

> **Note:** Clicking "Create New Account" generates Ed448 keypair in background.

---

### Step 1a: Create Passkey (●○○○○)
- **Title:** Create Passkey
- **Text:** Passkeys use your device's built-in security to protect your account. This requires two quick confirmations via your device.
- **Buttons:**
  - Primary: `Create Passkey` → device prompt
- **Tooltip:** "What is a Passkey?" → "A passkey uses your device's security features (Face ID, fingerprint, or PIN) to protect your account. It's more secure than a password and you don't have to remember anything."

- **On success:** → Step 1b (same dot stays active)

- **On error/cancel:**
  - Text (user cancelled): "You cancelled the confirmation. Tap Try Again when ready." ⓘ
  - Text (not supported): "Passkeys aren't supported on this browser." ⓘ
  - Text (timeout): "The confirmation timed out. Please try again." ⓘ
  - Text (generic): "Something went wrong. Please try again." ⓘ
  - ⓘ tooltip: Shows raw browser error for debugging/support
  - Buttons: `Try Again` / `Continue without passkey`
    - `Try Again` → retry Step 1a (safe - nothing created yet)
    - `Continue without passkey` → Fallback Mode → Step 2

> **Note:**
> - Calls `register()` → device biometric/PIN prompt.
> - **SDK Change Required:** Current SDK only shows "Proceed Without Passkeys". `Try Again` button needs to be added.

---

### Step 1b: Save Account Key to Passkey (●○○○○) - same dot as 1a
- **Title:** Save Your Account Key
- **Text:** Now let's store your account key inside your passkey. One more confirmation needed.
- **Buttons:**
  - Primary: `Save to Passkey` → device prompt
- **Tooltip:** "What is the Account Key?" → "Your account key is your unique identity in Quorum. It's like a master password that proves you are you - but it's generated automatically and stored securely in your passkey."

- **On success:** → Step 2

- **On error:**
  - Text: "Couldn't save to passkey. Your account key will be stored with standard encryption on this device - still secure, but without hardware protection."
  - Buttons: `Continue without Passkey` → Step 2

> **Note:**
> - Calls `completeRegistration()` → device biometric/PIN prompt.
> - No "Try Again" button - retrying would create orphan passkeys in user's authenticator.
> - Falls back to IndexedDB storage.

---

### Step 2: Backup Key (●●○○○)
- **Title:** Back Up Your Account Key
- **Text:** Save a backup of your account key. You'll need this to recover your account if you lose access to your device.
- **Warning:** Keep this file safe and private. Anyone with this file can access your account.
- **Buttons:**
  - Primary: `Download Key Backup` → downloads `.key` file
  - Link: `I've already saved my key` → Step 3
- **After download:** Show `Continue` button → Step 3
- **Tooltip:** "Without this backup, losing your device means losing your account - there's no 'forgot password' option. This is the price you pay for privacy :-)"

---

### Step 3: Add Name (●●●○○)
- **Title:** What should we call you?
- **Text:** This is how others will see you in Quorum. You can change this anytime in Settings.
- **Input:** placeholder "Enter your name"
- **Input (disabled):** label "Account Address" - placeholder "The user account address"
- **Buttons:**
  - Primary: `Continue` (disabled until name entered) → Step 4
- **Tooltip:** "What is the Account Address?" → "Your account address is a unique public identifier derived from your account key. Others can use it to find and message you. Think of it like a username that can never change."

---

### Step 4: Add Photo (●●●●○)
- **Title:** Add a profile photo
- **Text:** Help others recognize you with a profile picture.
- **Buttons:**
  - Primary: `Continue` → Step 5
  - Link: `Skip for now` → Step 5

---

### Step 5: Complete (●●●●●)
- **Title:** You're all set!
- **Text:** Welcome to Quorum, [Name]! Your account is secured and ready to go.
- **Buttons:**
  - Primary: `Enter Quorum` → Main App

---

## Returning User (Auto-Login)

If `localStorage['passkeys-list']` exists and has valid credentials:
- **Passkey users:** App auto-authenticates (may show biometric prompt)
- **Fallback users:** App auto-authenticates (no prompt, reads from IndexedDB)
- User goes directly to Main App

No login screen shown - this is seamless.

---

## Import Flow (Existing Account)

Triggered when user clicks `I already have an account` from Welcome screen (Step 0).

**Visual Progress:** 5 dots (●○○○○)

This flow is used when:
- User cleared browser data
- User is on a new device
- User reinstalled the app

---

### Import Step 1: Import Key (●○○○○)
- **Title:** Import your account key
- **Text:** Select or drag your account key file to restore your account.
- **Input:** File drop zone (accepts `.key` files)
- **Buttons:**
  - Primary: `Continue` (disabled until file selected) → Step 2a
  - Link: `Create new account instead` → New Account Step 1a

- **On invalid file:**
  - Text: "Invalid Key File"
  - Buttons: `Try Again`

> **Note:** Will add import via QR code in future.

---

### Import Step 2a & 2b: Passkey Setup (●●○○○)
- Same as New Account Steps 1a & 1b
- Uses imported keypair instead of generating new one

- **On success:** → Step 3 (Backup Key) → Step 4 (Name) → Step 5 (Photo) → Main App

> **Note:** Currently users must re-enter name and photo even when importing existing account. Profile data is stored locally, not synced. This will be improved in future.

---

## Fallback Mode (No Passkey)

Triggered when:
- Passkey creation fails and user clicks "Continue without passkey" (Step 1a error)
- `completeRegistration()` fails (Step 1b error)
- Electron app (no WebAuthn support - auto-fallback)
- Browser doesn't support PRF/LargeBlob (Firefox - auto-fallback)

---

**What happens technically:**
- Private key stored encrypted in IndexedDB (less secure than passkey)
- `credentialId` set to `'not-passkey'`

**User flow after fallback:**
- Continues to Step 2 (Backup Key) → Step 3 (Name) → Step 4 (Photo) → Step 5 (Complete)
- Same flow as passkey users, just without hardware protection

**No way to create passkey later** - not currently supported in UI (could be added in Settings)

**Returning fallback users:**
- Auto-login reads from IndexedDB (no device prompt)
- "Use Backup Key" works the same as passkey users

---

## Technical Notes

### Why Two Device Prompts? (Steps 1a & 1b)
WebAuthn requires two separate calls:
1. `navigator.credentials.create()` - Creates empty passkey (Step 1a)
2. `navigator.credentials.get()` with write extension - Stores data in it (Step 1b)

This is a WebAuthn spec requirement, not a design choice.

### Key Storage Comparison

| Mode | Storage | Security | Device Prompt on Login |
|------|---------|----------|------------------------|
| Passkey (Chrome) | localStorage encrypted with PRF | Hardware-backed | Yes |
| Passkey (Safari) | Credential largeBlob | Hardware-backed | Yes |
| Fallback | IndexedDB encrypted with AES | Software only | No |

### SDK Functions

```typescript
// New account
register(fqAppPrefix, address)           // Step 1a
completeRegistration(fqAppPrefix, {...}) // Step 1b
downloadKey()                            // Step 2

// Login
authenticate(fqAppPrefix)                // Passkey login
parseKeyFile(fileContents)               // Backup key login
```

---

## Known Issues

### Orphan Passkeys

**Problem:** Every time a user imports their account key, a NEW passkey is created in their device authenticator. Old passkeys are never deleted.

**When this happens:**
- User clears browser data → imports key → new passkey created
- User uses new browser profile → imports key → new passkey created
- User reinstalls app → imports key → new passkey created

**Result:** User accumulates multiple passkeys in their authenticator, all for the same Quorum account. Only the latest one works.

**Potential solutions (not implemented):**
1. Use `navigator.credentials.get()` with empty `allowCredentials` to discover existing passkeys before creating new ones
2. Prompt user to delete old passkeys manually
3. Store passkey metadata server-side to detect duplicates

### No "Sign in with existing Passkey" option

**Problem:** If user clears browser data but still has the passkey in their authenticator, there's no way to use that existing passkey. They must import their backup key and create a new passkey.

**Why:** The app stores passkey metadata in `localStorage`. When cleared, the app doesn't know a passkey exists.

### Step 1b failure creates orphan

**Problem:** If Step 1a succeeds but Step 1b fails, an empty passkey is left in the authenticator with no way to retry storing data in it.

**Current behavior:** Auto-fallback to IndexedDB, orphan passkey remains.

---

*Created: 2025-12-08*
