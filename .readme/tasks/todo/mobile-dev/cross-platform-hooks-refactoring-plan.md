# Cross-Platform Hooks Refactoring Plan
**Priority: High | Type: Architecture | Estimated Effort: 3-4 weeks**

## Executive Summary

Our cross-platform architecture goal of sharing 90% of business logic is being undermined by hooks that mix business logic with platform-specific APIs. We currently have **24 hooks** that require refactoring using the **adapter pattern** to maintain our shared codebase vision.

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

*Last updated: August 8, 2025*
*Created by: Claude Code*