---
type: task
title: Add Unified Context Menu System for Sidebar Items
status: done
complexity: medium
ai_generated: true
created: 2024-12-24T00:00:00.000Z
updated: '2026-01-09'
---

# Add Unified Context Menu System for Sidebar Items

> **⚠️ AI-Generated**: May contain errors. Verify before use.

> Verified by feature-analyzer agent


**Files**:
- `src/components/ui/ContextMenu.tsx` (new - shared component)
- `src/components/ui/ContextMenu.scss` (new)
- `src/components/direct/DirectMessageContactsList.tsx:55-68`
- `src/components/direct/DirectMessageContact.tsx:152-176`
- `src/components/navbar/SpaceButton.tsx:62-110`
- `src/components/navbar/NavMenu.tsx`
- `src/components/navbar/FolderContextMenu.tsx` (refactor to use shared)

## What & Why
Three sidebar item types (DM contacts, spaces, folders) need context menus with similar layouts: avatar/icon header + action items. Currently only folders have a context menu. Creating a unified `ContextMenu` component enables consistent UX while reducing code duplication and simplifying future maintenance.

## Context
- **Existing pattern**: `FolderContextMenu.tsx` provides the base implementation with positioning, close handlers, and styling
- **Truncation classes**: Use `truncate-user-name` for DM names, `truncate-space-name` for space names (defined in `src/styles/_base.scss:226-244`)
- **Space ownership check**: Use `useSpaceOwner` hook from `src/hooks/queries/spaceOwner/useSpaceOwner.ts` to determine if user can leave
- **Leave space logic**: `useSpaceLeaving` hook in `src/hooks/business/spaces/useSpaceLeaving.ts` handles the leave flow
- **Delete confirmation**: Reuse `useConfirmation` hook pattern from `ConversationSettingsModal.tsx:54-67`
- **Touch + drag pattern**: `FolderContainer.tsx:59-99` shows how to handle long-press on draggable elements
- **Touch interaction system**: See `.agents/docs/features/touch-interaction-system.md` for haptic feedback and hook usage

---

## Touch vs Desktop Behavior

| Device | Element | Gesture | Result |
|--------|---------|---------|--------|
| **Desktop** | DM/Space/Folder | Right-click | Context menu |
| **Touch** | DM contact | Long-press (500ms) | Open ConversationSettingsModal directly |
| **Touch** | Space icon | Long-press (500ms) | Open SpaceSettingsModal directly |
| **Touch** | Space icon | Drag (>15px) | dnd-kit drag (long-press cancelled) |
| **Touch** | Folder | Long-press (500ms) | Open FolderSettingsModal directly |
| **Touch** | Folder | Drag (>15px) | dnd-kit drag (long-press cancelled) |

**Key distinction:**
- **DM contacts** are NOT draggable → can use simpler `useLongPressWithDefaults` hook
- **Spaces & Folders** ARE draggable → must use raw touch events (`onTouchStart/Move/End`) pattern to avoid conflicts with dnd-kit

---

## Implementation

### Phase 0: Update Modal Infrastructure (required for Phase 3)
- [ ] **Update useModalState to support tab navigation** (`src/hooks/business/ui/useModalState.ts`)
    - Done when: `openSpaceEditor` accepts optional `initialTab` parameter
    - Update `spaceEditor` state interface:
      ```typescript
      spaceEditor: {
        isOpen: boolean;
        spaceId?: string;
        initialTab?: 'account' | 'general' | 'invites' | 'roles';
      };
      ```
    - Update `OPEN_SPACE_EDITOR` action type to include `initialTab?: string`
    - Update `openSpaceEditor` function signature: `openSpaceEditor(spaceId: string, initialTab?: string)`

- [ ] **Update SpaceSettingsModal to accept initialTab prop** (`src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`)
    - Done when: Modal opens to specified tab when `initialTab` prop is provided
    - Add `initialTab?: 'account' | 'general' | 'invites' | 'roles'` to props
    - Pass `initialTab` to `useSpaceManagement` hook
    - Default to `'general'` for owners, `'account'` for members if not specified

