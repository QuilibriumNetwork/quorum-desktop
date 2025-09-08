import { useState, useCallback, useEffect } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { Message } from '../../../api/quorumApi';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useSpaceOwner } from '../../queries/spaceOwner';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';

// Configuration constants for pinned messages feature
const PINNED_MESSAGES_CONFIG = {
  MAX_PINS: 50,  // Maximum number of messages that can be pinned per channel
} as const;

export const usePinnedMessages = (spaceId: string, channelId: string) => {
  const queryClient = useQueryClient();
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });
  
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
        const currentCount = await messageDB.getPinnedMessageCount(spaceId, channelId);
        
        if (currentCount >= PINNED_MESSAGES_CONFIG.MAX_PINS) {
          throw new Error(t`Pin limit reached (${PINNED_MESSAGES_CONFIG.MAX_PINS})`);
        }
        
        await messageDB.updateMessagePinStatus(
          messageId,
          true,
          user?.userInfo?.address
        );
        
        // TODO: Send pin event message to channel
        // This will be implemented when we add system messages
      } catch (error) {
        console.error('Error pinning message:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinnedMessages', spaceId, channelId] });
      queryClient.invalidateQueries({ queryKey: ['pinnedMessageCount', spaceId, channelId] });
      queryClient.invalidateQueries({ queryKey: ['Messages', spaceId, channelId] });
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
      queryClient.invalidateQueries({ queryKey: ['pinnedMessages', spaceId, channelId] });
      queryClient.invalidateQueries({ queryKey: ['pinnedMessageCount', spaceId, channelId] });
      queryClient.invalidateQueries({ queryKey: ['Messages', spaceId, channelId] });
    },
    onError: (error) => {
      console.error('Unpin mutation failed:', error);
      // The error will be available to consumers via mutation state
    },
  });

  const pinMessage = useCallback(
    (messageId: string) => {
      if (!isSpaceOwner) {
        console.warn('User does not have permission to pin messages');
        return;
      }
      if (!spaceId || !channelId) {
        console.error('Missing spaceId or channelId for pinning message');
        return;
      }
      pinMutation.mutate(messageId);
    },
    [isSpaceOwner, pinMutation, spaceId, channelId]
  );

  const unpinMessage = useCallback(
    (messageId: string) => {
      if (!isSpaceOwner) {
        console.warn('User does not have permission to unpin messages');
        return;
      }
      if (!spaceId || !channelId) {
        console.error('Missing spaceId or channelId for unpinning message');
        return;
      }
      unpinMutation.mutate(messageId);
    },
    [isSpaceOwner, unpinMutation, spaceId, channelId]
  );

  const togglePin = useCallback(
    (message: Message) => {
      if (!message || !message.messageId) {
        console.error('Invalid message object for toggle pin');
        return;
      }
      if (message.isPinned) {
        unpinMessage(message.messageId);
      } else {
        pinMessage(message.messageId);
      }
    },
    [pinMessage, unpinMessage]
  );

  return {
    pinnedMessages,
    pinnedCount,
    canPinMessages: Boolean(isSpaceOwner),
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