---
type: task
title: Message Link Rendering (Discord-style)
status: done
complexity: medium
ai_generated: true
created: 2025-12-03T00:00:00.000Z
updated: '2026-01-09'
---

# Message Link Rendering (Discord-style)

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent


**Files**:
- `src/utils/environmentDomains.ts` (new - centralized domain detection)
- `src/utils/messageLinkUtils.ts` (new - message link parsing)
- `src/utils/inviteDomain.ts` (refactor to use centralized utility)
- `src/components/message/MessageMarkdownRenderer.tsx:313-357`
- `src/components/message/Message.tsx:926-942` (fallback token rendering)
- `src/components/message/Message.scss` (CSS for message-link elements)
- `src/hooks/business/messages/useMessageFormatting.ts:190-254`
- `src/components/message/MessagePreview.tsx:46-125`

## What & Why

**Current state**: When users paste links to messages from channels within the same Space (e.g., `https://qm.one/spaces/spaceId/channelId#msg-messageId`), they render as plain URLs or clickable links.

**Desired state**: Message links should render in a Discord-style format showing `#channelname › 📄` (channel name with a message icon), using the same visual styling as channel mentions but with the message icon indicator.

**Value**: Improves readability, provides visual context for linked messages, and matches user expectations from Discord's similar feature.

## Context

- **Existing pattern**: Channel mentions use `<<<MENTION_CHANNEL:channelId:channelName:inlineDisplayName>>>` tokens
- **Reference implementation**: See channel mention processing in `MessageMarkdownRenderer.tsx:312-357`
- **Icon available**: `comment-dots` → `IconMessage` in icon mapping (line 54)
- **CSS styling**: `.message-name-mentions-you.interactive` for clickable mentions (REUSE - no new classes)

### URL Formats to Detect

**Production URLs**:
- `https://qm.one/spaces/{spaceId}/{channelId}#msg-{messageId}`
- `https://app.quorummessenger.com/spaces/{spaceId}/{channelId}#msg-{messageId}`

**Staging URLs**:
- `https://test.quorummessenger.com/spaces/{spaceId}/{channelId}#msg-{messageId}`

**Relative URLs** (pasted from address bar):
- `/spaces/{spaceId}/{channelId}#msg-{messageId}`

**NOT in scope** (per user request):
- DM message links: `/messages/{address}#msg-{messageId}`

### Critical Design Decisions

1. **Same-Space Only**: Only render styled message links for the **current space**. Cross-space links remain as plain URLs to avoid confusion.
2. **Word Boundary Validation**: Use `hasWordBoundaries()` to prevent extraction inside markdown syntax (code blocks, inline code, etc.)
3. **Processing Order**: Process message links **BEFORE** general URL processing to avoid double-processing.
4. **Reuse CSS**: Use existing `.message-name-mentions-you` class - no new CSS classes needed.

## Prerequisites

- [ ] Review existing channel mention implementation for patterns
- [ ] Understand the dual rendering system (MessageMarkdownRenderer + MessagePreview)
- [ ] Review `hasWordBoundaries()` usage in mention extraction

## Implementation

### Phase 0: Centralize Environment Domain Detection

- [ ] **Create shared environment utility** (`src/utils/environmentDomains.ts`)
  - Done when: Environment detection and domain building exported
  - Verify: Unit tests pass for all environments
  - Rationale: Single source of truth for domain whitelisting (used by invites + message links)

