import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Message as MessageType, Channel } from '../../api/quorumApi';
import {
  FlexColumn,
  FlexRow,
  FlexCenter,
  Text,
  Button,
  Container,
  Tooltip,
  Icon,
} from '../primitives';
import { DropdownPanel } from '../DropdownPanel';
import { t } from '@lingui/core/macro';
import { usePinnedMessages } from '../../hooks';
import { useMessageFormatting } from '../../hooks/business/messages/useMessageFormatting';
import { useMessageHighlight } from '../../hooks/business/messages/useMessageHighlight';
import { isTouchDevice } from '../../utils/platform';
import * as moment from 'moment-timezone';
import './PinnedMessagesPanel.scss';

// Configuration constants for pinned messages panel
const PINNED_PANEL_CONFIG = {
  TEXT_PREVIEW_LENGTH: 800, // Maximum characters to show in message preview
} as const;

interface PinnedMessagesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  channelId: string;
  channel?: Channel;
  mapSenderToUser: (senderId: string) => any;
  virtuosoRef?: any;
  messageList?: MessageType[];
}

export const PinnedMessagesPanel: React.FC<PinnedMessagesPanelProps> = ({
  isOpen,
  onClose,
  spaceId,
  channelId,
  channel,
  mapSenderToUser,
  virtuosoRef,
  messageList,
}) => {
  const navigate = useNavigate();
  const { pinnedMessages, unpinMessage, canPinMessages, isLoading } =
    usePinnedMessages(spaceId, channelId, channel);

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

  // Component to render formatted message content with links, mentions, etc.
  const FormattedMessageContent: React.FC<{ message: MessageType }> = ({
    message,
  }) => {
    const formatting = useMessageFormatting({
      message,
      stickers: {},
      mapSenderToUser,
      onImageClick: () => {}, // Not needed for preview panel
    });

    if (!message.content) return null;

    const contentData = formatting.getContentData();
    if (!contentData) return null;

    if (contentData.type === 'post') {
      let totalChars = 0;
      const maxChars = PINNED_PANEL_CONFIG.TEXT_PREVIEW_LENGTH;

      return (
        <>
          {contentData.content.map((line, i) => {
            const tokens = line.split(' ');
            const renderedTokens: React.ReactNode[] = [];

            for (let j = 0; j < tokens.length; j++) {
              const token = tokens[j];
              const tokenLength = token.length + 1; // +1 for space

              // Check if adding this token would exceed the limit
              if (totalChars + tokenLength > maxChars) {
                renderedTokens.push(
                  <React.Fragment key={`truncate-${i}-${j}`}>
                    ...
                  </React.Fragment>
                );
                break;
              }

              totalChars += tokenLength;
              const tokenData = formatting.processTextToken(
                token,
                contentData.messageId,
                i,
                j
              );

              if (tokenData.type === 'mention') {
                renderedTokens.push(
                  <React.Fragment key={tokenData.key}>
                    <Text className="message-name-mentions-you">
                      {tokenData.displayName}
                    </Text>{' '}
                  </React.Fragment>
                );
              } else if (tokenData.type === 'link') {
                renderedTokens.push(
                  <React.Fragment key={tokenData.key}>
                    <a
                      href={tokenData.url}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="text-accent hover:underline"
                      style={{ fontSize: 'inherit' }}
                    >
                      {tokenData.text}
                    </a>{' '}
                  </React.Fragment>
                );
              } else if (tokenData.type === 'youtube') {
                renderedTokens.push(
                  <React.Fragment key={tokenData.key}>
                    <Text className="text-accent">[YouTube Video]</Text>{' '}
                  </React.Fragment>
                );
              } else if (tokenData.type === 'invite') {
                renderedTokens.push(
                  <React.Fragment key={tokenData.key}>
                    <Text className="text-accent">[Invite Link]</Text>{' '}
                  </React.Fragment>
                );
              } else {
                renderedTokens.push(
                  <React.Fragment key={tokenData.key}>
                    {tokenData.text}{' '}
                  </React.Fragment>
                );
              }
            }

            return (
              <React.Fragment key={`line-${i}`}>
                {renderedTokens}
                {i < contentData.content.length - 1 && <br />}
              </React.Fragment>
            );
          })}
        </>
      );
    }

    // Since only 'post' type messages are pinnable, no need to handle other types
    return null;
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
          ? t`${pinnedMessages.length} pinned message`
          : t`${pinnedMessages.length} pinned messages`
      }
      className="pinned-messages-panel"
      showCloseButton={false}
    >
      <Container className="pinned-messages-list">
        {isLoading || pinnedMessages.length === 0
          ? renderEmptyState()
          : pinnedMessages.map((message) => {
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
                    <FlexRow
                      className={`message-actions items-center${isTouchDevice() ? ' always-visible' : ''}`}
                    >
                      <Tooltip
                        id={`jump-${message.messageId}`}
                        content={t`Jump to message`}
                        place="top"
                        showOnTouch={false}
                      >
                        <Button
                          type="unstyled"
                          onClick={() => handleJumpToMessage(message.messageId)}
                          iconName="arrow-right"
                          iconOnly={true}
                          size="compact"
                          className="jump-button"
                        />
                      </Tooltip>
                      {canPinMessages && (
                        <Tooltip
                          id={`unpin-${message.messageId}`}
                          content={t`Unpin this post`}
                          place="top"
                          showOnTouch={false}
                        >
                          <Button
                            type="unstyled"
                            onClick={() => unpinMessage(message.messageId)}
                            iconName="times"
                            iconOnly={true}
                            size="compact"
                            className="unpin-button"
                          />
                        </Tooltip>
                      )}
                    </FlexRow>
                  </FlexRow>

                  <Container className="result-content">
                    <Text className="result-text">
                      <FormattedMessageContent message={message} />
                    </Text>
                  </Container>
                </Container>
              );
            })}
      </Container>
    </DropdownPanel>
  );
};

export default PinnedMessagesPanel;
