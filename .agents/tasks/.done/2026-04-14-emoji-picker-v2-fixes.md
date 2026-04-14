# Emoji Picker v2 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix eight issues in the emoji picker v2: preview bar not working, category icons (clock/star), skin tone popover vertical layout, active-bar full height, hover contrast, stickers panel too small, top bar padding/search size, message-actions picker positioning and auto-close, and category scroll bug.

**Architecture:** Changes are spread across four areas: (1) `EmojiPicker.tsx` + `EmojiPicker.scss` for picker-internal fixes, (2) `emojiData.ts` + `types.ts` for category icon data, (3) `_chat.scss` for the stickers panel size, (4) `Message.tsx` + `MessageList.tsx` for positioning and auto-close. No new files needed.

**Tech Stack:** React 18, TypeScript, SCSS with Quorum design tokens (`_variables.scss`), Virtuoso for the emoji list, `emoji-datasource-twitter` for sprite data.

**Key facts for implementers:**
- `Button.web.tsx` from `@quilibrium/quorum-shared` only forwards `onClick` — not `onMouseEnter`/`onMouseLeave`. All emoji grid buttons must be plain `<button type="button">` elements.
- `CATEGORY_ICONS` in `types.ts` is an empty object at module load time; it gets populated by `buildEmojiIndex()` (called from `buildRowData`). "Frequently Used" and "Custom" are never added to it because they have no entry in `CATEGORY_ICON_CODES` in `emojiData.ts`.
- The stickers panel that wraps the emoji picker lives in `_chat.scss` (`.stickers-panel`: `width: 300px; height: 400px`) — it is smaller than the emoji picker (`380×480px`), causing clipping.
- `emojiPickerOpen` state lives in `MessageList.tsx`. The stickers panel state (`showStickers`) lives in `Channel.tsx` via `composer.showStickers`. They are independent — closing one does not close the other.
- The category scroll bug: `handleCategoryClick` calls `scrollToIndex({ index, align: 'start' })` then immediately sets `setActiveCategory`. But Virtuoso fires `rangeChanged` asynchronously after the scroll settles, which then overwrites the active category with whatever row is actually at the top — sometimes the *previous* category if scrolling upward doesn't move the viewport enough to put the header row at the top.

**Styling rules:** Use `$s-*` spacing, `$rounded-*`, `$text-*`, `$shadow-*`, `$duration-*` variables. Semantic CSS color variables only. No `@apply`. `var(--surface-5)` is `#d5d5db` light / stronger than `surface-3` — use for hover backgrounds in the emoji grid.

---

## File Structure

### Files to modify

```
src/components/emoji-picker/EmojiPicker.tsx        -- Replace Button with <button>, fix hover handlers, category icon fallbacks
src/components/emoji-picker/EmojiPicker.scss       -- Skin popover vertical, active bar full height, hover contrast, topbar padding, search size
src/components/emoji-picker/emojiData.ts           -- Add Frequently Used + Custom to CATEGORY_ICON_CODES
src/components/emoji-picker/types.ts               -- (if needed) verify CATEGORY_ICONS type supports new keys
src/styles/_chat.scss                              -- Grow stickers panel to 420×540px
src/components/message/Message.tsx                 -- Fix picker positioning (right offset, vertical clamp)
src/components/message/MessageList.tsx             -- Auto-close emojiPickerOpen when stickers panel opens
src/components/space/Channel.tsx                   -- Close emojiPickerOpen when stickers button clicked; close stickers when composer focused
```

---

## Task 1: Fix emoji preview bar — replace Button with plain `<button>` in renderRow

**Root cause:** `Button.web.tsx` from `@quilibrium/quorum-shared` only passes `onClick` to the underlying `<button>` — `onMouseEnter` and `onMouseLeave` are silently dropped, so `hoveredEmoji` state never gets set.

**Files:**
- Modify: `src/components/emoji-picker/EmojiPicker.tsx`

- [ ] **Step 1: Remove the Button import and replace renderRow**

In `EmojiPicker.tsx`, remove the `Button` import line:
```tsx
import { Button } from '../primitives';
```

