# Channel Ordering Feature Analysis

> **AI-Generated**: May contain errors. Verify before use.

## Executive Summary

This research analyzes how channel ordering works in the Quorum ecosystem across mobile (`quorum-mobile`) and desktop (`quorum-desktop`) implementations. **Key finding**: Mobile has a Channels tab with full reordering support (in development branch, not yet in public repo). Desktop lacks this feature and uses **pinning** as a workaround for channel prioritization.

**Important**: When channel ordering is implemented, the current **channel pinning feature should be removed** - it becomes redundant and would create confusing UX with two ways to control the same thing.

## Scope & Methodology

- **Scope**: Channel ordering, reordering, and management in Space Settings across platforms
- **Methodology**: Code review of `quorum-mobile`, `quorum-desktop`, and `quorum-shared`
- **Repositories Analyzed**:
  - `quorum-desktop` (this repo) - Web + Electron app
  - `quorum-mobile` (`..\quorum-mobile`) - React Native mobile app
  - `quorum-shared` (`..\quorum-shared`) - Shared types and utilities

## Findings

### 1. Current Channel Data Structure

**File**: `quorum-shared/src/types/space.ts`

```typescript
export type Channel = {
  channelId: string;
  spaceId: string;
  channelName: string;
  channelTopic: string;
  channelKey?: string;
  createdDate: number;      // Used for default ordering
  modifiedDate: number;
  mentionCount?: number;
  mentions?: string;
  isReadOnly?: boolean;
  managerRoleIds?: string[];
  isPinned?: boolean;       // Pinning flag for ordering
  pinnedAt?: number;        // Timestamp for secondary ordering of pinned channels
  icon?: string;
  iconColor?: string;
  iconVariant?: 'outline' | 'filled';
};

export type Group = {
  groupName: string;
  channels: Channel[];      // Order is implicit in array position
  icon?: string;
  iconColor?: string;
  iconVariant?: 'outline' | 'filled';
};
```

**Key Observations**:
- **No explicit `sortOrder` or `position` field** exists for channels or groups
- Channel order is determined by:
  1. `isPinned` - pinned channels appear first
  2. `pinnedAt` - among pinned channels, newest first (descending)
  3. `createdDate` - among unpinned channels, oldest first (ascending)
- Group order is determined by array position in `Space.groups[]`

### 2. Mobile Implementation

**Files Analyzed**:
- `quorum-mobile/components/SpaceSettingsModal.tsx`
- `quorum-mobile/hooks/chat/useChannelManagement.ts`

**SpaceSettingsModal Tabs** (for owners):
| Tab | Purpose | Channel Ordering? |
|-----|---------|-------------------|
| General | Space name, description, icon, banner | No |
| Account | Profile, notifications | No |
| Members | View/manage members | No |
| Roles | Role management | No |
| Emojis | Custom emoji | No |
| Stickers | Custom stickers | No |
| Invites | Generate invite links | No |
| Danger | Delete space | No |

**Available Channel Management Hooks** (`useChannelManagement.ts`):
- `useAddChannel()` - Add channel to a group by index
- `useUpdateChannel()` - Update channel properties
- `useDeleteChannel()` - Delete a channel
- `usePinChannel()` - Pin/unpin a channel (sets `isPinned` and `pinnedAt`)
- `useAddGroup()` - Add new channel group
- `useDeleteGroup()` - Delete a channel group

**No Reorder Hooks Found**:
- No `useMoveChannel()`, `useReorderChannels()`, or similar
- No `useMoveGroup()` or `useReorderGroups()`

### 3. Desktop Implementation

**Files Analyzed**:
- `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`
- `src/components/space/ChannelGroup.tsx`
- `src/components/space/ChannelItem.tsx`

**SpaceSettingsModal Tabs** (for owners):
| Tab | Purpose | Channel Ordering? |
|-----|---------|-------------------|
| General | Space name, description, icon, banner, default channel | No |
| Account | Profile in space, notifications | No |
| Roles | Role management | No |
| Emojis | Custom emoji | No |
| Stickers | Custom stickers | No |
| Invites | Invite link generation | No |
| Danger | Delete space | No |

**Channel Ordering Logic** (implicit, not in settings):
- Channels sorted within groups automatically
- Pinned channels first, then by creation date
- No UI for explicit reordering

### 4. Pinning as the Current Ordering Mechanism

Both platforms use pinning for channel prioritization:

**Mobile** (`usePinChannel`):
```typescript
export function usePinChannel() {
  return useMutation({
    mutationFn: async (params: PinChannelParams): Promise<void> => {
      const timestamp = Date.now();
      const updatedGroups = space.groups.map(group => ({
        ...group,
        channels: group.channels.map(channel => {
          if (channel.channelId === params.channelId) {
            return {
              ...channel,
              isPinned: params.isPinned,
              pinnedAt: params.isPinned ? timestamp : undefined,
              modifiedDate: timestamp,
            };
          }
          return channel;
        }),
      }));
      // Save to storage and sync...
    },
  });
}
```

**Desktop** (Channel context menu):
- Pin/unpin via right-click context menu on channel
- Uses same `isPinned`/`pinnedAt` mechanism

### 5. Data Sync Flow

Channel ordering changes sync via the Space manifest:

1. Local update to Space object (including channel order changes)
2. Save to local storage (MMKV on mobile, IndexedDB on desktop)
3. Encrypt space manifest with config key
4. Sign with owner key
5. POST to API via `postSpaceManifest()`
6. Broadcast via WebSocket to hub for real-time sync to members

