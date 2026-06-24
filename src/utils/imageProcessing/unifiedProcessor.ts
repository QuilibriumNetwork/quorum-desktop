/**
 * Unified Image Processor (desktop).
 *
 * Thin desktop binding over the platform-agnostic orchestration in
 * `orchestration.ts`. This file provides the desktop `ImagePlatform` adapter
 * (compressorjs + canvas) and maps the orchestrator's typed error codes back to
 * the existing localized messages, so the public API and behavior are unchanged.
 */

import { compressImage } from './compressor';
import { getImageDimensions } from './gifUtils';
import { processGifFile, shouldGenerateGifThumbnail, generateGifThumbnail } from './gifProcessor';
import { ProcessedImage } from './types';
import { ImageConfigType, ImageConfig } from './config';
import { IMAGE_ERRORS, formatFileSize } from './errors';
import {
  ImagePlatform,
  ImageProcessingError,
  processImageWithConfig,
  processAttachmentWithConfig,
  AttachmentResult,
} from './orchestration';

/**
 * Result from processing message attachments with optional thumbnail.
 * (Only used for message attachments with thumbnail support.)
 */
export type AttachmentProcessingResult = AttachmentResult<ProcessedImage>;

/**
 * Desktop platform adapter: compressorjs for static images, canvas for GIF
 * dimensions, and the existing GIF passthrough.
 */
const desktopPlatform: ImagePlatform<File, ProcessedImage> = {
  compress: (file, opts) => compressImage(file, opts),
  passthroughGif: (file, config) => processGifFile(file, config),
  getDimensions: (file) => getImageDimensions(file),
};

/** Map orchestrator error codes to the existing localized messages. */
function toLocalizedError(error: unknown): Error {
  if (error instanceof ImageProcessingError) {
    switch (error.code) {
      case 'FILE_TOO_LARGE':
        return new Error(IMAGE_ERRORS.FILE_TOO_LARGE(formatFileSize(error.limitBytes ?? 0)));
      case 'EMOJI_COMPRESSION_FAILED':
        return new Error(IMAGE_ERRORS.EMOJI_COMPRESSION_FAILED());
      case 'STICKER_COMPRESSION_FAILED':
        return new Error(IMAGE_ERRORS.STICKER_COMPRESSION_FAILED());
      case 'GIF_TOO_LARGE':
      case 'COMPRESSION_FAILED':
      default:
        return new Error(IMAGE_ERRORS.COMPRESSION_FAILED());
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Main unified image processor.
 *
 * @param file - Image file to process
 * @param type - Configuration type (avatar, emoji, sticker, etc.)
 * @returns ProcessedImage for single-image types
 */
export const processImage = async (
  file: File,
  type: ImageConfigType,
): Promise<ProcessedImage> => {
  try {
    return await processImageWithConfig(file, type, desktopPlatform);
  } catch (error) {
    throw toLocalizedError(error);
  }
};

/**
 * Specialized processor for message attachments with thumbnail support.
 *
 * @param file - Image file to process
 * @returns AttachmentProcessingResult with optional thumbnail
 */
export const processAttachmentImage = async (
  file: File,
): Promise<AttachmentProcessingResult> => {
  // GIF poster-frame extraction is desktop-specific (canvas); inject it.
  const generateThumb = (f: File, config: ImageConfig): Promise<ProcessedImage> =>
    // `generateGifThumbnail` already encapsulates the canvas extraction; the
    // shared layer only decides *whether* to call it via shouldGenerateGifThumbnail.
    generateGifThumbnail(f, config);

  try {
    return await processAttachmentWithConfig(file, desktopPlatform, generateThumb);
  } catch (error) {
    throw toLocalizedError(error);
  }
};

// Re-export so existing imports of this symbol from unifiedProcessor keep working.
export { shouldGenerateGifThumbnail };

// Export convenient type-specific processors
export const processAvatarImage = (file: File) => processImage(file, 'avatar');
export const processBannerImage = (file: File) => processImage(file, 'spaceBanner');
export const processEmojiImage = (file: File) => processImage(file, 'emoji');
export const processStickerImage = (file: File) => processImage(file, 'sticker');
