# Action Queue

> **AI-Generated**: May contain errors. Verify before use.

## Overview

The Action Queue is a persistent background task processing system that handles user operations asynchronously. It provides:

- **Instant UI feedback** through optimistic updates
- **Crash recovery** via IndexedDB persistence
- **Offline support** by queuing actions until connectivity is restored
- **Automatic retries** with exponential backoff for transient failures
- **Visibility** through offline banner counter ("n actions queued")

## Offline Support Summary

Not all actions can be queued for offline use. This table shows what works offline:

### Actions That Work Offline (Queued)

| Action | Category | Notes |
|--------|----------|-------|
| Send space message | Space | ✅ Fully queued, survives refresh |
| Reactions (space) | Space | ✅ Fully queued, survives refresh |
| Pin/unpin message | Space | ✅ Fully queued, survives refresh |
| Edit message (space) | Space | ✅ Fully queued, survives refresh |
| Delete message (space) | Space | ✅ Fully queued, survives refresh |
| Save user config | Global | ✅ Fully queued, survives refresh |
| Update space settings | Global | ✅ Fully queued, survives refresh |
| Kick/mute/unmute user | Moderation | ✅ Fully queued, survives refresh |
| Send DM | DM | ⚠️ Works if conversation was opened online (see note below) |
| Reactions (DM) | DM | ⚠️ Works if conversation was opened online (see note below) |
| Edit/delete DM | DM | ⚠️ Works if conversation was opened online (see note below) |

### Why Space Messages Work Fully Offline But DM Messages Don't

**Space messages** work fully offline because all encryption data is stored in IndexedDB:
- Encryption keys are persisted locally when you join a space
- You can send messages offline, close the app, reopen it, and they'll still be queued
- Messages are sent automatically when you come back online

**DM messages** have a limitation because counterparty registration data (public keys, inbox addresses) is only cached in React Query (memory), not persisted to IndexedDB:

| Scenario | Space Message | DM Message |
|----------|---------------|------------|
| Send while online → go offline → come back | ✅ Sends | ✅ Sends |
| Go offline → send → close app → reopen → come back | ✅ Sends | ❌ Lost (silent fail) |
| Open conversation online → go offline → send | ✅ Sends | ✅ Sends (if no refresh) |
| Start app offline → try to send | ✅ Sends | ❌ Silent fail |

**Why the difference?** Space encryption uses keys stored in IndexedDB (persisted). DM encryption requires the counterparty's registration data which must be fetched from the server and is only cached in memory.

**Known UX issue**: When DM sending fails due to missing registration, it fails silently (just a console.warn). This should show a user-visible error or disable the composer.

### Actions That Require Online (Not Queued)

