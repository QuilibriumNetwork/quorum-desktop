# Remove rehype-raw Plugin - Security Fix

**Status**: 🔴 Critical - Not Started
**Priority**: P0 (Critical Security Issue)
**Created**: 2025-11-07
**Assigned**: Development Team
**Related**: `.agents/tasks/security-analysis-message-markdown-renderer-2025-11-07.md`

## Overview

Remove the `rehype-raw` plugin from MessageMarkdownRenderer to eliminate critical HTML injection vulnerabilities while maintaining YouTube video embedding functionality using a **simple markdown image syntax approach**.

## Background

### Why rehype-raw Was Added
- **Date**: 2025-09-20 (commit ea0dab7e)
- **Purpose**: Enable YouTube video embeds by allowing custom HTML `<div>` placeholders
- **Problem**: The plugin allows ALL HTML to be rendered, not just YouTube placeholders
- **Risk**: Attackers can inject arbitrary HTML for phishing, UI spoofing, and data exfiltration

### Lead Developer Feedback
> "there's definitely some weird stuff coming through, i was able to generate some weird payloads that didn't use javascript at all. just the fact it could render html"

This is accurate - the vulnerability allows HTML structure manipulation without JavaScript, enabling sophisticated phishing attacks.

## Current Implementation

**File**: `src/components/message/MessageMarkdownRenderer.tsx`

### Current Flow:
1. `processStandaloneYouTubeUrls()` converts YouTube URLs to HTML:
   ```typescript
   return `<div data-youtube-url="${url}" class="youtube-placeholder"></div>`;
   ```
2. `rehype-raw` plugin renders this HTML (line 5, line 470)
3. Custom `div` component handler catches it (lines 395-423)
4. Renders `YouTubeEmbed` component

### Current Components Used:
- `YouTubeEmbed` (`src/components/ui/YouTubeEmbed.tsx`) - Wrapper that extracts video ID
- `YouTubeFacade` (`src/components/ui/YouTubeFacade.tsx`) - Shows thumbnail with click-to-play

## Security Issues

### Critical Vulnerabilities:
1. **HTML Injection** - Arbitrary HTML rendering without sanitization
2. **Phishing Attacks** - Fake forms and UI elements
3. **UI Spoofing** - Impersonation of system messages
4. **CSS-based Exfiltration** - Information leakage via external resources
5. **Attribute Injection** - Malicious data in mention/role attributes (EXISTING vulnerability)

**See full details**: `.agents/tasks/security-analysis-message-markdown-renderer-2025-11-07.md`

## Solution: Markdown Image Syntax (SIMPLE)

### Why This Approach?

The feature-analyzer agent analyzed the solution and determined:
- **Previous approach complexity**: 8/10 (significantly over-engineered)
- **This approach complexity**: 2/10 (appropriately simple)
- **Time savings**: 1 hour vs 5-7 hours
- **Code changes**: ~30 lines vs ~150 lines
- **New files**: 0 vs 1

### Approach

Instead of injecting HTML and using multiple ReactMarkdown instances, we'll use ReactMarkdown's native component customization:

1. Convert standalone YouTube URLs to markdown image syntax: `![youtube-embed](videoId)`
2. Add an `img` component handler that catches this special syntax
3. Render YouTube videos via the `img` handler
4. Remove `rehype-raw` entirely

### Benefits
- ✅ No HTML injection risk
- ✅ Uses standard markdown syntax
- ✅ Single ReactMarkdown instance (better performance)
- ✅ No new utilities or files needed
- ✅ Leverages ReactMarkdown's built-in component system
- ✅ Easier to maintain and understand
- ✅ React handles all attribute escaping automatically

## Implementation Tasks

### Step 1: Modify processStandaloneYouTubeUrls Function

**File**: `src/components/message/MessageMarkdownRenderer.tsx` (lines 74-85)

**Change from HTML injection to markdown syntax:**

