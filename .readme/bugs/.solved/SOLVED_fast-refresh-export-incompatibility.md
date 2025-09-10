# SOLVED: Fast Refresh Export Incompatibility



## Problem
Vite dev server was showing Fast Refresh failures with errors like:
```
Could not Fast Refresh ("useMessageDB" export is incompatible)
Could not Fast Refresh ("useRegistrationContext" export is incompatible)
```

## Root Cause
Files were exporting both React components AND hooks from the same module. Fast Refresh requires files to export either components OR non-component values, but not both.

## Solution
Separated hooks into dedicated files:
1. Created `/src/components/context/useMessageDB.ts` for the `useMessageDB` hook
2. Created `/src/components/context/useRegistrationContext.ts` for the `useRegistrationContext` hook
3. Updated 39 import statements across the codebase to use the new hook files

## Files Changed
- Created 2 new hook files
- Modified `MessageDB.tsx` and `RegistrationPersister.tsx` to only export components
- Updated imports in 39 files under `/src/components/` and `/src/hooks/`

## Result
Fast Refresh now works correctly, preserving component state during hot module replacement.

---
*Fixed: 2025-09-06*
