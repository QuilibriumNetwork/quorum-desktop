/**
 * BookmarkItem — the sender line must resolve via the identity module
 * (`<MemberName>`/`useResolvedName`), not render the frozen
 * `cachedPreview.senderName` snapshot.
 *
 * BEFORE this migration the sender line rendered
 * `cachedPreview.senderName || 'Unknown User'` — a name frozen at the moment
 * the message was bookmarked. A per-space nickname added afterwards never
 * appeared, and the QNS `.q` name never appeared at all (cachedPreview has
 * no field for it). Each case below renders with a STALE
 * `cachedPreview.senderName` that disagrees with a live roster/profile, so
 * passing requires actually reading the roster through the identity
 * provider — rendering the frozen field is exactly the bug this is meant to
 * catch red-handed.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import type { Bookmark } from '@quilibrium/quorum-shared';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

const getMessageById = vi.fn();
const getPublicProfile = vi.fn();

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({ messageDB: { getMessageById } }),
}));

vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

import { BookmarkItem } from '@/components/bookmarks/BookmarkItem';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const ADDR = 'QmPeerBEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const bookmark = (senderName: string): Bookmark =>
  ({
    bookmarkId: 'bm-1',
    messageId: 'msg-1',
    spaceId: 'space-1',
    channelId: 'channel-1',
    sourceType: 'channel',
    createdAt: 1_700_000_000_000,
    cachedPreview: {
      senderAddress: ADDR,
      // STALE on purpose — must never reach the screen after migration.
      senderName,
      textSnippet: 'hello there',
      messageDate: 1_699_999_000_000,
      sourceName: 'Quorum Test > #general',
      contentType: 'text',
    },
  }) as Bookmark;

const renderItem = (bm: Bookmark, rosters: Record<string, Record<string, unknown>>) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider rostersBySpace={rosters} selfAddress={null}>
        <BookmarkItem
          bookmark={bm}
          onJumpToMessage={() => {}}
          onRemoveBookmark={() => {}}
        />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
};

describe('BookmarkItem — sender resolves via the identity module', () => {
  it('the load-bearing case: no per-space override, a global name, and a QNS name renders <qns>.q', async () => {
    getMessageById.mockResolvedValue(null);
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderItem(bookmark('Stale Cached Name'), {
      'space-1': { [ADDR]: { display_name: '', global_display_name: 'Alice' } },
    });

    expect(await screen.findByText('alice.q')).toBeInTheDocument();
    expect(screen.queryByText('Stale Cached Name')).not.toBeInTheDocument();
  });

  it('a member WITH a per-space nickname renders the nickname and no .q', async () => {
    getMessageById.mockResolvedValue(null);
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderItem(bookmark('Stale Cached Name'), {
      'space-1': { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
    });

    expect(await screen.findByText('Mod Alice')).toBeInTheDocument();
    expect(screen.queryByText(/\.q/)).not.toBeInTheDocument();
    expect(screen.queryByText('Stale Cached Name')).not.toBeInTheDocument();
  });
});
