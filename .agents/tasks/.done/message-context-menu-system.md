---
type: task
title: Message Context Menu System
status: done
complexity: medium
ai_generated: true
created: 2025-12-05T00:00:00.000Z
updated: '2026-01-09'
---

# Message Context Menu System

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent


**Files**:
- `src/components/message/Message.tsx`
- `src/components/message/MessageActions.tsx`
- `src/components/message/MessageActionsDrawer.tsx`
- `src/components/ui/DropdownPanel.tsx`
- `src/styles/_colors.scss:84` (--color-bg-contextmenu already defined)

## What & Why

**Current state**: Messages display actions via hover-based `MessageActions` component on desktop and long-press `MobileDrawer` on touch devices. No right-click context menu exists.

**Desired state**: Right-clicking a message opens a custom context menu with the same actions as `MessageActions` but in a vertical layout (emoji row + icon+label items). The native browser context menu is disabled app-wide except on input fields.

**Value**: Provides familiar desktop UX pattern (Discord-style), improves discoverability of message actions.

## Context

- **Existing pattern**: `MessageActionsDrawer.tsx` already implements vertical layout with icon+label items for mobile
- **Existing pattern**: `DropdownPanel.tsx` has click-outside logic (lines 66-104) we can extract
- **Existing pattern**: `Portal.web.tsx` for rendering outside DOM hierarchy
- **CSS ready**: `--color-bg-contextmenu: var(--surface-00)` defined in `_colors.scss:84`
- **Z-index strategy**: 10001 for dropdowns, 10002 for tooltips

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Input fields | Allow native menu | Preserves spell-check, paste, accessibility |
| Touch devices | Desktop-only | Continue using existing long-press → MobileDrawer |
| Keyboard navigation | Defer to v2 | Mouse-only for v1, add later based on feedback |
| Generic abstraction | No | YAGNI - build specific, abstract when 3rd use case appears |

### Close Behavior UX Pattern
- **Modal actions** (Pin, Delete): Close immediately, open modal
- **Copy actions** (Copy Link, Copy Message): Close with ~300ms delay for "Copied!" feedback
- **Instant actions** (Reply, Edit, Bookmark): Close immediately

### Positioning Strategy
- **Default**: Top-left corner anchored at cursor (menu extends right and down)
- **Approach**: Fixed estimates for menu dimensions (like Discord)
- **Edge handling**: Flip when insufficient space

| Scenario | Solution |
|----------|----------|
| No space on right | Flip horizontally: menu extends left from cursor |
| No space below | Flip vertically: menu extends up from cursor |
| Both edges | Flip both: menu extends left and up |

```typescript
const MENU_WIDTH = 240;   // Fixed estimate
const MENU_HEIGHT = 320;  // Fixed estimate (max with all actions)
const PADDING = 8;        // Margin from viewport edge

function calculatePosition(clickX: number, clickY: number) {
  const flipX = clickX + MENU_WIDTH + PADDING > window.innerWidth;
  const flipY = clickY + MENU_HEIGHT + PADDING > window.innerHeight;

  return {
    x: flipX ? clickX - MENU_WIDTH : clickX,
    y: flipY ? clickY - MENU_HEIGHT : clickY,
  };
}
```

## Implementation

### Phase 1: Infrastructure

- [ ] **Extract useClickOutside hook** (`src/hooks/useClickOutside.ts`)
  - Done when: Hook provides simple click-outside detection
  - Note: Extract **basic** logic only - leave complex exclusions (tooltips, buttons, Select) in DropdownPanel
  - Verify: Can be used by both DropdownPanel and new context menu
  ```typescript
  export function useClickOutside(
    ref: RefObject<HTMLElement>,
    onClickOutside: () => void,
    enabled: boolean = true
  ): void
  ```

- [ ] **Create useContextMenuPrevention hook** (`src/hooks/useContextMenuPrevention.ts`)
  - Done when: Native context menu prevented except on inputs/textareas
  - Verify: Right-click on message shows nothing, right-click on input shows native menu
  ```typescript
  export function useContextMenuPrevention(): void {
    useEffect(() => {
      const handleContextMenu = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
      };
      document.addEventListener('contextmenu', handleContextMenu);
      return () => document.removeEventListener('contextmenu', handleContextMenu);
    }, []);
  }
  ```

- [ ] **Add hook to App.tsx**
  - Done when: Hook imported and called in App component
  - Verify: Native menu prevented throughout app

### Phase 2: MessageContextMenu Component

- [ ] **Create MessageContextMenu** (`src/components/message/MessageContextMenu.tsx`)
  - Done when: All-in-one component renders at cursor position
  - Verify: Menu appears, all actions work, closes correctly
  - Features:
    - Uses existing `<Portal>` primitive
    - Uses `useClickOutside` hook
    - Fixed positioning at cursor
    - z-index: 10001
  - Layout:
    1. Quick reactions row (❤️ 👍 🔥 ➕more)
    2. Divider
    3. Vertical action items with icon + label
  - Reference: Follow `MessageActionsDrawer.tsx` for action structure

