---
type: task
title: "Delete Confirmation System Implementation"
status: done
created: 2026-01-09
updated: 2025-09-13
---

# Delete Confirmation System Implementation

## Overview
Implement a unified confirmation system to provide consistent protection for delete operations across the application, addressing the current inconsistency between protected and unprotected delete actions.

## Problem Analysis

### Current State
- **No Protection**: Message delete (trash icon), SpaceEditor roles delete (trash icon)
- **Double-Click Protection**: ChannelEditor delete, GroupEditor delete, ConversationSettingsModal delete, SpaceEditor delete
- **Modal Protection**: Leave Space, Kick User

### Issues Identified
- Small trash icons lack confirmation, creating risk of accidental deletion
- Inconsistent UX patterns across similar delete operations
- Code duplication for confirmation state management
- No extensible system for future complex delete operations

## Proposed Solution

### 1. Core Architecture

**`useConfirmation` Hook**
- Global confirmation state management
- Support for multiple confirmation types (inline, modal, toast)
- Handles confirmation steps, timeouts, and state cleanup
- Consistent interface for any confirmation pattern

**`ConfirmationModal` Component**
- Reusable modal component with size options (small, medium, large)
- Configurable actions and variants (danger, warning, info)
- Cross-platform compatible with mobile gesture support

### 2. Confirmation Patterns

**Pattern A: Smart Inline Double-Click** (Existing ChannelEditor/SpaceEditor text link style AND LeaveSpaceModal/KickUserModal buttons style)
- Use case: Large buttons, with or without risk assessment
- Implementation: `useConfirmation({ type: 'inline' })` or `useConfirmation({ type: 'inline', escalateOnWarning: true })`
- **Smart Conditional Logic** (Channel/Group deletion only):
  - **Low Risk** (empty channel/group): Simple double-click confirmation (current UX)
  - **High Risk** (has messages/content): Automatically escalates to Pattern B modal
- **Standard Logic** (Leave Space, Kick User, etc.): Always simple double-click (no escalation)
- Maintains current UX for safe operations, adds protection only where data loss is possible

Can be applied both to simple links (existing ChannelEditor/SpaceEditor style), OR to buttons (existing LeaveSpaceModal/KickUserModal  style)

### 2.1. Smart Escalation Logic (Pattern A Enhancement)

**Current Implementation Analysis:**

**ChannelEditor Warning Logic (useChannelManagement.ts:73-89):**
```typescript
// Check if channel has messages
useEffect(() => {
  const checkMessages = async () => {
    if (channelId && messageDB) {
      try {
        const messages = await messageDB.getMessages({
          spaceId,
          channelId,
          limit: 1, // Just check if ANY messages exist
        });
        setHasMessages(messages.messages.length > 0);
      } catch (error) {
        console.error('Error checking messages:', error);
      }
    }
  };
  checkMessages();
}, [channelId, spaceId, messageDB]);
```
- **Low Risk**: Channel has 0 messages → Simple double-click
- **High Risk**: Channel has ≥1 message → Show warning + double-click

**GroupEditor Safety Logic (Enhanced Approach):**
```typescript
// ENHANCED: Check if group has ANY channels at all
useEffect(() => {
  const checkGroupSafety = async () => {
    if (groupName && space) {
      try {
        const group = space.groups.find((g) => g.groupName === groupName);
        if (group) {
          const hasChannels = group.channels.length > 0;
          setHasChannels(hasChannels);

          // Only check messages if there are channels
          if (hasChannels && messageDB) {
            for (const channel of group.channels) {
              const messages = await messageDB.getMessages({
                spaceId,
                channelId: channel.channelId,
                limit: 1,
              });
              if (messages.messages.length > 0) {
                setHasMessages(true);
                break;
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking group safety:', error);
      }
    }
  };
  checkGroupSafety();
}, [groupName, space, spaceId, messageDB]);
```

**New 3-Tier Safety Logic:**
- **SAFE**: Group has 0 channels → Allow simple double-click deletion
- **BLOCKED**: Group has ≥1 channels → **Prevent deletion entirely**, show instructional message
- **No longer applicable**: Message checking becomes irrelevant since channels must be deleted first

**ConversationSettingsModal Logic (Lines 105-147):**
```typescript
const handleDeleteClick = React.useCallback(async () => {
  if (confirmationStep === 0) {
    // First click - show confirmation
    setConfirmationStep(1);
    // Reset confirmation after 5 seconds
    const timeout = setTimeout(() => setConfirmationStep(0), 5000);
    setConfirmationTimeout(timeout);
  } else {
    // Second click - execute deletion
    await deleteConversation(conversationId);
    // Navigate away and close modal
  }
}, [confirmationStep, ...]);
```
- **Current**: Always uses double-click confirmation (no conditional logic)
- **Enhancement**: Should escalate to Pattern B modal to show warning text about local-only deletion

