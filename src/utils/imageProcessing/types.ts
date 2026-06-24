/**
 * Image processing types and interfaces.
 *
 * `ImageProcessingOptions` is platform-agnostic and now lives in
 * `sharedConfig.ts` (re-exported here for back-compat). `ProcessedImage` and
 * `ImageProcessor` reference the DOM `File` type, so they stay desktop-only.
 */

export type { ImageProcessingOptions } from './sharedConfig';

export interface ProcessedImage {
  /** Compressed file */
  file: File;
  /** File size reduction info */
  compressionRatio: number;
  /** Whether the image was actually compressed */
  wasCompressed: boolean;
}

export type ImageProcessor = (file: File) => Promise<ProcessedImage>;
