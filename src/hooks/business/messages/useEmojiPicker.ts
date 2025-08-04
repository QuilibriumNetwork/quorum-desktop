import { useState, useCallback, useMemo } from 'react';
import { Emoji } from '../../../api/quorumApi';
import { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';

interface UseEmojiPickerOptions {
  customEmoji?: Emoji[];
  height: number;
  onEmojiClick: (emoji: string) => void;
  onSetEmojiPickerOpen: (messageId: string | undefined) => void;
  onSetEmojiPickerDirection: (direction: string) => void;
}

export function useEmojiPicker(options: UseEmojiPickerOptions) {
  const {
    customEmoji,
    height,
    onEmojiClick,
    onSetEmojiPickerOpen,
    onSetEmojiPickerDirection,
  } = options;

  // State for mobile emoji drawer (separate from desktop picker)
  const [showMobileEmojiDrawer, setShowMobileEmojiDrawer] = useState(false);

  // Transform custom emoji data for emoji-picker-react
  const customEmojis = useMemo(() => {
    if (!customEmoji) return [];

    return customEmoji.map(
      (c) =>
        ({
          names: [c.name],
          id: c.id,
          imgUrl: c.imgUrl,
        }) as CustomEmoji
    );
  }, [customEmoji]);

  // Handle emoji selection for desktop picker
  const handleDesktopEmojiClick = useCallback(
    (emoji: string) => {
      onEmojiClick(emoji);
      onSetEmojiPickerOpen(undefined);
    },
    [onEmojiClick, onSetEmojiPickerOpen]
  );

  // Handle emoji selection for mobile drawer
  const handleMobileEmojiClick = useCallback(
    (emoji: string) => {
      onEmojiClick(emoji);
      setShowMobileEmojiDrawer(false);
    },
    [onEmojiClick]
  );

  // Open desktop emoji picker with direction calculation
  const openDesktopEmojiPicker = useCallback(
    (messageId: string, clientY: number) => {
      onSetEmojiPickerOpen(messageId);
      onSetEmojiPickerDirection(
        clientY / height > 0.5 ? 'upwards' : 'downwards'
      );
    },
    [height, onSetEmojiPickerOpen, onSetEmojiPickerDirection]
  );

  // Open mobile emoji drawer
  const openMobileEmojiDrawer = useCallback(() => {
    setShowMobileEmojiDrawer(true);
  }, []);

  // Close all emoji pickers
  const closeEmojiPickers = useCallback(() => {
    onSetEmojiPickerOpen(undefined);
    setShowMobileEmojiDrawer(false);
  }, [onSetEmojiPickerOpen]);

  // Close only mobile emoji drawer
  const closeMobileEmojiDrawer = useCallback(() => {
    setShowMobileEmojiDrawer(false);
  }, []);

  // Handle user profile click that also sets emoji picker direction
  const handleUserProfileClick = useCallback(
    (clientY: number, onProfileClick: () => void) => {
      onProfileClick();
      onSetEmojiPickerDirection(
        clientY / height > 0.5 ? 'upwards' : 'downwards'
      );
    },
    [height, onSetEmojiPickerDirection]
  );

  return {
    // State
    showMobileEmojiDrawer,
    customEmojis,

    // Actions
    handleDesktopEmojiClick,
    handleMobileEmojiClick,
    openDesktopEmojiPicker,
    openMobileEmojiDrawer,
    closeEmojiPickers,
    closeMobileEmojiDrawer,
    handleUserProfileClick,
  };
}
