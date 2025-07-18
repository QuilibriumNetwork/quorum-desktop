import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { t } from '@lingui/core/macro';
import EmojiPicker, {
  SkinTonePickerLocation,
  SuggestionMode,
  Theme,
} from 'emoji-picker-react';
import { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
import './EmojiPickerDrawer.scss';

export interface EmojiPickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiClick: (emoji: string) => void;
  customEmojis: CustomEmoji[];
}

/**
 * Mobile emoji picker drawer component.
 * Provides a full-screen emoji picker in a drawer format for mobile devices.
 */
const EmojiPickerDrawer: React.FC<EmojiPickerDrawerProps> = ({
  isOpen,
  onClose,
  onEmojiClick,
  customEmojis,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  // Handle visibility changes with animation
  React.useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      // Wait for animation to complete before hiding
      setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 300); // Match CSS animation duration
    }
  }, [isOpen, shouldRender]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleEmojiClick = (emojiData: any) => {
    onEmojiClick(emojiData.emoji);
    handleClose();
  };

  if (!shouldRender) return null;

  return (
    <div
      className={`emoji-picker-drawer ${isOpen && !isClosing ? 'emoji-picker-drawer--open' : ''} ${isClosing ? 'emoji-picker-drawer--closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t`Emoji picker`}
    >
      {/* Header with close button only */}
      <div className="emoji-picker-drawer__header">
        <button
          className="emoji-picker-drawer__close"
          onClick={handleClose}
          aria-label={t`Close`}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>

      {/* Emoji picker */}
      <div className="emoji-picker-drawer__content">
        <EmojiPicker
          width="100%"
          height={400}
          suggestedEmojisMode={SuggestionMode.FREQUENT}
          customEmojis={customEmojis}
          getEmojiUrl={(unified, style) => {
            return '/apple/64/' + unified + '.png';
          }}
          skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
          theme={Theme.DARK}
          onEmojiClick={handleEmojiClick}
        />
      </div>
    </div>
  );
};

export default EmojiPickerDrawer;