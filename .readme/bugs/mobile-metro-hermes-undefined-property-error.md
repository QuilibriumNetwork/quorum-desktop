# Mobile Metro Bundler - "Cannot read property 'S' of undefined" Error

**Status**: UNRESOLVED  
**Platform**: React Native/Expo (Android)  
**JS Engine**: Hermes  
**Date**: 2025-08-07  

## Error Description

When attempting to run the mobile app on Android (via Expo Go), the following error occurs consistently:

```
Android Bundled 825ms index.ts (719 modules)
ERROR  TypeError: Cannot read property 'S' of undefined, js engine: hermes
ERROR  TypeError: Cannot read property 'default' of undefined, js engine: hermes
ERROR  TypeError: Cannot read property 'S' of undefined, js engine: hermes
ERROR  TypeError: Cannot read property 'default' of undefined, js engine: hermes
```

## Context

- **Repository Structure**: Cross-platform monorepo with shared `src/` folder
- **Architecture**: Web + Mobile app sharing primitives from `src/components/primitives/`
- **Goal**: Testing mobile playground to validate cross-platform setup
- **Original Working State**: Mobile playground worked in `src/dev/playground/mobile/` with locally copied primitives

## Root Cause Investigation

### Initial Hypotheses and Tests

1. **Primitive Import Issues**
   - ❌ Fixed `useCrossPlatformTheme` → `useTheme` in Button.native.tsx
   - ❌ Simplified mobile App.tsx to remove complex screen imports
   - ❌ Created minimal test app with only basic React Native components
   - **Result**: Error persists even with zero shared imports

2. **Metro Configuration Issues**
   - ❌ Removed complex alias configuration
   - ❌ Disabled `unstable_enablePackageExports`
   - ❌ Added ES module compatibility settings
   - ❌ Simplified resolver to use direct relative imports
   - **Result**: No improvement

3. **ES Module Conflicts**
   - ❌ Identified root `package.json` has `"type": "module"`
   - ❌ Created separate mobile `package.json` without ES module type
   - ❌ Added ES module handling in Metro config
   - **Result**: Error persists

## Research Findings

### Online Search Results

**Common Causes of "Cannot read property 'S' of undefined" in React Native:**

1. **Metro `unstable_enablePackageExports` Issues**
   - Known to cause property undefined errors with certain packages
   - Solution: Set to `false` (already tried)

2. **Third-party Dependencies with Global Objects**
   - Libraries like `auth0-js` can cause undefined property errors with Hermes
   - Solution: Replace with React Native-compatible alternatives

3. **Monorepo Module Resolution**
   - Metro can have issues resolving modules in monorepo setups
   - Changes in React Native 0.73+ affected alias-based imports
   - Solution: Use relative paths instead of aliases (tried)

4. **Babel Configuration Conflicts**
   - `@babel/preset-env` in babel.config.js can cause issues
   - Node version compatibility issues
   - Solution: Remove problematic presets, use proper RN preset

5. **Metro Cache Corruption**
   - Cached Metro bundles can cause persistent errors
   - Solution: `--reset-cache` flag (tried)

## Attempted Solutions

### 1. Import Path Changes
```javascript
// From alias-based imports
import { ThemeProvider } from '@/primitives/theme';

// To relative imports  
import { ThemeProvider } from '../src/components/primitives/theme';

// To minimal test (no shared imports)
// Removed all shared imports entirely
```

### 2. Metro Configuration Evolution
```javascript
// Initial complex config with aliases
config.resolver.alias = {
  '@/primitives': path.resolve(monorepoRoot, 'src/components/primitives'),
};

// Simplified config without aliases
config.resolver = {
  nodeModulesPaths: [/* ... */],
  platforms: ['native', 'android', 'ios'],
  unstable_enablePackageExports: false,
};

// ES module compatibility config
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];
```

### 3. Package Configuration Changes
```json
// Root package.json issue identified
{
  "type": "module"  // This affects entire monorepo
}

// Created separate mobile package.json
{
  "name": "quorum-mobile",
  // No "type": "module"
  "dependencies": { /* essential deps only */ }
}
```

### 4. Babel Configuration
```javascript
// Mobile babel.config.js (unchanged)
{
  "presets": ["babel-preset-expo"],
  "plugins": ["@lingui/babel-plugin-lingui-macro"]
}
```

## Test Cases Performed

### Minimal Test App
```tsx
// Complete minimal app - still fails
export default function App() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Minimal Test App</Text>
        <Pressable onPress={() => console.log('pressed')}>
          <Text>Test Button</Text>
        </Pressable>
      </View>
    </SafeAreaProvider>
  );
}
```

**Result**: Error persists with zero custom imports or shared code.

## Current State

- **Mobile folder structure**: Complete with screens, components, styles
- **Dependencies**: Installed in both root and mobile folders
- **Metro config**: Multiple iterations attempted
- **App complexity**: Reduced to absolute minimum - still fails

## Working Reference

The original mobile playground at `src/dev/playground/mobile/` worked because:
- It had locally copied primitives (not cross-platform imports)
- Separate isolated environment
- Different Metro configuration approach

## Next Steps to Investigate

1. **Node.js Version**
   - Check if Node version compatibility with React Native 0.79.5
   - Try with different Node versions using nvm

2. **Expo SDK Version**
   - Current: Expo 53 with RN 0.79.5
   - Try different Expo SDK versions

3. **Dependency Analysis**
   - Review all installed packages for Hermes incompatibility
   - Check for global object manipulation

4. **Metro Cache Deep Clean**
   - Complete Metro cache cleanup
   - Remove node_modules and reinstall
   - Clear Expo cache

5. **Fresh Mobile Setup**
   - Create completely new mobile folder with `expo init`
   - Gradually add complexity

6. **Platform Testing**
   - Test on iOS vs Android
   - Test with different Hermes configurations
   - Try with JSC engine instead of Hermes

## File Locations

- **Metro Config**: `/mobile/metro.config.js`
- **Mobile App**: `/mobile/App.tsx`  
- **Mobile Package**: `/mobile/package.json`
- **Babel Config**: `/mobile/babel.config.js`
- **Root Package**: `/package.json` (contains `"type": "module"`)

## Technical Context

- **React Native**: 0.79.5
- **Expo**: ~53.0.20  
- **Node**: Check version compatibility
- **Metro**: Default Expo Metro config
- **Hermes**: Default enabled in Expo
- **Platform**: Android (via Expo Go app)

---

*This issue blocks mobile development and testing of the cross-platform architecture. The error occurs at the most basic level, preventing any mobile app functionality.*

---

*Last updated: 2025-08-07*