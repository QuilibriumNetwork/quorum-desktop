/**
 * Comprehensive test scenarios for the unified channel permission system
 * 
 * This file contains test scenarios to validate edge cases and ensure
 * the permission hierarchy works correctly in all situations.
 */

import { UnifiedPermissionSystem, PermissionContext } from './channelPermissions';
import { Space, Channel, Role, Message as MessageType } from '../api/quorumApi';

// Test data setup
const mockSpace: Space = {
  spaceId: 'test-space',
  spaceName: 'Test Space',
  description: '',
  vanityUrl: '',
  inviteUrl: '',
  iconUrl: '',
  bannerUrl: '',
  defaultChannelId: '',
  hubAddress: '',
  createdDate: Date.now(),
  modifiedDate: Date.now(),
  isRepudiable: false,
  isPublic: true,
  groups: [
    {
      groupName: 'General',
      channels: [
        {
          channelId: 'regular-channel',
          spaceId: 'test-space',
          channelName: 'regular',
          channelTopic: 'Regular channel',
          createdDate: Date.now(),
          modifiedDate: Date.now(),
          isReadOnly: false,
        },
        {
          channelId: 'readonly-channel',
          spaceId: 'test-space',
          channelName: 'readonly',
          channelTopic: 'Read-only channel',
          createdDate: Date.now(),
          modifiedDate: Date.now(),
          isReadOnly: true,
          managerRoleIds: ['manager-role-id'],
        },
      ],
    },
  ],
  roles: [
    {
      roleId: 'delete-role-id',
      displayName: 'Delete Role',
      roleTag: 'delete',
      color: '#ff0000',
      members: ['user-with-delete'],
      permissions: ['message:delete'],
    },
    {
      roleId: 'pin-role-id',
      displayName: 'Pin Role',
      roleTag: 'pin',
      color: '#00ff00',
      members: ['user-with-pin'],
      permissions: ['message:pin'],
    },
    {
      roleId: 'manager-role-id',
      displayName: 'Manager Role',
      roleTag: 'manager',
      color: '#0000ff',
      members: ['readonly-manager', 'multi-role-user'],
      permissions: ['message:delete', 'message:pin'], // Traditional permissions (irrelevant in read-only)
    },
    {
      roleId: 'multi-permissions-role-id',
      displayName: 'Multi Permissions',
      roleTag: 'multi',
      color: '#ff00ff',
      members: ['multi-role-user'],
      permissions: ['message:delete', 'message:pin', 'user:kick'],
    },
  ],
  emojis: [],
  stickers: [],
};

const regularChannel = mockSpace.groups[0].channels[0];
const readOnlyChannel = mockSpace.groups[0].channels[1];

const testMessage: MessageType = {
  messageId: 'test-msg',
  channelId: 'test-channel',
  spaceId: 'test-space',
  digestAlgorithm: 'SHA-256',
  nonce: 'test-nonce',
  createdDate: Date.now(),
  modifiedDate: Date.now(),
  lastModifiedHash: '',
  content: {
    type: 'post',
    senderId: 'message-author',
    text: 'Test message',
  } as any,
  reactions: [],
  mentions: {} as any,
};

