# Space Roles System Documentation

## Overview

The space roles system in Quorum provides a flexible, permission-based access control mechanism for space management. Roles allow space owners to delegate specific permissions to members while maintaining granular control over space functionality.

## Current Architecture

### Core Components

#### 1. Role Data Structure (`src/api/quorumApi.ts`)

```typescript
export type Role = {
  roleId: string;        // Unique identifier for the role
  displayName: string;   // Human-readable name shown in UI
  roleTag: string;       // Short tag/handle for the role (e.g., @admin)
  color: string;         // Visual color for role display
  members: string[];     // Array of user addresses with this role
  permissions: Permission[];  // Array of permissions granted to this role
};

export type Permission = 'message:delete';  // Currently only one permission
```

#### 2. Permission Types

**Current Permissions:**
- `'message:delete'` - Allows users with this role to delete messages in the space

**Permission Structure:**
- Permissions are defined as string literals
- Each permission represents a specific capability within a space
- Permissions are assigned to roles, not directly to users

#### 3. Role Management Components

**Primary Hooks:**
- `useRoleManagement` (`src/hooks/business/spaces/useRoleManagement.ts`) - Core role CRUD operations
- `useUserRoleManagement` (`src/hooks/business/user/useUserRoleManagement.ts`) - User-role assignment operations  
- `useUserRoleDisplay` (`src/hooks/business/user/useUserRoleDisplay.ts`) - Role display logic

**UI Components:**
- `SpaceEditor` (`src/components/channel/SpaceEditor.tsx`) - Role management interface
- `UserProfile` (`src/components/user/UserProfile.tsx`) - User role assignment interface

### Role Assignment Mechanisms

#### 1. Role Creation and Management

Roles are managed through the `SpaceEditor` component's "Roles" tab:

- **Creation**: Space owners can add new roles with custom names, tags, and colors
- **Editing**: Role names, tags, and permissions can be modified inline
- **Deletion**: Roles can be removed, automatically removing all user assignments
- **Permission Assignment**: Currently supports toggling the `message:delete` permission

#### 2. User-Role Assignment

User role assignments happen through the `UserProfile` component:

- **Assignment**: Space owners can assign available roles to users
- **Removal**: Assigned roles can be removed from users
- **Multi-Role Support**: Users can have multiple roles simultaneously
- **Real-time Updates**: Role changes are immediately reflected in the UI

#### 3. Permission Enforcement

**Channel Permissions** (`src/hooks/business/channels/useChannelPermissions.ts`):
- Currently basic - only checks if user is space owner
- Note: "This can be expanded based on role permissions in the future"

**Space Permissions** (`src/hooks/business/channels/useSpacePermissions.ts`):
- Owner-based permissions for space management
- Role-based permissions not yet integrated for space-level operations

## Current Limitations

### 1. Limited Permission Set
- Only one permission type: `'message:delete'`
- No permissions for channel management, user management, or space settings

### 2. Permission Enforcement Gaps
- Role permissions not consistently enforced across all features
- Many operations still rely on space ownership rather than role permissions
- Channel management permissions not implemented

### 3. Role Hierarchy
- No role hierarchy or inheritance system
- All roles are flat with no parent-child relationships
- No role priority system for conflicting permissions

### 4. Audit Trail
- No logging or audit trail for role changes
- No history of permission grants/revocations
- Limited visibility into role-based actions

## Enhancement Opportunities

### 1. Expand Permission System

**Channel Management Permissions:**
```typescript
type Permission = 
  | 'message:delete'
  | 'channel:create'
  | 'channel:edit'
  | 'channel:delete'
  | 'channel:manage_permissions'
```

**User Management Permissions:**
```typescript
type Permission = 
  | 'user:kick'
  | 'user:ban'
  | 'user:invite'
  | 'user:manage_roles'
```

**Space Management Permissions:**
```typescript
type Permission = 
  | 'space:edit_settings'
  | 'space:manage_emojis'
  | 'space:manage_stickers'
  | 'space:generate_invites'
```

### 2. Role Hierarchy System

**Proposed Structure:**
```typescript
export type Role = {
  roleId: string;
  displayName: string;
  roleTag: string;
  color: string;
  members: string[];
  permissions: Permission[];
  hierarchy: number;        // Higher numbers = more authority
  inheritsFrom?: string[];  // Role IDs this role inherits permissions from
};
```

### 3. Enhanced Permission Enforcement

**Centralized Permission Checker:**
```typescript
// Suggested utility function
export function hasPermission(
  userAddress: string, 
  spaceId: string, 
  permission: Permission,
  roles: Role[]
): boolean {
  // Check if user is space owner (always has all permissions)
  // Check if user has roles with required permission
  // Consider role hierarchy
}
```

### 4. Audit and Logging System

**Proposed Features:**
- Role assignment/removal logging
- Permission-based action tracking
- Export capabilities for compliance
- Real-time activity feeds

### 5. Advanced Role Features

**Role Templates:**
- Predefined role templates (Admin, Moderator, Member)
- Quick setup for common permission sets
- Customizable templates per space

**Conditional Permissions:**
- Time-based permissions (temporary elevated access)
- Channel-specific role overrides
- Context-aware permissions

**Bulk Operations:**
- Bulk role assignments
- Import/export role configurations
- Role synchronization across spaces

### 6. UI/UX Improvements

**Enhanced Role Management:**
- Drag-and-drop role assignment
- Visual permission matrix
- Role conflict detection and warnings
- Permission impact previews

**Better Role Visualization:**
- Role badges in member lists
- Permission tooltips
- Role hierarchy visualization
- Activity indicators

## Implementation Priority

### Phase 1: Core Permission Expansion
1. Add channel management permissions
2. Add user management permissions
3. Implement permission enforcement in existing hooks
4. Update UI to reflect new permissions

### Phase 2: Role Hierarchy
1. Add hierarchy field to Role type
2. Implement inheritance logic
3. Update UI for hierarchy management
4. Add role conflict resolution

### Phase 3: Advanced Features
1. Implement audit logging
2. Add role templates
3. Create bulk operations
4. Enhance UI/UX

### Phase 4: Enterprise Features
1. Conditional permissions
2. Advanced audit capabilities
3. Integration APIs
4. Compliance features

## Technical Considerations

### Database Schema Impact
- Role hierarchy will require schema updates
- Audit logging needs new data structures
- Consider migration strategies for existing roles

### Performance Implications
- Permission checking should be optimized for real-time operations
- Consider caching strategies for role/permission lookups
- Bulk operations need efficient algorithms

### Cross-Platform Compatibility
- Ensure role features work consistently across web/mobile
- Consider mobile-specific UI patterns for role management
- Maintain responsive design principles

### Security Considerations
- Validate all permission checks server-side
- Implement proper authorization for role management operations
- Consider potential privilege escalation vectors
- Audit sensitive operations

## Migration Strategy

### Existing Data
- Current roles will be compatible with new system
- Default hierarchy level for existing roles
- Preserve existing permission assignments

### Backwards Compatibility
- Maintain existing API interfaces during transition
- Gradual rollout of new permission types
- Feature flags for advanced functionality

---

*Document created: September 7, 2025*
*Based on codebase analysis as of commit 72520cf5*