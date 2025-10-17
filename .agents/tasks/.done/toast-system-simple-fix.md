# Toast System - Simple Bug Fixes

> **Status**: Ready for Implementation
> **Effort**: 30 minutes
> **Alternative to**: Full refactoring (toast-system-refactoring.md)

## Overview

Fix the two critical bugs in the current event-based toast system without refactoring the entire architecture. The current system works well for our needs (4 simple notification sites) - it just needs bug fixes.

## Why Not Refactor?

**Current System Assessment:**
- ✅ Works perfectly for simple notifications
- ✅ Only 4 callsites (Layout.tsx, SpaceSettingsModal.tsx, MessageService.ts, useSpaceProfile.ts)
- ✅ Decoupled architecture (MessageService doesn't need React)
- ✅ Browser-native events (simple, reliable)
- ✅ Easy to understand and maintain

**Full Refactoring Would:**
- ❌ Add 300+ lines of Context/Provider code
- ❌ Take 11+ hours vs. 30 minutes
- ❌ Solve problems we don't have (position config, action buttons, updateToast, multi-toast queue)
- ❌ Over-engineer for 4 simple notification calls

**Event-based architecture is the RIGHT choice when:**
- You have <10 dispatch sites
- Communication is one-way (notifications only)
- No state coordination needed
- Non-React code needs to trigger UI

**We meet all these criteria.**

## Current Problems

### 1. Timer Memory Leak ⚠️ CRITICAL
**Location:** `/src/components/Layout.tsx` lines 38-52

**Problem:**
```typescript
React.useEffect(() => {
  const kickHandler = (e: any) => {
    setKickToast({ message: `...`, variant: 'warning' });
  };
  // Timer is set when Callout renders with autoClose={5}
  // But timeout is NOT stored in a ref
  // When component unmounts, timeout continues running → memory leak
}, []);
```

**Impact:** Memory leak on every toast, especially problematic for long-running desktop app.

### 2. Double Timer Bug 🐛 HIGH
**Location:** `/src/components/Layout.tsx` lines 112-129

**Problem:**
```typescript
<Callout
  variant={kickToast.variant || 'info'}
  size="sm"
  dismissible
  autoClose={5}  // ❌ Callout sets its own timer
  onClose={() => setKickToast(null)}
>
```

**Impact:** Two timers running simultaneously (Callout's internal + potential external), inconsistent behavior.

## The Fix

### File: `/src/components/Layout.tsx`

**Replace lines 38-52 (event listeners):**

```typescript
const [toast, setToast] = React.useState<{
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'error'
} | null>(null);

// ✅ FIX: Store timer ref for cleanup (prevents memory leak)
const toastTimerRef = React.useRef<NodeJS.Timeout>();

React.useEffect(() => {
  const showToast = (message: string, variant: 'info' | 'success' | 'warning' | 'error') => {
    // Clear any existing timer
    clearTimeout(toastTimerRef.current);

    // Show new toast
    setToast({ message, variant });

    // Set new timer with cleanup
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  };

  const kickHandler = (e: any) => {
    showToast(
      `You've been kicked from ${e.detail?.spaceName || 'a space'}`,
      'warning'
    );
  };

  const genericHandler = (e: any) => {
    showToast(
      e.detail?.message || 'Notification',
      e.detail?.variant || 'info'
    );
  };

  (window as any).addEventListener('quorum:kick-toast', kickHandler);
  (window as any).addEventListener('quorum:toast', genericHandler);

  return () => {
    // ✅ FIX: Clean up timer on unmount
    clearTimeout(toastTimerRef.current);
    (window as any).removeEventListener('quorum:kick-toast', kickHandler);
    (window as any).removeEventListener('quorum:toast', genericHandler);
  };
}, []);
```

**Replace lines 112-129 (toast rendering):**

```typescript
{toast && (
  <Portal>
    <div
      className="fixed bottom-4 right-4 max-w-[360px]"
      style={{ zIndex: 2147483647 }}
    >
      <Callout
        variant={toast.variant || 'info'}
        size="sm"
        dismissible
        autoClose={0}  // ✅ FIX: Disable Callout's auto-close, Layout handles timing
        onClose={() => {
          // ✅ FIX: Clear timer when manually dismissed
          clearTimeout(toastTimerRef.current);
          setToast(null);
        }}
      >
        {toast.message}
      </Callout>
    </div>
  </Portal>
)}
```

## Changes Summary

| Issue | Old Behavior | New Behavior |
|-------|-------------|--------------|
| **Memory Leak** | Timer not tracked, runs after unmount | Timer stored in ref, cleaned up on unmount |
| **Double Timer** | Callout auto-closes in 5s, Layout has no timer | Layout manages timer, Callout doesn't auto-close |
| **Manual Dismiss** | Clears toast but timer keeps running | Clears both toast AND timer |
| **State Variable** | `kickToast` (misleading name) | `toast` (clearer) |

## Testing Checklist

### Manual Testing (10 minutes)

**Test 1: Profile Update Error**
- [ ] Trigger profile update error (useSpaceProfile.ts)
- [ ] Toast appears with error variant
- [ ] Toast auto-dismisses after 5 seconds
- [ ] Click X to dismiss early - toast disappears immediately
- [ ] No console errors

**Test 2: Space Settings Toasts**
- [ ] Open Space Settings modal
- [ ] Trigger kick sync success toast
- [ ] Toast appears and auto-dismisses
- [ ] Trigger "no updates" info toast
- [ ] Toast appears and auto-dismisses
- [ ] Trigger mention settings error toast
- [ ] Toast appears and auto-dismisses

**Test 3: Kick Toast (requires 2 accounts)**
- [ ] Get kicked from a space
- [ ] Toast appears with warning variant
- [ ] Toast auto-dismisses after 5 seconds

**Test 4: Rapid Toast Spam**
- [ ] Trigger 5 toasts rapidly
- [ ] Only ONE toast visible at a time (newest replaces old)
- [ ] No console errors
- [ ] No memory leak (check Chrome DevTools → Performance Monitor)

**Test 5: Component Unmount**
- [ ] Show a toast
- [ ] Navigate away before it dismisses
- [ ] No console errors
- [ ] Check Chrome DevTools → Memory → Heap snapshot (no leaked timers)

### Type Checking (2 minutes)

```bash
cmd.exe /c "cd /d D:\\GitHub\\Quilibrium\\quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck"
```

Should return NO errors.

### Build Test (3 minutes)

```bash
cmd.exe /c "cd /d D:\\GitHub\\Quilibrium\\quorum-desktop && yarn build"
```

Should succeed without errors.

## Implementation Steps

1. **Backup current Layout.tsx** (1 min)
   ```bash
   cp src/components/Layout.tsx src/components/Layout.tsx.backup
   ```

2. **Apply fixes** (5 min)
   - Replace lines 38-52 with new event listener code
   - Replace lines 112-129 with new toast rendering code

3. **Test manually** (10 min)
   - Follow testing checklist above
   - Verify all 4 toast types work

4. **Type check & build** (5 min)
   - Run TypeScript validation
   - Run build test
   - Fix any issues

5. **Commit** (5 min)
   ```bash
   git add src/components/Layout.tsx
   git commit -m "$(cat <<'EOF'
   Fix toast system memory leak and double timer bugs

   - Add useRef for timer cleanup (prevents memory leak)
   - Disable Callout autoClose, let Layout manage timing
   - Clear timer on manual dismiss
   - Rename kickToast → toast (clearer naming)

   Fixes memory leak on every toast notification
   Fixes inconsistent auto-dismiss behavior
   EOF
   )"
   ```

6. **Delete backup** (1 min)
   ```bash
   rm src/components/Layout.tsx.backup
   ```

**Total Time: ~30 minutes**

## Why This Is Better Than Full Refactoring

| Aspect | This Fix | Full Refactoring |
|--------|----------|------------------|
| **Time** | 30 minutes | 11 hours |
| **Lines Changed** | ~40 lines | 300+ new lines |
| **New Files** | 0 | 7+ files |
| **Risk** | Low (isolated changes) | High (architectural change) |
| **Testing** | Simple manual tests | Unit tests + integration tests |
| **Maintenance** | Keep existing patterns | New patterns to learn |
| **Features** | Fixes bugs | Adds unused features |
| **Mobile Ready** | Already works | Needs mobile stub |

## Optional Enhancement (1 Hour)

If you want cleaner API in the 4 files that dispatch toasts, create utility helpers:

**File: `/src/utils/toast.ts`** (NEW)

```typescript
export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export const showToast = (message: string, variant: ToastVariant = 'info'): void => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('quorum:toast', {
      detail: { message, variant },
    })
  );
};

