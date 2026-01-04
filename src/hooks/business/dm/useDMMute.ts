/**
 * Hook for managing muted DM conversations
 *
 * Provides functions to toggle mute status and check if conversations are muted.
 * Settings are stored in IndexedDB user_config.mutedConversations and sync across devices.
 * Uses Action Queue for offline support and crash recovery.
 */

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConfig, buildConfigKey } from '../../queries/config';

interface UseDMMuteReturn {
  /** Array of muted conversation IDs */
  muted: string[];
  /** Set of muted conversation IDs for O(1) lookup */
  mutedSet: Set<string>;
  /** Check if a conversation is muted */
  isMuted: (conversationId: string) => boolean;
  /** Mute a conversation */
  muteConversation: (conversationId: string) => Promise<void>;
  /** Unmute a conversation */
  unmuteConversation: (conversationId: string) => Promise<void>;
  /** Toggle mute status for a conversation */
  toggleMute: (conversationId: string) => Promise<void>;
}

/**
 * Hook for managing muted DM conversations
 *
 * @example
 * const { isMuted, toggleMute, muted } = useDMMute();
 *
 * // Check if muted:
 * if (isMuted(conversationId)) { ... }
 *
 * // Toggle from context menu:
 * await toggleMute(conversationId);
 */
export function useDMMute(): UseDMMuteReturn {
  const { messageDB, actionQueueService, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const queryClient = useQueryClient();

  // Get user config from React Query cache
  const { data: config } = useConfig({ userAddress: userAddress || '' });

  // Get muted array and memoized set for efficient lookup
  const muted = useMemo(() => config?.mutedConversations || [], [config?.mutedConversations]);
  const mutedSet = useMemo(() => new Set(muted), [muted]);

  // Check if a conversation is muted
  const isMuted = useCallback(
    (conversationId: string): boolean => {
      return mutedSet.has(conversationId);
    },
    [mutedSet]
  );

  // Mute a conversation
  const muteConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      if (!userAddress || !keyset) return;

      try {
        // Get current config
        const currentConfig = await messageDB.getUserConfig({ address: userAddress });
        const currentMuted = currentConfig?.mutedConversations || [];

        // Skip if already muted
        if (currentMuted.includes(conversationId)) return;

        // Update muted list
        const updatedConfig = {
          ...currentConfig,
          address: userAddress,
          spaceIds: currentConfig?.spaceIds || [],
          mutedConversations: [...currentMuted, conversationId],
        };

        // Optimistically update React Query cache for instant UI feedback
        queryClient.setQueryData(
          buildConfigKey({ userAddress }),
          updatedConfig
        );

        // Invalidate unread count queries for immediate NavMenu badge update
        queryClient.invalidateQueries({
          queryKey: ['unread-counts', 'direct-messages', userAddress],
        });

        // Queue config save in background (offline support, crash recovery)
        await actionQueueService.enqueue(
          'save-user-config',
          { config: updatedConfig },
          `config:${userAddress}` // Dedup key - collapses rapid toggles
        );
      } catch (error) {
        console.error('[DMMute] Error muting conversation:', error);
        throw error;
      }
    },
    [userAddress, keyset, messageDB, queryClient, actionQueueService]
  );

  // Unmute a conversation
  const unmuteConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      if (!userAddress || !keyset) return;

      try {
        // Get current config
        const currentConfig = await messageDB.getUserConfig({ address: userAddress });
        const currentMuted = currentConfig?.mutedConversations || [];

        // Skip if not muted
        if (!currentMuted.includes(conversationId)) return;

        // Update muted list (remove this conversation)
        const updatedConfig = {
          ...currentConfig,
          address: userAddress,
          spaceIds: currentConfig?.spaceIds || [],
          mutedConversations: currentMuted.filter((id) => id !== conversationId),
        };

        // Optimistically update React Query cache for instant UI feedback
        queryClient.setQueryData(
          buildConfigKey({ userAddress }),
          updatedConfig
        );

        // Invalidate unread count queries for immediate NavMenu badge update
        queryClient.invalidateQueries({
          queryKey: ['unread-counts', 'direct-messages', userAddress],
        });

        // Queue config save in background (offline support, crash recovery)
        await actionQueueService.enqueue(
          'save-user-config',
          { config: updatedConfig },
          `config:${userAddress}` // Dedup key - collapses rapid toggles
        );
      } catch (error) {
        console.error('[DMMute] Error unmuting conversation:', error);
        throw error;
      }
    },
    [userAddress, keyset, messageDB, queryClient, actionQueueService]
  );

  // Toggle mute status
  const toggleMute = useCallback(
    async (conversationId: string): Promise<void> => {
      if (isMuted(conversationId)) {
        await unmuteConversation(conversationId);
      } else {
        await muteConversation(conversationId);
      }
    },
    [isMuted, muteConversation, unmuteConversation]
  );

  return {
    muted,
    mutedSet,
    isMuted,
    muteConversation,
    unmuteConversation,
    toggleMute,
  };
}
