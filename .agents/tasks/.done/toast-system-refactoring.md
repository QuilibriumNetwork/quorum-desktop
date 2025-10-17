# Toast System Refactoring

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Status**: reviewed 2025-10-07 - HEAVILY OVER-ENGINEREED FOR OUR CURRENT NEEDS!

## Overview

Refactor the current toast notification system from a event-based implementation to a proper React Context-based architecture. The current system has lack of type safety, single-toast limitation, and platform coupling that prevents future mobile implementation.

## ⚠️ Critical Fixes Required

The following issues MUST be addressed before implementation:

1. **Timer Memory Leaks** - Add `useRef` for timeout cleanup
2. **Double Timer Bug** - Coordinate auto-dismiss between ToastProvider and Callout
3. **MessageService Migration** - Non-React code can't use hooks (see Phase 5, Step 3a)
4. **Error Boundary Missing** - Toast errors could crash app (see Phase 2a)
5. **Keyboard Support** - Implement Escape key dismissal (see Phase 3a)

## Current Problems

**Architecture Issues:**
- Event-based system (`window.dispatchEvent`) repeated in 6+ files
- All logic embedded in `Layout.tsx` (lines 39-53, 113-130)
- Heavy use of `any` types, no type safety
- Single toast limitation (new toasts replace existing ones)
- No accessibility (ARIA, keyboard support)
- Platform-coupled (window checks everywhere)

**Key Files:**
- `/src/components/Layout.tsx` - Toast display logic
- `/src/hooks/business/spaces/useSpaceProfile.ts` - Dispatches events
- `/src/services/MessageService.ts` - Dispatches events (⚠️ non-React class)

## Solution

**Replace with:** React Context + TypeScript + proper primitives

**Goals:**
1. Type-safe Context API (zero `any` types)
2. Multiple toasts support (start with 1, infrastructure supports more)
3. Keyboard accessibility (Escape key)
4. Platform-agnostic (works for future mobile)
5. Fix memory leaks (timer cleanup)

## Implementation Plan

### Phase 1: Foundation - Type System & Interfaces

**Create Type Definitions:**

File: `/src/types/toast.ts`

```typescript
export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number; // 0 = no auto-close, undefined = default (5s)
  dismissible?: boolean;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ToastConfig {
  position?: ToastPosition;
  maxVisible?: number;
  defaultDuration?: number; // seconds
}

export interface ToastContextValue {
  toasts: Toast[];
  config: ToastConfig;
  showToast: (toast: Omit<Toast, 'id'>) => string; // Returns toast ID
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}
```

### Phase 2: Core Implementation - Context & Provider

**2a. Error Boundary** (`/src/components/primitives/Toast/ToastErrorBoundary.tsx`)

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

export class ToastErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Toast system error:', error, errorInfo);
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}
```

**2b. Context** (`/src/components/context/ToastContext.tsx`)

```typescript
import React, { createContext, useContext } from 'react';
import type { ToastContextValue } from '@/types/toast';

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToastContext must be used within ToastProvider');
  return context;
};

export { ToastContext };
```

**2c. Provider** (`/src/components/context/ToastProvider.tsx`)

File: `/src/components/context/ToastProvider.tsx`

```typescript
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ToastContext } from './ToastContext';
import { ToastContainer } from '@/components/primitives/Toast/ToastContainer';
import { ToastErrorBoundary } from '@/components/primitives/Toast/ToastErrorBoundary';
import type { Toast, ToastConfig } from '@/types/toast';

const DEFAULT_CONFIG: ToastConfig = {
  position: 'bottom-right',
  maxVisible: 1, // ✅ START: Single toast (matches current behavior, increase if needed)
  defaultDuration: 5,
};

