---
type: bug
title: Safari Passkey Session Loss - Random Logout on Browser Restart
status: open
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# Safari Passkey Session Loss - Random Logout on Browser Restart

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

Ref: https://t.me/c/1967251104/146703/198329

User on Safari (macOS Tahoe 26.2, Safari 26.2) experience random session loss where:

1. **User is logged in** to Quorum web app with valid passkey authentication
2. **User closes Safari** (normal quit, not clearing data)
3. **User reopens Safari** and navigates to Quorum
4. **App shows login screen** claiming "no passkeys" exist for this website
5. **Passkey still exists** in macOS Passwords.app/Keychain Access
6. **Only workaround**: Clear browser history/cache and re-import existing key
7. **Result**: All local data (messages, DMs, spaces) is lost

### What User Sees

The Safari WebAuthn dialog displays:

> **Sign In**
> "You don't have any passwords or passkeys saved for this website. You may be able to use one of the options below to sign in."
> - Scan QR Code
> - Use Security key

This dialog indicates Safari/WebAuthn cannot find a credential for the current domain, even though the user confirms a passkey exists in Passwords.app for their Quorum account.

### Key Observations from User Report

- Affects account created via **"Import Existing Key"** flow (Ed448 key from 25 December 2024)
- Passkey IS visible in macOS Passwords.app for the correct domain
- User exported key and confirmed it matches original (same address)
- **No pattern** - happens randomly, worked fine for days then suddenly failed
- **Cross-device sync also not working** between Quorum Mobile Beta and Safari web app
- User has NOT enabled automatic history clearing in Safari preferences
- Has happened "lots of times during 2025" - **recurring issue**

### Environment

- **OS**: macOS Tahoe 26.2
- **Browser**: Safari Version 26.2 (21623.1.14.11.9)
- **Account type**: Imported key file (.key), NOT originally created with passkey

## Root Cause

**Under Investigation** - Multiple potential causes identified:

### Hypothesis 1: localStorage vs Passkey Credential Mismatch

Per the [passkey authentication flow analysis](..\reports\onboarding-flow\passkey-authentication-flow-analysis-2025-11-23.md):

- Login state is determined by `localStorage['passkeys-list']` existence
- If localStorage is cleared but passkey credential remains in Keychain, the app shows login screen
- Safari may be clearing IndexedDB/localStorage while preserving Keychain data

**Evidence supporting this**:
- User reports passkey exists in Passwords.app but app says "no passkeys"
- App uses `localStorage['passkeys-list']` for "quick lookup" of credentials
- If this localStorage entry is lost, app doesn't know a passkey exists

### Hypothesis 2: Safari Storage Partitioning/ITP

Safari's Intelligent Tracking Prevention (ITP) has aggressive storage policies:
- May cap IndexedDB/localStorage for sites not visited frequently
- May partition storage differently after updates
- Storage may expire if not accessed within 7 days of ITP rules

### Hypothesis 3: Imported Key Flow Inconsistency

Per documentation, when importing a key file:
1. App goes through two-prompt passkey creation flow
2. Private key is stored in passkey credential (or IndexedDB fallback)
3. `localStorage['passkeys-list']` stores lookup info

**Potential issue**: If any step fails silently or data becomes inconsistent, the session could appear "lost" despite passkey existing in Keychain.

### Hypothesis 4: Config Sync Failure

Per [config-sync-system.md](..\docs\config-sync-system.md):
- User reported sync not working between Mobile Beta and Safari
- If `allowSync` is enabled but sync fails, could cause state inconsistencies
- Timestamp-based conflict resolution could reject local config in edge cases

## Solution

**Not yet implemented** - Pending investigation

### Proposed Investigation Steps

1. **Add diagnostic logging** to passkey authentication flow:
   - Log when `localStorage['passkeys-list']` is accessed
   - Log when localStorage entry is not found vs when passkey credential fails
   - Log Safari storage events/permissions

2. **Check for Safari-specific storage behavior**:
   - Test with Safari's "Prevent cross-site tracking" disabled
   - Test with different website data retention settings
   - Verify IndexedDB persistence across browser restarts

3. **Add recovery mechanism**:
   - If passkey exists in Keychain but localStorage is missing, offer "Recover Existing Passkey" flow
   - Scan for existing credentials before showing "no passkeys" message

4. **Cross-reference with config sync**:
   - Ensure local session state survives when sync fails
   - Verify timestamp handling doesn't inadvertently invalidate local config

### Files to Investigate

- `src/components/modals/PasskeyModal.tsx` - Modal UI and flow logic
- `src/components/context/PasskeysContext.tsx` - React context for passkey state
- `src/hooks/business/user/useAuthenticationFlow.ts` - Auth state management
- `src/components/onboarding/Login.tsx` - Login screen logic
- `src/services/ConfigService.ts` - Config sync that may affect session

## Prevention

Once root cause is identified:

1. **Robust session persistence**: Don't rely solely on localStorage for session state
2. **Graceful recovery**: Detect orphaned passkeys and offer recovery flow
3. **Safari-specific handling**: Account for ITP and storage partitioning behaviors
4. **Better error messaging**: If passkey exists but can't be used, explain why
5. **Diagnostic mode**: Add way for users to export debug info for support

## Related Issues

- Cross-device sync not working (mentioned by same user)
- May be related to "Orphaned passkeys" issue documented in passkey flow analysis
- Similar to "Prompt #1 Succeeds, Prompt #2 Fails" edge case

## User Impact

- **Severity**: High - Complete data loss (all messages, DMs, spaces gone)
- **Frequency**: Random but recurring - happened "lots of times during 2025"
- **Workaround**: Clear cache and re-import key file (loses all local data)
- **Affected Users**: Safari users who imported existing key files

---


_Reported by: User "Oumlaut" via Telegram support chat_
_Environment: macOS Tahoe 26.2, Safari 26.2_
