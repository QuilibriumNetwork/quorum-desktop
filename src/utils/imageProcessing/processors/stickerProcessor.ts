import { compressImage } from '../compressor';
import { ImageProcessor } from '../types';

/**
 * Process custom sticker images
 * Target: 450×450px (1.5x message display size for crisp rendering)
 * Message display: 300x300px max, preview: 72x72px
 * Use case: Custom stickers
 */
export const processStickerImage: ImageProcessor = async (file: File) => {
  return compressImage(file, {
    maxWidth: 450,
    maxHeight: 450,
    quality: 0.8,
    maintainAspectRatio: true, // Keep aspect ratio for stickers
    skipCompressionThreshold: 100000, // 100KB
  });
};