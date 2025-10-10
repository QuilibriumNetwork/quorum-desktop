import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Container, FlexRow, Text, Icon, Button, Tooltip, FlexCenter, Select } from '../primitives';
import { DropdownPanel } from '../ui';
import { NotificationItem } from './NotificationItem';
import { useAllMentions } from '../../hooks/business/mentions';
import { useMessageHighlight } from '../../hooks/business/messages/useMessageHighlight';
import { useMessageDB } from '../context/useMessageDB';
import { useQueryClient } from '@tanstack/react-query';
import type { MentionTypeId } from '../../types/notifications';
import './NotificationPanel.scss';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  channelIds: string[];
  mapSenderToUser: (senderId: string) => any;
  virtuosoRef?: any; // For scrolling to message
  messageList?: any[]; // For scrolling to message
  className?: string;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  spaceId,
  channelIds,
  mapSenderToUser,
  virtuosoRef,
  messageList,
  className,
}) => {
  const navigate = useNavigate();
  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();

  // Filter state (all types enabled by default)
  const [selectedTypes, setSelectedTypes] = useState<MentionTypeId[]>(['you', 'everyone', 'roles']);

  // Fetch mentions with current filter
  const { mentions, isLoading } = useAllMentions({
    spaceId,
    channelIds,
    enabledTypes: selectedTypes,
  });

  // Use the message highlighting system
  const { highlightMessage, scrollToMessage } = useMessageHighlight();

  // Filter options for Select primitive
  const filterOptions = [
    {
      value: 'you' as MentionTypeId,
      label: t`@you`,
    },
    {
      value: 'everyone' as MentionTypeId,
      label: t`@everyone`,
    },
    {
      value: 'roles' as MentionTypeId,
      label: t`@roles`,
    },
  ];

  // Handle filter change - ensure at least one is always selected
  const handleFilterChange = useCallback((newValues: string[]) => {
    if (newValues.length === 0) {
      // Don't allow deselecting all
      return;
    }
    setSelectedTypes(newValues as MentionTypeId[]);
  }, []);

  // Handle navigation to message
  const handleNavigate = useCallback((spaceId: string, channelId: string, messageId: string) => {
    // Close the dropdown
    onClose();

    // Navigate to the channel (route pattern is /spaces/:spaceId/:channelId)
    navigate(`/spaces/${spaceId}/${channelId}`);

    // After navigation, scroll and highlight
    setTimeout(() => {
      scrollToMessage(messageId, virtuosoRef, messageList);
      highlightMessage(messageId, { duration: 6000 }); // 6s for mentions
    }, 100);
  }, [navigate, onClose, scrollToMessage, highlightMessage, virtuosoRef, messageList]);

  // Handle mark all as read
  const handleMarkAllRead = useCallback(async () => {
    try {
      // Get current timestamp
      const now = Date.now();

      // Update last read time for all channels with mentions
      const channelsWithMentions = new Set(mentions.map(m => m.channelId));

      for (const channelId of channelsWithMentions) {
        const conversationId = `${spaceId}/${channelId}`;
        await messageDB.saveReadTime({
          conversationId,
          lastMessageTimestamp: now,
        });
      }

      // Invalidate mention count caches
      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'channel', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['mention-notifications', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });

      // Close dropdown
      onClose();
    } catch (error) {
      console.error('[NotificationPanel] Error marking all as read:', error);
    }
  }, [mentions, spaceId, messageDB, queryClient, onClose]);

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
        <Icon name="bell" className="empty-icon" />
        <Text className="empty-message">{t`No unread mentions`}</Text>
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
        mentions.length === 1
          ? t`${mentions.length} unread mention`
          : t`${mentions.length} unread mentions`
      }
      className={`notification-panel ${className || ''}`}
      showCloseButton={true}
    >
      {/* Filter controls - only show when there are mentions */}
      {!isLoading && mentions.length > 0 && (
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
      {isLoading || mentions.length === 0 ? (
        renderEmptyState()
      ) : (
        <Container className="notification-panel__list">
          {mentions.map((notification) => {
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
