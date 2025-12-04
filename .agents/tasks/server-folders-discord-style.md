# Space Folders - Discord-Style Grouping Feature

https://github.com/QuilibriumNetwork/quorum-desktop/issues/89

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer and security-analyst agent

> **Status**: Planning
> **Priority**: Medium
> **Complexity**: High
> **Cross-Platform**: Must work on both desktop and mobile

---

## Overview

Implement Discord-style space folder functionality that allows users to group space icons by dragging them together in the left navigation bar. This feature enhances organization for users with many Spaces and provides visual grouping with customizable folder icons.

Quorum "Spaces" = Discord "Servers"

---

## Data Architecture

### Single-Array Schema (Simplified)

**Rationale**: A single `items` array eliminates data consistency issues between separate `folderOrder` and `folders` arrays.

```typescript
// Reuse existing IconColor type from IconPicker
// Available: 'default' | 'blue' | 'purple' | 'fuchsia' | 'green' | 'orange' | 'yellow' | 'red'
type FolderColor = IconColor;

type NavItem =
  | { type: 'space'; id: string }
  | {
      type: 'folder';
      id: string;                   // UUID
      name: string;                 // User-defined name (default: "Spaces")
      spaceIds: string[];           // Spaces in this folder (ordered)
      icon?: IconName;              // Custom icon (always rendered white, default: 'folder')
      color?: FolderColor;          // Folder background color (default: 'default' = gray #9ca3af)
      createdDate: number;
      modifiedDate: number;
    };

type UserConfig = {
  address: string;
  spaceIds?: string[];              // DEPRECATED - migration only
  items: NavItem[];                 // Single source of truth
  timestamp?: number;
  nonRepudiable?: boolean;
  allowSync?: boolean;
  spaceKeys?: SpaceKeyConfig[];
};

// Device-local preferences (NOT synced)
type DevicePreferences = {
  address: string;
  folderStates: Record<string, { collapsed: boolean }>;
};
```

**Key Design Decisions**:
- Folder data is inline within `items` array - no separate lookups needed
- `collapsed` state stored separately in device-local preferences (not synced)
- Space can only exist in ONE location (either standalone or inside exactly one folder)
- Empty folders are auto-deleted when last space is removed

### Migration Strategy

```typescript
const migrateToItems = (config: UserConfig): UserConfig => {
  // Already migrated
  if (config.items) return config;

  // Convert legacy spaceIds to items format
  const items: NavItem[] = (config.spaceIds || []).map(id => ({
    type: 'space' as const,
    id,
  }));

  return {
    ...config,
    items,
    spaceIds: undefined, // Remove deprecated field
  };
};
```

**Migration is one-way**: Once migrated, `spaceIds` is removed. No rollback needed since folder feature is additive.

---

## Validation Rules

### Folder Validation

Reuses existing validation patterns from `src/utils/validation.ts`. See `.agents/docs/features/input-validation-reference.md` for details.

```typescript
import { validateNameForXSS, MAX_NAME_LENGTH } from '@/utils/validation';

const FOLDER_VALIDATION = {
  name: {
    minLength: 1,
    maxLength: MAX_NAME_LENGTH,   // 40 chars - consistent with space/display names
    default: 'Spaces',
    trimWhitespace: true,
    xssValidation: true,          // Use validateNameForXSS()
    reservedNames: false,         // NOT needed - only for user display names
  },
  capacity: {
    minSpaces: 1,          // Auto-delete folder if empty
    maxSpaces: 50,         // Reasonable UI limit
    maxFoldersPerUser: 20,  // Prevent clutter
  },
  membership: {
    exclusive: true,        // Space can only be in ONE folder
  },
};

// Validation function
const validateFolderName = (name: string): { isValid: boolean; error?: string } => {
  const trimmed = name.trim();

  if (!trimmed) {
    return { isValid: false, error: 'Folder name cannot be empty' };
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return { isValid: false, error: `Folder name must be ${MAX_NAME_LENGTH} characters or less` };
  }

  const xssError = validateNameForXSS(trimmed);
  if (xssError) {
    return { isValid: false, error: xssError };
  }

  return { isValid: true };
};
```

