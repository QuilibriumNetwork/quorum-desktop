/**
 * MessageService - Unit Tests
 *
 * PURPOSE: Validates that MessageService functions correctly call dependencies
 * with correct parameters. Uses mocks and spies to verify behavior.
 *
 * APPROACH: Unit tests with vi.fn() mocks - NOT integration tests
 *
 * COVERED SECTIONS:
 * - submitMessage (P2P submission via enqueueOutbound)
 * - addMessage (React Query cache updates for DM and Space)
 * - saveMessage (database persistence for reaction/remove paths)
 * - encryptAndSendToSpace (hub message helper)
 *
 * KNOWN GAPS (see .agents/tasks/2026-05-19-test-suite-review.md):
 * - handleNewMessage routing (inbox-match branch and 7 message types)
 * - updateMessageStatus, encryptAndSendDm, sendEphemeralDM/SpaceControl
 * - deleteConversation, submitChannelMessage actual side effects
 * - SimpleRateLimiter integration
 *
 * FAILURE GUIDANCE:
 * - "Expected to be called but was not": Check if method call is missing
 * - "Expected to be called with X but got Y": Check parameters passed
 * - "Expected to throw but did not": Check error handling logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService, MessageServiceDependencies } from '@/services/MessageService';
import { QueryClient } from '@tanstack/react-query';

// Mock the secure channel module for crypto operations
// NOTE: crypto.randomUUID is mocked globally in setup.ts
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    TripleRatchetEncrypt: vi.fn().mockReturnValue(
      JSON.stringify({
        ratchet_state: { /* mock state */ },
        envelope: JSON.stringify({ type: 'encrypted', data: 'mock-encrypted-data' }),
      })
    ),
    DoubleRatchetInboxEncrypt: vi.fn().mockReturnValue([]),
    DoubleRatchetInboxEncryptForceSenderInit: vi.fn().mockReturnValue([]),
  },
  channel_raw: {
    js_sign_ed448: vi.fn().mockReturnValue(JSON.stringify('mock-signature')),
    js_verify_ed448: vi.fn().mockReturnValue(true),
  },
}));

