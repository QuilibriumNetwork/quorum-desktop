/**
 * Image Processing Utilities
 *
 * Unified system for client-side image compression across all upload scenarios.
 * Extends existing compressorjs infrastructure with standardized processors.
 */

// Core compression utilities
export { compressImage } from './compressor';

// Unified processing system
export {
  processImage,
  processAvatarImage,
  processBannerImage,
  processAttachmentImage,
  processEmojiImage,
  processStickerImage
} from './unifiedProcessor';

// Configuration system
export { IMAGE_CONFIGS, getImageConfig, FILE_SIZE_LIMITS } from './config';
export type { ImageConfig, ImageConfigType } from './config';

// Error handling
export { IMAGE_ERRORS, formatFileSize } from './errors';

// GIF utilities
export { extractGifFirstFrame, getImageDimensions } from './gifUtils';

// Types
export type { ImageProcessingOptions, ProcessedImage, ImageProcessor } from './types';
export type { AttachmentProcessingResult } from './unifiedProcessor';


