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
  });
});
