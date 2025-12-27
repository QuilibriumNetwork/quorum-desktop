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
  // NOTE: Space owners must explicitly join a manager role to manage read-only channels.
  // This is intentional - the receiving side cannot verify space ownership (privacy requirement).
  const canManageReadOnlyChannel = useCallback(
    (userAddress: string): boolean => {
      if (!channel?.isReadOnly) {
        return true;
      }

      // If no manager roles defined, nobody can manage
      if (!channel.managerRoleIds || channel.managerRoleIds.length === 0) {
        return false;
      }

      // Check if user has any of the manager roles (space owners must also be in a manager role)
      return roles.some(
        (role) =>
          channel.managerRoleIds?.includes(role.roleId) &&
          role.members.includes(userAddress)
      );
    },
    [channel, roles]
  );

  const messageList = useMemo(() => {
    const allMessages = messages.pages.flatMap(
      (p) => (p as { messages: MessageType[] }).messages as MessageType[]
    );
    // Deduplicate by messageId to prevent React key warnings
    // This can happen when the same message is added from multiple sources
    // (e.g., kick message created in SpaceService and MessageService rekey handler)
    const seen = new Set<string>();
    return allMessages.filter((msg) => {
      if (seen.has(msg.messageId)) return false;
      seen.add(msg.messageId);
      return true;
    });
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
    (_message: MessageType) => {
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

      // IMPORTANT: NO isSpaceOwner bypass - space owners must have explicit message:pin role
      // This matches usePinnedMessages.ts and receiving-side validation in MessageService.ts
      return hasPermission(userAddress, 'message:pin', space ?? undefined, false);
    },
    [roles, user.currentPasskeyInfo, channel, space]
  );

  const mapSenderToUser = useCallback(
    (senderId: string) => {
      const member = members[senderId];
      if (member) {
        return {
          ...member,
          displayName: member.displayName || senderId.slice(-6),
        };
      }
      return {
        displayName: senderId?.slice(-6) || t`Unknown User`,
        userIcon: DefaultImages.UNKNOWN_USER,
      };
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
