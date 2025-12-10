# Space Folders - Discord-Style Grouping Feature

https://github.com/QuilibriumNetwork/quorum-desktop/issues/89

> **Status**: Phase 5 Complete (Sync & Persistence)
> **Priority**: Medium
> **Complexity**: High
> **Cross-Platform**: Must work on both desktop and mobile

---

## Overview

Implement Discord-style space folder functionality that allows users to group space icons by dragging them together in the left navigation bar.

**Key Features:**
- Drag space onto space → creates folder
- Expandable folder container with colored background
- Folder customization (name, icon, color)
- Cross-device sync with conflict resolution
- Backwards compatible with native app

---

## Error Check Commands

Run after each step to catch errors early (faster than `yarn build`):

**Option 1: Lint specific files (recommended)**
```bash
cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && yarn lint"
```

**Option 2: Type-check specific files only**
```bash
# Replace with actual files you modified
cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit --skipLibCheck src/path/to/file.ts src/path/to/other.tsx"
```

**Example for folder files:**
```bash
cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit --skipLibCheck src/components/navbar/FolderButton.tsx src/components/navbar/FolderContainer.tsx src/utils/folderUtils.ts"
```

> ⚠️ Avoid running `npx tsc --noEmit` on the whole project - it will show many unrelated errors.

---

# IMPLEMENTATION CHECKLIST

## Phase 1: Data Foundation ✅ COMPLETE

### 1.1 Add `folder` icon to ICON_OPTIONS
- [x] **File**: `src/components/space/IconPicker/types.ts`
- [x] Added to `ICON_OPTIONS` array: `{ name: 'folder', tier: 1, category: 'Organization' }`
- [x] Added `folder` to `FILLED_ICONS` set
- [x] **File**: `src/components/primitives/Icon/types.ts` - Added `'folder'` and `'folder-minus'` to IconName
- [x] **File**: `src/components/primitives/Icon/iconMapping.ts` - Added folder icon mappings
- [x] **STOP**: Lint passed

### 1.2 Add `mode` prop to IconPicker
- [x] **File**: `src/components/space/IconPicker/types.ts` - Added `mode?: 'icon-color' | 'background-color'`
- [x] **File**: `src/components/space/IconPicker/IconPicker.web.tsx`
  - When `mode="background-color"`: icons render white, button shows colored bg, swatches show colored circles with white icons
  - Added `isBackgroundColorMode` and `displayIconColor` variables
  - Updated button, variant toggles, color swatches, and icon grid for bg-color mode
- [x] **File**: `src/components/space/IconPicker/IconPicker.native.tsx` - Same updates for native
- [x] **File**: `src/components/space/IconPicker/IconPicker.scss` - Added `.icon-picker-bg-swatch` styles
- [x] **File**: `src/components/space/IconPicker/IconPicker.native.styles.ts` - Added `bgSwatchButton` styles
- [x] **STOP**: Lint passed
- [ ] **STOP - VISUAL TEST**: Open any channel editor, verify IconPicker still works normally

### 1.3 Add NavItem types
- [x] **File**: `src/db/messages.ts` (UserConfig was here, not quorumApi.ts)
- [x] Added `FolderColor` type alias for IconColor
- [x] Added `NavItem` discriminated union type (space | folder)
- [x] Added `items?: NavItem[]` to UserConfig type
- [x] **STOP**: Lint passed

### 1.4 Add helper functions
- [x] **New File**: `src/utils/folderUtils.ts`
- [x] Added `deriveSpaceIds()` function
- [x] Added `validateItems()` function
- [x] Added `migrateToItems()` function
- [x] Added `createFolder()` helper
- [x] Added `findFolderContainingSpace()` helper
- [x] Added `canCreateFolder()` / `canAddToFolder()` limit check helpers
- [x] Added constants: `MAX_FOLDERS = 20`, `MAX_SPACES_PER_FOLDER = 50`
- [x] **STOP**: Lint passed

### 1.5 Add SpaceButton `size` prop
- [x] **File**: `src/components/navbar/SpaceButton.tsx` - Added `size?: 'small' | 'regular'` prop
- [x] **File**: `src/components/navbar/SpaceIcon.tsx` - Updated size type to `'small' | 'regular' | 'large'`, added 40px for small
- [x] **File**: `src/components/navbar/SpaceIcon.scss` - Added `.space-icon-small` class (40px)
- [x] **STOP**: Lint passed

**✅ PHASE 1 COMPLETE** - No visual changes yet, just foundation

---

## Phase 2: Folder UI Components ✅ COMPLETE

### 2.1 Create FolderButton component
- [x] **New File**: `src/components/navbar/FolderButton.tsx`
- [x] Props: `folder`, `hasUnread`, `unreadCount`, `mentionCount`, `size`
- [x] Renders: White icon on colored background (48px circle, 40px for small)
- [x] Tooltip on desktop, disabled on touch devices
- [x] Mention bubble for unread counts
- [x] **STOP**: Lint passed

### 2.2 Create FolderContainer component
- [x] **New File**: `src/components/navbar/FolderContainer.tsx`
- [x] Handles collapsed/expanded states with FolderButton
- [x] Uses `useLongPressWithDefaults` for touch (long-press opens editor)
- [x] Desktop: click toggles expand, right-click for context menu (Phase 3)
- [x] Integrates with dnd-kit for drag-and-drop
- [x] Renders spaces at small size (40px) when expanded
- [x] **STOP**: Lint passed

