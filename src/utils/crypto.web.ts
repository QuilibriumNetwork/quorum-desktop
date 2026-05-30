/**
 * CRYPTO UTILITIES FOR WEB
 * ========================
 *
 * This file re-exports the original multiformats functions for web usage.
 * The React Native version (crypto.native.ts) provides compatible implementations
 * using libraries that work in mobile environments.
 *
 * This separation allows us to use the optimal libraries for each platform
 * while maintaining the same API surface.
 */

// Re-export the original multiformats functions for web
export { sha256 } from 'multiformats/hashes/sha2';
export { base58btc } from 'multiformats/bases/base58';

// Also export as default for consistency with native version
import { sha256 } from 'multiformats/hashes/sha2';
import { base58btc } from 'multiformats/bases/base58';

export default {
  sha256,
  base58btc,
};

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

/**
 * Decrypts an AES-GCM-encrypted UserConfig blob using a user's private key.
 *
 * Wire format (encryptedUserConfig string):
 * - ciphertext (hex) | iv (last 24 hex chars = 12 bytes)
 *
 * Key derivation:
 * - SHA-512(privateKeyBytes), take first 32 bytes, import as AES-GCM key.
 *
 * Caller responsibilities:
 * - Verify any signature BEFORE calling this helper (this helper does
 *   symmetric decrypt only).
 * - Validate the returned object (treated as unknown — caller must check
 *   shape, sanitize strings, etc.).
 *
 * @param encryptedUserConfig The `user_config` field from a SavedConfig.
 * @param privateKeyBytes The user's Ed448 private key as raw bytes.
 * @returns The decrypted, JSON-parsed object. Caller validates shape.
 */
export async function decryptUserConfig(
  encryptedUserConfig: string,
  privateKeyBytes: ArrayBuffer | Uint8Array
): Promise<unknown> {
  const derived = await window.crypto.subtle.digest(
    'SHA-512',
    Buffer.from(new Uint8Array(privateKeyBytes))
  );

  const subtleKey = await window.crypto.subtle.importKey(
    'raw',
    derived.slice(0, 32),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const iv = encryptedUserConfig.substring(encryptedUserConfig.length - 24);
  const ciphertext = encryptedUserConfig.substring(0, encryptedUserConfig.length - 24);

  const plaintext = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(iv, 'hex') },
    subtleKey,
    Buffer.from(ciphertext, 'hex')
  );

  return JSON.parse(Buffer.from(plaintext).toString('utf-8'));
}
