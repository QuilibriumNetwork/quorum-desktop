# Mute User System Documentation

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: security-analyst agent

## Overview

The Mute User system allows moderators with `user:mute` permission to silence users in spaces. Unlike kick (which is space-owner only and protocol-enforced), mute is **client-enforced** through receiving-side validation - each client independently ignores messages from muted users. This provides effective moderation without requiring protocol-level changes.

## Architecture

### Component Structure

```
MuteUserModal (UI Component)
    ↓
useUserMuting (Business Logic Hook)
    ↓
submitChannelMessage (Network Broadcast)
    ↓
MessageService.addMessage (Receiving-Side Validation)
    ↓
IndexedDB (muted_users store)
```

### Key Design Principles

1. **Client-Enforced**: Each client validates mute permissions independently
2. **Receive-Side Validation**: Mute messages are validated when received, not when sent
3. **No Space Owner Bypass**: Space owners must have `user:mute` role permission (receiving side cannot verify owner status)
4. **Fail-Secure**: Reject mute when space data unavailable

## Components

### MuteUserModal (UI Component)

**Location**: `src/components/modals/MuteUserModal.tsx`

**Purpose**: Cross-platform modal UI for muting/unmuting users.

**Key Features**:
- ✅ **Single component for both modes** - Uses `isUnmuting` prop
- ✅ **Cross-platform compatible** - Uses only primitives (Container, Text, FlexRow, Button, Modal)
- ✅ **Error handling** - Shows errors via Callout component
- ✅ **Success feedback** - Button changes to "User Muted!/User Unmuted!" then auto-closes

**Props**:

```tsx
interface MuteUserModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  userName: string;
  userIcon?: string;
  userAddress: string;
  isUnmuting?: boolean;  // Controls mute vs unmute mode
}
```

### useUserMuting (Business Logic Hook)

**Location**: `src/hooks/business/user/useUserMuting.ts`

**Purpose**: Encapsulates all mute/unmute business logic and network operations.

**Key Functions**:

#### `muteUser(targetUserId: string)`

- Validates required parameters (spaceId, currentUser, targetUserId)
- Creates `MuteMessage` with unique `muteId` and timestamp
- Broadcasts via `submitChannelMessage`
- Stores locally in IndexedDB for immediate effect
- Invalidates React Query cache

#### `unmuteUser(targetUserId: string)`

- Same validation as muteUser
- Creates `UnmuteMessage` with unique `muteId` and timestamp
- Broadcasts and updates local state

**Return Values**:

```tsx
{
  muting: boolean;      // Loading state
  muteUser: (targetUserId: string) => Promise<void>;
  unmuteUser: (targetUserId: string) => Promise<void>;
}
```

### useMutedUsers (Query Hook)

**Location**: `src/hooks/queries/mutedUsers/useMutedUsers.ts`

**Purpose**: React Query hook for fetching muted users list from IndexedDB.

```typescript
const { data: mutedUsers } = useMutedUsers({ spaceId });
const isMuted = mutedUsers?.some(m => m.targetUserId === userAddress);
```

## Data Flow

### Muting a User

```
1. User clicks "Mute" in UserProfile
    ↓
2. MuteUserModal opens for confirmation
    ↓
3. User confirms → useUserMuting.muteUser() called
    ↓
4. MuteMessage created with unique muteId + timestamp
    ↓
5. Message broadcast via submitChannelMessage (network)
    ↓
6. Local IndexedDB updated immediately (muted_users store)
    ↓
7. React Query cache invalidated → UI updates
```

### Receiving Mute Messages

```
1. MessageService.addMessage receives mute message
    ↓
2. Validation checks:
   - Reject if DM (mute is Space-only)
   - Reject if self-mute (sender === target)
   - Reject if space data unavailable (fail-secure)
   - Reject if sender lacks user:mute permission
   - Reject if duplicate muteId (replay protection)
    ↓
3. Store in IndexedDB muted_users table
    ↓
4. Invalidate mutedUsers query cache
```

### Filtering Muted Users' Messages

```
1. MessageService.addMessage receives any message
    ↓
2. Check if sender is muted in this space
    ↓
3. If muted: Drop message silently (never added to UI cache)
    ↓
4. If not muted: Process message normally
```

## Database Schema

### muted_users Store (IndexedDB)

**Location**: `src/db/messages.ts` (DB version 5)

```typescript
type MutedUserRecord = {
  spaceId: string;       // Space where user is muted
  targetUserId: string;  // User who is muted
  mutedAt: number;       // Timestamp when muted
  mutedBy: string;       // User who performed the mute
  lastMuteId: string;    // For deduplication/replay protection
};

// Composite key: [spaceId, targetUserId]
// Indexes: by_space (spaceId), by_mute_id (lastMuteId)
```

### Database Methods

- `getMutedUsers(spaceId)`: Get all muted users in a space
- `isUserMuted(spaceId, userId)`: Check if specific user is muted
- `muteUser(spaceId, targetUserId, mutedBy, muteId, timestamp)`: Add mute record
- `unmuteUser(spaceId, targetUserId)`: Remove mute record
- `getMuteByMuteId(muteId)`: For deduplication checks

## Message Types

**Location**: `src/api/quorumApi.ts`

