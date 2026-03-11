# Thread Title Editing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline-editable thread title to the ThreadPanel header, pre-populated from the root message text, with broadcast support so all clients see the updated title.

**Architecture:** Add `customTitle` to `ThreadMeta` type and a new `'updateTitle'` action to `ThreadMessage`. `ThreadPanel` renders the title as a clickable text element; clicking switches to an `<Input>` primitive. On confirm (blur/Enter), the new title is broadcast via `submitChannelMessage`. `MessageService` handles incoming `updateTitle` messages by patching `threadMeta.customTitle` on the root message in both IndexedDB and the React Query cache. `getThreadTitle()` resolution order: `customTitle` → first 100 chars of root message text → `"Thread"` fallback.

**Tech Stack:** React, TypeScript, SCSS, `<Input>` primitive (`src/components/primitives/Input/`), existing `submitChannelMessage` pipeline, `MessageService.ts` for receive-side processing.

---

## Chunk 1: Data layer — types and `getThreadTitle`

### Task 1: Extend `ThreadMeta` and `ThreadMessage` types

**Files:**
- Modify: `src/api/quorumApi.ts:155-158` (ThreadMeta type)
- Modify: `src/api/quorumApi.ts:253-259` (ThreadMessage type)

- [ ] **Step 1: Add `customTitle` to `ThreadMeta`**

In `src/api/quorumApi.ts`, update the `ThreadMeta` type:

```typescript
export type ThreadMeta = {
  threadId: string;
  createdBy: string;
  customTitle?: string;  // User-set title, overrides auto-derived
};
```

- [ ] **Step 2: Add `'updateTitle'` action to `ThreadMessage`**

In `src/api/quorumApi.ts`, update the `ThreadMessage` type:

```typescript
export type ThreadMessage = {
  senderId: string;
  type: 'thread';
  targetMessageId: string;
  action: 'create' | 'updateTitle';
  threadMeta: ThreadMeta;
};
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors related to ThreadMeta or ThreadMessage.

- [ ] **Step 4: Commit**

```bash
git add src/api/quorumApi.ts
git commit -m "feat(threads): add customTitle to ThreadMeta, updateTitle action to ThreadMessage"
```

---

### Task 2: Update `getThreadTitle()` to use 100-char truncation and `customTitle`

**Files:**
- Modify: `src/components/thread/ThreadPanel.tsx:16-24`

- [ ] **Step 1: Update `getThreadTitle` function**

Replace the existing `getThreadTitle` function in `src/components/thread/ThreadPanel.tsx`:

```typescript
const THREAD_TITLE_MAX_CHARS = 100;

/**
 * Derive display title from root message.
 * Resolution order: customTitle → first 100 chars of message text → "Thread" fallback.
 */
