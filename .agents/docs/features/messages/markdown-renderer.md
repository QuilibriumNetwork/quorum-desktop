# Markdown Renderer

**Status**: ✅ Complete & Optimized
**Created**: 2025-09-20
**Last Updated**: 2025-01-20 (Major performance optimization)

## Overview

Messages automatically detect markdown patterns and render with enhanced formatting when markdown syntax is used. The renderer now includes intelligent URL processing, YouTube video embedding, and performance optimizations to prevent component remounting.

## Supported Features

### **Text Formatting**
- **Headers:** H3 only (`### Title`), H1/H2 auto-convert to H3 for design consistency
- **Bold text:** `**text**` or `__text__`
- **Italic text:** `*text*` or `_text_`
- **Strikethrough:** `~~text~~`
- **Inline code:** `` `code` ``

### **Structural Elements**
- **Code blocks:** ` ```language\ncode\n``` ` with syntax highlighting
- **Unordered lists:** `- item` or `* item`
- **Ordered lists:** `1. item`
- **Blockquotes:** `> quote text`
- **Tables:** GitHub-flavored markdown tables with hover effects
- **Horizontal rules:** `---` or `***`

### **Smart URL Processing**
- **YouTube videos:** Automatically detected and rendered as interactive video embeds
- **Regular URLs:** Auto-converted to clickable links with `target="_blank"`
- **Protected contexts:** URLs in code blocks and existing markdown links are preserved
- **Inline vs standalone:** Different handling for URLs on their own line vs inline

### **Raw HTML Support**
- **HTML elements:** Basic HTML rendering via `rehype-raw`
- **YouTube placeholders:** Special `<div>` elements for standalone video processing

## Code Block Features

- **Auto-scrolling:** Long code blocks (>10 lines or >500 chars) use ScrollContainer
- **Copy functionality:** Copy-to-clipboard button on all code blocks
- **Responsive design:** Aggressive line wrapping (`break-all`) for mobile
- **Unclosed blocks:** Auto-completes missing closing ` ``` `

## Key Files

- `src/components/message/MessageMarkdownRenderer.tsx` - Main renderer component
- `src/components/message/MarkdownToolbar.tsx` - Discord-style formatting toolbar
- `src/utils/youtubeUtils.ts` - Centralized YouTube URL utilities
- `src/utils/codeFormatting.ts` - Code block analysis utilities
- `src/utils/markdownFormatting.ts` - Markdown formatting functions for toolbar
- `src/hooks/business/messages/useMessageFormatting.ts` - Pattern detection & shouldUseMarkdown()
- `src/components/message/Message.tsx` - Integration point (markdown vs token-based routing)
- `src/config/features.ts` - Feature flag configuration (ENABLE_MARKDOWN)

## Architecture

### **Processing Pipeline (Optimized 2025-01-20)**

```typescript
// Stable processing functions (outside component scope)
const processURLs = (text: string): string => { /* Convert URLs to markdown links */ };
const processStandaloneYouTubeUrls = (text: string): string => { /* Handle standalone videos */ };

// Processing pipeline - reduced from 4 steps to 3
const processedContent = useMemo(() => {
  return fixUnclosedCodeBlocks(
    convertHeadersToH3(
      processURLs(
        processStandaloneYouTubeUrls(content)
      )
    )
  );
}, [content]); // Only content dependency - functions are stable
```

### **Component Rendering Flow**

1. **Pattern Detection:** `shouldUseMarkdown()` checks for markdown syntax in useMessageFormatting
2. **Route Decision:** Message.tsx chooses between MessageMarkdownRenderer vs token-based rendering
3. **Content Processing:** Stable pipeline transforms content without recreating functions
4. **Component Rendering:** Memoized components prevent YouTube video remounting
5. **URL Handling:** Smart detection converts YouTube URLs to embeds, others to links

### **Performance Optimizations**

- **Stable functions:** Processing functions moved outside component scope
- **Memoized components:** `useMemo(() => ({ ... }), [])` prevents re-creation
- **Minimal dependencies:** Only `content` triggers re-processing
- **Persistent state:** YouTube video state survives component re-renders

## Disabled Features (Design Decisions)

- **Headers:** H1, H2, H4, H5, H6 are disabled and convert to H3 for design consistency
- **Images:** No native markdown image support (uses existing image handling system)

## Smart Link Processing

Unlike the old implementation, links are now **intelligently processed**:

### **Enabled Link Features**
- **YouTube URLs:** `https://youtube.com/watch?v=abc123` → Interactive video embed
- **Regular URLs:** `https://example.com` → Clickable link with `target="_blank"`
- **Email links:** `mailto:user@example.com` → Clickable email links
- **Automatic detection:** URLs in plain text are auto-converted to links

