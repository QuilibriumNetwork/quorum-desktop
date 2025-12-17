import { useCallback } from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useInvalidateMutedUsers } from '../../queries/mutedUsers';
import type { MuteMessage } from '../../../api/quorumApi';

export const useUserMuting = () => {
  const { messageDB, actionQueueService } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { spaceId, channelId } = useParams();
  const invalidateMutedUsers = useInvalidateMutedUsers();

  const muteUser = useCallback(
    async (targetUserId: string, days: number = 0) => {
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

      const timestamp = Date.now();
      // Convert days to milliseconds (0 = forever, undefined duration)
      const duration = days > 0 ? days * 24 * 60 * 60 * 1000 : undefined;
      const expiresAt = duration ? timestamp + duration : undefined;

      const muteMessage: MuteMessage = {
        type: 'mute',
        senderId: currentPasskeyInfo.address,
        targetUserId,
        muteId: crypto.randomUUID(),
        timestamp,
        action: 'mute',
        ...(duration !== undefined && { duration }),
      };

      // Optimistic update: Store locally for immediate effect
      await messageDB.muteUser(
        spaceId,
        targetUserId,
        currentPasskeyInfo.address,
        muteMessage.muteId,
        muteMessage.timestamp,
        expiresAt
      );
      invalidateMutedUsers({ spaceId });

      // Queue the server-side message send in background
      await actionQueueService.enqueue(
        'mute-user',
        {
          spaceId,
          channelId: targetChannelId,
          muteMessage,
          currentPasskeyInfo,
        },
        `mute:${spaceId}:${targetUserId}` // Dedup key
      );
    },
    [spaceId, channelId, currentPasskeyInfo, messageDB, actionQueueService, invalidateMutedUsers]
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

      const unmuteMessage: MuteMessage = {
        type: 'mute',
        senderId: currentPasskeyInfo.address,
        targetUserId,
        muteId: crypto.randomUUID(),
        timestamp: Date.now(),
        action: 'unmute',
      };

      // Optimistic update: Remove locally for immediate effect
      await messageDB.unmuteUser(spaceId, targetUserId);
      invalidateMutedUsers({ spaceId });

      // Queue the server-side message send in background
      await actionQueueService.enqueue(
        'unmute-user',
        {
          spaceId,
          channelId: targetChannelId,
          unmuteMessage,
          currentPasskeyInfo,
        },
        `unmute:${spaceId}:${targetUserId}` // Dedup key
      );
    },
    [spaceId, channelId, currentPasskeyInfo, messageDB, actionQueueService, invalidateMutedUsers]
  );

  return {
    muteUser,
    unmuteUser,
  };
};
