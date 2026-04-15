# Rock-Hand Skin Tone Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the colored circle skin tone trigger and popover items with the 🤘 (rock-on hand) emoji rendered at the appropriate skin tone using `EmojiSprite`.

**Architecture:** Look up 🤘 (`1F918`) sheet coordinates and its 5 skin variants from the already-loaded emoji dataset at runtime (exported from `emojiData.ts`). Replace the colored `<div>` circles in `EmojiPicker.tsx` with `<EmojiSprite>` calls. Update `EmojiPicker.scss` to remove color-based styles and add sizing for the emoji-based skin buttons.

**Tech Stack:** React, TypeScript, `emoji-datasource-twitter` (already loaded), EmojiSprite component, SCSS

---

### Task 1: Export rock-hand lookup from emojiData.ts

**Files:**
- Modify: `src/components/emoji-picker/emojiData.ts`

The emoji datasource already contains 🤘 (`1F918`) with `skin_variations` keyed by tone codes like `1F3FB`–`1F3FF`. We need to expose a function that returns `{ sheetX, sheetY }` for a given unified code + optional skin tone, so `EmojiPicker.tsx` can call it without importing the raw JSON itself.

- [ ] **Step 1: Add `getRockHandSprite` export to `emojiData.ts`**

Add this function after the existing exports (after `getEmojiImageUrl`):

```ts
/** Sheet coordinates for 🤘 (1F918) at the given skin tone (or default) */
export function getRockHandSprite(skinTone?: string | null): { sheetX: number; sheetY: number } {
  const emojis = buildEmojiIndex();
  const rock = emojis.find((e) => e.unified === '1F918');
  if (!rock) return { sheetX: 0, sheetY: 0 };
  if (skinTone && rock.skinVariations?.[skinTone]) {
    return rock.skinVariations[skinTone];
  }
  return { sheetX: rock.sheetX, sheetY: rock.sheetY };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/emoji-picker/emojiData.ts
git commit -m "feat(emoji-picker): export getRockHandSprite helper"
```

---

### Task 2: Replace skin tone UI with rock-hand emoji in EmojiPicker.tsx

**Files:**
- Modify: `src/components/emoji-picker/EmojiPicker.tsx`

Replace both the trigger dot and each popover item — colored `<div>`s with `backgroundColor` — with `<EmojiSprite>` rendering 🤘 at the appropriate skin tone. The active/open border stays.

- [ ] **Step 1: Add `getRockHandSprite` import**

In the imports block at the top of `EmojiPicker.tsx`, add `getRockHandSprite` to the existing import from `./emojiData`:

```ts
import {
  buildRowData,
  buildSearchRows,
  unifiedToEmoji,
  getEmojiImageUrl,
  getRockHandSprite,
} from './emojiData';
```

- [ ] **Step 2: Remove `SKIN_TONE_COLORS` constant**

Delete the entire `SKIN_TONE_COLORS` block (lines 40–47):

```ts
// DELETE THIS:
const SKIN_TONE_COLORS: Record<string, string> = {
  default: '#FFCC22',
  '1F3FB': '#F7D7C4',
  '1F3FC': '#E8B88A',
  '1F3FD': '#C68642',
  '1F3FE': '#8D5524',
  '1F3FF': '#4A2912',
};
```

- [ ] **Step 3: Remove `currentToneColor` derived value**

Find and delete this line near the bottom of the component (just before the `return`):

```ts
const currentToneColor = SKIN_TONE_COLORS[skinTone ?? 'default'];
```

- [ ] **Step 4: Replace the skin trigger dot**

Find the skin trigger `<div>` block:

```tsx
<div
  className={`emoji-picker__skin-dot${skinPopoverOpen ? ' emoji-picker__skin-dot--open' : ''}`}
  style={{ backgroundColor: currentToneColor }}
  onClick={() => setSkinPopoverOpen((v) => !v)}
  role="button"
  tabIndex={0}
  aria-label={t`Select skin tone`}
  aria-expanded={skinPopoverOpen}
/>
```

