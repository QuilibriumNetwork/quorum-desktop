# Custom Emoji Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `emoji-picker-react` with a custom emoji picker that uses CSS sprite sheet rendering and DOM virtualization, reducing ~1,911 HTTP requests to 1 and ~1,911 DOM nodes to ~30-50.

**Architecture:** Three layers -- data (preprocessed emoji index from `emoji-datasource-twitter` JSON), rendering (CSS `background-position` on sprite sheet + row-based `Virtuoso`), interaction (search, categories, skin tones, frequently used). Single chromeless `<EmojiPicker>` component replaces all 8 render sites across 6 files. The picker has no visual chrome (border, shadow, radius) -- parent containers provide framing.

**Tech Stack:** React, TypeScript, react-virtuoso (Virtuoso list mode with row-based rendering), emoji-datasource-twitter, SCSS with Quorum design tokens and SCSS variables from `_variables.scss`. Uses `<Input>` primitive for search field and `<Button type="unstyled">` for interactive elements.

**Key styling rules:** Follow [Styling Guidelines](./../docs/styling-guidelines.md). Use `rem` and SCSS variables (`$s-*`, `$rounded-*`, `$text-*`, `$shadow-*`, `$duration-*`), never raw `px`. Use semantic CSS color variables. Search input uses `--color-field-*` pattern. No `@apply`. `--color-text-main` is an RGB tuple -- must wrap in `rgb()`.

---

## File Structure

### New files to create

```
src/components/emoji-picker/
  EmojiPicker.tsx              -- Main picker component (grid, search, categories, skin tones)
  EmojiPicker.scss             -- Picker-internal styling (chromeless -- no border/shadow/radius)
  EmojiSprite.tsx              -- Single emoji sprite rendering (background-position div)
  emojiData.ts                 -- Data layer: load, index, filter, search emoji JSON
  types.ts                     -- EmojiData, EmojiItem, VirtualRow, CustomEmoji types
  useFrequentlyUsed.ts         -- localStorage-backed frequently used tracking + migration
  useSkinTone.ts               -- localStorage-backed skin tone preference
  index.ts                     -- Barrel export
```

### Files to modify

```
src/components/message/EmojiPickerDrawer.tsx    -- Replace emoji-picker-react import with custom picker
src/components/message/Message.tsx              -- Replace 3 EmojiPicker instances
src/components/space/Channel.tsx                -- Replace LazyEmojiPicker
src/components/direct/DirectMessage.tsx         -- Replace LazyEmojiPicker
src/components/thread/ThreadPanel.tsx           -- Replace LazyEmojiPicker
src/components/context/MobileProvider.tsx       -- Replace CustomEmoji type import
src/hooks/business/messages/useEmojiPicker.ts   -- Replace CustomEmoji import, update types
src/components/message/ReactionsList.tsx         -- Replace CustomEmoji type import
src/components/modals/ReactionsModal.tsx         -- Replace CustomEmoji type import
src/components/modals/ReactionsModalProvider.tsx -- Replace CustomEmoji type import
src/hooks/business/messages/useModalManagement.ts -- Replace CustomEmoji type import
src/styles/_emoji-picker.scss                   -- Delete (replaced by EmojiPicker.scss)
```

---

## Task 1: Types and Data Layer

**Files:**
- Create: `src/components/emoji-picker/types.ts`
- Create: `src/components/emoji-picker/emojiData.ts`

- [ ] **Step 1: Create the types file**

```ts
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
  /** Scaled total sheet dimension */
  backgroundSize: Math.round((62 * 34 + 1) * (28 / 32)),  // ~1845
} as const;

/** Category icon emojis -- their sheet coordinates for rendering as EmojiSprite */
export const CATEGORY_ICONS: Record<string, { unified: string; sheetX: number; sheetY: number }> = {};
// Populated at runtime from emoji data on first buildEmojiIndex() call
```

- [ ] **Step 2: Create the data layer**

