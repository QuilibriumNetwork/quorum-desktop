# Business Logic Extraction & Native Preparation Plan

[← Back to INDEX](../../../INDEX.md)

## Overview

**Main Objective**: Extract business logic into shared hooks, prepare for native components while keeping web app fully working and tested.

**Strategy**: Business Logic First → Clean HTML Second → Test Native Readiness

---

## Phase 1: Business Logic Extraction (Priority #1)

### Target: 38 components need business logic extracted

### Modal Business Logic

- [x] CreateSpaceModal.tsx
- [x] UserSettingsModal.tsx
- [x] SpaceEditor.tsx (very complex)
- [x] JoinSpaceModal.tsx
- [x] NewDirectMessageModal.tsx
- [x] LeaveSpaceModal.tsx
- [x] KickUserModal.tsx
- [x] ChannelEditor.tsx
- [x] GroupEditor.tsx


### Search Business Logic

- [x] SearchBar.tsx
- [x] GlobalSearch.tsx
- [x] SearchResults.tsx
- [x] SearchResultItem.tsx

### Simple Logic, Quick Testing

- [x] AccentColorSwitcher.tsx
- [x] ClickToCopyContent.tsx

- [x] SpaceIcon.tsx

- [x] UserProfile.tsx

- [x] DirectMessageContactsList.tsx
- [x] EmptyDirectMessage.tsx

- [x] Layout.tsx 

### More Complex Logic

- [x] ChannelList.tsx
- [x] InviteLink.tsx
- [x] SpaceButton.tsx (Keep logic - see lessons learned)
- [x] NavMenu.tsx (Keep raw html/css or layout breaks)


### High Complexity - Extract Last (Require Careful Testing)

- [x] Channel.tsx 
- [x] MessageComposer.tsx 

- [x] DirectMessage.tsx 


#### Message.tsx 
This  avery big and complex component. I "think" it si shared between DirectMessage and Channel. Analyze the component carefully. If you think it coudl benefit fomr eing scomosed in smaller components, please advice. After you finish your detailed analysis of whatcan be done to extract all logic and add our primitves, report back.

There could me more logic to extract compared to what is listed below:
- [ ] Extract `useMessageActions` hook
- [ ] Extract `useEmojiPicker` hook
- [ ] Extract `useMessageRendering` hook
- [ ] Extract `useReactions` hook
- [ ] Test: Message interactions, emoji reactions, reply functionality

---

## Phase 2: Test Native Readiness (Validation)

### 🧪 **Build and Test React Native Compatibility**

#### Test Environment Setup
- [ ] Ensure React Native build pipeline works
- [ ] Configure mobile simulator/emulator
- [ ] Set up component testing framework

#### Test Order (Safest to Most Complex)

**Context Providers (Already Ready)**
- [ ] Test ThemeProvider on React Native
- [ ] Test ResponsiveLayoutProvider on React Native
- [ ] Test WebsocketProvider on React Native
- [ ] Test QuorumApiContext on React Native
- [ ] Test MessageDB on React Native
- [ ] Test RegistrationPersister on React Native

**Simple Components**
- [ ] Test ThemeRadioGroup on React Native (already 100% primitives)
- [ ] Test AccentColorSwitcher on React Native (after Phase 2 cleanup)

**Extracted + Cleaned Components**
- [ ] Test SearchBar on React Native (after Phases 1 & 2)
- [ ] Test CreateSpaceModal on React Native (after Phases 1 & 2)
- [ ] Test other cleaned modals

#### Success Criteria
- [ ] React Native build compiles without errors
- [ ] Components render correctly on mobile simulator
- [ ] Business logic hooks work identically on both platforms
- [ ] No raw HTML elements block React Native rendering
- [ ] All functionality preserved from web version

---

## Phase 4: Platform-Specific Components (Future)

**⚠️ Only after Phases 1-3 are complete and tested**

### Target: 21 components that need different UX per platform

#### Navigation Components
- [ ] NavMenu.tsx → Desktop sidebar vs mobile tabs
- [ ] ExpandableNavMenu.tsx → Different expansion patterns
- [ ] MessageActionsDrawer.tsx → Desktop hover vs mobile drawer
- [ ] EmojiPickerDrawer.tsx → Desktop popup vs mobile fullscreen

