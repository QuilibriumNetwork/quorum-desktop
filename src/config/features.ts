/**
 * Feature Flags Configuration
 *
 * Centralized feature toggles for the application.
 * Update these flags to enable/disable features without code deletion.
 */

/**
 * Markdown Rendering Feature
 *
 * Controls markdown rendering and formatting toolbar in messages.
 * When disabled, messages will use plain text rendering.
 *
 * @default false - Temporarily disabled for security review
 * To re-enable: Set to true
 */
export const ENABLE_MARKDOWN = false;
