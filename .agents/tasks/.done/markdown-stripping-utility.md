# Task: Markdown Stripping Utility

## Overview

Create a general-purpose utility for stripping markdown formatting from text and apply it to improve readability in search results and notifications.

**Status:** Ready for Implementation
**Priority:** Low-Medium
**Complexity:** Low
**Estimated Effort:** 30-45 minutes (library-based approach)
**Depends On:** `strip-markdown` package installation
**Blocks:** dm-conversation-list-preview.md (optional - can use utility once available)

> **⚠️ Updated after feature-analyzer review:** Changed from regex-based (120+ lines) to library-based approach (15 lines) using `strip-markdown` remark plugin for consistency with existing `react-markdown` + `remark-gfm` renderer.

---

## Motivation

Currently, search results and notifications display plain text but retain markdown syntax characters (e.g., `**bold**`, `[link](url)`), which creates visual noise. This task creates a reusable utility to strip markdown formatting and applies it to existing contexts where plain text display is desired.

### Current Problem

**Search Results:**
```
User search for "important update"
Result shows: "The **important** update is ready to [download](url)"
              ↑ Asterisks visible, brackets visible
```

**Notifications:**
```
Notification: "@John mentioned you: Check out **this** new `feature`"
              ↑ Markdown symbols cluttering the preview
```

### Desired Outcome

**Search Results:**
```
Result shows: "The important update is ready to download"
              ↑ Clean, readable text
```

**Notifications:**
```
Notification: "@John mentioned you: Check out this new feature"
              ↑ Clean preview text
```

---

## Implementation Plan

### Phase 0: Install Dependency (prerequisite)

**Install `strip-markdown` package:**
```bash
yarn add strip-markdown
```

> **Rationale:** The app already uses `react-markdown` + `remark-gfm` to render markdown. Using the same remark ecosystem for stripping ensures consistent markdown interpretation. The `strip-markdown` plugin is the official remark plugin for this purpose.

---

### Phase 1: Create Utility (15 minutes)

#### File: `src/utils/markdownStripping.ts` (NEW)

**Purpose:** General-purpose markdown text processing utility (companion to `markdownFormatting.ts`)

**Exports:**
- `stripMarkdown(text: string): string` - Removes all markdown formatting using remark

**Why library-based instead of regex:**
- ✅ Consistent with existing `react-markdown` + `remark-gfm` renderer
- ✅ Handles ALL markdown features (tables, footnotes, task lists, etc.)
- ✅ Properly handles edge cases (nested formatting, escaped characters, unmatched delimiters)
- ✅ Well-tested library (no unit tests needed)
- ✅ 15 lines instead of 120+ lines of regex
- ✅ Same GFM support as renderer

**Implementation:**

```typescript
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import strip from 'strip-markdown';

/**
 * Strips markdown formatting from text to create clean plain text.
 * Uses the same remark parser as the markdown renderer to ensure consistency.
 *
 * This is a general-purpose utility that can be used anywhere in the app where
 * plain text is needed from markdown-formatted content (previews, notifications,
 * search results, etc.)
 *
 * Companion to markdownFormatting.ts which adds markdown formatting.
 *
 * @param text - Text with markdown formatting
 * @returns Plain text without markdown syntax
 *
 * @example
 * stripMarkdown('**Hello** *world*') // Returns: 'Hello world'
 * stripMarkdown('[Link](url)') // Returns: 'Link'
 * stripMarkdown('`code`') // Returns: 'code'
 * stripMarkdown('### Heading') // Returns: 'Heading'
 * stripMarkdown('| Col1 | Col2 |\n|------|------|\n| A | B |') // Returns: 'Col1 Col2 A B'
 */
export function stripMarkdown(text: string): string {
  try {
    const result = remark()
      .use(remarkGfm) // Same GFM support as renderer
      .use(strip)     // Official strip-markdown plugin
      .processSync(text);

    return String(result).trim();
  } catch (error) {
    // Fallback to original text if parsing fails
    console.warn('Failed to strip markdown:', error);
    return text;
  }
}
```

---

### Phase 2: Testing Strategy

**Assessment:** Unit tests are **NOT NEEDED** for this utility.

**Why skip unit tests:**
- ✅ Using well-tested `strip-markdown` library (maintained by remark ecosystem)
- ✅ Library already has comprehensive test coverage
- ✅ Simple wrapper function with error handling
- ✅ Integration tests will validate actual usage in UI

**Testing approach:**
- ✅ Manual validation in search results and notifications
- ✅ Integration tests (see Phase 4)
- ❌ No unit tests needed

---

### Phase 3: Apply to Search Results (15 minutes)

#### File: `src/components/search/SearchResultItem.tsx` (MODIFY)

**Current behavior:** Shows `**important** update` with asterisks visible

**Change:**

```typescript
import { stripMarkdown } from '../../utils/markdownStripping';

// In DMSearchResultItem component (line ~39)
const { contextualSnippet } = useSearchResultHighlight({
  message,
  searchTerms,
});

// NEW: Strip markdown from snippet
const cleanSnippet = stripMarkdown(contextualSnippet);

// Then use cleanSnippet instead of contextualSnippet in render:
<Container
  className="result-text"
  dangerouslySetInnerHTML={{
    __html: highlightTerms(cleanSnippet), // Changed from contextualSnippet
  }}
/>
```

**Same change for SpaceSearchResultItem component** (line ~96 area)

---

### Phase 4: Apply to Notifications (15 minutes)

#### File: `src/components/notifications/NotificationItem.tsx` (MODIFY)

**Current behavior:** Shows `**important** update` with asterisks visible

**Change:**

