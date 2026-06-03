/**
 * Hook for the "hide muted spaces from sidebar" preference.
 *
 * Persisted in UserConfig.hideMutedSpacesFromSidebar. Same write pattern as
 * useDMFavorites — optimistic React Query cache update + action queue.
 */

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConfig, buildConfigKey } from '../../queries/config';

interface UseHideMutedSpacesReturn {
  hideMutedSpaces: boolean;
  toggleHideMutedSpaces: () => Promise<void>;
}

export function useHideMutedSpaces(): UseHideMutedSpacesReturn {
  const { messageDB, actionQueueService, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const queryClient = useQueryClient();

  const { data: config } = useConfig({ userAddress: userAddress || '' });

  const hideMutedSpaces = useMemo(
    () => config?.hideMutedSpacesFromSidebar ?? false,
    [config?.hideMutedSpacesFromSidebar]
  );

  const toggleHideMutedSpaces = useCallback(async (): Promise<void> => {
    if (!userAddress || !keyset) return;
    try {
      const currentConfig = await messageDB.getUserConfig({ address: userAddress });
      const next = !(currentConfig?.hideMutedSpacesFromSidebar ?? false);
      const updatedConfig = {
        ...currentConfig,
        address: userAddress,
        spaceIds: currentConfig?.spaceIds || [],
        hideMutedSpacesFromSidebar: next,
      };
      queryClient.setQueryData(buildConfigKey({ userAddress }), updatedConfig);
      await actionQueueService.enqueue(
        'save-user-config',
        { config: updatedConfig },
        `config:${userAddress}`
      );
    } catch (error) {
      console.error('[HideMutedSpaces] Error toggling:', error);
      throw error;
    }
  }, [userAddress, keyset, messageDB, queryClient, actionQueueService]);

  return { hideMutedSpaces, toggleHideMutedSpaces };
}
