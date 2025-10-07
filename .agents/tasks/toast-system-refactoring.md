# Toast System Refactoring

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

Refactor the current toast notification system from a event-based implementation to a proper React Context-based architecture. The current system has lack of type safety, single-toast limitation, and platform coupling that prevents future mobile implementation.

## Current State Analysis

### Architecture Problems

**Current Implementation:**
- Uses global `window.dispatchEvent` and `CustomEvent` API
- Toast logic embedded directly in `Layout.tsx`
- Single state variable handles ALL toasts (only one visible at a time)
- No separation of concerns or proper abstraction layer
- Heavy use of `any` types and unsafe casting

**Files Currently Involved:**
- `/src/components/Layout.tsx` (lines 39-53, 113-130) - Toast display logic
- `/src/hooks/business/spaces/useSpaceProfile.ts` - Dispatches toast events
- `/src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` - Dispatches toast events
- `/src/services/MessageService.ts` - Dispatches toast events
- 3+ other files dispatching `quorum:toast` and `quorum:kick-toast` events

### Critical Issues

1. **Single Toast Limitation**
   ```typescript
   // Current: Only one toast at a time
   const [kickToast, setKickToast] = useState<{...} | null>(null);
   // New toasts immediately replace existing ones
   ```

2. **Platform Coupling**
   ```typescript
   // Repeated 6+ times across codebase
   if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
     (window as any).dispatchEvent(
       new CustomEvent('quorum:toast', { detail: { ... } })
     );
   }
   ```

3. **No Type Safety**
   ```typescript
   const genericHandler = (e: any) => { // ❌ any type
     setKickToast({
       message: e.detail?.message, // ❌ Uncertain structure
       variant: e.detail?.variant || 'info'
     });
   };
   ```

4. **Misleading State Names**
   ```typescript
   // State named 'kickToast' but used for ALL toasts
   const [kickToast, setKickToast] = useState<{...} | null>(null);
   ```

5. **No Accessibility**
   - Missing ARIA live regions
   - No screen reader announcements
   - No keyboard navigation for dismissal

6. **Code Duplication**
   - Toast dispatch logic repeated across 6+ files
   - Two separate event types (`quorum:toast` and `quorum:kick-toast`)
   - Inconsistent error handling

## Goals

### Primary Goals

1. **Create proper abstraction layer** - Replace event-based system with React Context
2. **Enable multiple toasts** - Implement queue/stack system
3. **Add type safety** - Full TypeScript interfaces throughout
4. **Improve accessibility** - ARIA live regions and keyboard support
5. **Platform-agnostic API** - Design allows future mobile implementation without breaking changes

### Secondary Goals

1. Configurable toast positioning
2. Programmatic toast control (update, dismiss by ID)
3. Toast action buttons support
4. Better testing utilities
5. Comprehensive documentation

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

**Create Toast Context:**

File: `/src/components/context/ToastContext.tsx`

```typescript
import React, { createContext, useContext } from 'react';
import type { ToastContextValue } from '@/types/toast';

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider');
  }
  return context;
};

export { ToastContext };
```

**Create Toast Provider:**

File: `/src/components/context/ToastProvider.tsx`

```typescript
import React, { useState, useCallback, useMemo } from 'react';
import { ToastContext } from './ToastContext';
import { ToastContainer } from '@/components/primitives/Toast/ToastContainer';
import type { Toast, ToastConfig } from '@/types/toast';

const DEFAULT_CONFIG: ToastConfig = {
  position: 'bottom-right',
  maxVisible: 3,
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
      // Enforce max visible limit
      if (config.maxVisible && updated.length > config.maxVisible) {
        return updated.slice(-config.maxVisible);
      }
      return updated;
    });

    // Auto-dismiss if duration is set
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, newToast.duration * 1000);
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
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
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
      <ToastContainer />
    </ToastContext.Provider>
  );
};
```

### Phase 3: Toast Container Component

**Create Web Toast Container:**

File: `/src/components/primitives/Toast/ToastContainer.web.tsx`