```ts
// src/components/emoji-picker/emojiData.ts
import emojiDataRaw from 'emoji-datasource-twitter/emoji.json';
import type { EmojiItem, VirtualRow, CustomEmoji } from './types';
import { EMOJI_CATEGORIES, CATEGORY_ICONS } from './types';

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
      const skinVariations = e.skin_variations
        ? Object.fromEntries(
            Object.entries(e.skin_variations)
              .filter(([key, v]) => v.has_img_twitter && !key.includes('-'))
              .map(([key, v]) => [key, { sheetX: v.sheet_x, sheetY: v.sheet_y, unified: v.unified }])
          )
        : undefined;

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
  const emojis = buildEmojiIndex();
  const rows: VirtualRow[] = [];
  const categoryRowIndices = new Map<string, number>();

  // Helper: chunk an array into rows of N
  const chunkEmojis = (items: EmojiItem[]) => {
    for (let i = 0; i < items.length; i += columnsCount) {
      rows.push({ type: 'emoji-row', emojis: items.slice(i, i + columnsCount) });
    }
  };

  const chunkCustom = (items: CustomEmoji[]) => {
    for (let i = 0; i < items.length; i += columnsCount) {
      rows.push({ type: 'custom-row', emojis: items.slice(i, i + columnsCount) });
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
  const results = searchEmojis(query);
  const rows: VirtualRow[] = [];

  // Search custom emojis too
  if (customEmojis.length > 0) {
    const q = query.toLowerCase();
    const matching = customEmojis.filter((ce) =>
      ce.names.some((n) => n.toLowerCase().includes(q))
    );
    if (matching.length > 0) {
      for (let i = 0; i < matching.length; i += columnsCount) {
        rows.push({ type: 'custom-row', emojis: matching.slice(i, i + columnsCount) });
      }
    }
  }

  // Standard emoji results
  for (let i = 0; i < results.length; i += columnsCount) {
    rows.push({ type: 'emoji-row', emojis: results.slice(i, i + columnsCount) });
  }

  return rows;
}

/** Get the sprite background-position for a given sheet_x, sheet_y */
export function getSpritePosition(sheetX: number, sheetY: number): { x: number; y: number } {
  const stride = 34;
  const padding = 1;
  const scale = 28 / 32;
  return {
    x: (sheetX * stride + padding) * scale,
    y: (sheetY * stride + padding) * scale,
  };
}

/** Get all emojis (for external use) */
export function getAllEmojis(): EmojiItem[] {
  return buildEmojiIndex();
}
```

- [ ] **Step 3: Verify the JSON import works**

Run:
```bash
cd d:/GitHub/Quilibrium/quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

If `emoji-datasource-twitter/emoji.json` doesn't resolve, add `"resolveJsonModule": true` to `tsconfig.json`.

- [ ] **Step 4: Commit**

```bash
git add src/components/emoji-picker/types.ts src/components/emoji-picker/emojiData.ts
git commit -m "feat(emoji-picker): add types and data layer for custom sprite-based emoji picker"
```

---

## Task 2: EmojiSprite Component

**Files:**
- Create: `src/components/emoji-picker/EmojiSprite.tsx`

- [ ] **Step 1: Create the sprite rendering component**

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd d:/GitHub/Quilibrium/quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/emoji-picker/EmojiSprite.tsx
git commit -m "feat(emoji-picker): add EmojiSprite component for sprite sheet rendering"
```

---

## Task 3: Skin Tone and Frequently Used Hooks

**Files:**
- Create: `src/components/emoji-picker/useSkinTone.ts`
- Create: `src/components/emoji-picker/useFrequentlyUsed.ts`

- [ ] **Step 1: Create the skin tone hook**

```ts
// src/components/emoji-picker/useSkinTone.ts
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'emoji-picker-skin-tone';

/** The 5 skin tone modifier codepoints + null for default */
export const SKIN_TONES = [null, '1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF'] as const;
export type SkinTone = (typeof SKIN_TONES)[number];

function loadSkinTone(): SkinTone {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SKIN_TONES.includes(stored as SkinTone)) {
      return stored as SkinTone;
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

export function useSkinTone() {
  const [skinTone, setSkinToneState] = useState<SkinTone>(loadSkinTone);

  const setSkinTone = useCallback((tone: SkinTone) => {
    setSkinToneState(tone);
    try {
      if (tone === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, tone);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  return { skinTone, setSkinTone };
}
```

- [ ] **Step 2: Create the frequently used hook with migration**

