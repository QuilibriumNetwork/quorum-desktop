# Thread Management: Close, Auto-Close, and Remove — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add close/reopen, auto-close, and remove capabilities to the thread system, managed via a new Thread Settings Modal accessed from a cog icon in the ThreadPanel header.

**Architecture:** New actions (`close`, `reopen`, `updateSettings`, `remove`) extend the existing `ThreadMessage` type and flow through the same `submitChannelMessage` path already used by `create` and `updateTitle`. The receive side (`saveMessage` + `addMessage` in `MessageService.ts`) handles each action with client-enforced auth checks mirroring the existing mute/updateTitle pattern. A new `ThreadSettingsModal` follows the `ConversationSettingsModal` structure and is registered in `ModalProvider`.

**Tech Stack:** React, TypeScript, IndexedDB (via `messageDB`), React Query, `submitChannelMessage`, `useModals()` / `useModalState`, `ThreadContext` ref-based store pattern.

---

## Chunk 1: Data Model & Types

### Task 1: Extend `ThreadMeta` and `ThreadMessage` types

**Files:**
- Modify: `src/api/quorumApi.ts` (lines ~155-160 for ThreadMeta, ~254-260 for ThreadMessage)

- [ ] **Step 1: Read the current type definitions**

Open `src/api/quorumApi.ts` and locate:
- `ThreadMeta` type (~line 155)
- `ThreadMessage` type (~line 254)

- [ ] **Step 2: Extend `ThreadMeta` with new optional fields**

```typescript
export type ThreadMeta = {
  threadId: string;
  createdBy: string;
  customTitle?: string;
  // New fields:
  isClosed?: boolean;
  closedBy?: string;
  autoCloseAfter?: number;   // Duration in ms (preset-derived). "Never" = field omitted entirely
  lastActivityAt?: number;   // Timestamp of last reply; used for auto-close check
};
```

- [ ] **Step 3: Extend `ThreadMessage` action union**

```typescript
export type ThreadMessage = {
  senderId: string;
  type: 'thread';
  targetMessageId: string;
  action: 'create' | 'updateTitle' | 'close' | 'reopen' | 'updateSettings' | 'remove';
  threadMeta: ThreadMeta;
};
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```
Expected: no new errors from this change (all new fields are optional).

- [ ] **Step 5: Commit**

```bash
git add src/api/quorumApi.ts
git commit -m "feat(threads): extend ThreadMeta and ThreadMessage types for close/remove"
```

---

## Chunk 2: ThreadContext — New Actions Interface

### Task 2: Add new actions to `ThreadActions` interface

**Files:**
- Modify: `src/components/context/ThreadContext.tsx` (lines ~47-53 for `ThreadActions` interface)

- [ ] **Step 1: Read `ThreadContext.tsx`**

Verify the current `ThreadActions` interface shape.

- [ ] **Step 2: Add three new action signatures to `ThreadActions`**

```typescript
interface ThreadActions {
  openThread: (message: MessageType) => void;
  closeThread: () => void;
  submitMessage: (message: string | object, inReplyTo?: string) => Promise<void>;
  submitSticker?: (stickerId: string, inReplyTo?: string) => Promise<void>;
  updateTitle: (targetMessageId: string, threadMeta: ThreadMeta | undefined, newTitle: string) => Promise<void>;
  // New:
  setThreadClosed: (threadId: string, close: boolean) => Promise<void>;
  updateThreadSettings: (threadId: string, autoCloseAfter: number | undefined) => Promise<void>;
  removeThread: (threadId: string) => Promise<void>;
}
```

