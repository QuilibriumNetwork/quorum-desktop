# Background Action Queue

https://github.com/QuilibriumNetwork/quorum-desktop/issues/110

> **AI-Generated**: May contain errors. Verify before use.

**Status**: Ready for Implementation
**Complexity**: High
**Created**: 2025-12-17
**Updated**: 2025-12-17

**Reference Implementation**: [Commit 81c2c5ca](https://github.com/QuilibriumNetwork/quorum-desktop/commit/81c2c5caaf92f7ecd5fdd157847ec773a63cd91b) - Previous action queue implementation (not merged)

---

## Objective

**Build a background action queue system that:**
1. **Eliminates UI freezing** - User actions return instantly, heavy work happens in background
2. **Prevents data loss** - Operations persist to IndexedDB, survive crashes/refreshes
3. **Handles offline gracefully** - Queue accumulates, processes when back online
4. **Provides user feedback** - Toasts, banners, and status indicators

---

## Current Problems

### Problem 1: UI Freezing During Config Saves
**Symptom**: App freezes for ~7 seconds when saving user settings, dragging folders, etc.

**Actual Timing** (measured with debug instrumentation):
```
SHA-512 digest:       0.3ms   (0.004%)
AES key import:       0.3ms   (0.004%)
DB queries:          40.0ms   (0.6%)
JSON stringify:       0.1ms   (0.001%)
AES-GCM encrypt:      0.2ms   (0.003%)
Ed448 sign (WASM):  1000.0ms  (14%)     ← Main thread blocker
API call:           5500.0ms  (80%)     ← THE REAL BOTTLENECK
-------------------------------------------------
Total:              ~7000ms per save
```

### Problem 2: Data Loss on Failure
**Symptom**: Messages/config lost when app crashes mid-send, network fails, or user closes browser.

**Root Cause**: Current queue is in-memory only (`WebsocketProvider.tsx`).

### Problem 3: No Offline Support
**Symptom**: Operations fail silently when offline.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     USER ACTION                              │
│              (Send message, save config, etc.)               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               MAIN THREAD (Stays Responsive)                 │
│  1. Validate input                                           │
│  2. Update UI immediately (optimistic)                       │
│  3. Queue action to IndexedDB                                │
│  4. Return to user (instant!)                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              PERSISTENT QUEUE (IndexedDB)                    │
│  - Plaintext task storage (browser sandbox is sufficient)    │
│  - Survives crashes/refreshes                                │
│  - Status tracking (pending/processing/failed/completed)     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKGROUND PROCESSOR                            │
│  1. Status-based gating (multi-tab safety)                   │
│  2. Get next batch of pending tasks                          │
│  3. Execute task (crypto, API calls, WebSocket sends)        │
│  4. Update status, handle retries                            │
└─────────────────────────────────────────────────────────────┘
```

### How ActionQueue Relates to Existing WebSocket Queue

The two queues work **in series**, not compete:

```
┌─────────────────────────────────────────┐
│          ActionQueueService             │  ← Persistence layer
│  - IndexedDB storage                    │
│  - Retry logic                          │
│  - Crash recovery                       │
│  - Calls existing services              │
└─────────────────┬───────────────────────┘
                  │ calls
                  ▼
┌─────────────────────────────────────────┐
│    MessageService / ConfigService       │  ← Business logic
│  - Crypto/signing                       │
│  - API calls                            │
└─────────────────┬───────────────────────┘
                  │ uses
                  ▼
┌─────────────────────────────────────────┐
│         WebSocketProvider               │  ← Transport layer
│  - Real-time delivery                   │
│  - Reconnect buffering                  │
└─────────────────────────────────────────┘
```

| Queue | Purpose | Storage | Lifetime |
|-------|---------|---------|----------|
| **ActionQueue** | Persistence, retry, crash recovery | IndexedDB | Survives refresh |
| **WebSocket queue** | Buffer during disconnect | Memory | Lost on refresh |

---

## Milestones

| Order | Milestone | Value | Effort | Key Additions |
|-------|-----------|-------|--------|---------------|
| 1 | **Persistent Queue** | ⭐⭐⭐ HIGH | 2h | IndexedDB + crash recovery |
| 2 | **Queue Processing** | ⭐⭐⭐ HIGH | 3h | Handlers + lazy init + status gating |
| 3 | **UI Feedback** | ⭐⭐ MEDIUM | 2h | Event listener + offline banner |
| 4 | **Full Integration** | ⭐⭐⭐ HIGH | 1-2h | Wire together |

> **Note**: Concurrency is intentionally omitted. Start with sequential processing - add parallelism only if profiling shows it's needed.

---

## Milestone 1: Persistent Queue Foundation 🟡 MEDIUM RISK

**Goal**: Create IndexedDB storage for action queue with crash recovery.
**Value**: Enable persistence for reliability features.
**Risk**: Medium - IndexedDB schema changes require careful migration.
**Effort**: 2 hours

### Implementation

#### Step 1.1: Update IndexedDB Schema

**File**: `src/db/messages.ts`

```typescript
// Bump version number
const DB_VERSION = 5;  // or next version

// In onupgradeneeded, add:
if (!db.objectStoreNames.contains('action_queue')) {
  const queueStore = db.createObjectStore('action_queue', {
    keyPath: 'id',
    autoIncrement: true
  });

  queueStore.createIndex('status', 'status', { unique: false });
  queueStore.createIndex('taskType', 'taskType', { unique: false });
  queueStore.createIndex('key', 'key', { unique: false });
  queueStore.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
}
```

#### Step 1.2: Define Queue Types

**File**: `src/types/actionQueue.ts`

```typescript
export type ActionType =
  // Core actions
  | 'send-message'
  | 'save-user-config'  // UserConfig: folders, sidebar order, user preferences (UserSettingsModal)
  | 'update-space'      // Space settings: name, description, roles, emojis, stickers (SpaceSettingsModal)

  // Moderation
  | 'kick-user'
  | 'mute-user'
  | 'unmute-user'

  // Message actions
  | 'reaction'
  | 'pin-message'
  | 'unpin-message'
  | 'edit-message'
  | 'delete-message';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueTask {
  id?: number;  // Auto-generated
  taskType: ActionType;

  // Plaintext context - browser sandbox provides sufficient isolation
  // See "Why No Encryption-at-Rest?" section above
  context: Record<string, unknown>;

  // Grouping key for serial processing within group
  key: string;  // e.g., "spaceId/channelId" for messages

  // Status tracking
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: number;

  // Timestamps
  createdAt: number;
  processedAt?: number;
  processingStartedAt?: number;  // For crash recovery & multi-tab gating

  // Error info
  error?: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
  total: number;
}
```

#### Step 1.3: Add Queue CRUD Methods to MessageDB

**File**: `src/db/messages.ts`

```typescript
async addQueueTask(task: Omit<QueueTask, 'id'>): Promise<number> {
  await this.init();
  return new Promise((resolve, reject) => {
    const tx = this.db!.transaction('action_queue', 'readwrite');
    const store = tx.objectStore('action_queue');
    const request = store.add(task);

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

async getQueueTask(id: number): Promise<QueueTask | undefined> {
  await this.init();
  return new Promise((resolve, reject) => {
    const tx = this.db!.transaction('action_queue', 'readonly');
    const store = tx.objectStore('action_queue');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async getQueueTasksByStatus(status: TaskStatus, limit = 50): Promise<QueueTask[]> {
  await this.init();
  return new Promise((resolve, reject) => {
    const tx = this.db!.transaction('action_queue', 'readonly');
    const store = tx.objectStore('action_queue');
    const index = store.index('status');
    const request = index.getAll(status, limit);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async getAllQueueTasks(): Promise<QueueTask[]> {
  await this.init();
  return new Promise((resolve, reject) => {
    const tx = this.db!.transaction('action_queue', 'readonly');
    const store = tx.objectStore('action_queue');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async updateQueueTask(task: QueueTask): Promise<void> {
  await this.init();
  return new Promise((resolve, reject) => {
    const tx = this.db!.transaction('action_queue', 'readwrite');
    const store = tx.objectStore('action_queue');
    const request = store.put(task);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async deleteQueueTask(id: number): Promise<void> {
  await this.init();
  return new Promise((resolve, reject) => {
    const tx = this.db!.transaction('action_queue', 'readwrite');
    const store = tx.objectStore('action_queue');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async getQueueStats(): Promise<QueueStats> {
  await this.init();
  const all = await this.getAllQueueTasks();

  return {
    pending: all.filter(t => t.status === 'pending').length,
    processing: all.filter(t => t.status === 'processing').length,
    failed: all.filter(t => t.status === 'failed').length,
    completed: all.filter(t => t.status === 'completed').length,
    total: all.length
  };
}

async pruneCompletedTasks(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  await this.init();
  const cutoff = Date.now() - olderThanMs;
  const completed = await this.getQueueTasksByStatus('completed', 1000);

  let deleted = 0;
  for (const task of completed) {
    if (task.processedAt && task.processedAt < cutoff) {
      await this.deleteQueueTask(task.id!);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Reset tasks stuck in 'processing' state after crash.
 * Only resets tasks that have been processing for >1 minute.
 * Call this on app startup.
 */
async resetStuckProcessingTasks(stuckTimeoutMs = 60000): Promise<number> {
  await this.init();
  const cutoff = Date.now() - stuckTimeoutMs;
  const processing = await this.getQueueTasksByStatus('processing');

  let reset = 0;
  for (const task of processing) {
    // Only reset if stuck for more than timeout
    if (task.processingStartedAt && task.processingStartedAt < cutoff) {
      task.status = 'pending';
      task.processingStartedAt = undefined;
      task.retryCount = (task.retryCount || 0) + 1;
      await this.updateQueueTask(task);
      reset++;
      console.log(`[ActionQueue] Reset stuck task ${task.id} (${task.taskType})`);
    }
  }

  return reset;
}
```

### Verification (Milestone 1)

- [ ] Database migration runs without errors
- [ ] Can add tasks to queue
- [ ] Can query tasks by status
- [ ] Can update task status
- [ ] Can delete tasks
- [ ] Can get queue stats
- [ ] Crash recovery resets stuck tasks on startup
- [ ] TypeScript compiles

---

## Milestone 2: Queue Processing Engine 🟡 MEDIUM RISK

**Goal**: Background processor with lazy handler initialization and status-based multi-tab gating.
**Value**: Enables async processing, retry logic, offline support.
**Risk**: Medium - Core functionality, needs careful error handling.
**Effort**: 3 hours

### Implementation

#### Step 2.1: Create Handler Classes with Proper Toast Configuration

> **Toast Strategy**: Toasts only appear if handler defines `successMessage`/`failureMessage`. Messages use inline indicator (no toast). Config saves are silent on success.

**File**: `src/services/ActionQueueHandlers.ts`

```typescript
import { MessageDB } from '../db/messages';
import { MessageService } from './MessageService';
import { ConfigService } from './ConfigService';
import { SpaceService } from './SpaceService';
import { QueryClient } from '@tanstack/react-query';
import { showSuccess, showError } from '../utils/toast';

interface HandlerDeps {
  messageDB: MessageDB;
  messageService: MessageService;
  configService: ConfigService;
  spaceService: SpaceService;
  queryClient: QueryClient;
}

interface TaskHandler {
  execute: (context: any) => Promise<void>;
  isPermanentError: (error: Error) => boolean;
  successMessage?: string;   // Only show toast if defined
  failureMessage?: string;   // Only show toast if defined
}

/**
 * Class-based handlers for action queue tasks.
 * Groups all handlers with shared dependencies.
 */
export class ActionQueueHandlers {
  constructor(private deps: HandlerDeps) {}

  // === PHASE 1: Core Actions ===

  sendMessage: TaskHandler = {
    execute: async (context) => {
      // Check if space/channel still exists
      const space = await this.deps.messageDB.getSpace(context.spaceId);
      if (!space) {
        console.log(`[ActionQueue] Discarding message for deleted space: ${context.spaceId}`);
        return;
      }

      const channel = space.groups
        ?.flatMap(g => g.channels)
        .find(c => c.channelId === context.channelId);
      if (!channel) {
        console.log(`[ActionQueue] Discarding message for deleted channel: ${context.channelId}`);
        return;
      }

      await this.deps.messageService.submitChannelMessage(context);
      this.deps.queryClient.invalidateQueries({ queryKey: ['messages', context.channelId] });
    },
    isPermanentError: (error) => {
      return error.message.includes('400') ||
             error.message.includes('403') ||
             error.message.includes('404') ||
             error.message.includes('not found');
    },
    // NO toast - inline message indicator handles feedback
    successMessage: undefined,
    failureMessage: undefined,
  };

  saveUserConfig: TaskHandler = {
    execute: async (context) => {
      await this.deps.configService.saveConfig(context);
    },
    isPermanentError: (error) => {
      return error.message.includes('validation') || error.message.includes('invalid');
    },
    // Silent success, only show on failure
    successMessage: undefined,
    failureMessage: 'Failed to save settings',
  };

  updateSpace: TaskHandler = {
    execute: async (context) => {
      // Check if space still exists
      const space = await this.deps.messageDB.getSpace(context.spaceId as string);
      if (!space) {
        console.log(`[ActionQueue] Discarding update for deleted space: ${context.spaceId}`);
        return;
      }
      await this.deps.spaceService.updateSpace(context.space, this.deps.queryClient);
    },
    isPermanentError: (error) => {
      return error.message.includes('permission') ||
             error.message.includes('403') ||
             error.message.includes('not found');
    },
    successMessage: 'Space settings saved',
    failureMessage: 'Failed to save space settings',
  };

  // === PHASE 2: Extended Actions ===

  kickUser: TaskHandler = {
    execute: async (context) => {
      // Check if user still in space (may have left while offline)
      const members = await this.deps.messageDB.getSpaceMembers(context.spaceId);
      const userStillPresent = members?.some(m => m.address === context.targetUserId);
      if (!userStillPresent) {
        console.log('[ActionQueue] User already left space, skipping kick');
        return;
      }
      await this.deps.spaceService.kickUser(context);
      this.deps.queryClient.invalidateQueries({ queryKey: ['space', context.spaceId] });
    },
    isPermanentError: (error) => {
      return error.message.includes('permission') ||
             error.message.includes('403') ||
             error.message.includes('not found');
    },
    successMessage: 'User removed',
    failureMessage: 'Failed to remove user',
  };

  muteUser: TaskHandler = {
    execute: async (context) => {
      await this.deps.messageService.submitChannelMessage(context.muteMessage);
      this.deps.queryClient.invalidateQueries({ queryKey: ['mutedUsers', context.spaceId] });
    },
    isPermanentError: (error) => {
      return error.message.includes('permission') || error.message.includes('403');
    },
    successMessage: 'User muted',
    failureMessage: 'Failed to mute user',
  };

  unmuteUser: TaskHandler = {
    execute: async (context) => {
      await this.deps.messageService.submitChannelMessage(context.unmuteMessage);
      this.deps.queryClient.invalidateQueries({ queryKey: ['mutedUsers', context.spaceId] });
    },
    isPermanentError: (error) => {
      return error.message.includes('permission') || error.message.includes('403');
    },
    successMessage: 'User unmuted',
    failureMessage: 'Failed to unmute user',
  };

  reaction: TaskHandler = {
    execute: async (context) => {
      // Reactions are idempotent - re-adding same reaction is fine
      await this.deps.messageService.addReaction(context);
    },
    isPermanentError: (error) => {
      return error.message.includes('404'); // Message deleted
    },
    // Silent - non-critical action
    successMessage: undefined,
    failureMessage: undefined,
  };

  pinMessage: TaskHandler = {
    execute: async (context) => {
      const message = await this.deps.messageDB.getMessage(context.messageId);
      if (!message) return; // Message deleted - skip silently
      await this.deps.messageService.pinMessage(context);
    },
    isPermanentError: (error) => error.message.includes('404'),
    successMessage: undefined,
    failureMessage: 'Failed to pin message',
  };

  unpinMessage: TaskHandler = {
    execute: async (context) => {
      await this.deps.messageService.unpinMessage(context);
    },
    isPermanentError: (error) => error.message.includes('404'),
    successMessage: undefined,
    failureMessage: 'Failed to unpin message',
  };

  editMessage: TaskHandler = {
    execute: async (context) => {
      const message = await this.deps.messageDB.getMessage(context.messageId);
      if (!message) return; // Message deleted - skip silently
      await this.deps.messageService.editMessage(context);
    },
    isPermanentError: (error) => error.message.includes('404'),
    successMessage: undefined,
    failureMessage: 'Failed to edit message',
  };

  deleteMessage: TaskHandler = {
    execute: async (context) => {
      // Idempotent - if already deleted, that's success
      try {
        await this.deps.messageService.deleteMessage(context);
      } catch (err: any) {
        if (err.message?.includes('404')) return; // Already deleted
        throw err;
      }
    },
    isPermanentError: () => false, // Always retry (or silently succeed)
    successMessage: undefined,
    failureMessage: 'Failed to delete message',
  };

  getHandler(taskType: string): TaskHandler | undefined {
    const handlers: Record<string, TaskHandler> = {
      'send-message': this.sendMessage,
      'save-user-config': this.saveUserConfig,
      'update-space': this.updateSpace,
      'kick-user': this.kickUser,
      'mute-user': this.muteUser,
      'unmute-user': this.unmuteUser,
      'reaction': this.reaction,
      'pin-message': this.pinMessage,
      'unpin-message': this.unpinMessage,
      'edit-message': this.editMessage,
      'delete-message': this.deleteMessage,
    };
    return handlers[taskType];
  }
}
```

#### Step 2.2: Create ActionQueueService with Lazy Init & Status-Based Gating

> **Multi-tab safety**: Uses status-based gating instead of Web Locks API (simpler, cross-platform compatible). Re-fetches task status before processing to reduce race window.

**File**: `src/services/ActionQueueService.ts`

```typescript
import { MessageDB } from '../db/messages';
import { QueueTask, ActionType, QueueStats } from '../types/actionQueue';
import { ActionQueueHandlers } from './ActionQueueHandlers';
import { showError } from '../utils/toast';

export class ActionQueueService {
  private messageDB: MessageDB;
  private handlers: ActionQueueHandlers | null = null;  // Lazy init
  private isProcessing = false;
  private processInterval: ReturnType<typeof setInterval> | null = null;

  // Debounced queue update event
  private queueUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly queueUpdateDebounceMs = 500;

  // Config
  private readonly maxRetries = 3;
  private readonly baseRetryDelayMs = 2000;
  private readonly maxRetryDelayMs = 5 * 60 * 1000; // 5 minutes
  private readonly processIntervalMs = 1000;
  private readonly batchSize = 10;
  private readonly multiTabGraceMs = 30000; // 30 seconds grace for other tabs

  // Queue limits
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly MAX_TASK_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(messageDB: MessageDB) {
    this.messageDB = messageDB;
    // Note: handlers set later via setHandlers() to avoid circular deps
  }

  /**
   * Set handlers after all services are initialized.
   * Call this from the context provider after everything is wired up.
   */
  setHandlers(handlers: ActionQueueHandlers): void {
    this.handlers = handlers;
  }

  async enqueue(type: ActionType, context: Record<string, unknown>, key: string): Promise<number> {
    // Check queue size limits
    const stats = await this.messageDB.getQueueStats();
    if (stats.total >= this.MAX_QUEUE_SIZE) {
      await this.pruneOldTasks();

      const newStats = await this.messageDB.getQueueStats();
      if (newStats.pending >= this.MAX_QUEUE_SIZE / 2) {
        throw new Error('Action queue is full. Please try again later.');
      }
    }

    const task: Omit<QueueTask, 'id'> = {
      taskType: type,
      context,
      key,
      status: 'pending',
      retryCount: 0,
      maxRetries: this.maxRetries,
      nextRetryAt: Date.now(),
      createdAt: Date.now()
    };

    const id = await this.messageDB.addQueueTask(task);
    this.notifyQueueUpdated();
    this.processQueue();
    return id;
  }

  async start() {
    if (this.processInterval) return;

    // Reset stuck tasks from previous crash
    const reset = await this.messageDB.resetStuckProcessingTasks();
    if (reset > 0) {
      console.log(`[ActionQueue] Reset ${reset} stuck tasks on startup`);
    }

    this.processInterval = setInterval(() => this.processQueue(), this.processIntervalMs);
    this.processQueue();
  }

  stop() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (!navigator.onLine) return;
    if (!this.handlers) {
      console.warn('[ActionQueue] Handlers not initialized');
      return;
    }

    this.isProcessing = true;

    try {
      const now = Date.now();
      const pending = await this.messageDB.getQueueTasksByStatus('pending', this.batchSize);
      const ready = pending.filter(t => t.nextRetryAt <= now);

      if (ready.length === 0) return;

      // Sequential processing (simpler, safer)
      for (const task of ready) {
        await this.processTask(task);
      }

    } finally {
      this.isProcessing = false;
    }
  }

  private async processTask(task: QueueTask): Promise<void> {
    if (!this.handlers) {
      throw new Error('ActionQueueService: Handlers not initialized');
    }

    // === MULTI-TAB SAFETY: Status-based gating ===
    // Re-fetch task to check current status (reduces race window to milliseconds)
    const freshTask = await this.messageDB.getQueueTask(task.id!);
    if (!freshTask || freshTask.status !== 'pending') {
      // Another tab already grabbed it - skip
      return;
    }

    // Check if recently started by another tab (may still be processing)
    if (freshTask.processingStartedAt &&
        Date.now() - freshTask.processingStartedAt < this.multiTabGraceMs) {
      // Give the other tab time to finish
      return;
    }

    const handler = this.handlers.getHandler(task.taskType);
    if (!handler) {
      task.status = 'failed';
      task.error = 'No handler registered';
      await this.messageDB.updateQueueTask(task);
      this.notifyQueueUpdated();
      return;
    }

    // Mark as processing with timestamp for crash recovery & multi-tab gating
    task.status = 'processing';
    task.processingStartedAt = Date.now();
    await this.messageDB.updateQueueTask(task);

    try {
      await handler.execute(task.context);

      // Success - delete task and optionally show toast
      await this.messageDB.deleteQueueTask(task.id!);
      // Note: successMessage handled in handler if needed

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check for auth errors - don't retry, user needs to re-login
      if (err.message.includes('401') || err.message.includes('unauthorized')) {
        task.status = 'failed';
        task.error = 'Session expired. Please log in again.';
        showError('Session expired. Please log in again.');
        window.dispatchEvent(new CustomEvent('quorum:session-expired'));
        await this.messageDB.updateQueueTask(task);
        this.notifyQueueUpdated();
        return;
      }

      if (handler.isPermanentError(err)) {
        task.status = 'failed';
        task.error = err.message;
        task.processedAt = Date.now();
        if (handler.failureMessage) {
          showError(`${handler.failureMessage}: ${err.message}`);
        }
      } else {
        task.retryCount++;
        if (task.retryCount >= task.maxRetries) {
          task.status = 'failed';
          task.error = `Max retries exceeded: ${err.message}`;
          task.processedAt = Date.now();
          if (handler.failureMessage) {
            showError(`${handler.failureMessage}: ${err.message}`);
          }
        } else {
          task.status = 'pending';
          task.nextRetryAt = Date.now() + this.calculateBackoff(task.retryCount);
          task.error = err.message;
          // Don't show toast for retryable errors
        }
      }

      task.processingStartedAt = undefined;
      await this.messageDB.updateQueueTask(task);
    }

    this.notifyQueueUpdated();
  }

  /**
   * Debounced event to notify UI of queue changes.
   * Prevents event spam when processing many tasks rapidly.
   */
  private notifyQueueUpdated(): void {
    if (this.queueUpdateTimer) {
      clearTimeout(this.queueUpdateTimer);
    }

    this.queueUpdateTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('quorum:queue-updated'));
      this.queueUpdateTimer = null;
    }, this.queueUpdateDebounceMs);
  }

  private calculateBackoff(retryCount: number): number {
    const delay = this.baseRetryDelayMs * Math.pow(2, retryCount);
    return Math.min(delay, this.maxRetryDelayMs);
  }

  private async pruneOldTasks(): Promise<void> {
    const cutoff = Date.now() - this.MAX_TASK_AGE_MS;

    // Delete old completed tasks
    await this.messageDB.pruneCompletedTasks(this.MAX_TASK_AGE_MS);

    // Delete old failed tasks
    const failed = await this.messageDB.getQueueTasksByStatus('failed', 1000);
    for (const task of failed) {
      if (task.processedAt && task.processedAt < cutoff) {
        await this.messageDB.deleteQueueTask(task.id!);
      }
    }
  }

  async getStats(): Promise<QueueStats> {
    return this.messageDB.getQueueStats();
  }
}
```

#### Step 2.3: Service Initialization Order

> **Critical**: Services must be initialized in correct order to avoid circular dependencies.

**File**: `src/components/context/MessageDB.tsx` (or new context)

```typescript
// === INITIALIZATION ORDER ===

// 1. Create MessageDB (no deps)
const messageDB = new MessageDB();

// 2. Create ActionQueueService (only needs messageDB)
const actionQueueService = new ActionQueueService(messageDB);

// 3. Create other services (may reference actionQueueService for enqueuing)
const messageService = new MessageService({ messageDB, /* ... */ });
const configService = new ConfigService({ messageDB, /* ... */ });
const spaceService = new SpaceService({ messageDB, /* ... */ });

// 4. Create handlers (needs all services)
const handlers = new ActionQueueHandlers({
  messageDB,
  messageService,
  configService,
  spaceService,
  queryClient,
});

// 5. Wire handlers back to queue service (breaks circular dep)
actionQueueService.setHandlers(handlers);

// 6. Start processing
actionQueueService.start();
```

### Verification (Milestone 2)

- [ ] Tasks can be enqueued
- [ ] Background processor runs (sequential)
- [ ] Handlers execute correctly for each task type
- [ ] Toast notifications only when handler defines message
- [ ] Messages have NO toast (inline indicator handles it)
- [ ] `quorum:queue-updated` events fire (debounced)
- [ ] Retry logic works with exponential backoff
- [ ] Failed tasks marked correctly
- [ ] Offline detection stops processing
- [ ] Multi-tab: status gating prevents duplicate processing
- [ ] Auth errors trigger session-expired event

---

## Milestone 3: UI Feedback 🟢 LOW RISK

**Goal**: Notify users about queue status by listening to `quorum:queue-updated` events.
**Value**: Better UX - users know what's happening.
**Risk**: Low - UI-only changes.
**Effort**: 2 hours

### Implementation

#### Step 3.1: Create Queue Context with Event Listener

**File**: `src/components/context/ActionQueueContext.tsx`

```typescript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { QueueStats } from '../../types/actionQueue';
import { useMessageDB } from './MessageDB';

interface ActionQueueContextValue {
  stats: QueueStats;
  isOnline: boolean;
  refreshStats: () => Promise<void>;
}

const ActionQueueContext = createContext<ActionQueueContextValue | null>(null);

export function ActionQueueProvider({ children }: { children: React.ReactNode }) {
  const { actionQueueService } = useMessageDB();
  const [stats, setStats] = useState<QueueStats>({
    pending: 0, processing: 0, failed: 0, completed: 0, total: 0
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const refreshStats = useCallback(async () => {
    if (actionQueueService) {
      const newStats = await actionQueueService.getStats();
      setStats(newStats);
    }
  }, [actionQueueService]);

  // Listen for queue updates from ActionQueueService
  useEffect(() => {
    const handleQueueUpdated = () => {
      refreshStats();
    };

    window.addEventListener('quorum:queue-updated', handleQueueUpdated);
    return () => {
      window.removeEventListener('quorum:queue-updated', handleQueueUpdated);
    };
  }, [refreshStats]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger queue processing when back online
      actionQueueService?.processQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [actionQueueService]);

  // Initial stats load
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return (
    <ActionQueueContext.Provider value={{ stats, isOnline, refreshStats }}>
      {children}
    </ActionQueueContext.Provider>
  );
}

export function useActionQueue() {
  const context = useContext(ActionQueueContext);
  if (!context) throw new Error('useActionQueue must be used within ActionQueueProvider');
  return context;
}
```

#### Step 3.2: Add Offline Banner

**File**: `src/components/ui/OfflineBanner.tsx`

```typescript
import React from 'react';
import { useActionQueue } from '../context/ActionQueueContext';
import { t } from '@lingui/core/macro';

export function OfflineBanner() {
  const { isOnline, stats } = useActionQueue();

  if (isOnline && stats.pending === 0) return null;

  if (!isOnline) {
    return (
      <div className="offline-banner offline-banner--offline">
        <span>{t`You're offline`}</span>
        {stats.pending > 0 && <span> - {stats.pending} {t`actions queued`}</span>}
      </div>
    );
  }

  if (stats.pending > 0) {
    return (
      <div className="offline-banner offline-banner--syncing">
        <span>{t`Syncing`} ({stats.pending} {t`pending`})</span>
      </div>
    );
  }

  return null;
}
```

### Verification (Milestone 3)

- [ ] Context listens to `quorum:queue-updated` events
- [ ] Stats update automatically when queue changes
- [ ] Offline banner appears when offline
- [ ] Pending count shows in banner
- [ ] Banner disappears when queue empty and online
- [ ] Queue processing triggers when coming back online

---

## Milestone 4: Full Integration 🟡 MEDIUM RISK

**Goal**: Wire everything together for production use.
**Value**: Complete feature working end-to-end.
**Effort**: 1-2 hours

### Implementation

1. **Initialize ActionQueueService** in app startup with handlers (see M2 Step 2.3)
2. **Update WebsocketProvider** to use queue for message sending
3. **Wire OfflineBanner** into Layout component
4. **Update hooks** to route through queue where appropriate

### Which Operations Use the Queue?

| Operation | Action Type | Via ActionQueue? | Reason |
|-----------|-------------|-----------------|--------|
| **Send message** | `send-message` | ✅ Yes | Needs persistence, retry |
| **UserSettingsModal** | `save-user-config` | ✅ Yes | User preferences |
| **Folder create/edit/delete** | `save-user-config` | ✅ Yes | Local folder structure |
| **Folder drag-drop reorder** | `save-user-config` | ✅ Yes | Sidebar order |
| **Space drag-drop reorder** | `save-user-config` | ✅ Yes | Sidebar order |
| **SpaceSettingsModal** | `update-space` | ✅ Yes | Space name, roles, emojis, stickers |
| Reaction | `reaction` | ✅ Yes | Offline support |
| Pin/Unpin | `pin-message` | ✅ Yes | Offline support |
| Edit message | `edit-message` | ✅ Yes | Offline support |
| Delete message | `delete-message` | ✅ Yes | Offline support |
| Mute/Unmute | `mute-user` | ✅ Yes | Offline support |
| Kick user | `kick-user` | ✅ Yes | Offline support (with staleness check) |
| Listen subscription | - | ❌ No | Ephemeral, reconnect handles |
| Sync request | - | ❌ No | Ephemeral |
| Bookmark | - | ❌ No | Already local (syncs via config) |

> **Note**: `save-user-config` and `update-space` are distinct operations:
> - `save-user-config` → `ConfigService.saveConfig()` → User's local config (folders, preferences)
> - `update-space` → `SpaceService.updateSpace()` → Server-side space manifest (name, roles, emojis)

### Future: Concurrency (Optional)

> **Skip unless profiling shows it's needed.** With 80% of time being network latency, parallel processing provides minimal benefit over sequential.

### Verification (Milestone 4)

- [ ] Messages persist across refresh
- [ ] Config saves persist across crash
- [ ] Offline → Online syncs correctly
- [ ] Multi-tab doesn't cause duplicates
- [ ] All existing functionality works

---

## Files Summary

### New Files
- `src/types/actionQueue.ts` - Type definitions
- `src/services/ActionQueueService.ts` - Core queue service
- `src/services/ActionQueueHandlers.ts` - Class-based handlers
- `src/components/context/ActionQueueContext.tsx` - React context
- `src/components/ui/OfflineBanner.tsx` - Offline indicator

### Modified Files
- `src/db/messages.ts` (queue storage + crash recovery in M1)
- `src/components/Layout.tsx` (add OfflineBanner)
- `src/components/context/WebsocketProvider.tsx` (use queue)

---

## Definition of Done

- [ ] All milestones complete
- [ ] UI doesn't freeze during config saves
- [ ] Data persists across crashes/refreshes
- [ ] Offline mode queues actions correctly
- [ ] User sees appropriate feedback
- [ ] TypeScript compiles without errors
- [ ] All platforms tested (Electron + Web)

---

## Appendix: Design Decisions

### Why No Web Worker?

An earlier version of this task ([archived](./archived/background-action-queue-with-worker-crypto.md)) included Web Worker milestones for crypto offloading. After timing analysis, this was found to be **unnecessary**:

| Operation | Time | % of Total | Web Worker Benefit |
|-----------|------|------------|-------------------|
| **API call** | 5,500ms | 80% | ❌ Network latency - can't help |
| **Ed448 WASM signing** | 1,000ms | 14% | ⚠️ Requires private key - security risk |
| **DB queries** | 40ms | 0.6% | ❌ Already fast enough |
| **AES/SHA crypto** | <1ms | 0.01% | ✅ Could help, but 0.2ms is meaningless |

**Conclusion**: The 80% bottleneck is network latency. The solution is making operations **non-blocking via a background queue**, not moving sub-millisecond crypto to a worker.

> tested on _save space_ and _save space folder_ operations

### Why No Debouncing?

An earlier version of this task included config save debouncing (batching rapid saves into one). After analysis, this was found to be **unnecessary**:

| Scenario | Debounce Window (500ms) | Reality |
|----------|------------------------|---------|
| Drag folder A, then B | Would need <500ms between drops | Typical drag-drop takes 1-2 seconds |
| Rapid slider changes | ✅ Would help | Edge case, not the main problem |
| Programmatic batch updates | ✅ Would help | Rare in practice |

**Key insight**: The core problem is **blocking saves**, not duplicate saves. Once saves are non-blocking (via the queue), it doesn't matter if there are 3 saves instead of 1 - the UI never freezes.

**The reference implementation ([commit 81c2c5ca](https://github.com/QuilibriumNetwork/quorum-desktop/commit/81c2c5caaf92f7ecd5fdd157847ec773a63cd91b)) also did not include debouncing** - it queued all tasks and processed them sequentially.

> **Future**: If API load becomes a concern in production, debouncing can be added later as an optimization.

### Why No Encryption-at-Rest?

After threat model analysis, encrypting the action queue provides **minimal security benefit**:

| Threat | Without Encryption | With Encryption | Real Risk? |
|--------|-------------------|-----------------|------------|
| **Network exposure** | ❌ No - IndexedDB is local only | ❌ No | Not a concern |
| **Other websites** | ❌ No - IndexedDB is origin-isolated | ❌ No | Not a concern |
| **User sees own data** | ✅ Yes (DevTools) | ✅ Yes (they have the key) | **Not a threat** |
| **Browser extensions** | ⚠️ Some can access IndexedDB | ✅ Protected | Low-medium |
| **Malware on device** | ⚠️ Can read IndexedDB | ⚠️ Can also keylog password | Low benefit |

**Key points:**
1. IndexedDB is already origin-sandboxed
2. The user already has the key (they're logged in)
3. The reference commit (81c2c5ca) didn't encrypt either
4. Storing plaintext simplifies debugging (inspect queue in DevTools)

---

_Created: 2025-12-17_
_Updated: 2025-12-17 19:30_
_Status: Ready for Implementation_
