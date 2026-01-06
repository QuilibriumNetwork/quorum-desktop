# Markdown Renderer

## Overview

Messages automatically detect markdown patterns and render with enhanced formatting when markdown syntax is used. The renderer now includes intelligent URL processing, YouTube video embedding, and performance optimizations to prevent component remounting.

## Supported Features

### **Text Formatting**
- **Headers:** H3 only (`### Title`), H1/H2 auto-convert to H3 for design consistency
- **Bold text:** `**text**` or `__text__`
- **Italic text:** `*text*` or `_text_`
- **Strikethrough:** `~~text~~`
- **Spoiler:** `||hidden text||` - Click to reveal hidden content
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

### **Security (Updated 2025-11-18)**
- **No HTML injection:** The `rehype-raw` plugin has been removed to eliminate critical HTML injection vulnerabilities
- **Safe mentions:** User mentions use placeholder tokens that React escapes automatically
- **Word boundary validation:** Mentions only process when surrounded by whitespace (prevents mentions inside markdown syntax like `**@user**`, `*@user*`, `[text](@user)`)
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
- `src/utils/messageLinkUtils.ts` - Message link URL parsing and validation
- `src/utils/environmentDomains.ts` - Environment-aware domain detection (localhost/staging/prod)
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
- ✅ User mentions (both formats: `@<address>` and `@[Display Name]<address>`) via safe placeholder tokens
- ✅ Role mentions (`@role`) via safe placeholder tokens
- ✅ Channel mentions (both formats: `#<channelId>` and `#[Channel Name]<channelId>`) via safe placeholder tokens
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
  /* Convert URLs to markdown links (protects code blocks, inline code, existing md links) */
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

const processChannelMentions = (text: string): string => {
  /* Replace #channel mentions with safe placeholders */
};

const processMessageLinks = (text: string): string => {
  /* Replace message URLs with <<<MESSAGE_LINK:channelId:messageId:channelName>>> */
  /* Same-space only, protects code blocks/inline code/markdown links */
};

// Processing pipeline (order matters!)
const processedContent = useMemo(() => {
  return fixUnclosedCodeBlocks(
    convertHeadersToH3(
      processURLs(                    // Last: convert remaining URLs to links
        processMessageLinks(          // Before URLs: extract message links
          processChannelMentions(
            processRoleMentions(
              processMentions(
                processStandaloneYouTubeUrls(
                  processInviteLinks(content)
                )
              )
            )
          )
        )
      )
    )
  );
}, [content, processMentions, processRoleMentions, processChannelMentions, processMessageLinks]);
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
   - `text`, `p`, `h3` components: Convert mention tokens to styled React components via shared `processMentionTokens()` function
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

## Special Token System

MessageMarkdownRenderer uses special tokens to safely render dynamic content like embeds and mentions. These tokens are created during text processing and caught by React component handlers.

### YouTube Embeds
- **Token Pattern**: `![youtube-embed](videoId)`
- **Creation**: `processStandaloneYouTubeUrls()` converts standalone YouTube URLs
- **Rendering**: `img` component catches `alt="youtube-embed"` and renders `<YouTubeFacade>`
- **Example**: `"https://youtube.com/watch?v=abc"` → `"![youtube-embed](abc)"` → Video embed

### Invite Cards
- **Token Pattern**: `![invite-card](url)`
- **Creation**: `processInviteLinks()` converts invite URLs to markdown image syntax
- **Rendering**: `img` component catches `alt="invite-card"` and renders `<InviteLink>`
- **Example**: `"https://invite.url"` → `"![invite-card](https://invite.url)"` → Invite card

### User Mentions
- **Token Pattern**: `<<<MENTION_USER:address>>>`
- **Creation**: `processMentions()` converts both mention formats to safe tokens:
  - Legacy format: `@<Qm...>` → `<<<MENTION_USER:Qm...>>>`
  - Enhanced format: `@[Display Name]<Qm...>` → `<<<MENTION_USER:Qm...>>>`
- **Rendering**: `text` and `p` components catch tokens and render styled spans
- **Security**: Prevents markdown interpretation and XSS attacks
- **Backward Compatibility**: Both old and new formats work seamlessly
- **Display Name Priority**: Enhanced format uses inline display name, legacy format falls back to user lookup
- **Examples**:
  - Legacy: `"Hey @<Qm123>"` → `"Hey <<<MENTION_USER:Qm123>>>"` → Styled mention with lookup name
  - Enhanced: `"Hey @[John Doe]<Qm123>"` → `"Hey <<<MENTION_USER:Qm123>>>"` → Styled mention showing "John Doe"

### Everyone Mentions
- **Token Pattern**: `<<<MENTION_EVERYONE>>>`
- **Creation**: `processMentions()` converts `@everyone` to safe token
- **Rendering**: `text` and `p` components render styled `@everyone` spans

