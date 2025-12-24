import { useCallback } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useQueryClient } from '@tanstack/react-query';
import { useConfig, buildConfigKey } from '../../queries';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { NavItem, UserConfig } from '../../../db/messages';
import { deriveSpaceIds } from '../../../utils/folderUtils';

/**
 * Hook for deleting a folder and "spilling out" its spaces to standalone.
 * Performs optimistic React Query cache update for instant UI feedback.
 */
export const useDeleteFolder = () => {
  const user = usePasskeysContext();
  const queryClient = useQueryClient();
  const { data: config } = useConfig({
    userAddress: user.currentPasskeyInfo?.address || '',
  });
  const { actionQueueService, keyset } = useMessageDB();

  const deleteFolder = useCallback(
    async (folderId: string) => {
      if (!config || !keyset) return;

      const folderIndex = (config.items || []).findIndex(
        (i) => i.type === 'folder' && i.id === folderId
      );
      if (folderIndex === -1) return;

      const folder = config.items![folderIndex];
      if (folder.type !== 'folder') return;

      // "Spill out" spaces from folder to standalone
      const spilledSpaces: NavItem[] = folder.spaceIds.map((id) => ({
        type: 'space' as const,
        id,
      }));

      const newItems: NavItem[] = [
        ...(config.items || []).slice(0, folderIndex),
        ...spilledSpaces,
        ...(config.items || []).slice(folderIndex + 1),
      ];

      const newConfig: UserConfig = {
        ...config,
        items: newItems,
        spaceIds: deriveSpaceIds(newItems),
      };

      // Optimistically update React Query cache for instant UI feedback
      if (config.address) {
        queryClient.setQueryData(
          buildConfigKey({ userAddress: config.address }),
          newConfig
        );
      }

      // Queue config save in background - no more UI blocking!
      await actionQueueService.enqueue(
        'save-user-config',
        { config: newConfig },
        `config:${config.address}` // Dedup key
      );
    },
    [config, queryClient, actionQueueService]
  );

  return { deleteFolder };
};