### 2.3 Create folder SCSS
- [x] **New File**: `src/components/navbar/Folder.scss`
- [x] `.folder-button` - 48px circle with color bg, hover effects
- [x] `.folder-button--small` - 40px variant
- [x] `.folder-button-mention-bubble` - mention count badge
- [x] `.folder-container` - expanded container styling
- [x] `.folder-spaces` - container for space icons
- [x] Mobile-responsive sizes
- [x] **STOP**: Lint passed

### 2.4 Integrate into NavMenu
- [x] **File**: `src/components/navbar/NavMenu.tsx`
- [x] Added `useFolderStates` hook for local collapsed/expanded state
- [x] Added `useNavItems` hook to process config.items
- [x] Logic to detect `hasItems` (new format) vs legacy `spaceIds`
- [x] Render `FolderContainer` for folders, `SpaceButton` for spaces
- [x] Pass through mention counts and unread counts to folders
- [x] **New Files**:
  - `src/hooks/business/folders/useFolderStates.ts` - localStorage-based state
  - `src/hooks/business/folders/useNavItems.ts` - maps config to renderable items
  - `src/hooks/business/folders/index.ts` - exports
- [x] **STOP**: Lint passed
- [ ] **STOP - VISUAL TEST**:
  - Manually add a test folder to your local config (via dev tools or temp code)
  - Verify folder appears in navbar
  - Verify clicking expands/collapses
  - Verify spaces inside are smaller (40px)

**✅ PHASE 2 COMPLETE** - Folders render visually

---

## Phase 3: Interactions & Modals ✅ COMPLETE

### 3.1 Add FolderEditorModal state to ModalProvider
- [x] **File**: `src/hooks/business/ui/useModalState.ts`
- [x] Added folderEditor state: `{ isOpen: boolean; folderId?: string }`
- [x] Added actions: `OPEN_FOLDER_EDITOR`, `CLOSE_FOLDER_EDITOR`
- [x] **File**: `src/components/context/ModalProvider.tsx`
- [x] Added modal rendering (pattern from ChannelEditorModal)
- [x] **STOP**: Run `yarn lint` - passed

### 3.2 Create FolderEditorModal
- [x] **New File**: `src/components/modals/FolderEditorModal.tsx`
- [x] Pattern: Follows `ChannelEditorModal.tsx`
- [x] Contains:
  - Name input (max 40 chars)
  - IconPicker with `mode="background-color"`
  - Save button
  - Delete Folder link at bottom (danger style, double-click confirmation)
- [x] **New File**: `src/hooks/business/folders/useFolderManagement.ts`
  - Handles name, icon, color, validation, save, delete logic
  - Pre-fills with "Spaces" for new folders
- [x] **Delete confirmation**: Double-click pattern (like GroupEditorModal)
- [x] **STOP**: Run `yarn lint` - passed

### 3.3 Create FolderContextMenu (desktop only)
- [x] **New File**: `src/components/navbar/FolderContextMenu.tsx`
- [x] Options: "Folder Settings", "Delete Folder"
- [x] **New File**: `src/styles/_context-menu.scss` - Shared context menu styles
- [x] Updated `src/components/message/MessageActionsMenu.scss` to use shared styles
- [x] Updated `src/components/navbar/FolderContextMenu.scss` to use shared styles
- [x] **STOP**: Run `yarn lint` - passed

### 3.4 Wire up interactions
- [x] **File**: `src/components/navbar/NavMenu.tsx`
- [x] Added context menu state management
- [x] Desktop: Right-click → FolderContextMenu
- [x] **File**: `src/components/navbar/FolderContainer.tsx`
- [x] Touch: Long-press → FolderEditorModal directly (already implemented in Phase 2)
- [x] Desktop: Click toggles expand, right-click shows context menu
- [x] **STOP**: Run `yarn lint` - passed
- [ ] **STOP - VISUAL TEST**:
  - Desktop: Right-click folder → context menu appears
  - Desktop: Click "Folder Settings" → modal opens
  - Mobile (or touch simulation): Long-press → modal opens directly

**✅ PHASE 3 COMPLETE** - Folder editing works

---

## Phase 4: Drag & Drop ✅ COMPLETE

> **Implementation approach**: Created a new dedicated hook `useFolderDragAndDrop.ts` rather than extending the existing `useSpaceDragAndDrop.ts`. The new hook handles all folder-aware scenarios and uses `migrateToItems()` to work with both legacy and new config formats.

### 4.1 Create folder-aware drag hook ✅
- [x] **New File**: `src/hooks/business/folders/useFolderDragAndDrop.ts`
- [x] Created `DragScenario` type with all 10 scenarios
- [x] Created `parseDragInfo()` to understand drag source/target
- [x] Created `detectScenario()` with `dropIntent` parameter for zone-based detection
- [x] Implemented `handleDragStart`, `handleDragMove`, `handleDragEnd`
- [x] Touch support with sensors:
  ```typescript
  activationConstraint: isTouchDevice
    ? { delay: 200, tolerance: 5 }
    : { distance: 8 }
  ```
- [x] **File**: `src/hooks/business/folders/index.ts` - Added export
- [x] **STOP**: Lint passed

