import { Message } from '../api/quorumApi';
import { t } from '@lingui/core/macro';
import { stripMarkdown } from './markdownStripping';

/**
 * Truncates text to a maximum length, adding ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '…';
}

/**
 * Generates preview text for conversation lists
 *
 * Only shows actual conversational content (text, images).
 * System messages (edits, profile updates, reactions) return empty string
 * so the conversation falls back to the previous real message.
 *
 * Returns an object with preview text and optional icon information.
 */
export function generateMessagePreview(
  message: Message | undefined,
  maxLength = 100
): { text: string; icon?: string } {
  if (!message?.content) return { text: '' };

  switch (message.content.type) {
    // Actual conversational content - show in preview
    case 'post':
      const text = Array.isArray(message.content.text)
        ? message.content.text.join(' ')
        : message.content.text;
      return { text: truncateText(stripMarkdown(text), maxLength) };

    case 'embed':
      if (message.content.imageUrl) return { text: t`Photo`, icon: 'image' };
      // Future: Add support for other media types when implemented
      // if (message.content.videoUrl) return { text: t`Video`, icon: 'video' };
      // return { text: t`Attachment`, icon: 'paperclip' };
      return { text: t`Photo`, icon: 'image' }; // Currently only images are supported

    // System/action messages - return empty (will skip to previous message)
    case 'edit-message': // Message edit action
    case 'update-profile': // Profile update notification
    case 'reaction': // Reaction added
    case 'remove-reaction': // Reaction removed
    case 'pin': // Pin/unpin action
    case 'join': // User joined (spaces only)
    case 'leave': // User left (spaces only)
    case 'kick': // User kicked (spaces only)
      return '';

    // Special case: Deleted message
    case 'remove-message':
      return { text: t`Message deleted` };

    default:
      return { text: '' };
  }
}