- [ ] **Style the component**
  - Done when: Styled consistently with app design
  - Decision: Likely SCSS file given complexity (hover states, danger variant, divider, reactions row)
  - Key styles needed:
    - `bg-contextmenu` background
    - `rounded-lg`, `shadow-lg`
    - `z-[10001]` for z-index
    - `min-w-[200px]`, `max-w-[280px]`
    - Action items: flex, gap, padding, hover state
    - Danger variant (red) for Delete
    - Reactions row layout
    - Divider styling

### Phase 3: Integration

- [ ] **Integrate with Message.tsx**
  - Done when: Right-clicking message opens MessageContextMenu (desktop only)
  - Verify: Menu appears at cursor, all actions work
  - Touch devices: Use existing `isTouchDevice()` check - context menu is desktop-only, touch uses MobileDrawer
  ```typescript
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isTouchDevice()) return; // Touch devices use existing MobileDrawer
    e.preventDefault();
    setContextMenu({ position: { x: e.clientX, y: e.clientY } });
  };
  ```

- [ ] **Wire up action handlers**
  - Done when: All actions from MessageActions work in context menu
  - Reuse: Same handlers passed to MessageActions

### Phase 4: Polish

- [ ] **Close on scroll**
  - Done when: Context menu closes when message list container scrolls
  - Verify: Scroll message list with menu open → menu closes
  - Note: Listen to message list container scroll, not window scroll

- [ ] **Viewport edge detection**
  - Done when: Menu flips position when near viewport edges
  - Verify: Right-click near bottom/right edge → menu fully visible
  - Uses fixed estimates: MENU_WIDTH=240, MENU_HEIGHT=320, PADDING=8

- [ ] **Single active menu**
  - Done when: Only one context menu visible at a time
  - Verify: Rapid right-clicks → only latest menu shown

- [ ] **Escape key to close**
  - Done when: Pressing Escape closes context menu
  - Verify: Open menu, press Escape → menu closes

- [ ] **Refactor DropdownPanel to use useClickOutside**
  - Done when: DropdownPanel uses extracted hook
  - Verify: DropdownPanel behavior unchanged

## Verification

✅ **Right-click opens context menu**
   - Test: Right-click message → menu appears at cursor position

✅ **All actions work correctly**
   - Test: Each action (Reply, Copy Link, Edit, Pin, Delete, etc.) functions as in MessageActions

✅ **Close behaviors correct**
   - Test: Copy → sees "Copied!" then closes; Delete → closes immediately, modal opens

✅ **Touch devices unaffected**
   - Test: Long-press on mobile still opens MobileDrawer, not context menu

✅ **Input fields allow native menu**
   - Test: Right-click on message composer → native browser menu appears

✅ **TypeScript compiles**
   - Run: `cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck"`

## Definition of Done

- [ ] All phases complete
- [ ] All verification tests pass
- [ ] No console errors
- [ ] TypeScript passes
- [ ] Touch devices still use MobileDrawer
- [ ] Native menu works on input fields

## Files to Create

1. `src/hooks/useClickOutside.ts` - Reusable click-outside hook
2. `src/hooks/useContextMenuPrevention.ts` - Global prevention hook
3. `src/components/message/MessageContextMenu.tsx` - All-in-one component
4. `src/components/message/MessageContextMenu.scss` - Styling (optional: may use Tailwind inline if simple enough)

## Files to Modify

1. `src/App.tsx` - Add useContextMenuPrevention hook
2. `src/components/message/Message.tsx` - Add onContextMenu handler
3. `src/styles/main.scss` - Import new stylesheet
4. `src/components/ui/DropdownPanel.tsx` - Refactor to use useClickOutside

## Message Actions to Include

**Quick Reactions Row:**
- ❤️ 👍 🔥 ➕(more emoji picker)

**Action Items:**
| Action | Icon | Condition | Close Behavior |
|--------|------|-----------|----------------|
| Reply | `reply` | Always | Immediate |
| Copy Link | `link` | Always | Delayed (300ms) |
| Copy Message | `clipboard` | Always | Delayed (300ms) |
| Edit | `edit` | canUserEdit | Immediate |
| View Edit History | `history` | canViewEditHistory | Immediate |
| Bookmark | `bookmark`/`bookmark-off` | onBookmarkToggle | Immediate |
| Pin | `pin`/`pin-off` | canPinMessages | Immediate (opens modal) |
| Delete | `trash` (red) | canUserDelete | Immediate (opens modal) |

## Related Documentation

- [Mobile Message Actions Implementation](../docs/features/messages/message-actions-mobile.md)
- [Dropdown Panels](../docs/features/dropdown-panels.md)
- [Touch Interaction System](../docs/features/touch-interaction-system.md)

## Future (v2)

- Keyboard navigation (Arrow keys, Enter, Tab)
- Extract generic ContextMenu when 3rd use case appears
- Context menus for users, channels, images

---


*Reviewed: 2025-12-05 by feature-analyzer agent*
