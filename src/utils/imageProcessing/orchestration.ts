/**
 * Platform-agnostic image-processing orchestration.
 *
 * This module owns the cross-platform LOGIC — input-size validation, GIF vs
 * static routing, thumbnail decisions — but performs none of the actual
 * pixel-pushing. The platform injects its compressor and dimension reader via
 * the `ImagePlatform` adapter (compressorjs on desktop, expo-image-manipulator
 * on mobile).
 *
 * Like sharedConfig.ts, this is PURE: no DOM, no native, no i18n imports. It is
 * staged to move into `quorum-shared/src/utils/imageOrchestration.ts`. Errors
 * are surfaced as typed `ImageProcessingError` codes; each platform maps codes
 * to localized user-facing text.
 */

import {
  FILE_SIZE_LIMITS,
  IMAGE_CONFIGS,
  ImageConfig,
  ImageConfigType,
  ImageProcessingOptions,
} from './sharedConfig';

/** Stable error codes the platform maps to localized messages. */
export type ImageErrorCode =
  | 'FILE_TOO_LARGE'
  | 'GIF_TOO_LARGE'
  | 'COMPRESSION_FAILED'
  | 'EMOJI_COMPRESSION_FAILED'
  | 'STICKER_COMPRESSION_FAILED';

export class ImageProcessingError extends Error {
  code: ImageErrorCode;
  /** Limit (bytes) relevant to size errors, for message formatting. */
  limitBytes?: number;
  constructor(code: ImageErrorCode, limitBytes?: number) {
    super(code);
    this.name = 'ImageProcessingError';
    this.code = code;
    this.limitBytes = limitBytes;
  }
}

/**
 * Minimal description of an input image the orchestrator needs, independent of
 * platform file types. `size` is bytes, `type` is the MIME type.
 */
export interface ImageInput {
  size: number;
  type: string;
}

/**
 * Platform adapter the orchestrator depends on. `R` is the platform's processed
 * result type (e.g. desktop `ProcessedImage` wrapping a `File`).
 */
export interface ImagePlatform<F extends ImageInput, R> {
  /** Re-encode/resize `file` per `opts`, returning the platform result. */
  compress: (file: F, opts: ImageProcessingOptions) => Promise<R>;
  /** Pass a GIF through unchanged (animation preserved), returning a result. */
  passthroughGif: (file: F, config: ImageConfig) => Promise<R>;
  /** Natural pixel dimensions of `file`. */
  getDimensions: (file: F) => Promise<{ width: number; height: number }>;
}

/** Input-size guard shared by all surfaces. */
function validateInputFileSize(file: ImageInput, config: ImageConfig): void {
  const maxInputSize =
    config === IMAGE_CONFIGS.emoji
      ? FILE_SIZE_LIMITS.MAX_EMOJI_INPUT_SIZE
      : FILE_SIZE_LIMITS.MAX_INPUT_SIZE;

  if (file.size > maxInputSize) {
    throw new ImageProcessingError('FILE_TOO_LARGE', maxInputSize);
  }
}

function compressionFailureCode(config: ImageConfig): ImageErrorCode {
  if (config === IMAGE_CONFIGS.emoji) return 'EMOJI_COMPRESSION_FAILED';
  if (config === IMAGE_CONFIGS.sticker) return 'STICKER_COMPRESSION_FAILED';
  return 'COMPRESSION_FAILED';
}

function optsFromConfig(config: ImageConfig): ImageProcessingOptions {
  return {
    maxWidth: config.maxWidth,
    maxHeight: config.maxHeight,
    quality: config.quality,
    cropToFit: config.cropToFit,
    maintainAspectRatio: config.maintainAspectRatio,
    skipCompressionThreshold: config.skipCompressionThreshold,
  };
}

/**
 * Process a single-image surface (avatar, space icon, banner, emoji, sticker).
 */
export async function processImageWithConfig<F extends ImageInput, R>(
  file: F,
  type: ImageConfigType,
  platform: ImagePlatform<F, R>,
): Promise<R> {
  const config = IMAGE_CONFIGS[type];

  validateInputFileSize(file, config);

  if (file.type === 'image/gif') {
    return platform.passthroughGif(file, config);
  }

  try {
    return await platform.compress(file, optsFromConfig(config));
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError(compressionFailureCode(config));
  }
}

/** Result of processing a message attachment with optional thumbnail. */
export interface AttachmentResult<R> {
  thumbnail?: R;
  full: R;
  isLargeGif?: boolean;
}

/**
 * Decide whether a GIF needs a static thumbnail (large GIFs get a poster frame).
 * Mirrors the platform-specific helper so the decision lives in one place.
 */
function shouldGenerateGifThumbnail(file: ImageInput, config: ImageConfig): boolean {
  return Boolean(
    config.thumbnailConfig &&
      config.preserveGifAnimation &&
      file.size > config.thumbnailConfig.threshold * 1024,
  );
}

/**
 * Process a message attachment, generating a thumbnail when the source is large.
 * `generateGifThumbnail` is injected because GIF poster-frame extraction is
 * platform-specific (canvas on web, native on mobile).
 */
export async function processAttachmentWithConfig<F extends ImageInput, R>(
  file: F,
  platform: ImagePlatform<F, R>,
  generateGifThumbnail: (file: F, config: ImageConfig) => Promise<R>,
): Promise<AttachmentResult<R>> {
  const config = IMAGE_CONFIGS.messageAttachment;

  validateInputFileSize(file, config);

  if (file.type === 'image/gif') {
    if (shouldGenerateGifThumbnail(file, config)) {
      const [thumbnail, full] = await Promise.all([
        generateGifThumbnail(file, config),
        platform.passthroughGif(file, config),
      ]);
      return { thumbnail, full, isLargeGif: true };
    }
    const full = await platform.passthroughGif(file, config);
    return { full };
  }

  const dimensions = await platform.getDimensions(file);
  const tc = config.thumbnailConfig;

  if (tc && (dimensions.width > tc.threshold || dimensions.height > tc.threshold)) {
    const [thumbnail, full] = await Promise.all([
      platform.compress(file, {
        maxWidth: tc.maxWidth,
        maxHeight: tc.maxHeight,
        quality: tc.quality,
        maintainAspectRatio: true,
        skipCompressionThreshold: config.skipCompressionThreshold,
      }),
      platform.compress(file, {
        maxWidth: config.maxWidth,
        maxHeight: config.maxHeight,
        quality: config.quality,
        maintainAspectRatio: true,
        skipCompressionThreshold: config.skipCompressionThreshold,
      }),
    ]);
    return { thumbnail, full };
  }

  const full = await platform.compress(file, {
    maxWidth: config.maxWidth,
    maxHeight: config.maxHeight,
    quality: config.quality,
    maintainAspectRatio: true,
    skipCompressionThreshold: config.skipCompressionThreshold,
  });
  return { full };
}
