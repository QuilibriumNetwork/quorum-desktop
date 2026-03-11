import React from 'react';
import { Icon } from '../primitives';
import { useThreadStats } from '../../hooks/business/threads';
import { formatMessageDate } from '../../utils/dateFormatting';
import { t } from '@lingui/core/macro';
import './ThreadIndicator.scss';

interface ThreadIndicatorProps {
  spaceId: string;
  channelId: string;
  threadId: string;
  onClick: () => void;
}

export const ThreadIndicator: React.FC<ThreadIndicatorProps> = ({
  spaceId,
  channelId,
  threadId,
  onClick,
}) => {
  const { data: stats } = useThreadStats({ spaceId, channelId, threadId });
  const replyCount = stats?.replyCount ?? 0;

  return (
    <button
      type="button"
      className="thread-indicator"
      onClick={onClick}
    >
      <Icon name="messages" className="thread-indicator__icon" />
      <span className="thread-indicator__count">
        {replyCount === 0
          ? t`View Thread`
          : replyCount === 1
            ? t`1 reply`
            : t`${replyCount} replies`}
      </span>
      {stats?.lastReplyAt && (
        <span className="thread-indicator__time">
          {formatMessageDate(stats.lastReplyAt, true)}
        </span>
      )}
    </button>
  );
};
