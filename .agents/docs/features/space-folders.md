---
type: doc
title: Space Folders
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-12-11T00:00:00.000Z
---

# Space Folders

> **AI-Generated**: May contain errors. Verify before use.

## Overview

Space Folders is a Discord-style grouping feature that allows users to organize their spaces (chat rooms) into collapsible folders in the left navigation bar. Users can create folders by dragging one space onto another, customize folder appearance (name, icon, color), and reorder spaces within and across folders.

**Key capabilities:**
- Create folders by drag-and-drop (drag space onto space)
- Expand/collapse folders to show/hide contained spaces
- Customize folder name, icon, and background color
- Drag spaces into/out of folders
- Reorder folders and spaces within folders
- Syncs across devices with backwards compatibility

---

## Data Model

### NavItem Type

The feature introduces a discriminated union type in `src/db/messages.ts:31-42`:

```typescript
export type NavItem =
  | { type: 'space'; id: string }
  | {
      type: 'folder';
      id: string;           // crypto.randomUUID()
      name: string;         // User-defined (default: "Spaces", max 40 chars)
      spaceIds: string[];   // Ordered list of space IDs in folder
      icon?: IconName;      // Custom icon (rendered white on color bg)
      color?: FolderColor;  // Background color (reuses IconColor type)
      createdDate: number;  // Unix timestamp
      modifiedDate: number; // Unix timestamp (for sync conflict resolution)
    };
```

### UserConfig Integration

The `UserConfig` type (`src/db/messages.ts:44-72`) maintains dual fields for backwards compatibility:

```typescript
export type UserConfig = {
  address: string;
  spaceIds: string[];     // Legacy flat list - ALWAYS derived from items
  items?: NavItem[];      // Source of truth for ordering & folders
  // ... other fields
};
```

**Key invariant**: `spaceIds` is always derived from `items` using `deriveSpaceIds()`. This ensures older native apps without folder support still see all spaces.

### FolderColor Type

```typescript
// src/db/messages.ts:28
export type FolderColor = IconColor;  // Reuses existing color palette
```

---

## Component Architecture

```
NavMenu.tsx
├── DndContext (from @dnd-kit/core)
│   ├── SortableContext
│   │   ├── FolderContainer.tsx (for folder items)
│   │   │   ├── FolderButton.tsx (clickable folder icon)
│   │   │   └── SpaceButton.tsx[] (spaces inside, with parentFolderId)
│   │   └── SpaceButton.tsx (for standalone space items)
│   └── DragOverlay (floating ghost during drag)
├── FolderContextMenu.tsx (right-click menu, desktop only)
└── FolderEditorModal.tsx (via ModalProvider)
```

### Component Files

| Component | File | Purpose |
|-----------|------|---------|
| `FolderButton` | `src/components/navbar/FolderButton.tsx` | Folder icon with tooltip, unread indicator, mention badge |
| `FolderContainer` | `src/components/navbar/FolderContainer.tsx` | Wrapper handling expand/collapse, drag source, visual feedback |
| `FolderContextMenu` | `src/components/navbar/FolderContextMenu.tsx` | Desktop right-click menu with "Folder Settings" and "Delete" |
| `FolderEditorModal` | `src/components/modals/FolderEditorModal.tsx` | Modal for editing folder name, icon, and color |

### FolderButton Props

```typescript
interface FolderButtonProps {
  folder: NavItem & { type: 'folder' };
  hasUnread: boolean;        // Any space in folder has unread messages
  mentionCount?: number;     // Total mentions across all spaces
  size?: 'small' | 'regular'; // 40px or 48px
  isExpanded?: boolean;      // Hides indicators when expanded
}
```

### FolderContainer Props

```typescript
interface FolderContainerProps {
  folder: NavItem & { type: 'folder' };
  spaces: Space[];           // Resolved Space objects from folder.spaceIds
  isExpanded: boolean;
  onToggleExpand: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onEdit: () => void;        // Opens FolderEditorModal
  spaceMentionCounts?: Record<string, number>;
}
```

---

## Hook APIs

### useFolderStates

**Location**: `src/hooks/business/folders/useFolderStates.ts`

