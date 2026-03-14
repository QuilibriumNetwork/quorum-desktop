const buildMessagesKey = ({
  spaceId,
  channelId,
  includeThreadReplies = false,
}: {
  spaceId: string;
  channelId: string;
  includeThreadReplies?: boolean;
}) => ['Messages', spaceId, channelId, includeThreadReplies ? 'with-threads' : 'no-threads'];

export { buildMessagesKey };
