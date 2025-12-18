# Action Queue

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

The Action Queue is a persistent background task processing system that handles user operations asynchronously. It provides:

- **Instant UI feedback** through optimistic updates
- **Crash recovery** via IndexedDB persistence
- **Offline support** by queuing actions until connectivity is restored
- **Automatic retries** with exponential backoff for transient failures

## Architecture

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

### Key Components

| File | Purpose |
|------|---------|
| [ActionQueueService.ts](src/services/ActionQueueService.ts) | Core queue service - enqueuing, processing, retry logic |
| [ActionQueueHandlers.ts](src/services/ActionQueueHandlers.ts) | Task handlers for each action type |
| [ActionQueueContext.tsx](src/components/context/ActionQueueContext.tsx) | React context for queue state |
| [OfflineBanner.tsx](src/components/ui/OfflineBanner.tsx) | Offline status indicator |
| [OfflineBanner.scss](src/components/ui/OfflineBanner.scss) | Banner styles + layout push logic |
| [actionQueue.ts](src/types/actionQueue.ts) | Type definitions |

### Relationship to WebSocket Queue

The Action Queue works **in series** with the existing WebSocket queue:

```
ActionQueueService    →    MessageService/ConfigService    →    WebSocketProvider
(Persistence layer)        (Business logic)                    (Transport layer)
```

| Queue | Purpose | Storage | Lifetime |
|-------|---------|---------|----------|
| **ActionQueue** | Persistence, retry, crash recovery | IndexedDB | Survives refresh |
| **WebSocket queue** | Buffer during disconnect | Memory | Lost on refresh |

### Service Initialization

Services are initialized in order to avoid circular dependencies:

```typescript
// 1. Create MessageDB (no deps)
const messageDB = new MessageDB();

// 2. Create ActionQueueService (only needs messageDB)
const actionQueueService = new ActionQueueService(messageDB);

// 3. Create other services
const messageService = new MessageService({ messageDB, actionQueueService });

// 4. Create handlers (needs all services)
const handlers = new ActionQueueHandlers({ messageDB, messageService, ... });

// 5. Wire handlers back to queue service
actionQueueService.setHandlers(handlers);

// 6. Start processing
actionQueueService.start();
```

## Supported Action Types

| Action Type | Description | Hook/Service |
|-------------|-------------|--------------|
| `send-channel-message` | Send message to space channel (Triple Ratchet) | `MessageService.ts` |
| `send-dm` | Send direct message (Double Ratchet) | `MessageService.ts` |
| `save-user-config` | Save user settings, folders, sidebar order | `useUserSettings.ts`, `useFolderManagement.ts` |
| `update-space` | Update space settings (name, roles, emojis) | `useSpaceManagement.ts` |
| `kick-user` | Remove user from space | `useUserKicking.ts` |
| `mute-user` / `unmute-user` | Mute/unmute user in space | `useUserMuting.ts` |
| `reaction` | Add reaction to message | `useMessageActions.ts` |
| `pin-message` / `unpin-message` | Pin/unpin a message | `usePinnedMessages.ts` |
| `edit-message` | Edit a message | `MessageEditTextarea.tsx` |
| `delete-message` | Delete a message | `useMessageActions.ts` |

## Data Flow

### Optimistic UI Pattern

All queue-integrated actions follow this pattern:

```typescript
// 1. Optimistic UI update (INSTANT)
queryClient.setQueryData(queryKey, (oldData) => ({ ...oldData, /* changes */ }));

// 2. Persist to IndexedDB (DURABLE)
await messageDB.updateMessage(updatedMessage);

// 3. Queue server sync (EVENTUAL)
await actionQueueService.enqueue('action-type', context, dedupKey);
```

> **Important**: Use `setQueryData` for optimistic updates, not `invalidateQueries`. The latter may delay/skip refetches, causing offline actions to not appear in the UI.

### Message Sending

For messages, **signing** happens before queueing, **encryption** happens in the handler:

```
submitChannelMessage()
  1. Generate messageId (nonce)
  2. Sign message with Ed448 ← HAPPENS ONCE
  3. Add to cache (sendStatus: 'sending')
  4. Queue with signed message

ActionQueue Handler (retryable)
  1. Encrypt with Triple/Double Ratchet ← CAN RETRY SAFELY
  2. Send via WebSocket
  3. Update cache status to 'sent'
```

