import { compressImage } from '../compressor';
import { ImageProcessor } from '../types';
import { FILE_SIZE_LIMITS } from '../index';

/**
 * Process custom emoji images
 * Target: 36×36px for static images (1.5x display size for crisp rendering)
 * Display: 24×24px
 * Use case: Custom emojis
 * Supports animated GIFs up to 100KB (optimized for tiny emoji animations)
 */
export const processEmojiImage: ImageProcessor = async (file: File) => {
  // Apply 100KB limit for animated GIF emojis (perfect for 24x24px display)
  if (file.type === 'image/gif' && file.size > FILE_SIZE_LIMITS.MAX_EMOJI_GIF_SIZE) {
    throw new Error('Animated emoji GIFs cannot be larger than 100KB. Please optimize your GIF for emoji use.');
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
    maxWidth: 36,
    maxHeight: 36,
    quality: 0.8,
    cropToFit: true, // Square crop for emojis
    skipCompressionThreshold: 50000, // 50KB (emojis should be small)
  });
};