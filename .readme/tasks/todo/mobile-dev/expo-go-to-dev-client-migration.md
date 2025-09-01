# Expo Go to Expo Dev Client Migration Plan - Simplified

## Why Migrate?

Your project has native dependencies (`@quilibrium/quilibrium-js-sdk-channels`, crypto libraries, file system modules) that don't work in Expo Go's sandboxed environment. Dev Client creates a custom build with your dependencies included.

## Simple Migration Steps

### 0. Prerequisites (One-Time Setup) - DONE on LaMat Windows 01.09.2025

**Install Android Studio:**
1. Download from developer.android.com
2. Install with default settings
3. Open Android Studio → Tools → SDK Manager → Install latest SDK
4. Create virtual device: Tools → AVD Manager → Create Virtual Device

**Set Environment Variable:**
```bash
# Windows: Add to system PATH
setx ANDROID_HOME "C:\Users\%USERNAME%\AppData\Local\Android\Sdk"
```

**Verify setup:**
Restart terminal
```bash
echo %ANDROID_HOME% #verify
adb devices  # Should list emulator or connected device
```

### 1. Install Dev Client Plugin

```bash
cd mobile
expo install expo-dev-client
```

### 2. Update Configuration

**File: `mobile/app.json`** - Add one line:

```json
{
  "expo": {
    "name": "quorum-mobile-playground",
    "slug": "quorum-mobile-playground",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": ["expo-dev-client"]
  }
}
```

### 3. Update Package Scripts

**File: `package.json`** - Change existing scripts:

```json
"mobile": "cd mobile && expo start --dev-client",
"mobile:tunnel": "cd mobile && expo start --dev-client --tunnel",
"mobile:clear": "cd mobile && expo start --dev-client --clear",
"mobile:android": "cd mobile && expo start --dev-client --android",
```

Add new script:
```json
"mobile:build": "cd mobile && expo run:android"
```

### 4. Build Development Client

**For Physical Phone (One-Time Setup):**
```bash
# Connect your Android phone via USB with USB debugging enabled
# From project root
yarn mobile:build

# This will:
# - Create android/ folder
# - Build custom APK with your dependencies
# - Install it on connected device
```

**For Emulator (Automatic):**
```bash
# From project root
yarn mobile:android

# This will automatically:
# - Start emulator
# - Build and install dev client
# - Start Metro bundler
# - Connect everything
```

### 5. Start Development

**Physical Phone Workflow:**
```bash
# Daily development (same as before, but with --dev-client flag)
yarn mobile

# Open the new "Expo Dev Client" app (not Expo Go) on your device
# Connect to the development server
```

**Emulator Workflow:**
```bash
# Everything automatic
yarn mobile:android

# Emulator opens, app builds, installs, and connects automatically
```

**Both Options:**
```bash
# Quick testing: Emulator
yarn mobile:android

# Final testing: Real phone
yarn mobile  # After running yarn mobile:build once
```

## That's It!

**Before**: Expo Go app → Limited runtime → Some features broken
**After**: Custom Dev Client app → Full runtime → All features working

## Troubleshooting

**If build fails:**
- Ensure Android Studio and ANDROID_HOME are set up
- Try `yarn mobile:clear` to clear Metro cache

**If app crashes:**
- Check Metro bundler logs for native module errors
- Some dependencies might need additional configuration

**If connection fails:**
- Use `--tunnel` flag for network issues
- Ensure firewall allows Metro bundler port

## Validation Checklist

- [ ] `expo run:android` builds successfully
- [ ] Dev Client app installs on device/emulator  
- [ ] `yarn mobile` connects to custom app (not Expo Go)
- [ ] Native crypto functions work
- [ ] File upload/download works
- [ ] Hot reload still works

## Rollback Plan

If issues arise, temporarily revert scripts to use Expo Go:
```json
"mobile": "cd mobile && expo start --tunnel"
```

Remove `"plugins": ["expo-dev-client"]` from app.json and use Expo Go app until issues are resolved.

---

## Detailed Rollback Steps (Expo Dev Client → Expo Go)

