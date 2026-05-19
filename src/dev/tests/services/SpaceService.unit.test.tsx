/**
 * SpaceService - Unit Tests
 *
 * PURPOSE: Validates SpaceService behavior including mutations that call
 * into the @quilibrium/quilibrium-js-sdk-channels WASM module (mocked).
 *
 * APPROACH: Unit tests with vi.fn() mocks - NOT integration tests
 *
 * KNOWN GAPS (see .agents/tasks/2026-05-19-test-suite-review.md):
 * - kickUser happy path: the bulk of the kick work (ratchet rekey, member filtering,
 *   SealSyncEnvelope loop) runs inside the enqueueOutbound callback which is fire-and-
 *   forget. EstablishTripleRatchetSessionForSpace returns a complex session object with
 *   deep property accesses (session.template.dkg_ratchet, session.evals.shift(), etc.)
 *   that would require a very deep mock. Covered only at the enqueueOutbound-was-called level.
 * - submitUpdateSpace: the entire body runs inside enqueueOutbound (fire-and-forget).
 *   Only verifiable that enqueueOutbound is called; actual network/DB calls cannot be
 *   asserted without unwrapping the async callback.
 */

// Mock multiformats sha256 so Buffer-based digest works in jsdom
vi.mock('multiformats/hashes/sha2', () => ({
  sha256: {
    digest: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) }),
  },
}));

// Mock the secure channel WASM module
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    SealHubEnvelope: vi.fn().mockResolvedValue({ sealed: 'hub-envelope' }),
    SealSyncEnvelope: vi.fn().mockResolvedValue({ sealed: 'sync-envelope' }),
    SealInboxEnvelope: vi.fn().mockResolvedValue({ sealed: 'inbox-envelope' }),
    EstablishTripleRatchetSessionForSpace: vi.fn().mockResolvedValue({
      state: JSON.stringify({ root_key: 'rk', peer_id_map: {}, id_peer_map: { 1: { public_key: 'pk1' } } }),
      template: { dkg_ratchet: JSON.stringify({ id: 1 }), peer_id_map: {}, id_peer_map: {}, ephemeral_private_key: '' },
      evals: [],
    }),
  },
  channel_raw: {
    js_generate_ed448: vi.fn().mockReturnValue(
      JSON.stringify({ public_key: [1, 2, 3, 4, 5, 6, 7, 8], private_key: [9, 10, 11, 12, 13, 14, 15, 16] })
    ),
    js_generate_x448: vi.fn().mockReturnValue(
      JSON.stringify({ public_key: [17, 18, 19, 20, 21, 22, 23, 24], private_key: [25, 26, 27, 28, 29, 30, 31, 32] })
    ),
    js_sign_ed448: vi.fn().mockReturnValue(JSON.stringify('bW9jay1zaWduYXR1cmU=')),
    js_encrypt_inbox_message: vi.fn().mockReturnValue('mock-ciphertext'),
    js_get_pubkey_x448: vi.fn().mockReturnValue(
      JSON.stringify([17, 18, 19, 20, 21, 22, 23, 24])
    ),
    js_verify_ed448: vi.fn().mockReturnValue(true),
  },
}));

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import { SpaceService, SpaceServiceDependencies } from '@/services/SpaceService';
import { QueryClient } from '@tanstack/react-query';

// Initialize Lingui before tests so t`...` tagged templates work in createSpace
beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

