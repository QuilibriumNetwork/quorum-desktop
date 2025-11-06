# Markdown Toolbar Editor Implementation

**Status:** Pending
**Priority:** Medium
**Complexity:** Medium
**Created:** 2025-11-06
**Type:** Feature Enhancement

## Overview

Implement a simple Discord-style markdown toolbar that appears when users select text in the MessageComposer. The toolbar provides quick formatting buttons for common markdown syntax.

## Design

- **Style**: Discord-inspired floating toolbar
- **Trigger**: Appears above selected text
- **Buttons**: 6 icon-only buttons in a horizontal row
- **Component**: Uses existing Button primitive with `iconOnly` prop

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

### Phase 5: Mobile Implementation (Later Phase)

**New file:** `src/components/message/MarkdownToolbar.native.tsx`

**Approach:**
- Show toolbar in expanded input mode (not floating)
- Horizontal scrollable row above keyboard
- Use same Button primitive (already has `.native.tsx` version)
- Touch-friendly sizing (Button primitive handles this automatically)
- Same 6 buttons with same props

**File to modify:** `src/components/message/MessageComposer.native.tsx`

**Integration:**
```tsx
{isExpanded && (
  <MarkdownToolbar
    visible={true}
    onFormat={handleMarkdownFormat}
  />
)}
```

**Mobile differences:**
- No floating positioning needed (inline in expanded mode)
- No text selection detection (toolbar always visible when expanded)
- Button primitive automatically applies React Native styles
- May need horizontal ScrollView if screen is narrow

**Estimated time:** 1.5 hours

---

## Files Summary

### New Files (4):
1. `src/utils/markdownFormatting.ts` (~80 lines)
2. `src/components/message/MarkdownToolbar.tsx` (~60 lines)
3. `src/components/message/MarkdownToolbar.scss` (~20 lines)
4. `src/components/message/MarkdownToolbar.native.tsx` (~50 lines) - Phase 5

### Modified Files (4):
1. `src/components/primitives/Icon/iconMapping.ts` (+5 lines)
2. `src/components/primitives/Icon/types.ts` (+5 icon names)
3. `src/components/message/MessageComposer.tsx` (~40 lines added)
4. `src/components/message/MessageComposer.native.tsx` (~30 lines) - Phase 5

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

### Functionality:
- [ ] Toolbar appears when text is selected
- [ ] Toolbar hides when clicking outside or after formatting
- [ ] All 6 buttons apply correct markdown syntax
- [ ] Selected text remains selected after formatting
- [ ] Empty selection inserts syntax with cursor in middle
- [ ] Works with existing mention system (no conflicts)
- [ ] Tooltips show on button hover
- [ ] Toolbar positioned correctly (not cut off by viewport)

### Cross-Platform:
- [ ] Desktop: Floating toolbar on text selection
- [ ] Mobile: Inline toolbar in expanded mode (Phase 5)
- [ ] Button primitive styles correctly on both platforms

### Edge Cases:
- [ ] Multiple selections (rapid clicking)
- [ ] Very long text selection
- [ ] Selection near viewport edges
- [ ] Textarea resize/repositioning
- [ ] Keyboard shortcuts don't conflict

---

## Estimated Total Effort

**Desktop Implementation (Phases 1-4):**
- Phase 1: 15 minutes
- Phase 2: 1 hour
- Phase 3: 1.5 hours
- Phase 4: 2 hours
- **Total: ~4.5-5 hours**

**Mobile Implementation (Phase 5):**
- Phase 5: 1.5 hours
- **Total with Mobile: ~6-7 hours**

---

## Success Criteria

✅ Toolbar appears when user selects text in MessageComposer
✅ 6 buttons work correctly (heading, bold, quote, italic, code, strikethrough)
✅ Toolbar positioned above selection (Discord-style)
✅ Selected text remains selected after formatting
✅ Toolbar hides after applying format or clicking away
✅ Buttons have proper hover states and tooltips (via Button primitive)
✅ Works with existing mention system (no conflicts)
✅ Matches app styling and theme (Button primitive ensures this)
✅ Mobile version shows in expanded input mode (Phase 5)

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

**Last Updated:** 2025-11-06
**Dependencies:** MessageComposer, Button primitive, Icon primitive, markdown rendering system
**Related:** `.agents/tasks/.done/message-markdown-support.md` (Phase 4: User Experience enhancement)
