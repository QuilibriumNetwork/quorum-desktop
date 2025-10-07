# Server Folders - Discord-Style Grouping Feature

https://github.com/QuilibriumNetwork/quorum-desktop/issues/89

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> Optimized via feature-analyzer agent.
> Human reviewed only for UI/UX.

**Status**: Planning
**Priority**: Medium
**Complexity**: Medium
**Cross-Platform**: ✅ Must work on both desktop and mobile

---

## Overview

Implement Discord-style server folder functionality that allows users to group server icons by dragging them together in the left navigation bar. This feature enhances organization for users with many servers and provides visual grouping with folder icons.

## Current Architecture Analysis

### Existing Infrastructure
- **Navigation**: `src/components/navbar/NavMenu.tsx` with `@dnd-kit` drag-and-drop
- **Server Icons**: `src/components/navbar/SpaceButton.tsx` with sortable functionality
- **Drag Logic**: `src/hooks/business/spaces/useSpaceDragAndDrop.ts` handles reordering
- **Data Persistence**: User config stores `spaceIds: string[]` for custom ordering
- **Database**: IndexedDB via `MessageDB` class with `user_config` object store

### Current User Config Schema
```typescript
type UserConfig = {
  address: string;
  spaceIds: string[];           // Current: simple array for ordering
  timestamp?: number;
  nonRepudiable?: boolean;
  allowSync?: boolean;
  spaceKeys?: SpaceKeyConfig[];
};
```

---

## Data Architecture & Storage

### 1. Extended User Config Schema

**Schema Design**:
```typescript
type UserConfig = {
  address: string;
  spaceIds: string[];           // Keep for backward compatibility (read-only)
  folderOrder: FolderItem[];    // NEW: Single source of truth for ordering
  folders: ServerFolder[];      // NEW: Folder definitions
  timestamp?: number;
  nonRepudiable?: boolean;
  allowSync?: boolean;
  spaceKeys?: SpaceKeyConfig[];
};

type FolderItem =
  | { type: 'server'; id: string }
  | { type: 'folder'; id: string };

interface ServerFolder {
  id: string;                   // Unique folder identifier (UUID)
  name: string;                 // User-defined folder name (shows in tooltip)
  collapsed: boolean;           // Expanded/collapsed state (local-only)
  spaceIds: string[];          // Servers contained in this folder
  icon?: IconName;             // Custom folder icon (from IconPicker)
  iconColor?: IconColor;       // Folder icon color (from IconPicker)
  createdDate: number;         // Timestamp of creation
  modifiedDate: number;        // Last modification timestamp
}
```

**Data Flow Architecture**:
1. **Creation**: User drags server onto another → Create `ServerFolder` with defaults
2. **Persistence**: Use existing `saveConfig()` pattern - no new database methods
3. **Sync**: Include in existing sync payload (if `allowSync: true`)
4. **Migration**: Conversion from `spaceIds` to `folderOrder` format

### 2. Cross-Account Data Synchronization

Based on the existing sync architecture:

**Sync Strategy**:
```typescript
// Use existing sync mechanism - no new interfaces needed
// Folders included automatically in UserConfig sync payload
// Conflict resolution: timestamp-based (most recent wins)
```

**Sync Behavior**:
- **Folders**: Sync across devices if user enables sync
- **Collapsed State**: Local-only (device-specific preference)
- **Folder Names/Colors**: Synced across devices
- **Server Assignments**: Synced (which servers are in which folders)

### 3. Database Operations

**Reuse Existing Patterns**:
```typescript
// REUSE existing patterns instead of creating new methods:
const { saveConfig } = useMessageDB();

// Update folder data using existing saveConfig
await saveConfig({
  config: { ...config, folders: updatedFolders, folderOrder: newOrder },
  keyset
});
```

**Migration Strategy**:
```typescript
const migrateUserConfigToFolders = (oldConfig: UserConfig): UserConfig => {
  // Convert existing spaceIds to folderOrder format
  if (!oldConfig.folderOrder) {
    const folderOrder = oldConfig.spaceIds?.map(id => ({ type: 'server', id })) || [];
    return {
      ...oldConfig,
      folders: [],
      folderOrder
    };
  }
  return oldConfig;
};
```

---

## UI/UX Implementation

### 1. Component Architecture

