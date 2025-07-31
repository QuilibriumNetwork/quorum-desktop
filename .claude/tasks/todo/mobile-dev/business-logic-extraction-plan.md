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


### Data Management Logic**

#### ChannelList.tsx
- [ ] Extract `useChannelManagement` hook
  - Channel organization
  - Group management
  - Permission checking
- [ ] Extract `useSpacePermissions` hook
  - Role-based permissions
  - Admin controls
  - Visibility logic
- [ ] Test channel list functionality unchanged

#### UserProfile.tsx
- [ ] Extract `useUserProfile` hook
  - Profile data fetching
  - Display logic
  - Status management
- [ ] Extract `useRoleManagement` hook
  - Role assignment
  - Permission changes
  - Admin controls
- [ ] Extract `useProfileImage` hook (if different from UserSettingsModal)
- [ ] Test user profile functionality unchanged

#### DirectMessageContactsList.tsx
- [ ] Extract `useConversationPolling` hook
  - Polling logic with setInterval
  - Conversation refresh
  - Optimization patterns
- [ ] Test conversation list functionality unchanged

#### Additional Components (Lower Priority)
- [ ] InviteLink.tsx → `useInviteProcessing`, `useSpaceJoining`
- [ ] SpaceIcon.tsx → `useImageLoading`
- [ ] ClickToCopyContent.tsx → `useCopyToClipboard`, `useTooltipInteraction`
- [ ] GlobalSearch.tsx → `useGlobalSearchLogic`, `useSearchContext`, `useSearchState`
- [ ] SearchResults.tsx → `useResultsVirtualization`, `useSearchNavigation`

---

## Phase 2: Clean HTML → Primitives (Native Preparation)

### Target: 13 components using SOME primitives - replace remaining raw HTML

**⚠️ Only start after Phase 1 business logic is extracted and tested**

### 🎯 **Simple Wrapper Fixes (Low Risk)**

#### SearchBar.tsx (After logic extraction)
- [ ] Replace `<div className="search-bar">` → `<Container>`
- [ ] Test visual rendering identical
- [ ] Test all functionality preserved

#### AccentColorSwitcher.tsx (After logic extraction)
- [ ] Replace `<div className="flex gap-3">` → `<FlexRow>`
- [ ] Test color switching functionality
- [ ] Test visual layout unchanged

### 🏗️ **Modal Layout Fixes**

#### CreateSpaceModal.tsx (After logic extraction)
- [ ] Replace `<div className="modal-width-large">` → `<Container maxWidth="large">`
- [ ] Replace `<div className="flex flex-row justify-around pb-4">` → `<FlexRow justifyContent="around" paddingBottom={4}>`
- [ ] Replace `<div className="flex flex-col justify-around pb-4">` → `<FlexColumn paddingBottom={4}>`
- [ ] Replace `<span className="attachment-drop-icon...">` → `<Container className="attachment-drop-icon">`
- [ ] Test modal functionality unchanged
- [ ] Test file upload still works

#### NewDirectMessageModal.tsx (After logic extraction)
- [ ] Replace `<div className="modal-new-direct-message w-full max-w-[500px] mx-auto">` → `<Container maxWidth="500px">`
- [ ] Replace `<div className="mb-4 text-sm text-subtle">` → `<Container marginBottom={4}><Text variant="subtle" size="sm">`
- [ ] Replace action div containers with FlexRow/FlexColumn
- [ ] Test DM creation functionality unchanged

#### JoinSpaceModal.tsx (After logic extraction)
- [ ] Replace `<div className="modal-join-space modal-width-medium">` → `<Container maxWidth="medium">`
- [ ] Replace `<div className="w-full flex justify-center">` → `<FlexCenter width="full">`
- [ ] Replace `<div className="modal-join-space-icon">` → `<Container className="space-icon-container">`
- [ ] Test space joining functionality unchanged

