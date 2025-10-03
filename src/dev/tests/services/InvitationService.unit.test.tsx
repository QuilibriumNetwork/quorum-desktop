/**
 * InvitationService - Unit Tests
 *
 * PURPOSE: Validates that InvitationService functions correctly call dependencies
 * with correct parameters. Uses mocks and spies to verify behavior.
 *
 * APPROACH: Unit tests with vi.fn() mocks - NOT integration tests
 *
 * NOTE: InvitationService methods use complex crypto operations (js_generate_x448,
 * js_sign_ed448, js_decrypt_inbox_message) that require WASM initialization.
 * Tests focus on service construction, method signatures, and error handling.
 *
 * CRITICAL TESTS:
 * - Service construction and dependency injection
 * - Method existence and signatures
 * - Error handling for invalid invites
 *
 * FAILURE GUIDANCE:
 * - "Expected function but got undefined": Method is missing
 * - "Expected X parameters but got Y": Method signature changed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvitationService } from '@/services/InvitationService';
import { QueryClient } from '@tanstack/react-query';

describe('InvitationService - Unit Tests', () => {
  let invitationService: InvitationService;
  let mockDeps: any;
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

    // Setup mocks for all InvitationService dependencies
    mockDeps = {
      messageDB: {
        getSpace: vi.fn().mockResolvedValue(null),
        getSpaceKey: vi.fn().mockResolvedValue({
          keyId: 'test-key',
          publicKey: 'pubkey-hex',
          privateKey: 'privkey-hex',
        }),
        getSpaceMembers: vi.fn().mockResolvedValue([]),
        getEncryptionStates: vi.fn().mockResolvedValue([
          {
            state: JSON.stringify({
              state: JSON.stringify({
                id_peer_map: { 1: { public_key: 'peer-key' } },
                peer_id_map: {},
                root_key: 'root-key',
              }),
              template: {
                dkg_ratchet: JSON.stringify({ id: 1 }),
                root_key: 'root-key',
              },
              evals: [[1, 2, 3]],
            }),
          },
        ]),
        saveEncryptionState: vi.fn().mockResolvedValue(undefined),
        saveSpace: vi.fn().mockResolvedValue(undefined),
        saveSpaceKey: vi.fn().mockResolvedValue(undefined),
        saveSpaceMember: vi.fn().mockResolvedValue(undefined),
      } as any,
      apiClient: {
        getUser: vi.fn().mockResolvedValue({ data: { device_registrations: [] } }),
        getSpaceManifest: vi.fn().mockResolvedValue({
          data: {
            space_manifest: JSON.stringify({
              ciphertext: 'test-ciphertext',
              initialization_vector: 'test-iv',
              associated_data: 'test-ad',
            }),
            ephemeral_public_key: 'eph-key-hex',
          },
        }),
        getSpaceInviteEval: vi.fn().mockResolvedValue({ data: '{}' }),
        postSpace: vi.fn().mockResolvedValue({}),
        postSpaceManifest: vi.fn().mockResolvedValue({}),
        postSpaceInviteEvals: vi.fn().mockResolvedValue({}),
        postHubAdd: vi.fn().mockResolvedValue({}),
      } as any,
      spaceInfo: { current: {} } as any,
      selfAddress: 'address-self',
      enqueueOutbound: vi.fn(),
      queryClient,
      getConfig: vi.fn().mockResolvedValue(null),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      sendHubMessage: vi.fn().mockResolvedValue('hub-message-json'),
      requestSync: vi.fn().mockResolvedValue(undefined),
    };

    // Create InvitationService with mocked dependencies
    invitationService = new InvitationService(mockDeps);

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('1. Service Construction', () => {
    it('should construct InvitationService with all required dependencies', () => {
      // ✅ VERIFY: Service constructed successfully
      expect(invitationService).toBeDefined();
      expect(invitationService instanceof InvitationService).toBe(true);
    });

    it('should have all required methods', () => {
      // ✅ VERIFY: All methods exist
      expect(typeof invitationService.constructInviteLink).toBe('function');
      expect(typeof invitationService.sendInviteToUser).toBe('function');
      expect(typeof invitationService.generateNewInviteLink).toBe('function');
      expect(typeof invitationService.processInviteLink).toBe('function');
      expect(typeof invitationService.joinInviteLink).toBe('function');
    });
  });

  describe('2. Method Signatures', () => {
    it('should have correct parameter count for constructInviteLink', () => {
      // ✅ VERIFY: constructInviteLink has 1 parameter (spaceId)
      expect(invitationService.constructInviteLink.length).toBe(1);
    });

    it('should have correct parameter count for sendInviteToUser', () => {
      // ✅ VERIFY: sendInviteToUser has 5 parameters
      expect(invitationService.sendInviteToUser.length).toBe(5);
    });

    it('should have correct parameter count for generateNewInviteLink', () => {
      // ✅ VERIFY: generateNewInviteLink has 4 parameters
      expect(invitationService.generateNewInviteLink.length).toBe(4);
    });

    it('should have correct parameter count for processInviteLink', () => {
      // ✅ VERIFY: processInviteLink has 1 parameter (inviteLink)
      expect(invitationService.processInviteLink.length).toBe(1);
    });

    it('should have correct parameter count for joinInviteLink', () => {
      // ✅ VERIFY: joinInviteLink has 3 parameters
      expect(invitationService.joinInviteLink.length).toBe(3);
    });
  });

  describe('3. constructInviteLink() - Invite Link Construction', () => {
    it('should return existing invite URL if space has one', async () => {
      const spaceId = 'space-123';
      const existingUrl = 'https://quorum.app/invite#spaceId=space-123&configKey=abc';

      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId,
        spaceName: 'Test Space',
        inviteUrl: existingUrl,
      });

      const result = await invitationService.constructInviteLink(spaceId);

      // ✅ VERIFY: Existing URL returned
      expect(result).toBe(existingUrl);

      // ✅ VERIFY: Space retrieved
      expect(mockDeps.messageDB.getSpace).toHaveBeenCalledWith(spaceId);
    });
  });

  describe('4. processInviteLink() - Invite Link Validation', () => {
    it('should throw error for invalid invite link format', async () => {
      const invalidLink = 'invalid-link-format';

      // ✅ VERIFY: Throws error for invalid link
      await expect(
        invitationService.processInviteLink(invalidLink)
      ).rejects.toThrow();
    });

    it('should throw error if spaceId is missing from invite', async () => {
      const linkWithoutSpaceId = 'https://quorum.app/invite#configKey=abc';

      // ✅ VERIFY: Throws error for missing spaceId
      await expect(
        invitationService.processInviteLink(linkWithoutSpaceId)
      ).rejects.toThrow();
    });

    it('should throw error if configKey is missing from invite', async () => {
      const linkWithoutConfigKey = 'https://quorum.app/invite#spaceId=space-123';

      // ✅ VERIFY: Throws error for missing configKey
      await expect(
        invitationService.processInviteLink(linkWithoutConfigKey)
      ).rejects.toThrow();
    });

    it('should call apiClient.getSpaceManifest for valid invite', async () => {
      const validLink = 'https://quorum.app/invite#spaceId=space-123&configKey=abc123';

      // Mock decryption to avoid crypto operations
      try {
        await invitationService.processInviteLink(validLink);
      } catch (error) {
        // Expected to fail due to crypto operations, but should have called getSpaceManifest
      }

      // ✅ VERIFY: getSpaceManifest called with spaceId
      expect(mockDeps.apiClient.getSpaceManifest).toHaveBeenCalledWith('space-123');
    });
  });

  describe('5. sendInviteToUser() - Send Invite to User', () => {
    it('should call constructInviteLink and submitMessage', async () => {
      const address = 'recipient-address';
      const spaceId = 'space-123';
      const mockPasskeyInfo = {
        credentialId: 'cred',
        address: 'sender-address',
        publicKey: 'pubkey',
        completedOnboarding: true,
      };
      const mockKeyset = { userKeyset: {}, deviceKeyset: {} } as any;
      const mockSubmitMessage = vi.fn().mockResolvedValue(undefined);

      // Mock constructInviteLink to return quickly
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId,
        inviteUrl: 'https://test-link',
      });

      await invitationService.sendInviteToUser(
        address,
        spaceId,
        mockPasskeyInfo,
        mockKeyset,
        mockSubmitMessage
      );

      // ✅ VERIFY: getSpace called (part of constructInviteLink)
      expect(mockDeps.messageDB.getSpace).toHaveBeenCalledWith(spaceId);

      // ✅ VERIFY: getUser called for both sender and recipient
      expect(mockDeps.apiClient.getUser).toHaveBeenCalledWith(mockPasskeyInfo.address);
      expect(mockDeps.apiClient.getUser).toHaveBeenCalledWith(address);

      // ✅ VERIFY: submitMessage called
      expect(mockSubmitMessage).toHaveBeenCalled();
    });
  });

  describe('6. joinInviteLink() - Join Space via Invite', () => {
    it('should return undefined for invalid invite link format', async () => {
      const invalidLink = 'invalid-link';
      const mockKeyset = {
        userKeyset: {} as any,
        deviceKeyset: {} as any,
      };
      const mockPasskeyInfo = {
        credentialId: 'cred',
        address: 'user-address',
        publicKey: 'pubkey',
        completedOnboarding: true,
      };

      // ✅ VERIFY: Returns undefined for invalid link (parseInviteParams returns null)
      const result = await invitationService.joinInviteLink(
        invalidLink,
        mockKeyset,
        mockPasskeyInfo
      );

      expect(result).toBeUndefined();
    });
  });

  describe('7. generateNewInviteLink() - Generate New Invite', () => {
    it('should verify method exists and has correct signature', () => {
      // NOTE: generateNewInviteLink uses complex crypto operations
      // We can only verify method exists and has correct signature

      // ✅ VERIFY: Method exists
      expect(typeof invitationService.generateNewInviteLink).toBe('function');

      // ✅ VERIFY: Has 4 parameters (spaceId, user_keyset, device_keyset, registration)
      expect(invitationService.generateNewInviteLink.length).toBe(4);
    });
  });
});
