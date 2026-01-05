import { logger } from '@quilibrium/quorum-shared';
import { useCallback, useState } from 'react';
import React from 'react';
import { Message as MessageType, Role, Channel, ReactionMessage, RemoveReactionMessage, RemoveMessage } from '../../../api/quorumApi';
import { useConfirmationModal } from '../../../components/context/ConfirmationModalProvider';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext, channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { useQueryClient, InfiniteData } from '@tanstack/react-query';
import MessagePreview from '../../../components/message/MessagePreview';
import { extractMessageRawText } from '../../../utils/clipboard';
import { useCopyToClipboard } from '../ui';
import { useBookmarks } from '../bookmarks';
import { buildMessagesKey } from '../../queries/messages/buildMessagesKey';
import { t } from '@lingui/core/macro';
import { ENABLE_DM_ACTION_QUEUE } from '../../../config/features';

/**
 * DM context for action queue handlers.
 * Required for DM reactions/deletes/edits to use Double Ratchet encryption.
 */
export interface DmContext {
  self: secureChannel.UserRegistration;
  counterparty: secureChannel.UserRegistration;
}

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
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  onChannelClick?: (channelId: string) => void;
  // Bookmark context for creating bookmarks
  spaceId?: string;
  channelId?: string;
  conversationId?: string;
  sourceName?: string;
  // DM context for offline-resilient reactions/deletes (optional - only for DMs)
  dmContext?: DmContext;
  // Callback fired BEFORE optimistic delete update - use to prevent auto-scroll
  onBeforeDelete?: () => void;
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
    spaceRoles,
    spaceChannels,
    onChannelClick,
    // Bookmark context
    spaceId,
    channelId,
    conversationId,
    sourceName,
    // DM context for offline-resilient reactions/deletes
    dmContext,
    // Callback before delete
    onBeforeDelete,
  } = options;

  // State for copied link feedback
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Clipboard hook for copying message text
  const { copied: copiedMessageText, copyToClipboard } = useCopyToClipboard();

  // Get confirmation modal from context
  const { showConfirmationModal } = useConfirmationModal();

  // Bookmarks hook for bookmark functionality
  const bookmarks = useBookmarks({ userAddress });

  // ActionQueue hooks for offline-resilient operations
  const { messageDB, actionQueueService } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const queryClient = useQueryClient();

  // Calculate if user can delete this message
  // canDeleteMessages already contains all permission logic including space owner privileges
  const canUserDelete = Boolean(canDeleteMessages);

  // Calculate if user can edit this message
  // Only original sender can edit, and only within 15 minutes
  const EDIT_TIME_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
  const canUserEdit = message.content.senderId === userAddress &&
    message.content.type === 'post' &&
    (Date.now() - message.createdDate) <= EDIT_TIME_WINDOW;

  // Helper to build DM context for action queue handlers
  const buildDmActionContext = useCallback((address: string) => {
    if (!dmContext?.self) {
      logger.warn('[useMessageActions] Missing DM registration context - dmContext prop not provided');
      return null;
    }
    return {
      address,
      selfUserAddress: dmContext.self.user_address,
      senderDisplayName: currentPasskeyInfo?.displayName,
      senderUserIcon: currentPasskeyInfo?.pfpUrl,
    };
  }, [dmContext, currentPasskeyInfo]);

  // Handle reaction submission - optimistic update + queue
  const handleReaction = useCallback(
    async (emoji: string) => {
      // Check for missing context
      if (!spaceId || !channelId || !currentPasskeyInfo) {
        // Fallback to old behavior for missing context
        onSubmitMessage({
          type: message.reactions?.find((r) => r.emojiId === emoji)?.memberIds.includes(userAddress)
            ? 'remove-reaction'
            : 'reaction',
          messageId: message.messageId,
          reaction: emoji,
        });
        return;
      }

      // Detect DM: spaceId === channelId means it's a DM conversation
      const isDM = spaceId === channelId;

      const hasReacted = message.reactions
        ?.find((r) => r.emojiId === emoji)
        ?.memberIds.includes(userAddress);

      // Optimistic update: Update React Query cache immediately
      const messagesKey = buildMessagesKey({ spaceId, channelId });

      // Build the updated reactions
      const currentReactions = message.reactions || [];
      const existingReaction = currentReactions.find((r) => r.emojiId === emoji);

      let updatedReactions;
      if (!hasReacted) {
        // Adding reaction
        if (existingReaction) {
          updatedReactions = currentReactions.map((r) =>
            r.emojiId === emoji
              ? { ...r, memberIds: [...r.memberIds, userAddress], count: r.memberIds.length + 1 }
              : r
          );
        } else {
          // Create new reaction with all required fields
          updatedReactions = [...currentReactions, {
            emojiId: emoji,
            emojiName: emoji,
            spaceId: spaceId,
            memberIds: [userAddress],
            count: 1,
          }];
        }
      } else {
        // Removing reaction
        updatedReactions = currentReactions
          .map((r) =>
            r.emojiId === emoji
              ? { ...r, memberIds: r.memberIds.filter((id) => id !== userAddress), count: r.memberIds.length - 1 }
              : r
          )
          .filter((r) => r.memberIds.length > 0);
      }

      // Optimistic update: Update React Query cache immediately for instant UI feedback
      queryClient.setQueryData(
        messagesKey,
        (oldData: InfiniteData<{ messages: MessageType[]; prevCursor?: number; nextCursor?: number }> | undefined) => {
          if (!oldData?.pages) return oldData;
          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.messageId === message.messageId
                  ? { ...msg, reactions: updatedReactions }
                  : msg
              ),
            })),
          };
        }
      );

      // Also persist to IndexedDB for offline durability
      const updatedMessage = { ...message, reactions: updatedReactions };
      await messageDB.updateMessage(updatedMessage);

      // Create the reaction message
      const reactionMessage: ReactionMessage | RemoveReactionMessage = hasReacted
        ? {
            type: 'remove-reaction',
            senderId: currentPasskeyInfo.address,
            messageId: message.messageId,
            reaction: emoji,
          }
        : {
            type: 'reaction',
            senderId: currentPasskeyInfo.address,
            messageId: message.messageId,
            reaction: emoji,
          };

      // Route to appropriate handler based on DM vs Space
      if (isDM) {
        // DM: Use Double Ratchet encryption via reaction-dm handler (if enabled and offline)
        // When online, use legacy path to handle new devices properly
        const isOnline = navigator.onLine;
        const dmActionContext = (ENABLE_DM_ACTION_QUEUE && !isOnline) ? buildDmActionContext(spaceId) : null;
        if (!dmActionContext) {
          // Fallback to legacy path if context unavailable or feature disabled
          onSubmitMessage({
            type: hasReacted ? 'remove-reaction' : 'reaction',
            messageId: message.messageId,
            reaction: emoji,
          });
          return;
        }

        await actionQueueService.enqueue(
          'reaction-dm',
          {
            ...dmActionContext,
            reactionMessage,
          },
          `reaction-dm:${spaceId}:${message.messageId}:${emoji}` // Dedup key
        );
      } else {
        // Space: Use Triple Ratchet encryption via reaction handler
        await actionQueueService.enqueue(
          'reaction',
          {
            spaceId,
            channelId,
            reactionMessage,
            currentPasskeyInfo,
          },
          `reaction:${spaceId}:${channelId}:${message.messageId}:${emoji}:${userAddress}` // Dedup key
        );
      }
    },
    [message, userAddress, spaceId, channelId, currentPasskeyInfo, queryClient, actionQueueService, onSubmitMessage, messageDB, buildDmActionContext]
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

  // Handle copy message text action
  const handleCopyMessageText = useCallback(async () => {
    const text = extractMessageRawText(message);
    await copyToClipboard(text);
  }, [message, copyToClipboard]);

  // Handle delete action with confirmation - optimistic update + queue
  const handleDelete = useCallback((e: React.MouseEvent) => {
    const performDelete = async () => {
      // Check for missing context
      if (!spaceId || !channelId || !currentPasskeyInfo) {
        // Fallback to old behavior for missing context
        onSubmitMessage({
          type: 'remove-message',
          removeMessageId: message.messageId,
        });
        return;
      }

      // Detect DM: spaceId === channelId means it's a DM conversation
      const isDM = spaceId === channelId;

      // Call before-delete callback to set deletion flag BEFORE optimistic update
      // This prevents Virtuoso's followOutput from auto-scrolling
      onBeforeDelete?.();

      // Optimistic update: Remove message from React Query cache immediately
      const messagesKey = buildMessagesKey({ spaceId, channelId });
      queryClient.setQueryData(
        messagesKey,
        (oldData: InfiniteData<{ messages: MessageType[]; prevCursor?: number; nextCursor?: number }> | undefined) => {
          if (!oldData?.pages) return oldData;
          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page) => ({
              ...page,
              messages: page.messages.filter((msg) => msg.messageId !== message.messageId),
            })),
          };
        }
      );

      // Also delete from local DB for persistence
      await messageDB.deleteMessage(message.messageId);

      // Create the delete message
      const deleteMessage: RemoveMessage = {
        type: 'remove-message',
        senderId: currentPasskeyInfo.address,
        removeMessageId: message.messageId,
      };

      // Route to appropriate handler based on DM vs Space
      if (isDM) {
        // DM: Use Double Ratchet encryption via delete-dm handler (if enabled and offline)
        // When online, use legacy path to handle new devices properly
        const isOnline = navigator.onLine;
        const dmActionContext = (ENABLE_DM_ACTION_QUEUE && !isOnline) ? buildDmActionContext(spaceId) : null;
        if (!dmActionContext) {
          // Fallback to legacy path if context unavailable, feature disabled, or online
          onSubmitMessage({
            type: 'remove-message',
            removeMessageId: message.messageId,
          });
          return;
        }

        await actionQueueService.enqueue(
          'delete-dm',
          {
            ...dmActionContext,
            deleteMessage,
          },
          `delete-dm:${spaceId}:${message.messageId}` // Dedup key
        );
      } else {
        // Space: Use Triple Ratchet encryption via delete-message handler
        await actionQueueService.enqueue(
          'delete-message',
          {
            spaceId,
            channelId,
            deleteMessage,
            currentPasskeyInfo,
          },
          `delete:${spaceId}:${channelId}:${message.messageId}` // Dedup key
        );
      }
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
      preview: React.createElement(MessagePreview, {
        message,
        mapSenderToUser,
        stickers,
        spaceRoles,
        spaceChannels,
        onChannelClick,
        disableMentionInteractivity: true,
        currentSpaceId: spaceId,
      }),
      confirmText: t`Delete`,
      cancelText: t`Cancel`,
      variant: 'danger',
      protipAction: t`delete`,
      onConfirm: performDelete,
    });
  }, [message, spaceId, channelId, currentPasskeyInfo, queryClient, messageDB, actionQueueService, onSubmitMessage, showConfirmationModal, mapSenderToUser, stickers, spaceRoles, spaceChannels, onChannelClick, buildDmActionContext]);

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

  // Handle bookmark toggle action
  const handleBookmarkToggle = useCallback(() => {
    // Determine source type and context
    const sourceType = conversationId ? 'dm' : 'channel';
    const context = {
      spaceId,
      channelId,
      conversationId,
    };


    // Get sender name for bookmark preview
    const senderName = mapSenderToUser ?
      mapSenderToUser(message.content.senderId)?.displayName || 'Unknown User' :
      'Unknown User';

    // Use provided sourceName or derive it
    const bookmarkSourceName = sourceName ||
      (sourceType === 'dm' ? 'Direct Message' : `#${channelId || 'unknown'}`);

    bookmarks.toggleBookmark(
      message,
      sourceType,
      context,
      senderName,
      bookmarkSourceName
    );
  }, [message, bookmarks, conversationId, spaceId, channelId, mapSenderToUser, sourceName]);

  // Get bookmark status for this message
  const isBookmarked = bookmarks.isBookmarked(message.messageId);

  return {
    // State
    copiedLinkId,
    copiedMessageText,
    canUserDelete,
    canUserEdit,
    canViewEditHistory,

    // Bookmark state
    isBookmarked,

    // Actions
    handleReaction,
    handleReply,
    handleCopyLink,
    handleCopyMessageText,
    handleDelete,
    handleMoreReactions,
    handleEdit,
    handleViewEditHistory,
    handleBookmarkToggle,
  };
}
