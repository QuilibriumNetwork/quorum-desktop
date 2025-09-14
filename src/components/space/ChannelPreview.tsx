import React from 'react';
import { Text, Icon } from '../primitives';
import { t } from '@lingui/core/macro';

interface ChannelPreviewProps {
  channelName: string;
  messageCount: number;
}

export const ChannelPreview: React.FC<ChannelPreviewProps> = ({
  channelName,
  messageCount,
}) => {
  return (
    <div className="space-y-2 p-2">
      {/* Channel name with icon */}
      <div className="flex items-center gap-2">
        <Icon name="hashtag" size="xs" className="text-muted flex-shrink-0" />
        <Text variant="main" size="sm">
          {channelName}
        </Text>
      </div>

      {/* Message count */}
      <div className="flex items-center gap-2">
        <Icon name="comment-dots" size="xs" className="text-muted flex-shrink-0" />
        <Text variant="main" size="sm">
          {messageCount} message{messageCount !== 1 ? 's' : ''}
        </Text>
      </div>
    </div>
  );
};

export default ChannelPreview;