import React from 'react';
import {
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
    <div style={{ padding: 'var(--space-sm)', backgroundColor: 'var(--color-bg-chat)' }}>
      <Flex direction="column" gap="sm">
        {/* Channel name with icon */}
        <Flex align="center" gap="xs">
          <Icon name="hashtag" size="xs" />
          <span className="text-label-strong">
            {channelName}
          </span>
        </Flex>

        {/* Message count */}
        <Flex align="center" gap="xs">
          <Icon name="message" size="xs" />
          <span className="text-label-strong">
            {messageCount} message{messageCount !== 1 ? 's' : ''}
          </span>
        </Flex>
      </Flex>
    </div>
  );
};

export default ChannelPreview;
