# Quilibrium SDK Mobile Integration Issue

**Status**: 🔴 Blocked  
**Priority**: High  
**Date**: 2025-08-08  
**Last Updated**: 2025-01-07

**Issue confirmed with both Expo GO and Expo Dev Build**

> ⚠️ **UPDATE (2025-01-07)**: Testing with **Expo Dev Build** has confirmed that the SDK cannot be integrated as-is, even with proper polyfills and Metro configuration. The fundamental incompatibilities (WebAssembly, WebAuthn) are runtime limitations of React Native, not configuration issues.

## Executive Summary

The `@quilibrium/quilibrium-js-sdk-channels` SDK, used for Passkey Authentication, has fundamental incompatibilities with React Native that prevent the mobile app from bundling. The SDK requires Node.js-specific modules and WebAssembly, neither of which are available in React Native environments.

## Problem Description

### Error Encountered

```
Android Bundling failed
The package at "node_modules/@quilibrium/quilibrium-js-sdk-channels/dist/index.esm.js"
attempted to import the Node standard library module "crypto".
It failed because the native React runtime does not include the Node standard library.
```

### SDK Details

- **Package**: `@quilibrium/quilibrium-js-sdk-channels`
- **Version**: 2.1.0-preview
- **Location**: Linked as local dependency (`file:../quilibrium-js-sdk-channels`)
- **Purpose**: Passkey Authentication functionality
- **Build System**: Rollup (outputs ESM and CommonJS bundles)

## Root Causes

### 1. WebAssembly (WASM) - Fundamental Blocker

- SDK contains `channelwasm_bg.wasm` with compiled Rust crypto operations
- Uses `new URL('channelwasm_bg.wasm', import.meta.url)` for loading
- **React Native/Hermes does not support WebAssembly** - this is a runtime limitation
- WASM polyfills can prevent crashes but cannot provide functionality
- Core crypto operations (key generation, signing, encryption) depend on WASM

### 2. Web-Specific Global Objects

- SDK assumes browser environment: `window.Buffer = Buffer` (line 2 of index.ts)
- `window` object doesn't exist in React Native
- While polyfillable, indicates SDK was built specifically for browsers

### 3. React Components Evaluated at Module Level

- SDK exports React components directly: `export { PasskeysProvider, usePasskeysContext }`
- Causes "Invalid hook call" errors when imported outside React component tree
- Components use browser-specific APIs internally

### 4. WebAuthn/Passkey APIs

- Passkey functionality relies on WebAuthn browser API
- No React Native equivalent without native modules
- Would require platform-specific implementations for iOS/Android biometrics

### 5. Node.js Dependencies (Partially Solvable)

- `crypto` module - Can be polyfilled with `react-native-crypto`
- `import.meta.url` - Can be transformed with Babel
- Buffer, Stream, Process - Can be polyfilled
- **Note**: Even with polyfills, WASM-dependent crypto operations still fail

## Attempted Solutions (With Expo Dev Build)

1. **Node.js Polyfills** ✅ Partial Success
   - Installed: `react-native-crypto`, `react-native-get-random-values`, `buffer`, `stream-browserify`
   - Created polyfills.js with proper initialization order
   - Result: Crypto modules load, but WASM operations fail

2. **Metro Configuration** ✅ Partial Success
   - Added extraNodeModules for crypto aliasing
   - Enabled `unstable_enablePackageExports`
   - Result: Module resolution works, SDK attempts to load

3. **Babel Transforms** ✅ Success
   - Enabled: `unstable_transformImportMeta` in babel-preset-expo
   - Result: import.meta.url syntax now supported

4. **WebAssembly Polyfill** ❌ Failed
   - Added WebAssembly stub to prevent crashes
   - Result: WASM operations return empty/mock data
   - **Critical**: Cannot provide actual crypto functionality

5. **Direct SDK Import** ❌ Failed
   - Attempted to import SDK directly with all polyfills
   - Result: "Invalid hook call" errors due to React components at module level

## Viable Solutions

### Option A: Server-Side Proxy (RECOMMENDED)

Move SDK operations to backend API:

- Keep SDK on server only
- Create REST/GraphQL endpoints for all SDK operations
- Mobile app calls backend instead of using SDK directly
- Backend handles all crypto, passkey, and channel operations

**Implementation**:

```typescript
// Backend endpoints needed:
POST / api / passkey / create;
POST / api / passkey / authenticate;
POST / api / crypto / generateKeys;
POST / api / crypto / sign;
POST / api / crypto / encrypt;
POST / api / channel / send;
```

**Pros**:

