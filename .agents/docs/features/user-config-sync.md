---
type: doc
title: User Config Sync on Existing Accounts
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2025-12-13T00:00:00.000Z
---

# User Config Sync on Existing Accounts

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

When a returning user imports an existing key on a new device, the onboarding flow automatically fetches and applies their saved profile data (display name, profile image) from remote encrypted storage. This eliminates the need to re-enter profile information on each new device.

## Architecture

### Key Components

| File | Purpose |
|------|---------|
| [useOnboardingFlowLogic.ts](src/hooks/business/user/useOnboardingFlowLogic.ts) | Core `fetchUser()` function with decryption logic |
| [usePasskeyAdapter.web.ts](src/hooks/platform/user/usePasskeyAdapter.web.ts) | Provides `exportKey` for key extraction |
| [usePasskeyAdapter.native.ts](src/hooks/platform/user/usePasskeyAdapter.native.ts) | Omits `exportKey` for graceful mobile degradation |
| [Onboarding.tsx](src/components/onboarding/Onboarding.tsx) | Triggers fetch on mount, shows loading state |

### Data Flow

1. **Onboarding mounts** → triggers `fetchUser(address, setUser)`
2. **Check adapter support** → native returns early (no `exportKey`)
3. **Verify registration** → `apiClient.getUser(address)`
4. **Decrypt keyset** → passkey SDK decrypts user's identity key
5. **Fetch config** → `apiClient.getUserSettings(address)` (bypasses ConfigService)
6. **Decrypt config** → AES-GCM decryption using derived key from private key
7. **Validate data** → Zero-trust validation of name and profile_image
8. **Apply profile** → Update passkey storage, call `setUser()` to skip onboarding

### Design Decision: Bypass ConfigService

The implementation directly calls `apiClient.getUserSettings()` instead of using `ConfigService.getConfig()` because:

- **No side effects**: `getConfig()` triggers space/bookmark sync which can fail during onboarding
- **Faster**: Only fetches and decrypts profile fields needed
- **Simpler**: Fewer dependencies and error paths

## Security Controls

All remote config data is treated as untrusted (zero-trust model):

| Control | Implementation |
|---------|----------------|
| Display name validation | `validateDisplayName()` - rejects XSS, reserved names, oversized |
| Profile image validation | `validateProfileImage()` - rejects >2MB, invalid MIME types |
| Silent failures | No PII logged, graceful fallback to normal onboarding |

## Platform Behavior

| Platform | Behavior |
|----------|----------|
| **Web** | Full config sync - fetches and applies remote profile |
| **Mobile** | Graceful degradation - `exportKey` undefined, proceeds to normal onboarding |

## Usage

The feature activates automatically during onboarding when:
1. User has an existing registered address
2. Platform adapter provides `exportKey` (web only)
3. Remote config contains valid `name` field

No user action required - if profile exists remotely, onboarding is skipped entirely.

## Error Handling

When profile fetch fails for registered users, a toast notification is shown:

| Scenario | Toast | Message |
|----------|-------|---------|
| User not registered (404) | Silent | Proceeds to normal onboarding |
| Registered, no saved config | Silent | Proceeds to normal onboarding |
| Keyset decryption fails | ⚠️ Warning | "Couldn't load your saved profile. Please re-enter your name and profile image." |
| Config decryption fails | ⚠️ Warning | "Couldn't decrypt your saved profile. Please re-enter your name and profile image." |

## Known Limitations

- **Existing users migration**: Users who enabled sync before this feature must save their profile once in User Settings for the `name` and `profile_image` fields to be included in their remote config
- **Web-only**: Mobile lacks Web Crypto APIs needed for decryption

## Related Documentation

- [Task: user-config-sync-on-existing-accounts.md](.agents/tasks/user-config-sync-on-existing-accounts.md) - Full implementation details
- [ConfigService.ts](src/services/ConfigService.ts) - Full config management (spaces, bookmarks)
- [useProfileValidation.ts](src/hooks/business/validation/useProfileValidation.ts) - Image validation utility

---
