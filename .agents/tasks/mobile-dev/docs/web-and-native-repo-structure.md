# Web/Native Repository Structure

This document explains the optimal repository structure for the cross-platform Quorum app that enables parallel development of web and mobile applications while maximizing code sharing.

## **Current vs Target Structure**

### Current (Single Platform)

```
quorum/
├── src/                    # Mixed web/shared code
├── index.html             # Web entry
├── vite.config.js         # Web build config
├── electron/              # Desktop wrapper
└── package.json           # Web dependencies
```

### Target (Cross-Platform)

```
quorum/
├── src/                          # SHARED CODE (90% of app)
│   ├── components/
│   │   ├── primitives/           # Cross-platform UI components
│   │   │   ├── Button/
│   │   │   │   ├── Button.web.tsx     # Web implementation
│   │   │   │   ├── Button.native.tsx  # Mobile implementation
│   │   │   │   ├── Button.tsx         # Shared logic (optional)
│   │   │   │   ├── types.ts          # Shared types
│   │   │   │   └── index.ts          # Platform-aware exports
│   │   │   ├── Modal/
│   │   │   ├── Input/
│   │   │   └── ...
│   │   ├── Router/               # Platform-specific routing
│   │   │   ├── Router.web.tsx    # React Router (web)
│   │   │   ├── Router.native.tsx # React Navigation (mobile)
│   │   │   └── index.ts
│   │   ├── message/              # Business logic components
│   │   ├── channel/              # Business logic components
│   │   └── user/                 # Business logic components
│   ├── hooks/                    # 100% shared business logic
│   ├── api/                      # 100% shared API layer
│   ├── services/                 # 100% shared services
│   ├── types/                    # 100% shared TypeScript types
│   └── utils/                    # 100% shared utilities
│
├── web/                          # WEB-SPECIFIC FILES
│   ├── index.html               # Web HTML entry
│   ├── main.tsx                 # Web React entry point
│   ├── vite.config.ts           # Vite bundler config
│   ├── public/                  # Web-specific assets
│   └── electron/                # Electron desktop wrapper
│       ├── main.cjs
│       └── preload.cjs
│
├── mobile/                       # MOBILE-SPECIFIC FILES (future)
│   ├── App.tsx                  # React Native entry point
│   ├── app.json                 # Expo/RN configuration
│   ├── metro.config.js          # Metro bundler config
│   ├── babel.config.js          # Babel config for RN
│   └── assets/                  # Mobile app assets
│       ├── icon.png
│       ├── splash.png
│       └── adaptive-icon.png
│
├── src/dev/                      # DEVELOPMENT TOOLS (keep during transition)
│   ├── playground/
│   │   ├── web/                 # Web primitives testing
│   │   └── mobile/              # Mobile primitives testing (375MB)
│   └── components-audit/
│
├── package.json                  # SHARED dependencies & scripts
├── yarn.lock                     # SHARED lock file
├── tsconfig.json                 # SHARED TypeScript config
├── tailwind.config.js            # SHARED styling config
└── .gitignore                    # SHARED git ignore
```

## How the Entry Points Work

### Web Entry Point (`web/main.tsx`)

```tsx
// web/main.tsx - Enhanced version of current main.tsx
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PasskeysProvider } from '@quilibrium/quilibrium-js-sdk-channels';
import { QuorumApiClientProvider } from '../src/components/context/QuorumApiContext';
import { MessageDBProvider } from '../src/components/context/MessageDB';
import { WebSocketProvider } from '../src/components/context/WebsocketProvider';
import { ThemeProvider } from '../src/components/primitives/theme';
import { I18nProvider } from '@lingui/react';
import { i18n } from '../src/i18n/i18n';
import App from '../src/App';
import '../src/index.scss';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      staleTime: 100,
      gcTime: 100,
    },
  },
});

const Root = () => {
  React.useEffect(() => {
    const savedLocale = getUserLocale() || 'en';
    dynamicActivate(savedLocale);
  }, []);

  return (
    <BrowserRouter>
      <PasskeysProvider fqAppPrefix="Quorum">
        <QueryClientProvider client={queryClient}>
          <QuorumApiClientProvider>
            <WebSocketProvider>
              <MessageDBProvider>
                <ThemeProvider>
                  <I18nProvider i18n={i18n}>
                    <App />
                  </I18nProvider>
                </ThemeProvider>
              </MessageDBProvider>
            </WebSocketProvider>
          </QuorumApiClientProvider>
        </QueryClientProvider>
      </PasskeysProvider>
    </BrowserRouter>
  );
};

createRoot(document.getElementById('root')!).render(<Root />);
```

