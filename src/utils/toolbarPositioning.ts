/**
 * Utility for calculating optimal positioning of floating toolbars above text selections
 */

const TOOLBAR_OFFSET = 52; // Space between selection and toolbar (includes arrow + padding)
const TOOLBAR_WIDTH = 240; // Approximate width of markdown toolbar
const VIEWPORT_PADDING = 16; // Minimum distance from viewport edges
const MIN_TOP_SPACING = 10; // Minimum space from top of viewport

export interface ToolbarPosition {
  top: number;
  left: number;
}

/**
 * Calculates the optimal position for a floating toolbar above a text selection
 * Handles viewport boundaries, multi-line selections, and centering
 *
 * Uses mirror element approach because textareas don't expose selection coordinates
 * directly through the browser's Selection API (which only works on contentEditable elements)
 *
 * @param textarea - The textarea element containing the selection
 * @returns Position object with top and left coordinates, or null if no selection
 */
export function calculateToolbarPosition(
  textarea: HTMLTextAreaElement
): ToolbarPosition | null {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  // No selection or empty selection
  if (start === end) {
    return null;
  }

  // Use mirror element approach for precise textarea selection measurement
  // This is necessary because textareas don't expose selection coordinates directly
  return calculatePositionWithMirror(textarea, start, end);
}

/**
 * Uses a mirror element for precise textarea selection measurement
 * This is necessary because textareas don't expose selection coordinates directly
 */
function calculatePositionWithMirror(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number
): ToolbarPosition {
  // Create a mirror div that matches the textarea's styling
  const mirror = createMirrorElement(textarea);
  document.body.appendChild(mirror);

  // Split text into before, selected, and after
  const textBefore = textarea.value.substring(0, start);
  const textSelected = textarea.value.substring(start, end);

  // Create text nodes and selection marker
  const beforeNode = document.createTextNode(textBefore);
  const selectionMarker = document.createElement('span');
  selectionMarker.textContent = textSelected;

  mirror.appendChild(beforeNode);
  mirror.appendChild(selectionMarker);

  // Get selection bounds
  const selectionRect = selectionMarker.getBoundingClientRect();

  // Clean up
  document.body.removeChild(mirror);

  // If mirror approach failed (no valid bounds), use simple centering on textarea
  if (selectionRect.width === 0 || selectionRect.height === 0) {
    return calculateSimpleToolbarPosition(textarea);
  }

  // Calculate position from selection bounds
  // Calculate horizontal center of selection
  const selectionCenterX = selectionRect.left + selectionRect.width / 2;

  // Calculate toolbar left position (centered on selection)
  let left = selectionCenterX - TOOLBAR_WIDTH / 2;

  // Constrain to viewport boundaries
  const viewportWidth = window.innerWidth;
  const maxLeft = viewportWidth - TOOLBAR_WIDTH - VIEWPORT_PADDING;
  const minLeft = VIEWPORT_PADDING;

  left = Math.max(minLeft, Math.min(left, maxLeft));

  // Calculate vertical position (above selection)
  // Use the top of the selection (handles multi-line selections)
  let top = selectionRect.top - TOOLBAR_OFFSET;

  // Ensure toolbar doesn't go off top of viewport
  if (top < MIN_TOP_SPACING) {
    // If not enough space above, position below the selection
    top = selectionRect.bottom + 12;

    // If still not enough space (very top of viewport), clamp to minimum spacing
    if (top < MIN_TOP_SPACING) {
      top = MIN_TOP_SPACING;
    }
  }

  return { top, left };
}

/**
 * Creates a mirror element that mimics the textarea's styling
 * Used to calculate the exact position of selected text
 */
function createMirrorElement(textarea: HTMLTextAreaElement): HTMLDivElement {
  const mirror = document.createElement('div');
  const computed = window.getComputedStyle(textarea);

  // Copy all relevant text and box styles
  const stylesToCopy = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'letterSpacing',
    'lineHeight',
    'textTransform',
    'padding',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'border',
    'borderWidth',
    'borderStyle',
    'boxSizing',
    'width',
  ];

  stylesToCopy.forEach((prop) => {
    mirror.style[prop as any] = computed[prop as any];
  });

  // Position the mirror at the same location as the textarea
  const textareaRect = textarea.getBoundingClientRect();
  mirror.style.position = 'absolute';
  mirror.style.top = `${textareaRect.top + window.scrollY}px`;
  mirror.style.left = `${textareaRect.left + window.scrollX}px`;
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.overflow = 'hidden';
  mirror.style.height = 'auto';
  mirror.style.zIndex = '-1000';

  // Account for textarea's internal scroll position
  mirror.style.marginTop = `-${textarea.scrollTop}px`;

  return mirror;
}

/**
 * Simplified fallback positioning when other methods fail
 * Positions toolbar above the textarea with basic centering
 */
function calculateSimpleToolbarPosition(
  textarea: HTMLTextAreaElement
): ToolbarPosition {
  const textareaRect = textarea.getBoundingClientRect();

  // Center horizontally on textarea
  let left = textareaRect.left + textareaRect.width / 2 - TOOLBAR_WIDTH / 2;

  // Position above textarea
  let top = textareaRect.top - TOOLBAR_OFFSET;

  // Constrain to viewport
  const viewportWidth = window.innerWidth;
  const maxLeft = viewportWidth - TOOLBAR_WIDTH - VIEWPORT_PADDING;
  const minLeft = VIEWPORT_PADDING;

  left = Math.max(minLeft, Math.min(left, maxLeft));

  // Ensure not off top of screen
  if (top < MIN_TOP_SPACING) {
    // Try positioning below
    top = textareaRect.bottom + 12;

    // If still not enough space, clamp to minimum
    if (top < MIN_TOP_SPACING) {
      top = MIN_TOP_SPACING;
    }
  }

  return { top, left };
}
