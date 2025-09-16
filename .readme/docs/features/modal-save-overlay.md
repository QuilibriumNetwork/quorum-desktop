# Modal Save Overlay System

A centralized system for displaying loading overlays during async operations in modals, preventing user interaction and providing visual feedback during save operations.

## Overview

The Modal Save Overlay system provides consistent UX for long-running operations (3+ seconds) by:
- Blocking user interaction (ESC, backdrop clicks, form inputs)
- Displaying spinner with customizable messages
- Implementing automatic timeout failsafes
- Supporting both timeout-based and completion-based operations

## Core Components

### 1. ModalSaveOverlay Component
**File**: `src/components/modals/ModalSaveOverlay.tsx`

Reusable overlay component with spinner and message display.

```tsx
<ModalSaveOverlay
  visible={isSaving}
  message="Saving..."
  className="optional-custom-class"
/>
```

### 2. useModalSaveState Hook
**File**: `src/hooks/business/ui/useModalSaveState.ts`

Business logic hook managing save states with timeout handling.

```tsx
const { isSaving, saveWithTimeout, saveUntilComplete } = useModalSaveState({
  defaultTimeout: 3000,     // Close after 3 seconds
  maxTimeout: 30000,        // 30s failsafe
  onSaveComplete: dismiss,
  onSaveError: handleError,
});
```

### 3. Centralized CSS
**File**: `src/styles/_modal_common.scss`

```scss
.modal-save-overlay {
  position: absolute; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
}
.modal-save-backdrop {
  position: absolute; inset: 0;
  background-color: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px); border-radius: 0.5rem;
}
.modal-save-content {
  position: relative; display: flex; align-items: center; gap: 0.75rem;
  .modal-save-spinner { color: var(--accent); font-size: 24px; }
  .modal-save-text { font-size: 1.125rem; font-weight: 500; color: white; }
}
```

## Implementation Pattern

### Standard Implementation (Save Operations)

```tsx
// 1. Import dependencies
import ModalSaveOverlay from '../modals/ModalSaveOverlay';
import { useModalSaveState } from '../../hooks';

// 2. Set up hook
const { isSaving, saveWithTimeout } = useModalSaveState({
  defaultTimeout: 3000,
  onSaveComplete: dismiss,
});

// 3. Protect modal close mechanisms
<Modal
  onClose={isSaving ? undefined : dismiss}
  closeOnBackdropClick={!isSaving}
  closeOnEscape={!isSaving}
>
  {/* 4. Add overlay */}
  <ModalSaveOverlay visible={isSaving} message="Saving..." />

  {/* 5. Disable buttons during save */}
  <Button onClick={handleSave} disabled={isSaving}>
    Save Changes
  </Button>
</Modal>

// 6. Implement save handler
const handleSave = useCallback(async () => {
  saveWithTimeout(async () => {
    await actualSaveFunction();
  });
}, [saveWithTimeout]);
```

## Current Implementations

### ChannelEditor
- **Implementation**: `useModalSaveState` hook (`saveWithTimeout`)
- **Timeout**: 3000ms for save operations
- **Protection**: Modal close mechanisms disabled during save
- **Message**: "Saving..."

### GroupEditor
- **Implementation**: `useModalSaveState` hook (`saveWithTimeout`)
- **Timeout**: 3000ms for save operations
- **Protection**: Modal close mechanisms disabled during save
- **Message**: "Saving..."

### UserSettingsModal
- **Implementation**: `useModalSaveState` hook (`saveUntilComplete`)
- **Timeout**: Closes only on completion (30s failsafe)
- **Protection**: Modal close mechanisms disabled during save
- **Message**: "Saving..." (default)

### SpaceEditor
- **Implementation**: `useModalSaveState` hook (`saveUntilComplete`)
- **Timeout**: Closes only on completion (30s failsafe)
- **Protection**: Modal close mechanisms disabled during save
- **Message**: "Saving..." (default)

### KickUserModal
- **Implementation**: `useModalSaveState` hook (`saveUntilComplete`)
- **Timeout**: 3000ms for save operations
- **Protection**: Modal close mechanisms disabled during save
- **Message**: "Kicking..."

**✅ All modals now use the consistent `useModalSaveState` pattern!**

## Operation Types

### saveWithTimeout()
- Shows overlay immediately
- Executes save function
- Closes modal after specified timeout (regardless of completion)
- **Use case**: Operations with predictable duration

### saveUntilComplete()
- Shows overlay until operation completes
- Includes 30-second failsafe timeout
- Closes modal only after successful completion
- **Use case**: Operations with unpredictable duration

## Important Limitations

### ⚠️ Delete/Confirm Operations Disabled

**The Modal Save Overlay system is intentionally NOT used for delete operations via `ConfirmationModal.tsx`.**

**Reason**: During implementation, we discovered conflicts when combining:
- ConfirmationModal timeout overlays
- useChannelManagement delete completion callbacks
- Parent modal dismiss logic

**Result**: Delete operations became convoluted with:
- Double dismiss calls
- Complex state management (`shouldStayVisible`, `isProcessing`)
- Inconsistent UX between delete paths

**Current behavior**: Delete operations dismiss modals immediately after completion without overlay.

**Future consideration**: This could be re-implemented with a cleaner architecture for optimal UX, but requires careful design to avoid callback conflicts.

## Files Modified/Created

### New Files
- `src/components/modals/ModalSaveOverlay.tsx` - Overlay component
- `src/hooks/business/ui/useModalSaveState.ts` - State management hook

### Modified Files
- `src/components/space/ChannelEditor.tsx` - Migrated to `useModalSaveState` hook (saves only)
- `src/components/space/GroupEditor.tsx` - Migrated to `useModalSaveState` hook, updated error handling
- `src/components/space/SpaceEditor.tsx` - Migrated to `useModalSaveState` hook (`saveUntilComplete`)
- `src/components/modals/UserSettingsModal.tsx` - Migrated to `useModalSaveState` hook (`saveUntilComplete`)
- `src/components/modals/ConfirmationModal.tsx` - Simplified (removed timeout overlay logic)
- `src/hooks/business/channels/useChannelManagement.ts` - Cleaned up legacy `showWarning`
- `src/hooks/business/channels/useGroupManagement.ts` - Removed automatic error timeout
- `src/hooks/business/ui/index.ts` - Added export

### CSS
- `src/styles/_modal_common.scss` - Centralized overlay styles


---

*Created: 2025-01-16*
*Last Updated: 2025-01-16 (Complete migration)*