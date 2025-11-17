import React from 'react';
import { Icon, FlexBetween, FlexRow, Container, Text } from '../primitives';
import { useSearchResultHighlight, useSearchResultFormatting } from '../../hooks/business/search';
import type { MentionNotification } from '../../hooks/business/mentions';
import type { ReplyNotification } from '../../types/notifications';
import { stripMarkdown } from '../../utils/markdownStripping';
import './NotificationItem.scss';

interface NotificationItemProps {
  notification: MentionNotification | ReplyNotification;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  displayName: string; // Message author display name
  mapSenderToUser: (senderId: string) => any; // For rendering mentions with display names
  className?: string;
}

// Helper function to parse text and render mentions with styling
const renderTextWithMentions = (
  text: string,
  mapSenderToUser: (senderId: string) => any
): React.ReactNode => {
  // Match @<address> patterns from raw message text
  const mentionPattern = /@<(Qm[a-zA-Z0-9]+)>|@everyone\b|@\w+/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const matchedText = match[0];

    // Handle user mention @<address>
    if (match[1]) {
      const address = match[1];
      const user = mapSenderToUser(address);
      const displayName = user?.displayName || address.substring(0, 8) + '...';

      parts.push(
        <span key={`mention-${match.index}`} className="message-name-mentions-you">
          @{displayName}
        </span>
      );
    }
    // Handle @everyone
    else if (matchedText.toLowerCase() === '@everyone') {
      parts.push(
        <span key={`mention-${match.index}`} className="message-name-mentions-you">
          @everyone
        </span>
      );
    }
    // Handle role mentions @roleTag
    else {
      parts.push(
        <span key={`mention-${match.index}`} className="message-name-mentions-you">
          {matchedText}
        </span>
      );
    }

    lastIndex = match.index + matchedText.length;
  }

  // Add remaining text after last mention
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onNavigate,
  displayName,
  mapSenderToUser,
  className,
}) => {
  const { message, channelName } = notification;

  // Reuse search result formatting logic
  const { contextualSnippet } = useSearchResultHighlight({
    message,
    searchTerms: [], // No search terms, show from beginning
    contextWords: 12,
    maxLength: 200,
  });

  // Strip markdown from snippet for clean display
  const cleanSnippet = stripMarkdown(contextualSnippet);

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

  // Render text with styled mentions
  const renderedText = renderTextWithMentions(
    cleanSnippet,
    mapSenderToUser
  );

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
          <Text className="notification-channel mr-2">{channelName}</Text>
          <Icon name={notificationIcon} className="notification-mention-type-icon" />
          <Text className="notification-sender">{displayName}</Text>
        </FlexRow>
        <FlexRow className="notification-meta">
          <Icon name="calendar-alt" className="notification-date-icon" />
          <Text className="notification-date">{formattedDate}</Text>
        </FlexRow>
      </FlexBetween>

      <Container className="notification-content">
        <Container className="notification-text">
          {renderedText}
        </Container>
      </Container>
    </Container>
  );
};

export default NotificationItem;