**Purpose**: Manages device-local expanded/collapsed state via localStorage. Not synced across devices.

```typescript
const {
  isExpanded,           // (folderId: string) => boolean
  toggleFolder,         // (folderId: string) => void
  setFolderState,       // (folderId: string, collapsed: boolean) => void
  cleanupDeletedFolders // (existingFolderIds: string[]) => void
} = useFolderStates();
```

**Storage key**: `'folderStates'` in localStorage

**Default behavior**: Folders are collapsed by default (`collapsed: true`).

---

### useNavItems

**Location**: `src/hooks/business/folders/useNavItems.ts`

**Purpose**: Maps `config.items` to renderable objects with resolved Space data. Handles migration from legacy format.

```typescript
interface MappedNavItem {
  item: NavItem;
  spaces?: (Space & { id: string })[];  // Only for folder items
}

const {
  navItems,    // MappedNavItem[] - ordered list ready for rendering
  allSpaces,   // (Space & { id: string })[] - flat list for counts/queries
  setNavItems  // React.Dispatch - for optimistic UI updates
} = useNavItems(spaces: Space[], config: UserConfig | undefined);
```

**Key behaviors**:
- Automatically calls `migrateToItems()` if `config.items` is undefined
- Filters out spaces that don't exist in `spaces` array (deleted spaces)
- Filters out empty folders (all spaces deleted)
- Provides `allSpaces` for computing aggregate mention counts

---

### useFolderManagement

**Location**: `src/hooks/business/folders/useFolderManagement.ts`

**Purpose**: State management for FolderEditorModal. Handles form state, validation, save, and delete.

```typescript
const {
  // State
  name: string,
  icon: IconName | undefined,
  iconColor: IconColor,
  iconVariant: IconVariant,
  isEditMode: boolean,           // true if editing existing folder
  canSave: boolean,              // false if validation fails
  validationError: string | null,
  deleteConfirmationStep: number, // 0 = normal, 1 = "click again to confirm"
  spaceCount: number,            // Number of spaces in folder

  // Handlers
  handleNameChange: (value: string) => void,
  handleIconChange: (icon, color, variant) => void,
  saveChanges: () => Promise<void>,
  handleDeleteClick: () => boolean,  // Returns true if confirmed
  deleteFolder: () => Promise<void>,
} = useFolderManagement({ folderId?: string });
```

**Validation rules**:
- Name required (cannot be empty/whitespace)
- Max 40 characters
- XSS validation (no special HTML characters)

**Delete flow**:
1. First click: `deleteConfirmationStep` becomes 1, text changes to "Click again to confirm"
2. Second click within 5s: `handleDeleteClick()` returns true, caller executes delete
3. After 5s timeout: Resets to step 0

---

### useFolderDragAndDrop

**Location**: `src/hooks/business/folders/useFolderDragAndDrop.ts`

**Purpose**: Core drag-and-drop logic for all folder operations. Handles 10 different drag scenarios.

```typescript
interface UseFolderDragAndDropProps {
  config: UserConfig | undefined;
  onFolderCreated?: (folderId: string) => void;  // Callback after folder creation
}

const {
  handleDragStart,  // (e: DragStartEvent) => void
  handleDragMove,   // (e: DragMoveEvent) => void
  handleDragEnd,    // (e: DragEndEvent) => void
  sensors,          // ReturnType<typeof useSensors>
} = useFolderDragAndDrop({ config, onFolderCreated });
```

**Usage in NavMenu**:

```typescript
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragMove={handleDragMove}
  onDragEnd={handleDragEnd}
>
  {/* ... */}
</DndContext>
```

---

### useDeleteFolder

**Location**: `src/hooks/business/folders/useDeleteFolder.ts`

**Purpose**: Deletes a folder and "spills out" its spaces as standalone items at the folder's position.

```typescript
const { deleteFolder } = useDeleteFolder();

// Usage
await deleteFolder(folderId: string);
```

**Behavior**:
- Finds folder by ID
- Converts `folder.spaceIds` to standalone `NavItem[]`
- Inserts standalone spaces at folder's index position (preserves order)
- Removes folder from items
- Optimistically updates React Query cache
- Persists to DB and syncs