```ts
// src/components/emoji-picker/useFrequentlyUsed.ts
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'emoji-picker-frequently-used';
const LEGACY_KEY = 'epr_suggested'; // emoji-picker-react's key
const MAX_FREQUENT = 28;

interface FrequentEntry {
  count: number;
  lastUsed: number;
}

type FrequentMap = Record<string, FrequentEntry>;

/** Migrate from emoji-picker-react's epr_suggested format on first load */
function migrateLegacy(): FrequentMap | null {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return null;

    const parsed = JSON.parse(legacy);
    if (!Array.isArray(parsed)) return null;

    const migrated: FrequentMap = {};
    for (const entry of parsed) {
      if (entry?.unified) {
        migrated[entry.unified] = {
          count: entry.count ?? 1,
          lastUsed: Date.now(),
        };
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    localStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch {
    return null;
  }
}

function loadFrequent(): FrequentMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as FrequentMap;
    const migrated = migrateLegacy();
    if (migrated) return migrated;
  } catch {
    // Corrupted data, start fresh
  }
  return {};
}

function getTopFrequent(map: FrequentMap): string[] {
  return Object.entries(map)
    .sort(([, a], [, b]) => b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, MAX_FREQUENT)
    .map(([unified]) => unified);
}

export function useFrequentlyUsed() {
  const [frequentMap, setFrequentMap] = useState<FrequentMap>(loadFrequent);

  const recordUsage = useCallback((unified: string) => {
    setFrequentMap((prev) => {
      const updated = {
        ...prev,
        [unified]: {
          count: (prev[unified]?.count ?? 0) + 1,
          lastUsed: Date.now(),
        },
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Storage full
      }
      return updated;
    });
  }, []);

  const frequentUnifieds = getTopFrequent(frequentMap);

  return { frequentUnifieds, recordUsage };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd d:/GitHub/Quilibrium/quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/emoji-picker/useSkinTone.ts src/components/emoji-picker/useFrequentlyUsed.ts
git commit -m "feat(emoji-picker): add skin tone and frequently used hooks with legacy migration"
```

---

## Task 4: Main EmojiPicker Component and Styling

**Files:**
- Create: `src/components/emoji-picker/EmojiPicker.tsx`
- Create: `src/components/emoji-picker/EmojiPicker.scss`
- Create: `src/components/emoji-picker/index.ts`

### Key design decisions for the implementer:

- **Chromeless**: The picker has NO border, shadow, or border-radius. Parent containers (stickers panel, mobile drawer, reaction popup wrapper) provide the visual frame.
- **Row-based Virtuoso**: Use plain `Virtuoso` (NOT `VirtuosoGrid`). Each "item" is a full row -- either a category header or a flex row of N emoji buttons. `VirtuosoGrid` cannot mix headers with grid cells because it assumes uniform item sizes.
- **Column count**: Computed from container width. `columnsCount = Math.floor((containerWidth - horizontalPadding) / cellSize)`. Use a `ResizeObserver` or measure once on mount.
- **Category tab icons**: Use `EmojiSprite` component (NOT native emoji characters) to avoid Windows Segoe vs Twemoji visual mismatch.
- **Skin tone selector**: Placed inline in the categories row (right side, `margin-left: auto`), NOT as a separate bottom bar. Saves vertical space.
- **Search input**: Use the `Input` primitive with `variant="bordered"` and `--color-field-*` variables, or use `ListSearchInput` from `src/components/ui/`.
- **Emoji buttons**: Use `<Button type="unstyled">` from primitives. Add `::after` pseudo-element for 44px mobile touch targets without changing visual size.
- **Styling guidelines**: All spacing in `rem` via SCSS variables (`$s-1`, `$s-2`, etc.). Typography via `$text-xs`, `$text-sm`. Colors via semantic CSS variables. Font: `Sen, sans-serif`. Transitions: `$duration-150`/`$duration-200` + `$ease-in-out`.

- [ ] **Step 1: Create the SCSS file**

