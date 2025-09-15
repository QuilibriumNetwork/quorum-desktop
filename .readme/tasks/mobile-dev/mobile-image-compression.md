# Mobile Image Compression Implementation

## Objective
Implement the same client-side image compression system on the React Native/mobile side of the app to match the web implementation (see .readme\tasks\.done\client-side-image-processing.md), ensuring consistent behavior and user experience across platforms.

## Current State Analysis

### ✅ Web Implementation Completed
- **Unified compression system** in `src/utils/imageProcessing/` with specialized processors
- **1.5x display size compression** with optimal dimensions per use case
- **Smart cropping** (16:9 banners, 1:1 avatars) and format conversion (PNG→JPEG)
- **25MB input limits** with automatic compression to optimal sizes
- **All upload scenarios covered**: messages, avatars, space assets, emojis, stickers
- **Error handling and loading states** for compression progress

### 📱 Mobile Current State
- **Basic file upload functionality** exists in `src/components/primitives/FileUpload/FileUpload.native.tsx`
- **Same hooks architecture** as web - shared business logic in `src/hooks/`
- **Platform-specific implementation** only in primitives and platform utilities
- **No image compression** currently implemented for mobile uploads

### 🔄 Shared Infrastructure (Already Cross-Platform)
- **Business logic hooks**: All in `src/hooks/` - fully shared between platforms
- **API layer**: `src/api/` - 100% shared
- **Type definitions**: `src/types/` - 100% shared
- **Compression logic structure**: `src/utils/imageProcessing/` - can be extended for mobile

## Implementation Strategy

### 1. Mobile-Specific Dependencies

**Required React Native Libraries:**
```json
// mobile/package.json additions needed
{
  "expo-image-manipulator": "^11.8.0",  // Primary choice - Expo's optimized solution
  "react-native-image-resizer": "^3.0.7" // Alternative/fallback option
}
```

**Why expo-image-manipulator:**
- ✅ **Optimized for Expo/React Native** with native performance
- ✅ **Consistent API** similar to web Canvas/compressorjs
- ✅ **Built-in format conversion** (PNG→JPEG)
- ✅ **Resize and quality control** with exact dimension support
- ✅ **Maintained by Expo team** - reliable and up-to-date

### 2. Cross-Platform Architecture Extension

**Current Structure (Web-Only):**
```
src/utils/imageProcessing/
├── compressor.ts               # Web-only (compressorjs)
├── processors/                 # Shared logic but calls web compressor
└── types.ts                    # Fully shared
```

**New Cross-Platform Structure:**
```
src/utils/imageProcessing/
├── compressor.native.ts        # 📱 NEW: Native implementation
├── compressor.web.ts           # 🌐 Renamed from compressor.ts
├── compressor.ts               # 🔄 Platform dispatcher
├── processors/                 # ✅ No changes needed - calls platform compressor
├── types.ts                    # ✅ No changes needed
└── index.ts                    # ✅ No changes needed
```

### 3. Platform Dispatcher Pattern

**New `compressor.ts` (Platform Dispatcher):**
```typescript
// Auto-selects correct implementation based on platform
import { compressImage } from './compressor.web';
// On mobile: import { compressImage } from './compressor.native';
export { compressImage };
```

**Benefits:**
- ✅ **Zero changes** to existing processors or hooks
- ✅ **Automatic platform selection** by React Native bundler
- ✅ **Consistent API** across platforms
- ✅ **Easy testing** and development

### 4. Mobile Compression Implementation

**Target: `compressor.native.ts`**
```typescript
import * as ImageManipulator from 'expo-image-manipulator';
import { ImageProcessingOptions, ProcessedImage } from './types';

export const compressImage = async (
  file: File, // React Native file object
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage> => {
  // Mirror web compression logic using expo-image-manipulator
  // Handle GIF preservation, smart PNG→JPEG, dimension limits
  // Return same ProcessedImage interface as web
};
```

**Key Implementation Details:**
- **Same compression ratios** as web (1.5x display size)
- **Same quality settings** (0.8 quality, smart format conversion)
- **Same cropping logic** (16:9 banners, 1:1 avatars)
- **Same file size thresholds** (skip compression for small files)
- **Same error handling** patterns

### 5. FileUpload Primitive Mobile Update

**Current:** `FileUpload.native.tsx` handles file selection but no compression
**Update Needed:** Add same compression logic as web version

