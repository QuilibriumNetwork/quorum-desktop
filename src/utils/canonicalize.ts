import { t } from '@lingui/core/macro';
import type {
  PostMessage,
  EmbedMessage,
  ReactionMessage,
  RemoveReactionMessage,
  RemoveMessage,
  UpdateProfileMessage,
  StickerMessage,
} from '../api/quorumApi';

/**
 * Converts a message object to its canonical string representation.
 * This is used for generating consistent message IDs and signatures.
 *
 * @param pendingMessage - The message to canonicalize
 * @returns A canonical string representation of the message
 * @throws Error if the message type is invalid
 */
export function canonicalize(
  pendingMessage:
    | string
    | PostMessage
    | EmbedMessage
    | ReactionMessage
    | RemoveReactionMessage
    | RemoveMessage
    | UpdateProfileMessage
    | StickerMessage
): string {
  if (typeof pendingMessage === 'string') {
    return pendingMessage;
  }

  if (pendingMessage.type === 'post') {
    if (Array.isArray(pendingMessage.text)) {
      return pendingMessage.text.join('');
    }

    return pendingMessage.text;
  }

  if (pendingMessage.type === 'update-profile') {
    return (
      pendingMessage.type +
      pendingMessage.displayName +
      pendingMessage.userIcon
    );
  }

  if (pendingMessage.type === 'embed') {
    return (
      pendingMessage.type +
      (pendingMessage.width ?? '') +
      (pendingMessage.height ?? '') +
      (pendingMessage.imageUrl ?? '') +
      (pendingMessage.repliesToMessageId ?? '') +
      (pendingMessage.videoUrl ?? '')
    );
  }

  if (pendingMessage.type === 'reaction') {
    return (
      pendingMessage.type +
      pendingMessage.messageId +
      pendingMessage.reaction
    );
  }

  if (pendingMessage.type === 'remove-message') {
    return pendingMessage.type + pendingMessage.removeMessageId;
  }

  if (pendingMessage.type === 'remove-reaction') {
    return (
      pendingMessage.type +
      pendingMessage.messageId +
      pendingMessage.reaction
    );
  }

  if (pendingMessage.type === 'sticker') {
    return (
      pendingMessage.type +
      pendingMessage.stickerId +
      (pendingMessage.repliesToMessageId ?? '')
    );
  }

  throw new Error(t`invalid message type`);
}