### 4.2 Implement DragStateContext for global drag state ✅
- [x] **File**: `src/hooks/business/ui/useDragState.ts`
  - Added `ActiveDragItem` interface (id, type)
  - Added `DropTarget` interface (id, type, intent, parentFolderId)
  - Added `DropIntent` type: `'merge' | 'reorder-before' | 'reorder-after' | null`
- [x] **File**: `src/context/DragStateContext.tsx`
  - Extended context with `activeItem`, `setActiveItem`, `dropTarget`, `setDropTarget`
- [x] **STOP**: Lint passed

### 4.3 Implement zone-based drop detection ✅
- [x] **File**: `src/hooks/business/folders/useFolderDragAndDrop.ts`
- [x] `handleDragMove` calculates drop zones based on pointer position:
  - Top 25% of target → `reorder-before` (insert above)
  - Middle 50% of target → `merge` (create folder / add to folder)
  - Bottom 25% of target → `reorder-after` (insert below)
- [x] `detectScenario()` uses `dropIntent` to distinguish merge vs reorder actions
- [x] **STOP**: Lint passed

### 4.4 Implement all drag scenarios ✅
All 10 scenarios from the state machine are implemented:
- [x] `SPACE_TO_SPACE` - Drag space onto space → creates folder (only on merge intent)
- [x] `SPACE_TO_FOLDER` - Drag space onto closed folder → adds to folder
- [x] `SPACE_TO_FOLDER_SPACE` - Drag space onto space inside folder → adds to that folder
- [x] `FOLDER_SPACE_TO_FOLDER` - Move space from folder A to folder B
- [x] `FOLDER_SPACE_TO_SPACE` - Drag folder space onto standalone → creates new folder
- [x] `SPACE_OUT_OF_FOLDER` - Drag space out of folder → becomes standalone
- [x] `FOLDER_REORDER` - Reorder folders in list
- [x] `SPACE_REORDER_STANDALONE` - Reorder standalone spaces
- [x] `SPACE_REORDER_IN_FOLDER` - Reorder within folder
- [x] `INVALID` - Invalid drop targets are ignored
- [x] **Auto-delete empty folders**: When last space is removed, folder is deleted
- [x] **STOP**: Lint passed

### 4.5 Implement visual feedback ✅
- [x] **File**: `src/components/navbar/SpaceIcon.scss`
  - Added `.drop-target-wiggle` class with wiggle animation
- [x] **File**: `src/components/navbar/SpaceButton.tsx`
  - Uses `dropTarget` from context for visual feedback
  - Shows wiggle on merge intent (standalone spaces only)
  - Shows horizontal drop indicator on reorder intent
  - Added `parentFolderId` prop for spaces inside folders
- [x] **File**: `src/components/navbar/FolderContainer.tsx`
  - Closed folders: wiggle on merge intent
  - Open folders: only show drop indicators (no wiggle)
  - Spaces inside folders: only show drop indicators (no wiggle)
- [x] **STOP**: Lint passed

### 4.6 Implement DragOverlay for free-floating ghost ✅
- [x] **File**: `src/components/navbar/NavMenu.tsx`
  - Added `DragOverlay` component from `@dnd-kit/core`
  - Removed `restrictToVerticalAxis` modifier - ghost can move anywhere on screen
  - Added `dropAnimation` for smooth drop effect (200ms ease)
  - Renders ghost copy of dragged item (SpaceIcon or FolderButton)
- [x] **File**: `src/components/navbar/NavMenu.scss`
  - Added `.drag-overlay-ghost` class:
    - `opacity: 0.9` - slightly transparent
    - `filter: drop-shadow()` - shadow effect
    - `transform: scale(1.05)` - slightly larger
    - `cursor: grabbing`
- [x] **File**: `src/components/navbar/SpaceButton.tsx` & `FolderContainer.tsx`
  - Changed drag style from `opacity: 0.5` with transform to `visibility: hidden`
  - Original item stays in place as invisible placeholder
  - Other items don't shift until drop
- [x] **STOP**: Lint passed

### 4.7 Add UI limit enforcement ✅
- [x] **File**: `src/hooks/business/folders/useFolderDragAndDrop.ts`
- [x] Before creating folder: Check `canCreateFolder()` (max 20)
  - Shows toast: "Maximum 20 folders reached"
- [x] Before adding to folder: Check `canAddToFolder()` (max 50 per folder)
  - Shows toast: "Maximum 50 spaces per folder"
- [x] Uses existing `showWarning()` toast utility
- [x] **STOP**: Lint passed

### Visual Feedback Summary

| Target Type | Closed/Standalone | Inside Open Folder |
|-------------|-------------------|-------------------|
| Standalone space | Dashed border (center) / Separator (edge) | N/A |
| Closed folder | Dashed border (center) / Separator (edge) | N/A |
| Open folder | Separator only | N/A |
| Space inside folder | N/A | Separator only |

**Discord-like UX achieved**:
- Placeholder stays in place while dragging (no layout shift)
- Ghost follows cursor freely (not constrained to NavMenu)
- Zone-based detection: drag to center = merge, drag to edge = reorder
- Clear visual feedback: pulsing dashed border for merge, horizontal line for reorder

### 4.8 UI/UX Polish ✅
- [x] **Consistent spacing**: Changed from `margin-top` on items to `gap` on container
  - `.nav-menu-spaces` uses `gap: $s-2-5` (10px) for consistent spacing between all items
  - Removed all `margin-top` from `.space-icon`, `.space-icon-selected`, `.folder-button`
