# ReactTooltip Mobile Support Documentation

[← Back to INDEX](../../INDEX.md)

## Overview

The `ReactTooltip` component has been enhanced with mobile touch support to provide a better user experience on touch devices. By default, tooltips are hidden on mobile devices, but can be enabled with touch interactions for specific use cases.

## Mobile Behavior

### Default Behavior

- **Desktop**: Tooltips work normally with hover interactions
- **Mobile/Touch Devices**: Tooltips are hidden by default (returns `null`)

### Touch-Enabled Behavior

When `showOnTouch` is enabled:

- Tooltips can be triggered by touch interactions
- Supports both click and long-press triggers
- Tooltips remain visible until dismissed by tapping outside
- Accessibility is maintained with click event support

## API Reference

### Props

| Prop                | Type                      | Default   | Description                                     |
| ------------------- | ------------------------- | --------- | ----------------------------------------------- |
| `showOnTouch`       | `boolean`                 | `false`   | Enables tooltip display on touch devices        |
| `touchTrigger`      | `'click' \| 'long-press'` | `'click'` | How the tooltip is triggered on touch devices   |
| `longPressDuration` | `number`                  | `700`     | Duration in milliseconds for long-press trigger |

### Existing Props

All existing ReactTooltip props are preserved:

- `id`, `content`, `place`, `noArrow`, `theme`, `anchorSelect`, `className`, `highlighted`

## Usage Examples

### Basic Mobile Tooltip (Click to Show)

```tsx
<ReactTooltip
  id="info-tooltip"
  content="This information is helpful"
  anchorSelect="#info-icon"
  showOnTouch
  touchTrigger="click"
/>
```

### Long-Press Tooltip

```tsx
<ReactTooltip
  id="advanced-tooltip"
  content="Hold to see this information"
  anchorSelect="#advanced-icon"
  showOnTouch
  touchTrigger="long-press"
  longPressDuration={1000}
/>
```

### Info Icon Tooltip (Recommended Pattern)

```tsx
<div
  id="repudiability-tooltip-icon"
  className="border border-strong rounded-full w-6 h-6 text-center leading-5 text-lg cursor-default"
>
  ℹ
</div>
<ReactTooltip
  id="repudiability-tooltip"
  content="Detailed explanation of the feature..."
  place="bottom"
  className="!w-[400px]"
  anchorSelect="#repudiability-tooltip-icon"
  showOnTouch
  touchTrigger="click"
/>
```

## Implementation Details

### Touch Device Detection

```typescript
const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0);
```

### Event Handling

- **Click Trigger**: Uses `touchend` event with `preventDefault()`
- **Long-Press Trigger**: Uses `touchstart`, `touchend`, and `touchcancel` events
- **Outside Dismiss**: Listens for `touchstart` and `mousedown` events globally
- **Cleanup**: Properly removes all event listeners on unmount

### Accessibility

- Click events are preserved alongside touch events
- Screen readers can still interact with tooltips
- Keyboard navigation remains functional

## Best Practices

### When to Use Mobile Tooltips

✅ **Good Use Cases:**

- Info icons (`ℹ`) that provide explanational content
- Help text for complex features
- Additional context that's not essential but helpful

❌ **Avoid For:**

- Essential information that users need to see
- Navigation or primary action tooltips
- Tooltips that contain interactive elements

### Touch Trigger Selection

- **Use `'click'`** for: Info icons, help text, quick explanations
- **Use `'long-press'`** for: Advanced features, less common actions, power-user features

### Styling Considerations

- Use appropriate `className` for mobile-specific styling
- Consider tooltip width on mobile devices (`!w-[400px]`)
- Ensure proper placement with `place` prop
- Use `highlighted` prop for important tooltips

## Common Patterns

### 1. Info Icon Pattern

Used in SpaceEditor, UserSettingsModal, CreateSpaceModal:

```tsx
<div className="info-icon">ℹ</div>
<ReactTooltip
  id="info-tooltip"
  content="Explanatory text..."
  showOnTouch
  touchTrigger="click"
/>
```

### 2. Copy-to-Clipboard Pattern

Used in ClickToCopyContent component:

```tsx
<ReactTooltip
  content={copied ? t`Copied!` : tooltipText}
  showOnTouch
  touchTrigger="click"
/>
```

## Migration Guide

### From Non-Mobile Tooltips

```tsx
// Before
<ReactTooltip
  id="tooltip"
  content="Information"
  anchorSelect="#icon"
/>

// After (mobile-enabled)
<ReactTooltip
  id="tooltip"
  content="Information"
  anchorSelect="#icon"
  showOnTouch
  touchTrigger="click"
/>
```

### From Old CopyToClipboard Component

The old `CopyToClipboard` component has been replaced with `ClickToCopyContent` which includes mobile support:

```tsx
// Before
<CopyToClipboard
  text="content"
  tooltipText="Copy to clipboard"
/>

// After
<ClickToCopyContent
  text="content"
  tooltipText="Copy to clipboard"
>
  <></>
</ClickToCopyContent>
```

## Technical Notes

### Performance Considerations

- Touch device detection is memoized to avoid repeated calculations
- Event listeners are only added on touch devices
- Proper cleanup prevents memory leaks

### Browser Support

- Supports all modern mobile browsers
- Fallback behavior for older browsers (tooltips hidden)
- Works with both touch and mouse input simultaneously

### React Integration

- Uses `useEffect` for lifecycle management
- Integrates with existing ReactTooltip state management
- Compatible with React 18+ features

## Troubleshooting

### Common Issues

1. **Tooltip not showing on mobile**: Ensure `showOnTouch` is set to `true`
2. **Touch events not working**: Check that `anchorSelect` matches the element ID
3. **Tooltip not dismissing**: Verify outside click handling is not blocked by other elements

### Debug Tips

- Use browser dev tools to inspect touch events
- Check console for event listener errors
- Verify element IDs match between anchor and `anchorSelect`

## Future Enhancements

Potential improvements for future versions:

- Gesture support (swipe to dismiss)
- Haptic feedback integration
- Adaptive positioning based on screen size
- Touch-friendly tooltip sizing
