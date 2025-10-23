import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import type { Message as MessageType, Channel, Sticker } from '../../api/quorumApi';
import MessagePreview from './MessagePreview';
import {
  FlexRow,
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
}

interface PinnedMessageItemProps {
  message: MessageType;
  mapSenderToUser: (senderId: string) => any;
  onJumpToMessage: (messageId: string) => void;
  canPinMessages: boolean;
  togglePin: (e: React.MouseEvent, message: MessageType) => void;
  stickers?: { [key: string]: Sticker };
}

// Extract PinnedMessageItem component for Virtuoso optimization
const PinnedMessageItem: React.FC<PinnedMessageItemProps> = ({
  message,
  mapSenderToUser,
  onJumpToMessage,
  canPinMessages,
  togglePin,
  stickers,
}) => {
  const sender = mapSenderToUser(message.content?.senderId);

  return (
    <Container
      key={message.messageId}
      className="pinned-message-item"
    >
      <Container className="result-header">
        {/* Mobile layout: actions on first row */}
        <FlexRow className="sm:hidden items-center justify-end mb-2">
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
                type="danger-outline"
                onClick={(e: React.MouseEvent) => togglePin(e, message)}
                iconName="close"
                iconOnly={true}
                size="small"
              />
            </Tooltip>
          )}
          </FlexRow>
        </FlexRow>

        {/* Mobile layout: user info on second row */}
        <FlexRow className="sm:hidden result-meta items-center">
          <Icon name="user" className="result-user-icon" />
          <Text className="result-sender mr-4">
            {sender?.displayName || t`Unknown User`}
          </Text>
          <Icon name="calendar-alt" className="result-date-icon" />
          <Text className="result-date">
            {formatMessageDate(message.createdDate)}
          </Text>
        </FlexRow>

        {/* Desktop layout: original single row */}
        <FlexRow className="hidden sm:flex items-center justify-between">
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
                  type="danger-outline"
                  onClick={(e: React.MouseEvent) => togglePin(e, message)}
                  iconName="close"
                  iconOnly={true}
                  size="small"
                />
              </Tooltip>
            )}
          </FlexRow>
        </FlexRow>
      </Container>

      <Container className="result-content">
        <MessagePreview
          message={message}
          mapSenderToUser={mapSenderToUser}
          stickers={stickers}
          showBackground={false}
          hideHeader={true}
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
}) => {
  const navigate = useNavigate();
  const { pinnedMessages, canPinMessages, isLoading, togglePin } =
    usePinnedMessages(spaceId, channelId, channel, mapSenderToUser, stickers);

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
          <Icon name="spinner" className="loading-icon" spin />
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
      maxHeight={420}
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
        <Virtuoso
          style={
            isTouchDevice()
              ? {} // Mobile: no inline height, let CSS handle it
              : { height: '350px' } // Desktop: fixed height with own scrolling
          }
          totalCount={pinnedMessages.length}
          itemContent={(index) => (
            <PinnedMessageItem
              message={pinnedMessages[index]}
              mapSenderToUser={mapSenderToUser}
              onJumpToMessage={handleJumpToMessage}
              canPinMessages={canPinMessages}
              togglePin={togglePin}
              stickers={stickers}
            />
          )}
          className="pinned-messages-list"
        />
      )}
    </DropdownPanel>
  );
};

export default PinnedMessagesPanel;