### Role Mentions
- **Token Pattern**: `<<<MENTION_ROLE:roleTag:displayName>>>`
- **Creation**: `processRoleMentions()` converts `@roleTag` to safe tokens
- **Rendering**: `text` and `p` components render styled role mention spans

**Why Tokens?**
- Prevents markdown parser from interpreting dynamic content incorrectly
- React components handle tokens safely (automatic attribute escaping)
- Enables complex rendering (embeds, styled mentions) within markdown flow
- Security: No raw HTML injection possible

### Channel Mentions
- **Token Pattern**: `<<<MENTION_CHANNEL:channelId>>>`
- **Creation**: `processChannelMentions()` converts both channel mention formats to safe tokens:
  - Legacy format: `#<ch-abc123>` → `<<<MENTION_CHANNEL:ch-abc123>>>`
  - Enhanced format: `#[general-chat]<ch-abc123>` → `<<<MENTION_CHANNEL:ch-abc123>>>`
- **Rendering**: `text` and `p` components catch tokens and render clickable channel spans
- **Navigation**: Click handler navigates to the referenced channel
- **Display Name Priority**: Enhanced format uses inline channel name, legacy format falls back to channel lookup
- **Examples**:
  - Legacy: `"Check #<ch-123>"` → Clickable span showing channel lookup name
  - Enhanced: `"Check #[general]<ch-123>"` → Clickable span showing "general"

### Message Links (Discord-style)
- **Token Pattern**: `<<<MESSAGE_LINK:channelId:messageId:channelName>>>`
- **Creation**: `processMessageLinks()` converts message URLs to styled tokens
- **URL Format**: `https://qm.one/spaces/{spaceId}/{channelId}#msg-{messageId}`
- **Rendering**: Styled span showing `#channelName › 📄` (channel name + separator + message icon)
- **Navigation**: Click navigates to the specific message in the channel
- **Same-Space Only**: Only links to the current space are converted; cross-space links remain as regular URLs
- **Protected Contexts**: URLs inside code blocks, inline code, or markdown links `[text](url)` are NOT converted
- **CSS Classes**: `.message-mentions-message-link`, `.message-mentions-message-link__separator`, `.message-mentions-message-link__icon`
- **Example**: `"See https://qm.one/spaces/Qm.../Qm...#msg-abc123"` → `"See #general › 📄"` (clickable)

**Key Files**:
- `src/utils/messageLinkUtils.ts` - URL parsing and validation
- `src/utils/environmentDomains.ts` - Environment-aware domain detection (localhost, staging, production)

**Related**: See `src/utils/markdownStripping.ts` for token handling in plain text contexts

### Spoilers
- **Syntax**: `||hidden text||`
- **Detection**: `processMentionTokens()` matches `||content||` pattern directly (not a preprocessing token)
- **Rendering**: Clickable `<span className="message-spoiler">` with dot pattern overlay
- **Reveal**: Click or keyboard (Enter/Space) toggles `.message-spoiler--revealed` class
- **Styling**: Dot pattern background (`radial-gradient`), theme-aware (dark/light)
- **Accessibility**: `tabIndex={0}`, `role="button"`, `aria-label`, keyboard support
- **Limitation**: Only plain text content works inside spoilers. URLs, mentions, code, and other markdown syntax break the pattern because markdown processes them first.
- **CSS Classes**: `.message-spoiler`, `.message-spoiler--revealed`
- **Example**: `"This is ||secret|| text"` → Hidden content revealed on click

**Why not a preprocessing token?**
Multiple approaches were tried (token system, base64, placeholders) but markdown processing corrupted or split the tokens. The current post-markdown detection is the simplest solution that works for the primary use case (hiding short text).

**Related Task**: `.agents/tasks/spoiler-full-markdown-support.md` (backlog for full markdown support inside spoilers)

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
- **Spoiler:** Hide text with spoiler syntax (`||text||`)

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

## Related Documentation

- [Message Preview Rendering](message-preview-rendering.md) - Preview systems for panels (uses stripping, not full markdown)
- [Markdown Stripping](markdown-stripping.md) - Text processing utilities for previews
- [Bookmarks](bookmarks.md) - Hybrid preview rendering for bookmarks

---
**Last Updated**: 2026-01-06
**Security Hardening**: Complete (rehype-raw removed, XSS vulnerabilities fixed, word boundary validation added)
**Performance Optimization**: Complete
**Enhanced Mention Formats**: Complete (backward-compatible support for readable mention display names)
**Message Links**: Complete (Discord-style rendering with same-space validation)
**Spoilers**: Complete (plain text only, dot pattern styling, keyboard accessible)
**Recent Changes**: Added spoiler syntax (`||text||`) with dot pattern styling and toolbar button