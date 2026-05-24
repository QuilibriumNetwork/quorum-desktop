/**
 * useScrollAnchor — application-owned scroll anchoring for the message list.
 *
 * See `.agents/tasks/2026-05-24-virtuoso-application-owned-scroll-anchoring.md`
 * and `.agents/bugs/2026-05-24-virtuoso-measurement-scroll-reset.md` for the
 * full design rationale and investigation history.
 *
 * The hook is purely reactive to scroll position. It does not subscribe to
 * the React Query cache, does not schedule timeouts, does not coordinate
 * with Virtuoso's lifecycle. It maintains one piece of state:
 *
 *   wasAnchored — was the user near the bottom on the most recent scroll
 *                  event the hook understood as user-initiated?
 *
 * On every scroll event, the hook compares the new scrollTop to the previous
 * value. If scrollTop dropped (backward jump) AND the user was anchored,
 * the hook attributes the drop to Virtuoso's internal measurement callback
 * (the known upstream bug) and overwrites scrollTop back to the bottom.
 *
 * This approach is reactive to the actual symptom (scroll position changing
 * the wrong way) rather than to any particular trigger (cache writes, item
 * resizes, member data resolving, etc.). It works regardless of why Virtuoso
 * wrote the wrong value.
 */
import { useCallback, useEffect, useRef } from 'react';
// TEMPORARY DEBUG — remove with __scrollDebug.ts.
import { scrollDebug } from './__scrollDebug';

/**
 * Pixel threshold below which the user is considered "anchored at the bottom".
 * Separate from Virtuoso's `atBottomThreshold` (5000px) which drives the
 * jump-to-present button. Different semantics:
 *   - This 100px: how close to bottom for auto-snap on Virtuoso's bad writes
 *   - 5000px: how far from bottom before the Jump button appears
 */
const ANCHOR_THRESHOLD_PX = 100;

/**
 * Minimum backward delta (negative scrollTop change) to attribute to
 * Virtuoso rather than user input. Smaller jitter is ignored.
 */
const BACKWARD_JUMP_THRESHOLD_PX = 10;

interface UseScrollAnchorOptions {
  scrollerSelector?: string;
  /** Auto-snap is suppressed when the user has navigated to historical messages. */
  hasJumpedToOldMessageRef: React.RefObject<boolean>;
  /** Auto-snap is suppressed during a message deletion cycle. */
  deletionInProgressRef: React.RefObject<boolean>;
}

interface UseScrollAnchorReturn {
  /** Imperative snap to bottom. Used by jump-to-present and parent callers. */
  snapToBottom: () => void;
  /** No-op for API compatibility. Readiness is detected from scroll events. */
  onAtBottomStateChange: (atBottom: boolean) => void;
}

export function useScrollAnchor({
  scrollerSelector = '[data-virtuoso-scroller]',
  hasJumpedToOldMessageRef,
  deletionInProgressRef,
}: UseScrollAnchorOptions): UseScrollAnchorReturn {
  const scrollerRef = useRef<HTMLElement | null>(null);

  const performSnap = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }, []);

  const snapToBottom = useCallback(() => {
    performSnap();
  }, [performSnap]);

  // No-op; preserved for backward compatibility with MessageList's wiring.
  const onAtBottomStateChange = useCallback((_atBottom: boolean) => {}, []);

  useEffect(() => {
    let attempts = 0;
    let detach: (() => void) | undefined;

    const tryAttach = () => {
      const el = document.querySelector(scrollerSelector) as HTMLElement | null;
      if (!el) {
        if (++attempts < 30) setTimeout(tryAttach, 100);
        return;
      }
      scrollerRef.current = el;

      // The single piece of state the hook needs to make decisions.
      // True when, on the previous scroll event the hook handled, the user
      // was within ANCHOR_THRESHOLD_PX of the bottom. User scrolling away
      // clears it; staying at the bottom keeps it set.
      let wasAnchored = true;
      let prevScrollTop = el.scrollTop;

      const onScroll = () => {
        const cur = el.scrollTop;
        const gap = el.scrollHeight - el.clientHeight - cur;
        const isAnchoredNow = gap < ANCHOR_THRESHOLD_PX;
        const delta = cur - prevScrollTop;

        // TEMPORARY DEBUG: log every scroll event so we can see what the
        // hook saw at every moment. Remove with the rest of instrumentation.
        scrollDebug.log({
          kind: 'note',
          note: `useScrollAnchor: scroll cur=${cur} prev=${prevScrollTop} delta=${delta.toFixed(1)} gap=${gap.toFixed(1)} wasAnchored=${wasAnchored} isAnchoredNow=${isAnchoredNow} jumped=${hasJumpedToOldMessageRef.current}`,
        });

        // If scrollTop dropped meaningfully AND the user was anchored on the
        // last event, attribute the drop to Virtuoso's measurement callback
        // and overwrite.
        if (
          delta < -BACKWARD_JUMP_THRESHOLD_PX
          && wasAnchored
          && !hasJumpedToOldMessageRef.current
          && !deletionInProgressRef.current
        ) {
          scrollDebug.log({
            kind: 'note',
            note: `useScrollAnchor: ABSORB delta=${delta.toFixed(1)} cur=${cur} -> snap`,
          });
          el.scrollTop = el.scrollHeight - el.clientHeight;
          prevScrollTop = el.scrollTop;
          return;
        }

        prevScrollTop = cur;
        wasAnchored = isAnchoredNow;
      };

      // Seed initial value.
      onScroll();
      el.addEventListener('scroll', onScroll, { passive: true });
      detach = () => el.removeEventListener('scroll', onScroll);
    };

    tryAttach();
    return () => {
      detach?.();
      scrollerRef.current = null;
    };
  }, [scrollerSelector, hasJumpedToOldMessageRef, deletionInProgressRef]);

  return { snapToBottom, onAtBottomStateChange };
}