> **Naming note:** `closeThread` (existing) means "close the thread panel UI." `setThreadClosed` (new) means "broadcast close/reopen state on the thread content." These are intentionally distinct.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```
Expected: TypeScript errors in `Channel.tsx` because the registered actions object doesn't yet include the three new methods — this is expected and will be fixed in Task 4.

- [ ] **Step 3: Update `defaultActions` stubs**

In `ThreadContext.tsx`, locate the `defaultActions` object (around line 82, a const with no-op function stubs for every `ThreadActions` method). Add stubs for the three new methods:

```typescript
setThreadClosed: async () => {},
updateThreadSettings: async () => {},
removeThread: async () => {},
```

Without this, TypeScript will error immediately because `defaultActions` no longer satisfies the updated `ThreadActions` interface.

- [ ] **Step 4: Commit**

```bash
git add src/components/context/ThreadContext.tsx
git commit -m "feat(threads): add setThreadClosed/updateThreadSettings/removeThread to ThreadActions interface"
```

---

## Chunk 3: MessageService — Receive Path

### Task 3: Handle new actions in `saveMessage` (IndexedDB)

**Files:**
- Modify: `src/services/MessageService.ts` (locate the `saveMessage` thread block, currently at lines ~797-828)

The pattern to follow is the existing `updateTitle` block. The new actions do spread-merge updates to `threadMeta` on the root message, with auth checks before writing.

- [ ] **Step 1: Read the existing thread block in `saveMessage`**

Locate the `} else if (decryptedContent.content.type === 'thread') {` block inside `saveMessage` and understand its structure before editing.

- [ ] **Step 2: Add `close` / `reopen` / `updateSettings` / `remove` auth checks**

After the existing `if (threadMsg.action === 'create') { ... } else if (threadMsg.action === 'updateTitle') { ... }` block, add:

```typescript
} else if (threadMsg.action === 'close' || threadMsg.action === 'reopen' || threadMsg.action === 'updateSettings') {
  // Auth: sender must be thread creator OR have message:delete permission
  const isAuthor = threadMsg.senderId === targetMessage.threadMeta?.createdBy;
  // Check permission via space roles (same pattern as pin/remove/mute in this file)
  const space = await messageDB.getSpace(spaceId);
  const hasDeletePermission = space?.roles?.some(
    (role) =>
      role.members.includes(threadMsg.senderId) &&
      role.permissions.includes('message:delete')
  ) ?? false;
  if (!isAuthor && !hasDeletePermission) return;
} else if (threadMsg.action === 'remove') {
  // Auth: sender must be both thread creator AND root message sender (stricter — no mod override)
  const isAuthor = threadMsg.senderId === targetMessage.threadMeta?.createdBy;
  const isRootSender = threadMsg.senderId === targetMessage.senderId;
  if (!isAuthor || !isRootSender) return;
}
```

> **Pattern source:** This uses `messageDB.getSpace(spaceId)` then `space.roles` — the same permission-check pattern used for pins, removes, and mute actions in `saveMessage`. Locate those blocks in the file (search for `getSpace`) and confirm the exact API before finalizing this code.

- [ ] **Step 3: After the auth block, update the `updatedMessage` construction for `remove`**

The existing code after the auth checks does:
```typescript
const updatedMessage: Message = {
  ...targetMessage,
  threadMeta: { ...targetMessage.threadMeta, ...threadMsg.threadMeta },
};
await messageDB.saveMessage(updatedMessage, ...);
```

For `remove`, instead of merging, strip `threadMeta` and delete all thread replies:
```typescript
if (threadMsg.action === 'remove') {
  // Strip threadMeta from root message
  const { threadMeta: _stripped, ...rootWithoutThread } = targetMessage;
  const removedRoot: Message = rootWithoutThread as Message;
  await messageDB.saveMessage(removedRoot, 0, spaceId, conversationType,
    updatedUserProfile.user_icon!, updatedUserProfile.display_name!, currentUserAddress);

  // Delete all replies in this thread via by_thread index
  const threadId = threadMsg.threadMeta.threadId;
  const threadReplies = await messageDB.getThreadMessages({ spaceId, channelId, threadId });
  for (const reply of threadReplies.messages) {
    await messageDB.deleteMessage({ spaceId, channelId, messageId: reply.messageId });
  }
  return; // Don't fall through to the generic save below
}
```

For `close`, `reopen`, `updateSettings` — after the auth guard passes, execution continues to the existing spread-merge + `messageDB.saveMessage` call at the bottom of the block. No early return needed; the spread-merge correctly updates only those fields.

> **Check `getThreadMessages` and `deleteMessage` signatures** in `src/db/messages.ts` before writing this code. Use the actual method names and parameter shapes from the DB layer.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 5: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "feat(threads): handle close/reopen/updateSettings/remove in saveMessage"
```

### Task 4: Handle new actions in `addMessage` (React Query cache)

**Files:**
- Modify: `src/services/MessageService.ts` (locate the `addMessage` thread block, currently at lines ~1312-1343)

- [ ] **Step 1: Read the existing thread block in `addMessage`**

Locate the `} else if (decryptedContent.content.type === 'thread') {` block in `addMessage`. The existing block has an auth check only for `updateTitle` — `create` has no auth check (idempotency is its guard). The new auth-check code must be inserted as new `if` blocks before the existing generic `setQueryData`, not replacing the existing `updateTitle` check.

- [ ] **Step 2: Add auth checks for new actions**

After the existing `if (threadMsg.action === 'updateTitle') { ... }` auth check block, add these new blocks (they must be separate `if` statements, not `else if`, so each action type is handled independently):

```typescript
if (threadMsg.action === 'close' || threadMsg.action === 'reopen' || threadMsg.action === 'updateSettings') {
  const targetMessage = await this.messageDB.getMessage({ spaceId, channelId, messageId: threadMsg.targetMessageId });
  if (!targetMessage) return;
  const isAuthor = threadMsg.senderId === targetMessage.threadMeta?.createdBy;
  // Check permission via space roles (same pattern as saveMessage)
  const space = await this.messageDB.getSpace(spaceId);
  const hasDeletePermission = space?.roles?.some(
    (role) =>
      role.members.includes(threadMsg.senderId) &&
      role.permissions.includes('message:delete')
  ) ?? false;
  if (!isAuthor && !hasDeletePermission) return;
}

if (threadMsg.action === 'remove') {
  const targetMessage = await this.messageDB.getMessage({ spaceId, channelId, messageId: threadMsg.targetMessageId });
  if (!targetMessage) return;
  const isAuthor = threadMsg.senderId === targetMessage.threadMeta?.createdBy;
  const isRootSender = threadMsg.senderId === targetMessage.senderId;
  if (!isAuthor || !isRootSender) return;
}
```

- [ ] **Step 3: Update the React Query cache patch for new actions**

For `close`, `reopen`, `updateSettings` — the existing `setQueryData` spread-merge (which runs unconditionally for all thread actions except `remove`) already handles them correctly since it merges `threadMsg.threadMeta` onto existing `m.threadMeta`. The existing `invalidateQueries` call at the end of the block also still fires for these actions — no change needed for those.

For `remove`, replace the generic `setQueryData` with a filter that removes the thread entirely from the root message:

```typescript
if (threadMsg.action === 'remove') {
  const threadId = threadMsg.threadMeta.threadId;
  queryClient.setQueryData(
    buildMessagesKey({ spaceId, channelId }),
    (oldData: InfiniteData<any>) => {
      if (!oldData?.pages) return oldData;
      return {
        pageParams: oldData.pageParams,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          messages: page.messages.map((m: Message) => {
            if (m.messageId === threadMsg.targetMessageId) {
              const { threadMeta: _stripped, ...rest } = m;
              return rest as Message;
            }
            // Filter out thread replies for this thread
            if (m.threadId === threadId || (m.isThreadReply && m.threadId === threadId)) {
              return null;
            }
            return m;
          }).filter(Boolean),
        })),
      };
    }
  );
  // Invalidate thread messages query so panel closes cleanly
  queryClient.invalidateQueries({
    queryKey: ['thread-messages', spaceId, channelId, threadId],
  });
  return;
}
```