describe('SpaceService - Unit Tests', () => {
  let spaceService: SpaceService;
  let mockDeps: SpaceServiceDependencies;
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

    // Setup mocks for all SpaceService dependencies
    mockDeps = {
      messageDB: {
        saveSpace: vi.fn().mockResolvedValue(undefined),
        getSpace: vi.fn().mockResolvedValue(null),
        saveSpaceKey: vi.fn().mockResolvedValue(undefined),
        getSpaceKey: vi.fn().mockResolvedValue({
          keyId: 'test-key',
          publicKey: 'pubkey-hex',
          privateKey: 'privkey-hex',
          address: 'test-address',
        }),
        getSpaceKeys: vi.fn().mockResolvedValue([]),
        deleteSpaceKey: vi.fn().mockResolvedValue(undefined),
        saveSpaceMember: vi.fn().mockResolvedValue(undefined),
        getSpaceMember: vi.fn().mockResolvedValue(null),
        getSpaceMembers: vi.fn().mockResolvedValue([]),
        deleteSpaceMember: vi.fn().mockResolvedValue(undefined),
        deleteSpace: vi.fn().mockResolvedValue(undefined),
        getAllSpaceMessages: vi.fn().mockResolvedValue([]),
        deleteMessage: vi.fn().mockResolvedValue(undefined),
        getEncryptionStates: vi.fn().mockResolvedValue([]),
        deleteEncryptionState: vi.fn().mockResolvedValue(undefined),
        saveEncryptionState: vi.fn().mockResolvedValue(undefined),
        getUserConfig: vi.fn().mockResolvedValue(null),
      } as any,
      apiClient: {
        postSpace: vi.fn().mockResolvedValue({}),
        postSpaceManifest: vi.fn().mockResolvedValue({}),
        postHubAdd: vi.fn().mockResolvedValue({}),
        postHubDelete: vi.fn().mockResolvedValue({}),
        postSpaceInviteEvals: vi.fn().mockResolvedValue({}),
        getUser: vi.fn().mockResolvedValue({ data: { device_registrations: [] } }),
      } as any,
      enqueueOutbound: vi.fn(),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      selfAddress: 'address-self',
      keyset: {
        userKeyset: { privateKey: 'user-key' } as any,
        deviceKeyset: { privateKey: 'device-key' } as any,
      },
      spaceInfo: { current: {} } as any,
      saveMessage: vi.fn().mockResolvedValue(undefined),
      addMessage: vi.fn().mockResolvedValue(undefined),
    };

    // Create SpaceService with mocked dependencies
    spaceService = new SpaceService(mockDeps);

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('1. deleteSpace() - Space Deletion', () => {
    it('should throw error if hub key is missing address', async () => {
      const spaceId = 'space-invalid';

      // Mock hub key without address
      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue({
        keyId: 'hub',
        publicKey: 'hub-pubkey-hex',
        privateKey: 'hub-privkey-hex',
        address: null, // Missing address
      });

      // ✅ VERIFY: Throws error
      await expect(
        spaceService.deleteSpace(spaceId, queryClient)
      ).rejects.toThrow();
    });

    it('should throw error if hub key is null', async () => {
      const spaceId = 'space-invalid';

      // Mock missing hub key
      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue(null);

      // ✅ VERIFY: Throws error
      await expect(
        spaceService.deleteSpace(spaceId, queryClient)
      ).rejects.toThrow();
    });
  });

  describe('2. kickUser() - User Kick Validation', () => {
    it('should throw error if space not found', async () => {
      const spaceId = 'space-nonexistent';
      const userAddress = 'user-to-kick';

      // Mock space not found
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue(null);

      const mockUserKeyset = { privateKey: 'user-key' } as any;
      const mockDeviceKeyset = { privateKey: 'device-key' } as any;
      const mockRegistration = { user_address: 'kicker' } as any;

      // ✅ VERIFY: Throws error
      await expect(
        spaceService.kickUser(
          spaceId,
          userAddress,
          mockUserKeyset,
          mockDeviceKeyset,
          mockRegistration,
          queryClient
        )
      ).rejects.toThrow('Space space-nonexistent not found');
    });

    // Note: canKickUser validation was removed - kick is now enforced at protocol level
    // Only space owners can kick (requires ED448 key signature verification)

    it('should call enqueueOutbound when space is found', async () => {
      const spaceId = 'space-exists';
      const userAddress = 'user-to-kick';

      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId,
        spaceName: 'Test Space',
        defaultChannelId: 'channel-default',
        roles: [],
        groups: [],
      });

      const mockRegistration = { user_address: 'kicker' } as any;

      await spaceService.kickUser(
        spaceId,
        userAddress,
        mockDeps.keyset.userKeyset,
        mockDeps.keyset.deviceKeyset,
        mockRegistration,
        queryClient
      );

      expect(mockDeps.enqueueOutbound).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. sendHubMessage() - Hub Envelope Construction', () => {
    it('should call SealHubEnvelope with the hub key address and return a JSON string', async () => {
      const { channel: secureChannel } = await import('@quilibrium/quilibrium-js-sdk-channels');

      mockDeps.messageDB.getSpaceKey = vi.fn().mockImplementation((_spaceId: string, keyId: string) => {
        if (keyId === 'hub') {
          return Promise.resolve({ keyId: 'hub', publicKey: 'aabb', privateKey: 'ccdd', address: 'hub-address' });
        }
        return Promise.resolve({ keyId, publicKey: 'aabb', privateKey: 'ccdd' });
      });
      spaceService = new SpaceService(mockDeps);

      const result = await spaceService.sendHubMessage('space-123', JSON.stringify({ type: 'control' }));

      expect(secureChannel.SealHubEnvelope).toHaveBeenCalledWith(
        'hub-address',
        expect.objectContaining({ type: 'ed448' }),
        JSON.stringify({ type: 'control' }),
        expect.anything()
      );
      expect(result).toContain('"type":"group"');
    });

    it('should throw when hub key is missing', async () => {
      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue(null);
      spaceService = new SpaceService(mockDeps);

      await expect(
        spaceService.sendHubMessage('space-missing', 'payload')
      ).rejects.toThrow();
    });
  });

  describe('4. createChannel() - Channel Key Generation', () => {
    it('should call saveSpaceKey and return a non-empty channel ID', async () => {
      const spaceId = 'space-123';

      const channelId = await spaceService.createChannel(spaceId);

      expect(mockDeps.messageDB.saveSpaceKey).toHaveBeenCalledWith(
        expect.objectContaining({ spaceId, keyId: channelId })
      );
      expect(typeof channelId).toBe('string');
      expect(channelId.length).toBeGreaterThan(0);
    });
  });

  describe('5. deleteSpace() - Happy Path', () => {
    it('should call postHubDelete, deleteEncryptionState, deleteSpace, and enqueueOutbound', async () => {
      const spaceId = 'space-to-delete';

      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue({
        keyId: 'hub', publicKey: 'aabb', privateKey: 'ccdd', address: 'hub-address',
      });
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        { state: '{}', conversationId: spaceId + '/' + spaceId, inboxId: 'inbox-1', timestamp: 0 },
      ]);
      mockDeps.messageDB.getAllSpaceMessages = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getSpaceMembers = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getSpaceKeys = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getUserConfig = vi.fn().mockResolvedValue({
        address: 'address-self', spaceIds: [spaceId],
      });
      spaceService = new SpaceService(mockDeps);

      await spaceService.deleteSpace(spaceId, queryClient);

      expect(mockDeps.apiClient.postHubDelete).toHaveBeenCalledWith(
        expect.objectContaining({ hub_address: 'hub-address' })
      );
      expect(mockDeps.messageDB.deleteEncryptionState).toHaveBeenCalledTimes(1);
      expect(mockDeps.messageDB.deleteSpace).toHaveBeenCalledWith(spaceId);
      expect(mockDeps.enqueueOutbound).toHaveBeenCalledTimes(1);
    });
  });

  describe('6. createSpace() - Key Generation and Persistence', () => {
    it('should call saveSpace and apiClient.postSpace and enqueueOutbound', async () => {
      const mockRegistration = {
        user_address: 'creator-address',
        inbox_address: 'inbox-addr',
      } as any;

      mockDeps.messageDB.getUserConfig = vi.fn().mockResolvedValue(null);
      mockDeps.messageDB.getSpaceMember = vi.fn().mockResolvedValue({ user_address: 'creator-address' });

      await spaceService.createSpace(
        'My Space',
        'icon.png',
        mockDeps.keyset,
        mockRegistration,
        false,
        false,
        'icon.png',
        'Creator',
        queryClient
      );

      expect(mockDeps.apiClient.postSpace).toHaveBeenCalledTimes(1);
      expect(mockDeps.messageDB.saveSpace).toHaveBeenCalledWith(
        expect.objectContaining({ spaceName: 'My Space', iconUrl: 'icon.png' })
      );
      expect(mockDeps.messageDB.saveSpaceKey).toHaveBeenCalledWith(
        expect.objectContaining({ keyId: 'hub' })
      );
      expect(mockDeps.messageDB.saveSpaceKey).toHaveBeenCalledWith(
        expect.objectContaining({ keyId: 'owner' })
      );
      expect(mockDeps.enqueueOutbound).toHaveBeenCalledTimes(1);
    });
  });

  describe('7. updateSpace() - Manifest Upload and Cache Invalidation', () => {
    it('should call saveSpace, postSpaceManifest, and invalidate the space query', async () => {
      const space = {
        spaceId: 'space-456',
        spaceName: 'Updated Space',
        roles: [],
        groups: [],
      } as any;

      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue({
        keyId: 'config', publicKey: 'aabb', privateKey: 'ccdd',
      });

      spaceService = new SpaceService(mockDeps);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await spaceService.updateSpace(space, queryClient);

      expect(mockDeps.messageDB.saveSpace).toHaveBeenCalledWith(space);
      expect(mockDeps.apiClient.postSpaceManifest).toHaveBeenCalledWith(
        'space-456',
        expect.objectContaining({ space_address: 'space-456' })
      );
      expect(invalidateSpy).toHaveBeenCalled();
      expect(mockDeps.enqueueOutbound).toHaveBeenCalledTimes(1);
    });
  });
});
