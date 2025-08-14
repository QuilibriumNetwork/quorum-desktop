# Quilibrium SDK Mobile Integration Issue

**Status**: 🔴 Blocked  
**Priority**: High  
**Date**: 2025-08-08  

**Issue posted**

> ⚠️ **CRITICAL NOTE**: This analysis was conducted while testing with **Expo GO**. Many of the compatibility issues described below (especially crypto polyfills, Metro configuration, and WebAssembly support) may be resolved by switching to **Expo Dev Build**, which supports custom native dependencies and Metro configurations. Testing with Expo Dev Build should be the first step before pursuing more complex solutions.

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

### 1. Node.js Dependencies
The SDK directly imports Node.js built-in modules:
- `crypto` - Not available in React Native
- Uses `import.meta.url` for WASM loading - Not supported by Hermes engine
- Depends on `multiformats` with subpath exports that Metro struggles with

### 2. WebAssembly Components
- Contains `channelwasm_bg.wasm` file
- Uses `new URL('channelwasm_bg.wasm', import.meta.url)` for loading
- React Native doesn't support WebAssembly natively

### 3. Pre-bundled Distribution
- SDK is distributed as pre-bundled code with hardcoded imports
- Metro's module resolution and aliasing only work on source code
- Cannot intercept or polyfill the bundled `require('crypto')` calls

## Attempted Solutions (Failed)

1. **Node.js Polyfills**
   - Installed: `react-native-crypto`, `react-native-get-random-values`, `buffer`, etc.
   - Result: Metro still couldn't resolve crypto in pre-bundled SDK

2. **Metro Configuration**
   - Tried: Module aliasing, custom resolvers, package exports
   - Result: Aliases don't affect pre-bundled code

3. **Babel Transforms**
   - Enabled: `unstable_transformImportMeta`
   - Result: Helped with import.meta but crypto issue remained

## Viable Solutions

### Option A: Switch to Expo Dev Build (RECOMMENDED FIRST STEP)

Test with Expo Dev Build instead of Expo GO:
- Build custom development client with native dependencies
- Enable Metro configuration and crypto polyfills
- Test WebAssembly support in custom runtime

**Pros**: 
- May solve all issues with minimal changes
- Keeps existing polyfill approach
- No SDK modifications needed
- Simple to test

**Cons**: 
- Requires creating development build
- Slightly slower development iteration
- WebAssembly support still uncertain

### Option B: SDK Modification

Modify the SDK to support React Native:
- Create separate build targets for web and React Native
- Replace Node.js crypto with `react-native-crypto` in RN build
- Replace or remove WebAssembly components for mobile
- Use conditional exports in package.json

**Pros**: 
- Proper long-term solution
- Maintains same API surface
- No additional infrastructure

**Cons**: 
- Requires SDK source code access and modifications
- Testing across platforms needed
- Maintenance overhead for dual builds

### Option C: Server-Side Proxy

Move SDK operations to backend:
- Keep SDK on server only
- Create REST/GraphQL endpoints for passkey operations
- Mobile app uses API instead of SDK

**Pros**: 
- No SDK modifications needed
- Single source of truth for passkey logic
- Works immediately

**Cons**: 
- Requires backend infrastructure changes
- Additional network latency
- Offline functionality lost

### Option D: Conditional/Mock Implementation (already done)

Create shim for mobile:
- Mock SDK interface for React Native
- Disable passkey features on mobile temporarily
- Allow rest of app to function

**Pros**: 
- Immediate unblocking
- Minimal effort
- Allows incremental migration

**Cons**: 
- Feature disparity between platforms
- Technical debt
- Not a real solution

## Recommended Approach

### Phase 0: Test with Expo Dev Build (NEXT STEP)
- Create Expo Dev Build with custom native dependencies
- Test existing polyfills (`react-native-crypto`, etc.)
- Verify Metro configuration works properly
- Test WebAssembly loading in custom runtime

### Phase 1: Immediate (DONE)
- Implement Option E (Mock/Shim)
- Create `@quilibrium/quilibrium-js-sdk-channels.native.ts` shim
- Allow mobile app to run without passkey features
- Document feature limitations

### Phase 2: Short-term 
- If Dev Build doesn't work: Work with SDK team on Option B
- Create React Native compatible build
- Replace crypto and WASM dependencies
- Test across platforms

### Phase 3: Long-term
- Evaluate Option C for optimal mobile experience
- Implement native passkey modules if needed
- Ensure feature parity across platforms

## Implementation Notes

### For Mock/Shim Implementation
```typescript
// src/shims/quilibrium-sdk.native.ts
export const channel = {
  // Mock implementation matching SDK interface
  createPasskey: async () => { 
    console.warn('Passkey creation not available on mobile');
    return null;
  },
  // ... other methods
};

export const channel_raw = channel;
```

### Files Requiring Changes
- Components importing the SDK directly
- `MessageDB.tsx` - Heavy SDK usage
- `usePasskeysContext` - Core passkey functionality
- Any authentication flows

## Next Steps

1. **Test Expo Dev Build**: Create development build and test existing polyfills
2. **Evaluate Results**: If Dev Build works, problem solved; if not, proceed with SDK modifications
3. **Communicate**: Share this analysis with SDK team
4. **Decide**: Choose long-term solution based on priorities
5. **Plan**: Create detailed implementation plan for chosen solution
6. **Execute**: Implement solution with proper testing

## Related Files
- `/src/components/context/MessageDB.tsx`
- `/package.json` (SDK dependency)
- `/mobile/metro.config.js` (bundler configuration)
- Various hooks and components using passkey functionality

## Resources
- [React Native Crypto Libraries](https://github.com/tradle/react-native-crypto)
- [Metro Bundler Configuration](https://facebook.github.io/metro/docs/configuration)
- [WebAssembly in React Native Discussion](https://github.com/react-native-community/discussions-and-proposals/issues/564)

---
*Last updated: 2025-08-14*