```typescript
// BEFORE (lines 74-85):
const processStandaloneYouTubeUrls = (text: string): string => {
  return replaceYouTubeURLsInText(text, (url) => {
    // Check if URL is on its own line (standalone)
    const lines = text.split('\n');
    const isStandalone = lines.some(line => line.trim() === url);

    if (isStandalone) {
      return `<div data-youtube-url="${url}" class="youtube-placeholder"></div>`;
    }
    return url; // Keep inline YouTube URLs as-is for link processing
  });
};

// AFTER:
const processStandaloneYouTubeUrls = (text: string): string => {
  const lines = text.split('\n');

  return replaceYouTubeURLsInText(text, (url) => {
    // Check if URL is alone on its line (standalone)
    const isStandalone = lines.some(line => line.trim() === url.trim());

    if (isStandalone) {
      const videoId = extractYouTubeVideoId(url);
      if (videoId) {
        // Use markdown image syntax as signal for YouTube embed
        return `![youtube-embed](${videoId})`;
      }
    }
    return url; // Keep inline YouTube URLs as-is for link processing
  });
};
```

### Step 2: Add img Component Handler

**File**: `src/components/message/MessageMarkdownRenderer.tsx`

**Add after the `a` component handler (around line 270):**

```typescript
// Add this component handler to the components object
img: ({ src, alt, ...props }: any) => {
  // Handle YouTube embeds marked with special alt text
  if (alt === 'youtube-embed' && src) {
    return (
      <div className="my-2">
        <YouTubeFacade
          videoId={src}
          className="rounded-lg youtube-embed"
          style={{
            width: '100%',
            maxWidth: 560,
            aspectRatio: '16/9',
          }}
        />
      </div>
    );
  }

  // Regular images - render normally (or return null if images not supported)
  return null; // or <img src={src} alt={alt} {...props} /> if you want image support
},
```

### Step 3: Remove rehype-raw Plugin

**File**: `src/components/message/MessageMarkdownRenderer.tsx`

```typescript
// Line 5: Remove import
- import rehypeRaw from 'rehype-raw';

// Line 470: Remove from plugins array
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkBreaks]}
- rehypePlugins={[rehypeRaw]}
+ rehypePlugins={[]}
  components={components}
>
```

### Step 4: Remove Custom div Handler

**File**: `src/components/message/MessageMarkdownRenderer.tsx` (lines 395-423)

**Remove the entire `div` component handler:**

```typescript
// REMOVE THIS ENTIRE BLOCK (lines 395-423):
- // Handle YouTube placeholder divs
- div: ({ children, className, 'data-youtube-url': youtubeUrl, ...props }: any) => {
-   if (className === 'youtube-placeholder' && youtubeUrl) {
-     if (isYouTubeURL(youtubeUrl)) {
-       const embedUrl = convertToYouTubeEmbedURL(youtubeUrl);
-       if (embedUrl) {
-         return (
-           <div className="my-2">
-             <YouTubeEmbed
-               src={embedUrl}
-               className="rounded-lg youtube-embed"
-               style={{
-                 width: '100%',
-                 maxWidth: 560,
-                 aspectRatio: '16/9',
-               }}
-             />
-           </div>
-         );
-       }
-     }
-   }
-
-   // For regular divs, render normally
-   return (
-     <div className={className} {...props}>
-       {children}
-     </div>
-   );
- },
```

### Step 5: Remove rehype-raw Dependency

**File**: `package.json`

```bash
# Run in terminal
yarn remove rehype-raw
```

### Step 6: Update Inline YouTube URL Handling (APPROVED)

**Decision**: Inline YouTube URLs should render as **clickable links** (not embeds) to avoid cluttering messages.

**File**: `src/components/message/MessageMarkdownRenderer.tsx` (lines 234-269)

**Current implementation in `a` component handler:**
```typescript
a: ({ href, children, ...props }: any) => {
  if (href && isYouTubeURL(href)) {
    // Currently renders as YouTube embed
    const embedUrl = convertToYouTubeEmbedURL(href);
    if (embedUrl) {
      return <YouTubeEmbed src={embedUrl} ... />;
    }
  }

  // Regular links
  return <a href={href} target="_blank" ...>{children}</a>;
}
```

