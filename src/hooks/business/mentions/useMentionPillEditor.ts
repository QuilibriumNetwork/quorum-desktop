/**
 * Mention Pill Editor Hook
 *
 * React hook for managing mention pills in contentEditable editors.
 * Provides functions for inserting pills, extracting text, and managing cursor position.
 *
 * Features:
 * - Insert mention pills at cursor position
 * - Extract visual text (for mention detection) and storage text (with IDs)
 * - Get cursor position in contentEditable
 * - Event delegation for pill click handlers (prevents memory leaks)
 *
 * Platform: Web-only (uses DOM APIs and contentEditable)
 *
 * @module useMentionPillEditor
 *
 * @example
 * ```tsx
 * function MessageComposer() {
 *   const { resolve } = useNameResolver();
 *   const pillEditor = useMentionPillEditor({
 *     onTextChange: (text) => setMessageText(text),
 *     resolveName: (address) => {
 *       const r = resolve(address);
 *       return r.isQnsVerified ? `${r.name}.q` : r.name;
 *     },
 *   });
 *
 *   const { editorRef, insertPill, extractVisualText, getCursorPosition } = pillEditor;
 *
 *   return (
 *     <div
 *       ref={editorRef}
 *       contentEditable
 *       onInput={() => {
 *         const text = pillEditor.extractStorageText();
 *         onTextChange(text);
 *       }}
 *     />
 *   );
 * }
 * ```
 */

import { useRef, useCallback, useEffect } from 'react';
import type { MentionOption } from './useMentionInput';
import {
  createPillElement,
  extractStorageTextFromEditor,
  getCursorPositionInElement,
  type PillData,
} from '../../../utils/mentionPillDom';

/**
 * Options for the useMentionPillEditor hook
 */
export interface UseMentionPillEditorOptions {
  /** Callback when text changes (receives storage format text) */
  onTextChange: (text: string) => void;
  /**
   * Resolve a user address to the label its pill should carry, e.g.
   * `useNameResolver().resolve` with the ".q" suffix applied. Required for
   * `insertPill` to build a 'user' pill.
   *
   * This hook used to build user pills via `mentionPillDom`'s
   * `extractPillDataFromOption`, which resolves a name ITSELF
   * (`resolveMentionPillName`) from whatever fields the picked
   * `MentionOption` happened to carry — a second, independent resolution
   * path that could drift from how the SAME address renders in a message
   * header or an already-inserted pill. `resolveName` routes user pills
   * through the identity module instead, the same read every other migrated
   * surface uses. See `.agents/issues/.open/2026-08-10-identity-resolution-architecture-design.md`.
   */
  resolveName: (address: string) => string;
}

/**
 * Return value from the useMentionPillEditor hook
 */
export interface UseMentionPillEditorReturn {
  /** Ref to attach to contentEditable div */
  editorRef: React.RefObject<HTMLDivElement | null>;

  /** Extract visual text (what user sees) for mention detection */
  extractVisualText: () => string;

  /** Extract storage format text (with IDs) */
  extractStorageText: () => string;

  /** Get current cursor position */
  getCursorPosition: () => number;

  /** Insert a mention pill at specified position */
  insertPill: (option: MentionOption, mentionStart: number, mentionEnd: number) => void;
}

/**
 * Hook for managing mention pills in a contentEditable editor.
 *
 * This hook provides all the functionality needed to:
 * - Insert mention pills at the cursor
 * - Extract text in both visual and storage formats
 * - Track cursor position
 * - Handle pill click events (with event delegation to prevent memory leaks)
 *
 * @param options - Hook configuration options
 * @returns Object with editorRef and pill management functions
 */
