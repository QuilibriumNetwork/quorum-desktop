import { compressImage } from '../compressor';
import { ImageProcessor } from '../types';

/**
 * Process message attachment images
 * Target: 1200px max dimension (for modal viewing)
 * Use case: Message attachments
 */
export const processAttachmentImage: ImageProcessor = async (file: File) => {
  return compressImage(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.8,
    maintainAspectRatio: true, // Keep original aspect ratio
    skipCompressionThreshold: 100000, // 100KB
  });
};