# Space Folders - Discord-Style Grouping Feature

https://github.com/QuilibriumNetwork/quorum-desktop/issues/89

> **Status**: Ready for Implementation
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

## Phase 1: Data Foundation

### 1.1 Add `folder` icon to ICON_OPTIONS
- [ ] **File**: `src/components/space/IconPicker/types.ts`
- [ ] Add to `ICON_OPTIONS` array:
  ```typescript
  { name: 'folder', tier: 1, category: 'Organization' },
  ```
- [ ] **STOP**: Run `yarn lint` or check modified files

### 1.2 Add `mode` prop to IconPicker
- [ ] **File**: `src/components/space/IconPicker/types.ts`
- [ ] Add to `IconPickerProps`:
  ```typescript
  mode?: 'icon-color' | 'background-color';  // default: 'icon-color'
  ```
- [ ] **File**: `src/components/space/IconPicker/IconPicker.web.tsx`
- [ ] When `mode="background-color"`:
  - Icons always render white
  - Color swatches show as background previews (circle with color bg, white icon inside)
- [ ] **STOP**: Run `yarn lint` or check modified files
- [ ] **STOP - VISUAL TEST**: Open any channel editor, verify IconPicker still works normally

### 1.3 Add NavItem types
- [ ] **File**: `src/api/quorumApi.ts` (near UserConfig type)
- [ ] Add types (see [Reference: Data Types](#reference-data-types)):
  ```typescript
  export type FolderColor = IconColor;

  export type NavItem =
    | { type: 'space'; id: string }
    | {
        type: 'folder';
        id: string;
        name: string;
        spaceIds: string[];
        icon?: IconName;
        color?: FolderColor;
        createdDate: number;
        modifiedDate: number;
      };
  ```
- [ ] Update `UserConfig` type:
  ```typescript
  items?: NavItem[];  // Optional during migration
  ```
- [ ] **STOP**: Run `yarn lint` or check modified files

### 1.4 Add helper functions
- [ ] **File**: `src/utils.ts` (or new `src/utils/folderUtils.ts`)
- [ ] Add `deriveSpaceIds()` function (see [Reference: Helper Functions](#reference-helper-functions))
- [ ] Add `validateItems()` function
- [ ] Add `migrateToItems()` function
- [ ] **STOP**: Run `yarn lint` or check modified files

### 1.5 Add SpaceButton `size` prop
- [ ] **File**: `src/components/navbar/SpaceButton.tsx` (or wherever SpaceButton is)
- [ ] Add prop: `size?: 'regular' | 'small'` (default: 'regular')
- [ ] When `size="small"`: render at 40px instead of 48px
- [ ] **STOP**: Run `yarn lint` or check modified files

**✅ PHASE 1 COMPLETE** - No visual changes yet, just foundation

---

## Phase 2: Folder UI Components

### 2.1 Create FolderButton component
- [ ] **New File**: `src/components/navbar/FolderButton.tsx`
- [ ] Props: `folder`, `hasUnread`, `unreadCount`
- [ ] Renders: White icon on colored background (48px circle)
- [ ] See [Reference: FolderButton Component](#reference-folderbutton-component)
- [ ] **STOP**: Run `yarn lint` or check modified files

### 2.2 Create FolderContainer component
- [ ] **New File**: `src/components/navbar/FolderContainer.tsx`
- [ ] Handles collapsed/expanded states
- [ ] Uses `useLongPressWithDefaults` from touch interaction system
- [ ] See [Reference: FolderContainer Component](#reference-foldercontainer-component)
- [ ] **STOP**: Run `yarn lint` or check modified files

### 2.3 Create folder SCSS
- [ ] **New File**: `src/components/navbar/Folder.scss`
- [ ] Styles for:
  - `.folder-button` - 48px circle with color bg
  - `.folder-container` - expanded container with 50% opacity bg
  - `.folder-spaces` - container for smaller space icons
- [ ] Use `@media (hover: hover)` for hover states
- [ ] **STOP**: Run `yarn lint` or check modified files

### 2.4 Integrate into NavMenu
- [ ] **File**: Find where spaces are rendered in navbar (likely `NavMenu.tsx` or similar)
- [ ] Add logic to read from `items` array (fall back to `spaceIds` for migration)
- [ ] Render `FolderContainer` for folder items, `SpaceButton` for space items
- [ ] **STOP**: Run `yarn lint` or check modified files
- [ ] **STOP - VISUAL TEST**:
  - Manually add a test folder to your local config (via dev tools or temp code)
  - Verify folder appears in navbar
  - Verify clicking expands/collapses
  - Verify spaces inside are smaller (40px)

**✅ PHASE 2 COMPLETE** - Folders render visually

---

## Phase 3: Interactions & Modals

### 3.1 Add FolderEditorModal state to ModalProvider
- [ ] **File**: `src/hooks/business/ui/useModalState.ts`
- [ ] Add state:
  ```typescript
  folderEditor: { isOpen: boolean; folderId?: string };
  ```
- [ ] Add actions: `OPEN_FOLDER_EDITOR`, `CLOSE_FOLDER_EDITOR`
- [ ] **File**: `src/components/context/ModalProvider.tsx`
- [ ] Add modal rendering (pattern from ChannelEditorModal)
- [ ] **STOP**: Run `yarn lint` or check modified files

### 3.2 Create FolderEditorModal
- [ ] **New File**: `src/components/modals/FolderEditorModal.tsx`
- [ ] Pattern: Follow `ChannelEditorModal.tsx`
- [ ] Contains:
  - Name input (max 40 chars)
  - IconPicker with `mode="background-color"`
  - Save button
  - Delete Folder link at bottom (danger style)
- [ ] See [Reference: FolderEditorModal](#reference-foldereditormodal)
- [ ] **STOP**: Run `yarn lint` or check modified files
- [ ] **STOP - VISUAL TEST**:
  - Trigger modal open (via temp button or dev tools)
  - Verify layout matches spec
  - Verify IconPicker shows icons in white on colored backgrounds

### 3.3 Create FolderContextMenu (desktop only)
- [ ] **New File**: `src/components/navbar/FolderContextMenu.tsx`
- [ ] Options: "Folder Settings", "Delete Folder"
- [ ] See [Reference: FolderContextMenu](#reference-foldercontextmenu)
- [ ] **STOP**: Run `yarn lint` or check modified files

### 3.4 Wire up interactions
- [ ] **File**: `src/components/navbar/FolderContainer.tsx`
- [ ] Desktop: Right-click → FolderContextMenu
- [ ] Touch: Long-press → FolderEditorModal directly
- [ ] Use `useLongPressWithDefaults` with `TOUCH_INTERACTION_TYPES.STANDARD`
- [ ] **STOP**: Run `yarn lint` or check modified files
- [ ] **STOP - VISUAL TEST**:
  - Desktop: Right-click folder → context menu appears
  - Desktop: Click "Folder Settings" → modal opens
  - Mobile (or touch simulation): Long-press → modal opens directly

**✅ PHASE 3 COMPLETE** - Folder editing works

---

## Phase 4: Drag & Drop

> ⚠️ This phase is complex. Implement incrementally and test each scenario.
>
> **Existing system**: `src/hooks/business/spaces/useSpaceDragAndDrop.ts` already handles space reordering with `@dnd-kit`. Extend this hook, don't replace it.

### 4.1 Extend existing drag hook for folders
- [ ] **File**: `src/hooks/business/spaces/useSpaceDragAndDrop.ts`
- [ ] Current: handles simple space reordering via `arrayMove`
- [ ] Extend `handleDragEnd` to detect folder scenarios (see [Reference: Drag State Machine](#reference-drag-state-machine))
- [ ] Add touch constraints to existing sensors:
  ```typescript
  // Current: { distance: 8 }
  // Add touch support:
  activationConstraint: isTouchDevice
    ? { delay: 200, tolerance: 5, distance: 15 }
    : { distance: 8 }
  ```
- [ ] **STOP**: Run `yarn lint` or check modified files

### 4.2 Implement basic folder creation
- [ ] Drag Space A onto Space B → creates folder containing both
- [ ] Test scenario: `SPACE_TO_SPACE`
- [ ] **STOP**: Run `yarn lint` or check modified files
- [ ] **STOP - VISUAL TEST**: Drag one space onto another, verify folder is created

### 4.3 Implement add to folder
- [ ] Drag Space onto Folder → adds space to folder
- [ ] Test scenario: `SPACE_TO_FOLDER`
- [ ] **STOP - VISUAL TEST**: Drag space onto folder, verify it's added

### 4.4 Implement remove from folder
- [ ] Drag Space out of folder → becomes standalone
- [ ] Test scenario: `SPACE_OUT_OF_FOLDER`
- [ ] Auto-delete folder if empty
- [ ] **STOP - VISUAL TEST**: Drag space out of folder, verify it becomes standalone

### 4.5 Implement remaining drag scenarios
- [ ] `FOLDER_REORDER` - Reorder folders in list
- [ ] `SPACE_REORDER_IN_FOLDER` - Reorder within folder
- [ ] `SPACE_REORDER_STANDALONE` - Reorder standalone spaces
- [ ] `SPACE_BETWEEN_FOLDERS` - Move space from folder A to folder B
- [ ] See [Reference: Drag State Machine](#reference-drag-state-machine) for all 10 scenarios
- [ ] **STOP - VISUAL TEST**: Test each scenario manually

### 4.6 Add visual feedback
- [ ] Drop zone indicators (highlight valid targets)
- [ ] Drag shadows
- [ ] Invalid drop feedback (shake/red tint)
- [ ] **STOP - VISUAL TEST**: Verify drag feedback looks good

**✅ PHASE 4 COMPLETE** - Full drag & drop working

---

## Phase 5: Sync & Persistence

### 5.1 Update ConfigService for items
- [ ] **File**: `src/services/ConfigService.ts`
- [ ] In `saveConfig()`: Always derive `spaceIds` from `items` before saving
- [ ] Add `deriveSpaceIds()` call
- [ ] **STOP**: Run `yarn lint` or check modified files

### 5.2 Implement mergeItems()
- [ ] **File**: `src/services/ConfigService.ts`
- [ ] Add `mergeItems()` function (see [Reference: Merge Algorithm](#reference-merge-algorithm))
- [ ] Call in `getConfig()` after decryption
- [ ] **STOP**: Run `yarn lint` or check modified files

### 5.3 Add device-local folder states
- [ ] Store collapsed/expanded state locally (not synced)
- [ ] Use localStorage or IndexedDB DevicePreferences
- [ ] Key: `folderStates: Record<folderId, { collapsed: boolean }>`
- [ ] **STOP**: Run `yarn lint` or check modified files
- [ ] **STOP - VISUAL TEST**:
  - Expand folder, refresh page → should remember state
  - This state should NOT sync to other devices

### 5.4 Test sync scenarios
- [ ] Create folder on device A → appears on device B
- [ ] Edit folder on A → syncs to B
- [ ] Delete folder on A → removed on B
- [ ] Conflict: Edit on both devices → most recent wins

**✅ PHASE 5 COMPLETE** - Sync working

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
// In src/api/quorumApi.ts

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

import { NavItem } from '../api/quorumApi';

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
      }).slice(0, 50); // Max 50 spaces per folder

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

import { Icon, Tooltip } from '../primitives';
import { getIconColorHex } from '../space/IconPicker/types';

interface FolderButtonProps {
  folder: NavItem & { type: 'folder' };
  hasUnread: boolean;
  unreadCount: number;
}

const FolderButton: React.FC<FolderButtonProps> = ({
  folder,
  hasUnread,
  unreadCount,
}) => {
  const { isTouchDevice } = usePlatform();

  return (
    <Tooltip content={folder.name} disabled={isTouchDevice}>
      <div
        className="folder-button"
        style={{
          backgroundColor: getIconColorHex(folder.color),
          borderRadius: '50%',
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          name={folder.icon || 'folder'}
          color="white"
          size="md"
        />
        {unreadCount > 0 && (
          <NotificationBadge count={unreadCount} />
        )}
      </div>
    </Tooltip>
  );
};
```

## Reference: FolderContainer Component

```typescript
// src/components/navbar/FolderContainer.tsx

import { useLongPressWithDefaults } from '../../hooks/useLongPress';
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';
import { hapticMedium } from '../../utils/haptic';

interface FolderContainerProps {
  folder: NavItem & { type: 'folder' };
  spaces: Space[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onEdit: () => void;
}

const FolderContainer: React.FC<FolderContainerProps> = ({
  folder,
  spaces,
  isExpanded,
  onToggleExpand,
  onContextMenu,
  onEdit,
}) => {
  const { isTouchDevice } = usePlatform();
  const hasUnread = spaces.some(s => s.hasUnread);
  const unreadCount = spaces.reduce((sum, s) => sum + (s.unreadCount || 0), 0);

  const touchHandlers = useLongPressWithDefaults({
    delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,
    threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold,
    onLongPress: () => {
      if (isTouchDevice) {
        hapticMedium();
        onEdit();
      }
    },
    onTap: onToggleExpand,
  });

  if (!isExpanded) {
    return (
      <div
        {...touchHandlers}
        onContextMenu={onContextMenu}
        className={touchHandlers.className || ''}
        style={touchHandlers.style}
      >
        <FolderButton folder={folder} hasUnread={hasUnread} unreadCount={unreadCount} />
      </div>
    );
  }

  return (
    <div
      {...touchHandlers}
      onContextMenu={onContextMenu}
      className={`folder-container ${touchHandlers.className || ''}`}
      style={{
        ...touchHandlers.style,
        backgroundColor: `${getIconColorHex(folder.color)}80`, // 50% opacity
        borderRadius: 'var(--rounded-lg)',
        padding: '8px 4px',
      }}
    >
      <FolderButton folder={folder} hasUnread={hasUnread} unreadCount={unreadCount} />
      <div className="folder-spaces">
        {spaces.map(space => (
          <SpaceButton key={space.spaceId} space={space} size="small" />
        ))}
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
│ [____________________]      │
│                             │
│ [icon] [color swatches]     │
│  (IconPicker mode=          │
│   "background-color")       │
│                             │
│         [Save Changes]      │
│ ─────────────────────────── │
│       Delete Folder         │  <- danger text
└─────────────────────────────┘
```

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

# Manual Testing Checklist

## Folder Creation & Structure
- [ ] Create folder by dragging space onto space
- [ ] Add space to existing folder
- [ ] Remove space from folder (drag out)
- [ ] Reorder spaces within folder
- [ ] Reorder folders in list
- [ ] Auto-delete folder when last space removed

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
_Last Updated: 2025-12-04_

**Dependencies**: @dnd-kit, existing IconPicker, existing drag-and-drop infrastructure
