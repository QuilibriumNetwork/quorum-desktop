# UserProfile Modal Positioning - Viewport Boundary Detection

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

When clicking on a user avatar in a message near the bottom of the screen, the UserProfile modal opens downward and gets cut off by the viewport boundary. The modal should flip to open upward when there isn't enough space below, similar to how MessageActionsMenu handles this scenario.

**Expected behavior**: Modal opens with top aligned to avatar. If insufficient space below, modal flips so bottom aligns with avatar.

**Actual behavior**: Modal always opens downward from the avatar position, getting cut off when near the bottom of the screen.

## Root Cause

The positioning logic in `useUserProfileModal.ts` calculates the modal position **before** the modal is rendered to the DOM. This means:

1. The hook determines position based on `elementRect.top` without knowing actual modal height
2. There's no mechanism to measure the rendered modal and adjust position
3. The React component lifecycle makes "measure-then-position" difficult with the current hook architecture

**Contrast with MessageActionsMenu (which works correctly)**:
- MessageActionsMenu handles its own positioning internally using a callback ref pattern
- It renders initially hidden (`visibility: hidden`), measures actual height, then positions and shows
- The positioning logic is inside the component, not in an external hook

## Attempted Solutions (All Failed)

### 1. Callback Ref Pattern in Hook
**Approach**: Added `setModalRef` callback ref to `useUserProfileModal.ts` that would measure height and adjust position.

**Code attempted**:
```typescript
const setModalRef = useCallback((node: HTMLDivElement | null) => {
  if (node && pendingPosition) {
    const actualHeight = node.getBoundingClientRect().height;
    const adjustedTop = calculateVerticalPosition(pendingPosition.top, actualHeight);
    setModalPosition({ ...pendingPosition, top: adjustedTop });
    setIsPositioned(true);
  }
}, [pendingPosition]);
```

**Result**: Callback ref was never called. Modal stopped appearing entirely.

**Why it failed**: The ref callback timing didn't work with how the modal was conditionally rendered.

### 2. useLayoutEffect in Hook
**Approach**: Used `useLayoutEffect` with a ref to measure after render but before paint.

**Result**: No change in behavior. Modal still positioned incorrectly.

**Why it failed**: The element wasn't in the DOM when the effect ran, or the ref wasn't properly attached.

### 3. requestAnimationFrame in Callback Ref
**Approach**: Added `requestAnimationFrame` inside callback ref to wait for browser to complete render.

**Code attempted**:
```typescript
const setModalRef = useCallback((node: HTMLDivElement | null) => {
  if (node) {
    requestAnimationFrame(() => {
      const actualHeight = node.getBoundingClientRect().height;
      // ... position adjustment
    });
  }
}, [pendingPosition]);
```

**Result**: No console logs appeared, modal didn't open.

**Why it failed**: The callback ref itself wasn't being invoked.

### 4. useLayoutEffect in Channel.tsx
**Approach**: Moved positioning logic to the parent component (Channel.tsx) with useLayoutEffect.

**Result**: No change. Modal still positioned top-down.

**Why it failed**: The hook's state management and the parent's effect weren't synchronized properly.

### 5. Hidden Visibility Pattern
**Approach**: Render modal with `visibility: hidden`, measure, then set to `visible`.

**Result**: Modal remained hidden or positioning wasn't updated before becoming visible.

**Why it failed**: State updates and re-renders weren't happening in the expected order.

## Solution

**Recommended approach**: Refactor UserProfile to handle its own positioning internally, similar to MessageActionsMenu.tsx pattern.

**Key changes needed**:

1. **Move positioning logic inside UserProfile component** instead of external hook
2. **Use callback ref pattern** on the modal container div
3. **Render initially with `visibility: hidden`**
4. **Measure actual height in callback ref**, calculate adjusted position, then show

**Reference implementation** - MessageActionsMenu.tsx:41-54:
```typescript
const [adjustedPosition, setAdjustedPosition] = useState<{ x: number; y: number } | null>(null);

const setMenuRef = useCallback(
  (node: HTMLDivElement | null) => {
    menuRef.current = node;
    if (node) {
      const actualHeight = node.getBoundingClientRect().height;
      setAdjustedPosition(calculatePosition(position.x, position.y, actualHeight));
    }
  },
  [position.x, position.y]
);

// In JSX:
// visibility: adjustedPosition ? 'visible' : 'hidden'
```

## Prevention

When implementing viewport-aware positioning for modals/popups:
- Keep positioning logic inside the component that renders the element
- Use callback refs for DOM measurement, not useEffect/useLayoutEffect
- Render hidden first, measure, then show
- Avoid external hooks that calculate position before render

## Files Involved

- `src/hooks/business/ui/useUserProfileModal.ts` - Hook that currently handles positioning
- `src/components/user/UserProfile.tsx` - The modal component
- `src/components/user/UserProfile.scss` - Modal styling (width: 330px)
- `src/utils/modalPositioning.ts` - Shared positioning utilities
- `src/constants/ui.ts` - Modal dimension constants
- `src/components/message/MessageActionsMenu.tsx` - Reference implementation that works

---

_Created: 2026-01-03_
