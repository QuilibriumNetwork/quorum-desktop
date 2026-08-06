import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Regression guard for "DM unread dot never clears".
 *
 * The failure was never visible in a single render. It needed the sequence:
 *
 *   row is unread  →  the read time is written  →  the row must read as read
 *
 * with NO `lastMessageId` change anywhere in between. `useConversationPreviews`
 * is keyed on `conversationId:lastMessageId`, so reading a DM moves nothing in
 * that key; because the query used to cache a full COPY of every conversation
 * row (`{ ...conv, preview, previewIcon }`) and the sidebar rendered that copy,
 * the pre-read `lastReadTimestamp` was served indefinitely and the dot stayed.
 *
 * The two assertions below are deliberately paired:
 *   1. the cached payload carries preview fields ONLY — no row state to go stale;
 *   2. across the sequence the merged row reflects the NEW read time while the
 *      preview query is still serving its original cached result (getMessage is
 *      called exactly once), so the pass is real cache reuse and not an
 *      accidental refetch papering over it.
 *
 * See .agents/issues/2026-08-01-dm-unread-dot-stale-previews-snapshot.md §4.3.
 */

const getMessage = vi.fn();

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({ messageDB: { getMessage } }),
}));

vi.mock('@quilibrium/quorum-shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@quilibrium/quorum-shared'
  );
  return {
    ...actual,
    generateMessagePreview: (message: { text?: string }) => ({
      text: message?.text ?? '',
      icon: undefined,
    }),
  };
});

import {
  useConversationPreviews,
  withPreviews,
} from '@/hooks/business/conversations/useConversationPreviews';

const ADDRESS = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const CONVERSATION_ID = `${ADDRESS}/${ADDRESS}`;
const LAST_MESSAGE_ID = 'msg-1';

/** A conversation row as the DM sidebar receives it from the 2s poll. */
const row = (lastReadTimestamp: number) => ({
  conversationId: CONVERSATION_ID,
  address: ADDRESS,
  displayName: 'Ada Lovelace',
  icon: 'data:image/jpeg;base64,/9j/REAL',
  type: 'direct' as const,
  timestamp: 1_000,
  lastReadTimestamp,
  lastMessageId: LAST_MESSAGE_ID,
});

/** Exactly what DirectMessageContactsList computes for the dot. */
const isUnread = (c: { lastReadTimestamp?: number; timestamp: number }) =>
  (c.lastReadTimestamp ?? 0) < c.timestamp;

const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

/** The sidebar's own composition: cached previews merged onto live rows. */
const useListRows = (conversations: ReturnType<typeof row>[]) => {
  const { data } = useConversationPreviews(conversations);
  return { rows: withPreviews(conversations, data), previews: data };
};

describe('DM list read state survives the previews cache', () => {
  beforeEach(() => {
    getMessage.mockReset();
    getMessage.mockResolvedValue({ text: 'hello there' });
  });

  it('caches preview payload only — no conversation row fields', async () => {
    const { result } = renderHook(() => useListRows([row(0)]), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.previews).toBeDefined());

    const cached = result.current.previews![CONVERSATION_ID];
    expect(cached).toEqual({ preview: 'hello there', previewIcon: undefined });
    // The trap: anything else copied in here freezes until a lastMessageId moves.
    expect(Object.keys(cached).sort()).toEqual(['preview', 'previewIcon']);
  });

  it('clears unread when the read time advances without a new message', async () => {
    const { result, rerender } = renderHook(
      ({ lastRead }: { lastRead: number }) => useListRows([row(lastRead)]),
      { wrapper: makeWrapper(), initialProps: { lastRead: 0 } }
    );

    await waitFor(() => expect(result.current.rows[0].preview).toBe('hello there'));
    expect(isUnread(result.current.rows[0])).toBe(true);

    // Reading the DM writes a read time. No message was sent or received, so
    // `lastMessageId` — the entire previews cache key — is unchanged.
    rerender({ lastRead: 2_000 });

    expect(isUnread(result.current.rows[0])).toBe(false);
    expect(result.current.rows[0].lastReadTimestamp).toBe(2_000);
    // Preview text still rendered, and served from the SAME cache entry.
    expect(result.current.rows[0].preview).toBe('hello there');
    expect(getMessage).toHaveBeenCalledTimes(1);
  });

  it('refreshes the preview when a new message does arrive', async () => {
    const { result, rerender } = renderHook(
      ({ lastMessageId }: { lastMessageId: string }) =>
        useListRows([{ ...row(2_000), lastMessageId, timestamp: 3_000 }]),
      { wrapper: makeWrapper(), initialProps: { lastMessageId: LAST_MESSAGE_ID } }
    );

    await waitFor(() => expect(result.current.rows[0].preview).toBe('hello there'));

    getMessage.mockResolvedValue({ text: 'and a reply' });
    rerender({ lastMessageId: 'msg-2' });

    await waitFor(() => expect(result.current.rows[0].preview).toBe('and a reply'));
    expect(isUnread(result.current.rows[0])).toBe(true);
  });
});
