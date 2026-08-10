import { formatRelativeTime } from '@quilibrium/quorum-shared';
import { Icon } from '../primitives';
import type { ChannelThread } from '@quilibrium/quorum-shared';
import { MemberName } from '../../identity';

interface ThreadListItemProps {
  thread: ChannelThread;
  onOpen: (rootMessageId: string) => void;
}

export function ThreadListItem({ thread, onOpen }: ThreadListItemProps) {
  const title = thread.customTitle ?? thread.titleSnapshot ?? 'Thread';
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
        {/* Bounded per-panel surface (one row per thread starter) — enrich
            so a QNS-verified starter shows their ".q". */}
        <span>{'Started by '}<MemberName address={thread.createdBy} enrich /></span>
        <span className="thread-list-item__dot">&middot;</span>
        <span>{replyLabel}</span>
        <span className="thread-list-item__dot">&middot;</span>
        <span>{timeAgo}</span>
      </div>
    </div>
  );
}