```typescript
import { stripMarkdown } from '../../utils/markdownStripping';

// In NotificationItem component (line ~44)
const { contextualSnippet } = useSearchResultHighlight({
  message,
  searchTerms: [], // No search terms, show from beginning
  contextWords: 12,
  maxLength: 200,
});

// NEW: Strip markdown from snippet
const cleanSnippet = stripMarkdown(contextualSnippet);

// Replace user mentions with display names (line ~67)
const textWithDisplayNames = replaceMentionsWithDisplayNames(
  cleanSnippet, // Changed from contextualSnippet
  mapSenderToUser
);

// Then render textWithDisplayNames (already done at line ~95)
```

---

## Testing Checklist

### Integration Tests - Search Results
- [ ] Search for text with bold markdown: `**important**`
  - Before: Shows `**important**`
  - After: Shows `important`
- [ ] Search for text with links: `[click here](url)`
  - Before: Shows `[click here](url)`
  - After: Shows `click here`
- [ ] Search for text with code: `` `code` ``
  - Before: Shows backticks
  - After: Shows `code` without backticks
- [ ] Search highlights still work after stripping
- [ ] Long messages truncate properly

### Integration Tests - Notifications
- [ ] Notification with bold text renders cleanly
- [ ] Notification with links shows link text only
- [ ] Mention highlighting still works: `@username`
- [ ] Notification preview fits in notification item
- [ ] Multiple notification types work (mention, reply, role mention)

### Regression Tests
- [ ] Confirmation modals still show formatted markdown (not using stripMarkdown)
- [ ] Pinned messages panel still shows formatted markdown
- [ ] Regular message view unchanged
- [ ] Message editing preserves markdown

---

## Performance Considerations

**Library-based stripping:**
- ~0.1-0.5ms per message (slightly slower than regex, but still negligible)
- Negligible impact on search/notification rendering
- Uses existing remark ecosystem (~5KB additional size for `strip-markdown`)

**When applied:**
- Only in UI layer when displaying search results/notifications
- Not applied during indexing or storage
- Not applied to confirmation modals or pinned messages

**Cache considerations:**
- Search results: Stripping happens once per result render
- Notifications: Stripping happens once per notification render
- No need for memoization - fast enough

---

## Migration Strategy

This is a **pure addition** - no breaking changes:

1. ✅ Create utility file - New file, no impact
2. ✅ Add tests - New file, no impact
3. ✅ Apply to search results - Improves existing behavior
4. ✅ Apply to notifications - Improves existing behavior

**No database migrations needed**
**No API changes needed**
**No configuration changes needed**

---

## Success Criteria

- [ ] `strip-markdown` package installed
- [ ] `stripMarkdown()` utility created
- [ ] Search results show clean text without markdown symbols
- [ ] Notifications show clean text without markdown symbols
- [ ] Markdown highlighting still works in search results
- [ ] No regressions in confirmation modals or pinned messages
- [ ] Documentation updated

---

## Future Use Cases

Once this utility exists, it can be used for:

- ✅ **DM conversation list previews** (dm-conversation-list-preview.md task)
- ✅ **Space/Channel conversation previews** (if we add them)
- ✅ **Push notifications** (mobile - needs plain text)
- ✅ **Copy to clipboard** (plain text option)
- ✅ **Screen readers** (accessibility - plain text)
- ✅ **Character counting** (without markdown overhead)
- ✅ **Message length validation**
- ✅ **Quote previews**

---

## Visual Examples

### Before & After: Search Results

**Before:**
```
┌─────────────────────────────────────────┐
│ 📋 #general                    3:45 PM  │
│ The **important** update is ready       │
│     ↑ Asterisks visible                 │
└─────────────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────────┐
│ 📋 #general                    3:45 PM  │
│ The important update is ready           │
│     ↑ Clean, readable                   │
└─────────────────────────────────────────┘
```

### Before & After: Notifications

**Before:**
```
┌─────────────────────────────────────────┐
│ 🔔 @John mentioned you in #general      │
│ Check out **this** new `feature`        │
│            ↑ Markdown symbols            │
└─────────────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────────┐
│ 🔔 @John mentioned you in #general      │
│ Check out this new feature              │
│            ↑ Clean preview               │
└─────────────────────────────────────────┘
```

---

## File Summary

**New Files (1):**
- `src/utils/markdownStripping.ts` - Utility function

**Modified Files (2):**
- `src/components/search/SearchResultItem.tsx` - Apply stripping
- `src/components/notifications/NotificationItem.tsx` - Apply stripping

**Total Changes:** 3 files
**Dependencies:** +1 package (`strip-markdown`)

---

## Notes

- This utility is **opt-in by design** - components choose whether to strip markdown
- Existing components (MessagePreview, confirmation modals, etc.) are **unchanged**
- No impact on message storage or markdown rendering in main chat view
- Can be implemented and tested independently before DM conversation list feature

---

**Task Created:** 2025-01-13
**Last Updated:** 2025-01-13 (Updated after feature-analyzer review)
**Estimated Completion:** 30-45 minutes (reduced from 2-3 hours)
**Dependencies:** `strip-markdown` package
**Enables:** dm-conversation-list-preview.md (provides stripMarkdown utility)

---

## Revision History

**2025-01-13 - Major Update After feature-analyzer Review:**
- Changed from regex-based (120+ lines) to library-based approach (15 lines)
- Uses `strip-markdown` remark plugin for consistency with existing renderer
- Removed `truncateText()` function (already handled by `useSearchResultHighlight` maxLength)
- Removed unit tests (library is already tested)
- Reduced estimated time from 2-3 hours to 30-45 minutes
- Key benefit: Consistent markdown interpretation across rendering and stripping
