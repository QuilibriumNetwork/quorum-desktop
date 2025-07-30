
# Web/Native Repository Structure

[← Back to INDEX](../../../../INDEX.md)

```
quorum/
├── src/                          # SHARED CODE (90% of your app)
│   ├── components/
│   │   ├── primitives/           # Platform-specific UI
│   │   │   ├── Button/
│   │   │   │   ├── Button.web.tsx
│   │   │   │   ├── Button.native.tsx
│   │   │   │   └── index.ts
│   │   │   └── Modal/
│   │   ├── message/              # Shared business logic
│   │   ├── channel/              # Shared business logic
│   │   └── user/                 # Shared business logic
│   ├── hooks/                    # 100% shared
│   ├── api/                      # 100% shared
│   └── services/                 # 100% shared
│
├── web/                          # WEB-SPECIFIC FILES
│   ├── index.html                # Web entry HTML
│   ├── main.tsx                  # Web app entry point
│   ├── vite.config.ts            # Vite bundler config
│   └── public/                   # Web assets
│
├── mobile/                       # MOBILE-SPECIFIC FILES
│   ├── App.tsx                   # Mobile app entry point
│   ├── app.json                  # Expo/React Native config
│   ├── metro.config.js           # React Native bundler config
│   ├── babel.config.js           # Babel config for RN
│   └── assets/                   # Mobile assets (icons, splash screens)
│
├── package.json                  # SHARED dependencies & scripts
├── yarn.lock                     # SHARED lock file
├── tsconfig.json                 # SHARED TypeScript config
└── .gitignore                    # SHARED git ignore
```

## How the Entry Points Work

### Web Entry Point (`web/main.tsx`)
```tsx
// web/main.tsx - Same as your current main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../src/App';
import '../src/styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Mobile Entry Point (`mobile/App.tsx`)
```tsx
// mobile/App.tsx - React Native entry point
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import App from '../src/App';  // SAME App component!

export default function AppEntry() {
  return (
    <>
      <StatusBar style="auto" />
      <App />  {/* Your existing App.tsx works here too! */}
    </>
  );
}
```

## The Beautiful Part: Shared App Component

Your existing `src/App.tsx` will work on both platforms:

```tsx
// src/App.tsx - SHARED between web and mobile
import { ThemeProvider } from './contexts/ThemeProvider';
import { MessageProvider } from './contexts/MessageProvider';
import { Router } from './components/Router';  // Will differ per platform

export default function App() {
  return (
    <ThemeProvider>
      <MessageProvider>
        <Router />  {/* Web: react-router, Mobile: react-navigation */}
      </MessageProvider>
    </ThemeProvider>
  );
}
```

## Build Commands

```json
{
  "scripts": {
    "dev": "vite --config web/vite.config.ts",
    "build:web": "vite build --config web/vite.config.ts",
    
    "mobile:start": "cd mobile && expo start",
    "mobile:android": "cd mobile && expo start --android",
    "mobile:ios": "cd mobile && expo start --ios",
    "build:android": "cd mobile && expo build:android",
    "build:ios": "cd mobile && expo build:ios"
  }
}
```

## Platform-Specific Configs

### Web Config (`web/vite.config.ts`)
```ts
// web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '../',  // Root is main directory
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

### Mobile Config (`mobile/metro.config.js`)
```js
// mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Watch the parent src/ directory
config.watchFolders = ['../src'];

// Resolve modules from parent directory
config.resolver.nodeModulesPaths = ['../node_modules'];

module.exports = config;
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
├── logo.svg
└── robots.txt
```

### Mobile Assets (`mobile/assets/`)
```
mobile/assets/
├── icon.png          # App icon
├── splash.png        # Splash screen
└── adaptive-icon.png # Android adaptive icon
```

## Development Experience

### Starting Development
```bash
# Terminal 1: Web development (your current workflow)
yarn dev
# Opens http://localhost:5173

# Terminal 2: Mobile development (when ready)
yarn mobile:start
# Shows QR code → scan with phone
```

### File Changes
When you edit a file in `src/`:
- **Web**: Vite hot-reloads in browser
- **Mobile**: Metro hot-reloads on phone
- **Both platforms update simultaneously!**

## Why This Structure Works

1. **Clean Separation**: Platform-specific setup isolated in `web/` and `mobile/`
2. **Maximum Sharing**: All business logic in shared `src/`
3. **Independent Builds**: Each platform builds independently
4. **Familiar Structure**: Web folder looks like current setup
5. **Easy Migration**: Just move current files to `web/`, add `mobile/`

----

## Dependencies structure

Great question! **Dependencies are installed at the root level** - you'll have a single `node_modules` folder that both platforms share. This is one of the major benefits of the monorepo approach.

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
    "@lingui/react": "^4.5.0",
    "@tanstack/react-query": "^4.29.0",
    "minisearch": "^6.1.0",
    
    // WEB-ONLY: Bundler ignores on mobile
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "@fortawesome/react-fontawesome": "^0.2.0",
    
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

## Real Examples from Your Docs

### Libraries That "Just Work" ✅

From your third-party analysis, these are **fully compatible**:

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
import { BrowserRouter } from 'react-router-dom';  // Only bundled on web

// Mobile-only import  
import { NavigationContainer } from '@react-navigation/native';  // Only bundled on mobile
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