**Update to render as link instead:**
```typescript
a: ({ href, children, ...props }: any) => {
  // Render ALL links (including YouTube) as clickable links
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="link"
        {...props}
      >
        {children}
      </a>
    );
  }

  // If no href, just render as plain text
  return <span>{children}</span>;
}
```

### Step 7: Fix Mention Attribute Injection (CRITICAL)

**File**: `src/components/message/MessageMarkdownRenderer.tsx`

**Current issue**: User-controlled `displayName` and `userIcon` data is injected into HTML attributes without escaping (lines 168-172). This is a **SEPARATE critical XSS vulnerability** that exists right now.

**Problem example:**
```typescript
// If displayName = '"><script>alert(1)</script><span x="'
// This creates: <span data-user-display-name=""><script>alert(1)</script><span x="">
```

**Solution: Use React components with placeholders instead of HTML strings**

**Update `processMentions` function (lines 157-175):**

```typescript
// BEFORE (lines 157-175):
const processMentions = useCallback((text: string): string => {
  if (!mapSenderToUser) return text;

  let processedText = text;

  // Only style @everyone if the message has mentions.everyone = true
  if (hasEveryoneMention) {
    processedText = processedText.replace(/@everyone\b/gi, '<span class="message-name-mentions-everyone">@everyone</span>');
  }

  // Replace @<address> with styled, clickable @DisplayName
  processedText = processedText.replace(/@<(Qm[a-zA-Z0-9]+)>/g, (match, address) => {
    const user = mapSenderToUser(address);
    const displayName = user?.displayName || address.substring(0, 8) + '...';
    return `<span class="message-name-mentions-you cursor-pointer" data-user-address="${address}" data-user-display-name="${displayName || ''}" data-user-icon="${user?.userIcon || ''}">@${displayName}</span>`;
  });

  return processedText;
}, [mapSenderToUser, hasEveryoneMention]);

// AFTER - Use safe placeholder tokens:
const processMentions = useCallback((text: string): string => {
  if (!mapSenderToUser) return text;

  let processedText = text;

  // Only style @everyone if the message has mentions.everyone = true
  if (hasEveryoneMention) {
    processedText = processedText.replace(/@everyone\b/gi, '__MENTION_EVERYONE__');
  }

  // Replace @<address> with safe placeholder token
  processedText = processedText.replace(/@<(Qm[a-zA-Z0-9]+)>/g, (match, address) => {
    return `__MENTION_USER:${address}__`;
  });

  return processedText;
}, [mapSenderToUser, hasEveryoneMention]);
```

**Add `text` component handler to render mentions safely:**

```typescript
// Add this to the components object (around line 220)
text: ({ children, ...props }: any) => {
  const text = String(children);

  // Handle @everyone mentions
  if (text === '__MENTION_EVERYONE__') {
    return (
      <span className="message-name-mentions-everyone">
        @everyone
      </span>
    );
  }

  // Handle user mentions
  const mentionMatch = text.match(/^__MENTION_USER:(Qm[a-zA-Z0-9]+)__$/);
  if (mentionMatch && mapSenderToUser && onUserClick) {
    const address = mentionMatch[1];
    const user = mapSenderToUser(address);
    const displayName = user?.displayName || address.substring(0, 8) + '...';

    return (
      <span
        className="message-name-mentions-you cursor-pointer"
        data-user-address={address}
        data-user-display-name={displayName}
        data-user-icon={user?.userIcon || ''}
      >
        @{displayName}
      </span>
    );
  }

  return <>{children}</>;
},
```

**Update processRoleMentions similarly (lines 178-202):**