Then replace the entire `renderRow` useCallback with:

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
            <button
              key={ce.id}
              type="button"
              className="emoji-picker__emoji-btn"
              onClick={() => handleCustomEmojiClick(ce)}
              onMouseEnter={() => setHoveredEmoji({ shortName: `:${ce.names[0]}:`, sheetX: -1, sheetY: -1, isCustom: true, customImgUrl: ce.imgUrl })}
              onMouseLeave={() => setHoveredEmoji(null)}
              title={ce.names[0]}
            >
              <img src={ce.imgUrl} alt={ce.names[0]} className="emoji-picker__custom-emoji-img" />
            </button>
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
            <button
              key={item.unified}
              type="button"
              className="emoji-picker__emoji-btn"
              onClick={() => handleEmojiClick(item)}
              onMouseEnter={() => setHoveredEmoji({ shortName: `:${item.shortName}:`, sheetX, sheetY })}
              onMouseLeave={() => setHoveredEmoji(null)}
              title={item.shortName}
            >
              <EmojiSprite sheetX={sheetX} sheetY={sheetY} label={item.shortName} />
            </button>
          );
        })}
      </div>
    );
  },
  [displayRows, skinTone, handleEmojiClick, handleCustomEmojiClick]
);
```

Also replace the sidebar category buttons — they used `Button` from primitives. Replace:
```tsx
<Button
  key={cat}
  type="unstyled"
  className={`emoji-picker__category-btn${activeCategory === cat ? ' emoji-picker__category-btn--active' : ''}`}
  onClick={() => handleCategoryClick(cat)}
  title={cat}
>
  ...
</Button>
```
With:
```tsx
<button
  key={cat}
  type="button"
  className={`emoji-picker__category-btn${activeCategory === cat ? ' emoji-picker__category-btn--active' : ''}`}
  onClick={() => handleCategoryClick(cat)}
  title={cat}
>
  ...
</button>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -20
```

Expected: only the pre-existing `ImportKeyStep.tsx` error. No errors in `EmojiPicker.tsx`.

- [ ] **Step 3: Commit**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && git add src/components/emoji-picker/EmojiPicker.tsx && git commit -m "fix(emoji-picker): replace Button primitive with plain button to fix mouse hover events"
```

---

## Task 2: Category icons — clock for Frequently Used, star for Custom

**Root cause:** `CATEGORY_ICON_CODES` in `emojiData.ts` has no entry for "Frequently Used" or "Custom", so `CATEGORY_ICONS` never gets those sprite coordinates, and the sidebar falls back to the native `📁` emoji.

The clock emoji is `1F552` (🕒, "clock three") and the star is `2B50` (⭐, "white medium star") — both present in `emoji-datasource-twitter`.

**Files:**
- Modify: `src/components/emoji-picker/emojiData.ts`

- [ ] **Step 1: Add Frequently Used and Custom to CATEGORY_ICON_CODES**

In `emojiData.ts`, find `CATEGORY_ICON_CODES` and add two entries:

```ts
const CATEGORY_ICON_CODES: Record<string, string> = {
  'Frequently Used': '1F552',   // 🕒 clock three
  'Custom': '2B50',             // ⭐ white medium star
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
```

- [ ] **Step 2: Update the EmojiPicker.tsx sidebar fallback**

The current fallback in the sidebar is `<span style={{ fontSize: '1.125rem' }}>📁</span>`. Since "Frequently Used" and "Custom" will now have sprite entries (after `buildEmojiIndex()` runs), the existing `CATEGORY_ICONS[cat] ?` check will pick them up automatically.

However, `CATEGORY_ICONS` is populated lazily — it's filled when `buildEmojiIndex()` runs (which happens on the first `buildRowData()` call, which happens before the sidebar renders). So the fallback `📁` should never be seen for these categories anymore. Keep the fallback as a safety net but change it to a neutral symbol:

In `EmojiPicker.tsx`, find the fallback span and change it to:
```tsx
) : (
  <span style={{ fontSize: '1rem', lineHeight: 1 }}>●</span>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -20
```