---

## DragStateContext

**Location**: `src/context/DragStateContext.tsx`

The DragStateContext provides global drag state that components can read to show visual feedback during drag operations.

### Types

```typescript
// src/hooks/business/ui/useDragState.ts

interface ActiveDragItem {
  id: string;
  type: 'space' | 'folder';
}

type DropIntent = 'merge' | 'reorder-before' | 'reorder-after' | null;

interface DropTarget {
  id: string;
  type: 'space' | 'folder';
  intent: DropIntent;
  parentFolderId?: string;  // If target is inside a folder
}
```

### Context API

```typescript
interface DragStateContextType {
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  activeItem: ActiveDragItem | null;
  setActiveItem: (item: ActiveDragItem | null) => void;
  dropTarget: DropTarget | null;
  setDropTarget: (target: DropTarget | null) => void;
}
```

### Usage in Components

Components read `dropTarget` to show visual feedback:

```typescript
// In SpaceButton.tsx or FolderContainer.tsx
const { dropTarget } = useDragStateContext();

const isDropTarget = dropTarget?.id === myId;
const showWiggle = isDropTarget && dropTarget.intent === 'merge';
const showDropBefore = isDropTarget && dropTarget.intent === 'reorder-before';
const showDropAfter = isDropTarget && dropTarget.intent === 'reorder-after';
```

---

## Drag and Drop System

### Zone-Based Drop Detection

The drag system uses cursor position within the target to determine the action:

```
┌─────────────────────┐
│   Top 25%           │ → reorder-before (insert above)
├─────────────────────┤
│                     │
│   Middle 50%        │ → merge (create folder / add to folder)
│                     │
├─────────────────────┤
│   Bottom 25%        │ → reorder-after (insert below)
└─────────────────────┘
```

**Implementation** (`useFolderDragAndDrop.ts:238-250`):

```typescript
// Constants from folderUtils.ts
const DROP_ZONE_TOP_THRESHOLD = 0.25;    // Top 25% = reorder-before
const DROP_ZONE_BOTTOM_THRESHOLD = 0.75; // Bottom 25% = reorder-after

const topThreshold = overRect.top + overRect.height * DROP_ZONE_TOP_THRESHOLD;
const bottomThreshold = overRect.top + overRect.height * DROP_ZONE_BOTTOM_THRESHOLD;

let intent: DropIntent;
if (pointerCenter < topThreshold) {
  intent = 'reorder-before';
} else if (pointerCenter > bottomThreshold) {
  intent = 'reorder-after';
} else {
  intent = 'merge';
}
```

### Drag Scenarios

The `detectScenario()` function (`useFolderDragAndDrop.ts:102-187`) analyzes the drag source, target, and drop intent to determine which of 10 scenarios applies:

| Scenario | Source | Target | Intent | Result |
|----------|--------|--------|--------|--------|
| `SPACE_TO_SPACE` | Standalone | Standalone | merge | Creates new folder with both spaces |
| `SPACE_TO_FOLDER` | Standalone | Closed folder | merge | Adds space to folder |
| `SPACE_TO_FOLDER_SPACE` | Standalone | Space in folder | merge | Adds space to that folder |
| `FOLDER_SPACE_TO_FOLDER` | Space in folder A | Folder B | merge | Moves space to folder B |
| `FOLDER_SPACE_TO_SPACE` | Space in folder | Standalone | merge | Creates new folder with both |
| `SPACE_OUT_OF_FOLDER` | Space in folder | Outside | reorder | Becomes standalone at position |
| `FOLDER_REORDER` | Folder | Any | reorder | Reorders folder in list |
| `SPACE_REORDER_STANDALONE` | Standalone | Standalone | reorder | Reorders space in list |
| `SPACE_REORDER_IN_FOLDER` | Space in folder | Same folder | reorder | Reorders within folder |
| `INVALID` | Any | Invalid | - | No action |

### Visual Feedback

