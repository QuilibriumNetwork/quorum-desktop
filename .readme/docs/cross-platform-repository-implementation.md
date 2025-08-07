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

### Yarn Workspaces Implementation
The project uses **Yarn Workspaces** for proper monorepo dependency management, which was essential to resolve React version conflicts and ensure both platforms work correctly.

**Root package.json configuration**:
```json
{
  "workspaces": [
    "mobile"
  ],
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

**Key benefits of Yarn Workspaces**:
- ✅ Eliminates multiple React instances that caused Metro bundler errors
- ✅ Hoists shared dependencies to root `node_modules/`
- ✅ Allows mobile-specific dependencies in `mobile/package.json`
- ✅ Resolves version conflicts between web and mobile platforms

### Metro Configuration for Workspaces
**mobile/metro.config.js**:
```javascript
const config = getDefaultConfig(__dirname);
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

// Watch shared source folders
config.watchFolders = [
  path.resolve(monorepoRoot, 'src'),
];

// Configure resolver for workspace
config.resolver = {
  ...config.resolver,
  // Use hoisted dependencies from workspace root
  nodeModulesPaths: [
    path.resolve(monorepoRoot, 'node_modules'),
  ],
  platforms: ['native', 'android', 'ios'],
  sourceExts: [...config.resolver.sourceExts, 'mjs', 'cjs'],
  // Prioritize platform-specific files for React Native
  resolverMainFields: ['react-native', 'main'],
};

// Support symlinks (used by Yarn workspaces)
config.resolver.symlinks = true;
```

### Vite Configuration for Cross-Platform
**web/vite.config.ts** enhancements for React Native exclusion:
```typescript
export default defineConfig({
  resolve: {
    // Deduplicate React instances
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Exclude React Native from web builds
    exclude: ['react-native', '@react-native-async-storage/async-storage'],
    entries: [
      'web/index.html',
      'src/**/*.web.{ts,tsx,js,jsx}',
      '!src/dev/playground/mobile/**',
      '!src/**/*.native.{ts,tsx,js,jsx}',
      '!mobile/**'
    ],
  }
});
```

### Platform-Specific File Resolution Strategy
Critical fix for theme provider imports that caused build failures:

**Theme Provider Hybrid Resolution**:
```typescript
// src/components/primitives/theme/index.ts
// Vite will resolve ThemeProvider.web.tsx for web, Metro will resolve ThemeProvider.native.tsx for mobile
export { useTheme, ThemeProvider } from './ThemeProvider';

// src/components/primitives/theme/ThemeProvider.ts
// For React Native, export from .native file explicitly since Metro resolution isn't always reliable
export { useTheme, ThemeProvider } from './ThemeProvider.native';
```

This hybrid approach ensures:
- **Vite (Web)**: Uses platform resolution to find `.web.tsx` files
- **Metro (Mobile)**: Uses explicit `.native` exports for reliable resolution

### Single Shared Dependencies
- ✅ One `node_modules/` folder at root (via Yarn Workspaces)
- ✅ One `package.json` for shared dependencies  
- ✅ One `yarn.lock` file
- ✅ Web and mobile share 90%+ of dependencies
- ✅ Mobile can have additional dependencies in `mobile/package.json`

### Bundler Intelligence
- **Vite (Web)**: Only bundles web-compatible dependencies, excludes React Native
- **Metro (Mobile)**: Only bundles mobile-compatible dependencies from workspace
- Platform-specific dependencies are automatically filtered by each bundler

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

## Critical Fixes and Troubleshooting

### Issues Resolved During Implementation

**1. Metro Bundler "Cannot read property 'S' of undefined" Error**
- **Root Cause**: Multiple React instances and version conflicts
- **Solution**: Implemented Yarn Workspaces to deduplicate dependencies
- **Fix**: Hoisted React to workspace root, configured Metro to use workspace node_modules

**2. "useCrossPlatformTheme is not a function" Mobile Runtime Error**
- **Root Cause**: Inconsistent theme hook naming across primitives
- **Solution**: Updated all primitive components to use unified `useTheme` import
- **Files Fixed**: Button, Text, Icon, Tooltip, ModalContainer, OverlayBackdrop, ResponsiveContainer

**3. Vite Parsing React Native Flow Syntax Errors**
- **Root Cause**: Vite attempting to parse React Native files for web builds
- **Solution**: Added comprehensive React Native exclusion patterns in Vite config
- **Avoided**: Using react-native-web dependency (per lead developer preference)

**4. "Element type is invalid" Mobile Error After Theme Fixes**
- **Root Cause**: Metro bundler not reliably resolving platform-specific files
- **Solution**: Implemented hybrid resolution strategy with explicit .native exports
- **Implementation**: ThemeProvider.ts for Metro, index.ts for Vite platform resolution

### Commands for Testing Cross-Platform Setup
```bash
# Test web build
yarn dev
# → Should load without React Native errors

# Test web production build  
yarn build
# → Should exclude all React Native dependencies

# Test mobile build (in mobile/ directory)
cd mobile && yarn expo start
# → Should resolve shared dependencies from workspace root

# Verify workspace setup
yarn workspaces info
# → Should show mobile workspace properly configured
```

---

**Implementation Status**: ✅ Complete and Production Ready  
**Next Phase**: Mobile platform development can begin using this structure

*Updated: 2025-08-07 17:30:00*