---
type: task
title: Mobile Internationalization (i18n) Implementation Plan
status: in-progress
complexity: medium
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Mobile Internationalization (i18n) Implementation Plan


**Priority**: Medium

**Estimated Time**: 4-6 hours

## Current Situation Analysis

### ✅ What We Have (Web App)

- **26 Languages**: Full i18n support with extensive language coverage
- **Lingui Framework**: Using `@lingui/core` and `@lingui/react` with macro system
- **Dynamic Loading**: Web uses `dynamicActivate()` with dynamic imports for bundle optimization
- **User Choice**: Language selection stored in localStorage with settings UI
- **Translation Workflow**: Established with `.po` files, extraction, and compilation

### 🚧 Current Mobile Status (Test Playground)

- **Basic Setup**: English-only static import solution for unblocking primitive testing
- **Temporary Implementation**: `mobile/i18n.ts` with hardcoded English messages
- **Missing Features**: No language selection, no dynamic loading, no user preferences

### 🎯 Goal State (Production Mobile App)

- **Full Language Support**: All 26 languages available like web app
- **User Language Selection**: Settings UI for choosing preferred language
- **Cross-Platform Consistency**: Same translation keys and user experience
- **Performance Optimized**: Efficient loading without bloating app bundle
- **Native Storage**: Language preference stored in AsyncStorage (React Native equivalent of localStorage)

## Technical Challenges & Solutions

### Challenge 1: Metro Bundler Dynamic Import Limitations

**Problem**:

- Web uses `import(`./${locale}/messages.ts`)` for dynamic loading
- Metro bundler historically had issues with dynamic imports
- Current dynamic import in `src/i18n/i18n.ts:47` fails in React Native

**Research Findings (2024)**:

- ✅ **React Native 0.72+** (we have 0.79.5): Native dynamic import support
- ✅ **Metro 0.66+**: Automatic code splitting with `import()` syntax
- ✅ **New Lingui Metro Transformer**: `@lingui/metro-transformer` (Nov 2024) allows direct `.po` import

**Recommended Solutions**:

#### Option A: Lingui Metro Transformer (Preferred)

- **Pros**: Latest Lingui 2024 solution, direct `.po` imports, no compilation step
- **Cons**: Newest approach, less battle-tested
- **Implementation**: Use `@lingui/metro-transformer` for seamless `.po` loading

#### Option B: Static Import Map with Dynamic Selection

- **Pros**: Proven approach, works with current setup, full control
- **Cons**: All languages loaded upfront, larger initial bundle
- **Implementation**: Import all messages statically, select at runtime

#### Option C: Native Dynamic Imports with RN 0.72+

- **Pros**: Uses modern React Native capabilities, true lazy loading
- **Cons**: Requires Metro configuration tuning, more complex setup
- **Implementation**: Enable dynamic imports in Metro, adapt web's `dynamicActivate()`

### Challenge 2: Storage & User Preferences

**Problem**:

- Web uses `localStorage.getItem('language')`
- React Native doesn't have localStorage

**Solution**:

- Use `@react-native-async-storage/async-storage` (already in dependencies)
- Create mobile-specific storage adapter
- Maintain same API interface for cross-platform components

### Challenge 3: Language Detection & Fallbacks

**Problem**:

- Web uses `navigator.language` and localStorage
- React Native has different locale detection methods

**Solution**:

- Use `react-native-localize` for proper device locale detection
- Implement platform-specific `getUserLocale()` function
- Maintain fallback logic consistency

## Implementation Plan

### Phase 1: Foundation Setup (1-2 hours)

#### 1.1 Add Required Dependencies

```bash
# In mobile workspace
yarn add @react-native-async-storage/async-storage  # Already present
yarn add react-native-localize
yarn add @lingui/metro-transformer  # If using Option A
```

#### 1.2 Update Metro Configuration

```javascript
// mobile/metro.config.js
const config = getDefaultConfig(__dirname);

// Option A: Lingui Metro Transformer
config.transformerPath = require.resolve('@lingui/metro-transformer');

// Option C: Enable dynamic imports
config.resolver.platforms = ['native', 'android', 'ios'];
config.transformer.unstable_allowRequireContext = true;
```

#### 1.3 Create Mobile-Specific i18n Utilities

