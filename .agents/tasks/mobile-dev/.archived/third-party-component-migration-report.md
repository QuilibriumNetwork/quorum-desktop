---
type: task
title: Third-Party Component Migration Report
status: reference
created: 2026-01-09T00:00:00.000Z
updated: '2026-04-09'
---

# Third-Party Component Migration Report

> **Architecture Status (2026-04-09)**: The project now uses a **multi-repo model** (`quorum-desktop`, `quorum-mobile`, `quorum-shared`). The primitive wrapper strategy described here remains valid. However, the implementations belong in `quorum-shared` (for cross-platform wrappers) or directly in `quorum-mobile` (for native-only solutions) — **not** in `src/components/primitives/` of this repo. Items marked "DONE" below have been implemented in `quorum-shared`.

## Executive Summary

This report analyzes all third-party UI components in the Quorum Desktop app that are web-browser specific and will not work in React Native. For each component, we provide alternative solutions and recommend implementation paths that fit our cross-platform primitive architecture.

**Key Finding**: Most third-party components can be wrapped with primitives that maintain identical APIs while using platform-appropriate implementations underneath.

---

## Components Requiring Migration

### 1. react-virtuoso (Virtual Scrolling)

#### Current Usage

- **File**: `MessageList.tsx`, `SearchResults.tsx`
- **Purpose**: High-performance virtual scrolling for large lists (1000+ messages)
- **Dependencies**: DOM APIs (IntersectionObserver, ResizeObserver)
- **Usage Pattern**:

  ```tsx
  import { Virtuoso } from 'react-virtuoso';

  <Virtuoso
    data={messages}
    itemContent={(index, message) => <MessageItem message={message} />}
    followOutput="smooth"
    initialTopMostItemIndex={messages.length - 1}
  />;
  ```

#### Why It Won't Work on Mobile

- Uses DOM-specific APIs not available in React Native
- Relies on browser viewport calculations
- CSS-based positioning and sizing

#### Recommended Solution: VirtualList Primitive

**Implementation Strategy** (lives in `quorum-shared`):

```
@quilibrium/quorum-shared/src/primitives/VirtualList/
├── VirtualList.web.tsx      # Continue using react-virtuoso
├── VirtualList.native.tsx   # Use React Native FlatList/VirtualizedList
├── types.ts                # Shared interface
└── index.ts               # Platform resolution
```

**Web Implementation** (No Changes):

```tsx
// VirtualList.web.tsx
import { Virtuoso } from 'react-virtuoso';

export const VirtualList = ({ data, renderItem, ...props }) => (
  <Virtuoso
    data={data}
    itemContent={(index, item) => renderItem({ item, index })}
    {...props}
  />
);
```

**Native Implementation**:

```tsx
// VirtualList.native.tsx
import { FlatList } from 'react-native';

export const VirtualList = ({ data, renderItem, ...props }) => (
  <FlatList
    data={data}
    renderItem={({ item, index }) => renderItem({ item, index })}
    removeClippedSubviews={true}
    maxToRenderPerBatch={10}
    updateCellsBatchingPeriod={50}
    windowSize={10}
    {...props}
  />
);
```

**Migration Impact**:

- ✅ Zero code changes in MessageList.tsx or SearchResults.tsx
- ✅ Identical API and behavior
- ✅ Platform-optimized performance


---

### 2. emoji-picker-react (Emoji Selection)

#### Current Usage

- **Files**: `EmojiPickerDrawer.tsx`, `Message.tsx`
- **Purpose**: Full-featured emoji picker with categories, search, skin tones
- **Dependencies**: DOM elements, CSS styling, browser events
- **Usage Pattern**:

  ```tsx
  import EmojiPicker from 'emoji-picker-react';

  <EmojiPicker
    onEmojiClick={handleEmojiSelect}
    searchDisabled={false}
    skinTonesDisabled={false}
    previewConfig={{ showPreview: false }}
  />;
  ```

#### Why It Won't Work on Mobile

- Renders DOM elements with CSS classes
- Uses browser-specific event handling
- Hardcoded web styling and layouts

#### Recommended Solution: EmojiPicker Primitive

**Implementation Strategy** (lives in `quorum-shared` or `quorum-mobile`):

