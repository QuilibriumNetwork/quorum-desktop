/**
 * Hook for managing Space favorites.
 *
 * Stored in IndexedDB user_config.favoriteSpaces and synced across devices.
 * Uses Action Queue for offline support and crash recovery. Mirrors
 * useDMFavorites — see that hook for the canonical pattern.
 */

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConfig, buildConfigKey } from '../../queries/config';

interface UseSpaceFavoritesReturn {
  favorites: string[];
  favoritesSet: Set<string>;
  isFavorite: (spaceId: string) => boolean;
  addFavorite: (spaceId: string) => Promise<void>;
  removeFavorite: (spaceId: string) => Promise<void>;
  toggleFavorite: (spaceId: string) => Promise<void>;
}

export function useSpaceFavorites(): UseSpaceFavoritesReturn {
  const { messageDB, actionQueueService, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const queryClient = useQueryClient();

  const { data: config } = useConfig({ userAddress: userAddress || '' });

  const favorites = useMemo(() => config?.favoriteSpaces || [], [config?.favoriteSpaces]);
  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  const isFavorite = useCallback(
    (spaceId: string): boolean => favoritesSet.has(spaceId),
    [favoritesSet]
  );

  const addFavorite = useCallback(
    async (spaceId: string): Promise<void> => {
      if (!userAddress || !keyset) return;
      try {
        const currentConfig = await messageDB.getUserConfig({ address: userAddress });
        const currentFavorites = currentConfig?.favoriteSpaces || [];
        if (currentFavorites.includes(spaceId)) return;
        const updatedConfig = {
          ...currentConfig,
          address: userAddress,
          spaceIds: currentConfig?.spaceIds || [],
          favoriteSpaces: [...currentFavorites, spaceId],
        };
        queryClient.setQueryData(buildConfigKey({ userAddress }), updatedConfig);
        await actionQueueService.enqueue(
          'save-user-config',
          { config: updatedConfig },
          `config:${userAddress}`
        );
      } catch (error) {
        console.error('[SpaceFavorites] Error adding favorite:', error);
        throw error;
      }
    },
    [userAddress, keyset, messageDB, queryClient, actionQueueService]
  );

  const removeFavorite = useCallback(
    async (spaceId: string): Promise<void> => {
      if (!userAddress || !keyset) return;
      try {
        const currentConfig = await messageDB.getUserConfig({ address: userAddress });
        const currentFavorites = currentConfig?.favoriteSpaces || [];
        if (!currentFavorites.includes(spaceId)) return;
        const updatedConfig = {
          ...currentConfig,
          address: userAddress,
          spaceIds: currentConfig?.spaceIds || [],
          favoriteSpaces: currentFavorites.filter((id) => id !== spaceId),
        };
        queryClient.setQueryData(buildConfigKey({ userAddress }), updatedConfig);
        await actionQueueService.enqueue(
          'save-user-config',
          { config: updatedConfig },
          `config:${userAddress}`
        );
      } catch (error) {
        console.error('[SpaceFavorites] Error removing favorite:', error);
        throw error;
      }
    },
    [userAddress, keyset, messageDB, queryClient, actionQueueService]
  );

  const toggleFavorite = useCallback(
    async (spaceId: string): Promise<void> => {
      if (isFavorite(spaceId)) {
        await removeFavorite(spaceId);
      } else {
        await addFavorite(spaceId);
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