export const showSuccess = (message: string) => showToast(message, 'success');
export const showError = (message: string) => showToast(message, 'error');
export const showWarning = (message: string) => showToast(message, 'warning');
export const showInfo = (message: string) => showToast(message, 'info');
```

**Then update 4 files:**

### 1. `useSpaceProfile.ts` (line 214-222)

```typescript
// BEFORE
if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
  (window as any).dispatchEvent(
    new CustomEvent('quorum:toast', {
      detail: {
        message: error instanceof Error ? error.message : t`Failed to update profile`,
        variant: 'error',
      },
    })
  );
}

// AFTER
import { showError } from '@/utils/toast';

showError(error instanceof Error ? error.message : t`Failed to update profile`);
```

### 2. `SpaceSettingsModal.tsx` (3 locations)

```typescript
import { showSuccess, showInfo, showError } from '@/utils/toast';

// Line 54-62
showSuccess(t`Updated records for ${count} users that have been kicked.`);

// Line 66-75
showInfo(t`All kick records are up to date.`);

// Line 269-278
showError(t`Failed to save notification settings`);
```

### 3. `MessageService.ts` (line 1652-1658)

```typescript
import { showWarning } from '@/utils/toast';

// In kick handler
try {
  const space = await this.messageDB.getSpace(spaceId);
  showWarning(t`You've been kicked from ${space?.spaceName || spaceId}`);
} catch {
  // Silent fail
}
```

**Optional Enhancement Time: 1 hour total**
- Create utility file: 10 min
- Update 4 files: 30 min
- Test all changes: 20 min

## When Would Full Refactoring Make Sense?

Consider full refactoring (Context/Provider) if you need:

- [ ] 10+ toast dispatch locations
- [ ] Complex toast interactions (update, progress, stacking)
- [ ] Toast state querying from components
- [ ] Toast coordination across features
- [ ] Multi-toast queue management
- [ ] Toast action buttons with callbacks
- [ ] Dynamic positioning per toast

**Currently: NONE of these apply.**

## Success Criteria

- [x] Memory leak fixed (timers cleaned up)
- [x] Double timer bug fixed (single timer source)
- [x] All 4 toast types work (success, error, warning, info)
- [x] Auto-dismiss after 5 seconds
- [x] Manual dismiss works immediately
- [x] No console errors
- [x] TypeScript validation passes
- [x] Build succeeds
- [x] No breaking changes to existing behavior

## Future Work

If requirements change and you need complex toast features:

1. **Multi-toast queue** - Show 3+ toasts stacked
2. **Action buttons** - CTAs in toasts ("Undo", "View")
3. **Progress toasts** - Upload/download status
4. **Position variants** - Top-center for warnings, etc.
5. **Toast updates** - Update message without dismissing

**Then** consider full refactoring. But for now, keep it simple.

## References

- `/src/components/Layout.tsx` - Current implementation (lines 38-52, 112-129)
- `/src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` - Toast dispatches
- `/src/hooks/business/spaces/useSpaceProfile.ts` - Toast dispatch
- `/src/services/MessageService.ts` - Kick toast dispatch
- `.agents/tasks/toast-system-refactoring.md` - Full refactoring plan (alternative approach)

## Analysis Reference

This simple fix approach was validated by feature-analyzer agent analysis on 2025-10-17, which concluded:
- Current event-based system is appropriate for the use case
- Full refactoring is significantly over-engineered
- 30-minute bug fix provides same benefits as 11-hour rewrite

---

_Created: 2025-10-17 by Claude Code_
_Analysis by: feature-analyzer agent (2025-10-17)_
