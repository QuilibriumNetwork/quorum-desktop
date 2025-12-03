# Markdown Stripping

## Overview

Unified system for processing markdown text with flexible options for different contexts. Supports both "smart" stripping (preserves structure and formatting intent) and "dumb" stripping (collapses to plain text) depending on use case. Used across search results, message previews, and notifications.

## Key Functions

### `processMarkdownText(text: string, options: MarkdownProcessingOptions): string`
- **Purpose**: Unified markdown processing with flexible configuration
- **Used in**: MessagePreview, PinnedMessagesPanel, SearchResults (via legacy wrappers)
- **Performance**: 20-100x faster than full markdown rendering
- **Options**:
  ```typescript
  interface MarkdownProcessingOptions {
    removeMentions?: boolean;           // Remove @mentions entirely (default: false)
    removeFormatting?: boolean;         // Remove markdown syntax (default: true)
    removeStructure?: boolean;          // Remove line breaks, collapse whitespace (default: false)
    preserveLineBreaks?: boolean;       // Keep paragraph structure (default: true)
    preserveEmphasis?: boolean;         // Keep bold/italic intent without syntax (default: true)
    preserveHeaders?: boolean;          // Keep header content without ### syntax (default: true)
    truncateLength?: number;            // Optional length limit with smart truncation
    replaceMentionsWithNames?: boolean; // Convert @<addr> to @DisplayName (default: false)
    mapSenderToUser?: (senderId: string) => { displayName?: string } | undefined;
  }
  ```

### `stripMarkdown(text: string): string`
- **Purpose**: Strip markdown but preserve mentions (legacy function)
- **Used in**: Basic stripping needs
- **Removes**: Bold, italic, code, links, tables, YouTube embeds, invite cards
- **Preserves**: `@<address>`, `@everyone`, `@roleTag` patterns

### `stripMarkdownAndMentions(text: string): string`
- **Purpose**: Strip everything for clean text (legacy function)
- **Used in**: Search results (pure plain text)
- **Removes**: All markdown + all mention patterns
- **Note**: Now implemented using `processMarkdownText()` internally

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

## Processing Modes

### Smart Stripping (MessagePreview, PinnedMessagesPanel)
- **Goal**: Preserve structure and formatting intent while removing syntax
- **Use case**: Message previews where readability matters
- **Features**: Keeps line breaks, converts `### Title` → `Title`, `**bold**` → `bold`

### Dumb Stripping (SearchResults)
- **Goal**: Collapse to pure plain text for search
- **Use case**: Search results where brevity matters
- **Features**: Removes everything, collapses whitespace

## Usage Examples

### Smart Stripping (Message Previews)
```typescript
// MessagePreview.tsx - preserve structure and formatting intent
const smartProcessedText = processMarkdownText(fullText, {
  preserveLineBreaks: true,     // Keep paragraph structure
  preserveEmphasis: true,       // Keep bold/italic intent without syntax
  preserveHeaders: true,        // Keep header content without ### syntax
  removeFormatting: true,       // Remove markdown syntax
  removeStructure: false,       // Preserve line breaks for readability
});

// Input:  "### Important\n\n**Check** this @<Qm123> message!"
// Output: "Important\n\nCheck this @<Qm123> message!"
```

### Dumb Stripping (Search Results)
```typescript
// SearchResults - collapse to plain text
const cleanSnippet = processMarkdownText(text, {
  removeMentions: true,
  removeStructure: true,
  preserveLineBreaks: false,
  preserveEmphasis: false
});

// Input:  "### Important\n\n**Check** this @<Qm123> message!"
// Output: "Important Check this message!"
```

### Legacy Function Usage
```typescript
// Legacy approach (still supported)
const cleanSnippet = stripMarkdown(contextualSnippet);           // Preserve mentions
const plainSnippet = stripMarkdownAndMentions(contextualSnippet); // Remove everything
```

## Performance Benefits

- **MessagePreview/PinnedMessagesPanel**: Smart stripping is 20-100x faster than full markdown rendering
- **Memory efficient**: Lightweight text processing vs heavy React component trees
- **Consistent**: Same remark parser as MessageMarkdownRenderer ensures compatibility

## Key Files

- `src/utils/markdownStripping.ts` - Core unified stripping utilities
- `src/components/message/MessagePreview.tsx` - Smart stripping for message previews
- `src/components/message/PinnedMessagesPanel.tsx` - Smart stripping for pinned messages
- `src/components/search/SearchResultItem.tsx` - Dumb stripping for search integration
- `src/components/notifications/NotificationItem.tsx` - Unified mention rendering with formatting hooks

## Dependencies

- `unified` - Unified text processing
- `remark-parse` - Markdown parser
- `remark-gfm` - GitHub-flavored markdown
- `remark-stringify` - Convert back to string
- `strip-markdown` - Official remark plugin for stripping markdown

## Related Documentation

- [Message Preview Rendering](message-preview-rendering.md) - How MessagePreview uses these utilities
- [Markdown Renderer](markdown-renderer.md) - Full message rendering (dual system)
- [Bookmarks](bookmarks.md) - Hybrid preview rendering for bookmarks

---
**Last Updated**: 2025-12-02
