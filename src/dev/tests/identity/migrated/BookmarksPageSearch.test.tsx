/**
 * BookmarksPage — the search filter must match the SAME resolved name
 * `BookmarkCard` renders, not the frozen `cachedPreview.senderName` snapshot
 * (final fix wave, finding 5).
 *
 * `BookmarkCard` stopped rendering `cachedPreview.senderName` when it
 * migrated to resolve the sender from `senderAddress` via `src/identity`
 * (see `BookmarkCard.test.tsx`) — but the page's search filter kept matching
 * against that now-invisible frozen string. A sender who renamed themselves
 * AFTER a message was bookmarked would have their old bookmarks silently
 * stop matching their own current name: the card visibly shows the new name,
 * but typing it into search finds nothing.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import type { Bookmark } from '@quilibrium/quorum-shared';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

const SELF_ADDR = 'QmSelf00000000000000000000000000000000';
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({ currentPasskeyInfo: { address: SELF_ADDR } }),
}));

const getPublicProfile = vi.fn();
vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

// No roster/local-name tier needed for this test — search resolution is
// exercised via the global/QNS tier (public profile) alone.
vi.mock('@/hooks/business/identity', () => ({
  useMultiSpaceRosters: () => ({}),
  useLocalDmNames: () => ({}),
}));

const removeBookmark = vi.fn();
let mockBookmarks: Bookmark[] = [];
vi.mock('@/hooks/business/bookmarks', () => ({
  useBookmarks: () => ({
    bookmarks: mockBookmarks,
    bookmarkCount: mockBookmarks.length,
    isLoading: false,
    error: null,
    removeBookmark,
    filterBySourceType: (type: 'channel' | 'dm' | 'all') =>
      type === 'all' ? mockBookmarks : mockBookmarks.filter((b) => b.sourceType === type),
  }),
}));

// BookmarkCard itself is already migrated and covered by its own test —
// stub it here to a bare name label so this test stays focused on the
// search filter, not the card's own rendering.
vi.mock('@/components/bookmarks/BookmarkCard', () => ({
  BookmarkCard: ({ bookmark }: { bookmark: Bookmark }) => (
    <div>{bookmark.cachedPreview.textSnippet}</div>
  ),
}));

import { BookmarksPage } from '@/components/bookmarks/BookmarksPage';

const ADDR = 'QmPeerBEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const bookmark = (overrides: Partial<Bookmark['cachedPreview']> = {}): Bookmark =>
  ({
    bookmarkId: 'bm-1',
    messageId: 'msg-1',
    spaceId: 'space-1',
    channelId: 'channel-1',
    sourceType: 'channel',
    createdAt: 1_700_000_000_000,
    cachedPreview: {
      senderAddress: ADDR,
      // STALE on purpose — the name at bookmark-creation time, no longer
      // what the sender is currently called.
      senderName: 'Old Name',
      textSnippet: 'a message worth finding',
      messageDate: 1_699_999_000_000,
      sourceName: 'Quorum Test > #general',
      contentType: 'text',
      ...overrides,
    },
  }) as Bookmark;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/bookmarks']}>
        <BookmarksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BookmarksPage — search matches the CURRENT resolved name, not the frozen cachedPreview snapshot', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    removeBookmark.mockClear();
  });

  it('finds a bookmark by the sender\'s NEW name after they renamed, even though cachedPreview.senderName is still the old one', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: '', display_name: 'New Name' } });
    mockBookmarks = [bookmark()];

    renderPage();

    // The card is present before any search.
    expect(await screen.findByText('a message worth finding')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search bookmarks...'), 'New Name');

    await waitFor(() => {
      expect(screen.getByText('a message worth finding')).toBeInTheDocument();
    });
  });

  it('does NOT match the stale cachedPreview.senderName once the sender has a resolvable current name', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: '', display_name: 'New Name' } });
    mockBookmarks = [bookmark()];

    renderPage();
    expect(await screen.findByText('a message worth finding')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search bookmarks...'), 'Old Name');

    await waitFor(() => {
      expect(screen.queryByText('a message worth finding')).not.toBeInTheDocument();
      expect(screen.getByText('No bookmarks match your search.')).toBeInTheDocument();
    });
  });
});
