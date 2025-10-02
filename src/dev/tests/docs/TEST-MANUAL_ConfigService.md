# Manual Testing Guide - ConfigService

This guide covers manual testing procedures to verify the ConfigService extraction.

## Overview

ConfigService handles user configuration management, including:
- Loading and decrypting user settings from the server
- Saving and encrypting user settings to the server
- Restoring spaces and encryption states from synced config
- Cross-device configuration synchronization

## Quick Smoke Test (2 minutes)

**Verifies both `getConfig` and `saveConfig` are working:**

1. Open Settings
2. Change your display name
3. Click Save
4. Reload the page (F5)
5. ✅ **Verify**: Display name persists after reload

If this works, both functions are operating correctly:
- `saveConfig` encrypted and uploaded your config
- `getConfig` decrypted and loaded it on page reload

## Detailed Test Cases

### 1. User Settings Save/Load

**Tests**: `saveConfig()` and `getConfig()`

**Steps:**
1. Go to Settings
2. Change multiple settings:
   - Display name
   - Profile picture
   - Theme preference
   - Notification settings
3. Click Save
4. Reload the page

**Expected Results:**
- ✅ Settings save without errors
- ✅ All settings persist after reload
- ✅ No console errors

**Failure Indicators:**
- ❌ Settings revert after reload
- ❌ Console error: "received config with invalid signature!"
- ❌ Save button shows error

---

### 2. Cross-Device Sync

**Tests**: `saveConfig()` encryption and `getConfig()` decryption

**Steps:**
1. On Device A: Change settings and save
2. On Device B: Login with same account
3. Wait for sync (or trigger manual sync if available)

**Expected Results:**
- ✅ Settings from Device A appear on Device B
- ✅ Display name matches
- ✅ Profile picture matches
- ✅ Preferences match

**Failure Indicators:**
- ❌ Settings don't sync between devices
- ❌ Console error: "saved config is out of date"

---

### 3. Space Restoration from Config

**Tests**: `getConfig()` space restoration logic

**Steps:**
1. On Device A:
   - Create a space
   - Join channels
   - Send messages
2. On Device B (or clear data and re-login):
   - Login with same account
   - Wait for config to load

**Expected Results:**
- ✅ Space appears in sidebar
- ✅ Can send/receive messages
- ✅ Can view channel history
- ✅ No encryption errors

**Failure Indicators:**
- ❌ Spaces don't appear after login
- ❌ Console error: "decrypted space with no known config key"
- ❌ Console error: "Decrypted Space with no known hub key"
- ❌ Console error: "Could not add Space"
- ❌ Can't send messages due to encryption errors

---

### 4. Config Loading on Startup

**Tests**: `getConfig()` initialization

**Steps:**
1. Ensure you have saved settings
2. Close the app completely
3. Reopen the app
4. Watch the console during loading

**Expected Results:**
- ✅ App loads without errors
- ✅ Display name loads correctly
- ✅ Profile picture loads correctly
- ✅ Spaces are restored
- ✅ No console errors

**Failure Indicators:**
- ❌ Settings reset to defaults
- ❌ Spaces missing after reload
- ❌ Console error during config load

---

### 5. Settings Sync Toggle

**Tests**: `saveConfig()` conditional encryption

**Steps:**
1. Go to Settings
2. Find "Sync settings across devices" toggle
3. Enable it
4. Change some settings and save
5. Disable it
6. Change some settings and save

**Expected Results:**
- ✅ With sync enabled: settings encrypted and uploaded
- ✅ With sync disabled: settings saved locally only
- ✅ Console shows "syncing config" when enabled

**Failure Indicators:**
- ❌ Sync toggle has no effect
- ❌ Settings don't upload when sync enabled

---

## Console Monitoring

Watch for these log messages in the browser console (F12):

### Success Messages:
- `"syncing config"` - Config is being encrypted and uploaded

### Warning Messages:
- `"saved config is out of date"` - Server has older config than local
- `"received config with invalid signature!"` - Signature verification failed
- `"decrypted space with no known config key"` - Space missing config key
- `"Decrypted Space with no known hub key"` - Space missing hub key
- `"Could not obtain manifest for Space"` - Manifest fetch failed

### Error Messages:
- `"Could not add Space"` - Space restoration failed

## Test Environment Notes

- **Browser Console**: Keep F12 open to catch errors
- **Network Tab**: Monitor API calls to `/api/user-settings`
- **Multiple Devices**: Test with actual different browsers/devices for best results
- **Clear Data**: Use incognito mode or clear browser data to test fresh login

## Integration Points

ConfigService interacts with:
- **EncryptionService**: Uses encryption for space restoration
- **SpaceService**: Uses `sendHubMessage` for sync notifications
- **MessageService**: Indirectly through space/message operations
- **Backend API**: `getUserSettings()`, `postUserSettings()`, `getSpace()`, `getSpaceManifest()`, `postHubAdd()`

## Encryption Details

- **Algorithm**: AES-GCM with 256-bit key
- **Key Derivation**: SHA-512 hash of user private key
- **Signature**: ED448 signature for config verification
- **IV**: 12-byte random initialization vector

---

**Last Updated**: 2025-10-01 (ConfigService extraction)
