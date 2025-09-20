# Markdown Renderer

Comprehensive markdown support for message rendering using react-markdown.

## Overview

Messages automatically detect markdown patterns and render with enhanced formatting when markdown syntax is used. Falls back to token-based rendering for non-markdown messages.

## Supported Features

- **Headers:** H3 only (`### Title`), H1/H2 auto-convert to H3
- **Text formatting:** Bold (`**text**`), italic (`*text*`), strikethrough (`~~text~~`)
- **Code:** Inline code (`code`) and code blocks (` ```code``` `)
- **Lists:** Unordered (`- item`) and ordered (`1. item`)
- **Tables:** GitHub-flavored markdown tables
- **Blockquotes:** `> quote`
- **Horizontal rules:** `---`

## Code Block Features

- **Auto-scrolling:** Long code blocks (>10 lines or >500 chars) use ScrollContainer
- **Copy functionality:** Copy-to-clipboard button on all code blocks
- **Responsive design:** Aggressive line wrapping (`break-all`) for mobile
- **Unclosed blocks:** Auto-completes missing closing ` ``` `

## Key Files

- `src/components/message/MessageMarkdownRenderer.tsx` - Main renderer component
- `src/utils/codeFormatting.ts` - Code block analysis utilities
- `src/hooks/business/messages/useMessageFormatting.ts` - Pattern detection
- `src/components/message/Message.tsx` - Integration point

## Architecture

1. **Pattern Detection:** `hasMarkdownPatterns()` checks for markdown syntax
2. **Preprocessing:** Auto-converts H1/H2 to H3, fixes unclosed code blocks
3. **Rendering:** Uses react-markdown with custom component overrides
4. **Fallback:** Non-markdown messages use existing token-based system

## Disabled Features

- **Headers:** H1, H2, H4, H5, H6 (design consistency)
- **Links:** Markdown links disabled (conflicts with existing link system)

## Dependencies

- `react-markdown` - Core markdown parser
- `remark-gfm` - GitHub-flavored markdown support
- `ScrollContainer` - Long code block scrolling
- `ClickToCopyContent` - Code copy functionality

---
*Last updated: 2025-09-20*