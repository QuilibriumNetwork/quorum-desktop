import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isRangeInsideEditor,
  readSelectionInsideEditor,
  placeCaretAtEnd,
  isSavedCaretUsable,
  restoreSelectionInEditor,
  insertTextAtSavedCaret,
} from '../../../utils/composerSelection';

/**
 * Guards the emoji-at-the-start bug: using the emoji panel moved focus out of
 * the composer, and once the document selection had moved into the picker's
 * search box, focus() collapsed the caret to offset 0 — so the emoji was
 * inserted at the beginning of the message instead of at the caret.
 *
 * WHAT THESE TESTS DO NOT COVER — read before trusting a green run.
 *
 * jsdom does not model the mechanism of the bug at all. Its `focus()` only
 * checks focusability and fires events; it never touches Selection/Range state,
 * so the real Chromium behaviour of collapsing the caret to offset 0 on refocus
 * cannot happen here. `document.execCommand` does not exist in jsdom either.
 *
 * So these tests prove that composerSelection's functions are internally
 * correct — they save, detect staleness, restore, and fall back as intended.
 * They do NOT prove that the fix works in a browser. The browser-level evidence
 * came from a throwaway Electron harness driving real input events, recorded in
 * .agents/issues/2026-08-06-emoji-panel-inserts-at-start-of-message.md.
 *
 * The call-order test at the bottom covers the wiring in MessageComposer that
 * these unit tests otherwise leave completely unverified.
 */

let editor: HTMLDivElement;
let outsideInput: HTMLInputElement;

