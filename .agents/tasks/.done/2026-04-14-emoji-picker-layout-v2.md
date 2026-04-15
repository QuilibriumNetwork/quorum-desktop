# Emoji Picker Layout V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the custom emoji picker layout with a vertical left sidebar for categories, search + skin tone selector in the top bar, an emoji hover preview bar at the bottom, improved hover effects, and a larger panel size (380×480px desktop, responsive on mobile).

**Architecture:** All changes are contained within `src/components/emoji-picker/`. The `EmojiPicker.tsx` layout changes from a stacked header+grid to a three-zone layout: top bar (search + skin tone), body (left sidebar + right grid), bottom preview bar. The skin tone popover is a new local component rendered inline. A `hoveredEmoji` state drives the bottom preview. Panel dimensions increase to 380×480px with CSS clamp for responsiveness. No changes to consumers or data layer.

**Tech Stack:** React, TypeScript, SCSS with Quorum design tokens (`_variables.scss`), `EmojiSprite` for category icons and preview, existing `Button` primitive, `useSkinTone` / `useFrequentlyUsed` hooks unchanged.

**Key styling rules:** Use `$s-*` spacing, `$rounded-*`, `$text-*`, `$shadow-*`, `$duration-*` variables. Semantic CSS color variables only. No raw `px` except where noted (sprite math). No `@apply`. `--color-text-main` is an RGB tuple — wrap in `rgb()`. Chromeless picker — parent provides border/shadow/radius.

---

## File Structure

### Files to modify

```
src/components/emoji-picker/EmojiPicker.tsx     -- Layout restructure, new state, skin tone popover
src/components/emoji-picker/EmojiPicker.scss    -- New layout zones, sidebar, preview bar, hover effect, skin tone popover, responsive sizing
src/components/emoji-picker/types.ts            -- Add FREQUENTLY_USED_MAX constant (bump to 24)
src/components/emoji-picker/useFrequentlyUsed.ts -- Update MAX_FREQUENT to 24
```

### No new files needed

All changes fit in the existing component. The skin tone popover is a small inline section of `EmojiPicker.tsx`, not a separate file.

---

## Task 1: Update panel dimensions and layout skeleton in SCSS

**Files:**
- Modify: `src/components/emoji-picker/EmojiPicker.scss`

- [ ] **Step 1: Replace the `.emoji-picker` root and add layout zones**

Replace the entire contents of `src/components/emoji-picker/EmojiPicker.scss` with:

```scss
// src/components/emoji-picker/EmojiPicker.scss
// Chromeless picker -- no border, shadow, or radius.
// Parent containers provide the visual frame.
@use '@/styles/variables' as *;

// Root: responsive size via clamp so it shrinks on narrow viewports (mobile web)
.emoji-picker {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: Sen, sans-serif;
  // 380px wide, shrinks to 92vw on narrow screens; 480px tall, shrinks to 80vh
  width: clamp(280px, 92vw, 380px);
  height: clamp(340px, 80vh, 480px);
}

// ── Top bar: search field + skin tone trigger ──────────────────────────────
.emoji-picker__topbar {
  display: flex;
  align-items: center;
  gap: $s-2;
  padding: $s-2 $s-2 $s-2 $s-2;
  border-bottom: 1px solid var(--color-border-default);
  flex-shrink: 0;
}

.emoji-picker__search-wrap {
  flex: 1;
  min-width: 0;
}

// ── Skin tone trigger (single dot, right of search) ───────────────────────
.emoji-picker__skin-trigger {
  position: relative;
  flex-shrink: 0;
}

.emoji-picker__skin-dot {
  width: $s-6;
  height: $s-6;
  border-radius: $rounded-full;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color $duration-150 ease-in-out,
              transform $duration-150 ease-in-out;

  &:hover {
    transform: scale(1.15);
  }

  &--open {
    border-color: var(--accent);
  }
}

// Floating popover with 6 tone dots
.emoji-picker__skin-popover {
  position: absolute;
  top: calc(100% + #{$s-1-5});
  right: 0;
  display: flex;
  gap: $s-1-5;
  padding: $s-1-5 $s-2;
  background: var(--color-bg-modal);
  border: 1px solid var(--color-border-default);
  border-radius: $rounded-lg;
  box-shadow: $shadow-lg;
  z-index: 10;

  .emoji-picker__skin-dot {
    &--active {
      border-color: var(--accent);
    }
  }
}

// ── Body: sidebar + grid ───────────────────────────────────────────────────
.emoji-picker__body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

// Left sidebar: category icon list, vertically scrollable
.emoji-picker__sidebar {
  width: $s-12; // 48px
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid var(--color-border-default);
  scrollbar-width: none;
  padding: $s-1 0;

  &::-webkit-scrollbar {
    display: none;
  }
}

.emoji-picker__category-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: $s-10; // 40px touch target
  flex-shrink: 0;
  opacity: 0.45;
  transition: opacity $duration-150 ease-in-out,
              background-color $duration-150 ease-in-out;

  &:hover {
    background-color: var(--surface-3);
    opacity: 0.75;
  }

  &--active {
    opacity: 1;
    background-color: var(--surface-3);

    // Left accent bar
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 25%;
      bottom: 25%;
      width: 3px;
      border-radius: 0 $rounded-sm $rounded-sm 0;
      background: var(--accent);
    }
  }
}

// ── Emoji grid (right of sidebar) ─────────────────────────────────────────
.emoji-picker__grid-container {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.emoji-picker__row-header {
  padding: $s-1-5 $s-2 $s-1;
  font-size: $text-xs;
  font-weight: $font-bold;
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.emoji-picker__emoji-row {
  display: flex;
  gap: $s-0-5;
  padding: 0 $s-1-5;
}

.emoji-picker__emoji-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: $s-9;
  height: $s-9;
  border-radius: $rounded-md;
  transition: background-color $duration-150 ease-in-out;
  flex-shrink: 0;

  &:hover {
    background-color: var(--surface-3);
  }
}

.emoji-picker__custom-emoji-img {
  width: $s-7;
  height: $s-7;
  object-fit: contain;
}

.emoji-picker__no-results {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $s-8;
  color: var(--color-text-subtle);
  font-size: $text-sm;
}

// ── Bottom preview bar ─────────────────────────────────────────────────────
.emoji-picker__preview {
  display: flex;
  align-items: center;
  gap: $s-3;
  padding: $s-2 $s-3;
  border-top: 1px solid var(--color-border-default);
  flex-shrink: 0;
  min-height: $s-12; // 48px — reserve space even when empty
}

.emoji-picker__preview-sprite {
  flex-shrink: 0;
}

.emoji-picker__preview-name {
  font-size: $text-sm;
  color: var(--color-text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.emoji-picker__preview-empty {
  font-size: $text-xs;
  color: var(--color-text-subtle);
  opacity: 0.5;
}
```

