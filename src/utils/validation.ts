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
 * Regular expression to detect dangerous HTML patterns that could be used for XSS injection.
 *
 * Blocks < only when followed by characters that start HTML constructs:
 * - <a, <div, <script (HTML tags - letter after <)
 * - </div (closing tags - / after <)
 * - <!-- (comments - ! after <)
 * - <?xml (processing instructions - ? after <)
 *
 * Allows (safe patterns):
 * - <3 : Heart emoticon (number after <)
 * - >_< : Emoticons (standalone >)
 * - ->, <- : Arrows
 * - <<, >> : Double brackets
 * - <> : Empty brackets
 * - < space : Space after < breaks HTML parsing
 * - " and ' : React auto-escapes in JSX; allows O'Brien, "The Legend"
 * - & : Safe (allows "AT&T", "Tom & Jerry")
 * - Currency, accents, international chars, emojis, punctuation
 *
 * Security note: This relaxed pattern is safe because:
 * 1. HTML5 spec requires < immediately followed by ASCII letter for tag recognition
 * 2. Unicode lookalikes are NOT parsed as HTML tags by browsers
 * 3. React JSX auto-escapes all text content and attribute values
 * 4. SearchService.highlightSearchTerms properly escapes HTML before dangerouslySetInnerHTML
 */
export const DANGEROUS_HTML_PATTERN = /<[a-zA-Z\/!?]/;

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
 * patterns that could be used for XSS injection.
 *
 * @param name - The name to validate
 * @returns true if the name is safe, false if it contains dangerous patterns
 *
 * @example
 * // Allowed patterns
 * validateNameForXSS("John Doe") // true
 * validateNameForXSS("John & Jane") // true
 * validateNameForXSS("O'Brien") // true (quotes allowed)
 * validateNameForXSS('"The Legend"') // true (quotes allowed)
 * validateNameForXSS("<3") // true (heart emoticon)
 * validateNameForXSS(">_<") // true (emoticon)
 * validateNameForXSS("->") // true (arrow)
 * validateNameForXSS("<<Name>>") // true (decorative)
 * validateNameForXSS("a > b") // true (comparison)
 *
 * // Blocked patterns (HTML-like)
 * validateNameForXSS("<script>") // false
 * validateNameForXSS("<img onerror") // false
 * validateNameForXSS("</div>") // false
 * validateNameForXSS("<!--comment") // false
 */
export const validateNameForXSS = (name: string): boolean => {
  return !DANGEROUS_HTML_PATTERN.test(name);
};

/**
 * Gets a user-friendly error message for XSS validation failure.
 *
 * @param fieldName - The name of the field being validated (e.g., "Display name", "Space name")
 * @returns A localized error message
 *
 * @example
 * getXSSValidationError("Display name") // "Display name cannot contain HTML tags"
 * getXSSValidationError("Space name") // "Space name cannot contain HTML tags"
 */
export const getXSSValidationError = (fieldName: string = 'Name'): string => {
  return `${fieldName} cannot contain HTML tags`;
};

/**
 * Sanitizes a name by removing the < character when it starts an HTML-like pattern.
 * Use this for migrating existing data that may contain dangerous patterns.
 *
 * @param name - The name to sanitize
 * @returns The sanitized name with dangerous < characters removed
 *
 * @example
 * sanitizeNameForXSS("John<script>") // "Johnscript>" (removes < before 's')
 * sanitizeNameForXSS("test</div>") // "test/div>" (removes < before '/')
 * sanitizeNameForXSS("John & Jane") // "John & Jane" (unchanged)
 * sanitizeNameForXSS("O'Brien") // "O'Brien" (unchanged)
 * sanitizeNameForXSS("<3") // "<3" (unchanged - safe pattern)
 * sanitizeNameForXSS(">_<") // ">_<" (unchanged - safe pattern)
 */
export const sanitizeNameForXSS = (name: string): string => {
  // Remove < only when followed by characters that start HTML constructs
  // Uses global flag to remove all occurrences
  return name.replace(/<([a-zA-Z\/!?])/g, '$1');
};