- **100% feature parity with web app**
- No SDK modifications needed
- Works immediately with existing SDK
- Single source of truth for crypto operations
- Security benefit: keys can be managed server-side

**Cons**:

- Requires backend infrastructure changes
- Network dependency for all operations
- Additional latency (~50-200ms per operation)
- No offline functionality

**Estimated effort**: 2-3 days for basic implementation

### Option B: Native Module Bridge

Create native iOS/Android modules that replicate SDK functionality:

- Implement crypto operations in Swift/Kotlin
- Use platform biometric APIs for passkeys
- Bridge to JavaScript via React Native modules
- Essentially recreate WASM functionality natively

**Implementation Components**:

- iOS: CryptoKit + LocalAuthentication frameworks
- Android: Android Keystore + BiometricPrompt API
- React Native bridge layer
- TypeScript interface matching SDK

**Pros**:

- Full offline functionality
- Native performance
- Platform-specific optimizations
- Direct biometric integration

**Cons**:

- Significant development effort (2-4 weeks)
- Requires iOS/Android expertise
- Maintenance of three codebases (iOS/Android/Bridge)
- Must keep in sync with SDK updates
- Complex testing across platforms

## Current Workaround: SDK Shim

A temporary shim implementation is currently in place that provides mock functionality for mobile development and testing. See: [SDK Shim Temporary Solutions](./sdk-shim-temporary-solutions.md)

**Status**: ✅ In use
**Purpose**: Allow mobile app development to continue while permanent solution is implemented
**Limitations**: No actual crypto or passkey functionality

## Recommended Approach

### Immediate Action: Continue with SDK Shim

- ✅ Already implemented and working
- Allows mobile development to proceed
- No blocking issues for UI/UX development

### Short-term Solution (1-2 weeks): Implement Server-Side Proxy

- Create backend endpoints for SDK operations
- Update mobile app to use API calls instead of direct SDK
- Achieves full feature parity quickly
- Can be done incrementally (start with critical features)

### Long-term Consideration (if needed): Native Module Bridge

- Only if offline functionality becomes critical
- Only if latency becomes unacceptable
- Evaluate after proxy implementation
- Consider maintenance cost vs benefits

## Expo Dev Build Test Results (2025-01-07)

**Configuration Applied:**

- ✅ Node.js polyfills (crypto, buffer, stream, process)
- ✅ Metro configuration with module aliasing
- ✅ Babel transform for import.meta support
- ✅ WebAssembly polyfill (non-functional stub)

**Test Results:**

- ✅ Metro bundling succeeds with polyfills
- ✅ SDK attempts to load without bundling errors
- ❌ WebAssembly operations return empty data (expected)
- ❌ React component evaluation causes hook errors
- ❌ Core crypto functionality non-functional without WASM

**Conclusion:** Expo Dev Build resolves configuration issues but cannot overcome fundamental React Native/WASM incompatibility.

## Key Findings

1. **WebAssembly is the primary blocker** - Cannot be polyfilled in React Native
2. **Node.js dependencies are solvable** - Polyfills work correctly
3. **SDK architecture assumes browser environment** - Built for web, not cross-platform
4. **React component structure prevents clean imports** - Module-level evaluation issues

## Files Modified During Testing

### Configuration Files:

- `mobile/metro.config.js` - Added Node.js module aliasing
- `mobile/babel.config.js` - Enabled import.meta transformation
- `mobile/polyfills.js` - Comprehensive polyfill setup
- `mobile/shim.js` - Node.js compatibility layer
- `mobile/index.ts` - Import polyfills before app

### Test Integration Files:

- `src/shims/quilibrium-sdk-channels.native.tsx` - Smart shim with real SDK fallback
- `.readme/tasks/todo/mobile-dev/sdk-integration-test-results.md` - Detailed test log

## Related Documentation

- [SDK Shim Temporary Solutions](./sdk-shim-temporary-solutions.md) - Current workaround implementation
- [Passkey SDK Expo Dev Integration Plan](./passkey-sdk-expo-dev-integration-plan.md) - Integration attempt plan
- [SDK Integration Test Results](./sdk-integration-test-results.md) - Detailed test logs

## Resources

- [React Native Crypto Libraries](https://github.com/tradle/react-native-crypto)
- [Metro Bundler Configuration](https://facebook.github.io/metro/docs/configuration)
- [WebAssembly in React Native Discussion](https://github.com/react-native-community/discussions-and-proposals/issues/564)
- [Hermes WebAssembly Support Status](https://github.com/facebook/hermes/issues/114)

---

_Last updated: 2025-01-07_
