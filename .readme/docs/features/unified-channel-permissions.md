# Unified Channel Permission System

## Overview

The unified channel permission system provides a consistent, hierarchical approach to managing permissions across all channel types. It addresses the complex interactions between space owners, traditional roles, and read-only channel managers.

## Key Principles

### 1. Clear Permission Hierarchy
```
1. Space Owner (highest) → ALL permissions everywhere
2. Own Messages → Users can always manage their own messages  
3. Read-Only Channel Managers → ALL permissions in their managed channels ONLY
4. Traditional Roles → Permissions in regular channels based on role assignments
```

### 2. Read-Only Channel Isolation
**Critical Feature**: Read-only channels have completely isolated permissions, separate from the traditional role system.

- Users with traditional roles (delete, pin, etc.) have **NO permissions** in read-only channels unless they are managers
- Only space owners and designated managers can perform actions in read-only channels
- Traditional role permissions are **ignored** in read-only channels

### 3. Unified API
All permission checks go through a single, consistent API that handles edge cases and conflicts automatically.

## Architecture

### Core Classes

#### `UnifiedPermissionSystem`
Central permission checking engine that handles all permission types consistently.

```typescript
class UnifiedPermissionSystem {
  canDeleteMessage(message: MessageType): boolean
  canPinMessage(message: MessageType): boolean  
  canPostMessage(): boolean
  canKickUser(): boolean
}
```

#### `PermissionContext`
Encapsulates all context needed for permission decisions:

```typescript
interface PermissionContext {
  userAddress: string;
  isSpaceOwner: boolean;
  space: Space | undefined;
  channel: Channel | undefined;
  message?: MessageType;
}
```

### Factory Function
```typescript
const permissionChecker = createChannelPermissionChecker(context);
```

## Permission Logic Details

### Delete Permissions

#### Regular Channels:
1. Own messages → ✅ Always allowed
2. Space owner → ✅ Can delete ANY message  
3. Traditional delete role → ✅ Can delete ANY message

#### Read-Only Channels:
1. Own messages → ✅ Always allowed
2. Space owner → ✅ Can delete ANY message
3. Manager → ✅ Can delete ANY message
4. Traditional delete role → ❌ **NO permissions** (isolated system)

### Pin Permissions

#### Regular Channels:
1. Space owner → ✅ Can pin ANY message
2. Traditional pin role → ✅ Can pin ANY message

#### Read-Only Channels:
1. Space owner → ✅ Can pin ANY message
2. Manager → ✅ Can pin ANY message
3. Traditional pin role → ❌ **NO permissions** (isolated system)

### Post Permissions

#### Regular Channels:
- Everyone can post (no restrictions)

#### Read-Only Channels:
1. Space owner → ✅ Can post
2. Manager → ✅ Can post
3. Everyone else → ❌ Cannot post (even with traditional roles)

### Kick Permissions
- Space-wide permission (not channel-specific)
- Space owner → ✅ Can kick anyone
- Traditional kick role → ✅ Can kick users
- Read-only managers → ❌ **NO kick permissions** (channel managers ≠ space managers)

## Edge Cases Handled

### 1. Space Owner + Manager Role
**Scenario**: Space owner is also assigned as a read-only channel manager.
**Result**: Space owner privileges take precedence (no conflict).

### 2. Manager + Traditional Roles
**Scenario**: User has manager role AND traditional delete/pin roles.
**Result**: 
- In read-only channels → Manager privileges apply
- In regular channels → Traditional role privileges apply
- No conflicts or unexpected behavior

### 3. Multiple Traditional Roles
**Scenario**: User has multiple roles with different permissions.
**Result**: User gets the union of all permissions from their roles.

### 4. Manager Role Outside Managed Channel
**Scenario**: Read-only channel manager tries to use permissions in other channels.
**Result**: Manager status only applies to their specific managed channel(s).

## Implementation Files

### Core System
- `src/utils/channelPermissions.ts` - Unified permission system implementation
- `src/utils/channelPermissions.test.ts` - Comprehensive test suite

### Integration Points
- `src/hooks/business/channels/useChannelMessages.ts` - Channel message permissions
- `src/hooks/business/messages/usePinnedMessages.ts` - Pin permission checks  
- `src/components/channel/Channel.tsx` - Post permission checks
- `src/components/context/MessageDB.tsx` - Message processing permissions

## Migration from Old System

### Before (Fragmented)
```typescript
// Different permission logic in each component
if (isSpaceOwner) return true;
if (channel?.isReadOnly) {
  // Custom manager logic
}
return hasPermission(user, 'delete', space, isSpaceOwner);
```

### After (Unified)
```typescript
const checker = createChannelPermissionChecker(context);
return checker.canDeleteMessage(message);
```

## Benefits

### 1. Consistency
- Single source of truth for all permission logic
- Identical behavior across all components
- No more permission logic duplication

### 2. Maintainability  
- Centralized logic is easier to modify and debug
- Clear separation of concerns
- Comprehensive test coverage

### 3. Edge Case Safety
- Handles complex role interactions automatically
- Prevents permission conflicts
- Predictable behavior in all scenarios

### 4. Read-Only Channel Isolation
- Implements the critical requirement that read-only channels are separate from traditional roles
- Users with traditional permissions cannot bypass read-only restrictions
- Clear distinction between channel managers and traditional role holders

## Testing

The system includes comprehensive tests covering:
- All basic permission scenarios
- Complex edge cases with multiple roles
- Permission hierarchy validation
- Read-only channel isolation
- Space owner privilege precedence

Run tests with:
```bash
npm test channelPermissions.test.ts
```

## Future Enhancements

### Possible Extensions
1. **Role Inheritance**: More complex role hierarchies
2. **Time-based Permissions**: Temporary manager assignments  
3. **Channel-specific Traditional Roles**: Hybrid approach if needed
4. **Audit Logging**: Track permission checks for debugging

### Backwards Compatibility
The system maintains compatibility with existing `hasPermission` calls through a deprecated wrapper function, allowing gradual migration.

---

**Status**: ✅ Fully Implemented and Tested  
**Priority**: Core Architecture - Critical for Permission System Integrity  
**Last Updated**: 2025-09-11