```
@quilibrium/quorum-shared/src/primitives/EmojiPicker/
├── EmojiPicker.web.tsx      # Continue using emoji-picker-react
├── EmojiPicker.native.tsx   # Custom React Native implementation
├── types.ts                # Shared interface
└── index.ts               # Platform resolution
```

**Web Implementation** (No Changes):

```tsx
// EmojiPicker.web.tsx
import EmojiPicker from 'emoji-picker-react';

export const EmojiPicker = ({ onEmojiClick, ...props }) => (
  <EmojiPicker onEmojiClick={onEmojiClick} {...props} />
);
```

**Native Implementation Options**:

**Option A**: Use `react-native-emoji-selector` (Recommended)

```tsx
// EmojiPicker.native.tsx
import EmojiSelector from 'react-native-emoji-selector';

export const EmojiPicker = ({ onEmojiClick, ...props }) => (
  <EmojiSelector
    onEmojiSelected={(emoji) => onEmojiClick({ emoji })}
    showSearchBar={true}
    showHistory={true}
    showSectionTitles={true}
    category={Categories.all}
    {...props}
  />
);
```

**Option B**: Custom implementation using emoji datasets

- Use `emoji-datasource-apple` (already installed)
- Create custom grid with categories
- More control but higher complexity

**Migration Impact**:

- ✅ Zero code changes in EmojiPickerDrawer.tsx
- ✅ Same emoji selection behavior
- ⚠️ May need minor API adjustments for callback parameters


---

### 3. react-dropzone (File Upload)

#### Current Usage

- **Files**: `UserSettingsModal.tsx`, `DirectMessage.tsx`, `Channel.tsx`
- **Purpose**: Drag-and-drop file upload with click-to-select fallback
- **Dependencies**: File API, drag events, DOM file handling
- **Usage Pattern**:

  ```tsx
  import { useDropzone } from 'react-dropzone';

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    onDrop: handleFileDrop,
    multiple: false,
  });

  <div {...getRootProps()}>
    <input {...getInputProps()} />
    {isDragActive ? 'Drop files here' : 'Click or drag to upload'}
  </div>;
  ```

#### Why It Won't Work on Mobile

- Uses HTML5 File API and drag events
- Relies on DOM input elements
- Browser-specific file system access

#### Recommended Solution: FileUpload Primitive

**Implementation Strategy** (lives in `quorum-shared`):

```
@quilibrium/quorum-shared/src/primitives/FileUpload/
├── FileUpload.web.tsx       # Continue using react-dropzone
├── FileUpload.native.tsx    # Use React Native document/image pickers
├── types.ts                # Shared interface
└── index.ts               # Platform resolution
```

**Web Implementation** (No Changes):

```tsx
// FileUpload.web.tsx
import { useDropzone } from 'react-dropzone';

export const FileUpload = ({ onFilesSelected, accept, ...props }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    onDrop: onFilesSelected,
    ...props,
  });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {children}
    </div>
  );
};
```

**Native Implementation**:

```tsx
// FileUpload.native.tsx
import DocumentPicker from 'react-native-document-picker';
import ImagePicker from 'react-native-image-picker';

export const FileUpload = ({ onFilesSelected, accept, children }) => {
  const handlePress = async () => {
    try {
      const isImage = accept?.includes('image');

      if (isImage) {
        // Use image picker for photos
        const response = await ImagePicker.launchImageLibrary({
          mediaType: 'photo',
          quality: 0.8,
        });
        if (response.assets) {
          onFilesSelected(response.assets);
        }
      } else {
        // Use document picker for files
        const results = await DocumentPicker.pick({
          type: DocumentPicker.types.allFiles,
        });
        onFilesSelected(results);
      }
    } catch (error) {
      console.log('File selection cancelled');
    }
  };

  return <Pressable onPress={handlePress}>{children}</Pressable>;
};
```

**Migration Impact**:

- ✅ Zero code changes in business components
- ✅ Maintains file upload functionality
- 🔄 Drag-and-drop becomes tap-to-select (expected on mobile)


---

### 4. @fortawesome/react-fontawesome (Icons) - DONE

#### Current Usage

