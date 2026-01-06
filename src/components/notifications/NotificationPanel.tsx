import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Container, FlexRow, Text, Icon, Button, Tooltip, FlexCenter, Select } from '../primitives';
import { DropdownPanel } from '../ui';
import { isTouchDevice } from '../../utils/platform';
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
  spaceRoles?: any[];
  spaceChannels?: any[];
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  spaceId,
  channelIds,
  mapSenderToUser,
  className,
  userRoleIds = [],
  spaceRoles = [],
  spaceChannels = [],
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
    enabledTypes: mentionTypes, // Pass empty array when no mention types selected
    userRoleIds,
  });

  // Fetch replies based on UI filter state
  const { replies, isLoading: repliesLoading } = useAllReplies({
    spaceId,
    channelIds,
    enabled: selectedTypes.includes('reply'),
  });

  // Combine mentions and replies - filtering is now handled by the hooks
  const allNotifications = [
    ...mentions,
    ...replies,
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

  // Handle navigation to message - uses hash-based highlighting (cross-component communication)
  const handleNavigate = useCallback((spaceId: string, channelId: string, messageId: string) => {
    // Close the dropdown
    onClose();

    // Navigate with hash - MessageList handles scroll and Message detects hash for highlighting
    navigate(`/spaces/${spaceId}/${channelId}#msg-${messageId}`);

    // Clean up hash after highlight animation completes (8s matches CSS animation)
    setTimeout(() => {
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
    }, 8000);
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

      // Invalidate all notification-related caches
      // Space-level counts (for SpaceIcon indicators in NavMenu)
      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'space'] });
      queryClient.invalidateQueries({ queryKey: ['reply-counts', 'space'] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts', 'space'] });
      // Channel-level counts (for ChannelList indicators)
      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'channel', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['reply-counts', 'channel', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts', 'channel', spaceId] });
      // NotificationPanel data
      queryClient.invalidateQueries({ queryKey: ['mention-notifications', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['reply-notifications', spaceId] });
      // Conversation data (for read timestamps)
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
          <Icon name="spinner" className="loading-icon icon-spin" />
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
      maxHeight={Math.min(window.innerHeight * 0.8, 600)}
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
        <>
          {/* Mobile: Use new item list layout */}
          {isTouchDevice() ? (
            <div className="mobile-drawer__item-list mobile-drawer__item-list--with-controls">
              {allNotifications.map((notification) => {
                const sender = mapSenderToUser(notification.message.content?.senderId);
                return (
                  <div
                    key={`${notification.message.messageId}-${notification.channelId}`}
                    className="mobile-drawer__item-box mobile-drawer__item-box--interactive"
                  >
                    <NotificationItem
                      notification={notification}
                      onNavigate={handleNavigate}
                      displayName={sender?.displayName || t`Unknown User`}
                      mapSenderToUser={mapSenderToUser}
                      spaceRoles={spaceRoles}
                      spaceChannels={spaceChannels}
                      compactDate={true}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            /* Desktop: Keep existing layout */
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
                    spaceRoles={spaceRoles}
                    spaceChannels={spaceChannels}
                  />
                );
              })}
            </Container>
          )}
        </>
      )}
    </DropdownPanel>
  );
};

export default NotificationPanel;