### Validation Error Messages (User-Facing)

| Scenario | Error Message |
|----------|---------------|
| Blank folder name (user clears name in editor) | "Folder name cannot be empty" |
| Name too long | "Folder name must be 40 characters or less" |
| XSS attempt | "Name cannot contain HTML tags" |
| Max folders reached | "Maximum of 20 folders allowed" |
| Max Spaces in folder | "Folder can contain up to 50 spaces" |

**Notes**:
- XSS validation allows emoticons (`<3`), arrows (`->`), quotes - only blocks actual HTML tags
- No reserved name validation (only applies to user display names for anti-impersonation)
- Duplicate space membership is prevented by drag logic; `validateItems()` handles it silently as data integrity safeguard

---

## Drag & Drop State Machine

### Complete Scenario Matrix

| Drag Source | Drop Target | Action | Result |
|-------------|-------------|--------|--------|
| Space (standalone) | Space (standalone) | Create folder | New folder with both Spaces |
| Space (standalone) | Folder (collapsed) | Add to folder | Space added to folder end |
| Space (standalone) | Folder (expanded) | Add to folder | Space added to folder end |
| Space (standalone) | Root area | Reorder | Move space position in list |
| Space (in folder) | Outside folder | Remove from folder | Space becomes standalone |
| Space (in folder) | Same folder | Reorder | Change position within folder |
| Space (in folder) | Different folder | Move folder | Remove from old, add to new |
| Space (in folder) | Space (standalone) | Create folder | Remove from old folder, create new with both |
| Folder | Root area | Reorder | Change folder position in list |
| Folder | Folder | **Invalid** | No action, visual feedback |
| Folder | Space | **Invalid** | No action, visual feedback |

### Drag Handler Implementation

```typescript
// src/hooks/business/spaces/useSpaceDragAndDrop.ts

interface DragData {
  type: 'space' | 'folder';
  id: string;
  parentFolderId?: string;  // If space is inside a folder
}

const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const dragData = active.data.current as DragData;
  const dropData = over.data.current as DragData;

  // Determine scenario and execute
  const scenario = detectScenario(dragData, dropData);

  switch (scenario) {
    case 'space-to-space':
      createFolderWithSpaces(dragData.id, dropData.id);
      break;

    case 'space-to-folder':
      addSpaceToFolder(dragData.id, dropData.id);
      break;

    case 'space-out-of-folder':
      removeSpaceFromFolder(dragData.id, dragData.parentFolderId!);
      break;

    case 'space-within-folder':
      reorderWithinFolder(dragData.parentFolderId!, active.id, over.id);
      break;

    case 'space-between-folders':
      moveSpaceBetweenFolders(
        dragData.id,
        dragData.parentFolderId!,
        dropData.id
      );
      break;

    case 'folder-reorder':
      reorderItems(active.id, over.id);
      break;

    case 'invalid':
      // No action - visual feedback handled by drop indicator
      break;
  }
};
```

### Auto-Delete Empty Folders

```typescript
const removeSpaceFromFolder = (spaceId: string, folderId: string) => {
  const folder = findFolder(folderId);
  const newSpaceIds = folder.spaceIds.filter(id => id !== spaceId);

  if (newSpaceIds.length === 0) {
    // Delete empty folder, space is already standalone
    deleteFolder(folderId);
  } else if (newSpaceIds.length === 1) {
    // Auto-ungroup: delete folder, make remaining space standalone
    const remainingSpaceId = newSpaceIds[0];
    deleteFolder(folderId);
    // Space is now standalone at folder's position
  } else {
    // Update folder with remaining Spaces
    updateFolder(folderId, { spaceIds: newSpaceIds });
  }
};
```

### Drop Zone Indicators