```typescript
// src/utils/environmentDomains.ts
/**
 * Centralized environment detection and domain whitelisting
 * Used by invite links, message links, and future deep link features
 */

export type Environment = 'production' | 'staging' | 'localhost' | 'custom';

export interface EnvironmentInfo {
  environment: Environment;
  domains: string[];        // Valid domains for this environment
  protocol: 'http' | 'https';
  currentDomain: string;    // The detected current domain
}

/**
 * Detect current environment and return valid domains
 * Single source of truth for domain whitelisting
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  if (typeof window === 'undefined') {
    return {
      environment: 'production',
      domains: ['qm.one', 'app.quorummessenger.com'],
      protocol: 'https',
      currentDomain: 'qm.one'
    };
  }

  const { hostname, port } = window.location;

  // STAGING
  if (hostname === 'test.quorummessenger.com') {
    return {
      environment: 'staging',
      domains: ['test.quorummessenger.com'],
      protocol: 'https',
      currentDomain: hostname
    };
  }

  // PRODUCTION
  if (hostname === 'app.quorummessenger.com') {
    return {
      environment: 'production',
      domains: ['qm.one', 'app.quorummessenger.com'],
      protocol: 'https',
      currentDomain: hostname
    };
  }

  // LOCALHOST
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const localDomain = port ? `${hostname}:${port}` : hostname;
    return {
      environment: 'localhost',
      domains: [localDomain],
      protocol: 'http',
      currentDomain: localDomain
    };
  }

  // CUSTOM DEPLOYMENT
  return {
    environment: 'custom',
    domains: [hostname],
    protocol: 'https',
    currentDomain: hostname
  };
}

/**
 * Build URL prefixes for a given path pattern
 * @param pathSuffix - The path to append (e.g., '/spaces/', '/#', '/invite/#')
 * @returns Array of valid URL prefixes including relative paths
 */
export function buildValidPrefixes(pathSuffix: string): string[] {
  const { domains, protocol } = getEnvironmentInfo();
  const prefixes: string[] = [];

  for (const domain of domains) {
    prefixes.push(`${protocol}://${domain}${pathSuffix}`);
    prefixes.push(`${domain}${pathSuffix}`);
  }

  // Always accept relative paths (starts with /)
  if (pathSuffix.startsWith('/')) {
    prefixes.push(pathSuffix);
  }

  return prefixes;
}
```

- [ ] **Refactor inviteDomain.ts to use centralized utility** (`src/utils/inviteDomain.ts`)
  - Done when: `getValidInvitePrefixes()` uses `buildValidPrefixes()`
  - Verify: Invite links still work correctly
  - Note: Keep `getInviteBaseDomain()` and other invite-specific functions

```typescript
// Update getValidInvitePrefixes() in inviteDomain.ts:
import { buildValidPrefixes, getEnvironmentInfo } from './environmentDomains';

export function getValidInvitePrefixes(): string[] {
  const { environment } = getEnvironmentInfo();

  // Build prefixes for both invite path variants
  const hashPrefixes = buildValidPrefixes('/#');
  const invitePrefixes = buildValidPrefixes('/invite/#');

  // Localhost development: also accept common test ports
  if (environment === 'localhost') {
    return [
      ...hashPrefixes,
      ...invitePrefixes,
      // Keep legacy localhost ports for development
      'http://localhost:5173/#',
      'http://localhost:5173/invite/#',
      'http://localhost:3000/#',
      'http://localhost:3000/invite/#',
    ];
  }

  return [...hashPrefixes, ...invitePrefixes];
}
```

### Phase 1: Message Link Detection Utility

- [ ] **Create message link utility** (`src/utils/messageLinkUtils.ts`)
  - Done when: Functions exported for detecting and parsing message links
  - Verify: Parses all URL formats correctly
  - Reference: Uses centralized `buildValidPrefixes()` from Phase 0

```typescript
// src/utils/messageLinkUtils.ts
/**
 * Utility functions for message link detection and parsing
 * Uses centralized environment detection from environmentDomains.ts
 */

import { buildValidPrefixes } from './environmentDomains';

interface MessageLinkInfo {
  spaceId: string;
  channelId: string;
  messageId: string;
  isRelative: boolean;
}

/**
 * Get valid message link prefixes based on current environment
 * Uses centralized domain detection
 */
export function getValidMessageLinkPrefixes(): string[] {
  return buildValidPrefixes('/spaces/');
}

/**
 * Parse message link URL into components
 * Returns null if not a valid message link
 */