For non-`remove` actions, the existing `setQueryData` spread-merge handles them. Ensure the existing `invalidateQueries` call at the end of the block still fires for `close`, `reopen`, `updateSettings`.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 5: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "feat(threads): handle close/reopen/updateSettings/remove in addMessage cache update"
```

---

## Chunk 4: Channel.tsx — Send Path & Auto-Close

### Task 5: Add `handleSetThreadClosed`, `handleUpdateThreadSettings`, `handleRemoveThread`

**Files:**
- Modify: `src/components/space/Channel.tsx` (handlers near lines ~527-566 where `handleUpdateThreadTitle` lives)

Read `handleUpdateThreadTitle` carefully before writing these — they follow the exact same pattern.

- [ ] **Step 1: Add `handleSetThreadClosed`**

```typescript
const handleSetThreadClosed = useCallback(
  async (threadId: string, close: boolean) => {
    if (spaceId === channelId) return;
    if (!activeThreadRootMessage) return;

    const threadMeta = activeThreadRootMessage.threadMeta;
    if (!threadMeta) return;

    const updatedMeta: ThreadMeta = close
      ? { ...threadMeta, isClosed: true, closedBy: user.currentPasskeyInfo!.address }
      : { ...threadMeta, isClosed: false, closedBy: undefined };
    // Remove closedBy key entirely when reopening (don't leave undefined value)
    if (!close) {
      delete (updatedMeta as any).closedBy;
    }

    const threadMessage: ThreadMessage = {
      type: 'thread',
      senderId: user.currentPasskeyInfo!.address,
      targetMessageId: activeThreadRootMessage.messageId,
      action: close ? 'close' : 'reopen',
      threadMeta: updatedMeta,
    };

    const effectiveSkip = space?.isRepudiable ? skipSigning : false;
    await submitChannelMessage(
      spaceId, channelId, threadMessage, queryClient,
      user.currentPasskeyInfo!, undefined, effectiveSkip, isSpaceOwner
    );

    setActiveThreadRootMessage((prev) =>
      prev ? { ...prev, threadMeta: { ...prev.threadMeta, ...updatedMeta } } : prev
    );
  },
  [spaceId, channelId, activeThreadRootMessage, user.currentPasskeyInfo, submitChannelMessage, queryClient, space, skipSigning, isSpaceOwner]
);
```

- [ ] **Step 2: Add `handleUpdateThreadSettings`**

```typescript
const handleUpdateThreadSettings = useCallback(
  async (threadId: string, autoCloseAfter: number | undefined) => {
    if (spaceId === channelId) return;
    if (!activeThreadRootMessage) return;

    const threadMeta = activeThreadRootMessage.threadMeta;
    if (!threadMeta) return;

    const updatedMeta: ThreadMeta = { ...threadMeta };
    if (autoCloseAfter === undefined) {
      delete (updatedMeta as any).autoCloseAfter;
    } else {
      updatedMeta.autoCloseAfter = autoCloseAfter;
      // Initialize lastActivityAt when auto-close is first set
      if (!updatedMeta.lastActivityAt) {
        updatedMeta.lastActivityAt = Date.now();
      }
    }

    const threadMessage: ThreadMessage = {
      type: 'thread',
      senderId: user.currentPasskeyInfo!.address,
      targetMessageId: activeThreadRootMessage.messageId,
      action: 'updateSettings',
      threadMeta: updatedMeta,
    };

    const effectiveSkip = space?.isRepudiable ? skipSigning : false;
    await submitChannelMessage(
      spaceId, channelId, threadMessage, queryClient,
      user.currentPasskeyInfo!, undefined, effectiveSkip, isSpaceOwner
    );

    setActiveThreadRootMessage((prev) =>
      prev ? { ...prev, threadMeta: { ...prev.threadMeta, ...updatedMeta } } : prev
    );
  },
  [spaceId, channelId, activeThreadRootMessage, user.currentPasskeyInfo, submitChannelMessage, queryClient, space, skipSigning, isSpaceOwner]
);
```

- [ ] **Step 3: Add `handleRemoveThread`**

```typescript
const handleRemoveThread = useCallback(
  async (threadId: string) => {
    if (spaceId === channelId) return;
    if (!activeThreadRootMessage) return;

    const threadMeta = activeThreadRootMessage.threadMeta;
    if (!threadMeta) return;

    // Broadcast with minimal payload — peers use threadId + createdBy to clean up
    const threadMessage: ThreadMessage = {
      type: 'thread',
      senderId: user.currentPasskeyInfo!.address,
      targetMessageId: activeThreadRootMessage.messageId,
      action: 'remove',
      threadMeta: { threadId: threadMeta.threadId, createdBy: threadMeta.createdBy },
    };

    const effectiveSkip = space?.isRepudiable ? skipSigning : false;
    await submitChannelMessage(
      spaceId, channelId, threadMessage, queryClient,
      user.currentPasskeyInfo!, undefined, effectiveSkip, isSpaceOwner
    );

    // Close panel locally — threadMeta is about to be stripped
    setActivePanel(null);
    setActiveThreadId(null);
    setActiveThreadRootMessage(null);
  },
  [spaceId, channelId, activeThreadRootMessage, user.currentPasskeyInfo, submitChannelMessage, queryClient, space, skipSigning, isSpaceOwner, setActivePanel]
);
```

- [ ] **Step 4: Register new handlers in `setThreadActions` useEffect**

Find the existing `useEffect` that calls `threadCtx.setThreadActions(...)` (~line 569) and add the three new handlers:

```typescript
React.useEffect(() => {
  threadCtx.setThreadActions({
    openThread: handleOpenThread,
    closeThread: () => {
      setActivePanel(null);
      setActiveThreadId(null);
      setActiveThreadRootMessage(null);
    },
    submitMessage: handleSubmitThreadMessage,
    submitSticker: handleSubmitThreadSticker,
    updateTitle: handleUpdateThreadTitle,
    // New:
    setThreadClosed: handleSetThreadClosed,
    updateThreadSettings: handleUpdateThreadSettings,
    removeThread: handleRemoveThread,
  });
}, [handleOpenThread, handleSubmitThreadMessage, handleSubmitThreadSticker, handleUpdateThreadTitle,
    handleSetThreadClosed, handleUpdateThreadSettings, handleRemoveThread]);
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 6: Commit**

