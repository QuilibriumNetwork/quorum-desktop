# Modal System Documentation

## Overview

The app uses **two modal rendering systems** - this is intentional, not a temporary state.

## Architecture

### Two Rendering Systems

| System | Location | Modals | Best For |
|--------|----------|--------|----------|
| **ModalProvider** | Router level | 8 modals | Top-level triggers (NavMenu, menus) |
| **Layout-Level** | Layout.tsx | 6 modals | Deep triggers (Message.tsx) - context providers avoid prop drilling |

> ⚠️ **Never render modals at component level** (e.g., inside Message.tsx). This causes z-index issues where NavMenu appears above the modal overlay.

### Why Two Systems?

After feature-analyzer review, the hybrid architecture was determined to be **correct by design**:

1. **Performance**: ModalProvider context changes re-render ALL children. Layout-Level uses local state = fewer re-renders.
2. **Prop Drilling**: Layout-Level modals (ConfirmationModal, ImageModal, EditHistoryModal) are triggered 5+ levels deep. Context providers avoid passing functions through every level.
3. **No Bugs**: Both systems have perfect z-index stacking.

**Do NOT attempt to unify** - see `.agents/tasks/.archived/modal-system-unification.md` for full analysis.

### When to Use Each System

| Criteria | → System |
|----------|----------|
| Triggered from NavMenu, space menus, context menus | ModalProvider |
| Needs to open from multiple unrelated components | ModalProvider |
| Multi-section interface (settings) | ModalProvider |
| Triggered deep in component tree (Message.tsx) | Layout-Level |
| Simple viewer/confirmation | Layout-Level |
| Performance critical | Layout-Level |

## Modal Inventory

### Layout-Level Modals (6)

| Modal | File | Purpose |
|-------|------|---------|
| CreateSpaceModal | `src/components/modals/CreateSpaceModal.tsx` | Create new space |
| AddSpaceModal | `src/components/modals/AddSpaceModal.tsx` | Join via invite or create |
| JoinSpaceModal | `src/components/modals/JoinSpaceModal.tsx` | Join space (legacy) |
| ConfirmationModal | `src/components/modals/ConfirmationModal.tsx` | Universal confirmation dialog |
| ImageModal | `src/components/modals/ImageModal.tsx` | Full-screen image viewer |
| EditHistoryModal | `src/components/modals/EditHistoryModal.tsx` | Message edit history |

**Context Providers**: ConfirmationModalProvider, ImageModalProvider, EditHistoryModalProvider

### ModalProvider Modals (8)

| Modal | File | Purpose |
|-------|------|---------|
| UserSettingsModal | `src/components/modals/UserSettingsModal/` | User settings (multi-section) |
| SpaceSettingsModal | `src/components/modals/SpaceSettingsModal/` | Space management (multi-section) |
| ChannelEditorModal | `src/components/modals/ChannelEditorModal.tsx` | Create/edit channels |
| GroupEditorModal | `src/components/modals/GroupEditorModal.tsx` | Create/edit channel groups |
| LeaveSpaceModal | `src/components/modals/LeaveSpaceModal.tsx` | Leave space confirmation |
| KickUserModal | `src/components/modals/KickUserModal.tsx` | Kick user confirmation |
| NewDirectMessageModal | `src/components/modals/NewDirectMessageModal.tsx` | Start new DM |
| ConversationSettingsModal | `src/components/modals/ConversationSettingsModal.tsx` | DM conversation settings |

**Access**: `const { openUserSettings, openSpaceEditor, ... } = useModals();`

### Utility Component

| Component | File | Purpose |
|-----------|------|---------|
| ModalSaveOverlay | `src/components/modals/ModalSaveOverlay.tsx` | Loading overlay for async operations |

## Implementation

### Adding a ModalProvider Modal

1. **Add state** (`src/hooks/business/ui/useModalState.ts`):
```tsx
myModal: { isOpen: boolean; data?: any; }
```

2. **Add to ModalProvider** (`src/components/context/ModalProvider.tsx`):
```tsx
{modalState.state.myModal.isOpen && <MyModal onClose={modalState.closeMyModal} />}
```

3. **Use**: `const { openMyModal } = useModals();`

### Adding a Layout-Level Modal

1. **Add state** (`src/hooks/business/ui/useModalManagement.ts`):
```tsx
const [myModalVisible, setMyModalVisible] = useState(false);
```

2. **Add to Layout** (`src/components/Layout.tsx`):
```tsx
{myModalVisible && <MyModal visible={myModalVisible} onClose={() => setMyModalVisible(false)} />}
```

3. **For deep access**: Create a context provider (see ConfirmationModalProvider pattern)

### Using ConfirmationModal

```tsx
const { showConfirmationModal } = useConfirmationModal();

showConfirmationModal({
  title: t`Delete Message`,
  message: t`Are you sure?`,
  preview: <MessagePreview message={message} />,
  variant: 'danger',
  protipAction: t`delete`,
  onConfirm: handleDelete,
});
```

## Modal Sizes

| Size | Width | Use Case |
|------|-------|----------|
| `small` | 400px | Simple editors |
| `medium` | 600px | Standard forms |
| `large` | 800px | Multi-section settings |
| `full` | 95vw | Content-heavy modals |

## Core Components

### Modal Primitive (`src/components/primitives/Modal`)

```tsx
<Modal
  title="Title"
  visible={visible}
  onClose={onClose}
  size="medium"
  closeOnBackdropClick={true}
  closeOnEscape={true}
>
  {content}
</Modal>
```

### Required Primitives

All modals must use: `Button`, `Input`, `Switch`, `Icon`, `Tooltip`, `Select` from `../primitives`

**Exception**: Keep ReactTooltip for file upload areas (conflicts with react-dropzone)

## CSS

- **Primitive styles**: `src/components/primitives/Modal/Modal.scss`
- **App styles**: `src/styles/_modal_common.scss`
- **Responsive classes**: `modal-buttons-responsive`, `modal-body`, `modal-width-medium`

## Related Files

| File | Purpose |
|------|---------|
| `src/components/context/ModalProvider.tsx` | ModalProvider system |
| `src/hooks/business/ui/useModalState.ts` | ModalProvider state |
| `src/hooks/business/ui/useModalManagement.ts` | Layout-Level state |
| `src/components/Layout.tsx` | Layout-Level rendering |

---

**Last Updated:** 2025-12-03
**Verified:** 2025-12-09 - File paths confirmed current