- [ ] **Update useSpaceManagement to support initialCategory** (`src/hooks/business/spaces/useSpaceManagement.ts`)
    - Done when: Hook accepts `initialCategory` parameter and sets it as default
    - Add `initialCategory?: string` to hook options
    - Set `selectedCategory` initial state from `initialCategory` prop

### Phase 1: Create Shared Context Menu Component
- [ ] **Create ContextMenu component** (`src/components/ui/ContextMenu.tsx`)
    - Done when: Component renders header + configurable menu items
    - Reference: Extract common logic from `src/components/navbar/FolderContextMenu.tsx:38-153`

    Props interface (discriminated union for type safety):
    ```typescript
    type HeaderConfig =
      | {
          type: 'user';
          address: string;
          displayName?: string;
          userIcon?: string;  // UserAvatar handles initials fallback
        }
      | {
          type: 'space';
          spaceId: string;
          spaceName: string;
          iconUrl?: string;  // SpaceIcon handles initials fallback
        }
      | {
          type: 'folder';
          icon: string;
          iconColor: string;
          name: string;
        };

    interface MenuItem {
      icon: string;
      label: string;
      onClick: () => void;
      danger?: boolean;
      confirmLabel?: string;  // If set, requires click-confirm (shows this on 2nd click)
      hidden?: boolean;       // Conditionally hide items
    }

    interface ContextMenuProps {
      header?: HeaderConfig;  // OPTIONAL - when omitted, menu shows items only (no header)
      items: MenuItem[];
      position: { x: number; y: number };
      onClose: () => void;
      width?: number;  // Default: 240px for consistent width across all menus
    }
    ```

    Header rendering (when provided):
    - `type: 'user'` → `<UserAvatar>` (handles initials fallback) + truncated name
    - `type: 'space'` → `<SpaceIcon>` (handles initials fallback) + truncated name
    - `type: 'folder'` → `<Icon>` with color + truncated name
    - When `header` is omitted → no header section, just menu items

- [ ] **Create SCSS file** (`src/components/ui/ContextMenu.scss`)
    - Done when: Styles match FolderContextMenu using shared `_context-menu.scss` mixins
    - Use `z-index: 10001` (same as FolderContextMenu)
    - Header needs `max-width` constraint for truncation to work
    - Reference: `src/components/navbar/FolderContextMenu.scss`

- [ ] **Implement close handlers**
    - Done when: Menu closes on click outside, Escape key, and scroll
    - Use `useClickOutside` hook (like `FolderContextMenu.tsx:66`)
    - Add Escape key handler (like `FolderContextMenu.tsx:68-77`)
    - Add scroll-to-close handler with close-once guard (like `FolderContextMenu.tsx:79-90`)

- [ ] **Implement viewport edge detection**
    - Done when: Menu flips position when near right/bottom edges
    - Use constants: `MENU_WIDTH = 240` (default, overridable via props), `MENU_HEIGHT` (calculate based on items), `PADDING = 8`
    - Reference: `FolderContextMenu.tsx:24-36` for `calculatePosition` function

- [ ] **Implement per-item confirmation state**
    - Done when: Items with `confirmLabel` show confirmation text on first click, execute on second
    - Use internal state: `const [confirmingItem, setConfirmingItem] = useState<string | null>(null)`
    - Reset confirmation after 5 seconds (like `FolderContextMenu.tsx:52-59`)

### Phase 2: DM Conversation Context Menu (requires Phase 1)
- [ ] **Add onContextMenu prop to DirectMessageContact** (`src/components/direct/DirectMessageContact.tsx:152-176`)
    - Done when: Desktop div has `onContextMenu` handler that only fires on non-touch devices
    - Use `isTouchDevice()` from `src/utils/platform.ts` to check if touch device
    - Reference: `src/components/navbar/FolderContainer.tsx:136-142` for the exact pattern:
      ```typescript
      const isTouch = isTouchDevice();
      const handleContextMenu = (e: React.MouseEvent) => {
        if (!isTouch && onContextMenu) {
          e.preventDefault();
          onContextMenu(e);
        }
      };
      ```

