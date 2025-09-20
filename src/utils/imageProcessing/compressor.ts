import Compressor from 'compressorjs';
import { ImageProcessingOptions, ProcessedImage } from './types';

/**
 * Check if a PNG file is likely a photo (vs graphic/icon)
 * Photos benefit from JPEG conversion, graphics should stay PNG
 */
const isPNGPhoto = (file: File): boolean => {
  // Simple heuristic: large PNG files are likely photos
  // Icons and graphics are typically smaller
  return file.type === 'image/png' && file.size > 750000; // 750KB threshold
};

/**
 * Get image dimensions from a File object
 */
const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for dimension calculation'));
    };

    img.src = url;
  });
};

/**
 * Check if image is already within dimension limits
 */
const isWithinDimensions = async (
  file: File,
  maxWidth?: number,
  maxHeight?: number
): Promise<boolean> => {
  if (!maxWidth && !maxHeight) return true;

  try {
    const { width, height } = await getImageDimensions(file);

    if (maxWidth && width > maxWidth) return false;
    if (maxHeight && height > maxHeight) return false;

    return true;
  } catch {
    // If we can't get dimensions, assume compression is needed
    return false;
  }
};

/**
 * Unified image compression function
 * Handles all image processing needs with a single, fast approach
 */
export const compressImage = async (
  file: File,
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage> => {
  const {
    maxWidth,
    maxHeight,
    quality = 0.8,
    skipCompressionThreshold = 100000, // 100KB
  } = options;

  const originalSize = file.size;

  // Skip compression for GIFs (preserve animation)
  if (file.type === 'image/gif') {
    return {
      file,
      compressionRatio: 1,
      wasCompressed: false,
    };
  }

  // Skip compression if file is already small and within dimensions
  if (file.size < skipCompressionThreshold) {
    const withinDimensions = await isWithinDimensions(file, maxWidth, maxHeight);
    if (withinDimensions) {
      return {
        file,
        compressionRatio: 1,
        wasCompressed: false,
      };
    }
  }

  // Perform compression
  return new Promise<ProcessedImage>((resolve, reject) => {
    const compressorOptions: Compressor.Options = {
      quality,
      convertSize: Infinity,
      retainExif: false,
      mimeType: file.type,
      success(result: Blob) {
        // Convert to File with original name
        const compressedFile = new File([result], file.name, {
          type: result.type,
        });

        const compressionRatio = originalSize / compressedFile.size;

        resolve({
          file: compressedFile,
          compressionRatio,
          wasCompressed: true,
        });
      },
      error(err) {
        reject(new Error(`Image compression failed: ${err.message}`));
      },
    };

    // Handle dimension and cropping options
    if (maxWidth && maxHeight) {
      if (options.cropToFit) {
        // Fixed dimensions with cropping - set exact size and crop to fill
        compressorOptions.width = maxWidth;
        compressorOptions.height = maxHeight;
        compressorOptions.resize = 'cover'; // Crop to fill exact dimensions
      } else {
        // Maintain aspect ratio - use max constraints, not fixed dimensions
        compressorOptions.maxWidth = maxWidth;
        compressorOptions.maxHeight = maxHeight;
        // Don't set resize mode - let compressorjs handle aspect ratio naturally
      }
    } else {
      // Single dimension - compressorjs will maintain aspect ratio automatically
      if (maxWidth) compressorOptions.maxWidth = maxWidth;
      if (maxHeight) compressorOptions.maxHeight = maxHeight;
    }

    // Smart format conversion for large PNG photos
    if (isPNGPhoto(file)) {
      // Convert PNG photos to JPEG for better compression
      compressorOptions.mimeType = 'image/jpeg';
      compressorOptions.convertTypes = ['image/jpeg'];
    }

    new Compressor(file, compressorOptions);
  });
};