```bash
git add src/components/space/Channel.tsx
git commit -m "feat(threads): add handleSetThreadClosed/UpdateSettings/RemoveThread handlers"
```

### Task 6: Add auto-close check to `handleOpenThread` and `lastActivityAt` updates

**Files:**
- Modify: `src/components/space/Channel.tsx`

- [ ] **Step 1: Add auto-close check in `handleOpenThread`**

In `handleOpenThread`, after the `message` variable is fully resolved (after the `if (message.threadMeta) { ... } else { ... }` block that either opens an existing thread or creates a new one), add:

```typescript
// Auto-close check: evaluate expiry on open (check-on-read pattern)
if (message.threadMeta?.autoCloseAfter && message.threadMeta?.lastActivityAt) {
  const isExpired =
    message.threadMeta.lastActivityAt + message.threadMeta.autoCloseAfter <= Date.now();
  if (isExpired && !message.threadMeta.isClosed) {
    // Broadcast close — peers receive it and update their state too
    // Use queueMicrotask so panel opens first, then close broadcasts
    queueMicrotask(() => {
      handleSetThreadClosed(message.threadMeta!.threadId, true);
    });
    // Update local snapshot immediately
    message = {
      ...message,
      threadMeta: { ...message.threadMeta, isClosed: true, closedBy: user.currentPasskeyInfo!.address },
    };
  }
}
```

> **Dependency note:** `handleSetThreadClosed` must be declared before `handleOpenThread` in the file, or `handleOpenThread`'s `useCallback` deps array must include `handleSetThreadClosed`. Check file order and add `handleSetThreadClosed` to `handleOpenThread`'s deps if needed.

- [ ] **Step 2: Update `lastActivityAt` in the thread reply send path**

Find `handleSubmitThreadMessage` in `Channel.tsx`. After a successful `submitChannelMessage` call for a thread reply, update `lastActivityAt` on the root message in the React Query cache and stale snapshot:

```typescript
// Update lastActivityAt on root message threadMeta after sending a reply
if (activeThreadRootMessage?.threadMeta) {
  const now = Date.now();
  const updatedMeta: ThreadMeta = {
    ...activeThreadRootMessage.threadMeta,
    lastActivityAt: now,
  };
  // Update stale snapshot
  setActiveThreadRootMessage((prev) =>
    prev ? { ...prev, threadMeta: updatedMeta } : prev
  );
  // Note: the IndexedDB and React Query cache update for lastActivityAt
  // on the root message is handled in MessageService's send path
  // (submitChannelMessage processes the reply and can update the root).
  // If MessageService doesn't update it, add a direct messageDB.saveMessage call here.
}
```

> **Check:** Inspect how `submitChannelMessage` in `MessageService.ts` processes thread replies. If it already updates the root message's `threadMeta` when saving a reply (check the `isThreadReply` handling in the send path), then no additional DB update is needed here. If it doesn't, call `messageDB.updateMessage` directly.

- [ ] **Step 3: Update `lastActivityAt` in the receive path**

In `MessageService.ts`, in the `addMessage` handler, when processing a message where `isThreadReply === true` (or `threadId` is set), update the root message's `lastActivityAt` in the React Query cache:

```typescript
// When a thread reply arrives, update lastActivityAt on the root message
if (message.isThreadReply && message.threadId) {
  const now = message.createdDate ?? Date.now();
  queryClient.setQueryData(
    buildMessagesKey({ spaceId, channelId }),
    (oldData: InfiniteData<any>) => {
      if (!oldData?.pages) return oldData;
      return {
        pageParams: oldData.pageParams,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          messages: page.messages.map((m: Message) => {
            if (m.threadMeta?.threadId === message.threadId) {
              return {
                ...m,
                threadMeta: { ...m.threadMeta, lastActivityAt: now },
              };
            }
            return m;
          }),
        })),
      };
    }
  );
}
```

> **Where to place this:** Find where thread replies are processed in `addMessage` in `MessageService.ts`. Add this cache update there. This does NOT need to call `setActiveThreadRootMessage` — the auto-close check reads from cache/DB fresh on each open.

- [ ] **Step 4: Initialize `lastActivityAt` on thread creation**

In `handleOpenThread` in `Channel.tsx`, when building the `threadMeta` for a new thread (the `else` branch of `if (message.threadMeta)`), add `lastActivityAt`:

```typescript
const threadMeta: ThreadMeta = {
  threadId,
  createdBy: user.currentPasskeyInfo!.address,
  lastActivityAt: Date.now(),  // Add this
};
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 6: Commit**

```bash
git add src/components/space/Channel.tsx src/services/MessageService.ts
git commit -m "feat(threads): auto-close check on open, lastActivityAt tracking"
```

---

## Chunk 5: Modal — Thread Settings

### Task 7: Add `threadSettings` state to `useModalState.ts`

**Files:**
- Modify: `src/hooks/business/ui/useModalState.ts`

Follow the exact pattern of the existing `conversationSettings` modal state entry.

- [ ] **Step 1: Read `useModalState.ts`**

Locate the `ModalState` interface, the reducer, and the memoized callbacks section.

- [ ] **Step 2: Add state shape to `ModalState` interface**

```typescript
threadSettings: {
  isOpen: boolean;
  threadId?: string;
  rootMessage?: MessageType;
};
```

- [ ] **Step 3: Add initial state in the reducer's initial value**

```typescript
threadSettings: { isOpen: false },
```

- [ ] **Step 4: Add reducer cases**

```typescript
case 'OPEN_THREAD_SETTINGS':
  return { ...state, threadSettings: { isOpen: true, threadId: action.threadId, rootMessage: action.rootMessage } };