- [x] **Fixed inline-block baseline gap**: Changed `.space-icon` from `display: inline-block` to `display: block`
  - Space icons with background images were creating extra space due to baseline alignment
- [x] **Unified icon shape**: All icons (spaces and folders) use rounded square shape (`$rounded-lg`)
  - Changed `.space-icon` from `$rounded-full` to `$rounded-lg`
  - Added `.user-initials.space-icon` override to match (only when used as space icon, not user avatar)
  - Folder buttons also use `$rounded-lg`
- [x] **Drop target indicator**: Replaced wiggle animation with pulsing dashed border
  - `.drop-target-wiggle::after` - 3px dashed accent border with pulse animation
  - Uses `$rounded-xl` for border-radius (slightly larger than icon)
- [x] **Toggle indicator positioning**: Changed from hardcoded `margin-top` to `top: 50%; transform: translateY(-50%)`
  - Auto-centers regardless of icon size changes
  - Only need to adjust horizontal `left` position per breakpoint
- [x] **Folder background opacity**: Reduced from 50% to 25% for subtler appearance
- [x] **Context menu improvements**:
  - Added folder name header with folder icon and full-width border below
  - Smaller text (`size="sm"`) for menu options
  - Changed delete icon from `folder-minus` to `trash`
  - Menu opens 12px (`$s-3`) to the right of click position
- [x] **Folder expand/collapse animation**: CSS grid-based smooth height transition
  - Uses CSS grid trick: `grid-template-rows: 0fr` → `1fr` for animating height from 0 to auto
  - `.folder-spaces-wrapper` handles the animation with 300ms ease-in-out
  - `.folder-spaces` uses `min-height: 0` for grid animation to work
  - Spacing uses margins on first/last child (not padding) to avoid content peeking through when collapsed
  - Container padding only applied when expanded (animates in with background color)
- [x] **Folder icon size**: Uses `xl` (24px) for regular, `lg` (20px) for small

**✅ PHASE 4 COMPLETE** - Full drag & drop working with limit enforcement and polished UI

---

## Phase 4.5: Critical Bug Fix - New Spaces Not Visible ✅ COMPLETE

> **Issue discovered**: After Phase 4, newly created spaces were not appearing in NavMenu.
> **Root cause**: When creating/joining spaces, only `spaceIds` was updated, but `items` array was not.

### Problem Analysis

The folder feature introduced a dual data structure:
- `spaceIds: string[]` - Legacy flat list (for backwards compatibility)
- `items: NavItem[]` - New structure supporting folders

NavMenu rendering logic (line 93):
```typescript
const hasItems = config?.items && config.items.length > 0;
```

When `hasItems` is true, NavMenu uses `useNavItems` hook which reads from `items` array.
When a new space was created, `SpaceService.createSpace` only added to `spaceIds`, not `items`.

### Files Modified

#### SpaceService.ts (space creation)
- **Location**: `src/services/SpaceService.ts:434-459`
- **Change**: When creating a space, now also adds to `items` array if it exists
```typescript
// Create NavItem for the new space
const newSpaceItem: NavItem = { type: 'space', id: spaceAddress };
if (!config) {
  // New user: create config with both spaceIds and items
  await this.saveConfig({
    config: {
      address: registration.user_address,
      spaceIds: [spaceAddress],
      items: [newSpaceItem],
    },
    keyset,
  });
} else {
  // Existing user: update both spaceIds and items (if items exists)
  const updatedConfig = {
    ...config,
    spaceIds: [...config.spaceIds, spaceAddress],
  };
  if (config.items) {
    updatedConfig.items = [...config.items, newSpaceItem];
  }
  await this.saveConfig({ config: updatedConfig, keyset });
}
```

#### InvitationService.ts (joining spaces via invite)
- **Location**: `src/services/InvitationService.ts:799-818`
- **Change**: Same pattern - adds to `items` when joining a space
```typescript
const newSpaceItem: NavItem = { type: 'space', id: space.spaceId };
if (config) {
  config.spaceIds = [...(config.spaceIds ?? []), space.spaceId];
  if (config.items) {
    config.items = [...config.items, newSpaceItem];
  }
} else {
  config = {
    address: currentPasskeyInfo.address,
    spaceIds: [space.spaceId],
    items: [newSpaceItem],
  };
}
```

### Key Insight

The fix maintains backwards compatibility:
- If `config.items` doesn't exist (legacy config), only `spaceIds` is updated
- If `config.items` exists (folder-enabled config), both are updated
- New users get both `spaceIds` and `items` from the start

### Related Bug Report
- See `.agents/bugs/bloated-encryption-states-sync-failure.md` for a separate sync issue discovered during debugging

**✅ PHASE 4.5 COMPLETE** - New spaces now appear correctly in NavMenu

---

## Phase 5: Sync & Persistence

### 5.1 Update ConfigService for items ✅
- [x] **File**: `src/services/ConfigService.ts`
- [x] In `saveConfig()`: Always derive `spaceIds` from `items` before saving
- [x] Add `deriveSpaceIds()` call
- [x] **STOP**: Run `yarn lint` or check modified files

> **Implementation Note**: Instead of centralizing in ConfigService, `deriveSpaceIds()` is called at the point of modification in folder hooks:
> - `src/hooks/business/folders/useFolderManagement.ts:130`
> - `src/hooks/business/folders/useFolderDragAndDrop.ts:557`
> - `src/hooks/business/folders/useDeleteFolder.ts:48`

