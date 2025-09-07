import { useState, useCallback, useEffect } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { Message } from '../../../api/quorumApi';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useSpaceOwner } from '../../queries/spaceOwner';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';

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
      const MAX_PINS = 50;
      const currentCount = await messageDB.getPinnedMessageCount(spaceId, channelId);
      
      if (currentCount >= MAX_PINS) {
        throw new Error(t`Pin limit reached (50)`);
      }
      
      await messageDB.updateMessagePinStatus(
        messageId,
        true,
        user?.userInfo?.address
      );
      
      // TODO: Send pin event message to channel
      // This will be implemented when we add system messages
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinnedMessages', spaceId, channelId] });
      queryClient.invalidateQueries({ queryKey: ['pinnedMessageCount', spaceId, channelId] });
      queryClient.invalidateQueries({ queryKey: ['Messages', spaceId, channelId] });
    },
  });

  // Mutation for unpinning a message
  const unpinMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await messageDB.updateMessagePinStatus(messageId, false);
      
      // TODO: Send unpin event message to channel
      // This will be implemented when we add system messages
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinnedMessages', spaceId, channelId] });
      queryClient.invalidateQueries({ queryKey: ['pinnedMessageCount', spaceId, channelId] });
      queryClient.invalidateQueries({ queryKey: ['Messages', spaceId, channelId] });
    },
  });

  const pinMessage = useCallback(
    (messageId: string) => {
      if (!isSpaceOwner) {
        return;
      }
      pinMutation.mutate(messageId);
    },
    [isSpaceOwner, pinMutation]
  );

  const unpinMessage = useCallback(
    (messageId: string) => {
      if (!isSpaceOwner) {
        return;
      }
      unpinMutation.mutate(messageId);
    },
    [isSpaceOwner, unpinMutation]
  );

  const togglePin = useCallback(
    (message: Message) => {
      if (message.isPinned) {
        unpinMessage(message.messageId);
      } else {
        pinMessage(message.messageId);
      }
    },
    [pinMessage, unpinMessage, isSpaceOwner]
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
    error,
  };
};