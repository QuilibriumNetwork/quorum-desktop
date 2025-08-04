import { useMemo } from 'react';
import { useSpace } from '../../queries';
import { useSpaceOwner } from '../../queries/spaceOwner';

export function useChannelPermissions({
  spaceId,
  channelId,
}: {
  spaceId: string;
  channelId?: string;
}) {
  const { data: space } = useSpace({ spaceId });
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });

  const permissions = useMemo(() => {
    if (!space) {
      return {
        canCreateChannel: false,
        canEditChannel: false,
        canDeleteChannel: false,
        canManagePermissions: false,
        isSpaceOwner: false,
        isChannelAdmin: false,
      };
    }

    // For now, only space owners can manage channels
    // This can be expanded based on role permissions in the future
    const canManageChannels = isSpaceOwner || false;

    return {
      canCreateChannel: canManageChannels,
      canEditChannel: canManageChannels,
      canDeleteChannel: canManageChannels,
      canManagePermissions: isSpaceOwner || false,
      isSpaceOwner: isSpaceOwner || false,
      isChannelAdmin: canManageChannels,
    };
  }, [space, isSpaceOwner]);

  return permissions;
}
