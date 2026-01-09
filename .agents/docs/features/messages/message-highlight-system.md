---
type: doc
title: Message Highlight System
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2025-12-05T00:00:00.000Z
---

# Message Highlight System

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

The message highlighting system provides visual feedback when navigating to specific messages. It uses a **dual-mechanism architecture** that serves different use cases:

1. **URL Hash** (`#msg-{id}`) - Cross-component communication for navigation from panels, search, notifications
2. **Local State** - Self-highlighting for mentions when they enter the viewport

This separation exists because URL hash cannot easily trigger on viewport entry, while local React state cannot communicate across component instances.

## Architecture

### Key Components

| File | Purpose |
|------|---------|
| `src/hooks/business/messages/useMessageHighlight.ts` | Local state hook for self-highlighting |
| `src/components/message/Message.tsx:256-267` | Dual-mechanism detection logic |
| `src/components/message/Message.scss:1-34` | CSS animations for highlight effects |
| `src/hooks/business/messages/useViewportMentionHighlight.ts` | Mention auto-highlight on viewport entry |
| `src/components/message/MessageList.tsx:314-360` | Hash detection and scroll handling |

### How Hash-Based Highlighting Works

URL hash is global browser state that all Message components can detect:

```
window.location.hash = "#msg-abc123"
       ↓
React Router's useLocation() notifies all subscribers
       ↓
Each Message component re-renders
       ↓
Message with id "abc123" checks: location.hash === `#msg-${message.messageId}`
       ↓
Match found → applies .message-highlighted class
```

### How Local State Highlighting Works

Local state only works for **self-highlighting** (a component highlighting itself):

```
Message component renders with mention
       ↓
useViewportMentionHighlight observes viewport entry
       ↓
Calls highlightMessage(messageId) from THIS component's hook instance
       ↓
Updates THIS component's local state
       ↓
Component re-renders with .message-highlighted-mention class
```

### Why Local State Doesn't Work Cross-Component

Each `useMessageHighlight()` call creates isolated state:

```tsx
// PinnedMessagesPanel calls:
const { highlightMessage } = useMessageHighlight();
highlightMessage("msg-123"); // Sets Panel's highlightedMessageId to "msg-123"

// Message component with id "msg-123" has its own state:
const { isHighlighted } = useMessageHighlight();
isHighlighted("msg-123"); // Returns false - checks Message's state, not Panel's
```

This is why panels use hash navigation instead of direct state calls.

## CSS Animations

Two highlight variants exist in `Message.scss`:

| Class | Animation | Duration | Opacity | Use Case |
|-------|-----------|----------|---------|----------|
| `.message-highlighted` | `flash-highlight` | 8s | 20% → 0 | Navigation highlights |
| `.message-highlighted-mention` | `flash-highlight-mention` | 61s | 10% → 0 | Mention auto-highlight |

Both use the `--warning` color (yellow/gold `#e7b04a`). The mention variant is more subtle (10% opacity) and persists longer to ensure users notice it.

## Entry Points

All navigation sources use hash-based highlighting:

| Source | File | Pattern |
|--------|------|---------|
| Reply snippet click | `Message.tsx:436-456` | `navigate(path#msg-{id})` + 8s cleanup |
| Pinned message click | `PinnedMessagesPanel.tsx:155-175` | `navigate(path#msg-{id})` + 8s cleanup |
| Bookmark click | `BookmarksPanel.tsx:110-132` | `navigate(path#msg-{id})` + 8s cleanup |
| Notification click | `NotificationPanel.tsx:110-126` | `navigate(path#msg-{id})` + 8s cleanup |
| Search result click | `useGlobalSearchNavigation.ts:20-44` | `navigate(path#msg-{id})` + 8s cleanup |
| URL hash on load | `MessageList.tsx:314-337` | Hash detection + 8s cleanup |
| Mention viewport entry | `useViewportMentionHighlight.ts` | Local state (no hash) |

## Message Link Formats

- **Space channel**: `/spaces/{spaceId}/{channelId}#msg-{messageId}`
- **Direct message**: `/messages/{dmAddress}#msg-{messageId}`
- **Copy link action**: `useMessageActions.ts:115`

## Hash Cleanup

All navigation sources clean up the hash after 8 seconds (matching CSS animation):

```typescript
setTimeout(() => {
  history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search
  );
}, 8000);
```

This prevents stale hashes from causing re-highlighting on page refresh.

## Detection Logic in Message Component

The Message component checks **both** mechanisms (`Message.tsx:262-267`):

```typescript
const isMessageHighlighted = useMemo(() => {
  // Check BOTH mechanisms - hash for cross-component, state for self-highlighting
  const isUrlTarget = location.hash === `#msg-${message.messageId}`;
  const isStateHighlighted = isHighlighted(message.messageId);
  return isUrlTarget || isStateHighlighted;
}, [message.messageId, location.hash, isHighlighted]);
```

The variant is determined by `getHighlightVariant()` which returns `'mention'` for viewport-triggered highlights.

## Usage Examples

### Navigating to a Message (Cross-Component)

```typescript
// In any panel or navigation component:
const navigate = useNavigate();

const handleJumpToMessage = (messageId: string) => {
  // Navigate with hash - Message component detects and highlights
  navigate(`${currentPath}#msg-${messageId}`);

  // Clean up hash after animation completes
  setTimeout(() => {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }, 8000);
};
```

### Self-Highlighting (Within Message Component)

```typescript
// Only used for mention auto-highlighting:
const { highlightMessage } = useMessageHighlight();

// Called by useViewportMentionHighlight when mention enters viewport
highlightMessage(messageId, { duration: 61000, variant: 'mention' });
```

## Technical Decisions

### Why URL Hash Instead of Global State

- **Simplicity**: No Redux/Context setup needed
- **URL Shareability**: Links with hash can be shared and work on page load
- **Browser Native**: `useLocation()` handles all subscription logic
- **Cross-Route**: Works across route changes without extra wiring

### Why Keep Local State for Mentions

- **Viewport Detection**: Can't set hash for every visible message
- **No URL Pollution**: Mentions don't need shareable URLs
- **Self-Contained**: Message highlights itself, no cross-component communication needed

### Why 8 Second Duration

Matches the CSS `flash-highlight` animation which:
- Holds at 20% opacity for 4 seconds
- Fades out over the next 4 seconds

Cleaning up the hash earlier would cause the highlight to stop mid-animation.

## Known Limitations

1. **Hash Conflict with Delete**: If a message is deleted while its hash is in the URL, the hash persists. See `.agents/bugs/message-hash-navigation-conflict.md`.

2. **Single Active Hash**: Only one message can be hash-highlighted at a time. Clicking a new link replaces the previous hash.

3. **No Highlight on Back Navigation**: Browser back button restores the hash but doesn't re-trigger the animation since CSS animation only plays once per class application.

## Related Documentation

- `.agents/docs/features/messages/hash-navigation-to-old-messages.md` - Loading older messages for hash navigation
- `.agents/docs/features/messages/pinned-messages.md` - Pinned messages panel
- `.agents/docs/features/messages/bookmarks.md` - Bookmarks panel
- `.agents/docs/features/mention-notification-system.md` - Mention detection and notifications
- `.agents/tasks/message-highlight-system-refactor.md` - Refactoring task with implementation details

---


_Verified: 2025-12-09 - File paths confirmed current_
