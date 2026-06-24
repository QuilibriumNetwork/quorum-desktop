/**
 * Shared image-processing configuration (platform-agnostic).
 *
 * This module is intentionally PURE: no DOM, no native, no platform imports.
 * It is the single source of truth for image limits/targets across desktop
 * and mobile, and is staged to move verbatim into
 * `quorum-shared/src/utils/imageConfig.ts`. Keep it import-free so it builds
 * cleanly for both the web and React Native bundles.
 *
 * Canonical dimensions decided 2026-06-24 (desktop + mobile consistency):
 *   avatar 256, space icon 256, emoji 96, sticker 512 (longest axis),
 *   space banner 1600x900 (16:9, cropped at render), message attachment 1200.
 */

/**
 * File size limits (input limits before compression).
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
  LEGACY_AVATAR_LIMIT: 2 * 1024 * 1024, // 2MB
  LEGACY_SPACE_ASSET_LIMIT: 1 * 1024 * 1024, // 1MB
  LEGACY_EMOJI_LIMIT: 256 * 1024, // 256KB
} as const;

/**
 * Image processing configuration for a single use case.
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
 * Options accepted by a platform compressor implementation.
 * All primitive — safe to share across platforms.
 */
export interface ImageProcessingOptions {
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Compression quality (0-1) */
  quality?: number;
  /** Whether to maintain aspect ratio when resizing */
  maintainAspectRatio?: boolean;
  /** Whether to crop to exact dimensions or fit within bounds */
  cropToFit?: boolean;
  /** Skip compression for files smaller than this size (bytes) */
  skipCompressionThreshold?: number;
  /** Force compression of GIFs (they are normally skipped to preserve animation) */
  forceGifCompression?: boolean;
}

/**
 * Per-surface image configurations.
 *
 * Dimensions are sized as ~display-size x peak-device-pixel-ratio, capped for
 * storage, so one source is crisp on the densest mobile screen and on desktop
 * retina. See task 2026-06-24-share-image-compression-config-with-shared.md.
 */
export const IMAGE_CONFIGS = {
  /**
   * User avatars - square crop, no GIFs.
   * 256x256 source (was desktop 123 / mobile 512). Display ~40-82px; 82 x 3 DPR ~= 246 -> 256.
   */
  avatar: {
    maxWidth: 256,
    maxHeight: 256,
    quality: 0.8,
    cropToFit: true,
    skipCompressionThreshold: 50 * 1024, // 50KB
    gifSizeLimit: null, // No GIFs allowed
  } as ImageConfig,

  /**
   * Space icons - square crop, no GIFs. Same display role as avatar.
   * 256x256 source (was desktop 123 / mobile had no real limit).
   */
  spaceIcon: {
    maxWidth: 256,
    maxHeight: 256,
    quality: 0.8,
    cropToFit: true,
    skipCompressionThreshold: 50 * 1024, // 50KB
    gifSizeLimit: null, // No GIFs allowed
  } as ImageConfig,

  /**
   * Space banners - 16:9, no GIFs. Store a clean 16:9 source and let each
   * surface cover-crop at render (channel-list strip, mobile header, future
   * discover hero). 1600x900 (was desktop 450x253, too small for the discover hero).
   */
  spaceBanner: {
    maxWidth: 1600,
    maxHeight: 900,
    quality: 0.8,
    maintainAspectRatio: true, // no hard crop at upload; surfaces crop at render
    skipCompressionThreshold: 100 * 1024, // 100KB
    gifSizeLimit: null, // No GIFs allowed
  } as ImageConfig,

  /**
   * Message attachments - smart thumbnail system for large images/GIFs.
   * All GIFs constrained to 300px max width via CSS.
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
   * Custom emojis - tiny display, preserve small GIFs.
   * 96x96 source (was desktop 36 / mobile 128). Display 24px; 24 x 3 DPR = 72 -> 96 for picker preview headroom.
   */
  emoji: {
    maxWidth: 96,
    maxHeight: 96,
    quality: 0.8,
    cropToFit: true,
    skipCompressionThreshold: 50 * 1024, // 50KB
    gifSizeLimit: FILE_SIZE_LIMITS.MAX_EMOJI_GIF_SIZE,
    preserveGifAnimation: true,
  } as ImageConfig,

  /**
   * Custom stickers - longest-axis cap to preserve aspect, displayed at 300px.
   * 512 longest axis (mobile already used 512; replaces desktop's fixed 400x600 box).
   */
  sticker: {
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.8,
    maintainAspectRatio: true,
    skipCompressionThreshold: 100 * 1024, // 100KB
    gifSizeLimit: FILE_SIZE_LIMITS.MAX_STICKER_GIF_SIZE,
    preserveGifAnimation: true,
    gifMaxDisplayWidth: 300, // Display at 300px max width
  } as ImageConfig,
} as const;

/**
 * Type-safe keys for image configurations.
 */
export type ImageConfigType = keyof typeof IMAGE_CONFIGS;

/**
 * Get configuration for a specific image type.
 */
export const getImageConfig = (type: ImageConfigType): ImageConfig => {
  return IMAGE_CONFIGS[type];
};
