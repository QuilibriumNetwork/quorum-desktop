import { useMemo, useCallback } from 'react';
import { useMessages } from '../../queries/messages/useMessages';
import { useSpaceOwner } from '../../queries/spaceOwner/useSpaceOwner';
import { useSpace } from '../../queries/space/useSpace';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Message as MessageType, Channel, Role } from '../../../api/quorumApi';
import { hasPermission } from '../../../utils/permissions';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../../utils';

interface UseChannelMessagesProps {
  spaceId: string;
  channelId: string;
  roles: Role[];
  members: {
    [address: string]: {
      address: string;
      userIcon?: string;
      displayName?: string;
    };
  };
  channel?: Channel;
}

export function useChannelMessages({
  spaceId,
  channelId,
  roles,
  members,
  channel,
}: UseChannelMessagesProps) {
  const user = usePasskeysContext();
  const { data: messages, fetchPreviousPage, fetchNextPage, hasNextPage } = useMessages({
    spaceId,
    channelId,
  });
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });
  const { data: space } = useSpace({ spaceId });

  // Helper function to check if user can manage read-only channel
  const canManageReadOnlyChannel = useCallback(
    (userAddress: string): boolean => {
      if (!channel?.isReadOnly) {
        return true;
      }

      // Space owners can always manage
      if (isSpaceOwner) {
        return true;
      }

      // If no manager roles defined, only space owner can manage
      if (!channel.managerRoleIds || channel.managerRoleIds.length === 0) {
        return false;
      }

      // Check if user has any of the manager roles
      return roles.some(
        (role) =>
          channel.managerRoleIds?.includes(role.roleId) &&
          role.members.includes(userAddress)
      );
    },
    [channel, isSpaceOwner, roles]
  );

  const messageList = useMemo(() => {
    return messages.pages.flatMap(
      (p) => (p as { messages: MessageType[] }).messages as MessageType[]
    );
  }, [messages]);

  const canDeleteMessages = useCallback(
    (message: MessageType) => {
      const userAddress = user.currentPasskeyInfo?.address;
      if (!userAddress) return false;

      // Users can always delete their own messages
      if (message.content.senderId === userAddress) {
        return true;
      }

      // For read-only channels: check if user is a manager (before checking regular permissions)
      if (channel?.isReadOnly) {
        const isManager = !!(
          channel.managerRoleIds &&
          roles.some(
            (role) =>
              channel.managerRoleIds?.includes(role.roleId) &&
              role.members.includes(userAddress)
          )
        );
        if (isManager) {
          return true;
        }
      }

      // Check if user has delete permission through a role
      // Note: We explicitly check roles instead of using hasPermission() because
      // hasPermission() always returns true for space owners, which would show
      // the delete button even when it won't work (backend doesn't support it yet)
      const hasDeleteRole = space?.roles?.some(
        (role: Role) =>
          role.members.includes(userAddress) &&
          role.permissions.includes('message:delete')
      );

      return !!hasDeleteRole;
    },
    [roles, user.currentPasskeyInfo, channel, space]
  );

  const canPinMessages = useCallback(
    (message: MessageType) => {
      const userAddress = user.currentPasskeyInfo?.address;
      if (!userAddress) return false;

      // For read-only channels: check if user is a manager (before checking regular permissions)
      if (channel?.isReadOnly) {
        const isManager = !!(
          channel.managerRoleIds &&
          roles.some(
            (role) =>
              channel.managerRoleIds?.includes(role.roleId) &&
              role.members.includes(userAddress)
          )
        );
        if (isManager) {
          return true;
        }
      }

      // Use centralized permission utility (handles space owners + role permissions)
      // Note: Unlike delete, pin permissions work correctly for space owners
      return hasPermission(userAddress, 'message:pin', space, isSpaceOwner);
    },
    [roles, user.currentPasskeyInfo, isSpaceOwner, channel, space]
  );

  const mapSenderToUser = useCallback(
    (senderId: string) => {
      return (
        members[senderId] || {
          displayName: t`Unknown User`,
          userIcon: DefaultImages.UNKNOWN_USER,
        }
      );
    },
    [members]
  );

  return {
    messageList,
    fetchPreviousPage,
    fetchNextPage,
    hasNextPage,
    canDeleteMessages,
    canPinMessages,
    mapSenderToUser,
    isSpaceOwner,
    canManageReadOnlyChannel,
  };
}