| Action | Reason | UI Behavior |
|--------|--------|-------------|
| Create space | Server generates space ID | Warning callout + disabled button |
| Join space | Requires server handshake | N/A |
| Start new DM conversation | Needs counterparty registration | Silent fail |
| DM after page refresh | Registration cache lost | Silent fail |
| Delete conversation | Not yet integrated (see [Potential Future Actions](#potential-future-actions)) | N/A |
| Delete space | Not yet integrated (see [Potential Future Actions](#potential-future-actions)) | N/A |

### Why Some Actions Can't Be Queued

1. **Server-generated IDs**: Space creation requires the server to generate the `spaceId`. The client can't create this locally.

2. **Registration data not persisted**: DM encryption requires the counterparty's registration (public keys, inbox addresses). Unlike Space keys which are stored in IndexedDB, registration data is only cached in React Query memory. To fix this, registration data would need to be persisted to IndexedDB.

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
| [OfflineBanner.tsx](src/components/ui/OfflineBanner.tsx) | Offline status indicator with queue count |
| [actionQueue.ts](src/types/actionQueue.ts) | Type definitions |

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

---

## Space vs DM: Two Different Encryption Systems

The action queue handles two fundamentally different messaging systems with different encryption protocols.

### Encryption Protocol Comparison

| Aspect | Space Messages | DM Messages |
|--------|----------------|-------------|
| **Protocol** | Triple Ratchet | Double Ratchet |
| **Encryption States** | 1 per space | N per device inbox |
| **Recipients** | All space members via Hub | Specific device inboxes |
| **Transport** | `sendHubMessage()` | `sendDirectMessages()` (WebSocket) |
| **Identity** | Always known (space members) | Hidden until reply |
| **ID Structure** | `spaceId` ≠ `channelId` | `spaceId` === `channelId` (both = address) |

### DM Detection

Code detects DMs using this pattern:
```typescript
const isDM = spaceId === channelId;
```

For DMs, the counterparty's wallet address is used for both `spaceId` and `channelId`.

---

## Supported Action Types

For a summary of which actions work offline, see [Offline Support Summary](#offline-support-summary) above.

| Action Type | Category | Encryption | Source Location |
|-------------|----------|------------|-----------------|
| `send-channel-message` | Space | Triple Ratchet | `MessageService.ts` |
| `reaction` | Space | Triple Ratchet | `useMessageActions.ts` |
| `pin-message` | Space | Triple Ratchet | `usePinnedMessages.ts` |
| `unpin-message` | Space | Triple Ratchet | `usePinnedMessages.ts` |
| `edit-message` | Space | Triple Ratchet | `MessageEditTextarea.tsx` |
| `delete-message` | Space | Triple Ratchet | `useMessageActions.ts` |
| `send-dm` | DM | Double Ratchet | `MessageService.ts` |
| `reaction-dm` | DM | Double Ratchet | `useMessageActions.ts` |
| `delete-dm` | DM | Double Ratchet | `useMessageActions.ts` |
| `edit-dm` | DM | Double Ratchet | `MessageEditTextarea.tsx` |
| `save-user-config` | Global | None | `useUserSettings.ts` |
| `update-space` | Global | None | `useSpaceManagement.ts` |
| `kick-user` | Moderation | None | `useUserKicking.ts` |
| `mute-user` | Moderation | None | `useUserMuting.ts` |
| `unmute-user` | Moderation | None | `useUserMuting.ts` |

---

## Handler Architecture

### Space Message Handler Flow

```
User clicks Send in Space channel
    │
    ▼
MessageService.submitChannelMessage()
    ├─► Generate messageId (nonce)
    ├─► Sign message with Ed448 ← HAPPENS ONCE
    ├─► Add to React Query cache (sendStatus: 'sending')
    └─► actionQueueService.enqueue('send-channel-message', context)
            │
            ▼
ActionQueueHandlers.sendChannelMessage.execute()
    ├─► Check space/channel still exists
    ├─► Get Triple Ratchet encryption state
    ├─► Encrypt with TripleRatchetEncrypt()
    ├─► Send via sendHubMessage()
    ├─► Save updated encryption state
    └─► Update message status to 'sent'
```

### DM Message Handler Flow

```
User clicks Send in DM conversation
    │
    ▼
MessageService.submitMessage() (for DMs)
    ├─► Generate messageId (nonce)
    ├─► Sign message with Ed448 ← HAPPENS ONCE
    ├─► Add to React Query cache (sendStatus: 'sending')
    └─► actionQueueService.enqueue('send-dm', context)
            │
            ▼
ActionQueueHandlers.sendDm.execute()
    ├─► Get all inbox addresses (self + counterparty devices)
    ├─► Clean up stale encryption states
    ├─► For each target inbox:
    │     ├─► Check for existing encryption state
    │     ├─► Encrypt with DoubleRatchetInboxEncrypt() or
    │     │   NewDoubleRatchetSenderSession() (first message)
    │     └─► Collect sealed message
    ├─► Save encryption states
    ├─► Send all messages via sendDirectMessages()
    └─► Update message status to 'sent'
```

### DM Secondary Actions (Reactions, Deletes, Edits)

DM secondary actions use a shared helper `encryptAndSendDm()`:

```
User adds reaction in DM
    │
    ▼
useMessageActions.handleReaction()
    ├─► Optimistic UI update (React Query cache)
    ├─► Persist to IndexedDB
    ├─► Check isDM = spaceId === channelId → true
    ├─► buildDmActionContext() → get self, counterparty, keyset
    └─► actionQueueService.enqueue('reaction-dm', context)
            │
            ▼
ActionQueueHandlers.reactionDm.execute()
    └─► encryptAndSendDm(address, reactionMessage, ...)
            ├─► Double Ratchet encryption per inbox
            └─► sendDirectMessages()
```

### Context Requirements by Action Type

#### Space Actions Context
```typescript
{
  spaceId: string;
  channelId: string;
  signedMessage?: Message;      // For send-channel-message
  reactionMessage?: object;     // For reaction
  editMessage?: object;         // For edit-message
  deleteMessage?: object;       // For delete-message
  currentPasskeyInfo: object;   // User identity
}
```

#### DM Actions Context
```typescript
{
  address: string;              // Counterparty wallet address
  signedMessage?: Message;      // For send-dm
  reactionMessage?: object;     // For reaction-dm
  editMessage?: object;         // For edit-dm
  deleteMessage?: object;       // For delete-dm
  messageId?: string;           // For edit-dm (to check if still exists)
  self: UserRegistration;       // Sender's registration
  counterparty: UserRegistration; // Recipient's registration
  keyset: {
    deviceKeyset: DeviceKeyset;
    userKeyset: UserKeyset;
  };
  senderDisplayName?: string;   // For identity revelation
  senderUserIcon?: string;      // For identity revelation
}
```

---

## Deduplication Keys

Each action type uses a unique deduplication key to prevent duplicate actions:

| Action Type | Dedupe Key Format |
|-------------|-------------------|
| `send-channel-message` | `send:${spaceId}:${channelId}:${messageId}` |
| `send-dm` | `send-dm:${address}:${messageId}` |
| `reaction` | `reaction:${spaceId}:${channelId}:${messageId}:${emoji}:${userAddress}` |
| `reaction-dm` | `reaction-dm:${address}:${messageId}:${emoji}` |
| `delete-message` | `delete:${spaceId}:${channelId}:${messageId}` |
| `delete-dm` | `delete-dm:${address}:${messageId}` |
| `edit-message` | `edit:${spaceId}:${channelId}:${messageId}` |
| `edit-dm` | `edit-dm:${address}:${messageId}` |

---

## Legacy Fallback Path

DM secondary actions (reactions, deletes, edits) have a **legacy fallback** when `dmContext` is unavailable.

### When Fallback Triggers

The fallback triggers when:
- `dmContext` prop is not passed through component hierarchy
- `buildDmActionContext()` returns `null` (missing registration or keyset)
- Race conditions during component mounting

### Fallback Flow

```
handleReaction() (DM)
    ├─► isDM = true
    ├─► buildDmActionContext() → null (context unavailable)
    └─► onSubmitMessage({ type: 'reaction', ... })  ← FALLBACK
            │
            ▼
MessageService.submitMessage()
    └─► enqueueOutbound() (WebSocket queue)
            └─► Double Ratchet encryption + send
```

### Fallback Characteristics

| Aspect | Action Queue Path | Legacy Fallback Path |
|--------|-------------------|---------------------|
| **Visibility** | Shows in offline banner | No visibility |
| **Deduplication** | Yes (dedupe key) | No |
| **Retry Logic** | Exponential backoff | WebSocket reconnection |
| **Offline Support** | Yes | Yes (WebSocket queue) |

The fallback works correctly for both online and offline scenarios - it just lacks the action queue's visibility and deduplication features.

---

## Data Flow Patterns

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

### Sign Once, Encrypt on Retry

For messages, **signing** happens before queueing, **encryption** happens in the handler:

```
submitChannelMessage() / submitMessage()
  1. Generate messageId (nonce)
  2. Sign message with Ed448 ← HAPPENS ONCE
  3. Add to cache (sendStatus: 'sending')
  4. Queue with signed message

ActionQueue Handler (retryable)
  1. Encrypt with Triple/Double Ratchet ← CAN RETRY SAFELY
  2. Send via WebSocket/Hub
  3. Update cache status to 'sent'
```

This separation ensures retries don't create duplicate messages - the same messageId/signature is preserved across retries.

---

## Relationship to WebSocket Queue

The Action Queue works **in series** with the existing WebSocket queue:

```
ActionQueueService    →    MessageService/ConfigService    →    WebSocketProvider
(Persistence layer)        (Business logic)                    (Transport layer)
```

| Queue | Purpose | Storage | Lifetime |
|-------|---------|---------|----------|
| **ActionQueue** | Persistence, retry, crash recovery | IndexedDB | Survives refresh |
| **WebSocket queue** | Buffer during disconnect | Memory | Lost on refresh |

---

## Multi-Tab Safety

The queue uses status-based gating to prevent duplicate processing:

1. Re-fetch task status before processing
2. Skip if status is not `pending` (another tab grabbed it)
3. Check `processingStartedAt` timestamp for grace period (30s)
4. Mark as `processing` with timestamp before executing

---

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

---

## IndexedDB Schema

```typescript
interface QueueTask {
  id?: number;              // Auto-generated
  taskType: ActionType;
  context: Record<string, unknown>;
  key: string;              // Grouping/dedup key
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

---

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

---

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

---

## Toast Feedback

| Action | Success | Failure |
|--------|---------|---------|
| Messages | None (inline indicator) | None |
| Config saves | None | "Failed to save settings" |
| Space updates | None | "Failed to save space settings" |
| Moderation | None | "Failed to [action] user" |
| Reactions | None | None |
| Pin/Unpin | None | "Failed to pin/unpin message" |
| DM secondary actions | None | "Failed to edit/delete message" |

---

## Debugging

```javascript
// Check queue stats
await window.__actionQueue.getStats()

// View all tasks
await window.__messageDB.getAllQueueTasks()

// Force process queue
window.__actionQueue.processQueue()
```

---

## Technical Decisions

### No Web Worker

The bottleneck is network latency (~80% of operation time), not CPU. Moving crypto to a worker would add security concerns (private keys) with minimal benefit.

### No Debouncing

With non-blocking queued saves, multiple rapid operations don't freeze the UI. Sequential processing handles them without user impact.

### No Encryption-at-Rest

IndexedDB is origin-sandboxed. The user already has the key (they're logged in). Encryption would complicate debugging without meaningful security benefit.

### Sequential Processing

Simpler, avoids race conditions, prevents server overload, maintains message ordering.

### Legacy Fallback Preserved

The legacy `onSubmitMessage` path is intentionally preserved for DM secondary actions. This provides resilience for edge cases (race conditions, missing context) while the action queue path provides better visibility and deduplication.

---

## Component Hierarchy for DM Context

For DM actions to use the action queue (not fallback), `dmContext` must be passed through the component hierarchy:

```
DirectMessage.tsx
  └─► Constructs dmContext: { self: self.registration, counterparty: registration.registration }
      │
      ▼
MessageList.tsx (dmContext prop)
      │
      ▼
Message.tsx (dmContext prop)
  ├─► useMessageActions({ ..., dmContext }) → for reactions, deletes
  └─► MessageEditTextarea (dmContext prop) → for edits
```

If `dmContext` is not available at any point, the fallback path is used.

---

## Potential Future Actions

These actions could be integrated with the action queue but are not yet:

| Action Type | Current Location | Notes |
|-------------|------------------|-------|
| `delete-conversation` | `MessageService.deleteConversation()` | Multiple DB operations + Double Ratchet encryption |
| `delete-space` | `SpaceService.deleteSpace()` | Multiple DB operations + Hub envelope + API calls |

### Recommended Integration Approach

Both actions involve crypto (similar to `kick-user` which is already queued). Integration would follow this pattern:

```
User clicks Delete
    │
    ├─► Immediately: Delete local data (messages, keys, states)
    ├─► Immediately: Update React Query cache (item disappears)
    └─► Queue: 'delete-conversation-notify' or 'delete-space-notify'
            │
            ▼ (when online)
        Send notification to counterparty/server
```

This provides:
- **Instant feedback** - conversation/space disappears immediately
- **Offline support** - works even when disconnected
- **Best-effort notification** - counterparty gets notified when possible

The counterparty notification is already "best effort" (wrapped in try/catch), so queuing it is safe.

---

## Related Documentation

- [Offline Support](offline-support.md) - Comprehensive offline capabilities including navigation and data viewing
- [DM Action Queue Handlers Task](../../tasks/dm-action-queue-handlers.md) - Implementation details
- [DM Code Comparison Audit](../../reports/action-queue/003-DM-message-code-comparison-audit.md) - Code analysis and verification

---

*Updated: 2025-12-20 - Added Offline Support Summary section*
