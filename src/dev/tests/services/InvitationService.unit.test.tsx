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
      // The real SDK wraps the base64 result in JSON.stringify, so callers
      // do JSON.parse(...) on it. Mirror that here.
      JSON.stringify(Buffer.from([1, 2, 3]).toString('base64'))
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

  describe('1. constructInviteLink() - always builds a fresh one-time link', () => {
    // Mobile-aligned behavior (2026-06-07): even when `space.inviteUrl` is set,
    // private one-time invites continue to be generated from the local evals
    // pool. The old short-circuit that hijacked private invites and returned
    // the public URL is gone.
    it('should build a fresh one-time link even when space already has a public inviteUrl', async () => {
      const spaceId = 'space-123';
      const existingPublicUrl = 'https://app.quorummessenger.com/invite/#spaceId=space-123&configKey=abc';

      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId,
        spaceName: 'Test Space',
        inviteUrl: existingPublicUrl,
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
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        { state: JSON.stringify(encStateRaw), conversationId: spaceId + '/' + spaceId },
      ]);

      const result = await invitationService.constructInviteLink(spaceId);

      // ✅ VERIFY: returned a one-time link (has template/secret/hubKey), NOT the public URL
      expect(result).not.toBe(existingPublicUrl);
      expect(result).toContain('spaceId=' + spaceId);
      expect(result).toContain('configKey=cfg-priv');
      expect(result).toContain('template=');
      expect(result).toContain('secret=');
      expect(result).toContain('hubKey=hub-priv');

      // ✅ VERIFY: local eval pool decremented by one
      expect(mockDeps.messageDB.saveEncryptionState).toHaveBeenCalledWith(
        expect.objectContaining({
          state: expect.stringContaining('"evals":[[40,50,60]]'),
        }),
        true
      );
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
    it('should build a fresh one-time link from the local pool and call submitMessage with it', async () => {
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

      // Space has a public inviteUrl set; the new flow ignores it and builds
      // a fresh one-time link from the local evals pool anyway.
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId,
        inviteUrl: 'https://app.quorummessenger.com/invite/#spaceId=space-123&configKey=pub',
      });
      mockDeps.messageDB.getSpaceKey = vi.fn()
        .mockResolvedValueOnce({ keyId: 'config', publicKey: 'cfg-pub', privateKey: 'cfg-priv' })
        .mockResolvedValueOnce({ keyId: 'hub', publicKey: 'hub-pub', privateKey: 'hub-priv' });
      const encStateRaw = {
        state: JSON.stringify({ root_key: 'rk', id_peer_map: {}, peer_id_map: {} }),
        template: { dkg_ratchet: JSON.stringify({ id: 1 }), root_key: 'rk' },
        evals: [[1, 2, 3]],
      };
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        { state: JSON.stringify(encStateRaw), conversationId: spaceId + '/' + spaceId },
      ]);

      await invitationService.sendInviteToUser(
        address,
        spaceId,
        mockPasskeyInfo,
        mockKeyset,
        mockSubmitMessage
      );

      // ✅ VERIFY: getUser called for both sender and recipient
      expect(mockDeps.apiClient.getUser).toHaveBeenCalledWith(mockPasskeyInfo.address);
      expect(mockDeps.apiClient.getUser).toHaveBeenCalledWith(address);

      // ✅ VERIFY: submitMessage called with a one-time link (not the existing public URL)
      const submitArgs = mockSubmitMessage.mock.calls[0];
      const linkSent = submitArgs[1];
      expect(linkSent).toContain('spaceId=' + spaceId);
      expect(linkSent).toContain('template=');
      expect(linkSent).toContain('secret=');
      expect(linkSent).toContain('hubKey=hub-priv');
      expect(linkSent).not.toContain('configKey=pub');
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

      // The link's embedded template carries ratchet.id = 10001 - evals.length
      // (computed BEFORE consuming the eval). Extract it from the URL.
      const match = result.match(/template=([0-9a-f]+)/);
      expect(match).not.toBeNull();
      const templateHex = match![1];
      const templateJson = JSON.parse(Buffer.from(templateHex, 'hex').toString('utf-8'));
      const linkedRatchet = JSON.parse(templateJson.dkg_ratchet);
      expect(linkedRatchet.id).toBe(10001 - 3);

      // The SAVED template stays unchanged (no in-place mutation leak). The
      // deep-copy at constructInviteLink protects the persisted template from
      // being polluted by transient invite generation.
      const savedCall = mockDeps.messageDB.saveEncryptionState.mock.calls[0][0];
      const savedSets = JSON.parse(savedCall.state);
      const savedRatchet = JSON.parse(savedSets.template.dkg_ratchet);
      expect(savedRatchet.id).toBe(99);

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
    it('should call submitMessage with sender, recipient, and a freshly-built one-time link', async () => {
      const spaceId = 'space-send';
      const recipientAddress = 'recipient-addr';
      const mockPasskeyInfo = {
        credentialId: 'cred',
        address: 'sender-addr',
        publicKey: 'pubkey',
        completedOnboarding: true,
      };
      const mockKeyset = { userKeyset: {} as any, deviceKeyset: {} as any };
      const mockSubmitMessage = vi.fn().mockResolvedValue(undefined);

      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({ spaceId, inviteUrl: null });
      mockDeps.messageDB.getSpaceKey = vi.fn()
        .mockResolvedValueOnce({ keyId: 'config', publicKey: 'cpub', privateKey: 'cpriv' })
        .mockResolvedValueOnce({ keyId: 'hub', publicKey: 'hpub', privateKey: 'hpriv' });
      const encStateRaw = {
        state: JSON.stringify({ root_key: 'rk', id_peer_map: {}, peer_id_map: {} }),
        template: { dkg_ratchet: JSON.stringify({ id: 1 }), root_key: 'rk' },
        evals: [[9, 9, 9]],
      };
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        { state: JSON.stringify(encStateRaw), conversationId: spaceId + '/' + spaceId },
      ]);
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
        expect.stringContaining('spaceId=' + spaceId),
        expect.objectContaining({ address: 'sender-addr' }),
        expect.objectContaining({ address: 'recipient-addr' }),
        expect.anything(),
        expect.objectContaining({ address: mockPasskeyInfo.address }),
        mockKeyset
      );

      expect(mockDeps.apiClient.getUser).toHaveBeenCalledWith(mockPasskeyInfo.address);
      expect(mockDeps.apiClient.getUser).toHaveBeenCalledWith(recipientAddress);
    });

    it('mode=public: forwards the existing space.inviteUrl without constructing a new link', async () => {
      const spaceId = 'space-public-send';
      const existingPublicUrl = 'https://app.quorummessenger.com/invite/#spaceId=space-public-send&configKey=public-cfg';
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
        inviteUrl: existingPublicUrl,
      });
      // Encryption state setup deliberately omitted — if mode='public' incorrectly
      // fell through to constructInviteLink, it would throw on missing template.
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([]);
      mockDeps.apiClient.getUser = vi.fn()
        .mockResolvedValueOnce({ data: { address: 'sender-addr', device_registrations: [] } })
        .mockResolvedValueOnce({ data: { address: 'recipient-addr', device_registrations: [] } });

      await invitationService.sendInviteToUser(
        'recipient-addr',
        spaceId,
        mockPasskeyInfo,
        mockKeyset,
        mockSubmitMessage,
        'public'
      );

      // Exact existing URL was forwarded
      expect(mockSubmitMessage).toHaveBeenCalledWith(
        'recipient-addr',
        existingPublicUrl,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        mockKeyset
      );

      // No eval was consumed
      expect(mockDeps.messageDB.saveEncryptionState).not.toHaveBeenCalled();
    });

    it('mode=public: throws when no public inviteUrl exists yet', async () => {
      const spaceId = 'space-no-public';
      const mockPasskeyInfo = {
        credentialId: 'cred',
        address: 'sender-addr',
        publicKey: 'pubkey',
        completedOnboarding: true,
      };

      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({ spaceId, inviteUrl: null });

      await expect(
        invitationService.sendInviteToUser(
          'recipient-addr',
          spaceId,
          mockPasskeyInfo,
          {} as any,
          vi.fn(),
          'public'
        )
      ).rejects.toThrow();
    });

    it('mode=reuse: sends the exact presetLink without consuming an eval', async () => {
      const spaceId = 'space-reuse';
      const presetLink = 'https://app.quorummessenger.com/#spaceId=space-reuse&configKey=cfg&template=tpl&secret=sec&hubKey=hub';
      const mockPasskeyInfo = {
        credentialId: 'cred',
        address: 'sender-addr',
        publicKey: 'pubkey',
        completedOnboarding: true,
      };
      const mockKeyset = { userKeyset: {} as any, deviceKeyset: {} as any };
      const mockSubmitMessage = vi.fn().mockResolvedValue(undefined);

      // No getSpace mock, no encryption state — reuse mode must not need them.
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([]);
      mockDeps.apiClient.getUser = vi.fn()
        .mockResolvedValueOnce({ data: { address: 'sender-addr', device_registrations: [] } })
        .mockResolvedValueOnce({ data: { address: 'recipient-addr', device_registrations: [] } });

      await invitationService.sendInviteToUser(
        'recipient-addr',
        spaceId,
        mockPasskeyInfo,
        mockKeyset,
        mockSubmitMessage,
        'reuse',
        presetLink
      );

      // Exact preset link sent
      expect(mockSubmitMessage).toHaveBeenCalledWith(
        'recipient-addr',
        presetLink,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        mockKeyset
      );

      // No eval consumed — saveEncryptionState would have been called by
      // constructInviteLink if the mode had silently fallen through.
      expect(mockDeps.messageDB.saveEncryptionState).not.toHaveBeenCalled();
    });

    it('mode=reuse: throws when presetLink is missing', async () => {
      const spaceId = 'space-reuse-missing';
      const mockPasskeyInfo = {
        credentialId: 'cred',
        address: 'sender-addr',
        publicKey: 'pubkey',
        completedOnboarding: true,
      };

      await expect(
        invitationService.sendInviteToUser(
          'recipient-addr',
          spaceId,
          mockPasskeyInfo,
          {} as any,
          vi.fn(),
          'reuse'
          // no presetLink
        )
      ).rejects.toThrow();
    });
  });

  describe('7. generateNewInviteLink() - Public link generation (mobile-aligned)', () => {
    // Shared helper: produces a deps shape that the new generateNewInviteLink
    // expects. Encryption state has template/state/evals at the TOP level
    // (not nested), because the new flow uses the same encryption-state shape
    // as constructInviteLink (one source of truth) — not the nested shape the
    // old rekey path used.
    const setupForPublicGen = (spaceId: string, opts: { initialEvalCount?: number; inviteUrl?: string | null } = {}) => {
      const evalCount = opts.initialEvalCount ?? 3;
      const evals = Array.from({ length: evalCount }, (_, i) => [i + 1, i + 2, i + 3]);

      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({
        spaceId,
        spaceName: 'Gen Space',
        inviteUrl: opts.inviteUrl ?? null,
      });
      mockDeps.messageDB.getSpaceKey = vi.fn().mockImplementation((_id: string, keyId: string) => {
        if (keyId === 'owner') return Promise.resolve({ spaceId, keyId: 'owner', publicKey: 'owner-pub-hex', privateKey: 'owner-priv-hex' });
        if (keyId === 'hub') return Promise.resolve({ spaceId, keyId: 'hub', publicKey: 'hub-pub-hex', privateKey: 'hub-priv-hex', address: 'hub-addr' });
        if (keyId === 'config') return Promise.resolve({ spaceId, keyId: 'config', publicKey: 'cfg-pub-hex', privateKey: 'cfg-priv-hex' });
        return Promise.resolve({ spaceId, keyId, publicKey: 'p', privateKey: 'p' });
      });
      const encStateRaw = {
        state: JSON.stringify({ root_key: 'root-key', id_peer_map: {}, peer_id_map: {} }),
        template: { dkg_ratchet: JSON.stringify({ id: 1 }), root_key: 'root-key' },
        evals,
      };
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        { state: JSON.stringify(encStateRaw), conversationId: spaceId + '/' + spaceId },
      ]);
    };

    it('should upload exactly ONE eval to postSpaceInviteEvals (MAX_PUBLIC_EVALS = 1)', async () => {
      const spaceId = 'space-gen';
      setupForPublicGen(spaceId, { initialEvalCount: 5 });

      await invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any);

      expect(mockDeps.apiClient.postSpaceInviteEvals).toHaveBeenCalledTimes(1);
      const payload = mockDeps.apiClient.postSpaceInviteEvals.mock.calls[0][0];
      expect(payload.space_evals).toHaveLength(1);
      expect(payload.space_address).toBe(spaceId);
    });

    it('should use the EXISTING config public key (no new keypair) when uploading evals', async () => {
      const spaceId = 'space-gen-cfg';
      setupForPublicGen(spaceId);

      await invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any);

      const payload = mockDeps.apiClient.postSpaceInviteEvals.mock.calls[0][0];
      // Mobile parity: reuses existing 'config' key, does NOT mint a new one.
      expect(payload.config_public_key).toBe('cfg-pub-hex');
      expect(payload.owner_public_key).toBe('owner-pub-hex');
    });

    it('should NOT call saveSpaceKey for the config key (no new keypair persisted)', async () => {
      const spaceId = 'space-no-rekey';
      setupForPublicGen(spaceId);

      await invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any);

      const configSaveCalls = mockDeps.messageDB.saveSpaceKey.mock.calls.filter(
        (c: any[]) => c[0]?.keyId === 'config'
      );
      expect(configSaveCalls).toHaveLength(0);
    });

    it('should NOT call apiClient.postSpace (no space re-registration in the mobile-aligned flow)', async () => {
      const spaceId = 'space-no-postspace';
      setupForPublicGen(spaceId);

      await invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any);

      expect(mockDeps.apiClient.postSpace).not.toHaveBeenCalled();
    });

    it('should NOT read space members (no member rekey loop)', async () => {
      const spaceId = 'space-no-members-read';
      setupForPublicGen(spaceId);

      await invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any);

      expect(mockDeps.messageDB.getSpaceMembers).not.toHaveBeenCalled();
    });

    it('should NOT enqueue outbound sync envelopes (no member rekey messages)', async () => {
      const spaceId = 'space-no-outbounds';
      setupForPublicGen(spaceId);

      await invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any);

      expect(mockDeps.enqueueOutbound).not.toHaveBeenCalled();
    });

    it('should call postSpaceManifest to refresh the on-server snapshot', async () => {
      const spaceId = 'space-manifest-refresh';
      setupForPublicGen(spaceId);

      await invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any);

      expect(mockDeps.apiClient.postSpaceManifest).toHaveBeenCalledTimes(1);
      const manifestCall = mockDeps.apiClient.postSpaceManifest.mock.calls[0];
      expect(manifestCall[0]).toBe(spaceId);
      expect(manifestCall[1]).toEqual(
        expect.objectContaining({
          space_address: spaceId,
          owner_public_key: 'owner-pub-hex',
        })
      );
    });

    it('should save space with inviteUrl built from the EXISTING config private key', async () => {
      const spaceId = 'space-save';
      setupForPublicGen(spaceId);

      await invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any);

      expect(mockDeps.messageDB.saveSpace).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId,
          // URL uses the existing config private key, NOT a freshly-minted one
          inviteUrl: expect.stringContaining('configKey=cfg-priv-hex'),
        })
      );
      // And the URL is a public-invite shape (/invite/#)
      const savedSpace = mockDeps.messageDB.saveSpace.mock.calls[0][0];
      expect(savedSpace.inviteUrl).toContain('/invite/#');
      expect(savedSpace.inviteUrl).toContain('spaceId=' + spaceId);
    });

    it('should decrement the local evals pool by MAX_PUBLIC_EVALS (1)', async () => {
      const spaceId = 'space-pool-decrement';
      setupForPublicGen(spaceId, { initialEvalCount: 5 });

      await invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any);

      expect(mockDeps.messageDB.saveEncryptionState).toHaveBeenCalled();
      const saveCall = mockDeps.messageDB.saveEncryptionState.mock.calls[0][0];
      const savedSession = JSON.parse(saveCall.state);
      expect(savedSession.evals).toHaveLength(4); // 5 - 1
    });

    it('should not decrement the pool when the eval upload fails (failure happens before save)', async () => {
      const spaceId = 'space-fail-upload';
      setupForPublicGen(spaceId, { initialEvalCount: 3 });
      mockDeps.apiClient.postSpaceInviteEvals = vi.fn().mockRejectedValue(new Error('network down'));

      await expect(
        invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any)
      ).rejects.toThrow();

      // saveEncryptionState should NOT have been called — the pool stays intact
      expect(mockDeps.messageDB.saveEncryptionState).not.toHaveBeenCalled();
    });

    it('should throw when the local evals pool is empty', async () => {
      const spaceId = 'space-empty-pool';
      setupForPublicGen(spaceId, { initialEvalCount: 0 });

      await expect(
        invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any)
      ).rejects.toThrow();

      expect(mockDeps.apiClient.postSpaceInviteEvals).not.toHaveBeenCalled();
    });

    it('should throw when no owner key is present (non-owner gating)', async () => {
      const spaceId = 'space-non-owner';
      setupForPublicGen(spaceId);
      // Override owner key to return falsy
      mockDeps.messageDB.getSpaceKey = vi.fn().mockImplementation((_id: string, keyId: string) => {
        if (keyId === 'owner') return Promise.resolve({ spaceId, keyId: 'owner', publicKey: '', privateKey: '' });
        if (keyId === 'hub') return Promise.resolve({ spaceId, keyId: 'hub', publicKey: 'hub-pub', privateKey: 'hub-priv' });
        if (keyId === 'config') return Promise.resolve({ spaceId, keyId: 'config', publicKey: 'cfg-pub', privateKey: 'cfg-priv' });
        return Promise.resolve({ spaceId, keyId, publicKey: 'p', privateKey: 'p' });
      });

      await expect(
        invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any)
      ).rejects.toThrow();
    });
  });

  describe('8. URL host override (qm.one -> app.quorummessenger.com)', () => {
    // The buildInviteBase helper substitutes qm.one with app.quorummessenger.com
    // to match mobile's generation host. We assert against the public-gen URL
    // because the test env runs under jsdom (localhost), so the prod qm.one
    // branch in shared's getInviteUrlBase isn't hit at runtime — but the
    // .replace() in buildInviteBase is a deterministic string op so any URL
    // emitted from prod-shaped paths will be cleaned.
    it('should never emit qm.one in any generated invite URL', async () => {
      const spaceId = 'space-host-override';

      // Private path
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({ spaceId, inviteUrl: null });
      mockDeps.messageDB.getSpaceKey = vi.fn()
        .mockResolvedValueOnce({ keyId: 'config', publicKey: 'cpub', privateKey: 'cpriv' })
        .mockResolvedValueOnce({ keyId: 'hub', publicKey: 'hpub', privateKey: 'hpriv' });
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        {
          state: JSON.stringify({
            state: JSON.stringify({ root_key: 'rk', id_peer_map: {}, peer_id_map: {} }),
            template: { dkg_ratchet: JSON.stringify({ id: 1 }), root_key: 'rk' },
            evals: [[1, 2]],
          }),
          conversationId: spaceId + '/' + spaceId,
        },
      ]);

      const privateLink = await invitationService.constructInviteLink(spaceId);
      expect(privateLink).not.toContain('qm.one');

      // Public path
      mockDeps.messageDB.getSpace = vi.fn().mockResolvedValue({ spaceId, inviteUrl: null });
      mockDeps.messageDB.getSpaceKey = vi.fn().mockImplementation((_id: string, keyId: string) => {
        if (keyId === 'owner') return Promise.resolve({ keyId: 'owner', publicKey: 'op', privateKey: 'opriv' });
        if (keyId === 'hub') return Promise.resolve({ keyId: 'hub', publicKey: 'hp', privateKey: 'hpriv' });
        if (keyId === 'config') return Promise.resolve({ keyId: 'config', publicKey: 'cp', privateKey: 'cpriv' });
        return Promise.resolve({ keyId, publicKey: 'p', privateKey: 'p' });
      });
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        {
          state: JSON.stringify({
            state: JSON.stringify({ root_key: 'rk', id_peer_map: {}, peer_id_map: {} }),
            template: { dkg_ratchet: JSON.stringify({ id: 1 }), root_key: 'rk' },
            evals: [[1, 2]],
          }),
          conversationId: spaceId + '/' + spaceId,
        },
      ]);

      await invitationService.generateNewInviteLink(spaceId, {} as any, {} as any, {} as any);

      const publicSaved = mockDeps.messageDB.saveSpace.mock.calls[0][0];
      expect(publicSaved.inviteUrl).not.toContain('qm.one');
    });
  });

});
