/**
 * Utilities for getting caret (cursor) coordinates in text inputs.
 * Used for positioning dropdowns near where the user is typing.
 */

export interface CaretCoordinates {
  x: number;
  y: number;
  height: number;
}

/**
 * Get caret coordinates from a contentEditable element.
 * Uses the Selection API to get the current caret position.
 */
export function getCaretCoordinatesFromContentEditable(): CaretCoordinates | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // If rect is empty (collapsed selection at start), try getting from parent
  if (rect.width === 0 && rect.height === 0 && rect.x === 0 && rect.y === 0) {
    // Create a temporary span to measure position
    const span = document.createElement('span');
    span.textContent = '\u200B'; // Zero-width space
    range.insertNode(span);
    const spanRect = span.getBoundingClientRect();
    span.parentNode?.removeChild(span);

    // Normalize the range after removing span
    selection.removeAllRanges();
    selection.addRange(range);

    return {
      x: spanRect.left,
      y: spanRect.top,
      height: spanRect.height || 20, // Default line height if zero
    };
  }

  return {
    x: rect.left,
    y: rect.top,
    height: rect.height || 20,
  };
}

/**
 * Get caret coordinates from a textarea element.
 * Uses a mirror element technique to measure text position.
 */
export function getCaretCoordinatesFromTextarea(
  textarea: HTMLTextAreaElement
): CaretCoordinates | null {
  const { selectionStart } = textarea;
  if (selectionStart === null) {
    return null;
  }

  // Get computed styles from textarea
  const computed = window.getComputedStyle(textarea);
  const textareaRect = textarea.getBoundingClientRect();

  // Create mirror div
  const mirror = document.createElement('div');
  mirror.style.cssText = `
    position: absolute;
    top: -9999px;
    left: -9999px;
    visibility: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
  `;

  // Copy relevant styles
  const stylesToCopy = [
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'letter-spacing',
    'text-transform',
    'word-spacing',
    'text-indent',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'box-sizing',
    'line-height',
  ];

  stylesToCopy.forEach((style) => {
    mirror.style.setProperty(style, computed.getPropertyValue(style));
  });

  // Set width to match textarea
  mirror.style.width = `${textarea.clientWidth}px`;

  // Get text before caret
  const textBeforeCaret = textarea.value.substring(0, selectionStart);

  // Create text node for content before caret
  mirror.textContent = textBeforeCaret;

  // Create span for caret position
  const caretSpan = document.createElement('span');
  caretSpan.textContent = '|';
  mirror.appendChild(caretSpan);

  // Add rest of text (for accurate wrapping)
  const textAfterCaret = textarea.value.substring(selectionStart);
  mirror.appendChild(document.createTextNode(textAfterCaret));

  document.body.appendChild(mirror);

  // Get caret position relative to mirror
  const caretRect = caretSpan.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  // Calculate position relative to textarea
  const relativeX = caretRect.left - mirrorRect.left;
  const relativeY = caretRect.top - mirrorRect.top;

  // Account for scroll position in textarea
  const scrollTop = textarea.scrollTop;
  const scrollLeft = textarea.scrollLeft;

  document.body.removeChild(mirror);

  // Calculate absolute position
  const x = textareaRect.left + relativeX - scrollLeft;
  const y = textareaRect.top + relativeY - scrollTop;

  // Parse line height for caret height
  const lineHeight = parseFloat(computed.lineHeight) || 20;

  return {
    x,
    y,
    height: lineHeight,
  };
}

/**
 * Get caret coordinates from either a contentEditable or textarea element.
 */
export function getCaretCoordinates(
  element: HTMLElement | HTMLTextAreaElement | null,
  isContentEditable: boolean
): CaretCoordinates | null {
  if (!element) {
    return null;
  }

  if (isContentEditable) {
    return getCaretCoordinatesFromContentEditable();
  }

  if (element instanceof HTMLTextAreaElement) {
    return getCaretCoordinatesFromTextarea(element);
  }

  return null;
}
