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

### **Security (Updated 2025-11-07)**
- **No HTML injection:** The `rehype-raw` plugin has been removed to eliminate critical HTML injection vulnerabilities
- **Safe mentions:** User mentions use placeholder tokens that React escapes automatically
- **XSS protection:** All user-controlled content is safely rendered through React components

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

## Dual Rendering Architecture

The message rendering system maintains **two independent rendering paths** for reliability and backward compatibility:

### System 1: MessageMarkdownRenderer (Primary Path)
**Status**: Currently active (default)
**Location**: `src/components/message/MessageMarkdownRenderer.tsx`
**Activation**: When `ENABLE_MARKDOWN && shouldUseMarkdown()` returns true
**Current behavior**: `shouldUseMarkdown()` always returns `true` (all messages use this path)

**Supported Features**:
- ✅ Markdown formatting (`**bold**`, `*italic*`, code blocks, tables, etc.)
- ✅ User mentions (`@<address>`) via safe placeholder tokens
- ✅ Role mentions (`@role`) via safe placeholder tokens
- ✅ YouTube embeds (standalone URLs) and links (inline URLs)
- ✅ Regular URL auto-linking
- ✅ Invite links (via placeholder tokens)
- ✅ Security hardened (no HTML injection, XSS protection)

**Security Architecture**:
- Uses placeholder token system (`<<<TOKEN>>>`) for dynamic content
- React component handlers render tokens safely
- All attributes auto-escaped by React
- No raw HTML parsing

### System 2: Token-Based Rendering (Fallback Path)
**Status**: Inactive (fallback only)
**Location**: `src/components/message/Message.tsx` (lines 664-744)
**Activation**: When `ENABLE_MARKDOWN === false` OR `shouldUseMarkdown()` returns false
**Current behavior**: Unreachable code (kept for emergency fallback)

**Supported Features**:
- ✅ User mentions (`@<address>`) via React components
- ✅ Role mentions (`@role`) via React components
- ✅ YouTube embeds (all URLs)
- ✅ Regular URL auto-linking
- ✅ Invite links via `<InviteLink>` component
- ❌ No markdown formatting support

**Why It's Kept**:
1. **Emergency fallback**: If markdown rendering has critical issues, can disable via `ENABLE_MARKDOWN = false`
2. **Backward compatibility**: Existing code path maintained for safety
3. **Feature completeness**: Includes invite link support that was later added to MessageMarkdownRenderer
4. **Testing**: Useful for comparing rendering behavior

### Routing Decision Flow

```typescript
// Message.tsx (simplified)
if (ENABLE_MARKDOWN && formatting.shouldUseMarkdown()) {
  // System 1: MessageMarkdownRenderer (PRIMARY)
  return <MessageMarkdownRenderer content={contentData.fullText} />
} else {
  // System 2: Token-based rendering (FALLBACK)
  return (
    // Lines 664-744: Token-based rendering
    // Includes invite link handling at lines 708-715
  )
}
```

**Current State**:
- `ENABLE_MARKDOWN = true` in `src/config/features.ts`
- `shouldUseMarkdown()` always returns `true` in `useMessageFormatting.ts`
- **Result**: All messages use System 1 (MessageMarkdownRenderer)
- System 2 code exists but is unreachable

### When to Use Each System

**Use System 1 (MessageMarkdownRenderer) - DEFAULT**:
- Normal operation
- When users need markdown formatting
- For maximum security (security-hardened architecture)

**Use System 2 (Token-based) - EMERGENCY ONLY**:
- If critical bug found in MessageMarkdownRenderer
- For debugging/comparison purposes
- Set `ENABLE_MARKDOWN = false` in `src/config/features.ts`

**Trade-offs**:
- System 1: Full features, markdown support, security hardened
- System 2: Simpler, no markdown, but all links/embeds still work

## Architecture

### **Processing Pipeline (Security Hardened 2025-11-07)**

```typescript
// Stable processing functions (outside component scope)
const processURLs = (text: string): string => {
  /* Convert ALL URLs (including YouTube) to markdown links */
};

const processStandaloneYouTubeUrls = (text: string): string => {
  /* Detect standalone YouTube URLs and convert to markdown image syntax */
  /* Inline YouTube URLs remain as plain URLs for link processing */
};

const processMentions = (text: string): string => {
  /* Replace @mentions with safe placeholder tokens: <<<MENTION_USER:address>>> */
  /* Prevents markdown interpretation and XSS attacks */
};

const processRoleMentions = (text: string): string => {
  /* Replace @role mentions with safe placeholders */
};

// Processing pipeline
const processedContent = useMemo(() => {
  return fixUnclosedCodeBlocks(
    convertHeadersToH3(
      processURLs(
        processRoleMentions(
          processMentions(
            processStandaloneYouTubeUrls(content)
          )
        )
      )
    )
  );
}, [content, processMentions, processRoleMentions]);
```

### **Component Rendering Flow (Updated 2025-11-07)**

1. **Route Decision:** Message.tsx ALWAYS uses MessageMarkdownRenderer (security hardened)
   - `shouldUseMarkdown()` now returns `true` for all messages
   - Ensures all content goes through secure rendering path
   - Token-based rendering is legacy fallback only