**Extend Existing Components**:
```
src/components/navbar/
├── SpaceButton.tsx              # EXTEND: Add folder support with isFolder prop
├── SpaceIcon.tsx               # EXTEND: Add folder icon variants and stacking
└── FolderEditorModal.tsx       # NEW: Reuse GroupEditorModal pattern
                                 # REUSE: ConfirmationModal for delete confirmations
```

**Component Extensions**:
```typescript
// SpaceButton.tsx - EXTEND existing component
interface SpaceButtonProps {
  space: Space;
  folder?: ServerFolder;        // NEW: Optional folder data
  isFolder?: boolean;           // NEW: Render as folder
}

// SpaceIcon.tsx - EXTEND existing component
interface SpaceIconProps {
  // ... existing props
  isFolder?: boolean;           // NEW: Folder rendering mode
  folderPreviewIcons?: string[];// NEW: Server icons to show behind folder
  folderIcon?: IconName;        // NEW: Custom folder icon
  folderIconColor?: IconColor;  // NEW: Custom folder color
}

// FolderEditorModal.tsx - REUSE GroupEditorModal pattern
interface FolderEditorModalProps {
  folder: ServerFolder;
  onSave: (updates: Partial<ServerFolder>) => void;
  onClose: () => void;
}
```

### 2. Drag & Drop Logic

**EXTEND Existing Hook**: `src/hooks/business/spaces/useSpaceDragAndDrop.ts`

**Drag Logic**:
```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over) return;

  // Collision detection using @dnd-kit's built-in features
  const draggedItem = findItemById(active.id);
  const targetItem = findItemById(over.id);

  // Conditional logic for different drag scenarios
  if (draggedItem.type === 'server' && targetItem.type === 'server') {
    // Create folder with both servers
    createFolderWithServers([draggedItem.id, targetItem.id]);
  } else if (draggedItem.type === 'server' && targetItem.type === 'folder') {
    // Add server to existing folder
    addServerToFolder(draggedItem.id, targetItem.id);
  } else {
    // Reordering using existing arrayMove logic
    handleReorder(active, over);
  }
};
```

### 3. Visual Design

**Folder Icon Design**:
- **Default Folder Icon**: Use `folder` icon from existing icon set if no custom icon
- **Custom Icons**: Full IconPicker integration (50+ icons, 8 colors)
- **Stacked Server Previews**: Max 4 server icons visible behind/around folder icon
- **Notification Badges**: Aggregate count from all servers in folder
- **Tooltip Display**: Show folder name and server count on hover
- **Smooth Animations**: Expand/collapse, drag feedback, color transitions

**Drop Zone Indicators**:
- Visual feedback when dragging servers
- Highlight valid drop targets
- Show "Create Folder" preview overlay

**Mobile Considerations**:
- Touch-friendly drag handles
- Long-press to initiate drag
- Larger touch targets for folders
- Swipe gestures for folder actions

---

## Implementation Plan

### Phase 1: Data Layer
1. **Schema Extension**
   - Add `folderOrder: FolderItem[]` and `folders: ServerFolder[]` to `UserConfig`
   - Migration from existing `spaceIds` array
   - No new database methods - use existing `saveConfig` pattern

### Phase 2: Component Extensions
1. **Extend Existing Components**
   - Add folder support to `SpaceButton.tsx` (`isFolder` prop)
   - Enhance `SpaceIcon.tsx` with folder variants and stacking
   - Create `FolderEditorModal.tsx` using GroupEditorModal pattern

2. **Drag Integration**
   - Extend existing `useSpaceDragAndDrop.ts` with conditional logic
   - Leverage @dnd-kit built-ins for drag detection
   - Add folder creation and management functions
   - Integrate ConfirmationModal for folder deletion

### Phase 3: Polish & Mobile
1. **IconPicker Integration**
   - Reuse existing `IconPicker` component as-is
   - Default folder icon: `folder` from existing icon set
   - Tooltip shows folder name on hover

2. **Mobile Touch Support**
   - Use existing touch device detection logic (search codebase for touch detection patterns)
   - Implement long-press gesture for folder editing on touch devices
   - Disable tooltips on touch devices
   - Test existing drag patterns work on mobile
   - Ensure touch targets are appropriate size

---

## User Experience Design

### Interaction Patterns

**Folder Creation**:
1. User drags Server A onto Server B
2. System shows "Create Folder" overlay
3. On drop, create folder immediately with defaults:
   - Name: "Spaces"
   - Icon: `folder` from icon set
   - Color: `default` (gray)