#### KickUserModal.tsx (After logic extraction)
- [ ] Replace `<div className="w-full max-w-[400px] mx-auto">` → `<Container maxWidth="400px">`
- [ ] Replace `<div className="mb-4 text-sm text-subtle text-left max-sm:text-center">` → `<Container marginBottom={4}><Text variant="subtle" size="sm">`
- [ ] Replace `<div className="flex justify-start max-sm:justify-center">` → `<FlexRow justifyContent="start">`
- [ ] Test kick user functionality unchanged

#### LeaveSpaceModal.tsx (After logic extraction)
- [ ] Review and replace raw div elements (needs verification)
- [ ] Test leave space functionality unchanged

#### Additional Modal/Editor Components
- [ ] SpaceEditor.tsx → Replace layout divs with primitives (after logic extraction)
- [ ] ChannelEditor.tsx → Replace layout divs with primitives (after logic extraction)  
- [ ] GroupEditor.tsx → Replace layout divs with primitives (after logic extraction)

---

## Phase 3: Test Native Readiness (Validation)

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

## Hooks Structure Organization (Reference)

### Current Structure Analysis

Your hooks are well-organized with:
- **`queries/`** - Data fetching hooks (by domain: spaces, messages, etc.)
- **`mutations/`** - Data mutation hooks  
- **`utils/`** - Utility hooks
- **Root level** - General-purpose hooks (responsive, longpress, search)

### Recommended Organization for Business Logic Extraction

```
src/hooks/
├── index.ts                    # Main exports
├── queries/                    # Data fetching (existing nested structure)
│   ├── channels/
│   ├── conversations/ 
│   ├── spaces/
│   ├── etc...
├── mutations/                  # Data mutations (existing)
├── business/                   # 🆕 Business logic hooks (nested like queries)
│   ├── index.ts
│   ├── spaces/
│   │   ├── index.ts
│   │   ├── useSpaceCreation.ts
│   │   ├── useSpaceSettings.ts
│   │   ├── useSpaceJoining.ts
│   │   ├── useSpaceLeaving.ts
│   │   ├── useSpaceNavigation.ts
│   │   ├── useSpacePermissions.ts
│   │   └── useInviteValidation.ts
│   ├── messages/
│   │   ├── index.ts
│   │   ├── useMessageActions.ts
│   │   ├── useMessageComposer.ts
│   │   ├── useMessageRendering.ts
│   │   ├── useReactions.ts
│   │   └── useEmojiPicker.ts
│   ├── channels/
│   │   ├── index.ts
│   │   ├── useChannelManagement.ts
│   │   ├── useChannelData.ts
│   │   └── useGroupManagement.ts
│   ├── search/
│   │   ├── index.ts
│   │   ├── useSearchSuggestions.ts
│   │   ├── useKeyboardNavigation.ts
│   │   ├── useGlobalSearchLogic.ts
│   │   ├── useSearchState.ts
│   │   ├── useSearchNavigation.ts
│   │   └── useResultsVirtualization.ts
│   ├── user/
│   │   ├── index.ts
│   │   ├── useUserSettings.ts
│   │   ├── useUserProfile.ts
│   │   ├── useProfileImage.ts
│   │   ├── useRoleManagement.ts
│   │   └── useThemeSettings.ts
│   ├── conversations/
│   │   ├── index.ts
│   │   ├── useDirectMessageCreation.ts
│   │   ├── useConversationPolling.ts
│   │   ├── useConversationsData.ts
│   │   └── useShowHomeScreen.ts
│   ├── auth/
│   │   ├── index.ts
│   │   ├── useAuthentication.ts
│   │   ├── useRegistrationFlow.ts
│   │   ├── useProfileSetup.ts
│   │   └── usePasskeyFlow.ts
│   ├── modals/
│   │   ├── index.ts
│   │   ├── useModalManagement.ts
│   │   ├── useModalContext.ts
│   │   ├── useKickUser.ts
│   │   └── useConfirmationFlow.ts
│   ├── ui/
│   │   ├── index.ts
│   │   ├── useFileUpload.ts
│   │   ├── useImageLoading.ts
│   │   ├── useCopyToClipboard.ts
│   │   ├── useTooltipInteraction.ts
│   │   ├── useAccentColor.ts
│   │   ├── useDragAndDrop.ts
│   │   └── useLayoutState.ts
│   └── validation/
│       ├── index.ts
│       ├── useAddressValidation.ts
│       └── useInviteProcessing.ts
├── useResponsiveLayout.ts      # Keep existing
├── useLongPress.ts            # Keep existing  
├── useSearchContext.ts        # Keep existing
└── utils/                     # Keep existing
```

