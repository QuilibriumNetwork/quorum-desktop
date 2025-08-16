# CRITICAL: Mobile App Crashes with IndexedDB/window Error

**Status:** CRITICAL - Blocks mobile development  
**Affects:** React Native/Expo Go builds  
**Culprit Commit:** `a51ea3f663e43957a6b1f477eabe5ae1100c3616` (load user settings/config for existing accounts)  

## Issue Description

Mobile app crashes on startup with error:
```
TypeError: window.addEventListener is not a function (it is undefined)
```

This error occurs because commit a51ea3f6 introduced `useMessageDB` import in `useOnboardingFlowLogic.ts`, which imports the web-based MessageDB context that uses IndexedDB APIs not available in React Native.

## Root Cause Analysis

The commit added:
- `import { useMessageDB } from '../../../components/context/MessageDB';` in useOnboardingFlowLogic.ts
- MessageDB context imports `src/db/messages.ts` which calls `indexedDB.open()`
- IndexedDB doesn't exist in React Native, causing the crash

## Potential Solutions

1. **Platform-specific MessageDB implementations**
   - Maybe create `MessageDB.native.tsx` and `messages.native.ts` with AsyncStorage
   - Potentially use Metro's platform resolution to automatically choose correct version

2. **Conditional imports with platform detection**
   - Could potentially wrap IndexedDB calls with platform checks
   - Maybe use dynamic imports based on platform detection

3. **React Native storage abstraction layer**
   - Potentially create unified storage interface that works on both platforms
   - Could abstract IndexedDB/AsyncStorage behind common API

4. **Lazy loading of MessageDB context**
   - Maybe defer MessageDB initialization until actually needed
   - Potentially avoid import-time execution of browser APIs

## Impact

- Completely blocks mobile app functionality
- Prevents any React Native/Expo Go testing
- Breaks cross-platform architecture goals

---

*Created: 2025-08-16*