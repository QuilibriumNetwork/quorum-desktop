# Expo Dev Testing Guide

Quick setup guide for testing Quorum mobile app with Expo Dev Client.

## Prerequisites

### Required Tools
- **Node.js** 18+
- **Yarn** (NOT npm!)
- **Git**
- **Android Studio** (all platforms) or **Xcode** (macOS only)

### Android Studio Setup & Verification

After installing Android Studio, verify your environment:

#### 1. Check Environment Variables
```bash
# Windows (PowerShell)
echo $env:ANDROID_HOME
echo $env:Path

# macOS/Linux
echo $ANDROID_HOME
echo $PATH
```

#### 2. Set Missing Variables (if needed)
```bash
# Windows (run as Administrator)
setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"
setx PATH "%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools"

# macOS/Linux (add to ~/.bashrc or ~/.zshrc)
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools
```

#### 3. Verify Android Tools
```bash
# These commands should work after setup
adb --version
emulator -version
```

### Install Expo Tools
```bash
yarn global add expo-cli eas-cli
```

## Setup Steps

### 1. Clone & Install
```bash
git clone https://github.com/quilibrium/quorum-desktop.git
cd quorum-desktop
yarn install  # MUST use yarn, not npm
```

### 2. First-Time Device Setup

#### Android
```bash
cd mobile
yarn expo run:android  # Builds and installs dev client (up to 30 min first time)
```

#### iOS (macOS only)
```bash
cd mobile
yarn expo run:ios  # Builds and installs dev client (up to 30 min first time)
```

## Running the App

**IMPORTANT**: The emulator must be started manually BEFORE running the dev server.

### Step-by-step Workflow

1. **Start the emulator first** (choose one):
   ```bash
   # Android emulator
   emulator @AVD_NAME
   
   # iOS simulator (macOS only)
   open -a Simulator
   ```

2. **Start the dev server** (from project root):
   ```bash
   # Start dev server
   yarn mobile
   
   # With tunnel (for remote devices)
   yarn mobile:tunnel
   
   # Clear cache if issues
   yarn mobile:clear
   
   # Platform-specific
   yarn mobile:android
   yarn mobile:ios
   ```

3. **The app should open automatically** in the running emulator

**Note**: If you run a full build (`yarn expo run:android` or `yarn expo run:ios`), the emulator will be started automatically during the build process.

## Device Requirements

### Physical Android Device
1. Enable Developer Options & USB Debugging
2. Connect via USB
3. Trust computer when prompted

### Android Emulator
```bash
# List available emulators
emulator -list-avds

# Start specific emulator (replace AVD_NAME with your emulator name)
emulator @AVD_NAME

# Or start default emulator
emulator @Pixel_3a_API_30_x86
```

### iOS Simulator (macOS only)
```bash
# List available simulators
xcrun simctl list devices

# Open simulator app
open -a Simulator

# Boot specific device (optional)
xcrun simctl boot "iPhone 14"
```

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Metro bundler crash | `yarn mobile:clear` |
| Build fails | Clean build: `cd mobile/android && ./gradlew clean` |
| Network issues | Use tunnel: `yarn mobile:tunnel` |
| Android SDK not found | Set `ANDROID_HOME` environment variable |

## Testing Commands

All from project root:
- `yarn mobile` - Start standard dev server
- `yarn mobile:tunnel` - Use tunnel for remote access
- `yarn mobile:clear` - Clear cache and restart
- `yarn mobile:android` - Open on Android
- `yarn mobile:ios` - Open on iOS
- `yarn mobile:build` - Build Android APK

## Important Notes

- **ALWAYS use yarn**, never npm
- Shake device or press `Cmd+D`/`Cmd+M` for dev menu
- First build takes up to 30 minutes
- Both devices must be on same network (unless using tunnel)

---

*Last updated: 2025-09-03 15:45 UTC*