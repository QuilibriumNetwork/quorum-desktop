# Vite Cache React Hook Errors

**Date:** July 30, 2025  
**Status:** Identified - Workaround Available  
**Branch:** feat/mobile-app  
**Priority:** Medium (Dev Experience Issue)

## Bug Description

React hook errors occur in development mode on the `feat/mobile-app` branch when Vite cache is cleared, but production builds work perfectly. The errors manifest as "Invalid hook call" errors and prevent the app from loading properly.

## Error Messages

```
Warning: Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks  
3. You might have more than one copy of React in the same app

chunk-YMK7XHJB.js?v=0d8c5ba4:1347 Uncaught TypeError: Cannot read properties of null (reading 'useContext')
    at Object.useContext (chunk-YMK7XHJB.js?v=0d8c5ba4:1347:29)
    at useIsRestoring (@tanstack_react-query.js?v=0d8c5ba4:2989:35)
    at useBaseQuery (@tanstack_react-query.js?v=0d8c5ba4:3161:23)
    at useSuspenseQuery (@tanstack_react-query.js?v=0d8c5ba4:3248:10)
    at useRegistration (useRegistration.ts:10:10)
    at RegistrationProvider (RegistrationPersister.tsx:41:34)
```

## Root Cause Analysis

### Initial Hypotheses Explored

1. **Business Logic Extraction**: Initially suspected the recent business logic extraction work caused the issue
   - **Result**: Git bisect testing showed errors existed before business logic work
   - **Conclusion**: Business logic extraction is NOT the cause

2. **Dependency Differences**: Suspected `clsx` dependency only present in feat/mobile-app  
   - **Result**: Removing clsx broke primitive components that depend on it
   - **Conclusion**: Not the root cause

3. **Vite Configuration**: Tested rollupOptions and define differences
   - **Result**: These configurations are necessary and not causing the issue
   - **Conclusion**: Config differences are not the problem

### Actual Root Cause: Vite Cache/Bundling Issue

**The real issue is a Vite development mode caching problem:**

1. **Underlying Vulnerability**: The SDK (`@quilibrium/quilibrium-js-sdk-channels`) has its own React dependencies in `node_modules/@quilibrium/quilibrium-js-sdk-channels/node_modules/react[dom]`, creating duplicate React instances

2. **Trigger Mechanism**: When Vite cache is cleared (`rm -rf node_modules/.vite`), Vite's fresh cache rebuild incorrectly handles the duplicate React instances, causing context isolation between the main app's React and the SDK's React

3. **Cache Protection**: When Vite cache exists, pre-resolved modules avoid the duplicate React context issue

## Reproduction Steps

**Consistent reproduction pattern:**
1. `rm -rf node_modules/.vite && yarn dev` → React hook errors appear
2. Refresh the page → Errors disappear  
3. `Ctrl+C` and `yarn dev` again → No errors (cache intact)
4. `rm -rf node_modules/.vite && yarn dev` → Errors return

**Non-deterministic behavior:**
- Sometimes instead of React hook errors, get `GET http://localhost:5173/node_modules/.vite/deps/chunk-*.js 404` errors
- Indicates Vite's module resolution is unstable during cache rebuilds

## Why This Only Affects feat/mobile-app

Both `feat/mobile-app` and `new-style` branches have the same underlying duplicate React issue, but:
- **new-style**: Vite cache state somehow avoids triggering the problem
- **feat/mobile-app**: More frequent cache clearing during development exposes the issue
- **Production**: Different bundling process avoids the duplicate React problem entirely

## Technical Context

**Component Hierarchy:**
```
QueryClientProvider (React Query context from main app using main React)
├── PasskeysProvider (from SDK using SDK's React instance)  
    └── RegistrationProvider (tries to use React Query context)
        └── useRegistration calls useSuspenseQuery
```

**The Problem**: `useRegistration` tries to access React Query context, but it's executing in the SDK's React instance where `QueryClientProvider` doesn't exist, so `useContext` returns `null`.

## Solutions & Workarounds

### Current Workaround (Immediate)
**For Developers**: When React hook errors appear after clearing Vite cache, simply refresh the page once. Subsequent development will work normally.

### Potential Long-term Solutions
1. **Force React Deduplication**: Add explicit React aliases in vite.config.js (attempted but didn't resolve the caching aspect)
2. **SDK Dependency Management**: Ensure SDK doesn't bundle its own React dependencies  
3. **Vite Configuration Tuning**: Investigate optimizeDeps and other Vite cache settings

## Impact Assessment

- ✅ **Production**: No impact - works perfectly
- ✅ **Functionality**: No functional issues once loaded  
- ⚠️ **Developer Experience**: Minor inconvenience requiring page refresh after cache clears
- ✅ **Business Logic**: All recent extraction work is unaffected and working correctly

## Files Investigated

- `src/hooks/queries/registration/useRegistration.ts:10` (error location)
- `src/components/context/RegistrationPersister.tsx:41` (error context)  
- `vite.config.js` (configuration attempts)
- `package.json` (dependency analysis)
- `node_modules/@quilibrium/quilibrium-js-sdk-channels/node_modules/` (duplicate React location)

## Status

**Current Status**: Identified and documented with working workaround  
**Priority**: Medium (dev experience issue, not blocking)  
**Next Steps**: Document workaround for team, consider long-term SDK dependency cleanup

---
*Report created: July 30, 2025*  
*Last updated: July 30, 2025*