interface ToastProviderProps {
  children: React.ReactNode;
  config?: Partial<ToastConfig>;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  config: userConfig
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig]);

  // ✅ FIX: Store timeout refs for cleanup (prevents memory leaks)
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const showToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? config.defaultDuration,
      dismissible: toast.dismissible ?? true,
    };

    setToasts(prev => {
      const updated = [...prev, newToast];
      // Enforce max visible limit (start with 1, increase if needed)
      if (config.maxVisible && updated.length > config.maxVisible) {
        return updated.slice(-config.maxVisible);
      }
      return updated;
    });

    // ✅ FIX: Auto-dismiss with proper cleanup
    if (newToast.duration && newToast.duration > 0) {
      const timeoutId = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        timeoutRefs.current.delete(id);
      }, newToast.duration * 1000);

      timeoutRefs.current.set(id, timeoutId);
    }

    return id;
  }, [config.defaultDuration, config.maxVisible]);

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, 'id'>>) => {
    setToasts(prev =>
      prev.map(toast =>
        toast.id === id ? { ...toast, ...updates } : toast
      )
    );
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    // ✅ FIX: Clear timeout when manually dismissed
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
    // ✅ FIX: Clear all timeouts
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current.clear();
  }, []);

  // ✅ FIX: Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current.clear();
    };
  }, []);

  const value = useMemo(() => ({
    toasts,
    config,
    showToast,
    updateToast,
    dismissToast,
    dismissAll,
  }), [toasts, config, showToast, updateToast, dismissToast, dismissAll]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastErrorBoundary>
        <ToastContainer />
      </ToastErrorBoundary>
    </ToastContext.Provider>
  );
};
```

### Phase 3: Toast Container Component

**Phase 3a: Create Web Toast Container:**

File: `/src/components/primitives/Toast/ToastContainer.web.tsx`

```typescript
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToastContext } from '@/components/context/ToastContext';
import { Callout } from '@/components/primitives/Callout';
import { FlexColumn } from '@/components/primitives'; // ✅ FIX: Use primitive instead of raw div
import type { Toast } from '@/types/toast';

const POSITION_CLASSES = {
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
};

const TOAST_Z_INDEX = 2147483647; // Max safe z-index