export function parseMessageLink(url: string): MessageLinkInfo | null {
  // Match: [prefix]/spaces/{spaceId}/{channelId}#msg-{messageId}
  const regex = /\/spaces\/([^\/]+)\/([^#]+)#msg-([a-zA-Z0-9_-]+)$/;
  const match = url.match(regex);

  if (!match) return null;

  return {
    spaceId: match[1],
    channelId: match[2],
    messageId: match[3],
    isRelative: url.startsWith('/'),
  };
}

/**
 * Check if a URL is a message link (convenience function)
 */
export function isMessageLink(url: string): boolean {
  return parseMessageLink(url) !== null;
}
```

### Phase 2: Token Processing in MessageMarkdownRenderer

- [ ] **Add message link processing function** (`MessageMarkdownRenderer.tsx`)
  - Done when: Message links converted to `<<<MESSAGE_LINK:channelId:messageId:channelName>>>` tokens
  - Verify: Console log shows tokens being created
  - Reference: Follow `processChannelMentions()` pattern (lines 312-357)
  - **CRITICAL**: Include current space validation and word boundary checks

```typescript
// Add import at top
import { parseMessageLink, getValidMessageLinkPrefixes } from '../../utils/messageLinkUtils';
import { hasWordBoundaries } from '../../utils/mentionUtils';

// New processing function - add after processChannelMentions
const processMessageLinks = useCallback((text: string, currentSpaceId: string): string => {
  if (!currentSpaceId || !spaceChannels || spaceChannels.length === 0) {
    return text;
  }

  // Build regex dynamically from valid prefixes
  const prefixes = getValidMessageLinkPrefixes();
  const prefixPattern = prefixes
    .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  // Match message link URLs
  const messageLinkRegex = new RegExp(
    `(?:${prefixPattern})([^/]+)/([^#]+)#msg-([a-zA-Z0-9_-]+)`,
    'g'
  );

  let processed = text;
  const matches = Array.from(text.matchAll(messageLinkRegex));

  // Collect valid matches with word boundary validation
  const validMatches = [];
  for (const match of matches) {
    if (hasWordBoundaries(text, match)) {
      validMatches.push(match);
    }
  }

  // Process matches in reverse order to avoid index shifting
  for (let i = validMatches.length - 1; i >= 0; i--) {
    const match = validMatches[i];
    const [fullMatch, spaceId, channelId, messageId] = match;

    // CRITICAL: Only process links to CURRENT space
    if (spaceId !== currentSpaceId) {
      continue; // Leave cross-space links as plain URLs
    }

    // Find channel name from spaceChannels
    const channel = spaceChannels.find(c => c.channelId === channelId);
    if (!channel) {
      continue; // Channel not found - leave as plain URL
    }

    const channelName = channel.channelName;
    const beforeText = processed.substring(0, match.index);
    const afterText = processed.substring(match.index! + fullMatch.length);

    // Simplified token format (spaceId implicit - current space only)
    processed = beforeText + `<<<MESSAGE_LINK:${channelId}:${messageId}:${channelName}>>>` + afterText;
  }

  return processed;
}, [spaceChannels]);
```

- [ ] **Add to processing pipeline** (`MessageMarkdownRenderer.tsx:461-477`)
  - Done when: `processMessageLinks` called BEFORE processURLs in useMemo pipeline
  - Verify: Tokens appear in processed content
  - **CRITICAL**: Order matters - message links must be processed BEFORE general URLs

```typescript
// NOTE: processMessageLinks BEFORE processURLs to prevent double-processing
const processedContent = useMemo(() => {
  return fixUnclosedCodeBlocks(
    convertHeadersToH3(
      processURLs(  // General URLs - runs AFTER message links tokenized
        processMessageLinks(  // Message links - runs FIRST
          processChannelMentions(
            processRoleMentions(
              processMentions(
                processStandaloneYouTubeUrls(
                  processInviteLinks(content)
                )
              )
            )
          ),
          currentSpaceId  // Pass current space ID
        )
      )
    )
  );
}, [content, processMentions, processRoleMentions, processChannelMentions, processMessageLinks, currentSpaceId]);
```

### Phase 3: Token Rendering in MessageMarkdownRenderer

- [ ] **Add message link rendering** (`MessageMarkdownRenderer.tsx:359-458`)
  - Done when: Message link tokens render as styled spans with icon
  - Verify: Links appear with `#channelname › icon` format
  - Reference: Follow channel mention token handling (lines 431-447)

```typescript
// Update processMentionTokens() regex to include MESSAGE_LINK pattern
// EXACT capture group mapping documented below:

const cidPattern = createIPFSCIDRegex().source;
const mentionRegex = new RegExp(
  `<<<(` +
    `MENTION_(EVERYONE|USER:(${cidPattern}):([^>]{0,200})|ROLE:([^:]{1,50}):([^>]{1,200})|CHANNEL:([^:>]{1,50}):([^:>]{1,200}):([^>]{0,200}))|` +
    `MESSAGE_LINK:([^:>]{1,100}):([^:>]{1,100}):([^>]{0,200})` +  // channelId:messageId:channelName
  `)>>>`,
  'g'
);

// Capture group mapping:
// match[1] = Full inner content
// match[2] = MENTION type (EVERYONE, USER:..., ROLE:..., CHANNEL:...)
// ... (existing mention groups)
// match[10] = MESSAGE_LINK channelId
// match[11] = MESSAGE_LINK messageId
// match[12] = MESSAGE_LINK channelName

// Add handling for MESSAGE_LINK tokens after channel mention handling:
} else if (match[10] && match[11] && match[12]) {
  // Message link: <<<MESSAGE_LINK:channelId:messageId:channelName>>>
  const channelId = match[10];
  const messageId = match[11];
  const channelName = match[12];

  parts.push(
    <span
      key={`message-link-${match.index}`}
      className="message-mentions-message-link interactive"
      data-channel-id={channelId}
      data-message-id={messageId}
    >
      #{channelName}
      <span className="message-mentions-message-link__separator"> › </span>
      <Icon name="comment-dots" size="xs" variant="filled" className="message-mentions-message-link__icon" />
    </span>
  );
}
```

- [ ] **Add click handler** (`MessageMarkdownRenderer.tsx:743-767`)
  - Done when: Clicking message link navigates to the message
  - Verify: Navigation works with highlight
  - Reference: Follow channel mention click handler pattern

```typescript
// Add to handleClick callback after channel mention handling:

// Handle message link clicks
if (target.classList.contains('message-mentions-message-link') && target.dataset.messageId) {
  const channelId = target.dataset.channelId;
  const messageId = target.dataset.messageId;

  if (channelId && messageId && currentSpaceId) {
    // Navigate to the message (same pattern as NotificationPanel)
    navigate(`/spaces/${currentSpaceId}/${channelId}#msg-${messageId}`);
  }
}
```

### Phase 4: Token Processing in useMessageFormatting

- [ ] **Add message-link token type** (`useMessageFormatting.ts:215-254`)
  - Done when: `processTextToken` returns `message-link` type for message URLs
  - Verify: MessagePreview can detect and handle message links
  - Reference: Follow channel-mention handling pattern (lines 190-213)

```typescript
// Add import at top
import { parseMessageLink } from '../../../utils/messageLinkUtils';

