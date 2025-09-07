import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Message as MessageType } from '../../api/quorumApi';
import { 
  FlexColumn, 
  FlexRow, 
  FlexCenter,
  Text, 
  Icon, 
  Button,
  Container,
  Tooltip
} from '../primitives';
import { DropdownPanel } from '../DropdownPanel';
import { t } from '@lingui/core/macro';
import { usePinnedMessages } from '../../hooks';
import * as moment from 'moment-timezone';
import './PinnedMessagesPanel.scss';

interface PinnedMessagesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  channelId: string;
  mapSenderToUser: (senderId: string) => any;
}

export const PinnedMessagesPanel: React.FC<PinnedMessagesPanelProps> = ({
  isOpen,
  onClose,
  spaceId,
  channelId,
  mapSenderToUser,
}) => {
  const navigate = useNavigate();
  const { pinnedMessages, unpinMessage, canPinMessages, isLoading } = usePinnedMessages(
    spaceId,
    channelId
  );

  const handleJumpToMessage = useCallback((messageId: string) => {
    // Close the panel
    onClose();
    
    // Navigate to the message with hash
    const currentPath = window.location.pathname;
    navigate(`${currentPath}#msg-${messageId}`);
    
    // Trigger the yellow flash effect after navigation
    setTimeout(() => {
      const messageElement = document.getElementById(`msg-${messageId}`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageElement.classList.add('highlight-message');
        setTimeout(() => {
          messageElement.classList.remove('highlight-message');
        }, 2000);
      }
    }, 100);
  }, [navigate, onClose]);

  const formatMessageContent = (message: MessageType) => {
    if (!message.content) return '';
    
    switch (message.content.type) {
      case 'post':
        const text = Array.isArray(message.content.text) 
          ? message.content.text.join(' ')
          : message.content.text;
        return text.length > 800 ? text.substring(0, 800) + '...' : text;
      case 'sticker':
        return t`[Sticker]`;
      case 'embed':
        return t`[Image]`;
      default:
        return t`[Message]`;
    }
  };

  const formatMessageDate = (timestamp: number) => {
    const time = moment.tz(
      timestamp,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
    return time.format('MMM D, YYYY');
  };

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
        <Icon name="thumbtack" className="empty-icon" />
        <Text className="empty-message">{t`No pinned messages yet`}</Text>
        <Text className="empty-hint">
          {canPinMessages 
            ? t`Pin important messages to keep them easily accessible`
            : t`Space owners can pin important messages here`}
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
      title={pinnedMessages.length === 1
        ? t`${pinnedMessages.length} pinned message`
        : t`${pinnedMessages.length} pinned messages`}
      className="pinned-messages-panel"
    >
      <Container className="pinned-messages-list">
        {isLoading || pinnedMessages.length === 0 ? (
          renderEmptyState()
        ) : (
          pinnedMessages.map((message) => {
            const sender = mapSenderToUser(message.content?.senderId);
            return (
              <Container
                key={message.messageId}
                className="pinned-message-item"
              >
                <FlexRow className="result-header items-center justify-between">
                  <FlexRow className="result-meta items-center">
                    <Text className="result-sender">
                      {sender?.displayName || t`Unknown User`}
                    </Text>
                    <Text className="result-date">
                      {formatMessageDate(message.createdDate)}
                    </Text>
                  </FlexRow>
                  <FlexRow className="message-actions items-center">
                    <Tooltip
                      id={`jump-${message.messageId}`}
                      content={t`Jump to message`}
                      showOnTouch={true}
                      autoHideAfter={3000}
                    >
                      <Button
                        type="unstyled"
                        onClick={() => handleJumpToMessage(message.messageId)}
                        className="jump-button"
                      >
                        <Icon name="arrow-right" size="sm" />
                      </Button>
                    </Tooltip>
                    {canPinMessages && (
                      <Tooltip
                        id={`unpin-${message.messageId}`}
                        content={t`Unpin this post`}
                        showOnTouch={true}
                        autoHideAfter={3000}
                      >
                        <Button
                          type="unstyled"
                          onClick={() => unpinMessage(message.messageId)}
                          className="unpin-button"
                        >
                          <Icon name="times" size="sm" />
                        </Button>
                      </Tooltip>
                    )}
                  </FlexRow>
                </FlexRow>
                
                <Container className="result-content">
                  <Text className="result-text">
                    {formatMessageContent(message)}
                  </Text>
                </Container>
              </Container>
            );
          })
        )}
      </Container>
    </DropdownPanel>
  );
};

export default PinnedMessagesPanel;