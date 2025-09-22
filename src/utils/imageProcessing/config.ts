/**
 * Unified Image Processing Configuration
 *
 * Centralizes all image processing settings, compression targets,
 * and file size limits in a single configuration-driven system.
 */

/**
 * File size limits (input limits before compression)
 */
export const FILE_SIZE_LIMITS = {
  // Input limits - what users can upload
  MAX_INPUT_SIZE: 25 * 1024 * 1024, // 25MB for static images (will be compressed)
  MAX_GIF_SIZE: 2 * 1024 * 1024, // 2MB hard limit for GIFs (storage efficiency)
  MAX_EMOJI_INPUT_SIZE: 5 * 1024 * 1024, // 5MB for emojis

  // Processing thresholds
  GIF_THUMBNAIL_THRESHOLD: 500 * 1024, // 500KB - show thumbnail for GIFs above this
  MAX_STICKER_GIF_SIZE: 750 * 1024, // 750KB - animated sticker GIFs (displayed at 300px max)
  MAX_EMOJI_GIF_SIZE: 100 * 1024, // 100KB - animated emoji GIFs (displayed at 24x24px)

  // Legacy limits (for reference)
  LEGACY_MESSAGE_LIMIT: 2 * 1024 * 1024, // 2MB
  LEGACY_AVATAR_LIMIT: 2 * 1024 * 1024,  // 2MB
  LEGACY_SPACE_ASSET_LIMIT: 1 * 1024 * 1024, // 1MB
  LEGACY_EMOJI_LIMIT: 256 * 1024, // 256KB
} as const;

/**
 * Image processing configuration for different use cases
 */
export interface ImageConfig {
  // Output dimensions
  maxWidth: number;
  maxHeight: number;
  quality: number;

  // Aspect ratio handling
  cropToFit?: boolean;
  maintainAspectRatio?: boolean;

  // Compression settings
  skipCompressionThreshold: number;

  // GIF handling
  gifSizeLimit?: number | null; // null means no GIFs allowed
  preserveGifAnimation?: boolean;
  gifMaxDisplayWidth?: number; // CSS max-width for GIF display (300px)

  // Thumbnail generation (for dual-image scenarios)
  thumbnailConfig?: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
    threshold: number; // Generate thumbnail if original is larger than this
  };
}

/**
 * Configuration for different image types
 */
export const IMAGE_CONFIGS = {
  /**
   * User avatars - Square crop, no GIFs
   * Target: 123×123px for crisp 82×82px display
   */
  avatar: {
    maxWidth: 123,
    maxHeight: 123,
    quality: 0.8,
    cropToFit: true,
    skipCompressionThreshold: 50 * 1024, // 50KB
    gifSizeLimit: null, // No GIFs allowed
  } as ImageConfig,

  /**
   * Space icons - Square crop, no GIFs
   * Target: 123×123px for crisp 82×82px display
   */
  spaceIcon: {
    maxWidth: 123,
    maxHeight: 123,
    quality: 0.8,
    cropToFit: true,
    skipCompressionThreshold: 50 * 1024, // 50KB
    gifSizeLimit: null, // No GIFs allowed
  } as ImageConfig,

  /**
   * Space banners - 16:9 aspect ratio, no GIFs
   * Target: 450×253px for crisp 300×120px display
   */
  spaceBanner: {
    maxWidth: 450,
    maxHeight: 253,
    quality: 0.8,
    maintainAspectRatio: true,
    skipCompressionThreshold: 100 * 1024, // 100KB
    gifSizeLimit: null, // No GIFs allowed
  } as ImageConfig,

  /**
   * Message attachments - Smart thumbnail system for large GIFs
   * All GIFs constrained to 300px max width via CSS
   * Large GIFs (>500KB): static thumbnail + animate on click
   */
  messageAttachment: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.8,
    maintainAspectRatio: true,
    skipCompressionThreshold: 100 * 1024, // 100KB
    gifSizeLimit: FILE_SIZE_LIMITS.MAX_GIF_SIZE,
    preserveGifAnimation: true,
    gifMaxDisplayWidth: 300, // All GIFs constrained to 300px via CSS
    thumbnailConfig: {
      maxWidth: 300,
      maxHeight: 300,
      quality: 0.8,
      threshold: 300, // Generate thumbnail for images > 300px
    },
  } as ImageConfig,

  /**
   * Custom emojis - Tiny display, preserve small GIFs
   * Target: 36×36px for crisp 24×24px display
   * GIFs: 100KB limit, perfect for tiny animations
   */
  emoji: {
    maxWidth: 36,
    maxHeight: 36,
    quality: 0.8,
    cropToFit: true,
    skipCompressionThreshold: 50 * 1024, // 50KB
    gifSizeLimit: FILE_SIZE_LIMITS.MAX_EMOJI_GIF_SIZE,
    preserveGifAnimation: true,
  } as ImageConfig,

  /**
   * Custom stickers - Compressed to 400px max width, displayed at 300px
   * GIFs: 750KB limit, always animate but display at 300px max width
   */
  sticker: {
    maxWidth: 400,
    maxHeight: 600, // Max height limit to prevent overly tall stickers
    quality: 0.8,
    maintainAspectRatio: true,
    skipCompressionThreshold: 100 * 1024, // 100KB
    gifSizeLimit: FILE_SIZE_LIMITS.MAX_STICKER_GIF_SIZE,
    preserveGifAnimation: true,
    gifMaxDisplayWidth: 300, // Display at 300px max width
  } as ImageConfig,
} as const;

/**
 * Type-safe keys for image configurations
 */
export type ImageConfigType = keyof typeof IMAGE_CONFIGS;

/**
 * Helper to get configuration for a specific image type
 */
export const getImageConfig = (type: ImageConfigType): ImageConfig => {
  return IMAGE_CONFIGS[type];
};