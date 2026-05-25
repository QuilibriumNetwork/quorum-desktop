/**
 * useScrollAnchor — application-owned scroll anchoring for the message list.
 *
 * Replaces react-virtuoso's `followOutput` with our own snap-to-bottom logic.
 * Three signals:
 *   1. Passive scroll listener maintains `wasAnchoredRef` (within 100px of bottom).
 *   2. React Query cache subscription snaps on APPEND or REPLACE when anchored.
 *   3. Imperative `snapToBottom()` is called by send handlers and the
 *      jump-to-present button; force-sets `wasAnchoredRef=true` so any cache
 *      update arriving from the send re-snaps.
 *
 * Suppression: `hasJumpedToOldMessageRef` (hash nav, scrollToMessageId) and
 * `deletionInProgressRef` gate the cache-driven path. Imperative snap ignores
 * the gates — when the user explicitly sends or clicks Jump-to-Present, they
 * intend to be at the bottom regardless.
 *
 * See docs/features/messages/scroll-anchoring.md for the full architecture
 * reference and bugs/2026-05-24-virtuoso-measurement-scroll-reset.md for the
 * investigation history that produced this design.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { QueryClient, InfiniteData } from '@tanstack/react-query';
import { buildMessagesKeyPrefix } from '../queries/messages/buildMessagesKey';

/** How close to the bottom for cache appends to count as "anchored". */
const ANCHOR_THRESHOLD_PX = 100;

interface UseScrollAnchorOptions {
  scrollerSelector?: string;
  hasJumpedToOldMessageRef: React.RefObject<boolean>;
  deletionInProgressRef: React.RefObject<boolean>;
  /**
   * QueryClient + channel context enable the proactive snap path. For DMs the
   * convention is spaceId === channelId === recipientAddress. Without these,
   * only the scroll-listener (anchor-state-tracking) path runs.
   */
  queryClient?: QueryClient;
  spaceId?: string;
  channelId?: string;
}

interface UseScrollAnchorReturn {
  /** Imperative snap; force-sets anchored=true so subsequent cache events re-snap. */
  snapToBottom: () => void;
  /** Reserved for callers that want to forward Virtuoso's atBottomStateChange. */
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
  // Shared by the scroll listener (writes it) and the cache subscription (reads it).
  const wasAnchoredRef = useRef(true);

  const performSnap = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }, []);

  const snapToBottom = useCallback(() => {
    // Force anchored=true so a cache update arriving from this send
    // (optimistic addMessage, then the server-confirmed REPLACE) re-snaps
    // even if the user was scrolled up at submit time.
    wasAnchoredRef.current = true;
    performSnap();
  }, [performSnap]);

  // No-op kept for API stability — wired through MessageList's
  // handleBottomStateChange in case future logic needs it.
  const onAtBottomStateChange = useCallback((_atBottom: boolean) => {}, []);

  // Scroll listener: maintain wasAnchoredRef.
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

      const initialGap = el.scrollHeight - el.clientHeight - el.scrollTop;
      wasAnchoredRef.current = initialGap < ANCHOR_THRESHOLD_PX;

      const onScroll = () => {
        const gap = el.scrollHeight - el.clientHeight - el.scrollTop;
        wasAnchoredRef.current = gap < ANCHOR_THRESHOLD_PX;
      };
      onScroll();
      el.addEventListener('scroll', onScroll, { passive: true });
      detach = () => el.removeEventListener('scroll', onScroll);
    };

    tryAttach();
    return () => {
      detach?.();
      scrollerRef.current = null;
    };
  }, [scrollerSelector]);

  // Cache subscription: snap on APPEND or REPLACE while anchored.
  // The scroll listener alone misses cases where Virtuoso doesn't write
  // scrollTop after a cache append (notably DMs, and some channel sends
  // where Virtuoso silently fails to follow new content).
  useEffect(() => {
    if (!queryClient || !spaceId || !channelId) return;

    const prefix = buildMessagesKeyPrefix({ spaceId, channelId });

    // Seed from current cache so the first event is compared against the
    // real pre-mount baseline, not against 0 (which would treat the
    // existing channel content as a new append).
    let lastSeenLen = 0;
    let lastSeenLast: unknown = null;
    for (const includeThreads of [false, true]) {
      const key = [...prefix, includeThreads ? 'with-threads' : 'no-threads'];
      const data = queryClient.getQueryData(key) as
        InfiniteData<{ messages: unknown[] }> | undefined;
      if (data?.pages?.length) {
        const msgs = data.pages[data.pages.length - 1]?.messages ?? [];
        lastSeenLen = msgs.length;
        lastSeenLast = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        break;
      }
    }

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;

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

      const messages = data.pages[data.pages.length - 1]?.messages ?? [];
      const currentLen = messages.length;
      const currentLast = currentLen > 0 ? messages[currentLen - 1] : null;
      const prevLen = lastSeenLen;
      const prevLast = lastSeenLast;
      lastSeenLen = currentLen;
      lastSeenLast = currentLast;

      // APPEND: length grew. REPLACE: length same, last-message object
      // reference changed (optimistic → server-confirmed shares messageId
      // but addMessage rebuilds the array so the object identity changes).
      // Reactions, pins, status flips on non-last items don't change either,
      // so they don't snap.
      const isAppend = currentLen > prevLen;
      const isReplace = currentLen === prevLen
        && currentLast !== prevLast
        && currentLast !== null;
      if (!isAppend && !isReplace) return;

      if (!wasAnchoredRef.current) return;
      if (hasJumpedToOldMessageRef.current) return;
      if (deletionInProgressRef.current) return;

      performSnap();
    });

    return unsubscribe;
  }, [queryClient, spaceId, channelId, hasJumpedToOldMessageRef, deletionInProgressRef, performSnap]);

  return { snapToBottom, onAtBottomStateChange };
}
