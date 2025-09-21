/**
 * Unified GIF Processing Utility
 *
 * Centralizes all GIF handling logic including size validation,
 * animation preservation, and thumbnail generation.
 */

import { extractGifFirstFrame } from './gifUtils';
import { ProcessedImage } from './types';
import { IMAGE_ERRORS, formatFileSize } from './errors';
import { ImageConfig } from './config';

/**
 * Validates GIF file size against configuration limits
 */
export const validateGifSize = (file: File, config: ImageConfig): void => {
  if (!config.gifSizeLimit) {
    throw new Error('GIF files are not allowed for this image type');
  }

  if (file.size > config.gifSizeLimit) {
    const maxSize = formatFileSize(config.gifSizeLimit);

    // Use specific error messages based on the size limit
    if (config.gifSizeLimit === 100 * 1024) { // Emoji GIFs
      throw new Error(IMAGE_ERRORS.ANIMATED_EMOJI_GIF_TOO_LARGE());
    } else if (config.gifSizeLimit === 500 * 1024) { // Sticker GIFs
      throw new Error(IMAGE_ERRORS.ANIMATED_STICKER_GIF_TOO_LARGE());
    } else {
      throw new Error(IMAGE_ERRORS.GIF_TOO_LARGE(maxSize));
    }
  }
};

/**
 * Processes GIF files according to configuration
 *
 * @param file - The GIF file to process
 * @param config - Image processing configuration
 * @returns ProcessedImage with original GIF (animation preserved)
 */
export const processGifFile = async (
  file: File,
  config: ImageConfig
): Promise<ProcessedImage> => {
  // Validate GIF size first
  validateGifSize(file, config);

  // For GIFs where we preserve animation, return original file
  if (config.preserveGifAnimation) {
    return {
      file,
      compressionRatio: 1,
      wasCompressed: false,
    };
  }

  // If animation preservation is disabled, extract first frame
  // (This shouldn't happen with current configs, but keeping for completeness)
  const staticImage = await extractGifFirstFrame(file, Math.max(config.maxWidth, config.maxHeight));
  return staticImage;
};

/**
 * Determines if a GIF needs thumbnail generation for message attachments
 */
export const shouldGenerateGifThumbnail = (
  file: File,
  config: ImageConfig
): boolean => {
  if (!config.thumbnailConfig || !config.preserveGifAnimation) {
    return false;
  }

  // Generate thumbnail for GIFs larger than threshold
  return file.size > (config.thumbnailConfig.threshold * 1024);
};

/**
 * Generates static thumbnail for large GIF files
 */
export const generateGifThumbnail = async (
  file: File,
  config: ImageConfig
): Promise<ProcessedImage> => {
  if (!config.thumbnailConfig) {
    throw new Error('Thumbnail configuration not provided');
  }

  const maxSize = Math.max(config.thumbnailConfig.maxWidth, config.thumbnailConfig.maxHeight);
  return extractGifFirstFrame(file, maxSize);
};