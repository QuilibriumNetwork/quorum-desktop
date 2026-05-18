---
type: doc
title: Toast Notifications
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-05-18
---

# Toast Notifications

Simple utility for displaying temporary toast notifications using an event-based system.

## Quick Reference

```typescript
import { showToast, showSuccess, showError, showWarning, showInfo } from '@/utils/toast';

// Basic usage
showToast('Message here', 'info');

// Convenience methods
showSuccess('Operation completed!');
showError('Something went wrong');
showWarning('Please check your input');
showInfo('New update available');
```

## API

### `showToast(message: string, variant?: ToastVariant)`
Main function to display a toast notification.

**Variants:** `'info'` | `'success'` | `'warning'` | `'error'`

### Convenience Functions
- `showSuccess(message)` - Green success toast
- `showError(message)` - Red error toast
- `showWarning(message)` - Yellow warning toast
- `showInfo(message)` - Blue info toast

## How It Works

1. **Event-based**: Dispatches `quorum:toast` custom events
2. **Display**: Layout.tsx listens for events and renders Callout primitive
3. **Position**: Fixed to bottom-right (not configurable)
4. **Auto-close**: 5 second timeout, dismissible

## Persistent toasts

`showPersistentToast(id, message, variant?, bottomFixed?)` shows a toast that stays visible until `dismissToast(id)` is called or the user clicks X.

### Sync toast (built on top)

The sync system uses a small dedicated API in `toast.ts` so the timers can't drift apart from the toast lifecycle:

- `showSyncToast(message)` — shows the toast (id `'sync'`) AND arms a 15s fallback dismiss. Called from `SyncService.requestSync()` (fires on login restore, invite accept, manual "Sync now").
- `noteSyncActivity()` — cancels the fallback, arms a 5s idle dismiss that resets on each call. Called from MessageService.ts whenever a `sync-messages` or `sync-delta` chunk is successfully processed.

The fallback exists because a sync handshake can complete (or stall) without ever producing a `messageDelta` — lone-member spaces, all peers offline, peer responds with metadata-only envelopes, handshake errors. Without it the toast would hang indefinitely. Once any chunk arrives, the fallback is cancelled and the idle timer (5s after last activity) takes over.

Toast id is the literal string `'sync'`, shared across all spaces — concurrent space syncs collapse into one toast and one shared timer pair.

See `.agents/tasks/.done/sync-toast-notifications.md` for the design history and rework notes.

## Implementation Details

**File:** `src/utils/toast.ts`

**Display:** `src/components/Layout.tsx:142-162` renders toast using Callout primitive in a Portal

**Positioning:** Hardcoded to `fixed bottom-4 right-4` - no positioning options currently available

---

_Last updated: 2026-05-18 - added Persistent toasts section after sync-toast rework_
_Previously: 2025-10-17 / verified 2025-12-09_
