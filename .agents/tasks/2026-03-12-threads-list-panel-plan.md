# Threads List Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a channel-scoped Threads List Panel that lists all threads in the current channel grouped by participation and activity, accessible from the channel header.

**Architecture:** A new `channel_threads` IndexedDB store (DB v10) acts as a thread registry, written by `MessageService` on all thread lifecycle events. A `useChannelThreads` React Query hook reads it. `ThreadsListPanel` (wrapping `DropdownPanel`) renders grouped, searchable thread rows that open the existing `ThreadPanel` on click.

**Tech Stack:** React 18, TanStack React Query v5, Vitest + Testing Library, IndexedDB (Dexie-free raw IDB), TypeScript, SCSS

---

## Chunk 1: Data Layer — `ChannelThread` type + IndexedDB store + `getChannelThreads`

### Task 1: Add `ChannelThread` type to `quorumApi.ts`

**Files:**
- Modify: `src/api/quorumApi.ts` (after `ThreadMeta` type, ~line 163)

- [ ] **Step 1: Add the `ChannelThread` type**

Open `src/api/quorumApi.ts`. After the `ThreadMeta` type definition (~line 163), add:

```typescript
export type ChannelThread = {
  threadId: string;          // Primary key
  spaceId: string;
  channelId: string;
  rootMessageId: string;
  createdBy: string;         // senderId of thread creator
  createdAt: number;         // Unix timestamp ms
  lastActivityAt: number;    // Updated on each reply
  replyCount: number;        // Updated on each reply
  isClosed: boolean;
  customTitle?: string;      // Mirrors threadMeta.customTitle
  titleSnapshot?: string;    // First 100 chars of root message text, markdown stripped
  hasParticipated: boolean;  // true if the local user has sent a reply
};
```

- [ ] **Step 2: Commit**

```bash
git add src/api/quorumApi.ts
git commit -m "feat: add ChannelThread type"
```

---

### Task 2: Add `channel_threads` store to IndexedDB (DB v10)

**Files:**
- Modify: `src/db/messages.ts` (~line 144 for version bump, ~line 269 for upgrade block)

- [ ] **Step 1: Write the failing test**

Create `src/dev/tests/db/channelThreads.test.ts`:

```typescript
import 'fake-indexeddb/auto'; // Required: jsdom has no real IDBFactory; this polyfills it
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageDB } from '../../../db/messages';
import type { ChannelThread } from '../../../api/quorumApi';

describe('MessageDB - channel_threads store', () => {
  let db: MessageDB;

  beforeEach(async () => {
    db = new MessageDB();
    await db.init();
  });

  afterEach(async () => {
    await db.close?.();
    indexedDB.deleteDatabase('quorum-messages');
  });

  it('saves and retrieves a ChannelThread by channel', async () => {
    const thread: ChannelThread = {
      threadId: 'thread-1',
      spaceId: 'space-1',
      channelId: 'channel-1',
      rootMessageId: 'msg-1',
      createdBy: 'user-1',
      createdAt: 1000,
      lastActivityAt: 2000,
      replyCount: 3,
      isClosed: false,
      hasParticipated: false,
    };
    await db.saveChannelThread(thread);
    const results = await db.getChannelThreads({ spaceId: 'space-1', channelId: 'channel-1' });
    expect(results).toHaveLength(1);
    expect(results[0].threadId).toBe('thread-1');
  });

  it('returns only threads for the requested channel', async () => {
    await db.saveChannelThread({
      threadId: 'thread-a', spaceId: 'space-1', channelId: 'channel-1',
      rootMessageId: 'msg-a', createdBy: 'user-1', createdAt: 1000,
      lastActivityAt: 1000, replyCount: 0, isClosed: false, hasParticipated: false,
    });
    await db.saveChannelThread({
      threadId: 'thread-b', spaceId: 'space-1', channelId: 'channel-2',
      rootMessageId: 'msg-b', createdBy: 'user-1', createdAt: 1000,
      lastActivityAt: 1000, replyCount: 0, isClosed: false, hasParticipated: false,
    });
    const results = await db.getChannelThreads({ spaceId: 'space-1', channelId: 'channel-1' });
    expect(results).toHaveLength(1);
    expect(results[0].threadId).toBe('thread-a');
  });

  it('deletes a ChannelThread by threadId', async () => {
    await db.saveChannelThread({
      threadId: 'thread-del', spaceId: 'space-1', channelId: 'channel-1',
      rootMessageId: 'msg-1', createdBy: 'user-1', createdAt: 1000,
      lastActivityAt: 1000, replyCount: 0, isClosed: false, hasParticipated: false,
    });
    await db.deleteChannelThread('thread-del');
    const results = await db.getChannelThreads({ spaceId: 'space-1', channelId: 'channel-1' });
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/dev/tests/db/channelThreads.test.ts
```

Expected: FAIL — `saveChannelThread` and `getChannelThreads` not defined.

- [ ] **Step 3: Bump DB version and add upgrade block**

In `src/db/messages.ts`:

1. Change line ~144: `private readonly DB_VERSION = 9;` → `private readonly DB_VERSION = 10;`

2. In the `onupgradeneeded` handler, after the existing `if (event.oldVersion < 9)` block (~line 269), add:

```typescript
if (event.oldVersion < 10) {
  const channelThreadsStore = db.createObjectStore('channel_threads', {
    keyPath: 'threadId',
  });
  channelThreadsStore.createIndex('by_channel', ['spaceId', 'channelId']);
}
```

