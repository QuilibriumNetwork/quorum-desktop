import { useCallback } from 'react';
import { useSpaceOwner } from '../../queries/spaceOwner';
import { useModalContext } from '../../../components/context/ModalProvider';

/**
 * Custom hook for space permission checking and permission-based actions
 * Handles owner vs member logic and appropriate modal opening
 */
export const useSpacePermissions = (spaceId: string) => {
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });
  // `openLeaveSpace` was destructured here and never called. Dropped rather than
  // wired up: leaving is offered through the Space context menu, which correctly
  // withholds it from owners, and an unused handle here reads like a second entry
  // point that exists. LeaveSpaceModal itself is currently unreachable — nothing in
  // the app calls openLeaveSpace — and is left alone for a separate cleanup.
  const { openSpaceEditor } = useModalContext();

  const handleSpaceContextAction = useCallback(() => {
    // Always open Space Settings - Account tab for members, all tabs for owners
    openSpaceEditor(spaceId);
  }, [openSpaceEditor, spaceId]);

  const getContextIcon = useCallback(() => {
    // Always show sliders icon for Space Settings
    return 'sliders';
  }, []);

  const getContextTooltip = useCallback(() => {
    // Generic tooltip for all users
    return 'Space Settings';
  }, []);

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
    getContextTooltip,
  };
};
