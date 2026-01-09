---
type: doc
title: Unused Dependencies Analysis
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# Unused Dependencies Analysis

## Safe to Remove (Verified)

These dependencies were analyzed and confirmed to be unused:

### Main Dependencies

- `electron-is-dev` - Not used in source code
- `expo-media-library` - Not used in source code
- `expo-status-bar` - Not used in source code
- `@react-navigation/bottom-tabs` - Not used (project doesn't use React Navigation)
- `@react-navigation/native` - Not used (project doesn't use React Navigation)
- `@react-navigation/stack` - Not used (project doesn't use React Navigation)
- `react-native-document-picker` - Not used in source code

### Dev Dependencies

- `@vitejs/plugin-basic-ssl` - Not used in Vite config
- `autoprefixer` - Not used (no PostCSS config referencing it)
- `postcss` - Not used (no PostCSS config)
- `unenv` - Not used in Vite config

## DO NOT REMOVE (Required)

### Build-time Dependencies

- `emoji-datasource-apple` - Used in Vite config for static copy
- All browserify polyfills (`crypto-browserify`, `buffer`, etc.) - Required for Vite build
- All React Native platform dependencies - Used for platform-specific builds

### Dynamic/Platform Dependencies

- `expo-*` packages in general - May be used in mobile builds
- `react-native-*` packages - May be used in .native.tsx files
- Polyfill packages - Required for web compatibility

## Missing Dependencies (Need to Add)

- `@lingui/core` - Used throughout the app but not in package.json
- `@gorhom/bottom-sheet` - Used in Modal.native.gorhom.tsx

## Commands to Clean Up

```bash
# Remove confirmed unused dependencies
yarn remove electron-is-dev expo-media-library expo-status-bar
yarn remove @react-navigation/bottom-tabs @react-navigation/native @react-navigation/stack
yarn remove react-native-document-picker

# Remove unused dev dependencies
yarn remove @vitejs/plugin-basic-ssl autoprefixer postcss unenv

# Add missing dependencies
yarn add @lingui/core @gorhom/bottom-sheet
```

## Verification Steps

After removal, verify the app still works:

1. `yarn build` - Web build should succeed
2. `cd mobile && yarn install && expo start` - Mobile build should succeed
3. `yarn electron:build` - Electron build should succeed
4. Test key backup functionality on both platforms

---

_Analysis Date: 2025-01-11_
_Tool Used: depcheck + manual verification_
