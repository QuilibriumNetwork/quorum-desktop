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

### Component Updates

#### IconPicker Component (New)
- **IconPicker.web.tsx**: Responsive grid layout using CSS Grid (4/6/8 cols based on viewport)
- **IconPicker.native.tsx**: Mobile app inline expandable grid (6 cols fixed)
- **IconPicker.types.ts**: Shared interface and icon array
- **Props**: `selectedIcon`, `onIconSelect`, `buttonVariant: "subtle"`

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
- Grid slides down with animation, pushing other content down
- 35 icons in ~6 rows (6 icons per row for mobile)
- Collapse button or tap selected icon to close
- Bottom sheet auto-adjusts height for grid
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
  // Priority: custom icon > logic-based icon > default
  const channelIcon = channel.icon || (channel.isReadOnly ? "lock" : "hashtag");
  const groupIcon = group.icon; // No default for groups
  ```

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
- [ ] Default behavior (channels show logic-based icons, groups empty)
- [ ] Cross-platform compatibility (web + mobile)
- [ ] Accessibility (keyboard navigation, screen readers)
- [ ] Save/load icon preferences

## Future Enhancements

- Icon search/filter (if more icons added later)
- Custom icon upload (security considerations)
- Icon categories/grouping in dropdown
- Bulk icon assignment for multiple channels

## Implementation Notes

- Maintain backward compatibility (existing channels/groups without icons)
- Consider migration strategy for existing data
- Ensure icons work with existing theming (light/dark mode)
- Document icon selection UX in component style guide

---

**Last Updated:** 2025-01-14
**Next Review:** After Select component investigation