/** Collapse the caret inside the editor's first text node at `offset`. */
function putCaretAt(offset: number) {
  const textNode = editor.firstChild!;
  const range = document.createRange();
  range.setStart(textNode, offset);
  range.collapse(true);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Where is the caret now, as a character offset in the editor? */
function caretOffset(): number {
  const selection = window.getSelection()!;
  const range = selection.getRangeAt(0);
  const probe = document.createRange();
  probe.selectNodeContents(editor);
  probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString().length;
}

beforeEach(() => {
  document.body.innerHTML = '';
  editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.textContent = 'hello world';
  document.body.appendChild(editor);

  outsideInput = document.createElement('input');
  document.body.appendChild(outsideInput);

  window.getSelection()!.removeAllRanges();
});

describe('isRangeInsideEditor', () => {
  it('is true for a caret in the editor text', () => {
    putCaretAt(5);
    const range = window.getSelection()!.getRangeAt(0);
    expect(isRangeInsideEditor(editor, range)).toBe(true);
  });

  it('is true for a caret in an empty editor (container is the editor itself)', () => {
    editor.textContent = '';
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(true);
    expect(isRangeInsideEditor(editor, range)).toBe(true);
  });

  it('is false for a range belonging to another element', () => {
    const other = document.createElement('p');
    other.textContent = 'somewhere else';
    document.body.appendChild(other);
    const range = document.createRange();
    range.selectNodeContents(other);
    expect(isRangeInsideEditor(editor, range)).toBe(false);
  });

  it('is false for a selection that starts in the editor but ends outside it', () => {
    // Dragging a selection out of the composer and into the page. startContainer
    // is inside the editor, so a check on that alone would wrongly say "inside";
    // commonAncestorContainer is body, which is what makes this false.
    const other = document.createElement('p');
    other.textContent = 'somewhere else';
    document.body.appendChild(other);

    const range = document.createRange();
    range.setStart(editor.firstChild!, 3);
    range.setEnd(other.firstChild!, 4);

    expect(range.startContainer.parentElement).toBe(editor);
    expect(isRangeInsideEditor(editor, range)).toBe(false);
  });
});

describe('readSelectionInsideEditor', () => {
  it('returns the caret when it is inside the editor', () => {
    putCaretAt(5);
    const saved = readSelectionInsideEditor(editor);
    expect(saved).not.toBeNull();
    expect(saved!.range.startOffset).toBe(5);
  });

  it('returns null when the selection lives outside the editor', () => {
    const other = document.createElement('p');
    other.textContent = 'elsewhere';
    document.body.appendChild(other);
    const range = document.createRange();
    range.setStart(other.firstChild!, 2);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(readSelectionInsideEditor(editor)).toBeNull();
  });

  it('returns null when there is no selection at all', () => {
    window.getSelection()!.removeAllRanges();
    expect(readSelectionInsideEditor(editor)).toBeNull();
  });

  it('returns a clone, so collapsing the live selection does not move it', () => {
    putCaretAt(5);
    const saved = readSelectionInsideEditor(editor)!;

    // Mutate the *live* selection object itself. Without cloneRange() the
    // returned range IS the live one and would collapse to the end with it.
    const live = window.getSelection()!.getRangeAt(0);
    live.selectNodeContents(editor);
    live.collapse(false);

    expect(saved.range.startOffset).toBe(5);
    expect(saved.range.startContainer).toBe(editor.firstChild);
  });
});

describe('isSavedCaretUsable', () => {
  it('rejects null', () => {
    expect(isSavedCaretUsable(editor, null)).toBe(false);
  });

  it('accepts a range still attached to the editor', () => {
    putCaretAt(3);
    const saved = readSelectionInsideEditor(editor);
    expect(isSavedCaretUsable(editor, saved)).toBe(true);
  });

  it('rejects a range whose nodes were wiped by sending the message', () => {
    putCaretAt(3);
    const saved = readSelectionInsideEditor(editor);
    // This is what the send path does — MessageComposer.tsx clears the editor.
    editor.innerHTML = '';
    expect(isSavedCaretUsable(editor, saved)).toBe(false);
  });
});

describe('restoreSelectionInEditor', () => {
  it('puts the caret back where it was after focus moved to another input', () => {
    putCaretAt(5); // right after "hello"
    const saved = readSelectionInsideEditor(editor);

    // Simulate the picker's search box taking the selection with it.
    outsideInput.focus();
    const stolen = document.createRange();
    stolen.selectNodeContents(outsideInput);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(stolen);
    expect(readSelectionInsideEditor(editor)).toBeNull();

    editor.focus();
    restoreSelectionInEditor(editor, saved);

    expect(caretOffset()).toBe(5);
  });

  it('falls back to the end of the content when nothing was saved', () => {
    restoreSelectionInEditor(editor, null);
    expect(caretOffset()).toBe('hello world'.length);
  });

  it('falls back to the end when the saved range was invalidated', () => {
    putCaretAt(2);
    const saved = readSelectionInsideEditor(editor);
    editor.innerHTML = '';
    editor.textContent = 'a fresh draft';

    restoreSelectionInEditor(editor, saved);

    expect(caretOffset()).toBe('a fresh draft'.length);
  });

  it('leaves an empty editor at offset 0', () => {
    editor.textContent = '';
    restoreSelectionInEditor(editor, null);
    expect(caretOffset()).toBe(0);
  });
});

describe('placeCaretAtEnd', () => {
  it('collapses to the end of the text', () => {
    putCaretAt(0);
    placeCaretAtEnd(editor);
    expect(caretOffset()).toBe('hello world'.length);
  });
});

/**
 * Covers the wiring MessageComposer.insertEmoji depends on. The injected
 * `insert` records where the caret actually is at the moment of insertion,
 * which is the only thing that determines where the emoji lands.
 */
describe('insertTextAtSavedCaret', () => {
  /** Steal the selection the way the emoji picker's search box does. */
  function stealSelectionIntoInput() {
    outsideInput.focus();
    const stolen = document.createRange();
    stolen.selectNodeContents(outsideInput);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(stolen);
  }

  it('has restored the caret by the time the insert runs', () => {
    putCaretAt(5); // right after "hello"
    const saved = readSelectionInsideEditor(editor);
    stealSelectionIntoInput();

    let offsetAtInsert = -1;
    let insideEditorAtInsert = false;
    insertTextAtSavedCaret(editor, '@', saved, () => {
      offsetAtInsert = caretOffset();
      insideEditorAtInsert = readSelectionInsideEditor(editor) !== null;
      return true;
    });

    // Not merely "restored eventually" — restored BEFORE the insert ran.
    expect(insideEditorAtInsert).toBe(true);
    expect(offsetAtInsert).toBe(5);
  });

  it('has focused the editor by the time the insert runs', () => {
    putCaretAt(5);
    const saved = readSelectionInsideEditor(editor);
    stealSelectionIntoInput();

    // Asserting on document.activeElement would not work: jsdom does not treat
    // a contentEditable div as focusable, so focus() never moves activeElement
    // here. Spying on the call is what can actually be verified in jsdom, and
    // it is the ordering that matters — in a real browser focus() must precede
    // the restore or the restored range is not the active selection.
    const focusSpy = vi.spyOn(editor, 'focus');

    let focusCallsAtInsert = -1;
    insertTextAtSavedCaret(editor, '@', saved, () => {
      focusCallsAtInsert = focusSpy.mock.calls.length;
      return true;
    });

    expect(focusCallsAtInsert).toBe(1);
    focusSpy.mockRestore();
  });

  it('falls back to the end rather than the start when nothing is saved', () => {
    stealSelectionIntoInput();

    let offsetAtInsert = -1;
    insertTextAtSavedCaret(editor, '@', null, () => {
      offsetAtInsert = caretOffset();
      return true;
    });

    // The bug was insertion at 0; the no-saved-caret fallback must not land there.
    expect(offsetAtInsert).toBe('hello world'.length);
  });

  it('reports the insert result back to the caller', () => {
    putCaretAt(1);
    const saved = readSelectionInsideEditor(editor);
    expect(insertTextAtSavedCaret(editor, '@', saved, () => false)).toBe(false);
    expect(insertTextAtSavedCaret(editor, '@', saved, () => true)).toBe(true);
  });
});
