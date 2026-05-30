import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Space } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useSpace, buildSpaceKey } from '../../queries';

export interface ReorderGroupsParams {
  spaceId: string;
  groupOrder: number[];
}

/**
 * Reorder groups via index permutation. Mirrors mobile's API surface at
 * quorum-mobile/hooks/chat/useChannelManagement.ts:525-576.
 */
export function useReorderGroups(spaceId: string) {
  const queryClient = useQueryClient();
  const { updateSpace } = useMessageDB();
  const { data: space } = useSpace({ spaceId });

  return useMutation({
    mutationFn: async (params: ReorderGroupsParams): Promise<void> => {
      if (!space) throw new Error('Space not found');

      if (params.groupOrder.length !== space.groups.length) {
        throw new Error('Group order length mismatch');
      }

      const indices = new Set(params.groupOrder);
      if (indices.size !== params.groupOrder.length) {
        throw new Error('Duplicate group indices');
      }
      for (const index of params.groupOrder) {
        if (index < 0 || index >= space.groups.length) {
          throw new Error('Invalid group index in order');
        }
      }

      const reorderedGroups = params.groupOrder.map((index) => space.groups[index]);

      const updatedSpace: Space = {
        ...space,
        groups: reorderedGroups,
        modifiedDate: Date.now(),
      };

      queryClient.setQueryData(buildSpaceKey({ spaceId }), updatedSpace);

      try {
        await updateSpace(updatedSpace);
      } catch (err) {
        queryClient.setQueryData(buildSpaceKey({ spaceId }), space);
        throw err;
      }
    },
  });
}