// ============================================
// RESERVED NAME VALIDATION
// ============================================

/**
 * Homoglyph map for anti-impersonation protection.
 * Maps visually similar characters to their letter equivalents.
 */
const HOMOGLYPH_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
  '!': 'i',
  '|': 'l',
};

/**
 * Names protected with strict anti-impersonation (homoglyph + word boundary).
 * These names are commonly used by bad actors to impersonate staff/authority.
 */
const IMPERSONATION_NAMES = ['admin', 'administrator', 'moderator', 'support'];

/**
 * Normalizes a string by replacing homoglyphs with their letter equivalents.
 *
 * @param name - The name to normalize
 * @returns The normalized name with homoglyphs replaced
 *
 * @example
 * normalizeHomoglyphs("adm1n") // "admin"
 * normalizeHomoglyphs("supp0rt") // "support"
 * normalizeHomoglyphs("@DM1N") // "admin" (after toLowerCase)
 */
export const normalizeHomoglyphs = (name: string): string => {
  return name
    .toLowerCase()
    .split('')
    .map((char) => HOMOGLYPH_MAP[char] || char)
    .join('');
};

/**
 * Checks if a name contains a reserved word at a word boundary.
 * Word boundaries are: start/end of string, spaces, numbers, punctuation.
 *
 * @param normalized - The normalized (homoglyph-replaced) name
 * @param reserved - The reserved word to check for
 * @returns true if the reserved word is found at a word boundary
 *
 * @example
 * hasReservedWordBoundary("admin", "admin") // true
 * hasReservedWordBoundary("admin123", "admin") // true
 * hasReservedWordBoundary("sysadmin", "admin") // false (embedded)
 */
const hasReservedWordBoundary = (normalized: string, reserved: string): boolean => {
  // Match reserved word at start, end, or separated by non-letters
  const pattern = new RegExp(`(^|[^a-z])${reserved}([^a-z]|$)`, 'i');
  return pattern.test(normalized);
};

/**
 * Checks if a name matches any impersonation pattern.
 * Uses BOTH original name (for word boundary) AND homoglyph-normalized (for lookalike detection).
 *
 * @param name - The name to check
 * @returns true if the name matches an impersonation pattern
 *
 * @example
 * isImpersonationName("admin") // true
 * isImpersonationName("ADM1N") // true (homoglyph + case)
 * isImpersonationName("admin team") // true (word boundary)
 * isImpersonationName("admin123") // true (word boundary with numbers)
 * isImpersonationName("sysadmin") // false (embedded)
 * isImpersonationName("supporting") // false (embedded)
 */
export const isImpersonationName = (name: string): boolean => {
  const trimmed = name.trim();
  const lowercase = trimmed.toLowerCase();
  const homoglyphNormalized = normalizeHomoglyphs(trimmed);

  return IMPERSONATION_NAMES.some((reserved) => {
    // Check 1: Original lowercase name with word boundaries (catches "admin123", "admin team")
    const originalMatch = hasReservedWordBoundary(lowercase, reserved);
    // Check 2: Homoglyph-normalized name with word boundaries (catches "adm1n", "@dmin")
    const homoglyphMatch = hasReservedWordBoundary(homoglyphNormalized, reserved);
    // Check 3: Homoglyph-normalized starts/ends with reserved word (catches "m0derat0r123")
    // This handles cases where trailing digits become letters after normalization
    const startsWithReserved = homoglyphNormalized.startsWith(reserved) &&
      (homoglyphNormalized.length === reserved.length || !/^[a-z]$/.test(lowercase[reserved.length] || ''));
    const endsWithReserved = homoglyphNormalized.endsWith(reserved) &&
      (homoglyphNormalized.length === reserved.length || !/^[a-z]$/.test(lowercase[lowercase.length - reserved.length - 1] || ''));
    return originalMatch || homoglyphMatch || startsWithReserved || endsWithReserved;
  });
};

/**
 * Mention keywords that conflict with system mentions.
 * These are checked as exact matches only (case insensitive), no homoglyph protection.
 */
