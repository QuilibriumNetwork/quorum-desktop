/**
 * Unified Image Processor
 *
 * Replaces the 6 specialized processor files with a single configuration-driven
 * approach. Handles all image types (avatars, banners, attachments, emojis, stickers)
 * with consistent logic and centralized error handling.
 */

import { compressImage } from './compressor';
import { getImageDimensions } from './gifUtils';
import { processGifFile, shouldGenerateGifThumbnail, generateGifThumbnail } from './gifProcessor';
import { ProcessedImage } from './types';
import { IMAGE_CONFIGS, ImageConfigType, ImageConfig, FILE_SIZE_LIMITS } from './config';
import { IMAGE_ERRORS, formatFileSize } from './errors';

/**
 * Result from processing message attachments with optional thumbnail
 * (Only used for message attachments with thumbnail support)
 */
export interface AttachmentProcessingResult {
  thumbnail?: ProcessedImage;
  full: ProcessedImage;
  isLargeGif?: boolean;
}

/**
 * Validates input file size against general limits
 */
const validateInputFileSize = (file: File, config: ImageConfig): void => {
  let maxInputSize: number;

  // Determine appropriate input size limit based on image type
  if (config === IMAGE_CONFIGS.emoji) {
    maxInputSize = FILE_SIZE_LIMITS.MAX_EMOJI_INPUT_SIZE; // 5MB for emojis
  } else {
    maxInputSize = FILE_SIZE_LIMITS.MAX_INPUT_SIZE; // 25MB for everything else
  }

  if (file.size > maxInputSize) {
    const maxSize = formatFileSize(maxInputSize);
    throw new Error(IMAGE_ERRORS.FILE_TOO_LARGE(maxSize));
  }
};

/**
 * Main unified image processor
 *
 * @param file - Image file to process
 * @param type - Configuration type (avatar, emoji, sticker, etc.)
 * @returns ProcessedImage for single-image types
 */
export const processImage = async (
  file: File,
  type: ImageConfigType
): Promise<ProcessedImage> => {
  const config = IMAGE_CONFIGS[type];

  // Validate input file size
  validateInputFileSize(file, config);

  // Handle GIFs specially
  if (file.type === 'image/gif') {
    return processGifFile(file, config);
  }

  // Process static images (PNG, JPG, WebP, etc.)
  try {
    return await compressImage(file, {
      maxWidth: config.maxWidth,
      maxHeight: config.maxHeight,
      quality: config.quality,
      cropToFit: config.cropToFit,
      maintainAspectRatio: config.maintainAspectRatio,
      skipCompressionThreshold: config.skipCompressionThreshold,
    });
  } catch (error) {
    // Provide specific error messages based on image type
    if (config === IMAGE_CONFIGS.emoji) {
      throw new Error(IMAGE_ERRORS.EMOJI_COMPRESSION_FAILED());
    } else if (config === IMAGE_CONFIGS.sticker) {
      throw new Error(IMAGE_ERRORS.STICKER_COMPRESSION_FAILED());
    } else {
      throw new Error(IMAGE_ERRORS.COMPRESSION_FAILED());
    }
  }
};

/**
 * Specialized processor for message attachments with thumbnail support
 *
 * @param file - Image file to process
 * @returns AttachmentProcessingResult with optional thumbnail
 */
export const processAttachmentImage = async (
  file: File
): Promise<AttachmentProcessingResult> => {
  const config = IMAGE_CONFIGS.messageAttachment;

  // Validate input file size
  validateInputFileSize(file, config);

  // Handle GIFs with thumbnail generation
  if (file.type === 'image/gif') {
    if (shouldGenerateGifThumbnail(file, config)) {
      const thumbnail = await generateGifThumbnail(file, config);
      const full = await processGifFile(file, config);

      return {
        thumbnail,
        full,
        isLargeGif: true,
      };
    } else {
      // Small GIF - no thumbnail needed
      const full = await processGifFile(file, config);
      return { full };
    }
  }

  // Handle static images with thumbnail generation
  const dimensions = await getImageDimensions(file);

  if (config.thumbnailConfig &&
      (dimensions.width > config.thumbnailConfig.threshold ||
       dimensions.height > config.thumbnailConfig.threshold)) {

    // Generate both thumbnail and full image
    const [thumbnail, full] = await Promise.all([
      compressImage(file, {
        maxWidth: config.thumbnailConfig.maxWidth,
        maxHeight: config.thumbnailConfig.maxHeight,
        quality: config.thumbnailConfig.quality,
        maintainAspectRatio: true,
        skipCompressionThreshold: config.skipCompressionThreshold,
      }),
      compressImage(file, {
        maxWidth: config.maxWidth,
        maxHeight: config.maxHeight,
        quality: config.quality,
        maintainAspectRatio: true,
        skipCompressionThreshold: config.skipCompressionThreshold,
      }),
    ]);

    return { thumbnail, full };
  }

  // Small image - single version only
  const full = await compressImage(file, {
    maxWidth: config.maxWidth,
    maxHeight: config.maxHeight,
    quality: config.quality,
    maintainAspectRatio: true,
    skipCompressionThreshold: config.skipCompressionThreshold,
  });

  return { full };
};

// Export convenient type-specific processors
export const processAvatarImage = (file: File) => processImage(file, 'avatar');
export const processBannerImage = (file: File) => processImage(file, 'spaceBanner');
export const processEmojiImage = (file: File) => processImage(file, 'emoji');
export const processStickerImage = (file: File) => processImage(file, 'sticker');