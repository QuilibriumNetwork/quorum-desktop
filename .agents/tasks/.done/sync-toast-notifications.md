# Sync Toast Notifications

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Status**: Pending
**Complexity**: Medium
**Created**: 2025-12-14
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
