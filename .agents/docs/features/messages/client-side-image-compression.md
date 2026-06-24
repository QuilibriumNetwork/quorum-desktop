---
type: doc
title: Client-Side Image Compression & Thumbnail System
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-06-24T00:00:00.000Z
---

# Client-Side Image Compression & Thumbnail System

## Overview

Unified image compression system with smart thumbnail generation for bandwidth optimization. Automatically processes all uploaded images with appropriate compression and generates thumbnails for large images to minimize data usage while preserving quality when needed.

## Architecture

### Core Files

The platform-agnostic config + orchestration now live in **quorum-shared**; desktop keeps only the compressorjs engine and a thin binding that injects it.

```
quorum-shared/src/utils/
├── imageConfig.ts              # Single source of truth: FILE_SIZE_LIMITS, IMAGE_CONFIGS,
│                               #   ImageConfig, ImageConfigType, ImageProcessingOptions (pure, no DOM/native)
└── imageOrchestration.ts       # Platform-agnostic: input validation, GIF/static routing,
                                #   thumbnail decisions; compressor injected via ImagePlatform adapter

src/utils/imageProcessing/      (desktop)
├── compressor.ts               # Compression engine (compressorjs, web)
├── gifUtils.ts                 # GIF frame extraction utilities (canvas)
├── gifProcessor.ts             # Desktop GIF passthrough/validation
├── unifiedProcessor.ts         # Desktop binding: provides the compressorjs ImagePlatform
│                               #   adapter + maps shared error codes to localized (Lingui) messages
├── errors.ts                   # Centralized localized error messages
├── sharedConfig.ts             # Re-exports config from @quilibrium/quorum-shared
├── orchestration.ts            # Re-exports orchestration from @quilibrium/quorum-shared
├── config.ts / types.ts        # Thin re-export shims (back-compat for existing importers)
└── index.ts                    # Public API exports
```

Mobile consumes the same `imageConfig` / `imageOrchestration` from the published shared package and provides its own expo-image-manipulator adapter.

### Integration Points

**Updated Hooks (with compression & thumbnails):**
- `src/hooks/business/messages/useMessageComposer.ts` - Message attachments with dual URLs
- `src/hooks/business/user/useWebFileUpload.ts` - User avatars
- `src/hooks/business/ui/useSpaceFileUploads.ts` - Space icons/banners
- `src/hooks/business/ui/useCustomAssets.ts` - Emojis/stickers with GIF support
- `src/hooks/business/user/useProfileImage.ts` - Legacy avatar uploads
- `src/hooks/business/ui/useFileUpload.ts` - Legacy file uploads

**Enhanced Components:**
- `src/components/message/Message.tsx` - Smart thumbnail/full image display
- `src/components/message/MessageComposer.tsx` - Dual image preview
- `src/components/primitives/FileUpload/FileUpload.web.tsx` - Built-in avatar compression

## Compression Targets & GIF Handling

Canonical dimensions decided 2026-06-24 for cross-platform consistency (sized ~display-size × peak device pixel ratio, capped for storage). Defined once in `quorum-shared/src/utils/imageConfig.ts`.

| Use Case | Input Limit | Static Output | Animated GIF Limit | Display Size |
|----------|-------------|---------------|-------------------|--------------|
| **User Avatars** | 25MB | 256×256px | N/A (static only) | ~40–82px |
| **Space Icons** | 25MB | 256×256px | N/A (static only) | ~82px |
| **Space Banners** | 25MB | 1600×900px bounding box, `cover`-cropped at render | N/A (static only) | wide ~2:1 strip (upload hint: ratio 2:1) |
| **Message Attachments** | 25MB | 300px + 1200px | 2MB (animation preserved) | 300×300px max |
| **Custom Emojis** | 5MB | 96×96px | 100KB (animation preserved) | 24×24px |
| **Custom Stickers** | 25MB | 512px (longest axis) | 750KB (animation preserved) | 300px max width |

