# Markdown Toolbar Editor

**Status:** ✅ Desktop Complete | ⏳ Mobile Pending
**Created:** 2025-11-06 | **Updated:** 2025-11-07
**Type:** Feature Enhancement

---

## What Was Implemented (Desktop)

Discord-style floating markdown toolbar that appears when selecting text in message composer/editor.

### Features
- **Tooltip-style floating toolbar** with downward arrow
- **Smart positioning**: Centers above selection, handles viewport boundaries
- **6 formatting buttons**: Heading, Bold, Quote, Italic, Code, Strikethrough
- **Touch device detection**: Disabled on touch devices to avoid conflicts with native browser UI
- **Works in both**: MessageComposer (new messages) and MessageEditTextarea (editing)

### Platform Behavior

| Platform | Behavior |
|----------|----------|
| Desktop web (mouse) | ✅ Floating toolbar |
| Touch devices (web) | ❌ Disabled (uses native browser selection) |
| Mobile native app | ⏳ Inline toolbar (to be implemented) |

### Key Technical Details
- **Mirror element technique** for accurate textarea selection positioning
- **Viewport clamping** prevents toolbar from going off-screen
- **ScrollTop compensation** for scrolled textareas
- Uses `isTouchDevice()` from platform utils to detect touch capability

---

## Files Created (Desktop)

1. **`src/utils/toolbarPositioning.ts`** (~200 lines)
   - Smart positioning logic using mirror element technique
   - Viewport boundary handling
   - Constants: `TOOLBAR_OFFSET: 52px`, `TOOLBAR_WIDTH: 240px`

2. **`src/utils/markdownFormatting.ts`** (~170 lines)
   - Format functions: `toggleBold`, `toggleItalic`, `toggleStrikethrough`, `wrapCode`, `insertBlockQuote`, `insertHeading`
   - Toggle detection for bold/italic/strikethrough
   - Returns new cursor positions for selection restoration

3. **`src/components/message/MarkdownToolbar.tsx`** (~80 lines)
   - Toolbar component with 6 formatting buttons
   - Props: `visible`, `position`, `onFormat`

4. **`src/components/message/MarkdownToolbar.scss`** (~75 lines)
   - Tooltip-style appearance with arrow (uses `::before`/`::after` pseudo-elements)
   - Smooth fade-in animation (150ms)

---

## Files Modified (Desktop)

1. **`src/components/primitives/Icon/iconMapping.ts`**
   Added 5 icons: `bold`, `italic`, `strikethrough`, `heading`, `quote`

2. **`src/components/primitives/Icon/types.ts`**
   Added 5 icon type names

3. **`src/components/message/MessageComposer.tsx`** (~50 lines added)
   - `handleTextareaMouseUp`: Text selection detection + toolbar positioning
   - `handleMarkdownFormat`: Applies formatting and restores selection
   - Touch device check: `if (isTouchDevice()) return;`
   - State: `showMarkdownToolbar`, `toolbarPosition`, `selectionRange`

4. **`src/components/message/MessageEditTextarea.tsx`**
   Same toolbar integration as MessageComposer

---

## Mobile Implementation Guide (Native App)

### Overview
Implement inline markdown toolbar for React Native (iOS/Android) that appears in the expanded MessageComposer.

### Design Approach

**Key differences from desktop:**
- **Inline positioning** (not floating)
- **Always visible** when composer expanded (no text selection detection)
- **Touch-friendly** larger tap targets
- **Horizontal scrollable** for narrow screens
- Uses React Native components

### Implementation Steps

#### 1. Create `src/components/message/MarkdownToolbar.native.tsx`

```tsx
import { View, ScrollView, StyleSheet } from 'react-native';
import { Button } from '../primitives';
import {
  insertHeading,
  toggleBold,
  insertBlockQuote,
  toggleItalic,
  wrapCode,
  toggleStrikethrough,
  FormatFunction
} from '../../utils/markdownFormatting';

interface MarkdownToolbarProps {
  onFormat: (formatFn: FormatFunction) => void;
  visible?: boolean;
}

export function MarkdownToolbar({ onFormat, visible = true }: MarkdownToolbarProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Button type="unstyled" size="compact" iconName="heading" iconOnly onClick={() => onFormat(insertHeading)} />
        <Button type="unstyled" size="compact" iconName="bold" iconOnly onClick={() => onFormat(toggleBold)} />
        <Button type="unstyled" size="compact" iconName="quote" iconOnly onClick={() => onFormat(insertBlockQuote)} />
        <Button type="unstyled" size="compact" iconName="italic" iconOnly onClick={() => onFormat(toggleItalic)} />
        <Button type="unstyled" size="compact" iconName="code" iconOnly onClick={() => onFormat(wrapCode)} />
        <Button type="unstyled" size="compact" iconName="strikethrough" iconOnly onClick={() => onFormat(toggleStrikethrough)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)', // Use theme color
  },
  scrollContent: {
    gap: 4,
    paddingHorizontal: 4,
  },
});
```

