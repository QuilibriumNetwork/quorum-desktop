import { useMemo, useCallback } from 'react';
import { useMessages } from '../../queries/messages/useMessages';
import { useSpaceOwner } from '../../queries/spaceOwner/useSpaceOwner';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Message as MessageType, Channel, Role } from '../../../api/quorumApi';
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
  const { data: messages, fetchPreviousPage } = useMessages({
    spaceId,
    channelId,
  });
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });

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
      return roles.some(role => 
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
      
      console.log('🗑️ FIXED DELETE CHECK:', {
        messageId: message.messageId,
        userAddress,
        isSpaceOwner
      });
      
      // Space owners can always delete messages (inherent privilege)
      if (isSpaceOwner) {
        console.log('🗑️ FIXED: Space owner -> TRUE');
        return true;
      }
      
      // For read-only channels: check if user is a manager
      if (channel?.isReadOnly) {
        const isManager = !!(channel.managerRoleIds && 
          roles.some(role => 
            channel.managerRoleIds?.includes(role.roleId) && 
            role.members.includes(userAddress)
          )
        );
        console.log('🗑️ FIXED: Read-only channel, is manager?', isManager);
        return isManager;
      }
      
      // For regular channels: check traditional permissions
      const hasDeletePermission = !!roles.find(
        (r) =>
          r.permissions.includes('message:delete') &&
          r.members.includes(userAddress)
      );
      console.log('🗑️ FIXED: Regular channel, has delete permission?', hasDeletePermission);
      return hasDeletePermission;
    },
    [roles, user.currentPasskeyInfo, isSpaceOwner, channel]
  );

  const canPinMessages = useCallback(
    (message: MessageType) => {
      const userAddress = user.currentPasskeyInfo?.address;
      console.log('📌 PIN CHECK:', {
        messageId: message.messageId,
        userAddress,
        isSpaceOwner,
        channelIsReadOnly: channel?.isReadOnly,
        managerRoleIds: channel?.managerRoleIds,
        userRoles: roles.filter(r => r.members.includes(userAddress || '')).map(r => ({ roleId: r.roleId, permissions: r.permissions }))
      });
      
      if (!userAddress) return false;
      
      // Space owners can always pin messages
      if (isSpaceOwner) {
        console.log('📌 PIN: Space owner -> TRUE');
        return true;
      }
      
      // For read-only channels: check if user is a manager
      if (channel?.isReadOnly) {
        const isManager = !!(channel.managerRoleIds && 
          roles.some(role => 
            channel.managerRoleIds?.includes(role.roleId) && 
            role.members.includes(userAddress)
          )
        );
        console.log('📌 PIN: Read-only channel, is manager?', isManager);
        return isManager;
      }
      
      // For regular channels: check traditional permissions
      const hasPinPermission = !!roles.find(
        (r) =>
          r.permissions.includes('message:pin') &&
          r.members.includes(userAddress)
      );
      console.log('📌 PIN: Regular channel, has pin permission?', hasPinPermission);
      return hasPinPermission;
    },
    [roles, user.currentPasskeyInfo, isSpaceOwner, channel]
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
    canDeleteMessages,
    canPinMessages,
    mapSenderToUser,
    isSpaceOwner,
    canManageReadOnlyChannel,
  };
}