```scss
// src/components/emoji-picker/EmojiPicker.scss
// Chromeless picker -- no border, shadow, or radius.
// Parent containers provide the visual frame.

.emoji-picker {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: Sen, sans-serif;
  // Background inherited from parent container

  // Header row: category tabs + skin tone selector
  &__header {
    display: flex;
    align-items: center;
    padding: $s-1 $s-2;
    gap: $s-0-5;
    border-bottom: 1px solid var(--color-border-default);
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  &__category-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: $s-8;       // 2rem / 32px
    height: $s-8;
    border-radius: $rounded-md;
    flex-shrink: 0;
    opacity: 0.5;
    transition: opacity $duration-150 $ease-in-out,
                background-color $duration-150 $ease-in-out;

    &:hover {
      background-color: var(--surface-3);
      opacity: 0.8;
    }

    &--active {
      opacity: 1;
      background-color: var(--surface-3);
    }
  }

  // Skin tone dots inline in header row
  &__skin-tones {
    display: flex;
    gap: $s-1;
    margin-left: auto;
    padding-left: $s-2;
    flex-shrink: 0;
  }

  &__skin-tone-dot {
    width: $s-4;       // 1rem / 16px
    height: $s-4;
    border-radius: $rounded-full;
    border: 2px solid transparent;
    transition: border-color $duration-150 $ease-in-out;

    &--active {
      border-color: var(--accent);
    }
  }

  // Search bar
  &__search {
    padding: $s-2;
    border-bottom: 1px solid var(--color-border-default);
  }

  // Emoji grid (Virtuoso container)
  &__grid-container {
    flex: 1;
    min-height: 0; // Critical for flex child to not overflow
    overflow: hidden;
  }

  // Category header inside the virtualized list
  &__row-header {
    padding: $s-1-5 $s-1 $s-1;
    font-size: $text-xs;
    font-weight: $font-semibold;
    color: var(--color-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  // Emoji row (flex container of N emoji buttons)
  &__emoji-row {
    display: flex;
    gap: $s-0-5;
    padding: 0 $s-2;
  }

  // Individual emoji button
  &__emoji-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: $s-8-5;     // 2.125rem / 34px
    height: $s-8-5;
    border-radius: $rounded-md;
    transition: background-color $duration-150 $ease-in-out;

    &:hover {
      background-color: var(--surface-3);
    }

    // Expanded touch target for mobile (44px)
    &::after {
      content: '';
      position: absolute;
      inset: -#{$s-1};   // Expand by 4px each side: 34 + 8 = 42px ~ 44px
    }
  }

  // Custom emoji image (for space-uploaded emojis)
  &__custom-emoji-img {
    width: 1.75rem;    // 28px
    height: 1.75rem;
    object-fit: contain;
  }

  // No results state
  &__no-results {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: $s-8;
    color: var(--color-text-subtle);
    font-size: $text-sm;
  }
}
```

**Note for implementer**: Check that `$s-8-5` (2.125rem / 34px) exists in `_variables.scss`. If not, use `$s-8` (32px) or the closest available variable. If the exact value is off by 1-2px from a variable, per styling guidelines it's acceptable to use the closest variable.

- [ ] **Step 2: Create the main EmojiPicker component**

The component uses:
- `Virtuoso` (NOT `VirtuosoGrid`) with `VirtualRow[]` data (header rows and emoji rows)
- `rangeChanged` callback to track active category (NOT IntersectionObserver -- virtualized elements may be removed from DOM)
- `scrollToIndex` for category tab clicks
- `EmojiSprite` for category tab icons (NOT native emoji text)
- Skin tone dots inline in the header next to category tabs
- `Input` primitive (or `ListSearchInput`) for search
- `Button type="unstyled"` for emoji buttons and category tabs
- Column count computed from container width via `useRef` + measurement on mount

