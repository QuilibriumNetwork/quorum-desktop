/**
 * Mention Pill DOM Utilities
 *
 * Pure utility functions for creating and manipulating mention pills in contentEditable editors.
 * These functions are web-specific (use DOM APIs) and have zero React dependencies.
 *
 * @module mentionPillDom
 */

import type { MentionOption } from '../hooks/business/mentions/useMentionInput';
import { resolveSpaceMemberName, formatResolvedName } from './resolveMemberName';

/**
 * Type of mention pill
 */
export type MentionPillType = 'user' | 'role' | 'channel' | 'everyone';

/**
 * Data structure for a mention pill
 */
export interface PillData {
  type: MentionPillType;
  displayName: string;
  address: string;
}

/**
 * CSS class mapping for pill types.
 * Matches the classes used in Message.tsx for consistent styling.
 */
export const MENTION_PILL_CLASSES = {
  user: 'message-mentions-user',
  role: 'message-mentions-role',
  channel: 'message-mentions-channel',
  everyone: 'message-mentions-everyone',
} as const;

/**
 * Convert a MentionOption to PillData for pill creation.
 *
 * @param option - The mention option from autocomplete
 * @returns Pill data with type, displayName, and address
 *
 * @example
 * const pillData = extractPillDataFromOption({
 *   type: 'user',
 *   data: { address: '0x123', displayName: 'Alice' }
 * });
 * // => { type: 'user', displayName: 'Alice', address: '0x123' }
 */
export function extractPillDataFromOption(option: MentionOption): PillData {
  if (option.type === 'user') {
    // Model B: the pill shows the resolved name (name.q when QNS-verified). The
    // ".q" is display-only — storage stays @<address> via dataset.mentionAddress
    // in extractStorageTextFromEditor, so the wire format is unchanged.
    const resolved = resolveSpaceMemberName({
      address: option.data.address,
      displayName: option.data.displayName,
      primaryUsername: option.data.primaryUsername,
      globalDisplayName: option.data.globalDisplayName,
    });
    return {
      type: 'user',
      displayName: formatResolvedName(resolved) || 'Unknown User',
      address: option.data.address,
    };
  } else if (option.type === 'role') {
    return {
      type: 'role',
      displayName: option.data.displayName,
      address: option.data.roleTag,
    };
  } else if (option.type === 'channel') {
    return {
      type: 'channel',
      displayName: option.data.channelName || 'Unknown Channel',
      address: option.data.channelId,
    };
  } else {
    return {
      type: 'everyone',
      displayName: 'everyone',
      address: 'everyone',
    };
  }
}

/**
 * Create a mention pill DOM element.
 *
 * @param pillData - The pill data (type, displayName, address)
 * @param onClick - Optional click handler for the pill
 * @returns HTML span element configured as a mention pill
 *
 * @example
 * const pill = createPillElement(
 *   { type: 'user', displayName: 'Alice', address: '0x123' },
 *   () => console.log('Pill clicked')
 * );
 * // Creates: <span class="message-mentions-user message-composer-pill"
 * //                data-mention-type="user"
 * //                data-mention-address="0x123"
 * //                data-mention-display-name="Alice"
 * //                contenteditable="false">@Alice</span>
 */
export function createPillElement(pillData: PillData, onClick?: () => void): HTMLSpanElement {
  const pillSpan = document.createElement('span');
  pillSpan.contentEditable = 'false';
  pillSpan.dataset.mentionType = pillData.type;
  pillSpan.dataset.mentionAddress = pillData.address;
  pillSpan.dataset.mentionDisplayName = pillData.displayName;

  pillSpan.className = `${MENTION_PILL_CLASSES[pillData.type]} message-composer-pill`;
  const prefix = pillData.type === 'channel' ? '#' : '@';
  pillSpan.textContent = `${prefix}${pillData.displayName}`;

  if (onClick) {
    pillSpan.addEventListener('click', onClick);
  }

  return pillSpan;
}