```typescript
// BEFORE:
const processRoleMentions = useCallback((text: string): string => {
  if (!roleMentions || roleMentions.length === 0 || !spaceRoles || spaceRoles.length === 0) {
    return text;
  }

  // Get role data for existing roles only
  const roleData = roleMentions
    .map(roleId => {
      const role = spaceRoles.find(r => r.roleId === roleId);
      return role ? { roleTag: role.roleTag, displayName: role.displayName } : null;
    })
    .filter(Boolean) as Array<{ roleTag: string; displayName: string }>;

  // Replace @roleTag with styled span
  let processed = text;
  roleData.forEach(({ roleTag, displayName }) => {
    const regex = new RegExp(`@${roleTag}(?!\\w)`, 'g');
    processed = processed.replace(
      regex,
      `<span class="message-name-mentions-you" title="${displayName}">@${roleTag}</span>`
    );
  });

  return processed;
}, [roleMentions, spaceRoles]);

// AFTER - Use safe placeholder tokens:
const processRoleMentions = useCallback((text: string): string => {
  if (!roleMentions || roleMentions.length === 0 || !spaceRoles || spaceRoles.length === 0) {
    return text;
  }

  // Get role data for existing roles only
  const roleData = roleMentions
    .map(roleId => {
      const role = spaceRoles.find(r => r.roleId === roleId);
      return role ? { roleTag: role.roleTag, displayName: role.displayName } : null;
    })
    .filter(Boolean) as Array<{ roleTag: string; displayName: string }>;

  // Replace @roleTag with safe placeholder
  let processed = text;
  roleData.forEach(({ roleTag, displayName }) => {
    const regex = new RegExp(`@${roleTag}(?!\\w)`, 'g');
    processed = processed.replace(
      regex,
      `__MENTION_ROLE:${roleTag}:${displayName}__`
    );
  });

  return processed;
}, [roleMentions, spaceRoles]);
```

**Update the `text` component handler to also handle role mentions:**

```typescript
text: ({ children, ...props }: any) => {
  const text = String(children);

  // Handle @everyone mentions
  if (text === '__MENTION_EVERYONE__') {
    return (
      <span className="message-name-mentions-everyone">
        @everyone
      </span>
    );
  }

  // Handle user mentions
  const mentionMatch = text.match(/^__MENTION_USER:(Qm[a-zA-Z0-9]+)__$/);
  if (mentionMatch && mapSenderToUser && onUserClick) {
    const address = mentionMatch[1];
    const user = mapSenderToUser(address);
    const displayName = user?.displayName || address.substring(0, 8) + '...';

    return (
      <span
        className="message-name-mentions-you cursor-pointer"
        data-user-address={address}
        data-user-display-name={displayName}
        data-user-icon={user?.userIcon || ''}
      >
        @{displayName}
      </span>
    );
  }

  // Handle role mentions
  const roleMatch = text.match(/^__MENTION_ROLE:([^:]+):(.+)__$/);
  if (roleMatch) {
    const [, roleTag, displayName] = roleMatch;
    return (
      <span
        className="message-name-mentions-you"
        title={displayName}
      >
        @{roleTag}
      </span>
    );
  }

  return <>{children}</>;
},
```

**Note**: React automatically escapes all attributes, so when we set `data-user-display-name={displayName}`, React handles the escaping for us. No manual HTML escaping needed!

### Step 8: Testing

**Test cases:**

1. **Standalone YouTube URLs**
   ```
   Check this out:

   https://youtube.com/watch?v=dQw4w9WgXcQ

   Pretty cool!
   ```
   Expected: Video embed renders between text blocks

2. **Inline YouTube URLs**
   ```
   Check this video https://youtube.com/watch?v=dQw4w9WgXcQ out!
   ```
   Expected: Renders as clickable link (not embed)

3. **Multiple YouTube URLs**
   ```
   Video 1:
   https://youtube.com/watch?v=abc

   Video 2:
   https://youtube.com/watch?v=def
   ```
   Expected: Both videos render as embeds

