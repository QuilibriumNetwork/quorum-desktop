import { compressImage } from '../compressor';
import { ImageProcessor } from '../types';

/**
 * Process custom emoji images
 * Target: 36×36px (1.5x display size for crisp rendering)
 * Display: 24×24px
 * Use case: Custom emojis
 */
export const processEmojiImage: ImageProcessor = async (file: File) => {
  return compressImage(file, {
    maxWidth: 36,
    maxHeight: 36,
    quality: 0.8,
    cropToFit: true, // Square crop for emojis
    skipCompressionThreshold: 50000, // 50KB (emojis should be small)
  });
};