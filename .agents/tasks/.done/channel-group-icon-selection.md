# Channel & Group Icon Selection Feature

**Status:** Pending
**Priority:** Medium
**Estimated Effort:** 2-3 days
**Created:** 2025-01-14

## Overview

Add icon selection functionality to GroupEditor and ChannelEditor components, allowing users to choose custom icons for visual differentiation of channels and groups.

## Requirements

### UI/UX Design
- **Icon Selection UI:** Text label "Channel Icon" / "Group Icon" on left, icon-only button on right
- **Button Behavior:**
  - Shows currently selected icon or empty for groups (no default)
  - Channels default to current logic (`hashtag` for normal, `lock` for read-only)
  - Button variant: `subtle`
  - Clicking opens dropdown with icon grid
- **Placement:** Below name/topic fields in both editors
- **Optional Selection:** Icon selection is always optional

### Technical Requirements
- Use existing `Select` primitive for dropdown
- **Investigation needed:** Verify Select component supports icon grid layout
- Extend data models to include optional `icon` field
- Maintain cross-platform compatibility (web + mobile)
- Type-safe implementation using existing `IconName` type

## Proposed Icon Set (35 Icons) - Priority Ordered

**Note:** All icons verified to exist in our current icon mapping.

## Icon Color Selection Feature

**Enhancement:** Add color selection for each group/channel icon using existing ColorSwatch primitive.

### Color Selection UI Design

**Layout in Icon Dropdown:**
```
┌─────────────────────────────────────────┐
│ [Color Swatches Row - STICKY HEADER]    │
│ ⚪ 🔵 🟣 🟡 🟠 🟢 🟡  ← Always visible  │
│ ─────────────────────────────────────── │
│ [Icon Grid - Scrollable Area]           │
│ 📢 # 🏠 👥 💬 ⭐                        │
│ 💼 🎮 🖼️ 📹 🎤 😊                      │
│ 🔖 📊 🎁 🍃 🐾 🍽️                      │
│ ↕️  [Scrollable - 35+ icons]           │
│ [... more icons in selected color]      │
└─────────────────────────────────────────┘
```

### Color Options (Based on AccentColorSwitcher)

**Color Sequence:**
1. **Default** - `text-subtle` (current icon color) - White/Light Gray swatch
2. **Blue** - `blue` accent color
3. **Purple** - `purple` accent color
4. **Fuchsia** - `fuchsia` accent color
5. **Orange** - `orange` accent color
6. **Green** - `green` accent color
7. **Yellow** - `yellow` accent color

**Color Implementation:**
```typescript
const ICON_COLORS = [
  { value: 'default', label: 'Default', class: 'text-subtle' },
  { value: 'blue', label: 'Blue', class: 'text-accent-blue' },
  { value: 'purple', label: 'Purple', class: 'text-accent-purple' },
  { value: 'fuchsia', label: 'Fuchsia', class: 'text-accent-fuchsia' },
  { value: 'orange', label: 'Orange', class: 'text-accent-orange' },
  { value: 'green', label: 'Green', class: 'text-accent-green' },
  { value: 'yellow', label: 'Yellow', class: 'text-accent-yellow' },
];
```

### Data Model Extensions

```typescript
interface ChannelData {
  channelName: string;
  channelTopic: string;
  isReadOnly: boolean;
  managerRoleIds: string[];
  isPinned: boolean;
  pinnedAt?: number;
  icon?: IconName;           // 🆕 Icon selection
  iconColor?: IconColor;     // 🆕 Icon color selection
}

interface Group {
  groupName: string;
  icon?: IconName;           // 🆕 Icon selection
  iconColor?: IconColor;     // 🆕 Icon color selection
  channels: Channel[];
}

type IconColor = 'default' | AccentColor; // 'default' | 'blue' | 'purple' | etc.
```

### UI Behavior

**Color Selection Flow:**
1. User opens icon picker dropdown
2. **Top row**: ColorSwatch components in small size for 7 colors
3. **Color change**: Updates all icons in grid to show in selected color
4. **Icon selection**: User clicks icon, picker closes with both icon + color
5. **Save**: Both icon and iconColor saved to channel/group data

