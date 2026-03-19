import { useState, useMemo, useEffect } from 'react';
import { t } from '@lingui/core/macro';
import { DropdownPanel } from '../ui/DropdownPanel';
import ListSearchInput from '../ui/ListSearchInput';
import { ThreadListItem } from './ThreadListItem';
import { Icon, Flex } from '../primitives';
import { useChannelThreads } from '../../hooks/business/threads/useChannelThreads';
import { useMessageDB } from '../context/useMessageDB';
import { useThreadContext } from '../context/ThreadContext';
import { isTouchDevice } from '../../utils/platform';
import type { ChannelThread } from '@quilibrium/quorum-shared';
import './ThreadsListPanel.scss';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface ThreadsListPanelProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  channelId: string;
  mapSenderToUser: (senderId: string) => { displayName?: string } | undefined;
}

type ListItem =
  | { type: 'header'; label: string }
  | { type: 'thread'; thread: ChannelThread };

export function ThreadsListPanel({
  isOpen,
  onClose,
  spaceId,
  channelId,
  mapSenderToUser,
}: ThreadsListPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { messageDB } = useMessageDB();
  const { openThread } = useThreadContext();
  const { data: threads = [], isLoading } = useChannelThreads({
    spaceId,
    channelId,
    enabled: isOpen,
  });

  // Clear search when panel closes
  useEffect(() => {
    if (!isOpen) setSearchQuery('');
  }, [isOpen]);

  const resolveDisplayName = (senderId: string) =>
    mapSenderToUser(senderId)?.displayName ?? senderId;

  const listItems = useMemo((): ListItem[] => {
    const now = Date.now();
    const query = searchQuery.trim().toLowerCase();

    if (query) {
      const filtered = threads.filter((t) => {
        const title = (t.customTitle ?? t.titleSnapshot ?? 'Thread').toLowerCase();
        return title.includes(query);
      });
      return filtered.map((thread) => ({ type: 'thread', thread }));
    }

    const joined = threads.filter((t) => t.hasParticipated);
    const active = threads.filter(
      (t) => !t.hasParticipated && t.lastActivityAt > now - SEVEN_DAYS_MS
    );
    const older = threads.filter(
      (t) => !t.hasParticipated && t.lastActivityAt <= now - SEVEN_DAYS_MS
    );

    const items: ListItem[] = [];
    if (joined.length > 0) {
      items.push({ type: 'header', label: 'JOINED THREADS' });
      joined.forEach((thread) => items.push({ type: 'thread', thread }));
    }
    if (active.length > 0) {
      items.push({ type: 'header', label: 'OTHER ACTIVE THREADS' });
      active.forEach((thread) => items.push({ type: 'thread', thread }));
    }
    if (older.length > 0) {
      items.push({ type: 'header', label: 'OLDER THREADS' });
      older.forEach((thread) => items.push({ type: 'thread', thread }));
    }
    return items;
  }, [threads, searchQuery]);

  const handleOpen = async (rootMessageId: string) => {
    const rootMessage = await messageDB.getMessageById(rootMessageId);
    if (!rootMessage) return;
    onClose();
    openThread(rootMessage);
  };

  const headerContent = (
    <Flex className="items-center gap-2 flex-1 min-w-0">
      <span className="dropdown-panel__title">{t`Threads`}</span>
      <ListSearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t`Search threads…`}
        variant="bordered"
        clearable
      />
    </Flex>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <Flex justify="center" align="center" className="threads-empty-state">
          <Icon name="spinner" className="loading-icon icon-spin" />
        </Flex>
      );
    }

    if (threads.length === 0) {
      return (
        <Flex justify="center" align="center" className="threads-empty-state">
          <Icon name="messages" size="3xl" className="empty-icon" />
          <span className="empty-message">{t`No threads yet`}</span>
          <span className="empty-hint">{t`Start a thread from any message`}</span>
        </Flex>
      );
    }

    if (searchQuery && listItems.length === 0) {
      return (
        <Flex justify="center" align="center" className="threads-empty-state">
          <Icon name="search" size="3xl" className="empty-icon" />
          <span className="empty-message">{t`No threads match your search`}</span>
        </Flex>
      );
    }

    if (isTouchDevice()) {
      return (
        <div className="mobile-drawer__item-list">
          {listItems.map((item, i) =>
            item.type === 'header' ? (
              <div key={`header-${i}`} className="threads-section-header">
                {item.label}
              </div>
            ) : (
              <div
                key={item.thread.threadId}
                className="mobile-drawer__item-box mobile-drawer__item-box--interactive"
              >
                <ThreadListItem
                  thread={item.thread}
                  onOpen={handleOpen}
                  resolveDisplayName={resolveDisplayName}
                />
              </div>
            )
          )}
        </div>
      );
    }

    return (
      <div className="threads-results-list">
        {listItems.map((item, i) =>
          item.type === 'header' ? (
            <div key={`header-${i}`} className="threads-section-header">
              {item.label}
            </div>
          ) : (
            <ThreadListItem
              key={item.thread.threadId}
              thread={item.thread}
              onOpen={handleOpen}
              resolveDisplayName={resolveDisplayName}
            />
          )
        )}
      </div>
    );
  };

  return (
    <DropdownPanel
      isOpen={isOpen}
      onClose={onClose}
      position="absolute"
      positionStyle="right-aligned"
      maxWidth={500}
      maxHeight={Math.min(window.innerHeight * 0.8, 600)}
      showCloseButton={true}
      className="threads-list-panel"
      headerContent={headerContent}
    >
      {renderContent()}
    </DropdownPanel>
  );
}