const MENTION_RESERVED_NAMES = ['everyone', 'here', 'mod', 'manager'];

/**
 * Checks if a name is a reserved mention keyword (case insensitive exact match).
 * This is less strict than impersonation check - only blocks exact match.
 * Reason: These conflict with @everyone/@here mentions, not impersonation.
 *
 * @param name - The name to check
 * @returns true if name is exactly "everyone" or "here"
 *
 * @example
 * isMentionReserved("everyone") // true
 * isMentionReserved("here") // true
 * isMentionReserved("Here") // true
 * isMentionReserved("everyone loves me") // false (not exact)
 * isMentionReserved("3very0ne") // false (no homoglyph check)
 */
export const isMentionReserved = (name: string): boolean => {
  const normalized = name.trim().toLowerCase();
  return MENTION_RESERVED_NAMES.includes(normalized);
};

/**
 * @deprecated Use isMentionReserved instead
 */
export const isEveryoneReserved = isMentionReserved;

/**
 * Result of reserved name check with specific type for error messaging.
 * - 'mention': Conflicts with @everyone or @here mentions
 * - 'impersonation': Resembles admin/moderator/support names
 */
export type ReservedNameType = 'mention' | 'impersonation' | null;

/**
 * Checks if a name is reserved and returns the type of reservation.
 * Combines both mention keyword check and impersonation check.
 *
 * @param name - The name to check
 * @returns The type of reservation or null if not reserved
 *
 * @example
 * getReservedNameType("everyone") // 'mention'
 * getReservedNameType("here") // 'mention'
 * getReservedNameType("admin") // 'impersonation'
 * getReservedNameType("John") // null
 */
export const getReservedNameType = (name: string): ReservedNameType => {
  if (isMentionReserved(name)) return 'mention';
  if (isImpersonationName(name)) return 'impersonation';
  return null;
};

/**
 * Simple boolean check if a name is reserved (any type).
 *
 * @param name - The name to check
 * @returns true if the name is reserved
 */
export const isReservedName = (name: string): boolean => {
  return getReservedNameType(name) !== null;
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

// ============================================
// SPACE TAG VALIDATION
// ============================================

/**
 * Required length for Space Tag letter codes.
 */
export const SPACE_TAG_LETTERS_LENGTH = 4;

/**
 * Maximum byte length for space tag image data URIs.
 * Expected: 3-6 KB for a compressed tag badge. Cap at 50 KB to reject abuse
 * while allowing reasonable headroom for different image complexities.
 */
export const MAX_SPACE_TAG_URL_BYTES = 50_000;

/**
 * Validates Space Tag letter codes.
 * Must be exactly 4 uppercase alphanumeric characters (A-Z, 0-9).
 * Safe from XSS - alphanumeric only, no HTML patterns possible.
 *
 * @param letters - The letters to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * validateSpaceTagLetters("GAME") // true
 * validateSpaceTagLetters("DEV1") // true
 * validateSpaceTagLetters("abc") // false (lowercase, wrong length)
 * validateSpaceTagLetters("GAME!") // false (special char)
 */
export const validateSpaceTagLetters = (letters: string): boolean => {
  if (letters.length !== SPACE_TAG_LETTERS_LENGTH) return false;
  return /^[A-Z0-9]{4}$/.test(letters);
};

/**
 * Validates a space tag image URL for safe rendering.
 *
 * Security checks:
 * 1. Must be a base64-encoded PNG or JPEG data URI (rejects SVG to prevent XSS)
 * 2. Must not exceed MAX_SPACE_TAG_URL_BYTES (prevents storage/bandwidth abuse)
 *
 * @param url - The data URI to validate
 * @returns true if safe to render in an <img> tag, false otherwise
 */
export const isValidSpaceTagUrl = (url: string): boolean => {
  if (!url) return false;
  if (url.length > MAX_SPACE_TAG_URL_BYTES) return false;
  return url.startsWith('data:image/png;base64,') || url.startsWith('data:image/jpeg;base64,');
};
