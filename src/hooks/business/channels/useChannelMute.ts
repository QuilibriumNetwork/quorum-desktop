/**
 * Hook for managing channel mute settings
 *
 * Provides functions to mute/unmute channels and check mute status.
 * Settings are stored in IndexedDB user_config.mutedChannels[spaceId] and sync across devices.
 * Uses Action Queue for offline support and crash recovery (consistent with folder operations).
 *
 * Also provides space-level muting via notificationSettings[spaceId].isMuted.
 * Space mute is a user intent that mutes all channels (including future ones).
 *
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { isChannelMuted, getMutedChannelsForSpace } from '../../../utils/channelUtils';
import { getDefaultNotificationSettings } from '../../../utils/notificationSettingsUtils';
import { useConfig, buildConfigKey } from '../../queries/config';

interface UseChannelMuteProps {
  spaceId: string;
}

interface UseChannelMuteReturn {
  /** Check if a specific channel is muted */
  isChannelMuted: (channelId: string) => boolean;
  /** Get all muted channel IDs for the space */
  getMutedChannelIds: () => string[];
  /** Get the showMutedChannels preference (default: true) */
  showMutedChannels: boolean;
  /** Mute a channel */
  muteChannel: (channelId: string) => Promise<void>;
  /** Unmute a channel */
  unmuteChannel: (channelId: string) => Promise<void>;
  /** Toggle mute status for a channel */
  toggleMute: (channelId: string) => Promise<void>;
  /** Toggle the showMutedChannels preference */
  toggleShowMutedChannels: () => Promise<void>;
  /** Check if the entire space is muted */
  isSpaceMuted: boolean;
  /** Mute the entire space (all channels, including future ones) */
  muteSpace: () => Promise<void>;
  /** Unmute the space (restores individual channel preferences) */
  unmuteSpace: () => Promise<void>;
  /** Toggle space mute status */
  toggleSpaceMute: () => Promise<void>;
}

/**
 * Hook for managing channel mute settings for a space
 *
 * @example
 * const {
 *   isChannelMuted,
 *   muteChannel,
 *   unmuteChannel,
 *   toggleMute,
 *   showMutedChannels,
 *   toggleShowMutedChannels,
 * } = useChannelMute({ spaceId });
 *
 * // Check if muted:
 * if (isChannelMuted(channelId)) { ... }
 *
 * // Toggle mute from context menu:
 * await toggleMute(channelId);
 */