- [ ] **Step 4: Add `saveChannelThread`, `getChannelThreads`, and `deleteChannelThread` methods**

In `src/db/messages.ts`, add these three methods after `getThreadStats` (~line 621):

```typescript
async saveChannelThread(thread: ChannelThread): Promise<void> {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction('channel_threads', 'readwrite');
    const store = transaction.objectStore('channel_threads');
    const request = store.put(thread);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async getChannelThreads({
  spaceId,
  channelId,
}: {
  spaceId: string;
  channelId: string;
}): Promise<ChannelThread[]> {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction('channel_threads', 'readonly');
    const store = transaction.objectStore('channel_threads');
    const index = store.index('by_channel');
    const range = IDBKeyRange.only([spaceId, channelId]);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result as ChannelThread[]);
    request.onerror = () => reject(request.error);
  });
}

async deleteChannelThread(threadId: string): Promise<void> {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction('channel_threads', 'readwrite');
    const store = transaction.objectStore('channel_threads');
    const request = store.delete(threadId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
```

Also add the `ChannelThread` import at the top of `src/db/messages.ts`:
```typescript
import type { ..., ChannelThread } from '../api/quorumApi';
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/dev/tests/db/channelThreads.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/messages.ts src/dev/tests/db/channelThreads.test.ts
git commit -m "feat: add channel_threads IndexedDB store (DB v10)"
```

---

## Chunk 2: MessageService write paths

### Task 3: Wire `MessageService` to write `channel_threads` on thread lifecycle events

**Files:**
- Modify: `src/services/MessageService.ts` (thread handling section ~lines 797–872)

The `MessageService` already receives `currentUserAddress` as a parameter — this is the local user identity used for auth checks throughout. Use `currentUserAddress` for the `hasParticipated` comparison.

**Helper to strip markdown for `titleSnapshot`:** Use the existing `stripMarkdown` from `src/utils/markdownStripping.ts` — it uses `remark` + `strip-markdown` and handles GFM, mentions, YouTube embeds, etc. Do NOT write a custom regex — the existing utility is production-quality and already available.

- [ ] **Step 1: Write the failing test**

Create `src/dev/tests/services/channelThreadsWritePaths.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChannelThread } from '../../../api/quorumApi';

// Mock messageDB
const mockSaveChannelThread = vi.fn();
const mockGetChannelThread = vi.fn();
const mockDeleteChannelThread = vi.fn();
const mockGetMessage = vi.fn();
const mockSaveMessage = vi.fn();

// We test the helper functions extracted from MessageService rather than
// the full service to keep tests focused. The full integration is covered
// by the existing MessageService.unit.test.tsx patterns.

// Import the private helpers once they are extracted (see Step 3)
import {
  buildChannelThreadFromCreate,
  updateChannelThreadOnReply,
} from '../../../services/channelThreadHelpers';

describe('channelThreadHelpers', () => {
  it('buildChannelThreadFromCreate produces correct ChannelThread', () => {
    const result = buildChannelThreadFromCreate({
      spaceId: 'space-1',
      channelId: 'channel-1',
      rootMessageId: 'msg-1',
      threadMeta: {
        threadId: 'thread-1',
        createdBy: 'user-creator',
        lastActivityAt: 5000,
      },
      rootMessageText: 'Hello world this is a long message',
      currentUserAddress: 'user-creator',
      now: 5000,
    });

    expect(result.threadId).toBe('thread-1');
    expect(result.createdBy).toBe('user-creator');
    expect(result.hasParticipated).toBe(true); // creator = currentUser
    expect(result.titleSnapshot).toBe('Hello world this is a long message');
    expect(result.replyCount).toBe(0);
    expect(result.isClosed).toBe(false);
  });

  it('buildChannelThreadFromCreate sets hasParticipated=false for other users', () => {
    const result = buildChannelThreadFromCreate({
      spaceId: 'space-1',
      channelId: 'channel-1',
      rootMessageId: 'msg-1',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-other', lastActivityAt: 5000 },
      rootMessageText: 'Test',
      currentUserAddress: 'user-local',
      now: 5000,
    });
    expect(result.hasParticipated).toBe(false);
  });

  it('updateChannelThreadOnReply increments replyCount and updates lastActivityAt', () => {
    const existing: ChannelThread = {
      threadId: 'thread-1', spaceId: 'space-1', channelId: 'channel-1',
      rootMessageId: 'msg-1', createdBy: 'user-1', createdAt: 1000,
      lastActivityAt: 1000, replyCount: 2, isClosed: false, hasParticipated: false,
    };
    const updated = updateChannelThreadOnReply({
      existing,
      replySenderId: 'user-local',
      replyTimestamp: 9000,
      currentUserAddress: 'user-local',
    });
    expect(updated.replyCount).toBe(3);
    expect(updated.lastActivityAt).toBe(9000);
    expect(updated.hasParticipated).toBe(true);
  });

  it('updateChannelThreadOnReply preserves hasParticipated=true once set', () => {
    const existing: ChannelThread = {
      threadId: 'thread-1', spaceId: 'space-1', channelId: 'channel-1',
      rootMessageId: 'msg-1', createdBy: 'user-1', createdAt: 1000,
      lastActivityAt: 1000, replyCount: 1, isClosed: false, hasParticipated: true,
    };
    const updated = updateChannelThreadOnReply({
      existing,
      replySenderId: 'user-other',
      replyTimestamp: 9000,
      currentUserAddress: 'user-local',
    });
    expect(updated.hasParticipated).toBe(true); // already true, stays true
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/dev/tests/services/channelThreadsWritePaths.test.ts
```

