# Read-Only Channels with Role Managers

## Overview

Implement read-only channels where only space owners or users with designated "manager" roles can post, while all other users can only react to messages.

## Feature Requirements

### Core Functionality

- **Read-only toggle**: Channels can be marked as read-only in ChannelEditor
- **Role-based managers**: Any existing role can be designated as a manager for a read-only channel
- **Manager privileges**: Managers can post, delete, and pin messages in read-only channels
- **Everyone else**: Can only react to messages in read-only channels

### UI Design (ChannelEditor Modal)

```
Channel name: [input field]
Channel topic: [input field]

☐ Read only? [Select]

if selected it will show the below message in "text-xs" and the multiselect for managers:

"Select any existing role as managers for this channel. Managers have post, delete, and pin permissions on ANY message by default. If no managers are selected, only the Space owner can manage the channel."

Managers: [Multiselect with placeholder "Select Roles"]
```

- Use primitives: Icon, Tooltip, Select..

## Technical Implementation

### 1. Data Model Changes

```typescript
// Add to Channel type in src/api/quorumApi.ts
export type Channel = {
  channelId: string;
  spaceId: string;
  channelName: string;
  channelTopic: string;
  isReadOnly?: boolean;
  managerRoleIds?: string[]; // Roles that can manage this read-only channel
  // ... existing fields
};
```

### 2. Permission Logic (Separate System Approach)

Use a separate, simple system for read-only channels rather than extending the complex permission system:

```typescript
// Check if user can act in read-only channel
const isChannelManager =
  channel.isReadOnly &&
  userRoles.some((role) => channel.managerRoleIds?.includes(role.roleId));

const canPost = !channel.isReadOnly || isSpaceOwner || isChannelManager;
const canDelete = !channel.isReadOnly || isSpaceOwner || isChannelManager;
const canPin = !channel.isReadOnly || isSpaceOwner || isChannelManager;
```

### 3. Implementation Areas

#### UI Components to Update

- **ChannelEditor Modal**: Add read-only toggle and manager role selector
- **MessageComposer**: Disable input for non-managers in read-only channels
- **Channel List**: Show read-only indicator/badge
- **Message Actions**: Hide delete/pin buttons for non-managers

#### Logic Components to Update

- **useMessageComposer**: Check channel permissions before allowing sends
- **useChannelMessages**: Update delete/pin permission checks
- **Channel Component**: Pass read-only status to child components

#### Files to Modify

- `src/api/quorumApi.ts` - Channel type definition
- `src/components/channel/ChannelEditor.tsx` - Add read-only settings UI
- `src/components/message/MessageComposer.tsx` - Handle disabled state
- `src/hooks/business/messages/useMessageComposer.ts` - Permission checking
- `src/hooks/business/channels/useChannelMessages.ts` - Manager privilege checks

### 4. User Experience Features

- **Visual indicators**: Read-only badge on channel names
- **Clear messaging**: Placeholder text explaining why input is disabled
- **Tooltips**: Explain read-only status and who can post
- **Graceful fallback**: Non-managers see "You can only react to messages in this channel"

## Benefits

### Technical

- ✅ **Minimal disruption**: Separate system doesn't complicate existing permissions
- ✅ **Leverages existing roles**: No need to create new permission types
- ✅ **Simple logic**: Easy to understand and maintain
- ✅ **Cross-platform ready**: Uses existing primitive components

### User Experience

- ✅ **Flexible**: Any role can be designated as manager
- ✅ **Scalable**: Role-based approach works for large spaces
- ✅ **Intuitive**: Clear distinction between normal and read-only channels
- ✅ **Future-proof**: Foundation for more advanced channel permissions

## Implementation Notes

### Backwards Compatibility

- Default behavior: `isReadOnly: false` (all existing channels remain normal)
- No breaking changes to existing API or UI
- Graceful degradation for clients that don't support read-only channels

### Considerations

- **Space owner override**: Space owners can always post/delete/pin (existing behavior)
- **Reaction permissions**: All users can still react to messages
- **Manager inheritance**: Users get manager privileges through any assigned role that's designated as manager

## Future Enhancements

- **Individual user managers**: Option to designate specific users as managers
- **Granular permissions**: Different manager roles for different actions
- **Audit logging**: Track who performs actions in read-only channels
- **Templates**: Pre-defined read-only channel setups (announcements, etc.)

---

_Created: January 9, 2025_
_Priority: Medium_
_Complexity: Low-Medium_
_Impact: High (enables announcement channels, moderated discussions)_
