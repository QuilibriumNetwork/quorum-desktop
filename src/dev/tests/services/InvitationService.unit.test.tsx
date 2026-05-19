/**
 * InvitationService - Unit Tests
 *
 * PURPOSE: Validates InvitationService error/validation paths that do not
 * require WASM crypto.
 *
 * APPROACH: Unit tests with vi.fn() mocks - NOT integration tests
 *
 * KNOWN GAPS (see .agents/tasks/2026-05-19-test-suite-review.md):
 * - constructInviteLink non-cached path (multi-step stateful crypto with
 *   mutable ratchet ID — most valuable missing test)
 * - constructInviteLink error branches (no encryption states, missing template,
 *   no evals available)
 * - sendInviteToUser argument verification (currently only verifies the mock
 *   was called)
 * - joinInviteLink valid-link success path
 * - generateNewInviteLink — the 200+ one-time-invite generator + rekey + post
 *
 * Future rewrite should vi.mock @quilibrium/quilibrium-js-sdk-channels and
 * verify the actual sequence of DB / API / state-mutation calls.
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

  describe('1. constructInviteLink() - Invite Link Construction', () => {
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

  describe('2. processInviteLink() - Invite Link Validation', () => {
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

  });

  describe('3. sendInviteToUser() - Send Invite to User', () => {
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

  describe('4. joinInviteLink() - Join Space via Invite', () => {
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

});
