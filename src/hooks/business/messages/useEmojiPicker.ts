import { useState, useCallback, useMemo } from 'react';
import type { Emoji } from '@quilibrium/quorum-shared';
import type { CustomEmoji } from '../../../components/emoji-picker/types';

/**
 * The "more reactions" trigger rect the desktop emoji picker anchors to.
 * Stored verbatim (not a pre-computed popover position): FloatingPopover does
 * the flip-up / viewport clamp the hook used to compute by hand.
 */
export interface EmojiPickerAnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseEmojiPickerOptions {
  customEmoji?: Emoji[];
  onEmojiClick: (emoji: string) => void;
  onSetEmojiPickerOpen: (messageId: string | undefined) => void;
  onSetEmojiPickerPosition: (rect: EmojiPickerAnchorRect | null) => void;
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

  // Open desktop emoji picker, anchored to the "more reactions" trigger rect.
  // FloatingPopover handles flip-up + viewport clamp (previously hand-rolled
  // here against magic pickerHeight/pickerWidth constants).
  const openDesktopEmojiPicker = useCallback(
    (messageId: string, rect: DOMRect) => {
      onSetEmojiPickerOpen(messageId);
      onSetEmojiPickerPosition({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
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