4. **Markdown with YouTube**
   ```
   ### Tutorial

   https://youtube.com/watch?v=abc

   Code example:
   ```js
   console.log('test');
   ```
   ```
   Expected: Heading, video, code block all render correctly

5. **HTML Injection Attempt**
   ```
   <div onclick="alert('xss')">Click me</div>
   <script>alert('xss')</script>
   ```
   Expected: Renders as plain text, no HTML execution

6. **Attribute Injection in Mentions**
   ```
   @<Qmxxxxx> where displayName contains: '" onclick="alert(1)
   ```
   Expected: Mention renders safely, no script execution (React escapes it)

7. **YouTube URLs in Code Blocks**
   ````
   ```
   https://youtube.com/watch?v=abc
   ```
   ````
   Expected: URL stays as plain text in code block (not processed)

8. **Role Mention with Special Characters**
   ```
   @admin where displayName contains: '"><img src=x onerror=alert(1)>
   ```
   Expected: Renders safely without script execution

### Step 9: Update Documentation

**Files to update:**
1. `.agents/docs/features/messages/markdown-renderer.md`
   - Remove reference to `rehype-raw` as dependency (line 138)
   - Update "Raw HTML Support" section (lines 34-36) to explain it's no longer supported
   - Update "Architecture" section to reflect markdown image syntax approach

2. Add security fix note to commit message

## Testing Checklist

- [ ] YouTube standalone URLs render as embeds
- [ ] YouTube inline URLs render as clickable links (not embeds)
- [ ] Multiple YouTube URLs in same message work
- [ ] Markdown formatting still works (headers, bold, code blocks, tables, lists, etc.)
- [ ] Code blocks don't process YouTube URLs
- [ ] HTML injection attempts render as plain text
- [ ] Mention attribute injection is safe (React escapes attributes)
- [ ] Role mentions with special characters are safe
- [ ] @everyone mentions render correctly
- [ ] Clicking user mentions triggers onUserClick handler
- [ ] No console errors or warnings
- [ ] Performance is good (no lag when rendering)
- [ ] YouTube facade click-to-play works
- [ ] YouTube videos don't restart on scroll/re-render

## Rollback Plan

If issues are found after deployment:

1. **Immediate**: Revert the changes to `MessageMarkdownRenderer.tsx`
2. **Temporary**: Add content sanitization using DOMPurify library
3. **Permanent**: Fix the discovered issues and redeploy

## Success Criteria

- ✅ `rehype-raw` plugin removed from codebase
- ✅ All HTML injection attack vectors eliminated
- ✅ Mention/role attribute injection vulnerabilities fixed
- ✅ YouTube video embedding functionality preserved
- ✅ All tests pass
- ✅ No regression in markdown rendering
- ✅ Security analysis report updated with "Fixed" status

## Estimated Effort

- **Development**: 30-60 minutes
- **Testing**: 30 minutes
- **Code review**: 15 minutes
- **Total**: ~1-2 hours

## Dependencies

- No external dependencies required
- Uses existing `YouTubeFacade` component
- Uses existing `youtubeUtils.ts` utility functions
- No new files needed

## Notes

- This is a **critical security fix** and should be prioritized
- The solution is much simpler than originally proposed (1 hour vs 5-7 hours)
- No new files or utilities needed
- Single ReactMarkdown instance = better performance
- React handles all attribute escaping automatically
- Fixes TWO critical vulnerabilities: HTML injection AND mention attribute injection

## Architecture Comparison

### Previous Proposal (Over-Engineered):
- Create content splitter utility
- Multiple ReactMarkdown instances per message
- Complex segment key management
- Manual HTML escaping for attributes
- 150+ lines of changes
- 1 new file
- 5-7 hours of work

### This Solution (Appropriately Simple):
- Use markdown image syntax
- Single ReactMarkdown instance
- Leverage ReactMarkdown's component system
- React handles attribute escaping automatically
- ~30 lines of changes
- 0 new files
- 1-2 hours of work

---
**Created**: 2025-11-07
**Last Updated**: 2025-11-07