```typescript
import React from 'react';
import { createPortal } from 'react-dom';
import { useToastContext } from '@/components/context/ToastContext';
import { Callout } from '@/components/primitives/Callout';
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

  if (toasts.length === 0) return null;

  const positionClass = POSITION_CLASSES[config.position || 'bottom-right'];

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed ${positionClass} max-w-[360px] flex flex-col gap-2 pointer-events-none`}
      style={{ zIndex: TOAST_Z_INDEX }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Callout
            variant={toast.variant}
            size="sm"
            dismissible={toast.dismissible}
            autoClose={toast.duration}
            onClose={() => dismissToast(toast.id)}
            aria-label={`${toast.variant} notification`}
          >
            {toast.message}
          </Callout>
        </div>
      ))}
    </div>,
    document.body
  );
};
```

**Create Platform Index:**

File: `/src/components/primitives/Toast/ToastContainer.tsx`

```typescript
// Platform-agnostic export
// Future: Add ToastContainer.native.tsx for mobile
export { ToastContainer } from './ToastContainer.web';
```

### Phase 4: Developer-Friendly Hook

**Create useToast Hook:**

File: `/src/hooks/ui/useToast.ts`

```typescript
import { useToastContext } from '@/components/context/ToastContext';
import type { Toast } from '@/types/toast';

export const useToast = () => {
  const context = useToastContext();

  // Convenience methods
  const showSuccess = (message: string, options?: Partial<Omit<Toast, 'id' | 'message' | 'variant'>>) => {
    return context.showToast({ message, variant: 'success', ...options });
  };

  const showError = (message: string, options?: Partial<Omit<Toast, 'id' | 'message' | 'variant'>>) => {
    return context.showToast({ message, variant: 'error', ...options });
  };

  const showWarning = (message: string, options?: Partial<Omit<Toast, 'id' | 'message' | 'variant'>>) => {
    return context.showToast({ message, variant: 'warning', ...options });
  };

  const showInfo = (message: string, options?: Partial<Omit<Toast, 'id' | 'message' | 'variant'>>) => {
    return context.showToast({ message, variant: 'info', ...options });
  };

  return {
    ...context,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};
```

### Phase 5: Integration & Migration

**Step 1: Add ToastProvider to App Root**

File: `/src/components/Layout.tsx` or `/web/main.tsx`

```typescript
import { ToastProvider } from '@/components/context/ToastProvider';

// Wrap app with ToastProvider
<ToastProvider config={{ position: 'bottom-right', maxVisible: 3 }}>
  {/* existing app */}
</ToastProvider>
```

**Step 2: Remove Old Toast Logic from Layout.tsx**

Remove:
- Lines 39-53: Old event listeners
- Lines 113-130: Old toast rendering with `createPortal`
- State: `const [kickToast, setKickToast] = useState<{...} | null>(null);`

**Step 3: Migrate All Toast Dispatchers**

Replace this pattern (found in 6+ files):
```typescript
// ❌ OLD
if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
  (window as any).dispatchEvent(
    new CustomEvent('quorum:toast', {
      detail: { message: 'Success!', variant: 'success' }
    })
  );
}
```

With:
```typescript
// ✅ NEW
import { useToast } from '@/hooks/ui/useToast';

const { showSuccess } = useToast();
showSuccess('Profile updated successfully!');
```

**Files to Migrate:**
1. `/src/hooks/business/spaces/useSpaceProfile.ts:213-221`
2. `/src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`
3. `/src/services/MessageService.ts`
4. Search for all `quorum:toast` and `quorum:kick-toast` dispatches

**Step 4: Handle Kick Toast Special Case**

Instead of hardcoding the message in the event handler:
```typescript
// ❌ OLD
const kickHandler = (e: any) => {
  setKickToast({
    message: `You've been kicked from ${e.detail?.spaceName}`,
    variant: 'warning'
  });
};
```

Use i18n-friendly approach:
```typescript
// ✅ NEW
import { t } from '@lingui/macro';

const { showWarning } = useToast();
showWarning(t`You've been kicked from ${spaceName}`);
```

### Phase 6: Testing & Quality Assurance

**Create Test Utilities:**

File: `/src/test-utils/toast.tsx`

```typescript
import React from 'react';
import { ToastProvider } from '@/components/context/ToastProvider';
import type { ToastConfig } from '@/types/toast';

export const ToastTestProvider: React.FC<{
  children: React.ReactNode;
  config?: Partial<ToastConfig>;
}> = ({ children, config }) => (
  <ToastProvider config={config}>
    {children}
  </ToastProvider>
);

export const mockToastContext = {
  toasts: [],
  config: { position: 'bottom-right' as const, maxVisible: 3, defaultDuration: 5 },
  showToast: jest.fn(() => 'mock-toast-id'),
  updateToast: jest.fn(),
  dismissToast: jest.fn(),
  dismissAll: jest.fn(),
};
```

**Test Cases to Implement:**

1. **Toast Display**
   - Single toast shows correctly
   - Multiple toasts stack properly
   - Max visible limit enforced

2. **Auto-dismiss**
   - Toasts auto-close after specified duration
   - Duration = 0 disables auto-close
   - Manual dismiss works

3. **Queue Management**
   - FIFO queue when exceeding maxVisible
   - Dismiss by ID works
   - Dismiss all works

4. **Accessibility**
   - ARIA live region announces toasts
   - Keyboard dismissal works
   - Screen reader compatibility

5. **Type Safety**
   - TypeScript catches invalid variants
   - Required fields enforced

### Phase 7: Documentation

**Create Toast Documentation:**

File: `/src/components/primitives/Toast/README.md`

````markdown
# Toast System

## Overview

Global toast notification system using React Context. Supports multiple toasts, auto-dismiss, and platform-agnostic API designed for future mobile implementation.

## Basic Usage

```typescript
import { useToast } from '@/hooks/ui/useToast';

