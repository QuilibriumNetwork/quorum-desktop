---
type: task
title: "Implement Threaded Conversations for Space Channels"
status: done
complexity: medium
ai_generated: true
created: 2026-03-09
updated: 2026-03-09
related_docs:
  - "docs/features/messages/pinned-messages.md"
  - "docs/features/mention-notification-system.md"
related_tasks:
  - "tasks/.done/pinned-messages-feature.md"
  - "tasks/.done/reply-notification-system.md"
---

# Implement Threaded Conversations for Space Channels

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Expert Panel Review**: Revised after architecture/implementation/pragmatism review (5.3/10 → revised).

**Files** (modified/created):
- `src/api/quorumApi.ts` — ThreadMeta, ThreadMessage types, thread fields on Message
- `src/db/messages.ts` — DB_VERSION 9, `by_thread` index, getThreadMessages/getThreadStats queries
- `src/services/MessageService.ts` — thread creation handler, thread reply support in submitChannelMessage, incoming thread processing, soft-delete for root messages
- `src/components/thread/ThreadPanel.tsx` — Full right sidebar using MessageList + MessageComposer (Discord-style)
- `src/components/thread/ThreadPanel.scss` — Sidebar layout (400px width, border-left, flex column)
- `src/components/thread/ThreadIndicator.tsx` — Inline indicator on root messages showing reply count
- `src/components/thread/ThreadIndicator.scss`
- `src/components/message/MessageActions.tsx` — Thread button (right after Reply icon)
- `src/components/message/MessageActionsMenu.tsx` — "Start Thread" / "View Thread" in right-click context menu
- `src/components/message/MessageList.tsx` — Added `alignToTop` prop for thread panel (disables alignToBottom, initialTopMostItemIndex=0)
- `src/components/message/Message.tsx` — ThreadIndicator rendering, thread props to MessageActions/MessageActionsMenu
- `src/components/space/Channel.tsx` — ActivePanel 'thread', thread state, handleOpenThread, handleSubmitThreadMessage/Sticker, useThreadMessages hook, ThreadPanel sidebar integration
- `src/hooks/business/threads/useThreadMessages.ts` — useThreadMessages and useThreadStats React Query hooks
- `src/hooks/business/threads/index.ts`

## What & Why

Quorum currently has a basic reply system (`replyMetadata` on messages) but no threaded conversations. Users in busy space channels need a way to branch side-conversations off individual messages without cluttering the main feed.

This task implements flat threads: any message in a space channel can become a thread root, spawning a separate linear conversation in a side panel. Thread replies are hidden from the main channel feed and only appear inside the thread panel, keeping the main feed clean and focused.

**Scope**: Space channels only. No DM threading. No thread notifications (separate follow-up).

## Context

