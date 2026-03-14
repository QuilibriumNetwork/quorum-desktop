import { formatRelativeTime } from '@quilibrium/quorum-shared';
import { Icon } from '../primitives';
import type { ChannelThread } from '../../api/quorumApi';

interface ThreadListItemProps {
  thread: ChannelThread;
  onOpen: (rootMessageId: string) => void;
  resolveDisplayName: (senderId: string) => string;
}

export function ThreadListItem({ thread, onOpen, resolveDisplayName }: ThreadListItemProps) {
  const title = thread.customTitle ?? thread.titleSnapshot ?? 'Thread';
  const creatorName = resolveDisplayName(thread.createdBy);
  const replyLabel = thread.replyCount === 1 ? '1 reply' : `${thread.replyCount} replies`;
  const timeAgo = formatRelativeTime(thread.lastActivityAt);

  return (
    <div
      className="thread-list-item"
      onClick={() => onOpen(thread.rootMessageId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(thread.rootMessageId); }}
    >
      <div className="thread-list-item__title-row">
        {thread.isClosed && (
          <span data-testid="lock-icon" className="thread-list-item__lock">
            <Icon name="lock" size="sm" />
          </span>
        )}
        <span className="thread-list-item__title">{title}</span>
      </div>
      <div className="thread-list-item__meta">
        <span>{`Started by ${creatorName}`}</span>
        <span className="thread-list-item__dot">&middot;</span>
        <span>{replyLabel}</span>
        <span className="thread-list-item__dot">&middot;</span>
        <span>{timeAgo}</span>
      </div>
    </div>
  );
}
