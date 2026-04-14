---
type: doc
title: Custom Emoji Picker
status: current
created: 2026-04-14
updated: 2026-04-14
---

# Custom Emoji Picker

A fully custom emoji picker built in-house, replacing the `emoji-picker-react` dependency. Uses CSS sprite sheet rendering (1 HTTP request for the full emoji set) and row-based DOM virtualization via `react-virtuoso` (~30-50 DOM nodes regardless of emoji count).

## Why Custom

`emoji-picker-react` was making ~1,911 individual PNG requests per picker open and rendering ~1,911 DOM nodes. See the archived research report at `reports/.archived/emoji-picker-library-comparison_2026-02-24.md` for the full analysis. The decision was to build a custom picker using the Twitter sprite sheet from `emoji-datasource-twitter`, which ships as a single `sheets-clean/32.png`.

## File Structure

```
src/components/emoji-picker/
  EmojiPicker.tsx        — Main component (grid, search, category tabs, skin tones)
  EmojiPicker.scss       — Picker-internal styles (chromeless: no border/shadow/radius)
  EmojiSprite.tsx        — Single emoji rendered via CSS background-position
  emojiData.ts           — Data layer: build index, filter, search, build virtual rows
  types.ts               — EmojiData, EmojiItem, VirtualRow, CustomEmoji, SPRITE_SHEET
  useFrequentlyUsed.ts   — localStorage-backed frequent emoji tracking + legacy migration
  useSkinTone.ts         — localStorage-backed skin tone preference
  index.ts               — Barrel export
```

## Architecture

Three layers:

**Data layer (`emojiData.ts`):** Imports the raw `emoji-datasource-twitter` JSON once, filters to Twitter-available emojis, maps to `EmojiItem[]`, and caches module-level. `buildRowData()` produces a flat `VirtualRow[]` array (headers + emoji rows) for the virtualized list. `buildSearchRows()` does the same for search results.

**Rendering layer (`EmojiSprite.tsx`):** Renders a single emoji as a `<div>` with `background-image` pointing at the sprite sheet and `background-position` computed from `sheetX`/`sheetY`. No `<img>` tags — zero extra requests after the sprite loads.

**Interaction layer (`EmojiPicker.tsx`):** `react-virtuoso` in list mode with row-based rendering. `renderRow` is stabilized with `useCallback`. Active category tracks scroll position via `rangeChanged` (O(n categories), not O(n rows)). ResizeObserver measures container width to compute column count dynamically.

## Sprite Sheet Constants

Defined in `types.ts` as `SPRITE_SHEET`:

| Constant | Value | Notes |
|----------|-------|-------|
| `url` | `/twitter/sheets-clean/32.png` | Served as a static asset |
| `cellSize` | 32px | Raw sprite cell size |
| `padding` | 1px | Padding around each cell |
| `stride` | 34px | `cellSize + 2 * padding` |
| `cols` / `rows` | 62 | Sheet dimensions |
| `displaySize` | 28px | Rendered size |
| `scale` | 0.875 | `displaySize / cellSize` |

Position formula: `(sheetX * stride + padding) * scale`

## Component API

```tsx
<EmojiPicker
  onEmojiClick={(data: EmojiData) => void}
  customEmojis?: CustomEmoji[]   // Space-uploaded emojis
  width?: number | string        // Default: 300
  height?: number | string       // Default: 400
/>
```

The picker is **chromeless** — no border, shadow, or border-radius. All framing is provided by the parent container (e.g. the floating panel div in Channel.tsx applies `bg-modal border border-default rounded-lg shadow-lg overflow-hidden`).

### EmojiData (returned on click)

```ts
interface EmojiData {
  emoji: string;      // Native unicode character, e.g. '😀' — use this for insertion
  unified: string;    // Lowercase codepoint string, e.g. '1f600'
  names: string[];    // Short names / aliases
  imageUrl: string;   // URL to individual 64px PNG for message rendering
  isCustom: boolean;  // true for space-uploaded custom emojis
}
```

**All consumers should use `e.emoji` (the string) for text insertion**, not the full `EmojiData` object.

### CustomEmoji

```ts
interface CustomEmoji {
  id: string;
  names: string[];
  imgUrl: string;
}
```

## Consumer Pattern

All render sites lazy-load the picker and wrap in `<Suspense>`:

```tsx
const LazyEmojiPicker = React.lazy(() =>
  import('../emoji-picker/EmojiPicker').then((m) => ({ default: m.default }))
);

// In JSX:
<Suspense fallback={<div className="emoji-picker-loading" />}>
  <LazyEmojiPicker
    customEmojis={customEmojis}
    onEmojiClick={(e: EmojiData) => handleComposerEmojiClick(e.emoji)}
  />
</Suspense>
```

Consumers: `Channel.tsx`, `ThreadPanel.tsx`, `DirectMessage.tsx`, `Message.tsx`, `EmojiPickerDrawer.tsx`.

## Skin Tones

Skin tone preference is stored in localStorage under `emoji-picker-skin-tone`. The six tones (including default/yellow) map to Fitzpatrick scale modifier codepoints: `null`, `1F3FB`–`1F3FF`. Colors are defined in `EmojiPicker.scss` via `data-tone` attribute selectors.

## Frequently Used

`useFrequentlyUsed` stores a `Record<unified, { count, lastUsed }>` map in localStorage under `emoji-picker-frequently-used`. On first load it migrates from the old `epr_suggested` key (written by `emoji-picker-react`) but **does not delete** `epr_suggested` — the separate `useFrequentEmojis` hook (used by the quick-reaction bar in message actions) still reads from that key. A follow-up task should unify the two storage schemas.

## Related Files

- `src/hooks/business/messages/useEmojiPicker.ts` — Emoji picker state management hook
- `src/hooks/business/messages/useFrequentEmojis.ts` — Quick-reaction bar data (reads `epr_suggested`)
- `src/components/message/EmojiPickerDrawer.tsx` — Mobile drawer wrapper
- `public/twitter/` — Sprite sheet and individual emoji PNGs

---

*Last updated: 2026-04-14*
