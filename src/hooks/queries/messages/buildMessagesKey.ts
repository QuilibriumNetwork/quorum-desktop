const buildMessagesKey = ({
  spaceId,
  channelId,
  includeThreadReplies = false,
}: {
  spaceId: string;
  channelId: string;
  includeThreadReplies?: boolean;
}) => ['Messages', spaceId, channelId, includeThreadReplies ? 'with-threads' : 'no-threads'];

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
