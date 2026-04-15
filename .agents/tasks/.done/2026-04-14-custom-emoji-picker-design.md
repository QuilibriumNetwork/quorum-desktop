---
type: task
title: "Custom Emoji Picker with Sprite Sheet Rendering"
status: pending
complexity: high
created: 2026-04-14
updated: 2026-04-14
related_tasks:
  - "tasks/.done/emoji-picker-performance-fix.md"
  - "tasks/.done/twemoji-migration.md"
  - "tasks/2026-04-14-emoji-picker-virtualization-watch.md"
related_docs:
  - "docs/features/messages/emoji-picker-react-customization.md"
  - "reports/emoji-picker-library-comparison_2026-02-24.md"
---

# Custom Emoji Picker with Sprite Sheet Rendering

## Problem

The current emoji picker (`emoji-picker-react` v4.18.0) renders ~1,911 individual `<img>` DOM nodes, each triggering a separate HTTP request for a Twemoji PNG. Combined with HTTP/1.1's ~6 concurrent connection limit, this creates a visible waterfall where emojis load one by one over several seconds. The UX is unacceptable for a messaging app.

Previous mitigations (adding `lazyLoadEmojis={true}`, upgrading the library) had minimal impact. The library's virtualization PR (#439) has been stalled since Dec 2024 with no maintainer response. No existing emoji picker library supports sprite sheet rendering.

## Decision

Build a custom emoji picker component that replaces `emoji-picker-react` entirely. The picker will use CSS sprite sheet rendering (one HTTP request for all emojis) and DOM virtualization (only visible emojis exist in the DOM). This is the only approach that solves the core performance problem.

### Why not other options

- **Wait for emoji-picker-react virtualization**: PR #439 stalled since Dec 2024. Maintainer has a separate virtualize branch (Sept 2025) but no release. No timeline, no control.
- **Migrate to emoji-mart**: No release in 2 years (last: April 2024). Still uses individual images, not sprite sheets. Migration effort with no performance gain.
- **Other libraries (frimousse, emoji-picker-element)**: Either missing custom emoji support or using Shadow DOM. None support sprite sheets.

## Design

### Architecture

Three layers:

1. **Data layer** -- preprocessed emoji index from `emoji-datasource-twitter`'s JSON (1,911 entries, ~1.28MB). Contains unified codes, short names, categories, sort order, skin tone variants, and sprite sheet coordinates (`sheet_x`, `sheet_y`). Built as a flat in-memory array on first picker open (~2-3ms), searchable synchronously. Entries are sorted by `sort_order` at build time (not pre-sorted in the source data). Entries with `has_img_twitter: false` and the `Component` category (5 skin tone swatches) are excluded.

2. **Rendering layer** -- each emoji is a `<button>` wrapping a `<div>` styled with CSS `background-position` against the Twemoji 32px sprite sheet (`sheets-clean/32.png`, 4.7MB, loaded once, browser-cached). The 32px source displayed at 28px is crisp on 1x screens; slightly soft on 2x Retina but imperceptible at picker emoji sizes. The 64px sheet (10.8MB) could be used as a future upgrade if Retina sharpness becomes a concern. Grid is virtualized with `react-virtuoso`'s `VirtuosoGrid` with sentinel header items for categories. Only ~30-50 emoji elements exist in the DOM at a time.

3. **Interaction layer** -- search, category navigation, skin tone selection, frequently used tracking, and the `onEmojiClick` callback.

### Component API

```tsx
<EmojiPicker
  onEmojiClick={(emoji: EmojiData) => void}
  customEmojis?: CustomEmoji[]   // space-specific emojis with imgUrl
  theme?: 'dark' | 'light'
  width?: number | string
  height?: number | string
/>
```

`EmojiData` returned on click:
- `emoji` -- native unicode character (e.g. `😀`) -- **this is the only field currently used by all consumers**
- `unified` -- unicode codepoint (e.g. `1f600`)
- `names` -- short names
- `imageUrl` -- individual image URL (for future use by message rendering)
- `isCustom` -- whether it's a space custom emoji

