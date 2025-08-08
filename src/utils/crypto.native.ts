/**
 * CRYPTO UTILITIES FOR REACT NATIVE
 * ==================================
 * 
 * This file provides React Native compatible implementations of crypto functions
 * that are used throughout the app, particularly in MessageDB.
 * 
 * The web version uses 'multiformats' library which has Node.js dependencies.
 * This React Native version uses compatible libraries that work in mobile environments.
 * 
 * TODO: When implementing proper SDK integration:
 * - Ensure these implementations produce identical outputs to web version
 * - Consider performance optimizations for mobile
 * - Add comprehensive tests to verify compatibility
 */

import CryptoJS from 'react-native-crypto-js';
import * as base58 from 'base58-js';

/**
 * SHA256 implementation compatible with multiformats/hashes/sha2
 * 
 * Provides the same interface as multiformats sha256:
 * - digest(data) returns { bytes: Uint8Array }
 * 
 * TODO: Verify this produces identical hashes to web version
 */
export const sha256 = {
  /**
   * Computes SHA256 hash of input data
   * @param input - Buffer or Uint8Array to hash
   * @returns Object with bytes property containing hash as Uint8Array
   */
  digest: async (input: Buffer | Uint8Array): Promise<{ bytes: Uint8Array }> => {
    try {
      // Convert input to hex string for CryptoJS
      let hexString: string;
      if (Buffer.isBuffer(input)) {
        hexString = input.toString('hex');
      } else {
        // Uint8Array to hex
        hexString = Array.from(input)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }

      // Use CryptoJS to compute SHA256
      // CryptoJS expects data in specific format - we use hex encoding
      const wordArray = CryptoJS.enc.Hex.parse(hexString);
      const hash = CryptoJS.SHA256(wordArray);
      const hashHex = hash.toString(CryptoJS.enc.Hex);

      // Convert hex string back to Uint8Array to match multiformats interface
      const bytes = new Uint8Array(hashHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

      return { bytes };
    } catch (error) {
      console.error('[Crypto Native] SHA256 error:', error);
      // TODO: In production, handle this more gracefully
      throw new Error(`SHA256 hashing failed: ${error}`);
    }
  }
};

/**
 * Base58 Bitcoin encoding implementation compatible with multiformats/bases/base58
 * 
 * Provides the same interface as multiformats base58btc:
 * - baseEncode(bytes) returns base58 encoded string
 * - baseDecode(str) returns Uint8Array
 * 
 * TODO: Verify this produces identical encoding to web version
 */
export const base58btc = {
  /**
   * Encodes bytes to base58 string (Bitcoin alphabet)
   * @param bytes - Uint8Array to encode
   * @returns Base58 encoded string with 'z' prefix (multibase indicator)
   */
  baseEncode: (bytes: Uint8Array): string => {
    try {
      // base58-js: binary_to_base58 converts bytes to base58 string
      // Note: Despite the name, binary_to_base58 takes bytes and returns base58 string
      const encoded = base58.binary_to_base58(bytes);
      
      // multiformats adds a 'z' prefix for base58btc encoding (multibase indicator)
      // This prefix indicates the encoding type in multibase format
      // TODO: Verify if this prefix is required in our use case
      return 'z' + encoded;
    } catch (error) {
      console.error('[Crypto Native] Base58 encode error:', error);
      throw new Error(`Base58 encoding failed: ${error}`);
    }
  },

  /**
   * Decodes base58 string to bytes
   * @param str - Base58 encoded string (with or without 'z' prefix)
   * @returns Decoded bytes as Uint8Array
   */
  baseDecode: (str: string): Uint8Array => {
    try {
      // Remove multibase prefix if present
      const cleanStr = str.startsWith('z') ? str.slice(1) : str;
      
      // base58-js: base58_to_binary converts base58 string to bytes
      // Note: Despite the name, base58_to_binary takes base58 string and returns bytes
      const decoded = base58.base58_to_binary(cleanStr);
      return new Uint8Array(decoded);
    } catch (error) {
      console.error('[Crypto Native] Base58 decode error:', error);
      throw new Error(`Base58 decoding failed: ${error}`);
    }
  }
};

/**
 * IMPORTANT COMPATIBILITY NOTES:
 * ==============================
 * 
 * 1. Hash Compatibility:
 *    The SHA256 implementation MUST produce identical hashes to the web version.
 *    Any difference will cause address mismatches and break message routing.
 * 
 * 2. Base58 Compatibility:
 *    The base58 encoding MUST be compatible with Bitcoin's base58 alphabet.
 *    The 'z' prefix is part of the multibase standard - verify if needed.
 * 
 * 3. Testing Required:
 *    Before using in production, test with known inputs/outputs from web version:
 *    - Generate same addresses from same public keys
 *    - Verify message signatures match
 *    - Ensure space/channel addresses are consistent
 * 
 * 4. Performance Considerations:
 *    These operations are CPU intensive. Consider:
 *    - Caching computed hashes where appropriate
 *    - Batching operations when possible
 *    - Using native modules for better performance if needed
 * 
 * 5. Error Handling:
 *    Current implementation logs errors and throws.
 *    In production, consider:
 *    - Graceful degradation
 *    - User-friendly error messages
 *    - Retry mechanisms for transient failures
 */

export default {
  sha256,
  base58btc
};