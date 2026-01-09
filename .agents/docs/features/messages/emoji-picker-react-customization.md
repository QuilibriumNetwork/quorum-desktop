---
type: doc
title: Emoji Picker React - Styling & Customization
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-12-09T00:00:00.000Z
---

# Emoji Picker React - Styling & Customization

## Basic Information

- **Package**: emoji-picker-react
- **Root Selector**: `.EmojiPickerReact`
- **Dark Mode Selector**: `.EmojiPickerReact.epr-dark-theme`
- **Styles Location**: `src/styles/_emoji-picker.scss`

## Available CSS Variables

### Core Styling

- `--epr-emoji-size`: Controls emoji size (default in Quorum: `28px`)
- `--epr-emoji-gap`: Space between emojis (default in Quorum: `6px`)
- `--epr-bg-color`: Picker background color
- `--epr-text-color`: Text color in the picker
- `--epr-category-navigation-button-size`: Size of category nav buttons (default: `38px`)

### Backgrounds

- `--epr-category-label-bg-color`: Category label background (should match bg-color)
- `--epr-search-input-bg-color`: Search input background
- `--epr-search-input-bg-color-active`: Search input background when active
- `--epr-search-input-focus-bg-color`: Search input background when focused
- `--epr-hover-bg-color`: Hovered emoji background color
- `--epr-focus-bg-color`: Focused emoji background color

### Borders

- `--epr-picker-border-color`: Main picker border color
- `--epr-search-input-border-color`: Search input border color
- `--epr-search-border-color`: Search container border color

### Text

- `--epr-search-input-placeholder-color`: Search placeholder text color
- `--epr-category-label-text-color`: Category label text color

## Quorum Customization (src/styles/_emoji-picker.scss)

```scss
.EmojiPickerReact {
  /* Panel styling */
  box-shadow: $shadow-lg !important;

  /* Backgrounds - use Quorum design tokens */
  --epr-bg-color: var(--color-bg-modal) !important;
  --epr-category-label-bg-color: var(--color-bg-modal) !important;
  --epr-search-input-bg-color: var(--color-field-bg) !important;
  --epr-hover-bg-color: var(--surface-3) !important;
  --epr-focus-bg-color: var(--surface-3) !important;

  /* Borders */
  --epr-picker-border-color: var(--color-border-default) !important;
  --epr-search-border-color: var(--accent) !important;

  /* Text */
  --epr-text-color: var(--color-text-main) !important;
  --epr-category-label-text-color: var(--color-text-subtle) !important;

  /* UI sizing */
  --epr-category-navigation-button-size: 38px !important;
  --epr-emoji-size: 28px !important;
  --epr-emoji-gap: 6px !important;
}
```

## Important Notes

- When changing `--epr-bg-color`, also change `--epr-category-label-bg-color` to match
- Use more specific selectors when overriding default styles
- Component uses CSS variables for most customization needs
- Quorum applies Sen font family globally to the picker
- Focus outlines are removed from category buttons for cleaner appearance

## Common Classes (Observed)

- `.epr-cat-btn` - Category navigation buttons
- `.epr-cat-btn.epr-active` - Active category button
- `.epr-emoji-img` - Emoji images
- `.epr-emoji-native` - Native emoji elements
- `.epr-category-nav` - Category navigation container
- `.epr-search` - Search input
- `.epr-body` - Main emoji container
- `.epr-skin-tone-select` - Skin tone picker
- `button[class*='epr-emoji']` - Emoji buttons (used for focus state resets)

## Related Files

- `src/styles/_emoji-picker.scss` - Global emoji picker theming
- `src/components/message/EmojiPickerDrawer.tsx` - Mobile drawer component
- `src/components/message/EmojiPickerDrawer.scss` - Drawer-specific styles
- `src/hooks/business/messages/useEmojiPicker.ts` - Emoji picker hook

---

_Last updated: 2025-12-09_