```tsx
// src/components/emoji-picker/EmojiPicker.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { t } from '@lingui/core/macro';
import { Button } from '../primitives';
import EmojiSprite from './EmojiSprite';
import {
  buildRowData,
  buildSearchRows,
  unifiedToEmoji,
  getEmojiImageUrl,
} from './emojiData';
import { useSkinTone, SKIN_TONES } from './useSkinTone';
import { useFrequentlyUsed } from './useFrequentlyUsed';
import type { CustomEmoji, EmojiData, EmojiItem, VirtualRow } from './types';
import { EMOJI_CATEGORIES, CATEGORY_ICONS, SPRITE_SHEET } from './types';
import './EmojiPicker.scss';

interface EmojiPickerProps {
  onEmojiClick: (emoji: EmojiData) => void;
  customEmojis?: CustomEmoji[];
  width?: number | string;
  height?: number | string;
}

const DEFAULT_COLUMNS = 8;
const CELL_SIZE = 34; // px, must match SCSS $s-8-5 or closest
const H_PADDING = 16; // px, $s-2 * 2 sides

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onEmojiClick,
  customEmojis = [],
  width = 300,
  height = 400,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Frequently Used');
  const [columnsCount, setColumnsCount] = useState(DEFAULT_COLUMNS);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const { skinTone, setSkinTone } = useSkinTone();
  const { frequentUnifieds, recordUsage } = useFrequentlyUsed();

  // Measure container width to compute column count
  useEffect(() => {
    if (!containerRef.current) return;
    const measure = () => {
      const w = containerRef.current?.clientWidth ?? 300;
      setColumnsCount(Math.max(1, Math.floor((w - H_PADDING) / CELL_SIZE)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Build row data
  const { rows, categoryRowIndices } = useMemo(
    () => buildRowData(columnsCount, frequentUnifieds, customEmojis),
    [columnsCount, frequentUnifieds, customEmojis]
  );

  // Search results as rows
  const searchRows = useMemo(() => {
    if (!debouncedQuery) return null;
    return buildSearchRows(debouncedQuery, columnsCount, customEmojis);
  }, [debouncedQuery, columnsCount, customEmojis]);

  const displayRows = searchRows ?? rows;
  const isSearching = searchRows != null;

  // Debounced search
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedQuery(value), 150);
  }, []);

  useEffect(() => {
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, []);

  // Handle emoji click
  const handleEmojiClick = useCallback(
    (item: EmojiItem) => {
      let unified = item.unified;
      if (skinTone && item.hasSkinVariations && item.skinVariations?.[skinTone]) {
        unified = item.skinVariations[skinTone].unified;
      }

      recordUsage(item.unified); // Track by base unified
      onEmojiClick({
        emoji: unifiedToEmoji(unified),
        unified: unified.toLowerCase(),
        names: item.shortNames,
        imageUrl: getEmojiImageUrl(unified),
        isCustom: false,
      });
    },
    [skinTone, onEmojiClick, recordUsage]
  );

  // Handle custom emoji click
  const handleCustomEmojiClick = useCallback(
    (ce: CustomEmoji) => {
      onEmojiClick({
        emoji: ce.names[0] ?? ce.id,
        unified: `custom-${ce.id}`,
        names: ce.names,
        imageUrl: ce.imgUrl,
        isCustom: true,
      });
    },
    [onEmojiClick]
  );

  // Active category tracking via rangeChanged
  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (isSearching) return;
      for (let i = range.startIndex; i >= 0; i--) {
        const row = rows[i];
        if (row?.type === 'header') {
          setActiveCategory(row.category);
          return;
        }
      }
    },
    [rows, isSearching]
  );

  // Scroll to category on tab click
  const handleCategoryClick = useCallback(
    (category: string) => {
      const index = categoryRowIndices.get(category);
      if (index != null && virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({ index, align: 'start' });
        setActiveCategory(category);
      }
    },
    [categoryRowIndices]
  );

  // Available categories for tab bar
  const availableCategories = useMemo(
    () => Array.from(categoryRowIndices.keys()),
    [categoryRowIndices]
  );

  // Render a row
  const renderRow = useCallback(
    (index: number, row: VirtualRow) => {
      if (row.type === 'header') {
        return <div className="emoji-picker__row-header">{row.label}</div>;
      }

      if (row.type === 'custom-row') {
        return (
          <div className="emoji-picker__emoji-row">
            {row.emojis.map((ce) => (
              <Button
                key={ce.id}
                type="unstyled"
                className="emoji-picker__emoji-btn"
                onClick={() => handleCustomEmojiClick(ce)}
                title={ce.names[0]}
              >
                <img src={ce.imgUrl} alt={ce.names[0]} className="emoji-picker__custom-emoji-img" />
              </Button>
            ))}
          </div>
        );
      }

      // emoji-row
      return (
        <div className="emoji-picker__emoji-row">
          {row.emojis.map((item) => {
            let sheetX = item.sheetX;
            let sheetY = item.sheetY;
            if (skinTone && item.hasSkinVariations && item.skinVariations?.[skinTone]) {
              const variant = item.skinVariations[skinTone];
              sheetX = variant.sheetX;
              sheetY = variant.sheetY;
            }

            return (
              <Button
                key={item.unified}
                type="unstyled"
                className="emoji-picker__emoji-btn"
                onClick={() => handleEmojiClick(item)}
                title={item.shortName}
              >
                <EmojiSprite sheetX={sheetX} sheetY={sheetY} label={item.shortName} />
              </Button>
            );
          })}
        </div>
      );
    },
    [skinTone, handleEmojiClick, handleCustomEmojiClick]
  );

  return (
    <div className="emoji-picker" style={{ width, height }} ref={containerRef}>
      {/* Search */}
      <div className="emoji-picker__search">
        <input
          type="text"
          placeholder={t`Search emoji...`}
          value={searchQuery}
          onChange={handleSearchChange}
          autoComplete="off"
          className="emoji-picker__search-input"
        />
      </div>

      {/* Header: category tabs + skin tone dots */}
      {!isSearching && (
        <div className="emoji-picker__header">
          {availableCategories.map((cat) => (
            <Button
              key={cat}
              type="unstyled"
              className={`emoji-picker__category-btn ${activeCategory === cat ? 'emoji-picker__category-btn--active' : ''}`}
              onClick={() => handleCategoryClick(cat)}
              title={cat}
            >
              {CATEGORY_ICONS[cat] ? (
                <EmojiSprite
                  sheetX={CATEGORY_ICONS[cat].sheetX}
                  sheetY={CATEGORY_ICONS[cat].sheetY}
                  size={18}
                />
              ) : (
                <span style={{ fontSize: '1.125rem' }}>📁</span>
              )}
            </Button>
          ))}

          {/* Skin tone selector */}
          <div className="emoji-picker__skin-tones">
            {SKIN_TONES.map((tone) => (
              <button
                key={tone ?? 'default'}
                className={`emoji-picker__skin-tone-dot ${skinTone === tone ? 'emoji-picker__skin-tone-dot--active' : ''}`}
                onClick={() => setSkinTone(tone)}
                type="button"
                style={{
                  backgroundColor: tone === null ? '#ffcc4d'
                    : tone === '1F3FB' ? '#f7dece'
                    : tone === '1F3FC' ? '#e0bb95'
                    : tone === '1F3FD' ? '#bf8f68'
                    : tone === '1F3FE' ? '#9b643d'
                    : '#594539',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Emoji grid */}
      <div className="emoji-picker__grid-container">
        {displayRows.length === 0 && isSearching ? (
          <div className="emoji-picker__no-results">{t`No emoji found`}</div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            totalCount={displayRows.length}
            overscan={200}
            itemContent={(index) => {
              const row = displayRows[index];
              if (!row) return null;
              return renderRow(index, row);
            }}
            rangeChanged={handleRangeChanged}
          />
        )}
      </div>
    </div>
  );
};

export default EmojiPicker;
```

