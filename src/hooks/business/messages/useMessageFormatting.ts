import { useCallback } from 'react';
import * as linkify from 'linkifyjs';
import { Message as MessageType, Sticker } from '../../../api/quorumApi';
import { isYouTubeURL, extractYouTubeVideoId, YOUTUBE_URL_REGEX } from '../../../utils/youtubeUtils';

// Legacy export for backward compatibility
export const YTRegex = YOUTUBE_URL_REGEX;
export const InviteRegex = new RegExp(
  /^((?:https?:)?\/\/?)?((?:www\.)?(?:qm\.one|app\.quorummessenger\.com))(\/(invite\/)?#(.*))$/
);

interface UseMessageFormattingOptions {
  message: MessageType;
  stickers?: { [key: string]: Sticker };
  mapSenderToUser: (senderId: string) => any;
  onImageClick: (imageUrl: string) => void;
}

// Detect if text contains markdown patterns
const markdownPatterns = [
  /\*\*[^*]+\*\*/,        // Bold **text**
  /\*[^*]+\*/,            // Italic *text*
  /~~[^~]+~~/,            // Strikethrough ~~text~~
  /`[^`]+`/,              // Inline code `code`
  /```[\s\S]*?```/,       // Closed code blocks ```code```
  /```[\s\S]*$/,          // Unclosed code blocks ```code (at end)
  /^#{1,3}\s/m,           // H1, H2, H3 headers (all converted to H3)
  /^>\s/m,                // Blockquotes > text
  /^\s*[-*+]\s/m,         // Unordered lists - item
  /^\s*\d+\.\s/m,         // Ordered lists 1. item
  /\|[^|]+\|/,            // Tables |col|
  /^---+$/m,              // Horizontal rule ---
  /\[[^\]]+\]\([^)]+\)/,  // Markdown links [text](url)
  /<[^>]+>/,              // Angle bracket autolinks <url> or <email>
];

function hasMarkdownPatterns(text: string): boolean {
  if (!text) return false;
  return markdownPatterns.some(pattern => pattern.test(text));
}

export function useMessageFormatting(options: UseMessageFormattingOptions) {
  const { message, stickers, mapSenderToUser, onImageClick } = options;

  // Handle image click with size checking
  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>, imageUrl: string, hasThumbnail?: boolean) => {
      const img = e.currentTarget;
      // If we have a thumbnail, always allow clicking to see full image
      // Otherwise, check if the image is larger than 300px
      if (hasThumbnail || ((img.naturalWidth > 300 || img.naturalHeight > 300) && imageUrl)) {
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

  // Check if message content should be rendered with markdown
  const shouldUseMarkdown = useCallback(() => {
    if (message.content.type !== 'post') return false;

    const text = Array.isArray(message.content.text)
      ? message.content.text.join('\n')
      : message.content.text;

    return hasMarkdownPatterns(text);
  }, [message]);

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
        // Add full text for markdown rendering
        fullText: Array.isArray(message.content.text)
          ? message.content.text.join('\n')
          : message.content.text,
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
          displayName: mention.displayName || `@${userId.substring(0, 8)}...`,
          address: userId,
        };
      }

      // Check for YouTube videos using centralized utilities
      if (isYouTubeURL(token)) {
        const videoId = extractYouTubeVideoId(token);
        if (videoId) {
          return {
            type: 'youtube' as const,
            key: `${messageId}-${lineIndex}-${tokenIndex}`,
            videoId: videoId,
          };
        }
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
    shouldUseMarkdown,

    // Regex patterns
    YTRegex,
    InviteRegex,
  };
}
