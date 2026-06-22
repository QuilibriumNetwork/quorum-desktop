import { useState, useCallback } from 'react';

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

export interface UseUserProfileModalReturn {
  // State
  isOpen: boolean;
  selectedUser: UserProfileModalUser | null;
  /** The trigger element the profile card anchors to (for FloatingPopover). */
  anchorElement: HTMLElement | null;
  /**
   * How the card was opened — drives placement and scroll behaviour:
   * 'message-avatar'/'mention' live in the virtualized message list (close on
   * scroll, open to the right); 'sidebar' opens left over the chat.
   */
  anchorContext: UserProfileModalContext['type'];

  // Actions
  handleUserClick: (
    user: UserProfileModalUser,
    event: React.MouseEvent,
    context?: UserProfileModalContext
  ) => void;
  handleClose: () => void;
}

/**
 * Custom hook for managing user profile modal state.
 *
 * Positioning is delegated to <FloatingPopover> (@floating-ui/react): this
 * hook only tracks which user is open and which DOM element to anchor the
 * card to. The previous hand-rolled top/left computation (modalPositioning.ts)
 * and the per-context discriminator have been removed — flip/shift middleware
 * handles edge cases generically.
 */
export const useUserProfileModal = (): UseUserProfileModalReturn => {
  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfileModalUser | null>(null);
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const [anchorContext, setAnchorContext] =
    useState<UserProfileModalContext['type']>('sidebar');

  // Handle user profile click — capture the trigger element to anchor to.
  const handleUserClick = useCallback((
    user: UserProfileModalUser,
    event: React.MouseEvent,
    context?: UserProfileModalContext
  ) => {
    event.stopPropagation(); // Prevent background click from closing modal

    // Prefer an explicitly provided element (mention/message-avatar pass the
    // resolved node), otherwise fall back to the click target. Guard
    // currentTarget: some callers pass a synthetic event with no DOM node, or
    // React nulls currentTarget once a synthetic event is handled async.
    const anchor =
      context?.element ??
      (event.currentTarget instanceof HTMLElement ? event.currentTarget : null);

    setAnchorElement(anchor);
    setAnchorContext(context?.type ?? 'sidebar');
    setSelectedUser(user);
    setIsOpen(true);
  }, []);

  // Handle modal close
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSelectedUser(null);
    setAnchorElement(null);
  }, []);

  return {
    // State
    isOpen,
    selectedUser,
    anchorElement,
    anchorContext,

    // Actions
    handleUserClick,
    handleClose,
  };
};