// Add after channel mention check, before YouTube check (around line 214):

// Check for message links (same-space only)
const messageLinkInfo = parseMessageLink(token);

if (messageLinkInfo && messageLinkInfo.spaceId === currentSpaceId) {
  const channel = spaceChannels.find(c => c.channelId === messageLinkInfo.channelId);

  // Only render as message link if channel exists in current space
  if (channel) {
    return {
      type: 'message-link' as const,
      key: `${messageId}-${lineIndex}-${tokenIndex}`,
      channelId: messageLinkInfo.channelId,
      messageId: messageLinkInfo.messageId,
      channelName: channel.channelName,
      isInteractive: !disableMentionInteractivity,
    };
  }
}
```

**Note**: `currentSpaceId` needs to be added to the hook options:

```typescript
interface UseMessageFormattingOptions {
  message: MessageType;
  stickers?: { [key: string]: Sticker };
  mapSenderToUser: (senderId: string) => any;
  onImageClick: (imageUrl: string) => void;
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  disableMentionInteractivity?: boolean;
  currentSpaceId?: string;  // ADD THIS
}
```

### Phase 5: Rendering in MessagePreview

- [ ] **Handle message-link token type** (`MessagePreview.tsx:46-125`)
  - Done when: Message links render with icon in previews
  - Verify: BookmarksPanel and PinnedMessagesPanel show styled links
  - Reference: Follow channel-mention handling (lines 61-71)

```typescript
// Add after channel-mention handling (around line 71):

} else if (tokenData.type === 'message-link') {
  renderedTokens.push(
    <React.Fragment key={tokenData.key}>
      <span
        className={`message-mentions-message-link ${disableMentionInteractivity ? 'non-interactive' : 'interactive'}`}
        onClick={!disableMentionInteractivity ? () => {
          // Use navigate from react-router-dom or window.location
          window.location.href = `/spaces/${currentSpaceId}/${tokenData.channelId}#msg-${tokenData.messageId}`;
        } : undefined}
      >
        #{tokenData.channelName}
        <span className="message-mentions-message-link__separator"> › </span>
        <Icon name="comment-dots" size="xs" variant="filled" className="message-mentions-message-link__icon" />
      </span>{' '}
    </React.Fragment>
  );
}
```

### Phase 5b: Fallback Token-Based Rendering in Message.tsx

- [ ] **Handle message-link token in fallback path** (`Message.tsx:926-942`)
  - Done when: Message links render when `ENABLE_MARKDOWN = false`
  - Verify: Disable markdown flag, message links still render correctly
  - Reference: Follow channel-mention handling pattern (lines 926-942)
  - **CRITICAL**: Ensures dual rendering system works for message links

```typescript
// Add after channel-mention handling (around line 942):

