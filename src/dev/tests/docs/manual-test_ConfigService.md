# ConfigService Manual Testing Guide

Quick reference for manually testing ConfigService operations in the UI.

## Quick Test Checklist

- [ ] Get config - Load user settings from server/local
- [ ] Save config - Save settings locally and to server
- [ ] Config sync - Verify cross-device synchronization
- [ ] Space restoration - Restore spaces from config
- [ ] Settings persistence - Verify settings persist after reload

---

## Detailed Test Procedures

### Function 1: getConfig()

**What it does:** Loads user configuration from server or local storage
**Where to test:** Automatically on app startup/login
**Prerequisites:** User account with saved settings

**Steps:**
1. Have saved settings (display name, profile pic, etc.)
2. Close and reopen the app
3. Observe config loading during startup
4. Watch console for config operations

**Expected:**
- Config fetched from API (getUserSettings)
- If remote config exists and is newer:
  - Downloaded and decrypted
  - Signature verified
  - Applied to app
- If no remote config or older:
  - Local config used
  - Or default config returned
- Spaces restored from config
- Settings applied correctly

**Verify:**
- Check console for config loading
- API call to getUserSettings
- Config decrypted if remote exists
- Signature verification passed
- Settings appear correctly (name, avatar, etc.)
- Spaces restored from spaceKeys
- No console errors

**Errors:**
- ❌ "received config with invalid signature!" - Signature check failed
- ❌ "saved config is out of date" - Remote older than local
- ❌ "decrypted space with no known config key" - Space missing config key
- ❌ "Decrypted Space with no known hub key" - Space missing hub key
- ❌ "Could not add Space" - Space restoration failed

---

### Function 2: saveConfig()

**What it does:** Saves user settings locally and optionally to server
**Where to test:** Settings → Change settings → Save
**Prerequisites:** User account

**Steps:**
1. Open Settings
2. Change display name
3. Change profile picture
4. Toggle allowSync if available
5. Click Save
6. Observe save process

**Expected:**
- Timestamp updated to current time
- If allowSync is true:
  - Config encrypted with AES-GCM
  - Signed with ED448
  - Uploaded to server (postUserSettings)
  - Space keys included in sync
- If allowSync is false:
  - Only saved locally
  - Not uploaded to server
- Local database updated
- Changes visible immediately

**Verify:**
- Check console for "syncing config" (if allowSync true)
- API call to postUserSettings (if allowSync true)
- Config saved to local database
- Timestamp updated
- Settings persist after reload
- No encryption errors

**Errors:**
- ❌ Save fails - Database error
- ❌ Sync fails - API or encryption error
- ❌ Settings don't persist - Database save failed
- ❌ allowSync ignored - Flag not checked

---

### Function 3: Cross-Device Sync

**What it does:** Syncs settings across multiple devices
**Where to test:** Two devices with same account
**Prerequisites:** Two devices or browsers, allowSync enabled

**Steps:**
1. **Device A**: Enable "Sync settings" in settings
2. **Device A**: Change display name to "Test Sync A"
3. **Device A**: Save settings
4. **Device B**: Login or reload if already logged in
5. **Device B**: Wait for config to load
6. **Device B**: Verify display name is "Test Sync A"

**Expected:**
- Device A: Config encrypted and uploaded
- Device B: Config downloaded and decrypted
- Settings match across devices
- Spaces sync across devices
- Profile changes visible on both

**Verify:**
- Device A uploads config successfully
- Device B fetches newer config
- Timestamp comparison works
- Signature verification succeeds
- Settings match exactly
- Spaces restored on Device B

**Errors:**
- ❌ Settings don't sync - Config not uploaded
- ❌ Device B doesn't update - Not fetching remote config
- ❌ Signature fails - Encryption mismatch
- ❌ Partial sync - Some settings missing

---

### Function 4: Space Restoration

**What it does:** Restores spaces from synced config
**Where to test:** Login on new device or clear data
**Prerequisites:** Have spaces on one device

**Steps:**
1. **Device A**: Create a space and send messages
2. **Device A**: Ensure sync is enabled
3. **Device A**: Wait for config to upload
4. **Device B**: Login with same account (or clear browser data and re-login)
5. **Device B**: Watch spaces load during config fetch

