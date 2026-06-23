/**
 * Measures the on-screen bounding rect of a textarea's current selection.
 *
 * Textareas don't expose selection coordinates through the Selection API (that
 * only works on contentEditable elements), so we mirror the textarea into a
 * hidden div and measure a span wrapping the selected substring. The returned
 * rect feeds a floating-ui virtual element so <MarkdownToolbar> can anchor to
 * the selection; placement (centering, flip above/below, viewport clamping) is
 * handled by FloatingPopover, not here.
 */

/**
 * Returns the viewport-relative DOMRect of the textarea's selected text, or
 * null when there is no selection. Falls back to the textarea's own rect when
 * the mirror measurement yields no usable bounds.
 */
export function getTextareaSelectionRect(
  textarea: HTMLTextAreaElement
): DOMRect | null {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  // No selection or empty selection
  if (start === end) {
    return null;
  }

  const mirror = createMirrorElement(textarea);
  document.body.appendChild(mirror);

  // Split into before / selected, wrapping the selection in a measurable span
  const textBefore = textarea.value.substring(0, start);
  const textSelected = textarea.value.substring(start, end);

  const beforeNode = document.createTextNode(textBefore);
  const selectionMarker = document.createElement('span');
  selectionMarker.textContent = textSelected;

  mirror.appendChild(beforeNode);
  mirror.appendChild(selectionMarker);

  const selectionRect = selectionMarker.getBoundingClientRect();

  document.body.removeChild(mirror);

  // Mirror approach failed (no valid bounds) — fall back to the textarea rect
  if (selectionRect.width === 0 || selectionRect.height === 0) {
    return textarea.getBoundingClientRect();
  }

  return selectionRect;
}

/**
 * Creates a hidden mirror element that mimics the textarea's styling, used to
 * measure the exact on-screen position of the selected text.
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
