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