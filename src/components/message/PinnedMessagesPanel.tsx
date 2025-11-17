import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import type { Message as MessageType, Channel, Sticker, Role } from '../../api/quorumApi';
import MessagePreview from './MessagePreview';
import {
  FlexRow,
  FlexBetween,
  FlexCenter,
  Text,
  Button,
  Container,
  Tooltip,
  Icon,
} from '../primitives';
import { DropdownPanel } from '../ui';
import { t } from '@lingui/core/macro';
import { usePinnedMessages } from '../../hooks';
import { useMessageHighlight } from '../../hooks/business/messages/useMessageHighlight';
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
}) => {
  const sender = mapSenderToUser(message.content?.senderId);

  return (
    <Container
      key={message.messageId}
      className="pinned-message-item"
    >
      <Container className="result-header">
        <FlexBetween className="result-meta-container">
          <FlexRow className="result-meta items-center">
            <Icon name="user" className="result-user-icon" />
            <Text className="result-sender mr-4">
              {sender?.displayName || t`Unknown User`}
            </Text>
            <Icon name="calendar-alt" className="result-date-icon" />
            <Text className="result-date">
              {formatMessageDate(message.createdDate)}
            </Text>
          </FlexRow>
          <FlexRow
            className={`message-actions items-center${isTouchDevice() ? ' always-visible' : ''}`}
          >
            <Button
              type="secondary"
              onClick={() => onJumpToMessage(message.messageId)}
              iconName="arrow-right"
              size="small"
              className="gap-1 mr-2"
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
                  size="small"
                  className="text-danger"
                />
              </Tooltip>
            )}
          </FlexRow>
        </FlexBetween>
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


  // Use the new React state-based message highlighting
  const { highlightMessage, scrollToMessage } = useMessageHighlight();

  const handleJumpToMessage = useCallback(
    (messageId: string) => {
      // Close the panel
      onClose();

      // Navigate to the message with hash (for URL state consistency)
      const currentPath = window.location.pathname;
      navigate(`${currentPath}#msg-${messageId}`);

      // Use React state-based highlighting instead of DOM manipulation
      setTimeout(() => {
        // Scroll to the message using the appropriate method
        scrollToMessage(messageId, virtuosoRef, messageList);

        // Highlight the message using React state (triggers re-render with highlight class)
        highlightMessage(messageId, { duration: 2000 });
      }, 100);
    },
    [
      navigate,
      onClose,
      scrollToMessage,
      highlightMessage,
      virtuosoRef,
      messageList,
    ]
  );

  if (!isOpen) return null;

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <FlexCenter className="pinned-loading-state">
          <Icon name="spinner" className="loading-icon icon-spin" />
          <Text className="loading-message">{t`Loading pinned messages...`}</Text>
        </FlexCenter>
      );
    }

    return (
      <FlexCenter className="pinned-empty-state">
        <Icon name="pin" size="3xl" className="empty-icon" />
        <Text className="empty-message">{t`No pinned messages yet`}</Text>
        <Text className="empty-hint">
          {canPinMessages
            ? t`Pin important messages to keep them easily accessible`
            : t`Important messages will be pinned here`}
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
