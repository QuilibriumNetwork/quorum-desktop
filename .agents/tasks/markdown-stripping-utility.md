# Task: Markdown Stripping Utility

## Overview

Create a general-purpose utility for stripping markdown formatting from text and apply it to improve readability in search results and notifications.

**Status:** Ready for Implementation
**Priority:** Low-Medium
**Complexity:** Low
**Estimated Effort:** 1.5-2 hours (tests optional)
**Depends On:** None
**Blocks:** dm-conversation-list-preview.md (optional - can use utility once available)

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

### Phase 1: Create Utility (1 hour)

#### File: `src/utils/markdownStripping.ts` (NEW)

**Purpose:** General-purpose markdown text processing utility (companion to `markdownFormatting.ts`)

**Exports:**
- `stripMarkdown(text: string): string` - Removes all markdown formatting
- `truncateText(text: string, maxLength: number): string` - Truncates with ellipsis

**Implementation:**

```typescript
/**
 * Strips markdown formatting from text to create clean plain text
 * Handles: bold, italic, strikethrough, code, headings, blockquotes, links, images
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
 */
export function stripMarkdown(text: string): string {
  let plain = text;

  // Remove code blocks first (```code```)
  // Replace with [code] indicator to show code was present
  plain = plain.replace(/```[\s\S]*?```/g, '[code]');

  // Remove inline code (`code`)
  plain = plain.replace(/`([^`]+)`/g, '$1');

  // Remove links but keep link text: [text](url) -> text
  plain = plain.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove images: ![alt](url) -> empty string
  plain = plain.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // Remove bold/italic: **text** or __text__ -> text
  plain = plain.replace(/(\*\*|__)(.*?)\1/g, '$2');

  // Remove italic: *text* or _text_ -> text
  plain = plain.replace(/(\*|_)(.*?)\1/g, '$2');

  // Remove strikethrough: ~~text~~ -> text
  plain = plain.replace(/~~(.*?)~~/g, '$1');

  // Remove headings: ### text -> text
  plain = plain.replace(/^#{1,6}\s+/gm, '');

  // Remove blockquotes: > text -> text
  plain = plain.replace(/^>\s+/gm, '');

  // Remove horizontal rules
  plain = plain.replace(/^[-*_]{3,}$/gm, '');

  // Clean up multiple spaces and trim
  plain = plain.replace(/\s+/g, ' ').trim();

  return plain;
}

/**
 * Truncates text with ellipsis if it exceeds maxLength
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with '...' if needed
 *
 * @example
 * truncateText('Hello world', 5) // Returns: 'Hello...'
 * truncateText('Hi', 10) // Returns: 'Hi'
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}
```

---

### Phase 2: Testing Strategy (Optional)

**Assessment:** Tests are **optional but recommended** for this utility.

**Why tests might be overkill:**
- Simple regex-based logic (not complex algorithms)
- Used in non-critical UI contexts (previews)
- Can validate manually by looking at search results/notifications
- Regex patterns are straightforward and self-documenting

**Why tests are still valuable:**
- Catches edge cases (empty strings, plain text, partial markdown)
- Documents expected behavior clearly
- Prevents regressions if regex patterns are modified
- Only ~30 minutes to write

**Recommendation:** Add **minimal tests** only if time permits.

#### Minimal Test Suite (10 minutes)
**File:** `src/dev/tests/markdownStripping.unit.test.ts` (NEW)

```typescript
import { stripMarkdown, truncateText } from '../../utils/markdownStripping';

describe('stripMarkdown', () => {
  test('strips common markdown', () => {
    expect(stripMarkdown('**bold** *italic* ~~strike~~')).toBe('bold italic strike');
  });

  test('extracts link text', () => {
    expect(stripMarkdown('[text](url)')).toBe('text');
  });

  test('removes code backticks', () => {
    expect(stripMarkdown('Check `code` here')).toBe('Check code here');
  });

  test('handles plain text', () => {
    expect(stripMarkdown('No markdown here')).toBe('No markdown here');
  });

  test('handles empty string', () => {
    expect(stripMarkdown('')).toBe('');
  });
});

describe('truncateText', () => {
  test('truncates long text', () => {
    expect(truncateText('Hello world', 5)).toBe('Hello...');
  });

  test('keeps short text', () => {
    expect(truncateText('Hi', 10)).toBe('Hi');
  });
});
```

**If skipping tests:** Validate manually by checking search results show clean text without `**`, `~~`, etc.

---

### Phase 3: Apply to Search Results (30 minutes)

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

### Phase 4: Apply to Notifications (30 minutes)

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

### Unit Tests (Optional - 10 minutes)
- [ ] Basic markdown stripping works (bold, italic, links)
- [ ] Edge cases handled (empty string, plain text)
- [ ] File: `src/dev/tests/markdownStripping.unit.test.ts`

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

**Regex-based stripping:**
- ~0.01-0.05ms per message
- Negligible impact on search/notification rendering
- No external dependencies

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

- [ ] `stripMarkdown()` utility created and tested
- [ ] All unit tests pass (20+ test cases)
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

**New Files (2):**
- `src/utils/markdownStripping.ts` - Utility functions
- `src/utils/markdownStripping.test.ts` - Test suite

**Modified Files (2):**
- `src/components/search/SearchResultItem.tsx` - Apply stripping
- `src/components/notifications/NotificationItem.tsx` - Apply stripping

**Total Changes:** 4 files

---

## Notes

- This utility is **opt-in by design** - components choose whether to strip markdown
- Existing components (MessagePreview, confirmation modals, etc.) are **unchanged**
- No impact on message storage or markdown rendering in main chat view
- Can be implemented and tested independently before DM conversation list feature

---

**Task Created:** 2025-01-13
**Last Updated:** 2025-01-13
**Estimated Completion:** 2-3 hours
**Dependencies:** None
**Enables:** dm-conversation-list-preview.md (provides stripMarkdown utility)