case 'CLOSE_THREAD_SETTINGS':
  return { ...state, threadSettings: { isOpen: false } };
```

- [ ] **Step 5: Add memoized callbacks**

```typescript
const openThreadSettings = useCallback(
  (threadId: string, rootMessage: MessageType) =>
    dispatch({ type: 'OPEN_THREAD_SETTINGS', threadId, rootMessage }),
  []
);
const closeThreadSettings = useCallback(
  () => dispatch({ type: 'CLOSE_THREAD_SETTINGS' }),
  []
);
```

- [ ] **Step 6: Return the new callbacks from the hook**

Add `openThreadSettings` and `closeThreadSettings` to the return value.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

### Task 8: Register `ThreadSettingsModal` in `ModalProvider.tsx`

**Files:**
- Modify: `src/components/context/ModalProvider.tsx`

- [ ] **Step 1: Read `ModalProvider.tsx`**

Locate where `ConversationSettingsModal` is rendered (~line 113) and follow the exact same pattern.

- [ ] **Step 2: Add `openThreadSettings` / `closeThreadSettings` to `ModalContextType`**

In the `ModalContextType` interface in `ModalProvider.tsx`, add:
```typescript
openThreadSettings: (threadId: string, rootMessage: MessageType) => void;
closeThreadSettings: () => void;
```

- [ ] **Step 3: Add to `contextValue`**

```typescript
openThreadSettings: modalState.openThreadSettings,
closeThreadSettings: modalState.closeThreadSettings,
```

- [ ] **Step 4: Render the modal conditionally**

```typescript
{modalState.state.threadSettings.isOpen &&
  modalState.state.threadSettings.threadId &&
  modalState.state.threadSettings.rootMessage && (
    <ThreadSettingsModal
      threadId={modalState.state.threadSettings.threadId}
      rootMessage={modalState.state.threadSettings.rootMessage}
      visible={true}
      onClose={modalState.closeThreadSettings}
    />
  )}
```

Add the import for `ThreadSettingsModal` at the top of the file:
```typescript
import { ThreadSettingsModal } from '../modals/ThreadSettingsModal';
```

- [ ] **Step 5: Type-check (expect error for missing ThreadSettingsModal — that's OK)**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck 2>&1 | head -20
```

### Task 9: Create `ThreadSettingsModal.tsx`

**Files:**
- Create: `src/components/modals/ThreadSettingsModal.tsx`

Reference file: `src/components/modals/ConversationSettingsModal.tsx` — read it fully before writing this.
Also read `src/components/modals/SpaceSettingsModal/Danger.tsx` for the double-click confirm pattern.

- [ ] **Step 1: Read `ConversationSettingsModal.tsx` and `Danger.tsx`**

Understand the `Modal` + `Container` + `Spacer border` pattern and the `deleteConfirmationStep` / `setTimeout` double-click confirm.

- [ ] **Step 2: Write `ThreadSettingsModal.tsx`**

```typescript
import React from 'react';
import { t } from '@lingui/macro';
import { Modal } from '../primitives/Modal';
import { Container } from '../primitives/Container';
import { Flex } from '../primitives/Flex';
import { Button } from '../primitives/Button';
import { Select } from '../primitives/Select';
import { Spacer } from '../primitives/Spacer';
import { useThreadContext } from '../context/ThreadContext';
import { useModals } from '../context/ModalProvider';
import type { MessageType } from '../../types/message';

// Auto-close preset options
const AUTO_CLOSE_OPTIONS = [
  { value: '0', label: t`Never` },
  { value: String(60 * 60 * 1000), label: t`1 hour` },
  { value: String(24 * 60 * 60 * 1000), label: t`24 hours` },
  { value: String(3 * 24 * 60 * 60 * 1000), label: t`3 days` },
  { value: String(7 * 24 * 60 * 60 * 1000), label: t`1 week` },
] as const;

interface ThreadSettingsModalProps {
  threadId: string;
  rootMessage: MessageType;
  visible: boolean;
  onClose: () => void;
}

export const ThreadSettingsModal: React.FC<ThreadSettingsModalProps> = ({
  threadId,
  rootMessage,
  visible,
  onClose,
}) => {
  const threadCtx = useThreadContext();
  const { setThreadClosed, updateThreadSettings, removeThread, channelProps, threadMessages } = threadCtx;
  const { closeThreadSettings } = useModals();

  const [removeConfirmStep, setRemoveConfirmStep] = React.useState(0);

  const threadMeta = rootMessage.threadMeta;
  const isClosed = threadMeta?.isClosed ?? false;
  const currentAutoClose = threadMeta?.autoCloseAfter;
  const currentUserAddress = channelProps?.currentUserAddress;

  const isThreadAuthor = threadMeta?.createdBy === currentUserAddress;
  // canDeleteMessages is a function on channelProps that encapsulates role-permission checks for the current user
  const canManage =
    isThreadAuthor || (rootMessage ? (channelProps?.canDeleteMessages(rootMessage) ?? false) : false);

  // Determine if other users have replied — disables Remove button as a UI guard.
  // The definitive auth check is in handleRemoveThread; this is display-only.
  const hasOtherReplies = React.useMemo(
    () => threadMessages.some((m) => m.senderId !== currentUserAddress),
    [threadMessages, currentUserAddress]
  );

  const autoCloseValue = currentAutoClose ? String(currentAutoClose) : '0';

  const handleAutoCloseChange = async (value: string) => {
    const ms = parseInt(value, 10);
    await updateThreadSettings?.(threadId, ms === 0 ? undefined : ms);
  };

  const handleToggleClosed = async () => {
    await setThreadClosed?.(threadId, !isClosed);
    onClose();
  };

  const handleRemoveClick = async () => {
    if (removeConfirmStep === 0) {
      setRemoveConfirmStep(1);
      setTimeout(() => setRemoveConfirmStep(0), 5000);
      return;
    }
    await removeThread?.(threadId);
    closeThreadSettings();
  };

  if (!canManage) return null;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t`Thread Settings`}
      size="small"
    >
      <Container>
        <Flex direction="column">
          {/* Auto-close section */}
          <div className="text-label-strong mb-1">{t`Auto-close after`}</div>
          <Select
            value={autoCloseValue}
            onChange={handleAutoCloseChange}
            options={AUTO_CLOSE_OPTIONS}
          />
          <span className="text-small text-subtle mt-1">
            {t`Thread will close when inactive for this duration`}
          </span>
        </Flex>

        <Spacer spaceBefore="lg" spaceAfter="md" border direction="vertical" />

        {/* Close / Reopen section */}
        <Flex justify="center">
          <Button type="subtle" fullWidth onClick={handleToggleClosed}>
            {isClosed ? t`Reopen Thread` : t`Close Thread`}
          </Button>
        </Flex>

        {isThreadAuthor && (
          <>
            <Spacer spaceBefore="lg" spaceAfter="md" border direction="vertical" />

            {/* Remove section */}
            <Flex direction="column" align="center" gap="xs">
              <Button
                type="danger"
                onClick={handleRemoveClick}
                disabled={hasOtherReplies}
              >
                {removeConfirmStep === 0 ? t`Remove Thread` : t`Click again to confirm`}
              </Button>
              {hasOtherReplies && (
                <span className="text-small text-subtle">
                  {t`Threads with replies from other users cannot be removed`}
                </span>
              )}
            </Flex>
          </>
        )}
      </Container>
    </Modal>
  );
};
```