**SpaceEditor Delete Logic (Lines 279-291, 1046-1064):**
```typescript
// Delete Space tab only visible if:
{((spaceMembers && spaceMembers.length === 1) || space?.groups?.length === 0) && (
  <div onClick={() => setSelectedCategory('danger')}>Delete Space</div>
)}

// Delete button uses double-click confirmation:
onClick={() => {
  if (deleteConfirmationStep === 0) {
    setDeleteConfirmationStep(1);
    setTimeout(() => setDeleteConfirmationStep(0), 5000);
  } else {
    handleDeleteSpace();
  }
}}
```
- **Current**: Already safe - delete option only appears if space has 1 member OR 0 groups
- **Keep as-is**: Simple double-click confirmation (Pattern A) is appropriate

**Enhanced UX Pattern:**
```typescript
// Smart escalation logic for Channel deletion
const handleChannelDelete = (e: React.MouseEvent) => {
  if (hasMessages) {
    // HIGH RISK: Channel has ≥1 message → Pattern B modal
    showConfirmationModal({
      title: 'Delete Channel',
      message: 'This channel contains messages. All content will be lost forever!',
      preview: <ChannelMessagesPreview channelId={channelId} messageCount={messageCount} />,
      variant: 'danger'
    });
  } else {
    // LOW RISK: Channel has 0 messages → Current double-click UX
    handleInlineDoubleClick();
  }
};

// Enhanced safety logic for Group deletion
const handleGroupDelete = (e: React.MouseEvent) => {
  if (hasChannels) {
    // BLOCKED: Group contains channels → Show inline error message
    setBlockedError(`Cannot delete group. This group contains ${channelCount} channel(s). Please delete all channels first.`);
  } else {
    // SAFE: Group is empty (0 channels) → Simple double-click UX
    setBlockedError(''); // Clear any previous errors
    handleInlineDoubleClick();
  }
};

// In GroupEditor JSX:
{blockedError && (
  <div className="error-label mb-3 flex items-center">
    <Icon name="exclamation-triangle" className="mr-2" />
    {blockedError}
  </div>
)}
```

**Pattern B: Full Modal** (Discord-style confirmation)
- Use the Modal primitive and build the modal contents with our primitives if possible
 - Modal title: ActionName, e.g. "Delete Message"
 - Modal body: Text "Are you sure you want to ActionName", e.g. "Are you sure you want to delete this message?"
 - Modal TIP callout (required - text-sm with idea icon inside rounded borders container - icon and border area 'success' color class, see tailwind config ): "[icon] TIP: Hold down shift when clicking {action} to bypass this confirmation entirely."
 - Modal buttons: Cancel - Delete (buttons text can be customized, sometimes the "delete" is actually a confirmation, like when Pinning posts)
 - Content preview (optional - below everything else): Content preview, scrollable area using `<ScrollContainer height="sm">` primitive with the full content (e.g. message text, pinned posts, embedded media preview)

- Use case: Complex actions needing context/explanation
- Use for "delete message" action in Message.tsx and "pin/unpin message" action in Message.tsx PinnedMessagesPanel.tsx
- **Shift+Click Bypass**: Holding Shift while clicking the action button skips the modal entirely

**Pattern C: Inline Error Message** (New - for prevented operations)
- Show error message directly in the existing modal/interface
 - Error styling (red border, warning icon)
 - Clear explanation of why the action is blocked
 - Specific instructions on what needs to be done first
 - **No additional modal**: Error appears inline where user clicked

- Use case: Operations that cannot proceed due to dependencies
- **Primary use**: Group deletion when group contains channels → Show error in GroupEditor modal
- **Future uses**: Any operation requiring prerequisite cleanup
- **Much simpler**: No new modal component needed, just conditional error display


## Implementation Plan - Phase 2: Enhanced Confirmation System

**Focus**: Implement comprehensive system with content previews, Shift+click bypass, and smart escalation while keeping the API clean and maintainable.

### Step 1: Core Infrastructure (30 min)
- [ ] Create `useConfirmation` hook in `src/hooks/ui/useConfirmation.ts`
  - Clean API with smart escalation and blocking logic
  - Shift+click bypass detection for desktop users
  - State management for double-click, modal, and error states
- [ ] Build `ConfirmationModal` component in `src/components/modals/`
  - Discord-style layout with title, message, `<ScrollContainer height="sm">` for preview
  - PROTIP text: "Hold Shift when clicking [action] to bypass this confirmation"
  - Cancel/Confirm buttons with proper styling

