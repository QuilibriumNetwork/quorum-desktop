---
type: task
title: Implement Channel Ordering Feature
status: done
complexity: medium
ai_generated: true
created: 2026-01-07T00:00:00.000Z
updated: '2026-06-24'
---

# Implement Channel Ordering Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Unblocked 2026-05-29**: Mobile public repo now contains the channel ordering implementation. Reviewed at [quorum-mobile/hooks/chat/useChannelManagement.ts:446-636](../../../quorum-mobile/hooks/chat/useChannelManagement.ts) and [quorum-mobile/components/SpaceSettingsModal.tsx:1614-1822](../../../quorum-mobile/components/SpaceSettingsModal.tsx).

## ⚠️ Findings from Investigation (2026-05-29)

Resolved before implementation:

### 1. Persistence — desktop-local via `SpaceService.updateSpace()` (revised 2026-05-29)

**Earlier framing (now superseded)**: the original task suggested following shared's `StorageAdapter` pattern (`{ storage: StorageAdapter, ... }` options shape used by shared hooks like `useChannels`). That assumed the reorder hooks would ship to shared.

**Revised approach**: see "Mutation Hooks — Desktop-local for now" section below. Desktop hooks call `SpaceService.updateSpace(modifiedSpace)` directly for persistence. No shared abstraction needed for this task. If the hooks ever consolidate into shared later, that's when the `StorageAdapter` / callback-pattern decision gets made.

### 2. Mobile's reorder mutations don't broadcast — not a blocker for this task