**Key points:**
- Uses `ScrollView` with `horizontal` for narrow screens
- No positioning calculations (inline component)
- Same formatting functions as desktop
- Button primitive automatically uses native implementation

#### 2. Integrate in `MessageComposer.native.tsx`

**Add toolbar inside expanded composer:**

```tsx
{isExpanded && (
  <View style={styles.expandedContainer}>
    {/* Add toolbar here */}
    <MarkdownToolbar
      onFormat={handleMarkdownFormat}
      visible={true}
    />

    {/* Existing TextInput */}
    <TextInput
      ref={textInputRef}
      // ... existing props
    />
  </View>
)}
```

**Add format handler:**

```tsx
const handleMarkdownFormat = useCallback(
  (formatFn: FormatFunction) => {
    const result = formatFn(value, selectionRange.start, selectionRange.end);
    onChange(result.newText);

    // Restore selection (React Native version)
    setTimeout(() => {
      textInputRef.current?.setNativeProps({
        selection: { start: result.newStart, end: result.newEnd }
      });
      textInputRef.current?.focus();
    }, 0);
  },
  [value, selectionRange, onChange]
);
```

### Reusable Cross-Platform Code

These already work on both platforms:
- ✅ `src/utils/markdownFormatting.ts` (all formatting functions)
- ✅ `src/components/primitives/Button` (has `.native.tsx`)
- ✅ `src/components/primitives/Icon` (has `.native.tsx`)

### Mobile-Specific Considerations

**Text Selection:**
- React Native TextInput selection is harder to detect than web textarea
- Recommended: Toolbar always visible when expanded (simpler UX)
- Future enhancement: Add `onSelectionChange` detection

**Platform Differences:**
- **iOS**: Selection handles might cover small toolbar, position carefully
- **Android**: Keyboard behavior varies, test with different keyboards
- **Touch targets**: Ensure 44x44pt minimum (Button primitive handles this)

**Keyboard Behavior:**
- Toolbar should stay above keyboard
- May need `KeyboardAvoidingView` adjustments

### Testing Checklist (Mobile)

- [ ] Toolbar appears in expanded MessageComposer
- [ ] All 6 buttons apply correct markdown syntax
- [ ] Horizontal scrolling works on narrow screens (< 375px width)
- [ ] Buttons have proper touch targets (44x44pt)
- [ ] Formatting works with cursor position (no selection)
- [ ] Formatting works with text selection
- [ ] Toolbar doesn't interfere with keyboard
- [ ] Works on iOS and Android
- [ ] Matches app theme (light/dark mode)

### Estimated Effort: ~3.5 hours
- Component creation: 1 hour
- Integration: 1.25 hours
- Testing & refinement: 1.25 hours

---

## Quick Reference

**Desktop Files:**
- Component: `src/components/message/MarkdownToolbar.tsx`
- Styling: `src/components/message/MarkdownToolbar.scss`
- Positioning: `src/utils/toolbarPositioning.ts`
- Formatting: `src/utils/markdownFormatting.ts`
- Integration: `src/components/message/MessageComposer.tsx`, `MessageEditTextarea.tsx`
- Platform detection: `src/utils/platform.ts` (`isTouchDevice()`)

**Mobile Files (To Create):**
- Component: `src/components/message/MarkdownToolbar.native.tsx`
- Integration: `src/components/message/MessageComposer.native.tsx`

**Shared (Cross-Platform):**
- Formatting: `src/utils/markdownFormatting.ts` ✅
- Button primitive: `src/components/primitives/Button` ✅
- Icon primitive: `src/components/primitives/Icon` ✅

---

**Last Updated:** 2025-11-07
