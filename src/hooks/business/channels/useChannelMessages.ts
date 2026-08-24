import { useMemo, useCallback } from 'react';
import { useMessages } from '../../queries/messages/useMessages';
import { useSpaceOwner } from '../../queries/spaceOwner/useSpaceOwner';
import { useSpace } from '../../queries/space/useSpace';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { hasPermission } from '@quilibrium/quorum-shared';
import type { Message as MessageType, Channel, Role } from '@quilibrium/quorum-shared';
import { DefaultImages } from '../../../utils';
import { useBlockUser } from '../user/useBlockUser';

/**
 * Which messages a viewer actually sees in a channel.
 *
 * Extracted from the `useMemo` below so it can be tested without mounting a
 * hook. It carries three independent rules that had no test of any kind
 * (audited 2026-08-23), and the reason is worth stating: two of them are
 * viewer-side only, so no relay scenario can ever observe them however many
 * are added. The personal block in particular has no wire component at all —
 * nothing is broadcast, no permission is checked, no peer is told — so this
 * function and `blockUtils` in quorum-shared are the whole feature.
 *
 * Order matters and is deliberate. Dedup runs first and records `seen` only
 * for messages that SURVIVE, so a filtered-out duplicate does not consume the
 * slot its visible twin needs.
 */
export function selectVisibleMessages(
  allMessages: MessageType[],
  { threadsEnabled, blockedSet }: { threadsEnabled: boolean; blockedSet: Set<string> }
): MessageType[] {
  // Deduplicate by messageId and filter out thread replies (defense-in-depth)
  // Thread replies should be filtered at the DB layer, but this guards against
  // any code path that bypasses getMessages() (e.g., setQueryData with raw data)
  const seen = new Set<string>();
  return allMessages.filter((msg) => {
    if (seen.has(msg.messageId)) return false;
    if (msg.isThreadReply && threadsEnabled) return false;
    // Personal block: hide blocked senders' messages from this viewer's stream.
    // Optional-chain content to match every other consumer of this list (e.g.
    // Channel.tsx reads msg.content?.senderId off the same filtered array) and
    // guard against any raw/partial message that bypasses getMessages().
    if (msg.content?.senderId && blockedSet.has(msg.content.senderId)) return false;
    seen.add(msg.messageId);
    return true;
  });
}

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
  threadsEnabled?: boolean;
}

export function useChannelMessages({
  spaceId,
  channelId,
  roles,
  members,
  channel,
  threadsEnabled = false,
}: UseChannelMessagesProps) {
  const user = usePasskeysContext();
  const { data: messages, fetchPreviousPage, fetchNextPage, hasNextPage } = useMessages({
    spaceId,
    channelId,
    includeThreadReplies: !threadsEnabled,
  });
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });
  const { data: space } = useSpace({ spaceId });

  // Personal block (viewer-side hide): blocked senders' messages are filtered
  // from the rendered list for this space only, for this viewer only. This is a
  // local, reversible render filter — unblocking instantly restores past + new
  // messages. Distinct from the receive-time moderation mute in MessageService.
  const { blockedSet } = useBlockUser(spaceId);

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
    return selectVisibleMessages(allMessages, { threadsEnabled, blockedSet });
  }, [messages, threadsEnabled, blockedSet]);

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

  // Base sender lookup. Channel.tsx wraps this with a public-profile-enriched
  // map and only falls through to it for senders missing from the roster, so
  // the `member` branch is not currently reachable — it is written correctly
  // anyway so that a future direct consumer can't reintroduce the defect.
  //
  // A member is returned UNCHANGED, empty `displayName` included. Empty means
  // "no per-space override, follow the global identity"; substituting a
  // truncated address here reads as a deliberate per-space name, which
  // `resolveSpaceMemberName` ranks above the QNS `.q` name. The resolver owns
  // the fallback, so a caller must never supply one.
  const mapSenderToUser = useCallback(
    (senderId: string) => {
      const member = members[senderId];
      if (member) return member;
      // Not in the roster: address-only, so the resolver produces the
      // truncation itself and every surface truncates the same way.
      return {
        address: senderId,
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
