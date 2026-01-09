---
type: task
title: 'Research: Mobile Markdown Formatting Options'
status: on-hold
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Research: Mobile Markdown Formatting Options

**Status:** ✅ Complete | **Priority:** Medium
**Created:** 2025-11-07

---

## Question

Can we add formatting buttons to the native text selection menu (like Telegram/WhatsApp) on React Native?

---

## Options Evaluated

- **Option A**: No toolbar - manual markdown (like Discord mobile)
- **Option B**: Native selection menu integration (like Telegram)
- **Option C**: Inline toolbar above textarea
- **Option D**: Live markdown formatting (Expensify approach)

---

## How Other Apps Do It

| App | Approach |
|-----|----------|
| **Discord Mobile** | No toolbar - manual markdown |
| **Telegram/WhatsApp** | Native selection menu (Copy \| **B** \| *I* \| Select All) |
| **Slack Mobile** | Bottom sheet (not native menu) |

**Why Telegram/WhatsApp can do native menus:**
- Native iOS/Android apps (not React Native)
- Store rich text metadata (not markdown syntax)
- Direct platform API access

---

## Findings Summary

### Option B: Native Selection Menu ❌ NOT VIABLE

**Technical Reality:**
- React Native doesn't expose iOS/Android selection menu APIs
- Requires custom native modules (Objective-C/Swift + Java/Kotlin)
- **80-120 hours implementation** + ongoing maintenance
- Not Expo Go compatible (needs custom dev build)
- OS updates break APIs (UIMenuController deprecated iOS 16)

**Available Libraries:**
- `@astrocoders/react-native-selectable-text` - only for read-only Text, not TextInput
- `react-native-selectable-text-input` - unmaintained, poor docs
- No production-ready solution for TextInput selection menu

### Option C: Inline Toolbar ✅ VIABLE

**Key Insight:** Desktop already solves markdown conflicts!
- `src/utils/markdownFormatting.ts` has smart toggle functions
- `toggleBold()` **detects existing** `**bold**` and removes it (no nesting)
- Same code works on mobile

**Implementation:**
- Toolbar sits above TextInput (always visible when expanded)
- Reuses existing formatting functions
- ~3-4 hours implementation

**Trade-offs:**
- ✅ User-friendly, consistent with desktop
- ❌ Takes ~40-50px vertical space
- ❌ Always visible (visual clutter)

### Option D: Live Markdown ⚠️ COMPLEX

**Library:** `react-native-live-markdown` (Expensify)
- Type `**bold**` → see formatting live
- 24h implementation + custom dev build
- Different UX paradigm

---

## Final Recommendation

### Two Viable Paths Forward

**Option A: No Toolbar** ✅ **RECOMMENDED**
- Users type markdown manually: `**bold**`, `*italic*`
- Like Discord mobile
- **Pros:**
  - Zero implementation cost
  - Clean UI, maximum text space
  - Works today
- **Cons:**
  - Requires markdown knowledge
  - Less discoverable

**Option C: Inline Toolbar** ✅ **VIABLE (Add if needed)**
- Always-visible toolbar above TextInput
- Reuses `src/utils/markdownFormatting.ts` (handles conflicts!)
- **Pros:**
  - User-friendly, no markdown knowledge needed
  - Consistent with desktop UX
  - 3-4 hours implementation
- **Cons:**
  - Takes 40-50px vertical space
  - Visual clutter

**Option B: Native Selection Menu** ❌ **NOT VIABLE**
- 80-120 hours + ongoing maintenance
- Requires native modules (iOS + Android)
- Not Expo Go compatible
- OS API changes break implementation

**Option D: Live Markdown** ⚠️ **COMPLEX**
- 24 hours + custom dev build
- Different UX paradigm
- Overkill for current needs

---

## Strategy

**Start with Option A** (no toolbar) → **Add Option C if users request it**

Monitor user feedback:
- If users complain "how do I format text on mobile?" → implement inline toolbar (3-4h)
- If users are fine with manual markdown → keep it simple

---

## Implementation Notes (If Adding Option C)

**Files to modify:**
- `MessageComposer.native.tsx` - add `<MarkdownToolbar>` above TextInput
- Create `MarkdownToolbar.native.tsx` - horizontal scrollable button row
- Reuse `src/utils/markdownFormatting.ts` - no changes needed!

**Effort:** ~3-4 hours

---

## Related Files

- `src/utils/markdownFormatting.ts` - Smart toggle functions (cross-platform)
- `src/components/message/MarkdownToolbar.tsx` - Desktop floating toolbar
- `src/components/message/MessageComposer.native.tsx` - Mobile composer
- `.agents/tasks/markdown-toolbar-editor.md` - Desktop implementation details

---

**Last Updated:** 2025-11-07 (Research Completed)
