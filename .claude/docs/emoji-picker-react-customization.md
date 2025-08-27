# Emoji Picker React - Styling & Customization

## Basic Information

- **Package**: emoji-picker-react
- **Root Selector**: `.EmojiPickerReact`
- **Dark Mode Selector**: `.EmojiPickerReact.epr-dark-theme`

## Available CSS Variables

### Core Styling
- `--epr-emoji-size`: Controls emoji size
- `--epr-emoji-gap`: Space between emojis
- `--epr-bg-color`: Picker background color
- `--epr-text-color`: Text color in the picker

### Interactive States
- `--epr-hover-bg-color`: Hovered emoji background color
- `--epr-category-label-bg-color`: Category label background (should match bg-color)

## Example Customization

```css
.EmojiPickerReact {
  --epr-emoji-size: 24px;
  --epr-emoji-gap: 8px;
  --epr-hover-bg-color: #f0f0f0;
  --epr-bg-color: white;
  --epr-category-label-bg-color: white;
  --epr-text-color: #333;
}
```

## Important Notes

- When changing `--epr-bg-color`, also change `--epr-category-label-bg-color` to match
- Use more specific selectors when overriding default styles
- Component uses CSS variables for most customization needs

## Common Classes (Observed)

- `.epr-cat-btn` - Category navigation buttons
- `.epr-cat-btn.epr-active` - Active category button
- `.epr-emoji-img` - Emoji images
- `.epr-emoji-native` - Native emoji elements
- `.epr-category-nav` - Category navigation container
- `.epr-search` - Search input
- `.epr-body` - Main emoji container
- `.epr-skin-tone-select` - Skin tone picker