### Mobile Entry Point (`mobile/App.tsx`)

```tsx
// mobile/App.tsx - React Native entry point
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@lingui/react';
import { ThemeProvider } from '../src/components/primitives/theme';
import { i18n } from '../src/i18n/i18n';
import App from '../src/App'; // SAME App component!

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      staleTime: 100,
      gcTime: 100,
    },
  },
});

export default function AppEntry() {
  React.useEffect(() => {
    const savedLocale = getUserLocale() || 'en';
    dynamicActivate(savedLocale);
  }, []);

  return (
    <NavigationContainer>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider i18n={i18n}>
            <StatusBar style="auto" />
            <App /> {/* Your existing App.tsx works with minimal changes! */}
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </NavigationContainer>
  );
}
```

## The Beautiful Part: Shared App Component

Your existing `src/App.tsx` will work on both platforms with minimal modifications:

```tsx
// src/App.tsx - SHARED between web and mobile (95% unchanged)
import React, { Suspense } from 'react';
import { Buffer } from 'buffer';
import { useState, useEffect } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Router } from './components/Router'; // Platform-aware routing
import Layout from './components/Layout';
import { ModalProvider } from './components/context/ModalProvider';
import { MobileProvider } from './components/context/MobileProvider';
import { SidebarProvider } from './components/context/SidebarProvider';
import Connecting from './components/Connecting';
import CustomTitlebar from './components/Titlebar'; // Web/Electron only
import { Login } from './components/onboarding/Login';
import { Onboarding } from './components/onboarding/Onboarding';
import { RegistrationProvider } from './components/context/RegistrationPersister';
import { ResponsiveLayoutProvider } from './components/context/ResponsiveLayoutProvider';
import { isWeb, isElectron } from './utils/platform';

window.Buffer = Buffer;

export default function App() {
  // ... existing state and effects (unchanged)

  return (
    <ErrorBoundary fallback={<Maintenance />}>
      {user && currentPasskeyInfo ? (
        <div className="bg-app flex flex-col min-h-screen text-main">
          {/* Platform-specific titlebar */}
          {isWeb() && isElectron() && <CustomTitlebar />}

          <Suspense fallback={<Connecting />}>
            <RegistrationProvider>
              <ResponsiveLayoutProvider>
                <Router /> {/* Platform-aware routing */}
              </ResponsiveLayoutProvider>
            </RegistrationProvider>
          </Suspense>
        </div>
      ) : (
        // ... existing auth flow (unchanged)
      )}
    </ErrorBoundary>
  );
}
```

### Platform-Aware Router

```tsx
// src/components/Router/Router.web.tsx
import { Routes, Route, Navigate } from 'react-router';
import { ModalProvider } from '../context/ModalProvider';
import DirectMessages from '../direct/DirectMessages';
import Space from '../space/Space';
// ... existing route components

export function Router() {
  return (
    <Routes>
      {/* Existing web routes unchanged */}
      <Route path="/messages" element={<DirectMessages />} />
      <Route path="/spaces/:spaceId/:channelId" element={<Space />} />
      {/* ... */}
    </Routes>
  );
}
```