**Merge intent** (pulsing dashed border):
```scss
// src/components/navbar/SpaceIcon.scss
.drop-target-wiggle::after {
  content: '';
  position: absolute;
  inset: -3px;
  border: 3px dashed var(--accent);
  border-radius: $rounded-xl;
  animation: pulse-border 1s ease-in-out infinite;
}
```

**Reorder intent** (horizontal line):
```tsx
{showDropBefore && (
  <div className="flex justify-center py-1">
    <div className="w-12 h-1 bg-accent-500 rounded-full" />
  </div>
)}
```

### DragOverlay (Ghost Element)

During drag, the original item becomes invisible and a ghost copy follows the cursor:

```typescript
// NavMenu.tsx
<DragOverlay dropAnimation={dropAnimation}>
  {activeItem && (
    <div className="drag-overlay-ghost">
      {activeItem.type === 'folder' ? (
        <FolderButton folder={...} />
      ) : (
        <SpaceIcon space={...} />
      )}
    </div>
  )}
</DragOverlay>
```

```scss
// NavMenu.scss
.drag-overlay-ghost {
  opacity: 0.9;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
  transform: scale(1.05);
  cursor: grabbing;
}
```

### Touch Support

**Important**: See [Touch Interaction System](./../touch-interaction-system.md#drag-and-drop-with-long-press-dnd-kit) for full details on touch + drag-and-drop patterns.

#### Sensor Configuration

Only `PointerSensor` is used - **do not add TouchSensor** (causes race conditions):

```typescript
// src/hooks/business/folders/useFolderDragAndDrop.ts
import { TOUCH_INTERACTION_TYPES } from '../../../constants/touchInteraction';

const { dragActivationDistance, mouseActivationDistance } = TOUCH_INTERACTION_TYPES.DRAG_AND_DROP;

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: isTouchDevice()
      ? { distance: dragActivationDistance }  // 15px - no delay, allows long-press to work
      : { distance: mouseActivationDistance }, // 8px
  })
);
```

#### CSS Requirements

```scss
// Draggable elements (SpaceIcon, FolderButton)
.space-icon, .folder-button {
  touch-action: none;  // Required for iOS Safari
}

// Scrollable container
.nav-menu-spaces {
  touch-action: pan-y;  // Allow scroll, prevent pull-to-refresh
}
```

#### Long-Press on Folders (Touch Only)

Since drag uses distance-based activation (not delay), long-press is handled separately with raw touch events:

```typescript
// FolderContainer.tsx - simplified
const { threshold, delay } = TOUCH_INTERACTION_TYPES.DRAG_AND_DROP;

const handleTouchStart = (e: React.TouchEvent) => {
  touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  longPressTimer.current = setTimeout(() => {
    hapticLight();
    onEdit();  // Opens FolderEditorModal
  }, delay);  // 500ms
};

const handleTouchMove = (e: React.TouchEvent) => {
  // Cancel if moved > 15px (user wants to drag, not long-press)
  if (distance > threshold) clearLongPressTimer();
};
```

**Why this pattern?** Touch events run in parallel with pointer events (dnd-kit). The 15px threshold is shared between cancelling long-press and activating drag.

See: `.agents/reports/dnd-kit-touch-best-practices_2025-12-11.md`

---

## CSS Animation: Expand/Collapse

The expand/collapse animation uses the CSS Grid trick for animating to unknown heights:

```scss
// src/components/navbar/Folder.scss

.folder-spaces-wrapper {
  display: grid;
  grid-template-rows: 0fr;  // Collapsed: 0 fraction
  transition: grid-template-rows 300ms ease-in-out;

  .folder-container--expanded & {
    grid-template-rows: 1fr;  // Expanded: 1 fraction (full height)
  }
}

.folder-spaces {
  min-height: 0;  // Required for grid animation to work
  overflow: visible;  // Allow toggle indicators to overflow
}
```

**Why this works**: The grid fractional unit (`fr`) can animate from `0fr` to `1fr`, and the child's `min-height: 0` allows it to collapse to zero height. This is superior to `max-height` hacks because it doesn't require knowing the content height.

**Clip-path handling**: During collapse animation, `clip-path: inset(0 -100px 0 -100px)` clips vertically while allowing horizontal overflow (for toggle indicators). When expanded, `clip-path: none` allows tooltips to show.

---

## Modal Integration

### Opening FolderEditorModal

The modal is opened via the ModalProvider system:

```typescript
// NavMenu.tsx
const { openFolderEditor } = useModals();

// From context menu
const handleFolderSettings = () => {
  openFolderEditor(contextMenu.folder.id);
  closeContextMenu();
};

// From FolderContainer long-press (touch)
<FolderContainer
  onEdit={() => openFolderEditor(folder.id)}
/>
```

### Modal State Management

```typescript
// useModalState.ts
case 'OPEN_FOLDER_EDITOR':
  return {
    ...state,
    folderEditor: { isOpen: true, folderId: action.folderId },
  };
```

```typescript
// ModalProvider.tsx
{modalState.folderEditor.isOpen && (
  <FolderEditorModal
    folderId={modalState.folderEditor.folderId}
    onClose={modalState.closeFolderEditor}
  />
)}
```

---

## Data Flow: Creating a Folder

Here's the complete data flow when a user drags Space A onto Space B:

```
1. User drags Space A over Space B (center zone)
   │
   ├─► handleDragMove() detects dropIntent = 'merge'
   │   └─► setDropTarget({ id: B, intent: 'merge' })
   │       └─► SpaceButton B renders with .drop-target-wiggle
   │
2. User releases drag
   │
   ├─► handleDragEnd() fires
   │   ├─► detectScenario() returns 'SPACE_TO_SPACE'
   │   ├─► canCreateFolder() checks MAX_FOLDERS limit
   │   ├─► createFolder('Spaces', [B, A]) generates new folder
   │   ├─► Builds new items array (removes A & B, inserts folder)
   │   ├─► deriveSpaceIds(newItems) for backwards compat
   │   │
   │   ├─► Optimistic update:
   │   │   queryClient.setQueryData(buildConfigKey(...), newConfig)
   │   │   └─► NavMenu re-renders immediately with folder
   │   │
   │   └─► saveConfig() persists to IndexedDB + syncs to server
   │
3. Other devices receive sync
   │
   └─► ConfigService.getConfig() decrypts remote config
       └─► validateItems() enforces limits
           └─► Saved to local DB, UI updates
```

---

## Sync and Persistence

### Cross-Device Sync

Folders sync via the existing encrypted config sync:
- Config encrypted with AES-GCM using SHA-512 derived key from user's private key
- Signed with Ed448 for integrity verification
- Both `spaceIds` and `items` are saved for backwards compatibility

### Validation on Sync

After decrypting remote config, `validateItems()` is called (`src/services/ConfigService.ts:131-134`):

```typescript
if (config.items) {
  config.items = validateItems(config.items);
}
```

This enforces:
- Maximum 20 folders (excess silently dropped)
- Maximum 100 spaces per folder (excess truncated)
- No duplicate space IDs
- Empty folders removed

### Backwards Compatibility Matrix

| Device | Has Folder Support | Reads | Writes |
|--------|-------------------|-------|--------|
| Web app (current) | Yes | `items` | Both `items` and `spaceIds` |
| Native app (old) | No | `spaceIds` only | `spaceIds` only |
| Native app (updated) | Yes | `items` | Both |

When old native app writes `spaceIds` only, web app's `migrateToItems()` converts it back to `items` format on next read.

---

## Limits and Validation

### Enforced Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max folders | 20 | Matches Telegram Premium |
| Max spaces per folder | 100 | Matches Discord and Telegram |
| Folder name max length | 40 chars | Consistent with space names |

### Two-Layer Enforcement

1. **UI layer** (`useFolderDragAndDrop.ts`): Shows toast warning, blocks action
   ```typescript
   if (!canCreateFolder(items)) {
     showWarning(`Maximum ${MAX_FOLDERS} folders reached`);
     return;
   }
   ```

2. **Post-sync layer** (`ConfigService.ts`): Silent truncation via `validateItems()`
   - Defense against compromised devices bypassing UI

---

## Utility Functions

**Location**: `src/utils/folderUtils.ts`

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_FOLDERS` | 20 | Maximum folders per user |
| `MAX_SPACES_PER_FOLDER` | 100 | Maximum spaces per folder |
| `DROP_ZONE_TOP_THRESHOLD` | 0.25 | Top 25% of element = reorder-before |
| `DROP_ZONE_BOTTOM_THRESHOLD` | 0.75 | Bottom 25% of element = reorder-after |
| `FOLDER_MODAL_OPEN_DELAY_MS` | 100 | Delay before opening modal after folder creation |

### Functions

| Function | Purpose |
|----------|---------|
| `deriveSpaceIds(items)` | Flattens items to string[] for backwards compat |
| `validateItems(items)` | Enforces limits, removes duplicates and empty folders |
| `migrateToItems(config)` | Converts legacy spaceIds-only config to items format |
| `createFolder(name, spaceIds, icon?, color?)` | Factory function for new folder NavItem |
| `findFolderContainingSpace(items, spaceId)` | Finds parent folder for a space |
| `canCreateFolder(items)` | Checks if under MAX_FOLDERS limit |
| `canAddToFolder(folder)` | Checks if folder under MAX_SPACES_PER_FOLDER limit |

---

## Interactions Summary

### Desktop
| Action | Result |
|--------|--------|
| Click folder | Toggle expand/collapse |
| Right-click folder | Context menu |
| Drag folder | Reorder folders |
| Drag space to space center | Create folder |
| Drag space to folder | Add to folder |
| Drag space out of folder | Becomes standalone |

### Touch/Mobile
| Action | Result |
|--------|--------|
| Tap folder | Toggle expand/collapse |
| Long-press folder (500ms) | Open FolderEditorModal |
| Long-press + drag | Reorder/move operations |

---

## Error Handling

### Limit Exceeded
- UI shows warning toast: "Maximum 20 folders reached" or "Maximum 100 spaces per folder"
- Action is blocked (drag operation has no effect)

### Invalid Drop Target
- `detectScenario()` returns `'INVALID'`
- `handleDragEnd()` returns early with no action
- No error shown (silent no-op)

### Missing Data
- If `config` or `keyset` is undefined, drag operations are no-ops
- If space doesn't exist in database, it's filtered out by `useNavItems`
- Empty folders (all spaces deleted) are automatically removed

---

## Known Limitations

1. **No nested folders**: Folders cannot contain other folders (single level only)
2. **No folder sharing**: Folders are user-private, cannot be shared
3. **Sync conflicts**: Last write wins for entire `items` array (no field-level merge)
4. **Empty folders auto-delete**: A folder with no spaces is automatically removed
5. **No bulk operations**: Cannot select multiple spaces to add to folder at once
6. **No folder search**: Cannot search/filter folders by name

---

## Future Improvements

### Deferred: Advanced Sync Merge Algorithm

A sophisticated `mergeItems()` function could provide folder-level conflict resolution:

```typescript
private mergeItems(
  localItems: NavItem[],
  remoteItems: NavItem[],
  localTimestamp: number,
  remoteTimestamp: number
): NavItem[] {
  // Merge folders by ID, using most recent modifiedDate
  // Track space locations and use most recent folder assignment
  // Rescue orphaned spaces as standalone items
}
```

**Why deferred**: Current last-write-wins approach is consistent with existing config sync. Complex merge adds significant code for edge cases that rarely occur.

### Deferred: Zod Schema Validation

Adding Zod validation after decrypting synced config:

```typescript
const NavItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('space'), id: z.string() }),
  z.object({
    type: z.literal('folder'),
    id: z.string(),
    name: z.string().max(40),
    spaceIds: z.array(z.string()).max(100),
    icon: z.string().optional(),
    color: z.string().optional(),
    createdDate: z.number(),
    modifiedDate: z.number(),
  }),
]);
```

**Why deferred**: Current `validateItems()` handles critical limits. Full schema validation adds a dependency for an edge case (malformed JSON from compromised device).

---

## Related Documentation

- [Data Management Architecture Guide](../data-management-architecture-guide.md) - UserConfig and sync patterns
- [Task: Space Folders Discord-Style](../../tasks/done/space-folders-discord-style.md) - Implementation task with phase details

---
