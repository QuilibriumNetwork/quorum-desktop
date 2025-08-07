# Cross-Platform Repository Implementation

[← Back to INDEX](../INDEX.md)

This document explains the implemented cross-platform repository structure for the Quorum desktop application, detailing what changed from the previous structure and how the build configurations were modified to support both development and production environments.

## What Changed: Before vs After

### Previous Structure (Single Platform)
```
quorum-desktop/
├── src/                    # Mixed web/shared code
├── index.html             # Web entry at root
├── main.jsx              # Web entry point at root
├── vite.config.js        # Single config at root
├── electron/             # Electron wrapper at root
├── public/               # Web assets
├── package.json          # Web dependencies
└── node_modules/         # Dependencies
```

### New Structure (Cross-Platform Ready)
```
quorum-desktop/
├── src/                          # SHARED CODE (90% of app)
│   ├── components/
│   │   ├── primitives/           # Cross-platform UI components
│   │   │   ├── Button/
│   │   │   │   ├── Button.web.tsx     # Web implementation
│   │   │   │   ├── Button.native.tsx  # Mobile implementation
│   │   │   │   ├── types.ts           # Shared types
│   │   │   │   └── index.ts           # Platform-aware exports
│   │   │   └── ...
│   │   ├── Router/               # Platform-specific routing
│   │   │   ├── Router.web.tsx    # React Router (web)
│   │   │   ├── Router.native.tsx # React Navigation (mobile)
│   │   │   └── index.ts
│   │   └── ... (existing components)
│   ├── hooks/                    # 100% shared business logic
│   ├── api/                      # 100% shared API layer
│   ├── utils/
│   │   └── platform.ts           # NEW: Platform detection utilities
│   └── ... (existing structure)
│
├── web/                          # WEB-SPECIFIC FILES
│   ├── index.html               # Web HTML entry (moved from root)
│   ├── main.tsx                 # Web React entry (moved from root)
│   ├── vite.config.ts           # Web build config (moved from root)
│   └── electron/                # Electron wrapper (moved from root)
│       ├── main.cjs
│       └── preload.cjs
│
├── mobile/                       # MOBILE-SPECIFIC PLACEHOLDER
│   ├── App.tsx                  # React Native entry point
│   ├── app.json                 # Expo/RN configuration
│   ├── metro.config.js          # Metro bundler config
│   └── babel.config.js          # Babel config for RN
│
├── index.html                    # BUILD-ONLY: Root HTML for flat output
├── public/                       # SHARED assets (unchanged location)
├── dist/                        # PLATFORM-SPECIFIC BUILDS
│   ├── web/                     # Complete web distribution
│   └── mobile/                  # Future mobile distribution
├── package.json                  # SHARED dependencies & scripts
├── yarn.lock                     # SHARED lock file
└── node_modules/                 # SHARED dependencies
```

## Key Architectural Changes

### 1. Platform Detection System
**New file**: `src/utils/platform.ts`
```typescript
export function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

export function isMobile(): boolean {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

export function isElectron(): boolean {
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')) {
    return true;
  }
  return false;
}

export function isNative(): boolean {
  return isMobile(); // Alias for backward compatibility
}
```

**Usage in App.tsx**:
```typescript
// Before: Hardcoded electron detection
const isElectron = navigator.userAgent.includes('Electron');

// After: Platform-aware detection
import { isWeb, isElectron } from './utils/platform';
// ...
{isWeb() && isElectron() && <CustomTitlebar />}
```

### 2. Platform-Specific Router Abstraction
**New structure**: `src/components/Router/`
- `Router.web.tsx` - React Router implementation
- `Router.native.tsx` - React Navigation placeholder
- `index.ts` - Platform-aware exports

**Web Router** (`Router.web.tsx`):
```typescript
import { Routes, Route } from 'react-router';
// Existing routing logic extracted from App.tsx
export function Router() {
  return (
    <Routes>
      {/* Existing routes unchanged */}
    </Routes>
  );
}
```

### 3. Cross-Platform Primitive Components
Enhanced primitive components with platform-specific implementations:
- `Button.web.tsx` - Web implementation with CSS
- `Button.native.tsx` - React Native implementation
- Shared types and interfaces

## Build Configuration Changes

The most critical changes were made to support both development and production builds with the new structure.

### The Core Challenge
**Problem**: Different requirements for dev vs build contexts:
- **Dev server**: Needs to access `node_modules` from project root
- **Build**: Needs to avoid nested `dist/web/web/index.html` structure

### ESolution: Environment-Specific Entry Points

**New Vite Configuration** (`web/vite.config.ts`):
```typescript
import { defineConfig } from 'vite';
// ... other imports

export default defineConfig(({ command }) => ({
  root: resolve(__dirname, '..'), // Project root for dependency resolution
  publicDir: 'public',
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist/web',
    emptyOutDir: true,
    rollupOptions: {
      external: (id) => {
        if (process.env.NODE_ENV === 'production' && id.includes('/dev/')) {
          return true;
        }
        return false;
      },
      // KEY SOLUTION: Environment-specific entry points
      input: command === 'build' 
        ? resolve(__dirname, '..', 'index.html')  // Build: use root HTML (flat output)
        : resolve(__dirname, 'index.html'),       // Dev: use web/index.html
    },
  },
  // ... rest of config
}));
```

