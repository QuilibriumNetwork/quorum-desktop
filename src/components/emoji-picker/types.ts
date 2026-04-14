// src/components/emoji-picker/types.ts

/** Custom emoji provided by a space (user-uploaded, not on sprite sheet) */
export interface CustomEmoji {
  id: string;
  names: string[];
  imgUrl: string;
}

/** Emoji data returned to consumers on click */
export interface EmojiData {
  /** Native unicode character (e.g. '😀') -- primary field used by all consumers */
  emoji: string;
  /** Unicode codepoint string (e.g. '1f600') */
  unified: string;
  /** Display names / aliases */
  names: string[];
  /** URL to individual PNG for message rendering */
  imageUrl: string;
  /** Whether this is a custom space emoji */
  isCustom: boolean;
}

/** A standard emoji from the sprite sheet */
export interface EmojiItem {
  unified: string;
  shortName: string;
  shortNames: string[];
  name: string;
  category: string;
  sortOrder: number;
  sheetX: number;
  sheetY: number;
  /** Search string: lowercased name + short_names joined */
  searchString: string;
  /** Whether this emoji supports skin tone variants */
  hasSkinVariations: boolean;
  /** Skin tone variants keyed by tone code (e.g. '1F3FB') */
  skinVariations?: Record<string, { sheetX: number; sheetY: number; unified: string }>;
}

/** Row types for the virtualized list */
export type VirtualRow =
  | { type: 'header'; category: string; label: string }
  | { type: 'emoji-row'; emojis: EmojiItem[] }
  | { type: 'custom-row'; emojis: CustomEmoji[] };

/** Emoji categories in display order */
export const EMOJI_CATEGORIES = [
  'Smileys & Emotion',
  'People & Body',
  'Animals & Nature',
  'Food & Drink',
  'Travel & Places',
  'Activities',
  'Objects',
  'Symbols',
  'Flags',
] as const;

export type EmojiCategory = (typeof EMOJI_CATEGORIES)[number];

/** Sprite sheet constants for sheets-clean/32.png */
export const SPRITE_SHEET = {
  url: '/twitter/sheets-clean/32.png',
  cellSize: 32,
  padding: 1,
  stride: 34,        // cellSize + 2 * padding
  cols: 62,
  rows: 62,
  displaySize: 28,
  /** Scale factor: displaySize / cellSize */
  scale: 28 / 32,    // 0.875
} as const;

/** Category icon emojis -- their sheet coordinates for rendering as EmojiSprite */
export const CATEGORY_ICONS: Record<string, { unified: string; sheetX: number; sheetY: number }> = {};
// Populated at runtime from emoji data on first buildEmojiIndex() call