4. Create folder containing both servers
5. Auto-expand folder to show contents
6. User can right-click (or long press if touch device) to edit name/icon/color later
7. User can drag Space icons out of the folder list, when just one Space remains in the folder, the folder is automatically deleted

**Folder Management - Desktop Devices**:
- **Edit**: Right-click folder → "Edit Folder" → Opens FolderEditorModal (For touch devices: long press folder > Opens FolderEditorModal )
  - Name editing with real-time validation
  - Icon selection using existing IconPicker component
  - Color selection using existing ColorSwatch components
  - Same UI pattern as GroupEditorModal for consistency
  - FolderEditorModal has a "Delete folder" link at the bottom, similar to what we have in GroupEditorModal. On desktop devices the user can delete the folder either via the quick "right click" option or by using the link at the bottom of FolderEditorModal. On touch devices the users can only use the link in FolderEditorModal.
- **Delete**: Right-click folder → "Delete Folder" (moves servers back to main area)
- **Expand/Collapse**: Click folder icon to toggle
- **Tooltip**: Hover over folder shows name and server count

**Folder Management - Touch devices**:
- **Edit**: Long press folder > Opens FolderEditorModal
- **Delete**: Long press folder > Opens FolderEditorModal > click link "Delete folder" in the modal > moves servers back to main area
- **Expand/Collapse**: Tap folder icon to toggle
- **Tooltip**: Tooltip disabled

**"Delete folder" option or link**:
- Opens ConfirmationModal with a message like "Are you sure you want to delete this folder? The Spaces inside it will not be deleted.", and the buttons "Confirm" and "Cancel" (the pattern is similar to other ConfirmationModal instances used for delete confirmations)

**Context Menu Actions**:
- "Edit Folder" (primary action - opens modal)
- "Delete Folder" (with confirmation)
- Separator line between actions for clarity

**Visual Feedback**:
- Smooth animations for folder operations
- Clear drop zone indicators during drag
- Server icons partially visible in collapsed folders
- Notification badges aggregate across folder contents

### Accessibility

**Keyboard Navigation**:
- Tab through folders and servers
- Space/Enter to expand/collapse
- Context menu via keyboard shortcut
- Screen reader announcements for folder states

**Screen Reader Support**:
- Announce folder contents and state
- Describe drag operations in progress
- Provide text alternatives for visual feedback

---

## Testing Strategy

### Unit Tests
- Folder data operations (create, update, delete)
- Drag operation detection logic
- Config migration functions
- Sync conflict resolution

### Integration Tests
- End-to-end folder creation workflow
- Drag and drop across different scenarios
- Cross-device sync behavior
- Mobile touch interaction patterns

### User Testing
- Usability testing for folder management
- Mobile interaction testing
- Cross-platform consistency validation
- Performance testing with many folders/servers

---

## Performance Considerations

### Optimization Strategies
- **Lazy Loading**: Only render visible folder contents
- **Virtualization**: For users with many folders/servers
- **Debounced Persistence**: Batch config updates during drag sessions
- **Efficient Re-renders**: Use React.memo for folder components

### Memory Management
- Clean up drag state on completion
- Optimize server icon caching
- Minimize re-renders during animations
- Efficient folder state updates

---

## Migration & Compatibility

### Backward Compatibility
- Existing `spaceIds` array remains functional
- Gradual migration to folder system
- Fallback rendering for non-folder-aware clients
- Server ordering preserved during migration

### Version Management
- Database version increment for folder schema
- Graceful handling of older client versions
- Migration rollback capabilities
- Schema validation and error handling

## Risk Assessment

### Technical Risks
- **Drag Complexity**: Complex drag scenarios may be error-prone
  - *Mitigation*: Comprehensive testing, gradual rollout

- **Performance Impact**: Many folders could slow UI
  - *Mitigation*: Virtualization, lazy loading, optimization

- **Sync Conflicts**: Folder sync conflicts between devices
  - *Mitigation*: Robust conflict resolution, user override options

### UX Risks
- **Learning Curve**: Users may not discover folder features
  - *Mitigation*: Progressive disclosure, helpful tutorials

- **Mobile Usability**: Touch interactions may be challenging
  - *Mitigation*: Extensive mobile testing, intuitive gestures

---

---

_Created: 2025-09-26 by Claude Code_
_Last Updated: 2025-10-04 by Claude Code_

**Dependencies**: Existing drag-and-drop infrastructure, cross-platform primitives