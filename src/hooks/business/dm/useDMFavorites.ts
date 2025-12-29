/**
 * Hook for managing DM favorites
 *
 * Provides functions to toggle favorites and check favorite status.
 * Settings are stored in IndexedDB user_config.favoriteDMs and sync across devices.
 * Uses Action Queue for offline support and crash recovery.
 */

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConfig, buildConfigKey } from '../../queries/config';

interface UseDMFavoritesReturn {
  /** Array of favorite conversation IDs */
  favorites: string[];
  /** Set of favorite conversation IDs for O(1) lookup */
  favoritesSet: Set<string>;
  /** Check if a conversation is favorited */
  isFavorite: (conversationId: string) => boolean;
  /** Add a conversation to favorites */
  addFavorite: (conversationId: string) => Promise<void>;
  /** Remove a conversation from favorites */
  removeFavorite: (conversationId: string) => Promise<void>;
  /** Toggle favorite status for a conversation */
  toggleFavorite: (conversationId: string) => Promise<void>;
}

/**
 * Hook for managing DM favorites
 *
 * @example
 * const { isFavorite, toggleFavorite, favorites } = useDMFavorites();
 *
 * // Check if favorited:
 * if (isFavorite(conversationId)) { ... }
 *
 * // Toggle from context menu:
 * await toggleFavorite(conversationId);
 */
export function useDMFavorites(): UseDMFavoritesReturn {
  const { messageDB, actionQueueService, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const queryClient = useQueryClient();

  // Get user config from React Query cache
  const { data: config } = useConfig({ userAddress: userAddress || '' });

  // Get favorites array and memoized set for efficient lookup
  const favorites = useMemo(() => config?.favoriteDMs || [], [config?.favoriteDMs]);
  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  // Check if a conversation is favorited
  const isFavorite = useCallback(
    (conversationId: string): boolean => {
      return favoritesSet.has(conversationId);
    },
    [favoritesSet]
  );

  // Add a conversation to favorites
  const addFavorite = useCallback(
    async (conversationId: string): Promise<void> => {
      if (!userAddress || !keyset) return;

      try {
        // Get current config
        const currentConfig = await messageDB.getUserConfig({ address: userAddress });
        const currentFavorites = currentConfig?.favoriteDMs || [];

        // Skip if already favorited
        if (currentFavorites.includes(conversationId)) return;

        // Update favorites
        const updatedConfig = {
          ...currentConfig,
          address: userAddress,
          spaceIds: currentConfig?.spaceIds || [],
          favoriteDMs: [...currentFavorites, conversationId],
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
          `config:${userAddress}` // Dedup key - collapses rapid toggles
        );
      } catch (error) {
        console.error('[DMFavorites] Error adding favorite:', error);
        throw error;
      }
    },
    [userAddress, keyset, messageDB, queryClient, actionQueueService]
  );

  // Remove a conversation from favorites
  const removeFavorite = useCallback(
    async (conversationId: string): Promise<void> => {
      if (!userAddress || !keyset) return;

      try {
        // Get current config
        const currentConfig = await messageDB.getUserConfig({ address: userAddress });
        const currentFavorites = currentConfig?.favoriteDMs || [];

        // Skip if not favorited
        if (!currentFavorites.includes(conversationId)) return;

        // Update favorites (remove this conversation)
        const updatedConfig = {
          ...currentConfig,
          address: userAddress,
          spaceIds: currentConfig?.spaceIds || [],
          favoriteDMs: currentFavorites.filter((id) => id !== conversationId),
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
          `config:${userAddress}` // Dedup key - collapses rapid toggles
        );
      } catch (error) {
        console.error('[DMFavorites] Error removing favorite:', error);
        throw error;
      }
    },
    [userAddress, keyset, messageDB, queryClient, actionQueueService]
  );

  // Toggle favorite status
  const toggleFavorite = useCallback(
    async (conversationId: string): Promise<void> => {
      if (isFavorite(conversationId)) {
        await removeFavorite(conversationId);
      } else {
        await addFavorite(conversationId);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return {
    favorites,
    favoritesSet,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
  };
}