### Domain Mapping from Components

Based on the actual components that need extraction (from audit.json):

**Spaces Domain (`business/spaces/`):**
- CreateSpaceModal → `useSpaceCreation`, `useSpaceSettings`
- JoinSpaceModal → `useSpaceJoining`, `useInviteValidation`
- LeaveSpaceModal → `useSpaceLeaving`, `useConfirmationFlow`
- SpaceButton/NavMenu → `useSpaceNavigation`, `useDragAndDrop`
- ChannelList → `useSpacePermissions`

**Messages Domain (`business/messages/`):**
- Channel.tsx → `useMessageComposer`, `useMessageActions`
- Message.tsx → `useMessageRendering`, `useReactions`, `useEmojiPicker`
- MessageList.tsx → Already has hooks extracted

**User Domain (`business/user/`):**
- UserSettingsModal → `useUserSettings`, `useProfileImage`, `useThemeSettings`
- UserProfile → `useUserProfile`, `useRoleManagement`

**Search Domain (`business/search/`):**
- SearchBar → `useSearchSuggestions`, `useKeyboardNavigation`
- GlobalSearch → `useGlobalSearchLogic`, `useSearchState`
- SearchResults → `useResultsVirtualization`, `useSearchNavigation`

**Conversations Domain (`business/conversations/`):**
- NewDirectMessageModal → `useDirectMessageCreation`
- DirectMessageContactsList → `useConversationPolling`
- EmptyDirectMessage → `useShowHomeScreen`, `useConversationsData`

**Auth Domain (`business/auth/`):**
- Onboarding → `useRegistrationFlow`, `useProfileSetup`
- Login → `useAuthentication`, `usePasskeyFlow`

**UI Domain (`business/ui/`):**
- File upload components → `useFileUpload`
- ClickToCopyContent → `useCopyToClipboard`, `useTooltipInteraction`
- SpaceIcon → `useImageLoading`
- AccentColorSwitcher → `useAccentColor`
- Drag/drop components → `useDragAndDrop`

### Guidelines for Business Logic Extraction

#### 1. **Domain-Based Organization**
Group hooks by business domain (spaces, messages, auth) to match existing queries structure.

#### 2. **Naming Conventions**
- `useXxxLogic.ts` - Main business logic for a domain
- `useXxxFlow.ts` - Multi-step processes  
- `useXxxState.ts` - Complex state management
- `useXxxUI.ts` - UI-specific business logic

#### 3. **Hook Categories**

**Business Logic (`business/`)**:
- Complex component state management
- Business rules and validation
- Multi-step workflows
- Cross-component logic coordination

**UI Logic (`ui/`)**:
- Drawer/modal open/close logic
- Theme and styling logic  
- Notification display logic
- Search UI state

**Forms (`forms/`)**:
- Form state management
- Validation logic
- Form submission flows

#### 4. **Keep Existing Structure**
- `queries/` - Continue using for data fetching
- `mutations/` - Continue using for data mutations
- Root level - Keep general-purpose hooks (responsive, longpress)

### Implementation Strategy

This organization separates concerns cleanly while building on your existing well-structured foundation. The new structure allows for:

1. **Clean separation** between data access (queries/mutations) and business logic
2. **Domain-focused** organization that matches your app's architecture
3. **Easy testing** of isolated business logic
4. **Better reusability** across web and mobile platforms
5. **Gradual migration** without disrupting existing code

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

---

_Created: 2025-07-29_
_Updated: 2025-01-29_
_Priority: Business Logic First → Native Preparation Second_
_Objective: Fully working web app ready for native components_