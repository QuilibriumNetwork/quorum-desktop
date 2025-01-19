const buildMessagesKey = ({
  spaceId,
  channelId,
}: {
  spaceId: string;
  channelId: string;
}) => ['Messages', spaceId, channelId];

export { buildMessagesKey };
