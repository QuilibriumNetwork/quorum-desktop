/**
 * Image Processing Utilities
 *
 * Unified system for client-side image compression across all upload scenarios.
 * Extends existing compressorjs infrastructure with standardized processors.
 */

// Core compression utilities
export { compressImage } from './compressor';

// Specialized processors
export { processAvatarImage } from './processors/avatarProcessor';
export { processBannerImage } from './processors/bannerProcessor';
export { processAttachmentImage } from './processors/attachmentProcessor';
export { processEmojiImage } from './processors/emojiProcessor';
export { processStickerImage } from './processors/stickerProcessor';

// Types
export type { ImageProcessingOptions, ProcessedImage, ImageProcessor } from './types';

/**
 * File size limits (input limits before compression)
 */
export const FILE_SIZE_LIMITS = {
  // Input limits - what users can upload
  MAX_INPUT_SIZE: 25 * 1024 * 1024, // 25MB for most images
  MAX_EMOJI_INPUT_SIZE: 5 * 1024 * 1024, // 5MB for emojis

  // Legacy limits (for reference)
  LEGACY_MESSAGE_LIMIT: 2 * 1024 * 1024, // 2MB
  LEGACY_AVATAR_LIMIT: 2 * 1024 * 1024,  // 2MB
  LEGACY_SPACE_ASSET_LIMIT: 1 * 1024 * 1024, // 1MB
  LEGACY_EMOJI_LIMIT: 256 * 1024, // 256KB
} as const;

/**
 * Compression progress helper for showing loading states
 * Shows spinner if compression takes longer than 3 seconds
 */
export class CompressionProgressTracker {
  private timeoutId: number | null = null;
  private onShowProgress: (() => void) | null = null;
  private onHideProgress: (() => void) | null = null;

  constructor(
    onShowProgress: () => void,
    onHideProgress: () => void
  ) {
    this.onShowProgress = onShowProgress;
    this.onHideProgress = onHideProgress;
  }

  start() {
    // Show progress indicator after 3 seconds
    this.timeoutId = window.setTimeout(() => {
      this.onShowProgress?.();
    }, 3000);
  }

  finish() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.onHideProgress?.();
  }
}