### Current State Analysis
The project is currently configured with:
- ✅ Expo Dev Client plugin in `mobile/app.json`
- ✅ Dev Client scripts in root `package.json`
- ✅ Native Android build in `mobile/android/` directory
- ✅ Native dependencies that won't work in Expo Go

### Step 1: Update Package Scripts

**File: `package.json`** - Revert scripts to Expo Go:

```json
"mobile": "cd mobile && expo start --tunnel",
"mobile:tunnel": "cd mobile && expo start --tunnel",
"mobile:clear": "cd mobile && expo start --clear --tunnel",
"mobile:android": "cd mobile && expo start --android --tunnel",
```

Remove dev client specific scripts:
```json
// Remove these:
"mobile:build": "cd mobile && expo run:android"
```

### Step 2: Update App Configuration

**File: `mobile/app.json`** - Remove dev client plugin:

```json
{
  "expo": {
    "name": "quorum-mobile-playground",
    "slug": "quorum-mobile-playground",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "package": "com.quilibrium.quorum",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
    // Remove: "plugins": ["expo-dev-client"]
  }
}
```

### Step 3: Remove Development Dependencies

**File: `mobile/package.json`** - Remove expo-dev-client:

```bash
cd mobile
yarn remove expo-dev-client
```

### Step 4: Clean Build Artifacts (Optional)

Remove native build directory to save space:
```bash
# WARNING: This will require rebuilding if you want to go back to dev client
rm -rf mobile/android/
rm -rf mobile/ios/ # if exists
```

Or keep it for later:
```bash
# Rename to preserve for future use
mv mobile/android mobile/android_backup
```

### Step 5: Install Expo Go App

1. Download **Expo Go** app from Play Store/App Store (not your custom dev client)
2. Uninstall any existing "Expo Dev Client" custom apps
3. Use the standard Expo Go app for development

### Step 6: Start Development

```bash
# From project root
yarn mobile

# OR with explicit tunnel (recommended for network issues)
yarn mobile:tunnel
```

### Step 7: Verify Rollback

**Expected behavior:**
- ✅ `expo start` opens Expo Go QR code
- ✅ Scan QR with Expo Go app (not custom dev client)
- ❌ Native crypto functions will be disabled/broken
- ❌ File uploads may not work correctly
- ❌ Some native dependencies will be unavailable

### Feature Limitations After Rollback

**Will Work:**
- ✅ Basic React Native components and navigation
- ✅ UI primitives and cross-platform components
- ✅ Most business logic and state management
- ✅ Networking and API calls
- ✅ Internationalization (Lingui)

**Will NOT Work (Expo Go Limitations):**
- ❌ `@quilibrium/quilibrium-js-sdk-channels` (native crypto)
- ❌ Advanced file system operations
- ❌ Native crypto libraries
- ❌ Custom native modules
- ❌ Platform-specific features requiring native code

### Rollback Validation Checklist

- [ ] Removed `"plugins": ["expo-dev-client"]` from `mobile/app.json`
- [ ] Updated package.json scripts to use standard `expo start`
- [ ] Removed expo-dev-client dependency
- [ ] Uninstalled custom dev client app from device
- [ ] Installed standard Expo Go app
- [ ] `yarn mobile` opens standard Expo QR code
- [ ] App loads in Expo Go (with native features disabled)
- [ ] UI components and navigation work correctly
- [ ] Known native features show appropriate fallbacks/errors

### Re-enabling Dev Client Later

If you need native features again, reverse these steps:

1. Add back `"plugins": ["expo-dev-client"]` to `mobile/app.json`
2. Restore dev client scripts in `package.json`
3. Run `yarn mobile:build` to rebuild custom dev client
4. Install custom dev client app on device

### Why Rollback Might Be Needed

**Common Scenarios:**
- Build issues on new machine/environment
- Android Studio setup problems
- Device/emulator connection issues
- Need quick UI testing without native features
- Sharing with team members without dev client setup
- Testing cross-platform primitive components

**Note:** This rollback sacrifices native functionality for easier setup and broader compatibility.

---

*Document created: 2025-01-09*
*Rollback section added: 2025-01-09*