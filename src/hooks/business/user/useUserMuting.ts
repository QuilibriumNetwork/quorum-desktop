import { useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { useInvalidateMutedUsers } from '../../queries/mutedUsers';
import type { MuteMessage } from '../../../api/quorumApi';

export const useUserMuting = () => {
  const [muting, setMuting] = useState(false);

  const queryClient = useQueryClient();
  const { messageDB, submitChannelMessage } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { spaceId, channelId } = useParams();
  const invalidateMutedUsers = useInvalidateMutedUsers();

  const muteUser = useCallback(
    async (targetUserId: string) => {
      // Validate required parameters - throw errors instead of silent return
      if (!spaceId) {
        throw new Error('Cannot mute user: not in a Space context');
      }
      if (!currentPasskeyInfo?.address) {
        throw new Error('Cannot mute user: not logged in');
      }
      if (!targetUserId) {
        throw new Error('Cannot mute user: no target specified');
      }

      // Get the space to find the default channel if no channelId in route
      const space = await messageDB.getSpace(spaceId);
      const targetChannelId = channelId || space?.defaultChannelId;

      if (!targetChannelId) {
        throw new Error('Cannot mute user: no channel available');
      }

      setMuting(true);
      try {
        const muteMessage: MuteMessage = {
          type: 'mute',
          senderId: currentPasskeyInfo.address,
          targetUserId,
          muteId: crypto.randomUUID(),
          timestamp: Date.now(),
          action: 'mute',
        };

        await submitChannelMessage(
          spaceId,
          targetChannelId,
          muteMessage,
          queryClient,
          currentPasskeyInfo
        );

        // Also store locally for immediate effect
        await messageDB.muteUser(
          spaceId,
          targetUserId,
          currentPasskeyInfo.address,
          muteMessage.muteId,
          muteMessage.timestamp
        );

        // Invalidate muted users cache
        invalidateMutedUsers({ spaceId });
      } catch (error) {
        console.error('Failed to mute user:', error);
        throw error;
      } finally {
        setMuting(false);
      }
    },
    [spaceId, channelId, currentPasskeyInfo, messageDB, submitChannelMessage, queryClient, invalidateMutedUsers]
  );

  const unmuteUser = useCallback(
    async (targetUserId: string) => {
      // Validate required parameters - throw errors instead of silent return
      if (!spaceId) {
        throw new Error('Cannot unmute user: not in a Space context');
      }
      if (!currentPasskeyInfo?.address) {
        throw new Error('Cannot unmute user: not logged in');
      }
      if (!targetUserId) {
        throw new Error('Cannot unmute user: no target specified');
      }

      // Get the space to find the default channel if no channelId in route
      const space = await messageDB.getSpace(spaceId);
      const targetChannelId = channelId || space?.defaultChannelId;

      if (!targetChannelId) {
        throw new Error('Cannot unmute user: no channel available');
      }

      setMuting(true);
      try {
        const unmuteMessage: MuteMessage = {
          type: 'mute',
          senderId: currentPasskeyInfo.address,
          targetUserId,
          muteId: crypto.randomUUID(),
          timestamp: Date.now(),
          action: 'unmute',
        };

        await submitChannelMessage(
          spaceId,
          targetChannelId,
          unmuteMessage,
          queryClient,
          currentPasskeyInfo
        );

        // Also remove locally for immediate effect
        await messageDB.unmuteUser(spaceId, targetUserId);

        // Invalidate muted users cache
        invalidateMutedUsers({ spaceId });
      } catch (error) {
        console.error('Failed to unmute user:', error);
        throw error;
      } finally {
        setMuting(false);
      }
    },
    [spaceId, channelId, currentPasskeyInfo, messageDB, submitChannelMessage, queryClient, invalidateMutedUsers]
  );

  return {
    muting,
    muteUser,
    unmuteUser,
  };
};