### Step 2: Fix Unprotected Actions (45 min)
- [ ] **Message delete** - Add modal confirmation with preview
  - File: `MessageActions.tsx` (line ~203)
  - Show message text, attachments, timestamp in `<ScrollContainer height="sm">`
  - Include Shift+click bypass functionality

- [ ] **Role delete** - Add modal confirmation with details
  - File: `SpaceEditor.tsx` (line ~650)
  - Show role name, permissions, member count in `<ScrollContainer height="sm">`
  - Replace current unprotected trash icon

- [ ] **Pin/Unpin actions** - Add modal confirmation with post preview
  - Show post content, author, timestamp in `<ScrollContainer height="sm">`
  - Different modal titles: "Pin Message" vs "Unpin Message"

- [ ] **Conversation delete** - Upgrade to modal with warning
  - File: `ConversationSettingsModal.tsx` (replace double-click pattern)
  - Show local-only deletion warning
  - Include conversation partner info

### Step 3: Smart Escalation for Channel/Group Deletion (30 min)
- [ ] **ChannelEditor** - Add smart escalation
  - File: `ChannelEditor.tsx` - Replace existing double-click logic
  - Empty channels → Keep double-click UX
  - Channels with messages → Escalate to modal with message count + recent messages in `<ScrollContainer height="sm">`
  - Remove existing warning message (now handled by modal)

- [ ] **GroupEditor** - Add blocking logic with inline error
  - File: `GroupEditor.tsx` - Replace existing double-click logic
  - Empty groups → Keep double-click UX
  - Groups with channels → Block deletion + show inline error with channel list
  - Error: "Cannot delete group. Contains X channels: [channel names]. Delete channels first."

### Step 4: Testing & Polish (15 min)
- [ ] Test Shift+click bypass on desktop (Web app and Electron app)
- [ ] Verify all modals work properly on mobile (no Shift key behavior)
- [ ] Test smart escalation scenarios:
  - Empty channel deletion → double-click
  - Channel with messages → modal with preview
  - Group with channels → inline error + block
  - Empty group → double-click
- [ ] Ensure all preview components render correctly in modals

## Total Implementation Time: ~2 hours

## Key Benefits Delivered:
1. **Safety**: All unprotected delete actions now have confirmations
2. **Consistency**: Unified confirmation system across the app
3. **Power User Experience**: Shift+click bypass for desktop mods
4. **Smart UX**: Context-aware escalation (double-click vs modal vs blocked)
5. **Rich Previews**: Users see exactly what they're deleting
6. **Mobile-Friendly**: Works perfectly on touch devices (no Shift dependency)

## Technical Requirements

### Streamlined Hook Interface
```typescript
// Main hook - clean API with sensible defaults
interface UseConfirmationOptions {
  type: 'inline' | 'modal';

  // Smart escalation (Channel/Group deletion only)
  escalateWhen?: () => boolean; // When to escalate from inline to modal
  blockedWhen?: () => boolean;  // When to block with inline error

  // Modal configuration (when type='modal' or escalating)
  modalConfig?: {
    title: string;
    message: string;
    preview?: React.ReactNode;
    confirmText?: string;
    variant?: 'danger' | 'warning';
  };

  // Blocking error (Pattern C)
  blockedError?: string;
}

// Usage examples - much cleaner
const confirmDeleteChannel = useConfirmation({
  type: 'inline',
  escalateWhen: () => hasMessages,
  modalConfig: {
    title: 'Delete Channel',
    message: 'This channel contains messages. All content will be lost forever!',
    preview: <ChannelPreview channelId={channelId} />
  }
});

const confirmDeleteGroup = useConfirmation({
  type: 'inline',
  blockedWhen: () => hasChannels,
  blockedError: `Cannot delete group. Contains ${channelCount} channels. Delete channels first.`
});

const confirmDeleteMessage = useConfirmation({
  type: 'modal',
  modalConfig: {
    title: 'Delete Message',
    message: 'Are you sure you want to delete this message?',
    preview: <MessagePreview message={message} />
  }
});
```

