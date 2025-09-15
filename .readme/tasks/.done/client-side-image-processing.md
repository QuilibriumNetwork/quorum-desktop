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

### Current Image Display Sizes (From CSS Analysis) ✅ VERIFIED
- **Avatar uploads**: 82px × 82px (consistent across chat, UserSettingsModal, and SpaceEditor)
- **Space banners**: 300px × 120px (desktop), 100% width × 100px (mobile)
- **Message attachments**: 140px × 140px preview → **300px × 300px max when enlarged in modal**
- **Custom emojis**: 24px × 24px display
- **Custom stickers**: 72px × 72px preview, **300px × 300px max in messages**

## Implementation Strategy

### 1. Optimal Compressed Image Sizes (1.5X Display Size) ✅ IMPLEMENTED

Based on current UI display dimensions, target these optimized sizes:

| Use Case | Current Limit | New Input Limit | Compressed Output Size | Display Size |
|----------|---------------|-----------------|------------------------|--------------|
| **User Avatars** | 2MB | 25MB | 123×123px (square crop) | 82×82px |
| **Space Icons** | 1MB | 25MB | 123×123px (square crop) | 82×82px |
| **Space Banners** | 1MB | 25MB | 450×253px (16:9 crop) | 300×120px desktop, varies×100px mobile |
| **Message Attachments** | 2MB | 25MB | 1200px max dimension (ratio) | 140×140px preview, 300×300px modal |
| **Custom Emojis** | 256KB | 5MB | 36×36px (square crop) | 24×24px |
| **Custom Stickers** | 256KB | 25MB | 450×450px (maintain ratio) | 300×300px max |

**Note**: Changed from 2x to 1.5x multiplier for better balance between quality and file size.

### 2. Create Image Processing Utilities

**Location**: `src/utils/imageProcessing/`

```
src/utils/imageProcessing/                    ✅ IMPLEMENTED
├── processors/
│   ├── avatarProcessor.ts      # 123×123px dimensions
│   ├── bannerProcessor.ts      # 450×253px dimensions (16:9 ratio)
│   ├── attachmentProcessor.ts  # 1200px max dimension
│   ├── emojiProcessor.ts       # 36×36px dimensions
│   └── stickerProcessor.ts     # 450×450px dimensions
├── compressor.ts               # Unified compressorjs wrapper with smart PNG→JPEG conversion
├── types.ts                    # Shared interfaces and compression tracking
└── index.ts                    # Public API exports + CompressionProgressTracker
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
- **PNG with transparency**: Preserved for files ≤750KB, converted to JPEG for larger files (likely photos)
- **GIFs**: Preserved without compression (maintains animation)
- **Large PNG photos**: Auto-convert to JPEG for files >750KB for better compression
- **Quality standard**: Single 0.8 quality for all images
- **Support formats**: JPEG, PNG, WebP, HEIC, GIF (match current FileUpload)

### 4. Integration Points (Update Existing Hooks)

#### 4.1 Update `useWebFileUpload.ts` (Avatar uploads) ✅ IMPLEMENTED
- **File**: `src/hooks/business/user/useWebFileUpload.ts`
- **Change**: Added `processAvatarImage()` compression with error handling
- **File size limit**: Updated from 2MB → 25MB input
- **Components affected**: Onboarding.tsx, UserSettingsModal.tsx

#### 4.2 Update `useSpaceFileUploads.ts` (Space assets) ✅ IMPLEMENTED
- **File**: `src/hooks/business/ui/useSpaceFileUploads.ts`
- **Change**: Added `processAvatarImage()` for icons, `processBannerImage()` for banners
- **File size limit**: Updated from 1MB → 25MB input
- **Components affected**: CreateSpaceModal.tsx, SpaceEditor.tsx

#### 4.3 Standardize `useMessageComposer.ts` (Message attachments) ✅ IMPLEMENTED
- **File**: `src/hooks/business/messages/useMessageComposer.ts`
- **Change**: Replaced custom compressorjs with standardized `processAttachmentImage()`
- **File size limit**: Updated from 2MB → 25MB input
- **Component affected**: MessageComposer.tsx

#### 4.4 Update `useCustomAssets.ts` (Emojis/Stickers) ✅ IMPLEMENTED
- **File**: `src/hooks/business/ui/useCustomAssets.ts` (not SpaceEditor directly)
- **Change**: Added `processEmojiImage()` and `processStickerImage()` with multi-file support
- **File size limits**: Emojis 256KB → 5MB, Stickers 256KB → 25MB input
- **Loading states**: Added processing indicators for multi-file uploads
- **UI updates**: SpaceEditor.tsx text updated to reflect new limits

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

### 8. Implementation Order ✅ COMPLETED

1. ✅ **Create compression utilities** (`src/utils/imageProcessing/`)
2. ✅ **Update MessageComposer first** (standardize existing compression)
3. ✅ **Add avatar compression** (Onboarding, UserSettings)
4. ✅ **Add space asset compression** (CreateSpace, SpaceEditor icons/banners)
5. ✅ **Add emoji/sticker compression** (SpaceEditor via useCustomAssets)
6. ✅ **Update file size limits** throughout the app
7. ✅ **Enhance error messages** and loading states

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

## Key Changes Made During Implementation

### Major Differences from Original Plan:
1. **Compression Multiplier**: Changed from 2x to **1.5x display size** for better balance between quality and file size
2. **Sticker Display Discovery**: Found stickers display at 300×300px in messages (not 72×72px), adjusted compression accordingly
3. **Avatar Size Consistency**: Verified avatars use same 82×82px across all contexts (chat, modals)
4. **Hook Architecture**: Used existing `useCustomAssets.ts` for emojis/stickers instead of directly modifying SpaceEditor
5. **Multi-file Support**: Added proper loading states and error handling for emoji/sticker batch uploads
6. **Smart Format Conversion**: Implemented PNG→JPEG conversion for files >750KB (preserves transparency for smaller graphics/stickers)
7. **Error Message Improvements**: Enhanced error messages to reflect new size limits and compression capabilities
8. **Banner Aspect Ratio**: Changed from maintain aspect ratio to 16:9 cropping to prevent letterboxing and ensure proper display across all screen sizes
9. **Legacy Hook Updates**: Fixed `useProfileImage.ts` and `useFileUpload.ts` hooks that were bypassing compression system with old 1MB limits
   - **UserSettingsModal**: Now uses updated `useProfileImage` with 25MB limit and avatar compression
   - **CreateSpaceModal**: Now uses updated `useFileUpload` with 25MB limit and avatar compression
   - **Onboarding Components**: Updated file size limits from 2MB         
   to 25MB (compression handled by FileUpload primitive)

### Additional Features Added:
- **CompressionProgressTracker**: For showing spinners on long compression operations (>3 seconds)
- **File size thresholds**: Skip compression for files already small enough and within dimensions
- **GIF preservation**: Maintain animated GIFs without compression
- **Compression ratio tracking**: Monitor and report compression effectiveness
- **Multi-platform compatibility**: Structured for easy mobile implementation later
- **Smart banner cropping**: 16:9 aspect ratio ensures banners display properly across all screen sizes without letterboxing

### Final File Size Limits:
- **Input limits**: 25MB (5MB for emojis)
- **Output sizes**: Optimized 1.5x display dimensions with 0.8 quality compression
- **Typical results**: 15MB uploads → 50KB-500KB final sizes

---
*Created: 2025-09-15 - Initial task analysis and implementation plan*
*Completed: 2025-09-15 - Full implementation with optimizations*