Replace it with:

```tsx
<div
  className={`emoji-picker__skin-rock${skinPopoverOpen ? ' emoji-picker__skin-rock--open' : ''}`}
  onClick={() => setSkinPopoverOpen((v) => !v)}
  role="button"
  tabIndex={0}
  aria-label={t`Select skin tone`}
  aria-expanded={skinPopoverOpen}
>
  <EmojiSprite
    {...getRockHandSprite(skinTone)}
    size={24}
    label="rock on hand"
  />
</div>
```

- [ ] **Step 5: Replace the popover tone dots**

Find the popover `SKIN_TONES.map` block:

```tsx
{SKIN_TONES.map((tone) => (
  <div
    key={tone ?? 'default'}
    className={`emoji-picker__skin-dot${skinTone === tone ? ' emoji-picker__skin-dot--active' : ''}`}
    style={{ backgroundColor: SKIN_TONE_COLORS[tone ?? 'default'] }}
    onClick={() => { setSkinTone(tone); setSkinPopoverOpen(false); }}
    role="button"
    tabIndex={0}
    aria-label={SKIN_TONE_LABELS[tone ?? 'default']}
  />
))}
```

Replace it with:

```tsx
{SKIN_TONES.map((tone) => (
  <div
    key={tone ?? 'default'}
    className={`emoji-picker__skin-rock${skinTone === tone ? ' emoji-picker__skin-rock--active' : ''}`}
    onClick={() => { setSkinTone(tone); setSkinPopoverOpen(false); }}
    role="button"
    tabIndex={0}
    aria-label={SKIN_TONE_LABELS[tone ?? 'default']}
  >
    <EmojiSprite
      {...getRockHandSprite(tone)}
      size={24}
      label={SKIN_TONE_LABELS[tone ?? 'default']}
    />
  </div>
))}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/emoji-picker/EmojiPicker.tsx
git commit -m "feat(emoji-picker): replace skin tone circles with rock-hand emoji"
```

---

### Task 3: Update SCSS — remove color dot styles, add rock-hand styles

**Files:**
- Modify: `src/components/emoji-picker/EmojiPicker.scss`

Remove the `.emoji-picker__skin-dot` rules and replace with `.emoji-picker__skin-rock` styles that size the container around the emoji, keep hover/active border, and keep the popover layout working.

- [ ] **Step 1: Remove old dot styles and add new rock styles**

Find the two existing skin-dot blocks:

```scss
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
```

Replace the entire section above with:

```scss
// ── Skin tone trigger (rock-hand emoji, right of search) ──────────────────
.emoji-picker__skin-trigger {
  position: relative;
  flex-shrink: 0;
}

.emoji-picker__skin-rock {
  display: flex;
  align-items: center;
  justify-content: center;
  width: $s-8;
  height: $s-8;
  border-radius: $rounded-md;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color $duration-150 ease-in-out,
              transform $duration-150 ease-in-out,
              background-color $duration-150 ease-in-out;

  &:hover {
    transform: scale(1.1);
    background-color: var(--surface-5);
  }

  &--open {
    border-color: var(--accent);
  }

  &--active {
    border-color: var(--accent);
  }
}

// Floating popover — vertical column of rock-hand emoji per tone
.emoji-picker__skin-popover {
  position: absolute;
  top: calc(100% + #{$s-1-5});
  right: 0;
  display: flex;
  flex-direction: column;
  gap: $s-1;
  padding: $s-1-5;
  background: var(--color-bg-modal);
  border: 1px solid var(--color-border-default);
  border-radius: $rounded-lg;
  box-shadow: $shadow-lg;
  z-index: 10;
}
```

- [ ] **Step 2: Verify TypeScript and lint pass**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
yarn lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/emoji-picker/EmojiPicker.scss
git commit -m "feat(emoji-picker): replace skin-dot CSS with skin-rock emoji button styles"
```

---

*Last updated: 2026-04-14*