const MyComponent = () => {
  const { showSuccess, showError } = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      showSuccess('Data saved successfully!');
    } catch (error) {
      showError('Failed to save data');
    }
  };

  return <button onClick={handleSave}>Save</button>;
};
```

## API Reference

### `useToast()`

Returns toast context with the following methods:

#### Convenience Methods
- `showSuccess(message, options?)` - Show success toast
- `showError(message, options?)` - Show error toast
- `showWarning(message, options?)` - Show warning toast
- `showInfo(message, options?)` - Show info toast

#### Advanced Methods
- `showToast(toast)` - Show custom toast, returns toast ID
- `updateToast(id, updates)` - Update existing toast
- `dismissToast(id)` - Dismiss specific toast
- `dismissAll()` - Dismiss all toasts

### Toast Options

```typescript
interface Toast {
  message: string;
  variant: 'info' | 'success' | 'warning' | 'error';
  duration?: number; // seconds, 0 = no auto-close
  dismissible?: boolean; // default: true
  action?: {
    label: string;
    onPress: () => void;
  };
}
```

### Provider Configuration

```typescript
<ToastProvider config={{
  position: 'bottom-right', // 'top-left' | 'top-center' | etc.
  maxVisible: 3, // Maximum toasts shown simultaneously
  defaultDuration: 5, // Default auto-close duration (seconds)
}}>
  {/* app */}
</ToastProvider>
```

## Examples

### Long-lived Toast
```typescript
showInfo('Processing...', { duration: 0 }); // Manual dismiss only
```

### Toast with Action Button
```typescript
showToast({
  message: 'File deleted',
  variant: 'warning',
  action: {
    label: 'Undo',
    onPress: () => restoreFile(),
  },
});
```

### Programmatic Control
```typescript
const toastId = showInfo('Uploading...');

// Later: update the toast
updateToast(toastId, {
  message: 'Upload complete!',
  variant: 'success'
});

// Or dismiss it
dismissToast(toastId);
```

## Migration from Old System

**Before:**
```typescript
if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
  (window as any).dispatchEvent(
    new CustomEvent('quorum:toast', {
      detail: { message: 'Success!', variant: 'success' }
    })
  );
}
```

**After:**
```typescript
import { useToast } from '@/hooks/ui/useToast';

const { showSuccess } = useToast();
showSuccess('Success!');
```

## Accessibility

- Toasts use ARIA live regions for screen reader announcements
- Keyboard navigation supported
- Dismissible toasts have proper focus management

## Future: Mobile Implementation

The API is designed to be platform-agnostic. When mobile support is added:

1. Create `/src/components/primitives/Toast/ToastContainer.native.tsx`
2. Implement using React Native's `Animated` API
3. No changes required to consumer code (`useToast()` hook remains identical)
````

## Testing Checklist

### Functional Testing

- [ ] Single toast displays correctly
- [ ] Multiple toasts stack properly (up to `maxVisible`)
- [ ] Auto-dismiss works after specified duration
- [ ] Manual dismiss (X button) works
- [ ] Toast positioning configurable (all 6 positions)
- [ ] Max visible limit enforced (oldest removed when exceeded)
- [ ] `showSuccess`, `showError`, `showWarning`, `showInfo` shortcuts work
- [ ] `updateToast` updates existing toast
- [ ] `dismissToast` removes specific toast
- [ ] `dismissAll` clears all toasts
- [ ] Duration = 0 disables auto-close
- [ ] Dismissible = false hides X button

### Type Safety Testing

- [ ] TypeScript catches invalid variants
- [ ] Required fields enforced (`message`, `variant`)
- [ ] Hook throws error when used outside provider
- [ ] Toast ID returned from `showToast()`

### Accessibility Testing

- [ ] ARIA live region announces toasts
- [ ] Screen reader reads toast message and variant
- [ ] Keyboard can dismiss toasts (Escape key)
- [ ] Focus management works properly
- [ ] Color contrast meets WCAG standards

### Edge Cases

- [ ] Rapid toast creation doesn't break UI
- [ ] Toast dismissed during animation doesn't error
- [ ] Provider unmount clears all toasts
- [ ] Multiple providers don't conflict (if nested)
- [ ] Long messages don't break layout
- [ ] Special characters in messages render correctly
- [ ] i18n messages work properly

### Performance Testing

- [ ] No memory leaks with auto-dismiss timers
- [ ] No unnecessary re-renders
- [ ] Large number of toasts (10+) doesn't lag UI

### Migration Testing

- [ ] All old `quorum:toast` dispatches removed
- [ ] All old `quorum:kick-toast` dispatches removed
- [ ] Old event listeners removed from Layout.tsx
- [ ] Old toast state (`kickToast`) removed
- [ ] No console errors in browser
- [ ] TypeScript compiles with no errors
- [ ] Linting passes

## Future Enhancements (Post-Implementation)

### Phase 8: Advanced Features (Optional)

**Toast History:**
```typescript
interface ToastContextValue {
  // ... existing
  history: Toast[]; // All dismissed toasts
  clearHistory: () => void;
}
```

**Progress Toasts:**
```typescript
interface ProgressToast extends Toast {
  progress?: number; // 0-100
}