```typescript
type DropIndicator =
  | { type: 'create-folder'; position: 'before' | 'after' }
  | { type: 'add-to-folder'; folderId: string }
  | { type: 'reorder'; position: 'before' | 'after' }
  | { type: 'invalid'; reason: string }
  | null;

// Visual states during drag
interface DragState {
  isDragging: boolean;
  draggedItem: DragData | null;
  dropIndicator: DropIndicator;
}
```

---

## Component Architecture

### New Components

```
src/components/navbar/
├── NavMenu.tsx              # MODIFY: Render mixed items array
├── SpaceButton.tsx          # MODIFY: Add size prop ('regular' | 'small')
├── FolderContainer.tsx      # NEW: Wrapper for folder (collapsed/expanded states)
├── FolderButton.tsx         # NEW: Folder icon button (white icon on colored bg)
├── FolderContextMenu.tsx    # NEW: Right-click context menu (desktop only)
└── FolderEditorModal.tsx    # NEW: Edit folder name/icon/color
```

### FolderButton Component

The folder icon button - renders white icon on colored background.
Note: Click/touch handlers are managed by parent FolderContainer using touch interaction system.

```typescript
// src/components/navbar/FolderButton.tsx

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
          backgroundColor: getColorHex(folder.color),
          borderRadius: 'var(--rounded-full)',
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          name={folder.icon || 'folder'}
          color="white"  // Always white
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

### SpaceButton Modification

```typescript
// src/components/navbar/SpaceButton.tsx

interface SpaceButtonProps {
  space: Space;
  size?: 'regular' | 'small';  // NEW: 'small' for spaces inside folders (40px vs 48px)
}
```

When `size="small"`, the space icon renders at 40px instead of 48px, but retains all functionality (selection indicator, unread indicator, notification badge).

### FolderContainer Component

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
  const unreadCount = spaces.reduce((sum, s) => sum + s.unreadCount, 0);

  // Use existing touch interaction system (see touch-interaction-system.md)
  const touchHandlers = useLongPressWithDefaults({
    delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,  // 500ms
    threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold,  // 10px
    onLongPress: () => {
      if (isTouchDevice) {
        hapticMedium();
        onEdit();  // Open FolderEditorModal
      }
    },
    onTap: onToggleExpand,
  });

  if (!isExpanded) {
    // Collapsed: just show folder icon
    return (
      <div
        {...touchHandlers}
        onContextMenu={onContextMenu}
        className={touchHandlers.className || ''}
        style={touchHandlers.style}
      >
        <FolderButton
          folder={folder}
          hasUnread={hasUnread}
          unreadCount={unreadCount}
        />
      </div>
    );
  }

  // Expanded: container with folder icon + spaces inside
  return (
    <div
      {...touchHandlers}
      onContextMenu={onContextMenu}
      className={`folder-container ${touchHandlers.className || ''}`}
      style={{
        ...touchHandlers.style,
        backgroundColor: `${getColorHex(folder.color)}80`,  // 50% opacity
        borderRadius: 'var(--rounded-lg)',
        padding: '8px 4px',
      }}
    >
      {/* Folder icon at top - tap to collapse */}
      <FolderButton
        folder={folder}
        hasUnread={hasUnread}
        unreadCount={unreadCount}
      />

      {/* Spaces inside folder */}
      <div className="folder-spaces">
        {spaces.map(space => (
          <SpaceButton
            key={space.spaceId}
            space={space}
            size="small"  // 40px instead of 48px
          />
        ))}
      </div>
    </div>
  );
};
```

### NavMenu Rendering