```typescript
export type MuteMessage = {
  senderId: string;      // Who performed the mute
  type: 'mute';
  targetUserId: string;  // Who got muted
  muteId: string;        // UUID for deduplication (replay protection)
  timestamp: number;     // For ordering/conflict resolution
};

export type UnmuteMessage = {
  senderId: string;      // Who performed the unmute
  type: 'unmute';
  targetUserId: string;  // Who got unmuted
  muteId: string;        // UUID for deduplication
  timestamp: number;     // For ordering/conflict resolution
};
```

## Permission Integration

### UI Permission Checking

**Location**: `src/utils/channelPermissions.ts`

```typescript
canMuteUser(): boolean {
  const { channel } = this.context;

  // NOTE: NO isSpaceOwner bypass - receiving side can't verify owner status
  // Space owners must assign themselves a role with user:mute permission

  // 1. Read-only channels: Only managers can mute
  if (channel?.isReadOnly) {
    return this.isReadOnlyChannelManager();
  }

  // 2. Regular channels: Check for user:mute permission via roles
  return this.hasTraditionalRolePermission('user:mute');
}
```

### Receiving-Side Permission Validation

**Location**: `src/services/MessageService.ts`

```typescript
// Check permission - sender must have user:mute via roles
const hasPermission = space.roles?.some(
  (role) =>
    role.members?.includes(muteContent.senderId) &&
    role.permissions?.includes('user:mute')
);

if (!hasPermission) {
  return; // Reject silently
}
```

## UI Behavior

### UserProfile Button States

**Location**: `src/components/user/UserProfile.tsx`

| Context | User State | Button Shown |
|---------|------------|--------------|
| Viewing others | Not muted | "Mute" (volume-off icon) |
| Viewing others | Muted | "Unmute" (volume icon) |
| Own profile | Not muted | Hidden (prevent self-muting) |
| Own profile | Muted | "Unmute" (can unmute self) |

### MessageComposer for Muted Users

**Location**: `src/components/space/Channel.tsx`

Muted users see a disabled composer with message:
> "You have been muted in this Space"

## Security Considerations

### Implemented Mitigations

| Threat | Mitigation |
|--------|------------|
| Replay attacks | `muteId` + deduplication check |
| Race conditions | Timestamp-based last-write-wins |
| Unauthorized mute | Receiving-side permission validation |
| Cross-space leaks | Per-space scoping with spaceId |
| Space owner bypass | No isSpaceOwner bypass (can't verify on receive) |
| Self-mute DoS | Self-mute rejected |

### Design Decisions

- **No public announcements**: Other users don't see "X was muted" messages (prevents harassment)
- **Muted user feedback**: They see disabled composer - clear notification without public shaming
- **Consistent enforcement**: Both sending and receiving sides check permissions

## Related Files

### Core Implementation
- `src/hooks/business/user/useUserMuting.ts` - Business logic hook
- `src/hooks/queries/mutedUsers/` - React Query hooks
- `src/components/modals/MuteUserModal.tsx` - UI modal
- `src/services/MessageService.ts` - Receive-side validation
- `src/db/messages.ts` - Database layer

### Permission System
- `src/utils/channelPermissions.ts` - canMuteUser method
- `src/api/quorumApi.ts` - Permission and message types
- `src/components/modals/SpaceSettingsModal/Roles.tsx` - Role management UI

### UI Integration
- `src/components/user/UserProfile.tsx` - Mute/unmute button
- `src/components/space/Channel.tsx` - MessageComposer disabled state
- `src/components/context/ModalProvider.tsx` - Modal state management

### Supporting Files
- `src/utils/canonicalize.ts` - Message canonicalization for mute/unmute
- `src/hooks/business/ui/useModalState.ts` - MuteUserTarget interface

## Known Limitations

### Space Owner Can Be Muted

Users with `user:mute` permission can mute the space owner. This differs from kick (where space owners are protected).

**Why**: The receiving side cannot verify space ownership - there's no `Space.ownerAddress` exposed to clients for privacy reasons. Adding owner protection would require exposing owner identity, which conflicts with the privacy-first design.

**Mitigation**: Space owners can assign themselves a role with `user:mute` permission and unmute themselves if muted by a moderator. This is an acceptable trade-off since:
- Space owners control role assignments
- The effect is temporary (reversible via self-unmute)
- Malicious moderators can be removed by the owner

### No Mute Duration

Currently mute is permanent until manually unmuted. There's no time-based auto-unmute feature (planned for V2).

### Client-Enforced Only

Mute is enforced by each client independently. A malicious custom client could choose to ignore mute state and display muted users' messages. However, honest clients will still hide those messages.

## Comparison: Mute vs Kick

| Aspect | Mute | Kick |
|--------|------|------|
| **Enforcement** | Client-side (receiving validation) | Protocol-level (ED448 signed) |
| **Permission** | `user:mute` role permission | Space owner only |
| **Reversible** | Yes (unmute) | Requires re-invite |
| **Effect** | Messages hidden from others | User removed from space |
| **Visibility** | Silent (user knows via disabled composer) | Visible kick message |
| **Space owner bypass** | No (can't verify on receive) | Yes (protocol verifies) |

## Related Documentation

- **[Kick User System](./kick-user-system.md)** - Protocol-enforced user removal
- **[Space Permissions Architecture](../space-permissions/space-permissions-architecture.md)** - Permission system overview
- **[Space Roles System](../space-permissions/space-roles-system.md)** - Role-based permissions
- **[Security Architecture](./security.md)** - Defense-in-depth validation

---

*Created: 2025-12-15*
*Status: Production Ready*
*Cross-Platform: ✅ Web + Mobile Compatible*