- **Existing pattern**: Pinned messages feature (`tasks/.done/pinned-messages-feature.md`) — uses broadcast → validate → store → UI update flow with `PinMessage` content type. Thread creation follows the same pattern.
- **Existing pattern**: `Channel.tsx:106` — unified `ActivePanel` state (`'pinned' | 'notifications' | 'bookmarks' | 'search' | 'thread' | null`). Only one panel open at a time.
- **UI pattern**: Thread sidebar is a full right-side panel (Discord-style), not a DropdownPanel. Uses the same `MessageList` and `MessageComposer` as the main chat for consistent UX.
- **Constraints**: All thread data must be E2E encrypted via Triple Ratchet. Must work offline via action queue.
- **Dependencies**: No external dependencies. Uses existing encryption, sync, and broadcast infrastructure.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Threading model | Flat (replies to root only) | Simple data model, linear conversation. |
| Data approach | Tagged messages with `threadId` field | Simpler than sub-channels. Existing sync/encryption works unchanged. |
| Thread ID generation | Deterministic: `SHA-256(targetMessageId + ':thread')` | Prevents race condition when two users create a thread on the same message simultaneously — both produce the same ID. |
| Thread metadata | Minimal `threadMeta` on root message, reply stats derived client-side | Avoids metadata broadcast storm on every reply. `replyCount`/`lastReplyAt`/`lastReplyBy` computed from `by_thread` index. |
| Main feed filtering | Client-side filter in `getMessages()` cursor iteration | Modifying `by_conversation_time` compound index would break all existing queries. Client-side skip during cursor iteration is efficient since thread replies are a small fraction of messages. |
| UI | Full right sidebar (Discord-style) | Initially planned as `DropdownPanel`, but upgraded to a full sidebar for more space. Uses real `MessageList` + `MessageComposer` components for identical UX to main chat. |
| Panel state | Extend existing `ActivePanel` union in `Channel.tsx` | Channel already manages unified panel state. No separate context needed — avoids unnecessary abstraction. |
| Discovery | Inline `ThreadIndicator` on root messages + hover actions + context menu | Thread button in MessageActions (right after Reply), also in right-click MessageActionsMenu. ThreadIndicator on root messages shows reply count. |
| Thread composer | Reuse `MessageComposer` via `useMessageComposer` hook | Full-featured composer with mentions, file uploads, stickers, signing toggle — identical to main chat. |
| Thread replies | Reuse `submitChannelMessage` with optional `threadId` | No separate `sendThreadReply` method needed. |
| Thread messages | Reuse `MessageList` with `alignToTop` prop | Same Message components, hover states, avatars, reactions, actions as main chat. Messages align to top (not bottom like main chat). |
| Thread header | Discord-style: title + "Started by" | Title derived from first ~50 chars of root message text (truncated at word boundary). Subtitle shows "Started by **Username**". Close button on right. |
| Who can create | Anyone who can post in the channel | Simple. Permission gating (`thread:create`) deferred. |
| Thread replies in main feed | Hidden — only indicator on root message | Clean main feed. Thread conversation stays contained. |
| Root message deletion | Soft-delete: root message shows "[deleted]" placeholder, thread remains accessible | Prevents orphaned thread replies with no UI access. |

## Prerequisites

- [x] Review `.agents` documentation: INDEX.md, AGENTS.md for context
- [x] Review pinned messages implementation as primary pattern reference
- [x] Review existing `PinnedMessagesPanel.tsx` for side panel UI patterns
- [x] Review `Channel.tsx` `ActivePanel` state management pattern
- [x] Review `DropdownPanel.tsx` for desktop/mobile panel rendering
- [x] Review `MessageService.ts` pin message flow (saveMessage, addMessage, submitChannelMessage)
- [x] Review `messages.ts` DB schema (currently v8) and `getMessages()` query pattern

## Implementation Plan

> **For Claude:** Use superpowers:executing-plans to implement this plan task-by-task.

### Dependency Chain

```
Task 1 (Types)
  ↓
Task 2 (DB Schema) ──────── Task 10 (MessageActions) [independent]
  ↓
Task 3 (DB Queries)
  ↓
Task 4 (Service: Create/Send) ── Task 5 (Service: Incoming) ── Task 6 (Main Feed Filter)
  ↓
Task 7 (Hooks)  ── Task 12 (Soft Delete)
  ↓
Task 8 (ThreadIndicator) ── Task 9 (ThreadPanel)
  ↓
Task 11 (Layout Integration) ← Tasks 4, 8, 9, 10
  ↓
Task 13 (Verification)
```

**Parallelizable waves:**
- Wave 1: Task 1
- Wave 2: Tasks 2, 10
- Wave 3: Tasks 3, 4, 5, 6
- Wave 4: Tasks 7, 12
- Wave 5: Tasks 8, 9
- Wave 6: Task 11
- Wave 7: Task 13

---

### Task 1: Add Thread Types to Message Model

- [x] **Add types and fields** (`src/api/quorumApi.ts`)

**Files:**
- Modify: `src/api/quorumApi.ts:104` (Message type)
- Modify: `src/api/quorumApi.ts:237` (content union, new ThreadMessage type)

**Steps:**

1. After the `Message` type definition (around line 149), add `ThreadMeta`:

```typescript
export type ThreadMeta = {
  threadId: string;     // deterministic: SHA-256(targetMessageId + ':thread')
  createdBy: string;    // address of thread creator
};
```

2. Add three fields to the `Message` type (after `sendError?`):

```typescript
  threadMeta?: ThreadMeta;      // Set on root messages that have a thread
  threadId?: string;            // Set on thread reply messages
  isThreadReply?: boolean;      // Sentinel for filtering (false = main feed, true = thread reply)
```

