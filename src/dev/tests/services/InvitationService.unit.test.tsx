/**
 * InvitationService - Unit Tests
 *
 * PURPOSE: Validates InvitationService behavior including state mutations,
 * dependency call sequences, and error branches.
 *
 * APPROACH: Unit tests with vi.fn() mocks - NOT integration tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvitationService } from '@/services/InvitationService';
import { QueryClient } from '@tanstack/react-query';

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    SealHubEnvelope: vi.fn().mockResolvedValue(JSON.stringify({ envelope: 'mock' })),
    TripleRatchetEncrypt: vi.fn().mockReturnValue(
      JSON.stringify({ ratchet_state: {}, envelope: '{}' })
    ),
    DoubleRatchetInboxEncrypt: vi.fn().mockReturnValue([]),
    EstablishTripleRatchetSessionForSpace: vi.fn().mockResolvedValue({
      state: JSON.stringify({
        peer_id_map: {},
        id_peer_map: { 1: { public_key: 'peer-key' } },
        root_key: 'root-key',
      }),
      template: {
        dkg_ratchet: JSON.stringify({ id: 1, total: 1 }),
        root_key: 'root-key',
        peer_id_map: {},
        id_peer_map: {},
      },
      evals: [],
    }),
    SealInboxEnvelope: vi.fn().mockResolvedValue('{}'),
    SealSyncEnvelope: vi.fn().mockResolvedValue({}),
  },
  channel_raw: {
    js_generate_x448: vi.fn().mockReturnValue(
      JSON.stringify({ public_key: [1, 2, 3], private_key: [4, 5, 6] })
    ),
    js_generate_ed448: vi.fn().mockReturnValue(
      JSON.stringify({ public_key: [7, 8, 9], private_key: [10, 11, 12] })
    ),
    js_sign_ed448: vi.fn().mockReturnValue(JSON.stringify('mock-signature')),
    js_verify_ed448: vi.fn().mockReturnValue(true),
    js_decrypt_inbox_message: vi.fn().mockReturnValue(
      JSON.stringify(JSON.stringify({ spaceId: 'space-123', spaceName: 'Test Space', defaultChannelId: 'chan-1', inviteUrl: 'https://qm.one/invite/#spaceId=space-123&configKey=aabbcc' }))
    ),
    js_get_pubkey_x448: vi.fn().mockReturnValue(
      Buffer.from([1, 2, 3]).toString('base64')
    ),
    js_get_pubkey_ed448: vi.fn().mockReturnValue(
      Buffer.from([7, 8, 9]).toString('base64')
    ),
    js_encrypt_inbox_message: vi.fn().mockReturnValue('encrypted-ciphertext'),
  },
}));

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

  describe('5. constructInviteLink() - Non-Cached Path', () => {
    it('should consume one eval, persist updated state, and return URL with spaceId and configKey', async () => {
      const spaceId = 'space-abc';

      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId,
        spaceName: 'Test Space',
        inviteUrl: null,
      });
      mockDeps.messageDB.getSpaceKey = vi.fn()
        .mockResolvedValueOnce({ keyId: 'config', publicKey: 'cfg-pub', privateKey: 'cfg-priv' })
        .mockResolvedValueOnce({ keyId: 'hub', publicKey: 'hub-pub', privateKey: 'hub-priv' });

      const encStateRaw = {
        state: JSON.stringify({
          id_peer_map: { 1: { public_key: 'peer-key' } },
          peer_id_map: {},
          root_key: 'root-key-value',
        }),
        template: {
          dkg_ratchet: JSON.stringify({ id: 5 }),
          root_key: 'old-root-key',
        },
        evals: [[10, 20, 30], [40, 50, 60]],
      };
      const encStateRecord = { state: JSON.stringify(encStateRaw), conversationId: spaceId + '/' + spaceId };
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([encStateRecord]);

      const result = await invitationService.constructInviteLink(spaceId);

      expect(result).toContain('spaceId=' + spaceId);
      expect(result).toContain('configKey=cfg-priv');
      expect(result).toContain('hubKey=hub-priv');

      expect(mockDeps.messageDB.saveEncryptionState).toHaveBeenCalledWith(
        expect.objectContaining({
          state: expect.stringContaining('"evals":[[40,50,60]]'),
        }),
        true
      );
    });

    it('should set ratchet.id to 10001 minus the number of evals before consuming', async () => {
      const spaceId = 'space-ratchet';

      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({ spaceId, inviteUrl: null });
      mockDeps.messageDB.getSpaceKey = vi.fn()
        .mockResolvedValueOnce({ keyId: 'config', publicKey: 'cpub', privateKey: 'cpriv' })
        .mockResolvedValueOnce({ keyId: 'hub', publicKey: 'hpub', privateKey: 'hpriv' });

      const encStateRaw = {
        state: JSON.stringify({ root_key: 'rk', id_peer_map: {}, peer_id_map: {} }),
        template: {
          dkg_ratchet: JSON.stringify({ id: 99 }),
          root_key: 'rk',
        },
        evals: [[1], [2], [3]],
      };
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        { state: JSON.stringify(encStateRaw), conversationId: spaceId + '/' + spaceId },
      ]);

      const result = await invitationService.constructInviteLink(spaceId);

      const savedCall = mockDeps.messageDB.saveEncryptionState.mock.calls[0][0];
      const savedSets = JSON.parse(savedCall.state);
      const savedTemplate = savedSets.template;
      const savedRatchet = JSON.parse(savedTemplate.dkg_ratchet);
      expect(savedRatchet.id).toBe(10001 - 3);

      expect(result).toContain('spaceId=' + spaceId);
    });

    it('should throw when getEncryptionStates returns empty array', async () => {
      const spaceId = 'space-no-enc';

      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({ spaceId, inviteUrl: null });
      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue({ keyId: 'config', publicKey: 'p', privateKey: 'p' });
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([]);

      await expect(invitationService.constructInviteLink(spaceId)).rejects.toThrow();
    });

    it('should throw when the encryption state has no evals', async () => {
      const spaceId = 'space-no-evals';

      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({ spaceId, inviteUrl: null });
      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue({ keyId: 'config', publicKey: 'p', privateKey: 'p' });

      const encStateRaw = {
        state: JSON.stringify({ root_key: 'rk', id_peer_map: {}, peer_id_map: {} }),
        template: { dkg_ratchet: JSON.stringify({ id: 1 }), root_key: 'rk' },
        evals: [],
      };
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        { state: JSON.stringify(encStateRaw), conversationId: spaceId + '/' + spaceId },
      ]);

      await expect(invitationService.constructInviteLink(spaceId)).rejects.toThrow();
    });
  });

  describe('6. sendInviteToUser() - Argument Verification', () => {
    it('should call submitMessage with the invite URL, sender address, and recipient address', async () => {
      const spaceId = 'space-send';
      const recipientAddress = 'recipient-addr';
      const existingUrl = 'https://qm.one/#spaceId=space-send&configKey=deadbeef';
      const mockPasskeyInfo = {
        credentialId: 'cred',
        address: 'sender-addr',
        publicKey: 'pubkey',
        completedOnboarding: true,
      };
      const mockKeyset = { userKeyset: {} as any, deviceKeyset: {} as any };
      const mockSubmitMessage = vi.fn().mockResolvedValue(undefined);

      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId,
        inviteUrl: existingUrl,
      });
      mockDeps.apiClient.getUser = vi.fn()
        .mockResolvedValueOnce({ data: { address: 'sender-addr', device_registrations: [] } })
        .mockResolvedValueOnce({ data: { address: 'recipient-addr', device_registrations: [] } });

      await invitationService.sendInviteToUser(
        recipientAddress,
        spaceId,
        mockPasskeyInfo,
        mockKeyset,
        mockSubmitMessage
      );

      expect(mockSubmitMessage).toHaveBeenCalledWith(
        recipientAddress,
        existingUrl,
        expect.objectContaining({ address: 'sender-addr' }),
        expect.objectContaining({ address: 'recipient-addr' }),
        expect.anything(),
        expect.objectContaining({ address: mockPasskeyInfo.address }),
        mockKeyset
      );

      expect(mockDeps.apiClient.getUser).toHaveBeenCalledWith(mockPasskeyInfo.address);
      expect(mockDeps.apiClient.getUser).toHaveBeenCalledWith(recipientAddress);
    });
  });

  describe('7. generateNewInviteLink() - Invite Generation', () => {
    it('should call postSpaceInviteEvals, saveEncryptionState, and saveSpace', async () => {
      const spaceId = 'space-gen';

      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId,
        spaceName: 'Gen Space',
        inviteUrl: null,
      });
      mockDeps.messageDB.getSpaceKey = vi.fn()
        .mockResolvedValueOnce({ spaceId, keyId: spaceId, publicKey: 'space-pub', privateKey: 'space-priv' })
        .mockResolvedValueOnce({ spaceId, keyId: 'owner', publicKey: 'owner-pub', privateKey: 'owner-priv' })
        .mockResolvedValueOnce({ spaceId, keyId: 'hub', publicKey: 'hub-pub', privateKey: 'hub-priv', address: 'hub-addr' });
      mockDeps.messageDB.getSpaceMembers = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        {
          state: JSON.stringify({
            state: JSON.stringify({
              id_peer_map: { 1: { public_key: 'peer-key' } },
              peer_id_map: { 'peer-key': 1 },
              root_key: 'root-key',
            }),
          }),
          conversationId: spaceId + '/' + spaceId,
        },
      ]);

      const mockUserKeyset = {} as any;
      const mockDeviceKeyset = {} as any;
      const mockRegistration = {} as any;

      await invitationService.generateNewInviteLink(
        spaceId,
        mockUserKeyset,
        mockDeviceKeyset,
        mockRegistration
      );

      expect(mockDeps.apiClient.postSpaceInviteEvals).toHaveBeenCalledWith(
        expect.objectContaining({ space_address: spaceId })
      );
      expect(mockDeps.messageDB.saveEncryptionState).toHaveBeenCalled();
      expect(mockDeps.messageDB.saveSpace).toHaveBeenCalledWith(
        expect.objectContaining({ spaceId, inviteUrl: expect.stringContaining('spaceId=' + spaceId) })
      );
    });
  });

});