Mobile's `useMoveChannel` / `useReorderGroups` / `useReorderChannels` save to MMKV only — **no `broadcastSpaceUpdate` call**. Desktop's `SpaceService.updateSpace()` ([line 498](../../src/services/SpaceService.ts#L498)) does encrypt + sign + `postSpaceManifest` + `saveSpace` + invalidate.

- **Mobile today**: reorders stay local, don't sync to other devices. Mobile already has `broadcastSpaceUpdate` in `services/space/broadcastSpaceUpdate.ts` and uses it in other mutations — the reorder ones just weren't wired to it.
- **Cross-platform compatibility today**:
  - Desktop reorders → mobile sees ✅ (desktop broadcasts)
  - Mobile reorders → desktop sees ❌ (mobile doesn't broadcast, until they wire it up)

**Tracked at [mobile issue #66](https://github.com/QuilibriumNetwork/quorum-mobile/issues/66)** for the mobile dev to fix on their schedule. Not a blocker for this task — desktop ships its own reorder UI and broadcasts correctly. Mobile receives and renders desktop's reorders fine.

### 3. Collision detection — `closestCenter` (matches SpacesSidebar)

[SpacesSidebar.tsx](../../src/components/space/SpacesSidebar.tsx) uses `closestCenter` (see its `DndContext`) for nested-sortables (spaces inside folders). Copy that. No rectIntersection. (This pattern moved here from the deleted `navbar/NavMenu.tsx`.)

### 4. Drop position on group header / empty group — append to end

When a channel is dragged onto a group header or onto an empty group's body (not onto a specific channel within it), `toPosition` should be `targetGroup.channels.length` (append). This is the most predictable behavior. Document via tooltip if needed.

### 5. DragOverlay content

- **Dragging a channel**: render a simplified `ChannelRow` (icon + name + badges, no buttons). Match the SpacesSidebar overlay rendering (`SpacesSidebar.tsx` reuses `SpacesSidebarRow` inside `DragOverlay`) as a reference.
- **Dragging a group**: render `GroupHeader` (drag handle icon + group name, no buttons or expanded channels). Keep it visually distinct from a channel ghost.

### 6. Pinning feature — drop entirely, no migration

**User decision (2026-05-29)**: drop channel pinning. With drag-and-drop reordering shipping, pinning becomes redundant (two ways to put a channel at the top is confusing UX). No migration logic, no first-load conversion. Any space that has pinned channels today will see them unpinned after the update — affecting near-zero spaces in practice (desktop usage minimal, feature rarely used).

**Correction to earlier scoping (2026-05-29)**: the original task framing claimed "mobile has never had channel pinning." That's wrong — mobile DOES have a `usePinChannel` mutation at `quorum-mobile/hooks/chat/useChannelManagement.ts:250-280`, exported from the barrel at `index.ts:71`. BUT it has **zero UI callsites anywhere in mobile** (verified by grep across `origin/master`). Same Trap F pattern as mobile's `setAccentColor` (API wired but never invoked from UX). So the user-facing decision still holds — mobile users have never seen the feature — but the code-level cleanup is bigger than the task originally implied:

- **Desktop**: drop "Pin to top" toggle, drop `isPinned`/`pinnedAt` from `ChannelData`, drop pin rendering.
- **Mobile**: delete `usePinChannel` mutation from `hooks/chat/useChannelManagement.ts:250-280` AND remove the barrel re-export at `hooks/chat/index.ts:71`. This requires a small mobile PR.
- **Shared types**: `Channel.isPinned`/`pinnedAt` exist at `quorum-shared/src/types/space.ts:58-59`. These get removed. **Critical: do NOT remove `Message.isPinned`/`pinnedAt` at `quorum-shared/src/types/message.ts:297-298` — that's a completely separate feature (message pinning) that mobile uses heavily in `usePinnedMessages`, `MessageActionSheet`, `MessagesList`, `SpaceChatArea`. Different fields, same names.**

**Cross-repo sequencing required**: this is a breaking change to shared types. Per [cross-repo-workflow.md](quorum-shared-migration/cross-repo-workflow.md) Pattern A (mobile imports an affected symbol), all three repos coordinate. Order:
1. quorum-mobile PR: delete `usePinChannel` mutation + barrel re-export. Low-risk for lead to review (zero UI callsites, so no behavior change).
2. quorum-shared PR: remove `Channel.isPinned`/`pinnedAt`.
3. quorum-desktop PR: drop the pin toggle/rendering, bump shared version.

Mobile coordination is mandatory because shared's `Channel` type is referenced by mobile's `usePinChannel` even though mobile has no UI for it.

### 7. Read-only badge

Source: `Channel.isReadOnly: boolean` from shared types. Show 🔒 + "Read-only" label. Don't show which roles can post (that level of detail belongs in the channel editor modal). Mobile doesn't show this badge but desktop has more screen real estate, so it's a justified divergence.

## Cross-Platform Approach

**Desktop-local data layer for now, divergent UI layer.** After reviewing mobile and discussing trade-offs:

- **Mutation hooks → desktop-local** (`useMoveChannel`, `useReorderChannels`, `useReorderGroups`). See revised "Mutation Hooks" section below. Match mobile's API surface for forward-compatibility; do NOT ship to `quorum-shared` yet (would commit to a broadcast-DI pattern before lead-dev review).
- **Desktop UI: drag-and-drop**, reusing patterns from [SpacesSidebar.tsx](../../src/components/space/SpacesSidebar.tsx) and [useFolderDragAndDrop.ts](../../src/hooks/business/folders/useFolderDragAndDrop.ts). Better UX for mouse, discoverable, matches Discord/Slack/Notion conventions. (Pattern moved from the deleted `navbar/NavMenu`.)
- **Mobile UI: arrow buttons** (already shipped). Touch-friendly, avoids drag/scroll gesture conflicts.
- **Sync compatibility**: confirmed. Both platforms render `space.groups` and `group.channels` in array order with no `sortOrder` field. Any reordering on either side produces a new `Space` manifest that the other side renders correctly with zero changes. Cross-group moves and group reordering done on desktop will reflect on mobile automatically — mobile just lacks the UI to *initiate* those operations.

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

- **Mobile app**: Has Channels tab with chevron up/down arrow buttons for in-group reordering only. No group reordering UI, no cross-group moves UI — but the underlying `useMoveChannel` hook already supports cross-group, and `useReorderGroups` exists unused. Desktop will surface these capabilities via DnD.
- **Related report**: [channel-ordering-feature-analysis_2026-01-07.md](../reports/channel-ordering-feature-analysis_2026-01-07.md)
- **Pinning removal**: see section "6. Pinning feature — drop entirely" for the full cross-repo plan. Desktop has the UI, mobile has the mutation code but no UI, shared has the type fields. All three repos coordinate the removal.

### Mobile Implementation Reference (reviewed 2026-05-29)

**Hooks** ([quorum-mobile/hooks/chat/useChannelManagement.ts](../../../quorum-mobile/hooks/chat/useChannelManagement.ts)):

| Hook | Params | Behavior |
|------|--------|----------|
| `useMoveChannel` | `{ spaceId, channelId, fromGroupIndex, toGroupIndex, toPosition }` | Same-group reorder OR cross-group move in one mutation. Detects same-group via `fromGroupIndex === toGroupIndex`. |
| `useReorderGroups` | `{ spaceId, groupOrder: number[] }` | Index permutation array; validates uniqueness and bounds. |
| `useReorderChannels` | `{ spaceId, groupIndex, channelOrder: string[] }` | Channel ID permutation array; alternative bulk form. |

All three invalidate `['channels', spaceId]`, `['spaces', spaceId]`, `['spaces']` on success.

**UI patterns mobile uses that desktop will NOT copy**:
- Inline rename for group/channel names (input + check/cancel buttons in-row). Desktop keeps existing `ChannelEditorModal` / `GroupEditorModal` accessed via `[✎]` button — they support full options (read-only toggle, role selector, icon picker, topic) that mobile inlines piecemeal.
- Inline icon picker on tap. Desktop opens IconPicker via the editor modals.

**UI patterns mobile lacks that desktop WILL add**:
- Group reordering (DnD on group containers).
- Cross-group channel moves (DnD drop into different group).

These are valid uses of capabilities mobile shipped in the hook layer but never wired into its UI. Not a divergence.

### Sync Compatibility (confirmed)

Both platforms render `space.groups.map(...)` and `group.channels.map(...)` with no sort step or override. The synced manifest *is* the order. Any reordering done on desktop — including group reordering and cross-group moves — broadcasts via the existing `updateSpace()` flow and renders correctly on mobile. Mobile users without DnD UI can still **see** desktop-initiated reorderings.

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

**Reference implementation**: [SpacesSidebar.tsx](../../src/components/space/SpacesSidebar.tsx) - uses the same library for space/folder reordering. (The previous reference, `navbar/NavMenu.tsx`, was deleted in the new-UI shell migration; this is its successor.)

### Three Drag Operations

| Operation | Implementation | Complexity |
|-----------|---------------|------------|
| **1. Reorder groups** | `arrayMove(space.groups, fromIdx, toIdx)` | Simple |
| **2. Reorder channels in group** | `arrayMove(group.channels, fromIdx, toIdx)` | Simple |
| **3. Move channel between groups** | Remove from source, insert into target | Simple |

### Mutation Hooks — Desktop-local for now (2026-05-29 revision)

**Revised approach (2026-05-29)**: build `useMoveChannel`, `useReorderGroups`, `useReorderChannels` as **desktop-local hooks** for this task. Do NOT port them to `@quilibrium/quorum-shared` yet.

**Why desktop-local instead of shared**:
- Shipping shared hooks now would commit the codebase to a broadcast-DI pattern (callback vs adapter) before the lead-dev has weighed in on the broader question. Mobile coordinates broadcast differently than desktop, and the right shared-API shape isn't decided.
- Mobile already has its own working reorder hooks at `quorum-mobile/hooks/chat/useChannelManagement.ts:446-636`. The mobile gap is the missing `broadcastSpaceUpdate` call (tracked at [quorum-mobile issue #66](https://github.com/QuilibriumNetwork/quorum-mobile/issues/66)), NOT the absence of shared hooks.
- Per the migration roadmap's lessons (Phase 4 reclassification, Phase 4b closure): designing shared abstractions for hypothetical future shapes when the immediate use case doesn't need them is over-engineering. Ship the desktop feature; consolidate later if both platforms benefit.

**What CAN be shared today**: the pure `Space → Space` transform functions underneath the hooks (e.g. `moveChannelInSpace(space, channelId, fromGroupIndex, toGroupIndex, toPosition): Space`). These are pure math, no side effects, identical algorithm on both platforms. Same shape as the role-mutation helpers extraction scoped today (see `quorum-shared-migration/2026-05-29-migrate-role-mutation-helpers.md`). **OPTIONAL future C4 refactor**, NOT a prerequisite for this task. Skip if it adds scope.

**Desktop hook implementation**: build as React Query mutations in `src/hooks/business/channels/` calling `SpaceService.updateSpace(modifiedSpace)` for persistence (which already handles encrypt + sign + POST + broadcast + save). Match mobile's API surface for forward-compatibility:

```typescript
// Desktop-local hooks (src/hooks/business/channels/)
useMoveChannel()    // { spaceId, channelId, fromGroupIndex, toGroupIndex, toPosition }
useReorderGroups()  // { spaceId, groupOrder: number[] }
useReorderChannels()// { spaceId, groupIndex, channelOrder: string[] }
```

The API shape mirrors mobile's so that if the hooks ever consolidate into shared later (with a `saveSpace` callback), the consumer call sites won't change.

**Mobile**: NOT touched by this task. Mobile already has these hooks (local-only persistence). The mobile broadcast gap is tracked in issue #66 and gets fixed on the mobile dev's schedule.

**Desktop UI computes the params, hook does the mutation**. Example for the DnD `handleDragEnd`:

```typescript
// Reorder groups via index permutation
const newOrder = arrayMove(
  space.groups.map((_, i) => i),
  fromIndex,
  toIndex
);
reorderGroupsMutation.mutate({ spaceId, groupOrder: newOrder });

// Reorder channels within a group via ID permutation
const newOrder = arrayMove(
  group.channels.map(c => c.channelId),
  fromIdx,
  toIdx
);
reorderChannelsMutation.mutate({ spaceId, groupIndex, channelOrder: newOrder });

// Cross-group move
moveChannelMutation.mutate({
  spaceId,
  channelId: activeData.channelId,
  fromGroupIndex: activeData.parentGroupIndex,
  toGroupIndex: overData.parentGroupIndex,
  toPosition: overData.targetPosition,
});
```

### Sync Flow (desktop's path works end-to-end)

Desktop reorder → mobile sees the change:

1. Desktop UI computes new `Space` object (reorder arrays via `arrayMove`)
2. Desktop hook calls `SpaceService.updateSpace(modifiedSpace)`
3. `SpaceService` encrypts with config key, signs with owner key
4. POSTs to API via `postSpaceManifest()`
5. Broadcasts via WebSocket to all members
6. Saves locally to IndexedDB
7. Mobile receives WS notification, refetches `Space`, re-renders with new order ✅

**Reverse direction (mobile reorder → desktop sees)**: not yet — mobile's reorder mutations save to MMKV but don't call `broadcastSpaceUpdate`. Tracked at [mobile issue #66](https://github.com/QuilibriumNetwork/quorum-mobile/issues/66). Not a blocker for this task — desktop ships, mobile catches up on their schedule.

**Cross-platform render confirmation**: both platforms render `space.groups.map(...)` and `group.channels.map(...)` with no sort step. Manifest order = display order.

**Concurrency note**: the manifest model is last-write-wins. Same as existing add/delete operations — no new concurrency surface introduced.

### SpacesSidebar Reuse Guidance — Reference, Don't Subclass

> Historical note: the references in this section originally pointed at the deleted `navbar/NavMenu` / `navbar/SpaceButton` tree. The successor — `SpacesSidebar` + `SpacesSidebarRow` + `SpacesSidebarFolder` — is a fork of that tree with the same DnD wiring, so the guidance below still applies, just against the new component paths.

The SpacesSidebar is the most complex DnD surface in the codebase. **Channels reordering is a strict subset** — same library, simpler rules. Treat SpacesSidebar as a paved-road reference, not a base to extend. Resist inheriting complexity that doesn't apply.

**Directly reusable (copy as-is)**:

| Pattern | Source | Action |
|---------|--------|--------|
| Sensor config | [useFolderDragAndDrop.ts](../../src/hooks/business/folders/useFolderDragAndDrop.ts) (`sensors` export) | Drop in unchanged. `PointerSensor` only (no separate `TouchSensor` — avoids race conditions). Touch: `delay: 100, tolerance: 5`. Mouse: `distance: 8`. |
| Drop indicator styling | [SpacesSidebarRow.tsx](../../src/components/space/SpacesSidebarRow.tsx) (`spaces-sidebar__row-drop-indicator` block at the bottom of the component) | Reuse the same visual language so it feels consistent. |
| DragOverlay portal pattern | [SpacesSidebar.tsx](../../src/components/space/SpacesSidebar.tsx) (`<DragOverlay>` inside `DndContext`) | Copy structure for floating preview. |
| `useSortable` wiring shape | [SpacesSidebarRow.tsx](../../src/components/space/SpacesSidebarRow.tsx) (the `useSortable` call at the top of the component) | Reuse the *pattern* (attributes, listeners, isDragging) — write fresh components. |

**Pattern-reusable, rewrite cleaner**:

- `handleDragEnd` logic — SpacesSidebar's `useFolderDragAndDrop` has ~10 branches because of folder creation on merge. Channels has **3**: group↔group, channel↔channel-same-group, channel↔channel-cross-group. Write fresh; don't fork that switch.
- Hook orchestration — `useFolderDragAndDrop` persists to UserConfig; channels persists to Space manifest. Similar shape, different persistence call.

**Not reusable**: SpacesSidebarRow / SpacesSidebarFolder components themselves (wrong domain), folder-creation-on-merge logic (not applicable).

**Red flag during implementation**: if you're porting SpacesSidebar code and not deleting half of it, stop and rewrite. Channels should end up noticeably simpler than the spaces sidebar.

### Key Differences from SpacesSidebar

| SpacesSidebar | Channels Tab |
|---------------|--------------|
| Creates folders from merging | No merging — just reorder |
| ~10 complex drag scenarios | 3 simple scenarios |
| Persists to UserConfig (local) | Persists to Space manifest (broadcast) |
| Cross-container = create folders | Cross-container = move channel to other group |

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

### Phase 1: Data Layer (desktop-local)
- [ ] Reference mobile's mutation logic at [quorum-mobile/hooks/chat/useChannelManagement.ts:446-636](../../../quorum-mobile/hooks/chat/useChannelManagement.ts#L446-L636) — adapt the same algorithm but for desktop's persistence path
- [ ] Create `src/hooks/business/channels/useMoveChannel.ts` (React Query mutation)
- [ ] Create `src/hooks/business/channels/useReorderGroups.ts`
- [ ] Create `src/hooks/business/channels/useReorderChannels.ts`
- [ ] Each calls `SpaceService.updateSpace(modifiedSpace)` for persistence (already handles encrypt + sign + POST + broadcast + save)
- [ ] Use the same param shapes as mobile (see "Mutation Hooks" section above) for forward-compatibility
- [ ] Manual sync test: reorder on desktop → confirm mobile updates (desktop's broadcast → mobile's WebSocket receive → mobile re-renders new order)

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

### Phase 3: Pin Feature Removal (cross-repo)

See section "6. Pinning feature — drop entirely, no migration" above for the full plan and sequencing. Summary checklist:

**Step 1 — quorum-mobile PR (first):**
- [ ] Delete `usePinChannel` mutation from `hooks/chat/useChannelManagement.ts:250-280`
- [ ] Remove barrel re-export at `hooks/chat/index.ts:71`
- [ ] Verify zero callers remain via grep
- [ ] Open mobile PR for lead review (low-risk: zero UI callsites, no behavior change for users)

**Step 2 — quorum-shared PR (after mobile merges):**
- [ ] Remove `Channel.isPinned` / `Channel.pinnedAt` from `src/types/space.ts:58-59`
- [ ] **Do NOT touch** `Message.isPinned` / `Message.pinnedAt` at `src/types/message.ts:297-298` (separate feature, mobile uses heavily)
- [ ] Publish new shared version

**Step 3 — quorum-desktop PR (after shared merges):**
- [ ] Bump shared dependency to new version
- [ ] Remove "Pin to top" toggle from [ChannelEditorModal.tsx:137-142](../../src/components/modals/ChannelEditorModal.tsx#L137-L142)
- [ ] Remove `isPinned` / `pinnedAt` from `ChannelData` interface in [useChannelManagement.ts](../../src/hooks/business/channels/useChannelManagement.ts)
- [ ] Remove pin-related rendering in [ChannelItem.tsx](../../src/components/space/ChannelItem.tsx), [ChannelGroup.tsx](../../src/components/space/ChannelGroup.tsx) (if any sorts/filters by pinned)
- [ ] No migration logic — pinned channels simply lose their pinned status. Decision (2026-05-29): near-zero affected spaces. Document in changelog.

## Files to Create/Modify

**New Files (desktop)**:
- `src/components/modals/SpaceSettingsModal/Channels.tsx`
- `src/hooks/business/channels/useMoveChannel.ts`
- `src/hooks/business/channels/useReorderGroups.ts`
- `src/hooks/business/channels/useReorderChannels.ts`

**Modified Files (desktop)**:
- `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` (add Channels tab case)
- `src/components/modals/SpaceSettingsModal/Navigation.tsx` (add Channels nav entry, between General and Roles)
- `src/components/modals/SpaceSettingsModal/index.ts` (export Channels)
- `src/components/modals/ChannelEditorModal.tsx` (remove pin toggle at [line 137-142](../../src/components/modals/ChannelEditorModal.tsx#L137-L142))
- `src/hooks/business/channels/useChannelManagement.ts` (remove `isPinned` / `pinnedAt` from `ChannelData`)
- `package.json` (bump `@quilibrium/quorum-shared` version after the pin removal merges)

**Modified Files (`quorum-shared`)** — pin removal only:
- `src/types/space.ts` (remove `Channel.isPinned` and `Channel.pinnedAt` at lines 58-59)

**Modified Files (`quorum-mobile`)** — pin removal only:
- `hooks/chat/useChannelManagement.ts` (delete `usePinChannel` mutation at lines 250-280)
- `hooks/chat/index.ts` (remove barrel re-export at line 71)

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

### Pin Feature Cross-Repo Removal
- [ ] Mobile PR: `usePinChannel` mutation + barrel re-export deleted
- [ ] Shared PR: `Channel.isPinned`/`pinnedAt` removed (kept `Message.isPinned`/`pinnedAt`)
- [ ] Desktop PR: pin toggle/rendering removed, shared version bumped
- [ ] Pinning UX removed without breaking existing spaces (pinned channels lose pinned status, no migration)

### Technical
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] All strings internationalized with `<Trans>` or `` t`...` ``
- [ ] Drag handles have `aria-label` for accessibility

## Definition of Done

- [ ] Channels tab implemented in SpaceSettingsModal
- [ ] Drag-and-drop reordering works for channels and groups
- [ ] Changes persist and sync correctly
- [ ] Channel pinning removed across mobile + shared + desktop (cross-repo PRs merged in order)
- [ ] Sidebar shortcuts preserved
- [ ] All verification checks pass
- [ ] No console errors

---
