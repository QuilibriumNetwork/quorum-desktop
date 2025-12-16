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
  onConfirm: (days: number) => Promise<void>;  // days: 0 = forever, 1-365 = duration
  userName: string;
  userIcon?: string;
  userAddress: string;
  isUnmuting?: boolean;  // Controls mute vs unmute mode
}
```

**Duration Input** (V2):
- Numeric input field (0-365 days)
- `0` = mute forever (permanent until manually unmuted)
- `1-365` = mute for specified number of days (auto-expires)
- Default: 1 day
- Error-proof: Silent clamp to 0-365 range, non-numeric characters filtered

### useUserMuting (Business Logic Hook)

**Location**: `src/hooks/business/user/useUserMuting.ts`

**Purpose**: Encapsulates all mute/unmute business logic and network operations.

**Key Functions**:

#### `muteUser(targetUserId: string, days: number = 0)`

- Validates required parameters (spaceId, currentUser, targetUserId)
- Converts `days` to `duration` in milliseconds (0 = undefined for forever)
- Calculates `expiresAt` timestamp (timestamp + duration)
- Creates `MuteMessage` with unique `muteId`, timestamp, and optional `duration`
- Broadcasts via `submitChannelMessage`
- Stores locally in IndexedDB with `expiresAt` for immediate effect
- Invalidates React Query cache

#### `unmuteUser(targetUserId: string)`

- Same validation as muteUser
- Creates `MuteMessage` with `action: 'unmute'`
- Broadcasts and removes local mute record

**Return Values**:

```tsx
{
  muting: boolean;      // Loading state
  muteUser: (targetUserId: string, days?: number) => Promise<void>;
  unmuteUser: (targetUserId: string) => Promise<void>;
}
```

### useMutedUsers (Query Hook)

**Location**: `src/hooks/queries/mutedUsers/useMutedUsers.ts`

**Purpose**: React Query hook for fetching muted users list from IndexedDB.

```typescript
const { data: mutedUsers } = useMutedUsers({ spaceId });

// Check if user is muted (must also check expiration)
const muteRecord = mutedUsers?.find(m => m.targetUserId === userAddress);
const isMuted = muteRecord
  ? (!muteRecord.expiresAt || muteRecord.expiresAt > Date.now())
  : false;
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
  expiresAt?: number;    // V2: When mute expires (undefined = forever)
};

// Composite key: [spaceId, targetUserId]
// Indexes: by_space (spaceId), by_mute_id (lastMuteId)
```

### Database Methods

- `getMutedUsers(spaceId)`: Get all muted users in a space
- `isUserMuted(spaceId, userId)`: Check if specific user is muted (includes expiration check)
- `muteUser(spaceId, targetUserId, mutedBy, muteId, timestamp, expiresAt?)`: Add mute record
- `unmuteUser(spaceId, targetUserId)`: Remove mute record
- `getMuteByMuteId(muteId)`: For deduplication checks

## Message Types

**Location**: `src/api/quorumApi.ts`

```typescript
export type MuteMessage = {
  senderId: string;      // Who performed the mute/unmute
  type: 'mute';
  targetUserId: string;  // Who got muted/unmuted
  muteId: string;        // UUID for deduplication (replay protection)
  timestamp: number;     // For ordering/conflict resolution
  action: 'mute' | 'unmute';  // Mute or unmute action
  duration?: number;     // V2: Duration in milliseconds (undefined = forever)
};
```

**Note**: Mute and unmute now use the same `MuteMessage` type with an `action` field to distinguish between operations.

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

Muted users see a disabled composer with message showing remaining time:
- Timed mute: "You are muted for 3 days" / "You are muted for 24 hours"
- Forever mute: "You have been muted in this Space"

**Auto-Refresh**: When a timed mute expires, a `setTimeout` automatically invalidates the muted users cache, enabling the composer without requiring a page refresh.

**Helper Function**: `formatMuteRemaining(expiresAt)` in `src/utils/dateFormatting.ts`:
- Shows "X days" for mutes > 1 day remaining
- Shows "X hours" for mutes ≤ 1 day remaining
- Uses `Math.ceil` for user-friendly rounding (e.g., 23h 45m → "24 hours")

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
- `src/utils/canonicalize.ts` - Message canonicalization for mute (includes `duration`)
- `src/utils/dateFormatting.ts` - `formatMuteRemaining()` helper for time display
- `src/hooks/business/ui/useModalState.ts` - MuteUserTarget interface

## Known Limitations

### Space Owner Can Be Muted

Users with `user:mute` permission can mute the space owner. This differs from kick (where space owners are protected).

**Why**: The receiving side cannot verify space ownership - there's no `Space.ownerAddress` exposed to clients for privacy reasons. Adding owner protection would require exposing owner identity, which conflicts with the privacy-first design.

**Mitigation**: Space owners can assign themselves a role with `user:mute` permission and unmute themselves if muted by a moderator. This is an acceptable trade-off since:
- Space owners control role assignments
- The effect is temporary (reversible via self-unmute)
- Malicious moderators can be removed by the owner

### Mute Duration (V2 - Implemented)

Mute duration is now supported:
- **0 days** = Forever (permanent until manually unmuted)
- **1-365 days** = Timed mute (auto-expires after specified duration)

Duration is calculated client-side using `setTimeout`. Note: JS `setTimeout` max is ~24.8 days, but this is acceptable since users typically refresh/restart the app before then.

### Client-Enforced Only

Mute is enforced by each client independently. A malicious custom client could choose to ignore mute state and display muted users' messages. However, honest clients will still hide those messages.

## Comparison: Mute vs Kick

| Aspect | Mute | Kick |
|--------|------|------|
| **Enforcement** | Client-side (receiving validation) | Protocol-level (ED448 signed) |
| **Permission** | `user:mute` role permission | Space owner only |
| **Reversible** | Yes (unmute or auto-expires) | Requires re-invite |
| **Duration** | 0-365 days (0 = forever) | Permanent |
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
*Updated: 2025-12-16 (V2: Mute Duration Support)*
*Status: Production Ready*
*Cross-Platform: ✅ Web + Mobile Compatible*
