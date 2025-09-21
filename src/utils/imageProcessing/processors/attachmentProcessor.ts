import { compressImage } from '../compressor';
import { ProcessedImage } from '../types';
import { extractGifFirstFrame, getImageDimensions } from '../gifUtils';
import { FILE_SIZE_LIMITS } from '../index';

/**
 * Result from processing message attachments with optional thumbnail
 */
export interface AttachmentProcessingResult {
  thumbnail?: ProcessedImage;
  full: ProcessedImage;
  isLargeGif?: boolean;
}

/**
 * Process message attachment images with smart thumbnail generation
 * - Static images > 300px: Generate 300px thumbnail + 1200px full
 * - GIFs > 500KB: Generate static first frame + keep original
 * - Everything else: Single version only
 */
export const processAttachmentImage = async (
  file: File
): Promise<AttachmentProcessingResult> => {
  // Handle GIFs > 500KB with static thumbnail
  if (file.type === 'image/gif' && file.size > FILE_SIZE_LIMITS.GIF_THUMBNAIL_THRESHOLD) {
    const thumbnail = await extractGifFirstFrame(file, 300);

    let full: ProcessedImage;

    // Handle GIF size limits - hard 2MB limit for storage efficiency
    if (file.size > FILE_SIZE_LIMITS.MAX_GIF_SIZE) {
      // Hard limit for GIF storage
      throw new Error('GIF files cannot be larger than 2MB. Please use a smaller GIF.');
    } else {
      // Keep original GIF if under 2MB
      full = {
        file,
        compressionRatio: 1,
        wasCompressed: false,
      };
    }

    return {
      thumbnail,
      full,
      isLargeGif: true,
    };
  }

  // Handle static images > 300px with thumbnail
  if (file.type !== 'image/gif') {
    const dimensions = await getImageDimensions(file);

    if (dimensions.width > 300 || dimensions.height > 300) {
      const [thumbnail, full] = await Promise.all([
        compressImage(file, {
          maxWidth: 300,
          maxHeight: 300,
          quality: 0.8,
          maintainAspectRatio: true,
          skipCompressionThreshold: 50000, // 50KB
        }),
        compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.8,
          maintainAspectRatio: true,
          skipCompressionThreshold: 100000, // 100KB
        }),
      ]);

      return {
        thumbnail,
        full,
      };
    }
  }

  // Everything else: single version (small images, small GIFs)
  const full = await compressImage(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.8,
    maintainAspectRatio: true,
    skipCompressionThreshold: 100000, // 100KB
  });

  return {
    full,
  };
};