```typescript
// src/components/navbar/NavMenu.tsx

const NavMenu: React.FC = () => {
  const { items } = useUserConfig();
  const { folderStates, toggleFolder } = useFolderStates();
  const spaces = useSpaces();

  return (
    <DndContext {...dragHandlers}>
      <SortableContext items={getItemIds(items)}>
        {items.map((item) => {
          if (item.type === 'space') {
            const space = spaces.find(s => s.spaceId === item.id);
            if (!space) return null;
            return <SpaceButton key={item.id} space={space} />;
          }

          if (item.type === 'folder') {
            const folderSpaces = item.spaceIds
              .map(id => spaces.find(s => s.spaceId === id))
              .filter(Boolean);
            const isExpanded = folderStates[item.id]?.collapsed === false;

            return (
              <FolderContainer
                key={item.id}
                folder={item}
                spaces={folderSpaces}
                isExpanded={isExpanded}
                onToggleExpand={() => toggleFolder(item.id)}
                onContextMenu={(e) => openFolderContextMenu(item, e)}
                onEdit={() => openFolderEditor(item)}
              />
            );
          }
        })}
      </SortableContext>
    </DndContext>
  );
};
```

### FolderContextMenu

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
  folder,
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

**Delete Folder behavior**: Spaces inside the folder become standalone (ungrouped). No confirmation modal needed since it's easily reversible by re-creating the folder.

### FolderEditorModal

> ⚠️ **Must use ModalProvider system** (see `.agents/docs/features/modals.md`)
> - Triggered from NavMenu area (context menu / long-press)
> - Same pattern as ChannelEditorModal, GroupEditorModal

**Implementation steps:**

1. **Add state** to `src/hooks/business/ui/useModalState.ts`:
```typescript
folderEditor: { isOpen: boolean; folder?: NavItem & { type: 'folder' } }
```

2. **Add to ModalProvider** (`src/components/context/ModalProvider.tsx`):
```typescript
{modalState.state.folderEditor.isOpen && (
  <FolderEditorModal
    folder={modalState.state.folderEditor.folder}
    onClose={modalState.closeFolderEditor}
  />
)}
```

3. **Use**: `const { openFolderEditor } = useModals();`

**Modal content:**
- Name input (max 40 chars)
- IconPicker with `mode="background-color"` (icons always white, color = folder bg)
- Live preview: white icon on colored background
- Spacer + "Delete Folder" danger link at bottom (same pattern as ChannelEditorModal)

```typescript
// src/components/modals/FolderEditorModal.tsx

interface FolderEditorModalProps {
  folder: NavItem & { type: 'folder' };
  onClose: () => void;
}

// Modal layout:
// ┌─────────────────────────────┐
// │ Edit Folder            [X]  │
// ├─────────────────────────────┤
// │ Folder Name                 │
// │ [____________________]      │
// │                             │
// │ [icon] [color swatches]     │
// │                             │
// │         [Save Changes]      │
// │ ─────────────────────────── │
// │       Delete Folder         │  <- danger text, like ChannelEditorModal
// └─────────────────────────────┘
```

### IconPicker Mode Enhancement

Add `mode` prop to existing IconPicker component:

```typescript
// src/components/space/IconPicker/types.ts

interface IconPickerProps {
  // ... existing props
  mode?: 'icon-color' | 'background-color';  // NEW
}

// mode="icon-color" (default, current behavior):
//   - Icons rendered in selected color
//   - For channels, groups, etc.

// mode="background-color" (new):
//   - Icons always rendered white
//   - Color swatches show as background previews
//   - For folders
```

---

## Cross-Platform Interaction

### Desktop (Mouse)

| Action | Gesture | Result |
|--------|---------|--------|
| Expand/Collapse | Click folder | Toggle expanded state |
| Context menu | Right-click | Show FolderContextMenu |
| Drag folder | Click + drag | Reorder in list |
| Drag space | Click + drag | Various (see state machine) |
| Tooltip | Hover | Show folder name + count |

### Mobile (Touch)

| Action | Gesture | Result |
|--------|---------|--------|
| Expand/Collapse | Tap folder | Toggle expanded state |
| Edit folder | Long press (500ms) | Opens FolderEditorModal directly |
| Drag folder | Long press + drag | Reorder in list |
| Drag space | Long press + drag | Various (see state machine) |
| Tooltip | Disabled | N/A |