> **Space banner note:** `maintainAspectRatio` is used (no hard crop at upload); 1600×900 is a bounding box, not a target shape. Each surface `cover`-crops at render to its own wide ~2:1 strip (desktop channel-list header ~260–300×132, mobile header full-width×180, future discover hero). The upload UI hints "optimal ratio 2:1" to match what is shown.

### Smart Thumbnail System (Message Attachments)

**For Static Images > 300px:**
- **Thumbnail**: 300×300px max for instant display
- **Full Image**: 1200×1200px max for modal view
- **Bandwidth Savings**: ~90% (loads thumbnail first, full image on click)

**For All GIFs (New Approach):**
- **Display**: Always constrained to 300px max width via CSS
- **Modal**: Never opens - GIFs animate in-place only
- **Large GIFs (>500KB)**: Static first frame thumbnail with play button
- **Click Behavior**: Animate full GIF in-place at 300px max width
- **Small GIFs (≤500KB)**: Auto-play directly at 300px max width
- **Bandwidth Savings**: ~90% for large GIFs (thumbnail first)

### GIF Animation Preservation Strategy

- **Message GIFs**: 2MB limit, always animate in-place at 300px max width
- **Sticker GIFs**: 750KB limit, always animate in-place at 300px max width
- **Emoji GIFs**: 100KB limit, perfect for tiny animations
- **Modal Behavior**: GIFs never open in modal - only static images do
- **Smart Processing**: Never convert animated GIFs to static images

## Usage

### Message Attachments with Thumbnails
```typescript
import { processAttachmentImage } from '../../../utils/imageProcessing';

// Process message attachment - returns thumbnail + full image if needed
const result = await processAttachmentImage(file);

if (result.thumbnail) {
  // Large image/GIF - has thumbnail
  const thumbnailBuffer = await result.thumbnail.file.arrayBuffer();
  const fullBuffer = await result.full.file.arrayBuffer();

  const embedMessage: EmbedMessage = {
    type: 'embed',
    thumbnailUrl: `data:${result.thumbnail.file.type};base64,${Buffer.from(thumbnailBuffer).toString('base64')}`,
    imageUrl: `data:${result.full.file.type};base64,${Buffer.from(fullBuffer).toString('base64')}`,
    isLargeGif: result.isLargeGif
  };
} else {
  // Small image - single version
  const buffer = await result.full.file.arrayBuffer();
  const embedMessage: EmbedMessage = {
    type: 'embed',
    imageUrl: `data:${result.full.file.type};base64,${Buffer.from(buffer).toString('base64')}`
  };
}
```

### Unified Configuration-Driven Processing
```typescript
import { processImage, IMAGE_CONFIGS } from '../../../utils/imageProcessing';

// Direct config-based processing (new approach)
const result = await processImage(file, 'emoji');
const stickerResult = await processImage(file, 'sticker');

// Or use convenient type-specific processors
const emojiResult = await processEmojiImage(file);   // 96px, 100KB GIF limit
const stickerResult = await processStickerImage(file); // 512px longest axis, 750KB GIF limit
const avatarResult = await processAvatarImage(file);   // 256px, no GIFs
```

### Error Handling with Centralized Messages
```typescript
import { processImage, IMAGE_ERRORS } from '../../../utils/imageProcessing';

try {
  const result = await processImage(file, 'emoji');
} catch (error) {
  // Standardized error messages for better UX
  if (error.message.includes('100KB')) {
    // Handle emoji GIF size limit
  } else if (error.message.includes('5MB')) {
    // Handle general file size limit
  }
}
```

## File Size Limits

### Input Limits (What Users Can Upload)
- **Static images**: 25MB (automatically compressed)
- **Message GIFs**: 2MB hard limit (animation preserved)
- **Sticker GIFs**: 750KB hard limit (animation preserved)
- **Emoji GIFs**: 100KB hard limit (animation preserved)
- **Emojis (static)**: 5MB (compressed to 96×96px)

### Output Results (After Processing)
- **Static images**: 50KB - 500KB typical range
- **Thumbnails**: 20KB - 100KB typical range
- **Animated GIFs**: Original file size preserved (within limits)
- **Compression ratios**: 5-20x smaller for static images

