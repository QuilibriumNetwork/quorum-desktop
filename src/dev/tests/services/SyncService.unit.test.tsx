/**
 * SyncService - Unit Tests
 *
 * PURPOSE: Validates SyncService early-return / control-flow paths that do
 * not require WASM crypto.
 *
 * APPROACH: Unit tests with vi.fn() mocks - NOT integration tests
 *
 * KNOWN GAPS (see .agents/tasks/2026-05-19-test-suite-review.md):
 * 9 of 12 public methods have zero coverage: handleSyncInitiateV2,
 * handleSyncManifest, requestSync, directSync, synchronizeAll,
 * updateCacheWithMessage, updateCacheWithMember, removeCacheMessage,
 * getSharedSyncService. Several have testable early-return paths that
 * don't require WASM and should be filled in.
 *
 * Note: this is the desktop wrapper of SyncService. The shared protocol
 * logic lives in quorum-shared/src/sync/ with its own test file.
 */

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    SealHubEnvelope: vi.fn().mockResolvedValue({ sealed: 'hub' }),
    SealSyncEnvelope: vi.fn().mockResolvedValue({ sealed: 'sync' }),
  },
  channel_raw: {
    js_sign_ed448: vi.fn().mockReturnValue(JSON.stringify('mock-sig')),
    js_verify_ed448: vi.fn().mockReturnValue(true),
  },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '@/services/SyncService';

