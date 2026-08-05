import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The one-time sweep that reclaims embedded sender avatars from stored
 * bookmarks.
 *
 * The shared stripper is separately tested as a pure function. What is NOT
 * covered by that, and is where a migration actually goes wrong, is the hook
 * around it: does it write anything at all, does it write only what changed,
 * does it run once, and — the one that matters most — does it refuse to mark
 * itself complete when it failed halfway?
 *
 * A migration that sets its "done" flag after a partial failure is
 * unrecoverable without manual intervention, because nothing ever runs it
 * again. That is the case worth a test.
 */

const getBookmarks = vi.fn();
const putBookmark = vi.fn();
const invalidateBookmarks = vi.fn();

const USER = 'QmSelf00000000000000000000000000000000';
const FLAG = `bookmarkSenderIconsStripped:v1:${USER}`;
const AVATAR = `data:image/png;base64,${'A'.repeat(34_000)}`;

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({ messageDB: { getBookmarks, putBookmark } }),
}));

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
  usePasskeysContext: () => ({ currentPasskeyInfo: { address: USER } }),
}));

vi.mock('@/hooks/queries/bookmarks/useInvalidateBookmarks', () => ({
  useInvalidateBookmarks: () => invalidateBookmarks,
}));

import { useStripBookmarkSenderIcons } from '@/hooks/business/bookmarks/useStripBookmarkSenderIcons';

const bookmark = (id: string, senderIcon?: string) =>
  ({
    bookmarkId: id,
    messageId: `msg-${id}`,
    spaceId: 'space-1',
    channelId: 'channel-1',
    sourceType: 'channel',
    createdAt: 1_700_000_000_000,
    cachedPreview: {
      senderAddress: 'QmSender000000000000000000000000000000',
      senderName: 'Rosalind',
      ...(senderIcon !== undefined ? { senderIcon } : {}),
      textSnippet: 'keep me',
      messageDate: 1_699_999_000_000,
      sourceName: 'Quorum Test > #general',
      contentType: 'text',
    },
  }) as any;

const makeWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

const runSweep = () => renderHook(() => useStripBookmarkSenderIcons(), { wrapper: makeWrapper() });

beforeEach(() => {
  localStorage.clear();
  getBookmarks.mockReset().mockResolvedValue([]);
  putBookmark.mockReset().mockResolvedValue(undefined);
  invalidateBookmarks.mockReset();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('useStripBookmarkSenderIcons', () => {
  it('rewrites every bookmark carrying an avatar, keeping the rest of the preview', async () => {
    getBookmarks.mockResolvedValue([bookmark('bm-1', AVATAR), bookmark('bm-2', AVATAR)]);

    runSweep();

    await waitFor(() => expect(putBookmark).toHaveBeenCalledTimes(2));
    for (const [written] of putBookmark.mock.calls) {
      expect('senderIcon' in written.cachedPreview).toBe(false);
      expect(written.cachedPreview.senderAddress).toBe(
        'QmSender000000000000000000000000000000'
      );
      expect(written.cachedPreview.textSnippet).toBe('keep me');
    }
  });

  it('writes ONLY the rows that changed', async () => {
    // The stripper returns the same reference when there is nothing to strip.
    // Rewriting a clean row would be a pointless IndexedDB write per bookmark
    // on an account that has already migrated.
    getBookmarks.mockResolvedValue([
      bookmark('bm-1', AVATAR),
      bookmark('bm-2'),
      bookmark('bm-3', AVATAR),
    ]);

    runSweep();

    await waitFor(() => expect(putBookmark).toHaveBeenCalledTimes(2));
    expect(putBookmark.mock.calls.map(([b]) => b.bookmarkId)).toEqual(['bm-1', 'bm-3']);
  });

  it('marks itself done and does not run again on the next launch', async () => {
    getBookmarks.mockResolvedValue([bookmark('bm-1', AVATAR)]);

    runSweep();
    await waitFor(() => expect(localStorage.getItem(FLAG)).toBeTruthy());

    getBookmarks.mockClear();
    putBookmark.mockClear();
    runSweep();

    await new Promise((r) => setTimeout(r, 20));
    expect(getBookmarks).not.toHaveBeenCalled();
    expect(putBookmark).not.toHaveBeenCalled();
  });

  it('refreshes the bookmark views only when it actually changed something', async () => {
    getBookmarks.mockResolvedValue([bookmark('bm-1')]);

    runSweep();

    await waitFor(() => expect(localStorage.getItem(FLAG)).toBeTruthy());
    expect(putBookmark).not.toHaveBeenCalled();
    expect(invalidateBookmarks).not.toHaveBeenCalled();
  });

  it('invalidates the bookmark views after a real rewrite, so open lists re-read', async () => {
    getBookmarks.mockResolvedValue([bookmark('bm-1', AVATAR)]);

    runSweep();

    await waitFor(() => expect(invalidateBookmarks).toHaveBeenCalledWith({ userAddress: USER }));
  });

  it('does NOT mark itself done when a write fails, so it retries next launch', async () => {
    // The case that makes a migration unrecoverable. A flag set after a partial
    // failure means nothing ever sweeps the surviving rows again.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getBookmarks.mockResolvedValue([bookmark('bm-1', AVATAR), bookmark('bm-2', AVATAR)]);
    putBookmark.mockRejectedValueOnce(new Error('QuotaExceededError'));

    runSweep();

    await waitFor(() => expect(putBookmark).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(localStorage.getItem(FLAG)).toBeNull();
  });

  it('does not mark itself done when the read fails either', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getBookmarks.mockRejectedValue(new Error('IndexedDB unavailable'));

    runSweep();

    await new Promise((r) => setTimeout(r, 20));
    expect(localStorage.getItem(FLAG)).toBeNull();
    expect(putBookmark).not.toHaveBeenCalled();
  });

  it('completes cleanly on an account with no bookmarks', async () => {
    runSweep();

    await waitFor(() => expect(localStorage.getItem(FLAG)).toBeTruthy());
    expect(putBookmark).not.toHaveBeenCalled();
  });
});