function getThreadTitle(rootMessage: { content?: any; threadMeta?: { customTitle?: string } } | null): string {
  if (!rootMessage) return 'Thread';
  if (rootMessage.threadMeta?.customTitle) return rootMessage.threadMeta.customTitle;
  if (!rootMessage?.content) return 'Thread';
  const content = rootMessage.content as PostMessage;
  if (!content.text) return 'Thread';
  const text = Array.isArray(content.text) ? content.text.join(' ') : content.text;
  const clean = text.replace(/[*_~`#>[\]()!]/g, '').trim();
  if (!clean) return 'Thread';
  return clean.length > THREAD_TITLE_MAX_CHARS
    ? clean.substring(0, THREAD_TITLE_MAX_CHARS)
    : clean;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/thread/ThreadPanel.tsx
git commit -m "feat(threads): truncate auto-derived title to 100 chars, read customTitle"
```

---

## Chunk 2: Broadcast — send and receive `updateTitle`

### Task 3: Add `updateTitle` action to `ThreadActions` and implement send

**Files:**
- Modify: `src/components/context/ThreadContext.tsx:45-50` (ThreadActions interface)
- Modify: `src/components/space/Channel.tsx` (implement handler + wire to context)

- [ ] **Step 1: Add `updateTitle` to `ThreadActions` interface**

In `src/components/context/ThreadContext.tsx`, update `ThreadActions`:

```typescript
interface ThreadActions {
  openThread: (message: MessageType) => void;
  closeThread: () => void;
  submitMessage: (message: string | object, inReplyTo?: string) => Promise<void>;
  submitSticker?: (stickerId: string, inReplyTo?: string) => Promise<void>;
  updateTitle: (targetMessageId: string, threadMeta: ThreadMeta | undefined, newTitle: string) => Promise<void>;
}
```

Add the `ThreadMeta` import at the top of `ThreadContext.tsx`:

```typescript
import type {
  Message as MessageType,
  Role,
  Channel,
  Sticker,
  Emoji,
  ThreadMeta,
} from '../../api/quorumApi';
```

Update `defaultActions` to include a no-op:

```typescript
const defaultActions: ThreadActions = {
  openThread: noop,
  closeThread: noop,
  submitMessage: noopAsync,
  updateTitle: noopAsync,
};
```

- [ ] **Step 2: Implement `handleUpdateThreadTitle` in `Channel.tsx`**

In `src/components/space/Channel.tsx`, add this callback after `handleSubmitThreadSticker`:

```typescript
// Handle updating the thread title and broadcasting to peers
const handleUpdateThreadTitle = useCallback(
  async (targetMessageId: string, threadMeta: ThreadMeta | undefined, newTitle: string) => {
    if (spaceId === channelId) return; // No threads in DMs
    if (!activeThreadId) return; // Need threadId to construct updatedMeta

    const trimmed = newTitle.trim();
    // Build updated threadMeta — merge with existing or construct from activeThreadId
    const updatedMeta: ThreadMeta = {
      threadId: threadMeta?.threadId ?? activeThreadId,
      createdBy: threadMeta?.createdBy ?? user.currentPasskeyInfo!.address,
      customTitle: trimmed || undefined,
    };

    const threadMessage: ThreadMessage = {
      type: 'thread',
      senderId: user.currentPasskeyInfo!.address,
      targetMessageId,
      action: 'updateTitle',
      threadMeta: updatedMeta,
    };

    const effectiveSkip = space?.isRepudiable ? skipSigning : false;
    await submitChannelMessage(
      spaceId,
      channelId,
      threadMessage,
      queryClient,
      user.currentPasskeyInfo!,
      undefined,        // inReplyTo
      effectiveSkip,
      isSpaceOwner
    );
  },
  [spaceId, channelId, activeThreadId, user.currentPasskeyInfo, submitChannelMessage, queryClient, space, skipSigning, isSpaceOwner]
);
```

Add missing imports at the top of `Channel.tsx` if not already present:
```typescript
import type { ThreadMessage, ThreadMeta } from '../../api/quorumApi';
```

- [ ] **Step 3: Wire `handleUpdateThreadTitle` into thread context**

In the `useEffect` that calls `threadCtx.setThreadActions` (around line 516):

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
  });
}, [handleOpenThread, handleSubmitThreadMessage, handleSubmitThreadSticker, handleUpdateThreadTitle]);
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/context/ThreadContext.tsx src/components/space/Channel.tsx
git commit -m "feat(threads): add updateTitle action to thread context and Channel handler"
```

---

### Task 4: Handle incoming `updateTitle` in `MessageService`

**Files:**
- Modify: `src/services/MessageService.ts` (two locations: `processMessage` ~line 797, `addMessage` ~line 1304)

- [ ] **Step 1: Handle `updateTitle` in `processMessage` (IndexedDB path)**

In `MessageService.ts`, find the block starting at line 797:

```typescript
} else if (decryptedContent.content.type === 'thread') {
  const threadMsg = decryptedContent.content as ThreadMessage;
  if (spaceId === channelId) return; // Reject DMs

  const targetMessage = await messageDB.getMessage({ spaceId, channelId, messageId: threadMsg.targetMessageId });
  if (!targetMessage) return;

  // Idempotent check for 'create'
  if (targetMessage.threadMeta?.threadId === threadMsg.threadMeta.threadId) return;
  ...
```

Replace the entire `else if (decryptedContent.content.type === 'thread')` block with:

```typescript
} else if (decryptedContent.content.type === 'thread') {
  const threadMsg = decryptedContent.content as ThreadMessage;
  if (spaceId === channelId) return; // Reject DMs

  const targetMessage = await messageDB.getMessage({
    spaceId,
    channelId,
    messageId: threadMsg.targetMessageId,
  });
  if (!targetMessage) return;

  if (threadMsg.action === 'create') {
    // Idempotent — skip if threadId already set
    if (targetMessage.threadMeta?.threadId === threadMsg.threadMeta.threadId) return;
  }
  // For 'updateTitle': always apply the patch (title can change multiple times)

  const updatedMessage: Message = {
    ...targetMessage,
    threadMeta: { ...targetMessage.threadMeta, ...threadMsg.threadMeta },
  };
  await messageDB.saveMessage(
    updatedMessage,
    0,
    spaceId,
    conversationType,
    updatedUserProfile.user_icon!,
    updatedUserProfile.display_name!,
    currentUserAddress
  );
```

- [ ] **Step 2: Handle `updateTitle` in `addMessage` (React Query cache path)**

In `MessageService.ts`, find the block starting at line 1304:

```typescript
} else if (decryptedContent.content.type === 'thread') {
  const threadMsg = decryptedContent.content as ThreadMessage;
  if (spaceId === channelId) return;

  queryClient.setQueryData(
    buildMessagesKey({ spaceId, channelId }),
    (oldData: InfiniteData<any>) => {
      ...
      pages: oldData.pages.map((page: any) => ({
        ...page,
        messages: page.messages.map((m: Message) =>
          m.messageId === threadMsg.targetMessageId
            ? { ...m, threadMeta: threadMsg.threadMeta }
            : m
        ),
      })),
```

Update the cache map to merge rather than replace (so `create` and `updateTitle` both work correctly):

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
              ? { ...m, threadMeta: { ...m.threadMeta, ...threadMsg.threadMeta } }
              : m
          ),
        })),
      };
    }
  );
```

After the `setQueryData` call (at the same indentation level, inside the `else if (type === 'thread')` block but **outside** the `setQueryData` updater function), add an invalidation so the open ThreadPanel reflects the updated root message:

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
                  ? { ...m, threadMeta: { ...m.threadMeta, ...threadMsg.threadMeta } }
                  : m
              ),
            })),
          };
        }
      );
      // Invalidate thread messages so the open panel re-reads the updated root.
      // Applies to both 'create' and 'updateTitle' actions (harmless for 'create').
      queryClient.invalidateQueries({
        queryKey: ['thread-messages', spaceId, channelId, threadMsg.threadMeta.threadId],
      });
    } else if (...
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 4: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "feat(threads): handle updateTitle action in MessageService (IndexedDB + React Query)"
```

---

## Chunk 3: UI — inline title editing in ThreadPanel

### Task 5: Add inline title editing to `ThreadPanel`

**Files:**
- Modify: `src/components/thread/ThreadPanel.tsx`
- Modify: `src/components/thread/ThreadPanel.scss`

- [ ] **Step 1: Add edit state and handlers to `ThreadPanel`**

In `ThreadPanel.tsx`, add these imports:

```typescript
import { Input } from '../primitives';
```

Add these state variables and handlers inside the component (after existing state declarations):

```typescript
const [isEditingTitle, setIsEditingTitle] = useState(false);
const [titleDraft, setTitleDraft] = useState('');

const handleTitleClick = useCallback(() => {
  setTitleDraft(rootMessage?.threadMeta?.customTitle ?? '');
  setIsEditingTitle(true);
}, [rootMessage]);

const handleTitleSave = useCallback(() => {
  if (!rootMessage) return;
  const trimmed = titleDraft.trim();
  // Only broadcast if value actually changed
  const current = rootMessage.threadMeta?.customTitle ?? '';
  if (trimmed !== current) {
    // threadMeta may be undefined in a race (message arrived before thread 'create' broadcast)
    // updateTitle in Channel.tsx constructs updatedMeta from scratch, so passing undefined is safe
    updateTitle(rootMessage.messageId, rootMessage.threadMeta, trimmed);
  }
  setIsEditingTitle(false);
}, [titleDraft, rootMessage, updateTitle]);

const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleTitleSave();
  } else if (e.key === 'Escape') {
    setIsEditingTitle(false);
  }
}, [handleTitleSave]);
```

Destructure `updateTitle` from `useThreadContext()`:

```typescript
const {
  isOpen,
  threadId,
  rootMessage,
  threadMessages,
  isLoading,
  closeThread,
  submitMessage,
  submitSticker,
  channelProps,
  targetMessageId,
  updateTitle,         // ← add this
} = useThreadContext();
```

- [ ] **Step 2: Replace the static title `<h2>` with the inline edit UI**

Find the header section in `ThreadPanel.tsx` and replace:

```tsx
<h2 className="thread-panel__title">{threadTitle}</h2>
```

With:

```tsx
<div className="thread-panel__title-area">
  <label className="thread-panel__title-label">{t`Thread Title`}</label>
  {isEditingTitle ? (
    <Input
      variant="minimal"
      value={titleDraft}
      onChange={(val) => setTitleDraft(val.slice(0, 100))}
      onBlur={handleTitleSave}
      onKeyDown={handleTitleKeyDown}
      placeholder={threadTitle}
      autoFocus
      className="thread-panel__title-input"
    />
  ) : (
    <div
      className="thread-panel__title"
      onClick={handleTitleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleTitleClick()}
      aria-label={t`Edit thread title`}
    >
      {threadTitle}
    </div>
  )}
