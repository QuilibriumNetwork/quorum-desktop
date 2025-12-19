# Scroll Performance Optimization

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Status**: Pending
**Complexity**: High
**Created**: 2025-12-19
**Files**:
- `src/components/message/MessageList.tsx`
- `src/components/message/MessageActionsMenu.tsx`
- `src/components/navbar/FolderContextMenu.tsx`
- `src/hooks/business/channels/useSpaceHeader.ts`
- `src/hooks/ui/useScrollTracking.ts`
- `src/components/space/Channel.tsx`
- `src/components/direct/DirectMessage.tsx`

## What & Why

Chrome DevTools shows performance violations when visiting spaces:
- `[Violation] 'scroll' handler took 275ms`
- `[Violation] Forced reflow while executing JavaScript took 58ms`

These violations indicate scroll handlers are blocking the main thread, causing janky scrolling and poor UX. The root causes are unthrottled scroll handlers, forced reflows from layout reads during scroll, and expensive computations in scroll callbacks.

## Context

- **Existing pattern**: The app uses Virtuoso for virtualized list rendering (good)
- **Constraints**: Must maintain existing functionality (collapsing headers, jump-to-present, context menu dismissal, separator tracking)
- **Dependencies**: react-virtuoso, existing hook architecture
- **Risk**: Multiple interconnected scroll handlers - changes could break functionality

## Root Cause Analysis

### High Priority Issues

#### 1. MessageList `handleRangeChanged` - Array Search in Scroll Callback
**File**: `src/components/message/MessageList.tsx:437-467`

```typescript
const handleRangeChanged = useCallback(
  (range: { startIndex: number; endIndex: number }) => {
    // This findIndex runs on EVERY scroll range change
    const firstUnreadIndex = messageList.findIndex(
      (m) => m.messageId === newMessagesSeparator.firstUnreadMessageId
    );
    // ...
  },
  [newMessagesSeparator, onDismissSeparator, messageList, separatorWasVisible]
);
```

**Problems**:
- `messageList.findIndex()` runs on every scroll - O(n) on potentially thousands of messages
- `messageList` in dependency array causes callback recreation on every new message
- Called very frequently by Virtuoso during scrolling

**Fix approach**: Memoize the `firstUnreadIndex` calculation outside the callback so the O(n) search only runs when `messageList` or separator changes, not on every scroll event (which fires 10-50 times per second during scrolling).

#### 2. Context Menu Scroll Handlers - Capture Phase, Unthrottled
**Files**:
- `src/components/message/MessageActionsMenu.tsx:97-102`
- `src/components/navbar/FolderContextMenu.tsx:79-84`

```typescript
useEffect(() => {
  const handleScroll = () => onClose();
  window.addEventListener('scroll', handleScroll, true);  // Capture phase!
  return () => window.removeEventListener('scroll', handleScroll, true);
}, [onClose]);
```

**Problems**:
- Capture phase fires for ALL scroll events globally (even nested scrollables)
- No throttling - fires on every pixel of scroll
- Calls `onClose()` many times per second during active scrolling

**Fix approach**: Add a "close-once" guard so `onClose()` only fires once per menu open (the actual fix), not on every scroll pixel

#### 3. useCollapsingHeader - State Update on Every Scroll Pixel
**File**: `src/hooks/business/channels/useSpaceHeader.ts:70-72`

```typescript
const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
  setScrollTop(e.currentTarget.scrollTop)  // State update on every pixel
}, [])
```

**Problems**:
- Every pixel of scroll triggers React state update → re-render
- Used in ChannelList for collapsing header effect
- No throttling or requestAnimationFrame batching

**Fix approach**: Throttle with requestAnimationFrame to batch updates per animation frame

> ⚠️ **Risk**: rAF batching introduces ~16ms delay which may affect header smoothness. Test with fast scroll gestures.

### Medium Priority Issues

#### 4. Window Resize Handlers - No Debouncing
**Files**:
- `src/components/space/Channel.tsx:729-734` (header height)
- `src/components/direct/DirectMessage.tsx:366-388` (header height)
- `src/hooks/business/channels/useSpaceHeader.ts` (maxHeight)
- `src/components/message/MessageList.tsx:80-91` (window size for overscan)

```typescript
// Multiple places have this pattern:
window.addEventListener('resize', updateSomething);  // No debounce!
```

**Problems**:
- Resize fires rapidly during window drag
- Multiple components have independent resize listeners
- Some trigger `getBoundingClientRect()` calls (forced reflows)

**Fix approach**: Add debouncing to all resize handlers

#### 5. MessageList rowRenderer Dependencies
**File**: `src/components/message/MessageList.tsx:213-310`

**Problems**:
- Large dependency array causes frequent re-memoization
- Dependencies include: messageList, roles, stickers, emoji picker state, etc.
- Complex nested fragment rendering

**Fix approach**: Reduce dependencies, extract stable sub-components

### Low Priority Issues

#### 6. Virtuoso `atBottomThreshold={5000}` (UX consideration, not performance)
**File**: `src/components/message/MessageList.tsx:485`

This triggers fetchNextPage when 5000px from bottom (~4-5 screens on 1080p). This is a UX tradeoff (preloading messages early) rather than a performance issue. Keep as-is unless pagination feels too eager.

## Implementation

### Phase 1: Memoize firstUnreadIndex (Highest Impact)