The `CustomEmoji` type (`{ id: string; names: string[]; imgUrl: string }`) must be exported from the new picker module, as it's used across 9 files in the codebase (not just the picker instances): `useEmojiPicker.ts`, `MobileProvider.tsx`, `ReactionsModalProvider.tsx`, `useModalManagement.ts`, `Channel.tsx`, `ThreadPanel.tsx`, `ReactionsList.tsx`, `ReactionsModal.tsx`, and `EmojiPickerDrawer.tsx`.

### Sprite Sheet Rendering

Uses the 32px sprite sheet from `emoji-datasource-twitter` (`sheets-clean/32.png`, 4.7MB). The `sheets/` and `sheets-clean/` directories are identical for the Twitter set. The 32px source displayed at 28px CSS is crisp on 1x screens. On 2x Retina, the browser upscales 28px CSS to 56px device pixels from a 32px source -- slightly soft, but imperceptible at emoji picker grid sizes. The 64px sheet (10.8MB) can be swapped in later if Retina sharpness becomes a concern.

The sprite sheet is a 62x62 cell grid. Each cell is 32px content + 1px padding on each side = 34px stride. Each emoji's position is computed from pre-provided `sheet_x`/`sheet_y` grid coordinates:

```
x_px = (sheet_x * 34) + 1    // 34 = 32px cell + 2px border
y_px = (sheet_y * 34) + 1
```

For a 28px display size, the positions and sheet dimensions must be scaled by `28/32 = 0.875`:

```css
.emoji-sprite {
  width: 28px;
  height: 28px;
  background-image: url('/twitter/sheets-clean/32.png');
  background-size: 1845px 1845px;  /* 2109 * 28/32 */
  background-position: -<scaled_x>px -<scaled_y>px;
}
```

All emoji elements share the same `background-image` URL (one CSS class or variable). Each element only differs in `background-position`. The browser loads the sprite sheet once (4.7MB compressed, decodes to ~17MB RGBA in GPU memory -- acceptable, comparable to a single hi-res photo), then every emoji is a zero-cost CSS offset.

The sprite sheet is already copied to `dist/web/twitter/sheets-clean/32.png` by the existing viteStaticCopy glob (`img/twitter/*`). No build config changes needed.

Consider adding `<link rel="preload" as="image">` for the sprite sheet to start loading before the picker is first opened, eliminating any first-open delay.

### Virtualization

`react-virtuoso`'s `Virtuoso` in list mode (already a project dependency at v4.12.3):

- Build a row-based data array: `VirtualRow = { type: 'header' } | { type: 'emoji-row', emojis: EmojiItem[] } | { type: 'custom-row', emojis: CustomEmoji[] }`
- Each "item" is a full row: either a category header or a flex container of N emoji buttons
- Column count (N) computed from container width via ResizeObserver: `Math.floor((width - padding) / cellSize)`
- `Virtuoso` handles variable heights natively (headers ~24px, emoji rows ~34px) -- unlike `VirtuosoGrid` which requires uniform item sizes
- Only visible rows are in the DOM (~15-25 rows, ~30-50 emoji buttons)
- Expected first-open render: <50ms after sprite sheet is cached

**Why not VirtuosoGrid**: VirtuosoGrid measures a single item's dimensions and assumes all items are identical. Mixing category headers (full-width, different height) with emoji cells breaks the scroll math entirely.

**Active tab tracking**: Use Virtuoso's `rangeChanged` callback (not IntersectionObserver -- virtualized elements may be removed from DOM, breaking IO). Map the first visible row index back to its category by scanning backwards for the nearest header row. Same pattern used in `MessageList.tsx`.

**Scroll to category**: `scrollToIndex` maps to the header row's index in the flat row array.

