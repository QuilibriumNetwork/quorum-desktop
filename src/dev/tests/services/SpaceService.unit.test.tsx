/**
 * SpaceService - Unit Tests
 *
 * PURPOSE: Validates SpaceService error paths that do not require WASM crypto.
 *
 * APPROACH: Unit tests with vi.fn() mocks - NOT integration tests
 *
 * KNOWN GAPS (see .agents/tasks/2026-05-19-test-suite-review.md):
 * Most mutations (createSpace, updateSpace, kickUser happy path, deleteSpace
 * happy path, sendHubMessage actual invocation, createChannel, submitUpdateSpace)
 * are NOT tested here because they call into the @quilibrium/quilibrium-js-sdk-channels
 * WASM module. Future rewrite should vi.mock that module and verify the sequence
 * of DB / API / cache calls each method performs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpaceService, SpaceServiceDependencies } from '@/services/SpaceService';
import { QueryClient } from '@tanstack/react-query';

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
  });
});
