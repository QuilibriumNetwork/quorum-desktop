# Markdown Stripping

**Status**: ✅ Complete
**Created**: 2025-01-13
**Last Updated**: 2025-01-13

## Overview

Utility for removing markdown formatting from text while preserving or removing mentions as needed. Used in search results and notifications to display clean plain text previews.

## Key Functions

### `stripMarkdown(text: string): string`
- **Purpose**: Strip markdown but preserve mentions
- **Used in**: Notifications (mentions are styled with accent color)
- **Removes**: Bold, italic, code, links, tables, YouTube embeds, invite cards
- **Preserves**: `@<address>`, `@everyone`, `@roleTag` patterns

### `stripMarkdownAndMentions(text: string): string`
- **Purpose**: Strip everything for clean text
- **Used in**: Search results (pure plain text)
- **Removes**: All markdown + all mention patterns

## Implementation Details

**Library-based approach** using `unified` + `remark` + `strip-markdown`:
- Same parser as MessageMarkdownRenderer for consistency
- Handles all GFM features (tables, task lists, etc.)
- Properly handles edge cases (nested formatting, escaped characters)

**Mention Protection**: `@<address>` patterns use angle brackets that remark treats as HTML tags. Solution: Replace with unicode placeholders (`⟨MENTION0⟩`) before processing, restore after.

## Special Token System

The markdown stripping utilities are aware of the special token patterns used by MessageMarkdownRenderer:

### YouTube Embeds
- **Token Pattern**: `![youtube-embed](videoId)`
- **Purpose**: Markdown image syntax signals YouTube embed
- **Stripping Behavior**: Completely removed by `stripMarkdown()`
- **Example**: `"Check this ![youtube-embed](abc123)"` → `"Check this"`

### Invite Cards
- **Token Pattern**: `![invite-card](url)`
- **Purpose**: Markdown image syntax signals invite card render
- **Stripping Behavior**: Completely removed by `stripMarkdown()`
- **Example**: `"Join ![invite-card](https://...)"` → `"Join"`

### User Mentions
- **Raw Pattern**: `@<Qm[a-zA-Z0-9]+>` (from message text)
- **Processed Token**: `<<<MENTION_USER:address>>>` (only in MessageMarkdownRenderer)
- **Stripping Behavior**:
  - `stripMarkdown()`: Preserves raw `@<address>` patterns
  - `stripMarkdownAndMentions()`: Removes all mention patterns
- **Note**: Raw message text contains `@<address>`, NOT processed tokens

### Everyone/Role Mentions
- **Patterns**: `@everyone`, `@roleTag`
- **Stripping Behavior**:
  - `stripMarkdown()`: Preserves for notification display
  - `stripMarkdownAndMentions()`: Removes completely

## Usage Examples

### Notifications
```typescript
// Preserve mentions, strip markdown
const cleanSnippet = stripMarkdown(contextualSnippet);

// Render with styled mentions
const renderedText = renderTextWithMentions(cleanSnippet, mapSenderToUser);
// Result: "Check this " + <span className="text-accent-500">@JohnDoe</span>
```

### Search Results
```typescript
// Remove everything
const cleanSnippet = stripMarkdownAndMentions(contextualSnippet);
// Result: "Check this" (no markdown, no mentions)
```

## Key Files

- `src/utils/markdownStripping.ts` - Core stripping utilities
- `src/components/search/SearchResultItem.tsx` - Search integration
- `src/components/notifications/NotificationItem.tsx` - Notification integration with mention styling

## Dependencies

- `unified` - Unified text processing
- `remark-parse` - Markdown parser
- `remark-gfm` - GitHub-flavored markdown
- `remark-stringify` - Convert back to string
- `strip-markdown` - Official remark plugin for stripping markdown

---
**Last Updated**: 2025-01-13
