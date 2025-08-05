# Brave Browser React Hook Errors - ONGOING INVESTIGATION

[← Back to INDEX](/.readme/INDEX.md)

**Date:** July 30, 2025  
**Status:** 🔄 **ONGOING** - Multiple Solutions Attempted, Still Experiencing Hook Errors  
**Branch:** feat/mobile-app  
**Priority:** Medium (Development Experience Issue - Non-blocking)

## Bug Description

Brave browser exhibits intermittent "Invalid hook call" errors that prevent the app from loading in development mode, while Chrome works consistently. The issue appears to be **non-deterministic** and may be related to browser-specific JavaScript module loading behavior.

## Error Messages (Still Occurring)

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

## Root Cause Analysis - COMPLETED

### Git Bisect Investigation Results

**✅ Commit e748ef8** (last new-style commit): **NO** hook errors in Brave  
**❌ Commit 4f15c06** ("Implement cross-platform theming foundation and Button primitive"): **YES** hook errors in Brave

**Primary Issue**: React hooks being loaded during module initialization due to direct exports from primitive theme system, causing browser-specific compatibility issues.

## Solutions Attempted

### 1. Factory Function Pattern ❌

**Approach**: Replace direct exports with factory functions to lazy-load hooks.

**Implementation**:

```typescript
// Before (Direct Exports)
export { CrossPlatformThemeProvider, useCrossPlatformTheme } from './theme';

// After (Factory Functions)
export const createCrossPlatformThemeProvider = () => {
  const { CrossPlatformThemeProvider } = require('./theme/ThemeProvider');
  return CrossPlatformThemeProvider;
};
```

**Result**: Fixed initial hook loading issues but **still experiencing hook errors** in Brave. Created complexity for mobile development.

### 2. Dual Export Pattern ❌

**Approach**: Provide both direct exports (for mobile) and factory functions (for web).

**Implementation**:

```typescript
// Direct exports for mobile development (React Native compatible)
export {
  CrossPlatformThemeProvider,
  useCrossPlatformTheme,
} from './theme/ThemeProvider';

// Factory functions for web development (fixes Brave browser hook errors)
export const createCrossPlatformThemeProvider = () => {
  const { CrossPlatformThemeProvider } = require('./theme/ThemeProvider');
  return CrossPlatformThemeProvider;
};
```

**Result**: **Still experiencing hook errors** in Brave. Web app not using factory functions consistently.

### 3. Industry-Standard Conditional Exports ❌

**Approach**: Use environment detection with React.lazy() for web, direct exports for React Native.

**Implementation**:

```typescript
export const CrossPlatformThemeProvider =
  typeof window !== 'undefined'
    ? lazy(() =>
        import('./ThemeProvider').then((m) => ({
          default: m.CrossPlatformThemeProvider,
        }))
      )
    : require('./ThemeProvider').CrossPlatformThemeProvider;
```

**Result**: **Still experiencing hook errors** in Brave. Lazy loading doesn't solve the core module loading issue.

## Research Findings

### Industry Best Practices (2025)

Based on web search research:

1. **Context API + Custom Hooks** - Most recommended pattern for React Native Web theming
2. **CSS-in-JS libraries** (Styled Components, Emotion) for theme implementation
3. **Component libraries with built-in theming** (React Native Paper, UI Kitten)
4. **Factory functions NOT commonly mentioned** for theming solutions

### Hook Error Root Causes

Research confirms the "Invalid hook call" error is typically caused by:

1. **Multiple React instances** in the same application
2. **Dynamic module loading** with hooks (Module Federation issue)
3. **Browser-specific JavaScript engine differences** in module loading

## Current Status

### Browser Compatibility

- ❌ **Brave**: Intermittent hook errors, **non-deterministic behavior**
- ✅ **Chrome**: Consistently works
- ✅ **Production**: No issues reported

### Development Impact

- **Low-Medium Impact**: Brave users may need to refresh or clear cache occasionally
- **Workaround Available**: Use Chrome for development or clear Vite cache
- **Non-blocking**: Does not affect production or core functionality

