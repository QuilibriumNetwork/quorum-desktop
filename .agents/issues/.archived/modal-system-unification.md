---
type: task
title: 'Unify Modal Systems: Migrate Layout-Level Modals to ModalProvider'
status: archived
complexity: high
ai_generated: true
created: 2025-12-03T00:00:00.000Z
updated: '2026-01-09'
---

# Unify Modal Systems: Migrate Layout-Level Modals to ModalProvider

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent


**Archived**: 2025-12-03

## Archive Reason

**Decision: Do NOT proceed with unification.**

After feature-analyzer review, the hybrid two-system architecture was determined to be **intentionally correct**:

1. **ModalProvider System** (8 modals) - For modals triggered high in the component tree (NavMenu, context menus)
2. **Layout-Level System** (6 modals) - For modals triggered deep in the tree (Message.tsx) where context providers avoid prop drilling

**Key findings:**
- Current system has no bugs or z-index issues
- Migration would **degrade performance** (ModalProvider context changes trigger full app re-renders)
- Layout-Level context providers serve a purpose: avoiding prop drilling through 5+ component levels
- The "inconsistency" is actually **intentional design** - right tool for each use case

**See**: `.agents/docs/features/modals.md` for the documented architecture rationale.

---

**Files**:
- `src/components/context/ModalProvider.tsx` - Central modal provider (to be extended)
- `src/hooks/business/ui/useModalState.ts` - Modal state management (to be extended)
- `src/hooks/business/ui/useModalManagement.ts` - Layout-level modal state (to be deprecated)
- `src/components/Layout.tsx` - Currently renders 6 Layout-Level modals
- `src/components/context/ConfirmationModalProvider.tsx` - To be deprecated
- `src/components/context/ImageModalProvider.tsx` - To be deprecated
- `src/components/context/EditHistoryModalProvider.tsx` - To be deprecated

## What & Why

**Current State**: The application uses two parallel modal rendering systems:
1. **ModalProvider System** (8 modals) - Centralized state via `useModalState` hook
2. **Layout-Level System** (6 modals) - State via `useModalManagement` hook + individual context providers

**Desired State**: Single unified ModalProvider system managing all 14 modals with consistent API patterns.

**Value**:
- **Reduced cognitive load**: Developers learn one pattern instead of two
- **Consistent API**: All modals use `useModals()` → `openXxxModal()` pattern
- **Centralized state**: Single location for all modal state (`useModalState.ts`)
- **Easier maintenance**: Changes to modal behavior only need one location
- **Simplified onboarding**: New developers learn one system

## Context

- **Existing pattern**: ModalProvider system in `src/components/context/ModalProvider.tsx`
- **Reference implementation**: All 8 ModalProvider modals follow the same pattern
- **Constraints**: Must maintain z-index stacking (modals above NavMenu)
- **Dependencies**: None - pure refactor, no new features

### Current Modal Distribution

**ModalProvider System (8 modals)**:
| Modal | State Key | Open Function |
|-------|-----------|---------------|
| UserSettingsModal | `userSettings` | `openUserSettings()` |
| SpaceSettingsModal | `spaceEditor` | `openSpaceEditor(spaceId)` |
| ChannelEditorModal | `channelEditor` | `openChannelEditor(spaceId, groupName, channelId)` |
| GroupEditorModal | `groupEditor` | `openGroupEditor(spaceId, groupName)` |
| LeaveSpaceModal | `leaveSpace` | `openLeaveSpace(spaceId)` |
| KickUserModal | `kickUser` | `openKickUser(userAddress)` |
| NewDirectMessageModal | `newDirectMessage` | `openNewDirectMessage()` |
| ConversationSettingsModal | `conversationSettings` | `openConversationSettings(conversationId)` |

**Layout-Level System (6 modals to migrate)**:
| Modal | Current Hook | Current State Location |
|-------|--------------|------------------------|
| CreateSpaceModal | `useModalManagement` | `Layout.tsx` |
| AddSpaceModal | `useModalManagement` | `Layout.tsx` |
| ConfirmationModal | `useConfirmationModal` | `ConfirmationModalProvider` |
| ImageModal | `useImageModal` | `ImageModalProvider` |
| EditHistoryModal | `useEditHistoryModal` | `EditHistoryModalProvider` |
| JoinSpaceModal | `useModalManagement` | `Layout.tsx` (legacy, rarely used) |

## Prerequisites