> **Check primitive imports:** Before finalizing, verify that `Container`, `Flex`, `Spacer`, `Select` exist as named exports from `../primitives/` or their specific subfolders. Check `ConversationSettingsModal.tsx` imports for the exact import paths used in practice.

> **`useThreadContext()` shape:** The `useThreadContext()` hook (subscribing version used in `ThreadPanel.tsx`) returns a flattened snapshot. Verify the exact keys it exposes for `setThreadClosed`, `updateThreadSettings`, `removeThread` — they come from the `ThreadActions` interface you updated in Task 2. The actions may be accessed as `threadActions.setThreadClosed` or directly. Check the `useThreadContext` implementation.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```
Fix any import path errors or property access mismatches.

- [ ] **Step 4: Commit**

```bash
git add src/components/modals/ThreadSettingsModal.tsx src/components/context/ModalProvider.tsx src/hooks/business/ui/useModalState.ts
git commit -m "feat(threads): add ThreadSettingsModal and wire into ModalProvider"
```

---

## Chunk 6: ThreadPanel UI Updates

### Task 10: Add cog icon to ThreadPanel header

**Files:**
- Modify: `src/components/thread/ThreadPanel.tsx`
- Modify: `src/components/thread/ThreadPanel.scss`

- [ ] **Step 1: Read `ThreadPanel.tsx` header section**

Locate the header section (lines ~251-296). The existing close button is:
```typescript
<Button type="unstyled" onClick={closeThread} className="thread-panel__close">
  <Icon name="close" size="md" />
</Button>
```
The new settings cog will be inserted immediately before this close button and will use `name="settings" size="sm"`.

- [ ] **Step 2: Add `openThreadSettings` from `useModals()` and compute `canManage`**

At the top of the component (after existing hooks), add:
```typescript
const { openThreadSettings } = useModals();

const canManage =
  isThreadAuthor || (rootMessage ? (channelProps?.canDeleteMessages(rootMessage) ?? false) : false);
```

Where `isThreadAuthor` already exists (computed as `rootMessage.threadMeta.createdBy === channelProps.currentUserAddress`).

- [ ] **Step 3: Add cog button in the header, between title area and close button**

```typescript
{canManage && rootMessage && (
  <Button
    type="unstyled"
    onClick={() => openThreadSettings(threadId!, rootMessage)}
    className="thread-panel__settings"
    aria-label={t`Thread settings`}
  >
    <Icon name="settings" size="sm" />
  </Button>
)}
<Button
  type="unstyled"
  onClick={closeThread}
  className="thread-panel__close"
>
  <Icon name="close" size="md" />
</Button>
```

- [ ] **Step 4: Add CSS for cog button in `ThreadPanel.scss`**

Following the existing `.thread-panel__close` style, add:
```scss
.thread-panel__settings {
  // Same sizing and hover behavior as .thread-panel__close
  // Inspect .thread-panel__close and mirror the style
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: $rounded-full;
  color: var(--text-secondary);

  &:hover {
    background-color: var(--surface-hover);
    color: var(--text-primary);
  }
}
```

> Read the existing `.thread-panel__close` CSS in `ThreadPanel.scss` and mirror it exactly rather than guessing values.

- [ ] **Step 5: Type-check and visual check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 6: Commit**

```bash
git add src/components/thread/ThreadPanel.tsx src/components/thread/ThreadPanel.scss
git commit -m "feat(threads): add settings cog button to ThreadPanel header"
```

### Task 11: Add closed thread state to ThreadPanel

**Files:**
- Modify: `src/components/thread/ThreadPanel.tsx`
- Modify: `src/components/thread/ThreadPanel.scss`

When `threadMeta.isClosed === true`, the MessageComposer area at the bottom of the panel should be replaced with a closed notice and optional reopen link.

- [ ] **Step 1: Read the MessageComposer render area in `ThreadPanel.tsx`**

Find where `MessageComposer` is rendered (near the bottom of the component JSX). It likely looks like:
```typescript
<MessageComposer ... />
```

- [ ] **Step 2: Compute `isClosed` and `canReopen`**

```typescript
const isClosed = rootMessage?.threadMeta?.isClosed ?? false;
const canReopen =
  isThreadAuthor || (rootMessage ? (channelProps?.canDeleteMessages(rootMessage) ?? false) : false);