**Chromeless design**: The picker has no border, shadow, or border-radius. Parent containers provide the visual frame:
- Stickers panel (`.stickers-panel`): `--color-bg-modal`, `$shadow-lg`, `$rounded-lg`
- Mobile drawer: `--color-bg-mobile-drawer`, no border/shadow (drawer chrome handles it)
- Reaction popup: wrapper div matching DropdownPanel pattern (`--color-bg-panel`, `$shadow-lg`)

### Search

- On first picker open, build a flat search index: each emoji's `name` + `short_names` joined into a lowercase string
- On input, synchronous `includes()` filter over 1,911 entries (<2ms)
- Input debounced at ~150ms
- Search results replace the category grid with a flat virtualized list
- Clear search returns to category view

### Category Navigation

- Horizontal tab bar at top with category icons
- Click tab: scroll to that category's header sentinel via `scrollToIndex`
- Scroll naturally: `rangeChanged` callback updates the active tab
- 10 categories in the data: Smileys & Emotion (169), People & Body (386), Animals & Nature (159), Food & Drink (131), Travel & Places (218), Activities (85), Objects (264), Symbols (224), Flags (270). The Component category (5 entries) is excluded.
- Display order: Frequently Used, Custom (if any), then the 9 standard categories above

### Skin Tones

- `emoji-datasource-twitter` includes `skin_variations` per emoji (323 emojis support skin tones), each variant with its own `sheet_x`/`sheet_y`
- 5 standard tones keyed `1F3FB` through `1F3FF`
- Skin tone selector: 6 tone dots (default + 5 tones) in the picker header/preview area
- Preference stored in localStorage
- When set, emojis with skin support render the variant's sprite position instead of the default
- Emojis without skin support are unaffected
- **Phase 1 simplification**: 13 two-person emojis (couples, handshakes) have combined skin tone keys (`1F3FB-1F3FC` etc., 25 combinations each). In Phase 1, show only the single-tone variant matching the user's preference. Full two-person tone combos deferred.

### Frequently Used

- Track usage in localStorage: map of `unified -> { count, lastUsed }`
- Top 24-30 emojis by count populate the "Frequently Used" category at the top
- Updated on each `onEmojiClick`
- **Migration**: On first load, check for `emoji-picker-react`'s existing data under the `epr_suggested` localStorage key (stored as `[{ unified, original, count }]`). Convert to the new format so users don't lose their history.

### Custom Space Emojis

