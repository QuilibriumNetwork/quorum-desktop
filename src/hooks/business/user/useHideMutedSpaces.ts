import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { buildConfigKey, buildConfigFetcher } from '../../queries/config';

interface UseHideMutedSpacesReturn {
  hideMutedSpaces: boolean;
  toggleHideMutedSpaces: () => Promise<void>;
}

export function useHideMutedSpaces(): UseHideMutedSpacesReturn {
  const { messageDB, actionQueueService, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const queryClient = useQueryClient();

  // useQuery (not useSuspenseQuery) so callers don't need a Suspense boundary
  // to read just this single preference field.
  const { data: config } = useQuery({
    queryKey: buildConfigKey({ userAddress: userAddress || '' }),
    queryFn: buildConfigFetcher({ messageDB, userAddress: userAddress || '' }),
    enabled: !!userAddress,
    networkMode: 'always',
  });

  const hideMutedSpaces = config?.hideMutedSpacesFromSidebar ?? false;

  const toggleHideMutedSpaces = useCallback(async (): Promise<void> => {
    if (!userAddress || !keyset) return;

    try {
      const currentConfig = await messageDB.getUserConfig({ address: userAddress });

      const updatedConfig = {
        ...currentConfig,
        address: userAddress,
        spaceIds: currentConfig?.spaceIds || [],
        hideMutedSpacesFromSidebar: !(currentConfig?.hideMutedSpacesFromSidebar ?? false),
      };

      queryClient.setQueryData(buildConfigKey({ userAddress }), updatedConfig);

      await actionQueueService.enqueue(
        'save-user-config',
        { config: updatedConfig },
        `config:${userAddress}`
      );
    } catch (error) {
      console.error('[useHideMutedSpaces] Error toggling preference:', error);
      throw error;
    }
  }, [userAddress, keyset, messageDB, queryClient, actionQueueService]);

  return {
    hideMutedSpaces,
    toggleHideMutedSpaces,
  };
}
