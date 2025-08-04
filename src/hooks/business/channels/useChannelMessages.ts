import { useMemo, useCallback } from 'react';
import { useMessages } from '../../queries/messages/useMessages';
import { useSpaceOwner } from '../../queries/spaceOwner/useSpaceOwner';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Message as MessageType } from '../../../api/quorumApi';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../../utils';

interface UseChannelMessagesProps {
  spaceId: string;
  channelId: string;
  roles: Array<{ permissions: string[]; members: string[] }>;
  members: {
    [address: string]: {
      address: string;
      userIcon?: string;
      displayName?: string;
    };
  };
}

export function useChannelMessages({
  spaceId,
  channelId,
  roles,
  members,
}: UseChannelMessagesProps) {
  const user = usePasskeysContext();
  const { data: messages, fetchPreviousPage } = useMessages({
    spaceId,
    channelId,
  });
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });

  const messageList = useMemo(() => {
    return messages.pages.flatMap(
      (p) => (p as { messages: MessageType[] }).messages as MessageType[]
    );
  }, [messages]);

  const canDeleteMessages = useCallback(
    (message: MessageType) => {
      return !!roles.find(
        (r) =>
          r.permissions.includes('message:delete') &&
          r.members.includes(user.currentPasskeyInfo!.address)
      );
    },
    [roles, user.currentPasskeyInfo]
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
    mapSenderToUser,
    isSpaceOwner,
  };
}
