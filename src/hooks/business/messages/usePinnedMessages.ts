import { useState, useCallback, useEffect } from 'react';
import React from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import type { Message, Channel, Role } from '../../../api/quorumApi';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useSpaceOwner } from '../../queries/spaceOwner';
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
  const { messageDB } = useMessageDB();
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });
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

  // Mutation for pinning a message
  const pinMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!messageId) {
        throw new Error(t`Invalid message ID`);
      }

      try {
        const currentCount = await messageDB.getPinnedMessageCount(
          spaceId,
          channelId
        );

        if (currentCount >= PINNED_MESSAGES_CONFIG.MAX_PINS) {
          throw new Error(
            t`Pin limit reached (${PINNED_MESSAGES_CONFIG.MAX_PINS})`
          );
        }

        await messageDB.updateMessagePinStatus(
          messageId,
          true,
          user?.currentPasskeyInfo?.address
        );

        // TODO: Send pin event message to channel
        // This will be implemented when we add system messages
      } catch (error) {
        console.error('Error pinning message:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['pinnedMessages', spaceId, channelId],
      });
      queryClient.invalidateQueries({
        queryKey: ['pinnedMessageCount', spaceId, channelId],
      });
      queryClient.invalidateQueries({
        queryKey: ['Messages', spaceId, channelId],
      });
    },
    onError: (error) => {
      console.error('Pin mutation failed:', error);
      // The error will be available to consumers via mutation state
    },
  });

  // Mutation for unpinning a message
  const unpinMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!messageId) {
        throw new Error(t`Invalid message ID`);
      }

      try {
        await messageDB.updateMessagePinStatus(messageId, false);

        // TODO: Send unpin event message to channel
        // This will be implemented when we add system messages
      } catch (error) {
        console.error('Error unpinning message:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['pinnedMessages', spaceId, channelId],
      });
      queryClient.invalidateQueries({
        queryKey: ['pinnedMessageCount', spaceId, channelId],
      });
      queryClient.invalidateQueries({
        queryKey: ['Messages', spaceId, channelId],
      });
    },
    onError: (error) => {
      console.error('Unpin mutation failed:', error);
      // The error will be available to consumers via mutation state
    },
  });

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

    // Use centralized permission utility (handles space owners + role permissions)
    return hasPermission(userAddress, 'message:pin', space, isSpaceOwner);
  }, [user?.currentPasskeyInfo?.address, isSpaceOwner, channel, space]);

  const pinMessage = useCallback(
    (messageId: string) => {
      if (!canUserPin()) {
        console.warn('User does not have permission to pin messages');
        return;
      }
      if (!spaceId || !channelId) {
        console.error('Missing spaceId or channelId for pinning message');
        return;
      }
      pinMutation.mutate(messageId);
    },
    [canUserPin, pinMutation, spaceId, channelId]
  );

  const unpinMessage = useCallback(
    (messageId: string) => {
      if (!canUserPin()) {
        console.warn('User does not have permission to unpin messages');
        return;
      }
      if (!spaceId || !channelId) {
        console.error('Missing spaceId or channelId for unpinning message');
        return;
      }
      unpinMutation.mutate(messageId);
    },
    [canUserPin, unpinMutation, spaceId, channelId]
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
        }),
        confirmText: message.isPinned ? t`Unpin` : t`Pin`,
        cancelText: t`Cancel`,
        variant: message.isPinned ? 'danger' : 'primary',
        protipAction: message.isPinned ? t`unpin` : t`pin`,
        onConfirm: performToggle,
      });
    },
    [pinMessage, unpinMessage, showConfirmationModal, mapSenderToUser, spaceRoles, spaceChannels, onChannelClick]
  );

  return {
    pinnedMessages,
    pinnedCount,
    canPinMessages: canUserPin(),
    pinMessage,
    unpinMessage,
    togglePin,
    isPinning: pinMutation.isPending || unpinMutation.isPending,
    isLoading,
    error: error || pinMutation.error || unpinMutation.error,
    pinError: pinMutation.error,
    unpinError: unpinMutation.error,
  };
};
