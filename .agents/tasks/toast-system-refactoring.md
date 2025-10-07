# Toast System Refactoring

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Status**: Ready for Implementation (reviewed 2025-10-07)

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

**⚠️ IMPORTANT: Use Phased Rollout, NOT Big Bang**

This is a **high-risk migration**. Follow the phased approach to allow rollback if issues arise.

**Step 1: Add ToastProvider Alongside Old System (Week 1)**

File: `/src/components/Layout.tsx` or `/web/main.tsx`

```typescript
import { ToastProvider } from '@/components/context/ToastProvider';

// ✅ Add new system WITHOUT removing old one yet
<ToastProvider config={{ position: 'bottom-right', maxVisible: 1 }}>
  {/* existing app with old toast system still working */}
</ToastProvider>
```

**Step 2: Migrate React Components One-by-One (Week 2)**

**Priority Order (safest first):**

1. `/src/hooks/business/spaces/useSpaceProfile.ts` (simple hook)
2. `/src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` (isolated modal)
3. Other React components (identify via grep: `quorum:toast`)

**For each file:**
- [ ] Create feature flag check (optional but recommended)
- [ ] Migrate to `useToast()`
- [ ] Test thoroughly
- [ ] Deploy to production
- [ ] Monitor for issues before next migration

**Step 3: Handle Non-React Code (Week 3)**

**⚠️ CRITICAL: MessageService Migration Strategy**

**Problem:** `/src/services/MessageService.ts` is a **class**, not a React component. It **cannot use hooks**.

**Solution Options:**

**Option A: Hybrid System (RECOMMENDED - Less Risky)**

Keep event dispatch for non-React code, accept hybrid system:

```typescript
// In MessageService.ts (lines 1637-1642)
// Keep existing event dispatch - it works fine for non-React code
if (typeof window !== 'undefined') {
  window.dispatchEvent(
    new CustomEvent('quorum:kick-toast', {
      detail: { message: t`You've been kicked from ${spaceName}`, variant: 'warning' }
    })
  );
}

// In ToastProvider.tsx - Add event listener bridge
useEffect(() => {
  const handleLegacyEvent = (e: CustomEvent) => {
    showToast({
      message: e.detail.message,
      variant: e.detail.variant || 'info',
    });
  };

  window.addEventListener('quorum:toast', handleLegacyEvent as EventListener);
  window.addEventListener('quorum:kick-toast', handleLegacyEvent as EventListener);

  return () => {
    window.removeEventListener('quorum:toast', handleLegacyEvent as EventListener);
    window.removeEventListener('quorum:kick-toast', handleLegacyEvent as EventListener);
  };
}, [showToast]);
```

**Option B: Refactor MessageService (Higher Risk)**

Pass toast context through dependency injection:

```typescript
// In MessageServiceDependencies interface
export interface MessageServiceDependencies {
  // ... existing
  showToast: (toast: Omit<Toast, 'id'>) => string; // ✅ NEW
}

// In Layout.tsx where MessageService is instantiated
const { showToast } = useToast();
const messageService = new MessageService({
  // ... existing deps
  showToast, // ✅ Pass toast function
});
```

**Choose ONE approach before proceeding.**

**Step 3a: Document Decision**

Create: `/docs/architecture/toast-system-hybrid.md` explaining chosen approach and rationale.

**Step 4: Remove Old System (Week 4 - Only After All Migrations Succeed)**

**Remove from Layout.tsx:**
- Lines 39-53: Old event listeners (`useEffect` for `quorum:toast` and `quorum:kick-toast`)
- Lines 113-130: Old toast rendering with `createPortal`
- State: `const [kickToast, setKickToast] = useState<{...} | null>(null);`

**Verify all migrations complete:**
```bash
# Should return NO results
grep -r "quorum:toast" src/ --include="*.ts" --include="*.tsx"
grep -r "quorum:kick-toast" src/ --include="*.ts" --include="*.tsx"
```

**Step 5: Rollback Plan**

If issues arise:

1. **Phase 1 rollback**: Remove `<ToastProvider>` wrapper, old system still works
2. **Phase 2 rollback**: Keep new system, but revert individual file migrations
3. **Phase 3 rollback**: If MessageService breaks, revert to event dispatch (Option A)

**Keep this checklist:**
- [ ] Old system still works when new provider added
- [ ] Each migrated file tested independently
- [ ] Production monitoring shows no toast-related errors
- [ ] User reports no missing/duplicate toasts

### Phase 6: Testing

**Critical Test Cases:**
- [ ] **Memory leaks**: Verify timeouts cleaned up (Chrome DevTools)
- [ ] **No double timers**: Only ToastProvider handles auto-dismiss
- [ ] **Error boundary**: Toast errors don't crash app
- [ ] **Keyboard**: Escape key dismisses toast
- [ ] **Accessibility**: ARIA live regions work with screen readers
- [ ] Auto-dismiss after duration works
- [ ] Manual dismiss clears timeout
- [ ] Type safety enforced (invalid variants caught by TS)
- [ ] Hook throws error outside provider

### Phase 7: Documentation

Create `/src/components/primitives/Toast/README.md` with:

**Basic Usage:**
```typescript
const { showSuccess, showError } = useToast();
showSuccess('Data saved!');
```

**API:**
- `showSuccess/Error/Warning/Info(message, options?)` - Convenience methods
- `showToast(toast)` - Returns toast ID
- `dismissToast(id)` / `dismissAll()`
- `updateToast(id, updates)` - Optional, experimental

**Migration:**
Replace `window.dispatchEvent(new CustomEvent('quorum:toast', ...))` with `useToast()`

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

- `/src/components/Layout.tsx` - Current implementation (lines 39-53, 113-130)
- `/src/components/primitives/Callout/` - Underlying UI component
- `.agents/tasks/.done/callout-primitive-system.md` - Callout component docs

## Implementation Timeline

### Week 1: Foundation (8-12 hours)
- [ ] Implement timer cleanup fixes (2 hours)
- [ ] Create error boundary (1 hour)
- [ ] Create mobile stub (30 min)
- [ ] Implement keyboard support (1 hour)
- [ ] Add ToastProvider alongside old system (2 hours)
- [ ] Write unit tests for ToastProvider (3-4 hours)

### Week 2: Safe Migration (8-10 hours)
- [ ] Migrate `useSpaceProfile.ts` (1 hour)
- [ ] Test in production (monitoring)
- [ ] Migrate `SpaceSettingsModal.tsx` (1 hour)
- [ ] Test in production (monitoring)
- [ ] Identify and migrate remaining React components (4-6 hours)
- [ ] Document any issues encountered (1 hour)

### Week 3: Non-React Code (6-8 hours)
- [ ] Decide MessageService approach (hybrid vs refactor) (2 hours)
- [ ] Implement chosen approach (3-4 hours)
- [ ] Document decision and rationale (1 hour)
- [ ] Integration testing (1-2 hours)

### Week 4: Cleanup & Launch (4-6 hours)
- [ ] Remove old toast system (1 hour)
- [ ] Verify all grep searches return nothing (30 min)
- [ ] Final accessibility audit (1 hour)
- [ ] Performance testing (memory leaks, render time) (1-2 hours)
- [ ] Production monitoring (48 hours observation)
- [ ] Update documentation (1 hour)

**Total Estimated Effort:** 26-36 hours (3-4.5 weeks at 8-10 hours/week)

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
_Updated: 2025-10-07 by Claude Code (post-analysis improvements)_