if (tokenData.type === 'message-link') {
  return (
    <React.Fragment key={tokenData.key}>
      <Text
        as="span"
        className={`message-mentions-message-link ${tokenData.isInteractive ? 'interactive' : 'non-interactive'}`}
        onClick={tokenData.isInteractive ? () => {
          // Navigate to message - currentSpaceId available from component props
          navigate(`/spaces/${currentSpaceId}/${tokenData.channelId}#msg-${tokenData.messageId}`);
        } : undefined}
      >
        #{tokenData.channelName}
        <span className="message-mentions-message-link__separator"> › </span>
        <Icon name="comment-dots" size="xs" variant="filled" className="message-mentions-message-link__icon" />
      </Text>{' '}
    </React.Fragment>
  );
}
```

### Phase 6: Pass Current Space Context

- [ ] **Add currentSpaceId to component props chain**
  - Done when: MessageMarkdownRenderer and MessagePreview receive currentSpaceId
  - Verify: Space validation works correctly
  - Files: `Channel.tsx`, `DirectMessage.tsx`, parent components

The `currentSpaceId` needs to be passed through the component hierarchy:
1. `Channel.tsx` / `DirectMessage.tsx` → `Message.tsx` → `MessageMarkdownRenderer`
2. `BookmarksPanel.tsx` → `BookmarkItem.tsx` → `MessagePreview`
3. `PinnedMessagesPanel.tsx` → `PinnedMessageItem` → `MessagePreview`

### Phase 7: CSS Styling

- [ ] **Add message link styles** (`src/components/message/Message.scss`)
  - Done when: Message links render with proper styling
  - Verify: Works in both light and dark themes
  - Reference: Place near existing `.message-name-mentions-you` styles

```scss
// Add to src/styles/_chat.scss - follows existing mention class pattern

// Add .message-mentions-message-link to the base styling list:
.message-mentions-user,
.message-mentions-role,
.message-mentions-everyone,
.message-mentions-channel,
.message-mentions-message-link {  // ← Add this
  @include mention-base;
}

// Add interactive behavior (message links are clickable like user/channel mentions):
.message-mentions-user,
.message-mentions-channel,
.message-mentions-message-link {  // ← Add this
  &.interactive {
    cursor: pointer;

    &:hover {
      color: var(--color-link-mention-hover);
      background: var(--color-bg-mention-hover);
    }
  }

  &.non-interactive {
    cursor: default;
  }
}