export function useMentionPillEditor(
  options: UseMentionPillEditorOptions
): UseMentionPillEditorReturn {
  const { onTextChange, resolveName } = options;
  const editorRef = useRef<HTMLDivElement>(null);

  /**
   * Build the pill data for a picked MentionOption. User pills route through
   * `resolveName` (the identity module) instead of `mentionPillDom`'s own
   * `extractPillDataFromOption` — see `UseMentionPillEditorOptions.resolveName`.
   * Role/channel/everyone pills carry no member identity, so they're built
   * the same way `extractPillDataFromOption` always did.
   */
  const buildPillData = useCallback(
    (option: MentionOption): PillData => {
      if (option.type === 'user') {
        return {
          type: 'user',
          displayName: resolveName(option.data.address),
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
        return { type: 'everyone', displayName: 'everyone', address: 'everyone' };
      }
    },
    [resolveName]
  );

  /**
   * Event delegation for pill clicks.
   * Uses a single listener on the parent element instead of per-pill listeners.
   * This prevents memory leaks in long-running Electron applications.
   */
  useEffect(() => {
    const handlePillClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if the clicked element is a mention pill
      if (target.dataset?.mentionType) {
        target.remove();
        const newText = extractStorageTextFromEditor(editorRef.current!);
        onTextChange(newText);
      }
    };

    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener('click', handlePillClick);
      return () => {
        editor.removeEventListener('click', handlePillClick);
      };
    }
  }, [onTextChange]);

  /**
   * Extract visual text from contentEditable (what user sees, for mention detection)
   */
  const extractVisualText = useCallback(() => {
    if (!editorRef.current) return '';
    return editorRef.current.textContent || '';
  }, []);

  /**
   * Extract text with IDs (storage format) from contentEditable
   */
  const extractStorageText = useCallback(() => {
    if (!editorRef.current) return '';
    return extractStorageTextFromEditor(editorRef.current);
  }, []);

  /**
   * Get cursor position in contentEditable (character offset from start)
   */
  const getCursorPosition = useCallback((): number => {
    if (!editorRef.current) return 0;
    return getCursorPositionInElement(editorRef.current);
  }, []);

  /**
   * Insert a mention pill at cursor position.
   *
   * This is the most complex function in the hook. It:
   * 1. Creates a pill element from the mention option
   * 2. Walks the DOM to preserve existing pills
   * 3. Inserts the new pill at the specified position
   * 4. Rebuilds the editor content
   * 5. Sets cursor after the pill
   *
   * The DOM walking algorithm is battle-tested and should not be modified.
   *
   * @param option - The mention option to insert (from autocomplete)
   * @param mentionStart - Character position where mention starts
   * @param mentionEnd - Character position where mention ends
   */
  const insertPill = useCallback(
    (option: MentionOption, mentionStart: number, mentionEnd: number) => {
      if (!editorRef.current) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      // Convert option to pill data
      const pillData = buildPillData(option);

      // Create pill element (without click handler - event delegation handles it)
      const pillSpan = createPillElement(pillData);

      // Rebuild editor preserving existing pills
      // We need to walk the DOM and reconstruct, preserving pill elements
      const fragment = document.createDocumentFragment();
      let charCount = 0;

      // Walk through existing content and clone nodes up to mentionStart
      const walkAndClone = (node: Node, targetFragment: DocumentFragment) => {
        if (charCount >= mentionEnd) return false; // Stop if we've passed the mention end

        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          const textLength = text.length;

          if (charCount + textLength <= mentionStart) {
            // This text is entirely before the mention - clone it
            targetFragment.appendChild(node.cloneNode(true));
            charCount += textLength;
          } else if (charCount < mentionStart) {
            // This text spans the mention start - split it
            const beforeLength = mentionStart - charCount;
            const beforeText = text.substring(0, beforeLength);
            targetFragment.appendChild(document.createTextNode(beforeText));
            charCount = mentionStart;
          } else if (charCount >= mentionEnd) {
            // This text is after the mention - will be added later
            return false;
          } else {
            // This text is within the mention range - skip it
            charCount += textLength;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          // Check if it's a pill
          if (el.dataset?.mentionType) {
            const pillText = el.textContent || '';
            const pillLength = pillText.length;

            if (charCount + pillLength <= mentionStart) {
              // Pill is before mention - clone it
              targetFragment.appendChild(el.cloneNode(true));
              charCount += pillLength;
            } else if (charCount < mentionStart) {
              // Pill spans mention start (unlikely but handle it)
              charCount += pillLength;
            } else if (charCount >= mentionEnd) {
              // Pill is after mention - will be added later
              return false;
            } else {
              // Pill is within mention range - skip it
              charCount += pillLength;
            }
          } else {
            // Regular element - walk its children
            node.childNodes.forEach((child) => walkAndClone(child, targetFragment));
          }
        }
        return true;
      };

      // Clone content before mention
      editorRef.current.childNodes.forEach((child) => walkAndClone(child, fragment));

      // Insert the new pill
      fragment.appendChild(pillSpan);
      const space = document.createTextNode('\u00A0');
      fragment.appendChild(space);

      // Now add content after the mention
      charCount = 0;
      const skipUntil = mentionEnd;
      const addAfterMention = (node: Node, targetFragment: DocumentFragment) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          const textLength = text.length;

          if (charCount + textLength <= skipUntil) {
            // This text is before/at the mention end - skip it
            charCount += textLength;
          } else if (charCount < skipUntil) {
            // This text spans the mention end - split it
            const afterLength = charCount + textLength - skipUntil;
            const afterText = text.substring(textLength - afterLength);
            targetFragment.appendChild(document.createTextNode(afterText));
            charCount += textLength;
          } else {
            // This text is entirely after the mention - clone it
            targetFragment.appendChild(node.cloneNode(true));
            charCount += textLength;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.dataset?.mentionType) {
            const pillText = el.textContent || '';
            const pillLength = pillText.length;

            if (charCount + pillLength <= skipUntil) {
              // Pill is before/at mention end - skip it
              charCount += pillLength;
            } else {
              // Pill is after mention - clone it
              targetFragment.appendChild(el.cloneNode(true));
              charCount += pillLength;
            }
          } else {
            // Regular element - walk its children
            node.childNodes.forEach((child) => addAfterMention(child, targetFragment));
          }
        }
      };

      editorRef.current.childNodes.forEach((child) => addAfterMention(child, fragment));

      // Replace editor content with the fragment
      editorRef.current.innerHTML = '';
      editorRef.current.appendChild(fragment);

      // Set cursor after the space
      const range = document.createRange();
      range.setStartAfter(space);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      // Focus the editor
      editorRef.current.focus();

      // Notify parent of text change
      const newText = extractStorageTextFromEditor(editorRef.current);
      onTextChange(newText);
    },
    [onTextChange, buildPillData]
  );

  return {
    editorRef,
    extractVisualText,
    extractStorageText,
    getCursorPosition,
    insertPill,
  };
}