This separation ensures retries don't create duplicate messages - the same messageId/signature is preserved across retries.

### Multi-Tab Safety

The queue uses status-based gating to prevent duplicate processing:

1. Re-fetch task status before processing
2. Skip if status is not `pending` (another tab grabbed it)
3. Check `processingStartedAt` timestamp for grace period (30s)
4. Mark as `processing` with timestamp before executing

## UI Integration

### OfflineBanner

Displays **only when offline**:
- "You're offline" message with queued action count
- Dismissible X button (reappears on refresh or next offline event)
- Pushes layout down via `body.offline-banner-visible` class

When online, queue processing is silent - no "Syncing..." banner.

### useActionQueue Hook

```typescript
const { isOnline, stats, refreshStats } = useActionQueue();

// stats: { pending, processing, failed, completed, total }
```

### Events

| Event | Purpose |
|-------|---------|
| `quorum:queue-updated` | Queue state changed (debounced 500ms) |
| `quorum:session-expired` | Auth error (401) encountered |

## IndexedDB Schema

```typescript
interface QueueTask {
  id?: number;              // Auto-generated
  taskType: ActionType;
  context: Record<string, unknown>;
  key: string;              // Grouping key (e.g., "spaceId/channelId")
  status: TaskStatus;       // 'pending' | 'processing' | 'completed' | 'failed'
  retryCount: number;
  maxRetries: number;
  nextRetryAt: number;
  createdAt: number;
  processedAt?: number;
  processingStartedAt?: number;  // For crash recovery & multi-tab gating
  error?: string;
}
```

**Indexes**: `status`, `taskType`, `key`, `nextRetryAt`

## Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| `maxRetries` | 3 | Maximum retry attempts |
| `baseRetryDelayMs` | 2000 | Initial retry delay |
| `maxRetryDelayMs` | 300000 | Maximum retry delay (5 min) |
| `processIntervalMs` | 1000 | Queue polling interval |
| `batchSize` | 10 | Tasks per processing cycle |
| `multiTabGraceMs` | 30000 | Multi-tab coordination grace period |
| `MAX_QUEUE_SIZE` | 1000 | Maximum queue size |
| `MAX_TASK_AGE_MS` | 604800000 | Task retention (7 days) |

### Exponential Backoff

`min(baseRetryDelayMs * 2^retryCount, maxRetryDelayMs)` → 2s, 4s, 8s...

## Error Handling

### Error Classification

Each handler defines `isPermanentError(error)`:

**Permanent (No Retry)**: Validation errors, 400, 403, 404

**Retryable**: Network failures, timeouts, 5xx errors

**Auth Errors**: 401 triggers `quorum:session-expired` event, task fails immediately

### Idempotent Handlers

Some handlers are safe to retry by design:
- **Reactions**: Re-adding same reaction is a no-op
- **Delete**: Already deleted = success
- **Kick**: Checks if user already left

## Toast Feedback

| Action | Success | Failure |
|--------|---------|---------|
| Messages | None (inline indicator) | None |
| Config saves | None | "Failed to save settings" |
| Space updates | None | "Failed to save space settings" |
| Moderation | None | "Failed to [action] user" |
| Reactions | None | None |
| Pin/Unpin | None | "Failed to pin/unpin message" |

## Debugging

```javascript
// Check queue stats
await window.__actionQueue.getStats()

// View all tasks
await window.__messageDB.getAllQueueTasks()

// Force process queue
window.__actionQueue.processQueue()
```

## Technical Decisions

### No Web Worker

The bottleneck is network latency (~80% of operation time), not CPU. Moving crypto to a worker would add security concerns (private keys) with minimal benefit.

### No Debouncing

With non-blocking queued saves, multiple rapid operations don't freeze the UI. Sequential processing handles them without user impact.

### No Encryption-at-Rest

IndexedDB is origin-sandboxed. The user already has the key (they're logged in). Encryption would complicate debugging without meaningful security benefit.

### Sequential Processing

Simpler, avoids race conditions, prevents server overload, maintains message ordering.

## Related Documentation

- [Background Action Queue Task](.agents/tasks/.done/background-action-queue.md) - Implementation details and history

---

*Updated: 2025-12-18*
