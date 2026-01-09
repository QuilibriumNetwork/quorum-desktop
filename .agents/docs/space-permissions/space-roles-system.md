---
type: doc
title: Space Roles System
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-12-15T00:00:00.000Z
---

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
  isPublic?: boolean; // Whether the role is visible to other users (defaults to true)
};

export type Permission = 'message:delete' | 'message:pin' | 'user:mute' | 'mention:everyone';
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

#### **`user:mute`**

- **Scope**: Mute/unmute users in the space (their messages hidden from all clients)
- **UI Integration**: Controls mute/unmute button in user profiles
- **Processing**: Validated by `MessageService` for mute message reception (receiving-side validation)
- **Enforcement**: Client-enforced - each client independently ignores muted users' messages
- **Restrictions**: Does not work in DMs (mute is Space-only feature)
- **Self-Mute**: Users with permission can unmute themselves if muted by others

#### **`mention:everyone`**

- **Scope**: Ability to use @everyone mentions in messages
- **UI Integration**: Controls whether @everyone mentions are allowed
- **Processing**: Validated when processing message mentions
- **Restrictions**: Does not work in read-only channels (isolation principle)

## Role Visibility System

**⚠️ Important Note**: Role visibility is a **cosmetic/UI-only feature**. Since this is an open-source application, users can build custom clients that bypass visibility filters. This feature provides privacy convenience, not security enforcement.

### Overview

Roles can be marked as public or private using the `isPublic` field:
- **Public roles** (`isPublic: true` or `undefined`): Visible to all users viewing profiles
- **Private roles** (`isPublic: false`): Hidden from public view, visible only to the role holder and space owners

### Visibility Rules

1. **Regular users viewing others**: See only public roles
2. **Users viewing their own profile**: See ALL their roles (public + private)
3. **Users in Account Settings**: See ALL their roles (public + private)
4. **Space owners managing roles**: See ALL roles for any user (public + private)

### Implementation

**`useUserRoleDisplay` Hook** (`src/hooks/business/user/useUserRoleDisplay.ts`):

```typescript
export const useUserRoleDisplay = (
  userAddress: string,
  roles?: Role[],
  includePrivateRoles: boolean = false
) => {
  const userRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter((r) =>
      r.members.includes(userAddress) &&
      (includePrivateRoles || r.isPublic !== false)
    );
  }, [roles, userAddress, includePrivateRoles]);

  const availableRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter((r) =>
      !r.members.includes(userAddress) &&
      (includePrivateRoles || r.isPublic !== false)
    );
  }, [roles, userAddress, includePrivateRoles]);

  return { userRoles, availableRoles };
};
```

**Usage Examples**:

```typescript
// Regular user viewing another's profile - only public roles
const { userRoles } = useUserRoleDisplay(targetAddress, roles, false);

// User viewing their own profile - all roles
const { userRoles } = useUserRoleDisplay(
  targetAddress,
  roles,
  currentUser.address === targetAddress
);

// Space owner managing roles - all roles
const { userRoles } = useUserRoleDisplay(targetAddress, roles, true);
```

### UI Integration

**Visibility Toggle** (SpaceSettingsModal/Roles.tsx):
- Eye icon for public roles (visible)
- Eye-off icon for private roles (hidden)
- Tooltip: "Make role invisible" / "Make role public"
- Positioned before the delete button in role management

## Permission Enforcement

### Space Owner Permissions

**Important Design Decision**: Space owners do NOT automatically have all permissions. They must join appropriate roles.

**Exception - Kick Permission**: Space owners can ALWAYS kick users because the protocol verifies ownership via `owner_public_keys`.

**Why No Automatic Bypass?**: The receiving side cannot verify space ownership for post/delete/pin operations (privacy requirement - no `Space.ownerAddress` exposed). To maintain consistent enforcement on both sending and receiving sides, space owners must join roles.

```typescript
// Core permission checking pattern
export function hasPermission(
  userAddress: string,
  permission: Permission,
  space: Space | undefined,
  isSpaceOwner: boolean = false
): boolean {
  // Space owners can ONLY kick without roles (protocol-level verification)
  if (isSpaceOwner && permission === 'user:kick') return true;

  // All other permissions require role membership
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
  const permissions = new Set<Permission>();

  // Space owners can ONLY kick without roles
  if (isSpaceOwner) {
    permissions.add('user:kick');
  }

  // All other permissions come from roles
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

- **MessageService Operations**: Server-side validation for delete operations, interacting with MessageDB for persistence
- **Pinning System**: Permission checks in mutation hooks (preparing for global sync)
- **User Management**: Multi-layer kick protection system, handled by `SpaceService`
- **Receiving-Side Validation**: MessageService.ts validates incoming messages in read-only channels

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
  toggleRolePublic: (index: number) => void;
  deleteConfirmation: {
    showModal: boolean;
    setShowModal: (show: boolean) => void;
    modalConfig?: any;
  };
}
```