#### Layout Components  
- [ ] Layout.tsx → Desktop multi-pane vs mobile stack
- [ ] Space.tsx → Desktop sidebar + main vs mobile navigation
- [ ] DirectMessages.tsx → Desktop split vs mobile stack

---

## Success Metrics

### Phase 1 Success
- [ ] All targeted hooks extracted successfully
- [ ] Web app functionality 100% preserved
- [ ] Code is more testable and maintainable
- [ ] Business logic is platform-agnostic

### Phase 2 Success
- [ ] All raw HTML replaced with primitives
- [ ] Web app visual rendering unchanged
- [ ] No functionality regressions
- [ ] Components are theoretically React Native compatible

### Phase 3 Success
- [ ] React Native build successful
- [ ] Components render correctly on mobile
- [ ] All business logic works cross-platform
- [ ] Ready to build actual mobile UI

---

## Risk Mitigation

### Low-Risk Approach
- **Extract logic first** - no UI changes, easy to test and rollback
- **One component at a time** - isolate issues quickly
- **Thorough testing** - each change verified before next step
- **Preserve web functionality** - never break existing features

### Testing Strategy
- **Unit tests** for extracted hooks
- **Component tests** for UI changes
- **Integration tests** for full workflows
- **Cross-platform testing** for React Native compatibility

---

## Getting Started

### Immediate Next Steps
1. **Start with CreateSpaceModal business logic extraction**
2. **Set up hook testing framework**
3. **Extract useSpaceCreation hook first**
4. **Test web app thoroughly**
5. **Move to next hook in same component**

### Team Coordination
- **Web app must stay fully functional** throughout process
- **Each phase should be tested before proceeding**
- **Regular cross-platform compatibility checks**
- **Document patterns for other team members**

---

## Hooks Structure Organization

### Current Structure
Your hooks are well-organized with:
- **`queries/`** - Data fetching hooks (by domain: spaces, messages, etc.)
- **`mutations/`** - Data mutation hooks  
- **`utils/`** - Utility hooks
- **Root level** - General-purpose hooks (responsive, longpress, search)

### Business Logic Organization Strategy
Add a new **`business/`** folder organized by domain, similar to queries:

```
src/hooks/
├── queries/                    # Data fetching (existing)
├── mutations/                  # Data mutations (existing)
├── business/                   # 🆕 Business logic hooks (by domain)
│   ├── spaces/                 # Space-related business logic
│   ├── messages/              # Message-related business logic
│   ├── user/                  # User-related business logic
│   ├── conversations/         # Direct message logic
│   ├── search/               # Search logic
│   ├── ui/                   # UI interaction logic
│   └── validation/           # Validation logic
├── useResponsiveLayout.ts      # Keep existing
├── useLongPress.ts            # Keep existing  
└── utils/                     # Keep existing
```

### Guidelines
- **Domain-based organization** - Group by feature area, not component
- **Analyze as we go** - Determine specific hooks during component analysis
- **Keep existing structure** - Build on current queries/mutations pattern

---

## Business Logic Extraction - Lessons Learned

### Key Patterns & Best Practices

#### 1. State Synchronization with Async Data
**Problem**: States initialized with default values don't sync with loaded data.
**Solution**: Use `useEffect` with careful dependency management:
```tsx
// ✅ Good - Only runs when data loads/changes
useEffect(() => {
  if (space) {
    setSpaceName(space.spaceName || '');
    setIsRepudiable(space.isRepudiable || false);
  }
}, [space?.spaceId]); // Key: Use ID, not the whole object

// ❌ Bad - Creates infinite loops
useEffect(() => {
  setSpaceName(space.spaceName);
}, [space, spaceName]); // Runs every time spaceName changes
```

#### 2. React Hooks Rules Compliance
**Critical**: Always call hooks at the top level, never after conditional returns.
```tsx
// ❌ Bad - Violates Rules of Hooks
if (someCondition) return <SomeComponent />;
useEffect(() => {...}, []); // This hook is called conditionally!

// ✅ Good - All hooks before conditionals
useEffect(() => {...}, []);
if (someCondition) return <SomeComponent />;
```

#### 3. Cross-Platform Primitive Components
**Issue**: Primitive components must support all required props across platforms.
**Learning**: When extracting business logic, check that primitives handle all interactions:
- Web: Pass `onClick` directly to underlying component
- Native: Wrap with `TouchableOpacity` when `onClick` provided

