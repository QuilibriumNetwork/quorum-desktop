/**
 * Helpers for handling the raw ed448 account private key as hex.
 *
 * Two directions:
 * - {@link normalizePrivateKeyHex} — EXPORT side. The SDK's `exportKey()` (via
 *   `getPrivateKeyHex`) returns the credential's `largeBlob`, which is EITHER a
 *   114-char hex string OR a legacy JSON `{ private_key: number[] }` blob. This
 *   normalizes both to clean lowercase hex so the copy-to-clipboard and QR
 *   payloads are always a bare hex key (the SDK's import path accepts both, but
 *   hex is the canonical, shorter form). Mirrors the SDK's own normalization in
 *   `signWithPasskey`.
 * - {@link cleanAndValidateHexKey} — IMPORT side. Sanitizes user-pasted text
 *   (strip a `0x` prefix, strip whitespace, lowercase) and validates it is a
 *   well-formed ed448 private key. Mirrors mobile's `HexInputView`.
 *
 * An ed448 private key is 57 bytes = 114 hex characters.
 */

import { uint8ArrayToHex } from './crypto';

/** ed448 private key length in hex characters (57 bytes * 2). */
export const ED448_PRIVATE_KEY_HEX_LENGTH = 114;

/**
 * Normalize the raw value returned by the SDK's `exportKey()` into clean,
 * lowercase 114-char hex.
 *
 * Accepts:
 * - a bare hex string (possibly mixed-case / whitespace-padded), or
 * - a legacy JSON `{ "private_key": number[] }` blob.
 *
 * @throws if the value cannot be resolved to a 114-char hex key.
 */
export function normalizePrivateKeyHex(raw: string): string {
  const trimmed = raw.trim();

  let hex: string;
  if (trimmed.startsWith('{')) {
    // Legacy JSON shape: { private_key: number[] }
    const parsed = JSON.parse(trimmed);
    const bytes = parsed?.private_key;
    if (!Array.isArray(bytes)) {
      throw new Error('Malformed key blob: missing private_key array');
    }
    hex = uint8ArrayToHex(new Uint8Array(bytes));
  } else {
    hex = trimmed.replace(/^0x/i, '').replace(/\s/g, '').toLowerCase();
  }

  if (!isValidEd448HexKey(hex)) {
    throw new Error('Could not resolve a valid private key from export data');
  }
  return hex;
}

/**
 * Strip a `0x` prefix and all whitespace, lowercase. Does NOT validate length —
 * use {@link isValidEd448HexKey} or {@link validateHexKeyInput} for that. Kept
 * separate so the import UI can show a live `(n/114)` count on partial input.
 */
export function cleanHexKeyInput(input: string): string {
  return input.replace(/^0x/i, '').replace(/\s/g, '').toLowerCase();
}

/** True iff `hex` is exactly 114 lowercase hex characters. */
export function isValidEd448HexKey(hex: string): boolean {
  return /^[0-9a-f]{114}$/.test(hex);
}

/**
 * Clean and validate user-pasted hex. Returns the clean hex on success.
 * @throws with a human-friendly message on invalid input.
 */
export function cleanAndValidateHexKey(input: string): string {
  const hex = cleanHexKeyInput(input);
  if (!/^[0-9a-f]*$/.test(hex)) {
    throw new Error('Key contains invalid characters (expected hexadecimal)');
  }
  if (hex.length !== ED448_PRIVATE_KEY_HEX_LENGTH) {
    throw new Error(
      `Key must be ${ED448_PRIVATE_KEY_HEX_LENGTH} characters (got ${hex.length})`
    );
  }
  return hex;
}
