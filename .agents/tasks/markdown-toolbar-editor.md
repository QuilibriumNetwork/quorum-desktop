# Markdown Toolbar Editor Implementation

**Status:** ✅ Completed (Desktop) | ⏳ Pending (Mobile)
**Priority:** Medium
**Complexity:** Medium
**Created:** 2025-11-06
**Completed (Desktop):** 2025-11-06
**Type:** Feature Enhancement

## Overview

Implement a simple Discord-style markdown toolbar that appears when users select text in the MessageComposer. The toolbar provides quick formatting buttons for common markdown syntax.

## Design

- **Style**: Tooltip-style floating toolbar with downward-pointing arrow
- **Trigger**: Appears centered above selected text on `mouseUp` event
- **Positioning**: Smart positioning that centers on selection, handles viewport boundaries
- **Buttons**: 6 icon-only buttons in a horizontal row
- **Component**: Uses existing Button primitive with `iconOnly` prop
- **Visual**: Matches tooltip styling (`--color-bg-tooltip`) with 2px border and arrow

## ✅ Actual Implementation (Desktop - Completed)

The desktop implementation follows the planned design with several enhancements:

### Key Differences from Original Plan:
1. **Tooltip-style arrow**: Added CSS `::before` and `::after` pseudo-elements for arrow pointing to selection
2. **Smart positioning utility**: Created `src/utils/toolbarPositioning.ts` for precise positioning
3. **Mirror element technique**: Uses industry-standard approach to calculate selection coordinates
4. **Viewport boundary handling**: Toolbar never goes off-screen, clamps to minimum spacing
5. **ScrollTop compensation**: Handles scrolled textareas correctly
6. **SCSS variables**: Uses design system variables instead of hardcoded values
7. **Simplified props**: Removed `onClose` prop (not needed)
8. **Button type**: Uses `type="unstyled"` with custom hover colors

### Implementation Phases Completed:

#### ✅ Phase 1: Icons Added
- Added 5 new icons to Icon primitive: `bold`, `italic`, `strikethrough`, `heading`, `quote`
- Files: `src/components/primitives/Icon/iconMapping.ts`, `types.ts`

#### ✅ Phase 2: Markdown Formatting Utility
- **File**: `src/utils/markdownFormatting.ts`
- All planned functions implemented
- Toggle detection for bold/italic/strikethrough
- Empty selection handling
- Returns new cursor positions

#### ✅ Phase 3: Positioning Utility (NEW)
- **File**: `src/utils/toolbarPositioning.ts` (~200 lines)
- Smart centering above selection using mirror element technique
- Viewport boundary constraints (16px padding)
- Handles first-line selections (scrollTop compensation)
- Fallback positioning for edge cases
- Constants: `TOOLBAR_OFFSET: 52px`, `TOOLBAR_WIDTH: 240px`, `MIN_TOP_SPACING: 10px`

#### ✅ Phase 4: Desktop Toolbar Component
- **Files**:
  - `src/components/message/MarkdownToolbar.tsx` (~80 lines)
  - `src/components/message/MarkdownToolbar.scss` (~75 lines)
- Tooltip-style appearance with arrow (`::before` for border, `::after` for fill)
- Arrow uses same colors as toolbar (background + border)
- Smooth fade-in animation (150ms)
- Z-index: 10002 (same as tooltips)
- Button hover states with custom colors

#### ✅ Phase 5: MessageComposer Integration
- **File**: `src/components/message/MessageComposer.tsx`
- Added `handleTextareaMouseUp` using `calculateToolbarPosition()` utility
- State management: `showMarkdownToolbar`, `toolbarPosition`, `selectionRange`
- Format handler follows existing `handleMentionSelect` pattern
- Restores selection after formatting (setTimeout pattern)

### Files Created (3):
1. `src/utils/toolbarPositioning.ts` (~200 lines) - **NEW** positioning utility
2. `src/utils/markdownFormatting.ts` (~170 lines)
3. `src/components/message/MarkdownToolbar.tsx` (~80 lines)
4. `src/components/message/MarkdownToolbar.scss` (~75 lines)

