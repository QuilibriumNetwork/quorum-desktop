# Delete Confirmation System

## Overview

The delete confirmation system provides unified protection for all delete operations across the application. It implements smart escalation logic, content previews, and consistent UX patterns to prevent accidental deletions while maintaining good user experience.

## Architecture

### Core Components

**useConfirmation Hook** (`src/hooks/ui/useConfirmation.ts`)
- Manages confirmation state and logic
- Supports inline double-click and modal confirmations
- Handles smart escalation and blocking conditions
- Includes Shift+click bypass for desktop users

**ConfirmationModal** (`src/components/modals/ConfirmationModal.tsx`)
- Cross-platform modal component with web/native variants
- Scrollable content preview area using `ScrollContainer`
- PROTIP text for Shift+click bypass (desktop only)
- Configurable buttons, variants, and sizing

**Preview Components**
- `MessagePreview.tsx` - Shows message content, author, timestamp
- `RolePreview.tsx` - Displays role name, member count, permissions  
- `ChannelPreview.tsx` - Shows channel name and message count

**Layout Integration**
- `ConfirmationModalProvider.tsx` - Context provider for layout-level modal rendering
- Integrated into main Layout to fix z-index stacking issues

## Confirmation Patterns

### Pattern A: Inline Double-Click
- **Use case**: Large buttons/links with low-medium risk
- **Behavior**: First click shows "Click again to confirm", second click executes
- **Timeout**: 5 seconds to reset confirmation state
- **Example**: Empty channel deletion, space deletion

### Pattern B: Modal Confirmation  
- **Use case**: High-risk operations requiring context
- **Features**: Title, message, content preview, action buttons
- **Shift bypass**: Hold Shift+click to skip modal (desktop only)
- **PROTIP**: Shows bypass hint on desktop
- **Example**: Message deletion, role deletion

### Pattern C: Blocked Operations
- **Use case**: Operations that cannot proceed due to dependencies
- **Behavior**: Shows inline error message, prevents action
- **Example**: Group deletion when channels exist

## Smart Escalation Logic

The system automatically chooses the appropriate confirmation level:

```typescript
// Channel Deletion
- Empty channel (0 messages) → Double-click confirmation
- Channel with messages → Modal with content preview

// Group Deletion  
- Empty group (0 channels) → Double-click confirmation
- Group with channels → Blocked with error message

// Role Deletion
- Always → Modal with role details preview
```

## Implementation Example

```typescript
// Basic usage
const deleteConfirmation = useConfirmation({
  type: 'modal',
  enableShiftBypass: false,
  modalConfig: {
    title: t`Delete Role`,
    message: t`Are you sure you want to delete this role?`,
    preview: React.createElement(RolePreview, { role }),
    confirmText: t`Delete`,
    variant: 'danger'
  }
});

// In component
const handleDelete = (e: React.MouseEvent) => {
  deleteConfirmation.handleClick(e, () => {
    // Perform actual deletion
    performDelete();
  });
};

// Render confirmation modal
{deleteConfirmation.showModal && deleteConfirmation.modalConfig && (
  <ConfirmationModal
    visible={deleteConfirmation.showModal}
    {...deleteConfirmation.modalConfig}
    onCancel={() => deleteConfirmation.setShowModal(false)}
  />
)}
```

## Key Features

### Content Previews
- **ScrollContainer**: Used for long content with `height="sm"`
- **Rich content**: Shows exactly what will be deleted
- **Consistent styling**: Matches app's design system

### Cross-Platform Support
- **Desktop**: Full modal with Shift+click bypass
- **Mobile**: Streamlined modal without bypass features
- **Electron**: Desktop behavior with proper event handling

### Layout-Level Rendering
- Modals render at layout level to fix z-index issues
- Provider pattern allows any component to show confirmations
- Proper stacking above navigation menus

## Current Usage

**Protected Operations:**
- Message deletion (modal with preview)
- Role deletion (modal with details)
- Channel deletion (smart escalation)
- Group deletion (blocking when has channels)
- Conversation deletion (modal with warning)
- Pin/Unpin operations (modal with preview)

**Integration Points:**
- `useRoleManagement.ts` - Role deletion in SpaceEditor
- `useMessageActions.ts` - Message deletion 
- `usePinnedMessages.ts` - Pin/Unpin operations
- `useChannelManagement.ts` - Channel deletion
- `ConversationSettingsModal.tsx` - Conversation deletion

## Configuration Options

```typescript
interface UseConfirmationOptions {
  type: 'inline' | 'modal';
  escalateWhen?: () => boolean;    // Smart escalation trigger
  blockedWhen?: () => boolean;     // Block operation trigger  
  enableShiftBypass?: boolean;     // Allow Shift+click bypass
  doubleClickTimeout?: number;     // Timeout for double-click (default: 5s)
  modalConfig?: {
    title: string;
    message: string;
    preview?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
  };
  blockedError?: string;           // Error message when blocked
}
```

## Files Structure

```
src/
├── hooks/ui/
│   └── useConfirmation.ts           # Core confirmation logic
├── components/
│   ├── modals/
│   │   ├── ConfirmationModal.tsx    # Web modal component  
│   │   └── ConfirmationModal.native.tsx # Mobile modal component
│   ├── context/
│   │   └── ConfirmationModalProvider.tsx # Context provider
│   ├── message/
│   │   └── MessagePreview.tsx       # Message preview component
│   ├── role/  
│   │   └── RolePreview.tsx         # Role preview component
│   └── channel/
│       └── ChannelPreview.tsx      # Channel preview component
└── hooks/business/
    ├── spaces/useRoleManagement.ts  # Role deletion usage
    ├── messages/useMessageActions.ts # Message deletion usage
    └── messages/usePinnedMessages.ts # Pin/Unpin usage
```

---

*Created: 2025-09-13*