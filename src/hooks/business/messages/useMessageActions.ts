import { useCallback, useState } from 'react';
import React from 'react';
import { Message as MessageType } from '../../../api/quorumApi';
import { useConfirmationModal } from '../../../components/context/ConfirmationModalProvider';
import MessagePreview from '../../../components/message/MessagePreview';
import { t } from '@lingui/core/macro';

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
  mapSenderToUser?: (senderId: string) => any;
  stickers?: { [key: string]: any };
  onEdit?: (message: MessageType) => void;
  onViewEditHistory?: (message: MessageType) => void;
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
    mapSenderToUser,
    stickers,
    onEdit,
    onViewEditHistory,
  } = options;

  // State for copied link feedback
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Get confirmation modal from context
  const { showConfirmationModal } = useConfirmationModal();

  // Calculate if user can delete this message
  // canDeleteMessages already contains all permission logic including space owner privileges
  const canUserDelete = Boolean(canDeleteMessages);

  // Calculate if user can edit this message
  // Only original sender can edit, and only within 15 minutes
  const EDIT_TIME_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
  const canUserEdit = message.content.senderId === userAddress &&
    message.content.type === 'post' &&
    (Date.now() - message.createdDate) <= EDIT_TIME_WINDOW;

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

  // Handle delete action with confirmation
  const handleDelete = useCallback((e: React.MouseEvent) => {
    const performDelete = () => {
      onSubmitMessage({
        type: 'remove-message',
        removeMessageId: message.messageId,
      });
    };

    // Check for Shift+click bypass (desktop only)
    if (e.shiftKey) {
      performDelete();
      return;
    }

    // Show confirmation modal
    showConfirmationModal({
      title: t`Delete Message`,
      message: t`Are you sure you want to delete this message?`,
      preview: React.createElement(MessagePreview, { message, mapSenderToUser, stickers }),
      confirmText: t`Delete`,
      cancelText: t`Cancel`,
      variant: 'danger',
      protipAction: t`delete`,
      onConfirm: performDelete,
    });
  }, [message, onSubmitMessage, showConfirmationModal, mapSenderToUser, stickers]);

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

  // Handle edit action
  const handleEdit = useCallback(() => {
    if (canUserEdit && onEdit) {
      onEdit(message);
    }
  }, [canUserEdit, message, onEdit]);

  // Check if edit history can be viewed (message has edits and is a post)
  const canViewEditHistory = message.content.type === 'post' &&
    message.edits &&
    message.edits.length > 0;

  // Handle view edit history action
  const handleViewEditHistory = useCallback(() => {
    if (canViewEditHistory && onViewEditHistory) {
      onViewEditHistory(message);
    }
  }, [canViewEditHistory, message, onViewEditHistory]);

  return {
    // State
    copiedLinkId,
    canUserDelete,
    canUserEdit,
    canViewEditHistory,

    // Actions
    handleReaction,
    handleReply,
    handleCopyLink,
    handleDelete,
    handleMoreReactions,
    handleEdit,
    handleViewEditHistory,
  };
}
