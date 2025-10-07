# Space Roles System

## Overview

The space roles system provides **space-wide, role-based access control** for traditional permissions in Quorum spaces. This system allows space owners to delegate specific capabilities to members through assignable roles with defined permissions. Roles operate across all regular channels within a space but are isolated from read-only channel permissions.

## Core Architecture

### Role Data Structure

```typescript
export type Role = {
  roleId: string; // Unique identifier (crypto.randomUUID())
  displayName: string; // Human-readable name shown in UI
  roleTag: string; // Short identifier (e.g., @moderator)
  color: string; // Visual color for role display
  members: string[]; // Array of user addresses with this role
  permissions: Permission[]; // Array of permissions granted
};

export type Permission = 'message:delete' | 'message:pin' | 'user:kick';
```

### Permission Types

#### **`message:delete`**

- **Scope**: Delete any message in regular channels
- **UI Integration**: Controls delete button visibility in message actions
- **Processing**: Validated by `MessageService` for message removal operations (interacting with MessageDB for persistence)
- **Restrictions**: Does not work in read-only channels (isolation principle)

#### **`message:pin`**

- **Scope**: Pin/unpin any message in regular channels
- **UI Integration**: Controls pin button visibility and pin management panels
- **Processing**: Validated through pinning mutation hooks
- **Restrictions**: Does not work in read-only channels (isolation principle)

#### **`user:kick`**

- **Scope**: Remove users from the entire space
- **UI Integration**: Controls kick button in user profiles
- **Processing**: Multi-layer validation with space owner protection
- **Protection**: Cannot kick space owners (enforced at all levels)

## Permission Enforcement

### Space Owner Override System

**Critical Principle**: Space owners automatically have all **UI permissions** regardless of role assignments.

**⚠️ Important Limitation**: Space owner processing permissions are NOT implemented - delete buttons appear but do nothing.

```typescript
// Core permission checking pattern
export function hasPermission(
  userAddress: string,
  permission: Permission,
  space: Space | undefined,
  isSpaceOwner: boolean = false
): boolean {
  // Space owners always have all permissions
  if (isSpaceOwner) return true;

  // Check role-based permissions
  return (
    space?.roles?.some(
      (role) =>
        role.members.includes(userAddress) &&
        role.permissions.includes(permission)
    ) || false
  );
}
```

### Multi-Role Permission Accumulation

Users can have multiple roles simultaneously, with permissions accumulated across all roles:

```typescript
// Get all permissions for a user
export function getUserPermissions(
  userAddress: string,
  space: Space | undefined,
  isSpaceOwner: boolean = false
): Permission[] {
  if (isSpaceOwner) {
    return ['message:delete', 'message:pin', 'user:kick'];
  }

  const permissions = new Set<Permission>();
  space?.roles?.forEach((role) => {
    if (role.members.includes(userAddress)) {
      role.permissions.forEach((p) => permissions.add(p));
    }
  });

  return Array.from(permissions);
}
```

### Enforcement Locations

#### **UI Level Enforcement**

- **Message Actions**: Delete/pin buttons shown based on `hasPermission()` checks
- **User Profiles**: Kick buttons controlled by permission + space owner protection
- **Role Management**: Role assignment UI restricted to space owners

#### **Processing Level Enforcement**

- **MessageService Operations**: Server-side validation for delete operations (role-based only, space owners NOT implemented), interacting with MessageDB for persistence.
- **Pinning System**: Permission checks in mutation hooks (role-based only, space owners NOT implemented)
- **User Management**: Multi-layer kick protection system (including space owner protection), handled by `SpaceService`.

## Role Management Components

### Core Management Hooks

#### **`useRoleManagement`** (`src/hooks/business/spaces/useRoleManagement.ts`)

```typescript
export interface UseRoleManagementReturn {
  roles: Role[];
  setRoles: (roles: Role[]) => void;
  addRole: () => void;
  deleteRole: (index: number) => void;
  updateRoleTag: (index: number, roleTag: string) => void;
  updateRoleDisplayName: (index: number, displayName: string) => void;
  toggleRolePermission: (index: number, permission: Permission) => void;
  updateRolePermissions: (index: number, permissions: Permission[]) => void;
}
```