- Passed via `customEmojis` prop (same format as current: `{ id, names[], imgUrl }`)
- Rendered as individual `<img>` tags (not on sprite sheet, since they're user-uploaded)
- Shown in a "Custom" category after Frequently Used
- Searchable by their `names`

### Styling

- Designed fresh using Quorum's existing design tokens (CSS variables)
- Dark theme by default, light theme support via `theme` prop
- No dependency on `emoji-picker-react`'s SCSS -- the current 118 lines of overrides in `_emoji-picker.scss` will be replaced
- Responsive: width/height configurable, emoji grid adapts columns to available width, touch targets sized for mobile

### Integration Points (8 render sites across 6 files)

All current `<EmojiPicker>` / `<LazyEmojiPicker>` instances are replaced:

1. `src/components/space/Channel.tsx` -- channel composer panel (lazy loaded)
2. `src/components/direct/DirectMessage.tsx` -- DM composer panel (lazy loaded)
3. `src/components/thread/ThreadPanel.tsx` -- thread composer panel (lazy loaded)
4. `src/components/message/EmojiPickerDrawer.tsx` -- mobile bottom sheet drawer (via MobileProvider)
5. `src/components/message/Message.tsx:683` -- reaction picker (absolute positioned, direction-based)
6. `src/components/message/Message.tsx:710` -- reaction picker (portal, context menu, fixed position)
7. `src/components/message/Message.tsx:737` -- reaction picker (modal wrapper, mobile guard -- may be legacy/dead path since mobile now routes through MobileProvider's EmojiPickerDrawer; verify during implementation)

Lazy loading via `React.lazy()` stays for Channel, DM, and Thread (same pattern as now). The picker component itself is the lazy boundary.

**Imports to replace beyond render sites:**
- `SuggestionMode`, `SkinTonePickerLocation`, `Theme` enums -- dropped entirely (they were props for the old component)
- `CustomEmoji` deep import from `emoji-picker-react/dist/config/customEmojiConfig` -- replaced with our own exported type (used in 9 files)

### Mobile Drawer

The drawer container (`EmojiPickerDrawer.tsx`) remains unchanged -- it's just a bottom sheet wrapper. The picker inside it renders full-width with a taller height. Sticker tabs are completely separate from the picker (controlled by `EmojiPickerDrawer`'s local `useState<'emojis' | 'stickers'>`, with `<EmojiPicker>` only mounted when `activeTab === 'emojis'`).

## Cleanup After Migration

- Remove `emoji-picker-react` dependency
- Remove `emoji-datasource-apple` dependency (if still present)
- Delete `src/styles/_emoji-picker.scss`
- Update `useEmojiPicker` hook -- it imports `CustomEmoji` as a value import (not just type), casts data `as CustomEmoji`, and leaks the type to all callers. Re-point to our internal type.
- Replace `CustomEmoji` imports in all 9 files listed above

**Note**: The individual PNGs at `/twitter/64/*.png` must be kept -- they are used throughout the codebase for rendering emojis in messages (`remarkTwemoji.ts`), reaction badges (`ReactionsList.tsx`, `ReactionsModal.tsx`), and message action quick-reactions (`MessageActions.tsx`, `MessageActionsMenu.tsx`, `MessageActionsDrawer.tsx`). Only the picker changes from individual images to sprite sheets; all other emoji rendering stays on individual PNGs.

## Phasing

### Phase 1 -- Core picker (replaces emoji-picker-react) ✓ Complete

- Emoji grid with sprite sheet rendering (sheets-clean/32.png, 4.7MB)
- Virtualized grid with VirtuosoGrid (sentinel headers, rangeChanged for active tab)
- Category tab bar with scroll-to-section
- Search (in-memory filter over 1,911 entries)
- Skin tone selector with localStorage preference (single-tone variants only)
- Frequently used tracking (localStorage, with migration from epr_suggested)
- Custom space emojis category
- `onEmojiClick` callback with `EmojiData`
- Export `CustomEmoji` type for 9 consumer files
- Dark theme with Quorum design tokens
- Mobile-friendly (responsive sizing, touch targets)
- Swap into all 8 render sites across 6 files
- Remove old dependencies and unused imports

## References

- [Rebuilding Slack's Emoji Picker in React](https://slack.engineering/rebuilding-slacks-emoji-picker-in-react/) -- Slack's approach, 85% faster first mount with virtualization + sprites
- [emoji-datasource-twitter (iamcal)](https://github.com/iamcal/emoji-data) -- sprite sheet format, sheet_x/sheet_y coordinates
- [Emoji at scale: CSS sprites vs individual images](https://medium.com/parlay-engineering/emoji-at-scale-render-performance-of-css-sprites-vs-individual-images-f0a0a2dd8039) -- performance benchmarks
- [emoji-picker-react PR #439](https://github.com/ealush/emoji-picker-react/pull/439) -- stalled virtualization PR
- [Existing library comparison report](../reports/emoji-picker-library-comparison_2026-02-24.md)

---

_Created: 2026-04-14_
_Updated: 2026-04-14 -- Corrected after deep review: emoji count (1,911 not 3,786), sprite sheet (sheets-clean/64.png at 2.4MB for Retina), virtualization (VirtuosoGrid not GroupedVirtuoso, rangeChanged not IntersectionObserver), background-size formula, CustomEmoji type scope (9 files), frequently-used migration, two-person skin tone simplification, sort_order requirement, gender variant data fields._
_Updated: 2026-04-14 -- Dropped Phase 2 (gender preference filter). Affects only 20 emoji groups out of 1,911; adds complexity for negligible user value._