- **Files**: 35+ components throughout the app
- **Purpose**: SVG icon system with consistent styling
- **Dependencies**: SVG rendering, CSS classes
- **Usage Pattern**:

  ```tsx
  import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
  import { faTimes, faSearch, faUser } from '@fortawesome/free-solid-svg-icons';

  <FontAwesomeIcon icon={faTimes} className="w-4 h-4 text-subtle" />;
  ```

#### Why It Won't Work on Mobile

- Generates SVG elements with CSS classes
- Uses web-specific styling systems
- No direct React Native SVG support

#### Recommended Solution: Icon Primitive

**Implementation Strategy** (lives in `quorum-shared` — already done):

```
@quilibrium/quorum-shared/src/primitives/Icon/
├── Icon.web.tsx             # Uses FontAwesome
├── Icon.native.tsx          # Uses react-native-vector-icons
├── types.ts                # Shared interface with icon mapping
└── index.ts               # Platform resolution
```

**Web Implementation** (No Changes):

```tsx
// Icon.web.tsx
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export const Icon = ({ icon, size, color, ...props }) => (
  <FontAwesomeIcon
    icon={icon}
    className={`w-${size} h-${size} ${color}`}
    {...props}
  />
);
```

**Native Implementation**:

```tsx
// Icon.native.tsx
import FontAwesome from 'react-native-vector-icons/FontAwesome';

// Map FontAwesome 5 names to FontAwesome 4 names (react-native-vector-icons uses v4)
const iconMap = {
  faTimes: 'times',
  faSearch: 'search',
  faUser: 'user',
  faShield: 'shield',
  faPalette: 'paint-brush',
  faBell: 'bell',
  faInfoCircle: 'info-circle',
  // ... map all FontAwesome 5 icons to FontAwesome 4 equivalents
};

export const Icon = ({ icon, size = 16, color = '#666', ...props }) => (
  <FontAwesome
    name={iconMap[icon.iconName] || icon.iconName}
    size={size}
    color={color}
    {...props}
  />
);
```

**Migration Impact**:

- ✅ Zero import changes (same Icon component)
- ⚠️ Need to map ~50 FontAwesome icons to native equivalents
- ✅ Consistent visual appearance


---

### 5. react-tooltip (Tooltips) - DONE

#### Current Usage

- **Files**: `ReactTooltip.tsx` (custom wrapper), various components
- **Purpose**: Hover tooltips with mobile touch support
- **Dependencies**: DOM positioning, CSS styling, hover events
- **Usage Pattern**:

  ```tsx
  import ReactTooltip from 'react-tooltip';

  <span data-tip="Helpful information">
    Hover me
  </span>
  <ReactTooltip place="top" effect="solid" />
  ```

#### Why It Won't Work on Mobile

- Uses DOM positioning and hover events
- Relies on CSS for styling and positioning
- No native tooltip concept in mobile

#### Recommended Solution: Tooltip Primitive

**Implementation Strategy** (lives in `quorum-shared` — already done):

```
@quilibrium/quorum-shared/src/primitives/Tooltip/
├── Tooltip.web.tsx          # Uses react-tooltip
├── Tooltip.native.tsx       # Custom long-press implementation
├── types.ts                # Shared interface
└── index.ts               # Platform resolution
```

**Web Implementation** (No Changes):

```tsx
// Tooltip.web.tsx
import ReactTooltip from 'react-tooltip';

export const Tooltip = ({ children, content, ...props }) => (
  <>
    <span data-tip={content}>{children}</span>
    <ReactTooltip {...props} />
  </>
);
```

**Native Implementation**:

```tsx
// Tooltip.native.tsx
import { useState } from 'react';
import { Pressable, Modal, Text, View } from 'react-native';

export const Tooltip = ({ children, content, ...props }) => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        onLongPress={() => setVisible(true)}
        onPress={() => setVisible(false)}
      >
        {children}
      </Pressable>

      <Modal visible={visible} transparent>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <View style={styles.tooltip}>
            <Text>{content}</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};
```

**Migration Impact**:

- ✅ Zero code changes in components using tooltips
- 🔄 Hover becomes long-press (mobile standard)
- ✅ Same informational content delivery


---

## Components That Work As-Is

### MiniSearch (Search Library)

- **Status**: ✅ **FULLY COMPATIBLE**
- **Reason**: Pure JavaScript library with no DOM dependencies
- **Action**: No changes needed, works identically on both platforms

