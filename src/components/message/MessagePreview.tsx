import React from 'react';
import { Message as MessageType, Sticker, Role, Channel } from '../../api/quorumApi';
import { Container, Text, FlexRow, FlexColumn, Spacer, Icon } from '../primitives';
import { t } from '@lingui/core/macro';
import { useMessageFormatting } from '../../hooks/business/messages/useMessageFormatting';
import { YouTubeEmbed } from '../ui/YouTubeEmbed';
import { formatMessageDate } from '../../utils';

interface MessagePreviewProps {
  message: MessageType;
  mapSenderToUser?: (senderId: string) => any;
  stickers?: { [key: string]: Sticker };
  showBackground?: boolean;
  hideHeader?: boolean;
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  onChannelClick?: (channelId: string) => void;
  disableMentionInteractivity?: boolean;
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
  disableMentionInteractivity = false,
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
    if (!message.content) return <Text variant="subtle" size="sm">{t`[Empty message]`}</Text>;

    const contentData = formatting.getContentData();
    if (!contentData) return <Text variant="subtle" size="sm">{t`[Message]`}</Text>;

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

    // Handle post content
    if (contentData.type === 'post') {
      return (
        <Container className="message-preview-post text-sm font-normal">
          {contentData.content.map((line, i) => {
            const tokens = line.split(' ');
            const renderedTokens: React.ReactNode[] = [];

            for (let j = 0; j < tokens.length; j++) {
              const token = tokens[j];
              const tokenData = formatting.processTextToken(
                token,
                contentData.messageId,
                i,
                j
              );

              if (tokenData.type === 'mention') {
                renderedTokens.push(
                  <React.Fragment key={tokenData.key}>
                    <span className="message-name-mentions-you">
                      {tokenData.displayName}
                    </span>{' '}
                  </React.Fragment>
                );
              } else if (tokenData.type === 'channel-mention') {
                renderedTokens.push(
                  <React.Fragment key={tokenData.key}>
                    <span
                      className={`message-name-mentions-you ${disableMentionInteractivity ? '' : 'cursor-pointer'}`}
                      onClick={disableMentionInteractivity ? undefined : () => onChannelClick && onChannelClick(tokenData.channelId)}
                    >
                      {tokenData.displayName}
                    </span>{' '}
                  </React.Fragment>
                );
              } else if (tokenData.type === 'link') {
                renderedTokens.push(
                  <React.Fragment key={tokenData.key}>
                    <a
                      href={tokenData.url}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="link"
                      style={{ fontSize: 'inherit' }}
                    >
                      {tokenData.text}
                    </a>{' '}
                  </React.Fragment>
                );
              } else if (tokenData.type === 'youtube') {
                renderedTokens.push(
                  <Container
                    key={tokenData.key}
                    className="message-preview-youtube"
                  >
                    <YouTubeEmbed
                      src={
                        'https://www.youtube.com/embed/' +
                        tokenData.videoId
                      }
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
        </Container>
      );
    }

    return <Text variant="subtle" size="sm">{t`[Message]`}</Text>;
  };

  return (
    <Container
      padding="sm"
      backgroundColor={showBackground ? "var(--color-bg-chat)" : undefined}
    >
      <FlexColumn gap="sm">
        {/* Message header */}
        {!hideHeader && (
          <FlexRow align="center" className="dropdown-result-meta">
            <Icon name="user" className="dropdown-result-user-icon" />
            <Text className="dropdown-result-sender mr-4">{getDisplayName()}</Text>
            <Icon name="calendar-alt" className="dropdown-result-date-icon" />
            <Text className="dropdown-result-date">{formattedTimestamp}</Text>
          </FlexRow>
        )}

        {!hideHeader && (
          <Spacer
            spaceBefore="xs"
            spaceAfter="xs"
            border={true}
            direction="vertical"
          />
        )}

        {/* Message content */}
        {renderMessageContent()}
      </FlexColumn>
    </Container>
  );
};

export default MessagePreview;
