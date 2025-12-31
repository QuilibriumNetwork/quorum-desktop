import { logger } from '@quilibrium/quorum-shared';
import { useCallback } from 'react';
import React from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { Message, Channel, Role, PinMessage } from '../../../api/quorumApi';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { hasPermission } from '../../../utils/permissions';
import { useConfirmationModal } from '../../../components/context/ConfirmationModalProvider';
import MessagePreview from '../../../components/message/MessagePreview';
import { t } from '@lingui/core/macro';

// Configuration constants for pinned messages feature
const PINNED_MESSAGES_CONFIG = {
  MAX_PINS: 50, // Maximum number of messages that can be pinned per channel
} as const;

export const usePinnedMessages = (
  spaceId: string,
  channelId: string,
  channel?: Channel,
  mapSenderToUser?: (senderId: string) => any,
  stickers?: { [key: string]: any },
  spaceRoles?: Role[],
  spaceChannels?: Channel[],
  onChannelClick?: (channelId: string) => void
) => {
  const queryClient = useQueryClient();
  const user = usePasskeysContext();
  const { messageDB, actionQueueService } = useMessageDB();
  const { showConfirmationModal } = useConfirmationModal();
  // Query for space data to check roles and permissions
  const { data: space } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: async () => {
      if (!spaceId) return null;
      return await messageDB.getSpace(spaceId);
    },
    enabled: !!spaceId,
  });

  // Use channel from props instead of querying (to ensure consistency with useChannelMessages)

  // Query for pinned messages
  const {
    data: pinnedMessages = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['pinnedMessages', spaceId, channelId],
    queryFn: async () => {
      if (!spaceId || !channelId) return [];
      const result = await messageDB.getPinnedMessages(spaceId, channelId);
      return result;
    },
    enabled: !!spaceId && !!channelId,
  });

  // Query for pinned message count
  const { data: pinnedCount = 0 } = useQuery({
    queryKey: ['pinnedMessageCount', spaceId, channelId],
    queryFn: async () => {
      if (!spaceId || !channelId) return 0;
      return await messageDB.getPinnedMessageCount(spaceId, channelId);
    },
    enabled: !!spaceId && !!channelId,
  });

  // Pin a message - optimistic local update + queue server call
  const doPinMessage = useCallback(
    async (messageId: string) => {
      if (!messageId) {
        throw new Error(t`Invalid message ID`);
      }

      if (!user?.currentPasskeyInfo) {
        throw new Error(t`User not authenticated`);
      }

      const currentCount = await messageDB.getPinnedMessageCount(
        spaceId,
        channelId
      );

      if (currentCount >= PINNED_MESSAGES_CONFIG.MAX_PINS) {
        throw new Error(
          t`Pin limit reached (${PINNED_MESSAGES_CONFIG.MAX_PINS})`
        );
      }

      // Create the pin message
      const pinMessage: PinMessage = {
        senderId: user.currentPasskeyInfo.address,
        type: 'pin',
        targetMessageId: messageId,
        action: 'pin',
      };

      // Optimistic update: Update React Query caches immediately for instant UI feedback
      // Update Messages cache to show isPinned = true
      queryClient.setQueryData(
        ['Messages', spaceId, channelId],
        (oldData: any) => {
          if (!oldData?.pages) return oldData;
          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((msg: Message) =>
                msg.messageId === messageId
                  ? { ...msg, isPinned: true, pinnedAt: Date.now(), pinnedBy: user.currentPasskeyInfo!.address }
                  : msg
              ),
            })),
          };
        }
      );

      // Update pinnedMessageCount cache
      queryClient.setQueryData(
        ['pinnedMessageCount', spaceId, channelId],
        (oldCount: number | undefined) => (oldCount ?? 0) + 1
      );

      // Also persist to IndexedDB for offline durability
      await messageDB.updateMessagePinStatus(messageId, true, user.currentPasskeyInfo.address);

      // Update pinnedMessages list cache directly for instant UI feedback
      // Get the message from Messages cache to add to pinned list
      const messagesData = queryClient.getQueryData(['Messages', spaceId, channelId]) as any;
      if (messagesData?.pages) {
        for (const page of messagesData.pages) {
          const foundMsg = page.messages?.find((m: Message) => m.messageId === messageId);
          if (foundMsg) {
            const pinnedMsg = { ...foundMsg, isPinned: true, pinnedAt: Date.now(), pinnedBy: user.currentPasskeyInfo!.address };
            queryClient.setQueryData(
              ['pinnedMessages', spaceId, channelId],
              (oldPinned: Message[] | undefined) => [...(oldPinned || []), pinnedMsg]
            );
            break;
          }
        }
      }

      // Queue the server-side broadcast
      await actionQueueService.enqueue(
        'pin-message',
        {
          spaceId,
          channelId,
          messageId,
          pinMessage,
          currentPasskeyInfo: user.currentPasskeyInfo,
        },
        `pin:${spaceId}:${channelId}:${messageId}` // Dedup key
      );
    },
    [spaceId, channelId, user?.currentPasskeyInfo, messageDB, queryClient, actionQueueService]
  );

  // Unpin a message - optimistic local update + queue server call
  const doUnpinMessage = useCallback(
    async (messageId: string) => {
      if (!messageId) {
        throw new Error(t`Invalid message ID`);
      }

      if (!user?.currentPasskeyInfo) {
        throw new Error(t`User not authenticated`);
      }

      // Create the unpin message
      const unpinMessage: PinMessage = {
        senderId: user.currentPasskeyInfo.address,
        type: 'pin',
        targetMessageId: messageId,
        action: 'unpin',
      };

      // Optimistic update: Update React Query caches immediately for instant UI feedback
      // Update Messages cache to show isPinned = false
      queryClient.setQueryData(
        ['Messages', spaceId, channelId],
        (oldData: any) => {
          if (!oldData?.pages) return oldData;
          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((msg: Message) =>
                msg.messageId === messageId
                  ? { ...msg, isPinned: false, pinnedAt: undefined, pinnedBy: undefined }
                  : msg
              ),
            })),
          };
        }
      );

      // Update pinnedMessageCount cache
      queryClient.setQueryData(
        ['pinnedMessageCount', spaceId, channelId],
        (oldCount: number | undefined) => Math.max(0, (oldCount ?? 0) - 1)
      );

      // Also persist to IndexedDB for offline durability
      await messageDB.updateMessagePinStatus(messageId, false);

      // Update pinnedMessages list cache directly - remove the unpinned message
      queryClient.setQueryData(
        ['pinnedMessages', spaceId, channelId],
        (oldPinned: Message[] | undefined) => (oldPinned || []).filter((m) => m.messageId !== messageId)
      );

      // Queue the server-side broadcast
      await actionQueueService.enqueue(
        'unpin-message',
        {
          spaceId,
          channelId,
          unpinMessage,
          currentPasskeyInfo: user.currentPasskeyInfo,
        },
        `unpin:${spaceId}:${channelId}:${messageId}` // Dedup key
      );
    },
    [spaceId, channelId, user?.currentPasskeyInfo, messageDB, queryClient, actionQueueService]
  );

  // Check if user can pin messages - includes read-only manager logic
  const canUserPin = useCallback(() => {
    const userAddress = user?.currentPasskeyInfo?.address;
    if (!userAddress) return false;

    // For read-only channels: check if user is a manager (before checking regular permissions)
    if (channel?.isReadOnly) {
      const isManager = !!(
        channel.managerRoleIds &&
        space?.roles &&
        space.roles.some(
          (role) =>
            channel.managerRoleIds?.includes(role.roleId) &&
            role.members.includes(userAddress)
        )
      );
      if (isManager) {
        return true;
      }
    }

    // IMPORTANT: NO isSpaceOwner bypass - space owners must have explicit message:pin role
    // This matches the receiving-side validation (MessageService.ts:448-523, 882-978)
    // See: .agents/docs/features/messages/pinned-messages.md (lines 317-322)
    return hasPermission(userAddress, 'message:pin', space ?? undefined, false);
  }, [user?.currentPasskeyInfo?.address, channel, space]);

  const pinMessage = useCallback(
    (messageId: string) => {
      if (!canUserPin()) {
        logger.warn('User does not have permission to pin messages');
        return;
      }
      if (!spaceId || !channelId) {
        console.error('Missing spaceId or channelId for pinning message');
        return;
      }
      doPinMessage(messageId);
    },
    [canUserPin, doPinMessage, spaceId, channelId]
  );

  const unpinMessage = useCallback(
    (messageId: string) => {
      if (!canUserPin()) {
        logger.warn('User does not have permission to unpin messages');
        return;
      }
      if (!spaceId || !channelId) {
        console.error('Missing spaceId or channelId for unpinning message');
        return;
      }
      doUnpinMessage(messageId);
    },
    [canUserPin, doUnpinMessage, spaceId, channelId]
  );

  const togglePin = useCallback(
    (e: React.MouseEvent, message: Message) => {
      if (!message || !message.messageId) {
        console.error('Invalid message object for toggle pin');
        return;
      }
      
      const performToggle = () => {
        if (message.isPinned) {
          unpinMessage(message.messageId);
        } else {
          pinMessage(message.messageId);
        }
      };
      
      // Check for Shift+click bypass (desktop only)
      if (e.shiftKey) {
        performToggle();
        return;
      }
      
      // Show confirmation modal
      showConfirmationModal({
        title: message.isPinned ? t`Unpin Message` : t`Pin Message`,
        message: message.isPinned
          ? t`Are you sure you want to unpin this message?`
          : t`Are you sure you want to pin this message?`,
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
        confirmText: message.isPinned ? t`Unpin` : t`Pin`,
        cancelText: t`Cancel`,
        variant: message.isPinned ? 'danger' : undefined,
        protipAction: message.isPinned ? t`unpin` : t`pin`,
        onConfirm: performToggle,
      });
    },
    [pinMessage, unpinMessage, showConfirmationModal, mapSenderToUser, stickers, spaceId, spaceRoles, spaceChannels, onChannelClick]
  );

  return {
    pinnedMessages,
    pinnedCount,
    canPinMessages: canUserPin(),
    pinMessage,
    unpinMessage,
    togglePin,
    isPinning: false, // Always false - operations are queued and return immediately
    isLoading,
    error,
  };
};
