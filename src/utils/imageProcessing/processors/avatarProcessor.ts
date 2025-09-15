import { compressImage } from '../compressor';
import { ImageProcessor } from '../types';

/**
 * Process avatar images
 * Target: 123×123px (1.5x display size for crisp rendering)
 * Display: 82px desktop, 70px mobile
 * Use case: User avatars, space icons
 */
export const processAvatarImage: ImageProcessor = async (file: File) => {
  return compressImage(file, {
    maxWidth: 123,
    maxHeight: 123,
    quality: 0.8,
    cropToFit: true, // Square crop for avatars
    skipCompressionThreshold: 100000, // 100KB
  });
};