**ColorSwatch Integration:**
```typescript
// Sticky header with ColorSwatch row
<div className="sticky top-0 bg-surface-0 z-10">
  <FlexRow gap={8} className="p-2 border-b border-surface-3">
    {ICON_COLORS.map((colorOption) => (
      <ColorSwatch
        key={colorOption.value}
        color={colorOption.value === 'default' ? 'var(--color-text-subtle)' : colorOption.value}
        isActive={selectedColor === colorOption.value}
        onPress={() => setSelectedColor(colorOption.value)}
        size="small"
      />
    ))}
  </FlexRow>
</div>

// Scrollable icon grid below
<div className="max-h-64 overflow-y-auto">
  {/* Icon grid content */}
</div>
```

### Icon Display Updates

**ChannelGroup.tsx:**
```typescript
// Current logic (to be updated)
<Icon
  name={channel.icon || "hashtag"}
  size="xs"
  className="text-subtle"  // Replace with dynamic color
/>

// New logic with color support
<Icon
  name={channel.icon || "hashtag"}
  size="xs"
  className={getIconColorClass(channel.iconColor)}
/>

const getIconColorClass = (iconColor?: IconColor): string => {
  if (!iconColor || iconColor === 'default') return 'text-subtle';
  return `text-accent-${iconColor}`;
};
```

### Cross-Platform Considerations

**Web Implementation:**
- ColorSwatch row fits in modal dropdown
- CSS accent color classes for icon coloring
- Responsive grid layout maintained

**Mobile Implementation:**
- **Sticky ColorSwatch row** in expanded inline grid
- Same sticky positioning with `position: sticky` for React Native
- Touch-friendly swatch sizing
- **ScrollView with stickyHeaderIndices** for native implementation

### Tier 1: Essential & Most Common (Top Row)
1. `bullhorn` - Announcements (critical for communities)
2. `hashtag` - General/default channels
3. `home` - Main/primary channels
4. `users` - Team/group channels
5. `comment-dots` - General discussion
6. `star` - Important/featured content

### Tier 2: Popular Categories (Second Row)
7. `briefcase` - Business/work
8. `gamepad` - Gaming (very popular)
9. `image` - Media/photos (visual content)
10. `video` - Video content/streaming
11. `microphone` - Audio/podcasts
12. `smile` - Memes/fun (popular in communities)

### Tier 3: Work & Organization
13. `book` - Documentation
14. `tools` - Development/technical
15. `code` - Programming
16. `clipboard-list` - Tasks/project management
17. `cog` - Settings/configuration
18. `shield` - Security/admin

### Tier 4: Communication & Events
19. `bell` - Notifications/alerts
20. `calendar-alt` - Events/scheduling
21. `celebration` - Events/parties
22. `gift` - Rewards/special channels
23. `heart` - Community/social

### Tier 5: Support & Information
24. `info-circle` - General information
25. `life-ring` - Help/support (like "salvagente")
26. `question-circle` - FAQ/questions
27. `search` - Research/discovery
28. `bookmark` - Resources/links

### Tier 6: Specialized Interests
29. `money` - Finance/trading
30. `food` - Food/cooking
31. `paw` - Animals/pets
32. `leaf` - Nature/environment
33. `sword` - Combat/strategy games
34. `headset` - Gaming communication
35. `chart-line` - Analytics/reports

## Technical Implementation

### Data Model Changes

#### TypeScript Interfaces
```typescript
// Groups
interface Group {
  groupName: string;
  icon?: IconName; // Optional custom icon
  channels: Channel[];
}

// Channels
interface Channel {
  channelId: string;
  channelName: string;
  icon?: IconName; // Optional custom icon
  isReadOnly?: boolean;
  // ... existing fields
}
```

#### Data Persistence & Sync Strategy

**Analysis of Current Architecture**: Based on existing `isPinned` and `isReadOnly` implementation

**Current Pattern** (`src/hooks/business/channels/useChannelManagement.ts`):

**1. Channel Metadata State**
```typescript
export interface ChannelData {
  channelName: string;
  channelTopic: string;
  isReadOnly: boolean;      // ✅ Existing pattern
  managerRoleIds: string[]; // ✅ Existing pattern
  isPinned: boolean;        // ✅ Existing pattern
  pinnedAt?: number;        // ✅ Existing pattern
  icon?: IconName;          // 🆕 New field to add
}
```

