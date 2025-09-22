/**
 * UI Constants for consistent sizing and spacing across the application
 */

export const MODAL_DIMENSIONS = {
  USER_PROFILE_WIDTH: 320,
  USER_PROFILE_HEIGHT: 400,
  RIGHT_SIDEBAR_WIDTH: 260,
} as const;

export const SPACING = {
  MODAL_EDGE_PADDING: 8,
  MODAL_ELEMENT_GAP: 8,
  VIEWPORT_BOTTOM_PADDING: 16,
} as const;

export type ModalDimensions = typeof MODAL_DIMENSIONS;
export type SpacingConstants = typeof SPACING;