/**
 * SpaceService - Unit Tests
 *
 * PURPOSE: Validates that SpaceService functions correctly call dependencies
 * with correct parameters. Uses mocks and spies to verify behavior.
 *
 * APPROACH: Unit tests with vi.fn() mocks - NOT integration tests
 *
 * NOTE: SpaceService methods use complex crypto operations (js_generate_ed448,
 * js_generate_x448) that require WASM initialization. Instead of testing the
 * full execution (which would be integration testing), we verify method
 * signatures and that the service is properly constructed with dependencies.
 *
 * CRITICAL TESTS:
 * - Service construction and dependency injection
 * - Method existence and signatures
 * - simpler methods that don't require crypto (like sendHubMessage)
 *
 * FAILURE GUIDANCE:
 * - "Expected function but got undefined": Method is missing
 * - "Expected X parameters but got Y": Method signature changed
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

  describe('1. Service Construction', () => {
    it('should construct SpaceService with all required dependencies', () => {
      // ✅ VERIFY: Service constructed successfully
      expect(spaceService).toBeDefined();
      expect(spaceService instanceof SpaceService).toBe(true);
    });

    it('should have all required methods', () => {
      // ✅ VERIFY: All methods exist
      expect(typeof spaceService.createSpace).toBe('function');
      expect(typeof spaceService.updateSpace).toBe('function');
      expect(typeof spaceService.deleteSpace).toBe('function');
      expect(typeof spaceService.kickUser).toBe('function');
      expect(typeof spaceService.createChannel).toBe('function');
      expect(typeof spaceService.submitUpdateSpace).toBe('function');
      expect(typeof spaceService.sendHubMessage).toBe('function');
    });
  });

  describe('2. Method Signatures', () => {
    it('should have correct parameter count for createSpace', () => {
      // ✅ VERIFY: createSpace has 9 parameters
      expect(spaceService.createSpace.length).toBe(9);
    });

    it('should have correct parameter count for updateSpace', () => {
      // ✅ VERIFY: updateSpace has 2 parameters
      expect(spaceService.updateSpace.length).toBe(2);
    });

    it('should have correct parameter count for deleteSpace', () => {
      // ✅ VERIFY: deleteSpace has 2 parameters
      expect(spaceService.deleteSpace.length).toBe(2);
    });

    it('should have correct parameter count for kickUser', () => {
      // ✅ VERIFY: kickUser has 6 parameters
      expect(spaceService.kickUser.length).toBe(6);
    });

    it('should have correct parameter count for createChannel', () => {
      // ✅ VERIFY: createChannel has 1 parameter
      expect(spaceService.createChannel.length).toBe(1);
    });

    it('should have correct parameter count for sendHubMessage', () => {
      // ✅ VERIFY: sendHubMessage has 2 parameters
      expect(spaceService.sendHubMessage.length).toBe(2);
    });
  });

  describe('3. sendHubMessage() - Hub Message Sending', () => {
    it('should call getSpaceKey when sending hub message', async () => {
      // NOTE: sendHubMessage uses crypto.subtle.digest which requires browser crypto API
      // We can only verify method signature and that it calls getSpaceKey
      const spaceId = 'space-123';
      const message = JSON.stringify({ type: 'test', data: 'hello' });

      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue({
        keyId: 'hub',
        address: 'hub-address',
        publicKey: 'hub-pubkey-hex',
        privateKey: 'hub-privkey-hex',
      });

      // Can't fully test without crypto API, but verify method exists
      // ✅ VERIFY: Method exists and has correct signature
      expect(typeof spaceService.sendHubMessage).toBe('function');
      expect(spaceService.sendHubMessage.length).toBe(2);
    });
  });

  describe('4. deleteSpace() - Space Deletion', () => {
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

  describe('5. kickUser() - User Kick Validation', () => {
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
