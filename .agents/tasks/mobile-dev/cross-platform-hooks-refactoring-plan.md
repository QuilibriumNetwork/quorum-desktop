# Cross-Platform Hooks Refactoring Plan

**Priority: High | Type: Architecture**

## Executive Summary

Our cross-platform architecture goal of sharing 90% of business logic is being undermined by hooks that mix business logic with platform-specific APIs. We currently have **24 hooks** that require refactoring using the **adapter pattern** to maintain our shared codebase vision.

## ⚠️ **IMPORTANT: Native Component Implementation Rules**

When implementing native components during hook refactoring, **MUST** follow the styling and primitive usage guidelines:

📋 **Read**: [Web-to-Native Migration Guide](/.agents/docs/features/primitives/02-web-to-native-migration.md)

**Critical Requirements for Native Components:**

- **Mirror Web Styling** - Native components must visually match web versions exactly
- **Use Text Primitive Helpers** - Always use `<Title>`, `<Paragraph>`, `<Text>` helpers appropriately
- **Prefer Style Props** - Use component props (`color="white"`, `size="lg"`) over hardcoded `style` objects
- **Maintain Semantic Structure** - Choose components based on content meaning, not just appearance
- **Follow KeyboardAvoidingView Patterns** - Wrap form components properly for mobile UX

**Example from Mobile Onboarding:**

```tsx
// ✅ Correct primitive usage with proper propsth
<Title size="xl" align="center" color="white">
  {t`Welcome to Quorum!`}
</Title>
<Paragraph weight="semibold" color="white" align="center">
  {t`Important first-time user information:`}
</Paragraph>
```

### 🏗️ **Architecture Pattern: Container + Layout**

**Best Practice**: Use View for styling containers, Flex primitives for content layout

```tsx
// ✅ RECOMMENDED: Separation of styling vs layout concerns
<View style={[styles.card, { backgroundColor: theme.colors.bg.card }]}>
  <FlexColumn gap="md">
    <FlexRow gap="sm" align="center">
      <Icon name="user" />
      <Text>User Profile</Text>
    </FlexRow>
    <FlexColumn gap="xs">
      <Label>Email:</Label>
      <Input value={email} onChange={setEmail} />
    </FlexColumn>
  </FlexColumn>
</View>

// ❌ AVOID: Manual flexbox in View
<View style={{ flexDirection: 'column', gap: 16 }}>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Icon name="user" />
    <Text>User Profile</Text>
  </View>
</View>
```

**Why this pattern:**

- **View**: Handles visual styling (colors, borders, shadows)
- **Flex primitives**: Handle layout, spacing, and alignment consistently
- **Better maintainability**: Consistent gap system vs manual margins
- **Cross-platform**: Flex primitives abstract platform differences

### Migration Strategy

1. **Identify web-specific patterns** (CSS classes, HTML elements)
2. **Map to primitive equivalents** (Button, Input, FlexRow, etc.)
3. **Use semantic components** where available
4. **Test on mobile simulator** to ensure proper behavior
5. **Validate accessibility** with screen readers

This ensures consistent UX/UI across platforms while maintaining our shared codebase architecture.

## Problem Statement

### Current Situation

- **7 hooks already duplicated** (.native.ts versions exist)
- **17 additional hooks** contain platform-specific APIs
- **Business logic scattered** between platform versions
- **Technical debt increasing** with each new platform-specific hook

### Impact

- ❌ Violates 90% shared code architecture
- ❌ Duplicate maintenance of business logic
- ❌ Bug fixes require changes in multiple files
- ❌ Future platform support (desktop native) will require triple maintenance

## Analysis Results

### Total Hooks Requiring Attention: 24

#### Already Duplicated (7 hooks)

These need conversion from duplication to adapter pattern:

1. **`useResponsiveLayout`** - Window resize + business logic
2. **`useSearchContext`** - Router navigation + state management
3. **`useFileUpload`** - File handling + validation logic
4. **`useKeyBackup`** - Export logic + file download
5. **`useAddressValidation`** - Validation rules + platform formatting
6. **`useGlobalSearchNavigation`** - Navigation + search state
7. **`useKeyboardShortcuts`** - Event handling + focus management

#### High Severity - Complex Platform Dependencies (8 hooks)

**DOM Manipulation & Event Handling:**

- **`useSearchResultsOutsideClick`** - Mouse events, DOM queries, click detection logic
- **`useSearchResultsResponsive`** - Window API, DOM styling, responsive calculations
- **`useTooltipInteraction`** - Touch/mouse events, DOM manipulation, tooltip timing
- **`useKeyboardShortcuts`** (web) - Keyboard events, DOM queries, focus logic

