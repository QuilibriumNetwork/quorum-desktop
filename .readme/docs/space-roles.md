# Space Roles System Documentation



## Overview

The space roles system in Quorum provides a comprehensive, permission-based access control mechanism for space management. Roles allow space owners to delegate specific permissions to members while maintaining granular control over space functionality. The system has been significantly enhanced with multi-permission support, kick protection for space owners, and sophisticated UI components.

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

export type Permission = 'message:delete' | 'message:pin' | 'user:kick';
```

#### 2. Permission Types

**Current Permissions (Fully Implemented):**
- `'message:delete'` - Delete messages in the space (✅ Active enforcement in useChannelMessages)
- `'message:pin'` - Pin/unpin messages in the space (✅ Active enforcement in usePinnedMessages)
- `'user:kick'` - Kick users from the space (✅ Active enforcement in UserProfile with space owner protection)

**Permission Structure:**
- Permissions are defined as string literals in TypeScript
- Each permission represents a specific capability within a space
- Permissions are assigned to roles, not directly to users
- **Space Owner Override:** Space owners automatically have all permissions regardless of role assignments
- **Multi-Role Support:** Users can have multiple roles, with permissions accumulated across all roles

#### 3. Role Management Components

**Primary Hooks:**
- `useRoleManagement` (`src/hooks/business/spaces/useRoleManagement.ts`) - Complete role CRUD operations with permission toggle support
- `useUserRoleManagement` (`src/hooks/business/user/useUserRoleManagement.ts`) - User-role assignment operations with immediate UI updates
- `useUserRoleDisplay` (`src/hooks/business/user/useUserRoleDisplay.ts`) - Role filtering and display logic

**Permission System:**
- `hasPermission()` (`src/utils/permissions.ts`) - Core permission checker with space owner override
- `canKickUser()` (`src/utils/permissions.ts`) - Special validation preventing space owner kicks
- `getUserPermissions()` (`src/utils/permissions.ts`) - Returns all accumulated user permissions
- `getUserRoles()` (`src/utils/permissions.ts`) - Returns all user-assigned roles

**UI Components:**
- `SpaceEditor` (`src/components/channel/SpaceEditor.tsx`) - Sophisticated role management with multiselect permission interface
- `UserProfile` (`src/components/user/UserProfile.tsx`) - User role assignment with permission-based action buttons
- `Select` primitive (`src/components/primitives/Select/`) - Advanced multiselect dropdown supporting permission groups

### Role Assignment Mechanisms

#### 1. Role Creation and Management

Roles are managed through the `SpaceEditor` component's "Roles" tab:

- **Creation**: Space owners can add new roles with custom names, tags, and colors
- **Editing**: Role names, tags, and permissions can be modified inline
- **Deletion**: Roles can be removed, automatically removing all user assignments
- **Permission Assignment**: Supports multiselect permission management with three available permissions:
  - `message:delete` - Delete messages
  - `message:pin` - Pin/unpin messages  
  - `user:kick` - Kick users from space

#### 2. User-Role Assignment

User role assignments happen through the `UserProfile` component:

- **Assignment**: Space owners can assign available roles to users
- **Removal**: Assigned roles can be removed from users
- **Multi-Role Support**: Users can have multiple roles simultaneously
- **Real-time Updates**: Role changes are immediately reflected in the UI

#### 3. Permission Enforcement

**Active Enforcement Locations:**

**Message Operations:**
- **Message Deletion** (`src/hooks/business/channels/useChannelMessages.ts`) - Direct role permission checking
- **Message Pinning** (`src/hooks/business/messages/usePinnedMessages.ts`) - Uses `hasPermission()` utility with full role support

**User Operations:**
- **User Kicking** (`src/components/user/UserProfile.tsx`) - Combined permission and space owner protection checks
- **Kick Protection** (`src/components/context/MessageDB.tsx`) - Server-side validation prevents space owner kicks

**Permission Checking Strategy:**
- **Space Owner Override:** Space owners bypass all permission checks automatically
- **Multi-Role Accumulation:** Users with multiple roles get union of all permissions
- **Defense in Depth:** UI, business logic, and server-side validation layers

**Current Implementation Status:**
- ✅ **Message permissions:** Fully implemented and active
- ✅ **User kick permissions:** Implemented with space owner protection
- ⚠️ **Channel management:** Still uses basic ownership model
- ⚠️ **Space administration:** Limited role integration

## Recent Major Improvements (September 2025)

### September 9, 2025 - Multi-Permission Enhancement
- ✅ **Expanded Permission Types:** Added `message:pin` and `user:kick` to existing `message:delete`
- ✅ **Multiselect UI:** Replaced single permission checkbox with sophisticated multiselect dropdown
- ✅ **Permission Utilities:** Created comprehensive `utils/permissions.ts` with space owner priority system
- ✅ **Active Integration:** Updated pin message functionality to use role-based permissions
- ✅ **Kick Protection:** Implemented multi-layer protection preventing space owner kicks

### August 2025 - UX and Validation Improvements  
- ✅ **Smart UI:** Empty roles sections auto-hide when user has no roles and can't assign
- ✅ **Validation System:** Prevents saving roles with empty names/tags
- ✅ **Visual Polish:** Improved role tag styling and responsive layout
- ✅ **Role ID Generation:** Uses `crypto.randomUUID()` for unique role identifiers

## Current Limitations & Known Issues

### 1. Permission System Inconsistencies
- **Mixed Enforcement Patterns:** Some areas use `hasPermission()` utility, others check roles directly
- **Incomplete Server Validation:** Not all permission checks have server-side enforcement
- **Standardization Needed:** Should unify all permission checks to use `hasPermission()` utility

### 2. Limited Permission Scope
**Current:** Only covers basic moderation (`message:delete`, `message:pin`, `user:kick`)
**Missing:** Channel management, space settings, invite generation, emoji/sticker management, role delegation

### 3. No Role Hierarchy System
- All roles are flat with no inheritance or priority system
- Cannot create admin roles that inherit moderator permissions
- No conflict resolution when users have multiple roles with contradictory settings

### 4. Audit and Compliance Gaps
- No logging of permission-based actions or role changes
- No history tracking for role assignments/removals
- Limited audit trail for compliance requirements

## Enhancement Opportunities

### 1. Expand Permission System

**Message Management Permissions:**
```typescript
type Permission = 
  | 'message:delete'    // ✅ IMPLEMENTED
  | 'message:pin'       // ✅ IMPLEMENTED
  | 'message:edit'      // Future enhancement
  | 'message:react'     // Future enhancement