// Message link specific styles (separator and icon)
.message-mentions-message-link {
  display: inline-flex;
  align-items: center;

  // Separator between channel name and icon
  // Inherits color from mention-base (--color-link-mention)
  &__separator {
    font-size: $text-xs-responsive;       // 14px mobile → 12px desktop
    margin: 0 $s-1;                       // 0 4px - spacing scale
    opacity: 0.7;                         // Slightly muted relative to channel name
  }

  // Message icon
  // Inherits color from mention-base (--color-link-mention)
  &__icon {
    vertical-align: middle;
    opacity: 0.8;                         // Slightly muted relative to channel name
  }
}
```

**Note**:
- Follows the existing mention class pattern from `_chat.scss`
- Uses `@include mention-base` mixin for consistent base styling
- Added to interactive group (like user/channel mentions)
- Uses `$text-xs-responsive` and `$s-1` from design system
- Separator/icon inherit `var(--color-link-mention)` from mixin, use opacity to mute

## Verification

✅ **Message links detected correctly**
   - Test: Paste `https://qm.one/spaces/test/general#msg-abc123` in a message
   - Expected: Link converted to styled `#general › 📄` format

✅ **Same-space validation works**
   - Test: Paste link to message in a DIFFERENT Space
   - Expected: Renders as plain URL (not styled)

✅ **Word boundary validation works**
   - Test: Paste message link inside code block: `` `https://qm.one/spaces/...` ``
   - Expected: Not styled, remains as code

✅ **Navigation works**
   - Test: Click on a message link
   - Expected: Navigates to channel and highlights the specific message

✅ **Renders in all required contexts**
   - Test: View message with link in BookmarksPanel, PinnedMessagesPanel, delete confirmation modal
   - Expected: Styled message link appears (non-interactive in modals)

✅ **Does NOT render in SearchResults**
   - Test: Search for a message containing a message link
   - Expected: Plain URL displayed, not styled

✅ **Multiple links in one message**
   - Test: Paste 3 different message links in one message
   - Expected: All three render correctly

✅ **Link adjacent to text**
   - Test: `Check this https://qm.one/spaces/x/y#msg-z now!`
   - Expected: Link styled, surrounding text normal

✅ **Link in list/blockquote**
   - Test: `- See https://qm.one/spaces/x/y#msg-z`
   - Expected: Link styled within list item

✅ **TypeScript compiles**
   - Run: `cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck"`

✅ **No console errors**
   - Test: Open DevTools, paste and view message links
   - Expected: No errors or warnings

✅ **Dual system works (markdown disabled)**
   - Test: Set `ENABLE_MARKDOWN = false` in `src/config/features.ts`, paste message link
   - Expected: Link still renders as `#channelname › 📄` via fallback token rendering

## Definition of Done

- [ ] Centralized `environmentDomains.ts` utility created
- [ ] `inviteDomain.ts` refactored to use centralized utility (invite links still work)
- [ ] Message link utility created with detection and parsing functions
- [ ] MessageMarkdownRenderer processes and renders message link tokens
- [ ] Message.tsx fallback token rendering handles message-link type (dual system)
- [ ] Word boundary validation prevents extraction in markdown contexts
- [ ] Same-space validation prevents styling cross-space links
- [ ] useMessageFormatting returns message-link token type
- [ ] MessagePreview renders message links correctly
- [ ] Click navigation works with message highlighting
- [ ] CSS class `.message-mentions-message-link` added following existing mention pattern
- [ ] TypeScript passes
- [ ] Manual testing successful across all required contexts
- [ ] Verified: Message links work with `ENABLE_MARKDOWN = false`

## Related Documentation

- [Mention Notification System](../docs/features/mention-notification-system.md) - Channel mention patterns
- [Markdown Renderer](../docs/features/messages/markdown-renderer.md) - Token processing architecture
- [Bookmarks](../docs/features/messages/bookmarks.md) - BookmarksPanel integration

---


*Reviewed: 2025-12-03 by feature-analyzer agent*