3. After `PinMessage` (line ~242), add `ThreadMessage`:

```typescript
export type ThreadMessage = {
  senderId: string;
  type: 'thread';
  targetMessageId: string;
  action: 'create';
  threadMeta: ThreadMeta;
};
```

4. Add `ThreadMessage` to the `content` union in `Message` (line ~113-128):

```typescript
    | EditMessage
    | ThreadMessage;  // add at end
```

5. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
6. Commit: `feat: add ThreadMeta, ThreadMessage types and thread fields to Message`

---

### Task 2: Database Schema — Thread Index

- [x] **Add `by_thread` index** (`src/db/messages.ts`)

**Files:**
- Modify: `src/db/messages.ts:144` (DB_VERSION 8 → 9)
- Modify: `src/db/messages.ts:262` (add version block)

**Steps:**

1. Change `DB_VERSION` from `8` to `9` at line 144.

2. Add after the `event.oldVersion < 8` block (after line 267):

```typescript
        if (event.oldVersion < 9) {
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const messageStore = transaction.objectStore('messages');
            messageStore.createIndex('by_thread', [
              'spaceId',
              'channelId',
              'threadId',
              'createdDate',
            ]);
          }
        }
```

3. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
4. Commit: `feat: add by_thread IndexedDB index for thread message queries`

**Note on main feed filtering:** The original spec suggests modifying `by_conversation_time` to include `isThreadReply`. This would break all existing queries since IndexedDB compound indexes are positional. Instead, thread replies will be filtered client-side during cursor iteration in `getMessages()` (Task 6). This is efficient because thread replies are a small fraction of total messages.

---

### Task 3: Database Queries — `getThreadMessages` & `getThreadStats`

- [x] **Add thread query methods** (`src/db/messages.ts`)

**Files:**
- Modify: `src/db/messages.ts` (add methods to `MessageDB` class, after `getMessages` at line ~459)

**Steps:**

1. Add `getThreadMessages` — returns all messages in a thread with derived stats:

```typescript
  async getThreadMessages({
    spaceId,
    channelId,
    threadId,
  }: {
    spaceId: string;
    channelId: string;
    threadId: string;
  }): Promise<{
    messages: Message[];
    replyCount: number;
    lastReplyAt: number | null;
    lastReplyBy: string | null;
  }> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_thread');

      const range = IDBKeyRange.bound(
        [spaceId, channelId, threadId, 0],
        [spaceId, channelId, threadId, Number.MAX_VALUE]
      );

      const request = index.openCursor(range, 'next');
      const messages: Message[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          messages.push(cursor.value);
          cursor.continue();
        } else {
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
          resolve({
            messages,
            replyCount: messages.length,
            lastReplyAt: lastMessage?.createdDate ?? null,
            lastReplyBy: lastMessage?.content?.senderId ?? null,
          });
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
```

2. Add `getThreadStats` — lightweight count + last reply info for ThreadIndicator:

```typescript
  async getThreadStats({
    spaceId,
    channelId,
    threadId,
  }: {
    spaceId: string;
    channelId: string;
    threadId: string;
  }): Promise<{
    replyCount: number;
    lastReplyAt: number | null;
    lastReplyBy: string | null;
  }> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_thread');

      const range = IDBKeyRange.bound(
        [spaceId, channelId, threadId, 0],
        [spaceId, channelId, threadId, Number.MAX_VALUE]
      );

      const countRequest = index.count(range);

      countRequest.onsuccess = () => {
        const count = countRequest.result;
        if (count === 0) {
          resolve({ replyCount: 0, lastReplyAt: null, lastReplyBy: null });
          return;
        }

        const cursorRequest = index.openCursor(range, 'prev');
        cursorRequest.onsuccess = () => {
          const cursor = (cursorRequest as IDBRequest).result;
          if (cursor) {
            const msg = cursor.value as Message;
            resolve({
              replyCount: count,
              lastReplyAt: msg.createdDate,
              lastReplyBy: msg.content?.senderId ?? null,
            });
          } else {
            resolve({ replyCount: count, lastReplyAt: null, lastReplyBy: null });
          }
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
      };
      countRequest.onerror = () => reject(countRequest.error);
    });
  }
```

3. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
4. Commit: `feat: add getThreadMessages and getThreadStats queries to MessageDB`

---

### Task 4: Service Layer — Thread Creation & Thread Reply Sending

- [x] **Add `createThread` and `threadId` support to `submitChannelMessage`** (`src/services/MessageService.ts`)

**Files:**
- Modify: `src/services/MessageService.ts` (imports, `submitChannelMessage`, new `createThread` method, thread handler in `enqueueOutbound`)

**Steps:**

1. Add `ThreadMessage`, `ThreadMeta` to the import from `../../api/quorumApi` (line ~17).

2. Add `threadId?: string` parameter to `submitChannelMessage` (line 3949, after `parentMessage?`).

3. In the post message section (~line 4052-4084), when building the message object, spread thread fields:

```typescript
        // Thread fields
        ...(threadId ? { threadId, isThreadReply: true } : {}),
```

4. Add thread message detection to the type checks (~line 3967-3981):

```typescript
    const isThreadMessage =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'thread';
```

Update `isPostMessage`:

```typescript
    const isPostMessage =
      typeof pendingMessage === 'string' ||
      (!isEditMessage && !isPinMessage && !isUpdateProfileMessage && !isThreadMessage);
```

5. After the pin message handler in `enqueueOutbound` (~line 4343), add thread message handler:

```typescript
      // Handle thread-message type
      if (
        typeof pendingMessage === 'object' &&
        (pendingMessage as any).type === 'thread'
      ) {
        const threadMsg = pendingMessage as ThreadMessage;

        if (spaceId === channelId) return outbounds; // Reject DMs

        const targetMessage = await this.messageDB.getMessage({
          spaceId, channelId, messageId: threadMsg.targetMessageId,
        });
        if (!targetMessage) return outbounds;

        // Idempotent — deterministic ID means duplicate creates are no-ops
        if (targetMessage.threadMeta?.threadId === threadMsg.threadMeta.threadId) {
          return outbounds;
        }

        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            nonce + 'thread' + currentPasskeyInfo.address + canonicalize(threadMsg),
            'utf-8'
          )
        );

        const message = {
          spaceId, channelId,
          messageId: Buffer.from(messageId).toString('hex'),
          digestAlgorithm: 'SHA-256',
          nonce,
          createdDate: Date.now(),
          modifiedDate: Date.now(),
          lastModifiedHash: '',
          content: { ...threadMsg, senderId: currentPasskeyInfo.address } as ThreadMessage,
        } as Message;

        // Sign (same pattern as pin messages)
        if (!space?.isRepudiable || (space?.isRepudiable && !skipSigning)) {
          const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
          message.publicKey = inboxKey.publicKey;
          message.signature = Buffer.from(
            JSON.parse(
              ch.js_sign_ed448(
                Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
                Buffer.from(messageId).toString('base64')
              )
            ),
            'base64'
          ).toString('hex');
        }

        outbounds.push(await this.encryptAndSendToSpace(spaceId, message));

        // Update root message with threadMeta
        const updatedTarget: Message = { ...targetMessage, threadMeta: threadMsg.threadMeta };
        await this.saveMessage(updatedTarget, 0, spaceId, 'group', '', '', currentPasskeyInfo.address);

        // Update React Query cache
        queryClient.setQueryData(
          buildMessagesKey({ spaceId, channelId }),
          (oldData: InfiniteData<any>) => {
            if (!oldData?.pages) return oldData;
            return {
              pageParams: oldData.pageParams,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                messages: page.messages.map((m: Message) =>
                  m.messageId === threadMsg.targetMessageId
                    ? { ...m, threadMeta: threadMsg.threadMeta }
                    : m
                ),
              })),
            };
          }
        );

        return outbounds;
      }
```

6. Add `createThread` convenience method (after `submitChannelMessage`):