/**
 * Extract storage format text from a contentEditable editor.
 * Walks the DOM tree and converts pills to their storage representation.
 *
 * Storage formats:
 * - Users: `@<address>`
 * - Roles: `@roleTag` (no brackets)
 * - Channels: `#<channelId>`
 * - Everyone: `@everyone`
 *
 * @param editorElement - The contentEditable div element
 * @returns Text in storage format with mention IDs
 *
 * @example
 * // Editor contains: "Hello " + <pill user Alice 0x123> + " welcome!"
 * const text = extractStorageTextFromEditor(editorRef.current);
 * // => "Hello @<0x123> welcome!"
 */
export function extractStorageTextFromEditor(editorElement: HTMLElement): string {
  let text = '';

  // Block-level tags a contentEditable uses to represent visual lines. Browsers
  // keep the first line as inline/text content of the editor and wrap each
  // subsequent line in its own block element, so a `\n` must be emitted at the
  // start of every block boundary to reconstruct the original line breaks.
  const BLOCK_TAGS = new Set(['DIV', 'P']);

  // Walk the editor's DOM and serialize to storage text.
  // `isBlock` marks a node that opens a new visual line (a block element that is
  // not the editor's first child) so we can prefix it with a newline.
  const walk = (node: Node, isBlock: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;

    // A <br> is an explicit line break.
    if (el.tagName === 'BR') {
      text += '\n';
      return;
    }

    // Mention pills serialize to their storage token (no newline).
    if (el.dataset?.mentionType && el.dataset?.mentionAddress) {
      const prefix = el.dataset.mentionType === 'channel' ? '#' : '@';
      if (el.dataset.mentionType === 'role') {
        // Roles always use @roleTag format (no brackets)
        text += `@${el.dataset.mentionAddress}`;
      } else if (el.dataset.mentionType === 'everyone') {
        // @everyone always same format
        text += '@everyone';
      } else {
        // Legacy format: @<address> or #<channelId>
        text += `${prefix}<${el.dataset.mentionAddress}>`;
      }
      return;
    }

    // Other element: open a line break if this is a block boundary, then recurse.
    if (isBlock) {
      text += '\n';
    }

    const children = Array.from(el.childNodes);
    children.forEach((child, i) => {
      // A trailing <br> that is the sole/last child of a block is the filler
      // browsers insert into an otherwise-empty line; the block's own leading
      // newline already represents that line, so skip it to avoid a double `\n`.
      const isTrailingFillerBr =
        child.nodeType === Node.ELEMENT_NODE &&
        (child as HTMLElement).tagName === 'BR' &&
        i === children.length - 1 &&
        BLOCK_TAGS.has(el.tagName);
      if (isTrailingFillerBr) return;

      const childOpensBlock =
        child.nodeType === Node.ELEMENT_NODE &&
        BLOCK_TAGS.has((child as HTMLElement).tagName);
      walk(child, childOpensBlock);
    });
  };

  // Top-level children: the first child continues the first line (no leading
  // newline); each subsequent block-level child opens a new line.
  const topChildren = Array.from(editorElement.childNodes);
  topChildren.forEach((child, i) => {
    const opensBlock =
      i > 0 &&
      child.nodeType === Node.ELEMENT_NODE &&
      BLOCK_TAGS.has((child as HTMLElement).tagName);
    walk(child, opensBlock);
  });

  // Trim outer whitespace (matches the original behavior); the reconstruction
  // above only adds INTERNAL newlines, which trim() leaves intact.
  return text.trim();
}

/**
 * Get the current cursor position (character offset) in a contentEditable element.
 * Uses the Selection API to calculate the offset from the start of the element.
 *
 * @param editorElement - The contentEditable div element
 * @returns Character offset from the start of the element (0 if no selection)
 *
 * @example
 * // Editor contains: "Hello world", cursor is after "Hello "
 * const pos = getCursorPositionInElement(editorRef.current);
 * // => 6
 */
export function getCursorPositionInElement(editorElement: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(editorElement);
  preCaretRange.setEnd(range.endContainer, range.endOffset);

  return preCaretRange.toString().length;
}