**Web-Specific Libraries:**

- **`useWebFileUpload`** - react-dropzone, File API, validation logic
- **`useCustomAssets`** - react-dropzone, crypto API, asset processing
- **`useSpaceDragAndDrop`** - @dnd-kit library, ordering logic
- **`useWebKeyBackup`** - Blob API, file download, key export logic

#### Medium Severity - Platform APIs (9 hooks)

**Platform Detection & Features:**

- **`useCopyToClipboard`** - Clipboard API, copy state management
- **`useElectronDetection`** - Window inspection, platform detection
- **`useImageLoading`** - Buffer handling, loading state
- **`useLongPress`** - Touch/mouse events, gesture detection
- And 5 more hooks with window/document API usage

## Proposed Solution: Adapter Pattern Architecture

### New File Structure

```
hooks/
├── business/              # ✅ 100% shared business logic
│   ├── layout/
│   │   └── useResponsiveLayoutLogic.ts
│   ├── files/
│   │   ├── useFileUploadLogic.ts
│   │   └── useKeyBackupLogic.ts
│   ├── search/
│   │   ├── useSearchStateLogic.ts
│   │   └── useKeyboardLogic.ts
│   └── interactions/
│       ├── useTooltipLogic.ts
│       └── useLongPressLogic.ts
│
├── platform/             # ✅ Platform-specific adapters
│   ├── files/
│   │   ├── useFileSystem.web.ts
│   │   ├── useFileSystem.native.ts
│   │   ├── useDownload.web.ts
│   │   └── useDownload.native.ts
│   ├── events/
│   │   ├── useKeyboardEvents.web.ts
│   │   ├── useKeyboardEvents.native.ts
│   │   ├── useClickOutside.web.ts
│   │   └── useClickOutside.native.ts
│   ├── layout/
│   │   ├── useScreenDimensions.web.ts
│   │   └── useScreenDimensions.native.ts
│   └── navigation/
│       ├── useNavigation.web.ts
│       └── useNavigation.native.ts
│
└── [composed-hooks].ts   # ✅ Single hooks that compose business + platform
```

### Example Refactor: useFileUpload

#### Before (Current - Duplicated)

```typescript
// useFileUpload.ts - Re-exports web version
export { useWebFileUpload as useFileUpload } from './useWebFileUpload';

// useWebFileUpload.ts - 150+ lines mixing business + web APIs
const { getRootProps, getInputProps, acceptedFiles } = useDropzone({...}); // ❌ Web API
const [uploadProgress, setUploadProgress] = useState(0); // ✅ Business logic
const buffer = await file.arrayBuffer(); // ❌ Web API
const isValidSize = file.size <= maxSize; // ✅ Business logic

// useFileUpload.native.ts - Separate implementation with different APIs
import { DocumentPicker } from 'expo-document-picker'; // ❌ Different API
const [uploadProgress, setUploadProgress] = useState(0); // ❌ Duplicated business logic
```

#### After (Adapter Pattern)

```typescript
// business/files/useFileUploadLogic.ts - ✅ Pure business logic
export const useFileUploadLogic = (platformAdapter) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const validateFile = (file) => {
    return file.size <= maxSize && allowedTypes.includes(file.type);
  };

  const processUpload = async (files) => {
    setIsUploading(true);
    for (const file of files) {
      if (!validateFile(file)) continue;
      const buffer = await platformAdapter.readFile(file);
      // ... upload logic
    }
    setIsUploading(false);
  };

  return { uploadProgress, isUploading, error, processUpload, validateFile };
};

// platform/files/useFileSystem.web.ts - ✅ Web adapter
export const useFileSystemAdapter = () => {
  const { getRootProps, getInputProps, acceptedFiles } = useDropzone({...});

  return {
    readFile: async (file) => await file.arrayBuffer(),
    filePickerProps: { getRootProps, getInputProps },
    selectedFiles: acceptedFiles,
  };
};

// platform/files/useFileSystem.native.ts - ✅ Native adapter
export const useFileSystemAdapter = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({...});
    setSelectedFiles([result]);
  };

  return {
    readFile: async (file) => { /* React Native file reading */ },
    filePickerProps: { onPress: pickFiles },
    selectedFiles,
  };
};

// useFileUpload.ts - ✅ Single composed hook for both platforms
import { useFileUploadLogic } from './business/files/useFileUploadLogic';
import { useFileSystemAdapter } from './platform/files/useFileSystem';

export const useFileUpload = () => {
  const platformAdapter = useFileSystemAdapter();
  return useFileUploadLogic(platformAdapter);
};
```