```typescript
// In FileUpload.native.tsx - mirror web implementation
if (file.type.startsWith('image/')) {
  try {
    const result = await processAvatarImage(file);
    finalFile = result.file;
  } catch (error) {
    console.warn('Image compression failed, using original file:', error);
  }
}
```

### 6. Platform-Specific Considerations

#### **File Object Differences:**
- **Web**: Standard `File` objects from file input/drag-drop
- **Mobile**: React Native file objects from image picker/camera
- **Solution**: Normalize in mobile compressor to match web interface

#### **Image Picker Integration:**
- **Current**: Basic file selection
- **Enhanced**: Direct camera capture with compression
- **Maintain**: Same `FileUploadFile` interface output

#### **Performance Optimization:**
- **Native processing** faster than web for large images
- **Memory management** - dispose of intermediate images
- **Background processing** for better UX

### 7. Testing Strategy

#### **Cross-Platform Consistency:**
1. **Upload same test images** on web and mobile
2. **Verify identical compression results** (dimensions, quality, file size)
3. **Test all image formats** (PNG, JPEG, GIF, HEIC)
4. **Validate error handling** matches between platforms

#### **Mobile-Specific Testing:**
1. **Camera capture** with immediate compression
2. **Large image handling** (25MB inputs)
3. **Memory usage** during compression
4. **Performance** on older devices

#### **Regression Testing:**
1. **All existing upload workflows** continue working
2. **Hook compatibility** unchanged
3. **File size limits** properly enforced
4. **Error messages** consistent

### 8. Implementation Order

1. **📱 Add mobile dependencies** (`expo-image-manipulator`)
2. **🔄 Refactor web compressor** to `compressor.web.ts`
3. **🆕 Implement** `compressor.native.ts` with same API
4. **🔄 Create platform dispatcher** `compressor.ts`
5. **📱 Update** `FileUpload.native.tsx` with compression
6. **🧪 Test cross-platform consistency**
7. **📚 Update documentation** and mobile-specific notes

### 9. File Size and Compression Targets (Mobile)

**Same as Web Implementation:**
| Use Case | Input Limit | Compressed Output | Display Size |
|----------|-------------|-------------------|--------------|
| **User Avatars** | 25MB | 123×123px (1:1 crop) | 82×82px |
| **Space Icons** | 25MB | 123×123px (1:1 crop) | 82×82px |
| **Space Banners** | 25MB | 450×253px (16:9 crop) | 300×120px |
| **Message Attachments** | 25MB | 1200px max (ratio) | 140×140px preview |
| **Custom Emojis** | 5MB | 36×36px (1:1 crop) | 24×24px |
| **Custom Stickers** | 25MB | 450×450px (ratio) | 300×300px max |

**Mobile-Specific Enhancements:**
- **HEIC support** (iOS camera format) with conversion
- **Camera integration** with instant compression
- **Better memory management** for large images

### 10. Success Metrics

- **✅ Identical compression results** between web and mobile (±5% file size variance acceptable)
- **✅ Performance** - mobile compression completes in <3 seconds for 25MB files
- **✅ Memory efficiency** - no crashes on large image processing
- **✅ User experience** - seamless upload workflow unchanged
- **✅ Format support** - JPEG, PNG, GIF, HEIC all handled correctly

### 11. Dependencies and Prerequisites

#### **Mobile Development Environment:**
- **Expo CLI** installed and working
- **React Native debugger** for testing
- **Physical devices** for camera/performance testing

#### **Shared Code Dependencies:**
- ✅ Web implementation completed and tested
- ✅ Cross-platform hook architecture in place
- ✅ TypeScript interfaces defined in `types.ts`

### 12. Future Mobile Enhancements (Out of Scope)

- **Advanced camera controls** (zoom, focus, flash)
- **Multiple image selection** with batch compression
- **Real-time camera filters** before capture
- **Cloud compression offloading** for very large files

---

## Implementation Notes

### **Maintaining Cross-Platform Consistency:**
- **Same compression algorithms** and quality settings
- **Identical file size limits** and error messages
- **Consistent user experience** across platforms
- **Shared business logic** in hooks layer

### **Mobile-First Considerations:**
- **Camera integration** as primary upload method
- **Touch-optimized** file selection UI
- **Memory-conscious** processing for mobile constraints
- **Native performance** optimization

This implementation will complete the full cross-platform image compression system, ensuring users get the same powerful image upload experience whether they're using the web app or mobile app.

---
*Created: 2025-09-15 - Mobile image compression implementation plan based on completed web implementation*