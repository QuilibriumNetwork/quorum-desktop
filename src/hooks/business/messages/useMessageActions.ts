import { useCallback, useState } from 'react';
import { Message as MessageType } from '../../../api/quorumApi';

interface UseMessageActionsOptions {
  message: MessageType;
  userAddress: string;
  canDeleteMessages?: boolean;
  height: number;
  onSubmitMessage: (message: any) => Promise<void>;
  onSetInReplyTo: (message: MessageType) => void;
  onSetEmojiPickerOpen: (messageId: string) => void;
  onSetEmojiPickerDirection: (direction: string) => void;
  editorRef?: any;
}

export function useMessageActions(options: UseMessageActionsOptions) {
  const {
    message,
    userAddress,
    canDeleteMessages,
    height,
    onSubmitMessage,
    onSetInReplyTo,
    onSetEmojiPickerOpen,
    onSetEmojiPickerDirection,
    editorRef,
  } = options;

  // State for copied link feedback
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Calculate if user can delete this message
  // canDeleteMessages already contains all permission logic including space owner privileges
  const canUserDelete = Boolean(canDeleteMessages);

  // Handle reaction submission
  const handleReaction = useCallback(
    (emoji: string) => {
      const hasReacted = message.reactions
        ?.find((r) => r.emojiId === emoji)
        ?.memberIds.includes(userAddress);

      if (!hasReacted) {
        onSubmitMessage({
          type: 'reaction',
          messageId: message.messageId,
          reaction: emoji,
        });
      } else {
        onSubmitMessage({
          type: 'remove-reaction',
          messageId: message.messageId,
          reaction: emoji,
        });
      }
    },
    [message, userAddress, onSubmitMessage]
  );

  // Handle reply action
  const handleReply = useCallback(() => {
    onSetInReplyTo(message);
    editorRef?.focus();
  }, [message, onSetInReplyTo, editorRef]);

  // Handle copy link action
  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}#msg-${message.messageId}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkId(message.messageId);
    setTimeout(() => {
      setCopiedLinkId((prev) => (prev === message.messageId ? null : prev));
    }, 1500);
  }, [message.messageId]);

  // Handle delete action
  const handleDelete = useCallback(() => {
    onSubmitMessage({
      type: 'remove-message',
      removeMessageId: message.messageId,
    });
  }, [message.messageId, onSubmitMessage]);

  // Resend pending message (only own message)
  const handleResend = useCallback(() => {
    if (message.content.senderId !== userAddress) return;
    if (message.isSent === false) {
      // Reconstruct a minimal payload from the original message
      const payload = message.content.type === 'post'
        ? { type: 'post', text: (message.content as any).text, repliesToMessageId: (message.content as any).repliesToMessageId }
        : message.content;
      onSubmitMessage(payload as any);
    }
  }, [message, userAddress, onSubmitMessage]);

  // Handle more reactions (emoji picker)
  const handleMoreReactions = useCallback(
    (clientY: number) => {
      onSetEmojiPickerOpen(message.messageId);
      onSetEmojiPickerDirection(
        clientY / height > 0.5 ? 'upwards' : 'downwards'
      );
    },
    [message.messageId, height, onSetEmojiPickerOpen, onSetEmojiPickerDirection]
  );

  return {
    // State
    copiedLinkId,
    canUserDelete,

    // Actions
    handleReaction,
    handleReply,
    handleCopyLink,
    handleDelete,
    handleResend,
    handleMoreReactions,
  };
}