### Files Modified (3):
1. `src/components/primitives/Icon/iconMapping.ts` (+5 icons)
2. `src/components/primitives/Icon/types.ts` (+5 type names)
3. `src/components/message/MessageComposer.tsx` (~50 lines added)

## Toolbar Buttons (6 total)

1. **Heading** → `### text` - Icon: `heading` (Tabler: `IconHeading`)
2. **Bold** → `**text**` - Icon: `bold` (Tabler: `IconBold`)
3. **Quote** → `> text` - Icon: `quote` (Tabler: `IconQuote`)
4. **Italic** → `*text*` - Icon: `italic` (Tabler: `IconItalic`)
5. **Code** → `` `text` `` - Icon: `code` (Tabler: `IconCode`) ✅ Already in iconMapping
6. **Strikethrough** → `~~text~~` - Icon: `strikethrough` (Tabler: `IconStrikethrough`)

## Implementation Plan

### Phase 1: Add Missing Icons to Icon Component

**Files to modify:**
- `src/components/primitives/Icon/iconMapping.ts`
- `src/components/primitives/Icon/types.ts`

**Tasks:**
1. Add 5 new icons to `iconComponentMap` (around line 150, near existing `code` icon):
   ```typescript
   // Text formatting icons
   bold: 'IconBold',
   italic: 'IconItalic',
   strikethrough: 'IconStrikethrough',
   heading: 'IconHeading',
   quote: 'IconQuote',
   ```
2. Update `IconName` type in `types.ts` to include new icon names

**Estimated time:** 15 minutes

---

### Phase 2: Create Markdown Formatting Utility

**New file:** `src/utils/markdownFormatting.ts`

**Purpose:** Utility functions to wrap selected text with markdown syntax

**Key functions:**
```typescript
interface FormatResult {
  newText: string;      // Full text with formatting applied
  newStart: number;     // New selection start position
  newEnd: number;       // New selection end position
}

// Core wrapping function
export function wrapSelection(
  text: string,
  start: number,
  end: number,
  prefix: string,
  suffix?: string
): FormatResult

// Specific formatters (all return FormatResult)
export function toggleBold(text: string, start: number, end: number): FormatResult
export function toggleItalic(text: string, start: number, end: number): FormatResult
export function toggleStrikethrough(text: string, start: number, end: number): FormatResult
export function wrapCode(text: string, start: number, end: number): FormatResult
export function insertBlockQuote(text: string, start: number, end: number): FormatResult
export function insertHeading(text: string, start: number, end: number): FormatResult // Always ### (H3)
```

**Implementation notes:**
- Handle empty selections (insert syntax with cursor in middle)
- Handle existing markdown (toggle off if already formatted)
- Return new cursor position to restore selection after formatting

**Estimated time:** 1 hour

---

### Phase 3: Create Desktop Toolbar Component

**New files:**
- `src/components/message/MarkdownToolbar.tsx` (web only)
- `src/components/message/MarkdownToolbar.scss` (styling)

**Component structure:**
```tsx
interface MarkdownToolbarProps {
  visible: boolean;
  position: { top: number; left: number };
  onFormat: (formatFn: FormatFunction) => void;
  onClose: () => void;
}

export function MarkdownToolbar({ visible, position, onFormat, onClose }: MarkdownToolbarProps) {
  if (!visible) return null;

  return (
    <div className="markdown-toolbar" style={{ top: position.top, left: position.left }}>
      <Button type="subtle" size="compact" iconName="heading" iconOnly onClick={() => onFormat(insertHeading)} tooltip="Heading" />
      <Button type="subtle" size="compact" iconName="bold" iconOnly onClick={() => onFormat(toggleBold)} tooltip="Bold" />
      <Button type="subtle" size="compact" iconName="quote" iconOnly onClick={() => onFormat(insertBlockQuote)} tooltip="Quote" />
      <Button type="subtle" size="compact" iconName="italic" iconOnly onClick={() => onFormat(toggleItalic)} tooltip="Italic" />
      <Button type="subtle" size="compact" iconName="code" iconOnly onClick={() => onFormat(wrapCode)} tooltip="Code" />
      <Button type="subtle" size="compact" iconName="strikethrough" iconOnly onClick={() => onFormat(toggleStrikethrough)} tooltip="Strikethrough" />
    </div>
  );
}
```

