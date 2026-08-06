import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  buildMessagesKey,
  buildMessagesKeyPrefix,
} from '../../../hooks/queries/messages/buildMessagesKey';

// Regression: pinning a message never optimistically updated the pinned-messages
// panel.
//
// `usePinnedMessages` read the source message out of the Messages cache with a
// hand-rolled THREE-element key:
//
//     queryClient.getQueryData(['Messages', spaceId, channelId])
//
// Real Messages entries are FOUR elements — the last is the thread variant
// ('with-threads' | 'no-threads'). And `getQueryData` is an EXACT hash lookup
// (`queryCache.get(options.queryHash)`), NOT a prefix match, unlike
// `setQueriesData` / `getQueriesData` / `findAll`. So the read always returned
// `undefined`, the `if (messagesData?.pages)` guard was always false, and the
// optimistic append never ran.
//
// The two neighbouring raw literals in the same file were passed to
// `setQueriesData`, which DOES prefix-match, so they worked — which is exactly
// why the broken one blended in.
//
// This is the single instance the `buildMessagesKey` required-parameter change
// could not catch, because a hand-written array literal never goes through the
// builder at all.

const SPACE = 'space-1';
const CHANNEL = 'channel-1';

describe('pinned messages: reading the Messages cache', () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    // Mount a channel the way a threads-disabled space does.
    await queryClient.fetchInfiniteQuery({
      queryKey: buildMessagesKey({
        spaceId: SPACE,
        channelId: CHANNEL,
        includeThreadReplies: true,
      }),
      queryFn: async () => ({
        messages: [{ messageId: 'msg-1' }],
        nextCursor: null,
        prevCursor: null,
      }),
      initialPageParam: undefined,
    });
  });

  it('a hand-rolled 3-element key finds nothing via getQueryData', () => {
    // The old code. getQueryData hashes the key and looks for an exact match.
    const data = queryClient.getQueryData([
      'Messages', SPACE, CHANNEL,
    ]) as { pages?: unknown[] } | undefined;

    expect(data).toBeUndefined();
  });

  it('the prefix does find it via getQueriesData', () => {
    const matches = queryClient.getQueriesData({
      queryKey: buildMessagesKeyPrefix({ spaceId: SPACE, channelId: CHANNEL }),
    });

    expect(matches).toHaveLength(1);
    const [, data] = matches[0] as [unknown, { pages: { messages: { messageId: string }[] }[] }];
    expect(data.pages[0].messages[0].messageId).toBe('msg-1');
  });

  it('control: getQueryData works when handed the full key', () => {
    const data = queryClient.getQueryData(
      buildMessagesKey({
        spaceId: SPACE,
        channelId: CHANNEL,
        includeThreadReplies: true,
      })
    ) as { pages: { messages: { messageId: string }[] }[] } | undefined;

    expect(data?.pages[0].messages[0].messageId).toBe('msg-1');
  });

  it('control: the prefix does not match a different channel', () => {
    const matches = queryClient.getQueriesData({
      queryKey: buildMessagesKeyPrefix({ spaceId: SPACE, channelId: 'other' }),
    });

    expect(matches).toHaveLength(0);
  });
});
