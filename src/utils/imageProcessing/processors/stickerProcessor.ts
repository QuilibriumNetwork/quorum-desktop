import { compressImage } from '../compressor';
import { ImageProcessor } from '../types';
import { FILE_SIZE_LIMITS } from '../index';

/**
 * Process custom sticker images
 * Target: 450×450px for static images (1.5x message display size for crisp rendering)
 * Message display: 300x300px max, preview: 72x72px
 * Use case: Custom stickers
 * Supports animated GIFs up to 500KB (optimized for sticker use)
 */
export const processStickerImage: ImageProcessor = async (file: File) => {
  // Apply 500KB limit for animated GIF stickers (smaller than message attachments)
  if (file.type === 'image/gif' && file.size > FILE_SIZE_LIMITS.GIF_THUMBNAIL_THRESHOLD) {
    throw new Error('Animated sticker GIFs cannot be larger than 500KB. Please optimize your GIF for sticker use.');
  }

  // For animated GIFs, preserve animation by skipping dimensional compression
  if (file.type === 'image/gif') {
    return {
      file,
      compressionRatio: 1,
      wasCompressed: false,
    };
  }

  // For static images (PNG, JPG), apply dimensional compression
  return compressImage(file, {
    maxWidth: 450,
    maxHeight: 450,
    quality: 0.8,
    maintainAspectRatio: true, // Keep aspect ratio for stickers
    skipCompressionThreshold: 100000, // 100KB
  });
};