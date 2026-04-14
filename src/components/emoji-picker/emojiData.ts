// src/components/emoji-picker/emojiData.ts
import emojiDataRaw from 'emoji-datasource-twitter/emoji.json';
import type { EmojiItem, VirtualRow, CustomEmoji } from './types';
import { EMOJI_CATEGORIES, CATEGORY_ICONS, SPRITE_SHEET } from './types';

/** Raw entry shape from emoji-datasource-twitter */
interface RawEmoji {
  unified: string;
  short_name: string;
  short_names: string[];
  name: string;
  category: string;
  sort_order: number;
  sheet_x: number;
  sheet_y: number;
  has_img_twitter: boolean;
  skin_variations?: Record<string, {
    unified: string;
    sheet_x: number;
    sheet_y: number;
    has_img_twitter: boolean;
  }>;
}

// Representative emoji unified codes for each category tab icon
const CATEGORY_ICON_CODES: Record<string, string> = {
  'Smileys & Emotion': '1F600',
  'People & Body': '1F44B',
  'Animals & Nature': '1F43B',
  'Food & Drink': '1F354',
  'Travel & Places': '2708-FE0F',
  'Activities': '26BD',
  'Objects': '1F4A1',
  'Symbols': '1F49B',
  'Flags': '1F3C1',
};

let cachedEmojis: EmojiItem[] | null = null;

/** Convert unified codepoint string to native emoji character */
export function unifiedToEmoji(unified: string): string {
  return unified
    .split('-')
    .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
    .join('');
}

/** Get the individual image URL for a unified codepoint */
export function getEmojiImageUrl(unified: string): string {
  return `/twitter/64/${unified.toLowerCase()}.png`;
}

/** Parse and index all emojis. Called once on first picker open. */
function buildEmojiIndex(): EmojiItem[] {
  if (cachedEmojis) return cachedEmojis;

  const raw = emojiDataRaw as RawEmoji[];

  cachedEmojis = raw
    .filter((e) => e.has_img_twitter && e.category !== 'Component')
    .map((e): EmojiItem => {
      const filtered = e.skin_variations
        ? Object.fromEntries(
            Object.entries(e.skin_variations)
              .filter(([key, v]) => v.has_img_twitter && !key.includes('-'))
              .map(([key, v]) => [key, { sheetX: v.sheet_x, sheetY: v.sheet_y, unified: v.unified }])
          )
        : null;
      const skinVariations = filtered && Object.keys(filtered).length > 0 ? filtered : undefined;

      return {
        unified: e.unified,
        shortName: e.short_name,
        shortNames: e.short_names,
        name: e.name,
        category: e.category,
        sortOrder: e.sort_order,
        sheetX: e.sheet_x,
        sheetY: e.sheet_y,
        searchString: [e.name, ...e.short_names].join(' ').toLowerCase(),
        hasSkinVariations: !!skinVariations && Object.keys(skinVariations).length > 0,
        skinVariations,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Populate category icons from the data
  for (const [cat, code] of Object.entries(CATEGORY_ICON_CODES)) {
    const emoji = cachedEmojis.find((e) => e.unified === code);
    if (emoji) {
      CATEGORY_ICONS[cat] = { unified: emoji.unified, sheetX: emoji.sheetX, sheetY: emoji.sheetY };
    }
  }

  return cachedEmojis;
}

/**
 * Build virtualized row data from emojis.
 * Each row is either a category header or a row of N emojis.
 */
export function buildRowData(
  columnsCount: number,
  frequentUnifieds: string[],
  customEmojis: CustomEmoji[],
): { rows: VirtualRow[]; categoryRowIndices: Map<string, number> } {
  const cols = Math.max(1, columnsCount);
  const emojis = buildEmojiIndex();
  const rows: VirtualRow[] = [];
  const categoryRowIndices = new Map<string, number>();

  // Helper: chunk an array into rows of N
  const chunkEmojis = (items: EmojiItem[]) => {
    for (let i = 0; i < items.length; i += cols) {
      rows.push({ type: 'emoji-row', emojis: items.slice(i, i + cols) });
    }
  };

  const chunkCustom = (items: CustomEmoji[]) => {
    for (let i = 0; i < items.length; i += cols) {
      rows.push({ type: 'custom-row', emojis: items.slice(i, i + cols) });
    }
  };

  // Frequently Used
  if (frequentUnifieds.length > 0) {
    const freqEmojis = frequentUnifieds
      .map((u) => emojis.find((e) => e.unified === u))
      .filter((e): e is EmojiItem => e != null);

    if (freqEmojis.length > 0) {
      categoryRowIndices.set('Frequently Used', rows.length);
      rows.push({ type: 'header', category: 'Frequently Used', label: 'Frequently Used' });
      chunkEmojis(freqEmojis);
    }
  }

  // Custom emojis
  if (customEmojis.length > 0) {
    categoryRowIndices.set('Custom', rows.length);
    rows.push({ type: 'header', category: 'Custom', label: 'Custom' });
    chunkCustom(customEmojis);
  }

  // Standard categories
  for (const category of EMOJI_CATEGORIES) {
    const categoryEmojis = emojis.filter((e) => e.category === category);
    if (categoryEmojis.length === 0) continue;

    categoryRowIndices.set(category, rows.length);
    rows.push({ type: 'header', category, label: category });
    chunkEmojis(categoryEmojis);
  }

  return { rows, categoryRowIndices };
}

/** Search emojis by query string. Returns flat array of matching EmojiItems. */
export function searchEmojis(query: string): EmojiItem[] {
  const emojis = buildEmojiIndex();
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return emojis.filter((e) => e.searchString.includes(q));
}

/** Build search result rows from a query */
export function buildSearchRows(query: string, columnsCount: number, customEmojis: CustomEmoji[]): VirtualRow[] {
  const cols = Math.max(1, columnsCount);
  const results = searchEmojis(query);
  const rows: VirtualRow[] = [];

  // Search custom emojis too
  if (customEmojis.length > 0) {
    const q = query.toLowerCase().trim();
    const matching = customEmojis.filter((ce) =>
      ce.names.some((n) => n.toLowerCase().includes(q))
    );
    if (matching.length > 0) {
      for (let i = 0; i < matching.length; i += cols) {
        rows.push({ type: 'custom-row', emojis: matching.slice(i, i + cols) });
      }
    }
  }

  // Standard emoji results
  for (let i = 0; i < results.length; i += cols) {
    rows.push({ type: 'emoji-row', emojis: results.slice(i, i + cols) });
  }

  return rows;
}

/** Get the sprite background-position for a given sheet_x, sheet_y */
export function getSpritePosition(sheetX: number, sheetY: number): { x: number; y: number } {
  const { stride, padding, scale } = SPRITE_SHEET;
  return {
    x: (sheetX * stride + padding) * scale,
    y: (sheetY * stride + padding) * scale,
  };
}

/** Get all emojis (for external use) */
export function getAllEmojis(): EmojiItem[] {
  return buildEmojiIndex();
}
