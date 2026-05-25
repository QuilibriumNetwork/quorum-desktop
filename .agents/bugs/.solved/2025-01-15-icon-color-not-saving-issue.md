---
type: bug
title: Icon Color Not Saving Issue
status: done
created: 2025-01-15T00:00:00.000Z
updated: '2026-01-09'
---

# Icon Color Not Saving Issue


**Impact**: High - Icon colors were not persisting for channels and groups

## Problem Description

Users could select icon colors in the IconPicker component, but the colors would not save properly. When reopening the editor, the icon color would revert to the default, and changes were not reflected in the channel/group lists.

## Root Cause

The fundamental issue was that **color changes alone did not trigger the save callback**. The IconPicker component had two separate handlers:

1. `handleColorChange` - Updated internal state only
2. `handleIconClick` - Called `onIconSelect` to notify parent component

When users changed only the color (without selecting a different icon), the parent component was never notified of the change, so the data was never updated.

## Investigation Process

### Initial Symptoms
- Icon colors not displaying correctly in channel lists
- Colors reverting to default when reopening editors
- Intermittent behavior - "sometimes works, sometimes doesn't"

### Red Herrings & Over-Engineering Attempts

1. **React Key Conflicts**: Found duplicate keys in ChannelGroup causing render issues, but this was secondary
2. **CSS Color System**: Suspected missing color classes, created complex debugging system
3. **Force Re-render Mechanisms**: Added React keys to force component recreation
4. **Save Button Logic**: Over-complicated GroupEditor save logic
5. **Color Function Debugging**: Added extensive logging to `getIconColorHex()`
6. **State Management**: Suspected async state update issues

### Debug Process
- Added console logs throughout the component chain
- Tracked data flow from IconPicker → Editor → Save → Display
- Discovered that `handleColorChange` was called but `handleIconChange` was not
- Realized color selection never triggered the parent callback

## Actual Solution

**Simple 3-line fix** in `IconPicker.web.tsx`:

```typescript
const handleColorChange = (color: IconColor) => {
  setSelectedColor(color);
  // Immediately notify parent of color change with current icon
  if (selectedIcon) {
    onIconSelect(selectedIcon, color);
  }
};
```

## Over-Engineering to Clean Up

The following additions were made during debugging but are likely unnecessary:

### 1. Complex React Keys
- **Location**: `ChannelGroup.tsx` Icon components
- **Added**: Unique keys with icon/color combinations
- **Status**: Probably helpful for performance, keep

### 2. Enhanced Color Debugging
- **Location**: `IconPicker/types.ts` - `getIconColorHex()`
- **Added**: Console warnings and debug logs
- **Status**: Remove debug logs, keep error handling

### 3. Hover Titles for Debugging
- **Location**: All Icon components
- **Added**: `title="Icon: name (color)"` attributes
- **Status**: Keep for user experience

### 4. Force Refresh CSS
- **Location**: All Icon components
- **Added**: `pointerEvents: 'none'` and enhanced styling
- **Status**: `pointerEvents: 'none'` is needed, keep

### 5. Over-Simplified Save Logic
- **Location**: `useGroupManagement.ts`
- **Added**: Always-enabled save button for existing groups
- **Status**: This is actually an improvement, keep

## Lessons Learned

1. **Start with the data flow**: Track callbacks before assuming rendering issues
2. **Simple console logs**: Basic "function called" logs often reveal more than complex state inspection
3. **Question assumptions**: Color changes "should" trigger saves, but the code didn't implement this
4. **Avoid over-engineering**: The real fix was trivial compared to the debugging additions

## Recommended Cleanup Actions

1. Remove excessive debug console logs
2. Simplify color calculation functions
3. Keep improved save button logic (it's better UX)
4. Keep React keys (they prevent real issues)
5. Remove hover debug titles or make them user-friendly

## Prevention

- Add unit tests for IconPicker callback behavior
- Document component callback contracts clearly
- Consider using React DevTools for debugging component communication

---

*This bug exemplifies how debugging complex UI interactions can lead to over-engineering when the root cause is a simple missing callback.*
