const buildChannelKey = ({
  spaceId,
  channelId,
}: {
  spaceId: string;
  channelId: string;
}) => ['Channel', spaceId, channelId];

export { buildChannelKey };