```typescript
// mobile/utils/i18n-mobile.ts
export const getMobileLocale = async (): Promise<string> => {
  // Get from AsyncStorage, fallback to device locale
};

export const setMobileLocale = async (locale: string): Promise<void> => {
  // Save to AsyncStorage
};
```

### Phase 2: Choose and Implement Loading Strategy (2-3 hours)

#### Option A Implementation: Metro Transformer

1. Configure `@lingui/metro-transformer`
2. Import `.po` files directly: `import messages from '../src/i18n/en/messages.po'`
3. Create language selection mapping
4. Test with multiple languages

#### Option B Implementation: Static Import Map

1. Create comprehensive import map:

```typescript
const messageMap = {
  en: () => import('../src/i18n/en/messages'),
  fr: () => import('../src/i18n/fr/messages'),
  de: () => import('../src/i18n/de/messages'),
  // ... all 26 languages
};
```

2. Implement async loading function
3. Add loading states for language switches

#### Option C Implementation: Native Dynamic Imports

1. Configure Metro for dynamic imports
2. Adapt web's `dynamicActivate()` function
3. Handle React Native-specific import resolution
4. Add error handling for failed imports

### Phase 3: User Interface Integration (1-2 hours)

#### 3.1 Language Selection Component

- Create `LanguageSelector.native.tsx` primitive
- Reuse language list from `src/i18n/locales.ts`
- Implement AsyncStorage integration
- Add loading states and error handling

#### 3.2 Settings Integration

- Add language selection to mobile app settings
- Create settings screen in mobile playground
- Test language switching with immediate UI updates
- Ensure proper app state management during language changes

#### 3.3 App Initialization

- Update mobile `App.tsx` with proper i18n initialization
- Handle async language loading on app start
- Add loading screens during language initialization
- Implement error boundaries for i18n failures

### Phase 4: Testing & Optimization (30-60 minutes)

#### 4.1 Cross-Platform Consistency Testing

- Verify all shared components render correctly in all languages
- Test translation key consistency between web and mobile
- Validate RTL language support (Arabic, Hebrew)
- Check text truncation and layout issues

#### 4.2 Performance Testing

- Measure app startup time with different loading strategies
- Test language switching performance
- Monitor bundle size impact
- Validate memory usage during language changes

#### 4.3 Edge Case Handling

- Test offline language switching
- Handle corrupted AsyncStorage data
- Test with unsupported device locales
- Verify fallback behavior to English

## Recommended Implementation Order

### Immediate (Next Development Session)

1. **Choose Option B** (Static Import Map) for fastest implementation
2. Replace current `mobile/i18n.ts` with comprehensive language support
3. Add AsyncStorage integration for user preferences
4. Test with 3-4 major languages (English, Spanish, French, German)

### Future Optimization (Later)

1. Evaluate Option A (Metro Transformer) for Lingui 5.0 benefits
2. Implement proper device locale detection
3. Add language selection UI to mobile playground
4. Performance optimization and bundle size analysis

## File Structure After Implementation

```
mobile/
├── i18n/
│   ├── index.ts              # Main i18n setup
│   ├── storage.ts            # AsyncStorage wrapper
│   ├── locale-detector.ts    # Device locale detection
│   └── message-loader.ts     # Language loading logic
├── components/
│   └── LanguageSelector.tsx  # Language selection UI
└── screens/
    └── SettingsScreen.tsx    # Language settings
```

## Success Criteria

- ✅ All 26 languages available in mobile app
- ✅ User can change language in mobile settings
- ✅ Language preference persists across app restarts
- ✅ Cross-platform components show same translations
- ✅ App startup time remains under 3 seconds
- ✅ Language switching feels instant (< 500ms)
- ✅ Bundle size increase is reasonable (< 2MB total for all languages)

## Risks & Mitigation

### Risk: Bundle Size Bloat

- **Mitigation**: Use dynamic loading (Option A or C) for production
- **Fallback**: Implement language pack downloading for less common languages

### Risk: Metro Configuration Issues

- **Mitigation**: Start with Option B (static imports) for reliability
- **Fallback**: Keep current English-only setup as emergency fallback

### Risk: Cross-Platform Inconsistencies

- **Mitigation**: Extensive testing with shared components
- **Prevention**: Use same translation keys and validation scripts

---

**Next Steps**: Start with Phase 1 and Option B implementation for quickest path to full language support.
