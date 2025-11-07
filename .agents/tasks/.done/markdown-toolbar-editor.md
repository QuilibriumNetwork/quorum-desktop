# Markdown Toolbar Editor

**Status:** ✅ Desktop Complete | ✅ Mobile Decision Made
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
| Touch devices (web) | ❌ Disabled (respects native browser selection) |
| Mobile native app | ✅ Manual markdown (no toolbar) |

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

## Mobile Implementation (Native App)

### Current Status: Option A (No Toolbar) ✅

**Decision:** Start with manual markdown (like Discord mobile)
- Users type markdown syntax: `**bold**`, `*italic*`, `~~strikethrough~~`
- Zero implementation cost
- Clean UI with maximum text space
- Works with existing cross-platform markdown rendering

### Why Not Native Selection Menu?

After extensive research, integrating formatting into native OS selection menu (like Telegram/WhatsApp) is **not viable**:
- React Native doesn't expose iOS/Android selection menu APIs
- Requires custom native modules (80-120 hours + maintenance)
- WhatsApp/Telegram use native apps with direct platform API access
- Not compatible with Expo Go (requires custom dev build)

### Future Enhancement: Inline Toolbar (Optional)

If users request easier formatting, we can add an **inline toolbar** above TextInput:
- Always visible when composer expanded
- Reuses existing `src/utils/markdownFormatting.ts` (smart toggle functions)
- ~3-4 hours implementation
- Trade-off: Takes 40-50px vertical space

**See:** [markdown-toolbar-editor_mobile.md](./markdown-toolbar-editor_mobile.md) for complete research and implementation details

### Key Architectural Insight

Desktop's `markdownFormatting.ts` already handles markdown conflicts:
- `toggleBold()` detects existing `**bold**` and removes it (no nesting)
- `toggleItalic()` and other functions work the same way
- This same code works on mobile without modification
- Inline toolbar is viable; native selection menu is not

---

## Quick Reference

**Desktop Files:**
- Component: `src/components/message/MarkdownToolbar.tsx`
- Styling: `src/components/message/MarkdownToolbar.scss`
- Positioning: `src/utils/toolbarPositioning.ts`
- Formatting: `src/utils/markdownFormatting.ts`
- Integration: `src/components/message/MessageComposer.tsx`, `MessageEditTextarea.tsx`
- Platform detection: `src/utils/platform.ts` (`isTouchDevice()`)

**Mobile (Native App):**
- Current: Manual markdown (no toolbar implementation needed)
- Future: See [markdown-toolbar-editor_mobile.md](./markdown-toolbar-editor_mobile.md) for inline toolbar option

**Shared (Cross-Platform):**
- Formatting: `src/utils/markdownFormatting.ts` ✅
- Button primitive: `src/components/primitives/Button` ✅ (if toolbar added)
- Icon primitive: `src/components/primitives/Icon` ✅ (if toolbar added)

**Related Documentation:**
- [markdown-toolbar-editor_mobile.md](./markdown-toolbar-editor_mobile.md) - Mobile research & implementation details

---

**Last Updated:** 2025-11-07
