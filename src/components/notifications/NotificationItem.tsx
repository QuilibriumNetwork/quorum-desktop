import React from 'react';
import { Icon, FlexBetween, FlexRow, Container, Text } from '../primitives';
import { useSearchResultFormatting } from '../../hooks/business/search';
import { useMessageFormatting } from '../../hooks/business/messages/useMessageFormatting';
import type { MentionNotification } from '../../hooks/business/mentions';
import type { ReplyNotification } from '../../types/notifications';
import './NotificationItem.scss';

interface NotificationItemProps {
  notification: MentionNotification | ReplyNotification;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  displayName: string; // Message author display name
  mapSenderToUser: (senderId: string) => any; // For rendering mentions with display names
  className?: string;
  spaceRoles?: any[]; // Space roles for mention formatting
  spaceChannels?: any[]; // Space channels for mention formatting
}

// Helper function to render message content with proper mention formatting
const renderMessageContent = (
  message: any,
  formatting: any,
  maxLength: number = 200
): React.ReactNode => {
  const contentData = formatting.getContentData();
  if (!contentData || contentData.type !== 'post') {
    return message.content?.text?.substring(0, maxLength) || '[Empty message]';
  }

  const renderedTokens: React.ReactNode[] = [];
  const allText = contentData.content.join(' ');

  // Truncate if needed
  const truncatedText = allText.length > maxLength ? allText.substring(0, maxLength) + '...' : allText;
  const lines = [truncatedText]; // Treat as single line for notification display

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tokens = line.split(' ');

    for (let j = 0; j < tokens.length; j++) {
      const token = tokens[j];
      const tokenData = formatting.processTextToken(token, contentData.messageId, i, j);

      if (tokenData.type === 'mention') {
        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            <span className="message-name-mentions-you non-interactive">
              {tokenData.displayName}
            </span>
            {j < tokens.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      } else if (tokenData.type === 'channel-mention') {
        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            <span className="message-name-mentions-you non-interactive">
              {tokenData.displayName}
            </span>
            {j < tokens.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      } else {
        renderedTokens.push(
          <React.Fragment key={`${i}-${j}`}>
            {tokenData.text}
            {j < tokens.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      }
    }
  }

  return renderedTokens.length > 0 ? renderedTokens : truncatedText;
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onNavigate,
  displayName,
  mapSenderToUser,
  className,
  spaceRoles = [],
  spaceChannels = [],
}) => {
  const { message, channelName } = notification;

  // Use proper message formatting (same as PinnedMessagesPanel)
  const formatting = useMessageFormatting({
    message,
    stickers: {},
    mapSenderToUser,
    onImageClick: () => {}, // No-op for notifications
    spaceRoles,
    spaceChannels,
    disableMentionInteractivity: true, // Non-interactive in notifications
  });

  const { formattedDate, handleClick, handleKeyDown } = useSearchResultFormatting({
    message,
    onNavigate,
  });

  // Determine notification type and icon
  const isReply = notification.type === 'reply';
  const notificationIcon = isReply
    ? 'reply'
    : notification.type === 'mention-everyone' || (notification as MentionNotification).mentionType === 'everyone'
    ? 'bullhorn'
    : notification.type === 'mention-roles' || (notification as MentionNotification).mentionType === 'roles'
    ? 'users'
    : 'user';

  // Render message content with proper mention formatting
  const renderedContent = renderMessageContent(message, formatting, 200);

  return (
    <Container
      className={`notification-item ${className || ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <FlexBetween className="notification-header">
        <FlexRow className="notification-meta">
          <Icon name="hashtag" className="notification-channel-icon" />
          <Text className="notification-channel mr-2 truncate-channel-name">{channelName}</Text>
          <Icon name={notificationIcon} className="notification-mention-type-icon" />
          <Text className="notification-sender truncate-user-name">{displayName}</Text>
        </FlexRow>
        <FlexRow className="notification-meta">
          <Icon name="calendar-alt" className="notification-date-icon" />
          <Text className="notification-date">{formattedDate}</Text>
        </FlexRow>
      </FlexBetween>

      <Container className="notification-content">
        <Container className="notification-text">
          {renderedContent}
        </Container>
      </Container>
    </Container>
  );
};

export default NotificationItem;