**Styling (minimal - Button primitive handles buttons):**
```scss
.markdown-toolbar {
  position: fixed;
  display: flex;
  gap: $s-1; // 4px gap between buttons
  background: var(--surface-0);
  border: $border solid var(--color-border-default);
  border-radius: $rounded-lg;
  padding: $s-1; // 4px padding
  box-shadow: $shadow-lg;
  z-index: 1000;
}
```

**Why use Button primitive:**
- ✅ Built-in `iconOnly` prop creates perfect circular buttons (28x28px with `size="compact"`)
- ✅ Built-in hover states via `type="subtle"`
- ✅ Built-in tooltip support
- ✅ Consistent with app design system
- ✅ Cross-platform ready (.web.tsx and .native.tsx)
- ✅ Zero custom button styling needed

**Estimated time:** 1.5 hours

---

### Phase 4: Integrate into MessageComposer (Desktop)

**File to modify:** `src/components/message/MessageComposer.tsx`

**Integration tasks:**

1. **Add state:**
   ```tsx
   const [showMarkdownToolbar, setShowMarkdownToolbar] = useState(false);
   const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
   const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
   ```

2. **Add text selection handler:**
   ```tsx
   const handleTextareaMouseUp = useCallback(() => {
     const textarea = textareaRef.current;
     if (!textarea) return;

     const start = textarea.selectionStart;
     const end = textarea.selectionEnd;

     if (end > start) {
       // Text is selected
       setSelectionRange({ start, end });

       // Calculate position above textarea
       const textareaRect = textarea.getBoundingClientRect();
       setToolbarPosition({
         top: textareaRect.top - 50, // 50px above textarea
         left: textareaRect.left + 20
       });

       setShowMarkdownToolbar(true);
     } else {
       setShowMarkdownToolbar(false);
     }
   }, []);
   ```

3. **Add format handler (reuse pattern from handleMentionSelect):**
   ```tsx
   const handleMarkdownFormat = useCallback(
     (formatFn: FormatFunction) => {
       const result = formatFn(value, selectionRange.start, selectionRange.end);
       onChange(result.newText);

       // Restore selection and focus (same pattern as handleMentionSelect, lines 132-159)
       setTimeout(() => {
         textareaRef.current?.setSelectionRange(result.newStart, result.newEnd);
         textareaRef.current?.focus();
         setShowMarkdownToolbar(false);
       }, 0);
     },
     [value, selectionRange, onChange]
   );
   ```

4. **Add toolbar to JSX:**
   ```tsx
   <MarkdownToolbar
     visible={showMarkdownToolbar}
     position={toolbarPosition}
     onFormat={handleMarkdownFormat}
     onClose={() => setShowMarkdownToolbar(false)}
   />
   ```

5. **Add mouseUp listener to textarea:**
   ```tsx
   <TextArea
     ref={textareaRef}
     onMouseUp={handleTextareaMouseUp}
     // ... existing props
   />
   ```

6. **Add click-outside handler** (hide toolbar when clicking outside)

**Reference:** Existing `handleMentionSelect` pattern (lines 132-159) shows exact same text insertion approach

**Estimated time:** 2 hours

---

---

## ⏳ Mobile Implementation (Pending)

### Overview
Implement the markdown toolbar for React Native (iOS/Android). Unlike desktop, mobile will use an **inline toolbar** that appears in the expanded MessageComposer, not a floating overlay.