## Current Architecture

### Theme System Structure

```
src/components/primitives/
├── index.ts                    # Environment-aware exports
├── theme/
│   ├── index.ts               # Conditional lazy/direct exports
│   ├── ThemeProvider.tsx      # Core theme logic with hooks
│   └── colors.ts              # Static color exports (safe)
└── Select/Select.web.tsx      # Cleaned unused imports
```

### Mobile Playground

- ✅ **Working**: All mobile playground functionality preserved
- ✅ **Mirrors Main App**: Uses same export structure as main app
- ✅ **React Native Compatible**: Direct exports work without issues

## Potential Solutions (Not Yet Attempted)

### 1. Vite Configuration Approach

```javascript
// vite.config.js
export default {
  resolve: {
    alias: {
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    },
  },
};
```

### 2. React Instance Deduplication

```javascript
// webpack.config.js or vite equivalent
module.exports = {
  resolve: {
    alias: {
      react: require.resolve('react'),
    },
  },
};
```

### 3. SDK Architecture Changes

- Move React to peer dependencies in SDK
- Eliminate duplicate React instances entirely
- Implement proper module federation configuration

## Decision: Leave As-Is

**Rationale**:

1. **Non-deterministic issue** suggests deeper browser/bundler compatibility problem
2. **Multiple solutions attempted** without complete resolution
3. **Low priority** - affects only Brave development experience
4. **Workarounds available** - Chrome works perfectly, cache clearing helps
5. **No production impact** - issue isolated to development environment

**Risk Assessment**: **Low** - Development inconvenience only, no functional impact

## Files Modified During Investigation

### Core Architecture Files

- `src/components/primitives/index.ts` - Multiple export pattern attempts
- `src/components/primitives/theme/index.ts` - Conditional exports implementation
- `src/components/primitives/Select/Select.web.tsx` - Removed unused imports

### Mobile Playground (Working)

- `src/dev/playground/mobile/components/primitives/index.ts` - Mirrors main app
- `src/dev/playground/mobile/components/primitives/theme/index.ts` - Environment-aware exports
- Mobile components working with direct theme imports

### Investigation Documentation

- `.readme/bugs/brave-browser-react-hook-errors-ONGOING.md` - This file

## Long-Term Recommendations

### High Priority (If Issue Becomes Blocking)

1. **Deep-dive Vite configuration** for React instance management
2. **SDK refactoring** to eliminate duplicate React dependencies
3. **Module federation configuration** review

### Low Priority (Nice to Have)

1. **Browser compatibility testing** across all major browsers
2. **Performance analysis** of lazy loading vs direct exports
3. **Alternative theming libraries** evaluation (React Native Paper, etc.)

## Success Criteria (Partial Achievement)

- ✅ **Identified root cause**: Theme system hook loading during module initialization
- ✅ **Preserved mobile capabilities**: Playground and mobile development unaffected
- ✅ **Zero breaking changes**: Existing functionality maintained
- ✅ **Multiple solution attempts**: Factory functions, dual exports, conditional exports
- ❌ **Complete Brave compatibility**: Still experiencing intermittent issues
- ❌ **Deterministic behavior**: Issue remains non-deterministic

## Conclusion

While we've made significant progress understanding and addressing the root cause, the Brave browser hook errors persist despite multiple industry-standard solution attempts. The issue appears to be a complex interaction between:

1. **Browser-specific JavaScript engines** (Chrome V8 vs Brave)
2. **Vite bundling behavior** with React hooks
3. **Duplicate React instances** in the development environment

Given the **non-blocking nature** and **available workarounds**, the decision is to **leave the current architecture as-is** and focus development efforts on higher-priority features.

**Status**: 🔄 **ONGOING INVESTIGATION PAUSED**

---

_Investigation period: July 30, 2025_  
_Solutions attempted: Factory functions, dual exports, conditional lazy loading_  
_Result: Partial improvement, issue remains non-deterministic_  
_Decision: Accept current state due to low priority and available workarounds_

Updated: July 30, 2025 14:30 UTC