- [ ] **Add long-press for touch devices** (`src/components/direct/DirectMessageContact.tsx`)
    - Done when: Long-press opens ConversationSettingsModal on touch devices
    - DM contacts are NOT draggable, so use `useLongPressWithDefaults` hook (simpler than raw touch events)
    - Reference: Current `useLongPressWithDefaults` usage at line 38-47
    - Modify `onLongPress` callback to:
      ```typescript
      onLongPress: () => {
        hapticMedium();  // Always add haptic feedback for long-press
        onOpenSettings();
      },
      ```

- [ ] **Integrate context menu in DirectMessageContactsList** (`src/components/direct/DirectMessageContactsList.tsx`)
    - Done when: Right-click shows ContextMenu with:
      - Header: `type: 'user'` with address, displayName, userIcon
      - Item: "Conversation Settings" → opens `ConversationSettingsModal`
      - Item: "Delete Conversation" (danger, with confirmLabel) → delete then navigate
    - Reference: Delete logic from `ConversationSettingsModal.tsx:137-172`
    - **IMPORTANT**: Add post-delete navigation:
      ```typescript
      const handleDeleteConversation = async () => {
        const isActive = currentAddress === contact.address;
        await deleteConversation(conversationId);

        if (isActive) {
          // Navigate to next conversation or empty state
          const nextConversation = findNextConversation(conversations, conversationId);
          if (nextConversation) {
            navigate(`/messages/${nextConversation.address}`);
          } else {
            navigate('/messages'); // Empty state
          }
        }
        onClose();
      };
      ```
    - Track active context menu to prevent multiple menus:
      ```typescript
      const [activeContextMenu, setActiveContextMenu] = useState<string | null>(null);
      // Only render if this item is active
      {activeContextMenu === item.id && <ContextMenu ... />}
      ```

### Phase 3: Space Context Menu (requires Phase 1)
- [ ] **Add onContextMenu and onOpenSettings props to SpaceButton** (`src/components/navbar/SpaceButton.tsx`)
    - Done when: Props added and desktop div has `onContextMenu` handler that only fires on non-touch devices
    - Add `onContextMenu?: (e: React.MouseEvent) => void`
    - Add `onOpenSettings?: () => void` for long-press action
    - Use `isTouchDevice()` from `src/utils/platform.ts` to check if touch device
    - Reference: `src/components/navbar/FolderContainer.tsx:136-142` for the touch-aware pattern

- [ ] **Add long-press for touch devices** (`src/components/navbar/SpaceButton.tsx`)
    - Done when: Long-press opens SpaceSettingsModal on touch devices
    - Spaces ARE draggable, so must use raw touch events pattern (NOT useLongPress hook)
    - Reference: `src/components/navbar/FolderContainer.tsx:59-99` for the exact pattern
    - Include `hapticMedium()` call on long-press trigger
    - Cancel long-press when `isDragging` becomes true

- [ ] **Integrate context menu in NavMenu** (`src/components/navbar/NavMenu.tsx`)
    - Done when: Right-click on space shows ContextMenu with role-based items
    - Use `useSpaceOwner` to check if current user is owner
    - Use `openSpaceEditor(spaceId, initialTab)` with tab parameter from Phase 0

    **For regular members:**
      - Header: `type: 'space'` with spaceId, spaceName, iconUrl
      - Item: "My Account" → `openSpaceEditor(spaceId, 'account')`
      - Item: "Leave Space" (danger) → uses `useSpaceLeaving` hook

    **For space owners:**
      - Header: `type: 'space'` with spaceId, spaceName, iconUrl
      - Item: "My Account" → `openSpaceEditor(spaceId, 'account')`
      - Item: "Space Settings" → `openSpaceEditor(spaceId, 'general')`
      - Item: "Invite Members" → `openSpaceEditor(spaceId, 'invites')`
      - Item: "Manage Roles" → `openSpaceEditor(spaceId, 'roles')`

    **Note:** Delete Space removed (requires deleting all channels first - better in full modal)

    - Track active context menu to prevent multiple menus:
      ```typescript
      const [activeContextMenu, setActiveContextMenu] = useState<string | null>(null);
      // Only render if this space's menu is active
      {activeContextMenu === space.spaceId && <ContextMenu ... />}
      ```