#### 4. Database Operation Validation
**Problem**: Empty arrays/undefined values cause IndexedDB key errors.
**Solution**: Always validate data before database operations:
```tsx
// ✅ Add guards for empty data
if (!space || !space.groups || space.groups.length === 0) {
  resolve([]);
  return;
}

const channelIds = space.groups.flatMap(g => g.channels.map(c => c.channelId));
if (channelIds.length === 0) {
  resolve([]);
  return;
}
```

#### 5. Hook Extraction Strategy
**Approach**: Extract by feature domain, not by UI section:
- `useSpaceManagement` - Core space operations
- `useRoleManagement` - Role CRUD operations  
- `useCustomAssets` - Emoji/sticker management
- `useFileUploads` - File handling logic
- `useInviteManagement` - Invitation workflows

#### 6. Context Integration Patterns
**Pattern**: Extract context functions at hook level, not in callbacks:
```tsx
// ✅ Good - Extract at hook level
const { updateSpace, deleteSpace } = useMessageDB();

const handleDelete = useCallback(async () => {
  await deleteSpace(spaceId);
}, [deleteSpace, spaceId]);

// ❌ Bad - Extract in callback (hooks rules violation)
const handleDelete = useCallback(async () => {
  const { deleteSpace } = useMessageDB(); // Hook in callback!
  await deleteSpace(spaceId);
}, [spaceId]);
```

#### 7. State Management for Complex Modals
**Learning**: Keep UI-specific state in components, extract business logic to hooks:
- ✅ Component: `deleteConfirmationStep`, modal visibility
- ✅ Hook: Data operations, validation, API calls

### Common Pitfalls

1. **Fast Refresh Issues**: Context export changes require dev server restart
2. **Dependency Array Management**: Avoid objects in dependencies, use IDs/primitives
3. **State Initialization**: Don't assume data is immediately available
4. **Error Boundaries**: Add proper error handling for async operations
5. **Type Safety**: Validate data shapes before operations

### Migration Checklist

- [ ] Identify business logic vs UI logic
- [ ] Extract hooks by feature domain
- [ ] Validate all primitive component props work cross-platform
- [ ] Add proper state synchronization with useEffect
- [ ] Test empty/undefined data scenarios
- [ ] Verify React Hooks Rules compliance
- [ ] Add error handling for async operations

### Hook Sharing & Complexity Reduction Strategy

**Observation**: After extracting SpaceEditor and UserSettingsModal hooks, clear patterns emerge for potential sharing.

#### High Potential for Shared Hooks

**1. File Upload Patterns**
- `useSpaceFileUploads` vs `useProfileImage` both handle image uploads with validation
- **Future shared hook**: `useImageUpload({ type: 'avatar' | 'banner' | 'profile', maxSize, dimensions })`

**2. Settings Management Pattern**
- Both modals follow: Load → Edit → Save → Close pattern
- State sync with async data, form validation, error handling
- **Future shared hook**: `useSettingsForm({ loadFn, saveFn, validator })`

**3. Asset Collection Management**
- `useCustomAssets` (emojis/stickers) could generalize to badges, reactions, themes
- **Future shared hook**: `useAssetCollection({ type, maxCount, validations })`

#### Implementation Strategy

**Phase 1: Pattern Recognition (Current)**
- Continue extracting 2-3 more modals (JoinSpaceModal, NewDirectMessageModal)
- Document recurring patterns as they emerge

**Phase 2: Base Hook Creation (After 4-5 extractions)**
```tsx
// Create configurable base hooks
const useFormWithAsyncData = ({ loadFn, saveFn, validator }) => { ... };
const useFileUpload = ({ accept, maxSize, transform }) => { ... };
const useCollectionManager = ({ maxItems, validator, itemType }) => { ... };
```

**Phase 3: Refactor to Shared Hooks**
```tsx
// Build specialized hooks on shared foundations
const useSpaceManagement = (options) => {
  const form = useFormWithAsyncData({
    loadFn: () => useSpace(options.spaceId).data,
    saveFn: updateSpace,
    validator: spaceValidator
  });
  return { ...form, handleDeleteSpace, isOwner };
};
```

**Benefits**: Reduced code duplication, consistent UX patterns, better testability, easier maintenance.

**Timeline**: Evaluate for shared hooks after extracting JoinSpaceModal and NewDirectMessageModal to confirm patterns.

