/**
 * ActionQueueHandlers - Unit Tests
 *
 * PURPOSE: Validates all 16 ActionQueue task handlers including:
 * - Space actions (Triple Ratchet): send-channel-message, reaction, pin, unpin, edit, delete
 * - DM actions (Double Ratchet): send-dm, reaction-dm, edit-dm, delete-dm
 * - Config actions: save-user-config, update-space
 * - Moderation actions: kick-user, mute-user, unmute-user
 *
 * APPROACH: Unit tests with vi.fn() mocks - NOT integration tests
 *
 * CRITICAL TESTS:
 * - Each handler's execute() method
 * - isPermanentError() classification
 * - onFailure() callbacks where applicable
 * - Error sanitization
 *
 * FAILURE GUIDANCE:
 * - "Keyset not available": Handler requires keyset but getUserKeyset returned null
 * - "Handler undefined": Check getHandler returns correct handler
 * - "Expected to throw": Check isPermanentError logic
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';

// Initialize Lingui BEFORE importing ActionQueueHandlers
beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

// Mock the secure channel module
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    TripleRatchetEncrypt: vi.fn().mockReturnValue(
      JSON.stringify({
        ratchet_state: {},
        envelope: JSON.stringify({ type: 'encrypted', data: 'mock' }),
      })
    ),
    DoubleRatchetInboxEncrypt: vi.fn().mockReturnValue([]),
    DoubleRatchetInboxEncryptForceSenderInit: vi.fn().mockReturnValue([]),
  },
}));

// Import ActionQueueHandlers AFTER mocks are set up
import { ActionQueueHandlers, HandlerDependencies } from '@/services/ActionQueueHandlers';

describe('ActionQueueHandlers - Unit Tests', () => {
  let handlers: ActionQueueHandlers;
  let mockDeps: HandlerDependencies;
  let queryClient: QueryClient;

  // Mock keyset
  const mockKeyset = {
    deviceKeyset: {
      inbox_keyset: { inbox_address: 'test-inbox' },
    },
    userKeyset: {
      user_key: { public_key: new Uint8Array(57), private_key: new Uint8Array(57) },
    },
  };

  // Helper to create test message
  const createTestMessage = (overrides: any = {}) => ({
    messageId: 'msg-123',
    spaceId: 'space-123',
    channelId: 'channel-456',
    createdDate: Date.now(),
    modifiedDate: Date.now(),
    digestAlgorithm: 'SHA-256',
    nonce: 'test-nonce',
    lastModifiedHash: '',
    content: {
      type: 'post',
      senderId: 'sender-123',
      text: 'Test message',
    },
    ...overrides,
  });

  beforeEach(() => {
    // Create fresh QueryClient
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
    });

    // Setup mock dependencies
    mockDeps = {
      messageDB: {
        getSpace: vi.fn().mockResolvedValue({
          spaceId: 'space-123',
          spaceName: 'Test Space',
          groups: [{ channels: [{ channelId: 'channel-456' }] }],
        }),
        getSpaceMembers: vi.fn().mockResolvedValue([
          { user_address: 'user-to-kick' },
        ]),
        getMessageById: vi.fn().mockResolvedValue(createTestMessage()),
        getConversation: vi.fn().mockResolvedValue({
          conversation: { icon: 'icon.png', displayName: 'Test User' },
        }),
        getEncryptionStates: vi.fn().mockResolvedValue([
          {
            state: JSON.stringify({
              tag: 'inbox-1',
              sending_inbox: { inbox_public_key: 'key' },
              receiving_inbox: { inbox_address: 'inbox-1' },
              ratchet_state: {},
            }),
          },
        ]),
        saveEncryptionState: vi.fn().mockResolvedValue(undefined),
      } as any,
      messageService: {
        submitChannelMessage: vi.fn().mockResolvedValue(undefined),
        sendDirectMessages: vi.fn().mockResolvedValue(undefined),
        saveMessage: vi.fn().mockResolvedValue(undefined),
        updateMessageStatus: vi.fn(),
        getEncryptAndSendToSpace: vi.fn().mockReturnValue(
          vi.fn().mockResolvedValue('outbound-id')
        ),
      } as any,
      configService: {
        saveConfig: vi.fn().mockResolvedValue(undefined),
      } as any,
      spaceService: {
        updateSpace: vi.fn().mockResolvedValue(undefined),
        kickUser: vi.fn().mockResolvedValue(undefined),
      } as any,
      queryClient,
      getUserKeyset: vi.fn().mockReturnValue(mockKeyset),
    };

    // Create handlers
    handlers = new ActionQueueHandlers(mockDeps);

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('1. getHandler() - Handler Registry', () => {
    it('should return handler for all registered action types', () => {
      const actionTypes = [
        'send-channel-message',
        'send-dm',
        'save-user-config',
        'update-space',
        'kick-user',
        'mute-user',
        'unmute-user',
        'reaction',
        'pin-message',
        'unpin-message',
        'edit-message',
        'delete-message',
        'reaction-dm',
        'delete-dm',
        'edit-dm',
      ];

      for (const type of actionTypes) {
        const handler = handlers.getHandler(type);
        expect(handler).toBeDefined();
        expect(typeof handler?.execute).toBe('function');
        expect(typeof handler?.isPermanentError).toBe('function');
      }
    });

    it('should return undefined for unknown action types', () => {
      const handler = handlers.getHandler('unknown-action');
      expect(handler).toBeUndefined();
    });
  });

  describe('2. save-user-config Handler', () => {
    it('should call configService.saveConfig with keyset', async () => {
      const handler = handlers.getHandler('save-user-config')!;
      const context = {
        config: { address: 'test-address', spaceIds: [] },
      };

      await handler.execute(context);

      expect(mockDeps.configService.saveConfig).toHaveBeenCalledWith({
        config: context.config,
        keyset: mockKeyset,
      });
    });

    it('should throw when keyset not available', async () => {
      mockDeps.getUserKeyset = vi.fn().mockReturnValue(null);
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('save-user-config')!;

      await expect(handler.execute({ config: {} })).rejects.toThrow(
        'Keyset not available'
      );
    });

    it('should classify validation errors as permanent', () => {
      const handler = handlers.getHandler('save-user-config')!;

      expect(handler.isPermanentError(new Error('validation failed'))).toBe(true);
      expect(handler.isPermanentError(new Error('invalid config'))).toBe(true);
      expect(handler.isPermanentError(new Error('network timeout'))).toBe(false);
    });
  });

  describe('3. update-space Handler', () => {
    it('should call spaceService.updateSpace when space exists', async () => {
      const handler = handlers.getHandler('update-space')!;
      const context = {
        spaceId: 'space-123',
        space: { spaceName: 'Updated Space' },
      };

      await handler.execute(context);

      expect(mockDeps.spaceService.updateSpace).toHaveBeenCalledWith(
        context.space,
        queryClient
      );
    });

    it('should skip silently when space does not exist', async () => {
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue(null);
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('update-space')!;

      await handler.execute({ spaceId: 'deleted-space', space: {} });

      expect(mockDeps.spaceService.updateSpace).not.toHaveBeenCalled();
    });

    it('should classify permission errors as permanent', () => {
      const handler = handlers.getHandler('update-space')!;

      expect(handler.isPermanentError(new Error('permission denied'))).toBe(true);
      expect(handler.isPermanentError(new Error('403 Forbidden'))).toBe(true);
      expect(handler.isPermanentError(new Error('not found'))).toBe(true);
      expect(handler.isPermanentError(new Error('network error'))).toBe(false);
    });
  });

  describe('4. kick-user Handler', () => {
    it('should call spaceService.kickUser when user still in space', async () => {
      const handler = handlers.getHandler('kick-user')!;
      const context = {
        spaceId: 'space-123',
        userAddress: 'user-to-kick',
        registration: {},
      };

      await handler.execute(context);

      expect(mockDeps.spaceService.kickUser).toHaveBeenCalledWith(
        'space-123',
        'user-to-kick',
        mockKeyset.userKeyset,
        mockKeyset.deviceKeyset,
        context.registration,
        queryClient
      );
    });

    it('should skip silently when user already left', async () => {
      mockDeps.messageDB.getSpaceMembers = vi.fn().mockResolvedValue([]);
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('kick-user')!;

      await handler.execute({
        spaceId: 'space-123',
        userAddress: 'user-left',
        registration: {},
      });

      expect(mockDeps.spaceService.kickUser).not.toHaveBeenCalled();
    });

    it('should invalidate space query after kick', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const handler = handlers.getHandler('kick-user')!;

      await handler.execute({
        spaceId: 'space-123',
        userAddress: 'user-to-kick',
        registration: {},
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['space', 'space-123'],
      });
    });
  });

  describe('5. mute-user Handler', () => {
    it('should submit mute message via messageService', async () => {
      const handler = handlers.getHandler('mute-user')!;
      const context = {
        spaceId: 'space-123',
        channelId: 'channel-456',
        muteMessage: { type: 'mute', userId: 'user-123' },
        currentPasskeyInfo: { address: 'self' },
      };

      await handler.execute(context);

      expect(mockDeps.messageService.submitChannelMessage).toHaveBeenCalledWith(
        'space-123',
        'channel-456',
        context.muteMessage,
        queryClient,
        context.currentPasskeyInfo
      );
    });

    it('should invalidate mutedUsers query after mute', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const handler = handlers.getHandler('mute-user')!;

      await handler.execute({
        spaceId: 'space-123',
        channelId: 'channel-456',
        muteMessage: {},
        currentPasskeyInfo: {},
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['mutedUsers', 'space-123'],
      });
    });
  });

  describe('6. unmute-user Handler', () => {
    it('should submit unmute message via messageService', async () => {
      const handler = handlers.getHandler('unmute-user')!;
      const context = {
        spaceId: 'space-123',
        channelId: 'channel-456',
        unmuteMessage: { type: 'unmute', userId: 'user-123' },
        currentPasskeyInfo: { address: 'self' },
      };

      await handler.execute(context);

      expect(mockDeps.messageService.submitChannelMessage).toHaveBeenCalledWith(
        'space-123',
        'channel-456',
        context.unmuteMessage,
        queryClient,
        context.currentPasskeyInfo
      );
    });
  });

  describe('7. reaction Handler (Space)', () => {
    it('should submit reaction message', async () => {
      const handler = handlers.getHandler('reaction')!;
      const context = {
        spaceId: 'space-123',
        channelId: 'channel-456',
        reactionMessage: { type: 'reaction', emoji: '👍', messageId: 'msg-1' },
        currentPasskeyInfo: { address: 'self' },
      };

      await handler.execute(context);

      expect(mockDeps.messageService.submitChannelMessage).toHaveBeenCalledWith(
        'space-123',
        'channel-456',
        context.reactionMessage,
        queryClient,
        context.currentPasskeyInfo
      );
    });

    it('should classify 404 as permanent error (message deleted)', () => {
      const handler = handlers.getHandler('reaction')!;

      expect(handler.isPermanentError(new Error('404 Not Found'))).toBe(true);
      expect(handler.isPermanentError(new Error('network error'))).toBe(false);
    });
  });

  describe('8. pin-message Handler', () => {
    it('should submit pin message when target exists', async () => {
      const handler = handlers.getHandler('pin-message')!;
      const context = {
        spaceId: 'space-123',
        channelId: 'channel-456',
        messageId: 'msg-123',
        pinMessage: { type: 'pin', messageId: 'msg-123' },
        currentPasskeyInfo: { address: 'self' },
      };

      await handler.execute(context);

      expect(mockDeps.messageService.submitChannelMessage).toHaveBeenCalled();
    });

    it('should skip silently when target message deleted', async () => {
      mockDeps.messageDB.getMessageById = vi.fn().mockResolvedValue(null);
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('pin-message')!;

      await handler.execute({
        spaceId: 'space-123',
        channelId: 'channel-456',
        messageId: 'deleted-msg',
        pinMessage: {},
        currentPasskeyInfo: {},
      });

      expect(mockDeps.messageService.submitChannelMessage).not.toHaveBeenCalled();
    });
  });

  describe('9. unpin-message Handler', () => {
    it('should submit unpin message', async () => {
      const handler = handlers.getHandler('unpin-message')!;
      const context = {
        spaceId: 'space-123',
        channelId: 'channel-456',
        unpinMessage: { type: 'unpin', messageId: 'msg-123' },
        currentPasskeyInfo: { address: 'self' },
      };

      await handler.execute(context);

      expect(mockDeps.messageService.submitChannelMessage).toHaveBeenCalledWith(
        'space-123',
        'channel-456',
        context.unpinMessage,
        queryClient,
        context.currentPasskeyInfo
      );
    });
  });

  describe('10. edit-message Handler (Space)', () => {
    it('should submit edit message when target exists', async () => {
      const handler = handlers.getHandler('edit-message')!;
      const context = {
        spaceId: 'space-123',
        channelId: 'channel-456',
        messageId: 'msg-123',
        editMessage: { type: 'edit', messageId: 'msg-123', text: 'Updated' },
        currentPasskeyInfo: { address: 'self' },
      };

      await handler.execute(context);

      expect(mockDeps.messageService.submitChannelMessage).toHaveBeenCalled();
    });

    it('should skip silently when target message deleted', async () => {
      mockDeps.messageDB.getMessageById = vi.fn().mockResolvedValue(null);
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('edit-message')!;

      await handler.execute({
        spaceId: 'space-123',
        channelId: 'channel-456',
        messageId: 'deleted-msg',
        editMessage: {},
        currentPasskeyInfo: {},
      });

      expect(mockDeps.messageService.submitChannelMessage).not.toHaveBeenCalled();
    });
  });

  describe('11. delete-message Handler (Space)', () => {
    it('should submit delete message', async () => {
      const handler = handlers.getHandler('delete-message')!;
      const context = {
        spaceId: 'space-123',
        channelId: 'channel-456',
        deleteMessage: { type: 'remove-message', removeMessageId: 'msg-123' },
        currentPasskeyInfo: { address: 'self' },
      };

      await handler.execute(context);

      expect(mockDeps.messageService.submitChannelMessage).toHaveBeenCalled();
    });

    it('should treat 404 as success (already deleted)', async () => {
      mockDeps.messageService.submitChannelMessage = vi
        .fn()
        .mockRejectedValue(new Error('404 Not Found'));
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('delete-message')!;

      // Should not throw
      await expect(
        handler.execute({
          spaceId: 'space-123',
          channelId: 'channel-456',
          deleteMessage: {},
          currentPasskeyInfo: {},
        })
      ).resolves.not.toThrow();
    });

    it('should always return false for isPermanentError (idempotent)', () => {
      const handler = handlers.getHandler('delete-message')!;

      expect(handler.isPermanentError(new Error('any error'))).toBe(false);
    });
  });

  describe('12. send-channel-message Handler', () => {
    it('should encrypt and send message via Triple Ratchet', async () => {
      const handler = handlers.getHandler('send-channel-message')!;
      const message = createTestMessage();
      const context = {
        spaceId: 'space-123',
        channelId: 'channel-456',
        signedMessage: message,
        messageId: 'msg-123',
      };

      await handler.execute(context);

      // ✅ VERIFY: encryptAndSendToSpace was called
      expect(mockDeps.messageService.getEncryptAndSendToSpace).toHaveBeenCalled();
    });

    it('should update message status to failed when space deleted', async () => {
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue(null);
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('send-channel-message')!;
      const context = {
        spaceId: 'deleted-space',
        channelId: 'channel-456',
        signedMessage: createTestMessage(),
        messageId: 'msg-123',
      };

      await handler.execute(context);

      expect(mockDeps.messageService.updateMessageStatus).toHaveBeenCalledWith(
        queryClient,
        'deleted-space',
        'channel-456',
        'msg-123',
        'failed',
        'Space was deleted'
      );
    });

    it('should update message status to failed when channel deleted', async () => {
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId: 'space-123',
        groups: [{ channels: [] }], // No channels
      });
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('send-channel-message')!;
      const context = {
        spaceId: 'space-123',
        channelId: 'deleted-channel',
        signedMessage: createTestMessage(),
        messageId: 'msg-123',
      };

      await handler.execute(context);

      expect(mockDeps.messageService.updateMessageStatus).toHaveBeenCalledWith(
        queryClient,
        'space-123',
        'deleted-channel',
        'msg-123',
        'failed',
        'Channel was deleted'
      );
    });

    it('should classify 400 and 403 as permanent errors', () => {
      const handler = handlers.getHandler('send-channel-message')!;

      expect(handler.isPermanentError(new Error('400 Bad Request'))).toBe(true);
      expect(handler.isPermanentError(new Error('403 Forbidden'))).toBe(true);
      expect(handler.isPermanentError(new Error('Space was deleted'))).toBe(true);
      expect(handler.isPermanentError(new Error('network timeout'))).toBe(false);
    });

    it('should call onFailure to update message status', () => {
      const handler = handlers.getHandler('send-channel-message')!;
      const context = {
        spaceId: 'space-123',
        channelId: 'channel-456',
        messageId: 'msg-123',
      };

      handler.onFailure!(context, new Error('Network error'));

      expect(mockDeps.messageService.updateMessageStatus).toHaveBeenCalledWith(
        queryClient,
        'space-123',
        'channel-456',
        'msg-123',
        'failed',
        expect.any(String)
      );
    });
  });

  describe('13. send-dm Handler', () => {
    it('should throw when keyset not available', async () => {
      mockDeps.getUserKeyset = vi.fn().mockReturnValue(null);
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('send-dm')!;

      await expect(
        handler.execute({
          address: 'recipient',
          signedMessage: createTestMessage(),
          messageId: 'msg-123',
          selfUserAddress: 'self',
        })
      ).rejects.toThrow('Keyset not available');
    });

    it('should throw when no established sessions', async () => {
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([]);
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('send-dm')!;

      await expect(
        handler.execute({
          address: 'recipient',
          signedMessage: createTestMessage(),
          messageId: 'msg-123',
          selfUserAddress: 'self',
        })
      ).rejects.toThrow('No established sessions');
    });

    it('should classify 400 and 403 as permanent errors', () => {
      const handler = handlers.getHandler('send-dm')!;

      expect(handler.isPermanentError(new Error('400 Bad Request'))).toBe(true);
      expect(handler.isPermanentError(new Error('403 Forbidden'))).toBe(true);
      expect(handler.isPermanentError(new Error('network timeout'))).toBe(false);
    });

    it('should call onFailure to update message status', () => {
      const handler = handlers.getHandler('send-dm')!;
      const context = {
        address: 'recipient',
        messageId: 'msg-123',
      };

      handler.onFailure!(context, new Error('Send failed'));

      expect(mockDeps.messageService.updateMessageStatus).toHaveBeenCalledWith(
        queryClient,
        'recipient',
        'recipient',
        'msg-123',
        'failed',
        expect.any(String)
      );
    });
  });

  describe('14. reaction-dm Handler', () => {
    it('should throw when keyset not available', async () => {
      mockDeps.getUserKeyset = vi.fn().mockReturnValue(null);
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('reaction-dm')!;

      await expect(
        handler.execute({
          address: 'recipient',
          reactionMessage: { type: 'reaction', emoji: '👍' },
          selfUserAddress: 'self',
        })
      ).rejects.toThrow('Keyset not available');
    });

    it('should classify 404 as permanent error (message deleted)', () => {
      const handler = handlers.getHandler('reaction-dm')!;

      expect(handler.isPermanentError(new Error('404 Not Found'))).toBe(true);
      expect(handler.isPermanentError(new Error('network error'))).toBe(false);
    });
  });

  describe('15. delete-dm Handler', () => {
    it('should throw when keyset not available', async () => {
      mockDeps.getUserKeyset = vi.fn().mockReturnValue(null);
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('delete-dm')!;

      await expect(
        handler.execute({
          address: 'recipient',
          deleteMessage: { type: 'remove-message' },
          selfUserAddress: 'self',
        })
      ).rejects.toThrow('Keyset not available');
    });

    it('should always return false for isPermanentError (idempotent)', () => {
      const handler = handlers.getHandler('delete-dm')!;

      expect(handler.isPermanentError(new Error('any error'))).toBe(false);
    });
  });

  describe('16. edit-dm Handler', () => {
    it('should throw when keyset not available', async () => {
      mockDeps.getUserKeyset = vi.fn().mockReturnValue(null);
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('edit-dm')!;

      await expect(
        handler.execute({
          address: 'recipient',
          editMessage: { type: 'edit', text: 'Updated' },
          messageId: 'msg-123',
          selfUserAddress: 'self',
        })
      ).rejects.toThrow('Keyset not available');
    });

    it('should skip silently when target message deleted', async () => {
      mockDeps.messageDB.getMessageById = vi.fn().mockResolvedValue(null);
      handlers = new ActionQueueHandlers(mockDeps);

      const handler = handlers.getHandler('edit-dm')!;

      // Should not throw, should complete silently
      await expect(
        handler.execute({
          address: 'recipient',
          editMessage: { type: 'edit' },
          messageId: 'deleted-msg',
          selfUserAddress: 'self',
        })
      ).resolves.not.toThrow();

      // Should not try to send
      expect(mockDeps.messageService.sendDirectMessages).not.toHaveBeenCalled();
    });

    it('should classify 404 as permanent error', () => {
      const handler = handlers.getHandler('edit-dm')!;

      expect(handler.isPermanentError(new Error('404 Not Found'))).toBe(true);
      expect(handler.isPermanentError(new Error('network error'))).toBe(false);
    });
  });

  describe('17. Error Sanitization', () => {
    it('should sanitize network errors', () => {
      const handler = handlers.getHandler('send-channel-message')!;
      const context = { spaceId: 's', channelId: 'c', messageId: 'm' };

      handler.onFailure!(context, new Error('fetch failed: network error'));

      expect(mockDeps.messageService.updateMessageStatus).toHaveBeenCalledWith(
        queryClient,
        's',
        'c',
        'm',
        'failed',
        expect.stringContaining('Network error')
      );
    });

    it('should sanitize encryption errors', () => {
      const handler = handlers.getHandler('send-channel-message')!;
      const context = { spaceId: 's', channelId: 'c', messageId: 'm' };

      handler.onFailure!(context, new Error('ratchet state corrupted'));

      expect(mockDeps.messageService.updateMessageStatus).toHaveBeenCalledWith(
        queryClient,
        's',
        'c',
        'm',
        'failed',
        expect.stringContaining('Encryption error')
      );
    });
  });

  describe('18. Handler Messages', () => {
    it('should have failureMessage for handlers that show toasts', () => {
      const handlersWithToasts = [
        'save-user-config',
        'update-space',
        'kick-user',
        'mute-user',
        'unmute-user',
        'pin-message',
        'unpin-message',
        'edit-message',
        'delete-message',
        'delete-dm',
        'edit-dm',
      ];

      for (const type of handlersWithToasts) {
        const handler = handlers.getHandler(type);
        expect(handler?.failureMessage).toBeDefined();
      }
    });

    it('should NOT have toast messages for silent handlers', () => {
      const silentHandlers = ['reaction', 'reaction-dm'];

      for (const type of silentHandlers) {
        const handler = handlers.getHandler(type);
        expect(handler?.failureMessage).toBeUndefined();
      }
    });

    it('should NOT have success messages (silent success)', () => {
      const allTypes = [
        'save-user-config',
        'update-space',
        'kick-user',
        'mute-user',
        'unmute-user',
        'reaction',
        'pin-message',
        'unpin-message',
        'edit-message',
        'delete-message',
        'send-channel-message',
        'send-dm',
        'reaction-dm',
        'delete-dm',
        'edit-dm',
      ];

      for (const type of allTypes) {
        const handler = handlers.getHandler(type);
        expect(handler?.successMessage).toBeUndefined();
      }
    });
  });

  // ==========================================================================
  // HIGH-VALUE TARGETED TESTS
  // These verify specific contracts that are easy to break during refactoring
  // ==========================================================================

  describe('19. Context Contract Validation', () => {
    /**
     * These tests verify the SHAPE of context objects that handlers expect.
     * If someone changes the context structure in enqueue() but forgets to
     * update the handler, these tests will catch it.
     */

    it('send-channel-message requires correct context fields', async () => {
      const handler = handlers.getHandler('send-channel-message')!;

      // Valid context - should not throw for missing fields
      const validContext = {
        spaceId: 'space-123',
        channelId: 'channel-456',
        signedMessage: createTestMessage(),
        messageId: 'msg-123',
      };

      // Handler should access these fields without throwing
      await expect(handler.execute(validContext)).resolves.not.toThrow();

      // Verify the handler actually used the context fields
      expect(mockDeps.messageDB.getSpace).toHaveBeenCalledWith('space-123');
    });

    it('send-dm requires correct context fields', async () => {
      const handler = handlers.getHandler('send-dm')!;

      const validContext = {
        address: 'recipient-address',
        signedMessage: createTestMessage(),
        messageId: 'msg-123',
        selfUserAddress: 'self-address',
      };

      // Should execute without throwing for undefined field access
      // (mock has encryption state so it won't throw "No established sessions")
      await expect(handler.execute(validContext)).resolves.not.toThrow();

      // Verify context was properly accessed with correct address pattern
      expect(mockDeps.messageDB.getEncryptionStates).toHaveBeenCalledWith({
        conversationId: 'recipient-address/recipient-address',
      });
    });

    it('kick-user requires correct context fields', async () => {
      const handler = handlers.getHandler('kick-user')!;

      const validContext = {
        spaceId: 'space-123',
        userAddress: 'user-to-kick',
        registration: { some: 'data' },
      };

      await handler.execute(validContext);

      expect(mockDeps.messageDB.getSpaceMembers).toHaveBeenCalledWith('space-123');
      expect(mockDeps.spaceService.kickUser).toHaveBeenCalledWith(
        'space-123',
        'user-to-kick',
        expect.anything(), // userKeyset
        expect.anything(), // deviceKeyset
        { some: 'data' },  // registration - verify it's passed correctly
        expect.anything()  // queryClient
      );
    });

    it('reaction context includes currentPasskeyInfo', async () => {
      const handler = handlers.getHandler('reaction')!;

      const validContext = {
        spaceId: 'space-123',
        channelId: 'channel-456',
        reactionMessage: { type: 'reaction', emoji: '👍', messageId: 'msg-1' },
        currentPasskeyInfo: { address: 'user-address', nickname: 'User' },
      };

      await handler.execute(validContext);

      // Verify currentPasskeyInfo is passed to submitChannelMessage
      expect(mockDeps.messageService.submitChannelMessage).toHaveBeenCalledWith(
        'space-123',
        'channel-456',
        expect.any(Object),
        expect.anything(), // queryClient
        { address: 'user-address', nickname: 'User' } // currentPasskeyInfo
      );
    });
  });

  describe('20. SDK Call Parameter Verification', () => {
    /**
     * These tests verify that the SDK encryption functions are called
     * with correctly structured parameters. Even though the SDK is mocked,
     * we can verify the call signatures are correct.
     */

    it('send-dm calls DoubleRatchetInboxEncrypt with correct structure', async () => {
      // Import the mocked channel to check call args
      const { channel } = await import('@quilibrium/quilibrium-js-sdk-channels');

      const handler = handlers.getHandler('send-dm')!;
      const testMessage = createTestMessage({ content: { type: 'post', text: 'Hello' } });

      const context = {
        address: 'recipient',
        signedMessage: testMessage,
        messageId: 'msg-123',
        selfUserAddress: 'self-addr',
        senderDisplayName: 'Test User',
      };

      await handler.execute(context);

      // Verify SDK was called with correct parameter types
      expect(channel.DoubleRatchetInboxEncrypt).toHaveBeenCalledWith(
        expect.any(Object),  // deviceKeyset
        expect.any(Array),   // encryption states array
        expect.any(String),  // JSON stringified message
        expect.objectContaining({ user_address: 'self-addr' }), // minimalSelf
        'Test User',         // senderDisplayName
        undefined            // senderUserIcon
      );

      // Verify the message was JSON stringified (not passed as object)
      const callArgs = (channel.DoubleRatchetInboxEncrypt as any).mock.calls[0];
      expect(() => JSON.parse(callArgs[2])).not.toThrow();
    });

    it('send-channel-message calls getEncryptAndSendToSpace', async () => {
      const handler = handlers.getHandler('send-channel-message')!;
      const testMessage = createTestMessage();

      await handler.execute({
        spaceId: 'space-123',
        channelId: 'channel-456',
        signedMessage: testMessage,
        messageId: 'msg-123',
      });

      // Verify the encrypt function getter was called
      expect(mockDeps.messageService.getEncryptAndSendToSpace).toHaveBeenCalled();

      // Verify the returned function was called with correct args
      const encryptFn = mockDeps.messageService.getEncryptAndSendToSpace();
      expect(encryptFn).toHaveBeenCalledWith(
        'space-123',
        testMessage,
        expect.objectContaining({
          stripEphemeralFields: true,
          saveStateAfterSend: true,
        })
      );
    });
  });

  describe('21. Error Classification Edge Cases', () => {
    /**
     * Tests for edge cases in isPermanentError that could cause
     * infinite retries or premature failures.
     */

    it('send-channel-message: treats "was deleted" errors as permanent', () => {
      const handler = handlers.getHandler('send-channel-message')!;

      // These should be permanent (no retry)
      expect(handler.isPermanentError(new Error('Space was deleted'))).toBe(true);
      expect(handler.isPermanentError(new Error('Channel was deleted'))).toBe(true);

      // Case sensitivity check
      expect(handler.isPermanentError(new Error('space was deleted'))).toBe(false);
    });

    it('send-dm: network errors are retryable', () => {
      const handler = handlers.getHandler('send-dm')!;

      // These should NOT be permanent (should retry)
      expect(handler.isPermanentError(new Error('Network error'))).toBe(false);
      expect(handler.isPermanentError(new Error('fetch failed'))).toBe(false);
      expect(handler.isPermanentError(new Error('timeout'))).toBe(false);
      expect(handler.isPermanentError(new Error('ECONNREFUSED'))).toBe(false);
    });

    it('delete handlers are idempotent (always retry or succeed)', () => {
      const deleteMessage = handlers.getHandler('delete-message')!;
      const deleteDm = handlers.getHandler('delete-dm')!;

      // Delete operations should never be permanent errors
      // (if already deleted, that's success; if network error, retry)
      expect(deleteMessage.isPermanentError(new Error('any error'))).toBe(false);
      expect(deleteDm.isPermanentError(new Error('any error'))).toBe(false);
    });
  });

  describe('22. Message Status Update Contracts', () => {
    /**
     * These tests verify that message status updates use the correct
     * spaceId/channelId patterns for both Space and DM messages.
     */

    it('send-channel-message onFailure uses spaceId/channelId', () => {
      const handler = handlers.getHandler('send-channel-message')!;

      handler.onFailure!(
        { spaceId: 'space-123', channelId: 'channel-456', messageId: 'msg-1' },
        new Error('Failed')
      );

      expect(mockDeps.messageService.updateMessageStatus).toHaveBeenCalledWith(
        expect.anything(),
        'space-123',    // spaceId
        'channel-456',  // channelId
        'msg-1',
        'failed',
        expect.any(String)
      );
    });

    it('send-dm onFailure uses address/address pattern', () => {
      const handler = handlers.getHandler('send-dm')!;

      handler.onFailure!(
        { address: 'recipient-addr', messageId: 'msg-1' },
        new Error('Failed')
      );

      // DMs use address for both spaceId and channelId
      expect(mockDeps.messageService.updateMessageStatus).toHaveBeenCalledWith(
        expect.anything(),
        'recipient-addr',  // spaceId = address
        'recipient-addr',  // channelId = address
        'msg-1',
        'failed',
        expect.any(String)
      );
    });
  });
});
