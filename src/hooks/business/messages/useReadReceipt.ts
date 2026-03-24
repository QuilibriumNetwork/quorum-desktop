import { useEffect, useRef } from 'react';

/**
 * Hook to detect when a message becomes visually read (50%+ visible for 1 second,
 * tab focused). Reports the read event via callback. Once triggered, disconnects.
 *
 * Follows the same IntersectionObserver pattern as useViewportMentionHighlight.
 *
 * Duplicate reportRead calls are harmless — the high-water mark in
 * ReceiptService makes them no-ops if the timestamp is <= current mark.
 *
 * @param messageId - Unique identifier for the message
 * @param messageTimestamp - Creation timestamp of the message
 * @param isEnabled - Whether read receipts are enabled (setting + message eligibility)
 * @param reportRead - Callback to report the read event
 * @returns Ref to attach to the message element
 */
export function useReadReceipt(
  messageId: string,
  messageTimestamp: number,
  isEnabled: boolean,
  reportRead: ((messageId: string, timestamp: number) => void) | undefined
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const hasTriggeredRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isEnabled || !reportRead || hasTriggeredRef.current || !elementRef.current) {
      return;
    }

    const cleanup = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (visibilityListenerRef.current) {
        document.removeEventListener('visibilitychange', visibilityListenerRef.current);
        visibilityListenerRef.current = null;
      }
    };

    const startDwellTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible' && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          reportRead(messageId, messageTimestamp);
          cleanup();
        }
      }, 1000);
    };

    // Track whether the element is currently intersecting for visibility restart
    let isCurrentlyIntersecting = false;

    // Listen for tab visibility changes to cancel/restart timer
    visibilityListenerRef.current = () => {
      if (document.visibilityState === 'hidden') {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      } else if (document.visibilityState === 'visible' && isCurrentlyIntersecting) {
        // Tab regained focus while element is still visible — restart dwell timer
        startDwellTimer();
      }
    };
    document.addEventListener('visibilitychange', visibilityListenerRef.current);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (hasTriggeredRef.current) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            isCurrentlyIntersecting = true;
            // Message is visible — start dwell timer if tab is focused
            if (document.visibilityState === 'visible') {
              startDwellTimer();
            }
          } else {
            isCurrentlyIntersecting = false;
            // Message left viewport — cancel timer
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
          }
        });
      },
      {
        threshold: 0.5,
        rootMargin: '0px',
      }
    );

    observerRef.current.observe(elementRef.current);

    return cleanup;
  }, [messageId, messageTimestamp, isEnabled, reportRead]);

  // Reset if messageId changes
  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [messageId]);

  return elementRef;
}
