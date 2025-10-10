import React from 'react';
import { Icon, FlexBetween, FlexRow, Container, Text } from '../primitives';
import { useSearchResultHighlight, useSearchResultFormatting } from '../../hooks/business/search';
import type { MentionNotification } from '../../hooks/business/mentions';
import './NotificationItem.scss';

interface NotificationItemProps {
  notification: MentionNotification;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
  displayName: string; // Message author display name
  mapSenderToUser: (senderId: string) => any; // For rendering mentions with display names
  className?: string;
}

// Helper function to replace user mentions with display names
const replaceMentionsWithDisplayNames = (
  text: string,
  mapSenderToUser: (senderId: string) => any
): string => {
  // Match @<address> patterns (same as MessageMarkdownRenderer)
  const mentionPattern = /@<(Qm[a-zA-Z0-9]+)>/g;

  return text.replace(mentionPattern, (match, address) => {
    const user = mapSenderToUser(address);
    if (user?.displayName) {
      return `@${user.displayName}`;
    }
    // Fallback to shortened address if user not found
    return `@${address.substring(0, 8)}...`;
  });
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

  const { formattedDate, handleClick, handleKeyDown } = useSearchResultFormatting({
    message,
    onNavigate,
  });

  // Get mention type icon
  const mentionIcon = notification.mentionType === 'everyone'
    ? 'bullhorn'
    : notification.mentionType === 'roles'
    ? 'users'
    : 'user';

  // Replace user mentions with display names
  const textWithDisplayNames = replaceMentionsWithDisplayNames(
    contextualSnippet,
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
          <Icon name={mentionIcon} className="notification-mention-type-icon" />
          <Text className="notification-sender">{displayName}</Text>
        </FlexRow>
        <FlexRow className="notification-meta">
          <Icon name="calendar-alt" className="notification-date-icon" />
          <Text className="notification-date">{formattedDate}</Text>
        </FlexRow>
      </FlexBetween>

      <Container className="notification-content">
        <Container className="notification-text">
          {textWithDisplayNames}
        </Container>
      </Container>
    </Container>
  );
};

export default NotificationItem;
