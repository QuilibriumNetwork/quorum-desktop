import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  buildMessagesKey,
  buildMessagesKeyPrefix,
} from '../../../hooks/queries/messages/buildMessagesKey';

// Regression: a channel stays COMPLETELY empty until the page is refreshed.
//
// Messages arriving over the peer-sync path are written straight to IndexedDB,
// then the open channel is refreshed with a `refetchQueries`. Those call sites
// used `buildMessagesKey({ spaceId, channelId })` — omitting the
// `includeThreadReplies` flag, which used to DEFAULT to false and so pinned the
// key to its 'no-threads' variant.
//
// The mounted channel picks its variant the other way round:
//   Channel.tsx         threadsEnabled = !!space?.allowThreads && channel?.allowThreads !== false
//   useChannelMessages  includeThreadReplies: !threadsEnabled
//
// So a space with threads DISABLED — the default — mounts under 'with-threads',
// and every sync-path refetch targeted 'no-threads'. It matched nothing, the
// cache kept whatever it resolved to at mount, and a channel opened while its
// history was still syncing stayed empty for the life of that mount. Reloading
// re-reads IndexedDB, which is why a refresh "fixed" it.
//
// The flag is now REQUIRED, so omitting it is a compile error rather than a
// silent variant choice, and every conversation-wide write/refetch was moved to
// `buildMessagesKeyPrefix`. These tests pin the matching behaviour that fix
// depends on.

const SPACE = 'space-1';
const CHANNEL = 'channel-1';

describe('messages query key variants', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });

  /** Mount a channel query under one variant and report its queryFn. */
  const mountChannelQuery = async (includeThreadReplies: boolean) => {
    const queryFn = vi.fn().mockResolvedValue({
      messages: [],
      nextCursor: null,
      prevCursor: null,
    });
    await queryClient.fetchInfiniteQuery({
      queryKey: buildMessagesKey({
        spaceId: SPACE,
        channelId: CHANNEL,
        includeThreadReplies,
      }),
      queryFn,
      initialPageParam: undefined,
    });
    return queryFn;
  };

  it('the two variants are genuinely different keys', () => {
    expect(
      buildMessagesKey({ spaceId: SPACE, channelId: CHANNEL, includeThreadReplies: true })
    ).toEqual(['Messages', SPACE, CHANNEL, 'with-threads']);
    expect(
      buildMessagesKey({ spaceId: SPACE, channelId: CHANNEL, includeThreadReplies: false })
    ).toEqual(['Messages', SPACE, CHANNEL, 'no-threads']);
  });

  it('an exact key does not match the other variant', async () => {
    // threadsEnabled === false  =>  the channel mounts 'with-threads'
    await mountChannelQuery(true);

    const matched = queryClient.getQueryCache().findAll({
      queryKey: buildMessagesKey({
        spaceId: SPACE,
        channelId: CHANNEL,
        includeThreadReplies: false,
      }),
    });

    // This is the trap the whole bug rested on.
    expect(matched).toHaveLength(0);
  });

  it('the prefix matches a channel mounted under either variant', async () => {
    for (const variant of [true, false]) {
      queryClient.clear();
      await mountChannelQuery(variant);

      const matched = queryClient.getQueryCache().findAll({
        queryKey: buildMessagesKeyPrefix({ spaceId: SPACE, channelId: CHANNEL }),
      });

      expect(matched, `variant includeThreadReplies=${variant}`).toHaveLength(1);
    }
  });

  it('refetchQueries with the prefix re-reads a threads-disabled channel', async () => {
    const queryFn = await mountChannelQuery(true);
    expect(queryFn).toHaveBeenCalledTimes(1); // the mount fetch

    await queryClient.refetchQueries({
      queryKey: buildMessagesKeyPrefix({ spaceId: SPACE, channelId: CHANNEL }),
    });

    // 2 = the newly-synced messages in IndexedDB actually get read.
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('refetchQueries with the prefix re-reads a threads-enabled channel too', async () => {
    const queryFn = await mountChannelQuery(false);
    expect(queryFn).toHaveBeenCalledTimes(1);

    await queryClient.refetchQueries({
      queryKey: buildMessagesKeyPrefix({ spaceId: SPACE, channelId: CHANNEL }),
    });

    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('the prefix does not leak across channels', async () => {
    await mountChannelQuery(true);

    const matched = queryClient.getQueryCache().findAll({
      queryKey: buildMessagesKeyPrefix({ spaceId: SPACE, channelId: 'other-channel' }),
    });

    expect(matched).toHaveLength(0);
  });
});
