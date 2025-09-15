# Client-Side Image Processing for Large File Uploads

## Objective
Extend the existing image compression system (currently only in MessageComposer) to all image upload scenarios in the app, enabling users to upload images up to 25MB while automatically compressing them client-side to optimal sizes for each use case.

## Current State Analysis

### Existing Infrastructure ✅
- **compressorjs v1.2.1** already installed and working in MessageComposer
- **FileUpload primitive** with consistent cross-platform API
- **Multiple upload hooks** with similar patterns across components
- **Data flow**: File → ArrayBuffer → Base64 data URL → UI preview

### Current File Size Limits (Too Restrictive)
- Message Attachments: 2MB max → **Increase to 25MB with compression**
- User Avatars: 2MB max → **Increase to 25MB with compression**
- Space Icons: 1MB max → **Increase to 25MB with compression**
- Space Banners: 1MB max → **Increase to 25MB with compression**
- Custom Emojis: 256KB max → **Increase to 5MB with compression**
- Custom Stickers: 256KB max → **Increase to 25MB with compression**

### Current Image Display Sizes (From CSS Analysis)
- **Avatar uploads**: 82px × 82px (desktop), 70px × 70px (mobile)
- **Space banners**: 300px × 120px (desktop), 100% width × 100px (mobile)
- **Message attachments**: 140px × 140px preview → **1728px × 864px max when enlarged in modal**
- **Custom emojis**: 24px × 24px display
- **Custom stickers**: 72px × 72px display

## Implementation Strategy

### 1. Optimal Compressed Image Sizes (2X Display Size)

Based on current UI display dimensions, target these optimized sizes:

| Use Case | Current Limit | New Input Limit | Compressed Output Size |
|----------|---------------|-----------------|------------------------|
| **User Avatars** | 2MB | 25MB | 164×164px (square crop) |
| **Space Icons** | 1MB | 25MB | 164×164px (square crop) |
| **Space Banners** | 1MB | 25MB | 600×240px (maintain ratio) |
| **Message Attachments** | 2MB | 25MB | 1200px max dimension (ratio) |
| **Custom Emojis** | 256KB | 5MB | 48×48px (square crop) |
| **Custom Stickers** | 256KB | 25MB | 144×144px (square crop) |

### 2. Create Image Processing Utilities

**Location**: `src/utils/imageProcessing/`

```
src/utils/imageProcessing/
├── processors/
│   ├── avatarProcessor.ts      # 164×164px dimensions
│   ├── bannerProcessor.ts      # 600×240px dimensions
│   ├── attachmentProcessor.ts  # 1200px max dimension
│   ├── emojiProcessor.ts       # 48×48px dimensions
│   └── stickerProcessor.ts     # 144×144px dimensions
├── compressor.ts               # Unified compressorjs wrapper
├── types.ts                    # Shared interfaces
└── index.ts                    # Public API exports
```

**Extend existing MessageComposer pattern** from `useMessageComposer.ts:141-177`

### 3. Technical Specifications

#### Compression Strategy (Simple & Fast)
```typescript
// Single-pass compression - dimension-based limits
const compressImage = async (file, maxWidth, maxHeight) => {
  // Skip compression if already small enough
  if (file.size < 100000 && isWithinDimensions(file, maxWidth, maxHeight)) {
    return file;
  }

  // Single compression pass with good quality
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: 0.8,              // Single quality setting
      maxWidth,                  // Dimension limit
      maxHeight,                 // Dimension limit
      convertTypes: isPNGPhoto(file) ? ['image/png'] : [], // Smart PNG→JPEG for photos
      success: resolve,
      error: reject
    });
  });
};
```

#### Simple Quality Approach
- **Single compression pass** at **0.8 quality**
- **Dimension limits** naturally control file size
- **Fast performance** - no multiple attempts
- **Predictable results** - users know what to expect

#### Format Optimization (Simple Approach)
- **Dimension-based compression** for all formats
- **PNG with transparency**: Preserved, just resized to fit dimensions
- **GIFs**: Resized to fit dimensions (compressorjs handles this)
- **Large PNG photos**: Auto-convert to JPEG for better compression
- **Quality standard**: Single 0.8 quality for all images
- **Support formats**: JPEG, PNG, WebP, HEIC, GIF (match current FileUpload)

### 4. Integration Points (Update Existing Hooks)

#### 4.1 Update `useWebFileUpload.ts` (Avatar uploads)
- **File**: `src/hooks/business/useWebFileUpload.ts`
- **Current**: Direct `arrayBuffer()` call on line ~30
- **Change**: Replace with `avatarProcessor()` call
- **Components affected**: Onboarding.tsx, UserSettingsModal.tsx