**Notes for implementer:**
- The search input above uses a raw `<input>` with a class. The implementer should check whether `ListSearchInput` from `src/components/ui/` can be used instead. If so, replace the raw input with `<ListSearchInput variant="bordered" ... />`. If `ListSearchInput` doesn't fit (e.g., it adds icons or styling that conflicts), use `<Input variant="bordered" />` from primitives. Style the input with `--color-field-*` variables per the form field standards.
- The `Button` import path (`../primitives`) should be adjusted to match the actual re-export path. Check `src/components/primitives/index.ts` for the correct import.
- If `$s-8-5` doesn't exist in `_variables.scss`, adjust the SCSS values. The cell size (34px = 2.125rem) may need the closest available variable.

- [ ] **Step 3: Create the barrel export**

```ts
// src/components/emoji-picker/index.ts
export { default as EmojiPicker } from './EmojiPicker';
export type { EmojiData, CustomEmoji } from './types';
```

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
cd d:/GitHub/Quilibrium/quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/emoji-picker/
git commit -m "feat(emoji-picker): add main EmojiPicker component with Virtuoso, search, skin tones"
```

---

## Task 5: Replace emoji-picker-react in All Consumer Files

**Files:** 11 files to modify (see File Structure section above)

This task replaces all imports and usages. Each file follows the same pattern: replace `emoji-picker-react` imports with our custom picker imports.

- [ ] **Step 1: Update useEmojiPicker.ts**

Replace import:
```ts
// Before:
import { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
// After:
import type { CustomEmoji } from '../../../components/emoji-picker/types';
```

No other changes -- the `CustomEmoji` shape (`{ id, names, imgUrl }`) is identical.

- [ ] **Step 2: Update EmojiPickerDrawer.tsx**

Replace imports:
```tsx
// Before:
import EmojiPicker, { SkinTonePickerLocation, SuggestionMode, Theme } from 'emoji-picker-react';
import { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';

// After:
import { EmojiPicker } from '../emoji-picker';
import type { CustomEmoji, EmojiData } from '../emoji-picker/types';
```

Replace the `<EmojiPicker>` render -- remove all old props and use new API:
```tsx
<EmojiPicker
  width="100%"
  height={hasStickers ? 540 : 600}
  customEmojis={customEmojis}
  onEmojiClick={(emojiData: EmojiData) => {
    onEmojiClick(emojiData.emoji);
    onClose();
  }}
/>
```

- [ ] **Step 3: Update Message.tsx**

Replace imports:
```ts
// Before:
import EmojiPicker, { SkinTonePickerLocation, SuggestionMode, Theme } from 'emoji-picker-react';
// After:
import { EmojiPicker } from '../emoji-picker';
import type { EmojiData } from '../emoji-picker/types';
```

Replace all 3 `<EmojiPicker>` instances. Remove old props (`suggestedEmojisMode`, `skinTonePickerLocation`, `theme`, `lazyLoadEmojis`, `getEmojiUrl`). Use new API:
```tsx
<EmojiPicker
  customEmojis={emojiPicker.customEmojis}
  onEmojiClick={(e: EmojiData) => emojiPicker.handleDesktopEmojiClick(e.emoji)}
/>
```

For the mobile instance (line ~737), use `handleMobileEmojiClick`.

- [ ] **Step 4: Update Channel.tsx**

Replace imports and lazy load:
```ts
// Before:
import { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
const LazyEmojiPicker = React.lazy(() => import('emoji-picker-react'));
// Plus: SkinTonePickerLocation, SuggestionMode, Theme

// After:
import type { CustomEmoji, EmojiData } from '../emoji-picker/types';
const LazyEmojiPicker = React.lazy(() =>
  import('../emoji-picker/EmojiPicker').then((m) => ({ default: m.default }))
);
```

Replace `<LazyEmojiPicker>` render with new API. Remove old props. Keep existing width/height (300/358).

- [ ] **Step 5: Update DirectMessage.tsx**

Same pattern as Channel.tsx. `customEmojis={[]}`, width `300`, height `400`.

- [ ] **Step 6: Update ThreadPanel.tsx**

Same pattern as Channel.tsx. Adjust import path depth.

- [ ] **Step 7: Update type-only imports in remaining 5 files**

Replace `CustomEmoji` import in each:

- `src/components/context/MobileProvider.tsx`
- `src/components/message/ReactionsList.tsx`
- `src/components/modals/ReactionsModal.tsx`
- `src/components/modals/ReactionsModalProvider.tsx`
- `src/hooks/business/messages/useModalManagement.ts`

```ts
// Before:
import { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
// After:
import type { CustomEmoji } from '<relative-path>/emoji-picker/types';
```

- [ ] **Step 8: Verify no remaining emoji-picker-react references**

Run:
```bash
cd d:/GitHub/Quilibrium/quorum-desktop && grep -r "emoji-picker-react" src/ --include="*.ts" --include="*.tsx"
```

Should return zero results.

- [ ] **Step 9: Verify TypeScript compiles**

Run:
```bash
cd d:/GitHub/Quilibrium/quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(emoji-picker): replace emoji-picker-react with custom picker across all consumer files"
```

---

## Task 6: Cleanup Old Dependencies and Styles

**Files:**
- Modify: `package.json`
- Delete: `src/styles/_emoji-picker.scss`

- [ ] **Step 1: Remove emoji-picker-react from dependencies**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop && yarn remove emoji-picker-react
```

- [ ] **Step 2: Delete old emoji picker SCSS and remove its import**

```bash
rm src/styles/_emoji-picker.scss
```

Find and remove the `@import` or `@use` line from the parent SCSS file:
```bash
grep -r "_emoji-picker" src/styles/ --include="*.scss"
```

- [ ] **Step 3: Verify build works**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop && yarn build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove emoji-picker-react dependency and old SCSS overrides"
```

---

## Task 7: Manual Testing and Polish

- [ ] **Step 1: Start the dev server**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop && yarn dev
```

- [ ] **Step 2: Verify sprite sheet rendering**

Open DevTools Network tab. Open the emoji picker -- should see ONE request for `sheets-clean/32.png`, NOT thousands of individual PNGs. All emojis should render immediately. Second open should be instant (cached).

- [ ] **Step 3: Test all 8 render sites**

1. Channel composer -- click emoji button (inside stickers panel)
2. DM composer -- click emoji button
3. Thread panel -- click emoji button
4. Message reaction (hover) -- click smiley icon on a message
5. Message reaction (context menu) -- right-click message, add reaction
6. Message reaction (mobile modal) -- test at mobile viewport
7. Mobile drawer -- resize to mobile, open emoji drawer
8. Verify sticker tabs still work in Channel (Emojis/Stickers toggle)

- [ ] **Step 4: Test features**

- **Search**: Type "smile" -- should filter to matching emojis
- **Categories**: Click each tab -- should scroll to category. Scroll -- active tab should update
- **Skin tones**: Click tone dots -- people emojis should update. Reopen -- preference persisted
- **Frequently used**: Click emojis, reopen -- should appear at top
- **Custom emojis**: In a space with custom emojis, verify they appear and are clickable

- [ ] **Step 5: Test emoji insertion end-to-end**

- Pick emoji in composer -- inserted into message input
- Send message -- emoji renders as Twemoji image
- Add reaction -- reaction badge appears correctly
- Test at mobile viewport

- [ ] **Step 6: Fix issues and commit**

```bash
git add -A
git commit -m "fix(emoji-picker): polish and fixes from manual testing"
```

---

## Summary

| Task | Description | Files | Key change from v1 |
|------|-------------|-------|---------------------|
| 1 | Types and data layer | 2 new | Row-based `VirtualRow` type (not GridItem), `buildRowData` chunks into rows |
| 2 | EmojiSprite component | 1 new | Unchanged |
| 3 | Skin tone + frequently used hooks | 2 new | Unchanged |
| 4 | Main EmojiPicker + SCSS + barrel | 3 new | Plain `Virtuoso` (not VirtuosoGrid), chromeless, SCSS uses rem/$variables, EmojiSprite tab icons, inline skin tones, `Button type="unstyled"`, `--color-field-*` for search |
| 5 | Replace in all consumers | 11 modified | Unchanged |
| 6 | Cleanup dependencies | 2-3 modified/deleted | Unchanged |
| 7 | Manual testing | Various | Unchanged |

**Key corrections from review:**
- `Virtuoso` list mode with pre-chunked rows (VirtuosoGrid can't mix headers + grid cells)
- `rangeChanged` for active category (not IntersectionObserver)
- Chromeless picker (no border/shadow/radius -- parent containers provide framing)
- SCSS follows styling guidelines: `rem`, `$s-*`, `$rounded-*`, `$text-*`, `$duration-*`
- Category tab icons use `EmojiSprite` (not native emoji)
- Skin tone selector inline in header (not bottom bar)
- `Button type="unstyled"` for interactive elements
- `--color-field-*` variables for search input
- `::after` pseudo-element for 44px mobile touch targets
- Font: `Sen, sans-serif` (not `var(--font-family)` which doesn't exist)
- `min-height: 0` on grid container for flex correctness
- `--color-text-main` wrapped in `rgb()` where used

---

_Created: 2026-04-14_
_Updated: 2026-04-14 -- Full rewrite incorporating all review feedback: virtualization approach, styling guidelines, visual/UX fixes, chromeless design, primitive components._
