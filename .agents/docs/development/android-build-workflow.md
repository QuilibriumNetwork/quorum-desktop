---
type: doc
title: Android Build Workflow
status: done
ai_generated: true
created: 2026-03-15
updated: 2026-03-15
related_docs:
  - .agents/docs/expo-dev-testing-guide.md
---

# Android Build Workflow

> **AI-Generated**: May contain errors. Verify before use.

## Quick Start (TL;DR)

```bash
# 1. Start the emulator (or use Android Studio Device Manager)
"$ANDROID_HOME/emulator/emulator" -avd Pixel_7 &

# 2. First time only — build and install the native app (~20 min)
yarn mobile:android

# 3. Start Metro dev server
yarn mobile:clear           # use :clear on first run or after config changes
# or
yarn mobile                 # normal start (uses cache)

# 4. Connect the app to Metro (bypasses stuck Dev Launcher)
yarn mobile:connect

# 5. Wait ~3-5 min for first bundle (7400+ modules). Subsequent reloads are fast.
```

## Available Scripts

| Script | Command | When to use |
|--------|---------|-------------|
| `yarn mobile` | `expo start --dev-client` | Day-to-day JS development |
| `yarn mobile:clear` | `expo start --dev-client --clear` | After config changes or stale cache |
| `yarn mobile:connect` | `adb` deep link | Bypass stuck Dev Launcher splash |
| `yarn mobile:android` | `expo run:android` | First build, or after native changes |
| `yarn mobile:ios` | `expo run:ios` | iOS (requires macOS) |
| `yarn mobile:web` | `expo start --web` | Web testing |

## Environment Setup

### Required Environment Variables

These are set as **Windows User environment variables** and persist across sessions:

| Variable | Value | Purpose |
|---|---|---|
| `ANDROID_HOME` | `C:\Android\Sdk` | Android SDK location |
| `JAVA_HOME` | `C:\Program Files\Android\Android Studio\jbr` | JDK bundled with Android Studio |
| `GRADLE_USER_HOME` | `D:\gradle-cache` | Gradle cache on accent-free path |

### Setting Environment Variables

```powershell
# PowerShell (run once, persists)
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Android\Sdk', 'User')
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Android\Android Studio\jbr', 'User')
[System.Environment]::SetEnvironmentVariable('GRADLE_USER_HOME', 'D:\gradle-cache', 'User')
```

**Restart VS Code after setting these** for them to take effect in terminals.

### Accented Username Workaround

The Windows username contains an accented character (`Niccolò Angeli`). NTFS junctions alias it to `C:\Users\kyn`. Combined with `GRADLE_USER_HOME` pointing to an accent-free path (`D:\gradle-cache`), this fully resolves Gradle build failures caused by non-ASCII characters in paths. No separate Windows account is needed.

### Android Emulator Setup

Create an emulator via **Android Studio > Tools > Device Manager** (the SDK command-line tools are not installed). A Pixel 7 AVD with API 36 (Google APIs + Play Store, x86_64) is available.

## Detailed Workflow

### Step 1: Start the Emulator

```bash
"$ANDROID_HOME/emulator/emulator" -avd Pixel_7 &
"$ANDROID_HOME/platform-tools/adb" wait-for-device
```

Or launch from Android Studio Device Manager.

### Step 2: Kill Stale Processes

Metro defaults to port 8081. If a previous Metro/Node process is occupying it, kill it first:

```bash
# Find process on port 8081
netstat -ano | grep ":8081"
# Kill it (replace PID)
taskkill /PID <PID> /F
```

### Step 3: First-Time Build (or after native dependency changes)

```bash
yarn mobile:android
```

**Important**: Use `yarn expo` — NOT `npx expo`. The `npx` resolution in Yarn workspaces doubles the `node_modules` path, causing `MODULE_NOT_FOUND` errors.

First build takes ~20-25 minutes. Subsequent builds ~30 seconds.

### Step 4: Start Metro Dev Server

After the first build, you only need Metro for subsequent runs:

```bash
# First run or after config changes (clears Metro cache):
yarn mobile:clear

# Normal start (uses cache, much faster):
yarn mobile
```

### Step 5: Connect the App

The Dev Launcher UI has a known bug where it gets stuck on the splash screen. Use the connect script:

```bash
yarn mobile:connect
```

This force-stops the app and relaunches it with a deep link directly to Metro, bypassing the broken Dev Launcher UI.

### Step 6: Wait for First Bundle

The first bundle takes **3-5 minutes** (7400+ modules, 21MB). The emulator will show "Loading from 127.0.0.1:8081..." during this time. This is normal.