</div>
```

- [ ] **Step 3: Update `ThreadPanel.scss` for title area**

In `ThreadPanel.scss`, replace the existing `h2#{&}__title` block and add the new classes:

```scss
&__title-area {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

&__title-label {
  font-size: $text-xs;
  color: var(--text-subtle);
  font-weight: 500;
}

&__title {
  font-weight: 700;
  font-size: $text-xl;
  color: var(--text-primary);
  margin: 0;
  word-break: break-word;
  cursor: pointer;
  border-radius: $rounded-sm;
  padding: 2px 4px;
  margin-left: -4px; // Compensate for padding so text aligns with label

  &:hover {
    background-color: var(--color-field-bg-focus);
  }
}

&__title-input {
  font-weight: 700;
  font-size: $text-xl;

  // Align input text with the display title
  .quorum-input--minimal {
    padding: 2px 4px;
    margin-left: -4px;
  }
}
```

Also remove the `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` properties that were on the old `h2` — the title now wraps freely.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

- [ ] **Step 5: Lint**

```bash
yarn lint
```

- [ ] **Step 6: Commit**

```bash
git add src/components/thread/ThreadPanel.tsx src/components/thread/ThreadPanel.scss
git commit -m "feat(threads): inline editable title in ThreadPanel header"
```

---

