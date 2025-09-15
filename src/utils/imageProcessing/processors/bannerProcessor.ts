import { compressImage } from '../compressor';
import { ImageProcessor } from '../types';

/**
 * Process banner images
 * Target: 450×253px (16:9 landscape ratio - natural and familiar)
 * Display contexts:
 * - Desktop: 300×120px (2.5:1) - will crop from top/bottom to fit
 * - Mobile: 100% width×100px (varies:1) - will crop from sides as needed
 * - All use CSS background-size: cover for proper filling
 *
 * IMPORTANT: Uses 16:9 ratio (1.78:1) as it's natural, familiar, and provides good content area
 * Much better than thin 3:1 ratio - gives more vertical space for banner content
 * Use case: Space banners
 */
export const processBannerImage: ImageProcessor = async (file: File) => {
  return compressImage(file, {
    maxWidth: 450,
    maxHeight: 253, // 16:9 ratio (450 ÷ 16 × 9 = 253)
    quality: 0.8,
    cropToFit: true, // Crop to exact 16:9 landscape ratio
    skipCompressionThreshold: 100000, // 100KB
  });
};