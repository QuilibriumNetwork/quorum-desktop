<!-- 5480a5f6-776e-48a9-9927-5ea8d560526f f8f53856-2e50-4d33-8e43-5fd670a9f7f8 -->
# Background Action Queue (Web, per-key serial, global concurrency)

## Summary

Build a persistent background queue for user actions (web-only for now) with per-key serial ordering and a global concurrency cap configured via environment variable. It integrates with existing `MessageService`, `ConfigService`, and uses `MessageDB` (IndexedDB) for persistence. UI remains non-blocking; we show toasts and expose a lightweight status hook. A full task panel will be a follow-up.

- **Persistence**: New `action_queue` store in `MessageDB` (DB v4)
- **Concurrency**: Global cap from env `VITE_ACTION_QUEUE_CONCURRENCY` (default 4) with per-key serial (e.g., by conversation/user key)
- **Initial actions**: `send-message`, `save-user-config`, `kick-user`
- **Web scope now**: Storage + queue under web (native later via adapter)
- **UX**: Toasts + `useActionQueueStatus` hook; offline red banner when `navigator.onLine === false`; future full panel

References:

- Parallel concurrency pattern (chunked/limited Promise.all) [Medium](https://shnoman97.medium.com/parallel-processing-in-javascript-with-concurrency-c214e9facefd)
- React state and reset mechanics (avoid unintended resets when wiring providers) [React](https://react.dev/learn/preserving-and-resetting-state#resetting-state-at-the-same-position)
- State as component memory (queue status held in context + DB) [React](https://react.dev/learn/state-a-components-memory#when-a-regular-variable-isnt-enough)
- Responding to events (enqueue from UI handlers) [React](https://react.dev/learn/responding-to-events)
- Reducer for internal queue state transitions [React](https://react.dev/learn/extracting-state-logic-into-a-reducer)
- Effects for online/offline + resume [React](https://react.dev/reference/react/useEffect#displaying-different-content-on-the-server-and-the-client)

## Files to Add

- `src/actions/types.ts`
  - `export type ActionType = 'send-message' | 'save-user-config' | 'kick-user'`
  - `export interface QueueTask { id?: number; taskType: ActionType; context: any; key: string; status: 'pending'|'processing'|'completed'|'failed'; retryCount: number; createdAt: number; processedAt?: number; error?: string }`
  - `export type BuildKey = (task: QueueTask['context']) => string`
- `src/actions/handlers/sendMessage.ts`
  - Exports `handleSendMessage(ctx): Promise<void>` that: saves pending locally, triggers network send via `MessageService`, marks sent or error in DB
- `src/actions/handlers/saveUserConfig.ts`
  - Calls `ConfigService.saveConfig` and updates local state
- `src/actions/handlers/kickUser.ts`
  - Calls the relevant service (re-uses existing permission/role APIs)
- `src/services/ActionQueueService.ts`
  - Core queue logic: addTask, processQueue, resume, online/offline, retries, per-key serial + global concurrency
  - Reads concurrency from env: `const concurrency = Math.max(1, Number(import.meta.env.VITE_ACTION_QUEUE_CONCURRENCY ?? 4));`
- `src/components/context/ActionQueue.tsx`
  - Provider that instantiates `ActionQueueService`, exposes `addAction`, `useActionQueueStatus`, and starts processing on mount
- `src/hooks/actions/useActionQueue.ts`
  - Thin hook over context for components to enqueue actions and read status
- `src/config/actionQueue.ts`
  - Exports a helper to centralize the env read:
```ts
export const ACTION_QUEUE_CONCURRENCY = Math.max(
  1,
  Number((import.meta as any).env?.VITE_ACTION_QUEUE_CONCURRENCY ?? 4)
);
```


## File to Modify

- `src/db/messages.ts`
  - Bump DB_VERSION to 4; in `onupgradeneeded`, create `action_queue` store:
```ts
const queueStore = db.createObjectStore('action_queue', { keyPath: 'id', autoIncrement: true });
queueStore.createIndex('by_status', ['status']);
queueStore.createIndex('by_createdAt', ['createdAt']);
queueStore.createIndex('by_key_status', ['key','status']);
```

  - Add CRUD helpers: `addQueueTask`, `getPendingQueueTasks`, `updateQueueTask`, `deleteQueueTask`, `resetProcessingToPending` (for crash recovery)
- `web/main.tsx`
  - Wrap `App` with `ActionQueueProvider` (after `MessageDBProvider` so services are available)
- `src/services/MessageService.ts`
  - Export a helper usable by sendMessage handler (or reuse existing `submitMessage` flow without UI await); ensure it can be invoked headless
- A couple of minimal touchpoints to use `addAction` in DM/Channel submit paths (behind a flag or direct replacement)

## Core Design Details

- **Per-key serial**: `key` derived by action type:
  - `send-message`: `${spaceId}/${channelId}` or direct address
  - `save-user-config`: `${userAddress}`
  - `kick-user`: `${spaceId}/${userAddress}`
- **Global concurrency**: Read from `VITE_ACTION_QUEUE_CONCURRENCY` (default 4). Up to that many distinct keys processed in parallel; tasks for a single key execute sequentially.
- **Algorithm**:

  1. Load all `pending` tasks; group by `key`.
  2. Start up to `ACTION_QUEUE_CONCURRENCY` groups concurrently; within each group, await handlers sequentially.
  3. Mark task `processing` before run; on success set `completed` and delete (or keep with processedAt); on failure increment retry with backoff, set `failed` after max retries.
  4. On init, set any lingering `processing` to `pending` to recover.

- **Online/Offline**: Process only when `navigator.onLine === true`. Listen to `online`/`offline` to pause/resume.
- **Crash/Refresh resilience**: Queue persisted; resumed by provider on mount.
- **Toasts + status**: Use existing notification utilities to show success/failure. Status hook returns counts per status and in-flight keys for badges.

## Minimal Snippets

- `addAction` usage (component):
```ts
const { addAction } = useActionQueue();
await addAction('send-message', { spaceId, channelId, ...msg });
```

- Concurrency setting (centralized):
```ts
import { ACTION_QUEUE_CONCURRENCY } from '@/config/actionQueue';
// Use ACTION_QUEUE_CONCURRENCY inside ActionQueueService
```

- Concurrency skeleton in `ActionQueueService`:
```ts
async processQueue() {
  if (this.processing) return; this.processing = true;
  await this.db.resetProcessingToPending();
  const pending = await this.db.getPendingQueueTasks();
  const groups = groupByKey(pending);
  const keys = Object.keys(groups);
  for (let i = 0; i < keys.length; i += ACTION_QUEUE_CONCURRENCY) {
    const slice = keys.slice(i, i + ACTION_QUEUE_CONCURRENCY);
    await Promise.all(slice.map(k => this.processKeySerial(groups[k])));
  }
  this.processing = false;
}
```


## Integration Steps

1. Add provider to `web/main.tsx`. Ensure provider order keeps `MessageDB` available to the queue.
2. Wire `send-message` path to enqueue instead of awaiting network send:

   - In `src/components/direct/DirectMessage.tsx` and `src/components/space/Channel.tsx`, call `addAction('send-message', ctx)` and immediately update UI (pending saved by handler).

3. For `save-user-config` and `kick-user`, add non-blocking buttons that enqueue actions and optimistically update local state if applicable.

## Success Criteria

- Sending a message returns immediately; the message appears as pending, transitions to sent or error.
- Page refresh resumes queued tasks; interrupted tasks recover from `processing`.
- Multiple conversations can send in parallel; per conversation, order is preserved.
- Toasts appear on completion/failure; `useActionQueueStatus` shows correct counts.

## Future Work

- Native storage adapter and provider wrappers for React Native (AsyncStorage-based)
- Full background task panel listing, filtering, retry, and details
- Backoff tuning and per-action retry policies

### To-dos

- [ ] Add action_queue store and helpers to src/db/messages.ts
- [ ] Create ActionQueueService with per-key serial and global concurrency
- [ ] Implement sendMessage/saveUserConfig/kickUser handlers
- [ ] Add ActionQueueProvider and useActionQueue hook
- [ ] Wrap web/main.tsx with ActionQueueProvider
- [ ] Replace send-message calls in DirectMessage and Channel
- [ ] Replace save-user-config and kick-user calls
- [ ] Expose useActionQueueStatus and toasts for success/failure
- [ ] Add red OfflineBanner and wire to online/offline events
- [ ] Add full Background Tasks panel (list queued/failed)