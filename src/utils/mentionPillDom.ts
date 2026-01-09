/**
 * Mention Pill DOM Utilities
 *
 * Pure utility functions for creating and manipulating mention pills in contentEditable editors.
 * These functions are web-specific (use DOM APIs) and have zero React dependencies.
 *
 * @module mentionPillDom
 */

import type { MentionOption } from '../hooks/business/mentions/useMentionInput';

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
    return {
      type: 'user',
      displayName: option.data.displayName || 'Unknown User',
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

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset?.mentionType && el.dataset?.mentionAddress) {
        const prefix = el.dataset.mentionType === 'channel' ? '#' : '@';

        // Always use legacy format for storage
        // Pills provide the visual UX, so no need for enhanced format @[Name]<address>
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
      } else {
        node.childNodes.forEach(walk);
      }
    }
  };

  editorElement.childNodes.forEach(walk);
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
