# Action Queue

> **AI-Generated**: May contain errors. Verify before use.

## Overview

The Action Queue is a persistent background task processing system that handles user operations asynchronously. It solves **two main problems**:

### Problem 1: UI Freezing (Blocking Operations)

**Before**: Heavy operations (encryption, API calls) blocked the main thread, causing the UI to freeze for seconds during saves.

**After**: The main thread stays responsive. Operations complete instantly from the user's perspective:

1. **Validate input** - instant
2. **Update UI immediately** (optimistic update) - instant
3. **Queue action to IndexedDB** - instant (~1ms)
4. **Return to user** - instant

Heavy work (crypto, network calls) happens in the background processor, not blocking the UI.

**Examples of improved UX:**
- Settings modals close immediately after clicking Save (previously froze for seconds)
- Folder operations (create, edit, delete, reorder) are instant
- Space settings save without delay
- Message sending feels instantaneous

### Problem 2: Offline Support

Actions are persisted to IndexedDB and survive crashes/refreshes. When connectivity is restored, queued actions are automatically processed with exponential backoff retry.

### Summary of Benefits

- **Instant UI feedback** through optimistic updates
- **No more UI freezing** - heavy operations run in background
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
| Channel mute/unmute | Global | ✅ Fully queued, survives refresh (via save-user-config) |
| DM favorites | Global | ✅ Fully queued, survives refresh (via save-user-config) |
| Send DM | DM | ⚠️ Queued only when offline with existing sessions (see below) |
| Reactions (DM) | DM | ⚠️ Queued only when offline with existing sessions (see below) |
| Edit/delete DM | DM | ⚠️ Queued only when offline with existing sessions (see below) |

### DM Offline-Only Routing

**DM actions use a hybrid routing strategy** implemented in [MessageService.ts](src/services/MessageService.ts), [useMessageActions.ts](src/hooks/business/messages/useMessageActions.ts), and [MessageEditTextarea.tsx](src/components/message/MessageEditTextarea.tsx):

