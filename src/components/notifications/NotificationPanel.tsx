import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Container, FlexRow, Text, Icon, Button, Tooltip, FlexCenter, Select } from '../primitives';
import { DropdownPanel } from '../ui';
import { NotificationItem } from './NotificationItem';
import { useAllMentions, useMentionNotificationSettings } from '../../hooks/business/mentions';
import { useAllReplies } from '../../hooks/business/replies';
import { useMessageDB } from '../context/useMessageDB';
import { useQueryClient } from '@tanstack/react-query';
import type { NotificationTypeId } from '../../types/notifications';
import './NotificationPanel.scss';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  channelIds: string[];
  mapSenderToUser: (senderId: string) => any;
  className?: string;
  userRoleIds?: string[];
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  spaceId,
  channelIds,
  mapSenderToUser,
  className,
  userRoleIds = [],
}) => {
  const navigate = useNavigate();
  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();

  // Load user's saved notification settings for this space
  const { selectedTypes: savedTypes, isLoading: settingsLoading } = useMentionNotificationSettings({ spaceId });

  // Local filter state (syncs with saved settings)
  const [selectedTypes, setSelectedTypes] = useState<NotificationTypeId[]>(savedTypes);

  // Sync local state when saved settings change
  useEffect(() => {
    setSelectedTypes(savedTypes);
  }, [savedTypes]);

  // Derive mention-only filter for useAllMentions (unified format)
  const mentionTypes = selectedTypes.filter(t => t.startsWith('mention-')) as ('mention-you' | 'mention-everyone' | 'mention-roles')[];

  // Fetch mentions with current filter
  const { mentions, isLoading: mentionsLoading } = useAllMentions({
    spaceId,
    channelIds,
    enabledTypes: mentionTypes.length > 0 ? mentionTypes : undefined,
    userRoleIds,
  });

  // Fetch replies (only if 'reply' is selected)
  const { replies, isLoading: repliesLoading } = useAllReplies({
    spaceId,
    channelIds,
  });

  // Combine mentions and replies based on filter
  const allNotifications = [
    ...mentions,
    ...(selectedTypes.includes('reply') ? replies : []),
  ].sort((a, b) => b.message.createdDate - a.message.createdDate);

  const isLoading = mentionsLoading || repliesLoading || settingsLoading;

  // Filter options for Select primitive
  const filterOptions = [
    {
      value: 'mention-you' as NotificationTypeId,
      label: t`@you`,
    },
    {
      value: 'mention-everyone' as NotificationTypeId,
      label: t`@everyone`,
    },
    {
      value: 'mention-roles' as NotificationTypeId,
      label: t`@roles`,
      disabled: false,
    },
    {
      value: 'reply' as NotificationTypeId,
      label: t`Replies`,
    },
  ];

  // Handle filter change - ensure at least one is always selected
  const handleFilterChange = useCallback((newValues: string[]) => {
    if (newValues.length === 0) {
      // Don't allow deselecting all
      return;
    }
    setSelectedTypes(newValues as NotificationTypeId[]);
  }, []);

  // Handle navigation to message
  const handleNavigate = useCallback((spaceId: string, channelId: string, messageId: string) => {
    // Close the dropdown
    onClose();

    // Always use URL hash navigation for consistency and reliability
    // MessageList already handles #msg- hash by scrolling to the message
    // Message component applies .message-highlighted class when hash matches
    navigate(`/spaces/${spaceId}/${channelId}#msg-${messageId}`);
  }, [navigate, onClose]);

  // Handle mark all as read
  const handleMarkAllRead = useCallback(async () => {
    try {
      // Get current timestamp
      const now = Date.now();

      // Update last read time for all channels with notifications
      const channelsWithNotifications = new Set(allNotifications.map(n => n.channelId));

      for (const channelId of channelsWithNotifications) {
        const conversationId = `${spaceId}/${channelId}`;
        await messageDB.saveReadTime({
          conversationId,
          lastMessageTimestamp: now,
        });
      }

      // Invalidate both mention and reply count caches
      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'channel', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['mention-notifications', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['reply-counts', 'channel', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['reply-notifications', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });

      // Close dropdown
      onClose();
    } catch (error) {
      console.error('[NotificationPanel] Error marking all as read:', error);
    }
  }, [allNotifications, spaceId, messageDB, queryClient, onClose]);

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <FlexCenter className="notification-loading-state">
          <Icon name="spinner" className="loading-icon" spin />
          <Text className="loading-message">{t`Loading notifications...`}</Text>
        </FlexCenter>
      );
    }

    return (
      <FlexCenter className="notification-empty-state">
        <Icon name="bell" size="3xl" className="empty-icon" />
        <Text className="empty-message">{t`No unread notifications`}</Text>
        <Text className="empty-hint">
          {t`You're all caught up!`}
        </Text>
      </FlexCenter>
    );
  };

  return (
    <DropdownPanel
      isOpen={isOpen}
      onClose={onClose}
      position="absolute"
      positionStyle="right-aligned"
      maxWidth={500}
      maxHeight={420}
      title={
        allNotifications.length === 1
          ? t`${allNotifications.length} notification`
          : t`${allNotifications.length} notifications`
      }
      className={`notification-panel ${className || ''}`}
      showCloseButton={true}
    >
      {/* Filter controls - only show when there are notifications */}
      {!isLoading && allNotifications.length > 0 && (
        <Container className="notification-panel__controls">
          <FlexRow className="items-center justify-between gap-2">
            <Select
              value={selectedTypes}
              onChange={handleFilterChange}
              options={filterOptions}
              multiple={true}
              compactMode={true}
              compactIcon="filter"
              showSelectionCount={false}
              showSelectAllOption={false}
              size="medium"
            />

            <Tooltip
              id="mark-all-read-tooltip"
              content={t`Mark all as read`}
              place="top"
            >
              <Button
                type="unstyled"
                onClick={handleMarkAllRead}
                className="notification-panel__mark-read"
                iconName="check-circle"
                iconOnly
              />
            </Tooltip>
          </FlexRow>
        </Container>
      )}

      {/* Notification list */}
      {isLoading || allNotifications.length === 0 ? (
        renderEmptyState()
      ) : (
        <Container className="notification-panel__list">
          {allNotifications.map((notification) => {
            const sender = mapSenderToUser(notification.message.content?.senderId);
            return (
              <NotificationItem
                key={`${notification.message.messageId}-${notification.channelId}`}
                notification={notification}
                onNavigate={handleNavigate}
                displayName={sender?.displayName || t`Unknown User`}
                mapSenderToUser={mapSenderToUser}
              />
            );
          })}
        </Container>
      )}
    </DropdownPanel>
  );
};

export default NotificationPanel;