**2. State Management in Hook**
```typescript
// Current initialization (lines 42-49)
const [channelData, setChannelData] = useState<ChannelData>({
  channelName: currentChannel?.channelName || '',
  channelTopic: currentChannel?.channelTopic || '',
  isReadOnly: currentChannel?.isReadOnly || false,
  managerRoleIds: currentChannel?.managerRoleIds || [],
  isPinned: currentChannel?.isPinned || false,
  pinnedAt: currentChannel?.pinnedAt,
  icon: currentChannel?.icon || undefined,           // 🆕 Add this line
  iconColor: currentChannel?.iconColor || 'default', // 🆕 Add this line
});

// Icon change handler (new)
const handleIconChange = useCallback((iconName: IconName | null, iconColor: IconColor = 'default') => {
  setChannelData((prev) => ({
    ...prev,
    icon: iconName || undefined,
    iconColor: iconColor,
  }));
}, []);
```

**3. Save Changes Logic**
```typescript
// Current save pattern (lines 128-197) - just add icon field
const saveChanges = useCallback(async () => {
  if (channelId) {
    // Update existing channel (line 143-152)
    await updateSpace({
      ...space,
      groups: space.groups.map((g) => ({
        ...g,
        channels: groupName === g.groupName
          ? g.channels.map((c) => c.channelId === channelId ? {
              ...c,
              channelName: channelData.channelName,
              channelTopic: channelData.channelTopic,
              isReadOnly: channelData.isReadOnly,
              managerRoleIds: channelData.managerRoleIds,
              isPinned: channelData.isPinned,
              pinnedAt: channelData.pinnedAt,
              icon: channelData.icon,           // 🆕 Add this line
              iconColor: channelData.iconColor, // 🆕 Add this line
              modifiedDate: Date.now(),
            } : c)
          : g.channels,
      })),
    });
  }
}, [space, channelData, /* ... other deps */]);
```

**4. Real-time Sync via updateSpace**
```typescript
// updateSpace function (MessageDB.tsx) handles:
// 1. Encrypts space data with Quilibrium SDK
// 2. Sends encrypted payload via WebSocket
// 3. Server processes and broadcasts to all space members
// 4. All clients receive update and re-render automatically
// 5. Local IndexedDB is updated for persistence

// Same pattern used for isPinned, isReadOnly - no additional sync needed
```

**5. Data Flow (Following Existing Pattern)**
```
User selects blue bullhorn icon:
1. User selects blue color → icons in grid turn blue
2. User clicks bullhorn icon → IconPicker → handleIconChange('bullhorn', 'blue')
3. ChannelEditor Save → saveChanges()
4. updateSpace() → encrypt + WebSocket send (includes icon + iconColor)
5. Server broadcasts space update to all members
6. All users see blue bullhorn icon instantly (same as pin/readonly changes)
7. IndexedDB updated locally for offline access
```

**No API Changes Needed**: Icons sync via existing space update mechanism

### Component Updates

#### IconPicker Component (New)
- **IconPicker.web.tsx**: Responsive grid layout using CSS Grid (4/6/8 cols based on viewport)
- **IconPicker.native.tsx**: Mobile app inline expandable grid (6 cols fixed)
- **IconPicker.types.ts**: Shared interface and icon array
- **Props**: `selectedIcon`, `selectedIconColor`, `onIconSelect: (icon, color) => void`, `buttonVariant: "subtle"`

**Enhanced Features:**
- **Color Selection**: ColorSwatch row above icon grid (7 colors)
- **Dynamic Preview**: Icons change color in real-time based on selected color
- **Combined Selection**: Returns both icon name and color in single callback

#### Critical UI Considerations

**Modal Overflow Problem**: Icon grid (35 icons) may extend beyond modal bottom and get cut off.

**Solutions:**

**Option A: Modal Auto-Resize (Recommended)**
```tsx
// When icon picker opens
- Modal dynamically increases height to accommodate grid
- Smooth height transition animation
- Grid appears within modal bounds
- Modal shrinks back when grid closes
```

**Option B: Internal Scrolling**
```tsx
// Fixed modal height with scrollable grid
- Icon grid has fixed max-height (e.g., 300px)
- Grid becomes scrollable if content overflows
- Modal height remains constant
- User scrolls within grid area
```

