import { useEffect, useRef } from 'react';

/**
 * Hook to auto-highlight mentioned messages when they enter viewport
 * Integrates with useMessageHighlight system to maintain consistency
 *
 * Only highlights UNREAD mentions - messages that were created after the last read time
 *
 * @param messageId - Unique identifier for the message
 * @param isMentioned - Whether the message mentions the current user
 * @param isUnread - Whether the message is unread (createdDate > lastReadTimestamp)
 * @param highlightMessage - Callback from useMessageHighlight to trigger highlight
 * @returns Ref to attach to the message element
 *
 * @example
 * const { highlightMessage } = useMessageHighlight();
 * const isUnread = message.createdDate > (conversation?.lastReadTimestamp || 0);
 * const mentionRef = useViewportMentionHighlight(
 *   message.messageId,
 *   formatting.isMentioned(userAddress),
 *   isUnread,
 *   highlightMessage
 * );
 *
 * <div ref={mentionRef} ...>
 */
export function useViewportMentionHighlight(
  messageId: string,
  isMentioned: boolean,
  isUnread: boolean,
  highlightMessage: (messageId: string, options?: { duration?: number }) => void
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const hasTriggeredRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Only set up for UNREAD mentioned messages that haven't been highlighted yet
    if (!isMentioned || !isUnread || hasTriggeredRef.current || !elementRef.current) {
      return;
    }

    // Create IntersectionObserver to detect when message enters viewport
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Message is at least 50% visible and hasn't been triggered yet
          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= 0.5 &&
            !hasTriggeredRef.current
          ) {
            // Mark as triggered to prevent re-highlighting
            hasTriggeredRef.current = true;

            // Trigger highlight using existing system (6 second duration to match search/pinned navigation)
            highlightMessage(messageId, { duration: 6000 });

            // Stop observing once triggered
            if (observerRef.current) {
              observerRef.current.disconnect();
            }
          }
        });
      },
      {
        threshold: 0.5, // Trigger when 50% of message is visible
        rootMargin: '0px',
      }
    );

    observerRef.current.observe(elementRef.current);

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [messageId, isMentioned, isUnread, highlightMessage]);

  // Reset if messageId changes (e.g., message list updates)
  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [messageId]);

  return elementRef;
}
