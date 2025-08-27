# Emoji Picker Responsive Design Improvement

## Overview

Improve the mobile UX of the emoji picker by replacing CSS scaling with proper responsive implementation using emoji-picker-react's built-in features.

## Current State Analysis

### Problem Summary

The emoji picker currently uses CSS `scale` transforms for mobile/tablet responsiveness:

- Mobile: `scale: 0.7` (480px and below)
- Tablet: `scale: 0.75` (1023px and below)
- Desktop: `scale: 0.85`

### Issues with Current Implementation

1. **Poor Touch Targets**: Scaling makes emojis too small for comfortable mobile interaction
2. **Accessibility Problems**: Touch targets below 44px (iOS) / 48dp (Android) minimum
3. **Visual Degradation**: Scaled elements look pixelated and cramped
4. **UX Inconsistency**: Doesn't follow native mobile patterns users expect

### Current File Structure

```
src/styles/_components.scss         # Contains CSS scaling rules
src/components/message/Message.tsx  # EmojiPicker component usage
```

## Research Findings

### Mobile UX Best Practices

- **Touch targets**: Minimum 44px (iOS) / 48dp (Android) for accessibility
- **Contextual positioning**: Keep picker near trigger button when possible
- **Bottom sheet pattern**: Common mobile pattern for space-constrained selections
- **Text-first design**: Emojis should complement, not replace text

### emoji-picker-react Library Capabilities

- **Responsive props**: `width` and `height` accept CSS strings or pixel numbers
- **CSS variables**: Fine-grained control over emoji size, spacing, colors
- **Theme support**: Built-in dark/light theme switching
- **Performance features**: Lazy loading, virtualization support

### Key Configuration Options

```jsx
<EmojiPicker
  width="100%" // CSS width (responsive)
  height="300px" // CSS height (responsive)
  theme={Theme.DARK} // Theme matching app
  // ... other props
/>
```

### CSS Variables for Responsive Control

```scss
.EmojiPickerReact {
  --epr-emoji-size: 32px; // Individual emoji size
  --epr-emoji-gap: 8px; // Spacing between emojis
  --epr-category-navigation-button-size: 44px; // Category button size
}
```

## Responsive Strategy

### Device-Specific Approaches

#### Mobile (≤ 480px)

- **Pattern**: Bottom sheet or full-width modal
- **Positioning**: Fixed bottom positioning with slide-up animation
- **Dimensions**: `width="100%" height="300px"`
- **Touch targets**: Minimum 44px emoji size with proper spacing

#### Tablet (481px - 1023px)

- **Pattern**: Keep current relative positioning (contextual to trigger)
- **Positioning**: Absolute positioning relative to message actions
- **Dimensions**: `width="320px" height="350px"`
- **Touch targets**: 36px emoji size with comfortable spacing

#### Desktop (≥ 1024px)

- **Pattern**: Keep current relative positioning
- **Positioning**: Absolute positioning relative to message actions
- **Dimensions**: Use library defaults or `width="350px" height="400px"`
- **Touch targets**: 32px emoji size (mouse interaction)

### Positioning Strategy

```
Mobile:    Bottom sheet (full-width, slide up)
Tablet:    Relative to trigger (contextual)
Desktop:   Relative to trigger (contextual)
```

## Implementation Plan

### Phase 1: Replace CSS Scaling with Responsive Props

1. Remove CSS `scale` transforms from `_components.scss`
2. Add responsive `width` and `height` props to `EmojiPicker` component
3. Use CSS variables for emoji size and spacing control
4. Test basic responsiveness across devices

### Phase 2: Implement Mobile-Specific Patterns

1. Add mobile detection logic
2. Implement bottom sheet positioning for mobile
3. Add backdrop dismissal for mobile
4. Ensure proper touch target sizes

### Phase 3: Enhanced UX Features

1. Add slide-up animation for mobile
2. Implement touch-friendly interactions
3. Add haptic feedback (if supported)
4. Performance optimization with lazy loading

## Code Examples

### Current Implementation (Message.tsx)

```jsx
// Current - relies on CSS scaling
<EmojiPicker
  suggestedEmojisMode={SuggestionMode.FREQUENT}
  customEmojis={customEmojis}
  theme={Theme.DARK}
  onEmojiClick={(e) => {
    /* ... */
  }}
/>
```

### Proposed Implementation (Message.tsx)

```jsx
// Proposed - responsive props approach
const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);

<EmojiPicker
  width={isMobile ? '100%' : '320px'}
  height={isMobile ? '300px' : '350px'}
  suggestedEmojisMode={SuggestionMode.FREQUENT}
  customEmojis={customEmojis}
  theme={Theme.DARK}
  onEmojiClick={(e) => {
    /* ... */
  }}
/>;
```

### CSS Variables Implementation (\_components.scss)