## Error Handling

### Error Messages
- `"File cannot be larger than 25MB"` - Static image input limit
- `"GIF files cannot be larger than 2MB"` - Message GIF limit
- `"Animated sticker GIFs cannot be larger than 750KB"` - Sticker GIF limit
- `"Animated emoji GIFs cannot be larger than 100KB"` - Emoji GIF limit
- `"Unable to process image. Please use a smaller image."` - Processing failure

### Loading States
- Processing indicators for thumbnail generation
- Progress tracking for dual-image processing
- Specific indicators for GIF frame extraction

## Platform Support

Both platforms share the same `imageConfig` + `imageOrchestration` from quorum-shared; only the compression engine differs (injected via the `ImagePlatform` adapter).

### Web (✅ Implemented)
- Uses **compressorjs** library for static compression
- **Canvas API** for GIF frame extraction
- Handles all formats: JPEG, PNG, GIF, WebP, HEIC
- **PNG transparency**: Preserved for files ≤750KB, converted to JPEG for larger files
- **GIF animation**: Always preserved within size limits

### Mobile (🔜 Pending shared adoption)
- Uses **expo-image-manipulator** for static compression
- Same shared config + orchestration; mobile provides its own `ImagePlatform` adapter
- Blocked on the published shared package + version bump; see the mobile task `quorum-mobile/.agents/tasks/2026-06-24-plug-mobile-into-shared-image-config.md`

## Development Notes

### Adding New Image Types
1. Add configuration to `IMAGE_CONFIGS` in `config.ts`
2. Define compression target (dimensions, ratio, quality)
3. Set GIF size limits and animation preservation settings
4. Export type-specific processor function if needed
5. Update hooks to use new processor

### Configuration System Benefits
- **Single source of truth**: all compression settings live once in `quorum-shared` (`imageConfig.ts`), shared by desktop and mobile
- **Type safety**: TypeScript ensures valid configurations
- **Consistency**: Same logic applied across all image types
- **Maintainability**: Easy to adjust compression targets
- **Error handling**: Centralized, translatable error messages
- **GIF Display Control**: `gifMaxDisplayWidth` setting controls max width across all GIF types

### Testing Thumbnail System
```javascript
// Check thumbnail generation in browser console
const result = await processAttachmentImage(file);
console.log(`Has thumbnail: ${!!result.thumbnail}`);
if (result.thumbnail) {
  console.log(`Thumbnail: ${(result.thumbnail.file.size / 1024).toFixed(2)}KB`);
  console.log(`Full image: ${(result.full.file.size / 1024).toFixed(2)}KB`);
  console.log(`Bandwidth savings: ${((1 - result.thumbnail.file.size / result.full.file.size) * 100).toFixed(1)}%`);
}
```

### Testing GIF Processing
```javascript
// Check GIF handling in browser console
const gifFile = document.querySelector('input[type="file"]').files[0];
console.log(`GIF size: ${(gifFile.size / 1024).toFixed(2)}KB`);
console.log(`Type: ${gifFile.type}`);

// Test processing
const result = await processAttachmentImage(gifFile);
console.log(`Animation preserved: ${!result.thumbnail || result.isLargeGif}`);
```

### Performance Optimizations
- **Configuration-driven processing** - eliminates code duplication
- **Centralized GIF validation** - single validation path for all image types
- **Smart thumbnail generation** - only when needed for large images/GIFs
- **Skip compression** for files already within limits
- **Memory efficient** GIF frame extraction
- **Progressive enhancement** - works without thumbnails for old messages

### Bandwidth Impact
- **90% reduction** for large static images (300px vs 1200px)
- **95%+ reduction** for large GIFs (40KB thumbnail vs 2MB animation)
- **Zero overhead** for small images/GIFs (no unnecessary thumbnails)

---


*Verified: 2026-06-24 — config + orchestration moved to quorum-shared; canonical dimensions updated (avatar 256, space icon 256, emoji 96, sticker 512, banner 1600×900 / ~2:1, message attachment 1200).*