## Important Architecture Note: Barrel Exports vs Direct Imports

### The Import Chain Problem

During development, we discovered that barrel exports (`export * from './business'`) were causing unrelated hooks to be loaded, even when components didn't directly use them:

```typescript
// Onboarding.native.tsx imports:
import { useOnboardingFlow } from '@/hooks';

// This loads the entire chain:
@/hooks/index.ts → ./business → ./search → useSearchResultsResponsive (has window.addEventListener!)
```

Even though Onboarding never uses search hooks, Metro processes all exports and evaluates files with web APIs, causing crashes.

### Solution Strategy

**Not**: Abandon barrel exports entirely  
**But**: Structure them properly for cross-platform compatibility

#### ✅ Good Barrel Exports (Keep Using)

```typescript
// All hooks work on both platforms
export * from './useOnboardingFlow'; // Pure business logic
export * from './useUserSettings'; // Pure business logic
export * from './useProfileImage'; // Pure business logic
```

#### ❌ Problematic Barrel Exports (Fix First)

```typescript
// Mixed platform-specific code
export * from './useSearchResultsResponsive'; // Has window.addEventListener
export * from './useKeyboardShortcuts'; // Has document.querySelector
```

#### 🔄 Migration Path

1. **During refactoring**: Use direct imports for non-adapted hooks
2. **After adapter pattern**: Return to clean barrel exports
3. **End goal**: All hooks work cross-platform, barrel exports are safe

### Update: Platform Resolution vs Adapter Pattern (August 9, 2025)

**Important Discovery**: Not all hooks need full adapter pattern refactoring. Some hooks already work correctly with Metro's platform-specific file resolution (`.ts` vs `.native.ts`), but get contaminated through import chains.

**Example - Search Hooks Solution**:

- ❌ **Wrong Approach**: Implement full adapter pattern for `useSearchResultsResponsive`
- ✅ **Right Approach**: Fix import chains so Metro can properly resolve to `.native.ts` versions

**Decision Matrix for Hook Refactoring**:

1. **Use Platform Resolution** when:
   - Hook already has `.native.ts` version
   - Business logic is minimal or platform-specific
   - Issue is import chain contamination, not architecture

2. **Use Adapter Pattern** when:
   - Hooks have significant shared business logic
   - Need to eliminate code duplication between platforms
   - Want to ensure 90% code sharing goal

**Hooks That Use Platform Resolution**:

- `useSearchResultsResponsive` - Web (DOM) vs Native (flexbox) approaches
- `useSearchResultsOutsideClick` - Web (click events) vs Native (gesture handling)
- `useKeyboardShortcuts` - Web (keyboard) vs Native (hardware buttons)

**Hooks That Use Adapter Pattern**:

- `useOnboardingFlow` - Shared business logic with platform-specific SDK adapters ✅ **COMPLETED**
- `useKeyBackup` - Shared validation with platform-specific file handling

## SDK Integration Strategy & Feature Parity Principle

### Core Principle: Identical Functionality Across Platforms

**Requirement**: Web and native versions MUST have identical functionality, even when using different implementations.

### Current SDK Situation

1. **Web**: Uses real `@quilibrium/quilibrium-js-sdk-channels` with full passkey support
2. **Native**: Uses SDK shim (`/src/shims/quilibrium-sdk-channels.native.tsx`) due to incompatibility
3. **Future**: Will integrate real SDK once React Native compatible version is available

### Implementation Guidelines

When creating native components while SDK is unavailable:

1. **Maintain Feature Parity**
   - If web version has a feature, native MUST have it too
   - Use manual implementations as temporary solutions
   - Example: `Onboarding.native.tsx` manually calls `uploadRegistration` since PasskeyModal isn't available

2. **Add Clear TODO Comments**

   ```typescript
   // TODO: When real SDK is integrated for React Native:
   // 1. Import PasskeyModal from the SDK
   // 2. Remove manual uploadRegistration call
   // 3. Let PasskeyModal handle registration automatically
   ```

3. **Document SDK Dependencies**
   - Note which SDK components are missing (e.g., PasskeyModal)
   - Explain temporary workarounds
   - Reference: `/sdk-shim-temporary-solutions.md`

4. **Use Adapter Pattern for SDK Hooks**
   - Create platform adapters that abstract SDK differences
   - Example: `usePasskeyAdapter.web.ts` vs `usePasskeyAdapter.native.ts`
   - Business logic remains shared and platform-agnostic

### Example: Onboarding Component

