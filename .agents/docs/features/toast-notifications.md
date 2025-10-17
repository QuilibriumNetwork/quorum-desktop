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

## Implementation Details

**File:** `src/utils/toast.ts`

**Display:** `src/components/Layout.tsx:142-162` renders toast using Callout primitive in a Portal

**Positioning:** Hardcoded to `fixed bottom-4 right-4` - no positioning options currently available

---

_Last updated: 2025-10-17_
