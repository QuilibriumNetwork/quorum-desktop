import { ProcessedImage } from './types';

/**
 * Extract the first frame from a GIF and convert to JPEG thumbnail
 * Used for large GIFs to show static preview before loading full animation
 */
export const extractGifFirstFrame = async (
  file: File,
  maxSize: number
): Promise<ProcessedImage> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Calculate dimensions maintaining aspect ratio
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);

        // Draw first frame
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to JPEG blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create thumbnail blob'));
              return;
            }

            const jpegFile = new File([blob], 'thumbnail.jpg', {
              type: 'image/jpeg',
            });

            resolve({
              file: jpegFile,
              compressionRatio: file.size / jpegFile.size,
              wasCompressed: true,
            });
          },
          'image/jpeg',
          0.8
        );
      } catch (error) {
        reject(new Error(`Failed to extract GIF frame: ${error}`));
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load GIF for frame extraction'));
    };

    img.src = url;
  });
};

/**
 * Get image dimensions from a File object
 */
export const getImageDimensions = (
  file: File
): Promise<{ width: number; height: number }> => {
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