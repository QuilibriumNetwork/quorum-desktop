/**
 * Profile image validation utility
 * Used for validating remote config data (zero-trust)
 */

// 2MB matches the legacy avatar limit from imageProcessing/config.ts
// Avatars are compressed to 123x123 at 80% quality, so typical size is ~10-50KB
// We use a generous limit to accommodate edge cases
const MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Validates a profile image data URI
 * Used for zero-trust validation of remote config data
 *
 * @param dataUri - The data URI to validate
 * @returns true if valid, false otherwise
 */
export function validateProfileImage(dataUri: string | undefined): boolean {
  if (!dataUri) return false;
  if (!dataUri.startsWith('data:image/')) return false;

  // Estimate base64 decoded size (base64 is ~4/3 of original size)
  const base64Start = dataUri.indexOf(',');
  if (base64Start === -1) return false;

  const base64Data = dataUri.substring(base64Start + 1);
  const sizeEstimate = (base64Data.length * 3) / 4;
  if (sizeEstimate > MAX_PROFILE_IMAGE_SIZE) return false;

  // Validate MIME type
  const mimeMatch = dataUri.match(/^data:(image\/[^;]+);/);
  if (!mimeMatch || !ALLOWED_IMAGE_TYPES.includes(mimeMatch[1])) return false;

  return true;
}