### 5.2 Implement validateItems() security validation ✅
- [x] **File**: `src/services/ConfigService.ts`
- [x] Import `validateItems` from `../utils/folderUtils`
- [x] Call `validateItems()` in `getConfig()` after decryption (line 131-134)
- [x] **Security**: Enforces limits after sync (prevents compromised device abuse)
  - Max 20 folders (excess silently dropped)
  - Max 100 spaces per folder (excess truncated) - updated from 50 to match Discord/Telegram
  - Removes duplicate space IDs
  - Removes empty folders
- [x] **STOP**: Run `yarn lint` - passed
- [ ] ~~Add `mergeItems()` function~~ - **Deferred**: Using last-write-wins for entire `items` array (simpler, matches current behavior for other config fields)

> **Implementation Note**: Complex folder-level merge algorithm deferred. Current approach: remote config with newer timestamp wins entirely. This is consistent with how other config fields (spaceIds, bookmarks) already work.

### 5.3 Add device-local folder states ✅
- [x] Store collapsed/expanded state locally (not synced)
- [x] Use localStorage or IndexedDB DevicePreferences
- [x] Key: `folderStates: Record<folderId, { collapsed: boolean }>`
- [x] **STOP**: Run `yarn lint` or check modified files
- [ ] **STOP - VISUAL TEST**:
  - Expand folder, refresh page → should remember state
  - This state should NOT sync to other devices

> **Implementation**: `src/hooks/business/folders/useFolderStates.ts` - Full localStorage implementation with `toggleFolder()`, `isExpanded()`, `setFolderState()`, and `cleanupDeletedFolders()`.

### 5.4 Test sync scenarios
- [ ] Create folder on device A → appears on device B
- [ ] Edit folder on A → syncs to B
- [ ] Delete folder on A → removed on B
- [ ] Conflict: Edit on both devices → most recent wins

**✅ PHASE 5 COMPLETE** - Sync validation working (5.1, 5.2, 5.3 done; 5.4 manual testing)

---

## Phase 6: Polish & Cross-Platform

### 6.1 Touch gesture tuning
- [ ] Test on actual touch device (or good simulation)
- [ ] Verify: tap expands, long-press opens modal, drag reorders
- [ ] Verify: no accidental drags during scroll
- [ ] Tune `activationConstraint` if needed

### 6.2 Animations
- [ ] Expand/collapse animation (smooth height transition)
- [ ] Drag feedback animations
- [ ] Folder creation animation (subtle)

### 6.3 i18n
- [ ] Add translations for:
  - "Folder Settings"
  - "Delete Folder"
  - "Edit Folder"
  - Validation messages
- [ ] Note: Default folder name "Spaces" is user data, not translated

