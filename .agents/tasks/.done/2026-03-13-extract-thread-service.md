# Extract ThreadService Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract ~450 lines of thread-specific logic from MessageService.ts (5,464 lines) into a dedicated ThreadService, deduplicating auth checks and improving testability.

**Architecture:** ThreadService is a stateless helper class that MessageService delegates to. MessageService remains the owner of encryption, signing, and outbound queueing — ThreadService handles thread-specific DB writes, cache updates, and authorization. The three existing call sites in MessageService (`processMessage` receive path, `addMessage` cache path, `submitChannelMessage` send path) each get a single delegation call to ThreadService.

**Stays in MessageService (not extracted):**
- `createThread()` method (lines 5011–5056) — thin wrapper that generates a thread ID and calls `submitChannelMessage`. No thread logic to extract.
- Thread reply optimistic update in `submitChannelMessage` (lines 4477–4498) — adds replies to `thread-messages` cache with `sendStatus: 'sending'`. This is part of the post-message optimistic flow that's tightly coupled with the surrounding `submitChannelMessage` logic (signing, ActionQueue). Not worth extracting separately.
- Soft-delete thread root during `remove-message` processing in `addMessage` (lines 1322–1331) — this is in the `remove-message` type handler, not the `thread` type handler.

**Tech Stack:** TypeScript, Vitest, React Query (TanStack), IndexedDB (via MessageDB)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/services/ThreadService.ts` | **Create** | Thread auth, DB writes, cache updates, thread creation |
| `src/services/MessageService.ts` | **Modify** | Replace inline thread logic with ThreadService delegation calls |
| `src/services/channelThreadHelpers.ts` | **Keep** | Pure helpers stay separate (already well-scoped) |
| `src/dev/tests/services/ThreadService.unit.test.ts` | **Create** | Unit tests for ThreadService |
| `src/dev/tests/services/channelThreadsWritePaths.test.ts` | **Keep** | Existing helper tests stay untouched |

---

## Chunk 1: ThreadService — Auth & DB Layer

### Task 1: Create ThreadService with shared auth helper

**Files:**
- Create: `src/services/ThreadService.ts`
- Test: `src/dev/tests/services/ThreadService.unit.test.ts`

The core duplication is the auth check pattern, repeated 6 times across the three paths. We extract it once.

- [x] **Step 1: Write failing tests for `isThreadAuthorized`**

Create `src/dev/tests/services/ThreadService.unit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThreadService } from '@/services/ThreadService';
import type { MessageDB } from '@/db/messages';

// Minimal mock for MessageDB
function createMockMessageDB(overrides: Partial<MessageDB> = {}): MessageDB {
  return {
    getMessage: vi.fn().mockResolvedValue(null),
    getSpace: vi.fn().mockResolvedValue(null),
    getChannelThread: vi.fn().mockResolvedValue(null),
    getChannelThreads: vi.fn().mockResolvedValue([]),
    getThreadMessages: vi.fn().mockResolvedValue({ messages: [], replyCount: 0 }),
    saveMessage: vi.fn().mockResolvedValue(undefined),
    saveChannelThread: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    deleteChannelThread: vi.fn().mockResolvedValue(undefined),
    getConversation: vi.fn().mockResolvedValue({ conversation: null }),
    ...overrides,
  } as unknown as MessageDB;
}

