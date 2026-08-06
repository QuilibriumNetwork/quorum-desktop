/**
 * The exact key one message list mounts under.
 *
 * `includeThreadReplies` is REQUIRED on purpose. It used to default to `false`,
 * which read as "the flag is optional" but actually meant "pin this to the
 * 'no-threads' variant". Nine call sites omitted it, and a space with threads
 * disabled — the default — mounts under 'with-threads'
 * (`useChannelMessages` passes `includeThreadReplies: !threadsEnabled`), so
 * every one of those writes and refetches silently matched nothing. A channel
 * whose history arrived over the sync path while it was open stayed completely
 * empty until the page was reloaded.
 *
 * Use this ONLY where you genuinely mean one specific variant — in practice
 * that is `useMessages` and the callers that already know `threadsEnabled`.
 * To update or refetch "whatever this conversation actually mounted", use
 * `buildMessagesKeyPrefix` with `setQueriesData` / `invalidateQueries` /
 * `refetchQueries`, which prefix-match both variants.
 */
const buildMessagesKey = ({
  spaceId,
  channelId,
  includeThreadReplies,
}: {
  spaceId: string;
  channelId: string;
  includeThreadReplies: boolean;
}) => [
  'Messages',
  spaceId,
  channelId,
  includeThreadReplies ? 'with-threads' : 'no-threads',
];

/**
 * Returns the 3-element prefix key for matching all thread variants.
 * Use with setQueriesData/invalidateQueries which do prefix matching.
 * This matches both 'with-threads' and 'no-threads' query key variants.
 */
const buildMessagesKeyPrefix = ({
  spaceId,
  channelId,
}: {
  spaceId: string;
  channelId: string;
}) => ['Messages', spaceId, channelId];

export { buildMessagesKey, buildMessagesKeyPrefix };
