/**
 * Image processing types and interfaces
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
}

export interface ProcessedImage {
  /** Compressed file */
  file: File;
  /** File size reduction info */
  compressionRatio: number;
  /** Whether the image was actually compressed */
  wasCompressed: boolean;
}

export type ImageProcessor = (file: File) => Promise<ProcessedImage>;