describe('SyncService - Unit Tests', () => {
  let syncService: SyncService;
  let mockDeps: any;

  beforeEach(() => {
    // Setup mocks for all SyncService dependencies
    mockDeps = {
      messageDB: {
        getSpace: vi.fn().mockResolvedValue({ defaultChannelId: 'channel-123' }),
        getSpaceKey: vi.fn().mockResolvedValue({
          keyId: 'test-key',
          publicKey: 'pubkey-hex',
          privateKey: 'privkey-hex',
          address: 'test-address',
        }),
        getSpaceMembers: vi.fn().mockResolvedValue([]),
        getAllSpaceMessages: vi.fn().mockResolvedValue([]),
        getEncryptionStates: vi.fn().mockResolvedValue([
          {
            state: JSON.stringify({
              state: JSON.stringify({
                id_peer_map: { 1: { public_key: 'peer-key' } },
                peer_id_map: {},
              }),
            }),
          },
        ]),
      } as any,
      enqueueOutbound: vi.fn(),
      syncInfo: {
        current: {},
      } as any,
      sendHubMessage: vi.fn().mockResolvedValue('hub-message-json'),
    };

    // Create SyncService with mocked dependencies
    syncService = new SyncService(mockDeps);

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('1. initiateSync() - Early Return Validation', () => {
    it('should return early if no sync info exists for space', async () => {
      const spaceId = 'space-123';

      // Ensure syncInfo is empty
      mockDeps.syncInfo.current = {};

      await syncService.initiateSync(spaceId);

      // ✅ VERIFY: No database calls made (early return)
      expect(mockDeps.messageDB.getSpaceMembers).not.toHaveBeenCalled();
      expect(mockDeps.messageDB.getAllSpaceMessages).not.toHaveBeenCalled();
    });

    it('should return early if candidates array is empty', async () => {
      const spaceId = 'space-123';

      // Setup syncInfo with empty candidates
      mockDeps.syncInfo.current[spaceId] = {
        expiry: Date.now() + 30000,
        candidates: [],
        invokable: undefined,
      };

      await syncService.initiateSync(spaceId);

      // ✅ VERIFY: No database calls made (early return)
      expect(mockDeps.messageDB.getSpaceMembers).not.toHaveBeenCalled();
      expect(mockDeps.messageDB.getAllSpaceMessages).not.toHaveBeenCalled();
    });
  });

  describe('2. sendVerifyKickedStatuses() - Kicked User Detection', () => {
    it('should return 0 if no kicked users found', async () => {
      const spaceId = 'space-123';

      // Mock messages with no kick events
      mockDeps.messageDB.getAllSpaceMessages = vi.fn().mockResolvedValue([
        {
          messageId: 'msg-1',
          content: { type: 'post', senderId: 'user-1' },
          createdDate: Date.now(),
        },
      ]);

      const result = await syncService.sendVerifyKickedStatuses(spaceId);

      // ✅ VERIFY: Returns 0 for no kicked users
      expect(result).toBe(0);

      // ✅ VERIFY: No outbound messages enqueued
      expect(mockDeps.enqueueOutbound).not.toHaveBeenCalled();
    });

    it('should detect kicked users from kick events', async () => {
      const spaceId = 'space-123';

      // Mock messages with kick event
      mockDeps.messageDB.getAllSpaceMessages = vi.fn().mockResolvedValue([
        {
          messageId: 'msg-1',
          content: { type: 'kick', senderId: 'user-kicked' },
          createdDate: Date.now() - 1000,
        },
      ]);

      const result = await syncService.sendVerifyKickedStatuses(spaceId);

      // ✅ VERIFY: Returns 1 kicked user
      expect(result).toBe(1);

      // ✅ VERIFY: Outbound message enqueued
      expect(mockDeps.enqueueOutbound).toHaveBeenCalled();
    });

    it('should handle join events after kick events', async () => {
      const spaceId = 'space-123';

      // Mock messages: kick then join (user rejoined)
      mockDeps.messageDB.getAllSpaceMessages = vi.fn().mockResolvedValue([
        {
          messageId: 'msg-1',
          content: { type: 'kick', senderId: 'user-1' },
          createdDate: Date.now() - 2000,
        },
        {
          messageId: 'msg-2',
          content: { type: 'join', senderId: 'user-1' },
          createdDate: Date.now() - 1000,
        },
      ]);

      const result = await syncService.sendVerifyKickedStatuses(spaceId);

      // ✅ VERIFY: Returns 0 (user rejoined after kick)
      expect(result).toBe(0);
    });
  });

  describe('3. informSyncData() - Sync Info Early Return', () => {
    it('should return early if inbox addresses match', async () => {
      const spaceId = 'space-123';
      const inboxAddress = 'inbox-address';

      // Mock inbox key with matching address
      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue({
        keyId: 'inbox',
        address: inboxAddress, // Same as parameter
        publicKey: 'pubkey',
        privateKey: 'privkey',
      });

      await syncService.informSyncData(spaceId, inboxAddress, 10, 5);

      // ✅ VERIFY: No members/messages fetched (early return)
      expect(mockDeps.messageDB.getSpaceMembers).not.toHaveBeenCalled();
      expect(mockDeps.messageDB.getAllSpaceMessages).not.toHaveBeenCalled();
    });

    it('should return early if remote has more or equal data', async () => {
      const spaceId = 'space-123';
      const inboxAddress = 'inbox-address';
      const differentInboxAddress = 'different-inbox';

      // Mock inbox key with different address
      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue({
        keyId: 'inbox',
        address: differentInboxAddress,
        publicKey: 'pubkey',
        privateKey: 'privkey',
      });

      // Mock local data (5 messages, 3 members)
      mockDeps.messageDB.getSpaceMembers = vi.fn().mockResolvedValue([
        { user_address: 'user-1' },
        { user_address: 'user-2' },
        { user_address: 'user-3' },
      ]);
      mockDeps.messageDB.getAllSpaceMessages = vi.fn().mockResolvedValue([
        { messageId: 'msg-1' },
        { messageId: 'msg-2' },
        { messageId: 'msg-3' },
        { messageId: 'msg-4' },
        { messageId: 'msg-5' },
      ]);

      // Remote has same or more data (10 messages, 5 members)
      await syncService.informSyncData(spaceId, inboxAddress, 10, 5);

      // ✅ VERIFY: No sync envelope created (early return)
      expect(mockDeps.enqueueOutbound).not.toHaveBeenCalled();
    });

    it('should return early when inboxKey is null', async () => {
      const spaceId = 'space-123';
      const inboxAddress = 'remote-inbox';

      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue(null);

      await syncService.informSyncData(spaceId, inboxAddress, 5, 2);

      expect(mockDeps.messageDB.getSpaceMembers).not.toHaveBeenCalled();
      expect(mockDeps.enqueueOutbound).not.toHaveBeenCalled();
    });
  });

  describe('4. sendVerifyKickedStatuses() - Additional Guards', () => {
    it('should ignore kick messages with null senderId', async () => {
      const spaceId = 'space-123';

      mockDeps.messageDB.getAllSpaceMessages = vi.fn().mockResolvedValue([
        {
          messageId: 'msg-1',
          content: { type: 'kick', senderId: null },
          createdDate: Date.now() - 1000,
        },
      ]);

      const result = await syncService.sendVerifyKickedStatuses(spaceId);

      expect(result).toBe(0);
      expect(mockDeps.enqueueOutbound).not.toHaveBeenCalled();
    });

    it('should count and enqueue once for multiple kicked users', async () => {
      const spaceId = 'space-123';

      mockDeps.messageDB.getAllSpaceMessages = vi.fn().mockResolvedValue([
        {
          messageId: 'msg-1',
          content: { type: 'kick', senderId: 'user-a' },
          createdDate: Date.now() - 3000,
        },
        {
          messageId: 'msg-2',
          content: { type: 'kick', senderId: 'user-b' },
          createdDate: Date.now() - 2000,
        },
        {
          messageId: 'msg-3',
          content: { type: 'kick', senderId: 'user-c' },
          createdDate: Date.now() - 1000,
        },
      ]);

      const result = await syncService.sendVerifyKickedStatuses(spaceId);

      expect(result).toBe(3);
      expect(mockDeps.enqueueOutbound).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. synchronizeAll() - Owner Key Guard', () => {
    it('should not enqueue outbound when ownerKey is null', async () => {
      const spaceId = 'space-123';
      const inboxAddress = 'remote-inbox';

      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue(null);

      await syncService.synchronizeAll(spaceId, inboxAddress);

      expect(mockDeps.enqueueOutbound).not.toHaveBeenCalled();
    });

    it('should enqueue outbound when ownerKey exists', async () => {
      const spaceId = 'space-123';
      const inboxAddress = 'remote-inbox';

      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue({
        keyId: 'owner',
        address: 'owner-address',
        publicKey: 'pubkey-hex',
        privateKey: 'privkey-hex',
      });

      await syncService.synchronizeAll(spaceId, inboxAddress);

      expect(mockDeps.enqueueOutbound).toHaveBeenCalledTimes(1);
    });
  });

  describe('6. handleSyncInitiateV2() - Missing Manifest Fallback', () => {
    it('should fall back to directSync when manifest is missing', async () => {
      const spaceId = 'space-123';
      const message = {
        inboxAddress: 'remote-inbox',
        manifest: undefined,
        memberDigests: [],
        peerIds: [],
        memberCount: 2,
        messageCount: 5,
        latestMessageTimestamp: -1,
        oldestMessageTimestamp: -1,
      } as any;

      await syncService.handleSyncInitiateV2(spaceId, message);

      expect(mockDeps.enqueueOutbound).toHaveBeenCalledTimes(1);
    });

    it('should fall back to directSync when inboxAddress is missing', async () => {
      const spaceId = 'space-123';
      const message = {
        inboxAddress: undefined,
        manifest: { digests: [], channelId: spaceId },
        memberDigests: [],
        peerIds: [],
        memberCount: 2,
        messageCount: 5,
        latestMessageTimestamp: -1,
        oldestMessageTimestamp: -1,
      } as any;

      await syncService.handleSyncInitiateV2(spaceId, message);

      expect(mockDeps.enqueueOutbound).toHaveBeenCalledTimes(1);
    });
  });

  describe('7. getSharedSyncService() - Accessor', () => {
    it('should return a non-null SharedSyncService instance', () => {
      const shared = syncService.getSharedSyncService();

      expect(shared).not.toBeNull();
      expect(typeof shared.buildSyncRequest).toBe('function');
    });
  });

  describe('8. updateCacheWith* / removeCacheMessage() - Delegation to SharedSyncService', () => {
    it('updateCacheWithMessage delegates to sharedSyncService', () => {
      const shared = syncService.getSharedSyncService();
      const spy = vi.spyOn(shared as any, 'updateCacheWithMessage');

      const message = { messageId: 'msg-42', createdDate: 1000, content: { type: 'post' } } as any;
      syncService.updateCacheWithMessage('space-1', 'channel-1', message);

      expect(spy).toHaveBeenCalledWith('space-1', 'channel-1', message);
    });

    it('updateCacheWithMember delegates to sharedSyncService', () => {
      const shared = syncService.getSharedSyncService();
      const spy = vi.spyOn(shared as any, 'updateCacheWithMember');

      const member = { address: 'addr-abc' } as any;
      syncService.updateCacheWithMember('space-1', 'channel-1', member);

      expect(spy).toHaveBeenCalledWith('space-1', 'channel-1', member);
    });

    it('removeCacheMessage delegates to sharedSyncService', () => {
      const shared = syncService.getSharedSyncService();
      const spy = vi.spyOn(shared as any, 'removeCacheMessage');

      syncService.removeCacheMessage('space-1', 'channel-1', 'msg-42');

      expect(spy).toHaveBeenCalledWith('space-1', 'channel-1', 'msg-42');
    });
  });
});