#### 4.2 Update `useSpaceFileUploads.ts` (Space assets)
- **File**: `src/hooks/business/spaces/useSpaceFileUploads.ts`
- **Current**: Direct `arrayBuffer()` calls for icon/banner
- **Change**: Use `avatarProcessor()` for icons, `bannerProcessor()` for banners
- **Components affected**: CreateSpaceModal.tsx, SpaceEditor.tsx

#### 4.3 Standardize `useMessageComposer.ts` (Message attachments)
- **File**: `src/hooks/business/messages/useMessageComposer.ts`
- **Current**: Custom compressorjs implementation (lines 141-177)
- **Change**: Replace with `attachmentProcessor()` for consistency
- **Component affected**: MessageComposer.tsx

#### 4.4 Update SpaceEditor.tsx (Emojis/Stickers)
- **File**: `src/components/modals/spaces/SpaceEditor.tsx`
- **Current**: Direct file upload without compression (lines ~400-500)
- **Change**: Add `emojiProcessor()` and `stickerProcessor()`

### 5. User Experience Enhancements

#### 5.1 Loading States
Extend existing loading patterns to show compression progress:
```typescript
// Current pattern from FileUpload primitive
setIsLoading(true);
// Add: setCompressionProgress(0);
// Add compression progress updates
setIsLoading(false);
```

#### 5.2 Compression Progress & Error Handling
**Progress indicator** (show only if compression takes > 3 seconds):
```typescript
// Use Callout primitive with rotating spinner Icon
<Callout variant="warning" className="flex items-center gap-2">
  <Icon name="spinner-third" spin={true} />
  <span>Compressing image...</span>
</Callout>
```

**Error messages** (no success messages):
```typescript
// Current: "File too large"
// New: "Unable to compress image below size limit. Please use a smaller image." (failure)
```

#### 5.3 File Size Limit Updates
Update validation in FileUpload primitive to allow 25MB input:
```typescript
// File: src/components/primitives/FileUpload.tsx
// Current: maxSize prop varies per component
// New: maxSize={25 * 1024 * 1024} for image uploads
```

### 6. Dependencies

#### Web Implementation (Already Available)
- ✅ **compressorjs v1.2.1** - Already installed and working

#### Mobile Implementation (Future)
- 📱 **expo-image-manipulator** - Add to mobile/package.json when mobile development begins
- 📱 **react-native-image-crop-picker** - Alternative option for mobile

### 7. Testing Requirements

#### Manual Testing Scenarios
1. **Large file uploads** (15MB+ images) across all upload scenarios
2. **Progressive quality reduction** - verify fallback behavior
3. **Format conversion** - PNG→JPEG for photos
4. **GIF preservation** - ensure GIFs skip compression
5. **Error handling** - files that can't be compressed
6. **Cross-platform** - consistent behavior web/mobile

#### Integration Testing
- Verify all existing upload workflows still work
- Check that compressed images display correctly
- Ensure file size limits are properly enforced
- Test drag & drop functionality remains intact

### 8. Implementation Order

1. **Create compression utilities** (`src/utils/imageProcessing/`)
2. **Update MessageComposer first** (standardize existing compression)
3. **Add avatar compression** (Onboarding, UserSettings)
4. **Add space asset compression** (CreateSpace, SpaceEditor icons/banners)
5. **Add emoji/sticker compression** (SpaceEditor)
6. **Update file size limits** throughout the app
7. **Enhance error messages** and loading states

### 9. Success Metrics

- **File size reduction**: 15MB uploads → reasonable sizes based on dimensions (typically 50KB-500KB)
- **Upload success rate**: > 95% for files under 25MB
- **User experience**: No change in upload workflow, faster uploads
- **Performance**: Single-pass compression completes in < 2 seconds for 25MB files
- **Quality**: Compressed images visually acceptable at display sizes

### 10. File Size Validation Strategy

Update these components to allow 25MB input with dimension-based compression:

```typescript
// Before compression: Allow up to 25MB input
if (file.size > 25 * 1024 * 1024) return "File too large (max 25MB)";

// After compression: Simple validation
// Dimension limits naturally control file size - no additional size checks needed
```

This approach leverages your existing solid infrastructure while systematically extending compression to all image upload scenarios, maintaining the consistent user experience your app already provides.

---
*Updated: 2025-09-15 - Detailed analysis of current codebase with specific implementation plan*