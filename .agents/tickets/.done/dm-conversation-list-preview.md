---
type: task
title: "Task: Enhanced Direct Message Conversation List"
status: done
created: 2026-01-09
updated: 2026-01-09
---

# Task: Enhanced Direct Message Conversation List

## Overview

Add message previews and timestamps to DM conversation list, similar to Signal/Telegram.

**Status:** Ready for Implementation
**Priority:** Medium
**Complexity:** Medium
**Estimated Effort:** 4-5 hours
**Dependencies:** markdown-stripping-utility.md (optional)

### Security Notice ✅

Privacy protections verified - does NOT expose unknown user identities. Only shows message content already visible to you.

---

## Goal

**Current:**
```
[Avatar] Jennifer
         QmV5...ZF2n
```

**Target:**
```
[Avatar] Jennifer........................3:45 PM
         Hey, did you see the latest update?
```

**Layout:**
- Line 1: Avatar (44px) + Display Name + Timestamp (right-aligned)
- Line 2: Message preview (truncated, plain text)
- Remove truncated address (not useful)

**Date Format:**
- Today: "3:45 PM"
- Yesterday: "Yesterday"
- Older: "11 Nov", "6 Dec"

---

## Implementation

### Architecture: Hybrid Approach

**Store:** `lastMessageId` only (minimal DB change)
**Compute:** Preview on-demand in UI layer
**Cache:** React Query (30 seconds)

**Why:** Maintains separation of concerns, follows existing patterns, always shows current content.

### Files to Modify (7 total)

#### 1. Extend Conversation Type
**File:** `src/api/quorumApi.ts:73`

```typescript
export type Conversation = {
  // ... existing fields
  lastMessageId?: string; // ADD THIS
};
```

#### 2. Track Last Message in DB
**File:** `src/db/messages.ts:649`

```typescript
// In saveMessage(), update conversation:
conversationStore.put({
  ...existingConv,
  // ... existing fields
  lastMessageId: message.messageId, // ADD THIS
});
```

Also add `getMessage(messageId)` method if missing.

#### 3. Import Markdown Stripping Utility
**File:** Import from `.agents\docs\features\messages\markdown-stripping.md` task (or implement inline)

> IMPORTANT: we implemented the Markdown Stripping Utility differently so the below code exmaple could be inaccurate, please check the current utility before proceeding.

```typescript
// If utility available:
import { stripMarkdown, truncateText } from './markdownStripping';

// Otherwise, implement inline (see markdown-stripping-utility.md)
```

#### 4. Create Message Preview Utility
**File:** `src/utils/messagePreview.ts` (NEW)

```typescript
import { Message } from '../api/quorumApi';
import { t } from '@lingui/core/macro';
import { stripMarkdown, truncateText } from './markdownStripping';

/**
 * Generates preview text for conversation lists
 *
 * Only shows actual conversational content (text, images).
 * System messages (edits, profile updates, reactions) return empty string
 * so the conversation falls back to the previous real message.
 */
export function generateMessagePreview(
  message: Message | undefined,
  maxLength = 100
): string {
  if (!message?.content) return '';

  switch (message.content.type) {
    // Actual conversational content - show in preview
    case 'post':
      const text = Array.isArray(message.content.text)
        ? message.content.text.join(' ')
        : message.content.text;
      return truncateText(stripMarkdown(text), maxLength);

    case 'embed':
      if (message.content.imageUrl) return t`📷 Photo`;
      return t`📎 Media`;

    // System/action messages - return empty (will skip to previous message)
    case 'edit-message':       // Message edit action
    case 'update-profile':     // Profile update notification
    case 'reaction':           // Reaction added
    case 'remove-reaction':    // Reaction removed
    case 'pin':                // Pin/unpin action
    case 'join':               // User joined (spaces only)
    case 'leave':              // User left (spaces only)
    case 'kick':               // User kicked (spaces only)
      return '';

    // Special case: Deleted message
    case 'remove-message':
      return t`Message deleted`;

    default:
      return '';
  }
}
```

**Note:** When `lastMessageId` points to a system message (edit, profile update, etc.),
the preview will be empty. This is correct behavior - the conversation list should
show the last *real* message content, not system actions.

#### 5. Add Conversation Time Formatter
**File:** `src/utils/dateFormatting.ts` (append)