**Option C: Overlay Positioning**
```tsx
// Grid overlays outside modal
- Icon grid positioned absolutely above modal
- Higher z-index than modal backdrop
- Positioned relative to trigger button
- Risk: may extend beyond viewport
```

**Recommended: Option A (Modal Auto-Resize)**
- ✅ No content cut-off
- ✅ Clean visual integration
- ✅ Mobile-friendly (bottom sheet can expand)
- ✅ Consistent with modal patterns
- ✅ Smooth UX with height transitions

#### Mobile UX  (React Native)

ChannelEditor and GroupEditor are already bottom sheet modals on mobile. Icon picker cannot open another modal on top.

**Inline Expandable Grid (Recommended)**
```tsx
// IconPicker.native.tsx
- Button shows selected icon (collapsed state)
- Tap button expands grid inline within bottom sheet
- **Sticky ColorSwatch header** with ScrollView below
- Grid slides down with animation, pushing other content down
- 35 icons in ~6 rows (6 icons per row for mobile)
- ColorSwatch row remains visible while scrolling icons
- Collapse button or tap selected icon to close
- Bottom sheet auto-adjusts height for grid + sticky header

// Native ScrollView implementation
<ScrollView
  stickyHeaderIndices={[0]}
  style={{ maxHeight: 300 }}
>
  <View> {/* Sticky header - index 0 */}
    <ColorSwatch row />
  </View>
  <View> {/* Scrollable content */}
    <Icon grid />
  </View>
</ScrollView>
```

#### GroupEditor.tsx
- Add icon selection row below group name input
- Layout: FlexRow with label + IconPicker component
- Handle icon state in useGroupManagement hook
- Pass icon selection callback to IconPicker

#### ChannelEditor.tsx
- Add icon selection row below channel topic input
- Same layout pattern as GroupEditor
- Handle icon state in useChannelManagement hook
- Pass icon selection callback to IconPicker

#### ChannelGroup.tsx
- Update icon rendering logic:
  ```typescript
  // BREAKING CHANGE: Remove automatic lock icon for read-only channels
  // Priority: custom icon > default hashtag (regardless of read-only status)
  const channelIcon = channel.icon || "hashtag";
  const groupIcon = group.icon; // No default for groups

  // OLD LOGIC (to be removed):
  // const channelIcon = channel.icon || (channel.isReadOnly ? "lock" : "hashtag");
  ```

#### Read-Only Channel Icon Conflict Resolution

**Problem**: Current system automatically shows lock icon for read-only channels, conflicting with custom icon selection.

**Solution**: Remove automatic lock icon behavior
- ✅ **User Choice**: Let users choose lock icon if they want it (available in icon set)
- ✅ **Consistency**: All channels use same icon logic (custom or hashtag default)
- ✅ **Flexibility**: Read-only announcement channels can use bullhorn, etc.
- ✅ **Backwards Compatible**: Existing read-only channels just switch to hashtag default

**Implementation**:
- Remove `isReadOnly ? "lock" : "hashtag"` logic from ChannelGroup.tsx:96
- Replace with simple `channel.icon || "hashtag"`
- Read-only functionality remains unchanged (permissions system unaffected)
- Users can manually select lock icon if desired

### Select Component Investigation ✅

**Analysis Completed:** The current Select primitive has these characteristics:

#### Current Capabilities ✅
- **Icon Support**: Full Icon primitive integration with `SelectOption.icon` field
- **Cross-Platform**: Both web and React Native implementations
- **Custom Styling**: SCSS for web, StyleSheet for native
- **Dropdown Positioning**: Auto-placement logic for web

#### Current Limitations ❌
- **Vertical List Only**: Uses ScrollView with linear option layout
- **No Grid Layout**: Options render in single column with flex-direction: row per item
- **Fixed Layout Structure**: Each option is a horizontal row (icon + text)

#### Technical Details
- **Web**: Uses fixed-position dropdown with flex column layout
- **Native**: Uses Modal with ScrollView containing TouchableOpacity items
- **Icon Rendering**: Icons display as small (sm) size with text labels
- **Layout**: `flexDirection: 'row'` per option, not grid-based

#### Recommended Solution: Custom Icon Grid Component

Since Select primitive doesn't support grid layout, we recommend creating a custom cross-platform icon picker:

**Option A: Modal-Based Icon Grid (Recommended)**
```tsx
// Custom IconPickerModal component
- Modal overlay (consistent with app patterns)
- Grid layout: 6 icons per row (mobile), 8 per row (desktop)
- Scroll support for 35 icons
- Search functionality (future enhancement)
- Cross-platform: same modal approach as Select.native.tsx
```

**Option B: Custom Dropdown with Grid**
```tsx
// Enhanced dropdown component
- Extend Select positioning logic
- Replace ScrollView content with grid layout
- Maintain Select's auto-placement and styling
- Higher complexity for cross-platform parity
```

**Option C: Hybrid Approach**
```tsx
// Use Select trigger, custom dropdown content
- Reuse Select's button and positioning
- Replace dropdown content with custom grid
- Easier to maintain Select styling consistency
```

#### Implementation Recommendation


Create `IconPicker` as a specialized business component:

```
src/components/space/
├── IconPicker.web.tsx     # Web grid implementation
├── IconPicker.native.tsx  # Mobile grid implementation
├── IconPicker.types.ts    # Shared types
└── GroupEditor.tsx        # Uses IconPicker
```


**Component Responsibilities:**
- Trigger button with selected icon display
- **Web**: Modal with responsive grid layout + auto-resize functionality
  - 4 cols mobile browser, 6 cols tablet, 8 cols desktop
  - Modal height auto-adjusts when grid opens/closes
- **Native**: Inline expandable grid within bottom sheet (6 cols)
  - Bottom sheet height auto-adjusts for grid expansion
- Icon selection handling and callback
- Cross-platform grid implementation with overflow handling
- Integration with existing Modal patterns

## User Experience Flow

1. **Channel Creation/Edit:**
   - User enters channel name/topic
   - Below fields: "Channel Icon" label + icon button (shows default hashtag/lock)
   - **Web**: Click button → modal with responsive grid (4 cols mobile browser, 6 cols tablet, 8 cols desktop)
   - **Mobile App**: Tap button → grid expands inline within bottom sheet (6 cols)
   - Select icon → button updates, grid closes
   - Save channel with selected icon

2. **Group Creation/Edit:**
   - User enters group name
   - Below field: "Group Icon" label + empty icon button
   - **Web**: Click button → modal with responsive grid (4 cols mobile browser, 6 cols tablet, 8 cols desktop)
   - **Mobile App**: Tap button → grid expands inline within bottom sheet (6 cols)
   - Select icon → button shows selected icon, grid closes
   - Save group with selected icon

3. **Display Updates:**
   - ChannelGroup shows custom icons instead of default hashtag/lock
   - Groups show custom icon next to name (if selected)
   - Maintains pin overlay and other existing functionality

## Performance Considerations

- **Minimal Impact:** 35 icons add negligible memory/render overhead
- **FontAwesome Efficiency:** Icons are lightweight SVGs, already loaded
- **Dropdown Optimization:** Only renders when open
- **Cross-Platform:** Existing Icon primitive handles platform differences

## Testing Requirements

- [ ] Icon selection in GroupEditor
- [ ] Icon selection in ChannelEditor
- [ ] Icon display in ChannelGroup component
- [ ] Default behavior (all channels show hashtag default, groups empty)
- [ ] **Breaking Change**: Read-only channels no longer show automatic lock icon
- [ ] Cross-platform compatibility (web + mobile)
- [ ] Accessibility (keyboard navigation, screen readers)
- [ ] Save/load icon preferences
- [ ] **Regression Testing**: Verify read-only channel permissions still work correctly
- [ ] **Migration Testing**: Existing read-only channels display hashtag instead of lock

## Future Enhancements

- Icon search/filter (if more icons added later)
- Custom icon upload (security considerations)
- Icon categories/grouping in dropdown
- Bulk icon assignment for multiple channels

## Implementation Notes

- **Breaking Change**: Remove automatic lock icon for read-only channels
- Maintain backward compatibility (existing channels/groups without icons)
- **Migration Impact**: Existing read-only channels will show hashtag instead of lock
- Consider data migration strategy for existing channels with no custom icon
- Ensure icons work with existing theming (light/dark mode)
- Document icon selection UX in component style guide
- **Testing Priority**: Verify read-only permissions system remains intact

---

**Last Updated:** 2025-01-14
**Next Review:** After Select component investigation