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
import type { QueryClient, InfiniteData } from '@tanstack/react-query';
import { buildMessagesKeyPrefix } from '../../hooks/queries/messages/buildMessagesKey';
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
  /**
   * QueryClient + channel context enable the PROACTIVE snap path: the hook
   * subscribes to the messages cache and snaps to bottom when a new message
   * is appended AND the user was anchored. Required for cases where Virtuoso
   * does not write scrollTop after a cache append (notably DMs and some
   * multi-line / image sends in channels). Without these, only the reactive
   * scroll-listener path runs.
   * For DMs the convention is spaceId === channelId === recipientAddress.
   */
  queryClient?: QueryClient;
  spaceId?: string;
  channelId?: string;
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
  queryClient,
  spaceId,
  channelId,
}: UseScrollAnchorOptions): UseScrollAnchorReturn {
  const scrollerRef = useRef<HTMLElement | null>(null);
  // Shared anchor state — read by BOTH the scroll listener (reactive path)
  // and the cache subscription (proactive path).
  const wasAnchoredRef = useRef(true);

  const performSnap = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }, []);

  const snapToBottom = useCallback(() => {
    // Imperative snap = explicit anchor-at-bottom intent (e.g. send-message,
    // jump-to-present button). Force-set wasAnchoredRef so any cache update
    // that lands shortly after this call is treated as "user is anchored"
    // and gets its own snap. Without this, the user's pre-snap scrolled-up
    // state could suppress the subsequent cache snap, leaving the final
    // scroll position short of the bottom.
    wasAnchoredRef.current = true;
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

      // Initialize anchor state from current scroll position.
      const initialGap = el.scrollHeight - el.clientHeight - el.scrollTop;
      wasAnchoredRef.current = initialGap < ANCHOR_THRESHOLD_PX;
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
          note: `useScrollAnchor: scroll cur=${cur} prev=${prevScrollTop} delta=${delta.toFixed(1)} gap=${gap.toFixed(1)} wasAnchored=${wasAnchoredRef.current} isAnchoredNow=${isAnchoredNow} jumped=${hasJumpedToOldMessageRef.current}`,
        });

        // ABSORB branch TEMPORARILY DISABLED (Session 18 regression-test):
        // The absorb logic was causing user scroll-up gestures to snap back
        // to bottom due to a race with wasAnchoredRef state. With this
        // disabled, the cache-subscription path remains as the only auto-snap
        // mechanism. If scroll-up works smoothly without this branch, the
        // absorb needs a less-aggressive replacement (or removal if the
        // cache subscription alone is sufficient).
        // ----------------------------------------------------------------
        // if (
        //   delta < -BACKWARD_JUMP_THRESHOLD_PX
        //   && wasAnchoredRef.current
        //   && !hasJumpedToOldMessageRef.current
        //   && !deletionInProgressRef.current
        // ) {
        //   scrollDebug.log({
        //     kind: 'note',
        //     note: `useScrollAnchor: ABSORB delta=${delta.toFixed(1)} cur=${cur} -> snap`,
        //   });
        //   el.scrollTop = el.scrollHeight - el.clientHeight;
        //   prevScrollTop = el.scrollTop;
        //   return;
        // }

        prevScrollTop = cur;
        wasAnchoredRef.current = isAnchoredNow;
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

  // === Cache subscription: PROACTIVE snap on cache append.
  // The scroll listener above only fires when Virtuoso actually writes
  // scrollTop. In some cases (notably DM sends, and certain channel sends
  // where Virtuoso silently fails to follow new content) no scroll event
  // ever fires, so the listener has nothing to react to. This subscription
  // gives us a signal directly from the data layer: when a new message is
  // added to the last page, snap to bottom if the user was anchored.
  useEffect(() => {
    if (!queryClient || !spaceId || !channelId) return;

    const prefix = buildMessagesKeyPrefix({ spaceId, channelId });

    // Seed from current cache so the first cache event we see is correctly
    // compared against the pre-mount baseline (not against null/0 which
    // would treat the existing channel content as "new appends").
    let lastSeenLen = 0;
    let lastSeenLast: unknown = null;
    const seed = () => {
      for (const includeThreads of [false, true]) {
        const key = [...prefix, includeThreads ? 'with-threads' : 'no-threads'];
        const data = queryClient.getQueryData(key) as
          InfiniteData<{ messages: unknown[] }> | undefined;
        if (data?.pages?.length) {
          const lastPage = data.pages[data.pages.length - 1];
          const msgs = lastPage?.messages ?? [];
          lastSeenLen = msgs.length;
          lastSeenLast = msgs.length > 0 ? msgs[msgs.length - 1] : null;
          return;
        }
      }
    };
    seed();
    scrollDebug.log({
      kind: 'note',
      note: `useScrollAnchor[cache]: subscribed prefix=[${prefix.join(',')}] seededLen=${lastSeenLen}`,
    });

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;

      // Filter by query-key prefix (matches both thread/no-thread variants).
      const key = event.query.queryKey;
      if (
        !Array.isArray(key)
        || key.length < prefix.length
        || key[0] !== prefix[0]
        || key[1] !== prefix[1]
        || key[2] !== prefix[2]
      ) return;

      const data = event.query.state.data as
        InfiniteData<{ messages: unknown[] }> | undefined;
      if (!data?.pages?.length) return;

      const lastPage = data.pages[data.pages.length - 1];
      const messages = lastPage?.messages ?? [];
      const currentLen = messages.length;
      const currentLast = currentLen > 0 ? messages[currentLen - 1] : null;
      const prevLen = lastSeenLen;
      const prevLast = lastSeenLast;
      lastSeenLen = currentLen;
      lastSeenLast = currentLast;

      // APPEND: length grew. REPLACE: length same but last-message object
      // reference changed (optimistic→server-confirmed has identical
      // messageId but a fresh object after addMessage's filter+sort).
      // Reactions, pins, status flips on non-last items leave both
      // length and last-message-reference unchanged → no snap.
      const isAppend = currentLen > prevLen;
      const isReplace = currentLen === prevLen && currentLast !== prevLast && currentLast !== null;
      if (!isAppend && !isReplace) return;

      // Gates: same as the reactive path.
      if (!wasAnchoredRef.current) return;
      if (hasJumpedToOldMessageRef.current) return;
      if (deletionInProgressRef.current) return;

      scrollDebug.log({
        kind: 'note',
        note: `useScrollAnchor[cache]: ${isAppend ? 'APPEND' : 'REPLACE'} -> snap (len ${prevLen}→${currentLen})`,
      });
      performSnap();
    });

    return unsubscribe;
  }, [queryClient, spaceId, channelId, hasJumpedToOldMessageRef, deletionInProgressRef, performSnap]);

  return { snapToBottom, onAtBottomStateChange };
}
