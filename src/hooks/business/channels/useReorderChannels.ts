import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Space } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useSpace, buildSpaceKey } from '../../queries';

export interface ReorderChannelsParams {
  spaceId: string;
  groupIndex: number;
  channelOrder: string[];
}

/**
 * Reorder channels within a group via channel-ID permutation. Mirrors mobile's
 * API surface at quorum-mobile/hooks/chat/useChannelManagement.ts:578-636.
 */
export function useReorderChannels(spaceId: string) {
  const queryClient = useQueryClient();
  const { updateSpace } = useMessageDB();
  const { data: space } = useSpace({ spaceId });

  return useMutation({
    mutationFn: async (params: ReorderChannelsParams): Promise<void> => {
      if (!space) throw new Error('Space not found');

      if (params.groupIndex < 0 || params.groupIndex >= space.groups.length) {
        throw new Error('Invalid group index');
      }

      const group = space.groups[params.groupIndex];
      const channelMap = new Map(group.channels.map((c) => [c.channelId, c]));

      if (params.channelOrder.length !== group.channels.length) {
        throw new Error('Channel order length mismatch');
      }
      for (const channelId of params.channelOrder) {
        if (!channelMap.has(channelId)) {
          throw new Error('Invalid channel ID in order');
        }
      }

      const reorderedChannels = params.channelOrder.map((id) => channelMap.get(id)!);

      const updatedGroups = space.groups.map((g, index) =>
        index === params.groupIndex ? { ...g, channels: reorderedChannels } : g
      );

      const updatedSpace: Space = {
        ...space,
        groups: updatedGroups,
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
