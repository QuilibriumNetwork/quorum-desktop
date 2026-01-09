---
type: task
title: Implement Channel Ordering Feature
status: in-progress
complexity: high
ai_generated: true
created: 2026-01-07T00:00:00.000Z
updated: '2026-01-09'
---

# Implement Channel Ordering Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent


**Blocked By**: Need to review mobile implementation (currently in private branch) to verify hook patterns and ensure cross-platform consistency before implementation

## What & Why

Currently, space owners can only control channel order via **pinning** (binary: pinned or not, all pinned channels clump at top). This is a workaround for lack of proper ordering.

**Goal**: Implement full channel/group reordering with drag-and-drop, matching the mobile implementation. This allows owners to arrange channels in any order, making the pinning feature obsolete.

**Value**: Better UX for space organization, feature parity with mobile, cleaner data model.

## Chosen Approach: Option B (Channels Tab in SpaceSettingsModal)

**Decision**: Add a new "Channels" tab to SpaceSettingsModal for complete channel/group management with drag-and-drop reordering.

**Rationale** (from UX expert review):
1. **Design consistency** - SpaceSettingsModal already has tabs (Account, General, Roles, etc.)
2. **Mobile parity** - Mobile already has Channels tab in settings
3. **Space constraints** - Sidebar is narrow, modal has room for drag-and-drop
4. **Clear separation** - Sidebar = navigation, Settings = management
5. **Progressive disclosure** - Reordering is a power feature, doesn't need to be front-and-center

## Current Desktop UI (What Changes)

### ChannelList Sidebar - KEEP AS-IS (mostly)

Quick actions remain for convenience:

| Action | Keep? | Notes |
|--------|-------|-------|
| Click channel → Navigate | ✅ Keep | Primary purpose |
| Click group name → GroupEditorModal | ✅ Keep | Quick edit shortcut |
| `[+]` on group → Add channel | ✅ Keep | Quick add shortcut |
| Hover channel → Gear → ChannelEditorModal | ✅ Keep | Quick edit shortcut |
| `[+ Add Group]` button | ✅ Keep | Quick add shortcut |

### ChannelEditorModal - MODIFY

Remove "Pin to top" toggle (replaced by drag-and-drop ordering).

Keep everything else:
- Channel name
- Channel topic
- Channel icon & color (IconPicker)
- Read only toggle + role selector
- Delete channel

### New: Channels Tab in SpaceSettingsModal

Complete channel/group management hub with:
- **Drag-and-drop reordering** for channels within groups
- **Drag-and-drop reordering** for groups
- **Add group** button
- **Add channel** to group
- **Edit group** (name, icon) - click group name or edit icon → GroupEditorModal
- **Edit channel** - click channel name → ChannelEditorModal
- **Delete group/channel** buttons
- **Badges**: DEFAULT, 🔒 Read-only

## UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│ Space Settings                                              [X] │
├─────────────────────────────────────────────────────────────────┤
│ [Account] [General] [Channels] [Roles] [Emojis] [Stickers] ...  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Manage channel groups and channels.                            │
│  Drag to reorder.                                               │
│                                                                 │
│  [+ Add Group]                                                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ≡ MAIN                                  [✎] [+] [🗑️]    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │   ≡  # General           DEFAULT              [✎] [🗑️] │   │
│  │   ≡  # Announcements     🔒 Read-only         [✎] [🗑️] │   │
│  │   ≡  # Random                                 [✎] [🗑️] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ≡ BUGS                                  [✎] [+] [🗑️]    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │   ≡  # Web App                                [✎] [🗑️] │   │
│  │   ≡  # Mobile App                             [✎] [🗑️] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Legend**:
- `≡` - Drag handle
- `[✎]` - Edit (opens modal for full options including read-only + role selector)
- `[+]` - Add channel to this group
- `[🗑️]` - Delete (with confirmation)
- `DEFAULT` - Badge for default channel (cannot be deleted)
- `🔒 Read-only` - Badge for read-only channels

### Channel/Group Editing in Channels Tab

**Question**: Should we use modals or inline editing?

**Decision**: Use existing modals (ChannelEditorModal, GroupEditorModal)

**Reasoning**:
- Read-only channel needs role selector dropdown - requires space
- Modals already exist and work well
- Keeps Channels tab focused on organization/reordering
- Click `[✎]` or channel/group name → Opens respective modal

## Context

- **Mobile app**: Has Channels tab with arrow buttons for reordering (code in private branch, not yet reviewed)
- **Related report**: [channel-ordering-feature-analysis_2026-01-07.md](../reports/channel-ordering-feature-analysis_2026-01-07.md)
- **Note**: Pinning feature exists only on desktop, rarely used - migration is low risk

