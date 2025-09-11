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
  const canUserDelete =
    message.content.senderId === userAddress || Boolean(canDeleteMessages);
  
  console.log('⚡ MESSAGE ACTIONS - canUserDelete:', {
    messageId: message.messageId,
    senderId: message.content.senderId,
    userAddress,
    canDeleteMessages,
    isOwnMessage: message.content.senderId === userAddress,
    finalCanDelete: canUserDelete
  });

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
    console.log('🚨 DELETE BUTTON CLICKED!', {
      messageId: message.messageId,
      canUserDelete,
      onSubmitMessage: !!onSubmitMessage
    });
    
    onSubmitMessage({
      type: 'remove-message',
      removeMessageId: message.messageId,
    });
  }, [message.messageId, onSubmitMessage, canUserDelete]);

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
    handleMoreReactions,
  };
}
