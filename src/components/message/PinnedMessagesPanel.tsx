import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import type { Message as MessageType, Channel, Sticker, Role } from '../../api/quorumApi';
import MessagePreview from './MessagePreview';
import {
  Flex,
  Button,
  Container,
  Tooltip,
  Icon,
} from '../primitives';
import { DropdownPanel } from '../ui';
import { t } from '@lingui/core/macro';
import { usePinnedMessages } from '../../hooks';
import { isTouchDevice } from '../../utils/platform';
import { formatMessageDate } from '../../utils';
import './PinnedMessagesPanel.scss';

interface PinnedMessagesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  channelId: string;
  channel?: Channel;
  mapSenderToUser: (senderId: string) => any;
  virtuosoRef?: any;
  messageList?: MessageType[];
  stickers?: { [key: string]: any };
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  onChannelClick?: (channelId: string) => void;
}

interface PinnedMessageItemProps {
  message: MessageType;
  mapSenderToUser: (senderId: string) => any;
  onJumpToMessage: (messageId: string) => void;
  canPinMessages: boolean;
  togglePin: (e: React.MouseEvent, message: MessageType) => void;
  stickers?: { [key: string]: Sticker };
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  onChannelClick?: (channelId: string) => void;
  spaceId: string;
  compactDate?: boolean;
}

// Extract PinnedMessageItem component for Virtuoso optimization
const PinnedMessageItem: React.FC<PinnedMessageItemProps> = ({
  message,
  mapSenderToUser,
  onJumpToMessage,
  canPinMessages,
  togglePin,
  stickers,
  spaceRoles,
  spaceChannels,
  onChannelClick,
  spaceId,
  compactDate = false,
}) => {
  const sender = mapSenderToUser(message.content?.senderId);

  return (
    <Container
      key={message.messageId}
      className="pinned-message-item"
    >
      <Container className="result-header">
        <Flex justify="between" className="result-meta-container">
          <Flex className="result-meta items-center min-w-0 flex-1 mr-2">
            <Icon name="user" className="result-user-icon flex-shrink-0" />
            <span className="result-sender mr-2 truncate flex-shrink min-w-0">
              {sender?.displayName || t`Unknown User`}
            </span>
            <Icon name="calendar-alt" className="result-date-icon flex-shrink-0 ml-1" />
            <span className="result-date flex-shrink-0 whitespace-nowrap ml-1">
              {formatMessageDate(message.createdDate, compactDate)}
            </span>
          </Flex>
          <Flex
            className={`message-actions items-center flex-shrink-0${isTouchDevice() ? ' always-visible' : ''}`}
          >
            <Button
              type="secondary"
              onClick={() => onJumpToMessage(message.messageId)}
              iconName="arrow-right"
              size="small"
              className="gap-1"
            >
              {t`Jump`}
            </Button>
            {canPinMessages && (
              <Tooltip
                id={`unpin-${message.messageId}`}
                content={t`Unpin this post`}
                place="top"
                showOnTouch={false}
              >
                <Button
                  type="unstyled"
                  onClick={(e: React.MouseEvent) => togglePin(e, message)}
                  iconName="pin-off"
                  iconOnly={true}
                  iconSize="lg"
                  size="small"
                  className="text-danger flex items-center justify-center"
                />
              </Tooltip>
            )}
          </Flex>
        </Flex>
      </Container>

      <Container className="result-content">
        <MessagePreview
          message={message}
          mapSenderToUser={mapSenderToUser}
          stickers={stickers}
          showBackground={false}
          hideHeader={true}
          spaceRoles={spaceRoles}
          spaceChannels={spaceChannels}
          onChannelClick={onChannelClick}
          disableMentionInteractivity={true}
          currentSpaceId={spaceId}
        />
      </Container>
    </Container>
  );
};

export const PinnedMessagesPanel: React.FC<PinnedMessagesPanelProps> = ({
  isOpen,
  onClose,
  spaceId,
  channelId,
  channel,
  mapSenderToUser,
  virtuosoRef,
  messageList,
  stickers,
  spaceRoles,
  spaceChannels,
  onChannelClick,
}) => {
  const navigate = useNavigate();
  const { pinnedMessages, canPinMessages, isLoading, togglePin } =
    usePinnedMessages(spaceId, channelId, channel, mapSenderToUser, stickers, spaceRoles, spaceChannels, onChannelClick);

  const handleJumpToMessage = useCallback(
    (messageId: string) => {
      // Close the panel
      onClose();

      // Navigate with hash - MessageList handles scroll and Message detects hash for highlighting
      // This is the cross-component communication pattern via URL state
      const currentPath = window.location.pathname;
      navigate(`${currentPath}#msg-${messageId}`);

      // Clean up hash after highlight animation completes (8s matches CSS animation)
      setTimeout(() => {
        history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      }, 8000);
    },
    [navigate, onClose]
  );

  if (!isOpen) return null;

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <Flex justify="center" align="center" className="pinned-loading-state">
          <Icon name="spinner" className="loading-icon icon-spin" />
          <span className="loading-message">{t`Loading pinned messages...`}</span>
        </Flex>
      );
    }

    return (
      <Flex justify="center" align="center" className="pinned-empty-state">
        <Icon name="pin" size="3xl" className="empty-icon" />
        <span className="empty-message">{t`No pinned messages yet`}</span>
        <span className="empty-hint">
          {canPinMessages
            ? t`Pin important messages to keep them easily accessible`
            : t`Important messages will be pinned here`}
        </span>
      </Flex>
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
        pinnedMessages.length === 1
          ? t`${pinnedMessages.length} pinned message in this Channel`
          : t`${pinnedMessages.length} pinned messages in this Channel`
      }
      className="pinned-messages-panel"
      showCloseButton={true}
    >
      {isLoading || pinnedMessages.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {/* Mobile: Use new item list layout */}
          {isTouchDevice() ? (
            <div className="mobile-drawer__item-list">
              <Virtuoso
                data={pinnedMessages}
                style={{ height: Math.min(window.innerHeight * 0.8, 600) - 100 }}
                className="pinned-messages-list"
                itemContent={(index, message) => (
                  <div className="mobile-drawer__item-box mobile-drawer__item-box--interactive">
                    <PinnedMessageItem
                      message={message}
                      mapSenderToUser={mapSenderToUser}
                      onJumpToMessage={handleJumpToMessage}
                      canPinMessages={canPinMessages}
                      togglePin={togglePin}
                      stickers={stickers}
                      spaceRoles={spaceRoles}
                      spaceChannels={spaceChannels}
                      onChannelClick={onChannelClick}
                      spaceId={spaceId}
                      compactDate={true}
                    />
                  </div>
                )}
              />
            </div>
          ) : (
            /* Desktop: Keep existing layout */
            <Virtuoso
              style={{ height: '350px' }} // Desktop: fixed height with own scrolling
              totalCount={pinnedMessages.length}
              itemContent={(index) => (
                <PinnedMessageItem
                  message={pinnedMessages[index]}
                  mapSenderToUser={mapSenderToUser}
                  onJumpToMessage={handleJumpToMessage}
                  canPinMessages={canPinMessages}
                  togglePin={togglePin}
                  stickers={stickers}
                  spaceRoles={spaceRoles}
                  spaceChannels={spaceChannels}
                  onChannelClick={onChannelClick}
                  spaceId={spaceId}
                />
              )}
              className="pinned-messages-list"
            />
          )}
        </>
      )}
    </DropdownPanel>
  );
};

export default PinnedMessagesPanel;
