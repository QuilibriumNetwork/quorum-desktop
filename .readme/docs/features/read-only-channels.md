# Read-Only Channels Feature

## Overview
Read-only channels allow only space owners or users with designated "manager" roles to post messages, while all other users can only react. This enables announcement channels, moderated discussions, and controlled communication flows.

## Implementation Summary

### Data Model Changes

**Channel Type Extension (`src/api/quorumApi.ts`)**:
```typescript
export type Channel = {
  // ... existing fields
  isReadOnly?: boolean;           // Marks channel as read-only
  managerRoleIds?: string[];     // Roles that can manage this read-only channel
};
```

### Core Components Modified

#### 1. Channel Editor (`src/components/channel/ChannelEditor.tsx`)
- **Read-only toggle**: Switch component for enabling/disabling read-only mode
- **Manager role selector**: Multiselect dropdown for assigning manager roles
- **Explanatory text**: Clear description of manager permissions with proper line height (`lineHeight: '1.2'`)
- **UI spacing**: `mb-6` between explanation text and multiselect

#### 2. Channel Headers (`src/components/channel/Channel.tsx`)
**Visual indicators**:
- Lock icon for read-only channels: `<Icon name="lock" size="sm" className="text-subtle" />`
- Hashtag icon for normal channels: `<Icon name="hashtag" size="sm" className="text-subtle" />`
- **Styling differentiation**:
  - Channel name: `text-main font-medium`
  - Channel topic: `text-subtle font-light text-sm`
  - Separator: `text-subtle`
- **Layout**: Single-line with proper truncation using `gap-2` spacing

#### 3. Message Composer (`src/components/message/MessageComposer.tsx`)
**Disabled state for non-managers**:
```tsx
<div className="w-full items-center gap-2 ml-[11px] my-2 py-2 pl-4 pr-[6px] rounded-lg flex justify-start bg-chat-input">
  <Icon name="lock" size="xs" className="text-muted flex-shrink-0" />
  <span className="text-base font-normal" style={{ color: 'var(--color-field-placeholder)' }}>
    {disabledMessage || t`You cannot post in this channel`}
  </span>
</div>
```

#### 4. Channel List (`src/components/channel/ChannelGroup.tsx`)
**Icon display**:
- Read-only: `<Icon name="lock" size="xs" className="text-subtle" />`
- Normal: `<Icon name="hashtag" size="xs" className="text-subtle" />`

### Permission Logic

#### Helper Function (`src/components/channel/Channel.tsx`)
```typescript
function canPostInReadOnlyChannel(
  channel: Channel | undefined,
  userAddress: string | undefined,
  roles: Role[],
  isSpaceOwner: boolean
): boolean {
  if (!channel?.isReadOnly) return true;
  if (isSpaceOwner) return true;
  if (!channel.managerRoleIds || channel.managerRoleIds.length === 0) return false;
  if (!userAddress) return false;
  
  return roles.some(role => 
    channel.managerRoleIds?.includes(role.roleId) && 
    role.members.includes(userAddress)
  );
}
```

#### Hook Updates

**useChannelManagement (`src/hooks/business/channels/useChannelManagement.ts`)**:
- Extended `ChannelData` interface with `isReadOnly` and `managerRoleIds`
- Added handlers: `handleReadOnlyChange`, `handleManagerRolesChange`
- Returns `availableRoles` from space data

**useChannelMessages (`src/hooks/business/channels/useChannelMessages.ts`)**:
- Added `canManageReadOnlyChannel` helper function
- Updated `canDeleteMessages` and `canPinMessages` to respect read-only permissions
- Returns permission functions for message actions

### Design System Compliance

#### Styling Classes Used
- **Text hierarchy**: `text-main`, `text-subtle`, `text-muted` (no opacity values)
- **Font weights**: `font-medium`, `font-light`
- **Spacing**: `gap-2`, `mb-6`, `py-2`, `pl-4`
- **Background**: `bg-chat-input` (semantic Tailwind class)

#### Component Architecture
- **Primitives used**: `Icon`, `Switch`, `Select`, `Text`, `Container`
- **Cross-platform ready**: Uses existing primitive system
- **Mobile responsive**: Both desktop (`hidden lg:flex`) and mobile (`lg:hidden`) versions

## Permission Matrix

| User Type | Read-Only Channel Permissions |
|-----------|-------------------------------|
| **Space Owner** | ✅ Post, Delete, Pin, React |
| **Manager Role** | ✅ Post, Delete, Pin, React |
| **Regular User** | ❌ Post, Delete, Pin / ✅ React |

## Implementation Notes

### Message Actions Integration
The system integrates with existing message actions by:
1. Passing `canPinMessages` function through MessageList to Message components
2. Using conditional rendering: `canPinMessages !== undefined ? canPinMessages : pinnedMessages.canPinMessages`
3. Respecting both traditional permissions AND read-only channel permissions

### Interface Updates
**MessageDB Context (`src/components/context/MessageDB.tsx`)**:
- Updated `submitChannelMessage` interface to include optional `skipSigning?: boolean` parameter

### UI Behavior
- **Single-line headers**: Channel name and topic stay on one line with truncation
- **Proper spacing**: `gap-2` between header elements (icon, name, separator, topic)
- **Disabled messaging**: Clear "You cannot post in this channel" message with lock icon
- **Semantic styling**: Uses design system color classes instead of opacity values

## Key Benefits

### Technical
- **Minimal complexity**: Separate system doesn't interfere with existing permissions
- **Backwards compatible**: Default `isReadOnly: false` for existing channels
- **Type safe**: Proper TypeScript integration throughout

### User Experience  
- **Clear visual hierarchy**: Icons and styling clearly indicate channel status
- **Intuitive permissions**: Role-based system leverages existing space roles
- **Graceful degradation**: Non-managers see helpful messaging instead of broken UI

## Files Modified

### Core Implementation
- `src/api/quorumApi.ts` - Channel type definition
- `src/hooks/business/channels/useChannelManagement.ts` - Channel management logic
- `src/hooks/business/channels/useChannelMessages.ts` - Message permission logic
- `src/components/context/MessageDB.tsx` - Interface update

### UI Components  
- `src/components/channel/ChannelEditor.tsx` - Read-only settings UI
- `src/components/channel/Channel.tsx` - Header icons and permission integration
- `src/components/channel/ChannelGroup.tsx` - Channel list icons
- `src/components/message/MessageComposer.tsx` - Disabled state handling
- `src/components/message/Message.tsx` - Permission prop handling
- `src/components/message/MessageList.tsx` - Permission function passing

---

*Documentation created: September 11, 2025*  
*Implementation completed: Full feature with UI polish*  
*Status: Production ready*