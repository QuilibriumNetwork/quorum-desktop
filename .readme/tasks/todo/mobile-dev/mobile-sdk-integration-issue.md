# Quilibrium SDK Mobile Integration Issue

**Status**: 🔴 Blocked  
**Priority**: High  
**Date**: 2025-08-08  

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

### Option A: SDK Modification (Recommended)

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

### Option B: Server-Side Proxy

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

### Option C: Native Modules (I don't think so)

Implement passkey functionality natively:
- Create iOS module using Apple's passkey APIs
- Create Android module using Google's passkey APIs
- Bridge to React Native

**Pros**: 
- Best performance
- Platform-native UX
- Full feature parity

**Cons**: 
- Requires native iOS/Android expertise
- Significant development effort
- Separate maintenance for each platform

### Option D: Conditional/Mock Implementation

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

### Phase 1: Immediate 
- Implement Option D (Mock/Shim)
- Create `@quilibrium/quilibrium-js-sdk-channels.native.ts` shim
- Allow mobile app to run without passkey features
- Document feature limitations

### Phase 2: Short-term 
- Work with SDK team on Option A
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

1. **Immediate**: Implement mobile shim to unblock development
2. **Communicate**: Share this analysis with SDK team
3. **Decide**: Choose long-term solution based on priorities
4. **Plan**: Create detailed implementation plan for chosen solution
5. **Execute**: Implement solution with proper testing

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
*Last updated: 2025-08-08*