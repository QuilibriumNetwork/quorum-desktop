/**
 * Centralized error messages for image processing
 *
 * Provides consistent error messages across all image upload scenarios
 * with proper internationalization support via Lingui.
 */

import { t } from '@lingui/core/macro';

/**
 * Standard error messages for image processing failures
 */
export const IMAGE_ERRORS = {
  // Input size limit errors
  FILE_TOO_LARGE: (maxSize: string) =>
    t`File cannot be larger than ${maxSize}`,

  // GIF-specific errors
  GIF_TOO_LARGE: (maxSize: string) =>
    t`GIF files cannot be larger than ${maxSize}. Please use a smaller GIF.`,

  ANIMATED_EMOJI_GIF_TOO_LARGE: () =>
    t`Animated emoji GIFs cannot be larger than 100KB. Please optimize your GIF for emoji use.`,

  ANIMATED_STICKER_GIF_TOO_LARGE: () =>
    t`Animated sticker GIFs cannot be larger than 500KB. Please optimize your GIF for sticker use.`,

  // Processing errors
  COMPRESSION_FAILED: () =>
    t`Unable to process image. Please use a smaller image.`,

  EMOJI_COMPRESSION_FAILED: () =>
    t`Unable to process emoji image. Please use a smaller image.`,

  STICKER_COMPRESSION_FAILED: () =>
    t`Unable to process sticker image. Please use a smaller image.`,

  // Profile image specific
  PROFILE_IMAGE_SIZE: (maxSize: string) =>
    t`Your profile image size must be ${maxSize} or less and must be a PNG, JPG, or JPEG file extension.`
} as const;

/**
 * Helper function to format file size for error messages
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  } else if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }
  return `${bytes} bytes`;
};