export const ToastContainer: React.FC = () => {
  const { toasts, config, dismissToast } = useToastContext();

  // ✅ FIX: Keyboard support - Escape to dismiss
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toasts.length > 0) {
        // Dismiss the most recent toast
        dismissToast(toasts[toasts.length - 1].id);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;

  const positionClass = POSITION_CLASSES[config.position || 'bottom-right'];

  return createPortal(
    <FlexColumn
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed ${positionClass} max-w-[360px] gap-2 pointer-events-none`}
      style={{ zIndex: TOAST_Z_INDEX }}
    >
      {toasts.map((toast) => (
        <FlexColumn key={toast.id} className="pointer-events-auto">
          <Callout
            variant={toast.variant}
            size="sm"
            dismissible={toast.dismissible}
            autoClose={0} // ✅ FIX: Disable Callout's auto-close (ToastProvider handles it)
            onClose={() => dismissToast(toast.id)}
            aria-label={`${toast.variant} notification`}
          >
            {toast.message}
          </Callout>
        </FlexColumn>
      ))}
    </FlexColumn>,
    document.body
  );
};
```

**3b. Platform Index** (`/src/components/primitives/Toast/ToastContainer.tsx`)

```typescript
// Metro bundler automatically picks .native.tsx for mobile
export { ToastContainer } from './ToastContainer.web';
```

**3c. Mobile Stub** (`/src/components/primitives/Toast/ToastContainer.native.tsx`)

```typescript
import React from 'react';

export const ToastContainer: React.FC = () => {
  if (__DEV__) console.warn('Toast system not yet implemented for mobile');
  return null;
};
```

### Phase 4: Developer-Friendly Hook

**useToast Hook** (`/src/hooks/ui/useToast.ts`)

```typescript
import { useToastContext } from '@/components/context/ToastContext';
import type { Toast } from '@/types/toast';

export const useToast = () => {
  const context = useToastContext();

  const showSuccess = (message: string, options?: Partial<Omit<Toast, 'id' | 'message' | 'variant'>>) =>
    context.showToast({ message, variant: 'success', ...options });

  const showError = (message: string, options?: Partial<Omit<Toast, 'id' | 'message' | 'variant'>>) =>
    context.showToast({ message, variant: 'error', ...options });

  const showWarning = (message: string, options?: Partial<Omit<Toast, 'id' | 'message' | 'variant'>>) =>
    context.showToast({ message, variant: 'warning', ...options });

  const showInfo = (message: string, options?: Partial<Omit<Toast, 'id' | 'message' | 'variant'>>) =>
    context.showToast({ message, variant: 'info', ...options });

  return { ...context, showSuccess, showError, showWarning, showInfo };
};
```

### Phase 5: Integration & Migration

STOP HERE AND TEST BEFORE BEGINNING THE MIGRATION

**⚠️ PRE-PRODUCTION ADVANTAGE: Simplified Direct Migration**

Since the app is **not live yet** and the toast system is only used in **4 files**, we can use a direct migration strategy instead of a complex phased rollout.

**Current Toast Usage (Complete Audit):**
1. `/src/components/Layout.tsx` - Event listeners + display (lines 38-52, 112-129)
2. `/src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` - 3 toast dispatches (lines 54-75, 66-76, 269-278)
3. `/src/services/MessageService.ts` - 1 kick toast dispatch (line 1654)
4. `/src/hooks/business/spaces/useSpaceProfile.ts` - 1 error toast dispatch (line 216)

**Timeline: 4 Days (~11 hours total)**

---

#### Step 1: Foundation & Testing (Day 1, ~4 hours)

**1a. Implement Core System** (2 hours)
- Complete Phases 1-4 (types, context, provider, container, hook)
- Add ToastProvider to app root in `/src/components/Layout.tsx` or `/web/main.tsx`:

```typescript
import { ToastProvider } from '@/components/context/ToastProvider';

// Wrap children with ToastProvider
<ToastProvider config={{ position: 'bottom-right', maxVisible: 1 }}>
  {/* existing app */}
</ToastProvider>
```

**1b. Write Unit Tests** (2 hours)
```typescript
// Test timer cleanup (memory leak prevention)
// Test error boundary catches toast errors
// Test keyboard support (Escape key dismissal)
// Test toast queue behavior (maxVisible: 1)
// Test hook throws error outside provider
```

**Checkpoint:** ✅ All tests pass, new system ready

---

#### Step 2: Migrate React Files (Day 2, ~3 hours)

**Migration Pattern (Same for All React Files):**

```typescript
// BEFORE (Old Event System)
if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
  (window as any).dispatchEvent(
    new CustomEvent('quorum:toast', {
      detail: { message: 'Error message', variant: 'error' }
    })
  );
}

// AFTER (New Hook System)
import { useToast } from '@/hooks/ui/useToast';

const { showError } = useToast();
showError('Error message');
```

**2a. Migrate `useSpaceProfile.ts` (30 min)**
- Location: Line 216
- Replace event dispatch with `showError()` hook
- Test profile update error scenario

**2b. Migrate `SpaceSettingsModal.tsx` (1 hour)**
- Location: Lines 54-75, 66-76, 269-278 (3 toast dispatches)
- Replace all 3 event dispatches with appropriate hooks:
  - Success: `showSuccess()`
  - Info: `showInfo()`
  - Error: `showError()`
- Test all three scenarios (kick sync, no updates, mention settings error)

**2c. Remove Old System from `Layout.tsx` (30 min)**
- **Delete lines 38-52**: Old event listeners
  ```typescript
  // DELETE THIS:
  const [kickToast, setKickToast] = React.useState<{...} | null>(null);
  React.useEffect(() => {
    const kickHandler = (e: any) => {...};
    const genericHandler = (e: any) => {...};
    (window as any).addEventListener('quorum:kick-toast', kickHandler);
    (window as any).addEventListener('quorum:toast', genericHandler);
    return () => {...};
  }, []);
  ```

- **Delete lines 112-129**: Old toast rendering
  ```typescript
  // DELETE THIS:
  {kickToast && (
    <Portal>
      <div className="fixed bottom-4 right-4 max-w-[360px]" style={{ zIndex: 2147483647 }}>
        <Callout variant={kickToast.variant || 'info'} size="sm" dismissible autoClose={5} onClose={() => setKickToast(null)}>
          {kickToast.message}
        </Callout>
      </div>
    </Portal>
  )}
  ```

**2d. Local Testing** (1 hour)
- [ ] Profile update error toast appears
- [ ] Space settings toasts work (all 3 types)
- [ ] Toasts auto-dismiss after 5 seconds
- [ ] Manual dismiss works (click X)
- [ ] Keyboard dismiss works (Escape key)

**Checkpoint:** ✅ All React files migrated, old Layout code removed

---

#### Step 3: Handle MessageService.ts (Day 3, ~2 hours)

**⚠️ CRITICAL DECISION: MessageService is Non-React Class (Cannot Use Hooks)**

**RECOMMENDED: Option A - Event Bridge (Minimal Risk)**

**Why Option A:**
- ✅ Zero changes to MessageService.ts (preserves stability)
- ✅ Kick event is rare (edge case, low impact)
- ✅ MessageService handles critical encryption/messaging
- ✅ Only 15 lines of bridge code vs. major refactor
- ✅ Can refactor later if needed

**Implementation (30 min):**

Add this to `/src/components/context/ToastProvider.tsx`:

```typescript
// In ToastProvider component, add after existing useEffect:

// Bridge for MessageService.ts (non-React class) kick notifications
useEffect(() => {
  const handleKickToast = (e: Event) => {
    const customEvent = e as CustomEvent;
    showToast({
      message: customEvent.detail?.message || t`You've been kicked from a space`,
      variant: 'warning',
    });
  };

  window.addEventListener('quorum:kick-toast', handleKickToast);

  return () => {
    window.removeEventListener('quorum:kick-toast', handleKickToast);
  };
}, [showToast]);
```

**No changes needed to MessageService.ts** - it continues dispatching `quorum:kick-toast` events as before.

**Testing (1.5 hours):**
- [ ] Kick toast appears when kicked from space (requires 2-account test)
- [ ] Message still visible with correct styling
- [ ] No breaking changes to message handling

---

**ALTERNATIVE: Option B - Dependency Injection (NOT Recommended)**

Only consider if you want "pure" new system without events. Requires:
1. Refactor `MessageServiceDependencies` interface
2. Pass `showToast` function through constructor
3. Update all MessageService instantiation sites
4. Replace event dispatch in MessageService (line 1654)

**Risk:** High - MessageService is critical infrastructure. Not worth refactoring for 1 toast.

---

#### Step 4: Final Testing & Documentation (Day 4, ~2 hours)

**4a. Integration Testing** (1 hour)
- [ ] All toast types work (success, error, warning, info)
- [ ] Auto-dismiss after 5 seconds
- [ ] Manual dismiss (click X)
- [ ] Keyboard dismiss (Escape key)
- [ ] Kick toast works (MessageService event bridge)
- [ ] No console errors
- [ ] No memory leaks (Chrome DevTools → Performance Monitor → check JS Heap)

**4b. TypeScript Validation** (15 min)
```bash
cmd.exe /c "cd /d D:\\GitHub\\Quilibrium\\quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck"
```

**4c. Build Test** (15 min)
```bash
cmd.exe /c "cd /d D:\\GitHub\\Quilibrium\\quorum-desktop && yarn build"
```

**4d. Verify Migration Complete** (5 min)
```bash
# Should only show MessageService.ts and ToastProvider.tsx (event bridge)
grep -r "quorum:kick-toast" src/ --include="*.ts" --include="*.tsx"