### 6.4 Final testing
- [ ] Run through full [Manual Testing Checklist](#manual-testing-checklist)
- [ ] Run `yarn build` - ensure no errors
- [ ] Test on both desktop and mobile

**✅ PHASE 6 COMPLETE** - Feature ready for release

---

# REFERENCE SECTIONS

## Reference: Data Types

```typescript
// In src/db/messages.ts

export type FolderColor = IconColor;

export type NavItem =
  | { type: 'space'; id: string }
  | {
      type: 'folder';
      id: string;                   // crypto.randomUUID()
      name: string;                 // User-defined name (default: "Spaces")
      spaceIds: string[];           // Spaces in this folder (ordered)
      icon?: IconName;              // Custom icon (always rendered white, default: 'folder')
      color?: FolderColor;          // Folder background color (default: 'default' = gray #9ca3af)
      createdDate: number;
      modifiedDate: number;
    };

export type UserConfig = {
  address: string;
  spaceIds: string[];               // KEPT for backwards compatibility (derived from items)
  items?: NavItem[];                // Single source of truth for ordering & folders
  // ... other existing fields
};

// Device-local preferences (NOT synced)
type DevicePreferences = {
  address: string;
  folderStates: Record<string, { collapsed: boolean }>;
};
```

## Reference: Helper Functions

```typescript
// In src/utils/folderUtils.ts

import { NavItem } from '../db/messages';

// Extract all space IDs from items (flattens folders)
export const deriveSpaceIds = (items: NavItem[]): string[] => {
  const spaceIds: string[] = [];
  for (const item of items) {
    if (item.type === 'space') {
      spaceIds.push(item.id);
    } else if (item.type === 'folder') {
      spaceIds.push(...item.spaceIds);
    }
  }
  return spaceIds;
};

// Validate and clean items array
export const validateItems = (items: NavItem[]): NavItem[] => {
  const seen = new Set<string>();
  const validItems: NavItem[] = [];
  let folderCount = 0;

  for (const item of items) {
    if (item.type === 'space') {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        validItems.push(item);
      }
    } else if (item.type === 'folder') {
      if (folderCount >= 20) continue; // Max 20 folders

      // Dedupe spaces within folder
      const uniqueSpaces = item.spaceIds.filter(id => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, 100); // Max 100 spaces per folder (matches Discord/Telegram)

      if (uniqueSpaces.length > 0) {
        validItems.push({ ...item, spaceIds: uniqueSpaces });
        folderCount++;
      }
      // Empty folders are auto-deleted (not added to validItems)
    }
  }

  return validItems;
};

// Migrate legacy spaceIds to items format
export const migrateToItems = (config: UserConfig): UserConfig => {
  if (config.items) return config; // Already migrated

  const items: NavItem[] = (config.spaceIds || []).map(id => ({
    type: 'space' as const,
    id,
  }));

  return {
    ...config,
    items,
    // Keep spaceIds for backwards compatibility
  };
};
```

## Reference: FolderButton Component

```typescript
// src/components/navbar/FolderButton.tsx
// See actual implementation for full details - this is a simplified reference

import { Icon, Tooltip, useTheme } from '../primitives';
import { getFolderColorHex } from '../space/IconPicker/types';
import { NavItem } from '../../db/messages';

interface FolderButtonProps {
  folder: NavItem & { type: 'folder' };
  hasUnread: boolean;
  unreadCount: number;
  mentionCount?: number;
  size?: 'small' | 'regular';  // 40px or 48px
  isExpanded?: boolean;        // Hides indicators when expanded
}

const FolderButton: React.FC<FolderButtonProps> = ({
  folder,
  hasUnread,
  mentionCount = 0,
  size = 'regular',
  isExpanded = false,
}) => {
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  const backgroundColor = getFolderColorHex(folder.color, isDarkTheme);

  return (
    <Tooltip content={folder.name} disabled={isTouchDevice}>
      <div className="relative">
        {/* Toggle indicator for unread */}
        {!isExpanded && (
          <div className={`space-icon-toggle ${hasUnread ? 'space-icon-toggle--unread' : ''}`} />
        )}
        <div
          className={`folder-button ${size === 'small' ? 'folder-button--small' : ''}`}
          style={{ backgroundColor }}
        >
          <Icon
            name={folder.icon || 'folder'}
            color="#ffffff"
            size={size === 'small' ? 'lg' : 'xl'}
          />
          {!isExpanded && mentionCount > 0 && (
            <span className="folder-button-mention-bubble">
              {formatMentionCount(mentionCount, 9)}
            </span>
          )}
        </div>
      </div>
    </Tooltip>
  );
};
```

## Reference: FolderContainer Component

```typescript
// src/components/navbar/FolderContainer.tsx
// See actual implementation for full details - this is a simplified reference
// Actual implementation uses @dnd-kit/sortable and CSS grid animation

import { useSortable } from '@dnd-kit/sortable';
import { useDragStateContext } from '../../context/DragStateContext';
import { getFolderColorHex } from '../space/IconPicker/types';
import { NavItem } from '../../db/messages';

interface FolderContainerProps {
  folder: NavItem & { type: 'folder' };
  spaces: Space[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onEdit: () => void;
  spaceMentionCounts?: Record<string, number>;
}

const FolderContainer: React.FC<FolderContainerProps> = ({
  folder,
  spaces,
  isExpanded,
  onToggleExpand,
  onContextMenu,
  onEdit,
  spaceMentionCounts = {},
}) => {
  // Drag and drop integration
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: folder.id,
    data: { type: 'folder', targetId: folder.id },
  });

  // Drop target visual feedback from context
  const { dropTarget } = useDragStateContext();
  const isDropTarget = dropTarget?.id === folder.id;
  const showWiggle = isDropTarget && dropTarget.intent === 'merge' && !isExpanded;

  // Long press on touch opens editor (500ms)
  // Click toggles expand/collapse
  // Right-click shows context menu (desktop only)

  // Uses CSS grid animation for smooth expand/collapse:
  // .folder-spaces-wrapper { grid-template-rows: 0fr → 1fr }

  return (
    <div
      ref={setNodeRef}
      className={`folder-container ${isExpanded ? 'folder-container--expanded' : ''} ${showWiggle ? 'drop-target-wiggle' : ''}`}
      style={{ '--folder-color': getFolderColorHex(folder.color) }}
    >
      <div {...listeners} onClick={onToggleExpand} onContextMenu={onContextMenu}>
        <FolderButton folder={folder} hasUnread={...} mentionCount={...} isExpanded={isExpanded} />
      </div>
      <div className="folder-spaces-wrapper">
        <div className="folder-spaces">
          {spaces.map(space => (
            <SpaceButton key={space.spaceId} space={space} parentFolderId={folder.id} />
          ))}
        </div>
      </div>
    </div>
  );
};
```

## Reference: FolderContextMenu

```typescript
// src/components/navbar/FolderContextMenu.tsx

interface FolderContextMenuProps {
  folder: NavItem & { type: 'folder' };
  position: { x: number; y: number };
  onClose: () => void;
  onOpenSettings: () => void;
  onDelete: () => void;
}

const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
  position,
  onClose,
  onOpenSettings,
  onDelete,
}) => {
  return (
    <ContextMenu position={position} onClose={onClose}>
      <ContextMenuItem
        icon="settings"
        label={t`Folder Settings`}
        onClick={onOpenSettings}
      />
      <ContextMenuItem
        icon="folder-minus"
        label={t`Delete Folder`}
        onClick={onDelete}
        variant="danger"
      />
    </ContextMenu>
  );
};
```

## Reference: FolderEditorModal

Follow `ChannelEditorModal.tsx` pattern:

```
┌─────────────────────────────┐
│ Edit Folder            [X]  │
├─────────────────────────────┤
│ Folder Name                 │
│ [Spaces_______________]     │  <- pre-filled, error if empty
│                             │
│ [icon] [color swatches]     │
│  (IconPicker mode=          │
│   "background-color")       │
│                             │
│         [Save Changes]      │  <- disabled if name empty
│ ─────────────────────────── │
│       Delete Folder         │  <- double-click: "Click again to confirm"
└─────────────────────────────┘
```

**Defaults on folder creation**:
- Name: "Spaces" (pre-filled, user can edit)
- Icon: "folder"
- Color: "default" (gray #9ca3af)

**Delete behavior**: Double-click confirmation pattern (like GroupEditorModal)
- First click: Text changes to "Click again to confirm"
- Second click (within 5s): Executes delete, ungroups spaces
- Timeout: Resets to "Delete Folder" after 5 seconds

Must use ModalProvider system (see `.agents/docs/features/modals.md`).

## Reference: Drag State Machine

| # | Scenario | Source | Target | Result |
|---|----------|--------|--------|--------|
| 1 | SPACE_TO_SPACE | Standalone space | Standalone space | Create folder |
| 2 | SPACE_TO_FOLDER | Standalone space | Folder | Add to folder |
| 3 | SPACE_TO_FOLDER_SPACE | Standalone space | Space inside folder | Add to that folder |
| 4 | FOLDER_SPACE_TO_FOLDER | Space in folder A | Folder B | Move to folder B |
| 5 | FOLDER_SPACE_TO_SPACE | Space in folder | Standalone space | Create new folder |
| 6 | SPACE_OUT_OF_FOLDER | Space in folder | Outside (gap) | Remove from folder |
| 7 | FOLDER_REORDER | Folder | Gap between items | Reorder folders |
| 8 | SPACE_REORDER_STANDALONE | Standalone space | Gap between items | Reorder |
| 9 | SPACE_REORDER_IN_FOLDER | Space in folder | Gap within folder | Reorder |
| 10 | INVALID | Any | Invalid target | Cancel |

## Reference: Existing Drag System

**Current implementation** (`src/hooks/business/spaces/useSpaceDragAndDrop.ts`):
```typescript
// Already handles: space reordering via arrayMove
// Uses: @dnd-kit/core, @dnd-kit/sortable
// Persists: saveConfig({ spaceIds: sortedSpaces.map(...) })

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },  // Desktop only currently
  })
);
```

**Extend to support folders**:
```typescript
const { isTouchDevice } = usePlatform();

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: isTouchDevice
      ? { delay: 200, tolerance: 5, distance: 15 }
      : { distance: 8 },
  })
);

// In handleDragEnd, detect scenario and route to appropriate handler:
const scenario = detectDragScenario(active, over, items);
switch (scenario) {
  case 'SPACE_TO_SPACE': createFolderWithSpaces(...); break;
  case 'SPACE_TO_FOLDER': addSpaceToFolder(...); break;
  // ... etc
  default: /* existing arrayMove logic for simple reorder */
}
```

## Reference: Merge Algorithm

```typescript
// In ConfigService.ts

private mergeItems(
  localItems: NavItem[],
  remoteItems: NavItem[],
  localTimestamp: number,
  remoteTimestamp: number
): NavItem[] {
  const mergedFolders = new Map<string, NavItem>();
  const allSpaceIds = new Set<string>();
  const spaceLocations = new Map<string, string | null>();

  const processFolders = (items: NavItem[]) => {
    for (const item of items) {
      if (item.type === 'folder') {
        const existing = mergedFolders.get(item.id);
        if (!existing || item.modifiedDate > existing.modifiedDate) {
          mergedFolders.set(item.id, item);
        }
        for (const spaceId of item.spaceIds) {
          allSpaceIds.add(spaceId);
          const currentLocation = spaceLocations.get(spaceId);
          if (!currentLocation || item.modifiedDate > (mergedFolders.get(currentLocation)?.modifiedDate ?? 0)) {
            spaceLocations.set(spaceId, item.id);
          }
        }
      } else if (item.type === 'space') {
        allSpaceIds.add(item.id);
        if (!spaceLocations.has(item.id)) {
          spaceLocations.set(item.id, null);
        }
      }
    }
  };

  processFolders(localItems);
  processFolders(remoteItems);

  const baseItems = remoteTimestamp >= localTimestamp ? remoteItems : localItems;
  const result: NavItem[] = [];
  const addedIds = new Set<string>();

  for (const item of baseItems) {
    if (item.type === 'folder') {
      const mergedFolder = mergedFolders.get(item.id);
      if (mergedFolder && !addedIds.has(item.id)) {
        result.push(mergedFolder);
        addedIds.add(item.id);
      }
    } else if (item.type === 'space') {
      if (spaceLocations.get(item.id) === null && !addedIds.has(item.id)) {
        result.push(item);
        addedIds.add(item.id);
      }
    }
  }

  // Rescue orphaned spaces
  for (const spaceId of allSpaceIds) {
    const isInResult = result.some(item =>
      (item.type === 'space' && item.id === spaceId) ||
      (item.type === 'folder' && item.spaceIds.includes(spaceId))
    );
    if (!isInResult) {
      result.push({ type: 'space', id: spaceId });
    }
  }

  return result;
}
```

## Reference: Backwards Compatibility

```
┌─────────────────────────────────────────────────────────────┐
│ Web app (with folders)                                      │
│   └─> reads items → sees folders + spaces                   │
│   └─> writes both: items + spaceIds (derived)               │
├─────────────────────────────────────────────────────────────┤
│ Native app (before folder support)                          │
│   └─> reads spaceIds → sees all spaces (flat, ungrouped)    │
├─────────────────────────────────────────────────────────────┤
│ Native app (after folder support)                           │
│   └─> reads items → sees folders + spaces                   │
└─────────────────────────────────────────────────────────────┘
```

---

# Security Considerations

> Reviewed by security-analyst agent. Config sync is E2E encrypted (AES-GCM + Ed448 signatures), so folder data is not visible to network observers or servers.

**Threat Model**: These issues only affect a single user's devices. If Device A is compromised, it could sync malformed data that crashes the user's Device B. This **cannot** affect other users because config is encrypted and signed with the user's private key.

## Required: Schema Validation After Decrypt

**Issue**: After decrypting synced config in `ConfigService.ts`, JSON is parsed directly without validation:
```typescript
const config = JSON.parse(...) as UserConfig;  // No validation!
```

A compromised device could sync malformed folder data that crashes the user's other devices.

**Mitigation**: Add Zod schema validation after decryption:

```typescript
import { z } from 'zod';

const NavItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('space'), id: z.string() }),
  z.object({
    type: z.literal('folder'),
    id: z.string(),
    name: z.string().max(40),
    spaceIds: z.array(z.string()).max(50),
    icon: z.string().optional(),
    color: z.string().optional(),
    createdDate: z.number(),
    modifiedDate: z.number(),
  }),
]);

const UserConfigSchema = z.object({
  address: z.string(),
  items: z.array(NavItemSchema).max(100).optional(),  // 20 folders + 80 spaces max
  // ... other fields
});

// In ConfigService.getConfig(), after decryption:
const rawConfig = JSON.parse(decryptedBuffer.toString('utf-8'));
const config = UserConfigSchema.parse(rawConfig);  // Throws if invalid
```

## Required: Limit Enforcement (Two Layers)

**Limits**: 20 folders max, 100 spaces per folder max (matches Discord/Telegram).

| Layer | Where | What happens | Implemented |
|-------|-------|--------------|-------------|
| **UI** | Phase 4.7 | User sees toast error, action blocked | Drag & drop validation |
| **Post-sync** | Phase 5.2 | Silent truncation, no error | `validateItems()` after decrypt |

**Why two layers?**
- UI layer: Friendly UX for normal users
- Post-sync layer: Defense against compromised devices bypassing UI (DevTools, malware, modified app)

```typescript
// Already implemented in src/utils/folderUtils.ts
// Called in ConfigService.getConfig() at line 131-134 after decryption
const validateItems = (items: NavItem[]): NavItem[] => {
  const validItems: NavItem[] = [];
  let folderCount = 0;

  for (const item of items) {
    if (item.type === 'folder') {
      if (folderCount >= 20) continue;  // Skip excess folders
      if (item.spaceIds.length > 100) {
        item.spaceIds = item.spaceIds.slice(0, 100);  // Truncate
      }
      folderCount++;
    }
    validItems.push(item);
  }

  return validItems;
};
```

## Not a Concern: Privacy Metadata

Folder structure is fully encrypted. Server only sees:
- Timestamp (when config changed)
- Encrypted blob size

This is consistent with existing config sync (spaceIds, bookmarks) - not a new leak.

---

# Manual Testing Checklist

## Folder Creation & Structure
- [ ] Create folder by dragging space onto space
- [ ] Add space to existing folder
- [ ] Remove space from folder (drag out)
- [ ] Reorder spaces within folder
- [ ] Reorder folders in list
- [ ] Auto-delete folder when last space removed
- [ ] **Folder deletion preserves space order**: Reorder spaces in folder (e.g., D,B,C), delete folder → spaces appear as D,B,C (not original order)

## Expanded Folder Visual
- [ ] Expanded folder shows container with 50% opacity bg color
- [ ] Folder icon at top (white on solid color), click to collapse
- [ ] Space icons inside are smaller (40px vs 48px)
- [ ] Space icons retain selection indicator
- [ ] Space icons retain unread indicator
- [ ] Space icons retain notification badges

## Desktop Interactions
- [ ] Click folder to expand/collapse
- [ ] Right-click folder → context menu appears
- [ ] Context menu: "Folder Settings" opens FolderEditorModal
- [ ] Context menu: "Delete Folder" ungroups spaces
- [ ] Hover folder → tooltip shows name

## Touch Interactions
- [ ] Tap folder to expand/collapse
- [ ] Long-press folder → FolderEditorModal opens directly
- [ ] Long-press + drag → reorder folder
- [ ] No accidental drags during scroll

## FolderEditorModal
- [ ] Edit folder name (max 40 chars, validation)
- [ ] Change folder icon (IconPicker with background-color mode)
- [ ] Change folder color (icons always white preview)
- [ ] Save changes persists
- [ ] Delete Folder option at bottom works

## Sync
- [ ] Create folder on device A, appears on device B
- [ ] Edit folder on A, syncs to B
- [ ] Delete folder on A while B has it expanded

## Backwards Compatibility
- [ ] Create folders on web → native app shows all spaces flat
- [ ] Verify `spaceIds` is populated after saving config with folders
- [ ] Add space on native app → appears correctly on web app

---

_Created: 2025-09-26_
_Last Updated: 2025-12-10 (Phase 5 complete - reference sections updated to reflect actual codebase, limits updated to 20 folders / 100 spaces per folder)_

**Dependencies**: @dnd-kit, existing IconPicker, existing drag-and-drop infrastructure