### Design Approach

**Key differences from desktop:**
1. **Inline positioning**: Not floating - toolbar sits inside expanded composer UI
2. **Always visible when expanded**: No text selection detection (harder on mobile)
3. **No arrow**: Not needed since it's inline
4. **Touch-friendly**: Larger tap targets, horizontal scrollable if needed
5. **Platform-specific behavior**: Uses React Native components

### Files to Create

#### 1. `src/components/message/MarkdownToolbar.native.tsx`
**Structure:**
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
  visible?: boolean; // Optional, for future text selection support
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
        <Button
          type="unstyled"
          size="compact"
          iconName="heading"
          iconOnly
          onClick={() => onFormat(insertHeading)}
          style={styles.button}
        />
        <Button
          type="unstyled"
          size="compact"
          iconName="bold"
          iconOnly
          onClick={() => onFormat(toggleBold)}
          style={styles.button}
        />
        {/* ... rest of buttons */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent', // Or use theme color
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)', // Or use theme color
  },
  scrollContent: {
    gap: 4, // React Native 0.71+ supports gap
    paddingHorizontal: 4,
  },
  button: {
    marginHorizontal: 2, // Fallback for older RN versions
  },
});
```

**Key points:**
- Uses `ScrollView` with `horizontal` for narrow screens
- No positioning calculations needed (inline component)
- Same formatting functions as desktop
- Button primitive automatically uses `.native.tsx` implementation
- Styling uses React Native `StyleSheet`

#### 2. Integration in `MessageComposer.native.tsx`

**Location to add:** Inside the expanded composer view, above the TextInput

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

**Format handler (reuse from desktop):**
```tsx
const handleMarkdownFormat = useCallback(
  (formatFn: FormatFunction) => {
    const result = formatFn(value, selectionRange.start, selectionRange.end);
    onChange(result.newText);

    // Restore selection and focus (React Native version)
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

### Implementation Steps

1. **Create native component** (`MarkdownToolbar.native.tsx`)
   - Import React Native components (View, ScrollView)
   - Use Button primitive (already cross-platform)
   - Add horizontal scrolling
   - Style with theme colors
   - **Time estimate:** 1 hour

2. **Find MessageComposer expanded mode** (`MessageComposer.native.tsx`)
   - Locate where expanded input is rendered
   - Identify the `isExpanded` state variable
   - Find the TextInput ref
   - **Time estimate:** 15 minutes

3. **Add toolbar to expanded mode**
   - Place toolbar above TextInput in expanded view
   - Pass `handleMarkdownFormat` handler
   - Test that buttons appear
   - **Time estimate:** 30 minutes

4. **Add format handler**
   - Adapt desktop `handleMarkdownFormat` for React Native
   - Use `setNativeProps` for selection restoration
   - Test formatting with each button
   - **Time estimate:** 45 minutes

5. **Test on devices**
   - Test on iOS simulator/device
   - Test on Android emulator/device
   - Test horizontal scrolling on narrow screens
   - Test with existing mention system (no conflicts)
   - **Time estimate:** 1 hour

### Mobile-Specific Considerations

**Text Selection Challenges:**
- React Native TextInput selection is harder to detect than web `<textarea>`
- Current plan: Toolbar always visible when expanded (simpler UX)
- Future enhancement: Add `onSelectionChange` detection

**Platform Differences:**
- **iOS**: Selection handles might cover small toolbar, position carefully
- **Android**: Keyboard behavior varies, test with different keyboards
- **Touch targets**: Ensure 44x44pt minimum (Button primitive should handle this)

**Keyboard Behavior:**
- Toolbar should stay above keyboard
- Consider using `KeyboardAvoidingView` if needed
- May need `keyboardVerticalOffset` adjustments

**Performance:**
- Minimal - only 6 buttons in ScrollView
- No complex positioning calculations
- Reuses existing formatting utilities

### Testing Checklist (Mobile)

- [ ] Toolbar appears in expanded MessageComposer
- [ ] All 6 buttons apply correct markdown syntax
- [ ] Horizontal scrolling works on narrow screens (< 375px width)
- [ ] Buttons have proper touch targets (44x44pt minimum)
- [ ] Formatting works with cursor position (no selection)
- [ ] Formatting works with text selection
- [ ] Toolbar doesn't interfere with keyboard
- [ ] Works on iOS simulator/device
- [ ] Works on Android emulator/device
- [ ] Doesn't conflict with mention system
- [ ] Matches app theme (light/dark mode)

### Files Summary (Mobile)

**New Files (1):**
- `src/components/message/MarkdownToolbar.native.tsx` (~100 lines)

**Modified Files (1):**
- `src/components/message/MessageComposer.native.tsx` (~30 lines added)

**Reused Files (utilities work on both platforms):**
- `src/utils/markdownFormatting.ts` ✅ Already cross-platform
- `src/components/primitives/Button` ✅ Already has `.native.tsx`
- `src/components/primitives/Icon` ✅ Already has `.native.tsx`

### Estimated Time: 3.5 hours
- Component creation: 1 hour
- Integration: 1.25 hours
- Testing & refinement: 1.25 hours

### Notes for Mobile Implementation

1. **Keep it simple**: Don't try to replicate floating tooltip behavior
2. **Always visible approach**: Simpler than text selection detection on mobile
3. **Horizontal scroll**: Handles all screen sizes gracefully
4. **Reuse utilities**: All formatting logic is platform-agnostic
5. **Button primitive**: Already handles touch targets and platform styles
6. **Future enhancement**: Could add text selection detection with `onSelectionChange`

### Reference Implementation

The desktop implementation provides these reusable pieces:
- ✅ `markdownFormatting.ts` - Works on both platforms
- ✅ Button primitive - Already cross-platform
- ✅ Icon primitive - Already cross-platform
- ✅ Format handler pattern - Adaptable to React Native
- ✅ Same 6 buttons - Same functionality

Only need to create:
- Mobile UI layout (inline, not floating)
- React Native styling
- Integration with MessageComposer.native.tsx

---

## Files Summary

### Desktop (Completed):

**New Files (4):**
1. `src/utils/toolbarPositioning.ts` (~200 lines) - Smart positioning utility
2. `src/utils/markdownFormatting.ts` (~170 lines) - Markdown syntax functions
3. `src/components/message/MarkdownToolbar.tsx` (~80 lines) - Toolbar component
4. `src/components/message/MarkdownToolbar.scss` (~75 lines) - Toolbar styling

**Modified Files (3):**
1. `src/components/primitives/Icon/iconMapping.ts` (+5 icon mappings)
2. `src/components/primitives/Icon/types.ts` (+5 icon type names)
3. `src/components/message/MessageComposer.tsx` (~50 lines added)

### Mobile (Pending):

**New Files (1):**
1. `src/components/message/MarkdownToolbar.native.tsx` (~100 lines) - Mobile toolbar

**Modified Files (1):**
1. `src/components/message/MessageComposer.native.tsx` (~30 lines added)

**Reused (Cross-platform):**
- `src/utils/markdownFormatting.ts` ✅
- `src/components/primitives/Button` ✅
- `src/components/primitives/Icon` ✅

---

## Technical Implementation Details

### Text Selection Detection Pattern
```typescript
// On mouseUp, check if text is selected
const start = textareaRef.current?.selectionStart || 0;
const end = textareaRef.current?.selectionEnd || 0;

if (end > start) {
  // Show toolbar
} else {
  // Hide toolbar
}
```

### Text Formatting Pattern (from existing handleMentionSelect)
```typescript
// 1. Apply formatting function
const result = formatFn(value, selectionRange.start, selectionRange.end);

// 2. Update textarea value
onChange(result.newText);

// 3. Restore selection (critical for UX)
setTimeout(() => {
  textareaRef.current?.setSelectionRange(result.newStart, result.newEnd);
  textareaRef.current?.focus();
}, 0);
```

### Position Calculation
```typescript
// Get textarea position
const textareaRect = textarea.getBoundingClientRect();

// Position toolbar above textarea (simple approach)
const toolbarPosition = {
  top: textareaRect.top - 50,  // 50px above
  left: textareaRect.left + 20 // Small horizontal offset
};
```

**Note:** Advanced positioning (above selection, not textarea) can be added later if needed.

---

## Dependencies

### Existing Infrastructure (Already Available):
- ✅ Button primitive with `iconOnly` support
- ✅ Icon primitive with Tabler Icons
- ✅ Tooltip support in Button component
- ✅ Text selection APIs (`selectionStart`, `selectionEnd`, `setSelectionRange`)
- ✅ Text insertion pattern (from mention system)
- ✅ Existing `textareaRef` in MessageComposer
- ✅ Cross-platform component architecture

### New Dependencies:
- ❌ None! (Zero new npm packages)

---

## Testing Checklist

### Desktop Functionality (Completed ✅):
- [x] Toolbar appears when text is selected
- [x] Toolbar hides after formatting
- [x] All 6 buttons apply correct markdown syntax
- [x] Selected text remains selected after formatting
- [x] Empty selection inserts syntax with cursor in middle
- [x] Works with existing mention system (no conflicts)
- [x] Toolbar positioned correctly (not cut off by viewport)
- [x] Arrow points to selection
- [x] Tooltip styling matches app tooltips

### Desktop Edge Cases (Completed ✅):
- [x] First-line text selection (scrollTop compensation)
- [x] Multi-line text selection (uses top of selection)
- [x] Selection near viewport edges (viewport clamping)
- [x] Scrolled textarea (mirror element handles this)
- [x] Single word, multiple words, multiple lines

### Mobile Functionality (Pending):
- [ ] Toolbar appears in expanded MessageComposer
- [ ] All 6 buttons apply correct markdown syntax
- [ ] Horizontal scrolling works on narrow screens
- [ ] Buttons have proper touch targets (44x44pt)
- [ ] Formatting works with cursor position
- [ ] Formatting works with text selection
- [ ] Toolbar doesn't interfere with keyboard
- [ ] Works on iOS and Android
- [ ] Doesn't conflict with mention system
- [ ] Matches app theme (light/dark mode)

---

## Estimated Total Effort

**Desktop Implementation (Completed):**
- Phase 1 (Icons): 15 minutes
- Phase 2 (Formatting utils): 1 hour
- Phase 3 (Positioning utils): 1.5 hours *(NEW - not in original plan)*
- Phase 4 (Toolbar component): 1.5 hours
- Phase 5 (Integration): 1 hour
- Refinements (arrow, edge cases): 1 hour
- **Actual Total: ~6 hours** (vs planned 4.5-5 hours)

**Mobile Implementation (Pending):**
- Component creation: 1 hour
- Integration: 1.25 hours
- Testing & refinement: 1.25 hours
- **Estimated: ~3.5 hours**

**Complete Implementation: ~9.5 hours** (Desktop ✅ + Mobile ⏳)

---

## Success Criteria

### Desktop (Completed ✅):
- ✅ Toolbar appears when user selects text in MessageComposer
- ✅ 6 buttons work correctly (heading, bold, quote, italic, code, strikethrough)
- ✅ Toolbar positioned above selection with tooltip-style arrow
- ✅ Smart centering on selection (not just textarea)
- ✅ Viewport boundary handling (never goes off-screen)
- ✅ First-line selection support (scrollTop compensation)
- ✅ Multi-line selection support (positions above first line)
- ✅ Selected text remains selected after formatting
- ✅ Toolbar hides after applying format
- ✅ Buttons have proper hover states
- ✅ Works with existing mention system (no conflicts)
- ✅ Matches tooltip styling and theme
- ✅ Smooth fade-in animation

### Mobile (Pending):
- [ ] Toolbar appears in expanded MessageComposer
- [ ] Same 6 buttons with same functionality
- [ ] Inline positioning (not floating)
- [ ] Horizontal scrolling on narrow screens
- [ ] Touch-friendly tap targets
- [ ] Works on iOS and Android
- [ ] Keyboard doesn't cover toolbar
- [ ] Matches app theme

---

## Benefits

✅ **Ultra-lightweight**: ~150 lines of code total, zero new dependencies
✅ **Familiar UX**: Discord-style toolbar users already know
✅ **Design system consistency**: Uses existing Button primitive
✅ **No custom styling**: Button primitive handles all button appearance
✅ **Built-in tooltips**: Button primitive includes tooltip support
✅ **Cross-platform ready**: Button has .web.tsx and .native.tsx already
✅ **Simple maintenance**: Fewer custom styles to maintain
✅ **Performance**: No overhead, instant response
✅ **Accessible**: Button primitive already handles accessibility

---

## Notes

- Lists and ordered lists are easier for users to create manually (excluded from toolbar)
- Separators (`---`) are rare and excluded from toolbar
- Links are automatically rendered, no need for markdown link syntax in toolbar
- Heading always uses `###` (H3) - simple and consistent
- Button primitive with `type="subtle"` and `size="compact"` provides perfect toolbar button styling

---

## Lessons Learned (Desktop Implementation)

### What Worked Well:
1. **Mirror element technique**: Industry-standard approach worked perfectly for textarea selection positioning
2. **Reusing primitives**: Button and Icon primitives made implementation very clean
3. **Tooltip styling**: Matching existing tooltip styles created visual consistency
4. **SCSS variables**: Using design system variables made styling maintainable
5. **Viewport clamping**: Toolbar never goes off-screen, great UX

### Challenges Overcome:
1. **First-line selections**: Required scrollTop compensation in mirror element
2. **Arrow border alignment**: Needed careful pseudo-element sizing (::before 8px, ::after 6px)
3. **Selection API limitation**: Doesn't work on textareas, had to use mirror approach
4. **Multi-line selections**: Positioning above first line provides best UX

### Key Technical Insights:
- `window.getSelection()` doesn't work on `<textarea>` elements (only contentEditable)
- Mirror element must account for `textarea.scrollTop` for accurate positioning
- Viewport clamping prevents toolbar from disappearing at viewport edges
- Arrow requires two pseudo-elements (border + fill) for proper visual depth
- Using `type="unstyled"` buttons with custom colors provides best flexibility

### Unexpected Additions:
- Created full positioning utility (`toolbarPositioning.ts`) - not in original plan
- Added tooltip-style arrow - enhanced from original simple toolbar design
- Implemented viewport boundary detection - better than original fixed positioning
- Added scrollTop compensation - handles edge case not in original plan

---

**Last Updated:** 2025-11-06
**Desktop Completed:** 2025-11-06
**Mobile Status:** Pending
**Dependencies:** MessageComposer, Button primitive, Icon primitive, markdown rendering system, positioning utility
**Related:** `.agents/tasks/.done/message-markdown-support.md` (Phase 4: User Experience enhancement)

---

## Quick Reference

**Desktop Files:**
- Component: `src/components/message/MarkdownToolbar.tsx`
- Styling: `src/components/message/MarkdownToolbar.scss`
- Positioning: `src/utils/toolbarPositioning.ts`
- Formatting: `src/utils/markdownFormatting.ts`
- Integration: `src/components/message/MessageComposer.tsx`

**Mobile Files (To Create):**
- Component: `src/components/message/MarkdownToolbar.native.tsx`
- Integration: `src/components/message/MessageComposer.native.tsx`

**Cross-Platform (Shared):**
- Formatting logic: `src/utils/markdownFormatting.ts` ✅
- Button primitive: `src/components/primitives/Button` ✅
- Icon primitive: `src/components/primitives/Icon` ✅