**Features**:

- Complete CRUD operations for role management
- Real-time permission toggling with multiselect support
- Automatic role ID generation using `crypto.randomUUID()`
- Validation preventing empty role names/tags

#### **`useUserRoleManagement`** (`src/hooks/business/user/useUserRoleManagement.ts`)

- User-role assignment operations with immediate UI updates
- Multi-role assignment support
- Real-time role change reflection across the application

### UI Components

#### **SpaceSettingsModal Role Management**

**Location**: `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`

**Features**:

- **Role Creation**: Add new roles with custom names, tags, and colors
- **Permission Assignment**: Multiselect dropdown for all available permissions
- **Role Editing**: Inline editing of role properties
- **Role Deletion**: Remove roles with automatic user unassignment
- **Validation**: Prevents saving roles with empty required fields

**Permission UI**:

```typescript
// Multiselect permission interface
<Select
  value={role.permissions}
  options={[
    { value: 'message:delete', label: 'Delete Messages' },
    { value: 'message:pin', label: 'Pin Messages' },
    { value: 'user:kick', label: 'Kick Users' }
  ]}
  onChange={(perms) => updateRolePermissions(index, perms as Permission[])}
  multiple={true}
  placeholder="Select Permissions"
/>
```

#### **UserProfile Role Assignment**

**Location**: `src/components/user/UserProfile.tsx`

**Features**:

- **Role Assignment**: Assign available space roles to users
- **Role Removal**: Remove assigned roles from users
- **Multi-Role Display**: Show all roles assigned to a user
- **Permission-Based Actions**: Show/hide action buttons based on permissions

## Security and Protection Systems

### Space Owner Protection

**Multi-Layer Kick Protection System**:

1. **UI Layer**: Kick buttons hidden for space owners using `canKickUser()`
2. **Permission Layer**: `hasPermission()` considers target user protection
3. **Processing Layer**: `SpaceService` server-side validation prevents space owner kicks (interacting with MessageDB for persistence)

```typescript
export function canKickUser(targetUserAddress: string, space: Space): boolean {
  if (!space) return false;
  // Prevent kicking space owners (critical security feature)
  if (space.ownerAddress === targetUserAddress) return false;
  return true;
}
```

**Protection Ensures**:

- Space owners maintain permanent control over their spaces
- Prevents privilege escalation attacks
- Multiple validation layers for security depth

### Permission Validation Strategy

**Defense in Depth Approach**:

- **UI Controls**: Prevent unauthorized action attempts
- **Business Logic**: Validate permissions in hooks and utilities
- **Server Validation**: Final authorization in relevant services (e.g., `MessageService`, `SpaceService`) exposed via `MessageDB Context`.
- **Space Owner Priority**: Owners bypass all permission checks

## Integration with Permission Architecture

### Relationship to Read-Only Channels

**Isolation Principle**: Traditional space roles **do not work** in read-only channels.

- **Regular Channels**: Space roles provide full permissions
- **Read-Only Channels**: Space roles are ignored, only managers have permissions
- **Architectural Separation**: Two completely independent permission systems

### Processing Integration

**Service-Oriented Validation Pattern (via MessageDB Context)**:

The logic for validating and processing messages (e.g., deletion) is now encapsulated within specialized services (e.g., `MessageService`, `SpaceService`) exposed via `MessageDB Context`. These services interact with the low-level `MessageDB` (`src/db/messages.ts`) for data access.

```typescript
// Example: Delete message processing (orchestrated by a service)
if (spaceId != channelId) {
  // Service would fetch space data
  const space = await messageDB.getSpace(spaceId); // Internal call within a service

  // For read-only channels: isolated manager system
  if (channel?.isReadOnly) {
    const isManager = /* manager role check */;
    if (isManager) {
      // Service would call messageDB.deleteMessage()
      await messageDB.deleteMessage(messageId);
      return;
    }
    return; // Block traditional roles
  }

  // For regular channels: traditional role system
  if (!space?.roles.find(r =>
    r.members.includes(senderId) &&
    r.permissions.includes('message:delete')
  )) {
    return;
  }
  // Service would call messageDB.deleteMessage()
  await messageDB.deleteMessage(messageId);
}
```

