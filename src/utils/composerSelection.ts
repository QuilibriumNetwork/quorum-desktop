/**
 * Composer Selection Utilities
 *
 * Helpers for remembering and restoring the caret inside the composer's
 * contentEditable editor.
 *
 * Why this exists: the emoji panel is a sibling of the composer, so using it
 * moves DOM focus away from the editor. Chromium keeps the editor's selection
 * alive when focus lands on a plain `<button>`, but NOT when it lands on a
 * text-editing element — clicking the picker's search box moves the document
 * selection into that input. Once that has happened, calling `editor.focus()`
 * puts the caret at offset 0, so the emoji is inserted at the very start of the
 * message instead of where the user was typing.
 *
 * The fix is to record the last caret position that was genuinely inside the
 * editor and put it back before inserting.
 *
 * Platform: Web-only (uses DOM Selection/Range APIs).
 *
 * @module composerSelection
 */

/**
 * A remembered caret position.
 *
 * `anchorNode` is deliberately kept alongside the range. A Range — including
 * one returned by `cloneRange()` — stays *live*: the DOM spec makes the browser
 * rewrite its boundary points when nodes are removed. So after the send path
 * wipes the editor (`innerHTML = ''`), the range does not become invalid, it
 * quietly collapses to `(editor, 0)` and would restore the caret to the start
 * of whatever text appears next. Holding our own reference to the node the
 * caret was actually in is what lets us notice it was removed.
 */
export interface SavedCaret {
  range: Range;
  anchorNode: Node;
}

/**
 * Is this range anchored inside the given editor element?
 *
 * `Node.contains` reports true for the element itself, which is what we want:
 * a caret in an empty editor has the editor as its container.
 */
export function isRangeInsideEditor(editor: HTMLElement, range: Range): boolean {
  return editor.contains(range.commonAncestorContainer);
}

/**
 * Read the current caret, but only if it sits inside the editor.
 *
 * Returns null when there is no selection or it belongs to some other element
 * — which is exactly the case the remembered caret exists to cover.
 */
export function readSelectionInsideEditor(editor: HTMLElement): SavedCaret | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!isRangeInsideEditor(editor, range)) return null;

  return { range: range.cloneRange(), anchorNode: range.startContainer };
}

/** Collapse the caret to the very end of the editor's content. */
export function placeCaretAtEnd(editor: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Is a previously saved caret still meaningful?
 *
 * False once the node it pointed into has left the document — sending a message
 * clears the editor, and any caret remembered from the sent text is stale.
 */
export function isSavedCaretUsable(
  editor: HTMLElement,
  saved: SavedCaret | null
): saved is SavedCaret {
  if (!saved) return false;
  if (!saved.anchorNode.isConnected) return false;
  return editor.contains(saved.anchorNode);
}

/**
 * Put the caret back where it was before focus left the editor.
 *
 * Falls back to the end of the content when there is nothing usable to restore
 * — appending is the sane default, and it is what a user expects when they open
 * the panel without ever having placed a caret.
 *
 * The caller is responsible for focusing the editor first; restoring a range on
 * an unfocused element does not make it the active selection in all browsers.
 */
export function restoreSelectionInEditor(
  editor: HTMLElement,
  saved: SavedCaret | null
): void {
  const selection = window.getSelection();
  if (!selection) return;

  if (!isSavedCaretUsable(editor, saved)) {
    placeCaretAtEnd(editor);
    return;
  }

  selection.removeAllRanges();
  selection.addRange(saved.range);
}

/** Default insertion: `execCommand` keeps the editor's native undo stack. */
function execInsertText(text: string): boolean {
  return document.execCommand('insertText', false, text);
}

/**
 * Focus the editor, put the caret back where it was, then insert.
 *
 * The order is the whole point and is why this lives here rather than inline at
 * the call site: `focus()` must come first (restoring a range on an unfocused
 * element does not make it the active selection everywhere), and the restore
 * must come before the insert (`execCommand` writes at whatever the selection
 * is at that instant). Keeping the sequence in one place means a test can
 * verify the real ordering instead of a copy of it.
 *
 * `insert` is injectable so tests can observe the selection at insertion time;
 * jsdom implements neither `execCommand` nor the caret behaviour this works around.
 *
 * @returns whether the insertion reported success.
 */
export function insertTextAtSavedCaret(
  editor: HTMLElement,
  text: string,
  saved: SavedCaret | null,
  insert: (text: string) => boolean = execInsertText
): boolean {
  editor.focus();
  restoreSelectionInEditor(editor, saved);
  return insert(text);
}