### FolderContextMenu (Desktop only)

| Option | Action |
|--------|--------|
| Folder Settings | Opens FolderEditorModal |
| Delete Folder | Ungroups spaces (makes them standalone) |

**Note**: On touch devices, long-press opens FolderEditorModal directly (which includes "Delete Folder" option at bottom, similar to ChannelEditorModal pattern).

### Touch Interaction System Integration

> ⚠️ **Leverage existing system** - See `.agents/docs/features/touch-interaction-system.md`

**Use existing hooks and constants:**

```typescript
// src/components/navbar/FolderContainer.tsx

import { useLongPressWithDefaults } from '../../hooks/useLongPress';
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';
import { hapticMedium } from '../../utils/haptic';

const FolderContainer: React.FC<FolderContainerProps> = ({
  folder,
  onToggleExpand,
  onContextMenu,
  onEdit,
}) => {
  const { isTouchDevice } = usePlatform();

  // Use existing touch interaction system
  const touchHandlers = useLongPressWithDefaults({
    delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,  // 500ms
    threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold,  // 10px
    onLongPress: () => {
      if (isTouchDevice) {
        hapticMedium();  // Haptic feedback on long-press
        onEdit();        // Open FolderEditorModal
      }
    },
    onTap: () => {
      onToggleExpand();  // Expand/collapse folder
    },
  });

  return (
    <div
      {...touchHandlers}
      onContextMenu={onContextMenu}  // Desktop right-click
      className={`folder-container ${touchHandlers.className || ''}`}
      style={touchHandlers.style}
    >
      {/* ... */}
    </div>
  );
};
```

### Drag Activation Constraints

```typescript
// src/hooks/business/spaces/useSpaceDragAndDrop.ts

const { isTouchDevice } = usePlatform();

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: isTouchDevice
      ? {
          delay: 200,        // Prevent accidental drags
          tolerance: 5,      // Allow slight movement during delay
          distance: 15,      // Higher threshold for touch
        }
      : {
          distance: 8,       // Quick activation for mouse
        },
  })
);
```

### Gesture Conflict Resolution

| Gesture | Duration | Movement | Action |
|---------|----------|----------|--------|
| Tap | < 500ms | < 10px | Expand/collapse folder |
| Long press | > 500ms | < 10px | Open FolderEditorModal (touch) |
| Drag | > 200ms | > 15px | Start drag operation |
| Scroll | any | Vertical only | Scroll list (not drag) |
| Right-click | instant | N/A | Open FolderContextMenu (desktop) |

### CSS Hover States

```scss
// Disable hover on touch devices to prevent "sticky hover"
@media (hover: hover) and (pointer: fine) {
  .folder-button:hover {
    transform: scale(1.05);
  }
}
```

---

## Sync & Conflict Resolution

### Sync Strategy

```typescript
interface SyncPayload {
  items: NavItem[];           // Synced across devices
  timestamp: number;
  // folderStates NOT included - device-local only
}
```

### Conflict Resolution Rules

| Scenario | Resolution | Rationale |
|----------|------------|-----------|
| Same folder modified on 2 devices | Most recent timestamp wins | Simple, predictable |
| Folder deleted on A, modified on B | Restore folder with B's changes | Prefer data preservation |
| Space added to folder on A, deleted on B | Space remains in folder | Prefer data preservation |
| Folder order differs | Most recent timestamp wins | Order is subjective anyway |

### Orphaned Space Handling

When a folder is deleted but contains Spaces referenced by another device:

```typescript
const resolveFolderDeletion = (
  localItems: NavItem[],
  incomingItems: NavItem[],
  deletedFolderId: string
) => {
  const localFolder = findFolder(localItems, deletedFolderId);

  if (!localFolder) {
    // Folder doesn't exist locally, deletion confirmed
    return incomingItems;
  }

  // Folder exists locally - check if Spaces need rescue
  const orphanedSpaces = localFolder.spaceIds.filter(spaceId => {
    // Space not in any incoming folder or standalone
    return !isSpaceInItems(incomingItems, spaceId);
  });

  if (orphanedSpaces.length > 0) {
    // Add orphaned Spaces as standalone at end
    return [
      ...incomingItems,
      ...orphanedSpaces.map(id => ({ type: 'space' as const, id })),
    ];
  }

  return incomingItems;
};
```

---

## Error Handling

### Error Scenarios & Recovery

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Save config fails | IndexedDB error | Show toast, retry with exponential backoff |
| Sync conflict | Timestamp comparison | Apply conflict resolution rules |
| Invalid folder data | Schema validation | Remove invalid folder, move Spaces to standalone |
| Missing space in folder | Space not found | Remove from folder's spaceIds silently |
| Circular reference | Validation check | Should never happen with single-array design |

### Validation on Load

```typescript
const validateItems = (items: NavItem[]): NavItem[] => {
  const seenSpaces = new Set<string>();
  const validItems: NavItem[] = [];

  for (const item of items) {
    if (item.type === 'space') {
      if (!seenSpaces.has(item.id)) {
        seenSpaces.add(item.id);
        validItems.push(item);
      }
      // Skip duplicate Spaces
    } else if (item.type === 'folder') {
      // Filter folder's Spaces to remove duplicates
      const uniqueSpaceIds = item.spaceIds.filter(id => {
        if (seenSpaces.has(id)) return false;
        seenSpaces.add(id);
        return true;
      });

      if (uniqueSpaceIds.length > 0) {
        validItems.push({ ...item, spaceIds: uniqueSpaceIds });
      }
      // Skip empty folders
    }
  }

  return validItems;
};
```

---

## User Experience

### Folder Creation Flow