```typescript
  async createThread(
    spaceId: string,
    channelId: string,
    targetMessageId: string,
    queryClient: QueryClient,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
    },
    skipSigning?: boolean,
    isSpaceOwner?: boolean
  ) {
    if (spaceId === channelId) return; // Reject DMs

    const threadIdBuffer = await crypto.subtle.digest(
      'SHA-256',
      Buffer.from(targetMessageId + ':thread', 'utf-8')
    );
    const threadId = Buffer.from(threadIdBuffer).toString('hex');

    const threadMeta: ThreadMeta = { threadId, createdBy: currentPasskeyInfo.address };
    const threadMessage: ThreadMessage = {
      type: 'thread',
      senderId: currentPasskeyInfo.address,
      targetMessageId,
      action: 'create',
      threadMeta,
    };

    await this.submitChannelMessage(
      spaceId, channelId, threadMessage, queryClient,
      currentPasskeyInfo, undefined, skipSigning, isSpaceOwner
    );

    return { threadId, threadMeta };
  }
```

7. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
8. Commit: `feat: add createThread method and threadId support to submitChannelMessage`

---

### Task 5: Incoming Message Processing — Handle ThreadMessage & Thread Replies

- [x] **Handle incoming `ThreadMessage` and thread reply storage** (`src/services/MessageService.ts`)

**Files:**
- Modify: `src/services/MessageService.ts` — `saveMessage` (~line 699) and `addMessage` (~line 1144)

**Steps:**

1. In `saveMessage`, after the pin handler block (~line 775), add thread handler:

```typescript
    } else if (decryptedContent.content.type === 'thread') {
      const threadMsg = decryptedContent.content as ThreadMessage;
      if (spaceId === channelId) return; // Reject DMs

      const targetMessage = await messageDB.getMessage({
        spaceId, channelId, messageId: threadMsg.targetMessageId,
      });
      if (!targetMessage) return; // Root not found

      // Idempotent
      if (targetMessage.threadMeta?.threadId === threadMsg.threadMeta.threadId) return;

      const updatedMessage: Message = { ...targetMessage, threadMeta: threadMsg.threadMeta };
      await messageDB.saveMessage(
        updatedMessage, 0, spaceId, conversationType,
        updatedUserProfile?.user_icon || '', updatedUserProfile?.display_name || '',
        currentUserAddress
      );
```

2. In `addMessage`, after the pin cache handler (~line 1240), add thread cache handler:

```typescript
    } else if (decryptedContent.content.type === 'thread') {
      const threadMsg = decryptedContent.content as ThreadMessage;
      if (spaceId === channelId) return;

      queryClient.setQueryData(
        buildMessagesKey({ spaceId, channelId }),
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;
          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((m: Message) =>
                m.messageId === threadMsg.targetMessageId
                  ? { ...m, threadMeta: threadMsg.threadMeta }
                  : m
              ),
            })),
          };
        }
      );
```

3. Ensure incoming thread replies get `isThreadReply = true`. In the general message storage path, before the message is saved to IndexedDB:

```typescript
      if (decryptedContent.threadId && !decryptedContent.isThreadReply) {
        decryptedContent.isThreadReply = true;
      }
```

4. When adding a post message to React Query cache in `addMessage`, guard against thread replies entering main feed:

```typescript
      if (message.isThreadReply) {
        queryClient.invalidateQueries({
          queryKey: ['thread-messages', spaceId, channelId, message.threadId],
        });
        return;
      }
```

5. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
6. Commit: `feat: handle incoming ThreadMessage and thread reply filtering in message processing`

---

### Task 6: Main Feed Filtering — Exclude Thread Replies from `getMessages`

- [x] **Filter thread replies during cursor iteration** (`src/db/messages.ts:367`)

**Files:**
- Modify: `src/db/messages.ts` — `getMessages` method (line ~422)

**Steps:**

1. In the cursor success handler (~line 422-428), skip thread replies:

```typescript
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && messages.length < limit) {
          if (cursor.value.isThreadReply) {
            cursor.continue();
            return;
          }
          messages.push(cursor.value);
          cursor.continue();
        } else {
```

2. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
3. Commit: `feat: filter thread replies from main channel feed in getMessages`

---

### Task 7: React Hook — `useThreadMessages`

- [x] **Create thread hooks** (`src/hooks/business/threads/`)

**Files:**
- Create: `src/hooks/business/threads/useThreadMessages.ts`
- Create: `src/hooks/business/threads/index.ts`

**Steps:**