After the first bundle, Metro caches everything. Hot reload (saving a file) is near-instant.

### Step 6: Set Up Port Forwarding (if needed)

The emulator's `localhost` is its own network, not the host PC. Port forwarding is needed:

```bash
adb reverse tcp:8081 tcp:8081
```

This is usually set up automatically by `expo run:android`, but if the app can't connect to Metro, run it manually.

## Troubleshooting

### Stuck at 99.9% Bundling / White Screen

This was caused by multiple Metro configuration issues in the monorepo setup. All are now fixed in `mobile/metro.config.js`. If it happens again:

1. **Always use `yarn mobile:clear`** to clear Metro's cache
2. **After clearing, use `yarn mobile:connect`** to bypass the Dev Launcher
3. **Check for hidden errors** by fetching the bundle URL directly:
   ```bash
   curl -s "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false" | tail -c 500
   ```
4. If the curl output is valid JS (starts with `var __BUNDLE_START_TIME__`), the bundle is fine — the emulator is just slow downloading 21MB

**Root causes (all fixed):**
- Root `package.json` `"main"` field conflicting with Metro resolution → redirected to `mobile/index.ts` in `resolveRequest`
- `blockList` regex `.*web.*` was too broad, blocking `expo-modules-core/src/web/` → anchored to monorepo root only
- `multiformats` subpath imports need package exports support → mapped manually in `resolveRequest`
- Stale `AccentColorSwitcher` imports in test files → removed

See [bug report](.agents/bugs/2026-03-15-mobile-metro-bundling-failure.md) for full details.

### "No apps connected" in Metro

The installed dev client build is stale or the emulator can't reach Metro.

1. Verify the emulator is running: `adb devices`
2. Set up port forwarding: `adb reverse tcp:8081 tcp:8081`
3. If still broken, rebuild: `yarn mobile:android`

### "Port 8081 is being used by another process"

Kill the old process (see Step 2) or let Expo use the alternate port — but note the app expects 8081 by default.

### Dev Launcher Stuck on Splash Screen

Use `yarn mobile:connect`. The `devMenuHost` lateinit property bug in `expo-dev-menu` causes the WebView-based launcher UI to fail silently. The deep link bypass is the workaround.

### `npx expo` MODULE_NOT_FOUND Error

```
Error: Cannot find module 'D:\...\node_modules\node_modules\expo\bin\cli'
```

Yarn workspaces causes `npx` to double the `node_modules` path. Always use `yarn expo` instead.

### Metro Config (`mobile/metro.config.js`)

Key configuration points:
- **`watchFolders`**: Includes root `src/` for shared code access
- **`nodeModulesPaths`**: Points to root `node_modules/` (hoisted by Yarn workspaces)
- **`resolveRequest`**: Handles three redirections:
  1. Root `./index` → `mobile/index.ts` (prevents root `package.json` conflict)
  2. `multiformats/*` subpath imports → `dist/src/` files (Metro doesn't support package exports)
  3. `@quilibrium/quilibrium-js-sdk-channels` → mock shim
- **`blockList`**: Excludes SDK package, root `web/` dir, electron packages (anchored regexes)

### Clean Build

```bash
cd mobile/android && ./gradlew clean
```

## Technical Decisions

- **`yarn expo` instead of `npx expo`**: Avoids Yarn workspaces path doubling issue.
- **`GRADLE_USER_HOME` on `D:\gradle-cache`**: Ensures Gradle never touches the accented user profile path.
- **Android Studio bundled JDK**: Using the JBR (JetBrains Runtime) ensures version compatibility with Android Gradle Plugin. Currently Java 21.
- **Dev Client over Expo Go**: The app uses native modules not available in Expo Go.

## Known Limitations

- **First bundle is slow (~3-5 min)**: The monorepo setup means Metro bundles 7400+ modules (entire `src/`). Subsequent reloads are cached and fast.
- **No iOS builds**: Requires macOS with Xcode; not available on this Windows setup.
- **No SDK command-line tools**: `avdmanager`/`sdkmanager` are not installed. Use Android Studio UI for managing AVDs and SDK components.
- **`@tabler/icons-react-native` warning**: Expo autolinking warns it cannot resolve this package path. Non-blocking — the build succeeds.
- **Dev Launcher splash bug**: The Dev Launcher WebView UI sometimes fails to render. Use `yarn mobile:connect`.

## Related Documentation

- [Expo Dev Testing Guide](../expo-dev-testing-guide.md) — General Expo setup and testing workflows
- [Metro Bundling Bug Report](../../.agents/bugs/2026-03-15-mobile-metro-bundling-failure.md) — Full investigation details

---

_Updated: 2026-03-15 17:30_
