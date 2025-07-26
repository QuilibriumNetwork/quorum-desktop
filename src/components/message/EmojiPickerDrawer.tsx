import React from 'react';
import { t } from '@lingui/core/macro';
import EmojiPicker, {
  SkinTonePickerLocation,
  SuggestionMode,
  Theme,
} from 'emoji-picker-react';
import { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
import MobileDrawer from '../MobileDrawer';
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
  const handleEmojiClick = (emojiData: any) => {
    onEmojiClick(emojiData.emoji);
    onClose();
  };

  return (
    <MobileDrawer
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={t`Emoji picker`}
      showCloseButton={false}
    >
      <div className="emoji-picker-drawer__content">
        <EmojiPicker
          width="100%"
          height={600}
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
    </MobileDrawer>
  );
};

export default EmojiPickerDrawer;