### Hook Implementation Strategy
```typescript
// Hook returns clean interface
const useConfirmation = (options: UseConfirmationOptions) => {
  const [confirmationStep, setConfirmationStep] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [blockedError, setBlockedError] = useState('');

  const handleClick = (e: React.MouseEvent, onConfirm: () => void) => {
    // Check if operation should be blocked
    if (options.blockedWhen?.()) {
      setBlockedError(options.blockedError || 'Operation not allowed');
      return;
    }

    // Clear any previous errors
    setBlockedError('');

    // Check for Shift+click bypass (desktop only)
    if (e.shiftKey && options.type === 'modal') {
      onConfirm();
      return;
    }

    // Smart escalation logic
    if (options.type === 'inline' && options.escalateWhen?.()) {
      setShowModal(true);
      return;
    }

    // Handle based on type
    if (options.type === 'modal') {
      setShowModal(true);
    } else {
      // Pattern A: Double-click confirmation
      if (confirmationStep === 0) {
        setConfirmationStep(1);
        setTimeout(() => setConfirmationStep(0), 5000);
      } else {
        onConfirm();
        setConfirmationStep(0);
      }
    }
  };

  return {
    handleClick,
    confirmationStep,
    showModal,
    setShowModal,
    blockedError
  };
};
```

### Modal Component Props
```typescript
interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  preview?: React.ReactNode; // Optional content preview
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  size?: 'small' | 'medium' | 'large';
  showProtip?: boolean; // Show PROTIP text (default: true)
  protipAction?: string; // Action name for PROTIP text (e.g., "delete message")
  onConfirm: () => void;
  onCancel: () => void;
}
```

### Shift+Click Bypass Implementation
```typescript
// In the action handler
const handleDelete = (e: React.MouseEvent) => {
  if (e.shiftKey && confirmationOptions.skipOnShift) {
    // Skip confirmation, execute action directly
    performDelete();
  } else {
    // Show confirmation modal
    showConfirmation();
  }
};
```

## Files to Modify

### New Files
- `src/hooks/ui/useConfirmation.ts`
- `src/components/modals/ConfirmationModal.tsx`
- `src/components/modals/ConfirmationModal.native.tsx`

### Modified Files
- `src/components/message/MessageActions.tsx` - Add confirmation to delete
- `src/components/space/SpaceEditor.tsx` - Add confirmation to role delete, migrate existing
- `src/components/space/ChannelEditor.tsx` - Migrate existing confirmation

## Benefits

1. **Consistency**: All delete operations follow same patterns
2. **Safety**: No more accidental deletions from unprotected actions
3. **Extensibility**: Easy to add new confirmation types and complex actions
4. **Mobile-First**: Works perfectly on touch interfaces
5. **Maintainability**: Centralized confirmation logic, less code duplication
6. **Future-Proof**: Support for advanced features like batch operations

## Success Criteria

- [ ] All trash icons have appropriate confirmation
- [ ] Existing double-click patterns continue working unchanged
- [ ] Mobile users have proper touch targets for confirmations
- [ ] Code reduction through elimination of duplicate confirmation states
- [ ] System easily extensible for future complex delete operations

## Implementation Recommendations

### Pattern B Complexity Management

Given the complexity of Pattern B, here are the recommended approaches:

**1. Template-Based System (Recommended)**
Create pre-defined templates for common confirmation scenarios:

```typescript
enum ConfirmationTemplate {
  DELETE_MESSAGE = 'delete-message',
  DELETE_ROLE = 'delete-role',
  PIN_POST = 'pin-post',
  UNPIN_POST = 'unpin-post',
  CUSTOM = 'custom'
}

// Usage
useConfirmation({
  type: 'modal',
  template: ConfirmationTemplate.DELETE_MESSAGE,
  data: { message, channelName }
})
```

**2. Builder Pattern for Complex Cases**
For cases requiring custom configuration:

```typescript
const confirmation = useConfirmation()
  .setType('modal')
  .setTitle('Delete Message')
  .setMessage('Are you sure you want to delete this message?')
  .setPreview(<MessagePreview {...message} />)
  .setVariant('danger')
  .enableShiftBypass()
  .build();
```

### Key Implementation Points

1. **Shift+Click Bypass**
   - Must work on all Pattern B modals
   - Store user preference in localStorage
   - Show visual indicator when Shift is held (cursor change)

2. **PROTIP Text**
   - Always visible in Pattern B modals
   - Dynamically generated based on action
   - Format: "PROTIP: You can hold down shift when clicking {action} to bypass this confirmation entirely."

3. **Mobile Considerations**
   - No Shift key on mobile devices
   - Options:
     - Settings toggle: "Skip confirmations"
     - Long-press gesture for bypass
     - Swipe-to-delete with undo option

4. **Preview Content**
   - Scrollable area for long content
   - Support for:
     - Text messages
     - Embedded media (images, videos)
     - Code blocks
     - Role permissions lists

### Migration Strategy

1. **Keep Pattern A unchanged** - Existing double-click UX remains
2. **Apply Pattern B to all unprotected deletes** - Immediate safety improvement
3. **Gradual refactoring** - Move existing code to use new hook over time
4. **Monitor usage** - Track Shift+click usage to understand user preferences

---
