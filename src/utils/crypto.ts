/**
 * CRYPTO UTILITIES INDEX
 * ======================
 *
 * This file acts as the entry point for crypto utilities.
 * It will automatically resolve to the correct platform-specific implementation:
 * - crypto.web.ts for web browsers
 * - crypto.native.ts for React Native
 *
 * This is just a fallback for TypeScript - the actual platform-specific
 * files will be used by the bundlers (Vite for web, Metro for mobile).
 */

// Default export for web (this file is mainly for TypeScript)
// The bundlers will actually use the .web.ts or .native.ts versions
export { sha256 } from 'multiformats/hashes/sha2';
export { base58btc } from 'multiformats/bases/base58';

/**
 * Hex conversion utilities (platform-independent)
 * These work the same on web and mobile
 */

/**
 * Converts a hex string to Uint8Array.
 * Used for converting hex-encoded keys and data.
 *
 * @param hex - Hex string to convert
 * @returns Uint8Array containing the decoded bytes
 *
 * @example
 * const publicKey = hexToUint8Array('deadbeef');
 * // Uint8Array [222, 173, 190, 239]
 */
export function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

/**
 * Converts a hex string to a spread array (number[]).
 * This is used for SDK compatibility where spread syntax is needed.
 *
 * @param hex - Hex string to convert
 * @returns Array of numbers (0-255)
 *
 * @example
 * const keyArray = hexToSpreadArray('deadbeef');
 * // [222, 173, 190, 239]
 *
 * // Usage in SDK calls:
 * const envelope = await SealEnvelope({
 *   private_key: hexToSpreadArray(privateKeyHex),
 *   public_key: hexToSpreadArray(publicKeyHex),
 * });
 */
export function hexToSpreadArray(hex: string): number[] {
  return [...hexToUint8Array(hex)];
}

/**
 * Converts a Uint8Array to hex string.
 * Used for encoding binary data as hex.
 *
 * @param arr - Uint8Array to convert
 * @returns Hex string representation
 *
 * @example
 * const bytes = new Uint8Array([222, 173, 190, 239]);
 * const hex = uint8ArrayToHex(bytes);
 * // 'deadbeef'
 */
export function uint8ArrayToHex(arr: Uint8Array): string {
  return Buffer.from(arr).toString('hex');
}