### Phase 4: Refactor FolderContextMenu (requires Phase 1)
- [ ] **Update FolderContextMenu width to 240px** (`src/components/navbar/FolderContextMenu.tsx`)
    - Done when: `MENU_WIDTH` constant updated from 180 to 240
    - Update line 10: `const MENU_WIDTH = 240;`
    - Update SCSS if width-specific styles exist
    - Ensures consistency with new ContextMenu component

- [ ] **Refactor FolderContextMenu to use ContextMenu** (`src/components/navbar/FolderContextMenu.tsx`)
    - Done when: `FolderContextMenu.tsx` is a thin wrapper around `ContextMenu`
    - Maintains same external API for backwards compatibility
    - Passes `type: 'folder'` header with icon, iconColor, name

---

## Menu Configurations Summary

| Type | Header | Items | Touch Behavior |
|------|--------|-------|----------------|
| **DM Contact** | `UserAvatar` + name (initials fallback) | Settings, Delete (danger+confirm) | Long-press → Settings modal (`useLongPressWithDefaults` + `hapticMedium`) |
| **Space (Member)** | `SpaceIcon` + name (initials fallback) | My Account → Account tab, Leave Space (danger) | Long-press → Account tab (raw touch events, drag-aware, `hapticMedium`) |
| **Space (Owner)** | `SpaceIcon` + name (initials fallback) | My Account → Account tab, Space Settings → General tab, Invite Members → Invites tab, Manage Roles → Roles tab | Long-press → General tab (raw touch events, drag-aware, `hapticMedium`) |
| **Folder** | `Icon` (colored) + name | Settings, Delete (danger+confirm) | Long-press → Settings modal (raw touch events, drag-aware) |

---

## Verification

✓ **DM context menu works (desktop)**
    - Test: Right-click DM contact → menu with avatar + truncated name appears
    - Test: DM without avatar → shows UserInitials with colored background
    - Test: "Conversation Settings" → opens ConversationSettingsModal
    - Test: "Delete Conversation" → first click shows "Confirm", second click deletes

✓ **DM long-press works (touch)**
    - Test: Long-press DM contact (500ms) → haptic feedback + ConversationSettingsModal opens
    - Test: Tap DM contact → navigates (no modal)

✓ **Space context menu works (desktop)**
    - Test: Right-click space icon → menu with space icon + truncated name appears
    - Test: Space without icon → shows initials with colored background
    - Test (as owner): Menu shows "My Account", "Space Settings", "Invite Members", "Manage Roles"
    - Test (as owner): "My Account" → opens SpaceSettingsModal at Account tab
    - Test (as owner): "Space Settings" → opens SpaceSettingsModal at General tab
    - Test (as owner): "Invite Members" → opens SpaceSettingsModal at Invites tab
    - Test (as owner): "Manage Roles" → opens SpaceSettingsModal at Roles tab
    - Test (as member): Menu shows "My Account", "Leave Space"
    - Test (as member): "My Account" → opens SpaceSettingsModal at Account tab
    - Test (as member): "Leave Space" → uses useSpaceLeaving hook

✓ **Space long-press works (touch)**
    - Test (as owner): Long-press space (500ms) → haptic feedback + SpaceSettingsModal opens at General tab
    - Test (as member): Long-press space (500ms) → haptic feedback + SpaceSettingsModal opens at Account tab
    - Test: Press and drag space (>15px) → drag activates, no modal, no haptic
    - Test: Tap space → navigates (no modal)

✓ **Folder context menu still works**
    - Test: Right-click folder → same behavior as before (regression test)

✓ **Long names truncate properly**
    - Test: DM with very long display name → truncates with ellipsis in header
    - Test: Space with very long name → truncates with ellipsis in header

✓ **Menu positioning at edges**
    - Test: Right-click near right/bottom edge → menu flips appropriately

✓ **TypeScript compiles**
    - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority | Risk |