1. User drags Space A onto Space B
2. System shows "Create Folder" overlay indicator
3. On drop:
   - Create folder with defaults:
     - `name`: "Spaces"
     - `icon`: "folder" (must add to ICON_OPTIONS if not present)
     - `color`: "default" (gray #9ca3af)
   - Add both Spaces to folder
   - Auto-expand folder
4. User can customize via context menu (desktop) or long-press (touch)

### Folder Deletion Flow

**From FolderEditorModal** (touch: long-press, desktop: context menu → Folder Settings):
1. User clicks "Delete Folder" danger link at bottom
2. Spaces become standalone (ungrouped), folder removed
3. No confirmation modal needed (easily reversible by re-creating folder)

**From FolderContextMenu** (desktop only: right-click):
1. User clicks "Delete Folder" option
2. Same behavior: spaces become standalone, folder removed

### Empty Folder Auto-Delete

When user drags last space out of folder:
1. Folder automatically deletes
2. No confirmation needed (reversible by creating new folder)
3. Toast notification: "Folder deleted" (optional, low priority)

---

## Visual Design

### Folder Icon States

| State | Visual |
|-------|--------|
| Collapsed, no unread | Folder icon (white) on colored background, 48px circle |
| Collapsed, has unread | Same + notification badge (aggregate count from all spaces) |
| Expanded | Folder container with spaces inside (see below) |
| Dragging | Folder icon with drag shadow, slight scale up |
| Drop target (valid) | Highlight border, slight scale up |
| Drop target (invalid) | Red tint or shake animation |

**Collapsed folder** (simple, like Discord):
- Just the folder icon on colored background
- No preview icons of spaces inside (simpler than Discord's stacked preview)
- Notification badge shows aggregate unread count from all contained spaces

### Expanded Folder Container (Discord-style)

When a folder is expanded, it renders as a vertical container:

```
┌─────────────────┐
│   [folder📁]    │  <- Folder icon (white on colored bg), click to collapse
│  ┌───────────┐  │
│  │  [space]  │  │  <- Smaller space icons inside
│  │  [space]  │  │
│  │  [space]  │  │
│  └───────────┘  │
└─────────────────┘
     ↑
  Container with folder color at 50% opacity
```

**Container styling:**
- Background: `folder.color` at 50% opacity
- Border radius: rounded corners (consistent with design system)
- Padding: small padding around space icons

**Folder icon (top of container):**
- White icon on solid colored background (same as collapsed state)
- Click to collapse the folder
- Shows notification badge if any space has unread

**Space icons inside folder:**
- Slightly smaller than regular space icons (e.g., 40px vs 48px)
- Same behavior as normal space icons:
  - Left accent indicator when selected
  - Left indicator for unread messages
  - Notification bubble for mention counts
- Clickable to navigate to that space
- Draggable to reorder within folder or drag out

### Folder Icon Customization

Using existing IconPicker and ColorSwatch components:
- **Icons**: 50+ icons from existing icon set (always rendered white)
- **Colors**: 8 colors from existing palette (applied to background)
- **Default**: `folder` icon, gray background

**Color Application Pattern** (consistent with UserInitials):
- Background: `color` applied as gradient (lighter top, darker bottom)
- Icon: Always white for contrast
- Matches space icons that use initials fallback

### Animation Timings

| Animation | Duration | Easing |
|-----------|----------|--------|
| Expand/collapse | 200ms | ease-out |
| Drag start | 150ms | ease-out |
| Drop settle | 200ms | spring |
| Invalid drop shake | 300ms | ease-in-out |

---

## Accessibility

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move focus through items |
| Enter/Space | Toggle folder expand/collapse |
| Arrow Up/Down | Move between items |
| Delete | Delete focused folder (with confirmation) |

### Screen Reader Announcements

| Event | Announcement |
|-------|--------------|
| Folder focused | "{name} folder, {n} spaces, {collapsed/expanded}" |
| Folder expanded | "{name} expanded, {n} spaces" |
| Folder collapsed | "{name} collapsed" |
| Drag started | "Dragging {item}, drop on another space to create folder" |
| Folder created | "Created folder with {n} spaces" |

---

## Implementation Phases

### Phase 1: Data & Core Components
1. Schema migration (spaceIds → items)
2. Device-local collapsed state storage (DevicePreferences)
3. Add `folder` icon to ICON_OPTIONS (if not present)
4. IconPicker `mode` prop enhancement (`icon-color` | `background-color`)
5. SpaceButton `size` prop (`regular` | `small`)

### Phase 2: Folder UI Components
1. FolderButton component (white icon on colored bg)
2. FolderContainer component (collapsed/expanded states)
3. Expanded folder visual design:
   - Container with folder color @ 50% opacity
   - Smaller space icons (40px) inside
   - Full space icon functionality (selection, unread, badges)
4. NavMenu integration (render mixed items array)

### Phase 3: Interactions & Modals
1. FolderContextMenu (desktop only - right-click)
2. FolderEditorModal via ModalProvider:
   - Add state to useModalState.ts
   - Add to ModalProvider.tsx
   - IconPicker with `mode="background-color"`
   - Delete Folder option at bottom
3. Touch: long-press → open FolderEditorModal directly
4. Desktop: right-click → context menu → Folder Settings / Delete

### Phase 4: Drag & Drop
1. Basic drag-and-drop (create folder, add to folder)
2. Complete drag state machine (all 10 scenarios)
3. Drop zone indicators
4. Auto-delete empty folders
5. Reorder within folders

### Phase 5: Cross-Platform & Sync
1. Touch activation constraint tuning
2. Mobile gesture conflict resolution (tap vs long-press vs drag)
3. Sync conflict resolution
4. Orphaned space handling
5. Animations and visual polish
6. i18n: Translate all UI strings (FolderContextMenu, FolderEditorModal, tooltips)
   - Note: Default folder name "Spaces" is user data, not translated

---

## Testing Strategy

### Unit Tests
- `validateItems()` - duplicate removal, empty folder removal
- `migrateToItems()` - legacy spaceIds conversion
- `detectScenario()` - all 10 drag scenarios
- Conflict resolution functions

### Integration Tests
- Create folder via drag-and-drop
- Remove space from folder
- Auto-delete empty folder
- Cross-device sync with conflicts

### Manual Testing Checklist

**Folder Creation & Structure**
- [ ] Create folder by dragging space onto space
- [ ] Add space to existing folder
- [ ] Remove space from folder (drag out)
- [ ] Reorder spaces within folder
- [ ] Reorder folders in list
- [ ] Auto-delete folder when last space removed

**Expanded Folder Visual**
- [ ] Expanded folder shows container with 50% opacity bg color
- [ ] Folder icon at top (white on solid color), click to collapse
- [ ] Space icons inside are smaller (40px vs 48px)
- [ ] Space icons retain selection indicator
- [ ] Space icons retain unread indicator
- [ ] Space icons retain notification badges

**Desktop Interactions**
- [ ] Click folder to expand/collapse
- [ ] Right-click folder → context menu appears
- [ ] Context menu: "Folder Settings" opens FolderEditorModal
- [ ] Context menu: "Delete Folder" ungroups spaces
- [ ] Hover folder → tooltip shows name

**Touch Interactions**
- [ ] Tap folder to expand/collapse
- [ ] Long-press folder → FolderEditorModal opens directly
- [ ] Long-press + drag → reorder folder
- [ ] No accidental drags during scroll

**FolderEditorModal**
- [ ] Edit folder name (max 40 chars, validation)
- [ ] Change folder icon (IconPicker with background-color mode)
- [ ] Change folder color (icons always white preview)
- [ ] Save changes persists
- [ ] Delete Folder option at bottom works

**Sync**
- [ ] Create folder on device A, appears on device B
- [ ] Edit folder on A, syncs to B
- [ ] Delete folder on A while B has it expanded

---

## Security Considerations

Reviewed by security-analyst agent. Config sync is E2E encrypted (AES-GCM + Ed448 signatures), so folder data is not visible to network observers or servers.

### Required: Schema Validation After Decrypt

**Issue**: After decrypting synced config in `ConfigService.ts`, JSON is parsed directly without validation:
```typescript
const config = JSON.parse(...) as UserConfig;  // No validation!
```

A compromised device (same user) could sync malformed folder data that crashes other devices.

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

### Required: Limit Enforcement After Sync

**Issue**: Validation limits (20 folders, 50 spaces per folder) are only enforced in UI. A compromised device could sync config with 1000 folders.

**Mitigation**: Enforce limits in `validateItems()` and call it after sync:

```typescript
const validateItems = (items: NavItem[]): NavItem[] => {
  const validItems: NavItem[] = [];
  let folderCount = 0;

  for (const item of items) {
    if (item.type === 'folder') {
      if (folderCount >= 20) continue;  // Skip excess folders
      if (item.spaceIds.length > 50) {
        item.spaceIds = item.spaceIds.slice(0, 50);  // Truncate
      }
      folderCount++;
    }
    validItems.push(item);
  }

  return validItems;
};

// In ConfigService.getConfig(), after schema validation:
config.items = validateItems(config.items ?? []);
```

### Not a Concern: Privacy Metadata

Folder structure is fully encrypted. Server only sees:
- Timestamp (when config changed)
- Encrypted blob size

This is consistent with existing config sync (spaceIds, bookmarks) - not a new leak.

---

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Drag gesture conflicts on mobile | High | High | Activation constraint tuning, testing |
| Data loss during sync | High | Low | Orphan handling, prefer preservation |
| Complex drag scenarios confuse users | Medium | Medium | Clear visual feedback, subtle animations |
| Empty folder edge cases | Medium | Medium | Auto-delete logic, validation on load |

---

_Created: 2025-09-26_
_Last Updated: 2025-12-04 (expanded folder visual design)_

**Dependencies**: @dnd-kit, existing IconPicker, existing drag-and-drop infrastructure