**Key Insight**: Since channel order is stored in the `Space.groups[].channels[]` array, any change to array order would automatically sync to all members via the standard Space manifest broadcast.

## Mobile Channels Tab (Development Branch)

**Note**: The mobile app has a fully functional Channels tab that is not yet in the public `quorum-mobile` repository (only 2 commits exist: `initial release` and `initial commit`). The feature exists in a development/private branch.

**Features observed in mobile Channels tab**:
- Groups listed with their channels (MAIN, BUGS, MANY CHANNELS, etc.)
- Up/down arrow buttons for reordering channels within groups
- **+ Add Group** button at top
- **+** button per group to add channels
- **Edit (pencil)** and **Delete (trash)** icons for groups
- **DEFAULT** badge on the default channel
- Channel deletion controls

This confirms the feature works and syncs correctly - it should be ported to desktop.

## Channel Pinning Deprecation

### Why Remove Pinning When Ordering is Implemented

The current channel pinning feature (`isPinned`, `pinnedAt` fields) serves as a **workaround** for lack of proper ordering:

| Current (Pinning) | New (Ordering) |
|-------------------|----------------|
| Owner pins channel → goes to top | Owner moves channel → any position |
| Binary: pinned or not | Full control: any position |
| All pinned channels clump at top | Flexible arrangement |

**Pinning becomes redundant because**:
1. Moving a channel to position 0 = "pinning" it
2. Having both creates confusing UX (two ways to do the same thing)
3. Simpler data model without `isPinned`/`pinnedAt` fields

### Migration Path

When implementing channel ordering:
1. **Deprecate** `isPinned` and `pinnedAt` fields (or remove entirely)
2. **Convert existing pinned channels**: Ensure they remain at top of their group's array
3. **Remove pin/unpin** from channel context menus on desktop
4. **Add Channels tab** to SpaceSettingsModal with full ordering controls

## Gap Analysis

### What's Missing for Full Channel Ordering

| Feature | Status | Required for Implementation |
|---------|--------|---------------------------|
| Explicit `sortOrder` field | Missing | Add to Channel/Group types in quorum-shared |
| Channel reorder UI | Missing | New tab/section in SpaceSettingsModal |
| Arrow buttons (up/down) | Missing | UI components for reordering |
| Drag-and-drop | Missing | Optional enhancement |
| `useMoveChannel` hook | Missing | Hook to update channel position |
| `useMoveGroup` hook | Missing | Hook to update group position |
| Group reordering | Missing | Same infrastructure as channel reordering |

### Implementation Options

#### Option A: Array Position-Based Ordering (Current Pattern)

Pros:
- No schema changes needed
- Already works with sync
- Simple to understand

Cons:
- Requires moving items in array (splice operations)
- Order implicit, not explicit

#### Option B: Explicit `sortOrder` Field (Recommended)

Add to `quorum-shared/src/types/space.ts`:

```typescript
export type Channel = {
  // ... existing fields
  sortOrder?: number;  // NEW: Explicit ordering (default to createdDate if missing)
};

export type Group = {
  // ... existing fields
  sortOrder?: number;  // NEW: Explicit group ordering
};
```

Pros:
- Explicit ordering semantics
- Easier to implement reordering logic
- Backwards compatible (optional field)
- Can coexist with pinning

Cons:
- Requires shared types update
- Need migration for existing data (default to createdDate)

## Recommendations

### High Priority

1. **Add `sortOrder` field to types**
   - Location: `quorum-shared/src/types/space.ts`
   - Add to both `Channel` and `Group` types
   - Make optional for backwards compatibility

2. **Create Channels tab in SpaceSettingsModal**
   - Show all groups and their channels
   - Add arrow buttons for reordering within groups
   - Add group reordering controls

3. **Create reorder hooks in desktop**
   - `useMoveChannel(spaceId, channelId, groupIndex, newPosition)`
   - `useMoveGroup(spaceId, groupIndex, newPosition)`

### Medium Priority

4. **Add channel management to Channels tab**
   - Add channel button (with group selector)
   - Add group button
   - Edit channel inline
   - Delete channel with confirmation

5. **Sync with mobile**
   - Ensure mobile implements same hooks
   - Use shared types for compatibility

### Low Priority

6. **Drag-and-drop enhancement**
   - Add drag handles to channels
   - Allow cross-group channel moving
   - Visual feedback during drag

## Action Items

- [ ] **Create task**: Implement Channels tab in desktop SpaceSettingsModal
- [ ] **Create task**: Create channel/group reordering hooks
- [ ] **Create task**: Remove channel pinning feature (context menu, fields)
- [ ] **Coordinate**: Get mobile branch with Channels tab for reference implementation
- [ ] **Migration**: Handle existing pinned channels during transition

## Related Documentation

- [quorum-shared-architecture.md](..\docs\quorum-shared-architecture.md) - Shared package architecture
- [SpaceSettingsModal.tsx](..\..\src\components\modals\SpaceSettingsModal\SpaceSettingsModal.tsx) - Current settings modal
- [useChannelManagement.ts](..\..\quorum-mobile\hooks\chat\useChannelManagement.ts) - Mobile channel hooks

---

_Created: 2026-01-07_
_Updated: 2026-01-07_
_Report Type: Research/Analysis_