**Web Version Features**:

- PasskeyModal for authentication UI ✅
- Automatic user registration ✅
- Key backup functionality ✅
- Profile photo upload ✅

**Native Version Implementation**:

- ~~PasskeyModal~~ → Manual UI implementation ✅
- ~~Automatic registration~~ → Manual `uploadRegistration` call ✅
- Key backup → Same hook via adapter pattern ✅
- Profile photo → Same primitive component ✅

**Result**: Identical functionality, different implementations

### Integration Checklist for Future SDK

When real React Native SDK becomes available:

- [ ] Remove SDK shim file
- [ ] Update all components with TODO comments
- [ ] Remove manual workarounds
- [ ] Test feature parity is maintained
- [ ] Update documentation

See: `.agents/tasks/todo/mobile-dev/sdk-shim-temporary-solutions.md` for detailed tracking

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal**: Establish adapter pattern and refactor most critical hooks

**Tasks**:

1. Create new directory structure (`business/`, `platform/`)
2. Refactor file handling hooks (highest business value):
   - `useFileUpload` / `useWebFileUpload`
   - `useKeyBackup` / `useWebKeyBackup`
   - `useCustomAssets`
3. Create platform adapters:
   - File system access (`useFileSystem.web.ts`, `useFileSystem.native.ts`)
   - Download functionality (`useDownload.web.ts`, `useDownload.native.ts`)
4. Update imports in components using these hooks
5. **Follow native component styling rules** - Apply migration guide principles when updating components

### Phase 2: UI Interactions (Week 2)

**Goal**: Fix mobile UX issues caused by web-specific event handling

**Tasks**:

1. Refactor interaction hooks:
   - `useTooltipInteraction`
   - `useSearchResultsOutsideClick`
   - `useLongPress`
   - `useKeyboardShortcuts`
2. Create event adapters:
   - `useClickOutside.web.ts` / `useClickOutside.native.ts`
   - `useKeyboardEvents.web.ts` / `useKeyboardEvents.native.ts`
   - `useGestures.web.ts` / `useGestures.native.ts`
3. **Apply KeyboardAvoidingView patterns** - Use migration guide examples for form interactions

### Phase 3: Layout & Navigation (Week 3)

**Goal**: Ensure consistent responsive behavior and navigation

**Tasks**:

1. Refactor layout hooks:
   - `useResponsiveLayout`
   - `useSearchResultsResponsive`
2. Refactor navigation hooks:
   - `useSearchContext`
   - `useGlobalSearchNavigation`
3. Create adapters:
   - `useScreenDimensions.web.ts` / `useScreenDimensions.native.ts`
   - `useNavigation.web.ts` / `useNavigation.native.ts`

### Phase 4: Utilities & Polish (Week 4)

**Goal**: Complete remaining hooks and cleanup

**Tasks**:

1. Refactor remaining hooks:
   - `useCopyToClipboard`
   - `useImageLoading`
   - `useAddressValidation`
   - `useSpaceDragAndDrop`
2. Remove all `.native.ts` duplicate files
3. Update documentation and examples
4. Test all functionality on both platforms

## Benefits After Refactoring

### ✅ Architectural Benefits

- **Single source of truth** for business logic
- **True 90% code sharing** achieved
- **Platform differences isolated** to adapters
- **Future platforms** (desktop native) only require new adapters

### ✅ Development Benefits

- **Bug fixes once** - business logic shared
- **Easier testing** - business logic separate from platform APIs
- **Better maintainability** - clear separation of concerns
- **Consistent behavior** - same business rules across platforms

### ✅ Mobile Benefits

- **Proper mobile UX** - native event handling, gestures, file access
- **Performance improvements** - no web API polyfills
- **Feature parity** - same functionality, different implementation

## Risk Mitigation

### Potential Challenges

1. **Breaking changes** during refactor
2. **Complex web-specific libraries** (react-dropzone, @dnd-kit)
3. **Testing effort** for both platforms
4. **Team coordination** during refactor

### Mitigation Strategies

1. **Incremental migration** - one hook at a time
2. **Feature flags** - toggle between old/new implementations
3. **Comprehensive testing** - automated tests for business logic
4. **Documentation** - clear examples and migration guides

## Success Metrics

- [ ] **Zero `.native.ts` duplicate files** remaining
- [ ] **24 hooks refactored** to adapter pattern
- [ ] **90%+ code sharing** achieved (measured by line count)
- [ ] **All mobile functionality** working without web API dependencies
- [ ] **Performance improvements** on mobile (no polyfills)

_Last updated: August 9, 2025_