// Usage:
const id = showInfo('Uploading...', { progress: 0 });
// Update progress
updateToast(id, { progress: 50 });
updateToast(id, { progress: 100, message: 'Upload complete!', variant: 'success' });
```

**Toast Groups:**
```typescript
interface Toast {
  // ... existing
  group?: string; // Group related toasts
}

// Dismiss entire group
dismissGroup(groupName: string);
```

**Sound Notifications:**
```typescript
interface ToastConfig {
  // ... existing
  playSound?: boolean;
  sounds?: {
    success?: string; // path to audio file
    error?: string;
    warning?: string;
    info?: string;
  };
}
```

## Mobile Implementation Notes (Future)

When mobile notifications are ready to implement:

### Platform Detection Strategy

```typescript
// src/components/primitives/Toast/ToastContainer.tsx
import { isMobile } from '@/utils/platform';

export const ToastContainer = isMobile()
  ? require('./ToastContainer.native').ToastContainer
  : require('./ToastContainer.web').ToastContainer;
```

### React Native Implementation Considerations

**File:** `/src/components/primitives/Toast/ToastContainer.native.tsx`

Key differences for mobile:
1. Use `react-native-reanimated` for animations
2. Position relative to safe area (notch/home indicator)
3. Consider keyboard visibility
4. Use haptic feedback for important toasts
5. Handle orientation changes

**Possible Implementation:**
```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastContext } from '@/components/context/ToastContext';
import { Callout } from '@/components/primitives/Callout';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToastContext();
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        { top: insets.top + 16, right: 16 }
      ]}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <Animated.View
          key={toast.id}
          entering={FadeInUp}
          exiting={FadeOutUp}
        >
          <Callout
            variant={toast.variant}
            size="sm"
            dismissible={toast.dismissible}
            onClose={() => dismissToast(toast.id)}
          >
            {toast.message}
          </Callout>
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
    maxWidth: 360,
    gap: 8,
  },
});
```

**No changes to consumer code required** - `useToast()` hook works identically on both platforms.

## Success Criteria

This refactoring is considered complete when:

1. ✅ All old event-based toast code removed
2. ✅ New Context-based system implemented
3. ✅ Multiple toasts can display simultaneously
4. ✅ Full TypeScript type safety
5. ✅ Accessibility features working (ARIA)
6. ✅ All existing toast functionality preserved
7. ✅ Developer-friendly API (`useToast` hook)
8. ✅ Comprehensive documentation
9. ✅ Test coverage for core functionality
10. ✅ Zero breaking changes to user-facing behavior
11. ✅ API designed to accommodate future mobile implementation without breaking changes

## References

### Current Implementation Files
- `/src/components/Layout.tsx` - Current toast logic (lines 39-53, 113-130)
- `/src/components/primitives/Callout/` - Underlying toast UI component

### Related Documentation
- `.agents/tasks/.done/callout-primitive-system.md` - Callout component implementation
- `.agents/tasks/.done/callout-primitive-audit.md` - Callout component audit
- `.agents/INDEX.md` - Project documentation index

### TypeScript Resources
- [TypeScript Handbook - Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [React Context TypeScript](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/context/)

### Accessibility Resources
- [WAI-ARIA: status role](https://www.w3.org/TR/wai-aria-1.2/#status)
- [WCAG 2.1 - Time-based Media](https://www.w3.org/WAI/WCAG21/Understanding/time-based-media)

---

_Created: 2025-10-07 by Claude Code_
