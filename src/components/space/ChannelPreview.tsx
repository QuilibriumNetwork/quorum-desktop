import React from 'react';
import {
  Container,
  Text,
  Icon,
  FlexRow,
  FlexColumn,
  Spacer,
} from '../primitives';

interface ChannelPreviewProps {
  channelName: string;
  messageCount: number;
}

export const ChannelPreview: React.FC<ChannelPreviewProps> = ({
  channelName,
  messageCount,
}) => {
  return (
    <Container padding="sm" backgroundColor="var(--color-bg-chat)">
      <FlexColumn gap="sm">
        {/* Channel name with icon */}
        <FlexRow align="center" gap="xs">
          <Icon name="hashtag" size="xs" />
          <Text variant="main" size="sm">
            {channelName}
          </Text>
        </FlexRow>

        {/* Message count */}
        <FlexRow align="center" gap="xs">
          <Icon name="comment-dots" size="xs" />
          <Text variant="main" size="sm">
            {messageCount} message{messageCount !== 1 ? 's' : ''}
          </Text>
        </FlexRow>
      </FlexColumn>
    </Container>
  );
};

export default ChannelPreview;