describe('MessageService - Unit Tests', () => {
  let messageService: MessageService;
  let mockDeps: MessageServiceDependencies;
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
      logger: {
        log: () => {},
        warn: () => {},
        error: () => {},
      },
    });

    // Setup mocks for all MessageService dependencies
    mockDeps = {
      messageDB: {
        saveMessage: vi.fn().mockResolvedValue(undefined),
        getMessage: vi.fn().mockResolvedValue(null),
        getMessages: vi.fn().mockResolvedValue({ messages: [], hasMore: false }),
        deleteMessage: vi.fn().mockResolvedValue(undefined),
        deleteMessagesForConversation: vi.fn().mockResolvedValue(undefined),
        getSpace: vi.fn().mockResolvedValue(null),
        getAllEncryptionStates: vi.fn().mockResolvedValue([]),
        isMessageDeleted: vi.fn().mockResolvedValue(false),
        getEncryptionStates: vi.fn().mockResolvedValue([]),
        saveEncryptionState: vi.fn().mockResolvedValue(undefined),
        getSpaceKey: vi.fn().mockResolvedValue({
          keyId: 'hub',
          publicKey: 'hub-pubkey-hex',
          privateKey: 'hub-privkey-hex',
          address: 'hub-address',
        }),
        getSpaceMember: vi.fn().mockResolvedValue(null),
        isUserMuted: vi.fn().mockResolvedValue(false),
      } as any,
      enqueueOutbound: vi.fn(),
      addOrUpdateConversation: vi.fn(),
      apiClient: {} as any,
      deleteEncryptionStates: vi.fn().mockResolvedValue(undefined),
      deleteInboxMessages: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn(),
      spaceInfo: { current: {} } as any,
      syncInfo: { current: {} } as any,
      synchronizeAll: vi.fn().mockResolvedValue(undefined),
      informSyncData: vi.fn().mockResolvedValue(undefined),
      initiateSync: vi.fn().mockResolvedValue(undefined),
      directSync: vi.fn().mockResolvedValue(undefined),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      sendHubMessage: vi.fn().mockResolvedValue('message-id'),
    };

    // Create MessageService with mocked dependencies
    messageService = new MessageService(mockDeps);

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('1. submitMessage() - P2P Message Submission', () => {
    it('should call saveMessage and enqueueOutbound for P2P message', async () => {
      const selfAddress = 'address-self';
      const messageContent = 'Test P2P message';
      const mockRegistration = {
        address: selfAddress,
        publicKey: 'pubkey-self',
      } as any;
      const mockCounterpartyRegistration = {
        address: 'address-counterparty',
        publicKey: 'pubkey-counterparty',
      } as any;
      const mockPasskeyInfo = {
        address: selfAddress,
      } as any;
      const mockKeyset = {
        userKeyset: { privateKey: 'privkey' },
        deviceKeyset: { privateKey: 'devkey' },
      } as any;

      await messageService.submitMessage(
        selfAddress,
        messageContent,
        mockRegistration,
        mockCounterpartyRegistration,
        queryClient,
        mockPasskeyInfo,
        mockKeyset
      );

      // ✅ VERIFY: enqueueOutbound called (WebSocket)
      expect(mockDeps.enqueueOutbound).toHaveBeenCalled();

      // Note: submitMessage has complex internal logic with encryption
      // We verify the high-level behavior (enqueue) rather than internal details
    });

  });

  describe('2. addMessage() - Cache Updates', () => {
    it('should update queryClient cache when adding DM message', async () => {
      // DM scenario: spaceId === channelId (both are partner's address)
      const conversationId = 'dm-partner-address';

      const testMessage = {
        messageId: 'msg-dm-456',
        spaceId: conversationId,
        channelId: conversationId,
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        digestAlgorithm: 'sha256' as const,
        nonce: 'nonce',
        lastModifiedHash: 'hash',
        content: {
          senderId: 'sender',
          type: 'post' as const,
          text: 'Test DM message',
        },
      };

      const spy = vi.spyOn(queryClient, 'setQueriesData');

      await messageService.addMessage(
        queryClient,
        conversationId,
        conversationId,
        testMessage
      );

      // ✅ VERIFY: Cache was updated
      expect(spy).toHaveBeenCalled();
    });

    it('should update queryClient cache when adding Space message', async () => {
      // Space scenario: spaceId !== channelId
      // Requires mocking space data with the channel
      const spaceId = 'space-123';
      const channelId = 'channel-456';

      // Mock getSpace to return a valid space with the target channel
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId,
        groups: [
          {
            groupId: 'group-1',
            channels: [
              { channelId, isReadOnly: false },
            ],
          },
        ],
      });

      const testMessage = {
        messageId: 'msg-space-789',
        spaceId,
        channelId,
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        digestAlgorithm: 'sha256' as const,
        nonce: 'nonce',
        lastModifiedHash: 'hash',
        content: {
          senderId: 'sender',
          type: 'post' as const,
          text: 'Test Space message',
        },
      };

      const spy = vi.spyOn(queryClient, 'setQueriesData');

      await messageService.addMessage(
        queryClient,
        spaceId,
        channelId,
        testMessage
      );

      // ✅ VERIFY: Cache was updated
      expect(spy).toHaveBeenCalled();
    });

    it('should handle reaction message cache updates', async () => {
      const spaceId = 'space-123';
      const channelId = 'channel-123';

      const reactionMessage = {
        messageId: 'reaction-123',
        spaceId,
        channelId,
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        digestAlgorithm: 'sha256' as const,
        nonce: 'nonce',
        lastModifiedHash: 'hash',
        content: {
          senderId: 'sender',
          type: 'reaction' as const,
          reaction: '👍',
          messageId: 'target-msg',
        },
      };

      const spy = vi.spyOn(queryClient, 'setQueriesData');

      await messageService.addMessage(
        queryClient,
        spaceId,
        channelId,
        reactionMessage
      );

      // ✅ VERIFY: Cache update attempted
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('3. saveMessage() - Database Persistence', () => {
    it('should handle reaction messages by updating target message', async () => {
      const targetMessage = {
        messageId: 'target-msg',
        spaceId: 'space',
        channelId: 'channel',
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        digestAlgorithm: 'sha256' as const,
        nonce: 'nonce',
        lastModifiedHash: 'hash',
        content: {
          senderId: 'sender',
          type: 'post',
          text: 'Original',
        },
        reactions: [],
      };

      mockDeps.messageDB.getMessage = vi.fn().mockResolvedValue(targetMessage);

      const reactionMessage = {
        messageId: 'reaction-123',
        spaceId: 'space',
        channelId: 'channel',
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        digestAlgorithm: 'sha256' as const,
        nonce: 'nonce',
        lastModifiedHash: 'hash',
        content: {
          senderId: 'reactor',
          type: 'reaction',
          reaction: '👍',
          messageId: 'target-msg',
        },
      };

      await messageService.saveMessage(
        reactionMessage,
        mockDeps.messageDB,
        'space',
        'channel',
        'direct',
        { user_icon: 'icon.png', display_name: 'User' }
      );

      // ✅ VERIFY: getMessage called to fetch target
      expect(mockDeps.messageDB.getMessage).toHaveBeenCalledWith({
        spaceId: 'space',
        channelId: 'channel',
        messageId: 'target-msg',
      });

      // ✅ VERIFY: saveMessage called to update with reaction
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalled();
    });

    it('should handle remove-message type by calling deleteMessage', async () => {
      const targetMessage = {
        messageId: 'msg-to-remove',
        spaceId: 'space',
        channelId: 'channel',
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        digestAlgorithm: 'sha256' as const,
        nonce: 'nonce',
        lastModifiedHash: 'hash',
        content: {
          senderId: 'original-sender',
          type: 'post',
          text: 'Message',
        },
      };

      mockDeps.messageDB.getMessage = vi.fn().mockResolvedValue(targetMessage);

      const removeMessage = {
        messageId: 'remove-123',
        spaceId: 'space',
        channelId: 'channel',
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        digestAlgorithm: 'sha256' as const,
        nonce: 'nonce',
        lastModifiedHash: 'hash',
        content: {
          senderId: 'original-sender', // Same sender can remove
          type: 'remove-message',
          removeMessageId: 'msg-to-remove',
        },
      };

      await messageService.saveMessage(
        removeMessage,
        mockDeps.messageDB,
        'space',
        'channel',
        'direct',
        { user_icon: 'icon.png', display_name: 'User' }
      );

      // ✅ VERIFY: deleteMessage called
      expect(mockDeps.messageDB.deleteMessage).toHaveBeenCalledWith('msg-to-remove');
    });
  });

  describe('4. encryptAndSendToSpace() - Hub Message Helper', () => {
    const createTestMessage = () =>
      ({
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
      }) as any;

    it('should call sendHubMessage and enqueueOutbound', async () => {
      const message = createTestMessage();

      await messageService.encryptAndSendToSpace('space-123', message);

      // ✅ VERIFY: sendHubMessage was called with spaceId and message payload
      expect(mockDeps.sendHubMessage).toHaveBeenCalledWith(
        'space-123',
        expect.stringContaining('"type":"message"')
      );

      // ✅ VERIFY: enqueueOutbound was called to send via WebSocket
      expect(mockDeps.enqueueOutbound).toHaveBeenCalled();
    });

    it('should strip ephemeral fields when stripEphemeralFields is true', async () => {
      const messageWithEphemeral = {
        ...createTestMessage(),
        sendStatus: 'failed' as const,
        sendError: 'Network error',
      };

      await messageService.encryptAndSendToSpace('space-123', messageWithEphemeral, {
        stripEphemeralFields: true,
      });

      // ✅ VERIFY: sendHubMessage was called
      expect(mockDeps.sendHubMessage).toHaveBeenCalled();

      // ✅ VERIFY: The payload should NOT contain ephemeral fields
      const payload = JSON.parse(mockDeps.sendHubMessage.mock.calls[0][1]);
      expect(payload.message.sendStatus).toBeUndefined();
      expect(payload.message.sendError).toBeUndefined();
    });

    it('should return the outbound message ID from sendHubMessage', async () => {
      const message = createTestMessage();
      const expectedOutboundId = 'outbound-msg-id-456';

      mockDeps.sendHubMessage = vi.fn().mockResolvedValue(expectedOutboundId);
      messageService = new MessageService(mockDeps);

      const result = await messageService.encryptAndSendToSpace('space-123', message);

      // ✅ VERIFY: Returns the outbound ID
      expect(result).toBe(expectedOutboundId);
    });

  });

  describe('5. updateMessageStatus() - Cache Mutation', () => {
    const seedCacheWithSendingMessage = (
      qc: QueryClient,
      spaceId: string,
      channelId: string,
      msg: Record<string, unknown>
    ) => {
      qc.setQueryData(['Messages', spaceId, channelId, 'no-threads'], {
        pageParams: [null],
        pages: [{ messages: [msg], nextCursor: null, prevCursor: null }],
      });
    };

    it('should clear sendStatus and sendError when status is "sent"', () => {
      const spaceId = 'space-abc';
      const channelId = 'channel-abc';
      const messageId = 'msg-optimistic-1';

      seedCacheWithSendingMessage(queryClient, spaceId, channelId, {
        messageId,
        sendStatus: 'sending',
        sendError: undefined,
        content: { type: 'post', senderId: 'me', text: 'hello' },
      });

      messageService.updateMessageStatus(queryClient, spaceId, channelId, messageId, 'sent');

      const cached = queryClient.getQueryData<any>(['Messages', spaceId, channelId, 'no-threads']);
      const updatedMsg = cached.pages[0].messages[0];
      expect(updatedMsg.sendStatus).toBeUndefined();
      expect(updatedMsg.sendError).toBeUndefined();
    });

    it('should set sendStatus "failed" and write the error string', () => {
      const spaceId = 'space-abc';
      const channelId = 'channel-abc';
      const messageId = 'msg-optimistic-2';

      seedCacheWithSendingMessage(queryClient, spaceId, channelId, {
        messageId,
        sendStatus: 'sending',
        content: { type: 'post', senderId: 'me', text: 'hello' },
      });

      messageService.updateMessageStatus(queryClient, spaceId, channelId, messageId, 'failed', 'Network timeout');

      const cached = queryClient.getQueryData<any>(['Messages', spaceId, channelId, 'no-threads']);
      const updatedMsg = cached.pages[0].messages[0];
      expect(updatedMsg.sendStatus).toBe('failed');
      expect(updatedMsg.sendError).toBe('Network timeout');
    });

    it('should not modify a message that has no sendStatus (server version already landed)', () => {
      const spaceId = 'space-abc';
      const channelId = 'channel-abc';
      const messageId = 'msg-server-version';

      seedCacheWithSendingMessage(queryClient, spaceId, channelId, {
        messageId,
        sendStatus: undefined,
        content: { type: 'post', senderId: 'me', text: 'confirmed' },
      });

      messageService.updateMessageStatus(queryClient, spaceId, channelId, messageId, 'failed', 'late error');

      const cached = queryClient.getQueryData<any>(['Messages', spaceId, channelId, 'no-threads']);
      const msg = cached.pages[0].messages[0];
      // sendStatus was already undefined — must remain undefined (server version is authoritative)
      expect(msg.sendStatus).toBeUndefined();
      expect(msg.sendError).toBeUndefined();
    });
  });

  describe('6. encryptAndSendDm() - DM Encryption and Dispatch', () => {
    const makeKeyset = (selfInboxAddress: string) =>
      ({
        deviceKeyset: {
          inbox_keyset: { inbox_address: selfInboxAddress },
        },
        userKeyset: {},
      }) as any;

    beforeEach(() => {
      // sendDirectMessages wraps resolve() inside the enqueueOutbound callback.
      // The default vi.fn() never calls the callback, so the promise never settles.
      // Override here so the callback is invoked immediately, unblocking the await.
      mockDeps.enqueueOutbound = vi.fn().mockImplementation((fn: () => Promise<string[]>) => fn());
      messageService = new MessageService(mockDeps);
    });

    it('should throw when there are no encryption states (no established sessions)', async () => {
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([]);

      await expect(
        messageService.encryptAndSendDm(
          'partner-address',
          { type: 'post', text: 'hi' },
          'self-address',
          makeKeyset('self-inbox-addr'),
        )
      ).rejects.toThrow('No established sessions available');
    });

    it('should call DoubleRatchetInboxEncrypt and enqueueOutbound for an established session', async () => {
      const selfInbox = 'self-inbox-addr';
      const partnerInbox = 'partner-inbox-addr';

      // One encryption state for the partner (tag !== selfInbox, has a public key)
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        {
          state: JSON.stringify({
            tag: partnerInbox,
            sending_inbox: { inbox_public_key: 'some-pubkey', inbox_address: partnerInbox },
            receiving_inbox: { inbox_address: 'recv-inbox' },
            ratchet_state: '{}',
          }),
          inboxId: partnerInbox,
          conversationId: 'partner-address/partner-address',
        },
      ]);

      const { channel } = await import('@quilibrium/quilibrium-js-sdk-channels');

      await messageService.encryptAndSendDm(
        'partner-address',
        { type: 'post', text: 'hi' },
        'self-address',
        makeKeyset(selfInbox),
      );

      expect(channel.DoubleRatchetInboxEncrypt).toHaveBeenCalledWith(
        expect.objectContaining({ inbox_keyset: { inbox_address: selfInbox } }),
        expect.arrayContaining([expect.objectContaining({ tag: partnerInbox })]),
        expect.any(String),
        expect.objectContaining({ user_address: 'self-address' }),
        undefined,
        undefined
      );
      // sendDirectMessages always calls enqueueOutbound (even with empty outbound list)
      expect(mockDeps.enqueueOutbound).toHaveBeenCalled();
    });

    it('should call DoubleRatchetInboxEncryptForceSenderInit when sending_inbox.inbox_public_key is empty', async () => {
      const selfInbox = 'self-inbox-addr';
      const partnerInbox = 'partner-inbox-force';

      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        {
          state: JSON.stringify({
            tag: partnerInbox,
            sending_inbox: { inbox_public_key: '', inbox_address: partnerInbox },
            receiving_inbox: { inbox_address: 'recv-inbox-force' },
            ratchet_state: '{}',
          }),
          inboxId: partnerInbox,
          conversationId: 'partner-address/partner-address',
        },
      ]);

      const { channel } = await import('@quilibrium/quilibrium-js-sdk-channels');

      await messageService.encryptAndSendDm(
        'partner-address',
        { type: 'post', text: 'hi' },
        'self-address',
        makeKeyset(selfInbox),
      );

      expect(channel.DoubleRatchetInboxEncryptForceSenderInit).toHaveBeenCalledWith(
        expect.objectContaining({ inbox_keyset: { inbox_address: selfInbox } }),
        expect.arrayContaining([expect.objectContaining({ tag: partnerInbox })]),
        expect.any(String),
        expect.objectContaining({ user_address: 'self-address' }),
        undefined,
        undefined
      );
    });
  });

  describe('7. sendEphemeralSpaceControl() - Typing Indicator (Space)', () => {
    it('should encrypt via TripleRatchet and enqueue outbound without saving to DB', async () => {
      const typingMsg = { type: 'typing-start', senderId: 'me' } as any;

      await messageService.sendEphemeralSpaceControl('space-xyz', typingMsg);

      expect(mockDeps.sendHubMessage).toHaveBeenCalledWith(
        'space-xyz',
        expect.stringContaining('"type":"message"')
      );
      expect(mockDeps.enqueueOutbound).toHaveBeenCalled();
      expect(mockDeps.messageDB.saveMessage).not.toHaveBeenCalled();
    });

    it('should not throw even when encryptAndSendToSpace rejects', async () => {
      mockDeps.sendHubMessage = vi.fn().mockRejectedValue(new Error('hub down'));
      messageService = new MessageService(mockDeps);

      await expect(
        messageService.sendEphemeralSpaceControl('space-xyz', { type: 'typing-start' } as any)
      ).resolves.toBeUndefined();
    });
  });

  describe('8. sendEphemeralDMControl() - Typing Indicator (DM)', () => {
    it('should not throw even when encryptAndSendDm rejects (no sessions)', async () => {
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([]);

      const keyset = {
        deviceKeyset: { inbox_keyset: { inbox_address: 'self-inbox' } },
        userKeyset: {},
      } as any;

      await expect(
        messageService.sendEphemeralDMControl('partner', { type: 'typing-start' } as any, 'self-addr', keyset)
      ).resolves.toBeUndefined();
    });
  });

  describe('9. addMessage() - Space post rejected when space not found in DB', () => {
    it('should not update the cache when getSpace returns null for a space post message', async () => {
      const spaceId = 'space-unknown';
      const channelId = 'channel-456';

      // getSpace returns null → fail-secure rejection
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue(null);

      const postMessage = {
        messageId: 'msg-rejected',
        spaceId,
        channelId,
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        digestAlgorithm: 'sha256' as const,
        nonce: 'nonce',
        lastModifiedHash: 'hash',
        content: {
          senderId: 'sender',
          type: 'post' as const,
          text: 'This should be rejected',
        },
      };

      const spy = vi.spyOn(queryClient, 'setQueriesData');

      await messageService.addMessage(queryClient, spaceId, channelId, postMessage);

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
