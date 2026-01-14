import React from 'react';
import {
  Container,
  Text,
  Icon,
  Flex,
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
      <Flex direction="column" gap="sm">
        {/* Channel name with icon */}
        <Flex align="center" gap="xs">
          <Icon name="hashtag" size="xs" />
          <Text variant="main" size="sm">
            {channelName}
          </Text>
        </Flex>

        {/* Message count */}
        <Flex align="center" gap="xs">
          <Icon name="message" size="xs" />
          <Text variant="main" size="sm">
            {messageCount} message{messageCount !== 1 ? 's' : ''}
          </Text>
        </Flex>
      </Flex>
    </Container>
  );
};

export default ChannelPreview;