**Features**:

- Complete CRUD operations for role management
- Real-time permission toggling with multiselect support
- Role visibility toggling (public/private)
- Automatic role ID generation using `crypto.randomUUID()`
- New roles default to public (`isPublic: true`)
- Validation preventing empty role names/tags
- Confirmation modal for role deletion

#### **`useUserRoleManagement`** (`src/hooks/business/user/useUserRoleManagement.ts`)

- User-role assignment operations with immediate UI updates
- Multi-role assignment support
- Real-time role change reflection across the application

#### **`useUserRoleDisplay`** (`src/hooks/business/user/useUserRoleDisplay.ts`)

- Filters roles based on visibility settings (`isPublic`)
- Returns `userRoles` (roles assigned to a user) and `availableRoles` (roles not assigned)
- Accepts `includePrivateRoles` parameter to bypass visibility filtering
- Used in UserProfile and Account Settings for role display

### UI Components

#### **SpaceSettingsModal Role Management**

**Location**: `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx`

**Features**:

- **Role Creation**: Add new roles with custom names, tags, and colors
- **Permission Assignment**: Multiselect dropdown for all available permissions
- **Visibility Toggle**: Eye/eye-off icon to control role visibility (public/private)
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
    { value: 'user:mute', label: 'Mute Users' },
    { value: 'mention:everyone', label: 'Mention Everyone' }
  ]}
  onChange={(perms) => updateRolePermissions(index, perms as Permission[])}
  multiple={true}
  placeholder="Select Permissions"
/>
```

**Role Grid Layout** (4 columns):
1. **Role Info**: @roleTag input and displayName badge
2. **Permissions**: Multiselect dropdown for permissions
3. **Visibility**: Eye/eye-off icon with tooltip
4. **Delete**: Trash icon with confirmation modal

#### **UserProfile Role Assignment**

**Location**: `src/components/user/UserProfile.tsx`

**Features**:

- **Role Assignment**: Assign available space roles to users (space owners only)
- **Role Removal**: Remove assigned roles from users (space owners only)
- **Multi-Role Display**: Show roles assigned to a user
- **Visibility Filtering**: Respects role visibility settings
  - Regular users: See only public roles of others
  - Users viewing self: See all their roles (public + private)
  - Space owners: See all roles for any user (public + private)
- **Permission-Based Actions**: Show/hide action buttons based on permissions
- **Conditional Display**: Hides entire "Roles" section if user has no visible roles

#### **Account Settings Role Display**

**Location**: `src/components/modals/SpaceSettingsModal/Account.tsx`

**Features**:

- **User's Roles Display**: Shows all roles assigned to the current user
- **Full Visibility**: User always sees all their roles (public + private)
- **Read-Only View**: Roles displayed as badges, not editable
- **Integrated Settings**: Part of the user's account settings in Space Settings modal

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
- **Server Validation**: Final authorization in relevant services (e.g., `MessageService`, `SpaceService`)
- **Receiving-Side Validation**: Incoming messages validated before adding to cache
- **Space Owner Kick**: Protocol-level verification via `owner_public_keys`

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
- **User Muting**: Role-based mute/unmute with receiving-side validation (2025-12-15)
- **Mention Everyone**: Role-based @everyone mention permissions
- **Role Management**: Full CRUD operations with sophisticated UI
- **Role Visibility**: Public/private role toggle with filtering in UserProfile and Account Settings
- **Multi-Role Support**: Users can have multiple roles with accumulated permissions

### ⚠️ Known Limitations

- **Visibility is Cosmetic**: Role visibility is UI-only; custom clients can bypass filters
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
2. **Space owner kick exception**: Only kick permission works without roles
3. **Respect read-only isolation**: Don't expect space roles to work in read-only channels
4. **Implement defense in depth**: UI controls + business logic + server validation + receiving-side

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
- **Role visibility**: Test visibility filtering for different user contexts (self, others, space owners)
- **Private roles**: Verify users can always see their own private roles in all views

## Related Documentation

- **[Space Permissions Architecture](./space-permissions-architecture.md)** - System overview and integration
- **[Read-Only Channels System](./read-only-channels-system.md)** - Isolated read-only channel permissions

---

_Last Updated: 2025-12-15_
_Implementation Status: Core features complete, user:mute added, user:kick removed_
_Security Update: Space owners must join roles for delete/pin/mute (kick is space-owner only via protocol)_