```typescript
export const formatConversationTime = (timestamp: number): string => {
  const time = moment.tz(timestamp, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const now = moment();
  const daysDiff = now.diff(time, 'days');

  if (daysDiff === 0) return time.format('h:mm A');
  if (daysDiff === 1) return t`Yesterday`;
  return time.format('D MMM'); // "11 Nov"
};
```

#### 6. Create Conversation Previews Hook
**File:** `src/hooks/business/conversations/useConversationPreviews.ts` (NEW)

```typescript
import { useQuery } from '@tanstack/react-query';
import { Conversation } from '../../../api/quorumApi';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { generateMessagePreview } from '../../../utils/messagePreview';

export function useConversationPreviews(conversations: Conversation[]) {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: ['conversation-previews', conversations.map(c => c.lastMessageId)],
    queryFn: async () => {
      return Promise.all(
        conversations.map(async (conv) => {
          if (!conv.lastMessageId) return { ...conv, preview: '' };

          try {
            const message = await messageDB.getMessage(conv.lastMessageId);
            return { ...conv, preview: generateMessagePreview(message) };
          } catch (error) {
            console.warn('Failed to load preview:', conv.conversationId, error);
            return { ...conv, preview: '' };
          }
        })
      );
    },
    enabled: conversations.length > 0,
    staleTime: 30000,
    gcTime: 60000,
  });
}
```

#### 7. Update DirectMessageContact Component
**File:** `src/components/direct/DirectMessageContact.tsx`

**Add props:**
```typescript
interface Props {
  unread: boolean;
  address: string;
  displayName?: string;
  userIcon?: string;
  lastMessagePreview?: string;  // NEW
  timestamp?: number;            // NEW
}
```

**Update JSX:**
```tsx
<Link to={`/messages/${props.address}`}>
  <div className="relative direct-message-contact flex flex-row rounded-lg hover:bg-sidebar-hover">
    {props.unread && <div className="dm-unread-dot" />}

    <UserAvatar size={44} {...avatarProps} />

    <div className="flex flex-col flex-1 min-w-0 pl-2">
      {/* Line 1: Name + Time */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate flex-1 min-w-0 font-semibold">
          {props.displayName ?? truncateAddress(props.address)}
        </span>
        {props.timestamp && (
          <span className="text-xs text-muted flex-shrink-0">
            {formatConversationTime(props.timestamp)}
          </span>
        )}
      </div>

      {/* Line 2: Preview */}
      {props.lastMessagePreview ? (
        <div className="text-sm text-muted truncate">
          {props.lastMessagePreview}
        </div>
      ) : props.displayName ? (
        <div className="text-xs text-muted truncate">
          {truncateAddress(props.address)}
        </div>
      ) : null}
    </div>
  </div>
</Link>
```

#### 8. Update DirectMessageContactsList
**File:** `src/components/direct/DirectMessageContactsList.tsx`

```typescript
import { useConversationPreviews } from '../../hooks/business/conversations/useConversationPreviews';

const DirectMessageContactsList: React.FC = () => {
  const { conversations } = useConversationPolling();
  const { data: conversationsWithPreviews = conversations } = useConversationPreviews(conversations);

  return (
    // ... existing structure
    {conversationsWithPreviews.map((c) => (
      <DirectMessageContact
        key={'dmc-' + c.address}
        unread={(c.lastReadTimestamp ?? 0) < c.timestamp}
        address={c.address}
        userIcon={c.icon}
        displayName={c.displayName}
        lastMessagePreview={c.preview}  // NEW
        timestamp={c.timestamp}          // NEW
      />
    ))}
  );
};
```

#### 9. Update Styling
**File:** `src/components/direct/DirectMessageContact.scss`

```scss
.direct-message-contact {
  padding: $s-3 $s-2; // Increased for two lines
  margin-bottom: $s-1;
}

// Ensure truncation works
.direct-message-contact-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0; // Critical for flex truncation
}
```

---

## Key Design Decisions

### Layout Considerations

**Avatar Size:** 38px → 44px (better visual balance for two lines)
**Spacing:** Increased vertical padding for readability
**Truncation:** Use `min-w-0` on flex containers (critical for proper ellipsis)

**Edge Cases:**
- Long names: Truncate with ellipsis, timestamp stays fixed-width
- Empty preview: Show truncated address as fallback
- Unknown users: Shows "Unknown User" + placeholder (privacy maintained)

