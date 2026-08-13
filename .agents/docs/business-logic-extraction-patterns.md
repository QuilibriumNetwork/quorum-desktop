---
type: doc
title: Business Logic Extraction Patterns
status: done
created: 2026-08-13
updated: 2026-08-13
---

# Business Logic Extraction Patterns

> **Where this came from.** These patterns were written up in 2025 as the "Lessons
> Learned" half of `mobile-dev/2025-08-01-business-logic-extraction-plan.md`, a plan
> that finished long ago. The plan itself was archived on 2026-08-13 with the rest of
> the single-repo cross-platform material; this section was pulled out first because
> it is not about mobile at all. It describes how `src/hooks/business/` is meant to
> work, and that layer is used across the whole app today.
>
> One section of the original was dropped rather than carried over: a
> "Platform-Specific Components Pattern" showing `Component.tsx` /
> `Component.native.tsx` splits. There are no `.native` files in this repo any more
> (see the [removal issue](../issues/2026-08-13-remove-single-repo-cross-platform-leftovers.md)),
> so that guidance would now be actively misleading.

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

const channelIds = space.groups.flatMap((g) =>
  g.channels.map((c) => c.channelId)
);
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
    validator: spaceValidator,
  });
  return { ...form, handleDeleteSpace, isOwner };
};
```

**Benefits**: Reduced code duplication, consistent UX patterns, better testability, easier maintenance.

**Timeline**: Evaluate for shared hooks after extracting JoinSpaceModal and NewDirectMessageModal to confirm patterns.

### When NOT to Extract: Lessons from SpaceButton


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
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({
      id: space.spaceId,
      data: { targetId: space.spaceId },
    });

  // Simple, explicit logic
  const isSelected = currentSpaceId === space.spaceId;
  const navigationUrl = `/spaces/${space.spaceId}/${space.defaultChannelId || '...'}`;

  return (
    <Link
      ref={setNodeRef}
      style={dragStyle}
      {...listeners}
      {...attributes}
      to={navigationUrl}
    >
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


---

*Last updated: 2026-08-13*
