import { useCallback } from 'react';
import * as linkify from 'linkifyjs';
import { Message as MessageType, Sticker } from '../../../api/quorumApi';

// Regex patterns for content detection
export const YTRegex = new RegExp(
  /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu\.be))(\/(?:[\w\-]+\?v=|embed\/|live\/|v\/)?)([\w\-]{11})((?:\?|\&)\S+)?$/
);
export const InviteRegex = new RegExp(
  /^((?:https?:)?\/\/?)?((?:www\.)?(?:qm\.one|app\.quorummessenger\.com))(\/(invite\/)?#(.*))$/
);

interface UseMessageFormattingOptions {
  message: MessageType;
  stickers?: { [key: string]: Sticker };
  mapSenderToUser: (senderId: string) => any;
  onImageClick: (imageUrl: string) => void;
}

export function useMessageFormatting(options: UseMessageFormattingOptions) {
  const { message, stickers, mapSenderToUser, onImageClick } = options;

  // Handle image click with size checking
  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>, imageUrl: string) => {
      const img = e.currentTarget;
      if ((img.naturalWidth > 300 || img.naturalHeight > 300) && imageUrl) {
        onImageClick(imageUrl);
      }
    },
    [onImageClick]
  );

  // Check if message mentions current user
  const isMentioned = useCallback(
    (userAddress: string) => {
      return message.mentions?.memberIds.includes(userAddress) || false;
    },
    [message.mentions]
  );

  // Get processed content data for rendering
  const getContentData = useCallback(() => {
    if (message.content.type === 'post') {
      const contentArray = Array.isArray(message.content.text)
        ? message.content.text
        : message.content.text.split('\n');

      return {
        type: 'post' as const,
        content: contentArray,
        messageId: message.messageId,
      };
    } else if (message.content.type === 'embed') {
      return {
        type: 'embed' as const,
        content: message.content as {
          imageUrl?: string;
          videoUrl?: string;
          width?: string;
          height?: string;
        },
        messageId: message.messageId,
      };
    } else if (message.content.type === 'sticker') {
      const sticker = (stickers ?? {})[message.content.stickerId];
      return {
        type: 'sticker' as const,
        sticker,
        messageId: message.messageId,
      };
    }
    return null;
  }, [message, stickers]);

  // Process text tokens for mentions, links, etc.
  const processTextToken = useCallback(
    (
      token: string,
      messageId: string,
      lineIndex: number,
      tokenIndex: number
    ) => {
      // Check for mentions
      if (token.match(new RegExp(`^@<Qm[a-zA-Z0-9]+>$`))) {
        const userId = token.substring(2, token.length - 1);
        const mention = mapSenderToUser(userId);
        return {
          type: 'mention' as const,
          key: `${messageId}-${lineIndex}-${tokenIndex}`,
          displayName: mention.displayName,
        };
      }

      // Check for YouTube videos
      if (token.match(YTRegex)) {
        const group = token.match(YTRegex)![6];
        return {
          type: 'youtube' as const,
          key: `${messageId}-${lineIndex}-${tokenIndex}`,
          videoId: group,
        };
      }

      // Check for invite links
      if (token.match(InviteRegex)) {
        return {
          type: 'invite' as const,
          key: `${messageId}-${tokenIndex}`,
          inviteLink: token,
        };
      }

      // Check for regular links
      if (linkify.test(token)) {
        return {
          type: 'link' as const,
          key: `${messageId}-${lineIndex}-${tokenIndex}`,
          url: linkify.find(token)[0].href,
          text: token,
        };
      }

      // Regular text
      return {
        type: 'text' as const,
        key: `${messageId}-${lineIndex}-${tokenIndex}`,
        text: token,
      };
    },
    [mapSenderToUser]
  );

  return {
    // Data processors
    getContentData,
    processTextToken,

    // Utilities
    isMentioned,
    handleImageClick,

    // Regex patterns
    YTRegex,
    InviteRegex,
  };
}