- [ ] **Extract index calculation from callback** (`MessageList.tsx`)
  ```typescript
  // Before: findIndex inside handleRangeChanged
  // After: memoize outside
  const firstUnreadIndex = useMemo(() => {
    if (!newMessagesSeparator?.firstUnreadMessageId) return -1;
    return messageList.findIndex(
      (m) => m.messageId === newMessagesSeparator.firstUnreadMessageId
    );
  }, [messageList, newMessagesSeparator?.firstUnreadMessageId]);

  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (firstUnreadIndex === -1 || !onDismissSeparator) return;
      // Use memoized firstUnreadIndex
      const isVisible = firstUnreadIndex >= range.startIndex &&
                        firstUnreadIndex <= range.endIndex;
      // ...
    },
    [firstUnreadIndex, onDismissSeparator, separatorWasVisible]
  );
  ```
  - Done when: `firstUnreadIndex` is memoized and `findIndex` only runs when messageList/separator changes
  - Note: Callback will still recreate when `firstUnreadIndex` changes, but the expensive O(n) search won't run on every scroll event
  - Verify: Scroll performance improves, separator dismissal still works

### Phase 2: Throttle Collapsing Header (High Impact)

- [ ] **Add requestAnimationFrame batching** (`useSpaceHeader.ts`)
  ```typescript
  const rafRef = useRef<number>();

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setScrollTop(scrollTop);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);
  ```
  - Done when: State updates batched per animation frame
  - Verify: Collapsing header still works smoothly, fewer re-renders
  - **Test specifically**: Header collapse responsiveness with rapid scroll gestures (rAF may introduce 16ms lag)

### Phase 3: Fix Context Menu Scroll Handlers (Medium Impact)

- [ ] **Add close-once guard** (`MessageActionsMenu.tsx`, `FolderContextMenu.tsx`)
  ```typescript
  useEffect(() => {
    let hasClosed = false;
    const handleScroll = () => {
      if (hasClosed) return;
      hasClosed = true;
      onClose();
    };
    window.addEventListener('scroll', handleScroll, { capture: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [onClose]);
  ```
  - The `hasClosed` guard is the actual fix - prevents `onClose()` from firing hundreds of times per scroll gesture
  - Done when: Menu closes on first scroll, doesn't fire repeatedly
  - Verify: Context menus still close on scroll, performance improved

### Phase 4: Debounce Resize Handlers (Medium Impact)

- [ ] **Create shared debounced resize hook** (`src/hooks/ui/useWindowResize.ts`)
  ```typescript
  export function useWindowResize(callback: () => void, delay = 200) {
    useEffect(() => {
      let timeoutId: number;
      const handleResize = () => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(callback, delay);
      };
      window.addEventListener('resize', handleResize);
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', handleResize);
      };
    }, [callback, delay]);
  }
  ```
  - Note: 200ms default is typical for resize debouncing (window resize fires every ~16ms during drag)
  - Done when: Hook created and documented

- [ ] **Apply to Channel.tsx header height** (`Channel.tsx:729-734`)
  - Done when: Uses debounced handler
  - Verify: Header height still updates after resize stops

- [ ] **Apply to DirectMessage.tsx header height** (`DirectMessage.tsx:366-388`)
  - Done when: Uses debounced handler

- [ ] **Apply to useSpaceHeader maxHeight** (`useSpaceHeader.ts`)
  - Done when: Uses debounced handler

- [ ] **Apply to MessageList useWindowSize hook** (`MessageList.tsx:80-91`)
  - This hook recalculates Virtuoso overscan values on every resize pixel
  - Done when: Uses debounced handler or the shared hook

### Phase 5: Validate & Test

- [ ] **Test scroll performance**
  - Open Chrome DevTools Performance tab
  - Scroll through message list
  - Verify no 275ms+ violations

- [ ] **Test all affected functionality**
  - Collapsing space headers work
  - Jump-to-present button appears/disappears correctly
  - New messages separator dismisses when scrolled out of view
  - Context menus close on scroll
  - Window resize updates header heights

## Verification

✅ **No Chrome DevTools violations**
   - Test: Open space, scroll through messages
   - Expected: No "scroll handler took Xms" violations in console

✅ **Collapsing header works**
   - Test: In space with banner, scroll channel list with fast gestures
   - Expected: Header smoothly collapses/expands without feeling laggy
   - Note: If header feels sluggish after Phase 2, consider throttling to 60fps instead of rAF batching

✅ **Jump-to-present works**
   - Test: Scroll up in messages, button appears; click it
   - Expected: Jumps to bottom, button disappears

✅ **New messages separator dismisses**
   - Test: Have unread messages, scroll past separator
   - Expected: Separator dismissed when scrolled out of view

✅ **Context menus close on scroll**
   - Test: Open message actions menu, scroll
   - Expected: Menu closes on scroll

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| Memoize firstUnreadIndex | Low | Simple refactor, same logic |
| Throttle collapsing header | Medium | Test header smoothness - rAF adds 16ms delay |
| Context menu close-once guard | Low | Simple guard, same behavior |
| Debounce resize handlers | Low | Standard pattern |
| rowRenderer dependencies | High | Defer to later phase |

## Definition of Done

- [ ] All implementation phases complete
- [ ] No scroll handler violations in Chrome DevTools
- [ ] All verification tests pass
- [ ] TypeScript passes
- [ ] Manual testing successful
- [ ] No console errors
- [ ] PR reviewed and merged

## Edge Cases Covered

- **Rapid channel switching during scroll**: The rAF cleanup in useEffect return handles unmount during scroll ✅
- **Hash navigation during scroll**: Existing safeguards (`isLoadingHashMessage`, `hasProcessedHash`) remain intact ✅
- **Mobile touch vs desktop wheel scrolling**: Proposed solutions (memoization, rAF) work for both ✅
- **Accessibility (reduced motion)**: Consider disabling rAF batching when `prefers-reduced-motion` is set (immediate updates may be preferred)

---

_Created: 2025-12-19_
_Reviewed: 2025-12-19 by feature-analyzer agent_