export function useChannelMute({
  spaceId,
}: UseChannelMuteProps): UseChannelMuteReturn {
  const { messageDB, actionQueueService, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const queryClient = useQueryClient();

  // Get user config from React Query cache
  const { data: config } = useConfig({ userAddress: userAddress || '' });

  // Check if a specific channel is muted
  const checkIsChannelMuted = useCallback(
    (channelId: string): boolean => {
      return isChannelMuted(spaceId, channelId, config?.mutedChannels);
    },
    [spaceId, config?.mutedChannels]
  );

  // Get all muted channel IDs for the space
  const getMutedChannelIds = useCallback((): string[] => {
    return getMutedChannelsForSpace(spaceId, config?.mutedChannels);
  }, [spaceId, config?.mutedChannels]);

  // Get showMutedChannels preference (default: true)
  const showMutedChannels = config?.showMutedChannels ?? true;

  // Invalidate notification queries after mute/unmute
  const invalidateNotificationQueries = useCallback(() => {
    // Invalidate mention counts for this space
    queryClient.invalidateQueries({
      queryKey: ['mention-counts', 'channel', spaceId],
    });
    // Invalidate reply counts for this space
    queryClient.invalidateQueries({
      queryKey: ['reply-counts', 'channel', spaceId],
    });
    // Invalidate notification panel queries
    queryClient.invalidateQueries({
      queryKey: ['mention-notifications', spaceId],
    });
    queryClient.invalidateQueries({
      queryKey: ['reply-notifications', spaceId],
    });
    // Invalidate space-level counts
    queryClient.invalidateQueries({
      queryKey: ['mention-counts', 'space'],
    });
    queryClient.invalidateQueries({
      queryKey: ['reply-counts', 'space'],
    });
  }, [queryClient, spaceId]);

  // Mute a channel
  const muteChannel = useCallback(
    async (channelId: string): Promise<void> => {
      if (!userAddress || !keyset) return;

      try {
        // Get current config
        const currentConfig = await messageDB.getUserConfig({ address: userAddress });

        // Get current muted channels for this space
        const currentMuted = currentConfig?.mutedChannels?.[spaceId] || [];

        // Skip if already muted
        if (currentMuted.includes(channelId)) return;

        // Update muted channels
        const updatedConfig = {
          ...currentConfig,
          address: userAddress,
          spaceIds: currentConfig?.spaceIds || [],
          mutedChannels: {
            ...(currentConfig?.mutedChannels || {}),
            [spaceId]: [...currentMuted, channelId],
          },
        };

        // Optimistically update React Query cache for instant UI feedback
        queryClient.setQueryData(
          buildConfigKey({ userAddress }),
          updatedConfig
        );

        // Invalidate notification queries for immediate UI update
        invalidateNotificationQueries();

        // Queue config save in background (offline support, crash recovery)
        await actionQueueService.enqueue(
          'save-user-config',
          { config: updatedConfig },
          `config:${userAddress}` // Dedup key - collapses rapid toggles
        );
      } catch (error) {
        console.error('[ChannelMute] Error muting channel:', error);
        throw error;
      }
    },
    [spaceId, userAddress, keyset, messageDB, queryClient, actionQueueService, invalidateNotificationQueries]
  );

  // Unmute a channel
  const unmuteChannel = useCallback(
    async (channelId: string): Promise<void> => {
      if (!userAddress || !keyset) return;

      try {
        // Get current config
        const currentConfig = await messageDB.getUserConfig({ address: userAddress });

        // Get current muted channels for this space
        const currentMuted = currentConfig?.mutedChannels?.[spaceId] || [];

        // Skip if not muted
        if (!currentMuted.includes(channelId)) return;

        // Update muted channels (remove this channel)
        const updatedConfig = {
          ...currentConfig,
          address: userAddress,
          spaceIds: currentConfig?.spaceIds || [],
          mutedChannels: {
            ...(currentConfig?.mutedChannels || {}),
            [spaceId]: currentMuted.filter((id) => id !== channelId),
          },
        };

        // Optimistically update React Query cache for instant UI feedback
        queryClient.setQueryData(
          buildConfigKey({ userAddress }),
          updatedConfig
        );

        // Invalidate notification queries for immediate UI update
        invalidateNotificationQueries();

        // Queue config save in background (offline support, crash recovery)
        await actionQueueService.enqueue(
          'save-user-config',
          { config: updatedConfig },
          `config:${userAddress}` // Dedup key - collapses rapid toggles
        );
      } catch (error) {
        console.error('[ChannelMute] Error unmuting channel:', error);
        throw error;
      }
    },
    [spaceId, userAddress, keyset, messageDB, queryClient, actionQueueService, invalidateNotificationQueries]
  );

  // Toggle mute status
  const toggleMute = useCallback(
    async (channelId: string): Promise<void> => {
      if (checkIsChannelMuted(channelId)) {
        await unmuteChannel(channelId);
      } else {
        await muteChannel(channelId);
      }
    },
    [checkIsChannelMuted, muteChannel, unmuteChannel]
  );

  // Toggle showMutedChannels preference
  const toggleShowMutedChannels = useCallback(async (): Promise<void> => {
    if (!userAddress || !keyset) return;

    try {
      // Get current config
      const currentConfig = await messageDB.getUserConfig({ address: userAddress });

      // Toggle the preference
      const updatedConfig = {
        ...currentConfig,
        address: userAddress,
        spaceIds: currentConfig?.spaceIds || [],
        showMutedChannels: !(currentConfig?.showMutedChannels ?? true),
      };

      // Optimistically update React Query cache for instant UI feedback
      queryClient.setQueryData(
        buildConfigKey({ userAddress }),
        updatedConfig
      );

      // Queue config save in background (offline support, crash recovery)
      await actionQueueService.enqueue(
        'save-user-config',
        { config: updatedConfig },
        `config:${userAddress}` // Dedup key
      );
    } catch (error) {
      console.error('[ChannelMute] Error toggling showMutedChannels:', error);
      throw error;
    }
  }, [userAddress, keyset, messageDB, queryClient, actionQueueService]);

  // Check if the entire space is muted (from notificationSettings)
  const isSpaceMuted = config?.notificationSettings?.[spaceId]?.isMuted ?? false;

  // Mute the entire space
  const muteSpace = useCallback(async (): Promise<void> => {
    if (!userAddress || !keyset) return;

    try {
      // Get current config
      const currentConfig = await messageDB.getUserConfig({ address: userAddress });

      // Get current notification settings for this space
      const currentSettings = currentConfig?.notificationSettings?.[spaceId] ||
        getDefaultNotificationSettings(spaceId);

      // Update notification settings with isMuted = true
      const updatedConfig = {
        ...currentConfig,
        address: userAddress,
        spaceIds: currentConfig?.spaceIds || [],
        notificationSettings: {
          ...(currentConfig?.notificationSettings || {}),
          [spaceId]: {
            ...currentSettings,
            isMuted: true,
          },
        },
      };

      // Optimistically update React Query cache for instant UI feedback
      queryClient.setQueryData(
        buildConfigKey({ userAddress }),
        updatedConfig
      );

      // Invalidate notification queries for immediate UI update
      invalidateNotificationQueries();

      // Queue config save in background (offline support, crash recovery)
      await actionQueueService.enqueue(
        'save-user-config',
        { config: updatedConfig },
        `config:${userAddress}` // Dedup key
      );
    } catch (error) {
      console.error('[ChannelMute] Error muting space:', error);
      throw error;
    }
  }, [spaceId, userAddress, keyset, messageDB, queryClient, actionQueueService, invalidateNotificationQueries]);

  // Unmute the entire space
  const unmuteSpace = useCallback(async (): Promise<void> => {
    if (!userAddress || !keyset) return;

    try {
      // Get current config
      const currentConfig = await messageDB.getUserConfig({ address: userAddress });

      // Get current notification settings for this space
      const currentSettings = currentConfig?.notificationSettings?.[spaceId] ||
        getDefaultNotificationSettings(spaceId);

      // Update notification settings with isMuted = false
      const updatedConfig = {
        ...currentConfig,
        address: userAddress,
        spaceIds: currentConfig?.spaceIds || [],
        notificationSettings: {
          ...(currentConfig?.notificationSettings || {}),
          [spaceId]: {
            ...currentSettings,
            isMuted: false,
          },
        },
      };

      // Optimistically update React Query cache for instant UI feedback
      queryClient.setQueryData(
        buildConfigKey({ userAddress }),
        updatedConfig
      );

      // Invalidate notification queries for immediate UI update
      invalidateNotificationQueries();

      // Queue config save in background (offline support, crash recovery)
      await actionQueueService.enqueue(
        'save-user-config',
        { config: updatedConfig },
        `config:${userAddress}` // Dedup key
      );
    } catch (error) {
      console.error('[ChannelMute] Error unmuting space:', error);
      throw error;
    }
  }, [spaceId, userAddress, keyset, messageDB, queryClient, actionQueueService, invalidateNotificationQueries]);

  // Toggle space mute status
  const toggleSpaceMute = useCallback(async (): Promise<void> => {
    if (isSpaceMuted) {
      await unmuteSpace();
    } else {
      await muteSpace();
    }
  }, [isSpaceMuted, muteSpace, unmuteSpace]);

  return {
    isChannelMuted: checkIsChannelMuted,
    getMutedChannelIds,
    showMutedChannels,
    muteChannel,
    unmuteChannel,
    toggleMute,
    toggleShowMutedChannels,
    isSpaceMuted,
    muteSpace,
    unmuteSpace,
    toggleSpaceMute,
  };
}
