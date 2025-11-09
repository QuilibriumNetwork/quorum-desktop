import { useMemo } from 'react';
import { Space } from '../../../api/quorumApi';
import { useSpaces } from '../../../hooks';
import { t } from '@lingui/core/macro';

/**
 * Custom hook for managing invite UI state and logic
 * Handles button text, disabled states, and membership checking
 */
export const useInviteUI = (
  space: Space | undefined,
  joining: boolean,
  messageSenderId?: string,
  currentUserAddress?: string
) => {
  const { data: spaces } = useSpaces({});

  // Check if current user sent this invite
  const isSender = useMemo(() => {
    return messageSenderId && currentUserAddress && messageSenderId === currentUserAddress;
  }, [messageSenderId, currentUserAddress]);

  const isAlreadyMember = useMemo(() => {
    if (!space) return false;
    return spaces.some((s) => s.spaceId === space.spaceId);
  }, [spaces, space]);

  const buttonText = useMemo(() => {
    if (joining) return t`Joining...`;
    // Don't show "Joined" if the user is the sender - they obviously sent it from that space
    if (isAlreadyMember && !isSender) return t`Joined`;
    if (isSender) return t`Invite sent`;
    return t`Join`;
  }, [joining, isAlreadyMember, isSender]);

  const isButtonDisabled = useMemo(() => {
    // Always disable for senders (they can't join their own invite)
    if (isSender) return true;
    return joining || isAlreadyMember;
  }, [joining, isAlreadyMember, isSender]);

  return {
    isAlreadyMember,
    buttonText,
    isButtonDisabled,
  };
};
