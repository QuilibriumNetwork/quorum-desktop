import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Flex, Icon, Button, Tooltip, Select, Modal } from '../primitives';
import { DropdownPanel } from '../ui';
import { isTouchDevice } from '../../utils/platform';
import { buildMessageHash } from '../../utils/messageHashNavigation';
import { resolveSpaceMemberName, formatResolvedName } from '../../utils/resolveMemberName';
import { NotificationItem } from './NotificationItem';
import { useAllMentions, useMentionNotificationSettings } from '../../hooks/business/mentions';
import { useAllReplies } from '../../hooks/business/replies';
import { useGlobalNotifications, GLOBAL_DISPLAY_CAP } from '../../hooks/business/notifications';
import { useMessageDB } from '../context/useMessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { useConfirmation } from '../../hooks/ui/useConfirmation';
import ConfirmationModal from '../modals/ConfirmationModal';
import type { SpaceNotificationTypeId } from '../../types/notifications';
import type { Space } from '@quilibrium/quorum-shared';
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
  /** Global mode: aggregate across all spaces, centered presentation. */
  global?: boolean;
  /** Required in global mode: all the user's spaces. */
  spaces?: Space[];
  /** Global mode sender resolver (spaceId, senderId) → user. */
  resolveGlobalSender?: (spaceId: string, senderId: string) => any;
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
  global = false,
  spaces,
  resolveGlobalSender,
}) => {
  const navigate = useNavigate();
  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();


  // Load user's saved notification settings for this space
  const { selectedTypes: savedTypes, isLoading: settingsLoading } = useMentionNotificationSettings({ spaceId });

  // Local filter state (syncs with saved settings)
  const [selectedTypes, setSelectedTypes] = useState<SpaceNotificationTypeId[]>(savedTypes);

  // Sync local state when saved settings change
  useEffect(() => {
    setSelectedTypes(savedTypes);
  }, [savedTypes]);

  // Derive mention-only filter for useAllMentions (unified format)
  const mentionTypes = selectedTypes.filter(t => t.startsWith('mention-')) as ('mention-you' | 'mention-everyone' | 'mention-roles')[];

  // Whether reply notifications are enabled
  const replyEnabled = selectedTypes.includes('reply');

  // Per-space path (existing) — empty channelIds in global mode disables it.
  const { mentions: spaceMentions, isLoading: smLoading } = useAllMentions({
    spaceId,
    channelIds: global ? [] : channelIds,
    enabledTypes: mentionTypes,
    userRoleIds,
  });
  const { replies: spaceReplies, isLoading: srLoading } = useAllReplies({
    spaceId,
    channelIds: global ? [] : channelIds,
    enabled: replyEnabled,
  });

  // Global path — empty spaces in per-space mode disables it.
  const { notifications: globalNotifications, truncated: globalTruncated, isLoading: gLoading } = useGlobalNotifications({
    spaces: global ? (spaces ?? []) : [],
    enabledTypes: mentionTypes,
    replyEnabled,
  });

  const allNotifications = global
    ? globalNotifications
    : [...spaceMentions, ...spaceReplies].sort((a, b) => b.message.createdDate - a.message.createdDate);

  const isLoading = global
    ? (gLoading || settingsLoading)
    : (smLoading || srLoading || settingsLoading);

  // Filter options for Select primitive
  const filterOptions = [
    {
      value: 'mention-you' as SpaceNotificationTypeId,
      label: t`@you`,
    },
    {
      value: 'mention-everyone' as SpaceNotificationTypeId,
      label: t`@everyone`,
    },
    {
      value: 'mention-roles' as SpaceNotificationTypeId,
      label: t`@roles`,
      disabled: false,
    },
    {
      value: 'reply' as SpaceNotificationTypeId,
      label: t`Replies`,
    },
  ];

  // Handle filter change - ensure at least one is always selected
  const handleFilterChange = useCallback((newValues: string[]) => {
    if (newValues.length === 0) {
      // Don't allow deselecting all
      return;
    }
    setSelectedTypes(newValues as SpaceNotificationTypeId[]);
  }, []);

  // Handle navigation to message - uses hash-based highlighting (cross-component communication)
  const handleNavigate = useCallback((spaceId: string, channelId: string, messageId: string, threadId?: string) => {
    onClose();

    // buildMessageHash returns #msg-{id} or #thread-{threadId}-msg-{id}
    const hash = buildMessageHash(messageId, threadId);
    navigate(`/spaces/${spaceId}/${channelId}${hash}`);

    // Clean up hash after highlight animation completes (8s matches CSS animation)
    setTimeout(() => {
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
    }, 8000);
  }, [navigate, onClose]);

  // Core mark-all-read logic (handles both per-space and global modes)
  const handleMarkAllReadCore = useCallback(async () => {
    try {
      const now = Date.now();
      const pairs = new Map<string, { spaceId: string; channelId: string }>();
      for (const n of allNotifications) {
        const sId = global ? ((n as any).spaceId ?? spaceId) : spaceId;
        pairs.set(`${sId}/${n.channelId}`, { spaceId: sId, channelId: n.channelId });
      }
      for (const { spaceId: sId, channelId } of pairs.values()) {
        await messageDB.saveReadTime({
          conversationId: `${sId}/${channelId}`,
          lastMessageTimestamp: now,
        });
      }

      const threadEntries: Array<{ threadId: string; spaceId: string; channelId: string; lastReadTimestamp: number }> = [];
      for (const { spaceId: sId, channelId } of pairs.values()) {
        const threads = await messageDB.getChannelThreads({ spaceId: sId, channelId });
        for (const thread of threads) {
          threadEntries.push({ threadId: thread.threadId, spaceId: sId, channelId, lastReadTimestamp: now });
        }
      }
      if (threadEntries.length > 0) await messageDB.bulkSaveThreadReadTimes(threadEntries);

      // Invalidate all notification-related caches (broad prefix so global mode refreshes every space)
      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'space'] });
      queryClient.invalidateQueries({ queryKey: ['reply-counts', 'space'] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts', 'space'] });
      queryClient.invalidateQueries({ queryKey: ['mention-counts', 'channel'] });
      queryClient.invalidateQueries({ queryKey: ['reply-counts', 'channel'] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts', 'channel'] });
      queryClient.invalidateQueries({ queryKey: ['mention-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['reply-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });

      onClose();
    } catch (error) {
      console.error('[NotificationPanel] Error marking all as read:', error);
    }
  }, [allNotifications, spaceId, global, messageDB, queryClient, onClose]);

  // Confirmation hook for global mode mark-all-read
  const confirm = useConfirmation({
    type: 'modal',
    modalConfig: {
      variant: 'warning',
      title: t`Mark all as read?`,
      message: t`This marks mentions and replies as read across all your spaces. This can't be undone.`,
      confirmText: t`Mark all read`,
      cancelText: t`Cancel`,
    },
  });

  // In global mode, gate mark-all-read behind a confirmation modal
  const handleMarkAllRead = useCallback((e: React.MouseEvent) => {
    if (global) {
      confirm.handleClick(e, handleMarkAllReadCore);
    } else {
      handleMarkAllReadCore();
    }
  }, [global, confirm, handleMarkAllReadCore]);

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <Flex direction="column" justify="center" align="center" className="notification-loading-state">
          <Icon name="spinner" className="loading-icon icon-spin" />
          <span className="loading-message">{t`Loading notifications...`}</span>
        </Flex>
      );
    }

    return (
      <Flex direction="column" justify="center" align="center" className="notification-empty-state">
        <Icon name="bell" size="3xl" className="empty-icon" />
        <span className="empty-message">{t`No unread notifications`}</span>
        <span className="empty-hint">
          {t`You're all caught up!`}
        </span>
      </Flex>
    );
  };

  // Per-space panel makes the scope explicit in the title; the global panel
  // (across all spaces) keeps the plain count.
  const panelTitle = global
    ? allNotifications.length === 1
      ? t`${allNotifications.length} notification`
      : t`${allNotifications.length} notifications`
    : allNotifications.length === 1
      ? t`${allNotifications.length} Notification in this Space`
      : t`${allNotifications.length} Notifications in this Space`;

  const panelBody = (
      <>
        {/* Filter controls - only show when there are notifications */}
        {!isLoading && allNotifications.length > 0 && (
          <div className="notification-panel__controls">
            <Flex className="items-center justify-between gap-2">
              <Select
                value={selectedTypes}
                onChange={handleFilterChange}
                options={filterOptions}
                multiple={true}
                compactMode={true}
                compactIcon="filter"
                showSelectionCount={false}
                showSelectAllOption={false}
                selectAllLabel={t`All`}
                clearAllLabel={t`Clear`}
                size="medium"
                dropdownClassName="panel-select-dropdown"
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
            </Flex>
          </div>
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
                  const senderId = notification.message.content?.senderId;
                  const rowSpaceId = (notification as any).spaceId ?? spaceId;
                  const sender = global && resolveGlobalSender
                    ? resolveGlobalSender(rowSpaceId, senderId)
                    : mapSenderToUser(senderId);
                  return (
                    <div
                      key={`${notification.message.messageId}-${notification.channelId}`}
                      className="mobile-drawer__item-box mobile-drawer__item-box--interactive"
                    >
                      <NotificationItem
                        notification={notification}
                        onNavigate={handleNavigate}
                        displayName={
                          sender
                            ? formatResolvedName(
                                resolveSpaceMemberName({
                                  address: sender.address ?? notification.message.content?.senderId ?? '',
                                  displayName: sender.displayName,
                                  primaryUsername: sender.primaryUsername,
                                  globalDisplayName: sender.globalDisplayName,
                                }),
                              )
                            : t`Unknown User`
                        }
                        mapSenderToUser={mapSenderToUser}
                        spaceRoles={spaceRoles}
                        spaceChannels={spaceChannels}
                        spaceName={global ? (notification as any).spaceName : undefined}
                        compactDate={true}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Desktop: card item layout */
              <div className="notification-panel__list">
                {allNotifications.map((notification) => {
                  const senderId = notification.message.content?.senderId;
                  const rowSpaceId = (notification as any).spaceId ?? spaceId;
                  const sender = global && resolveGlobalSender
                    ? resolveGlobalSender(rowSpaceId, senderId)
                    : mapSenderToUser(senderId);
                  return (
                    <div
                      key={`${notification.message.messageId}-${notification.channelId}`}
                      className="panel-item-box panel-item-box--interactive"
                    >
                      <NotificationItem
                        notification={notification}
                        onNavigate={handleNavigate}
                        displayName={
                          sender
                            ? formatResolvedName(
                                resolveSpaceMemberName({
                                  address: sender.address ?? notification.message.content?.senderId ?? '',
                                  displayName: sender.displayName,
                                  primaryUsername: sender.primaryUsername,
                                  globalDisplayName: sender.globalDisplayName,
                                }),
                              )
                            : t`Unknown User`
                        }
                        mapSenderToUser={mapSenderToUser}
                        spaceRoles={spaceRoles}
                        spaceChannels={spaceChannels}
                        spaceName={global ? (notification as any).spaceName : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Truncation note - only in global mode when results are capped */}
        {global && globalTruncated && (
          <div className="notification-panel__truncation-note">
            {t`Showing the ${GLOBAL_DISPLAY_CAP} most recent notifications`}
          </div>
        )}
      </>
  );

  return (
    <>
      {global ? (
        // Global mode: top-level centered Modal (backdrop + blur + correct
        // z-index above the AppShell chrome — see .agents/docs/features/modals.md).
        <Modal
          visible={isOpen}
          onClose={onClose}
          title={panelTitle}
          size="medium"
          closeOnBackdropClick
          closeOnEscape
          noPadding
          className={`notification-panel notification-panel--global ${className || ''}`}
        >
          {panelBody}
        </Modal>
      ) : (
        // Per-space mode: anchored right-aligned dropdown (unchanged).
        <DropdownPanel
          isOpen={isOpen}
          onClose={onClose}
          position="absolute"
          positionStyle="right-aligned"
          maxWidth={500}
          maxHeight={Math.min(window.innerHeight * 0.8, 600)}
          title={panelTitle}
          className={`notification-panel ${className || ''}`}
          showCloseButton={true}
        >
          {panelBody}
        </DropdownPanel>
      )}

      {confirm?.modalConfig && (
        <ConfirmationModal
          visible={confirm.showModal}
          title={confirm.modalConfig.title}
          message={confirm.modalConfig.message}
          confirmText={confirm.modalConfig.confirmText}
          cancelText={confirm.modalConfig.cancelText}
          variant={confirm.modalConfig.variant}
          busy={confirm.isConfirming}
          onConfirm={confirm.modalConfig.onConfirm}
          onCancel={confirm.modalConfig.onCancel}
        />
      )}
    </>
  );
};

export default NotificationPanel;
