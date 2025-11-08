/**
 * Validation utilities for user input security
 *
 * This module provides validation functions to prevent XSS (Cross-Site Scripting)
 * attacks by blocking dangerous HTML characters in user-controlled content like
 * display names and space names.
 */

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
