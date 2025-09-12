import { useState, useCallback, useRef, useEffect } from 'react';
import { isWeb } from '../../../utils/platform';

export interface MessageHighlightState {
  highlightedMessageId: string | null;
  isHighlighted: (messageId: string) => boolean;
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
  scrollBehavior?: 'auto' | 'smooth';
  scrollBlock?: 'start' | 'center' | 'end';
}

const DEFAULT_HIGHLIGHT_DURATION = 2000;
const DEFAULT_SCROLL_BEHAVIOR = 'auto';
const DEFAULT_SCROLL_BLOCK = 'center';

/**
 * Centralized message highlighting hook that replaces DOM manipulation with React state.
 * Provides mobile-safe scrolling and consistent highlight behavior across all components.
 */
export const useMessageHighlight = (): MessageHighlightState => {
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
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

  const highlightMessage = useCallback(
    (messageId: string, options: HighlightOptions = {}) => {
      const { duration = DEFAULT_HIGHLIGHT_DURATION } = options;

      // Clear any existing highlight first
      clearHighlight();

      // Set new highlight
      setHighlightedMessageId(messageId);

      // Auto-clear after duration
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
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
    isHighlighted,
    highlightMessage,
    clearHighlight,
    scrollToMessage,
  };
};
