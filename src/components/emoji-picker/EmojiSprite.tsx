// src/components/emoji-picker/EmojiSprite.tsx
import React, { memo } from 'react';
import { SPRITE_SHEET } from './types';

interface EmojiSpriteProps {
  sheetX: number;
  sheetY: number;
  /** Display size in px. Defaults to SPRITE_SHEET.displaySize (28) */
  size?: number;
  label?: string;
}

/** Renders a single emoji from the sprite sheet using CSS background-position */
const EmojiSprite: React.FC<EmojiSpriteProps> = memo(({ sheetX, sheetY, size, label }) => {
  const displaySize = size ?? SPRITE_SHEET.displaySize;
  const scale = displaySize / SPRITE_SHEET.cellSize;
  const bgSize = Math.round((SPRITE_SHEET.cols * SPRITE_SHEET.stride + SPRITE_SHEET.padding) * scale);
  const posX = (sheetX * SPRITE_SHEET.stride + SPRITE_SHEET.padding) * scale;
  const posY = (sheetY * SPRITE_SHEET.stride + SPRITE_SHEET.padding) * scale;

  return (
    <div
      role="img"
      aria-label={label}
      style={{
        width: displaySize,
        height: displaySize,
        backgroundImage: `url(${SPRITE_SHEET.url})`,
        backgroundSize: `${bgSize}px ${bgSize}px`,
        backgroundPosition: `-${posX}px -${posY}px`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
});

EmojiSprite.displayName = 'EmojiSprite';
export default EmojiSprite;
