import React from 'react';
import { Icon } from '../primitives';

interface ChannelPreviewProps {
  channelName: string;
  messageCount: number;
}

export const ChannelPreview: React.FC<ChannelPreviewProps> = ({
  channelName,
  messageCount,
}) => {
  return (
    <div className="p-3 bg-chat rounded">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <Icon name="hashtag" size="xs" />
          <span className="text-label-strong">{channelName}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Icon name="message" size="xs" />
          <span className="text-label-strong">
            {messageCount} message{messageCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChannelPreview;