### What We Need From Mobile

Before implementing, review mobile's private branch for:
1. **Hook implementation** - How does mobile's reorder hook work? (e.g., `useMoveChannel`, `useReorderChannels`)
2. **Cross-group moves** - Does mobile support moving channels between groups? How?
3. **Edge cases** - Any special handling for default channel, empty groups, etc.?
4. **Sync validation** - Confirm `updateSpace()` with reordered arrays syncs correctly

### Speculative Design (May Adjust After Mobile Review)

The technical specifications below are based on:
- Observed mobile UI (screenshots showing arrow buttons, Channels tab)
- Desktop's existing drag-and-drop patterns (NavMenu)
- Shared types analysis (array-based ordering, no `sortOrder` field)

Once mobile code is available, compare and align implementations.

## Technical Specifications

### Data Model - No Schema Changes Needed

Order is implicit in array position - **no `sortOrder` field required**:

```typescript
Space = {
  groups: Group[]  // Array position = group order
}

Group = {
  groupName: string,
  channels: Channel[]  // Array position = channel order
}
```

All reordering operations work by modifying arrays and calling `updateSpace()`.

### Drag-and-Drop Library

**Already installed**: `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0, `@dnd-kit/modifiers` ^9.0.0

**Reference implementation**: [NavMenu.tsx](../../src/components/navbar/NavMenu.tsx) - uses same library for space/folder reordering.

### Three Drag Operations

| Operation | Implementation | Complexity |
|-----------|---------------|------------|
| **1. Reorder groups** | `arrayMove(space.groups, fromIdx, toIdx)` | Simple |
| **2. Reorder channels in group** | `arrayMove(group.channels, fromIdx, toIdx)` | Simple |
| **3. Move channel between groups** | Remove from source, insert into target | Simple |

### Implementation Pattern (from NavMenu)

```typescript
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';

// Reorder groups
const reorderGroups = (fromIndex: number, toIndex: number) => {
  const newGroups = arrayMove(space.groups, fromIndex, toIndex);
  updateSpace({ ...space, groups: newGroups });
};

// Reorder channels within a group
const reorderChannelsInGroup = (groupIndex: number, fromIdx: number, toIdx: number) => {
  const newGroups = space.groups.map((g, i) =>
    i === groupIndex
      ? { ...g, channels: arrayMove(g.channels, fromIdx, toIdx) }
      : g
  );
  updateSpace({ ...space, groups: newGroups });
};

// Move channel between groups
const moveChannelToGroup = (
  channelId: string,
  sourceGroupIdx: number,
  targetGroupIdx: number,
  targetPosition: number
) => {
  const channel = space.groups[sourceGroupIdx].channels.find(c => c.channelId === channelId);
  const newGroups = space.groups.map((g, i) => {
    if (i === sourceGroupIdx) {
      return { ...g, channels: g.channels.filter(c => c.channelId !== channelId) };
    }
    if (i === targetGroupIdx) {
      const channels = [...g.channels];
      channels.splice(targetPosition, 0, channel!);
      return { ...g, channels };
    }
    return g;
  });
  updateSpace({ ...space, groups: newGroups });
};
```

### Sync Flow (Already Works)

Changes automatically sync via existing `updateSpace()` flow:
1. Modify `Space` object (reorder arrays)
2. Call `updateSpace(modifiedSpace)`
3. Encrypts with config key, signs with owner key
4. POSTs to API via `postSpaceManifest()`
5. Broadcasts via WebSocket to all members
6. Saves locally to IndexedDB

### Reusable Patterns from NavMenu

| Pattern | File | What to Reuse |
|---------|------|---------------|
| DndContext setup | [NavMenu.tsx:550-675](../../src/components/navbar/NavMenu.tsx#L550-L675) | Sensors, collision detection, DragOverlay |
| useSortable hook | [SpaceButton.tsx:99-103](../../src/components/navbar/SpaceButton.tsx#L99-L103) | Drag handle, isDragging state |
| Drop indicators | [SpaceButton.tsx:151-155](../../src/components/navbar/SpaceButton.tsx#L151-L155) | Visual feedback lines |
| Drag overlay ghost | [NavMenu.tsx:634-674](../../src/components/navbar/NavMenu.tsx#L634-L674) | Floating preview |
| Sensor config | [useFolderDragAndDrop.ts:600-608](../../src/hooks/business/folders/useFolderDragAndDrop.ts#L600-L608) | Touch/mouse activation |

### Key Differences from NavMenu

| NavMenu | Channels Tab |
|---------|--------------|
| Creates folders from merging | No merging - just reorder |
| 10 complex drag scenarios | 3 simple scenarios |
| Persists to UserConfig | Persists to Space manifest |
| Cross-container = folders | Cross-container = groups |

### Nested Sortables Architecture

Channels Tab uses **nested SortableContexts** - groups are sortable, and channels within each group are also sortable:

```tsx
<DndContext onDragEnd={handleDragEnd} sensors={sensors} collisionDetection={closestCenter}>
  {/* Outer: Groups are sortable */}
  <SortableContext items={groups.map(g => g.groupName)}>
    {groups.map((group, groupIndex) => (
      <SortableGroup key={group.groupName} group={group} groupIndex={groupIndex}>
        {/* Inner: Channels within this group are sortable */}
        <SortableContext items={group.channels.map(c => c.channelId)}>
          {group.channels.map((channel) => (
            <SortableChannel
              key={channel.channelId}
              channel={channel}
              parentGroupIndex={groupIndex}  // Track parent for cross-group moves
            />
          ))}
        </SortableContext>
      </SortableGroup>
    ))}
  </SortableContext>
  <DragOverlay>{/* Floating preview */}</DragOverlay>
