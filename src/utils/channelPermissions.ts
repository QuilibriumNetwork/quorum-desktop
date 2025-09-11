import { Permission, Role, Space, Channel, Message as MessageType } from '../api/quorumApi';

/**
 * Consolidated Channel Permission System
 * 
 * This system handles all permission checks with a clear hierarchy and supports
 * isolated read-only channel permissions separate from regular role system.
 * 
 * PERMISSION HIERARCHY:
 * 1. Space Owner - Has ALL permissions everywhere (inherent privilege)
 * 2. Own Messages - Users can always manage their own messages  
 * 3. Read-Only Channel Managers - Have ALL permissions in their managed channels ONLY
 * 4. Traditional Roles - Have permissions in regular channels based on role assignments
 * 
 * KEY PRINCIPLE: Read-only channels are completely isolated from traditional role system.
 * Users with traditional roles have NO permissions in read-only channels unless they are managers.
 */

export interface PermissionContext {
  userAddress: string;
  isSpaceOwner: boolean;
  space: Space | undefined;
  channel: Channel | undefined;
  message?: MessageType;
}

export interface ChannelPermissionChecker {
  canDeleteMessage: (message: MessageType) => boolean;
  canPinMessage: (message: MessageType) => boolean;
  canPostMessage: () => boolean;
  canKickUser: () => boolean;
}

/**
 * Core permission checking logic that handles all permission types consistently
 */
export class UnifiedPermissionSystem {
  private context: PermissionContext;

  constructor(context: PermissionContext) {
    this.context = context;
  }

  /**
   * Check if user can delete a specific message
   */
  canDeleteMessage(message: MessageType): boolean {
    const { userAddress, isSpaceOwner, space, channel } = this.context;

    // 1. Users can always delete their own messages
    if (message.content.senderId === userAddress) {
      return true;
    }

    // 2. Space owners can delete ANY message (inherent privilege)
    if (isSpaceOwner) {
      return true;
    }

    // 3. Read-only channels: ISOLATED permission system
    if (channel?.isReadOnly) {
      return this.isReadOnlyChannelManager();
    }

    // 4. Regular channels: Traditional role-based permissions
    return this.hasTraditionalRolePermission('message:delete');
  }

  /**
   * Check if user can pin/unpin a specific message
   */
  canPinMessage(message: MessageType): boolean {
    const { isSpaceOwner, channel } = this.context;

    // 1. Space owners can pin ANY message (inherent privilege)
    if (isSpaceOwner) {
      return true;
    }

    // 2. Read-only channels: ISOLATED permission system
    if (channel?.isReadOnly) {
      return this.isReadOnlyChannelManager();
    }

    // 3. Regular channels: Traditional role-based permissions
    return this.hasTraditionalRolePermission('message:pin');
  }

  /**
   * Check if user can post messages in the channel
   */
  canPostMessage(): boolean {
    const { isSpaceOwner, channel } = this.context;

    // 1. Space owners can post anywhere (inherent privilege)
    if (isSpaceOwner) {
      return true;
    }

    // 2. Read-only channels: ONLY managers can post
    if (channel?.isReadOnly) {
      return this.isReadOnlyChannelManager();
    }

    // 3. Regular channels: Everyone can post (no restrictions)
    return true;
  }

  /**
   * Check if user can kick other users from the space
   */
  canKickUser(): boolean {
    const { isSpaceOwner } = this.context;

    // 1. Space owners can kick anyone (inherent privilege)  
    if (isSpaceOwner) {
      return true;
    }

    // 2. Kick is space-wide, not channel-specific, so use traditional roles
    // Read-only channel managers do NOT get kick permissions
    return this.hasTraditionalRolePermission('user:kick');
  }

  /**
   * Check if user is a manager of the current read-only channel
   * This is the ONLY way to get permissions in read-only channels (except space owner)
   */
  private isReadOnlyChannelManager(): boolean {
    const { userAddress, space, channel } = this.context;

    if (!channel?.isReadOnly || !channel.managerRoleIds || !space?.roles) {
      return false;
    }

    return space.roles.some(role => 
      channel.managerRoleIds?.includes(role.roleId) && 
      role.members.includes(userAddress)
    );
  }

  /**
   * Check if user has a specific permission through traditional role system
   * This is ONLY used for regular channels - read-only channels are isolated
   */
  private hasTraditionalRolePermission(permission: Permission): boolean {
    const { userAddress, space } = this.context;

    if (!space?.roles) {
      return false;
    }

    return space.roles.some(role => 
      role.members.includes(userAddress) && 
      role.permissions.includes(permission)
    );
  }
}

/**
 * Factory function to create a permission checker for a specific context
 */
export function createChannelPermissionChecker(context: PermissionContext): ChannelPermissionChecker {
  const permissionSystem = new UnifiedPermissionSystem(context);

  return {
    canDeleteMessage: (message: MessageType) => permissionSystem.canDeleteMessage(message),
    canPinMessage: (message: MessageType) => permissionSystem.canPinMessage(message),
    canPostMessage: () => permissionSystem.canPostMessage(),
    canKickUser: () => permissionSystem.canKickUser(),
  };
}

/**
 * Utility function for backward compatibility with existing hasPermission calls
 * @deprecated Use createChannelPermissionChecker instead for new code
 */
export function hasChannelPermission(
  userAddress: string,
  permission: Permission,
  space: Space | undefined,
  isSpaceOwner: boolean,
  channel?: Channel,
  message?: MessageType
): boolean {
  const context: PermissionContext = {
    userAddress,
    isSpaceOwner,
    space,
    channel,
    message
  };

  const checker = createChannelPermissionChecker(context);

  switch (permission) {
    case 'message:delete':
      return message ? checker.canDeleteMessage(message) : false;
    case 'message:pin':
      return message ? checker.canPinMessage(message) : false;
    case 'user:kick':
      return checker.canKickUser();
    default:
      return false;
  }
}

/**
 * Helper to check if a user can manage (post/delete/pin) in a read-only channel
 * This is useful for UI elements that need to know general management capabilities
 */
export function canManageReadOnlyChannel(
  userAddress: string,
  isSpaceOwner: boolean,
  space: Space | undefined,
  channel: Channel | undefined
): boolean {
  if (!channel?.isReadOnly) {
    return false; // Not a read-only channel
  }

  // Space owners can manage any channel
  if (isSpaceOwner) {
    return true;
  }

  // Check if user is a manager
  if (!channel.managerRoleIds || !space?.roles) {
    return false;
  }

  return space.roles.some(role => 
    channel.managerRoleIds?.includes(role.roleId) && 
    role.members.includes(userAddress)
  );
}