### When NOT to Extract: Lessons from SpaceButton

**Date**: 2025-08-01

**Learning**: Not every component needs business logic extraction, even in a cross-platform architecture.

#### The SpaceButton Over-Engineering Case

**What we did**:
1. Created `useDragAndDrop` hook for sortable functionality
2. Created `useSpaceNavigation` hook for URL generation and selection state
3. Used spread operators to hide prop details

**Why it was wrong**:
1. **Too simple to abstract** - The component had minimal logic (just prop transformations)
2. **Hidden intent** - `{...spaceIconProps}` made it harder to understand what props were passed
3. **Platform concerns mixed** - Drag/drop is inherently web-specific, not "business logic"
4. **Added complexity without benefit** - More files, more indirection, same functionality

#### When to Extract vs When to Keep Simple

**✅ EXTRACT when you have**:
- Complex state management (multiple useState/useEffect)
- Async operations with error handling
- Business rules and validation
- Multi-step workflows
- Logic that could be reused across components
- 10+ lines of interconnected logic

**Examples of good extraction**:
- `InviteLink` - Complex async flow, error states, join process
- `ChannelList` - Permission logic, modal coordination, data processing
- `SpaceEditor` - Multiple feature domains, complex state sync

**❌ DON'T EXTRACT when you have**:
- Simple prop transformations
- Platform-specific behavior (drag/drop, native gestures)
- UI-only calculations
- Single-purpose, single-use logic
- Components under 50 lines with clear intent

**Examples to keep simple**:
- `SpaceButton` - Just a draggable link with an icon

#### Best Practices for Cross-Platform Architecture

1. **Clarity over cleverness** - Explicit props are better than spread operators
2. **Extract by complexity, not by principle** - Don't force extraction on simple components
3. **Platform-specific is OK** - Not everything needs to be "cross-platform ready"
4. **Simple components should stay simple** - Maintainability > Architectural purity

#### The Revised SpaceButton Approach

```tsx
// ✅ Good - Clear, simple, maintainable
const SpaceButton = ({ space }) => {
  const { spaceId: currentSpaceId } = useParams();
  
  // Platform-specific drag logic - clearly visible
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: space.spaceId,
    data: { targetId: space.spaceId },
  });

  // Simple, explicit logic
  const isSelected = currentSpaceId === space.spaceId;
  const navigationUrl = `/spaces/${space.spaceId}/${space.defaultChannelId || '...'}`;

  return (
    <Link ref={setNodeRef} style={dragStyle} {...listeners} {...attributes} to={navigationUrl}>
      <SpaceIcon
        notifs={Boolean(space.notifs && space.notifs > 0)}
        selected={isSelected}
        size="regular"
        iconUrl={space.iconUrl}
        spaceName={space.spaceName}
        spaceId={space.spaceId}
        highlightedTooltip={true}
      />
    </Link>
  );
};
```

**Key Takeaway**: In cross-platform development, knowing when NOT to abstract is as important as knowing when to abstract. Keep simple things simple.

### Platform-Specific Components Pattern

**Date**: 2025-08-01

**Pattern**: How to handle components with platform-specific behavior like drag/drop, gestures, or navigation.

#### The SpaceButton Platform Split

SpaceButton requires different implementations because:
- **Web**: Uses `@dnd-kit/sortable` for drag-and-drop reordering
- **Native**: Might use long-press menus or different gesture system
- **Core logic**: Only 2-3 lines (selection state, URL generation)

#### Best Practice: Platform-Specific Files

```
src/components/navbar/
├── SpaceButton.tsx          # Web version with drag/drop
├── SpaceButton.native.tsx   # Native version with gestures
└── SpaceButton.shared.ts    # Shared logic (only if complex)
```

#### Implementation Pattern

**Web Version (SpaceButton.tsx)**:
```tsx
const SpaceButton = ({ space }) => {
  const { spaceId: currentSpaceId } = useParams();
  const isSelected = currentSpaceId === space.spaceId;
  
  // Web-specific: Drag and drop
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: space.spaceId,
    data: { targetId: space.spaceId },
  });
  
  const { setIsDragging } = useDragStateContext();
  React.useEffect(() => {
    setIsDragging(isDragging);
  }, [isDragging, setIsDragging]);

  const dragStyle = { /* transform, opacity, etc */ };
  const navigationUrl = `/spaces/${space.spaceId}/${space.defaultChannelId || '...'}`;

  return (
    <Link ref={setNodeRef} style={dragStyle} {...listeners} {...attributes} to={navigationUrl}>
      <SpaceIcon
        notifs={Boolean(space.notifs && space.notifs > 0)}
        selected={isSelected}
        size="regular"
        iconUrl={space.iconUrl}
        spaceName={space.spaceName}
        spaceId={space.spaceId}
        highlightedTooltip={true}
      />
    </Link>
  );
};
```

