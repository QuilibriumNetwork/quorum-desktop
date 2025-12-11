/**
 * Touch interaction configuration constants
 * Centralized configuration for consistent touch behavior across the app
 */

export const TOUCH_INTERACTION_CONFIG = {
  /** Default delay before triggering long press (in milliseconds) */
  LONG_PRESS_DELAY: 500,

  /** Movement threshold in pixels before canceling long press */
  MOVEMENT_THRESHOLD: 10,

  /** Slightly longer delay for message long press interactions */
  MESSAGE_LONG_PRESS_DELAY: 600,

  /** Quick feedback delay for acknowledgment taps */
  QUICK_TAP_DELAY: 0,

  /**
   * Movement threshold for drag-and-drop elements (in pixels)
   * Higher than standard threshold to distinguish drag from long-press
   * Must match dnd-kit PointerSensor activationConstraint.distance
   */
  DRAG_MOVEMENT_THRESHOLD: 15,
} as const;

/**
 * Touch interaction types for different UI elements
 */
export const TOUCH_INTERACTION_TYPES = {
  /** Standard interaction for buttons, menu items */
  STANDARD: {
    delay: TOUCH_INTERACTION_CONFIG.LONG_PRESS_DELAY,
    threshold: TOUCH_INTERACTION_CONFIG.MOVEMENT_THRESHOLD,
  },

  /** Interaction for message bubbles, content areas */
  CONTENT: {
    delay: TOUCH_INTERACTION_CONFIG.MESSAGE_LONG_PRESS_DELAY,
    threshold: TOUCH_INTERACTION_CONFIG.MOVEMENT_THRESHOLD,
  },

  /** Quick interactions for navigation, selections */
  QUICK: {
    delay: TOUCH_INTERACTION_CONFIG.LONG_PRESS_DELAY,
    threshold: TOUCH_INTERACTION_CONFIG.MOVEMENT_THRESHOLD,
  },

  /**
   * Drag-and-drop interaction for elements using dnd-kit
   * IMPORTANT: Do NOT use useLongPress hook with draggable elements - it conflicts with dnd-kit.
   * Instead, use raw touch events (onTouchStart/Move/End) which run in parallel with pointer events.
   * See: .agents/reports/dnd-kit-touch-best-practices_2025-12-11.md
   */
  DRAG_AND_DROP: {
    delay: TOUCH_INTERACTION_CONFIG.LONG_PRESS_DELAY,
    threshold: TOUCH_INTERACTION_CONFIG.DRAG_MOVEMENT_THRESHOLD,
    /** dnd-kit PointerSensor distance activation for touch devices */
    dragActivationDistance: TOUCH_INTERACTION_CONFIG.DRAG_MOVEMENT_THRESHOLD,
    /** dnd-kit PointerSensor distance activation for mouse */
    mouseActivationDistance: 8,
  },
} as const;