Expected: FAIL — `channelThreadHelpers` module not found.

- [ ] **Step 3: Create `src/services/channelThreadHelpers.ts`**

```typescript
import type { ChannelThread, ThreadMeta } from '../api/quorumApi';
import { stripMarkdown } from '../utils/markdownStripping';

export function buildChannelThreadFromCreate({
  spaceId,
  channelId,
  rootMessageId,
  threadMeta,
  rootMessageText,
  currentUserAddress,
  now,
}: {
  spaceId: string;
  channelId: string;
  rootMessageId: string;
  threadMeta: ThreadMeta;
  rootMessageText: string;
  currentUserAddress: string;
  now: number;
}): ChannelThread {
  const stripped = stripMarkdown(rootMessageText).slice(0, 100);
  return {
    threadId: threadMeta.threadId,
    spaceId,
    channelId,
    rootMessageId,
    createdBy: threadMeta.createdBy,
    createdAt: now,
    lastActivityAt: threadMeta.lastActivityAt ?? now,
    replyCount: 0,
    isClosed: false,
    customTitle: threadMeta.customTitle,
    titleSnapshot: stripped || undefined,
    hasParticipated: threadMeta.createdBy === currentUserAddress,
  };
}

export function updateChannelThreadOnReply({
  existing,
  replySenderId,
  replyTimestamp,
  currentUserAddress,
}: {
  existing: ChannelThread;
  replySenderId: string;
  replyTimestamp: number;
  currentUserAddress: string;
}): ChannelThread {
  return {
    ...existing,
    replyCount: existing.replyCount + 1,
    lastActivityAt: replyTimestamp,
    hasParticipated:
      existing.hasParticipated || replySenderId === currentUserAddress,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/dev/tests/services/channelThreadsWritePaths.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Wire helpers into `MessageService`**

In `src/services/MessageService.ts`, add import at the top:
```typescript
import {
  buildChannelThreadFromCreate,
  updateChannelThreadOnReply,
} from './channelThreadHelpers';
```

**In the `action='create'` block** (~line 830, right after the idempotency guard passes and before `saveMessage`):

```typescript
// Write to channel_threads registry
const rootText =
  (targetMessage.content as { text?: string })?.text ?? '';
const newThread = buildChannelThreadFromCreate({
  spaceId,
  channelId,
  rootMessageId: threadMsg.targetMessageId,
  threadMeta: threadMsg.threadMeta,
  rootMessageText: typeof rootText === 'string' ? rootText : '',
  currentUserAddress,
  now: Date.now(),
});
await messageDB.saveChannelThread(newThread);
```

**For incoming thread replies** — find the section where `isThreadReply` messages are persisted (~line 750 area). After the `messageDB.saveMessage(...)` call for a thread reply, add:

Note: `getChannelThreads` returns all threads for the channel then we `.find()` in JS. This is acceptable because thread counts per channel are expected to be small (tens, not thousands). A dedicated `getChannelThread(threadId)` direct key lookup can be added later if profiling shows it matters.

```typescript
// Update channel_threads registry
const existingThreadEntry = await messageDB.getChannelThreads({
  spaceId,
  channelId,
}).then(list => list.find(t => t.threadId === incomingMessage.threadId));

if (existingThreadEntry) {
  const updated = updateChannelThreadOnReply({
    existing: existingThreadEntry,
    replySenderId: incomingMessage.content.senderId,
    replyTimestamp: incomingMessage.createdDate,
    currentUserAddress,
  });
  await messageDB.saveChannelThread(updated);
}
```

**For `action='updateSettings'` / `action='close'` / `action='reopen'`** (~line 860 area, after the auth checks), after the `saveMessage` call for each action, add:

```typescript
// Sync channel_threads registry
const threads = await messageDB.getChannelThreads({ spaceId, channelId });
const entry = threads.find(t => t.threadId === threadMsg.threadMeta.threadId);
if (entry) {
  await messageDB.saveChannelThread({
    ...entry,
    isClosed: threadMsg.action === 'close'
      ? true
      : threadMsg.action === 'reopen'
        ? false
        : entry.isClosed,
    customTitle: threadMsg.threadMeta.customTitle ?? entry.customTitle,
  });
}
```

**For `action='remove'`** (~line 855, after `deleteMessage` loop), add:
```typescript
await messageDB.deleteChannelThread(threadMsg.threadMeta.threadId);
queryClient.invalidateQueries({
  queryKey: ['channel-threads', spaceId, channelId],
});
```

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
npx vitest run src/dev/tests/services/
```

Expected: all existing service tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/services/MessageService.ts src/services/channelThreadHelpers.ts src/dev/tests/services/channelThreadsWritePaths.test.ts
git commit -m "feat: wire MessageService to write channel_threads registry"
```

---

## Chunk 3: React Query hook + `DropdownPanel` header slot

### Task 4: Add `useChannelThreads` hook

**Files:**
- Create: `src/hooks/business/threads/useChannelThreads.ts`
- Modify: `src/hooks/business/threads/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/dev/tests/hooks/useChannelThreads.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ChannelThread } from '../../../api/quorumApi';