```tsx
// src/components/Router/Router.native.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DirectMessages from '../direct/DirectMessages';
import Space from '../space/Space';
// ... existing route components adapted for mobile

const Stack = createNativeStackNavigator();

export function Router() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Messages" component={DirectMessages} />
      <Stack.Screen name="Space" component={Space} />
      {/* Mobile-optimized navigation */}
    </Stack.Navigator>
  );
}
```

## Build Commands

```json
{
  "scripts": {
    // Web Development (current workflow unchanged)
    "dev": "vite --config web/vite.config.ts",
    "build": "vite build --config web/vite.config.ts",
    "build:preview": "yarn build && yarn preview --port 3000",
    "preview": "vite preview --config web/vite.config.ts",

    // Web + Electron
    "electron:dev": "NODE_ENV=development electron web/electron/main.cjs",
    "electron:build": "yarn build && electron-builder",

    // Mobile Development
    "mobile:dev": "cd mobile && expo start",
    "mobile:android": "cd mobile && expo start --android",
    "mobile:ios": "cd mobile && expo start --ios",
    "mobile:build:android": "cd mobile && expo build:android",
    "mobile:build:ios": "cd mobile && expo build:ios",

    // Development Tools
    "playground:web": "vite --config src/dev/playground/web/vite.config.ts",
    "playground:mobile": "cd src/dev/playground/mobile && expo start",
    "playground:sync": "node src/dev/scripts/playground-sync.js",
    "playground:check": "node src/dev/scripts/playground-check-sync.js",

    // Quality & Maintenance
    "lint": "eslint .",
    "format": "prettier --write .",
    "lingui:extract": "lingui extract",
    "lingui:compile": "lingui compile"
  }
}
```

## Platform-Specific Configs

### Web Config (`web/vite.config.ts`)

```ts
// web/vite.config.ts - Enhanced version of current config
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { lingui } from '@lingui/vite-plugin';

export default defineConfig({
  root: '../', // Point to project root
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      external: (id) => {
        // Exclude dev folder from production builds
        if (process.env.NODE_ENV === 'production' && id.includes('/dev/')) {
          return true;
        }
        return false;
      },
    },
  },
  plugins: [
    lingui(),
    nodePolyfills({ target: 'esnext' }),
    react({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/emoji-datasource-apple/img/apple/*',
          dest: 'apple',
        },
        {
          src: '../quilibrium-js-sdk-channels/src/wasm/channelwasm_bg.wasm',
          dest: './',
        },
      ],
    }),
  ],
  server: {
    headers: {
      'Permissions-Policy': 'publickey-credentials-get=*',
    },
  },
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
      '@quilibrium/quilibrium-js-sdk-channels': resolve(
        __dirname,
        '../node_modules/@quilibrium/quilibrium-js-sdk-channels/dist/index.js'
      ),
    },
  },
  optimizeDeps: {
    include: ['@quilibrium/quilibrium-js-sdk-channels'],
  },
});
```

### Mobile Config (`mobile/metro.config.js`)

```js
// mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Watch the parent src/ directory and shared dependencies
config.watchFolders = [
  path.resolve(__dirname, '../src'),
  path.resolve(__dirname, '../node_modules'),
];

// Resolve modules from parent directory
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, '../node_modules'),
  path.resolve(__dirname, './node_modules'),
];

// Platform-specific file resolution
config.resolver.platforms = ['native', 'ios', 'android', 'web'];

// Handle shared TypeScript paths
config.resolver.alias = {
  '@': path.resolve(__dirname, '../src'),
};

module.exports = config;
```

### Mobile App Config (`mobile/app.json`)

