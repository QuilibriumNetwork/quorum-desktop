---
type: task
title: Sync Toast Notifications
status: done
complexity: medium
ai_generated: true
created: 2025-12-14T00:00:00.000Z
updated: '2026-05-18'
---

# Sync Toast Notifications

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## 2026-05-18 — Reworked (current behavior)

The original implementation below was reworked because the toast almost never fired in practice. Root cause: the trigger was a per-chunk message-count threshold (`>= 20`), but the new manifest/delta sync protocol chunks by byte size (5MB), so most syncs arrive as a single delta with a wide range of message counts and the threshold check produced non-deterministic results. It also fired late (after data verification, inside the receive handler), missing the user-anxious window between login and first delta arrival.

**New trigger point:** `SyncService.requestSync()` — the toast fires the moment a sync handshake is initiated, regardless of expected delta size. This is the original spec's "intent-based" goal, just at the request stage rather than `initiateSync()`.

**When the toast appears (sync is episodic, not continuous):**
- App startup, 10s after login, once per space — [MessageDB.tsx:497-505](../../../src/components/context/MessageDB.tsx#L497-L505)
- Accepting an invite — [InvitationService.ts:900](../../../src/services/InvitationService.ts#L900)
- Manual "Sync now" from Space Settings — [SpaceSettingsModal.tsx:58](../../../src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx#L58)

Live messages received over the open WebSocket are NOT sync — they don't trigger the toast.

**Dismiss logic — two-timer system (lives in `src/utils/toast.ts`):**

The dismiss path is much narrower than the fire path — a sync handshake can complete (or fail) without ever producing a `messageDelta`, so a single dismiss timer keyed only on chunk arrival was leaving the toast stuck indefinitely (most visible in lone-member or quiet spaces, where no peer ever responds to `sync-request`). Fix: two cooperating timers, both centralised in `toast.ts`.

1. **Idle dismiss (happy path):** 5s after the last `sync-messages` / `sync-delta` chunk arrives. Reset on every chunk via `noteSyncActivity()` in MessageService.ts.
2. **Fallback dismiss (safety net):** 15s hard maximum from when the toast was shown. Armed by `showSyncToast()` in SyncService.requestSync(). Cleared as soon as the first chunk arrives (idle dismiss takes over). Handles: lone-member spaces, all peers offline, peer responds with metadata-only envelopes, handshake errors, anything that doesn't produce a `messageDelta`.

Manual X-close still works in both states.

**Trade-off accepted:** A genuinely large sync that takes >15s before the *first* chunk arrives would lose the toast prematurely. In practice, the first chunk from a willing peer arrives within 1-2s of `initiateSync` running, so 15s is a comfortable margin. Once any chunk arrives, the idle timer takes over and the toast stays for the full duration of activity.

**Files changed in rework (2026-05-18):**
- `src/utils/toast.ts` — added `showSyncToast()` and `noteSyncActivity()` helpers; centralised the two timers (`syncIdleTimer`, `syncFallbackTimer`) as module state. Constants: `SYNC_TOAST_MAX_LIFETIME_MS = 15_000`, `SYNC_TOAST_IDLE_DISMISS_MS = 5_000`.
- `src/services/SyncService.ts` — calls `showSyncToast(t\`Syncing...\`)` at top of `requestSync()`; added toast/`t` imports.
- `src/services/MessageService.ts` — removed two per-chunk threshold checks (the source of the original non-determinism); removed module-level `syncDismissTimer` (now in toast.ts); both chunk-arrival sites call `noteSyncActivity()` instead.

---

## Original spec (superseded — kept for historical context)

**Files**:
- `src/utils/toast.ts`
- `src/components/Layout.tsx:43-86`
- `src/services/SyncService.ts:174-230`
- `src/services/MessageService.ts:43, 2747-2860`

## What & Why

Users have no visibility when a space is syncing messages. This is problematic when:
1. Joining a new space via invite link
2. Logging in on a new device (spaces restored from config)
3. Returning to a space after being away with many messages to catch up

Show "Syncing space..." toast (info) at sync START when >= 20 messages need to sync. Toast persists during sync and auto-dismisses 5 seconds after last sync chunk received. User can manually close via X.

## Context

- **Trigger point**: `SyncService.initiateSync()` - we know sync will happen and have the message delta
- **Threshold**: Only show toast when >= 20 messages to sync (avoids spam during periodic syncs)
- **Dismiss logic**: 5 seconds after last `sync-messages` chunk (tracks sync activity)

### Sync Flow
```
requestSync() → 'sync-request' to hub
  → peers respond with 'sync-info' (includes messageCount)
  → candidates accumulate
  → initiateSync() after 1-30s
    → FILTER candidates with more messages
    → IF delta >= 20: SHOW PERSISTENT TOAST ← here
    → sends 'sync-initiate'
    → peer responds with sync-messages chunks
    → EACH CHUNK: reset 5s dismiss timer ← here
    → 5s after last chunk: DISMISS TOAST ← here
```

## Implementation

### Step 1: Extend Toast System
- [ ] **Add persistent toast support** (`src/utils/toast.ts`)
  ```typescript
  export const showPersistentToast = (
    id: string,
    message: string,
    variant: ToastVariant = 'info'
  ): void => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('quorum:toast', {
        detail: { id, message, variant, persistent: true },
      })
    );
  };

  export const dismissToast = (id: string): void => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('quorum:toast-dismiss', { detail: { id } })
    );
  };
  ```

- [ ] **Update Layout.tsx toast handler** (`src/components/Layout.tsx:43-86`)
  - Add `id` and `persistent` to toast state
  - Listen for `quorum:toast-dismiss` event
  - Skip auto-dismiss timer when `persistent: true`

### Step 2: Revert Previous Changes
- [ ] **Remove earlier toast implementation** (`src/services/MessageService.ts`)
  - Revert line 43: `import { showWarning, showSuccess }` → `import { showWarning }`
  - Remove lines 2857-2860 (the `showSuccess` call)

### Step 3: Show Toast at Sync Start
- [ ] **Add toast in initiateSync()** (`src/services/SyncService.ts:174-230`)
  ```typescript
  import { showPersistentToast } from '../utils/toast';
  import { t } from '@lingui/core/macro';

  // After `if (candidates.length == 0) return;`:
  const messageDelta = candidates[0].messageCount - messageSet.length;
  if (messageDelta >= 20) {
    showPersistentToast('sync', t`Syncing space...`, 'info');
  }
  ```

### Step 4: Dismiss Toast After Sync Inactivity
- [ ] **Add dismiss logic in sync-messages handler** (`src/services/MessageService.ts`)
  - Add module-level timer: `let syncDismissTimer: NodeJS.Timeout | undefined;`
  - In `sync-messages` handler (around line 2856), add:
  ```typescript
  import { dismissToast } from '../utils/toast';

  // After processing sync-messages:
  clearTimeout(syncDismissTimer);
  syncDismissTimer = setTimeout(() => {
    dismissToast('sync');
  }, 5000);
  ```

## Verification

✅ **New space join (50+ messages)**
   - Toast "Syncing space..." appears at sync start
   - Toast persists while messages load
   - Toast dismisses ~5s after last chunk

✅ **Long sync (3+ minutes)**
   - Toast stays visible entire time
   - Dismisses 5s after completion

✅ **Small sync (< 20 messages)**
   - No toast appears

✅ **Manual dismiss**
   - Click X → toast closes immediately

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

## Definition of Done
- [ ] Toast system extended with persistent + dismiss
- [ ] MessageService.ts previous changes reverted
- [ ] SyncService.ts shows persistent toast
- [ ] MessageService.ts dismisses after 5s inactivity
- [ ] Toast shows only for syncs >= 20 messages
- [ ] TypeScript passes
- [ ] Manual testing successful