1. Create `src/hooks/business/threads/useThreadMessages.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';

export function useThreadMessages({
  spaceId, channelId, threadId, enabled = true,
}: {
  spaceId: string;
  channelId: string;
  threadId: string | null;
  enabled?: boolean;
}) {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: ['thread-messages', spaceId, channelId, threadId],
    queryFn: async () => {
      if (!threadId) return { messages: [], replyCount: 0, lastReplyAt: null, lastReplyBy: null };
      return messageDB.getThreadMessages({ spaceId, channelId, threadId });
    },
    enabled: enabled && !!threadId,
    networkMode: 'always',
    staleTime: 30 * 1000,
  });
}

export function useThreadStats({
  spaceId, channelId, threadId, enabled = true,
}: {
  spaceId: string;
  channelId: string;
  threadId: string | null;
  enabled?: boolean;
}) {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: ['thread-stats', spaceId, channelId, threadId],
    queryFn: async () => {
      if (!threadId) return { replyCount: 0, lastReplyAt: null, lastReplyBy: null };
      return messageDB.getThreadStats({ spaceId, channelId, threadId });
    },
    enabled: enabled && !!threadId,
    networkMode: 'always',
    staleTime: 30 * 1000,
  });
}
```

2. Create `src/hooks/business/threads/index.ts`:

```typescript
export { useThreadMessages, useThreadStats } from './useThreadMessages';
```

3. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
4. Commit: `feat: add useThreadMessages and useThreadStats React Query hooks`

---

### Task 8: ThreadIndicator Component

- [x] **Create ThreadIndicator** (`src/components/thread/`)

**Files:**
- Create: `src/components/thread/ThreadIndicator.tsx`
- Create: `src/components/thread/ThreadIndicator.scss`

**Steps:**

1. Create `src/components/thread/ThreadIndicator.tsx`:

Uses `Button` primitive (project convention: always use primitives for interactive elements).

```typescript
import React from 'react';
import { Button, Icon } from '../primitives';
import { useThreadStats } from '../../hooks/business/threads';
import { formatMessageDate } from '../../utils';
import { t } from '@lingui/core/macro';
import './ThreadIndicator.scss';

interface ThreadIndicatorProps {
  spaceId: string;
  channelId: string;
  threadId: string;
  onClick: () => void;
}

export const ThreadIndicator: React.FC<ThreadIndicatorProps> = ({
  spaceId, channelId, threadId, onClick,
}) => {
  const { data: stats } = useThreadStats({ spaceId, channelId, threadId });
  const replyCount = stats?.replyCount ?? 0;

  return (
    <Button
      className="thread-indicator"
      onClick={onClick}
      variant="ghost"
    >
      <Icon name="comments" className="thread-indicator__icon" />
      <span className="thread-indicator__count">
        {replyCount === 0
          ? t`View Thread`
          : replyCount === 1
            ? t`1 reply`
            : t`${replyCount} replies`}
      </span>
      {stats?.lastReplyAt && (
        <span className="thread-indicator__time">
          {formatMessageDate(stats.lastReplyAt, true)}
        </span>
      )}
    </Button>
  );
};
```

2. Create `src/components/thread/ThreadIndicator.scss`:

```scss
@use '../../styles/variables' as *;

.thread-indicator {
  display: inline-flex;
  align-items: center;
  gap: $s-2;
  padding: $s-1 $s-3;
  margin-top: $s-1;
  border: none;
  border-radius: $rounded-md;
  background: transparent;
  color: var(--text-link);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: background-color $duration-150 $ease-out;

  &:hover {
    background: var(--surface-2);
  }

  &__icon {
    font-size: 0.75rem;
    color: var(--text-link);
  }

  &__count {
    font-weight: 600;
  }

  &__time {
    color: var(--text-subtle);
    font-weight: 400;
  }
}
```

3. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
4. Commit: `feat: add ThreadIndicator component for thread discovery on root messages`

---

### Task 9: ThreadPanel Component (Revised — Full Sidebar)

- [x] **Create ThreadPanel as Discord-style right sidebar** (`src/components/thread/`)

**Files:**
- Create: `src/components/thread/ThreadPanel.tsx`
- Create: `src/components/thread/ThreadPanel.scss`

**What was built:**

