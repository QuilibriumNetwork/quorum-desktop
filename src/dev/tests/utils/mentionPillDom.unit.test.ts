/**
 * Unit tests for extractStorageTextFromEditor — the contentEditable → storage
 * string serializer used by the message composer and the edit textarea.
 *
 * Focus: newline reconstruction (regression — multi-line messages were
 * flattened to a single line because the walker ignored block elements and
 * <br>). Browsers represent contentEditable line breaks as either <br> nodes or
 * by wrapping each line after the first in its own <div>/<p>; both shapes are
 * exercised here. See .agents/bugs/2026-06-25-composer-paste-strips-newlines.md.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import {
  extractStorageTextFromEditor,
  extractVisualTextWithNewlines,
} from '../../../utils/mentionPillDom';

/** Build a contentEditable editor div from an HTML string. */
function editor(html: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('contenteditable', 'true');
  el.innerHTML = html;
  return el;
}

/** Build a mention pill span the way the composer does. */
function pill(type: 'user' | 'role' | 'channel' | 'everyone', address: string, label: string): string {
  return `<span data-mention-type="${type}" data-mention-address="${address}">${label}</span>`;
}

describe('extractStorageTextFromEditor — basic content', () => {
  it('returns plain single-line text unchanged', () => {
    expect(extractStorageTextFromEditor(editor('hello world'))).toBe('hello world');
  });

  it('serializes a user pill to @<address>', () => {
    const html = `hi ${pill('user', 'QmAddr123', '@Alice')} there`;
    expect(extractStorageTextFromEditor(editor(html))).toBe('hi @<QmAddr123> there');
  });

  it('serializes role / channel / everyone pills', () => {
    expect(extractStorageTextFromEditor(editor(pill('role', 'admin', '@admin')))).toBe('@admin');
    expect(extractStorageTextFromEditor(editor(pill('channel', 'chan-1', '#general')))).toBe('#<chan-1>');
    expect(extractStorageTextFromEditor(editor(pill('everyone', 'everyone', '@everyone')))).toBe('@everyone');
  });
});

describe('extractStorageTextFromEditor — newline reconstruction (the regression)', () => {
  it('reconstructs newlines from <br> elements', () => {
    expect(extractStorageTextFromEditor(editor('line1<br>line2<br>line3'))).toBe('line1\nline2\nline3');
  });

  it('reconstructs newlines from per-line <div> wrapping (Chrome paste shape)', () => {
    // First line is bare text; each subsequent line is its own <div>.
    const html = 'line1<div>line2</div><div>line3</div>';
    expect(extractStorageTextFromEditor(editor(html))).toBe('line1\nline2\nline3');
  });

  it('handles an all-div shape (every line wrapped)', () => {
    const html = '<div>line1</div><div>line2</div>';
    // Leading <div> opens line 2 relative to an empty line 1 → one newline between.
    expect(extractStorageTextFromEditor(editor(html))).toBe('line1\nline2');
  });

  it('represents an empty line as a single newline (<div><br></div>)', () => {
    // "a", blank line, "b" → a\n\nb
    const html = 'a<div><br></div><div>b</div>';
    expect(extractStorageTextFromEditor(editor(html))).toBe('a\n\nb');
  });

  it('does not double-count a trailing filler <br> inside a block', () => {
    const html = 'a<div>b<br></div>';
    expect(extractStorageTextFromEditor(editor(html))).toBe('a\nb');
  });

  it('preserves newlines around mention pills', () => {
    const html = `${pill('user', 'QmX', '@X')}<div>second line</div>`;
    expect(extractStorageTextFromEditor(editor(html))).toBe('@<QmX>\nsecond line');
  });

  it('reconstructs a multi-block paste (header + blank + list lines)', () => {
    // Mimics pasting:  # Title\n\n- one\n- two
    const html = '# Title<div><br></div><div>- one</div><div>- two</div>';
    expect(extractStorageTextFromEditor(editor(html))).toBe('# Title\n\n- one\n- two');
  });

  it('keeps an unclosed code fence on its own line (the empty-code-box repro)', () => {
    const html = '```<div>code line 1</div><div>code line 2</div>';
    expect(extractStorageTextFromEditor(editor(html))).toBe('```\ncode line 1\ncode line 2');
  });
});

describe('extractVisualTextWithNewlines — visible text with line breaks', () => {
  it('returns plain single-line text unchanged', () => {
    expect(extractVisualTextWithNewlines(editor('hello world'))).toBe('hello world');
  });

  it('renders pills as their visible label, not the storage token', () => {
    const html = `hi ${pill('user', 'QmAddr123', '@Alice')} there`;
    expect(extractVisualTextWithNewlines(editor(html))).toBe('hi @Alice there');
  });

  it('reconstructs newlines from <br> and per-line <div> (the format-collapse repro)', () => {
    expect(extractVisualTextWithNewlines(editor('line1<br>line2<br>line3'))).toBe(
      'line1\nline2\nline3'
    );
    expect(
      extractVisualTextWithNewlines(editor('line1<div>line2</div><div>line3</div>'))
    ).toBe('line1\nline2\nline3');
  });

  it('represents a blank line between paragraphs as a single newline', () => {
    const html = 'para1<div><br></div><div>para2</div>';
    expect(extractVisualTextWithNewlines(editor(html))).toBe('para1\n\npara2');
  });

  it('does NOT trim, so leading/trailing whitespace offsets stay accurate', () => {
    expect(extractVisualTextWithNewlines(editor('  hi  '))).toBe('  hi  ');
  });

  it('measures a partial selection (fragment) with newlines preserved', () => {
    // Simulate Range.cloneContents() over "line1\nlin" of a two-<div> editor:
    // the fragment carries the leading text node plus a partial second block.
    const frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode('line1'));
    const div = document.createElement('div');
    div.textContent = 'lin';
    frag.appendChild(div);
    // "line1" + "\n" + "lin" = 9 chars — the offset the toolbar would record.
    expect(extractVisualTextWithNewlines(frag)).toBe('line1\nlin');
    expect(extractVisualTextWithNewlines(frag).length).toBe(9);
  });
});

describe('extractStorageTextFromEditor — trimming', () => {
  it('trims outer whitespace but keeps internal newlines', () => {
    expect(extractStorageTextFromEditor(editor('  hello<br>world  '))).toBe('hello\nworld');
  });

  it('returns empty string for an empty editor', () => {
    expect(extractStorageTextFromEditor(editor(''))).toBe('');
  });
});
