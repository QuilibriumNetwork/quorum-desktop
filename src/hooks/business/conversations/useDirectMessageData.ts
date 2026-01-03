import { useMemo } from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useRegistration } from '../../queries/registration/useRegistration';
import { useConversation } from '../../queries/conversation/useConversation';
import { DefaultImages } from '../../../utils';
import { t } from '@lingui/core/macro';

export interface DirectMessageMember {
  displayName?: string;
  userIcon?: string;
  address: string;
}

export interface UseDirectMessageDataReturn {
  address: string;
  conversationId: string;
  members: { [address: string]: DirectMessageMember };
  otherUser: DirectMessageMember;
  currentUser: DirectMessageMember;
}

/**
 * Hook for managing DirectMessage conversation data including participants and metadata
 */
export function useDirectMessageData(): UseDirectMessageDataReturn {
  const { address } = useParams<{ address: string }>();
  const user = usePasskeysContext();
  const conversationId = address! + '/' + address!;

  // Get registration data for the other user
  const { data: registration } = useRegistration({ address: address! });

  // Get registration data for current user
  const { data: self } = useRegistration({
    address: user.currentPasskeyInfo!.address,
  });

  // Get conversation metadata
  const { data: conversation } = useConversation({
    conversationId: conversationId,
  });

  // Build members map
  const members = useMemo(() => {
    const m: { [address: string]: DirectMessageMember } = {};

    // Other user
    if (conversation?.conversation) {
      m[address!] = {
        displayName: conversation.conversation.displayName ?? t`Unknown User`,
        userIcon: conversation.conversation.icon ?? DefaultImages.UNKNOWN_USER,
        address: address!,
      };
    } else if (registration?.registration) {
      m[registration.registration.user_address] = {
        displayName: t`Unknown User`,
        userIcon: DefaultImages.UNKNOWN_USER,
        address: registration.registration.user_address,
      };
    }

    // Current user
    m[user.currentPasskeyInfo!.address] = {
      address: user.currentPasskeyInfo!.address,
      userIcon: user.currentPasskeyInfo!.pfpUrl,
      displayName: user.currentPasskeyInfo!.displayName,
    };

    return m;
  }, [registration, conversation, address, user.currentPasskeyInfo]);

  // Helper getters for easier access
  const otherUser = members[address!] || {
    displayName: t`Unknown User`,
    userIcon: DefaultImages.UNKNOWN_USER,
    address: address!,
  };

  const currentUser = members[user.currentPasskeyInfo!.address];

  return {
    address: address!,
    conversationId,
    members,
    otherUser,
    currentUser,
  };
}