```

- [ ] **Step 3: Replace the composer with a conditional**

```typescript
{isClosed ? (
  <div className="thread-panel__closed-notice">
    <span className="text-body text-subtle">{t`This thread has been closed`}</span>
    {canReopen && (
      <button
        type="button"
        className="thread-panel__reopen-link"
        onClick={() => setThreadClosed?.(threadId!, false)}
      >
        {t`Reopen`}
      </button>
    )}
  </div>
) : (
  <MessageComposer ... />
)}
```

- [ ] **Step 4: Also guard `handleSubmitMessage` against closed threads**

Find where `handleSubmitMessage` is called or passed as a prop. In `Channel.tsx`, in `handleSubmitThreadMessage`, add an early guard:

```typescript
const handleSubmitThreadMessage = useCallback(
  async (message: string | object, inReplyTo?: string) => {
    // Guard: reject if thread is closed (defense-in-depth)
    if (activeThreadRootMessage?.threadMeta?.isClosed) return;
    // ... rest of existing logic
  },
  [/* existing deps */, activeThreadRootMessage]
);
```

- [ ] **Step 5: Add CSS for the closed notice**

```scss
.thread-panel__closed-notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $s-2;
  padding: $s-4 $s-6;
  border-top: 1px solid var(--color-border-default);
}

.thread-panel__reopen-link {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--text-link);
  font-size: inherit;

  &:hover {
    text-decoration: underline;
    color: var(--text-link-hover);
  }
}
```

> Check `ThreadPanel.scss` for existing spacing variables (`$s-2`, `$s-4`) and border color variables. Use what the file already uses.

- [ ] **Step 6: Handle "thread removed" — panel auto-close**

In `ThreadPanel.tsx` (or via a `useEffect` in `Channel.tsx`), detect when the root message loses `threadMeta`:

In `Channel.tsx`, in the `useEffect` that sets `setThreadState`, add a check:

```typescript
React.useEffect(() => {
  // If the active thread's root message no longer has threadMeta, close the panel
  if (activePanel === 'thread' && activeThreadRootMessage && !activeThreadRootMessage.threadMeta) {
    setActivePanel(null);
    setActiveThreadId(null);
    setActiveThreadRootMessage(null);
  }
}, [activeThreadRootMessage, activePanel]);
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 8: Commit**

```bash
git add src/components/thread/ThreadPanel.tsx src/components/thread/ThreadPanel.scss src/components/space/Channel.tsx
git commit -m "feat(threads): closed thread UI state, reopen link, panel auto-close on remove"
```

---

## Chunk 7: ThreadIndicator Closed State

### Task 12: Add closed state visual cue to `ThreadIndicator`

**Files:**
- Modify: `src/components/thread/ThreadIndicator.tsx`
- Modify: (likely) the file that renders `ThreadIndicator` — check how `threadMeta` is passed down

The spec says: "Implementation detail to be refined during development." A lock icon next to the reply count is a reasonable approach.

- [ ] **Step 1: Read `ThreadIndicator.tsx` and how it's called**

Check what props it currently accepts. Currently:
```typescript
interface ThreadIndicatorProps {
  spaceId: string;
  channelId: string;
  threadId: string;
  onClick: () => void;
}
```

Find where `ThreadIndicator` is rendered in the codebase (grep for `ThreadIndicator`) to see what the call site provides.

- [ ] **Step 2: Add `isClosed` prop**

```typescript
interface ThreadIndicatorProps {
  spaceId: string;
  channelId: string;
  threadId: string;
  onClick: () => void;
  isClosed?: boolean;  // New
}
```

- [ ] **Step 3: Update render to show lock icon when closed**

```typescript
<button type="button" className={`thread-indicator${isClosed ? ' thread-indicator--closed' : ''}`} onClick={onClick}>
  <Icon name="messages" className="thread-indicator__icon" />
  {isClosed && <Icon name="lock" className="thread-indicator__lock-icon" size="xs" />}
  <span className="thread-indicator__count">
    {/* existing count/text logic */}
  </span>
  {/* existing time */}
</button>
```

> Verify `"lock"` is a valid icon name in the project's icon set. Check other components that use lock icons. If unavailable, use `"lock-closed"` or `"closed"` — whatever exists.

- [ ] **Step 4: Pass `isClosed` from the call site**

At the call site (likely `Message.tsx` or similar), pass `isClosed={message.threadMeta?.isClosed}`.

- [ ] **Step 5: Add CSS for the closed state**

```scss
.thread-indicator--closed {
  .thread-indicator__count {
    color: var(--text-subtle); // Muted text
  }
}

.thread-indicator__lock-icon {
  color: var(--text-subtle);
  margin-left: $s-1;
}
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 7: Commit**

```bash
git add src/components/thread/ThreadIndicator.tsx
git commit -m "feat(threads): closed state visual cue on ThreadIndicator"
```

---

## Chunk 8: Remove Thread — DB-Level Reply Cleanup

### Task 13: Verify DB `deleteMessage` API and `getThreadMessages` for remove action

**Files:**
- Read: `src/db/messages.ts` (or `src/adapters/IndexedDBAdapter.ts`)

This task ensures the `remove` handling in Task 3 uses correct DB method signatures.

- [ ] **Step 1: Find `deleteMessage` (or equivalent) in the DB layer**

```bash
# Search for delete methods in the DB layer
```

Use Grep to search for `deleteMessage` in `src/db/` and `src/adapters/`.

- [ ] **Step 2: Confirm `getThreadMessages` return shape**

Verify what `getThreadMessages()` returns — particularly that it returns `{ messages: Message[] }` or similar, and confirm the parameter shape `{ spaceId, channelId, threadId }`.

- [ ] **Step 3: If `deleteMessage` doesn't exist, find the correct delete API**

Look for soft-delete patterns (used for regular message deletion) — check if thread reply removal should also soft-delete or hard-delete. For removes (thread removal), hard-delete is appropriate since the spec says "strips from IndexedDB."

- [ ] **Step 4: Update Tasks 3 and 4 code if method signatures differ**

Go back to the `processMessage` and `addMessage` blocks added in Tasks 3–4 and correct any method names or parameter shapes.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 6: Commit any fixes**

```bash
git add src/services/MessageService.ts
git commit -m "fix(threads): correct DB method signatures for remove reply cleanup"
```

---

## Chunk 9: Integration Test & Lint

### Task 14: Type-check and lint the full implementation

- [ ] **Step 1: Full type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```
Expected: 0 errors.