|----------|-------------------|--------|----------|------|
| Owner right-clicks own space | Shows owner menu: My Account, Space Settings, Invite Members, Manage Roles | ⚠️ Needs handling | P0 | Low |
| Member right-clicks space | Shows member menu: My Account, Leave Space | ⚠️ Needs handling | P0 | Low |
| Delete active DM conversation | Navigate to next conversation | ⚠️ Needs handling | P0 | Medium |
| Delete only DM conversation | Navigate to `/messages` empty state | ⚠️ Needs handling | P0 | Low |
| Leave current space | Navigate to `/messages` | ✓ Handled by useSpaceLeaving | P0 | Low |
| Touch: drag vs long-press conflict | Movement >15px cancels long-press | ✓ Pattern from FolderContainer | P0 | Low |
| Touch device right-click | No context menu (touch uses long-press) | ✓ Use isTouchDevice() check in handler | P0 | Low |
| Multiple context menus | Opening new menu closes previous | ⚠️ Needs handling | P1 | Low |
| User/Space without avatar | Show initials with colored bg | ✓ UserAvatar/SpaceIcon handle this | P0 | Low |
| SpaceSettingsModal opened with tab param | Navigate to specified tab (account, general, invites, roles) | ⚠️ Needs useModalState update | P0 | Medium |
| Menu width consistency | All context menus use 240px width | ⚠️ Needs implementation | P1 | Low |

---

## Definition of Done

- [ ] All Phase 0-4 checkboxes complete
- [ ] TypeScript compiles without errors
- [ ] All verification tests pass
- [ ] No console errors or warnings
- [ ] Folder context menu regression tested (including 240px width)
- [ ] Touch long-press works for DM, Space, Folder (with haptic feedback)
- [ ] Touch drag not broken for Space, Folder
- [ ] Initials fallback works for users/spaces without avatars
- [ ] Code follows existing patterns (shared mixins, hooks)
- [ ] Modal tab navigation works (SpaceSettingsModal opens to correct tab)
- [ ] Post-delete navigation works (DM deletion navigates to next conversation)
- [ ] Only one context menu visible at a time

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2024-12-24 - Claude**: Initial task creation with DM context menu only
**2024-12-24 - Claude**: Expanded scope to include Space context menu and unified SidebarContextMenu component
**2024-12-24 - Claude**: Added touch device behavior - long-press for DM (simple) vs Space/Folder (drag-aware raw touch events)
**2024-12-24 - Claude**: Incorporated feature-analyzer feedback:
  - Refined header props to discriminated union with proper avatar/initials handling
  - Added missing Phase 1 items: useClickOutside, Escape handler, scroll-to-close, viewport edge detection
  - Added hapticMedium() requirement for all long-press actions
  - Added per-item confirmation state tracking
  - Added onOpenSettings prop requirement for SpaceButton
  - Added edge case for multiple context menus
**2024-12-25 - Claude**: Updated Space context menu design:
  - Space owners see: My Account, Space Settings, Invite Members, Manage Roles (Delete Space removed)
  - Regular members see: My Account, Leave Space
  - Owner cannot leave space (no ownership transfer support yet)
  - All menu items open SpaceSettingsModal at specific tabs (Account, General, Invites, Roles)
  - Consistent 240px width for all context menus (accommodates long space/folder names)
  - Long-press behavior: owners → General tab, members → Account tab
  - Context menus disabled on touch devices (checked via `isTouchDevice()` utility)
**2024-12-25 - Claude**: Incorporated feature-analyzer review feedback:
  - Added Phase 0: Modal infrastructure updates (useModalState, SpaceSettingsModal, useSpaceManagement)
  - Added post-delete navigation for DM conversations (navigate to next or empty state)
  - Added context menu coordination to prevent multiple menus (activeContextMenu state)
  - Added FolderContextMenu width update to 240px for consistency
  - Updated edge case priorities and verification requirements
**2024-12-25 - Claude**: Updated component location:
  - Changed from `src/components/sidebar/SidebarContextMenu.tsx` to `src/components/ui/ContextMenu.tsx`
  - Simpler name (ContextMenu vs SidebarContextMenu)
  - Better location alongside other shared UI components (DropdownPanel, MobileDrawer, etc.)