ThreadPanel is a full-height right sidebar (400px wide, max 50vw) — NOT a DropdownPanel. It reuses the real `MessageList` and `MessageComposer` components for identical UX to the main chat area.

**Layout:**
1. **Header**: Discord-style — thread title (first ~50 chars of root message, truncated at word boundary) + "Started by **Username**" + close (X) button
2. **Messages**: `MessageList` with `alignToTop={true}` — full message rendering with avatars, hover states, reactions, context menus, same as main chat
3. **Composer**: Full `MessageComposer` via `useMessageComposer` hook — mentions, file uploads, stickers, signing toggle

**Key props:** Receives all channel data from Channel.tsx (members, roles, stickers, customEmoji, mapSenderToUser, canDeleteMessages, canPinMessages, etc.) plus `threadMessages` and `isLoadingThread` (from `useThreadMessages` called in Channel.tsx).

**SCSS:** Uses SCSS variables (`$text-xl`, `$text-xs`, `$text-sm`) not CSS custom properties. `h2#{&}__title` selector for specificity over global h2 reset.

---

### Task 10: Add "Start Thread" to MessageActions & MessageActionsMenu

- [x] **Add thread button to hover toolbar and right-click context menu**

**Files:**
- Modify: `src/components/message/MessageActions.tsx` — hover toolbar
- Modify: `src/components/message/MessageActionsMenu.tsx` — right-click context menu
- Modify: `src/components/message/Message.tsx` — pass thread props to both

**What was built:**

1. **MessageActions (hover toolbar)**: Thread button placed **right after Reply** (not after Bookmark as originally planned). Uses `<Icon name="messages">` icon. Shows "Start Thread" or "View Thread" tooltip based on `hasThread` prop.

2. **MessageActionsMenu (right-click context menu)**: Added `hasThread`/`onStartThread` props. "Start Thread" / "View Thread" menu item right after Reply, with `handleStartThread` handler that calls `onStartThread` and closes menu.

3. **Message.tsx**: Passes `hasThread={!!message.threadMeta}` and `onStartThread={onStartThread}` to both MessageActions and MessageActionsMenu.

---

### Task 11: Layout Integration — Wire Everything into Channel.tsx

- [x] **Integrate ThreadPanel as sidebar, ThreadIndicator, and thread actions into Channel.tsx**

**Files:**
- Modify: `src/components/space/Channel.tsx` (ActivePanel, state, handlers, JSX layout)
- Modify: `src/components/message/Message.tsx` (thread props, ThreadIndicator)
- Modify: `src/components/message/MessageList.tsx` (pass through thread props, `alignToTop` prop)

**What was built:**

1. `ActivePanel` union extended with `'thread'`.

2. Thread state: `activeThreadId`, `activeThreadRootMessage`, plus `useThreadMessages` hook called in Channel (data passed down to ThreadPanel, not fetched inside ThreadPanel).

3. `handleOpenThread` callback — checks for existing `threadMeta`, creates thread with deterministic SHA-256 ID if needed, sets state and opens panel.

4. `handleSubmitThreadMessage` — matches `useMessageComposer`'s `onSubmitMessage` signature (`string | object` + optional `inReplyTo`). Fetches parent message for reply notifications. Passes `activeThreadId` to `submitChannelMessage`.

5. `handleSubmitThreadSticker` — separate handler for sticker submission in threads.

6. **Layout**: ThreadPanel rendered as a **sibling column** in the flex layout (between messages+composer and users sidebar). NOT inside the messages column. The main chat area shrinks to accommodate it.

```
<div class="flex flex-1 relative">
  <div class="flex flex-col flex-1">  ← messages + composer
  <ThreadPanel ... />                  ← thread sidebar (400px)
  <div class="channel-users-sidebar">  ← users sidebar (260px, optional)
</div>
```

7. ThreadPanel receives all channel data: members, roles, stickers, customEmoji, permissions, mentions, signing config, etc.

8. `MessageList` gained `alignToTop` prop — when true, sets `alignToBottom={false}` and `initialTopMostItemIndex={0}` on Virtuoso. Used by ThreadPanel to show messages from top.

---

### Task 12: Root Message Deletion — Soft Delete Behavior

- [x] **Preserve threadMeta on deletion** (`src/services/MessageService.ts`)