- [ ] **Step 2: Verify the app compiles without errors**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -30
```

Expected: no errors related to `EmojiPicker.scss`.

---

## Task 2: Restructure EmojiPicker.tsx layout

**Files:**
- Modify: `src/components/emoji-picker/EmojiPicker.tsx`

This task replaces the top-level JSX structure. The `width`/`height` props are removed — sizing is now handled by CSS clamp in the SCSS. The header (horizontal category tabs) is replaced by a vertical sidebar. The search moves into a top bar alongside the skin tone trigger.

- [ ] **Step 1: Remove `width`/`height` from the props interface and defaults**

In `EmojiPicker.tsx`, change the props interface and destructuring:

```tsx
interface EmojiPickerProps {
  onEmojiClick: (emoji: EmojiData) => void;
  customEmojis?: CustomEmoji[];
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onEmojiClick,
  customEmojis = [],
}) => {
```

- [ ] **Step 2: Add `hoveredEmoji` state and skin tone popover state**

After the existing state declarations (after `const [columnsCount, setColumnsCount] = useState(DEFAULT_COLUMNS);`), add:

```tsx
const [hoveredEmoji, setHoveredEmoji] = useState<{ shortName: string; sheetX: number; sheetY: number; isCustom?: boolean; customImgUrl?: string } | null>(null);
const [skinPopoverOpen, setSkinPopoverOpen] = useState(false);
const skinTriggerRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Add a click-outside handler to close the skin popover**

After the existing `useEffect` hooks, add:

```tsx
useEffect(() => {
  if (!skinPopoverOpen) return;
  const handleClickOutside = (e: MouseEvent) => {
    if (skinTriggerRef.current && !skinTriggerRef.current.contains(e.target as Node)) {
      setSkinPopoverOpen(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [skinPopoverOpen]);
```

- [ ] **Step 4: Remove `width` and `height` from the `ResizeObserver` `useEffect`**

The existing measure effect passes `width` to the container style. Since sizing is now CSS-only, the observer just needs to recompute column count. The effect stays the same — it already uses `containerRef.current.clientWidth`. No change needed here; just confirm it still reads from `containerRef`.

- [ ] **Step 5: Update `renderRow` to add hover callbacks**

Replace the `renderRow` function:

```tsx
const renderRow = useCallback(
  (index: number) => {
    const row = displayRows[index];
    if (!row) return null;

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
              onMouseEnter={() => setHoveredEmoji({ shortName: `:${ce.names[0]}:`, sheetX: -1, sheetY: -1, isCustom: true, customImgUrl: ce.imgUrl })}
              onMouseLeave={() => setHoveredEmoji(null)}
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
              onMouseEnter={() => setHoveredEmoji({ shortName: `:${item.shortName}:`, sheetX, sheetY })}
              onMouseLeave={() => setHoveredEmoji(null)}
              title={item.shortName}
            >
              <EmojiSprite sheetX={sheetX} sheetY={sheetY} label={item.shortName} />
            </Button>
          );
        })}
      </div>
    );
  },
  [displayRows, skinTone, handleEmojiClick, handleCustomEmojiClick]
);
```

- [ ] **Step 6: Replace the return JSX with the new three-zone layout**

Replace the entire `return (...)` block:

```tsx
// Skin tone dot color map
const SKIN_TONE_COLORS: Record<string, string> = {
  default: '#FFCC22',
  '1F3FB': '#F7D7C4',
  '1F3FC': '#E8B88A',
  '1F3FD': '#C68642',
  '1F3FE': '#8D5524',
  '1F3FF': '#4A2912',
};

const currentToneColor = SKIN_TONE_COLORS[skinTone ?? 'default'];

return (
  <div className="emoji-picker" ref={containerRef}>
    {/* Top bar: search + skin tone */}
    <div className="emoji-picker__topbar">
      <div className="emoji-picker__search-wrap">
        <ListSearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t`Search emoji...`}
          variant="bordered"
        />
      </div>

      {/* Skin tone trigger */}
      <div className="emoji-picker__skin-trigger" ref={skinTriggerRef}>
        <div
          className={`emoji-picker__skin-dot${skinPopoverOpen ? ' emoji-picker__skin-dot--open' : ''}`}
          style={{ backgroundColor: currentToneColor }}
          onClick={() => setSkinPopoverOpen((v) => !v)}
          role="button"
          aria-label={t`Select skin tone`}
          aria-expanded={skinPopoverOpen}
        />

        {skinPopoverOpen && (
          <div className="emoji-picker__skin-popover">
            {SKIN_TONES.map((tone) => (
              <div
                key={tone ?? 'default'}
                className={`emoji-picker__skin-dot${skinTone === tone ? ' emoji-picker__skin-dot--active' : ''}`}
                style={{ backgroundColor: SKIN_TONE_COLORS[tone ?? 'default'] }}
                onClick={() => { setSkinTone(tone); setSkinPopoverOpen(false); }}
                role="button"
                aria-label={SKIN_TONE_LABELS[tone ?? 'default']}
              />
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Body: sidebar + grid */}
    <div className="emoji-picker__body">
      {/* Left sidebar — hidden during search */}
      {!isSearching && (
        <div className="emoji-picker__sidebar">
          {availableCategories.map((cat) => (
            <Button
              key={cat}
              type="unstyled"
              className={`emoji-picker__category-btn${activeCategory === cat ? ' emoji-picker__category-btn--active' : ''}`}
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
            itemContent={renderRow}
            rangeChanged={handleRangeChanged}
          />
        )}
      </div>
    </div>

    {/* Bottom preview bar */}
    <div className="emoji-picker__preview">
      {hoveredEmoji ? (
        <>
          <div className="emoji-picker__preview-sprite">
            {hoveredEmoji.isCustom && hoveredEmoji.customImgUrl ? (
              <img src={hoveredEmoji.customImgUrl} alt={hoveredEmoji.shortName} style={{ width: 32, height: 32, objectFit: 'contain' }} />
            ) : (
              <EmojiSprite sheetX={hoveredEmoji.sheetX} sheetY={hoveredEmoji.sheetY} size={32} label={hoveredEmoji.shortName} />
            )}
          </div>
          <span className="emoji-picker__preview-name">{hoveredEmoji.shortName}</span>
        </>
      ) : (
        <span className="emoji-picker__preview-empty">{t`Hover an emoji to preview`}</span>
      )}
    </div>
  </div>
);
```

Note: the `SKIN_TONE_COLORS` and `currentToneColor` constants should be defined **above** the `return` statement inside the component body, not inside the JSX.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -40
```

Expected: no errors in `EmojiPicker.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/components/emoji-picker/EmojiPicker.tsx src/components/emoji-picker/EmojiPicker.scss
git commit -m "feat(emoji-picker): v2 layout — vertical sidebar, search+skin top bar, preview bar"
```

---

## Task 3: Update consumers that passed `width`/`height` props

**Files:**
- Modify: `src/components/message/Message.tsx`
- Modify: `src/components/message/EmojiPickerDrawer.tsx`
- Modify: `src/components/space/Channel.tsx` (if applicable)
- Modify: `src/components/direct/DirectMessage.tsx` (if applicable)
- Modify: `src/components/thread/ThreadPanel.tsx` (if applicable)

Since `width` and `height` props are removed from `EmojiPicker`, any consumer passing them will get a TypeScript error. Remove those props from all call sites.

- [ ] **Step 1: Find all EmojiPicker usages passing width/height**

```bash
grep -rn "width=\|height=" src/components/message/EmojiPickerDrawer.tsx src/components/message/Message.tsx src/components/space/Channel.tsx src/components/direct/DirectMessage.tsx src/components/thread/ThreadPanel.tsx 2>/dev/null
```

- [ ] **Step 2: Remove `width` and `height` props from all EmojiPicker usages found above**

In `src/components/message/EmojiPickerDrawer.tsx`, the `<EmojiPicker>` call currently has:
```tsx
<EmojiPicker
  width="100%"
  height={hasStickers ? 540 : 600}
  customEmojis={customEmojis}
  onEmojiClick={handleEmojiClick}
/>
```

Replace with:
```tsx
<EmojiPicker
  customEmojis={customEmojis}
  onEmojiClick={handleEmojiClick}
/>
```

Remove any other `width`/`height` props on `<EmojiPicker>` in the other files found in Step 1.

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/message/EmojiPickerDrawer.tsx src/components/message/Message.tsx
git commit -m "chore(emoji-picker): remove width/height props from all consumers"
```

---

## Task 4: Bump frequently used emoji cap to 24

**Files:**
- Modify: `src/components/emoji-picker/useFrequentlyUsed.ts`
- Modify: `src/components/emoji-picker/types.ts`

The new layout has more vertical space — 3 rows of 8 = 24 emojis fits well.

- [ ] **Step 1: Update `MAX_FREQUENT` in `useFrequentlyUsed.ts`**

```ts
const MAX_FREQUENT = 24;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/emoji-picker/useFrequentlyUsed.ts
git commit -m "feat(emoji-picker): bump frequently used cap to 24 (3 rows)"
```

---

## Task 5: Fix column count for narrower grid

**Files:**
- Modify: `src/components/emoji-picker/EmojiPicker.tsx`

The emoji grid is now narrower because the sidebar takes 48px. With a 380px panel, sidebar=48px, border=1px → grid width ≈ 331px. At `$s-9` (36px) cells with `$s-0-5` (2px) gaps and `$s-1-5` (6px) horizontal padding each side → usable width ≈ 319px → fits ~8 columns. The `ResizeObserver` already measures `containerRef` (the whole picker) width. We need to account for the sidebar width in the column calculation.

- [ ] **Step 1: Update the column count calculation**

The `containerRef` is on the outer `.emoji-picker` div. The sidebar is 48px + 1px border = 49px. Update the measure function inside the `useEffect`:

```tsx
useEffect(() => {
  if (!containerRef.current) return;
  const SIDEBAR_WIDTH = 49; // $s-12 (48px) + 1px border
  const measure = () => {
    const w = containerRef.current?.clientWidth ?? 380;
    const gridWidth = w - SIDEBAR_WIDTH - H_PADDING;
    setColumnsCount(Math.max(1, Math.floor(gridWidth / CELL_SIZE)));
  };
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(containerRef.current);
  return () => observer.disconnect();
}, []);
```

- [ ] **Step 2: Verify column count is correct at 380px**

380 - 49 - 16 = 315px / 36px = ~8 columns. Check in browser that the grid renders 8 columns.

- [ ] **Step 3: Commit**

```bash
git add src/components/emoji-picker/EmojiPicker.tsx
git commit -m "fix(emoji-picker): account for sidebar width in grid column calculation"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Left sidebar, icon-only, vertically scrollable — Task 2 Step 6
- ✅ Search + skin tone in top bar — Task 2 Step 6
- ✅ Skin tone: single dot trigger → floating popover — Task 2 Steps 2-3, Step 6
- ✅ Emoji hover effect (`surface-3` background) — Task 1 Step 1 (`.emoji-picker__emoji-btn:hover`)
- ✅ Bottom preview bar: large sprite + `:short_name:` — Task 2 Steps 5-6
- ✅ Panel size 380×480px with responsive clamp — Task 1 Step 1
- ✅ Category order: Frequently Used → Custom → standard categories — unchanged from data layer (already correct in `emojiData.ts`)
- ✅ Frequently used cap 24 — Task 4
- ✅ Width/height props removed from consumers — Task 3
- ✅ Column count adjusted for sidebar — Task 5
- ✅ EmojiSprite used for category icons (no Tabler change needed) — Task 2 Step 6

**Placeholder scan:** No TBDs or TODOs found.

**Type consistency:**
- `hoveredEmoji` state type defined in Step 2, used in Steps 5 and 6 — consistent.
- `SKIN_TONE_COLORS` defined above return, referenced in Step 6 — consistent.
- `skinPopoverOpen` / `setSkinPopoverOpen` defined in Step 2, used in Steps 3 and 6 — consistent.
- `skinTriggerRef` defined in Step 2, used in Steps 3 and 6 — consistent.

---

*Last updated: 2026-04-14*
