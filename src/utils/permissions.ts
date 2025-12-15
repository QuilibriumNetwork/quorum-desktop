import { Permission, Role, Space } from '../api/quorumApi';

/**
 * Utility functions for checking user permissions in spaces
 */

/**
 * Check if a user has a specific permission in a space
 * @param userAddress - The address of the user to check
 * @param permission - The permission to check for
 * @param space - The space object containing roles
 * @param isSpaceOwner - Whether the user is the space owner (owners have all permissions)
 * @returns boolean - true if user has the permission
 */
export function hasPermission(
  userAddress: string,
  permission: Permission,
  space: Space | undefined,
  isSpaceOwner: boolean = false
): boolean {
  // Space owners always have all permissions
  if (isSpaceOwner) {
    return true;
  }

  // If no space data available, deny permission
  if (!space || !space.roles) {
    return false;
  }

  // Check if user has any role with the required permission
  return space.roles.some(
    (role: Role) =>
      role.members.includes(userAddress) &&
      role.permissions.includes(permission)
  );
}

/**
 * Get all permissions a user has in a space
 * @param userAddress - The address of the user
 * @param space - The space object containing roles
 * @param isSpaceOwner - Whether the user is the space owner
 * @returns Permission[] - array of permissions the user has
 */
export function getUserPermissions(
  userAddress: string,
  space: Space | undefined,
  isSpaceOwner: boolean = false
): Permission[] {
  // Space owners have all role-delegatable permissions
  // Note: kick is NOT included here because it requires the owner's ED448 key,
  // not a role permission - only owners can kick (protocol-level enforcement)
  if (isSpaceOwner) {
    return ['message:delete', 'message:pin', 'mention:everyone'];
  }

  if (!space || !space.roles) {
    return [];
  }

  // Collect all unique permissions from user's roles
  const permissions = new Set<Permission>();

  space.roles.forEach((role: Role) => {
    if (role.members.includes(userAddress)) {
      role.permissions.forEach((permission: Permission) => {
        permissions.add(permission);
      });
    }
  });

  return Array.from(permissions);
}

/**
 * Get all roles a user has in a space
 * @param userAddress - The address of the user
 * @param space - The space object containing roles
 * @returns Role[] - array of roles the user has
 */
export function getUserRoles(
  userAddress: string,
  space: Space | undefined
): Role[] {
  if (!space || !space.roles) {
    return [];
  }

  return space.roles.filter((role: Role) => role.members.includes(userAddress));
}