# Should return NO results (all generic toasts migrated)
grep -r "quorum:toast" src/ --include="*.ts" --include="*.tsx" | grep -v "quorum:kick-toast"
```

**4e. Update Documentation** (30 min)
- Add comment in ToastProvider.tsx explaining event bridge
- Update this file: Mark Phase 5 complete
- Note MessageService strategy decision (Option A chosen)

**Checkpoint:** ✅ Ready for commit

---

### Migration Checklist

**Day 1: Foundation**
- [ ] Phases 1-4 complete (types, context, provider, hook)
- [ ] ToastProvider added to app
- [ ] Unit tests written and passing

**Day 2: React Migration**
- [ ] useSpaceProfile.ts migrated (line 216)
- [ ] SpaceSettingsModal.tsx migrated (3 locations)
- [ ] Layout.tsx old code removed (lines 38-52, 112-129)
- [ ] Manual testing complete

**Day 3: MessageService**
- [ ] Event bridge added to ToastProvider
- [ ] Kick toast tested with 2 accounts
- [ ] No MessageService changes needed

**Day 4: Finalization**
- [ ] All integration tests pass
- [ ] TypeScript validation clean
- [ ] Build succeeds
- [ ] grep verification (only kick-toast in 2 files)
- [ ] Documentation updated
- [ ] Single commit created

### Success Verification

```bash
# Should show only MessageService.ts (dispatch) and ToastProvider.tsx (bridge)
grep -r "quorum:kick-toast" src/ --include="*.ts" --include="*.tsx"

# Should return ZERO results (all generic toasts migrated)
grep -r "quorum:toast" src/ --include="*.ts" --include="*.tsx" | grep -v "quorum:kick-toast"

# Should return ZERO results (old event listeners removed)
grep -r "addEventListener.*quorum:toast" src/ --include="*.ts" --include="*.tsx" | grep -v ToastProvider
```

**Final Verification:**
- ✅ No TypeScript errors
- ✅ Build succeeds
- ✅ All toasts display correctly
- ✅ No console errors
- ✅ No memory leaks
- ✅ Keyboard support works (Escape)

### Rollback Plan

If issues arise, simple git revert:

```bash
# Rollback entire migration
git revert HEAD