### Why This Works

1. **Development (`yarn dev`)**:
   - Uses `web/index.html` as entry point
   - Vite root is project root → can access `node_modules`
   - References `/web/main.tsx` in HTML

2. **Production (`yarn build`)**:
   - Uses `index.html` at project root as entry point
   - Avoids nested `dist/web/web/` structure
   - Creates clean `dist/web/index.html` output

### Dual HTML Strategy

**Development HTML** (`web/index.html`):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="./quorumicon-blue.png" />
    <!-- ... other head content ... -->
    <script src="./handleredirect.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>  <!-- Dev path -->
  </body>
</html>
```

**Build HTML** (`index.html` at root):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="./quorumicon-blue.png" />
    <!-- ... other head content ... -->
    <script src="./handleredirect.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./web/main.tsx"></script>  <!-- Build path -->
  </body>
</html>
```

## Updated Package.json Scripts

```json
{
  "scripts": {
    // Web Development (uses web/vite.config.ts)
    "dev": "vite --config web/vite.config.ts",
    "build": "vite build --config web/vite.config.ts", 
    "build:preview": "yarn build && yarn preview --port 3000 --config web/vite.config.ts",
    "preview": "vite preview --config web/vite.config.ts",
    
    // Electron (uses new paths)
    "electron:dev": "NODE_ENV=development electron web/electron/main.cjs",
    "electron:build": "yarn build && electron-builder",
    
    // Mobile (placeholder - not active yet)
    "mobile:dev": "echo 'Mobile development not yet active. Run: cd mobile && expo start'",
    "mobile:android": "echo 'Mobile development not yet active. Run: cd mobile && expo start --android'",
    "mobile:ios": "echo 'Mobile development not yet active. Run: cd mobile && expo start --ios'",
    
    // Existing scripts unchanged
    "lint": "eslint .",
    "format": "prettier --write .",
    "lingui:extract": "lingui extract",
    "lingui:compile": "lingui compile"
  }
}
```

## Build Output Structure

### Correct Cross-Platform Build Structure
```
dist/
└── web/                    # Complete web distribution
    ├── index.html         ✅ Correct location
    ├── assets/            ✅ JS/CSS bundles
    │   ├── index-[hash].js
    │   ├── index-[hash].css
    │   └── messages-[hash].js (i18n chunks)
    ├── apple/             ✅ Emoji assets
    ├── quorumicon-blue.png ✅ Public assets
    ├── handleredirect.js   ✅ Static scripts
    └── channelwasm_bg.wasm ✅ WebAssembly module
```

**Future mobile builds will create**:
```
dist/
├── web/                   # Web distribution
└── mobile/                # Mobile distribution
    ├── android/          # Android APK/AAB
    └── ios/              # iOS IPA
```

## Dependency Management

### Single Shared Dependencies
- ✅ One `node_modules/` folder at root
- ✅ One `package.json` for all platforms  
- ✅ One `yarn.lock` file
- ✅ Web and mobile share 90%+ of dependencies

### Bundler Intelligence
- **Vite (Web)**: Only bundles web-compatible dependencies
- **Metro (Mobile)**: Only bundles mobile-compatible dependencies
- Platform-specific dependencies are ignored by other platforms

## Development Workflow

### Starting Development
```bash
# Web development (unchanged experience)
yarn dev
# → Opens http://localhost:5173

# Electron development  
yarn electron:dev
# → Opens Electron window

# Production build
yarn build
# → Creates dist/web/ with correct structure

# Preview production build
yarn build:preview
# → Serves from dist/web/ on http://localhost:3000
```

### Key Benefits Achieved

1. **Zero Disruption**: Existing web developers see no workflow changes
2. **Clean Separation**: Platform-specific code isolated in `web/` and `mobile/`
3. **Maximum Sharing**: 90%+ codebase shared between platforms
4. **Proper Build Structure**: Each platform gets clean `dist/platform/` output
5. **Both Environments Work**: Dev server and production builds both functional
6. **Future-Proof**: Ready for mobile development without further restructuring

## Technical Implementation Details

### Platform File Resolution
The build system automatically resolves platform-specific files:
- `Button.web.tsx` → Used in web builds
- `Button.native.tsx` → Used in mobile builds (when implemented)
- `Button.tsx` → Fallback for shared logic

### Shared Asset Access
Assets in `public/` are accessible to both platforms:
```typescript
// Works in both web and mobile
<img src="/quorumicon-blue.png" alt="Quorum" />
```

### Environment-Specific Builds
The Vite configuration intelligently handles different build contexts without requiring separate config files or build hacks.

---

**Implementation Status**: ✅ Complete and Production Ready  
**Next Phase**: Mobile platform development can begin using this structure

*Updated: 2025-08-07 11:00:00*