**Expected:**
- Config fetched from server
- Space keys decrypted from config
- For each space in config:
  - Space manifest fetched from API
  - Manifest decrypted
  - Space keys saved locally
  - Inbox generated
  - Space added to database
  - Encryption state initialized
  - Hub registration (postHubAdd)
  - Space appears in sidebar
- Can send/receive messages in restored spaces

**Verify:**
- Check console for space restoration
- All spaces from Device A appear on Device B
- Can access all channels
- Encryption keys configured
- Can send messages
- Messages sync correctly

**Errors:**
- ❌ Spaces don't appear - Config fetch failed
- ❌ "decrypted space with no known config key" - Config key missing
- ❌ "Decrypted Space with no known hub key" - Hub key missing
- ❌ "Could not obtain manifest for Space" - Manifest fetch failed
- ❌ "Could not add Space" - Restoration failed
- ❌ Can't send messages - Encryption not configured

---

### Function 5: Settings Persistence

**What it does:** Ensures settings persist across sessions
**Where to test:** Save settings, close app, reopen
**Prerequisites:** User account with settings

**Steps:**
1. Change multiple settings:
   - Display name
   - Profile picture
   - Theme preference
   - Notification settings
2. Save settings
3. Verify changes appear
4. Close browser completely
5. Reopen browser and app
6. Verify all settings persisted

**Expected:**
- All settings saved locally
- Settings restored on reload
- No data loss
- Timestamp preserved
- Config loaded from local DB if no newer remote

**Verify:**
- Settings appear after reload
- Display name correct
- Profile picture correct
- Preferences correct
- No reset to defaults
- Timestamp matches last save

**Errors:**
- ❌ Settings reset - Local save failed
- ❌ Partial loss - Some settings not saved
- ❌ Config corruption - Invalid data

---

## Testing Tips

**Console Monitoring:**
- Keep browser DevTools open (F12)
- Watch for "syncing config" message
- Check signature verification
- Monitor space restoration

**Common Messages:**
- `"syncing config"` - Config being encrypted and uploaded
- `"saved config is out of date"` - Remote older than local
- `"received config with invalid signature!"` - Signature verification failed
- Various space restoration messages

**Best Practices:**
- Test with allowSync both enabled and disabled
- Test cross-device sync with actual different devices
- Test space restoration from clean state
- Verify encryption/decryption works correctly
- Check signature verification

**Config Structure:**
- `address` - User address
- `spaceIds` - Array of space IDs user is in
- `spaceKeys` - Array of space encryption keys
- `allowSync` - Whether to sync to server
- `timestamp` - When config was last saved
- Other user preferences

**Encryption Details:**
- Algorithm: AES-GCM 256-bit
- Key derivation: SHA-512 of user private key
- Signature: ED448
- IV: 12-byte random per encryption

**Integration Points:**
ConfigService interacts with:
- **Database**: getUserConfig, saveUserConfig
- **API**: getUserSettings, postUserSettings, getSpace, getSpaceManifest, postHubAdd
- **Encryption**: crypto.subtle (AES-GCM), js_sign_ed448, js_verify_ed448, js_decrypt_inbox_message, js_generate_ed448
- **SpaceService**: sendHubMessage for sync
- **EncryptionService**: For space restoration
- **QueryClient**: Update spaces and config cache

---

## Common Scenarios

### Scenario 1: First Time Setup
1. Create account
2. Set display name and avatar
3. Enable sync
4. Save settings
5. Settings uploaded to server

### Scenario 2: Multi-Device Usage
1. Login on multiple devices
2. Change settings on one device
3. Settings sync to other devices
4. All devices have same config

### Scenario 3: Space Sync
1. Join spaces on Device A
2. Login on Device B
3. All spaces appear on Device B
4. Can access and use all spaces

### Scenario 4: Offline → Online
1. Change settings while offline
2. Settings saved locally
3. Go online
4. Settings uploaded to server
5. Available on other devices

---

_Last updated: 2025-10-03_