## Current Implementation Status

### ✅ Fully Implemented

- **Message Deletion**: Role-based delete permissions working in regular channels
- **Message Pinning**: Role-based pin permissions with proper UI integration
- **User Kicking**: Complete kick system with space owner protection
- **Role Management**: Full CRUD operations with sophisticated UI
- **Multi-Role Support**: Users can have multiple roles with accumulated permissions

### ⚠️ Known Limitations

- **Mixed Enforcement Patterns**: Some areas use direct role checks instead of `hasPermission()`
- **Incomplete Server Validation**: Not all permission checks have full server-side enforcement
- **Limited Permission Scope**: Only covers basic moderation, not channel/space management

## Future Enhancement Opportunities

### Permission System Expansion

**Additional Message Permissions**:

```typescript
type Permission =
  | 'message:delete' // ✅ IMPLEMENTED
  | 'message:pin' // ✅ IMPLEMENTED
  | 'message:edit' // Future: Allow editing others' messages
  | 'message:react'; // Future: Control reaction permissions
```

**Channel Management Permissions**:

```typescript
type Permission =
  | 'channel:create' // Create new channels
  | 'channel:edit' // Modify channel settings
  | 'channel:delete' // Remove channels
  | 'channel:manage_permissions'; // Set channel-specific permissions
```

**Space Management Permissions**:

```typescript
type Permission =
  | 'space:edit_settings' // Modify space settings
  | 'space:manage_emojis' // Add/remove custom emojis
  | 'space:manage_stickers' // Add/remove custom stickers
  | 'space:generate_invites'; // Create invite links
```

### Role Hierarchy System

**Proposed Enhancement**:

```typescript
export type Role = {
  roleId: string;
  displayName: string;
  roleTag: string;
  color: string;
  members: string[];
  permissions: Permission[];
  hierarchy: number; // Priority level (higher = more authority)
  inheritsFrom?: string[]; // Inherit permissions from other roles
};
```

**Benefits**:

- **Role Inheritance**: Admin roles automatically include moderator permissions
- **Conflict Resolution**: Clear priority system for role conflicts
- **Simplified Management**: Templates and inheritance reduce configuration complexity

### Advanced Features

**Role Templates**:

- Predefined role configurations (Admin, Moderator, Member)
- Quick setup for common permission sets
- Customizable per space

**Audit and Logging**:

- Track all permission-based actions
- Role assignment/removal history
- Compliance and security audit capabilities

## Development Guidelines

### Working with Space Roles

1. **Use `hasPermission()` utility**: Prefer centralized permission checking
2. **Consider space owner override**: Always account for space owner privileges
3. **Respect read-only isolation**: Don't expect space roles to work in read-only channels
4. **Implement defense in depth**: UI controls + business logic + server validation

### Adding New Permissions

1. **Extend Permission type**: Add new permission string literal
2. **Update UI components**: Add permission to multiselect options
3. **Implement enforcement**: Add checks to relevant components/hooks
4. **Add server validation**: Ensure the relevant service (e.g., `MessageService`, `SpaceService`) exposed via `MessageDB Context` validates new permission.
5. **Update documentation**: Document new permission scope and behavior

### Testing Considerations

- **Multi-role scenarios**: Test users with multiple overlapping roles
- **Space owner behavior**: Verify owners always have all permissions
- **Permission boundaries**: Test regular vs read-only channel isolation
- **Security**: Verify space owner protection cannot be bypassed

## Related Documentation

- **[Space Permissions Architecture](./space-permissions-architecture.md)** - System overview and integration
- **[Read-Only Channels System](./read-only-channels-system.md)** - Isolated read-only channel permissions

---

_Last Updated: 2025-09-11_  
_Implementation Status: Core features complete, expansion opportunities identified_