describe('ThreadService', () => {
  let threadService: ThreadService;
  let mockDB: MessageDB;

  beforeEach(() => {
    mockDB = createMockMessageDB();
    threadService = new ThreadService(mockDB);
  });

  describe('isThreadAuthorized', () => {
    it('returns true when sender is thread creator', async () => {
      const result = await threadService.isThreadAuthorized({
        senderId: 'user-a',
        createdBy: 'user-a',
        spaceId: 'space-1',
      });
      expect(result).toBe(true);
      // Should NOT call getSpace — short-circuits on author match
      expect(mockDB.getSpace).not.toHaveBeenCalled();
    });

    it('returns true when sender has message:delete permission', async () => {
      (mockDB.getSpace as any).mockResolvedValue({
        roles: [{
          members: ['user-mod'],
          permissions: ['message:delete'],
        }],
      });
      const result = await threadService.isThreadAuthorized({
        senderId: 'user-mod',
        createdBy: 'user-other',
        spaceId: 'space-1',
      });
      expect(result).toBe(true);
    });

    it('returns false when sender is neither author nor has permission', async () => {
      (mockDB.getSpace as any).mockResolvedValue({
        roles: [{
          members: ['user-mod'],
          permissions: ['message:pin'],  // wrong permission
        }],
      });
      const result = await threadService.isThreadAuthorized({
        senderId: 'user-random',
        createdBy: 'user-other',
        spaceId: 'space-1',
      });
      expect(result).toBe(false);
    });

    it('returns false when space has no roles', async () => {
      (mockDB.getSpace as any).mockResolvedValue({ roles: undefined });
      const result = await threadService.isThreadAuthorized({
        senderId: 'user-random',
        createdBy: 'user-other',
        spaceId: 'space-1',
      });
      expect(result).toBe(false);
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/dev/tests/services/ThreadService.unit.test.ts`
Expected: FAIL — `ThreadService` module not found

- [x] **Step 3: Create ThreadService with `isThreadAuthorized`**

Create `src/services/ThreadService.ts`:

```typescript
import { logger } from '@quilibrium/quorum-shared';
import type { MessageDB } from '../db/messages';
import type {
  Message,
  ThreadMessage,
  ThreadMeta,
  ChannelThread,
} from '../api/quorumApi';
import {
  buildChannelThreadFromCreate,
  updateChannelThreadOnReply,
} from './channelThreadHelpers';

export class ThreadService {
  constructor(private messageDB: MessageDB) {}

  /**
   * Unified thread authorization: thread creator OR message:delete permission.
   * Replaces 6 duplicate auth checks across MessageService's three code paths.
   */
  async isThreadAuthorized(params: {
    senderId: string;
    createdBy: string | undefined;
    spaceId: string;
  }): Promise<boolean> {
    if (params.senderId === params.createdBy) return true;

    const space = await this.messageDB.getSpace(params.spaceId);
    return (
      space?.roles?.some(
        (role) =>
          role.members.includes(params.senderId) &&
          role.permissions.includes('message:delete')
      ) ?? false
    );
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/dev/tests/services/ThreadService.unit.test.ts`
Expected: All 4 tests PASS

- [x] **Step 5: Commit**

```bash
git add src/services/ThreadService.ts src/dev/tests/services/ThreadService.unit.test.ts
git commit -m "feat: add ThreadService with shared auth helper"
```

---

### Task 2: Add `handleThreadReceive` — the processMessage delegation target

This method handles all thread-type messages on the **receive** path (lines 801–940 of MessageService.ts). It replaces the `else if (decryptedContent.content.type === 'thread')` block in `processMessage` / `handleNewMessage`.

**Files:**
- Modify: `src/services/ThreadService.ts`
- Modify: `src/dev/tests/services/ThreadService.unit.test.ts`

- [x] **Step 1: Write failing tests for `handleThreadReceive`**

Add to the test file:

```typescript
describe('handleThreadReceive', () => {
  it('rejects DMs (spaceId === channelId)', async () => {
    const threadMsg: ThreadMessage = {
      type: 'thread',
      senderId: 'user-a',
      targetMessageId: 'msg-1',
      action: 'create',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    const result = await threadService.handleThreadReceive({
      threadMsg,
      spaceId: 'same-id',
      channelId: 'same-id',
      currentUserAddress: 'user-a',
      conversationType: 'group',
      updatedUserProfile: { user_icon: '', display_name: '' },
    });
    expect(result).toBe(false);
  });

  it('creates thread and saves to channel_threads registry', async () => {
    const rootMessage = {
      messageId: 'msg-1',
      content: { type: 'post', senderId: 'user-a', text: 'Hello world' },
      threadMeta: undefined,
    };
    (mockDB.getMessage as any).mockResolvedValue(rootMessage);

    const threadMsg: ThreadMessage = {
      type: 'thread',
      senderId: 'user-a',
      targetMessageId: 'msg-1',
      action: 'create',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    const result = await threadService.handleThreadReceive({
      threadMsg,
      spaceId: 'space-1',
      channelId: 'channel-1',
      currentUserAddress: 'user-a',
      conversationType: 'group',
      updatedUserProfile: { user_icon: '', display_name: '' },
    });
    expect(result).toBe(true);
    expect(mockDB.saveChannelThread).toHaveBeenCalledOnce();
    expect(mockDB.saveMessage).toHaveBeenCalledOnce();
  });

  it('skips create when threadId already set (idempotent)', async () => {
    const rootMessage = {
      messageId: 'msg-1',
      content: { type: 'post', senderId: 'user-a', text: 'Hello' },
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    (mockDB.getMessage as any).mockResolvedValue(rootMessage);

    const threadMsg: ThreadMessage = {
      type: 'thread',
      senderId: 'user-a',
      targetMessageId: 'msg-1',
      action: 'create',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    const result = await threadService.handleThreadReceive({
      threadMsg,
      spaceId: 'space-1',
      channelId: 'channel-1',
      currentUserAddress: 'user-a',
      conversationType: 'group',
      updatedUserProfile: { user_icon: '', display_name: '' },
    });
    expect(result).toBe(false); // Idempotent skip
    expect(mockDB.saveChannelThread).not.toHaveBeenCalled();
  });

  it('rejects updateTitle from non-creator', async () => {
    const rootMessage = {
      messageId: 'msg-1',
      content: { type: 'post', senderId: 'user-a', text: 'Hello' },
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    (mockDB.getMessage as any).mockResolvedValue(rootMessage);

    const threadMsg: ThreadMessage = {
      type: 'thread',
      senderId: 'user-intruder',
      targetMessageId: 'msg-1',
      action: 'updateTitle',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a', customTitle: 'Hacked' },
    };
    const result = await threadService.handleThreadReceive({
      threadMsg,
      spaceId: 'space-1',
      channelId: 'channel-1',
      currentUserAddress: 'user-a',
      conversationType: 'group',
      updatedUserProfile: { user_icon: '', display_name: '' },
    });
    expect(result).toBe(false);
    expect(mockDB.saveMessage).not.toHaveBeenCalled();
  });

  it('remove action: hard-deletes root if sender is root author', async () => {
    const rootMessage = {
      messageId: 'msg-1',
      content: { type: 'post', senderId: 'user-a', text: 'Hello' },
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    (mockDB.getMessage as any).mockResolvedValue(rootMessage);
    (mockDB.getSpace as any).mockResolvedValue({ roles: [] });
    (mockDB.getThreadMessages as any).mockResolvedValue({ messages: [{ messageId: 'reply-1' }] });

    const threadMsg: ThreadMessage = {
      type: 'thread',
      senderId: 'user-a',
      targetMessageId: 'msg-1',
      action: 'remove',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    const result = await threadService.handleThreadReceive({
      threadMsg,
      spaceId: 'space-1',
      channelId: 'channel-1',
      currentUserAddress: 'user-a',
      conversationType: 'group',
      updatedUserProfile: { user_icon: '', display_name: '' },
    });
    expect(result).toBe(true);
    // Root hard-deleted + 1 reply hard-deleted
    expect(mockDB.deleteMessage).toHaveBeenCalledTimes(2);
    expect(mockDB.deleteChannelThread).toHaveBeenCalledWith('thread-1');
  });

  it('close action: authorized by thread creator', async () => {
    const rootMessage = {
      messageId: 'msg-1',
      content: { type: 'post', senderId: 'user-a', text: 'Hello' },
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    (mockDB.getMessage as any).mockResolvedValue(rootMessage);
    (mockDB.getChannelThreads as any).mockResolvedValue([
      { threadId: 'thread-1', isClosed: false },
    ]);

    const threadMsg: ThreadMessage = {
      type: 'thread',
      senderId: 'user-a',
      targetMessageId: 'msg-1',
      action: 'close',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a', isClosed: true },
    };
    const result = await threadService.handleThreadReceive({
      threadMsg,
      spaceId: 'space-1',
      channelId: 'channel-1',
      currentUserAddress: 'user-a',
      conversationType: 'group',
      updatedUserProfile: { user_icon: '', display_name: '' },
    });
    expect(result).toBe(true);
    expect(mockDB.saveChannelThread).toHaveBeenCalledOnce();
    const saved = (mockDB.saveChannelThread as any).mock.calls[0][0];
    expect(saved.isClosed).toBe(true);
  });

  it('close action: rejected for unauthorized user', async () => {
    const rootMessage = {
      messageId: 'msg-1',
      content: { type: 'post', senderId: 'user-a', text: 'Hello' },
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    (mockDB.getMessage as any).mockResolvedValue(rootMessage);
    (mockDB.getSpace as any).mockResolvedValue({ roles: [] });

    const threadMsg: ThreadMessage = {
      type: 'thread',
      senderId: 'user-random',
      targetMessageId: 'msg-1',
      action: 'close',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a', isClosed: true },
    };
    const result = await threadService.handleThreadReceive({
      threadMsg,
      spaceId: 'space-1',
      channelId: 'channel-1',
      currentUserAddress: 'user-a',
      conversationType: 'group',
      updatedUserProfile: { user_icon: '', display_name: '' },
    });
    expect(result).toBe(false);
  });

  it('remove action: falls back to channel_threads registry when root is null', async () => {
    (mockDB.getMessage as any).mockResolvedValue(null);
    (mockDB.getChannelThread as any).mockResolvedValue({
      threadId: 'thread-1',
      createdBy: 'user-a',
    });
    (mockDB.getSpace as any).mockResolvedValue({ roles: [] });
    (mockDB.getThreadMessages as any).mockResolvedValue({ messages: [] });

    const threadMsg: ThreadMessage = {
      type: 'thread',
      senderId: 'user-a',
      targetMessageId: 'msg-1',
      action: 'remove',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    const result = await threadService.handleThreadReceive({
      threadMsg,
      spaceId: 'space-1',
      channelId: 'channel-1',
      currentUserAddress: 'user-a',
      conversationType: 'group',
      updatedUserProfile: { user_icon: '', display_name: '' },
    });
    expect(result).toBe(true);
    expect(mockDB.getChannelThread).toHaveBeenCalledWith('thread-1');
    expect(mockDB.deleteChannelThread).toHaveBeenCalledWith('thread-1');
  });

  it('remove action: strips threadMeta when root belongs to another user', async () => {
    const rootMessage = {
      messageId: 'msg-1',
      content: { type: 'post', senderId: 'user-b', text: 'Their message' },
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    (mockDB.getMessage as any).mockResolvedValue(rootMessage);
    (mockDB.getSpace as any).mockResolvedValue({ roles: [] });
    (mockDB.getThreadMessages as any).mockResolvedValue({ messages: [] });

    const threadMsg: ThreadMessage = {
      type: 'thread',
      senderId: 'user-a',
      targetMessageId: 'msg-1',
      action: 'remove',
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    const result = await threadService.handleThreadReceive({
      threadMsg,
      spaceId: 'space-1',
      channelId: 'channel-1',
      currentUserAddress: 'user-a',
      conversationType: 'group',
      updatedUserProfile: { user_icon: '', display_name: '' },
    });
    expect(result).toBe(true);
    // Root NOT hard-deleted — saved with threadMeta stripped
    expect(mockDB.deleteMessage).not.toHaveBeenCalled();
    expect(mockDB.saveMessage).toHaveBeenCalledOnce();
    const savedMsg = (mockDB.saveMessage as any).mock.calls[0][0];
    expect(savedMsg.threadMeta).toBeUndefined();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/dev/tests/services/ThreadService.unit.test.ts`
Expected: FAIL — `handleThreadReceive` not a function

- [x] **Step 3: Implement `handleThreadReceive`**

Add to `ThreadService` class in `src/services/ThreadService.ts`:

```typescript
  /**
   * Handles incoming thread-type messages (receive path).
   * Extracted from MessageService.processMessage lines 801–940.
   *
   * @returns true if the message was processed, false if rejected/skipped.
   */
  async handleThreadReceive(params: {
    threadMsg: ThreadMessage;
    spaceId: string;
    channelId: string;
    currentUserAddress: string;
    conversationType: string;
    updatedUserProfile: { user_icon: string; display_name: string };
  }): Promise<boolean> {
    const { threadMsg, spaceId, channelId, currentUserAddress, conversationType, updatedUserProfile } = params;

    // Reject DMs
    if (spaceId === channelId) return false;

    const targetMessage = await this.messageDB.getMessage({
      spaceId,
      channelId,
      messageId: threadMsg.targetMessageId,
    });

    // For 'remove' action, allow proceeding even if root was already deleted
    if (!targetMessage && threadMsg.action !== 'remove') return false;

    // --- Action routing ---

    if (threadMsg.action === 'create') {
      // Idempotent — skip if threadId already set
      if (targetMessage!.threadMeta?.threadId === threadMsg.threadMeta.threadId) return false;

      const rootText = (targetMessage!.content as { text?: string })?.text ?? '';
      const newThread = buildChannelThreadFromCreate({
        spaceId,
        channelId,
        rootMessageId: threadMsg.targetMessageId,
        threadMeta: threadMsg.threadMeta,
        rootMessageText: typeof rootText === 'string' ? rootText : '',
        currentUserAddress: currentUserAddress ?? '',
        now: Date.now(),
      });
      await this.messageDB.saveChannelThread(newThread);
    } else if (threadMsg.action === 'updateTitle') {
      if (threadMsg.senderId !== targetMessage!.threadMeta?.createdBy) return false;
    } else if (
      threadMsg.action === 'close' ||
      threadMsg.action === 'reopen' ||
      threadMsg.action === 'updateSettings'
    ) {
      const authorized = await this.isThreadAuthorized({
        senderId: threadMsg.senderId,
        createdBy: targetMessage!.threadMeta?.createdBy,
        spaceId,
      });
      if (!authorized) return false;
    } else if (threadMsg.action === 'remove') {
      return this.handleThreadRemoveReceive({
        threadMsg,
        targetMessage,
        spaceId,
        channelId,
        currentUserAddress,
        conversationType,
        updatedUserProfile,
      });
    }

    // All non-remove actions require targetMessage
    if (!targetMessage) return false;

    // Merge threadMeta and save
    const updatedMessage: Message = {
      ...targetMessage,
      threadMeta: { ...targetMessage.threadMeta, ...threadMsg.threadMeta },
    };
    await this.messageDB.saveMessage(
      updatedMessage, 0, spaceId, conversationType,
      updatedUserProfile.user_icon, updatedUserProfile.display_name,
      currentUserAddress
    );

    // Sync channel_threads registry for settings/close/reopen
    if (
      threadMsg.action === 'close' ||
      threadMsg.action === 'reopen' ||
      threadMsg.action === 'updateSettings'
    ) {
      const threads = await this.messageDB.getChannelThreads({ spaceId, channelId });
      const entry = threads.find(t => t.threadId === threadMsg.threadMeta.threadId);
      if (entry) {
        await this.messageDB.saveChannelThread({
          ...entry,
          isClosed: threadMsg.action === 'close'
            ? true
            : threadMsg.action === 'reopen'
              ? false
              : entry.isClosed,
          customTitle: threadMsg.threadMeta.customTitle ?? entry.customTitle,
        });
      }
    }

    return true;
  }

  /**
   * Handles thread removal on the receive path.
   * Separated for clarity — remove has complex root message handling.
   */
  private async handleThreadRemoveReceive(params: {
    threadMsg: ThreadMessage;
    targetMessage: Message | null;
    spaceId: string;
    channelId: string;
    currentUserAddress: string;
    conversationType: string;
    updatedUserProfile: { user_icon: string; display_name: string };
  }): Promise<boolean> {
    const { threadMsg, targetMessage, spaceId, channelId, currentUserAddress, conversationType, updatedUserProfile } = params;

    // Auth: fall back to channel_threads registry if root was already deleted
    const threadRecord = !targetMessage
      ? await this.messageDB.getChannelThread(threadMsg.threadMeta.threadId)
      : undefined;
    const createdBy = targetMessage?.threadMeta?.createdBy ?? threadRecord?.createdBy;

    const authorized = await this.isThreadAuthorized({
      senderId: threadMsg.senderId,
      createdBy,
      spaceId,
    });
    if (!authorized) return false;

    // Handle root message
    if (targetMessage) {
      const isRootSender = threadMsg.senderId === targetMessage.content.senderId;
      const rootText = (targetMessage.content as { text?: string })?.text;
      const isSoftDeleted = !rootText || (Array.isArray(rootText) && (rootText as string[]).every(s => !s));

      if (isRootSender || isSoftDeleted) {
        await this.messageDB.deleteMessage(targetMessage.messageId);
      } else {
        // Strip threadMeta — keep the other user's message
        const stripped: Message = { ...targetMessage };
        delete stripped.threadMeta;
        await this.messageDB.saveMessage(
          stripped, 0, spaceId, conversationType,
          updatedUserProfile.user_icon, updatedUserProfile.display_name,
          currentUserAddress
        );
      }
    }

    // Hard-delete all thread replies
    const { messages: threadReplies } = await this.messageDB.getThreadMessages({
      spaceId,
      channelId,
      threadId: threadMsg.threadMeta.threadId,
    });
    for (const reply of threadReplies) {
      await this.messageDB.deleteMessage(reply.messageId);
    }

    // Remove from channel_threads registry
    await this.messageDB.deleteChannelThread(threadMsg.threadMeta.threadId);
    return true;
  }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/dev/tests/services/ThreadService.unit.test.ts`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/services/ThreadService.ts src/dev/tests/services/ThreadService.unit.test.ts
git commit -m "feat: add handleThreadReceive to ThreadService"
```

---

### Task 3: Add `handleThreadReplyReceive` — thread reply registry updates

This handles the thread reply processing on the receive path (lines 980–1011 of MessageService.ts). It marks incoming replies with `isThreadReply` and updates the `channel_threads` registry.

**Files:**
- Modify: `src/services/ThreadService.ts`
- Modify: `src/dev/tests/services/ThreadService.unit.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
describe('handleThreadReplyReceive', () => {
  it('marks message as isThreadReply and updates channel_threads registry', async () => {
    const existingThread: ChannelThread = {
      threadId: 'thread-1', spaceId: 'space-1', channelId: 'channel-1',
      rootMessageId: 'msg-1', createdBy: 'user-a', createdAt: 1000,
      lastActivityAt: 1000, replyCount: 1, isClosed: false,
    };
    (mockDB.getChannelThreads as any).mockResolvedValue([existingThread]);

    const message = {
      threadId: 'thread-1',
      isThreadReply: false,
      content: { senderId: 'user-b' },
      createdDate: 5000,
    } as any;

    const result = await threadService.handleThreadReplyReceive({
      message,
      spaceId: 'space-1',
      channelId: 'channel-1',
      currentUserAddress: 'user-local',
    });
    expect(result).toBe(true);
    expect(message.isThreadReply).toBe(true);
    expect(mockDB.saveChannelThread).toHaveBeenCalledOnce();
    const saved = (mockDB.saveChannelThread as any).mock.calls[0][0];
    expect(saved.replyCount).toBe(2);
    expect(saved.lastActivityAt).toBe(5000);
  });

  it('does nothing for non-thread messages', async () => {
    const message = { content: { senderId: 'user-a' } } as any;
    const result = await threadService.handleThreadReplyReceive({
      message,
      spaceId: 'space-1',
      channelId: 'channel-1',
      currentUserAddress: 'user-a',
    });
    expect(result).toBe(false);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/dev/tests/services/ThreadService.unit.test.ts`
Expected: FAIL

- [x] **Step 3: Implement `handleThreadReplyReceive`**

Add to `ThreadService`:

```typescript
  /**
   * Marks incoming thread replies with isThreadReply flag and updates
   * the channel_threads registry. Called before the reply is saved to DB.
   *
   * Mutates the message object in place (sets isThreadReply).
   *
   * @returns true if the message was a thread reply and registry was updated.
   */
  async handleThreadReplyReceive(params: {
    message: Message;
    spaceId: string;
    channelId: string;
    currentUserAddress: string;
  }): Promise<boolean> {
    const { message, spaceId, channelId, currentUserAddress } = params;

    // Ensure thread replies are marked for filtering
    if (message.threadId && !message.isThreadReply) {
      message.isThreadReply = true;
    }

    if (!message.isThreadReply || !message.threadId) return false;

    // Update channel_threads registry
    const threads = await this.messageDB.getChannelThreads({ spaceId, channelId });
    const existingEntry = threads.find(t => t.threadId === message.threadId);

    if (existingEntry) {
      const updated = updateChannelThreadOnReply({
        existing: existingEntry,
        replySenderId: message.content.senderId,
        replyTimestamp: message.createdDate,
        currentUserAddress: currentUserAddress ?? '',
      });
      await this.messageDB.saveChannelThread(updated);
    }

    return true;
  }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/dev/tests/services/ThreadService.unit.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/services/ThreadService.ts src/dev/tests/services/ThreadService.unit.test.ts
git commit -m "feat: add handleThreadReplyReceive to ThreadService"
```

---

## Chunk 2: ThreadService — Cache & Send Layer

### Task 4: Add `handleThreadCache` — the addMessage delegation target

This handles thread-type messages on the **cache** path (lines 1458–1567 of MessageService.ts). It updates React Query caches for thread metadata changes.

**Files:**
- Modify: `src/services/ThreadService.ts`
- Modify: `src/dev/tests/services/ThreadService.unit.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
import { QueryClient, InfiniteData } from '@tanstack/react-query';

describe('handleThreadCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('rejects DMs', async () => {
    const threadMsg = {
      type: 'thread' as const,
      senderId: 'user-a',
      targetMessageId: 'msg-1',
      action: 'create' as const,
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    const result = await threadService.handleThreadCache({
      threadMsg,
      spaceId: 'same',
      channelId: 'same',
      queryClient,
    });
    expect(result).toBe(false);
  });

  it('updateTitle: rejects non-creator', async () => {
    (mockDB.getMessage as any).mockResolvedValue({
      messageId: 'msg-1',
      content: { senderId: 'user-a' },
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    });
    const threadMsg = {
      type: 'thread' as const,
      senderId: 'user-intruder',
      targetMessageId: 'msg-1',
      action: 'updateTitle' as const,
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a', customTitle: 'Hacked' },
    };
    const result = await threadService.handleThreadCache({
      threadMsg,
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient,
    });
    expect(result).toBe(false);
  });

  it('remove: removes thread from channel-threads cache', async () => {
    (mockDB.getMessage as any).mockResolvedValue({
      messageId: 'msg-1',
      content: { senderId: 'user-a', text: 'Hello' },
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    });
    (mockDB.getSpace as any).mockResolvedValue({ roles: [] });

    // Seed channel-threads cache
    queryClient.setQueryData(['channel-threads', 'space-1', 'channel-1'], [
      { threadId: 'thread-1' },
      { threadId: 'thread-2' },
    ]);

    const threadMsg = {
      type: 'thread' as const,
      senderId: 'user-a',
      targetMessageId: 'msg-1',
      action: 'remove' as const,
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    };
    const result = await threadService.handleThreadCache({
      threadMsg,
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient,
    });
    expect(result).toBe(true);
    const threads = queryClient.getQueryData(['channel-threads', 'space-1', 'channel-1']) as any[];
    expect(threads).toHaveLength(1);
    expect(threads[0].threadId).toBe('thread-2');
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/dev/tests/services/ThreadService.unit.test.ts`
Expected: FAIL

- [x] **Step 3: Implement `handleThreadCache`**

Add to `ThreadService`:

```typescript
import { QueryClient, InfiniteData } from '@tanstack/react-query';
import { buildMessagesKey } from '../hooks';
```

```typescript
  /**
   * Handles thread-type messages on the cache path (React Query updates).
   * Extracted from MessageService.addMessage lines 1458–1567.
   *
   * @returns true if processed, false if rejected.
   */
  async handleThreadCache(params: {
    threadMsg: ThreadMessage;
    spaceId: string;
    channelId: string;
    queryClient: QueryClient;
  }): Promise<boolean> {
    const { threadMsg, spaceId, channelId, queryClient } = params;

    if (spaceId === channelId) return false;

    const targetMessage = await this.messageDB.getMessage({
      spaceId, channelId, messageId: threadMsg.targetMessageId,
    });

    // Auth checks per action
    if (threadMsg.action === 'updateTitle') {
      if (!targetMessage || threadMsg.senderId !== targetMessage.threadMeta?.createdBy) return false;
    }

    if (threadMsg.action === 'close' || threadMsg.action === 'reopen' || threadMsg.action === 'updateSettings') {
      if (!targetMessage) return false;
      const authorized = await this.isThreadAuthorized({
        senderId: threadMsg.senderId,
        createdBy: targetMessage.threadMeta?.createdBy,
        spaceId,
      });
      if (!authorized) return false;
    }

    if (threadMsg.action === 'remove') {
      return this.handleThreadRemoveCache({
        threadMsg, targetMessage, spaceId, channelId, queryClient,
      });
    }

    // Non-remove: merge threadMeta into main feed cache
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
    queryClient.invalidateQueries({
      queryKey: ['thread-messages', spaceId, channelId, threadMsg.threadMeta.threadId],
    });
    queryClient.invalidateQueries({
      queryKey: ['channel-threads', spaceId, channelId],
    });
    return true;
  }

  /**
   * Handles thread removal cache updates.
   */
  private async handleThreadRemoveCache(params: {
    threadMsg: ThreadMessage;
    targetMessage: Message | null;
    spaceId: string;
    channelId: string;
    queryClient: QueryClient;
  }): Promise<boolean> {
    const { threadMsg, targetMessage, spaceId, channelId, queryClient } = params;
    const threadId = threadMsg.threadMeta.threadId;

    // Auth
    const threadRecord = !targetMessage
      ? await this.messageDB.getChannelThread(threadId)
      : undefined;
    const createdBy = targetMessage?.threadMeta?.createdBy ?? threadRecord?.createdBy;
    const authorized = await this.isThreadAuthorized({
      senderId: threadMsg.senderId, createdBy, spaceId,
    });
    if (!authorized) return false;

    const isRootSender = targetMessage
      ? threadMsg.senderId === targetMessage.content.senderId
      : false;

    // Update main feed cache
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
                const text = (m.content as { text?: string })?.text;
                if (!text || isRootSender) return null;
                const { threadMeta: _stripped, ...rest } = m;
                return rest as Message;
              }
              if (m.threadId === threadId) return null;
              return m;
            }).filter((m: Message | null): m is Message => m !== null),
          })),
        };
      }
    );

    queryClient.removeQueries({
      queryKey: ['thread-messages', spaceId, channelId, threadId],
    });
    queryClient.setQueryData(
      ['channel-threads', spaceId, channelId],
      (old: any[] | undefined) =>
        old ? old.filter((t: any) => t.threadId !== threadId) : old,
    );
    return true;
  }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/dev/tests/services/ThreadService.unit.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/services/ThreadService.ts src/dev/tests/services/ThreadService.unit.test.ts
git commit -m "feat: add handleThreadCache to ThreadService"
```

---

### Task 5: Add `handleThreadReplyCache` — thread reply cache updates

This handles thread reply messages on the cache path (lines 1673–1712 of MessageService.ts).

**Files:**
- Modify: `src/services/ThreadService.ts`
- Modify: `src/dev/tests/services/ThreadService.unit.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
describe('handleThreadReplyCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('invalidates thread-messages and thread-stats queries', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    threadService.handleThreadReplyCache({
      message: { threadId: 'thread-1', isThreadReply: true, createdDate: 5000 } as any,
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient,
    });

    expect(spy).toHaveBeenCalledWith({
      queryKey: ['thread-messages', 'space-1', 'channel-1', 'thread-1'],
    });
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['thread-stats', 'space-1', 'channel-1', 'thread-1'],
    });
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['channel-threads', 'space-1', 'channel-1'],
    });
  });

  it('returns false for non-thread-reply messages', () => {
    const result = threadService.handleThreadReplyCache({
      message: { content: { senderId: 'user-a' } } as any,
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient,
    });
    expect(result).toBe(false);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/dev/tests/services/ThreadService.unit.test.ts`

- [x] **Step 3: Implement `handleThreadReplyCache`**

Add to `ThreadService`:

```typescript
  /**
   * Handles thread reply cache updates (invalidations + lastActivityAt bump).
   * Extracted from MessageService.addMessage lines 1673–1712.
   *
   * @returns true if the message was a thread reply.
   */
  handleThreadReplyCache(params: {
    message: Message;
    spaceId: string;
    channelId: string;
    queryClient: QueryClient;
  }): boolean {
    const { message, spaceId, channelId, queryClient } = params;

    if (!message.isThreadReply || !message.threadId) return false;

    queryClient.invalidateQueries({
      queryKey: ['thread-messages', spaceId, channelId, message.threadId],
    });
    queryClient.invalidateQueries({
      queryKey: ['thread-stats', spaceId, channelId, message.threadId],
    });

    // Update lastActivityAt on root message in main feed cache
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
                return { ...m, threadMeta: { ...m.threadMeta, lastActivityAt: now } };
              }
              return m;
            }),
          })),
        };
      }
    );
    queryClient.invalidateQueries({
      queryKey: ['channel-threads', spaceId, channelId],
    });

    return true;
  }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/dev/tests/services/ThreadService.unit.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/services/ThreadService.ts src/dev/tests/services/ThreadService.unit.test.ts
git commit -m "feat: add handleThreadReplyCache to ThreadService"
```

---

### Task 6: Add `handleThreadDeletedMessageCache` — thread reply deletion in cache

This handles thread reply deletion in the cache path (lines 1345–1359 of MessageService.ts) and the thread root soft-delete cache logic (lines 1322–1331).

**Files:**
- Modify: `src/services/ThreadService.ts`
- Modify: `src/dev/tests/services/ThreadService.unit.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
describe('handleThreadDeletedMessageCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('updates thread-messages cache when a thread reply is deleted', () => {
    // Seed thread-messages cache
    queryClient.setQueryData(
      ['thread-messages', 'space-1', 'channel-1', 'thread-1'],
      { messages: [{ messageId: 'reply-1' }, { messageId: 'reply-2' }], replyCount: 2 }
    );

    threadService.handleThreadDeletedMessageCache({
      targetMessage: { messageId: 'reply-1', isThreadReply: true, threadId: 'thread-1' } as any,
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient,
    });

    const data = queryClient.getQueryData(['thread-messages', 'space-1', 'channel-1', 'thread-1']) as any;
    expect(data.messages).toHaveLength(1);
    expect(data.replyCount).toBe(1);
  });

  it('does nothing for non-thread messages', () => {
    const spy = vi.spyOn(queryClient, 'setQueryData');
    threadService.handleThreadDeletedMessageCache({
      targetMessage: { messageId: 'msg-1' } as any,
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient,
    });
    // Only called if targetMessage is a thread reply
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

- [x] **Step 3: Implement `handleThreadDeletedMessageCache`**

```typescript
  /**
   * Updates thread-messages cache when a thread reply is deleted.
   * Extracted from MessageService.addMessage lines 1345–1359.
   */
  handleThreadDeletedMessageCache(params: {
    targetMessage: Message | null;
    spaceId: string;
    channelId: string;
    queryClient: QueryClient;
  }): void {
    const { targetMessage, spaceId, channelId, queryClient } = params;

    if (!targetMessage?.isThreadReply || !targetMessage.threadId) return;

    const threadKey = ['thread-messages', spaceId, channelId, targetMessage.threadId];
    queryClient.setQueryData(threadKey, (oldData: any) => {
      if (!oldData?.messages) return oldData;
      return {
        ...oldData,
        messages: oldData.messages.filter((m: Message) => m.messageId !== targetMessage.messageId),
        replyCount: Math.max(0, (oldData.replyCount || 0) - 1),
      };
    });
  }
```

- [x] **Step 4: Run tests to verify they pass**

- [x] **Step 5: Commit**

```bash
git add src/services/ThreadService.ts src/dev/tests/services/ThreadService.unit.test.ts
git commit -m "feat: add handleThreadDeletedMessageCache to ThreadService"
```

---

### Task 7: Add `handleThreadSend` — the submitChannelMessage delegation target

This handles thread messages on the **send** path (lines 4740–4920 of MessageService.ts). Note: message ID generation, signing, and encryption remain in MessageService. ThreadService handles the post-send DB writes and cache updates.

**Files:**
- Modify: `src/services/ThreadService.ts`
- Modify: `src/dev/tests/services/ThreadService.unit.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
describe('handleThreadSend', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('rejects DMs', async () => {
    const result = await threadService.handleThreadSend({
      threadMsg: { type: 'thread', senderId: 'user-a', targetMessageId: 'msg-1', action: 'create', threadMeta: { threadId: 'thread-1', createdBy: 'user-a' } },
      spaceId: 'same',
      channelId: 'same',
      queryClient,
      currentUserAddress: 'user-a',
    });
    expect(result.shouldProceed).toBe(false);
    expect(result.targetMessage).toBeUndefined();
  });

  it('rejects create when thread already exists (idempotent)', async () => {
    (mockDB.getMessage as any).mockResolvedValue({
      messageId: 'msg-1',
      content: { senderId: 'user-a', text: 'Hello' },
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    });
    const result = await threadService.handleThreadSend({
      threadMsg: { type: 'thread', senderId: 'user-a', targetMessageId: 'msg-1', action: 'create', threadMeta: { threadId: 'thread-1', createdBy: 'user-a' } },
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient,
      currentUserAddress: 'user-a',
    });
    expect(result.shouldProceed).toBe(false);
  });

  it('updateTitle: rejects non-creator', async () => {
    (mockDB.getMessage as any).mockResolvedValue({
      messageId: 'msg-1',
      content: { senderId: 'user-a', text: 'Hello' },
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    });
    const result = await threadService.handleThreadSend({
      threadMsg: { type: 'thread', senderId: 'user-intruder', targetMessageId: 'msg-1', action: 'updateTitle', threadMeta: { threadId: 'thread-1', createdBy: 'user-a', customTitle: 'Hacked' } },
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient,
      currentUserAddress: 'user-intruder',
    });
    expect(result.shouldProceed).toBe(false);
  });

  it('returns targetMessage when shouldProceed is true', async () => {
    const rootMsg = {
      messageId: 'msg-1',
      content: { senderId: 'user-a', text: 'Hello world' },
      threadMeta: undefined,
    };
    (mockDB.getMessage as any).mockResolvedValue(rootMsg);

    const result = await threadService.handleThreadSend({
      threadMsg: { type: 'thread', senderId: 'user-a', targetMessageId: 'msg-1', action: 'create', threadMeta: { threadId: 'thread-1', createdBy: 'user-a' } },
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient,
      currentUserAddress: 'user-a',
    });
    expect(result.shouldProceed).toBe(true);
    expect(result.targetMessage).toBe(rootMsg);
  });
});

describe('handleThreadSendPostBroadcast', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('create: saves root message and channel_threads entry', async () => {
    const targetMessage = {
      messageId: 'msg-1',
      content: { senderId: 'user-a', text: 'Hello world' },
      threadMeta: undefined,
    } as any;

    const result = await threadService.handleThreadSendPostBroadcast({
      threadMsg: { type: 'thread', senderId: 'user-a', targetMessageId: 'msg-1', action: 'create', threadMeta: { threadId: 'thread-1', createdBy: 'user-a' } },
      targetMessage,
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient,
      currentUserAddress: 'user-a',
      conversationProfile: { user_icon: 'icon.png', display_name: 'Test' },
    });
    expect(result.earlyReturn).toBe(false);
    expect(mockDB.saveMessage).toHaveBeenCalledOnce();
    expect(mockDB.saveChannelThread).toHaveBeenCalledOnce();
  });

  it('remove: deletes root, replies, and registry; returns earlyReturn=true', async () => {
    const targetMessage = {
      messageId: 'msg-1',
      content: { senderId: 'user-a', text: 'Hello' },
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    } as any;
    (mockDB.getThreadMessages as any).mockResolvedValue({
      messages: [{ messageId: 'reply-1' }],
    });

    const result = await threadService.handleThreadSendPostBroadcast({
      threadMsg: { type: 'thread', senderId: 'user-a', targetMessageId: 'msg-1', action: 'remove', threadMeta: { threadId: 'thread-1', createdBy: 'user-a' } },
      targetMessage,
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient,
      currentUserAddress: 'user-a',
      conversationProfile: { user_icon: 'icon.png', display_name: 'Test' },
    });
    expect(result.earlyReturn).toBe(true);
    expect(mockDB.deleteMessage).toHaveBeenCalledTimes(2); // root + reply
    expect(mockDB.deleteChannelThread).toHaveBeenCalledWith('thread-1');
  });

  it('remove: strips threadMeta when root belongs to another user', async () => {
    const targetMessage = {
      messageId: 'msg-1',
      content: { senderId: 'user-b', text: 'Their message' },
      threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
    } as any;
    (mockDB.getThreadMessages as any).mockResolvedValue({ messages: [] });

    const result = await threadService.handleThreadSendPostBroadcast({
      threadMsg: { type: 'thread', senderId: 'user-a', targetMessageId: 'msg-1', action: 'remove', threadMeta: { threadId: 'thread-1', createdBy: 'user-a' } },
      targetMessage,
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient,
      currentUserAddress: 'user-a',
      conversationProfile: { user_icon: 'icon.png', display_name: 'Test' },
    });
    expect(result.earlyReturn).toBe(true);
    // Root NOT deleted — saved with stripped threadMeta
    expect(mockDB.deleteMessage).not.toHaveBeenCalled();
    expect(mockDB.saveMessage).toHaveBeenCalledOnce();
    const savedMsg = (mockDB.saveMessage as any).mock.calls[0][0];
    expect(savedMsg.threadMeta).toBeUndefined();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

- [x] **Step 3: Implement `handleThreadSend`**

Add to `ThreadService`:

```typescript
  /**
   * Pre-send validation for thread messages. Performs DM check, idempotency,
   * and auth checks. Returns the targetMessage so the caller doesn't need
   * to fetch it again.
   *
   * Returns { shouldProceed: false } if the message should not be sent.
   * Returns { shouldProceed: true, targetMessage } for valid messages.
   *
   * Extracted from MessageService.submitChannelMessage lines 4740–4764.
   */
  async handleThreadSend(params: {
    threadMsg: ThreadMessage;
    spaceId: string;
    channelId: string;
    queryClient: QueryClient;
    currentUserAddress: string;
  }): Promise<{ shouldProceed: boolean; targetMessage?: Message }> {
    const { threadMsg, spaceId, channelId } = params;

    if (spaceId === channelId) return { shouldProceed: false };

    const targetMessage = await this.messageDB.getMessage({
      spaceId, channelId, messageId: threadMsg.targetMessageId,
    });
    if (!targetMessage) return { shouldProceed: false };

    // Idempotent for 'create'
    if (threadMsg.action === 'create' && targetMessage.threadMeta?.threadId === threadMsg.threadMeta.threadId) {
      return { shouldProceed: false };
    }

    // updateTitle: only creator
    if (threadMsg.action === 'updateTitle' && threadMsg.senderId !== targetMessage.threadMeta?.createdBy) {
      return { shouldProceed: false };
    }

    return { shouldProceed: true, targetMessage };
  }

  /**
   * Post-send DB and cache operations for thread messages.
   * Called AFTER the message has been encrypted and sent.
   *
   * For 'remove': performs DB cleanup (root handling, reply deletion, registry removal).
   * For 'create'/'updateTitle'/etc: saves updated root message and updates caches.
   *
   * The `conversationProfile` parameter is resolved by the caller (MessageService)
   * since it depends on DefaultImages and i18n (t``) which ThreadService shouldn't import.
   */
  async handleThreadSendPostBroadcast(params: {
    threadMsg: ThreadMessage;
    targetMessage: Message;
    spaceId: string;
    channelId: string;
    queryClient: QueryClient;
    currentUserAddress: string;
    conversationProfile: { user_icon: string; display_name: string };
  }): Promise<{ earlyReturn: boolean }> {
    const { threadMsg, targetMessage, spaceId, channelId, queryClient, currentUserAddress, conversationProfile } = params;

    // Remove action: full cleanup
    if (threadMsg.action === 'remove') {
      const isRootSender = threadMsg.senderId === targetMessage.content.senderId;
      const rootText = (targetMessage.content as { text?: string })?.text;
      const isSoftDeleted = !rootText || (Array.isArray(rootText) && (rootText as string[]).every(s => !s));

      if (isRootSender || isSoftDeleted) {
        await this.messageDB.deleteMessage(targetMessage.messageId);
      } else {
        const stripped: Message = { ...targetMessage };
        delete stripped.threadMeta;
        await this.messageDB.saveMessage(
          stripped, 0, spaceId, 'group',
          conversationProfile.user_icon, conversationProfile.display_name,
          currentUserAddress
        );
      }

      const { messages: threadReplies } = await this.messageDB.getThreadMessages({
        spaceId, channelId, threadId: threadMsg.threadMeta.threadId,
      });
      for (const reply of threadReplies) {
        await this.messageDB.deleteMessage(reply.messageId);
      }
      await this.messageDB.deleteChannelThread(threadMsg.threadMeta.threadId);
      return { earlyReturn: true };
    }

    // Non-remove: save updated root
    const mergedMeta = threadMsg.action === 'updateTitle'
      ? { ...targetMessage.threadMeta, ...threadMsg.threadMeta }
      : threadMsg.threadMeta;
    const updatedTarget: Message = { ...targetMessage, threadMeta: mergedMeta };
    await this.messageDB.saveMessage(
      updatedTarget, 0, spaceId, 'group',
      conversationProfile.user_icon, conversationProfile.display_name,
      currentUserAddress
    );

    // Update main feed cache
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
                ? { ...m, threadMeta: threadMsg.action === 'updateTitle'
                    ? { ...m.threadMeta, ...threadMsg.threadMeta }
                    : threadMsg.threadMeta }
                : m
            ),
          })),
        };
      }
    );

    // Create: save to channel_threads registry
    if (threadMsg.action === 'create') {
      const rootText = (targetMessage.content as { text?: string })?.text ?? '';
      const newThread = buildChannelThreadFromCreate({
        spaceId, channelId,
        rootMessageId: threadMsg.targetMessageId,
        threadMeta: threadMsg.threadMeta,
        rootMessageText: typeof rootText === 'string' ? rootText : '',
        currentUserAddress,
        now: Date.now(),
      });
      await this.messageDB.saveChannelThread(newThread);
      queryClient.invalidateQueries({ queryKey: ['channel-threads', spaceId, channelId] });
    }

    // updateTitle: invalidate thread-messages
    if (threadMsg.action === 'updateTitle') {
      queryClient.invalidateQueries({
        queryKey: ['thread-messages', spaceId, channelId, threadMsg.threadMeta.threadId],
      });
    }

    return { earlyReturn: false };
  }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/dev/tests/services/ThreadService.unit.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/services/ThreadService.ts src/dev/tests/services/ThreadService.unit.test.ts
git commit -m "feat: add handleThreadSend and handleThreadSendPostBroadcast to ThreadService"
```

---

## Chunk 3: Wire ThreadService into MessageService

### Task 8: Instantiate ThreadService in MessageService

**Files:**
- Modify: `src/services/MessageService.ts`

- [x] **Step 1: Add ThreadService import and instance**

At top of `MessageService.ts`, add import:
```typescript
import { ThreadService } from './ThreadService';
```

In the class body, add a field:
```typescript
private threadService: ThreadService;
```

In the constructor, after `this.messageDB = dependencies.messageDB;`:
```typescript
this.threadService = new ThreadService(this.messageDB);
```

- [x] **Step 2: Run existing tests to confirm nothing breaks**

Run: `npx vitest run src/dev/tests/services/MessageService.unit.test.tsx`
Expected: All existing tests PASS (adding an unused field changes nothing)

- [x] **Step 3: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "refactor: instantiate ThreadService in MessageService constructor"
```

---

### Task 9: Delegate processMessage thread logic to ThreadService

Replace the thread block in `processMessage`/`handleNewMessage` (lines ~801–940) with a delegation call.

**Files:**
- Modify: `src/services/MessageService.ts:801-940`

- [x] **Step 1: Replace the `else if (decryptedContent.content.type === 'thread')` block**

Replace lines 801–940 (the entire thread block in processMessage) with:

```typescript
    } else if (decryptedContent.content.type === 'thread') {
      const threadMsg = decryptedContent.content as ThreadMessage;
      await this.threadService.handleThreadReceive({
        threadMsg,
        spaceId,
        channelId,
        currentUserAddress: currentUserAddress ?? '',
        conversationType,
        updatedUserProfile: {
          user_icon: updatedUserProfile.user_icon!,
          display_name: updatedUserProfile.display_name!,
        },
      });
```

- [x] **Step 2: Replace the thread reply handling (lines ~980–1011)**

Replace the thread reply code at the end of the `else` block (where regular messages are saved) with delegation. The existing code:

```typescript
      // Ensure thread replies are marked for filtering
      if (decryptedContent.threadId && !decryptedContent.isThreadReply) {
        decryptedContent.isThreadReply = true;
      }
      // ... saveMessage call stays ...
      // Update channel_threads registry for thread replies
      if (decryptedContent.isThreadReply && decryptedContent.threadId) {
        // ... registry update logic ...
      }
```

Replace with:

```typescript
      // Mark thread replies and update channel_threads registry
      await this.threadService.handleThreadReplyReceive({
        message: decryptedContent,
        spaceId,
        channelId,
        currentUserAddress: currentUserAddress ?? '',
      });
```

**Important:** The `handleThreadReplyReceive` call must come BEFORE `saveMessage` because it mutates `decryptedContent.isThreadReply` which affects filtering.

- [x] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [x] **Step 4: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "refactor: delegate processMessage thread logic to ThreadService"
```

---

### Task 10: Delegate addMessage thread logic to ThreadService

Replace the thread blocks in `addMessage` with delegation calls.

**Files:**
- Modify: `src/services/MessageService.ts:1322-1359,1458-1567,1673-1712`

- [x] **Step 1: Replace the thread-type message block (lines ~1458–1567)**

Replace with:

```typescript
    } else if (decryptedContent.content.type === 'thread') {
      const threadMsg = decryptedContent.content as ThreadMessage;
      await this.threadService.handleThreadCache({
        threadMsg,
        spaceId,
        channelId,
        queryClient,
      });
```

- [x] **Step 2: Replace the thread reply cache block (lines ~1673–1712)**

Replace with:

```typescript
      if (decryptedContent.isThreadReply) {
        this.threadService.handleThreadReplyCache({
          message: decryptedContent,
          spaceId,
          channelId,
          queryClient,
        });
        return;
      }
```

- [x] **Step 3: Replace the deleted thread reply cache block (lines ~1345–1359)**

Replace with:

```typescript
        // For thread replies: also update the thread-messages cache
        this.threadService.handleThreadDeletedMessageCache({
          targetMessage: targetMessage ?? null,
          spaceId,
          channelId,
          queryClient,
        });
```

- [x] **Step 4: Verify the soft-delete thread root logic (lines ~1322–1331) stays in MessageService**

The soft-delete logic for thread root messages during `remove-message` processing (the `if (m.threadMeta)` block that preserves the message with empty content) stays in MessageService's `addMessage` — it's part of the `remove-message` type handler, not the `thread` type handler. **Do not move this.**

- [x] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [x] **Step 6: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "refactor: delegate addMessage thread logic to ThreadService"
```

---

### Task 11: Delegate submitChannelMessage thread logic to ThreadService

Replace the thread block in `submitChannelMessage` (lines ~4740–4920) with delegation calls. Message ID generation, signing, and encryption stay in MessageService.

**Files:**
- Modify: `src/services/MessageService.ts:4740-4920`

- [x] **Step 1: Replace pre-send auth checks**

Replace lines 4740–4764 (type check + DM rejection + idempotency + updateTitle auth) with:

```typescript
      // Handle thread-message type
      if (
        typeof pendingMessage === 'object' &&
        (pendingMessage as any).type === 'thread'
      ) {
        const threadMsg = pendingMessage as ThreadMessage;

        // Pre-send validation (DM check, idempotency, auth)
        // Returns targetMessage to avoid a second DB fetch
        const preCheck = await this.threadService.handleThreadSend({
          threadMsg,
          spaceId,
          channelId,
          queryClient,
          currentUserAddress: currentPasskeyInfo.address,
        });
        if (!preCheck.shouldProceed || !preCheck.targetMessage) return outbounds;
        const targetMessage = preCheck.targetMessage;
```

- [x] **Step 2: Keep message ID generation, signing, and encryption (lines ~4766–4807)**

These lines stay exactly as-is in MessageService. They generate the message ID, create the message object, sign it, and call `encryptAndSendToSpace`.

- [x] **Step 3: Replace post-send DB and cache operations**

Replace lines 4809–4919 (everything after `encryptAndSendToSpace`) with:

```typescript
        // Resolve conversation profile for DB saves (uses DefaultImages + i18n)
        const conversationId = spaceId + '/' + channelId;
        const conversation = await this.messageDB.getConversation({ conversationId });

        // Post-broadcast: DB writes and cache updates
        const { earlyReturn } = await this.threadService.handleThreadSendPostBroadcast({
          threadMsg,
          targetMessage,
          spaceId,
          channelId,
          queryClient,
          currentUserAddress: currentPasskeyInfo.address,
          conversationProfile: {
            user_icon: conversation.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name: conversation.conversation?.displayName ?? t`Unknown User`,
          },
        });
        if (earlyReturn) return outbounds;

        return outbounds;
      }
```

- [x] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "refactor: delegate submitChannelMessage thread logic to ThreadService"
```

---

### Task 12: Clean up unused imports in MessageService

After extraction, some imports in MessageService may now be unused.

**Files:**
- Modify: `src/services/MessageService.ts`

- [x] **Step 1: Check for unused thread-related imports**

Check if these imports are still used elsewhere in MessageService (they should NOT be, since ThreadService imports them directly):
- `buildChannelThreadFromCreate` and `updateChannelThreadOnReply` from `./channelThreadHelpers`
- `ThreadMeta` type import (still used by `createThread` method — keep it)

- [x] **Step 2: Remove unused imports**

Remove the `channelThreadHelpers` import if no longer referenced:
```typescript
// REMOVE:
import {
  buildChannelThreadFromCreate,
  updateChannelThreadOnReply,
} from './channelThreadHelpers';
```

- [x] **Step 3: Run TypeScript type check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors

- [x] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [x] **Step 5: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "refactor: remove unused thread helper imports from MessageService"
```

---

### Task 13: Final verification and line count check

- [x] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [x] **Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors

- [x] **Step 3: Verify line count reduction**

Run: `wc -l src/services/MessageService.ts src/services/ThreadService.ts`
Expected: MessageService reduced by ~350-400 lines, ThreadService ~300-350 lines.
Net: slight increase due to method signatures/JSDoc, but MessageService is significantly leaner.

- [x] **Step 4: Run lint**

Run: `yarn lint`
Expected: No new lint errors

- [x] **Step 5: Final commit (if any cleanup needed)**

Only if linting or type checks revealed issues to fix.

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| MessageService.ts lines | ~5,464 | ~5,050 (estimated) |
| Thread auth check copies | 6 | 1 (`isThreadAuthorized`) |
| Thread-related files | 2 (MessageService + helpers) | 3 (MessageService + ThreadService + helpers) |
| Thread test files | 1 (helpers only) | 2 (helpers + ThreadService unit tests) |
| Testable thread methods | 0 (all inline in MessageService) | 7 public methods on ThreadService |

---

_Created: 2026-03-13_
_Updated: 2026-03-13 (reviewer fixes: added explicit non-extraction notes for createThread/reply optimistic update, fixed double getMessage by returning targetMessage from handleThreadSend, replaced saveMessageFn callback with conversationProfile parameter, added missing tests for close/reopen/remove-null-root/handleThreadSendPostBroadcast)_
