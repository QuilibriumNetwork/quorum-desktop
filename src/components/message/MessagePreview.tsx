import React from 'react';
import { Message as MessageType } from '../../api/quorumApi';
import { Container, Text, FlexRow, FlexColumn, Spacer } from '../primitives';
import moment from 'moment-timezone';
import { t } from '@lingui/core/macro';

interface MessagePreviewProps {
  message: MessageType;
  mapSenderToUser?: (senderId: string) => any;
}

export const MessagePreview: React.FC<MessagePreviewProps> = ({
  message,
  mapSenderToUser,
}) => {
  // Extract senderId from the message content based on message type
  const senderId = message.content?.senderId || '';
  const sender = mapSenderToUser && senderId ? mapSenderToUser(senderId) : null;

  // Get display name - prefer sender displayName, fallback to username, then senderId
  const getDisplayName = () => {
    if (sender?.displayName) return sender.displayName;
    if (sender?.username) return sender.username;
    if (senderId) return senderId.slice(-8);
    return t`Unknown User`;
  };

  // Use createdDate (number timestamp) instead of createdAt
  const formattedTimestamp = message.createdDate
    ? moment(message.createdDate).format('MMM D, YYYY [at] h:mm A')
    : t`Unknown time`;

  // Extract message text for deletable content types
  const getMessageText = () => {
    if (!message.content) return t`[Empty message]`;

    switch (message.content.type) {
      case 'post':
        return Array.isArray(message.content.text)
          ? message.content.text.join('\n')
          : message.content.text || t`[Empty message]`;
      case 'embed':
        return t`[Image/Media]`;
      case 'sticker':
        return t`[Sticker]`;
      default:
        return t`[Message]`;
    }
  };

  return (
    <Container padding="sm" backgroundColor="var(--color-bg-chat)">
      <FlexColumn gap="sm">
        {/* Message header */}
        <FlexRow align="center" gap="xs">
          <Text size="sm">{getDisplayName()}</Text>
          <Text variant="subtle" size="xs">
            - {formattedTimestamp}
          </Text>
        </FlexRow>

        <Spacer
          spaceBefore="xs"
          spaceAfter="xs"
          border={true}
          direction="vertical"
        />

        {/* Message content */}
        <Text variant="main" size="sm">
          {getMessageText()}
        </Text>
      </FlexColumn>
    </Container>
  );
};

export default MessagePreview;
