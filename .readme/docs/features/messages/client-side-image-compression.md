# Client-Side Image Compression

## Overview

Unified image compression system that automatically optimizes all uploaded images to appropriate sizes and formats. Users can upload images up to 25MB which are automatically compressed client-side to optimal dimensions for each use case.

## Architecture

### Core Files

```
src/utils/imageProcessing/
├── compressor.ts               # Main compression engine (web)
├── types.ts                    # Shared interfaces
├── index.ts                    # Public API exports
└── processors/                 # Specialized processors per use case
    ├── avatarProcessor.ts      # User/space avatars (1:1 ratio)
    ├── bannerProcessor.ts      # Space banners (16:9 ratio)
    ├── attachmentProcessor.ts  # Message attachments (preserve ratio)
    ├── emojiProcessor.ts       # Custom emojis (1:1 ratio)
    └── stickerProcessor.ts     # Custom stickers (preserve ratio)
```

### Integration Points

**Updated Hooks (with compression):**
- `src/hooks/business/messages/useMessageComposer.ts` - Message attachments
- `src/hooks/business/user/useWebFileUpload.ts` - User avatars
- `src/hooks/business/ui/useSpaceFileUploads.ts` - Space icons/banners
- `src/hooks/business/ui/useCustomAssets.ts` - Emojis/stickers
- `src/hooks/business/user/useProfileImage.ts` - Legacy avatar uploads
- `src/hooks/business/ui/useFileUpload.ts` - Legacy file uploads

**Enhanced Primitives:**
- `src/components/primitives/FileUpload/FileUpload.web.tsx` - Built-in avatar compression

## Compression Targets

| Use Case | Input Limit | Compressed Output | Display Size | Ratio |
|----------|-------------|-------------------|--------------|-------|
| **User Avatars** | 25MB | 123×123px | 82×82px | 1:1 crop |
| **Space Icons** | 25MB | 123×123px | 82×82px | 1:1 crop |
| **Space Banners** | 25MB | 450×253px | 300×120px | 16:9 crop |
| **Message Attachments** | 25MB | 1200px max | 140×140px preview | Preserve ratio |
| **Custom Emojis** | 5MB | 36×36px | 24×24px | 1:1 crop |
| **Custom Stickers** | 25MB | 450×450px | 300×300px max | Preserve ratio |

### Compression Strategy

- **1.5x display size** for crisp rendering without excessive file sizes
- **0.8 quality** for optimal size/quality balance
- **Smart format conversion** - PNG files >750KB → JPEG (preserves transparency for smaller graphics)
- **GIF preservation** - animated GIFs skip compression
- **Cropping vs fitting** - avatars/banners crop to exact ratios, others preserve aspect ratio

## Usage

### Basic Usage
```typescript
import { processAvatarImage, processBannerImage } from '../../../utils/imageProcessing';

// Process avatar with 1:1 cropping
const result = await processAvatarImage(file);
const compressedFile = result.file;
const compressionRatio = result.compressionRatio; // e.g., 5.2x smaller

// Process banner with 16:9 cropping
const bannerResult = await processBannerImage(file);
```

### Hook Integration Example
```typescript
// In upload hooks - replace direct file.arrayBuffer() calls
useEffect(() => {
  if (currentFile) {
    (async () => {
      try {
        const result = await processAvatarImage(currentFile);
        const arrayBuffer = await result.file.arrayBuffer();
        setFileData(arrayBuffer);
        setFileError(null);
      } catch (error) {
        setFileError('Unable to compress image. Please use a smaller image.');
      }
    })();
  }
}, [currentFile]);
```

## File Size Limits

### Input Limits (What Users Can Upload)
- **Most images**: 25MB
- **Emojis**: 5MB (smaller due to tiny display size)

### Output Results (After Compression)
- **Typical range**: 50KB - 500KB for most images
- **Compression ratios**: Usually 5-20x smaller than input
- **Quality**: Visually identical at display sizes

## Error Handling

### Error Messages
- `"File cannot be larger than 25MB"` - Input size limit
- `"Unable to compress image. Please use a smaller image."` - Compression failure

### Loading States
- Processing indicators for multi-file uploads (emojis/stickers)
- Progress tracking for compression >3 seconds

## Platform Support

### Web (✅ Implemented)
- Uses **compressorjs** library
- Handles all formats: JPEG, PNG, GIF, WebP, HEIC
- **PNG transparency**: Preserved for files ≤750KB, converted to JPEG for larger files

### Mobile (📱 Planned)
- Will use **expo-image-manipulator**
- Same compression targets and behavior
- See: `.readme/tasks/mobile-dev/mobile-image-compression.md`

## Development Notes

### Adding New Image Types
1. Create processor in `processors/` directory
2. Define compression target (dimensions, ratio, quality)
3. Update hook to use new processor
4. Update file size constants if needed

### Testing Compression
```javascript
// Check compression in browser console
console.log(`Original: ${(originalFile.size / 1024 / 1024).toFixed(2)}MB`);
console.log(`Compressed: ${(result.file.size / 1024 / 1024).toFixed(2)}MB`);
console.log(`Ratio: ${result.compressionRatio.toFixed(2)}x smaller`);
```

### Performance
- **Single-pass compression** for speed
- **Skip compression** for files <100KB already within dimensions
- **Memory efficient** - no intermediate canvas operations

---
*Updated: 2025-09-15 - Documentation for completed web implementation*