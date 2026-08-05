import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * `useBookmarkSenderIcon` end to end — the WIRING, not just the picker.
 *
 * `pickBookmarkSenderIcon` is pure and separately tested, but the pure rule
 * only fires on whatever the hook actually reads. These tests cover the part
 * that could silently do nothing: which store is consulted for which kind of
 * bookmark, whether the sender's own address is used as the lookup key, and
 * whether the network fallback is correctly withheld.
 *
 * That last one is not cosmetic. Bookmarks render as a flat list of up to
 * MAX_BOOKMARKS (200) with no virtualization, so a fallback that fires
 * unconditionally is one public-profile request per distinct sender the moment
 * the page opens.
 */

const getSpaceMember = vi.fn();
const getConversation = vi.fn();
const getPublicProfile = vi.fn();

let passkeyInfo: { address?: string; pfpUrl?: string } = {};

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({ messageDB: { getSpaceMember, getConversation } }),
}));

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
  usePasskeysContext: () => ({ currentPasskeyInfo: passkeyInfo }),
}));

vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

import { useBookmarkSenderIcon } from '@/hooks/business/bookmarks/useBookmarkSenderIcon';
import type { Bookmark } from '@quilibrium/quorum-shared';

const SENDER = 'QmSender000000000000000000000000000000';
const ME = 'QmSelf00000000000000000000000000000000';

const OVERRIDE = 'data:image/png;base64,OVERRIDE';
const ROSTER_GLOBAL = 'data:image/png;base64,ROSTERGLOBAL';
const PARTNER = 'data:image/png;base64,PARTNER';
const MY_AVATAR = 'data:image/png;base64,MINE';
const PUBLIC = 'data:image/png;base64,PUBLIC';

const channelBookmark = (senderAddress = SENDER): Bookmark =>
  ({
    bookmarkId: 'bm-1',
    messageId: 'msg-1',
    spaceId: 'space-1',
    channelId: 'channel-1',
    sourceType: 'channel',
    createdAt: 1_700_000_000_000,
    cachedPreview: {
      senderAddress,
      senderName: 'Rosalind',
      textSnippet: 'hello',
      messageDate: 1_699_999_000_000,
      sourceName: 'Quorum Test > #general',
      contentType: 'text',
    },
  }) as Bookmark;

const dmBookmark = (senderAddress = SENDER): Bookmark =>
  ({
    bookmarkId: 'bm-2',
    messageId: 'msg-2',
    conversationId: `${SENDER}/${SENDER}`,
    sourceType: 'dm',
    createdAt: 1_700_000_000_000,
    cachedPreview: {
      senderAddress,
      senderName: 'Rosalind',
      textSnippet: 'hello',
      messageDate: 1_699_999_000_000,
      sourceName: '',
      contentType: 'text',
    },
  }) as Bookmark;

const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

/** Render and let every query settle, so an undefined result means "resolved to nothing". */
const resolve = async (bookmark: Bookmark) => {
  const { result } = renderHook(() => useBookmarkSenderIcon(bookmark), {
    wrapper: makeWrapper(),
  });
  await waitFor(() => {
    if (bookmark.sourceType === 'channel') expect(getSpaceMember).toHaveBeenCalled();
    else expect(getConversation).toHaveBeenCalled();
  });
  return result;
};

beforeEach(() => {
  getSpaceMember.mockReset().mockResolvedValue(undefined);
  getConversation.mockReset().mockResolvedValue({ conversation: undefined });
  getPublicProfile.mockReset().mockResolvedValue({ data: null });
  passkeyInfo = { address: ME, pfpUrl: MY_AVATAR };
});

describe('useBookmarkSenderIcon — which store it reads', () => {
  it('looks a channel sender up on the SENDER address, not ours', async () => {
    // The whole fix rests on senderAddress being the lookup key. Keying on the
    // viewer would return our own row and label every bookmark with our face.
    getSpaceMember.mockResolvedValue({ user_icon: OVERRIDE });
    const result = await resolve(channelBookmark(SENDER));

    expect(getSpaceMember).toHaveBeenCalledWith('space-1', SENDER);
    await waitFor(() => expect(result.current).toBe(OVERRIDE));
  });

  it('falls to the roster global slot when there is no per-space override', async () => {
    getSpaceMember.mockResolvedValue({ user_icon: '', global_user_icon: ROSTER_GLOBAL });
    const result = await resolve(channelBookmark(SENDER));
    await waitFor(() => expect(result.current).toBe(ROSTER_GLOBAL));
  });

  it('reads the conversation record for a DM bookmark', async () => {
    getConversation.mockResolvedValue({
      conversation: { address: SENDER, icon: PARTNER },
    });
    const result = await resolve(dmBookmark(SENDER));

    expect(getConversation).toHaveBeenCalledWith({ conversationId: `${SENDER}/${SENDER}` });
    await waitFor(() => expect(result.current).toBe(PARTNER));
  });

  it('does not consult the space roster for a DM, or the conversation for a channel', async () => {
    await resolve(dmBookmark(SENDER));
    expect(getSpaceMember).not.toHaveBeenCalled();

    getConversation.mockClear();
    await resolve(channelBookmark(SENDER));
    expect(getConversation).not.toHaveBeenCalled();
  });
});

describe('useBookmarkSenderIcon — our own message in a DM', () => {
  it('shows OUR avatar, not the conversation counterpart’s', async () => {
    // The bug this guards: a conversation record is keyed by the counterpart and
    // carries the counterpart's identity. Bookmarking your own DM message is
    // ordinary, and using that icon blindly puts the other person's face next
    // to your name.
    getConversation.mockResolvedValue({
      conversation: { address: SENDER, icon: PARTNER },
    });
    const result = await resolve(dmBookmark(ME));

    await waitFor(() => expect(result.current).toBe(MY_AVATAR));
    expect(result.current).not.toBe(PARTNER);
  });

  it('renders nothing rather than borrowing the counterpart avatar', async () => {
    // Even with no avatar of our own, coloured initials beat the wrong face.
    passkeyInfo = { address: ME, pfpUrl: undefined };
    getConversation.mockResolvedValue({
      conversation: { address: SENDER, icon: PARTNER },
    });
    const result = await resolve(dmBookmark(ME));

    await waitFor(() => expect(getPublicProfile).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });
});

describe('useBookmarkSenderIcon — the network fallback stays withheld', () => {
  it('does NOT fetch a public profile when a local source answered', async () => {
    // 200 bookmarks render at once. An unconditional fetch is one request per
    // distinct sender on page open.
    getSpaceMember.mockResolvedValue({ user_icon: OVERRIDE });
    const result = await resolve(channelBookmark(SENDER));

    await waitFor(() => expect(result.current).toBe(OVERRIDE));
    expect(getPublicProfile).not.toHaveBeenCalled();
  });

  it('DOES fetch when nothing local answered, and uses the result', async () => {
    getSpaceMember.mockResolvedValue(undefined);
    getPublicProfile.mockResolvedValue({ data: { profile_image: PUBLIC } });
    const result = await resolve(channelBookmark(SENDER));

    await waitFor(() => expect(result.current).toBe(PUBLIC));
    expect(getPublicProfile).toHaveBeenCalledWith(SENDER);
  });

  it('resolves to undefined when every source is empty', async () => {
    // Not an error: UserAvatar renders coloured initials.
    passkeyInfo = { address: ME, pfpUrl: undefined };
    const result = await resolve(channelBookmark(SENDER));

    await waitFor(() => expect(getPublicProfile).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });
});
