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
type NavItem =
  | { type: 'space'; id: string }
  | {
      type: 'folder';
      id: string;                   // UUID
      name: string;                 // User-defined name (default: "Spaces")
      spaceIds: string[];           // Spaces in this folder (ordered)
      icon?: IconName;              // Custom icon from IconPicker
      iconColor?: IconColor;        // Custom color from IconPicker
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
├── SpaceButton.tsx          # KEEP: Space-only, add isInFolder prop
├── FolderButton.tsx         # NEW: Folder rendering with expand/collapse
├── FolderChildren.tsx       # NEW: Renders Spaces within expanded folder
└── FolderEditorModal.tsx    # NEW: Edit folder name/icon/color
```

### FolderButton Component

```typescript
// src/components/navbar/FolderButton.tsx

interface FolderButtonProps {
  folder: NavItem & { type: 'folder' };
  spaces: Space[];              // Resolved spaces in this folder
  isExpanded: boolean;
  hasUnread: boolean;           // Aggregate from contained spaces
  unreadCount: number;          // Aggregate notification count
  onToggleExpand: () => void;
  onEdit: () => void;
  onDragStart: () => void;
}

const FolderButton: React.FC<FolderButtonProps> = ({
  folder,
  spaces,
  isExpanded,
  hasUnread,
  unreadCount,
  onToggleExpand,
  onEdit,
}) => {
  const { isTouchDevice } = usePlatform();

  // Long press for edit on both touch AND desktop
  const longPressHandlers = useLongPress({
    onLongPress: onEdit,
    delay: 500,
  });

  return (
    <Tooltip content={`${folder.name} (${spaces.length})`} disabled={isTouchDevice}>
      <Pressable
        onClick={onToggleExpand}
        {...longPressHandlers}
        style={styles.folderButton}
      >
        <FolderIcon
          icon={folder.icon}
          iconColor={folder.iconColor}
          previewIcons={spaces.slice(0, 4).map(s => s.icon)}
          isExpanded={isExpanded}
        />
        {unreadCount > 0 && (
          <NotificationBadge count={unreadCount} />
        )}
      </Pressable>
    </Tooltip>
  );
};
```

### SpaceButton Modification

```typescript
// src/components/navbar/SpaceButton.tsx

interface SpaceButtonProps {
  space: Space;
  isInFolder?: boolean;  // NEW: Adjusts styling/indentation
}
```

Minimal change - just add optional `isInFolder` prop for visual styling.

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
              <React.Fragment key={item.id}>
                <FolderButton
                  folder={item}
                  spaces={folderSpaces}
                  isExpanded={isExpanded}
                  hasUnread={folderSpaces.some(s => s.hasUnread)}
                  unreadCount={folderSpaces.reduce((sum, s) => sum + s.unreadCount, 0)}
                  onToggleExpand={() => toggleFolder(item.id)}
                  onEdit={() => openFolderEditor(item)}
                />
                {isExpanded && (
                  <FolderChildren folderId={item.id}>
                    {folderSpaces.map(space => (
                      <SpaceButton
                        key={space.spaceId}
                        space={space}
                        isInFolder
                      />
                    ))}
                  </FolderChildren>
                )}
              </React.Fragment>
            );
          }
        })}
      </SortableContext>
    </DndContext>
  );
};
```

### FolderEditorModal

Reuse `GroupEditorModal` pattern with:
- Name input (max 32 chars)
- IconPicker integration (50+ icons)
- ColorSwatch integration (8 colors)
- "Delete Folder" link at bottom (opens ConfirmationModal)

```typescript
// src/components/modals/FolderEditorModal.tsx

interface FolderEditorModalProps {
  folder: NavItem & { type: 'folder' };
  onSave: (updates: Partial<NavItem>) => void;
  onDelete: () => void;
  onClose: () => void;
}
```

---

## Cross-Platform Interaction

### Desktop (Mouse)

| Action | Gesture | Result |
|--------|---------|--------|
| Expand/Collapse | Click folder | Toggle expanded state |
| Edit folder | Long press (500ms) | Open FolderEditorModal |
| Drag folder | Click + drag | Reorder in list |
| Drag space | Click + drag | Various (see state machine) |
| Tooltip | Hover | Show folder name + count |

### Mobile (Touch)

| Action | Gesture | Result |
|--------|---------|--------|
| Expand/Collapse | Tap folder | Toggle expanded state |
| Edit folder | Long press (500ms) | Open FolderEditorModal |
| Drag folder | Long press + drag | Reorder in list |
| Drag space | Long press + drag | Various (see state machine) |
| Tooltip | Disabled | N/A |

### Touch Activation Constraints

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
| Tap | < 200ms | < 5px | Expand/collapse folder |
| Long press | > 500ms | < 5px | Open editor modal |
| Drag | > 200ms | > 15px | Start drag operation |
| Scroll | any | Vertical only | Scroll list (not drag) |

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
   - Create folder with defaults: name="Spaces", icon=`folder`, color=default
   - Add both Spaces to folder
   - Auto-expand folder
4. User can long-press to customize name/icon/color later

### Folder Deletion Flow

1. User opens FolderEditorModal (via long press)
2. User clicks "Delete Folder" link at bottom
3. ConfirmationModal appears:
   - Title: "Delete Folder"
   - Message: "The spaces inside will be moved out of the folder."
   - Buttons: "Cancel" | "Delete"
4. On confirm: Spaces become standalone, folder removed

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
| Collapsed, no unread | Folder icon with 4 space preview icons behind |
| Collapsed, has unread | Folder icon + notification badge (aggregate count) |
| Expanded | Folder icon with "open" style, children visible below |
| Dragging | Folder icon with drag shadow |
| Drop target (valid) | Highlight border, slight scale up |
| Drop target (invalid) | Red tint or shake animation |

### Folder Icon Customization

Using existing IconPicker and ColorSwatch components:
- **Icons**: 50+ icons from existing icon set
- **Colors**: 8 colors from existing palette
- **Default**: `folder` icon, gray color

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

### Phase 1: Core Functionality
1. Schema migration (spaceIds → items)
2. FolderButton component with expand/collapse
3. Basic drag-and-drop (create folder, add to folder)
4. Device-local collapsed state storage

### Phase 2: Full Drag Support
1. Complete drag state machine (all 10 scenarios)
2. Drop zone indicators
3. Auto-delete empty folders
4. Reorder within folders

### Phase 3: Customization & Polish
1. FolderEditorModal with IconPicker integration
2. Icon and color customization (50+ icons, 8 colors)
3. Folder deletion flow
4. Animations and visual polish

### Phase 4: Cross-Platform & Sync
1. Touch activation constraint tuning
2. Mobile gesture conflict resolution
3. Sync conflict resolution
4. Orphaned space handling

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
- [ ] Create folder by dragging space onto space
- [ ] Add space to existing folder
- [ ] Remove space from folder (drag out)
- [ ] Reorder Spaces within folder
- [ ] Reorder folders in list
- [ ] Expand/collapse folder
- [ ] Edit folder name/icon/color
- [ ] Delete folder, verify Spaces restored
- [ ] Mobile: long-press to edit
- [ ] Mobile: drag without triggering scroll
- [ ] Sync: create folder on device A, verify on device B
- [ ] Sync: delete folder on A while B has it expanded

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
    iconColor: z.string().optional(),
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
_Last Updated: 2025-12-03_

**Dependencies**: @dnd-kit, existing IconPicker, existing drag-and-drop infrastructure
