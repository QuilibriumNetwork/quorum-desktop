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
  return space.roles.some((role: Role) => 
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
  // Space owners have all permissions
  if (isSpaceOwner) {
    return ['message:delete', 'message:pin', 'user:kick'];
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
 * Check if a user can be kicked from a space
 * Space owners cannot be kicked, regardless of who has kick permissions
 * @param targetUserAddress - The address of the user to be kicked
 * @param space - The space object
 * @returns boolean - true if user can be kicked
 */
export function canKickUser(
  targetUserAddress: string,
  space: Space | undefined
): boolean {
  if (!space) {
    return false;
  }

  // Space owners cannot be kicked
  if (space.ownerAddress === targetUserAddress) {
    return false;
  }

  return true;
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

  return space.roles.filter((role: Role) => 
    role.members.includes(userAddress)
  );
}