/**
 * Validation utilities for user input security and cryptographic keys
 *
 * This module provides validation functions to prevent XSS (Cross-Site Scripting)
 * attacks by blocking dangerous HTML characters in user-controlled content like
 * display names and space names, as well as utilities for validating cryptographic
 * addresses and channel IDs.
 */

import { base58btc } from 'multiformats/bases/base58';

/**
 * Regular expression to detect dangerous HTML characters that can be used for XSS injection.
 *
 * Blocks:
 * - < : Opens HTML tags (e.g., <script>)
 * - > : Closes HTML tags
 * - " : Can break out of double-quoted HTML attributes
 * - ' : Can break out of single-quoted HTML attributes
 *
 * Allows all other characters including:
 * - & : Safe (cannot inject code by itself, allows "AT&T", "Tom & Jerry", etc.)
 * - Currency symbols: $, €, ¥, £, etc.
 * - Accented letters: é, ñ, ü, etc.
 * - International characters: 北京, مستخدم, etc.
 * - Emojis: 🎉, 👍, etc.
 * - Common punctuation: -, _, ., @, #, etc.
 */
export const DANGEROUS_HTML_CHARS = /[<>"']/;

/**
 * Maximum length for user input names (display names, space names, group names, channel names)
 * Centralized constant to ensure consistency across the application
 */
export const MAX_NAME_LENGTH = 40;

/**
 * Maximum length for topic/description fields (channel topics, space descriptions)
 * Longer limit for descriptive text fields
 */
export const MAX_TOPIC_LENGTH = 80;

/**
 * Maximum length for message content
 * Future extensibility: Can be made dynamic based on user roles/subscription
 */
export const MAX_MESSAGE_LENGTH = 2500;

/**
 * Validates a name (display name, space name, etc.) to ensure it doesn't contain
 * characters that could be used for XSS injection.
 *
 * @param name - The name to validate
 * @returns true if the name is safe, false if it contains dangerous characters
 *
 * @example
 * validateNameForXSS("John Doe") // true
 * validateNameForXSS("John & Jane") // true
 * validateNameForXSS("José García") // true
 * validateNameForXSS("User 🎉") // true
 * validateNameForXSS("Price: $100") // true
 * validateNameForXSS("<script>alert('xss')</script>") // false
 * validateNameForXSS('test"><script>') // false
 */
export const validateNameForXSS = (name: string): boolean => {
  return !DANGEROUS_HTML_CHARS.test(name);
};

/**
 * Gets a user-friendly error message for XSS validation failure.
 *
 * @param fieldName - The name of the field being validated (e.g., "Display name", "Space name")
 * @returns A localized error message
 *
 * @example
 * getXSSValidationError("Display name") // "Display name cannot contain < > \" ' characters"
 * getXSSValidationError("Space name") // "Space name cannot contain < > \" ' characters"
 */
export const getXSSValidationError = (fieldName: string = 'Name'): string => {
  return `${fieldName} cannot contain special characters`;
};

/**
 * Sanitizes a name by removing dangerous HTML characters.
 * Use this for migrating existing data that may contain dangerous characters.
 *
 * @param name - The name to sanitize
 * @returns The sanitized name with dangerous characters removed
 *
 * @example
 * sanitizeNameForXSS("John<script>") // "Johnscript"
 * sanitizeNameForXSS('test"><script>') // "testscript"
 * sanitizeNameForXSS("John & Jane") // "John & Jane" (unchanged)
 */
export const sanitizeNameForXSS = (name: string): string => {
  return name.replace(DANGEROUS_HTML_CHARS, '');
};

// ============================================
// CRYPTOGRAPHIC KEY VALIDATION
// ============================================

/**
 * Regular expression pattern for valid IPFS CID addresses.
 * - Starts with "Qm"
 * - Followed by exactly 44 base58-encoded characters
 * - Total length: 46 characters
 */
export const IPFS_CID_REGEX = /^Qm[a-zA-Z0-9]{44}$/;

/**
 * Base58 alphabet used in IPFS CIDs for more precise validation.
 * Excludes: 0, O, I, l (to avoid ambiguity)
 */
export const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * More precise regex for IPFS CIDs using the exact base58 alphabet.
 */
export const IPFS_CID_PRECISE_REGEX = new RegExp(`^Qm[${BASE58_ALPHABET}]{44}$`);

/**
 * Validates if a string is a valid IPFS CID address.
 * Uses fast string validation first, then validates base58 encoding.
 *
 * @param address - The address to validate
 * @param precise - If true, uses precise base58 alphabet validation
 * @returns true if the address is a valid IPFS CID
 *
 * @example
 * isValidIPFSCID("QmV5xWMo5CYSxgAAy6emKFZZPCPKwCsBZKZxXD3mCUZF2n") // true
 * isValidIPFSCID("QmInvalid") // false
 * isValidIPFSCID("not-an-address") // false
 */
export const isValidIPFSCID = (address: string, precise = false): boolean => {
  // Fast string validation first
  if (!address || address.length !== 46 || !address.startsWith('Qm')) {
    return false;
  }

  // Use appropriate regex based on precision level
  const regex = precise ? IPFS_CID_PRECISE_REGEX : IPFS_CID_REGEX;
  if (!regex.test(address)) {
    return false;
  }

  // Validate base58 encoding
  try {
    base58btc.baseDecode(address);
    return true;
  } catch {
    return false;
  }
};

/**
 * Creates a regex pattern for matching IPFS CID addresses in text.
 * Useful for mention parsing and content validation.
 *
 * @param precise - If true, uses precise base58 alphabet
 * @returns RegExp for matching IPFS CIDs in text
 *
 * @example
 * const mentionRegex = createIPFSCIDRegex();
 * const text = "Hey @<QmV5xWMo5CYSxgAAy6emKFZZPCPKwCsBZKZxXD3mCUZF2n>";
 * const match = text.match(mentionRegex); // Matches the address part
 */
export const createIPFSCIDRegex = (precise = false): RegExp => {
  if (precise) {
    return new RegExp(`Qm[${BASE58_ALPHABET}]{44}`, 'g');
  }
  return /Qm[a-zA-Z0-9]{44}/g;
};

/**
 * Validates if a string could be a channel ID.
 * Channel IDs follow the same IPFS CID format as user addresses.
 *
 * @param channelId - The channel ID to validate
 * @returns true if the channel ID is valid
 */
export const isValidChannelId = (channelId: string): boolean => {
  return isValidIPFSCID(channelId);
};