### **Protected Contexts**
- **Code blocks:** URLs inside ` ```code``` ` blocks remain as plain text
- **Existing markdown links:** `[text](url)` are preserved and enhanced
- **Inline code:** URLs inside `` `code` `` remain as plain text

### **Implementation**
```tsx
// Link component in MessageMarkdownRenderer
a: ({ href, children, ...props }: any) => {
  if (href && isYouTubeURL(href)) {
    // Render as YouTube embed
    return <YouTubeEmbed src={convertToYouTubeEmbedURL(href)} />;
  }

  // Render as regular clickable link
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return <span>{children}</span>;
}
```

## Dependencies

- `react-markdown` - Core markdown parser
- `remark-gfm` - GitHub-flavored markdown support (tables, strikethrough, etc.)
- `rehype-raw` - HTML element support for YouTube placeholders
- `ScrollContainer` - Long code block scrolling
- `ClickToCopyContent` - Code copy functionality
- `YouTubeEmbed` - Video embed integration
- `youtubeUtils` - Centralized YouTube URL processing

## Markdown Formatting Toolbar

**Location**: `src/components/message/MarkdownToolbar.tsx`

A Discord-style floating toolbar that appears above selected text in the MessageComposer, providing quick access to markdown formatting options.

### **Features**
- **Heading:** Insert H3 heading (`### Text`)
- **Bold:** Toggle bold formatting (`**text**`)
- **Italic:** Toggle italic formatting (`*text*`)
- **Strikethrough:** Toggle strikethrough (`~~text~~`)
- **Code:** Wrap in inline code (`` `code` ``)
- **Blockquote:** Insert blockquote (`> quote`)

### **Behavior**
- Appears on text selection in MessageComposer
- Positioned above selected text (floating)
- One-click formatting application
- Integrates with `src/utils/markdownFormatting.ts` utility functions

### **Implementation**
```tsx
<MarkdownToolbar
  visible={showToolbar}
  position={{ top: toolbarTop, left: toolbarLeft }}
  onFormat={handleFormat}
/>
```

## Feature Flag Configuration

**File**: `src/config/features.ts`

The markdown rendering feature can be toggled via the `ENABLE_MARKDOWN` flag:

```typescript
/**
 * Markdown Rendering Feature
 * Controls markdown rendering and formatting toolbar in messages.
 * When disabled, messages will use plain text rendering.
 */
export const ENABLE_MARKDOWN = false; // Default: disabled
```

### **What the Flag Controls**
- Markdown renderer (MessageMarkdownRenderer)
- Markdown formatting toolbar (MarkdownToolbar)
- Pattern detection for markdown syntax
- When `false`: Messages use plain text/token-based rendering

### **Usage**
Import and check the flag before enabling markdown features:
```typescript
import { ENABLE_MARKDOWN } from '@/config/features';

if (ENABLE_MARKDOWN && formatting.shouldUseMarkdown()) {
  // Use markdown renderer
}
```

## Integration Example

```tsx
// Message.tsx - Routing logic
if (contentData.type === 'post') {
  // Check if we should use markdown rendering
  if (formatting.shouldUseMarkdown()) {
    return (
      <Container className="message-post-content break-words">
        <MessageMarkdownRenderer content={contentData.fullText} />
      </Container>
    );
  }
  // Fall back to token-based rendering
  return <TokenBasedRenderer />;
}
```



---
**Last Updated**: 2025-11-07
**Performance Optimization**: Complete
**Recent Additions**: MarkdownToolbar component, feature flag configuration