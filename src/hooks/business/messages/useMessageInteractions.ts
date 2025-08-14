import { useState, useCallback, useEffect } from 'react';
import { Message as MessageType } from '../../../api/quorumApi';
import { useResponsiveLayout } from '../../useResponsiveLayout';
import { useLongPress } from '../../useLongPress';
import { isTouchDevice as detectTouchDevice } from '../../../utils/platform';

interface UseMessageInteractionsOptions {
  message: MessageType;
  hoverTarget: string | undefined;
  setHoverTarget: React.Dispatch<React.SetStateAction<string | undefined>>;
  setShowUserProfile: React.Dispatch<React.SetStateAction<boolean>>;
  onCloseEmojiPickers: () => void;
  onMobileActionsDrawer: (config: any) => void;
  onEmojiPickerUserProfileClick: (
    clientY: number,
    onProfileClick: () => void
  ) => void;
}

export function useMessageInteractions(options: UseMessageInteractionsOptions) {
  const {
    message,
    hoverTarget,
    setHoverTarget,
    setShowUserProfile,
    onCloseEmojiPickers,
    onMobileActionsDrawer,
    onEmojiPickerUserProfileClick,
  } = options;

  // Responsive layout and device detection
  const { isMobile } = useResponsiveLayout();
  const isTouchDevice = detectTouchDevice();
  const useMobileDrawer = isMobile;
  const useDesktopTap = !isMobile && isTouchDevice;
  const useDesktopHover = !isMobile && !isTouchDevice;

  // State for desktop tap interaction
  const [actionsVisibleOnTap, setActionsVisibleOnTap] = useState(false);

  // Effect to handle hiding tablet actions when clicking elsewhere
  useEffect(() => {
    if (
      useDesktopTap &&
      actionsVisibleOnTap &&
      hoverTarget === message.messageId
    ) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element;
        if (!target.closest(`#msg-${message.messageId}`)) {
          setHoverTarget(undefined);
          setActionsVisibleOnTap(false);
        }
      };

      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [
    useDesktopTap,
    actionsVisibleOnTap,
    hoverTarget,
    message.messageId,
    setHoverTarget,
  ]);

  // Long-press handler for mobile and tablets
  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (useMobileDrawer) {
        // Mobile: Open drawer
        onMobileActionsDrawer({
          message,
        });
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate(50);
          } catch (e) {
            // Silently ignore vibration blocked by browser
          }
        }
      } else if (useDesktopTap) {
        // Tablet: Show inline actions and hide others
        setHoverTarget(message.messageId);
        setActionsVisibleOnTap(true);
      }
    },
    delay: 500,
  });

  // Handle mouse over for desktop hover
  const handleMouseOver = useCallback(() => {
    if (useDesktopHover) {
      setHoverTarget(message.messageId);
    }
  }, [useDesktopHover, setHoverTarget, message.messageId]);

  // Handle mouse out for desktop hover
  const handleMouseOut = useCallback(() => {
    if (useDesktopHover) {
      setHoverTarget(undefined);
    }
  }, [useDesktopHover, setHoverTarget]);

  // Handle main message click
  const handleMessageClick = useCallback(
    (e: React.MouseEvent) => {
      // Prevent default click behavior for mobile drawer
      if (useMobileDrawer) {
        e.preventDefault();
      }

      // For tablets, regular click should hide actions (not show them)
      if (useDesktopTap) {
        // Hide actions if clicking on a different message or same message
        if (hoverTarget !== message.messageId) {
          setHoverTarget(undefined);
          setActionsVisibleOnTap(false);
        }
      }

      // Common click behaviors
      setShowUserProfile(false);
      onCloseEmojiPickers();
    },
    [
      useMobileDrawer,
      useDesktopTap,
      hoverTarget,
      message.messageId,
      setHoverTarget,
      setActionsVisibleOnTap,
      setShowUserProfile,
      onCloseEmojiPickers,
    ]
  );

  // Handle user profile icon click
  const handleUserProfileClick = useCallback(
    (e: React.MouseEvent) => {
      onEmojiPickerUserProfileClick(e.clientY, () => setShowUserProfile(true));
      e.stopPropagation();
    },
    [onEmojiPickerUserProfileClick, setShowUserProfile]
  );

  // Handle background click to close user profile
  const handleUserProfileBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      setShowUserProfile(false);
    },
    [setShowUserProfile]
  );

  // Check if actions should be visible
  const shouldShowActions =
    (hoverTarget === message.messageId && useDesktopHover) ||
    (hoverTarget === message.messageId && actionsVisibleOnTap && useDesktopTap);

  // Get touch handlers for mobile/tablet
  const touchHandlers =
    useMobileDrawer || useDesktopTap ? longPressHandlers : {};

  return {
    // State
    actionsVisibleOnTap,
    shouldShowActions,

    // Device detection
    isTouchDevice,
    useMobileDrawer,
    useDesktopTap,
    useDesktopHover,

    // Event handlers
    handleMouseOver,
    handleMouseOut,
    handleMessageClick,
    handleUserProfileClick,
    handleUserProfileBackgroundClick,
    touchHandlers,
  };
}
