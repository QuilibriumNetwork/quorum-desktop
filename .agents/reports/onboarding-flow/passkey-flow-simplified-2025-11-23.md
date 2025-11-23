# Passkey Flow - Simplified User Journey

**Date:** 2025-11-23

---

## Why Two Steps?

WebAuthn passkeys require **two separate authenticator interactions**:

1. **First interaction**: Creates the passkey credential (like creating a "lock")
2. **Second interaction**: Stores the private key inside that credential (putting the "key" in the lock)

This is a WebAuthn limitation, not a design choice.

---

## New Account Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOGIN SCREEN                                  │
│                                                                  │
│              [Create New Account]                                │
│              [Import Existing Key]                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PASSKEY MODAL                                   │
│                                                                  │
│  "Use Passkeys to access your account..."                       │
│  "This will require two round-trips with your                   │
│   authenticator to complete"                                    │
│                                                                  │
│                    [Continue]                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   AUTHENTICATOR PROMPT #1    │
        │   (Face ID / Touch ID /      │
        │    Windows Hello / PIN)      │
        │                              │
        │   Creates passkey credential │
        └──────────────┬───────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PASSKEY MODAL                                   │
│                                                                  │
│  "To save the account, you will need to perform                 │
│   one more passkey interaction. Tap continue to complete."      │
│                                                                  │
│                    [Continue]                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   AUTHENTICATOR PROMPT #2    │
        │   (Face ID / Touch ID /      │
        │    Windows Hello / PIN)      │
        │                              │
        │   Stores private key in      │
        │   the passkey credential     │
        └──────────────┬───────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PASSKEY MODAL                                   │
│                                                                  │
│  ✓ "Your passkey has been successfully created."                │
│                                                                  │
│                    [Continue]                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│               ONBOARDING SCREEN                                  │
│                                                                  │
│  Step 1: Key Backup                                             │
│          [Save User Key]  or  "I already saved mine"            │
│                                                                  │
│  Step 2: Display Name                                           │
│          [input field] [Set Display Name]                       │
│                                                                  │
│  Step 3: Profile Photo                                          │
│          [upload area] [Save] or "Skip"                         │
│                                                                  │
│  Step 4: Complete                                               │
│          [Let's gooooooooo]                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Happens When Passkeys Fail?

```
┌─────────────────────────────────────────────────────────────────┐
│                  PASSKEY MODAL - ERROR STATE                     │
│                                                                  │
│  ❗ "An error was encountered while attempting to register      │
│      the passkey."                                              │
│                                                                  │
│     [Error message from browser]                                │
│                                                                  │
│  "If your browser told you the passkey option cannot be         │
│   used with the site, you may be running an unsupported         │
│   browser. If the browser provides an option to use a           │
│   phone for passkeys, use this. Alternatively, if you           │
│   would like to proceed without passkeys, click                 │
│   Proceed Without Passkeys."                                    │
│                                                                  │
│           [Proceed Without Passkeys]  ◀── FALLBACK              │
│           [Cancel]                                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ "Proceed Without Passkeys"
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  FALLBACK MODE                                                   │
│                                                                  │
│  • Private key stored encrypted in browser's IndexedDB          │
│  • No hardware security (software-only encryption)              │
│  • Credential ID set to "not-passkey"                           │
│  • User proceeds to onboarding normally                         │
│                                                                  │
│  ⚠️  Less secure than passkey mode!                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Import Existing Key Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOGIN SCREEN                                  │
│                                                                  │
│              [Import Existing Key]                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PASSKEY MODAL (Import Mode)                     │
│                                                                  │
│  "To begin, import your existing key file.                      │
│   Drop it in the area below or click to select."                │
│                                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │                                         │                    │
│  │   Drop key file here or click to select │                    │
│  │           (accepts .key files)          │                    │
│  │                                         │                    │
│  └─────────────────────────────────────────┘                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ User drops/selects .key file
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PASSKEY MODAL                                   │
│                                                                  │
│  "Use Passkeys to save your account..."                         │
│  "This will require two round-trips..."                         │
│                                                                  │
│                    [Continue]                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
              (Same two-step passkey flow as new account)
                       │
                       ▼
              (Onboarding flow)
```

---

## Browser Support Matrix

| Browser | Passkey Storage Method | Notes |
|---------|----------------------|-------|
| Chrome 131+ | PRF Extension | Key encrypted with hardware-derived secret |
| Safari 17+ | LargeBlob Extension | Key stored directly in credential |
| Older Chrome/Safari | ❌ Falls back | Uses IndexedDB (less secure) |
| Firefox | ❌ Falls back | No LargeBlob/PRF support yet |
| Electron (Desktop App) | Auto-fallback | Always uses IndexedDB mode |

---

## Key Points for Redesign

1. **Two authenticator prompts are unavoidable** - This is WebAuthn's design

2. **The fallback exists for**:
   - Browsers without PRF/LargeBlob support
   - Users whose authenticators don't support these extensions
   - Electron app (always uses fallback)

3. **Error scenarios to handle**:
   - User cancels first authenticator prompt
   - User cancels second authenticator prompt
   - Browser doesn't support passkeys at all
   - Authenticator rejects the operation

4. **The "double step" messaging** is currently shown upfront - users should understand they'll authenticate twice

---

*Updated: 2025-11-23*
