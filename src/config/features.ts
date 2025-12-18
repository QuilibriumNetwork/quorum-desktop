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
 * DM Action Queue Feature Flags
 *
 * Granular control over which DM actions use the action queue with
 * Double Ratchet encryption vs falling back to legacy paths.
 *
 * When disabled (false): Falls back to legacy WebSocket outbound queue
 * When enabled (true): Uses action queue handlers with Double Ratchet
 *
 * Use these to isolate which action type might be causing issues.
 */
export const DM_ACTION_QUEUE = {
  /** Master switch - if false, all DM actions use legacy path */
  ENABLED: true,
  /** reaction-dm handler */
  REACTION: true,
  /** delete-dm handler */
  DELETE: true,
  /** edit-dm handler */
  EDIT: true,
} as const;

/** Helper to check if a specific DM action queue feature is enabled */
export function isDmActionEnabled(action: 'REACTION' | 'DELETE' | 'EDIT'): boolean {
  return DM_ACTION_QUEUE.ENABLED && DM_ACTION_QUEUE[action];
}

/** @deprecated Use DM_ACTION_QUEUE.ENABLED or isDmActionEnabled() instead */
export const ENABLE_DM_ACTION_QUEUE = DM_ACTION_QUEUE.ENABLED;
