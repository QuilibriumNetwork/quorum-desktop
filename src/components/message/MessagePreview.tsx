import React from 'react';
import { Message as MessageType } from '../../api/quorumApi';
import { Container, Text, FlexRow, Icon } from '../primitives';
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
    <Container className="space-y-3">
      {/* Message header */}
      <FlexRow className="items-center gap-2">
        <Text variant="strong" className="text-sm">
          {getDisplayName()}
        </Text>
        <Text variant="muted" className="text-xs">
          {formattedTimestamp}
        </Text>
      </FlexRow>

      {/* Message content */}
      <Container className="bg-surface-1 p-3 rounded">
        <Text variant="main" className="text-sm whitespace-pre-wrap break-words">
          {getMessageText()}
        </Text>
      </Container>

    </Container>
  );
};

export default MessagePreview;