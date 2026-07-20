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
import { deriveInboxAddress } from '@quilibrium/quorum-shared';
import { channel_raw } from '@quilibrium/quilibrium-js-sdk-channels';
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
        getSpaceMembers: vi.fn().mockResolvedValue([]),
        getSpaceMemberDevices: vi.fn().mockResolvedValue([]),
        getSpaceMemberDevice: vi.fn().mockResolvedValue(undefined),
        saveSpaceMemberDevice: vi.fn().mockResolvedValue(undefined),
        getMuteByMuteId: vi.fn().mockResolvedValue(null),
        muteUser: vi.fn().mockResolvedValue(undefined),
        unmuteUser: vi.fn().mockResolvedValue(undefined),
        isUserMuted: vi.fn().mockResolvedValue(false),
        getConversation: vi.fn().mockResolvedValue({ conversation: null }),
        updateMessage: vi.fn().mockResolvedValue(undefined),
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

    const spaceTarget = {
      messageId: 'msg-to-remove',
      spaceId: 'space',
      channelId: 'channel',
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      digestAlgorithm: 'sha256' as const,
      nonce: 'nonce',
      lastModifiedHash: 'hash',
      content: { senderId: 'original-sender', type: 'post', text: 'Message' },
    };
    const spaceRemove = (over: Record<string, unknown> = {}) => ({
      messageId: 'remove-123',
      spaceId: 'space',
      channelId: 'channel',
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      digestAlgorithm: 'sha256' as const,
      nonce: 'nonce',
      lastModifiedHash: 'hash',
      content: {
        senderId: 'original-sender',
        type: 'remove-message',
        removeMessageId: 'msg-to-remove',
      },
      ...over,
    });

    it('honors a SIGNED space delete when the verified signer authored the target', async () => {
      // The verified sender is derived from the signing key, not the payload.
      // Register a member whose inbox_address matches this public key so the
      // reverse lookup resolves to 'original-sender'.
      const publicKey = 'aabbccddeeff00112233445566778899';
      mockDeps.messageDB.getMessage = vi.fn().mockResolvedValue(spaceTarget);
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId: 'space',
        roles: [],
        groups: [],
      });
      mockDeps.messageDB.getSpaceMembers = vi.fn().mockResolvedValue([
        { address: 'original-sender', inbox_address: deriveInboxAddress(publicKey) },
      ]);

      await messageService.saveMessage(
        spaceRemove({ publicKey, signature: 'sig' }) as any,
        mockDeps.messageDB,
        'space',
        'channel',
        'direct',
        { user_icon: 'icon.png', display_name: 'User' }
      );

      expect(mockDeps.messageDB.deleteMessage).toHaveBeenCalledWith('msg-to-remove');
    });

    it('DROPS an UNSIGNED space delete (no verified signer, fail closed)', async () => {
      mockDeps.messageDB.getMessage = vi.fn().mockResolvedValue(spaceTarget);
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId: 'space',
        roles: [],
        groups: [],
      });

      await messageService.saveMessage(
        spaceRemove() as any, // no publicKey/signature
        mockDeps.messageDB,
        'space',
        'channel',
        'direct',
        { user_icon: 'icon.png', display_name: 'User' }
      );

      expect(mockDeps.messageDB.deleteMessage).not.toHaveBeenCalled();
    });

    it('DROPS a SIGNED space delete when the signer is not the author and has no role', async () => {
      // Signer resolves to 'mallory' (a real member) but claims senderId=original-sender.
      const publicKey = 'ffeeddccbbaa99887766554433221100';
      mockDeps.messageDB.getMessage = vi.fn().mockResolvedValue(spaceTarget);
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId: 'space',
        roles: [],
        groups: [],
      });
      mockDeps.messageDB.getSpaceMembers = vi.fn().mockResolvedValue([
        { address: 'mallory', inbox_address: deriveInboxAddress(publicKey) },
      ]);

      await messageService.saveMessage(
        // claims to be the author, but the key belongs to mallory → senderid-mismatch
        spaceRemove({ publicKey, signature: 'sig' }) as any,
        mockDeps.messageDB,
        'space',
        'channel',
        'direct',
        { user_icon: 'icon.png', display_name: 'User' }
      );

      expect(mockDeps.messageDB.deleteMessage).not.toHaveBeenCalled();
    });
  });

  // SECURITY: DM control-message authorization must anchor to the session-
  // authenticated sender (the conversation owner == spaceId for a DM), NOT the
  // spoofable plaintext content.senderId. See
  // .agents/tasks/2026-06-25-MASTER-RECAP-control-message-auth.md
  describe('3b. saveMessage() - DM remove-message authorization (anti-spoofing)', () => {
    // For a DM, spaceId === channelId === the proven conversation partner address.
    const PEER = 'peer-address';
    const SELF = 'my-own-address';

    const makeTarget = (authorSenderId: string) => ({
      messageId: 'target-msg',
      spaceId: PEER,
      channelId: PEER,
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      digestAlgorithm: 'sha256' as const,
      nonce: 'nonce',
      lastModifiedHash: 'hash',
      content: { senderId: authorSenderId, type: 'post' as const, text: 'msg' },
    });

    const makeRemove = (claimedSenderId: string) => ({
      messageId: 'remove-req',
      spaceId: PEER,
      channelId: PEER,
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      digestAlgorithm: 'sha256' as const,
      nonce: 'nonce',
      lastModifiedHash: 'hash',
      content: {
        senderId: claimedSenderId,
        type: 'remove-message' as const,
        removeMessageId: 'target-msg',
      },
    });

    it('(a) honors a peer deleting a message the peer authored', async () => {
      // Target authored by PEER; delete claims PEER. Both === spaceId (PEER).
      mockDeps.messageDB.getMessage = vi.fn().mockResolvedValue(makeTarget(PEER));

      await messageService.saveMessage(
        makeRemove(PEER) as any,
        mockDeps.messageDB,
        PEER, // spaceId === channelId → DM
        PEER,
        'direct',
        { user_icon: 'icon.png', display_name: 'User' }
      );

      expect(mockDeps.messageDB.deleteMessage).toHaveBeenCalledWith('target-msg');
    });

    it('(b) DROPS a peer trying to delete YOUR message by spoofing senderId=you', async () => {
      // Target authored by SELF (you). Attacker (the peer) sends a delete with
      // content.senderId spoofed to SELF. The old code compared the two plaintext
      // fields (SELF === SELF) and deleted. The fix anchors to spaceId (PEER):
      // SELF !== PEER → unauthorized → must NOT delete.
      mockDeps.messageDB.getMessage = vi.fn().mockResolvedValue(makeTarget(SELF));

      await messageService.saveMessage(
        makeRemove(SELF) as any, // spoofed claim
        mockDeps.messageDB,
        PEER,
        PEER,
        'direct',
        { user_icon: 'icon.png', display_name: 'User' }
      );

      expect(mockDeps.messageDB.deleteMessage).not.toHaveBeenCalled();
    });

    it('(b2) DROPS a peer deleting a message authored by a third party', async () => {
      // Defense-in-depth: even if the claim matched spaceId, a target not authored
      // by the proven owner must not be deletable.
      mockDeps.messageDB.getMessage = vi
        .fn()
        .mockResolvedValue(makeTarget('someone-else'));

      await messageService.saveMessage(
        makeRemove(PEER) as any,
        mockDeps.messageDB,
        PEER,
        PEER,
        'direct',
        { user_icon: 'icon.png', display_name: 'User' }
      );

      expect(mockDeps.messageDB.deleteMessage).not.toHaveBeenCalled();
    });
  });

  describe('3c. saveMessage() - DM edit-message authorization (anti-spoofing)', () => {
    const PEER = 'peer-address';
    const SELF = 'my-own-address';

    const makeTarget = (authorSenderId: string) => ({
      messageId: 'target-msg',
      spaceId: PEER,
      channelId: PEER,
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      digestAlgorithm: 'sha256' as const,
      nonce: 'orig-nonce',
      lastModifiedHash: 'orig-nonce',
      content: { senderId: authorSenderId, type: 'post' as const, text: 'original' },
    });

    const makeEdit = (claimedSenderId: string) => ({
      messageId: 'edit-req',
      spaceId: PEER,
      channelId: PEER,
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      digestAlgorithm: 'sha256' as const,
      nonce: 'nonce',
      lastModifiedHash: 'hash',
      content: {
        senderId: claimedSenderId,
        type: 'edit-message' as const,
        originalMessageId: 'target-msg',
        editedText: 'EDITED',
        editedAt: Date.now(),
        editNonce: 'edit-nonce',
      },
    });

    it('(a) honors a peer editing a message the peer authored', async () => {
      mockDeps.messageDB.getMessage = vi.fn().mockResolvedValue(makeTarget(PEER));

      await messageService.saveMessage(
        makeEdit(PEER) as any,
        mockDeps.messageDB,
        PEER,
        PEER,
        'direct',
        { user_icon: 'icon.png', display_name: 'User' }
      );

      // An applied edit persists the updated message via saveMessage.
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalled();
    });

    it('(b) DROPS a peer trying to edit YOUR message by spoofing senderId=you', async () => {
      mockDeps.messageDB.getMessage = vi.fn().mockResolvedValue(makeTarget(SELF));

      await messageService.saveMessage(
        makeEdit(SELF) as any, // spoofed claim
        mockDeps.messageDB,
        PEER,
        PEER,
        'direct',
        { user_icon: 'icon.png', display_name: 'User' }
      );

      // Unauthorized edit returns early before persisting any change.
      expect(mockDeps.messageDB.saveMessage).not.toHaveBeenCalled();
    });
  });

  // SECURITY: space mute must authorize against the verified signing key, not
  // the spoofable payload senderId (same class as remove/edit).
  describe('3d. addMessage() - Space mute authorization (anti-spoofing)', () => {
    const muteMsg = (over: Record<string, unknown> = {}) =>
      ({
        messageId: 'mute-1',
        spaceId: 'space',
        channelId: 'channel',
        nonce: 'n',
        content: {
          senderId: 'mod',
          type: 'mute',
          targetUserId: 'victim',
          muteId: 'mid-1',
          timestamp: Date.now(),
          action: 'mute',
        },
        ...over,
      }) as any;

    beforeEach(() => {
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId: 'space',
        roles: [{ members: ['mod'], permissions: ['user:mute'] }],
        groups: [],
      });
    });

    it('honors a SIGNED mute from the verified user:mute role holder', async () => {
      const publicKey = '11223344556677889900aabbccddeeff';
      mockDeps.messageDB.getSpaceMembers = vi
        .fn()
        .mockResolvedValue([{ address: 'mod', inbox_address: deriveInboxAddress(publicKey) }]);

      await messageService.addMessage(
        queryClient,
        'space',
        'channel',
        muteMsg({ publicKey, signature: 'sig' })
      );

      expect(mockDeps.messageDB.muteUser).toHaveBeenCalled();
    });

    it('DROPS an UNSIGNED mute claiming a moderator senderId (spoof)', async () => {
      await messageService.addMessage(
        queryClient,
        'space',
        'channel',
        muteMsg() // claims senderId 'mod' but no signature
      );

      expect(mockDeps.messageDB.muteUser).not.toHaveBeenCalled();
    });

    it('DROPS a SIGNED mute whose signer is not the claimed moderator', async () => {
      const publicKey = 'ff00ff00ff00ff00ff00ff00ff00ff00';
      // Key belongs to 'mallory' (no mute role); payload claims 'mod'.
      mockDeps.messageDB.getSpaceMembers = vi
        .fn()
        .mockResolvedValue([{ address: 'mallory', inbox_address: deriveInboxAddress(publicKey) }]);

      await messageService.addMessage(
        queryClient,
        'space',
        'channel',
        muteMsg({ publicKey, signature: 'sig' })
      );

      expect(mockDeps.messageDB.muteUser).not.toHaveBeenCalled();
    });
  });

  // SECURITY: a post to a read-only channel must be authorized against the
  // verified signer (a manager), not the spoofable payload senderId.
  describe('3e. addMessage() - read-only channel post authorization (anti-spoofing)', () => {
    const RO = 'ro-channel';
    const mgrPub = 'aabb00112233445566778899aabbccdd';
    const roSpace = {
      spaceId: 'space',
      roles: [{ roleId: 'mgr-role', members: ['manager'], permissions: [] }],
      groups: [
        {
          groupId: 'g1',
          channels: [
            { channelId: RO, isReadOnly: true, managerRoleIds: ['mgr-role'] },
          ],
        },
      ],
    };
    const roPost = (over: Record<string, unknown> = {}) =>
      ({
        messageId: 'ro-1',
        spaceId: 'space',
        channelId: RO,
        nonce: 'n-ro',
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        digestAlgorithm: 'sha256' as const,
        lastModifiedHash: '',
        content: { senderId: 'manager', type: 'post', text: 'announce' },
        ...over,
      }) as any;
    // The test harness mocks crypto.subtle.digest to return 32 zero bytes, so
    // the signed-post's messageId must match that (64 hex zeros) to pass the
    // fingerprint recompute in isReadOnlyPostAuthorized.
    const signedManagerPost = () =>
      roPost({ messageId: '0'.repeat(64), publicKey: mgrPub, signature: 'sig' });

    beforeEach(() => {
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue(roSpace);
      mockDeps.messageDB.getSpaceMembers = vi
        .fn()
        .mockResolvedValue([{ address: 'manager', inbox_address: deriveInboxAddress(mgrPub) }]);
    });

    it('honors a SIGNED post from the verified read-only-channel manager', async () => {
      vi.mocked(channel_raw.js_verify_ed448).mockReturnValue('true');
      const spy = vi.spyOn(queryClient, 'setQueriesData');
      await messageService.addMessage(queryClient, 'space', RO, signedManagerPost());
      expect(spy).toHaveBeenCalled();
    });

    it('DROPS an UNSIGNED post to a read-only channel', async () => {
      const spy = vi.spyOn(queryClient, 'setQueriesData');
      await messageService.addMessage(queryClient, 'space', RO, roPost()); // no signature
      expect(spy).not.toHaveBeenCalled();
    });

    it('DROPS a SIGNED read-only post whose verified signer is not a manager', async () => {
      vi.mocked(channel_raw.js_verify_ed448).mockReturnValue('true');
      // key resolves to 'intruder', who is NOT in the manager role
      mockDeps.messageDB.getSpaceMembers = vi
        .fn()
        .mockResolvedValue([{ address: 'intruder', inbox_address: deriveInboxAddress(mgrPub) }]);
      const spy = vi.spyOn(queryClient, 'setQueriesData');
      await messageService.addMessage(queryClient, 'space', RO, signedManagerPost());
      expect(spy).not.toHaveBeenCalled();
    });

    // The read-only gate must cover ALL visible content types, not just 'post'.
    // Before the fix, embed/sticker skipped the gate entirely (isPostMessage
    // === false) and were accepted from anyone.
    it('DROPS an UNSIGNED embed to a read-only channel', async () => {
      const spy = vi.spyOn(queryClient, 'setQueriesData');
      await messageService.addMessage(
        queryClient,
        'space',
        RO,
        roPost({
          messageId: 'ro-embed',
          content: { senderId: 'manager', type: 'embed', imageUrl: 'x' },
        })
      );
      expect(spy).not.toHaveBeenCalled();
    });

    it('DROPS an UNSIGNED sticker to a read-only channel', async () => {
      const spy = vi.spyOn(queryClient, 'setQueriesData');
      await messageService.addMessage(
        queryClient,
        'space',
        RO,
        roPost({
          messageId: 'ro-sticker',
          content: { senderId: 'manager', type: 'sticker', stickerId: 's1' },
        })
      );
      expect(spy).not.toHaveBeenCalled();
    });

    it('honors a SIGNED manager embed to a read-only channel', async () => {
      vi.mocked(channel_raw.js_verify_ed448).mockReturnValue('true');
      const spy = vi.spyOn(queryClient, 'setQueriesData');
      await messageService.addMessage(
        queryClient,
        'space',
        RO,
        roPost({
          messageId: '0'.repeat(64),
          publicKey: mgrPub,
          signature: 'sig',
          content: { senderId: 'manager', type: 'embed', imageUrl: 'x' },
        })
      );
      expect(spy).toHaveBeenCalled();
    });
  });

  // SECURITY (durable path): the disk write (saveMessage) must enforce read-only
  // the same way the live cache path does — otherwise a forged post/embed/sticker
  // is persisted and reappears on the next refetch from storage. FAIL-OPEN on
  // missing space/channel data: a fail-secure drop here would permanently lose a
  // legit (signed) manager message that arrives before its space row during
  // replay (see bug 2026-06-12, reverted first attempt).
  describe('3f. saveMessage() - read-only channel durable enforcement (anti-spoofing)', () => {
    const RO = 'ro-channel';
    const mgrPub = 'aabb00112233445566778899aabbccdd';
    const roSpace = {
      spaceId: 'space',
      roles: [{ roleId: 'mgr-role', members: ['manager'], permissions: [] }],
      groups: [
        {
          groupId: 'g1',
          channels: [
            { channelId: RO, isReadOnly: true, managerRoleIds: ['mgr-role'] },
          ],
        },
      ],
    };
    const roPost = (over: Record<string, unknown> = {}) =>
      ({
        messageId: 'ro-d1',
        spaceId: 'space',
        channelId: RO,
        nonce: 'n-ro',
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        digestAlgorithm: 'sha256' as const,
        lastModifiedHash: '',
        content: { senderId: 'manager', type: 'post', text: 'announce' },
        ...over,
      }) as any;
    const signedManagerPost = (over: Record<string, unknown> = {}) =>
      roPost({ messageId: '0'.repeat(64), publicKey: mgrPub, signature: 'sig', ...over });

    const save = (msg: any) =>
      messageService.saveMessage(
        msg,
        mockDeps.messageDB,
        'space',
        RO,
        'group',
        { user_icon: 'i.png', display_name: 'U' }
      );

    beforeEach(() => {
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue(roSpace);
      mockDeps.messageDB.getSpaceMembers = vi
        .fn()
        .mockResolvedValue([{ address: 'manager', inbox_address: deriveInboxAddress(mgrPub) }]);
    });

    it('PERSISTS a SIGNED manager post to a read-only channel', async () => {
      vi.mocked(channel_raw.js_verify_ed448).mockReturnValue('true');
      await save(signedManagerPost());
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalled();
    });

    it('does NOT persist an UNSIGNED post to a read-only channel', async () => {
      await save(roPost()); // no signature
      expect(mockDeps.messageDB.saveMessage).not.toHaveBeenCalled();
    });

    it('does NOT persist an UNSIGNED embed to a read-only channel', async () => {
      await save(
        roPost({ messageId: 'ro-de', content: { senderId: 'manager', type: 'embed', imageUrl: 'x' } })
      );
      expect(mockDeps.messageDB.saveMessage).not.toHaveBeenCalled();
    });

    it('does NOT persist an UNSIGNED sticker to a read-only channel', async () => {
      await save(
        roPost({ messageId: 'ro-ds', content: { senderId: 'manager', type: 'sticker', stickerId: 's1' } })
      );
      expect(mockDeps.messageDB.saveMessage).not.toHaveBeenCalled();
    });

    it('does NOT persist a SIGNED post whose verified signer is not a manager', async () => {
      vi.mocked(channel_raw.js_verify_ed448).mockReturnValue('true');
      mockDeps.messageDB.getSpaceMembers = vi
        .fn()
        .mockResolvedValue([{ address: 'intruder', inbox_address: deriveInboxAddress(mgrPub) }]);
      await save(signedManagerPost());
      expect(mockDeps.messageDB.saveMessage).not.toHaveBeenCalled();
    });

    // FAIL-OPEN: with no space row loaded we cannot prove the channel is
    // read-only, so we must NOT drop — otherwise a legit signed manager message
    // arriving before its space during replay is lost from disk forever.
    it('PERSISTS when space data is unavailable (fail-open, no legit-message loss)', async () => {
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue(null);
      await save(roPost()); // unsigned, but space unknown → cannot confirm read-only
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalled();
    });

    // Thread replies are exempt to match the live path (addMessage short-circuits
    // them before its read-only gate); the durable path must not be stricter.
    it('does NOT gate a thread reply (matches live path)', async () => {
      mockDeps.messageDB.getChannelThreads = vi.fn().mockResolvedValue([]);
      await save(roPost({ messageId: 'ro-tr', isThreadReply: true, threadId: 't1' }));
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalled();
    });
  });

  // SECURITY: update-profile must authorize against the VERIFIED signer, never
  // the spoofable payload senderId, and must NEVER write the announced key onto
  // a member row. Otherwise a forged senderId + attacker key repoints a victim's
  // inbox_address and poisons the resolveVerifiedSender reverse-lookup that
  // control-message auth (delete/edit/pin/mute) relies on.
  describe('3g. saveMessage() - update-profile authorization (anti-poisoning)', () => {
    const attackerPub = '1111111111111111111111111111111111111111111111111111111111111111';
    const victimPub = '2222222222222222222222222222222222222222222222222222222222222222';
    const freshPub = '3333333333333333333333333333333333333333333333333333333333333333';
    const attackerInbox = deriveInboxAddress(attackerPub);
    const victimInbox = deriveInboxAddress(victimPub);

    const upMsg = (over: Record<string, unknown> = {}) =>
      ({
        messageId: 'up-1',
        spaceId: 'space',
        channelId: 'space',
        nonce: 'n-up',
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        digestAlgorithm: 'sha256' as const,
        lastModifiedHash: '',
        content: { senderId: 'victim', type: 'update-profile', displayName: 'Hacked' },
        publicKey: attackerPub,
        signature: 'sig',
        ...over,
      }) as any;

    const save = (msg: any) =>
      messageService.saveMessage(
        msg,
        mockDeps.messageDB,
        'space',
        'space',
        'group',
        { user_icon: 'i.png', display_name: 'U' }
      );

    beforeEach(() => {
      mockDeps.messageDB.saveSpaceMember = vi.fn().mockResolvedValue(undefined);
      mockDeps.messageDB.getSpaceMember = vi.fn().mockResolvedValue(null);
      mockDeps.messageDB.getSpaceMembers = vi.fn().mockResolvedValue([]);
    });

    it('DROPS an unsigned update-profile', async () => {
      await save(upMsg({ publicKey: undefined, signature: undefined }));
      expect(mockDeps.messageDB.saveSpaceMember).not.toHaveBeenCalled();
    });

    it('DROPS when a KNOWN key claims another member as senderId', async () => {
      // attacker's key is registered to 'attacker'; it may not speak for 'victim'
      mockDeps.messageDB.getSpaceMembers = vi.fn().mockResolvedValue([
        { user_address: 'attacker', address: 'attacker', inbox_address: attackerInbox },
        { user_address: 'victim', address: 'victim', inbox_address: victimInbox },
      ]);
      await save(upMsg()); // senderId 'victim', signed with attacker's key
      expect(mockDeps.messageDB.saveSpaceMember).not.toHaveBeenCalled();
    });

    it('does NOT overwrite an existing member inbox_address (unknown key claiming victim)', async () => {
      // fresh key resolves to no member → accepted as a bootstrap announcement,
      // but the victim's existing inbox_address must be preserved (no poisoning).
      mockDeps.messageDB.getSpaceMembers = vi.fn().mockResolvedValue([
        { user_address: 'victim', address: 'victim', inbox_address: victimInbox },
      ]);
      mockDeps.messageDB.getSpaceMember = vi.fn().mockResolvedValue({
        user_address: 'victim',
        address: 'victim',
        inbox_address: victimInbox,
      });
      await save(upMsg({ publicKey: freshPub }));
      expect(mockDeps.messageDB.saveSpaceMember).toHaveBeenCalledWith(
        'space',
        expect.objectContaining({ inbox_address: victimInbox })
      );
    });

    it('bootstraps an unknown sender with an EMPTY inbox_address (never the announced key)', async () => {
      // no existing row; unknown key → create display-only row, inbox stays ''
      await save(
        upMsg({
          content: { senderId: 'newuser', type: 'update-profile', displayName: 'Ada' },
          publicKey: freshPub,
        })
      );
      expect(mockDeps.messageDB.saveSpaceMember).toHaveBeenCalledWith(
        'space',
        expect.objectContaining({ user_address: 'newuser', inbox_address: '' })
      );
    });

    it('accepts a member updating their OWN profile (verified signer === senderId)', async () => {
      mockDeps.messageDB.getSpaceMembers = vi.fn().mockResolvedValue([
        { user_address: 'victim', address: 'victim', inbox_address: victimInbox },
      ]);
      mockDeps.messageDB.getSpaceMember = vi.fn().mockResolvedValue({
        user_address: 'victim',
        address: 'victim',
        inbox_address: victimInbox,
      });
      // signed with victim's own key
      await save(upMsg({ publicKey: victimPub }));
      expect(mockDeps.messageDB.saveSpaceMember).toHaveBeenCalledWith(
        'space',
        expect.objectContaining({ inbox_address: victimInbox })
      );
    });
  });

  // Multi-device: a synced second device regenerates the per-device `inbox`
  // (mailbox) key, but must SIGN with the per-user `signing` key (the join key
  // receivers bound), else verified-signer auth drops its control messages. The
  // join device / pre-migration state has no `signing` key → fall back to `inbox`.
  describe('3h. getSigningKey() - per-user signing key selection (multi-device)', () => {
    const signingKey = { spaceId: 'space', keyId: 'signing', address: 'a', publicKey: 'signpub', privateKey: 'signpriv' };
    const inboxKey = { spaceId: 'space', keyId: 'inbox', address: 'b', publicKey: 'inboxpub', privateKey: 'inboxpriv' };

    it('signs with the per-user signing key when present', async () => {
      mockDeps.messageDB.getSpaceKey = vi
        .fn()
        .mockImplementation((_s: string, keyId: string) =>
          Promise.resolve(
            keyId === 'signing' ? signingKey : keyId === 'inbox' ? inboxKey : undefined
          )
        );
      const key = await (messageService as any).getSigningKey('space');
      expect(key.publicKey).toBe('signpub');
    });

    it('falls back to the inbox (mailbox) key when no signing key exists', async () => {
      mockDeps.messageDB.getSpaceKey = vi
        .fn()
        .mockImplementation((_s: string, keyId: string) =>
          Promise.resolve(keyId === 'inbox' ? inboxKey : undefined)
        );
      const key = await (messageService as any).getSigningKey('space');
      expect(key.publicKey).toBe('inboxpub');
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

  describe('6b. encryptAndSendDm() - ratchet state serialization', () => {
    // Regression test for the aead::Error frame-drop bug: Double Ratchet
    // state is strictly linear, so two concurrent sends must never both read
    // the same state snapshot (read-read-save-save loses one advance and
    // forks the ratchet). The per-conversation dmRatchetMutex must force
    // read1 → save1 → read2 → save2.
    it('serializes concurrent sends on the same conversation (no read/save interleaving)', async () => {
      const events: string[] = [];
      let stateVersion = 0;

      mockDeps.enqueueOutbound = vi
        .fn()
        .mockImplementation((fn: () => Promise<string[]>) => fn());
      mockDeps.messageDB.getEncryptionStates = vi
        .fn()
        .mockImplementation(async () => {
          events.push(`read:v${stateVersion}`);
          // Widen the race window: without the lock, both sends read here
          // before either saves.
          await new Promise((r) => setTimeout(r, 10));
          return [
            {
              state: JSON.stringify({
                tag: 'partner-inbox',
                sending_inbox: {
                  inbox_public_key: 'some-pubkey',
                  inbox_address: 'partner-inbox',
                },
                receiving_inbox: { inbox_address: 'recv-inbox' },
                ratchet_state: '{}',
              }),
              inboxId: 'partner-inbox',
              conversationId: 'partner-address/partner-address',
            },
          ];
        });
      mockDeps.messageDB.saveEncryptionState = vi
        .fn()
        .mockImplementation(async () => {
          stateVersion++;
          events.push(`save:v${stateVersion}`);
        });

      const { channel } = await import('@quilibrium/quilibrium-js-sdk-channels');
      const fakeSession = {
        ratchet_state: 'advanced',
        receiving_inbox: { inbox_address: 'recv-inbox' },
        sending_inbox: { inbox_address: 'partner-inbox' },
        tag: 'partner-inbox',
        sent_accept: true,
        sealed_message: {},
      };
      (channel.DoubleRatchetInboxEncrypt as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce([fakeSession])
        .mockReturnValueOnce([fakeSession]);

      messageService = new MessageService(mockDeps);
      const keyset = {
        deviceKeyset: { inbox_keyset: { inbox_address: 'self-inbox-addr' } },
        userKeyset: {},
      } as any;

      await Promise.all([
        messageService.encryptAndSendDm(
          'partner-address',
          { type: 'delivery-ack', messageIds: ['m1'] },
          'self-address',
          keyset
        ),
        messageService.encryptAndSendDm(
          'partner-address',
          { type: 'read-ack', upToMessageId: 'm1' },
          'self-address',
          keyset
        ),
      ]);

      // Strict alternation: the second send must observe the first send's
      // saved state, never the snapshot the first send started from.
      expect(events).toEqual(['read:v0', 'save:v1', 'read:v1', 'save:v2']);
    });

    // Regression test for the live deadlock of 2026-07-17: the lock must be
    // released once the advanced state is saved and the frames are enqueued —
    // NOT held until the outbound queue delivers them. Holding it until
    // delivery is a circular wait (outbound callbacks themselves take this
    // lock), observed live as both directions stuck at "Sending…". The
    // subtle trap: an async lock callback returning the delivery promise
    // gets auto-flattened, silently extending the critical section.
    it('releases the lock after save+enqueue even when the outbound queue never drains', async () => {
      // Simulate a stalled socket: callbacks are queued but never executed.
      const queuedCallbacks: Array<() => Promise<string[]>> = [];
      mockDeps.enqueueOutbound = vi
        .fn()
        .mockImplementation((fn: () => Promise<string[]>) => {
          queuedCallbacks.push(fn);
        });
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        {
          state: JSON.stringify({
            tag: 'partner-inbox',
            sending_inbox: {
              inbox_public_key: 'some-pubkey',
              inbox_address: 'partner-inbox',
            },
            receiving_inbox: { inbox_address: 'recv-inbox' },
            ratchet_state: '{}',
          }),
          inboxId: 'partner-inbox',
          conversationId: 'partner-address/partner-address',
        },
      ]);
      mockDeps.messageDB.saveEncryptionState = vi.fn().mockResolvedValue(undefined);

      const { channel } = await import('@quilibrium/quilibrium-js-sdk-channels');
      const fakeSession = {
        ratchet_state: 'advanced',
        receiving_inbox: { inbox_address: 'recv-inbox' },
        sending_inbox: { inbox_address: 'partner-inbox' },
        tag: 'partner-inbox',
        sent_accept: true,
        sealed_message: {},
      };
      (channel.DoubleRatchetInboxEncrypt as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce([fakeSession])
        .mockReturnValueOnce([fakeSession]);

      messageService = new MessageService(mockDeps);
      const keyset = {
        deviceKeyset: { inbox_keyset: { inbox_address: 'self-inbox-addr' } },
        userKeyset: {},
      } as any;

      // Both sends pend on delivery (queue never drains) — that's expected.
      // What must NOT happen: the first send's lock blocking the second send
      // from reaching its own encrypt+save.
      const first = messageService.encryptAndSendDm(
        'partner-address',
        { type: 'post', text: 'one' },
        'self-address',
        keyset
      );
      const second = messageService.encryptAndSendDm(
        'partner-address',
        { type: 'post', text: 'two' },
        'self-address',
        keyset
      );

      await vi.waitFor(() => {
        expect(mockDeps.messageDB.saveEncryptionState).toHaveBeenCalledTimes(2);
      });

      // Cleanup: drain the queue so both promises settle before test end.
      for (const cb of queuedCallbacks) await cb();
      await Promise.all([first, second]);
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

  // Per-device signing keys: control auth resolves a second device's key via an
  // admitted statement (stored in space_member_devices), and the receive handler
  // persists admissions/tombstones. The statement crypto itself is covered by
  // shared's deviceKeys.test.ts; these assert the desktop WIRING.
  describe('9. Per-device signing keys (admission wiring)', () => {
    const SPACE = 'space-pdk';
    const CHANNEL = 'chan-pdk';
    const ALICE = 'addr-alice-pdk';
    const USER_PUB = '11'.repeat(57);
    const DEVICE_KEY_PUB = '22'.repeat(57);
    const JOIN_KEY_PUB = '33'.repeat(57);
    const USER_ADDRESS = deriveInboxAddress(USER_PUB);
    const DEVICE_INBOX = 'dev-inbox-1';

    const aliceMember = {
      address: ALICE,
      user_address: ALICE,
      inbox_address: deriveInboxAddress(JOIN_KEY_PUB),
    };
    const admission = {
      spaceId: SPACE,
      userAddress: ALICE,
      deviceInboxAddress: DEVICE_INBOX,
      inboxAddress: deriveInboxAddress(DEVICE_KEY_PUB),
      spaceKeyPublicKey: DEVICE_KEY_PUB,
      timestamp: 1,
      revoked: false,
    };
    // remove-message of Alice's own message, signed by her SECOND device key.
    const removeOwn = {
      publicKey: DEVICE_KEY_PUB,
      signature: 'sig',
      content: { type: 'remove-message', senderId: ALICE, removeMessageId: 'm1' },
    } as any;
    const targetByAlice = { content: { senderId: ALICE, type: 'post' } } as any;

    beforeEach(() => {
      mockDeps.messageDB.getSpace = vi
        .fn()
        .mockResolvedValue({ spaceId: SPACE, groups: [], roles: [] });
      mockDeps.messageDB.getSpaceMembers = vi.fn().mockResolvedValue([aliceMember]);
    });

    it('authorizes a control message signed by an admitted second-device key', async () => {
      mockDeps.messageDB.getSpaceMemberDevices = vi
        .fn()
        .mockResolvedValue([admission]);
      const ok = await (messageService as any).isSpaceControlAuthorized(
        removeOwn,
        mockDeps.messageDB,
        SPACE,
        CHANNEL,
        targetByAlice
      );
      expect(ok).toBe(true);
    });

    it('drops the same message when no admission exists (fail closed)', async () => {
      mockDeps.messageDB.getSpaceMemberDevices = vi.fn().mockResolvedValue([]);
      const ok = await (messageService as any).isSpaceControlAuthorized(
        removeOwn,
        mockDeps.messageDB,
        SPACE,
        CHANNEL,
        targetByAlice
      );
      expect(ok).toBe(false);
    });

    it('drops the message when the admitted device key is revoked', async () => {
      mockDeps.messageDB.getSpaceMemberDevices = vi
        .fn()
        .mockResolvedValue([{ ...admission, revoked: true }]);
      const ok = await (messageService as any).isSpaceControlAuthorized(
        removeOwn,
        mockDeps.messageDB,
        SPACE,
        CHANNEL,
        targetByAlice
      );
      expect(ok).toBe(false);
    });

    it('persists an admission for a valid announce-keys statement', async () => {
      // Force the WASM verifier to accept (real Ed448 is exercised elsewhere).
      vi.mocked(channel_raw.js_verify_ed448).mockReturnValue('true' as any);
      const statement = {
        type: 'announce-keys',
        userAddress: USER_ADDRESS,
        userPublicKey: USER_PUB,
        spaceId: SPACE,
        deviceInboxAddress: DEVICE_INBOX,
        spaceKeyPublicKey: DEVICE_KEY_PUB,
        timestamp: 1000,
        signature: 'ab'.repeat(114),
      };
      const save = vi.fn().mockResolvedValue(undefined);
      mockDeps.messageDB.saveSpaceMemberDevice = save;
      mockDeps.messageDB.getSpaceMemberDevice = vi.fn().mockResolvedValue(undefined);

      await (messageService as any).processDeviceKeyStatement(statement, SPACE);

      expect(save).toHaveBeenCalledTimes(1);
      expect(save.mock.calls[0][0]).toMatchObject({
        spaceId: SPACE,
        userAddress: USER_ADDRESS,
        deviceInboxAddress: DEVICE_INBOX,
        inboxAddress: deriveInboxAddress(DEVICE_KEY_PUB),
        revoked: false,
      });
    });

    it('persists a revocation tombstone for a valid revoke-device statement', async () => {
      vi.mocked(channel_raw.js_verify_ed448).mockReturnValue('true' as any);
      const statement = {
        type: 'revoke-device',
        userAddress: USER_ADDRESS,
        userPublicKey: USER_PUB,
        spaceId: SPACE,
        deviceInboxAddress: DEVICE_INBOX,
        timestamp: 2000,
        signature: 'ab'.repeat(114),
      };
      const save = vi.fn().mockResolvedValue(undefined);
      mockDeps.messageDB.saveSpaceMemberDevice = save;
      mockDeps.messageDB.getSpaceMemberDevice = vi
        .fn()
        .mockResolvedValue({ ...admission, timestamp: 1000 });

      await (messageService as any).processDeviceKeyStatement(statement, SPACE);

      expect(save).toHaveBeenCalledTimes(1);
      expect(save.mock.calls[0][0]).toMatchObject({
        deviceInboxAddress: DEVICE_INBOX,
        revoked: true,
        timestamp: 2000,
      });
    });

    it('drops a statement whose signed spaceId does not match the delivering space', async () => {
      vi.mocked(channel_raw.js_verify_ed448).mockReturnValue('true' as any);
      const save = vi.fn().mockResolvedValue(undefined);
      mockDeps.messageDB.saveSpaceMemberDevice = save;
      const statement = {
        type: 'announce-keys',
        userAddress: USER_ADDRESS,
        userPublicKey: USER_PUB,
        spaceId: 'a-different-space',
        deviceInboxAddress: DEVICE_INBOX,
        spaceKeyPublicKey: DEVICE_KEY_PUB,
        timestamp: 1000,
        signature: 'ab'.repeat(114),
      };
      await (messageService as any).processDeviceKeyStatement(statement, SPACE);
      expect(save).not.toHaveBeenCalled();
    });
  });
});