# Or rollback specific file
git checkout HEAD~1 -- src/path/to/file.tsx
```

**Why Simple Rollback Works:**
- Single commit migration
- Pre-production (no user impact)
- All testing done before commit

---

### Why This Approach vs. Original

**Original Plan:** 4 weeks, hybrid system, phased rollout, 26-36 hours
**Simplified Plan:** 4 days, direct migration, single commit, ~11 hours

**Key Differences:**
- ✅ No hybrid system complexity (except minimal event bridge)
- ✅ No production monitoring between phases
- ✅ No gradual rollout (all-at-once after testing)
- ✅ Single PR instead of multiple deployments
- ✅ 60-70% time savings

**Why Safe:**
- Pre-production (no users to disrupt)
- Only 4 files to migrate (known scope)
- Full testing before commit
- Simple git revert if issues found
- MessageService left stable (event bridge)

### Phase 6: Documentation

Update files in `/src/components/primitives/` with the new Toast primitive where applicable.


## Pre-Launch Checklist

### Before Merging
- [ ] All timeouts stored in `useRef` and cleaned up
- [ ] Error boundary wraps `ToastContainer`
- [ ] Escape key handler added
- [ ] Primitives used (FlexColumn, not raw divs)
- [ ] Mobile stub exists (`ToastContainer.native.tsx`)
- [ ] Callout receives `autoClose={0}`
- [ ] TypeScript has zero `any` types
- [ ] Lingui used for user-facing strings

### After Full Migration
- [ ] `grep -r "quorum:toast" src/` returns nothing (or only MessageService if hybrid)
- [ ] Old Layout.tsx toast code removed
- [ ] No memory leaks verified (Chrome DevTools)
- [ ] No console errors
- [ ] Production monitoring: 48 hours with no toast errors

## Future Enhancements (Post-Launch)

- Toast history tracking
- Progress toasts (upload/download status)
- Toast groups (dismiss related toasts together)
- Sound notifications
- Full mobile implementation with react-native-reanimated

## Mobile Implementation (Future)

When ready, implement `/src/components/primitives/Toast/ToastContainer.native.tsx`:
- Use `react-native-reanimated` for animations
- Respect safe area insets
- Consider keyboard visibility
- Add haptic feedback for errors
- `useToast()` hook works identically (no API changes)

## Success Criteria (Revised)

This refactoring is considered complete when:

### Core Requirements (Must Have)
1. ✅ All old event-based toast code removed (or documented as hybrid for MessageService)
2. ✅ New Context-based system implemented with error boundary
3. ✅ **No memory leaks** - All timeouts cleaned up properly
4. ✅ Full TypeScript type safety (zero `any` types)
5. ✅ **Keyboard support** - Escape key dismisses toasts
6. ✅ ARIA live regions for screen readers
7. ✅ All existing toast functionality preserved
8. ✅ Developer-friendly API (`useToast` hook with convenience methods)
9. ✅ **Mobile stub created** (prevents build failures)
10. ✅ Zero breaking changes to user-facing behavior

### Quality Requirements (Must Have)
11. ✅ **Test coverage**: Timer cleanup, error boundary, keyboard events
12. ✅ **Performance**: Toast render time < 16ms, no memory leaks verified
13. ✅ **Documentation**: README, migration guide, MessageService decision doc
14. ✅ **Rollback strategy tested**: Can revert to old system if needed

### Stretch Goals (Nice to Have)
15. 🎯 Multiple toasts display simultaneously (start with 1, add if needed)
16. 🎯 Toast positioning configurable (all 6 positions tested)
17. 🎯 `updateToast` method (mark as experimental)
18. 🎯 Toast action buttons support (defer to Phase 8)

### Future Work (Post-Implementation)
19. 📋 Mobile implementation with react-native-reanimated
20. 📋 Toast history tracking
21. 📋 Progress toasts
22. 📋 Sound notifications

## References

- `/src/components/Layout.tsx` - Current implementation (lines 38-52, 112-129)
- `/src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` - Toast dispatches
- `/src/hooks/business/spaces/useSpaceProfile.ts` - Toast dispatch
- `/src/services/MessageService.ts` - Kick toast dispatch (non-React)
- `/src/components/primitives/Callout/` - Underlying UI component
- `.agents/tasks/.done/callout-primitive-system.md` - Callout component docs

## Risks & Mitigation

**High Risk:**
- Timer memory leaks → useRef cleanup
- MessageService can't use hooks → Hybrid approach or dependency injection
- Double timer bug → Set Callout `autoClose={0}`
- Toast errors crash app → Error boundary

**Medium Risk:**
- Big bang migration → Phased 4-week rollout
- Mobile build failures → .native.tsx stub
- Accessibility regression → Escape key + ARIA

---

_Created: 2025-10-07 by Claude Code_
_Updated: 2025-10-17 by Claude Code (Phase 5 simplified for pre-production app)_