```json
{
  "expo": {
    "name": "Quorum",
    "slug": "quorum-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

## How Imports Work

Both platforms import from the same shared `src/` folder:

```tsx
// Works in both web/main.tsx and mobile/App.tsx
import { Button } from '../src/components/primitives/Button';
import { useAuth } from '../src/hooks/useAuth';
import { api } from '../src/services/api';
```

The bundlers automatically resolve:

- **Web (Vite)**: Picks `.web.tsx` files
- **Mobile (Metro)**: Picks `.native.tsx` files

## Assets and Resources

### Web Assets (`web/public/`)

```
web/public/
├── favicon.ico
├── quorumicon-blue.png
├── logo.svg
├── robots.txt
└── handleredirect.js
```

### Mobile Assets (`mobile/assets/`)

```
mobile/assets/
├── icon.png              # Main app icon (1024x1024)
├── splash-icon.png       # Splash screen image
├── adaptive-icon.png     # Android adaptive icon
└── favicon.png          # Web fallback icon
```

### Shared Assets (Current `public/` folder)

```
public/ (moved from root, stays at root for now)
├── channelwasm_bg.wasm   # WebAssembly module
├── wasm_exec.js          # WebAssembly runtime
├── quorum.png            # App logos
├── quorumicon-blue.png
├── Sen-VariableFont_wght.ttf # Custom fonts
├── unknown-dark.png      # Default avatars
├── unknown-light.png
└── ... (other shared assets)
```

## Development Experience

### Starting Development

```bash
# Web development (unchanged workflow for other developers)
yarn dev
# Opens http://localhost:5173 - works exactly as before

# Electron development
yarn electron:dev
# Opens Electron app window

# Mobile development (when mobile platform is ready)
yarn mobile:dev
# Shows QR code → scan with Expo Go app on phone

# Development playgrounds
yarn playground:web     # Test primitives in browser
yarn playground:mobile  # Test primitives on mobile device
```

### File Changes & Hot Reloading

When you edit a file in `src/`:

- **Web**: Vite hot-reloads in browser (unchanged)
- **Electron**: Vite hot-reloads in Electron window (unchanged)
- **Mobile**: Metro hot-reloads on phone (new capability)
- **Playgrounds**: Both update simultaneously for primitive testing

**Key Benefit**: Edit shared components once, see changes on all platforms instantly!

## Why This Structure Works

1. **Clean Separation**: Platform-specific entry points isolated in `web/` and `mobile/`
2. **Maximum Code Sharing**: 90%+ of codebase shared in `src/`
3. **Zero Developer Disruption**: Web development workflow unchanged
4. **Independent Platform Builds**: Each platform builds independently
5. **Parallel Development**: Teams can work on web features while mobile is built
6. **Gradual Migration**: Existing structure preserved, mobile added incrementally
7. **Development Tools Preserved**: Playground and audit tools remain functional

---

## Dependencies Structure

**Dependencies are installed at the root level** - you'll have a single `node_modules` folder that both platforms share. This is one of the major benefits of the monorepo approach.

## Dependency Structure

```
quorum/
├── node_modules/                 # SINGLE shared node_modules
│   ├── @lingui/
│   ├── @tanstack/
│   ├── react/
│   ├── react-dom/               # Web only (but still in shared node_modules)
│   ├── react-native/            # Mobile only (but still in shared node_modules)
│   └── ...
├── package.json                 # SINGLE package.json with ALL dependencies
├── yarn.lock                    # SINGLE lock file
├── web/
└── mobile/
```

## How Dependencies Work

### Single Package.json Strategy

```json
{
  "dependencies": {
    // SHARED: Work on both platforms
    "react": "^18.2.0",
    "@lingui/react": "^5.3.3",
    "@tanstack/react-query": "^5.62.7",
    "minisearch": "^7.1.2",

    // WEB-ONLY: Bundler ignores on mobile
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.0.2",
    "@fortawesome/react-fontawesome": "^0.2.2",

    // MOBILE-ONLY: Bundler ignores on web
    "react-native": "0.72.6",
    "@react-navigation/native": "^6.1.0",
    "expo": "~49.0.0"
  }
}
```

### Bundler Intelligence

The bundlers are smart about what they include:

**Web (Vite):**

- ✅ Includes: `@lingui/react`, `@tanstack/react-query`, `react-dom`
- ❌ Ignores: `react-native`, `expo`, `@react-navigation`

**Mobile (Metro):**

- ✅ Includes: `@lingui/react`, `@tanstack/react-query`, `react-native`
- ❌ Ignores: `react-dom`, `react-router-dom`

## Real Examples from Your Codebase

### Libraries That "Just Work" ✅

From your current dependencies, these are **fully compatible**:

```typescript
// Works identically on both platforms
import { t } from '@lingui/macro';
import { useQuery } from '@tanstack/react-query';
import MiniSearch from 'minisearch';