**Files:**
- Modify: `src/services/MessageService.ts` — remove-message handler in `saveMessage` and `addMessage`

**Steps:**

1. In the remove-message handler, before deleting a message, check if it has `threadMeta`. If so, soft-delete instead:

```typescript
      if (targetMessage.threadMeta) {
        const softDeleted: Message = {
          ...targetMessage,
          content: {
            type: 'post',
            senderId: targetMessage.content.senderId,
            text: '',
          } as PostMessage,
          threadMeta: targetMessage.threadMeta,
        };
        // Save soft-deleted version instead of removing
        await messageDB.saveMessage(softDeleted, /* same params */);
        return;
      }
```

2. Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
3. Commit: `feat: soft-delete root messages that have threads to preserve thread access`

---

### Task 13: Final Verification

- [x] **Full verification pass**

**Steps:**

1. `npx tsc --noEmit --jsx react-jsx --skipLibCheck` — no new errors
2. `yarn lint` — passes
3. `yarn build` — builds successfully
4. Manual checklist:
   - [ ] Thread types compile
   - [ ] DB migration v8 → v9 adds `by_thread` index
   - [ ] `getThreadMessages` / `getThreadStats` work
   - [ ] `createThread` generates deterministic threadId and broadcasts
   - [ ] Thread replies sent via `submitChannelMessage` with `threadId`
   - [ ] Thread replies filtered from main feed
   - [ ] Incoming `ThreadMessage` sets `threadMeta` on root
   - [ ] ThreadIndicator renders on root messages with threads
   - [ ] ThreadPanel opens, shows messages, accepts replies
   - [ ] "Start Thread" / "View Thread" in MessageActions
   - [ ] Root message deletion preserves thread access
5. Commit: `chore: verify threaded conversations implementation compiles and builds`

---

## Verification

✅ **Thread creation works end-to-end**
   - Test: Create thread → see indicator on root message → open thread panel → send reply → reply appears

✅ **Thread replies hidden from main feed**
   - Test: Send thread reply → verify it does NOT appear in channel message list

✅ **Cross-user thread sync**
   - Test: User A creates thread → User B sees thread indicator → User B opens thread and replies → User A sees the reply

✅ **Responsive layout**
   - Test: Thread sidebar renders as full right-side panel (400px, border-left) alongside main chat

✅ **Root message deletion**
   - Test: Delete root message → thread still accessible → root shows "[deleted message]"

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✅ **No regressions**
   - Test: Regular (non-threaded) messages still display and work correctly
   - Test: Pinned messages, reactions, bookmarks unaffected
   - Test: Reply notifications still work for non-threaded replies

## Definition of Done

- [ ] All tasks complete
- [ ] TypeScript passes
- [ ] Thread creation, reply, and display work end-to-end
- [ ] Thread sidebar renders correctly as full right-side panel
- [ ] Sync works across devices
- [ ] No regressions in existing features
- [ ] No console errors
- [ ] Related docs updated

## Future Work (Not in This Task)

- **Thread notifications**: Participation tracking, auto-follow, unread indicators per-thread. Store thread follows in separate IndexedDB store (NOT UserConfig — unbounded growth concern). Separate task.
- **ThreadsList & channel header button**: Browsable list of all threads in a channel. Separate task after v1 validates the feature.
- **Migrate thread types to `quorum-shared`**: Move types/hooks to shared package for cross-platform compatibility.
- **Auto-archive**: Add `isArchived` and `autoArchiveDuration` to ThreadMeta when building archive feature.
- **Close/delete threads**: Author and moderators can close threads (read-only) or delete them.
- **Permission gating**: Add `thread:create` permission to role system for per-role thread creation control.
- **"Also send to channel"**: Option to post a thread reply to the main feed (Slack-style).
- **Thread search**: Include thread replies in global search results.
- **DM threading**: Extend threads to direct message conversations.
- **Thread titles**: Optional user-set titles on threads (low value — root message provides context).
- **Extract ThreadService**: If MessageService grows further, extract thread handling to dedicated service class.

---

_Created: 2026-03-09_
_Updated: 2026-03-09 (Detailed implementation plan with exact code, file paths, and dependency chain)_