**Native Version (SpaceButton.native.tsx)**:
```tsx
import { TouchableOpacity, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const SpaceButton = ({ space }) => {
  const navigation = useNavigation();
  const { spaceId: currentSpaceId } = useParams();
  const isSelected = currentSpaceId === space.spaceId;
  
  // Native-specific: Navigation and gestures
  const handlePress = () => {
    navigation.navigate('Space', {
      spaceId: space.spaceId,
      channelId: space.defaultChannelId || '00000000-0000-0000-0000-000000000000'
    });
  };

  const handleLongPress = () => {
    // Native might show action menu instead of drag
    showSpaceActions(space);
  };

  return (
    <Pressable 
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1
      })}
    >
      <SpaceIcon
        notifs={Boolean(space.notifs && space.notifs > 0)}
        selected={isSelected}
        size="regular"
        iconUrl={space.iconUrl}
        spaceName={space.spaceName}
        spaceId={space.spaceId}
        highlightedTooltip={false} // Tooltips work differently on native
      />
    </Pressable>
  );
};
```

#### When to Use This Pattern

**Use platform-specific files when**:
- Platform behaviors are fundamentally different (drag vs gestures)
- Each platform has unique optimization opportunities
- Shared logic is minimal (< 10 lines)
- Platform-specific APIs are heavily used

**Examples of platform-specific components**:
- `SpaceButton` - Drag/drop vs long-press
- `FileUpload` - File input vs camera/gallery
- `Tooltip` - Hover vs press-and-hold
- `ContextMenu` - Right-click vs long-press

#### When to Share Logic

**Extract shared logic only when**:
- Business rules must stay synchronized
- Complex calculations (> 10 lines)
- Data transformations
- State management logic

**Example of worth extracting**:
```tsx
// useMessagePermissions.shared.ts
export const useMessagePermissions = (message, user, space) => {
  const isAuthor = user.id === message.authorId;
  const isAdmin = space.roles.find(r => r.userId === user.id)?.permissions.includes('admin');
  const editTimeout = Date.now() - message.timestamp < 15 * 60 * 1000;
  
  const canEdit = isAuthor && editTimeout && !message.deleted;
  const canDelete = isAuthor || isAdmin;
  const canReact = !message.deleted && space.permissions.reactions;
  const canReply = !message.deleted && space.permissions.replies;
  
  return { canEdit, canDelete, canReact, canReply };
};
```

#### Metro Bundler Configuration

React Native's Metro bundler automatically picks the right file:
- `SpaceButton.tsx` → Used on web
- `SpaceButton.native.tsx` → Used on iOS/Android
- `SpaceButton.ios.tsx` → iOS specific (if needed)
- `SpaceButton.android.tsx` → Android specific (if needed)

#### Key Principles

1. **"Share business logic, not UI logic"**
   - ✅ Share: Calculations, validations, data processing
   - ❌ Don't share: Gestures, animations, platform APIs

2. **Duplication is OK for simple logic**
   - 2-3 lines of duplication > complex abstraction
   - Each platform can optimize independently

3. **Optimize for platform strengths**
   - Web: Hover states, drag/drop, keyboard shortcuts
   - Native: Gestures, haptics, native navigation

4. **Keep platform code obvious**
   - Anyone should immediately see what's platform-specific
   - No hidden platform checks in shared components

#### Migration Strategy

When splitting existing components:
1. Identify platform-specific code (drag, hover, file inputs)
2. Create `.native.tsx` version
3. Move platform code to respective files
4. Keep truly shared logic inline (if < 10 lines)
5. Extract to `.shared.ts` only if complex

This pattern ensures clean, maintainable code that leverages each platform's strengths without unnecessary abstraction.

---

_Created: 2025-07-29_
_Updated: 2025-08-01_
_Priority: Business Logic First → Native Preparation Second_
_Objective: Fully working web app ready for native components_