// Test scenarios
describe('Unified Permission System Edge Cases', () => {
  describe('Space Owner Permissions', () => {
    test('Space owner can delete any message in regular channel', () => {
      const context: PermissionContext = {
        userAddress: 'space-owner',
        isSpaceOwner: true,
        space: mockSpace,
        channel: regularChannel,
        message: testMessage,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(testMessage)).toBe(true);
    });

    test('Space owner can delete any message in read-only channel', () => {
      const context: PermissionContext = {
        userAddress: 'space-owner',
        isSpaceOwner: true,
        space: mockSpace,
        channel: readOnlyChannel,
        message: testMessage,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(testMessage)).toBe(true);
    });

    test('Space owner can post in read-only channel', () => {
      const context: PermissionContext = {
        userAddress: 'space-owner',
        isSpaceOwner: true,
        space: mockSpace,
        channel: readOnlyChannel,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canPostMessage()).toBe(true);
    });

    test('Space owner who is also a manager still gets space owner privileges', () => {
      // Edge case: Space owner is assigned as manager - should still get space owner privileges
      const context: PermissionContext = {
        userAddress: 'space-owner',
        isSpaceOwner: true,
        space: {
          ...mockSpace,
          roles: [
            ...mockSpace.roles,
            {
              roleId: 'manager-role-id',
              displayName: 'Manager Role',
              roleTag: 'manager', 
              color: '#0000ff',
              members: ['space-owner'], // Space owner is also a manager
              permissions: ['message:delete'],
            },
          ],
        },
        channel: readOnlyChannel,
        message: testMessage,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(testMessage)).toBe(true);
      expect(system.canPinMessage(testMessage)).toBe(true);
      expect(system.canPostMessage()).toBe(true);
    });
  });

  describe('Read-Only Channel Isolation', () => {
    test('User with delete role CANNOT delete in read-only channel if not manager', () => {
      const context: PermissionContext = {
        userAddress: 'user-with-delete',
        isSpaceOwner: false,
        space: mockSpace,
        channel: readOnlyChannel,
        message: testMessage,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(testMessage)).toBe(false);
    });

    test('User with pin role CANNOT pin in read-only channel if not manager', () => {
      const context: PermissionContext = {
        userAddress: 'user-with-pin',
        isSpaceOwner: false,
        space: mockSpace,
        channel: readOnlyChannel,
        message: testMessage,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canPinMessage(testMessage)).toBe(false);
    });

    test('User with delete role CANNOT post in read-only channel if not manager', () => {
      const context: PermissionContext = {
        userAddress: 'user-with-delete',
        isSpaceOwner: false,
        space: mockSpace,
        channel: readOnlyChannel,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canPostMessage()).toBe(false);
    });

    test('Read-only manager CAN delete any message in their managed channel', () => {
      const context: PermissionContext = {
        userAddress: 'readonly-manager',
        isSpaceOwner: false,
        space: mockSpace,
        channel: readOnlyChannel,
        message: testMessage,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(testMessage)).toBe(true);
    });

    test('Read-only manager CAN pin messages in their managed channel', () => {
      const context: PermissionContext = {
        userAddress: 'readonly-manager',
        isSpaceOwner: false,
        space: mockSpace,
        channel: readOnlyChannel,
        message: testMessage,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canPinMessage(testMessage)).toBe(true);
    });

    test('Read-only manager CANNOT kick users (kick is space-wide, not channel-specific)', () => {
      const context: PermissionContext = {
        userAddress: 'readonly-manager',
        isSpaceOwner: false,
        space: mockSpace,
        channel: readOnlyChannel,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canKickUser()).toBe(false);
    });
  });

  describe('Multi-Role Edge Cases', () => {
    test('User with multiple roles including manager gets manager privileges in read-only channel', () => {
      // User has both manager role and other traditional roles
      const context: PermissionContext = {
        userAddress: 'multi-role-user',
        isSpaceOwner: false,
        space: mockSpace,
        channel: readOnlyChannel,
        message: testMessage,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(testMessage)).toBe(true); // Manager privilege
      expect(system.canPinMessage(testMessage)).toBe(true); // Manager privilege
      expect(system.canPostMessage()).toBe(true); // Manager privilege
    });

    test('User with multiple traditional roles gets combined permissions in regular channel', () => {
      const context: PermissionContext = {
        userAddress: 'multi-role-user',
        isSpaceOwner: false,
        space: mockSpace,
        channel: regularChannel,
        message: testMessage,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(testMessage)).toBe(true); // From multi-permissions-role-id
      expect(system.canPinMessage(testMessage)).toBe(true); // From multi-permissions-role-id
      expect(system.canKickUser()).toBe(true); // From multi-permissions-role-id
      expect(system.canPostMessage()).toBe(true); // Regular channels allow posting
    });

    test('Manager in read-only channel has no special privileges in regular channels', () => {
      // Manager role doesn't give special privileges outside of managed read-only channels
      const context: PermissionContext = {
        userAddress: 'readonly-manager',
        isSpaceOwner: false,
        space: mockSpace,
        channel: regularChannel,
        message: testMessage,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(testMessage)).toBe(true); // From manager role's traditional permissions
      expect(system.canPinMessage(testMessage)).toBe(true); // From manager role's traditional permissions
      expect(system.canPostMessage()).toBe(true); // Regular channels allow posting
    });
  });

  describe('Own Message Permissions', () => {
    test('User can always delete their own message regardless of other permissions', () => {
      const ownMessage = { ...testMessage, content: { ...testMessage.content, senderId: 'user-no-roles' }};
      
      const context: PermissionContext = {
        userAddress: 'user-no-roles',
        isSpaceOwner: false,
        space: mockSpace,
        channel: regularChannel,
        message: ownMessage,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(ownMessage)).toBe(true);
    });

    test('User can delete own message even in read-only channel without manager role', () => {
      const ownMessage = { ...testMessage, content: { ...testMessage.content, senderId: 'user-no-roles' }};
      
      const context: PermissionContext = {
        userAddress: 'user-no-roles',
        isSpaceOwner: false,
        space: mockSpace,
        channel: readOnlyChannel,
        message: ownMessage,
      };

      const system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(ownMessage)).toBe(true);
    });
  });

  describe('Permission Hierarchy Validation', () => {
    test('Permission precedence: Space owner > Own message > Manager > Traditional roles', () => {
      // This test validates that the permission system respects the correct hierarchy
      
      // Test 1: Space owner overrides everything
      let context: PermissionContext = {
        userAddress: 'space-owner-and-manager',
        isSpaceOwner: true,
        space: {
          ...mockSpace,
          roles: mockSpace.roles.map(role => 
            role.roleId === 'manager-role-id' 
              ? { ...role, members: [...role.members, 'space-owner-and-manager'] }
              : role
          ),
        },
        channel: readOnlyChannel,
        message: testMessage,
      };
      
      let system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(testMessage)).toBe(true); // Space owner privilege

      // Test 2: Own message overrides manager status
      const ownMessage = { ...testMessage, content: { ...testMessage.content, senderId: 'regular-user' }};
      context = {
        userAddress: 'regular-user',
        isSpaceOwner: false,
        space: mockSpace,
        channel: readOnlyChannel,
        message: ownMessage,
      };
      
      system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(ownMessage)).toBe(true); // Own message privilege

      // Test 3: Manager overrides traditional roles in read-only channels
      context = {
        userAddress: 'readonly-manager',
        isSpaceOwner: false,
        space: mockSpace,
        channel: readOnlyChannel,
        message: testMessage,
      };
      
      system = new UnifiedPermissionSystem(context);
      expect(system.canDeleteMessage(testMessage)).toBe(true); // Manager privilege
    });
  });
});

export { }; // Make this a module