const mockGetChannelThreads = vi.fn();
vi.mock('../../../components/context/useMessageDB', () => ({
  useMessageDB: () => ({ messageDB: { getChannelThreads: mockGetChannelThreads } }),
}));

import { useChannelThreads } from '../../../hooks/business/threads/useChannelThreads';

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

const mockThreads: ChannelThread[] = [
  {
    threadId: 'thread-1', spaceId: 'space-1', channelId: 'channel-1',
    rootMessageId: 'msg-1', createdBy: 'user-1', createdAt: 1000,
    lastActivityAt: 3000, replyCount: 2, isClosed: false, hasParticipated: true,
  },
  {
    threadId: 'thread-2', spaceId: 'space-1', channelId: 'channel-1',
    rootMessageId: 'msg-2', createdBy: 'user-2', createdAt: 500,
    lastActivityAt: 1000, replyCount: 1, isClosed: false, hasParticipated: false,
  },
];

describe('useChannelThreads', () => {
  it('returns threads sorted by lastActivityAt desc', async () => {
    mockGetChannelThreads.mockResolvedValue(mockThreads);
    const { result } = renderHook(
      () => useChannelThreads({ spaceId: 'space-1', channelId: 'channel-1' }),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data![0].threadId).toBe('thread-1'); // lastActivityAt 3000
    expect(result.current.data![1].threadId).toBe('thread-2'); // lastActivityAt 1000
  });

  it('does not fetch when enabled=false', () => {
    const { result } = renderHook(
      () => useChannelThreads({ spaceId: 'space-1', channelId: 'channel-1', enabled: false }),
      { wrapper: makeWrapper() }
    );
    expect(result.current.data).toBeUndefined();
    expect(mockGetChannelThreads).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/dev/tests/hooks/useChannelThreads.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/hooks/business/threads/useChannelThreads.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';
import type { ChannelThread } from '../../../api/quorumApi';

export function useChannelThreads({
  spaceId,
  channelId,
  enabled = true,
}: {
  spaceId: string;
  channelId: string;
  enabled?: boolean;
}) {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: ['channel-threads', spaceId, channelId],
    queryFn: async (): Promise<ChannelThread[]> => {
      const threads = await messageDB.getChannelThreads({ spaceId, channelId });
      return [...threads].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    },
    enabled,
    networkMode: 'always',
    staleTime: 30 * 1000,
  });
}
```

- [ ] **Step 4: Export from threads index**

In `src/hooks/business/threads/index.ts`, add:
```typescript
export { useChannelThreads } from './useChannelThreads';
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/dev/tests/hooks/useChannelThreads.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/business/threads/useChannelThreads.ts src/hooks/business/threads/index.ts src/dev/tests/hooks/useChannelThreads.test.ts
git commit -m "feat: add useChannelThreads hook"
```

---

### Task 5: Add `headerContent` prop to `DropdownPanel`

**Files:**
- Modify: `src/components/ui/DropdownPanel.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/dev/tests/components/DropdownPanelHeaderContent.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DropdownPanel } from '../../../components/ui/DropdownPanel';

describe('DropdownPanel - headerContent prop', () => {
  it('renders headerContent instead of title when provided', () => {
    render(
      <DropdownPanel
        isOpen={true}
        onClose={vi.fn()}
        showCloseButton={false}
        headerContent={<span data-testid="custom-header">Custom Header</span>}
        useMobileBottomSheet={false}
      >
        <div>body</div>
      </DropdownPanel>
    );
    expect(screen.getByTestId('custom-header')).toBeInTheDocument();
    expect(screen.queryByText('Custom Header')).toBeInTheDocument();
  });

  it('still renders title when headerContent is not provided', () => {
    render(
      <DropdownPanel
        isOpen={true}
        onClose={vi.fn()}
        title="My Title"
        showCloseButton={false}
        useMobileBottomSheet={false}
      >
        <div>body</div>
      </DropdownPanel>
    );
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/dev/tests/components/DropdownPanelHeaderContent.test.tsx
```

Expected: FAIL — `headerContent` prop does not exist.

- [ ] **Step 3: Add `headerContent` prop to `DropdownPanel`**

In `src/components/ui/DropdownPanel.tsx`:

1. Add to the `DropdownPanelProps` interface (after `useMobileBottomSheet`):
```typescript
headerContent?: React.ReactNode;
```

2. Update the header rendering section (~lines 168–188). Replace the current `{(title || resultsCount !== undefined) && (` block with:

```typescript
{(title || resultsCount !== undefined || headerContent) && (
  <Container className="dropdown-panel__header">
    <Flex className="items-center justify-between">
      {headerContent ?? (
        <span className="dropdown-panel__title">
          {title ||
            (resultsCount === 1
              ? `${resultsCount} result`
              : `${resultsCount} results`)}
        </span>
      )}
      {showCloseButton && (
        <Button
          type="unstyled"
          onClick={onClose}
          className="dropdown-panel__close"
        >
          <Icon name="close" size="sm" />
        </Button>
      )}
    </Flex>
  </Container>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/dev/tests/components/DropdownPanelHeaderContent.test.tsx
```

Expected: 2 tests PASS.

- [ ] **Step 5: Run full component tests to check no regressions**

```bash
npx vitest run src/dev/tests/components/
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/DropdownPanel.tsx src/dev/tests/components/DropdownPanelHeaderContent.test.tsx
git commit -m "feat: add headerContent prop to DropdownPanel"
```

---

## Chunk 4: `ThreadListItem` + `ThreadsListPanel` components

### Task 6: Build `ThreadListItem`

**Files:**
- Create: `src/components/thread/ThreadListItem.tsx`

This component receives a `ChannelThread` and an `onOpen` callback. It resolves the display title and calls `onOpen` when clicked.

- [ ] **Step 1: Write the failing test**

Create `src/dev/tests/components/ThreadListItem.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThreadListItem } from '../../../components/thread/ThreadListItem';
import type { ChannelThread } from '../../../api/quorumApi';

const baseThread: ChannelThread = {
  threadId: 'thread-1', spaceId: 'space-1', channelId: 'ch-1',
  rootMessageId: 'msg-1', createdBy: 'user-1', createdAt: 1000,
  lastActivityAt: 5000, replyCount: 3, isClosed: false, hasParticipated: false,
};

describe('ThreadListItem', () => {
  it('renders customTitle when provided', () => {
    render(
      <ThreadListItem
        thread={{ ...baseThread, customTitle: 'My Custom Title' }}
        onOpen={vi.fn()}
        resolveDisplayName={() => 'Alice'}
      />
    );
    expect(screen.getByText('My Custom Title')).toBeInTheDocument();
  });

  it('falls back to titleSnapshot when no customTitle', () => {
    render(
      <ThreadListItem
        thread={{ ...baseThread, titleSnapshot: 'Snapshot text' }}
        onOpen={vi.fn()}
        resolveDisplayName={() => 'Alice'}
      />
    );
    expect(screen.getByText('Snapshot text')).toBeInTheDocument();
  });

  it('falls back to "Thread" when neither customTitle nor titleSnapshot', () => {
    render(
      <ThreadListItem
        thread={baseThread}
        onOpen={vi.fn()}
        resolveDisplayName={() => 'Alice'}
      />
    );
    expect(screen.getByText('Thread')).toBeInTheDocument();
  });

  it('shows lock icon when thread is closed', () => {
    render(
      <ThreadListItem
        thread={{ ...baseThread, isClosed: true }}
        onOpen={vi.fn()}
        resolveDisplayName={() => 'Alice'}
      />
    );
    expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
  });

  it('calls onOpen when row is clicked', async () => {
    const user = userEvent.setup();
    const handleOpen = vi.fn();
    render(
      <ThreadListItem
        thread={baseThread}
        onOpen={handleOpen}
        resolveDisplayName={() => 'Alice'}
      />
    );
    await user.click(screen.getByRole('button'));
    expect(handleOpen).toHaveBeenCalledWith('msg-1'); // rootMessageId
  });

  it('shows reply count in meta', () => {
    render(
      <ThreadListItem
        thread={{ ...baseThread, replyCount: 5 }}
        onOpen={vi.fn()}
        resolveDisplayName={() => 'Alice'}
      />
    );
    expect(screen.getByText(/5 replies/)).toBeInTheDocument();
  });

  it('shows singular "1 reply" for replyCount=1', () => {
    render(
      <ThreadListItem
        thread={{ ...baseThread, replyCount: 1 }}
        onOpen={vi.fn()}
        resolveDisplayName={() => 'Alice'}
      />
    );
    expect(screen.getByText(/1 reply/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/dev/tests/components/ThreadListItem.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/components/thread/ThreadListItem.tsx`**

```typescript
import React from 'react';
import { formatRelativeTime } from '@quilibrium/quorum-shared';
import { Icon } from '../ui/Icon';
import type { ChannelThread } from '../../api/quorumApi';

interface ThreadListItemProps {
  thread: ChannelThread;
  onOpen: (rootMessageId: string) => void;
  resolveDisplayName: (senderId: string) => string;
}

export function ThreadListItem({ thread, onOpen, resolveDisplayName }: ThreadListItemProps) {
  const title = thread.customTitle ?? thread.titleSnapshot ?? 'Thread';
  const creatorName = resolveDisplayName(thread.createdBy);
  const replyLabel = thread.replyCount === 1 ? '1 reply' : `${thread.replyCount} replies`;
  const timeAgo = formatRelativeTime(thread.lastActivityAt);

  return (
    <button
      className="thread-list-item"
      onClick={() => onOpen(thread.rootMessageId)}
      type="button"
    >
      <div className="thread-list-item__title-row">
        {thread.isClosed && (
          <Icon name="lock" size="sm" data-testid="lock-icon" className="thread-list-item__lock" />
        )}
        <span className="thread-list-item__title">{title}</span>
      </div>
      <div className="thread-list-item__meta">
        <span>{`Started by ${creatorName}`}</span>
        <span className="thread-list-item__dot">·</span>
        <span>{replyLabel}</span>
        <span className="thread-list-item__dot">·</span>
        <span>{timeAgo}</span>
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/dev/tests/components/ThreadListItem.test.tsx
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/thread/ThreadListItem.tsx src/dev/tests/components/ThreadListItem.test.tsx
git commit -m "feat: add ThreadListItem component"
```

---

### Task 7: Build `ThreadsListPanel`

**Files:**
- Create: `src/components/thread/ThreadsListPanel.tsx`
- Create: `src/components/thread/ThreadsListPanel.scss`

- [ ] **Step 1: Write the failing test**

Create `src/dev/tests/components/ThreadsListPanel.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ChannelThread } from '../../../api/quorumApi';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const now = Date.now();

const joinedThread: ChannelThread = {
  threadId: 'joined-1', spaceId: 's1', channelId: 'c1', rootMessageId: 'msg-j',
  createdBy: 'user-a', createdAt: now - 1000, lastActivityAt: now - 1000,
  replyCount: 2, isClosed: false, hasParticipated: true,
  customTitle: 'Joined Thread',
};
const activeThread: ChannelThread = {
  threadId: 'active-1', spaceId: 's1', channelId: 'c1', rootMessageId: 'msg-a',
  createdBy: 'user-b', createdAt: now - 2000, lastActivityAt: now - 2000,
  replyCount: 1, isClosed: false, hasParticipated: false,
  customTitle: 'Active Thread',
};
const olderThread: ChannelThread = {
  threadId: 'older-1', spaceId: 's1', channelId: 'c1', rootMessageId: 'msg-o',
  createdBy: 'user-c', createdAt: now - SEVEN_DAYS_MS - 10000,
  lastActivityAt: now - SEVEN_DAYS_MS - 10000,
  replyCount: 0, isClosed: false, hasParticipated: false,
  customTitle: 'Older Thread',
};

const mockUseChannelThreads = vi.fn();
vi.mock('../../../hooks/business/threads/useChannelThreads', () => ({
  useChannelThreads: (args: unknown) => mockUseChannelThreads(args),
}));

vi.mock('../../../components/context/ThreadContext', () => ({
  useThreadContext: () => ({
    openThread: vi.fn(),
    closeThread: vi.fn(),
  }),
}));

import { ThreadsListPanel } from '../../../components/thread/ThreadsListPanel';

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe('ThreadsListPanel', () => {
  it('renders section headers for joined, active, and older groups', () => {
    mockUseChannelThreads.mockReturnValue({
      data: [joinedThread, activeThread, olderThread],
      isLoading: false,
    });
    render(
      <ThreadsListPanel isOpen={true} onClose={vi.fn()} spaceId="s1" channelId="c1"
        mapSenderToUser={() => ({ displayName: 'Alice' })} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByText(/joined threads/i)).toBeInTheDocument();
    expect(screen.getByText(/other active threads/i)).toBeInTheDocument();
    expect(screen.getByText(/older threads/i)).toBeInTheDocument();
  });

  it('does not render empty sections', () => {
    mockUseChannelThreads.mockReturnValue({
      data: [activeThread],
      isLoading: false,
    });
    render(
      <ThreadsListPanel isOpen={true} onClose={vi.fn()} spaceId="s1" channelId="c1"
        mapSenderToUser={() => ({ displayName: 'Alice' })} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.queryByText(/joined threads/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/older threads/i)).not.toBeInTheDocument();
    expect(screen.getByText(/other active threads/i)).toBeInTheDocument();
  });

  it('shows empty state when no threads', () => {
    mockUseChannelThreads.mockReturnValue({ data: [], isLoading: false });
    render(
      <ThreadsListPanel isOpen={true} onClose={vi.fn()} spaceId="s1" channelId="c1"
        mapSenderToUser={() => ({ displayName: 'Alice' })} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByText(/no threads yet/i)).toBeInTheDocument();
  });

  it('filters by search query, hiding section headers', async () => {
    const user = userEvent.setup();
    mockUseChannelThreads.mockReturnValue({
      data: [joinedThread, activeThread],
      isLoading: false,
    });
    render(
      <ThreadsListPanel isOpen={true} onClose={vi.fn()} spaceId="s1" channelId="c1"
        mapSenderToUser={() => ({ displayName: 'Alice' })} />,
      { wrapper: makeWrapper() }
    );
    const input = screen.getByPlaceholderText(/search threads/i);
    await user.type(input, 'Joined');
    expect(screen.getByText('Joined Thread')).toBeInTheDocument();
    expect(screen.queryByText('Active Thread')).not.toBeInTheDocument();
    expect(screen.queryByText(/joined threads/i)).not.toBeInTheDocument(); // section header gone
  });

  it('shows no-results state when search has no matches', async () => {
    const user = userEvent.setup();
    mockUseChannelThreads.mockReturnValue({
      data: [joinedThread],
      isLoading: false,
    });
    render(
      <ThreadsListPanel isOpen={true} onClose={vi.fn()} spaceId="s1" channelId="c1"
        mapSenderToUser={() => ({ displayName: 'Alice' })} />,
      { wrapper: makeWrapper() }
    );
    await user.type(screen.getByPlaceholderText(/search threads/i), 'zzznomatch');
    expect(screen.getByText(/no threads match/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/dev/tests/components/ThreadsListPanel.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/components/thread/ThreadsListPanel.tsx`**

```typescript
import React, { useState, useMemo, useEffect } from 'react';
import { t } from '@lingui/macro';
import { DropdownPanel } from '../ui/DropdownPanel';
import { ThreadListItem } from './ThreadListItem';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Flex } from '../ui/Flex';
import { useChannelThreads } from '../../hooks/business/threads/useChannelThreads';
import { useMessageDB } from '../context/useMessageDB';
import { useThreadContext } from '../context/ThreadContext';
import { isTouchDevice } from '../../utils/device';
import type { ChannelThread } from '../../api/quorumApi';
import './ThreadsListPanel.scss';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface ThreadsListPanelProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  channelId: string;
  mapSenderToUser: (senderId: string) => { displayName?: string } | undefined;
}

type ListItem =
  | { type: 'header'; label: string }
  | { type: 'thread'; thread: ChannelThread };

export function ThreadsListPanel({
  isOpen,
  onClose,
  spaceId,
  channelId,
  mapSenderToUser,
}: ThreadsListPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { messageDB } = useMessageDB();
  const { openThread } = useThreadContext();
  const { data: threads = [], isLoading } = useChannelThreads({
    spaceId,
    channelId,
    enabled: isOpen,
  });

  // Clear search when panel closes
  useEffect(() => {
    if (!isOpen) setSearchQuery('');
  }, [isOpen]);

  const resolveDisplayName = (senderId: string) =>
    mapSenderToUser(senderId)?.displayName ?? senderId;

  const listItems = useMemo((): ListItem[] => {
    const now = Date.now();
    const query = searchQuery.trim().toLowerCase();

    if (query) {
      const filtered = threads.filter((t) => {
        const title = (t.customTitle ?? t.titleSnapshot ?? 'Thread').toLowerCase();
        return title.includes(query);
      });
      return filtered.map((thread) => ({ type: 'thread', thread }));
    }

    const joined = threads.filter((t) => t.hasParticipated);
    const active = threads.filter(
      (t) => !t.hasParticipated && t.lastActivityAt > now - SEVEN_DAYS_MS
    );
    const older = threads.filter(
      (t) => !t.hasParticipated && t.lastActivityAt <= now - SEVEN_DAYS_MS
    );

    const items: ListItem[] = [];
    if (joined.length > 0) {
      items.push({ type: 'header', label: t`JOINED THREADS` });
      joined.forEach((thread) => items.push({ type: 'thread', thread }));
    }
    if (active.length > 0) {
      items.push({ type: 'header', label: t`OTHER ACTIVE THREADS` });
      active.forEach((thread) => items.push({ type: 'thread', thread }));
    }
    if (older.length > 0) {
      items.push({ type: 'header', label: t`OLDER THREADS` });
      older.forEach((thread) => items.push({ type: 'thread', thread }));
    }
    return items;
  }, [threads, searchQuery]);

  const handleOpen = async (rootMessageId: string) => {
    // Use getMessageById for O(1) direct keyPath lookup — does not require spaceId/channelId.
    // Note: messageDB.getMessage({ spaceId, channelId, messageId }) is a different method that
    // uses the compound index. getMessageById is the correct choice here.
    const rootMessage = await messageDB.getMessageById(rootMessageId);
    if (!rootMessage) return;
    openThread(rootMessage);
    onClose();
  };

  const headerContent = (
    <Flex className="threads-panel__header-row items-center gap-2 flex-1">
      <span className="threads-panel__title">{t`Threads`}</span>
      <div className="threads-panel__search-wrap">
        <Icon name="search" size="sm" className="threads-panel__search-icon" />
        <input
          className="threads-panel__search"
          placeholder={t`Search threads…`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <Button
        type="unstyled"
        icon="plus"
        iconSize="sm"
        disabled
        tooltip={t`Coming soon`}
        className="threads-panel__create-btn header-icon-button"
      />
    </Flex>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <Flex justify="center" align="center" className="threads-empty-state">
          <Icon name="spinner" className="loading-icon icon-spin" />
        </Flex>
      );
    }

    if (threads.length === 0) {
      return (
        <Flex justify="center" align="center" className="threads-empty-state">
          <Icon name="messages" size="3xl" className="empty-icon" />
          <span className="empty-message">{t`No threads yet`}</span>
          <span className="empty-hint">{t`Start a thread from any message`}</span>
        </Flex>
      );
    }

    if (searchQuery && listItems.length === 0) {
      return (
        <Flex justify="center" align="center" className="threads-empty-state">
          <Icon name="search" size="3xl" className="empty-icon" />
          <span className="empty-message">{t`No threads match your search`}</span>
        </Flex>
      );
    }

    if (isTouchDevice()) {
      return (
        <div className="mobile-drawer__item-list">
          {listItems.map((item, i) =>
            item.type === 'header' ? (
              <div key={`header-${i}`} className="threads-section-header">
                {item.label}
              </div>
            ) : (
              <div
                key={item.thread.threadId}
                className="mobile-drawer__item-box mobile-drawer__item-box--interactive"
              >
                <ThreadListItem
                  thread={item.thread}
                  onOpen={handleOpen}
                  resolveDisplayName={resolveDisplayName}
                />
              </div>
            )
          )}
        </div>
      );
    }

    return (
      <div className="threads-list">
        {listItems.map((item, i) =>
          item.type === 'header' ? (
            <div key={`header-${i}`} className="threads-section-header">
              {item.label}
            </div>
          ) : (
            <ThreadListItem
              key={item.thread.threadId}
              thread={item.thread}
              onOpen={handleOpen}
              resolveDisplayName={resolveDisplayName}
            />
          )
        )}
      </div>
    );
  };

  return (
    <DropdownPanel
      isOpen={isOpen}
      onClose={onClose}
      position="absolute"
      positionStyle="right-aligned"
      showCloseButton={true}
      className="threads-list-panel"
      headerContent={headerContent}
    >
      {renderContent()}
    </DropdownPanel>
  );
}
```

- [ ] **Step 4: Create `src/components/thread/ThreadsListPanel.scss`**

```scss
.threads-list-panel {
  .threads-panel__header-row {
    min-width: 0;
  }

  .threads-panel__title {
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .threads-panel__search-wrap {
    position: relative;
    flex: 1;
    min-width: 0;

    .threads-panel__search-icon {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }

    .threads-panel__search {
      width: 100%;
      padding: 4px 8px 4px 28px;
      border-radius: var(--rounded-md);
      border: 1px solid var(--color-border-default);
      background: var(--color-bg-input);
      color: var(--text-primary);
      font-size: var(--text-sm);

      &:focus {
        outline: none;
        border-color: var(--text-link);
      }
    }
  }

  .threads-panel__create-btn {
    flex-shrink: 0;
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.threads-section-header {
  padding: 8px 12px 4px;
  font-size: var(--text-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.threads-list {
  padding: 4px 0;
}

.thread-list-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  border-radius: var(--rounded-lg);
  transition: background-color 0.1s ease;

  &:hover {
    background-color: var(--color-bg-hover);
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  &__title {
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  &__lock {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin-top: 2px;
  }

  &__dot {
    opacity: 0.5;
  }
}

.threads-empty-state {
  flex-direction: column;
  gap: 8px;
  padding: 40px 20px;
  text-align: center;

  .empty-icon {
    color: var(--text-muted);
    opacity: 0.5;
  }

  .empty-message {
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }

  .empty-hint {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/dev/tests/components/ThreadsListPanel.test.tsx
```

Expected: 5 tests PASS.

- [ ] **Step 6: Run all component tests**

```bash
npx vitest run src/dev/tests/components/
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/thread/ThreadsListPanel.tsx src/components/thread/ThreadsListPanel.scss src/dev/tests/components/ThreadsListPanel.test.tsx
git commit -m "feat: add ThreadsListPanel component"
```

---

## Chunk 5: Channel header integration + end-to-end smoke test

### Task 8: Add Threads button to channel header and render panel

**Files:**
- Modify: `src/components/space/Channel.tsx`

- [ ] **Step 1: Add `'threads'` to `ActivePanel` union type**

In `src/components/space/Channel.tsx`, find the `ActivePanel` type definition and add `'threads'`:

```typescript
type ActivePanel = 'pinned' | 'threads' | 'notifications' | 'bookmarks' | 'search' | 'thread' | null;
```

- [ ] **Step 2: Add Threads button to channel header**

In `Channel.tsx`, find the section where the pinned messages button is rendered (look for `icon="pin"` or `activePanel === 'pinned'`). Immediately **after** that button, add:

```typescript
<Button
  type="unstyled"
  icon="messages"
  iconSize={headerIconSize}
  iconVariant={activePanel === 'threads' ? 'filled' : 'outline'}
  className={`header-icon-button ${activePanel === 'threads' ? 'active' : ''}`}
  onClick={() => setActivePanel((p) => (p === 'threads' ? null : 'threads'))}
  tooltip={t`Threads`}
/>
```

Note: `messages` is a valid icon name per `src/components/primitives/Icon/types.ts`. If a more specific threads icon is added to the icon set in future, update this to match.

- [ ] **Step 3: Add `ThreadsListPanel` import and render**

At the top of `Channel.tsx`, add import:
```typescript
import { ThreadsListPanel } from '../thread/ThreadsListPanel';
```

In the Channel return JSX, alongside the other panel renders (e.g. near `PinnedMessagesPanel`, `NotificationPanel`), add:

```typescript
<ThreadsListPanel
  isOpen={activePanel === 'threads'}
  onClose={() => setActivePanel(null)}
  spaceId={spaceId}
  channelId={channelId}
  mapSenderToUser={mapSenderToUser}
/>
```

- [ ] **Step 4: Run TypeScript type check**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no new errors.

- [ ] **Step 5: Run lint**

```bash
yarn lint
```

Expected: no new lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/space/Channel.tsx
git commit -m "feat: add Threads button and ThreadsListPanel to channel header"
```

---

### Task 9: Manual smoke test checklist

Before declaring the feature complete, verify the following manually in the running app:

- [ ] **Open a space channel.** The Threads button (icon) appears in the header between the Pinned and Notifications buttons.

- [ ] **Click the Threads button.** The panel opens as a `DropdownPanel` on the right side. The header shows "Threads", a search input, a disabled "+" button, and a close button.

- [ ] **With no threads in the channel.** The empty state shows "No threads yet" + hint text.

- [ ] **Create a thread** via a message's action menu. Reopen the Threads panel. The new thread appears in the correct group (Joined Threads, since you created it).

- [ ] **Search for a thread by title.** Matching threads appear, section headers disappear, non-matching threads are hidden.

- [ ] **Clear search.** Section grouping returns.

- [ ] **Search with no matches.** "No threads match your search" state appears.

- [ ] **Click a thread row.** The thread panel opens and the threads list panel closes.

- [ ] **On mobile (or narrow viewport).** The panel opens as a bottom sheet. Thread items use `mobile-drawer__item-box` styling.

- [ ] **Disabled Create button.** Hovering shows "Coming soon" tooltip. Clicking does nothing.

- [ ] **Commit final smoke test confirmation** (no code change needed — this is a manual gate).

---

*Created: 2026-03-12*
