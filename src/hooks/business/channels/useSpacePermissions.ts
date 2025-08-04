import { useCallback } from 'react';
import { useSpaceOwner } from '../../queries/spaceOwner';
import { useModalContext } from '../../../components/context/ModalProvider';

/**
 * Custom hook for space permission checking and permission-based actions
 * Handles owner vs member logic and appropriate modal opening
 */
export const useSpacePermissions = (spaceId: string) => {
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });
  const { openSpaceEditor, openLeaveSpace } = useModalContext();

  const handleSpaceContextAction = useCallback(() => {
    if (isSpaceOwner) {
      openSpaceEditor(spaceId);
    } else {
      openLeaveSpace(spaceId);
    }
  }, [isSpaceOwner, openSpaceEditor, openLeaveSpace, spaceId]);

  const getContextIcon = useCallback(() => {
    return isSpaceOwner ? 'sliders' : 'door-open';
  }, [isSpaceOwner]);

  const canManageSpace = Boolean(isSpaceOwner);
  const canAddGroups = Boolean(isSpaceOwner);
  const canEditGroups = Boolean(isSpaceOwner);

  return {
    isSpaceOwner,
    canManageSpace,
    canAddGroups,
    canEditGroups,
    handleSpaceContextAction,
    getContextIcon,
  };
};
