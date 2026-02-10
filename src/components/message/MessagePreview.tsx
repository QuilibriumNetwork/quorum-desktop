import React from 'react';
import { Message as MessageType, Sticker, Role, Channel } from '../../api/quorumApi';
import { Container, Flex, Spacer, Icon } from '../primitives';
import { t } from '@lingui/core/macro';
import { useMessageFormatting } from '../../hooks/business/messages/useMessageFormatting';
import { YouTubeEmbed } from '../ui/YouTubeEmbed';
import { formatMessageDate } from '../../utils';
import { processMarkdownText } from '../../utils/markdownStripping';

// Helper function to process text with mentions and special tokens after smart markdown stripping
const renderPreviewTextWithSpecialTokens = (
  text: string,
  formatting: any,
  messageId: string,
  disableMentionInteractivity: boolean,
  onChannelClick?: (channelId: string) => void,
  onMessageLinkClick?: (channelId: string, messageId: string) => void
): React.ReactNode => {
  const lines = text.split('\n');

  return lines.map((line, i) => {
    // Smart tokenization: preserve mention patterns as single tokens
    // Matches: @<address> or #<channelId>
    // Falls back to space-delimited words for regular text
    const mentionPattern = /(@<[^>]+>|#<[^>]+>)/g;
    const tokens: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionPattern.exec(line)) !== null) {
      // Add any text before this mention (split by spaces)
      if (match.index > lastIndex) {
        const beforeText = line.slice(lastIndex, match.index);
        tokens.push(...beforeText.split(' ').filter(t => t));
      }
      // Add the mention as a single token
      tokens.push(match[0]);
      lastIndex = match.index + match[0].length;
    }
    // Add any remaining text after the last mention
    if (lastIndex < line.length) {
      const afterText = line.slice(lastIndex);
      tokens.push(...afterText.split(' ').filter(t => t));
    }

    const renderedTokens: React.ReactNode[] = [];

    for (let j = 0; j < tokens.length; j++) {
      const token = tokens[j];
      const tokenData = formatting.processTextToken(token, messageId, i, j);

      if (tokenData.type === 'mention') {
        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            <span
              className={`message-mentions-user ${disableMentionInteractivity ? 'non-interactive' : 'interactive'}`}
            >
              {tokenData.displayName}
            </span>{' '}
          </React.Fragment>
        );
      } else if (tokenData.type === 'channel-mention') {
        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            <span
              className={`message-mentions-channel ${disableMentionInteractivity ? 'non-interactive' : 'interactive'}`}
              onClick={!disableMentionInteractivity ? () => onChannelClick?.(tokenData.channelId) : undefined}
            >
              {tokenData.displayName}
            </span>{' '}
          </React.Fragment>
        );
      } else if (tokenData.type === 'link') {
        // Truncate long URLs to 50 chars (matching MessageMarkdownRenderer)
        const isLongUrl = tokenData.text.length > 50;
        const displayText = isLongUrl
          ? tokenData.text.substring(0, 50) + '...'
          : tokenData.text;

        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            <a
              href={tokenData.url}
              target="_blank"
              referrerPolicy="no-referrer"
              className="link"
              title={isLongUrl ? tokenData.url : undefined}
              style={{ fontSize: 'inherit', wordBreak: 'break-all' }}
            >
              {displayText}
            </a>{' '}
          </React.Fragment>
        );
      } else if (tokenData.type === 'youtube') {
        renderedTokens.push(
          <Container key={tokenData.key} className="message-preview-youtube">
            <YouTubeEmbed
              src={'https://www.youtube.com/embed/' + tokenData.videoId}
              allow="autoplay; encrypted-media"
              className="rounded-lg youtube-embed"
              style={{
                width: '100%',
                maxWidth: 300,
                aspectRatio: '16/9',
              }}
              previewOnly={true}
            />
          </Container>
        );
      } else if (tokenData.type === 'invite') {
        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            <span className="text-accent">[Invite Link]</span>{' '}
          </React.Fragment>
        );
      } else if (tokenData.type === 'message-link') {
        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            <span
              className={`message-mentions-message-link ${disableMentionInteractivity ? 'non-interactive' : 'interactive'}`}
              onClick={!disableMentionInteractivity ? () => onMessageLinkClick?.(tokenData.channelId, tokenData.messageId) : undefined}
            >
              #{tokenData.channelName}
              <span className="message-mentions-message-link__separator"> › </span>
              <Icon name="message" size="sm" variant="filled" className="message-mentions-message-link__icon" />
            </span>{' '}
          </React.Fragment>
        );
      } else {
        // This is already processed by smart markdown stripping, so just render the clean text
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
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

interface MessagePreviewProps {
  message: MessageType;
  mapSenderToUser?: (senderId: string) => any;
  stickers?: { [key: string]: Sticker };
  showBackground?: boolean;
  hideHeader?: boolean;
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  onChannelClick?: (channelId: string) => void;
  onMessageLinkClick?: (channelId: string, messageId: string) => void;
  disableMentionInteractivity?: boolean;
  currentSpaceId?: string;
}

export const MessagePreview: React.FC<MessagePreviewProps> = ({
  message,
  mapSenderToUser,
  stickers,
  showBackground = true,
  hideHeader = false,
  spaceRoles = [],
  spaceChannels = [],
  onChannelClick,
  onMessageLinkClick,
  disableMentionInteractivity = false,
  currentSpaceId,
}) => {
  // Extract senderId from the message content based on message type
  const senderId = message.content?.senderId || '';
  const sender = mapSenderToUser && senderId ? mapSenderToUser(senderId) : null;

  // Message formatting logic - no image modal needed for preview
  const formatting = useMessageFormatting({
    message,
    stickers: stickers || {},
    mapSenderToUser: mapSenderToUser || (() => ({})),
    onImageClick: () => {}, // No-op for message preview - just display images
    spaceRoles,
    spaceChannels,
    disableMentionInteractivity,
    currentSpaceId,
  });

  // Get display name - prefer sender displayName, fallback to username, then senderId
  const getDisplayName = () => {
    if (sender?.displayName) return sender.displayName;
    if (sender?.username) return sender.username;
    if (senderId) return senderId.slice(-8);
    return t`Unknown User`;
  };

  // Use shared date formatting utility (matches Message.tsx format)
  const formattedTimestamp = message.createdDate
    ? formatMessageDate(message.createdDate)
    : t`Unknown time`;

  // Render message content with actual images and stickers
  const renderMessageContent = () => {
    if (!message.content) return <span className="text-label">{t`[Empty message]`}</span>;

    const contentData = formatting.getContentData();
    if (!contentData) return <span className="text-label">{t`[Message]`}</span>;

    // Handle embed content (images/videos)
    if (contentData.type === 'embed') {
      return (
        <Container className="message-preview-embed">
          {contentData.content.imageUrl && (
            <img
              src={contentData.content.thumbnailUrl || contentData.content.imageUrl}
              style={{
                maxWidth: 200,
                maxHeight: 150,
                width: 'auto',
              }}
              className="rounded-lg"
            />
          )}
          {contentData.content.videoUrl?.startsWith(
            'https://www.youtube.com/embed'
          ) && (
            <YouTubeEmbed
              src={contentData.content.videoUrl}
              allow="autoplay; encrypted-media"
              className="rounded-lg youtube-embed"
              style={{
                width: '100%',
                maxWidth: 300,
                aspectRatio: '16/9',
              }}
              previewOnly={true}
            />
          )}
        </Container>
      );
    }

    // Handle sticker content
    if (contentData.type === 'sticker') {
      return (
        <Container className="message-preview-sticker">
          <img
            src={contentData.sticker?.imgUrl}
            style={{ maxWidth: 120, maxHeight: 120 }}
            className="rounded-lg"
          />
        </Container>
      );
    }

    // Handle post content with smart markdown processing
    if (contentData.type === 'post') {
      // Get full text content and apply smart markdown stripping
      const fullText = contentData.content.join('\n');
      const smartProcessedText = processMarkdownText(fullText, {
        preserveLineBreaks: true,     // Keep paragraph structure in previews
        preserveEmphasis: true,       // Keep bold/italic intent without syntax
        preserveHeaders: true,        // Keep header content without ### syntax
        removeFormatting: true,       // Remove markdown syntax
        removeStructure: false,       // Preserve line breaks for readability
      });

      // Process the text for mentions and links
      const processedContent = renderPreviewTextWithSpecialTokens(
        smartProcessedText,
        formatting,
        contentData.messageId,
        disableMentionInteractivity,
        onChannelClick,
        onMessageLinkClick
      );

      return (
        <Container className="message-preview-post text-sm font-normal">
          {processedContent}
        </Container>
      );
    }

    return <span className="text-label">{t`[Message]`}</span>;
  };

  return (
    <Container
      padding="sm"
      backgroundColor={showBackground ? "var(--color-bg-chat)" : undefined}
    >
      <Flex direction="column" gap="sm">
        {/* Message header */}
        {!hideHeader && (
          <Flex align="center" className="dropdown-result-meta min-w-0">
            <Icon name="user" className="dropdown-result-user-icon flex-shrink-0" />
            <span className="dropdown-result-sender mr-4 truncate-user-name flex-shrink min-w-0">{getDisplayName()}</span>
            <Icon name="calendar-alt" className="dropdown-result-date-icon flex-shrink-0" />
            <span className="dropdown-result-date">{formattedTimestamp}</span>
          </Flex>
        )}

        {!hideHeader && (
          <Spacer
            spaceAfter="xs"
            border={true}
            direction="vertical"
          />
        )}

        {/* Message content */}
        {renderMessageContent()}
      </Flex>
    </Container>
  );
};

export default MessagePreview;