```scss
/* Remove these CSS scaling rules */
.EmojiPickerReact {
  scale: 0.85; /* REMOVE */
}

@media (max-width: 1023px) {
  .EmojiPickerReact {
    scale: 0.75; /* REMOVE */
  }
}

@media (max-width: 480px) {
  .EmojiPickerReact {
    scale: 0.7; /* REMOVE */
  }
}

/* Replace with responsive CSS variables */
.EmojiPickerReact {
  /* Desktop defaults */
  --epr-emoji-size: 32px;
  --epr-emoji-gap: 6px;
  --epr-category-navigation-button-size: 38px;

  /* Keep existing theme variables */
  --epr-bg-color: var(--surface-1) !important;
  --epr-text-color: var(--color-text-main) !important;
  /* ... other theme variables ... */
}

@media (max-width: 1023px) {
  .EmojiPickerReact {
    --epr-emoji-size: 36px;
    --epr-emoji-gap: 8px;
    --epr-category-navigation-button-size: 44px;
  }
}

@media (max-width: 480px) {
  .EmojiPickerReact {
    --epr-emoji-size: 44px;
    --epr-emoji-gap: 10px;
    --epr-category-navigation-button-size: 48px;
  }
}
```

### Mobile Positioning Logic (Message.tsx)

```jsx
// Mobile-specific positioning
const emojiPickerClass = isMobile
  ? 'fixed bottom-0 left-0 right-0 z-[9999]'
  : 'absolute right-0 z-[9999] ' +
    (emojiPickerOpenDirection === 'upwards' ? 'bottom-6' : 'top-0');

{
  emojiPickerOpen === message.messageId && (
    <div className={emojiPickerClass}>
      <EmojiPicker
        width={isMobile ? '100%' : '320px'}
        height={isMobile ? '300px' : '350px'}
        // ... other props
      />
    </div>
  );
}
```

## Files to Modify

### Primary Files

1. **`src/styles/_components.scss`**
   - Remove CSS `scale` transforms
   - Add responsive CSS variables for emoji size/spacing
   - Keep existing theme variables

2. **`src/components/message/Message.tsx`**
   - Add responsive width/height props to EmojiPicker
   - Implement mobile-specific positioning logic
   - Add mobile detection and state management

### Supporting Files (if needed)

3. **`src/hooks/useResponsiveLayout.ts`**
   - Potentially add mobile detection hooks if not already available

## Testing Requirements

### Device Testing

- [ ] iPhone (various sizes) - Safari and Chrome
- [ ] Android phones (various sizes) - Chrome
- [ ] iPad - Safari and Chrome
- [ ] Android tablets - Chrome
- [ ] Desktop browsers - Chrome, Firefox, Safari

### Functionality Testing

- [ ] Emoji selection accuracy on mobile
- [ ] Touch target sizes meet accessibility guidelines (44px minimum)
- [ ] Picker positioning works correctly in all screen orientations
- [ ] Backdrop dismissal works on mobile
- [ ] Animation smoothness (if implemented)
- [ ] Performance with large emoji sets

### Accessibility Testing

- [ ] Screen reader compatibility
- [ ] High contrast mode support
- [ ] Touch target size validation
- [ ] Keyboard navigation (desktop)

## Success Metrics

### UX Improvements

- [ ] Touch targets ≥ 44px on mobile
- [ ] No more pixelated/scaled appearance
- [ ] Consistent native mobile patterns
- [ ] Smooth interaction animations

### Technical Improvements

- [ ] No CSS transforms affecting emoji picker
- [ ] Proper responsive implementation using library features
- [ ] Better performance (no scaling calculations)
- [ ] Maintainable responsive code

## Implementation Notes

### Current Screenshot Reference

The mobile emoji picker in screenshot 210 shows the scaling issues:

- Emojis appear too small for comfortable touch interaction
- Overall picker looks cramped and difficult to use
- Touch targets are below accessibility guidelines

### Positioning Context

The emoji picker appears relative to message hover actions:

- Trigger button: FontAwesome smile icon in hover actions
- Current positioning: `absolute right-0` with upward/downward logic
- Z-index: Currently `z-[9999]` (fixed in previous work)

### Theme Integration

Maintain existing theme variables:

- Background colors match app surface colors
- Text colors match app text hierarchy
- Border and hover states match app accent colors

## Next Steps

1. **Start with Phase 1**: Remove CSS scaling and add responsive props
2. **Test thoroughly**: Validate basic responsiveness works
3. **Implement Phase 2**: Add mobile-specific patterns
4. **Performance check**: Ensure no regressions
5. **User testing**: Get feedback on improved mobile experience

## Dependencies

- `emoji-picker-react`: Already installed and configured
- `@lingui/core`: For internationalization (already integrated)
- React hooks: `useState`, `useEffect` for responsive logic
- Existing responsive layout context (if available)

## Rollback Plan

If issues arise during implementation:

1. Revert CSS changes in `_components.scss`
2. Remove responsive props from `EmojiPicker` component
3. Restore original scaling implementation
4. Test thoroughly before re-attempting

This ensures safe iteration without breaking existing functionality.