### Markdown Handling

**Strategy:** Strip markdown in previews (limited space)
**Examples:**
- `**Hello** *world*` → `Hello world`
- `Check [link](url)` → `Check link`
- `` `code` `` → `code`

**Confirmation modals keep rendered markdown** (user needs to see exact message)

### Performance

**Write:** +0.01ms per message (add `lastMessageId`)
**Read:** 10-100ms initial (fetch N messages), then cached
**Memory:** ~4 KB for 20 conversations (negligible)
**Optimization:** React Query cache (30s), only fetches visible conversations

---

## Edge Cases

1. **Empty conversations** - Show empty preview
2. **Deleted messages** - `getMessage()` fails gracefully, show empty preview
3. **Message edits** - Invalidate cache on edit (future enhancement)
4. **Unknown users** - Privacy maintained (shows "Unknown User", preview shows YOUR message)
5. **Long text** - Truncated after markdown stripping
6. **Markdown in messages** - Stripped via `stripMarkdown()` utility
7. **Encrypted messages** - Preview generated after decryption (no issue)

---

## Testing Checklist

### Unit Tests
- [ ] `formatConversationTime()` - today, yesterday, older dates
- [ ] Message preview generation for all DM message types
- [ ] Markdown stripping (if implemented inline)

### Integration Tests
- [ ] Two-line layout renders correctly on desktop
- [ ] Mobile sidebar (<1024px) works with new layout
- [ ] Unread indicators appear correctly
- [ ] Timestamp right-aligned, doesn't wrap
- [ ] Preview truncates long messages
- [ ] Empty conversations show fallback
- [ ] Unknown users maintain privacy

### Visual Tests
- [ ] Avatar size looks balanced
- [ ] Spacing between conversations adequate
- [ ] Long display names truncate properly (no overlap with timestamp)
- [ ] Preview text doesn't overlap with content below

---

## Cache Invalidation

Invalidate `['conversation-previews']` when:
1. New message arrives
2. Message edited (future)
3. Message deleted (future)

Add to `src/hooks/queries/conversation/useInvalidateConversation.ts`:
```typescript
queryClient.invalidateQueries({ queryKey: ['conversation-previews'] });
```

---

## i18n Requirements

Add to `src/i18n/en/messages.po`:
```
msgid "📷 Photo"
msgstr "📷 Photo"

msgid "Yesterday"
msgstr "Yesterday"

msgid "Edited a message"
msgstr "Edited a message"

msgid "Deleted a message"
msgstr "Deleted a message"
```

---

## Security: Unknown Users

**Verified Safe:**
- Only reads existing `Conversation.displayName` (already "Unknown User" for unknown contacts)
- Preview shows message content (already visible to you)
- Does NOT query profile data
- Does NOT attempt to resolve identities

**Example:**
```
Before: [?] Unknown User
        QmABC...123

After:  [?] Unknown User................3:45 PM
        Hello  ← Your message to them
```

---

## Rollout Phases

**Phase 1: Core (3-4h)**
1. Add `lastMessageId` to Conversation type
2. Update `saveMessage()` to track last message
3. Create message preview utility
4. Create conversation previews hook
5. Add time formatter

**Phase 2: UI (1-2h)**
6. Update DirectMessageContact layout
7. Update DirectMessageContactsList to use hook
8. Adjust styling

**Phase 3: Polish (optional)**
9. Add cache invalidation
10. Add i18n labels
11. Testing

---

## Success Criteria

- [ ] Conversation list shows two-line layout
- [ ] Message previews display for all DM types
- [ ] Timestamps in compact format (3:45 PM, Yesterday, 11 Nov)
- [ ] Performance < 100ms render time
- [ ] Mobile layout works correctly
- [ ] Unknown user privacy maintained
- [ ] No regressions in existing functionality

---

## Future Enhancements

- Sender name in group DMs: "Alice: Hey there"
- Typing indicators
- Draft message preview
- Pin conversations
- Archive conversations

---

**Created:** 2025-01-13
**Updated:** 2025-01-13
**References:**
- markdown-stripping-utility.md (provides stripMarkdown)
- useConversationPolling.ts (existing 2s polling)
- Conversation type (src/api/quorumApi.ts:73)
