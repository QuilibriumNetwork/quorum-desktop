/**
 * Application-owned scroll anchoring — replaces react-virtuoso's followOutput.
 * See docs/features/messages/scroll-anchoring.md for the architecture.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { buildMessagesKeyPrefix } from '../queries/messages/buildMessagesKey';

/** How close to the bottom for cache appends to count as "anchored". */
const ANCHOR_THRESHOLD_PX = 100;

interface UseScrollAnchorOptions {
  hasJumpedToOldMessageRef: React.RefObject<boolean>;
  deletionInProgressRef: React.RefObject<boolean>;
  /** Without queryClient + (spaceId+channelId | queryKeyPrefix), the proactive path is inert. */
  queryClient?: QueryClient;
  /** For DMs, spaceId === channelId === recipientAddress. */
  spaceId?: string;
  channelId?: string;
  /** Takes precedence over spaceId/channelId. Used by ThreadPanel. */
  queryKeyPrefix?: readonly unknown[];
}

interface UseScrollAnchorReturn {
  snapToBottom: () => void;
  onAtBottomStateChange: (atBottom: boolean) => void;
  /** Pass to <Virtuoso scrollerRef={...}> so this hook acts on the right instance. */
  setScrollerEl: (el: HTMLElement | Window | null) => void;
}

export function useScrollAnchor({
  hasJumpedToOldMessageRef,
  deletionInProgressRef,
  queryClient,
  spaceId,
  channelId,
  queryKeyPrefix,
}: UseScrollAnchorOptions): UseScrollAnchorReturn {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const wasAnchoredRef = useRef(true);

  const performSnap = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }, []);

  const snapToBottom = useCallback(() => {
    // Force-anchor so the trailing cache update from this send still re-snaps
    // even if the user was scrolled up at submit time.
    wasAnchoredRef.current = true;
    performSnap();
  }, [performSnap]);

  // Reserved for future callers; currently a no-op.
  const onAtBottomStateChange = useCallback((_atBottom: boolean) => {}, []);

  // Virtuoso hands us its scroller via scrollerRef. We register it here so each
  // MessageList instance gets its own listener — querying the DOM would collide
  // when multiple lists (e.g. channel + open thread panel) are mounted.
  const detachRef = useRef<(() => void) | null>(null);
  const setScrollerEl = useCallback((el: HTMLElement | Window | null) => {
    detachRef.current?.();
    detachRef.current = null;
    if (!el || el instanceof Window) {
      scrollerRef.current = null;
      return;
    }
    scrollerRef.current = el;

    const initialGap = el.scrollHeight - el.clientHeight - el.scrollTop;
    wasAnchoredRef.current = initialGap < ANCHOR_THRESHOLD_PX;

    const onScroll = () => {
      const gap = el.scrollHeight - el.clientHeight - el.scrollTop;
      wasAnchoredRef.current = gap < ANCHOR_THRESHOLD_PX;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    detachRef.current = () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    return () => {
      detachRef.current?.();
      detachRef.current = null;
      scrollerRef.current = null;
    };
  }, []);

  // Cache subscription: catches appends the scroll listener misses (DMs and
  // some channel sends where Virtuoso doesn't write scrollTop).
  const effectivePrefix: readonly unknown[] | undefined = queryKeyPrefix
    ?? (spaceId && channelId ? buildMessagesKeyPrefix({ spaceId, channelId }) : undefined);
  // Stable dep key — prefix arrays are often freshly constructed each render.
  const prefixDepKey = effectivePrefix ? JSON.stringify(effectivePrefix) : '';

  useEffect(() => {
    if (!queryClient || !effectivePrefix) return;

    const prefix = effectivePrefix;

    // Channels/DMs store InfiniteData<{ messages }>; threads store flat { messages }.
    const extractLastPageMessages = (data: unknown): readonly unknown[] => {
      if (!data || typeof data !== 'object') return [];
      const pages = (data as { pages?: Array<{ messages?: unknown[] }> }).pages;
      if (Array.isArray(pages)) {
        if (pages.length === 0) return [];
        return pages[pages.length - 1]?.messages ?? [];
      }
      const flat = (data as { messages?: unknown[] }).messages;
      return Array.isArray(flat) ? flat : [];
    };

    // Seed from cache so the first event compares against the pre-mount baseline
    // rather than treating existing content as a fresh append.
    let lastSeenLen = 0;
    let lastSeenLast: unknown = null;
    const seedMatches = queryClient.getQueriesData({ queryKey: prefix });
    for (const [, data] of seedMatches) {
      const msgs = extractLastPageMessages(data);
      if (msgs.length > 0) {
        lastSeenLen = msgs.length;
        lastSeenLast = msgs[msgs.length - 1];
        break;
      }
    }

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;

      const key = event.query.queryKey;
      if (!Array.isArray(key) || key.length < prefix.length) return;
      for (let i = 0; i < prefix.length; i++) {
        if (key[i] !== prefix[i]) return;
      }

      const messages = extractLastPageMessages(event.query.state.data);
      const currentLen = messages.length;
      const currentLast = currentLen > 0 ? messages[currentLen - 1] : null;
      const prevLen = lastSeenLen;
      const prevLast = lastSeenLast;
      lastSeenLen = currentLen;
      lastSeenLast = currentLast;

      // APPEND: new message. REPLACE: optimistic → server-confirmed swap (same
      // id, new object). Reactions/pins/non-tail edits keep the tail identical
      // and don't snap.
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
    // effectivePrefix tracked via stable prefixDepKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, prefixDepKey, hasJumpedToOldMessageRef, deletionInProgressRef, performSnap]);

  return { snapToBottom, onAtBottomStateChange, setScrollerEl };
}
