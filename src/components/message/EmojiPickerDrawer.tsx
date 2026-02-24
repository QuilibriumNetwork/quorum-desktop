// This is for mobile users using the web app, for the native app we have /primitives/Modal/Modal.native.tsx and we need to add another emojipicker there (compatibel with react native)

import React, { useState } from 'react';
import { t } from '@lingui/core/macro';
import EmojiPicker, {
  SkinTonePickerLocation,
  SuggestionMode,
  Theme,
} from 'emoji-picker-react';
import { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
import { MobileDrawer } from '../ui';
import './EmojiPickerDrawer.scss';

interface DrawerSticker {
  id: string;
  name: string;
  imgUrl: string;
}

export interface EmojiPickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiClick: (emoji: string) => void;
  customEmojis: CustomEmoji[];
  /** When provided, the drawer shows an Emojis/Stickers tab bar */
  stickers?: DrawerSticker[];
  onStickerClick?: (stickerId: string) => void;
}

/**
 * Mobile emoji picker drawer component.
 * Provides a full-screen emoji picker in a drawer format for mobile devices.
 * When stickers are provided, shows Emojis / Stickers tabs.
 */
const EmojiPickerDrawer: React.FC<EmojiPickerDrawerProps> = ({
  isOpen,
  onClose,
  onEmojiClick,
  customEmojis,
  stickers,
  onStickerClick,
}) => {
  const hasStickers = stickers && stickers.length > 0 && onStickerClick;
  const [activeTab, setActiveTab] = useState<'emojis' | 'stickers'>('emojis');

  const handleEmojiClick = (emojiData: any) => {
    onEmojiClick(emojiData.emoji);
    onClose();
  };

  const handleStickerClick = (stickerId: string) => {
    onStickerClick?.(stickerId);
    onClose();
  };

  return (
    <MobileDrawer
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={t`Emoji picker`}
      showCloseButton={false}
    >
      {/* Tab bar — only when stickers are available */}
      {hasStickers && (
        <div className="emoji-picker-drawer__tabs">
          <button
            className={`emoji-picker-drawer__tab ${activeTab === 'emojis' ? 'active' : ''}`}
            onClick={() => setActiveTab('emojis')}
          >
            {t`Emojis`}
          </button>
          <button
            className={`emoji-picker-drawer__tab ${activeTab === 'stickers' ? 'active' : ''}`}
            onClick={() => setActiveTab('stickers')}
          >
            {t`Stickers`}
          </button>
        </div>
      )}

      {/* Emoji tab content */}
      {(!hasStickers || activeTab === 'emojis') && (
        <div className="emoji-picker-drawer__content">
          <EmojiPicker
            width="100%"
            height={hasStickers ? 540 : 600}
            suggestedEmojisMode={SuggestionMode.FREQUENT}
            customEmojis={customEmojis}
            getEmojiUrl={(unified) => '/twitter/64/' + unified + '.png'}
            skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
            theme={Theme.DARK}
            onEmojiClick={handleEmojiClick}
            lazyLoadEmojis={true}
          />
        </div>
      )}

      {/* Stickers tab content */}
      {hasStickers && activeTab === 'stickers' && (
        <div className="emoji-picker-drawer__stickers">
          {stickers!.map((s) => (
            <div
              key={'sticker-' + s.id}
              className="sticker-item"
              onClick={() => handleStickerClick(s.id)}
            >
              <img src={s.imgUrl} alt={s.name} />
            </div>
          ))}
        </div>
      )}
    </MobileDrawer>
  );
};

export default EmojiPickerDrawer;
