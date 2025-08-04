import { useMemo } from 'react';
import { Space } from '../../../api/quorumApi';
import { useSpaces } from '../../../hooks';
import { t } from '@lingui/core/macro';

/**
 * Custom hook for managing invite UI state and logic
 * Handles button text, disabled states, and membership checking
 */
export const useInviteUI = (space: Space | undefined, joining: boolean) => {
  const { data: spaces } = useSpaces({});

  const isAlreadyMember = useMemo(() => {
    if (!space) return false;
    return spaces.some((s) => s.spaceId === space.spaceId);
  }, [spaces, space]);

  const buttonText = useMemo(() => {
    if (joining) return t`Joining...`;
    if (isAlreadyMember) return t`Joined`;
    return t`Join`;
  }, [joining, isAlreadyMember]);

  const isButtonDisabled = useMemo(() => {
    return joining || isAlreadyMember;
  }, [joining, isAlreadyMember]);

  return {
    isAlreadyMember,
    buttonText,
    isButtonDisabled,
  };
};