// In any component:
export function MyComponent() {
  const { data } = useQuery(['messages'], fetchMessages);
  const searchEngine = new MiniSearch({ fields: ['content'] });

  return <div>{t`Hello World`}</div>;  // Same on both platforms
}
```

### Platform-Specific Libraries

```typescript
// Web-only import
import { BrowserRouter } from 'react-router-dom'; // Only bundled on web

// Mobile-only import
import { NavigationContainer } from '@react-navigation/native'; // Only bundled on mobile
```

## Installation Process

### Current (Web Only)

```bash
yarn add @lingui/react
# Installs to single node_modules, used by web
```

### Future (Web + Mobile)

```bash
yarn add @lingui/react
# Same command! Single node_modules, used by both platforms
```

### Adding Platform-Specific Dependencies

```bash
# Add mobile-only dependency
yarn add react-native-vector-icons
# Still goes to shared node_modules, but only mobile bundles it

# Add web-only dependency
yarn add @fortawesome/react-fontawesome
# Still goes to shared node_modules, but only web bundles it
```

## Bundle Size Optimization

Each platform only includes what it uses:

### Web Bundle

- ✅ `@lingui/react` (6KB)
- ✅ `@tanstack/react-query` (24KB)
- ✅ `react-dom` (42KB)
- ❌ `react-native` (0KB - not included)
- ❌ `expo` (0KB - not included)

### Mobile Bundle

- ✅ `@lingui/react` (6KB)
- ✅ `@tanstack/react-query` (24KB)
- ✅ `react-native` (core platform)
- ❌ `react-dom` (0KB - not included)
- ❌ `@fortawesome/react-fontawesome` (0KB - not included)

## Development Workflow

### Installing New Dependencies

```bash
# From root directory (always)
yarn add some-new-library

# No need to cd into web/ or mobile/ folders
# No need to install twice
# No need to manage separate package.json files
```

### Checking What's Installed

```bash
# Single source of truth
cat package.json

# Single lock file
cat yarn.lock

# Single node_modules
ls node_modules/
```

## Your Lingui Example

Perfect example! Lingui works exactly the same:

```typescript
// src/components/SomeComponent.tsx - SHARED between platforms
import { t } from '@lingui/macro';
import { useLingui } from '@lingui/react';

export function SomeComponent() {
  const { i18n } = useLingui();

  return (
    <div>
      {t`Welcome to Quorum`}
      <button onClick={() => i18n.activate('es')}>
        {t`Switch to Spanish`}
      </button>
    </div>
  );
}
```

**Result:**

- ✅ Web: Renders as HTML with translations
- ✅ Mobile: Renders as React Native with same translations
- ✅ Same translation files work for both
- ✅ Same language switching logic
- ✅ Single `yarn add @lingui/react` installation

## Benefits of Shared Dependencies

1. **Single Installation**: `yarn add` once, works everywhere
2. **Version Consistency**: Same library version on both platforms
3. **Simplified Management**: One package.json to maintain
4. **Faster CI/CD**: Single `yarn install` for both platforms
5. **Smaller Repository**: No duplicate node_modules folders
6. **Easier Updates**: `yarn upgrade` updates both platforms

---

Updated: 2025-08-05 16:40:00
