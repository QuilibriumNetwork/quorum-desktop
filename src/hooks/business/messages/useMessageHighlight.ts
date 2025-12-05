import { useState, useCallback, useRef, useEffect } from 'react';
import { isWeb } from '../../../utils/platform';

export interface MessageHighlightState {
  highlightedMessageId: string | null;
  highlightVariant: 'default' | 'mention';
  isHighlighted: (messageId: string) => boolean;
  getHighlightVariant: () => 'default' | 'mention';
  highlightMessage: (messageId: string, options?: HighlightOptions) => void;
  clearHighlight: () => void;
  scrollToMessage: (
    messageId: string,
    virtuosoRef?: any,
    messageList?: any[]
  ) => void;
}

export interface HighlightOptions {
  duration?: number; // Duration in milliseconds, default 2000
  variant?: 'default' | 'mention'; // Highlight variant, default 'default'
  scrollBehavior?: 'auto' | 'smooth';
  scrollBlock?: 'start' | 'center' | 'end';
}

const DEFAULT_HIGHLIGHT_DURATION = 8000;
const DEFAULT_SCROLL_BEHAVIOR = 'auto';
const DEFAULT_SCROLL_BLOCK = 'center';

/**
 * Message highlighting hook for self-highlighting within a component.
 *
 * IMPORTANT: This hook creates LOCAL state, not shared/centralized state.
 * Each component that calls this hook gets its own isolated state.
 *
 * Two highlighting mechanisms exist:
 * 1. **URL Hash** (`#msg-{id}`): For cross-component communication (pinned, bookmarks,
 *    search, notifications, reply clicks). The hash is global browser state that all
 *    Message components can detect via useLocation().
 * 2. **Local State** (this hook): For self-highlighting only. Used by mention viewport
 *    highlighting where a Message component highlights itself when it enters the viewport.
 *
 * @see Message.tsx:258-263 - Checks BOTH hash AND local state for highlighting
 * @see useViewportMentionHighlight.ts - Uses this hook correctly for self-highlighting
 */
export const useMessageHighlight = (): MessageHighlightState => {
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [highlightVariant, setHighlightVariant] = useState<
    'default' | 'mention'
  >('default');
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any existing timeout when component unmounts
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedMessageId(null);
    setHighlightVariant('default');
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, []);

  const isHighlighted = useCallback(
    (messageId: string): boolean => {
      return highlightedMessageId === messageId;
    },
    [highlightedMessageId]
  );

  const getHighlightVariant = useCallback(() => {
    return highlightVariant;
  }, [highlightVariant]);

  const highlightMessage = useCallback(
    (messageId: string, options: HighlightOptions = {}) => {
      const { duration = DEFAULT_HIGHLIGHT_DURATION, variant = 'default' } = options;

      // Clear any existing highlight first
      clearHighlight();

      // Set new highlight
      setHighlightedMessageId(messageId);
      setHighlightVariant(variant);

      // Auto-clear after duration
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
        setHighlightVariant('default');
        highlightTimeoutRef.current = null;
      }, duration);
    },
    [clearHighlight]
  );

  const scrollToMessage = useCallback(
    (messageId: string, virtuosoRef?: any, messageList?: any[]) => {
      if (!isWeb()) {
        // For React Native, we'll need platform-specific implementation
        // For now, just highlight without scrolling
        return;
      }

      // Method 1: Use Virtuoso if available (preferred for MessageList)
      if (virtuosoRef && messageList) {
        const messageIndex = messageList.findIndex(
          (m: any) => m.messageId === messageId
        );
        if (messageIndex !== -1) {
          virtuosoRef.scrollToIndex({
            index: messageIndex,
            align: DEFAULT_SCROLL_BLOCK,
            behavior: DEFAULT_SCROLL_BEHAVIOR,
          });
          return;
        }
      }

      // Method 2: Fallback to DOM scrolling (for cases where Virtuoso isn't available)
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        const messageElement = document.getElementById(`msg-${messageId}`);
        if (messageElement) {
          // Use mobile-safe scrolling
          messageElement.scrollIntoView({
            behavior: DEFAULT_SCROLL_BEHAVIOR,
            block: DEFAULT_SCROLL_BLOCK,
            inline: 'nearest',
          });
        }
      });
    },
    []
  );

  return {
    highlightedMessageId,
    highlightVariant,
    isHighlighted,
    getHighlightVariant,
    highlightMessage,
    clearHighlight,
    scrollToMessage,
  };
};