Expected: only the pre-existing `ImportKeyStep.tsx` error.

- [ ] **Step 4: Commit**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && git add src/components/emoji-picker/emojiData.ts src/components/emoji-picker/EmojiPicker.tsx && git commit -m "fix(emoji-picker): add clock/star category icons for Frequently Used and Custom"
```

---

## Task 3: SCSS fixes — skin popover vertical, active bar full height, hover contrast, topbar padding, search font

**Files:**
- Modify: `src/components/emoji-picker/EmojiPicker.scss`

All changes are in this one file. Make them all at once.

- [ ] **Step 1: Apply all SCSS changes**

Replace the full contents of `EmojiPicker.scss` with the following (changes annotated with `// CHANGED:`):

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
  padding: $s-3 $s-4; // CHANGED: was $s-2 — more breathing room around search
  border-bottom: 1px solid var(--color-border-default);
  flex-shrink: 0;
}

.emoji-picker__search-wrap {
  flex: 1;
  min-width: 0;

  // CHANGED: shrink search field font and input height
  input {
    font-size: $text-xs;
  }
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

// Floating popover with 6 tone dots — CHANGED: vertical column layout
.emoji-picker__skin-popover {
  position: absolute;
  top: calc(100% + #{$s-1-5});
  right: 0;
  display: flex;
  flex-direction: column; // CHANGED: was row, now vertical stack
  gap: $s-1-5;
  padding: $s-2 $s-1-5;
  background: var(--color-bg-modal);
  border: 1px solid var(--color-border-default);
  border-radius: $rounded-lg;
  box-shadow: $shadow-lg;
  z-index: 10;
}

.emoji-picker__skin-popover .emoji-picker__skin-dot--active {
  border-color: var(--accent);
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
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: opacity $duration-150 ease-in-out,
              background-color $duration-150 ease-in-out;

  &:hover {
    background-color: var(--surface-5); // CHANGED: was surface-3, stronger contrast
    opacity: 0.85;                       // CHANGED: was 0.75
  }

  &--active {
    opacity: 1;
    background-color: var(--surface-4); // CHANGED: was surface-3

    // Left accent bar — CHANGED: full height (top:0 bottom:0), no border-radius
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;    // CHANGED: was 25%
      bottom: 0; // CHANGED: was 25%
      width: 3px;
      border-radius: 0; // CHANGED: was rounded-sm
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
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background-color $duration-150 ease-in-out;
  flex-shrink: 0;

  &:hover {
    background-color: var(--surface-5); // CHANGED: was surface-3, stronger contrast
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

- [ ] **Step 2: Verify TypeScript compiles (SCSS errors show at build time, not tsc)**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -10
```

Expected: only the pre-existing `ImportKeyStep.tsx` error.

- [ ] **Step 3: Commit**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && git add src/components/emoji-picker/EmojiPicker.scss && git commit -m "fix(emoji-picker): vertical skin popover, full-height active bar, stronger hover contrast, topbar padding"
```

---

## Task 4: Grow stickers panel to fit emoji picker

**Root cause:** `.stickers-panel` in `_chat.scss` is `width: 300px; height: 400px`. The emoji picker inside it is `clamp(280px, 92vw, 380px)` wide and `clamp(340px, 80vh, 480px)` tall, plus the tab bar (~40px). The picker gets clipped.

**Fix:** Set `.stickers-panel` to `width: 420px; height: 560px`. This gives the picker full room (380px picker + some breathing) and the tab bar. The sticker grid also gets this extra space automatically since it uses `flex: 1`.

**Files:**
- Modify: `src/styles/_chat.scss`

- [ ] **Step 1: Update stickers panel dimensions**

In `_chat.scss`, find `.stickers-panel` and change `width` and `height`:

```scss
// Panel content
.stickers-panel {
  display: flex;
  flex-direction: column;
  width: 420px;   // CHANGED: was 300px — fits 380px picker + breathing room
  height: 560px;  // CHANGED: was 400px — fits 480px picker + 40px tab bar + borders
  border: $border solid var(--color-border-default);
  border-radius: $rounded-lg;
  background-color: var(--color-bg-modal);
  box-shadow: $shadow-lg;
  pointer-events: auto;
  overflow: hidden;
}
```

Also update `.stickers-panel-grid` width to match (it has a hardcoded `width: 300px`):

```scss
.stickers-panel-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr); // CHANGED: was 3, now 4 to use extra width
  grid-auto-rows: min-content;
  gap: $s-1;
  width: 100%;    // CHANGED: was 300px — fill panel width
  padding: $s-4;
  overflow-y: auto;
  flex: 1;
}
```

Also update `.sticker-item` — with 4 columns in a 420px panel (minus 32px padding and 12px gaps), each item is ~(420-32-36)/4 ≈ 88px. Keep at `80px` or let grid handle sizing:

```scss
.sticker-item {
  display: flex;
  justify-content: center;
  align-items: center;
  aspect-ratio: 1; // CHANGED: was fixed width/height 80px — let grid control size
  padding: $s-1;
  border-radius: $rounded-lg;
  background-color: var(--surface-0);
  cursor: pointer;
  transition: all $duration-200 $ease-in-out;

  &:hover {
    background-color: var(--surface-6);
    transform: scale(1.05);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && git add src/styles/_chat.scss && git commit -m "fix(stickers-panel): grow to 420x560 to fit emoji picker, 4-column sticker grid"
```

---

## Task 5: Fix message-actions emoji picker positioning

**Current behavior:** The picker opens `absolute right-4` relative to the message content div, with `bottom-6` or `top-0` depending on direction. It covers the cursor and the actions toolbar.

**Fix:** Shift it further right so it opens to the **left** of the actions toolbar. The message actions toolbar is on the right edge of the message. Change `right-4` to a class that positions it so the picker's right edge aligns a bit left of the actions toolbar — specifically use `right-10` (40px from right, which moves the picker left enough to not obscure the action buttons). Also fix the vertical: when `upwards`, use `bottom-full mb-1` (picker floats entirely above the message content div) instead of `bottom-6`. When downwards, use `top-full mt-1` to open below the message content div — **verify this with single-line messages**, as `top-full` relative to `.message-content` places the picker below the whole message div and may overlap the next message row or be clipped by the Virtuoso scroll container on short messages. If that happens, fall back to `top-0 right-12` instead.

For the **portal picker** (context menu, `emojiPickerPosition`), fix the clamp values:
- `window.innerWidth - 352` → `window.innerWidth - 400` (picker is 380px + 20px buffer)
- `window.innerHeight - 435` → `window.innerHeight - 500` (picker is 480px + 20px buffer)

**Files:**
- Modify: `src/components/message/Message.tsx`

- [ ] **Step 1: Fix the inline picker (no emojiPickerPosition) positioning**

In `Message.tsx` at line ~673, find:

```tsx
{emojiPickerOpen === message.messageId && !emojiPickerPosition && (
  <div
    onClick={(e: React.MouseEvent) => e.stopPropagation()}
    className={
      'absolute right-4 z-[9999] bg-modal border border-default rounded-lg shadow-lg overflow-hidden ' +
      (emojiPickerOpenDirection == 'upwards'
        ? 'bottom-6'
        : 'top-0')
    }
  >
```

Replace with:

```tsx
{emojiPickerOpen === message.messageId && !emojiPickerPosition && (
  <div
    onClick={(e: React.MouseEvent) => e.stopPropagation()}
    className={
      'absolute right-10 z-[9999] bg-modal border border-default rounded-lg shadow-lg overflow-hidden ' +
      (emojiPickerOpenDirection == 'upwards'
        ? 'bottom-full mb-1'
        : 'top-full mt-1')
    }
  >
```

- [ ] **Step 2: Fix the portal picker clamp values**

In `Message.tsx` at line ~697, find:

```tsx
style={{
  left: Math.min(emojiPickerPosition.x, window.innerWidth - 352),
  top: Math.min(emojiPickerPosition.y, window.innerHeight - 435),
}}
```

Replace with:

```tsx
style={{
  left: Math.min(emojiPickerPosition.x, window.innerWidth - 400),
  top: Math.min(emojiPickerPosition.y, window.innerHeight - 500),
}}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && git add src/components/message/Message.tsx && git commit -m "fix(emoji-picker): adjust message-actions positioning to not cover toolbar"
```

---

## Task 6: Auto-close emoji picker when stickers panel opens (and vice versa)

**Problem:** Opening the stickers panel from the composer while the message-actions emoji picker is open leaves both visible. Clicking the composer input should also close the message-actions picker.

**Architecture:**
- `emojiPickerOpen` state lives in `MessageList.tsx` and is passed down to each `Message` component as props.
- `composer.showStickers` (and `composer.setShowStickers`) lives in `Channel.tsx`.
- To close `emojiPickerOpen` from Channel.tsx's stickers button, we need `setEmojiPickerOpen` accessible at the Channel level. `MessageList` exposes `setEmojiPickerOpen` via props that Channel passes down. Check if `setEmojiPickerOpen` bubbles up to Channel — it does not currently.
- The simplest approach: expose a `closeEmojiPicker` callback from `MessageList` via a `ref` or prop, OR simply listen to a shared event. The cleanest approach without major refactor: since `MessageList` already receives and forwards `setEmojiPickerOpen` through props, and `Channel` owns the `MessageList`, we can lift `emojiPickerOpen` state from `MessageList` up to `Channel` — but that's a large refactor.

**Pragmatic fix:** Use a module-level event bus pattern with a custom DOM event. When the stickers panel opens, dispatch a `close-emoji-picker` custom event on `document`. `MessageList` listens for this event and calls `setEmojiPickerOpen(undefined)`. Same approach: when the message-actions picker opens (any `setEmojiPickerOpen` call with a non-null value), close the stickers panel by dispatching `close-stickers-panel`.

**Files:**
- Modify: `src/components/message/MessageList.tsx`
- Modify: `src/components/space/Channel.tsx`

- [ ] **Step 1: Add event listener in MessageList.tsx to close picker on external signal**

In `MessageList.tsx`, inside the `MessageList` `forwardRef` callback (where `emojiPickerOpen` and `setEmojiPickerOpen` are defined at lines 178-179), add a `useEffect` after the existing effect that resets `emojiPickerPosition` (lines 184-188):

```tsx
// Close emoji picker when stickers panel opens
useEffect(() => {
  const handleClose = () => setEmojiPickerOpen(undefined);
  document.addEventListener('quorum:close-emoji-picker', handleClose);
  return () => document.removeEventListener('quorum:close-emoji-picker', handleClose);
}, [setEmojiPickerOpen]);
```

- [ ] **Step 2: Dispatch the event from Channel.tsx when stickers panel opens**

In `Channel.tsx`, find where `composer.setShowStickers(true)` is called (line ~1148):

```tsx
composer.setShowStickers(true);
```

Change to:

```tsx
composer.setShowStickers(true);
document.dispatchEvent(new CustomEvent('quorum:close-emoji-picker'));
```

- [ ] **Step 3: Also dispatch close-emoji-picker when the stickers backdrop is clicked or Escape pressed (to keep symmetry)**

In `Channel.tsx`, the sticker panel toggle button and backdrop already call `composer.setShowStickers(false)` — these don't need the event since closing stickers doesn't affect the emoji picker.

What we also want: when the stickers panel is open and the user clicks the composer area, close the stickers panel. The stickers panel already has a `.stickers-backdrop` click handler (`onClick={() => composer.setShowStickers(false)}`), so clicking outside the panel already works.

No additional changes needed here — the backdrop handles it.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -20
```

Expected: only the pre-existing `ImportKeyStep.tsx` error.

- [ ] **Step 5: Commit**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && git add src/components/message/MessageList.tsx src/components/space/Channel.tsx && git commit -m "fix(emoji-picker): auto-close message-actions picker when stickers panel opens"
```

---

## Task 7: Fix category scroll bug — debounce rangeChanged after manual scroll

**Root cause:** When clicking a category, `handleCategoryClick` calls `scrollToIndex({ index, align: 'start' })` and immediately sets `setActiveCategory(category)`. Virtuoso then fires `rangeChanged` asynchronously as the scroll settles — if the target category's header row ends up not quite at `startIndex` (which happens when scrolling upward, as Virtuoso may not reach the exact index), `handleRangeChanged` overwrites `activeCategory` with the nearest header *actually visible*, which may be the previous category.

**Fix:** Suppress `rangeChanged` updates for a short window (400ms) after a manual category click, using a `ignoreRangeChangedUntil` ref. After the debounce window expires, range tracking resumes normally.

**Files:**
- Modify: `src/components/emoji-picker/EmojiPicker.tsx`

- [ ] **Step 1: Add a scroll-lock ref and update handleCategoryClick and handleRangeChanged**

In `EmojiPicker.tsx`, add a new ref below the existing refs:

```tsx
// Suppress rangeChanged updates briefly after a manual category scroll
// to prevent Virtuoso's async scroll event from overwriting the clicked category.
const ignoreRangeChangedUntilRef = useRef<number>(0);
```

Then update `handleCategoryClick` to set the lock:

```tsx
const handleCategoryClick = useCallback(
  (category: string) => {
    const index = categoryRowIndices.get(category);
    if (index != null && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({ index, align: 'start' });
      setActiveCategory(category);
      // Suppress rangeChanged for 400ms to let Virtuoso settle
      ignoreRangeChangedUntilRef.current = Date.now() + 400;
    }
  },
  [categoryRowIndices]
);
```

Then update `handleRangeChanged` to respect the lock:

```tsx
const handleRangeChanged = useCallback(
  (range: ListRange) => {
    if (isSearching) return;
    if (Date.now() < ignoreRangeChangedUntilRef.current) return; // suppressed after manual scroll
    let best: string | undefined;
    let bestIndex = -1;
    for (const [category, idx] of categoryRowIndices) {
      if (idx <= range.startIndex && idx > bestIndex) {
        bestIndex = idx;
        best = category;
      }
    }
    if (best !== undefined) setActiveCategory(best);
  },
  [categoryRowIndices, isSearching]
);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd "d:\GitHub\Quilibrium\quorum-desktop" && git add src/components/emoji-picker/EmojiPicker.tsx && git commit -m "fix(emoji-picker): debounce rangeChanged after manual category click to fix scroll bug"
```

---

## Self-Review

**Spec coverage:**
- ✅ Preview bar not working — Task 1 (Button → plain button)
- ✅ Clock icon for Frequently Used — Task 2
- ✅ Star icon for Custom — Task 2
- ✅ Skin tone popover vertical — Task 3 (`flex-direction: column`)
- ✅ Active bar full height, no border-radius — Task 3 (`top: 0; bottom: 0; border-radius: 0`)
- ✅ Stronger hover contrast on sidebar — Task 3 (`surface-5`)
- ✅ Stronger hover contrast on emoji grid — Task 3 (`surface-5`)
- ✅ Stickers panel too small — Task 4 (300→420px, 400→560px)
- ✅ Topbar more padding, smaller search — Task 3 (`$s-3 $s-4` padding, `$text-xs` on input)
- ✅ Emoji picker positioning from message actions — Task 5
- ✅ Portal picker clamp values fixed — Task 5
- ✅ Auto-close message-actions picker when stickers opens — Task 6
- ✅ Category scroll bug — Task 7

**Placeholder scan:** No TBDs or TODOs found.

**Type consistency:**
- `ignoreRangeChangedUntilRef` is `useRef<number>(0)` and accessed via `.current` in both functions — consistent.
- Custom event name `'quorum:close-emoji-picker'` used in both dispatch (Channel.tsx) and listener (MessageList.tsx) — consistent.
- All existing types (`EmojiItem`, `CustomEmoji`, `VirtualRow`) unchanged — no new types introduced.

---

*Last updated: 2026-04-14*
