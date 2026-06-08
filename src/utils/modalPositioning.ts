import { MODAL_DIMENSIONS, SPACING } from '../constants/ui';

export interface ModalPositionConfig {
  elementRect: DOMRect;
  modalWidth?: number;
  modalHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  rightSidebarWidth?: number;
  context?: {
    type: 'mention' | 'message-avatar' | 'sidebar';
  };
}

export interface ModalPosition {
  top: number;
  left?: number;
}

/**
 * Calculate optimal position for a modal relative to a trigger element
 * Handles viewport boundary detection and smart repositioning
 */
export const calculateModalPosition = (config: ModalPositionConfig): ModalPosition => {
  const {
    elementRect,
    modalWidth = MODAL_DIMENSIONS.USER_PROFILE_WIDTH,
    modalHeight = MODAL_DIMENSIONS.USER_PROFILE_HEIGHT,
    viewportWidth = window.innerWidth,
    viewportHeight = window.innerHeight,
    rightSidebarWidth = 0,
    context
  } = config;

  const position: ModalPosition = { top: 0 };

  // Default vertical position: align the modal's top with the trigger's top.
  // Then clamp so the modal stays inside the viewport — without this,
  // triggers near the bottom of the screen produce a card whose bottom
  // edge runs off-screen (UserProfile can grow when the user has a bio
  // and/or many roles + an open note).
  const maxTop = viewportHeight - modalHeight - SPACING.VIEWPORT_BOTTOM_PADDING;
  const minTop = SPACING.MODAL_EDGE_PADDING;
  position.top = Math.max(minTop, Math.min(elementRect.top, maxTop));

  // Calculate horizontal position based on context
  if (context?.type === 'mention' || context?.type === 'message-avatar') {
    position.left = calculateHorizontalPosition(
      elementRect,
      modalWidth,
      viewportWidth,
      rightSidebarWidth
    );
  }
  // For sidebar context, we don't set left (uses fixed CSS positioning)

  return position;
};


/**
 * Calculate horizontal position for relative positioning contexts
 */
const calculateHorizontalPosition = (
  elementRect: DOMRect,
  modalWidth: number,
  viewportWidth: number,
  rightSidebarWidth: number
): number => {
  const availableWidth = viewportWidth - rightSidebarWidth;

  // Default: Position to the right of element with gap
  let left = elementRect.left + elementRect.width + SPACING.MODAL_ELEMENT_GAP;

  // If modal would go off-screen horizontally, position it to the left of the element instead
  if (left + modalWidth > availableWidth) {
    left = elementRect.left - modalWidth - SPACING.MODAL_ELEMENT_GAP;
  }

  // Ensure modal doesn't go off the left edge
  if (left < SPACING.MODAL_EDGE_PADDING) {
    left = SPACING.MODAL_EDGE_PADDING;
  }

  return left;
};