---
type: bug
title: "Mobile Metro bundling fails at 99.9% — unable to resolve ./index from root"
status: resolved
priority: high
ai_generated: true
created: 2026-03-15
updated: 2026-03-15
---

# Mobile Metro bundling fails at 99.9% — unable to resolve ./index from root

> **AI-Generated**: May contain errors. Verify before use.

## Symptoms

When running the mobile app via `yarn mobile` or `yarn expo start` from the `mobile/` directory:

1. Metro bundles ~1428/1429 modules successfully, then **hangs at 99.9%** with no error displayed in the terminal
2. The emulator shows a blank white screen or "Bundling 98.0%" that never completes
3. The actual error is only visible when fetching the bundle URL directly:

```bash
curl -s "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false" | tail -c 500
```

**Error message** (hidden from terminal):
```
Unable to resolve module ./index from D:\GitHub\Quilibrium\quorum-desktop/.:
None of these files exist:
  * ..\index(.android.ts|.native.ts|.ts|...)
```

**Additional symptom**: The Expo Dev Launcher splash screen gets permanently stuck due to a separate bug (`kotlin.UninitializedPropertyAccessException: lateinit property devMenuHost has not been initialized`). Workaround: `yarn mobile:connect`.

## Root Cause Analysis (Verified)

**Five distinct issues** were found and fixed, each masked by the previous one:

### Issue 1: Root package.json entry point resolution (PRIMARY)

Expo's `getMetroServerRoot()` resolves the workspace root (monorepo root) as Metro's server root. When the native app requests `/index.bundle`, Metro resolves `./index` from `quorum-desktop/.`.

The root `package.json` has `"main": "web/electron/main.cjs"` (for Electron). This is blocked by `blockList`. Metro then falls back to `./index` at the root — which doesn't exist. Metro fails silently and hangs at 99.9%.

**Fix**: In `resolveRequest`, intercept `./index` from `quorum-desktop/.` and redirect to `mobile/index.ts` (the actual mobile entry point). This also ensures the native app's default `/index.bundle` URL works correctly.

### Issue 2: Overly broad `web/` blockList regex

The blockList entry `.*[/\\]web[/\\].*` blocked ALL paths containing `/web/`, including `node_modules/expo-modules-core/src/web/`.

**Fix**: Anchored regex to monorepo root only:
```javascript
new RegExp(monorepoRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[/\\\\]web[/\\\\].*')
```

### Issue 3: `multiformats` subpath imports not resolved

The `multiformats` package uses `"exports"` for subpath imports like `multiformats/bases/base58`. With `unstable_enablePackageExports: false`, Metro can't resolve these.

**Fix**: Added `resolveRequest` handler to map `multiformats/*` to `dist/src/` files.

### Issue 4: Stale `AccentColorSwitcher` imports

Removed component still imported in two mobile test screens.

**Fix**: Removed from `PrimitivesMenuScreen.tsx` and `ThemeTestScreen.tsx`.

### Issue 5: Native app requests wrong bundle URL

The native app requests `/index.bundle` but the correct manifest URL is `/mobile/index.ts.bundle`. The original `resolveRequest` fix returned an empty module for `./index` from root, which made `/index.bundle` return a 1-module empty bundle instead of the app.

**Fix**: Changed the intercept from returning `__empty.js` to redirecting to `mobile/index.ts`. Now `/index.bundle` serves the actual app.

## Files Changed

- **`mobile/metro.config.js`** — Three `resolveRequest` handlers + anchored `blockList` regex
- **`mobile/__empty.js`** — Empty module stub (no longer used as entry, kept as fallback)
- **`mobile/test/primitives/PrimitivesMenuScreen.tsx`** — Removed `AccentColorSwitcher` import/usage
- **`mobile/test/primitives/ThemeTestScreen.tsx`** — Removed `AccentColorSwitcher` import/usage
- **Root `package.json`** — Updated mobile scripts (`mobile:connect`, `mobile:android`, etc.)

## Cleanup Needed

- Delete `index.native.js` from monorepo root (leftover from debugging)

## How to Verify

```bash
# Start Metro with cleared cache
yarn mobile:clear

# In another terminal, connect the app
yarn mobile:connect

# Or verify via curl (should return ~21MB, HTTP 200):
curl -s -o /dev/null -w "HTTP=%{http_code} SIZE=%{size_download}\n" \
  "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false"
```

First bundle takes ~3-5 minutes (7400+ modules, 21MB). Subsequent loads are cached.

## Prevention

- When Metro hangs silently, always check the bundle URL directly via curl for error details
- `blockList` regexes must be anchored to specific directories, never use generic path patterns like `.*web.*`
- When removing components from desktop codebase, grep for imports in `mobile/` too
- Test Metro bundle compilation as part of CI

## Environment

- Windows 10 Pro, x86_64
- Node.js v22.14.0
- Expo 53.0.22, React Native 0.79.6
- expo-dev-client 5.2.4, expo-dev-launcher 5.1.16, expo-dev-menu 6.1.14
- Android emulator: Pixel 7 API 36
- Yarn workspaces: root `quorum-desktop` → workspace `mobile`

---

_Created: 2026-03-15_
_Updated: 2026-03-15 17:30_
