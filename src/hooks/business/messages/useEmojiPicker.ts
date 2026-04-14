import { useState, useCallback, useMemo } from 'react';
import type { Emoji } from '@quilibrium/quorum-shared';
import type { CustomEmoji } from '../../../components/emoji-picker/types';

interface UseEmojiPickerOptions {
  customEmoji?: Emoji[];
  onEmojiClick: (emoji: string) => void;
  onSetEmojiPickerOpen: (messageId: string | undefined) => void;
  onSetEmojiPickerPosition: (pos: { x: number; y: number } | null) => void;
}

export function useEmojiPicker(options: UseEmojiPickerOptions) {
  const {
    customEmoji,
    onEmojiClick,
    onSetEmojiPickerOpen,
    onSetEmojiPickerPosition,
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

  // Open desktop emoji picker with fixed position calculation from DOMRect
  const openDesktopEmojiPicker = useCallback(
    (messageId: string, rect: DOMRect) => {
      onSetEmojiPickerOpen(messageId);
      // These match .emoji-picker max dimensions in EmojiPicker.scss (clamp values)
      // Update here if the SCSS clamp values change
      const pickerHeight = 480;
      const pickerWidth = 380;
      const spaceBelow = window.innerHeight - rect.bottom;
      const y = spaceBelow < pickerHeight + 16
        ? Math.max(8, rect.top - pickerHeight - 4) // flip upward, clamp to viewport top
        : rect.bottom + 4;                          // open downward
      const x = Math.max(8, Math.min(rect.left, window.innerWidth - pickerWidth - 8));
      onSetEmojiPickerPosition({ x, y });
    },
    [onSetEmojiPickerOpen, onSetEmojiPickerPosition]
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

  // Handle user profile click
  const handleUserProfileClick = useCallback(
    (_clientY: number, onProfileClick: () => void) => {
      onProfileClick();
    },
    []
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