### Task 6: Expose `updateTitle` through `useThreadContext`

**Files:**
- Modify: `src/components/context/ThreadContext.tsx:154-159` (useThreadContext return value)

The `useThreadContext` hook spreads `...store.getThreadActions()`, so `updateTitle` is already included automatically once it's in `ThreadActions`. No changes needed here.

- [ ] **Step 1: Verify `updateTitle` is available in `useThreadContext`**

Confirm that `useThreadContext()` in `ThreadContext.tsx` returns `updateTitle` by checking the spread:

```typescript
return {
  ...store.getThreadState(),
  ...store.getThreadActions(),   // ← updateTitle comes from here
  channelProps: store.getChannelProps(),
};
```

No code change needed — this is a verification step only.

- [ ] **Step 2: Type-check the full project**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 3: Final lint and format**

```bash
yarn lint
yarn format
```

- [ ] **Step 4: Final commit**

```bash
git add -p
git commit -m "feat(threads): thread title editing complete — inline edit, broadcast, receive"
```

---

## Manual Testing Checklist

After implementation, verify these scenarios:

1. **Open thread from a message** — title area shows "Thread Title" label above the auto-derived first 100 chars of the message
2. **Click title** — switches to `<Input>` primitive with focus, placeholder shows the auto-derived title
3. **Type a new title, press Enter** — input closes, title updates immediately, other open clients see the new title
4. **Type a new title, blur** — same as above
5. **Press Escape** — input closes, title reverts to previous value, no broadcast
6. **Clear the typed title (empty), blur** — `customTitle` cleared, title reverts to auto-derived text
7. **Long message root** — auto-derived placeholder is exactly 100 chars, no ellipsis in input placeholder
8. **Narrow panel** — title wraps to multiple lines freely, no overflow clipping
9. **Root message deleted** — title falls back to `"Thread"`, editing still works

---

_Created: 2026-03-11_