| Scenario | Path | Why |
|----------|------|-----|
| **Online** | Legacy path | Handles new devices, creates new sessions, cleans stale states |
| **Offline + existing sessions** | Action Queue | Persisted, crash-resilient, works with cached encryption states |
| **Offline + new conversation** | Legacy path | Fails immediately (expected - can't create sessions offline) |

**Implementation** checks `navigator.onLine` at enqueue time:

```typescript
const isOnline = navigator.onLine;
if (ENABLE_DM_ACTION_QUEUE && hasEstablishedSessions && !isOnline) {
  // Use Action Queue (offline only)
} else {
  // Use legacy path (online or new conversation)
}
```

**Why offline-only?** The Action Queue doesn't store `counterparty.device_registrations` (for security - see [007-plaintext-private-keys-fix.md](../../reports/action-queue/007-plaintext-private-keys-fix.md)). This means it cannot create new sessions for counterparty's new devices. By routing through legacy path when online, new devices are always handled correctly.

See [010-dm-registration-inbox-mismatch-fix.md](../../reports/action-queue/010-dm-registration-inbox-mismatch-fix.md) for the full analysis.

### Why Space Messages Work Fully Offline But DM Messages Don't

**Space messages** work fully offline because all encryption data is stored in IndexedDB:
- Encryption keys are persisted locally when you join a space
- You can send messages offline, close the app, reopen it, and they'll still be queued
- Messages are sent automatically when you come back online

**DM messages** have additional constraints:
- **Encryption states** are stored in IndexedDB (work offline for established sessions)
- **BUT** the Action Queue can't create *new* sessions (requires counterparty registration data)
- **AND** stale encryption states are cleaned up on DM page load (see [DirectMessage.tsx:198-245](src/components/direct/DirectMessage.tsx#L198-L245))

| Scenario | Space Message | DM Message |
|----------|---------------|------------|
| Online: send message | ✅ Via Action Queue | ✅ Via Legacy path |
| Offline: existing conversation | ✅ Via Action Queue | ✅ Via Action Queue |
| Offline: new conversation | ✅ Via Action Queue | ❌ Fails (expected) |
| App restart with pending | ✅ Resumes | ✅ Resumes (if sessions exist) |

**Why the difference?** Space encryption uses static keys. DM encryption uses Double Ratchet with per-device sessions that require counterparty registration data to create.

### Actions That Require Online (Not Queued)

| Action | Reason | UI Behavior |
|--------|--------|-------------|
| Create space | Server generates space ID | Warning callout + disabled button |
| Join space | Requires server handshake | N/A |
| Start new DM conversation | Needs counterparty registration | Fails with error |
| Delete conversation | Not yet integrated (see [Potential Future Actions](#potential-future-actions)) | N/A |
| Delete space | Not yet integrated (see [Potential Future Actions](#potential-future-actions)) | N/A |

### Why Some Actions Can't Be Queued

1. **Server-generated IDs**: Space creation requires the server to generate the `spaceId`. The client can't create this locally.

2. **New DM sessions require registration data**: Creating a new Double Ratchet session requires the counterparty's device registration (public keys, inbox addresses). The Action Queue deliberately doesn't store this data for security reasons. New conversations must be started online.

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
│  - Task context stored WITHOUT private keys                  │
│  - Survives crashes/refreshes                                │
│  - Status tracking (pending/processing/failed/completed)     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKGROUND PROCESSOR                            │
│  1. Keyset gate (waits for auth to complete)                 │
│  2. Status-based gating (multi-tab safety)                   │
│  3. Get next batch of pending tasks                          │
│  4. Execute task (crypto, API calls, WebSocket sends)        │
│  5. Update status, handle retries                            │
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

// 7. After passkey auth completes (in MessageDB.tsx):
actionQueueService.setUserKeyset({ deviceKeyset, userKeyset });
// Queue now starts processing tasks that require keys
```

**Important**: The queue waits for `setUserKeyset()` before processing tasks that require cryptographic keys. This ensures keys are never stored in IndexedDB - they're pulled from memory at processing time.

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
| `save-user-config` | Global | None | `useUserSettings.ts`, `useFolderManagement.ts`, `useFolderDragAndDrop.ts`, `useDeleteFolder.ts`, `useSpaceDragAndDrop.ts`, `useChannelMute.ts`, `useDMFavorites.ts` |
| `update-space` | Global | None | `useSpaceManagement.ts` |
| `kick-user` | Moderation | None | `useUserKicking.ts` |
| `mute-user` | Moderation | None | `useUserMuting.ts` |
| `unmute-user` | Moderation | None | `useUserMuting.ts` |

> **Note**: The `save-user-config` action type handles many UI operations because user configuration (stored in IndexedDB and synced to server) includes:
> - User profile settings (display name, avatar, preferences)
> - Folder structure (create, edit, delete, reorder folders)
> - Space organization (drag spaces into/out of folders, reorder spaces)
> - Channel mute settings (mute/unmute channels, show/hide muted channels toggle)
> - DM favorites (add/remove favorite conversations)
>
> All these operations use the same optimistic update + queue pattern, which is why folder, space organization, channel mute, and DM favorite operations are instant and non-blocking.

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

DM messages use **offline-only routing** - Action Queue is only used when offline:

```
User clicks Send in DM conversation
    │
    ▼
MessageService.submitMessage() (for DMs)
    ├─► Generate messageId (nonce)
    ├─► Sign message with Ed448 ← HAPPENS ONCE
    ├─► Add to React Query cache (sendStatus: 'sending')
    ├─► Check: hasEstablishedSessions && !navigator.onLine?
    │
    ├─► [If ONLINE] → Legacy path (handles new devices)
    │     └─► Full Double Ratchet flow with stale cleanup
    │
    └─► [If OFFLINE + sessions exist] → Action Queue
            └─► actionQueueService.enqueue('send-dm', context)
                    │
                    ▼
            ActionQueueHandlers.sendDm.execute()
                ├─► Get encryption states from IndexedDB
                ├─► For each existing session:
                │     └─► Encrypt with DoubleRatchetInboxEncrypt()
                ├─► Save updated encryption states
                ├─► Send all messages via sendDirectMessages()
                └─► Update message status to 'sent'
```

**Why offline-only?** The Action Queue only stores `selfUserAddress` (not full registration). It cannot create new sessions for counterparty's new devices. Online routing through legacy path ensures new devices are always handled.

### DM Secondary Actions (Reactions, Deletes, Edits)

DM secondary actions (reactions, deletes, edits) also use **offline-only routing**:

```
User adds reaction in DM
    │
    ▼
useMessageActions.handleReaction()
    ├─► Optimistic UI update (React Query cache)
    ├─► Persist to IndexedDB
    ├─► Check isDM = spaceId === channelId → true
    ├─► Check: navigator.onLine?
    │
    ├─► [If ONLINE] → Legacy path via onSubmitMessage()
    │
    └─► [If OFFLINE] → buildDmActionContext() + enqueue
            └─► actionQueueService.enqueue('reaction-dm', context)
                    │
                    ▼
            ActionQueueHandlers.reactionDm.execute()
                └─► encryptAndSendDm(address, reactionMessage, ...)
                        ├─► Double Ratchet encryption per existing inbox
                        └─► sendDirectMessages()
```

The same pattern applies to `edit-dm` in [MessageEditTextarea.tsx](src/components/message/MessageEditTextarea.tsx) and `delete-dm` in [useMessageActions.ts](src/hooks/business/messages/useMessageActions.ts).

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
  selfUserAddress: string;      // Sender's user address (only field needed from self)
  senderDisplayName?: string;   // For identity revelation
  senderUserIcon?: string;      // For identity revelation
  // NOTE: keyset NOT stored (security - pulled from memory at processing time)
  // NOTE: counterparty NOT stored (security - uses existing encryption states)
  // See: 007-plaintext-private-keys-fix.md, 009-dm-offline-registration-persistence-fix.md
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

## Legacy Path vs Action Queue

DM actions use **offline-only routing**: Legacy path when online, Action Queue when offline.

### When Each Path Is Used

| Condition | Path | Why |
|-----------|------|-----|
| Online + any DM action | Legacy | Handles new devices, creates new sessions |
| Offline + existing sessions | Action Queue | Persisted, crash-resilient |
| Offline + new conversation | Legacy | Fails (expected - can't create sessions) |
| `dmContext` unavailable | Legacy | Fallback for race conditions |
| `ENABLE_DM_ACTION_QUEUE = false` | Legacy | Feature disabled |

### Path Comparison

| Aspect | Action Queue Path | Legacy Path |
|--------|-------------------|-------------|
| **Visibility** | Shows in offline banner | No visibility |
| **Deduplication** | Yes (dedupe key) | No |
| **Retry Logic** | Exponential backoff | WebSocket reconnection |
| **Offline Support** | Yes (existing sessions) | Limited (WebSocket queue) |
| **New device support** | ❌ No | ✅ Yes |
| **Stale cleanup** | Relies on DM page load | ✅ Built-in |

**Key insight**: The legacy path handles more edge cases (new devices, stale cleanup). Action Queue provides better offline resilience for established sessions.

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
| `MAX_TASK_AGE_MS` | 259200000 | Task retention (3 days) |

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

### Keys Not Stored in Queue (Security)

**Private keys are never stored in IndexedDB.** Instead of storing keysets in the task context, handlers pull keys from memory at processing time via `actionQueueService.getUserKeyset()`.

This approach:
- **Avoids keys on disk** - keys exist only in memory after passkey auth
- **Auth gate** - queue waits for `setUserKeyset()` before processing key-requiring tasks
- **App restart handling** - queue persists, keys don't; after re-auth, queue resumes

See [007-plaintext-private-keys-fix.md](../../reports/action-queue/007-plaintext-private-keys-fix.md) for implementation details.

### Sequential Processing

Tasks are processed one at a time, not in parallel. This is a deliberate choice:

**Why not parallel?** Actions to the **same target** share mutable state:
- Space messages: Same Triple Ratchet encryption state
- DM messages: Same Double Ratchet encryption states
- User config: Same config object (folders, settings, profile)

Parallel processing would cause race conditions:
```
Action A reads config → Action B reads config → A writes → B writes (overwrites A!)
```

**Could we parallelize across different targets?** Yes, in theory:
- Space A message + Space B message → Safe (different encryption states)
- Space message + DM message + user config → Safe (independent)

But the complexity (lock groups, per-target semaphores, more failure modes) isn't justified by the benefit. The "slowness" users perceive is network/crypto latency, not queue ordering.

**Current approach**: Sequential is simple, safe, and correct. Grouped parallelism is a potential future optimization if throughput becomes a real pain point.

### Legacy Path as Primary for DMs

DM actions use **offline-only routing**: the legacy path is now the primary path when online. This design decision:
- **Handles new devices** - legacy path creates new Double Ratchet sessions
- **Cleans stale states** - legacy path has built-in stale encryption state cleanup
- **Reserves Action Queue for offline** - where its persistence benefits matter most

The Action Queue is only used for DMs when `navigator.onLine === false` and established sessions exist.

---

## Component Hierarchy for DM Context

For DM actions to use the Action Queue path (when offline), `dmContext` must be passed through the component hierarchy:

```
DirectMessage.tsx
  ├─► Cleans stale encryption states on page load (Layer 3 fix)
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

**Note**: When online, all DM actions use the legacy path regardless of `dmContext` availability. The hierarchy matters primarily for offline scenarios.

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

## Testing

Unit tests for the Action Queue are in `src/dev/tests/services/`:

```bash
# Run all Action Queue tests (98 tests)
yarn vitest src/dev/tests/services/ActionQueue --run
```

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `ActionQueueService.unit.test.ts` | 42 | Queue mechanics, retry logic, multi-tab safety |
| `ActionQueueHandlers.unit.test.ts` | 56 | All 15 handlers, context contracts, error classification |

Tests verify control flow and contracts, not real encryption (SDK is mocked). See [README](src/dev/tests/README.md) for details.

---

## Related Documentation

### Feature Documentation
- [Offline Support](offline-support.md) - Comprehensive offline capabilities including navigation and data viewing
- [Feature Flag](../../src/config/features.ts) - `ENABLE_DM_ACTION_QUEUE` controls DM routing

### Reports & Fixes
- [Keyset Security Fix (007)](../../reports/action-queue/007-plaintext-private-keys-fix.md) - Private keys not stored in queue
- [Offline-Only Routing Fix (009)](../../reports/action-queue/009-dm-offline-registration-persistence-fix.md) - Action Queue used only when offline
- [Inbox Mismatch Fix (010)](../../reports/action-queue/010-dm-registration-inbox-mismatch-fix.md) - Stale encryption state cleanup + offline-only routing

### Audits
- [DM Code Comparison Audit (003)](../../reports/action-queue/003-DM-message-code-comparison-audit.md) - Code analysis and verification
- [Space Message Audit (004)](../../reports/action-queue/004-space-message-code-comparison-audit.md) - Space message code comparison

### Full Report Index
- [Action Queue Report Index](../../reports/action-queue/INDEX.md) - All Action Queue related bugs and reports

---

*Updated: 2025-12-29 - Added DM favorites to Action Queue integration*