### @lingui/react (Internationalization)

- **Status**: ✅ **FULLY COMPATIBLE**
- **Reason**: React Native has full i18n support
- **Action**: No changes needed

### @tanstack/react-query (Data Fetching)

- **Status**: ✅ **FULLY COMPATIBLE**
- **Reason**: Platform-agnostic data fetching and caching
- **Action**: No changes needed

---

## Desktop-Only Components (No Mobile Equivalent)

### @dnd-kit (Drag & Drop)

- **Status**: 🖥️ **DESKTOP-ONLY**
- **Reason**: Drag & drop isn't appropriate for mobile UX
- **Mobile Alternative**: Edit mode with up/down buttons, reorder menus
- **Action**: Design mobile-specific reordering UI patterns

### react-router (Navigation)

- **Status**: 🔄 **COMPLETE REDESIGN**
- **Reason**: Mobile uses different navigation paradigms
- **Mobile Alternative**: @react-navigation/native
- **Action**: Implement mobile navigation architecture in Phase 4

---

## Migration Priority Matrix

### High Priority (Core App Function)

1. **VirtualList** (MessageList.tsx) - Chat performance critical
2. **FileUpload** (File sharing) - Core functionality
3. **Icon** (35+ components) - Visual consistency

### Medium Priority (User Experience)

4. **EmojiPicker** (Chat enhancement) - Important for messaging
5. **Tooltip** (Help system) - Usability improvement

### Low Priority (Enhancement)

6. **Navigation** (Complete redesign) - Phase 4 implementation

---

## Implementation Recommendations

### Phase 2A: Core Performance (Weeks 3-4)

- Implement VirtualList primitive for MessageList.tsx
- Test with large message datasets (1000+ messages)
- Optimize scroll performance and memory usage

### Phase 2B: Essential UI (Weeks 5-6)

- Implement Icon primitive and map FontAwesome icons
- Implement FileUpload primitive with platform-specific pickers
- Test file upload workflows across all components

### Phase 2C: User Experience (Weeks 7-8)

- Implement EmojiPicker primitive
- Implement Tooltip primitive with mobile touch patterns
- Test interaction patterns and accessibility

### Phase 2D: Validation

- Audit remaining web-only dependencies
- Test all primitives in development and production
- Document any behavioral differences between platforms

---

## Success Metrics

### Performance

- ✅ MessageList handles 1000+ messages smoothly (60fps)
- ✅ File uploads complete without errors
- ✅ Icons render consistently across platforms

### Compatibility

- ✅ 0 breaking changes to existing component APIs
- ✅ 100% visual consistency between web and mobile
- ✅ All existing functionality preserved

### Development Experience

- ✅ Primitives integrate seamlessly into existing codebase
- ✅ Clear documentation for platform differences
- ✅ Easy testing and debugging workflows

---

## Risk Assessment

### Low Risk

- **MiniSearch, @lingui, react-query**: Already compatible
- **Icon mapping**: Straightforward library integration

### Medium Risk

- **VirtualList**: Performance tuning may require iteration
- **FileUpload**: Platform permission complexity

### High Risk

- **EmojiPicker**: May need custom implementation if libraries don't meet needs
- **Navigation**: Complete architecture change in Phase 4

---

## Conclusion

The third-party component migration is highly achievable with our primitive wrapper approach. Most components (5/8) can be wrapped with minimal complexity, preserving existing APIs while enabling cross-platform functionality.

**Key Success Factors**:

1. **Primitive wrappers** maintain API compatibility
2. **Platform-appropriate implementations** optimize for each environment
3. **Incremental migration** allows testing and validation at each step
4. **Preserved functionality** ensures no regression in user experience

The biggest challenge will be the React Router → React Navigation migration in Phase 4, which requires a complete navigation architecture redesign. However, the component-level primitives (VirtualList, FileUpload, Icon, etc.) are straightforward implementations that fit well within our established architecture.

---

_Report generated: 2025-07-23 02:15 UTC_
_Last updated: 2026-04-09 — updated to reflect multi-repo model (quorum-desktop / quorum-mobile / quorum-shared)_
_For current primitives status, see [quorum-shared-architecture.md](../../../docs/quorum-shared-architecture.md)_