- [ ] Review `.agents/docs/features/modals.md` for current architecture details
- [ ] Review `useModalState.ts` to understand state pattern
- [ ] Review `ModalProvider.tsx` to understand rendering pattern
- [ ] Branch created from `develop`
- [ ] No conflicting PRs in modal-related files

## Implementation

### Phase 1: Extend useModalState.ts (Add State for 6 New Modals)

- [ ] **Add CreateSpaceModal state** (`src/hooks/business/ui/useModalState.ts`)
  ```typescript
  createSpace: {
    isOpen: boolean;
  }
  ```
  - Add `openCreateSpace()` and `closeCreateSpace()` functions
  - Done when: State and functions exported from hook

- [ ] **Add AddSpaceModal state**
  ```typescript
  addSpace: {
    isOpen: boolean;
  }
  ```
  - Add `openAddSpace()` and `closeAddSpace()` functions

- [ ] **Add ConfirmationModal state**
  ```typescript
  confirmation: {
    isOpen: boolean;
    config: {
      title: string;
      message: string;
      preview?: React.ReactNode;
      confirmText?: string;
      cancelText?: string;
      variant?: 'danger' | 'warning' | 'info';
      protipAction?: string;
      onConfirm: () => void;
      onCancel?: () => void;
    } | null;
  }
  ```
  - Add `showConfirmation(config)` and `hideConfirmation()` functions

- [ ] **Add ImageModal state**
  ```typescript
  imageViewer: {
    isOpen: boolean;
    imageUrl: string | null;
  }
  ```
  - Add `openImageViewer(imageUrl)` and `closeImageViewer()` functions

- [ ] **Add EditHistoryModal state**
  ```typescript
  editHistory: {
    isOpen: boolean;
    message: MessageType | null;
  }
  ```
  - Add `openEditHistory(message)` and `closeEditHistory()` functions

- [ ] **Add JoinSpaceModal state** (legacy modal)
  ```typescript
  joinSpace: {
    isOpen: boolean;
  }
  ```
  - Add `openJoinSpace()` and `closeJoinSpace()` functions

### Phase 2: Extend ModalProvider.tsx (Render 6 New Modals)

- [ ] **Import new modals** (`src/components/context/ModalProvider.tsx`)
  ```typescript
  import CreateSpaceModal from '../modals/CreateSpaceModal';
  import AddSpaceModal from '../modals/AddSpaceModal';
  import ConfirmationModal from '../modals/ConfirmationModal';
  import ImageModal from '../modals/ImageModal';
  import { EditHistoryModal } from '../modals/EditHistoryModal';
  import JoinSpaceModal from '../modals/JoinSpaceModal';
  ```
  - Done when: No import errors

- [ ] **Add context interface properties**
  - Add all new open/close functions to `ModalContextType`
  - Done when: TypeScript compiles without errors

- [ ] **Add modal rendering**
  - Render each modal conditionally based on state
  - Follow existing pattern from other modals
  - Done when: All 6 modals render in ModalProvider

- [ ] **Export new functions from context**
  - Add to `contextValue` object
  - Done when: `useModals()` returns all new functions

### Phase 3: Update Consumer Components

- [ ] **Update Layout.tsx** (`src/components/Layout.tsx`)
  - Remove modal state from `useModalManagement` destructuring
  - Remove modal rendering (6 modals)
  - Remove provider imports and provider wrappers
  - Keep: NavMenu, ResponsiveContainer, toast system
  - Done when: Layout.tsx no longer renders modals directly

- [ ] **Update components using ConfirmationModal**
  - Search for: `useConfirmationModal`
  - Replace with: `const { showConfirmation } = useModals()`
  - Files likely affected:
    - `src/components/message/Message.tsx`
    - Any component using confirmation dialogs
  - Done when: No imports of `useConfirmationModal` remain

- [ ] **Update components using ImageModal**
  - Search for: `useImageModal`
  - Replace with: `const { openImageViewer } = useModals()`
  - Files likely affected:
    - `src/components/message/Message.tsx`
  - Done when: No imports of `useImageModal` remain

- [ ] **Update components using EditHistoryModal**
  - Search for: `useEditHistoryModal`
  - Replace with: `const { openEditHistory } = useModals()`
  - Files likely affected:
    - `src/components/message/Message.tsx`
  - Done when: No imports of `useEditHistoryModal` remain

- [ ] **Update NavMenu/AddSpaceModal triggers**
  - Search for: `showAddSpaceModal`, `showCreateSpaceModal`
  - Replace with: `openAddSpace()`, `openCreateSpace()`
  - Done when: All Layout-level modal triggers updated

