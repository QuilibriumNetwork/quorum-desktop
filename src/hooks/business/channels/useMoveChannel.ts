import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Space } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useSpace, buildSpaceKey } from '../../queries';

export interface MoveChannelParams {
  spaceId: string;
  channelId: string;
  fromGroupIndex: number;
  toGroupIndex: number;
  toPosition: number;
}

/**
 * Move a channel within or between groups, persist via Space manifest update
 * (encrypt + sign + broadcast + save). Mirrors mobile's API surface at
 * quorum-mobile/hooks/chat/useChannelManagement.ts:446-523.
 */
export function useMoveChannel(spaceId: string) {
  const queryClient = useQueryClient();
  const { updateSpace } = useMessageDB();
  const { data: space } = useSpace({ spaceId });

  return useMutation({
    mutationFn: async (params: MoveChannelParams): Promise<void> => {
      if (!space) throw new Error('Space not found');

      if (params.fromGroupIndex < 0 || params.fromGroupIndex >= space.groups.length) {
        throw new Error('Invalid source group index');
      }
      if (params.toGroupIndex < 0 || params.toGroupIndex >= space.groups.length) {
        throw new Error('Invalid target group index');
      }

      const fromGroup = space.groups[params.fromGroupIndex];
      const channel = fromGroup.channels.find((c) => c.channelId === params.channelId);
      if (!channel) throw new Error('Channel not found in source group');

      const updatedFromChannels = fromGroup.channels.filter(
        (c) => c.channelId !== params.channelId
      );

      const updatedGroups = space.groups.map((group, index) => {
        if (index === params.fromGroupIndex && index === params.toGroupIndex) {
          const channels = [...updatedFromChannels];
          const insertPosition = Math.min(params.toPosition, channels.length);
          channels.splice(insertPosition, 0, channel);
          return { ...group, channels };
        }
        if (index === params.fromGroupIndex) {
          return { ...group, channels: updatedFromChannels };
        }
        if (index === params.toGroupIndex) {
          const channels = [...group.channels];
          const insertPosition = Math.min(params.toPosition, channels.length);
          channels.splice(insertPosition, 0, channel);
          return { ...group, channels };
        }
        return group;
      });

      const updatedSpace: Space = {
        ...space,
        groups: updatedGroups,
        modifiedDate: Date.now(),
      };

      // Optimistic cache update so the UI reflects the new order
      // immediately (the dragged item doesn't snap back during
      // encrypt+sign+POST). updateSpace() invalidates on completion.
      queryClient.setQueryData(buildSpaceKey({ spaceId }), updatedSpace);

      try {
        await updateSpace(updatedSpace);
      } catch (err) {
        // Roll back the optimistic update on failure
        queryClient.setQueryData(buildSpaceKey({ spaceId }), space);
        throw err;
      }
    },
  });
}
