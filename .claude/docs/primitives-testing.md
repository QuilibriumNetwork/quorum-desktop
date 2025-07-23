# Primitives Testing Guide

## Accessing the Primitives Playground

During development, you can test all primitives by navigating to:

**URL**: `/primitives`

Example: If running locally on port 5173, visit:
```
http://localhost:5173/primitives
```

## What You'll Find

The Primitives Playground includes:

### 1. ModalContainer Testing
- Modal with backdrop (click outside or ESC to close)
- Modal without backdrop (ESC only)
- Tests animation states
- Verifies z-index layering

### 2. OverlayBackdrop Testing
- Standalone backdrop with content
- Click-outside functionality
- Blur effect verification

### 3. Future Primitives (Placeholders)
- FlexRow, FlexBetween, FlexCenter
- ResponsiveContainer
- Button primitive
- More to come...

## Testing Checklist

When testing each primitive:

- [ ] Visual appearance matches design
- [ ] Animations are smooth
- [ ] Click interactions work correctly
- [ ] Keyboard navigation (Tab, Escape) works
- [ ] No console errors
- [ ] No layout shifts or flickers
- [ ] Dark/light theme both work
- [ ] Z-index layering is correct

## Adding New Primitives to Playground

When you create a new primitive:

1. Import it in `PrimitivesPlayground.tsx`
2. Add a new section with examples
3. Include different prop combinations
4. Test both controlled and uncontrolled states

## Quick Development Tips

- Keep the playground open in a separate browser tab
- Use browser DevTools to inspect rendered HTML
- Check responsive behavior by resizing window
- Test with keyboard-only navigation

---

*Last updated: 2025-07-23 01:00 UTC*