</DndContext>
```

### Drag Data for Cross-Group Detection

Each sortable item includes `data` to identify its type and parent:

```typescript
// Group item
useSortable({
  id: group.groupName,
  data: { type: 'group', groupIndex }
});

// Channel item
useSortable({
  id: channel.channelId,
  data: { type: 'channel', channelId: channel.channelId, parentGroupIndex }
});
```

In `handleDragEnd`, use this data to detect the scenario:
```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over) return;

  const activeData = active.data.current;
  const overData = over.data.current;

  if (activeData.type === 'group' && overData.type === 'group') {
    // Scenario 1: Reorder groups
    reorderGroups(activeData.groupIndex, overData.groupIndex);
  } else if (activeData.type === 'channel' && overData.type === 'channel') {
    if (activeData.parentGroupIndex === overData.parentGroupIndex) {
      // Scenario 2: Reorder within same group
      reorderChannelsInGroup(activeData.parentGroupIndex, ...);
    } else {
      // Scenario 3: Move to different group
      moveChannelToGroup(activeData.channelId, activeData.parentGroupIndex, overData.parentGroupIndex, ...);
    }
  }
};
```

### Sensor Configuration (Touch + Mouse)

```typescript
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: isTouchDevice()
      ? { delay: 100, tolerance: 5 }  // Touch: 100ms hold + 5px tolerance
      : { distance: 8 },               // Mouse: 8px movement to activate
  })
);
```

**Important**:
- Use only `PointerSensor`, not `TouchSensor` - it handles both and avoids race conditions
- Touch requires `delay` (not just `distance`) to prevent accidental drags during scroll
- Reference: [useFolderDragAndDrop.ts:600-608](../../src/hooks/business/folders/useFolderDragAndDrop.ts#L600-L608)

### Visual Feedback Components

| Element | Purpose | Implementation |
|---------|---------|----------------|
| **Drag handle** | `≡` icon to grab | Explicit handle with `{...listeners}` on handle only |
| **Drop indicator** | Horizontal line showing drop position | Conditional `<div className="drop-indicator" />` |
| **Drag ghost** | Floating preview of dragged item | `<DragOverlay>` with item preview |
| **Placeholder** | Gray box where item was | Replace item with placeholder when `isDragging` |

### Edge Cases & Validation

| Edge Case | Handling |
|-----------|----------|
| **Default channel** | Cannot be deleted, show "DEFAULT" badge, can still be moved between groups |
| **Empty group after move** | Keep empty group (user can delete manually via `[🗑️]` button), show subtle tooltip: "No channels - drag channels here or delete group" |
| **Last channel in group** | Allow moving out, group becomes empty (see above) |
| **Drop on self** | No-op, ignore |
| **Group with default channel** | Cannot delete group (existing validation in useGroupManagement) |
| **Network failure during save** | Show error toast, keep local state, allow retry via re-drag |
| **Rapid successive drags** | Debounce `updateSpace()` calls or queue operations |

### Accessibility

- **Keyboard navigation**: Consider adding arrow key support for reordering in future iteration (not required for MVP)
- **Screen readers**: Ensure drag handles have appropriate `aria-label` (e.g., "Drag to reorder channel")
- **Focus management**: Return focus to moved item after drop completes

### i18n

All user-visible strings should be wrapped for translation:
- Use `<Trans>` component or `` t`string` `` template literal
- Strings: "Manage channel groups and channels", "Drag to reorder", "DEFAULT", "Read-only", "No channels - drag channels here or delete group", etc.

### Component Structure

```
Channels.tsx
├── ChannelsTab (main component)
│   ├── DndContext + SortableContext (groups)
│   │   └── SortableGroup (per group)
│   │       ├── GroupHeader (drag handle, name, controls)
│   │       └── SortableContext (channels)
│   │           └── SortableChannel (per channel)
│   │               ├── ChannelRow (drag handle, name, badges, controls)
│   └── DragOverlay
└── useChannelReorder hook
```

Alternatively, keep it simpler with inline components in Channels.tsx and extract later if needed.

## Implementation Phases

### Phase 1: Data Layer
- [ ] Create `useChannelReorder` hook with three functions above
- [ ] Test sync works correctly with reordered arrays (manual test)

### Phase 2: Channels Tab UI
- [ ] Create `src/components/modals/SpaceSettingsModal/Channels.tsx`
- [ ] Add "Channels" tab to SpaceSettingsModal navigation (after General, before Roles)
- [ ] Implement DndContext with `closestCenter` collision detection (test with nested sortables)
- [ ] Implement draggable group list (outer SortableContext)
- [ ] Implement draggable channel list within each group (inner SortableContexts)
- [ ] Add group controls: `[✎]` edit, `[+]` add channel, `[🗑️]` delete
- [ ] Add channel controls: `[✎]` edit, `[🗑️]` delete
- [ ] Show badges: DEFAULT, 🔒 Read-only
- [ ] Wire up edit buttons to open ChannelEditorModal / GroupEditorModal
- [ ] Handle edge cases (cross-group moves, empty groups with tooltip, default channel protection)
- [ ] Test collision detection works correctly with nested sortables (may need `rectIntersection` instead of `closestCenter`)
- [ ] Wrap all user-visible strings with `<Trans>` or `` t`...` ``

### Phase 3: Cleanup (Desktop-only, low risk)
- [ ] Remove "Pin to top" toggle from ChannelEditorModal
- [ ] Remove pin/unpin from channel context menus (if any)
- [ ] Migrate existing pinned channels: On first load after update, if channel has `isPinned: true`, move to top of its group array (one-time migration)
- [ ] Remove `isPinned`/`pinnedAt` fields from Channel type (desktop-only, mobile never had this)
- [ ] Note: Pinning is rarely used, migration affects very few spaces

## Files to Create/Modify

**New Files**:
- `src/components/modals/SpaceSettingsModal/Channels.tsx`
- `src/hooks/business/spaces/useChannelReorder.ts`

**Modified Files**:
- `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` (add Channels tab)
- `src/components/modals/SpaceSettingsModal/Navigation.tsx` (add Channels to nav)
- `src/components/modals/ChannelEditorModal.tsx` (remove pin toggle)
- `src/hooks/business/spaces/useChannelManagement.ts` (add move functions)

## Verification

### Drag-and-Drop Functionality
- [ ] Channels can be reordered within a group via drag-and-drop
- [ ] Channels can be moved between groups via drag-and-drop
- [ ] Groups can be reordered via drag-and-drop
- [ ] Drop indicators show correctly during drag
- [ ] Drag ghost (overlay) follows cursor smoothly
- [ ] Touch devices: drag activates after 100ms hold (no accidental drags during scroll)

### Data & Sync
- [ ] Changes sync to other devices/members
- [ ] Rapid successive drags don't cause race conditions
- [ ] Network failure shows error toast and allows retry

### UI & UX
- [ ] Edit buttons open correct modals (ChannelEditorModal, GroupEditorModal)
- [ ] Default channel shows badge and cannot be deleted
- [ ] Read-only channels show lock badge
- [ ] Empty groups show tooltip: "No channels - drag channels here or delete group"
- [ ] Sidebar quick actions still work (add channel, edit channel, edit group)

### Migration & Cleanup
- [ ] Pinning feature removed without breaking existing spaces
- [ ] Existing pinned channels migrated to top of group

### Technical
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] All strings internationalized with `<Trans>` or `` t`...` ``
- [ ] Drag handles have `aria-label` for accessibility

## Definition of Done

- [ ] Channels tab implemented in SpaceSettingsModal
- [ ] Drag-and-drop reordering works for channels and groups
- [ ] Changes persist and sync correctly
- [ ] Channel pinning removed (desktop-only migration complete)
- [ ] Sidebar shortcuts preserved
- [ ] All verification checks pass
- [ ] No console errors

---
