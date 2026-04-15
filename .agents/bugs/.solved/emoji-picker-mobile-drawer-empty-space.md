# Bug: Emoji Picker Grid Has Empty Space on Right Side in Mobile Drawer

## Status
In Progress — testing CSS grid approach

## Confirmed Facts

- Grid container reports `clientWidth: 318px` on the test device (Samsung Galaxy S7)
- Column count math is correct: 7 cols × 30px + 6 gaps × 6px + 16px padding = 282px — fits in 318px
- The gap is **not a data/count problem** — it's a visual layout problem
- Fixed-width flex buttons always leave remainder pixels; they never fill 100% of row width
- Scrollbar from Virtuoso (~12px) eats into layout but this was a secondary factor

## Root Cause
Fixed pixel button widths (`width: 30px`) in a flex row never fill the container perfectly. Any remainder from integer column math shows as dead space on the right. This is a fundamental flaw with the fixed-size flex approach.

## Correct Design Solution
Use **CSS Grid with `1fr` columns** on the row:
- Row: `display: grid; grid-template-columns: repeat(var(--emoji-cols), 1fr)`
- Button: `aspect-ratio: 1` (square, size driven by grid, not fixed px)
- JS still computes column count (needed for data chunking in Virtuoso) using `CELL_MIN_SIZE = 36px` as a minimum target
- CSS variable `--emoji-cols` set on picker root, inherited by all rows
- Result: cells always fill 100% of row width, zero dead space, works on any screen width

## What NOT to Do
- **Do NOT use fixed pixel widths on buttons** (`width: 30px`, `width: $s-9`) — always leaves remainder dead space
- **Do NOT use `justify-content: space-between`** — spreads partial last rows incorrectly
- **Do NOT use `flex: 1` + `max-width`** — buttons grow too large on wide screens
- **Do NOT make `.emoji-picker` `width: 100%; height: 100%` globally** — breaks desktop popover (no intrinsic size from parent)
- **Do NOT use `width: 100% !important`** — brittle, hard to trace
- **Do NOT measure `containerRef` (picker root) and subtract sidebar/scrollbar/padding manually** — error-prone across contexts; measure the actual grid element (`gridRef`) instead
- **Do NOT try to match a fixed CELL_SIZE in both JS and CSS** — they will always drift apart

## Relevant Files
- [EmojiPicker.tsx](src/components/emoji-picker/EmojiPicker.tsx) — `gridRef`, `ResizeObserver`, `--emoji-cols` CSS variable on root
- [EmojiPicker.scss](src/components/emoji-picker/EmojiPicker.scss) — `.emoji-picker__emoji-row` (CSS grid), `.emoji-picker__emoji-btn` (aspect-ratio: 1)
- [EmojiPickerDrawer.scss](src/components/message/EmojiPickerDrawer.scss) — `.emoji-picker-drawer__content .emoji-picker { width: 100% }`
- [MobileDrawer.scss](src/components/ui/MobileDrawer.scss) — drawer is 500px on wide screens, 100vw on narrow

---
*Filed: 2026-04-15 — Updated: 2026-04-15*