### Phase 4: Cleanup Deprecated Code

- [ ] **Delete ConfirmationModalProvider.tsx**
  - Path: `src/components/context/ConfirmationModalProvider.tsx`
  - Verify no imports remain first
  - Done when: File deleted, no import errors

- [ ] **Delete ImageModalProvider.tsx**
  - Path: `src/components/context/ImageModalProvider.tsx`
  - Verify no imports remain first

- [ ] **Delete EditHistoryModalProvider.tsx**
  - Path: `src/components/context/EditHistoryModalProvider.tsx`
  - Verify no imports remain first

- [ ] **Deprecate useModalManagement.ts**
  - Path: `src/hooks/business/ui/useModalManagement.ts`
  - Remove modal state (keep only toast state if used)
  - Or delete entirely if not needed
  - Update `src/hooks/index.ts` exports

- [ ] **Update hooks/index.ts exports**
  - Remove exports for deprecated hooks/providers

### Phase 5: Documentation & Verification

- [ ] **Update modals.md documentation**
  - Path: `.agents/docs/features/modals.md`
  - Update to reflect single unified system
  - Remove Layout-Level system references
  - Update modal inventory with unified API

- [ ] **Verify z-index stacking**
  - Open each migrated modal
  - Confirm it renders above NavMenu
  - Test on both desktop and mobile viewports

- [ ] **Run type checking**
  ```bash
  cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck"
  ```

- [ ] **Run build**
  ```bash
  cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && yarn build"
  ```

## Verification

✅ **All modals accessible via `useModals()` hook**
   - Test: Import `useModals`, verify all 14 open functions available
   - Verify: TypeScript autocomplete shows all functions

✅ **Z-index stacking preserved**
   - Test: Open each modal → Verify appears above NavMenu
   - Test on: Desktop viewport (1200px+) and mobile viewport (375px)

✅ **ConfirmationModal works with preview content**
   - Test: Trigger message delete → Verify MessagePreview renders in modal
   - Test: Shift+click bypass still works

✅ **ImageModal opens images correctly**
   - Test: Click image in message → Opens full-screen viewer
   - Test: Close via X button, backdrop click, ESC key

✅ **EditHistoryModal shows message history**
   - Test: Click "View Edit History" on edited message
   - Verify: Shows chronological edit list with timestamps

✅ **CreateSpace/AddSpace flow works**
   - Test: Click "+" in NavMenu → Opens AddSpaceModal
   - Test: Click "Create a Space" → Opens CreateSpaceModal

✅ **No orphaned imports or providers**
   - Search: `ConfirmationModalProvider`, `ImageModalProvider`, `EditHistoryModalProvider`
   - Verify: Zero results in codebase

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`
   - Result: No errors

✅ **Build succeeds**
   - Run: `yarn build`
   - Result: Build completes without errors

## Definition of Done

- [ ] All 14 modals managed by single ModalProvider system
- [ ] `useModals()` hook provides access to all modal functions
- [ ] Layout.tsx no longer renders any modals directly
- [ ] Deprecated providers deleted (3 files)
- [ ] useModalManagement.ts deprecated/deleted
- [ ] All verification tests pass
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Documentation updated
- [ ] No console errors in browser

## Rollback Plan

If issues arise during migration:
1. Git revert to pre-migration commit
2. Re-enable Layout-Level system
3. Document specific failure points
4. Create smaller incremental migration tasks

## API Reference (Post-Migration)

```typescript
const {
  // Existing ModalProvider modals
  openUserSettings,
  closeUserSettings,
  openSpaceEditor,
  closeSpaceEditor,
  openChannelEditor,
  closeChannelEditor,
  openGroupEditor,
  closeGroupEditor,
  openLeaveSpace,
  closeLeaveSpace,
  openKickUser,
  closeKickUser,
  openNewDirectMessage,
  closeNewDirectMessage,
  openConversationSettings,
  closeConversationSettings,

  // Migrated from Layout-Level
  openCreateSpace,
  closeCreateSpace,
  openAddSpace,
  closeAddSpace,
  showConfirmation,      // Note: "show" not "open" for config-based modals
  hideConfirmation,
  openImageViewer,
  closeImageViewer,
  openEditHistory,
  closeEditHistory,
  openJoinSpace,
  closeJoinSpace,
} = useModals();
```

---
