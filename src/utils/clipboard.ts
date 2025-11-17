import { Message as MessageType, PostMessage, EmbedMessage, StickerMessage } from '../api/quorumApi';
import { t } from '@lingui/core/macro';

/**
 * Extracts raw text content from different message types for copying to clipboard.
 * Preserves original formatting including markdown syntax.
 *
 * @param message - The message object containing content
 * @returns The raw text content suitable for copying
 */
export function extractMessageRawText(message: MessageType): string {
  const content = message.content;

  switch (content.type) {
    case 'post': {
      const postContent = content as PostMessage;
      // Handle both string and string array formats
      if (Array.isArray(postContent.text)) {
        return postContent.text.join('\n');
      }
      return postContent.text || '';
    }

    case 'embed': {
      const embedContent = content as EmbedMessage;
      // Currently only images are supported in the app
      if (embedContent.imageUrl) {
        return t`[Image]`;
      }
      // Future: Add support for other media types when implemented
      // if (embedContent.videoUrl) {
      //   return t`[Video]`;
      // }
      // if (embedContent.fileUrl) {
      //   return t`[File]`;
      // }
      return t`[Media]`;
    }

    case 'sticker': {
      const stickerContent = content as StickerMessage;
      return t`[Sticker: ${stickerContent.stickerId}]`;
    }

    // Fallback for any unexpected cases (shouldn't happen if MessageActions is only shown for copyable messages)
    default:
      return t`[Message content not copyable]`;
  }
}

