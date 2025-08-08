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
  base58btc
};