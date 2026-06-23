import React from 'react';
import { t } from '@lingui/core/macro';
import type { IconName } from '@quilibrium/quorum-shared';
import { Icon, Flex } from '../primitives';
import { TouchAwareListItem } from '../ui';
import { useSearchResultFormatting } from '../../hooks/business/search';
import { useMessageFormatting } from '../../hooks/business/messages/useMessageFormatting';
import dayjs from '../../utils/dayjs';
import type { MentionNotification } from '../../hooks/business/mentions';
import type { ReplyNotification } from '../../types/notifications';
import './NotificationItem.scss';

interface NotificationItemProps {
  notification: MentionNotification | ReplyNotification;
  onNavigate: (spaceId: string, channelId: string, messageId: string, threadId?: string) => void;
  displayName: string; // Message author display name
  mapSenderToUser: (senderId: string) => any; // For rendering mentions with display names
  className?: string;
  spaceRoles?: any[]; // Space roles for mention formatting
  spaceChannels?: any[]; // Space channels for mention formatting
  compactDate?: boolean; // Compact date format (omit time for today/yesterday)
  spaceName?: string; // When set (global panel), renders a "Space › #channel" breadcrumb
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
            <span className="message-mentions-user non-interactive">
              {tokenData.displayName}
            </span>
            {j < tokens.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      } else if (tokenData.type === 'channel-mention') {
        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            <span className="message-mentions-channel non-interactive">
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
  compactDate = false,
  spaceName,
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

  // We render relative time (dayjs fromNow) rather than the formatted date, but
  // still pass compactDate through for API compatibility with callers.
  const { handleClick } = useSearchResultFormatting({
    message,
    onNavigate,
    compactDate,
  });

  // Leading badge icon by notification type (mirrors the mobile notifications
  // screen so the type is scannable at a glance): @you → at, @everyone →
  // bullhorn, role mention → shield, reply → reply arrow.
  const isReply = 'type' in notification && notification.type === 'reply';
  const mentionType = 'mentionType' in notification ? notification.mentionType : null;
  const typeIcon: IconName = isReply
    ? 'reply'
    : mentionType === 'everyone'
    ? 'bullhorn'
    : mentionType === 'roles'
    ? 'shield'
    : 'at';

  // Render message content with proper mention formatting
  const renderedContent = renderMessageContent(message, formatting, 200);

  // Detect if this notification came from a thread
  const isThread = !!(message.threadId || message.isThreadReply);

  // Relative time ("a few seconds ago", "8 minutes ago", …) via dayjs.
  const relativeTime = dayjs(message.createdDate).fromNow();

  return (
    <TouchAwareListItem
      className={`notification-item ${className || ''}`}
      onClick={handleClick}
      tabIndex={0}
    >
      {/* Leading type badge — conveys notification kind at a glance (mirrors the
          mobile notifications screen). */}
      <div className="notification-badge flex-shrink-0" aria-hidden="true">
        <Icon name={typeIcon} className="notification-badge-icon" />
      </div>

      <div className="notification-body min-w-0">
        {/* Line 1 — location: [Space ›] #channel [› Thread] */}
        <Flex className="notification-location min-w-0">
          {spaceName && (
            <>
              <span className="notification-space truncate-channel-name flex-shrink min-w-0">{spaceName}</span>
              <span className="notification-thread-chevron">›</span>
            </>
          )}
          <Icon name="hashtag" className="notification-channel-icon flex-shrink-0" />
          <span className="notification-channel truncate-channel-name flex-shrink min-w-0">{channelName}</span>
          {isThread && (
            <>
              <span className="notification-thread-chevron">›</span>
              <span className="notification-thread-label">{t`Thread`}</span>
            </>
          )}
        </Flex>

        {/* Line 2 — author + message preview */}
        <div className="notification-text">
          <span className="notification-author">{displayName}: </span>
          {renderedContent}
        </div>

        {/* Line 3 — relative time */}
        <div className="notification-date">{relativeTime}</div>
      </div>
    </TouchAwareListItem>
  );
};

export default NotificationItem;
