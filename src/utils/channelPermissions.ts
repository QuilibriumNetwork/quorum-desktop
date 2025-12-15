import {
  Permission,
  Role,
  Space,
  Channel,
  Message as MessageType,
} from '../api/quorumApi';

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
  canMuteUser: () => boolean;
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
   *
   * NOTE: Space owners must have a role with delete permission to delete others' messages.
   * This is intentional - the receiving side validates permissions consistently.
   */
  canDeleteMessage(message: MessageType): boolean {
    const { userAddress, channel } = this.context;

    // 1. Users can always delete their own messages
    if (message.content.senderId === userAddress) {
      return true;
    }

    // 2. Read-only channels: ISOLATED permission system
    if (channel?.isReadOnly) {
      return this.isReadOnlyChannelManager();
    }

    // 3. Regular channels: Traditional role-based permissions
    return this.hasTraditionalRolePermission('message:delete');
  }

  /**
   * Check if user can pin/unpin a specific message
   *
   * NOTE: Space owners must have a role with pin permission to pin messages.
   * This prepares for global pin sync where receiving side validates permissions.
   */
  canPinMessage(_message: MessageType): boolean {
    const { channel } = this.context;

    // 1. Read-only channels: ISOLATED permission system
    if (channel?.isReadOnly) {
      return this.isReadOnlyChannelManager();
    }

    // 2. Regular channels: Traditional role-based permissions
    return this.hasTraditionalRolePermission('message:pin');
  }

  /**
   * Check if user can post messages in the channel
   *
   * NOTE: Space owners must explicitly join a manager role to post in read-only channels.
   * This is intentional - the receiving side cannot verify space ownership (privacy requirement),
   * so we enforce the same rule on both sides for consistency.
   */
  canPostMessage(): boolean {
    const { channel } = this.context;

    // Read-only channels: ONLY managers can post
    if (channel?.isReadOnly) {
      return this.isReadOnlyChannelManager();
    }

    // Regular channels: Everyone can post (no restrictions)
    return true;
  }

  /**
   * Check if user can kick other users from the space.
   *
   * NOTE: Only space owners can kick. The kick operation requires the owner's
   * ED448 private key to sign the kick message, which only the owner possesses.
   * Role-based kick delegation is not currently supported at the protocol level.
   */
  canKickUser(): boolean {
    const { isSpaceOwner } = this.context;
    return isSpaceOwner;
  }

  /**
   * Check if user can mute/unmute other users in the space.
   *
   * NOTE: NO isSpaceOwner bypass - receiving side can't verify owner status.
   * Space owners must assign themselves a role with user:mute permission.
   */
  canMuteUser(): boolean {
    const { channel } = this.context;

    // 1. Read-only channels: Only managers can mute
    if (channel?.isReadOnly) {
      return this.isReadOnlyChannelManager();
    }

    // 2. Regular channels: Check for user:mute permission via roles
    return this.hasTraditionalRolePermission('user:mute');
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

    return space.roles.some(
      (role) =>
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

    return space.roles.some(
      (role) =>
        role.members.includes(userAddress) &&
        role.permissions.includes(permission)
    );
  }
}

/**
 * Factory function to create a permission checker for a specific context
 */
export function createChannelPermissionChecker(
  context: PermissionContext
): ChannelPermissionChecker {
  const permissionSystem = new UnifiedPermissionSystem(context);

  return {
    canDeleteMessage: (message: MessageType) =>
      permissionSystem.canDeleteMessage(message),
    canPinMessage: (message: MessageType) =>
      permissionSystem.canPinMessage(message),
    canPostMessage: () => permissionSystem.canPostMessage(),
    canKickUser: () => permissionSystem.canKickUser(),
    canMuteUser: () => permissionSystem.canMuteUser(),
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
    message,
  };

  const checker = createChannelPermissionChecker(context);

  switch (permission) {
    case 'message:delete':
      return message ? checker.canDeleteMessage(message) : false;
    case 'message:pin':
      return message ? checker.canPinMessage(message) : false;
    case 'user:mute':
      return checker.canMuteUser();
    // Note: 'user:kick' is not a role permission - use canKickUser() directly
    // Kick requires owner's ED448 key and cannot be delegated via roles
    default:
      return false;
  }
}

/**
 * Helper to check if a user can manage (post/delete/pin) in a read-only channel
 * This is useful for UI elements that need to know general management capabilities
 *
 * NOTE: Space owners must explicitly join a manager role to manage read-only channels.
 * This is intentional - the receiving side cannot verify space ownership (privacy requirement).
 */
export function canManageReadOnlyChannel(
  userAddress: string,
  _isSpaceOwner: boolean,
  space: Space | undefined,
  channel: Channel | undefined
): boolean {
  if (!channel?.isReadOnly) {
    return false; // Not a read-only channel
  }

  // Check if user is a manager (space owners must also be in a manager role)
  if (!channel.managerRoleIds || !space?.roles) {
    return false;
  }

  return space.roles.some(
    (role) =>
      channel.managerRoleIds?.includes(role.roleId) &&
      role.members.includes(userAddress)
  );
}