```

**Channel Management Permissions:**
```typescript
type Permission = 
  | 'channel:create'
  | 'channel:edit'
  | 'channel:delete'
  | 'channel:manage_permissions'
```

**User Management Permissions:**
```typescript
type Permission = 
  | 'user:kick'         // ✅ IMPLEMENTED
  | 'user:ban'          // Future enhancement
  | 'user:invite'       // Future enhancement
  | 'user:manage_roles' // Future enhancement
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

## Security and Protection Systems

### Space Owner Protection (NEW)
**Multi-Layer Kick Protection:**
1. **UI Layer:** `UserProfile.tsx` - Kick button hidden for space owners using `canKickUser()`
2. **Business Logic:** `hasPermission()` - Permission checks consider target user protection
3. **Server Validation:** `MessageDB.kickUser()` - Server-side validation prevents space owner kicks

**Implementation:**
```typescript
// Utility function preventing space owner kicks
export function canKickUser(targetUserAddress: string, space: Space): boolean {
  if (!space) return false;
  if (space.ownerAddress === targetUserAddress) return false; // Space owners cannot be kicked
  return true;
}
```

**Protection Ensures:**
- Space owners cannot be kicked by any user, regardless of permissions
- Critical for maintaining space control and security model
- Prevents privilege escalation attacks

### Permission Validation Strategy
**Current Approach:**
- **Defense in Depth:** Multiple validation layers (UI, hooks, server)
- **Space Owner Priority:** Owners automatically have all permissions
- **Multi-Role Accumulation:** Users get union of permissions from all assigned roles

## Technical Considerations

### Current Architecture Strengths
- **Cross-Platform Design:** Uses primitive components ensuring web/mobile compatibility
- **TypeScript Integration:** Strong typing for permissions and roles
- **Modern React Patterns:** Proper hook extraction and context usage
- **Responsive UI:** Mobile-first design with proper breakpoints

### Performance Characteristics
- **Efficient Permission Checking:** `hasPermission()` utility optimized for real-time use
- **Local Role Storage:** Roles cached in space data for fast access  
- **Minimal Re-renders:** Hooks designed to prevent unnecessary UI updates

### Security Considerations
- **Server-Side Enforcement:** Critical operations validated in `MessageDB.tsx`
- **Input Validation:** Role names and tags validated before saving
- **Privilege Separation:** Clear distinction between space owners and role-based permissions
- **Protection Systems:** Multiple layers prevent unauthorized actions

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
*Major update: January 9, 2025 - Comprehensive system review and space owner protection documentation*  
*Based on codebase analysis including recent kick protection enhancements*