- [ ] **Step 2: Lint**

```bash
yarn lint
```
Fix any lint errors (unused imports, missing deps in `useCallback`, etc.).

- [ ] **Step 3: Build check**

```bash
yarn build
```
Expected: build succeeds.

- [ ] **Step 4: Manual smoke-test checklist**

In the running app, verify:
- [ ] Cog icon appears in ThreadPanel header for thread author
- [ ] Cog icon appears for users with `message:delete` permission
- [ ] Cog icon hidden for regular users
- [ ] Thread Settings Modal opens on cog click
- [ ] Auto-close dropdown shows correct presets
- [ ] Changing auto-close setting broadcasts and persists
- [ ] "Close Thread" button closes thread and swaps composer to closed notice
- [ ] Closed notice shows "Reopen" link for authorized users
- [ ] Reopen restores composer
- [ ] ThreadIndicator shows closed state (lock icon / muted text) on root messages
- [ ] Remove Thread button is disabled when other users have replied
- [ ] Remove Thread double-click confirm: first click shows "Click again to confirm", auto-reverts in 5s
- [ ] Remove Thread: thread disappears from main feed, thread panel closes
- [ ] Peer receives close broadcast: composer swaps without jarring transition
- [ ] Peer receives remove broadcast: thread panel auto-closes if open
- [ ] Auto-close: opening an expired thread closes it and broadcasts

- [ ] **Step 5: Final commit**

```bash
git add -p  # Stage any remaining fixes
git commit -m "fix(threads): lint and type fixes"
```

---

## Implementation Notes for the Engineer

### Key Gotchas

1. **`closeThread` vs `setThreadClosed`**: `closeThread` (ThreadActions, existing) closes the UI panel. `setThreadClosed` (new) broadcasts the thread's closed/open state. These are different operations with similar names — be careful.

2. **`handleSetThreadClosed` order in Channel.tsx**: `handleOpenThread` calls `handleSetThreadClosed` for auto-close. If `handleSetThreadClosed` is defined after `handleOpenThread` in the file, ensure `handleOpenThread`'s `useCallback` deps array includes `handleSetThreadClosed` (or move `handleSetThreadClosed` above `handleOpenThread`).

3. **`closedBy` field on reopen**: When reopening, `closedBy` should be removed entirely from `threadMeta` — not set to `undefined`. Use `delete` on the field or destructure it out. A field with value `undefined` in spread operations behaves differently from an absent field in some scenarios.

4. **`autoCloseAfter: undefined` vs omitted**: The spec says `"Never" = field deleted (not 0 or undefined value)`. So when saving `updateSettings` with "Never", the spread-merge in `processMessage`/`addMessage` will spread `autoCloseAfter: undefined`, which creates an explicit `undefined` property. You may need to explicitly delete the key after the merge if the DB/cache stores the raw object. Check behavior.

5. **Auto-close idempotency**: If two users open an expired thread simultaneously, both broadcast `close`. The second broadcast arriving on either peer finds `isClosed` already `true` — the spread-merge is a no-op (no visible change). This is safe by design.

6. **`useThreadContext()` return shape**: The flattened snapshot returned by `useThreadContext()` (used in `ThreadPanel.tsx`) needs to expose the new actions. Check how the subscribing hook flattens `actionsRef.current` — the new `setThreadClosed`, `updateThreadSettings`, `removeThread` should be accessible directly from the hook result.

7. **`canDeleteMessages` vs `permissions` array**: In the UI layer (`ThreadPanel.tsx`, `ThreadSettingsModal.tsx`), use `channelProps.canDeleteMessages(rootMessage)` — a function — to check if the current user can manage threads. There is no `channelProps.permissions` array. The raw role lookup (`space.roles`) is only used in `MessageService.ts` where `channelProps` is unavailable.

8. **Primitive imports**: Always check actual import paths in `ConversationSettingsModal.tsx` rather than guessing. `Container`, `Spacer`, `Select`, `Flex` may import from different subpaths.

### Relevant File Locations (verified)

| File | Path |
|------|------|
| ThreadMeta / ThreadMessage types | `src/api/quorumApi.ts` |
| ThreadContext (actions interface) | `src/components/context/ThreadContext.tsx` |
| Channel.tsx (handlers) | `src/components/space/Channel.tsx` |
| MessageService.ts | `src/services/MessageService.ts` |
| ThreadPanel.tsx | `src/components/thread/ThreadPanel.tsx` |
| ThreadPanel.scss | `src/components/thread/ThreadPanel.scss` |
| ThreadIndicator.tsx | `src/components/thread/ThreadIndicator.tsx` |
| useModalState.ts | `src/hooks/business/ui/useModalState.ts` |
| ModalProvider.tsx | `src/components/context/ModalProvider.tsx` |
| ConversationSettingsModal.tsx | `src/components/modals/ConversationSettingsModal.tsx` |
| Danger.tsx (double-click confirm) | `src/components/modals/SpaceSettingsModal/Danger.tsx` |
| ThreadSettingsModal.tsx (NEW) | `src/components/modals/ThreadSettingsModal.tsx` |

---

_Created: 2026-03-12_
