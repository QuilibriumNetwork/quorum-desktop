/**
 * BookmarkCard — the sender header must resolve via the identity module
 * (`<MemberName>`/`useResolvedName`), not render the frozen
 * `cachedPreview.senderName` snapshot.
 *
 * BEFORE this migration the header rendered
 * `cachedPreview.senderName || 'Unknown User'` — a name frozen at the moment
 * the message was bookmarked. A per-space nickname added afterwards never
 * appeared, and the QNS `.q` name never appeared at all (cachedPreview has
 * no field for it). Each case below renders with a STALE
 * `cachedPreview.senderName` that disagrees with a live roster/profile, so
 * passing requires actually reading the roster through the identity
 * provider — rendering the frozen field is exactly the bug this is meant to
 * catch red-handed.
 *
 * BookmarkCard is only ever mounted from the standalone /bookmarks page,
 * which spans every space the bookmarks came from — a DETACHED surface, so
 * `spaceId` must come from the bookmark itself, never from context.
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
const getSpaceMember = vi.fn();
const getConversation = vi.fn();
const getPublicProfile = vi.fn();

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({ messageDB: { getMessageById, getSpaceMember, getConversation } }),
}));

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
  usePasskeysContext: () => ({ currentPasskeyInfo: { address: 'QmSelf00000000000000000000000000000000' } }),
}));

vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

import { BookmarkCard } from '@/components/bookmarks/BookmarkCard';
import { IdentityScopeProvider } from '@/identity/identityProvider';
import { ImageModalProvider } from '@/components/context/ImageModalProvider';

const ADDR = 'QmPeerCEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

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

const renderCard = (bm: Bookmark, rosters: Record<string, Record<string, unknown>>) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ImageModalProvider showImageModal={() => {}}>
        <IdentityScopeProvider rostersBySpace={rosters} selfAddress={null}>
          <BookmarkCard
            bookmark={bm}
            onJumpToMessage={() => {}}
            onRemoveBookmark={() => {}}
          />
        </IdentityScopeProvider>
      </ImageModalProvider>
    </QueryClientProvider>,
  );
};

describe('BookmarkCard — sender resolves via the identity module', () => {
  beforeAll(() => {
    getMessageById.mockResolvedValue(null);
    getSpaceMember.mockResolvedValue(undefined);
    getConversation.mockResolvedValue({ conversation: undefined });
  });

  it('the load-bearing case: no per-space override, a global name, and a QNS name renders <qns>.q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderCard(bookmark('Stale Cached Name'), {
      'space-1': { [ADDR]: { display_name: '', global_display_name: 'Alice' } },
    });

    expect(await screen.findByText('alice.q')).toBeInTheDocument();
    expect(screen.queryByText('Stale Cached Name')).not.toBeInTheDocument();
  });

  it('a member WITH a per-space nickname renders the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderCard(bookmark('Stale Cached Name'), {
      'space-1': { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
    });

    expect(await screen.findByText('Mod Alice')).toBeInTheDocument();
    expect(screen.queryByText(/\.q/)).not.toBeInTheDocument();
    expect(screen.queryByText('Stale Cached Name')).not.toBeInTheDocument();
  });
});
