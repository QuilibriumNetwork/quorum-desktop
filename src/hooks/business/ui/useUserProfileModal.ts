import { useState, useCallback } from 'react';
import { calculateModalPosition, ModalPosition } from '../../../utils/modalPositioning';
import { MODAL_DIMENSIONS } from '../../../constants/ui';

export interface UserProfileModalUser {
  address: string;
  displayName?: string;
  userIcon?: string;
  bio?: string;
}

export interface UserProfileModalContext {
  type: 'mention' | 'message-avatar' | 'sidebar';
  element?: HTMLElement;
}

export interface UseUserProfileModalOptions {
  showUsers?: boolean; // For right sidebar width calculation
}

export interface UseUserProfileModalReturn {
  // State
  isOpen: boolean;
  selectedUser: UserProfileModalUser | null;
  modalPosition: ModalPosition | null;

  // Actions
  handleUserClick: (
    user: UserProfileModalUser,
    event: React.MouseEvent,
    context?: UserProfileModalContext
  ) => void;
  handleClose: () => void;
}

/**
 * Custom hook for managing user profile modal state and positioning
 * Extracts modal logic from components for better separation of concerns
 */
export const useUserProfileModal = (
  options: UseUserProfileModalOptions = {}
): UseUserProfileModalReturn => {
  const { showUsers = false } = options;

  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfileModalUser | null>(null);
  const [modalPosition, setModalPosition] = useState<ModalPosition | null>(null);

  // Handle user profile click with smart positioning
  const handleUserClick = useCallback((
    user: UserProfileModalUser,
    event: React.MouseEvent,
    context?: UserProfileModalContext
  ) => {
    event.stopPropagation(); // Prevent background click from closing modal

    // Determine positioning based on context
    const contextType = context?.type || 'sidebar';

    if ((contextType === 'mention' || contextType === 'message-avatar') && context?.element) {
      // For mentions and message avatars, calculate relative position
      const elementRect = context.element.getBoundingClientRect();
      const rightSidebarWidth = showUsers ? MODAL_DIMENSIONS.RIGHT_SIDEBAR_WIDTH : 0;

      const position = calculateModalPosition({
        elementRect,
        rightSidebarWidth,
        context: { type: contextType }
      });

      setModalPosition(position);
    } else if (event.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
      // For sidebar clicks, calculate fixed right-side positioning with vertical boundary check.
      // Guard currentTarget: some callers (e.g. the member-list TouchAwareListItem, which
      // opens the profile in a drawer) pass a synthetic event with no DOM node, and React
      // also nulls currentTarget once a synthetic event is handled asynchronously. In those
      // cases skip positioning — the drawer / CSS handles layout.
      const elementRect = event.currentTarget.getBoundingClientRect();

      const position = calculateModalPosition({
        elementRect,
        context: { type: 'sidebar' }
      });

      setModalPosition({ top: position.top }); // Only set top for sidebar (left is handled by CSS)
    } else {
      // No positionable element — open without a computed position.
      setModalPosition(null);
    }

    setSelectedUser(user);
    setIsOpen(true);
  }, [showUsers]);

  // Handle modal close
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSelectedUser(null);
    setModalPosition(null);
  }, []);

  return {
    // State
    isOpen,
    selectedUser,
    modalPosition,

    // Actions
    handleUserClick,
    handleClose,
  };
};