2. **Content Processing:** Secure pipeline transforms content:
   - YouTube URLs: Standalone → embeds, Inline → clickable links
   - Mentions: Converted to safe placeholder tokens
   - URLs: All converted to markdown links for consistent processing
3. **Component Rendering:** React component handlers process placeholders:
   - `text` component: Catches mention placeholders in text nodes
   - `p` component: Catches mention placeholders in paragraphs
   - `img` component: Renders YouTube embeds from `![youtube-embed](videoId)` syntax
   - `a` component: Renders all links (including inline YouTube URLs) as clickable links
4. **Security:** React automatically escapes all attributes, preventing XSS

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

### **Enabled Link Features (Updated 2025-11-07)**
- **Standalone YouTube URLs:** `https://youtube.com/watch?v=abc123` (on its own line) → Interactive video embed
- **Inline YouTube URLs:** `Check this https://youtube.com/watch?v=abc out` → Clickable link (NOT embed)
- **Regular URLs:** `https://example.com` → Clickable link with `target="_blank"`
- **Email links:** `mailto:user@example.com` → Clickable email links
- **Automatic detection:** URLs in plain text are auto-converted to links

### **Protected Contexts**
- **Code blocks:** URLs inside ` ```code``` ` blocks remain as plain text
- **Existing markdown links:** `[text](url)` are preserved and enhanced
- **Inline code:** URLs inside `` `code` `` remain as plain text

### **Implementation (Updated 2025-11-07)**

```tsx
// Standalone YouTube URLs converted to markdown image syntax
const processStandaloneYouTubeUrls = (text: string): string => {
  const lines = text.split('\n');
  const processedLines = lines.map(line => {
    const trimmedLine = line.trim();
    return replaceYouTubeURLsInText(line, (url) => {
      const isStandalone = trimmedLine === url.trim();
      if (isStandalone) {
        const videoId = extractYouTubeVideoId(url);
        if (videoId) {
          return `![youtube-embed](${videoId})`; // Markdown image syntax
        }
      }
      return url; // Inline URLs stay as-is
    });
  });
  return processedLines.join('\n');
};

// Image component catches YouTube embeds and invite cards
img: ({ src, alt, ...props }: any) => {
  if (alt === 'youtube-embed' && src) {
    return (
      <div className="my-2">
        <YouTubeFacade
          videoId={src}
          className="rounded-lg youtube-embed"
          style={{ width: '100%', maxWidth: 560, aspectRatio: '16/9' }}
        />
      </div>
    );
  }
  if (alt === 'invite-card' && src) {
    return (
      <div className="my-2">
        <InviteLink inviteLink={src} />
      </div>
    );
  }
  return null; // No regular image support
},

// Paragraph component - prevents invalid HTML nesting
p: ({ children, node, ...props }: any) => {
  // Block embeds (YouTube, invite cards) render <div> elements
  // Detect at AST level if paragraph contains only an image node
  // If so, render as fragment to avoid invalid <p><div> nesting
  if (node?.children?.length === 1 && node.children[0].tagName === 'img') {
    return <>{children}</>;
  }
  return <p className="mb-2 last:mb-0">{children}</p>;
},

// Link component renders ALL links as clickable (including YouTube)
a: ({ href, children, ...props }: any) => {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="link">
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
- `remark-breaks` - Line break support
- ~~`rehype-raw`~~ - **REMOVED 2025-11-07** (security vulnerability)
- `ScrollContainer` - Long code block scrolling
- `ClickToCopyContent` - Code copy functionality
- `YouTubeFacade` - Lightweight video thumbnail with click-to-play (replaces YouTubeEmbed)
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



## Security Hardening (2025-11-07)

### Critical Vulnerabilities Fixed

1. **HTML Injection via rehype-raw**
   - **Issue**: `rehype-raw` plugin allowed arbitrary HTML rendering
   - **Impact**: XSS attacks, phishing, UI spoofing, data exfiltration
   - **Fix**: Removed `rehype-raw` completely, use markdown image syntax for YouTube embeds

2. **Mention Attribute Injection**
   - **Issue**: User display names injected directly into HTML attributes without escaping
   - **Impact**: XSS via malicious display names like `"><script>alert(1)</script>`
   - **Fix**: Use safe placeholder tokens (<<<MENTION_USER:address>>>) rendered by React components

3. **Role Mention Attribute Injection**
   - **Issue**: Role display names in title attributes without escaping
   - **Impact**: XSS via malicious role names
   - **Fix**: Use placeholder tokens rendered safely by React

### Security Architecture

All user-controlled content now follows this pattern:
1. Convert to safe placeholder tokens during text processing
2. React component handlers catch placeholders
3. React automatically escapes all attributes
4. No raw HTML injection possible

**Related Task**: `.agents/tasks/remove-rehype-raw-security-fix.md`

---
**Last Updated**: 2025-11-09
**Security Hardening**: Complete (rehype-raw removed, XSS vulnerabilities fixed)
**Performance Optimization**: Complete
**Recent Changes**: Fixed invalid HTML nesting for block-level embeds (YouTube, invite cards)