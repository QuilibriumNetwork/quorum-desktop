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
export const ENABLE_MARKDOWN = true;

/**
 * DM Action Queue Feature Flag
 *
 * Controls whether DM actions (send, edit, delete, reaction) use the
 * Action Queue with Double Ratchet encryption.
 *
 * When false: Falls back to legacy WebSocket outbound queue
 * When true: Uses action queue handlers with Double Ratchet
 */
export const ENABLE_DM_ACTION_QUEUE = true;
