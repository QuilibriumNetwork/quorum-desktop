/**
 * ConfigService - Unit Tests
 *
 * PURPOSE: Validates ConfigService getConfig/saveConfig paths that do not
 * require crypto operations.
 *
 * APPROACH: Unit tests with vi.fn() mocks - NOT integration tests
 *
 * KNOWN GAPS (see 2026-05-19-test-suite-review.md under .agents/issues/):
 * - getConfig newer-remote-timestamp branch (the 60-line decrypt-and-verify path)
 * - getConfig equal-timestamp / stale-remote branches
 * - getConfig bookmark merge, user notes merge, tombstone application paths
 * - saveConfig allowSync:true filtering logic
 * - saveConfig queryClient.setQueryData side effect
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import { ConfigService } from '@/services/ConfigService';
import { QueryClient } from '@tanstack/react-query';

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    SealHubEnvelope: vi.fn().mockResolvedValue({ sealed: 'hub-envelope' }),
  },
  channel_raw: {
    js_sign_ed448: vi.fn().mockReturnValue(JSON.stringify('mock-signature')),
    js_verify_ed448: vi.fn().mockReturnValue(JSON.stringify(true)),
    js_decrypt_inbox_message: vi.fn().mockReturnValue(
      JSON.stringify([...Buffer.from(JSON.stringify({ name: 'Mock Space' }), 'utf-8')])
    ),
    js_generate_ed448: vi.fn().mockReturnValue(
      JSON.stringify({ public_key: [1, 2, 3], private_key: [4, 5, 6] })
    ),
  },
}));

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

describe('ConfigService - Unit Tests', () => {
  let configService: ConfigService;
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

    // Setup mocks for all ConfigService dependencies
    mockDeps = {
      messageDB: {
        getUserConfig: vi.fn().mockResolvedValue(null),
        saveUserConfig: vi.fn().mockResolvedValue(undefined),
        getSpace: vi.fn().mockResolvedValue(null),
        saveSpace: vi.fn().mockResolvedValue(undefined),
        getSpaceKey: vi.fn().mockResolvedValue(null),
        saveSpaceKey: vi.fn().mockResolvedValue(undefined),
        getSpaceKeys: vi.fn().mockResolvedValue([]),
        getSpaces: vi.fn().mockResolvedValue([]),
        getEncryptionStates: vi.fn().mockResolvedValue([]),
        saveEncryptionState: vi.fn().mockResolvedValue(undefined),
        getBookmarks: vi.fn().mockResolvedValue([]),
        addBookmark: vi.fn().mockResolvedValue(undefined),
        removeBookmark: vi.fn().mockResolvedValue(undefined),
        getAllUserNotes: vi.fn().mockResolvedValue([]),
        saveUserNote: vi.fn().mockResolvedValue(undefined),
        deleteUserNote: vi.fn().mockResolvedValue(undefined),
      } as any,
      apiClient: {
        getUserSettings: vi.fn().mockRejectedValue(new Error('No remote config')),
        postUserSettings: vi.fn().mockResolvedValue({}),
        getSpace: vi.fn().mockResolvedValue({ data: {} }),
        getSpaceManifest: vi.fn().mockResolvedValue({ data: {} }),
        postHubAdd: vi.fn().mockResolvedValue({}),
      } as any,
      spaceInfo: { current: {} } as any,
      enqueueOutbound: vi.fn(),
      sendHubMessage: vi.fn().mockResolvedValue('hub-message-json'),
      queryClient,
    };

    // Create ConfigService with mocked dependencies
    configService = new ConfigService(mockDeps);

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('1. getConfig() - Configuration Retrieval', () => {
    it('should return default config when no saved or stored config exists', async () => {
      const address = 'user-address-123';
      const mockUserKey = {
        user_key: {
          private_key: new Uint8Array(57),
          public_key: new Uint8Array(57),
        },
      } as any;

      // Mock no remote config (already set in beforeEach)
      // Mock no stored config
      mockDeps.messageDB.getUserConfig = vi.fn().mockResolvedValue(null);

      const result = await configService.getConfig({
        address,
        userKey: mockUserKey,
      });

      // ✅ VERIFY: Returns default config
      expect(result).toBeDefined();
      expect(result.address).toBe(address);

      // ✅ VERIFY: API getUserSettings was called
      expect(mockDeps.apiClient.getUserSettings).toHaveBeenCalledWith(address);

      // ✅ VERIFY: Database getUserConfig was called
      expect(mockDeps.messageDB.getUserConfig).toHaveBeenCalledWith({ address });
    });

    it('should return stored config when no saved config exists', async () => {
      const address = 'user-address-123';
      const mockUserKey = {
        user_key: {
          private_key: new Uint8Array(57),
          public_key: new Uint8Array(57),
        },
      } as any;

      const storedConfig = {
        address,
        spaceIds: ['space-1', 'space-2'],
        timestamp: Date.now(),
      };

      // Mock no remote config (already set in beforeEach)
      // Mock stored config
      mockDeps.messageDB.getUserConfig = vi.fn().mockResolvedValue(storedConfig);

      const result = await configService.getConfig({
        address,
        userKey: mockUserKey,
      });

      // ✅ VERIFY: Returns stored config
      expect(result).toEqual(storedConfig);
      expect(result.spaceIds).toEqual(['space-1', 'space-2']);
    });
  });

  describe('2. saveConfig() - Configuration Persistence', () => {
    it('should save config to database with updated timestamp', async () => {
      const mockConfig = {
        address: 'user-123',
        spaceIds: ['space-1'],
        allowSync: false, // Don't sync to avoid crypto operations
        timestamp: 0,
      };

      const mockKeyset = {
        userKeyset: {
          user_key: {
            private_key: new Uint8Array(57),
            public_key: new Uint8Array(57),
          },
        } as any,
        deviceKeyset: {} as any,
      };

      await configService.saveConfig({
        config: mockConfig,
        keyset: mockKeyset,
      });

      // ✅ VERIFY: Timestamp was updated on the SAVED config. saveConfig
      // deep-clones its input (to avoid mutating a shared React Query cache
      // object), so the assertion must read the object passed to the DB, not
      // the caller's original mockConfig.
      const savedConfig = (
        mockDeps.messageDB.saveUserConfig as ReturnType<typeof vi.fn>
      ).mock.calls[0][0];
      expect(savedConfig.timestamp).toBeGreaterThan(0);

      // ✅ VERIFY: Config saved to database
      expect(mockDeps.messageDB.saveUserConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'user-123',
          spaceIds: ['space-1'],
        })
      );

      // ✅ VERIFY: Not posted to API (allowSync: false)
      expect(mockDeps.apiClient.postUserSettings).not.toHaveBeenCalled();
    });

    it('should not call remote API when allowSync is false', async () => {
      const mockConfig = {
        address: 'user-123',
        spaceIds: ['space-1'],
        allowSync: false, // Disable sync
        timestamp: 0,
      };

      const mockKeyset = {
        userKeyset: {
          user_key: {
            private_key: new Uint8Array(57),
            public_key: new Uint8Array(57),
          },
        } as any,
        deviceKeyset: {} as any,
      };

      await configService.saveConfig({
        config: mockConfig,
        keyset: mockKeyset,
      });

      // ✅ VERIFY: API not called when allowSync is false
      expect(mockDeps.apiClient.postUserSettings).not.toHaveBeenCalled();

      // ✅ VERIFY: getSpaces not called when allowSync is false
      expect(mockDeps.messageDB.getSpaces).not.toHaveBeenCalled();

      // ✅ VERIFY: Config still saved to database
      expect(mockDeps.messageDB.saveUserConfig).toHaveBeenCalled();
    });
  });

  describe('3. getConfig() - remote timestamp branches', () => {
    const address = 'user-address-123';
    const mockUserKey = {
      user_key: {
        private_key: new Uint8Array(57),
        public_key: new Uint8Array(57),
      },
    } as any;

    function makeRemoteConfig(timestamp: number) {
      return {
        user_config: 'aabbccdd' + '000000000000000000000000',
        timestamp,
        signature: 'aabbcc',
      };
    }

    it('returns stored config and does not decrypt when remote timestamp equals stored timestamp', async () => {
      const ts = 1000;
      const storedConfig = { address, spaceIds: [], timestamp: ts };
      mockDeps.messageDB.getUserConfig = vi.fn().mockResolvedValue(storedConfig);
      mockDeps.apiClient.getUserSettings = vi.fn().mockResolvedValue({ data: makeRemoteConfig(ts) });

      const result = await configService.getConfig({ address, userKey: mockUserKey });

      expect(result).toEqual(storedConfig);
      expect(global.crypto.subtle.decrypt).not.toHaveBeenCalled();
    });

    it('returns stored config and does not decrypt when remote timestamp is older than stored', async () => {
      const storedConfig = { address, spaceIds: [], timestamp: 2000 };
      mockDeps.messageDB.getUserConfig = vi.fn().mockResolvedValue(storedConfig);
      mockDeps.apiClient.getUserSettings = vi.fn().mockResolvedValue({ data: makeRemoteConfig(1000) });

      const result = await configService.getConfig({ address, userKey: mockUserKey });

      expect(result).toEqual(storedConfig);
      expect(global.crypto.subtle.decrypt).not.toHaveBeenCalled();
    });

    it('saves merged config and returns it when remote timestamp is newer than stored', async () => {
      const storedConfig = { address, spaceIds: ['space-old'], timestamp: 500 };
      const decryptedConfig = {
        address,
        spaceIds: ['space-new'],
        spaceKeys: [],
        timestamp: 999,
      };
      const jsonBytes = new TextEncoder().encode(JSON.stringify(decryptedConfig));
      const decryptedBuffer = jsonBytes.buffer.slice(jsonBytes.byteOffset, jsonBytes.byteOffset + jsonBytes.byteLength);

      mockDeps.messageDB.getUserConfig = vi.fn().mockResolvedValue(storedConfig);
      mockDeps.apiClient.getUserSettings = vi.fn().mockResolvedValue({ data: makeRemoteConfig(1000) });

      vi.spyOn(global.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
      vi.spyOn(global.crypto.subtle, 'decrypt').mockResolvedValue(decryptedBuffer as ArrayBuffer);

      const result = await configService.getConfig({ address, userKey: mockUserKey });

      expect(mockDeps.messageDB.saveUserConfig).toHaveBeenCalledWith(
        expect.objectContaining({ address, timestamp: 1000 })
      );
      expect(result).toMatchObject({ address, spaceIds: ['space-new'] });
    });

    it('merges bookmarks from remote into local when remote timestamp is newer', async () => {
      const storedConfig = { address, spaceIds: [], timestamp: 100 };
      const localBookmark = { bookmarkId: 'bk-local', messageId: 'msg-1', createdAt: 50 };
      const remoteBookmark = { bookmarkId: 'bk-remote', messageId: 'msg-2', createdAt: 200 };
      const decryptedConfig = {
        address,
        spaceIds: [],
        spaceKeys: [],
        bookmarks: [remoteBookmark],
        deletedBookmarkIds: [],
      };
      const jsonBytes = new TextEncoder().encode(JSON.stringify(decryptedConfig));
      const decryptedBuffer = jsonBytes.buffer.slice(jsonBytes.byteOffset, jsonBytes.byteOffset + jsonBytes.byteLength);

      mockDeps.messageDB.getUserConfig = vi.fn().mockResolvedValue(storedConfig);
      mockDeps.apiClient.getUserSettings = vi.fn().mockResolvedValue({ data: makeRemoteConfig(500) });
      mockDeps.messageDB.getBookmarks = vi.fn().mockResolvedValue([localBookmark]);

      vi.spyOn(global.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
      vi.spyOn(global.crypto.subtle, 'decrypt').mockResolvedValue(decryptedBuffer as ArrayBuffer);

      await configService.getConfig({ address, userKey: mockUserKey });

      expect(mockDeps.messageDB.addBookmark).toHaveBeenCalledWith(
        expect.objectContaining({ bookmarkId: 'bk-remote' })
      );
    });
  });

  describe('4. saveConfig() - allowSync:true path', () => {
    const mockKeyset = {
      userKeyset: {
        user_key: {
          private_key: new Uint8Array(57),
          public_key: new Uint8Array(57),
        },
      } as any,
      deviceKeyset: {} as any,
    };

    it('calls getSpaces, getSpaceKeys, postUserSettings, and saveUserConfig when allowSync is true', async () => {
      const mockConfig = {
        address: 'user-sync',
        spaceIds: ['space-1'],
        allowSync: true,
        timestamp: 0,
      };
      const mockSpace = { spaceId: 'space-1' };

      mockDeps.messageDB.getSpaces = vi.fn().mockResolvedValue([mockSpace]);
      mockDeps.messageDB.getSpaceKeys = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([{ id: 'enc-1' }]);
      mockDeps.messageDB.getBookmarks = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getAllUserNotes = vi.fn().mockResolvedValue([]);
      mockDeps.apiClient.postUserSettings = vi.fn().mockResolvedValue({});

      vi.spyOn(global.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
      vi.spyOn(global.crypto.subtle, 'encrypt').mockResolvedValue(new Uint8Array(16).buffer as ArrayBuffer);

      await configService.saveConfig({ config: mockConfig, keyset: mockKeyset });

      expect(mockDeps.messageDB.getSpaces).toHaveBeenCalled();
      expect(mockDeps.messageDB.getSpaceKeys).toHaveBeenCalledWith('space-1');
      expect(mockDeps.apiClient.postUserSettings).toHaveBeenCalledWith(
        'user-sync',
        expect.objectContaining({ user_address: 'user-sync' })
      );
      expect(mockDeps.messageDB.saveUserConfig).toHaveBeenCalled();
    });

    it('calls queryClient.setQueryData after saving config', async () => {
      const mockConfig = {
        address: 'user-cache',
        spaceIds: [],
        allowSync: false,
        timestamp: 0,
      };

      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

      await configService.saveConfig({ config: mockConfig, keyset: mockKeyset });

      expect(setQueryDataSpy).toHaveBeenCalledWith(
        expect.arrayContaining(['Config']),
        expect.anything()
      );
    });
  });

  describe('5. saveConfig() - truncated Space lists stay local', () => {
    const mockKeyset = {
      userKeyset: {
        user_key: {
          private_key: new Uint8Array(57),
          public_key: new Uint8Array(57),
        },
      } as any,
      deviceKeyset: {} as any,
    };

    // The config lists three Spaces across a folder, but the local DB only
    // holds space-1 with a usable encryption state. That is the state a device
    // is in mid-sync, and it is what previously truncated the nav.
    const partialDbConfig = () => ({
      address: 'user-partial',
      spaceIds: ['space-1', 'space-2', 'space-3'],
      items: [
        { type: 'space', id: 'space-1' },
        { type: 'space', id: 'space-2' },
        { type: 'folder', id: 'folder-1', name: 'Work', spaceIds: ['space-1', 'space-3'] },
      ],
      allowSync: true,
      timestamp: 0,
    }) as any;

    const arrangePartialDb = () => {
      mockDeps.messageDB.getSpaces = vi.fn().mockResolvedValue([{ spaceId: 'space-1' }]);
      mockDeps.messageDB.getSpaceKeys = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([{ id: 'enc-1' }]);
      mockDeps.messageDB.getBookmarks = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getAllUserNotes = vi.fn().mockResolvedValue([]);
      mockDeps.apiClient.postUserSettings = vi.fn().mockResolvedValue({});
      vi.spyOn(global.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
      return vi
        .spyOn(global.crypto.subtle, 'encrypt')
        .mockResolvedValue(new Uint8Array(16).buffer as ArrayBuffer);
    };

    it('persists the full Space list locally even when the DB is incomplete', async () => {
      arrangePartialDb();

      await configService.saveConfig({ config: partialDbConfig(), keyset: mockKeyset });

      const saved = mockDeps.messageDB.saveUserConfig.mock.calls[0][0];
      expect(saved.spaceIds).toEqual(['space-1', 'space-2', 'space-3']);
      expect(saved.items).toHaveLength(3);
      // The folder keeps both of its Spaces: filtering must not mutate it
      expect(saved.items[2].spaceIds).toEqual(['space-1', 'space-3']);
    });

    it('caches the full Space list, not the narrowed upload', async () => {
      arrangePartialDb();
      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

      await configService.saveConfig({ config: partialDbConfig(), keyset: mockKeyset });

      const cached = setQueryDataSpy.mock.calls.at(-1)?.[1] as any;
      expect(cached.spaceIds).toEqual(['space-1', 'space-2', 'space-3']);
    });

    it('does not publish a Space list truncated by an incomplete DB', async () => {
      arrangePartialDb();

      await configService.saveConfig({ config: partialDbConfig(), keyset: mockKeyset });

      // Publishing this would make every other device adopt the shorter list
      expect(mockDeps.apiClient.postUserSettings).not.toHaveBeenCalled();
    });

    it('keeps tombstones unsent when the upload is held', async () => {
      arrangePartialDb();
      const withTombstones = {
        ...partialDbConfig(),
        deletedBookmarkIds: ['bk-1'],
        deletedUserNoteAddresses: ['addr-1'],
      };

      await configService.saveConfig({ config: withTombstones, keyset: mockKeyset });

      // Clearing these without syncing would resurrect the deletions elsewhere
      const saved = mockDeps.messageDB.saveUserConfig.mock.calls[0][0];
      expect(saved.deletedBookmarkIds).toEqual(['bk-1']);
      expect(saved.deletedUserNoteAddresses).toEqual(['addr-1']);
    });

    it('still publishes when the user removed a Space, so removals propagate', async () => {
      // The user left space-2: the caller already took it out of spaceIds, but
      // it is still sitting in the local DB with a valid encryption state.
      // Nothing is dropped by narrowing, so this must publish as normal.
      const afterLeaving = {
        address: 'user-left',
        spaceIds: ['space-1'],
        items: [{ type: 'space', id: 'space-1' }],
        allowSync: true,
        timestamp: 0,
      } as any;

      mockDeps.messageDB.getSpaces = vi
        .fn()
        .mockResolvedValue([{ spaceId: 'space-1' }, { spaceId: 'space-2' }]);
      mockDeps.messageDB.getSpaceKeys = vi.fn().mockResolvedValue([]);
      // Faithful to the real removal paths (SpaceService.deleteSpace, the
      // self-kicked branch in MessageService): the leaving Space's encryption
      // state is deleted BEFORE saveConfig runs, so space-2 has none here.
      mockDeps.messageDB.getEncryptionStates = vi
        .fn()
        .mockImplementation(({ conversationId }: { conversationId: string }) =>
          Promise.resolve(conversationId.startsWith('space-1') ? [{ id: 'enc-1' }] : [])
        );
      mockDeps.messageDB.getBookmarks = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getAllUserNotes = vi.fn().mockResolvedValue([]);
      mockDeps.apiClient.postUserSettings = vi.fn().mockResolvedValue({});
      vi.spyOn(global.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
      const encryptSpy = vi
        .spyOn(global.crypto.subtle, 'encrypt')
        .mockResolvedValue(new Uint8Array(16).buffer as ArrayBuffer);

      await configService.saveConfig({ config: afterLeaving, keyset: mockKeyset });

      expect(mockDeps.apiClient.postUserSettings).toHaveBeenCalled();
      const uploaded = JSON.parse(
        Buffer.from(encryptSpy.mock.calls[0][2] as Uint8Array).toString('utf-8')
      );
      // space-2 is gone from the published list, and its key with it
      expect(uploaded.spaceIds).toEqual(['space-1']);
      expect(uploaded.spaceKeys.map((k: any) => k.spaceId)).toEqual(['space-1']);
      // A published save earns a fresh timestamp
      const saved = mockDeps.messageDB.saveUserConfig.mock.calls[0][0];
      expect(saved.timestamp).toBeGreaterThan(0);
    });

    it('does not advance the stored timestamp when the upload is held', async () => {
      arrangePartialDb();

      await configService.saveConfig({
        config: { ...partialDbConfig(), timestamp: 1000 },
        keyset: mockKeyset,
      });

      // getConfig resolves purely by timestamp and never merges the losing
      // side, so claiming to be newer than the server without having published
      // would make this device ignore every remote config while it holds.
      const saved = mockDeps.messageDB.saveUserConfig.mock.calls[0][0];
      expect(saved.timestamp).toBe(1000);
    });

    it('holds when a listed Space is absent from the local DB entirely', async () => {
      // The EncryptionService re-key path (ensureKeyForSpace) writes the new
      // spaceId into the config before the Space row exists under that id, so
      // getSpaces() cannot see it yet. Narrowing must hold, not publish a
      // config that silently drops the Space from every other device.
      const midRename = {
        address: 'user-rename',
        spaceIds: ['space-new'],
        items: [{ type: 'space', id: 'space-new' }],
        allowSync: true,
        timestamp: 500,
      } as any;

      mockDeps.messageDB.getSpaces = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getSpaceKeys = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getBookmarks = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getAllUserNotes = vi.fn().mockResolvedValue([]);
      mockDeps.apiClient.postUserSettings = vi.fn().mockResolvedValue({});
      vi.spyOn(global.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
      vi.spyOn(global.crypto.subtle, 'encrypt').mockResolvedValue(
        new Uint8Array(16).buffer as ArrayBuffer
      );

      await configService.saveConfig({ config: midRename, keyset: mockKeyset });

      expect(mockDeps.apiClient.postUserSettings).not.toHaveBeenCalled();
      const saved = mockDeps.messageDB.saveUserConfig.mock.calls[0][0];
      expect(saved.spaceIds).toEqual(['space-new']);
      expect(saved.timestamp).toBe(500);
    });
  });

  /**
   * The receive side of the vanishing-sidebar bug.
   *
   * saveConfig (section 5) stops THIS device publishing a truncated list. It
   * does nothing about a truncated list arriving from another device, which is
   * how the bug actually reaches a desktop: mobile narrows its Space list to
   * what it can key, publishes anyway, wins on timestamp, and this device
   * adopts it verbatim. The sidebar renders from the adopted config, so it
   * empties while every Space row sits untouched in IndexedDB.
   *
   * These tests pin the instrument, not a fix — adoption is still verbatim.
   * The first test is the characterization: it asserts the loss happens, so it
   * will fail the day someone makes the receive side merge, which is the
   * correct moment to revisit it.
   */
  describe('6. getConfig() - space-list shrink on adopt', () => {
    const address = 'user-address-123';
    const mockUserKey = {
      user_key: {
        private_key: new Uint8Array(57),
        public_key: new Uint8Array(57),
      },
    } as any;
    const DIAG_KEY = 'quorum:diag:configSpaceShrink';

    /** Drive one adopt-a-newer-remote-config cycle. */
    async function adopt({
      storedSpaceIds,
      remoteSpaceIds,
      dbSpaceIds = storedSpaceIds,
    }: {
      storedSpaceIds: string[];
      remoteSpaceIds: string[];
      dbSpaceIds?: string[];
    }) {
      const storedConfig = { address, spaceIds: storedSpaceIds, timestamp: 500 };
      const decryptedConfig = {
        address,
        spaceIds: remoteSpaceIds,
        items: remoteSpaceIds.map(id => ({ type: 'space', id })),
        spaceKeys: [],
        timestamp: 1000,
      };
      const jsonBytes = new TextEncoder().encode(JSON.stringify(decryptedConfig));
      const decryptedBuffer = jsonBytes.buffer.slice(
        jsonBytes.byteOffset,
        jsonBytes.byteOffset + jsonBytes.byteLength
      );

      mockDeps.messageDB.getUserConfig = vi.fn().mockResolvedValue(storedConfig);
      mockDeps.messageDB.getSpaces = vi
        .fn()
        .mockResolvedValue(dbSpaceIds.map(id => ({ spaceId: id })));
      mockDeps.apiClient.getUserSettings = vi.fn().mockResolvedValue({
        data: { user_config: 'aabbccdd' + '000000000000000000000000', timestamp: 1000, signature: 'aabbcc' },
      });

      vi.spyOn(global.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
      vi.spyOn(global.crypto.subtle, 'decrypt').mockResolvedValue(decryptedBuffer as ArrayBuffer);

      return configService.getConfig({ address, userKey: mockUserKey });
    }

    /** The single diagnostic entry the instrument recorded, if any. */
    function lastEntry() {
      const raw = localStorage.getItem(DIAG_KEY);
      if (!raw) return undefined;
      const ring = JSON.parse(raw);
      return ring[ring.length - 1];
    }

    beforeEach(() => {
      localStorage.clear();
    });

    it('adopts the narrower list verbatim, dropping Spaces this device still holds', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await adopt({
        storedSpaceIds: ['space-a', 'space-b', 'space-c'],
        remoteSpaceIds: ['space-c'],
      });

      // The reported symptom: only the publisher's Space survives.
      expect(result.spaceIds).toEqual(['space-c']);
      const saved = mockDeps.messageDB.saveUserConfig.mock.calls[0][0];
      expect(saved.spaceIds).toEqual(['space-c']);
    });

    it('warns and records the drop, naming the Spaces about to vanish', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await adopt({
        storedSpaceIds: ['space-a', 'space-b', 'space-c'],
        remoteSpaceIds: ['space-c'],
      });

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('ADOPTED a config that drops 2 Space(s)'),
        expect.objectContaining({ before: 3, after: 1, dropped: 2, stillInDb: 2 })
      );
      expect(lastEntry()).toMatchObject({
        before: 3,
        after: 1,
        dropped: 2,
        stillInDb: 2,
        droppedIds: ['space-a', 'space-b'],
        incomingTimestamp: 1000,
      });
    });

    it('counts only dropped Spaces the local DB still holds', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // space-a was already gone from this device's DB, so losing it from the
      // nav costs the user nothing. Only space-b is a real disappearance.
      await adopt({
        storedSpaceIds: ['space-a', 'space-b', 'space-c'],
        remoteSpaceIds: ['space-c'],
        dbSpaceIds: ['space-b', 'space-c'],
      });

      expect(lastEntry()).toMatchObject({ dropped: 2, stillInDb: 1 });
    });

    it('stays silent when the incoming list is not narrower', async () => {
      // Control arm: same adopt path, same DB, nothing dropped. If this warns,
      // the instrument is measuring adoption rather than loss and every entry
      // above is noise.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await adopt({
        storedSpaceIds: ['space-a'],
        remoteSpaceIds: ['space-a', 'space-b'],
      });

      expect(warn).not.toHaveBeenCalled();
      expect(localStorage.getItem(DIAG_KEY)).toBeNull();
    });

    it('keeps the diagnostic ring bounded at 20 entries', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      localStorage.setItem(
        DIAG_KEY,
        JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ at: `old-${i}` })))
      );

      await adopt({ storedSpaceIds: ['space-a', 'space-b'], remoteSpaceIds: ['space-b'] });

      const ring = JSON.parse(localStorage.getItem(DIAG_KEY)!);
      expect(ring).toHaveLength(20);
      expect(ring[0].at).toBe('old-1');
      expect(ring[19]).toMatchObject({ dropped: 1 });
    });

    it('never lets a broken diagnostic take down config sync', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });

      const result = await adopt({
        storedSpaceIds: ['space-a', 'space-b'],
        remoteSpaceIds: ['space-b'],
      });

      expect(result.spaceIds).toEqual(['space-b']);
      expect(mockDeps.messageDB.saveUserConfig).toHaveBeenCalled();
    });
  });

  // Bookmarks were 656 KB of an 873 KB config blob (measured 2026-08-05), and
  // 94% of that was one field: a base64 sender avatar copied into every single
  // bookmark. The blob is the ONLY cross-device transport for every synced
  // setting, so overrunning it stops Spaces, mutes, device names and profile
  // sync all at once, silently. These tests guard both directions of the choke
  // point — nothing fat goes out, nothing fat comes in.
  describe('7. bookmarks - embedded sender avatars never enter the blob', () => {
    const AVATAR = `data:image/png;base64,${'A'.repeat(34_000)}`;

    const legacyBookmark = (id: string) =>
      ({
        bookmarkId: id,
        messageId: `msg-${id}`,
        spaceId: 'space-1',
        channelId: 'channel-1',
        sourceType: 'channel',
        createdAt: 1_700_000_000_000,
        cachedPreview: {
          senderAddress: 'QmSender000000000000000000000000000000',
          senderName: 'Rosalind',
          senderIcon: AVATAR,
          textSnippet: 'still here',
          messageDate: 1_699_999_000_000,
          sourceName: 'Quorum Test > #general',
          contentType: 'text',
        },
      }) as any;

    const mockKeyset = {
      userKeyset: {
        user_key: { private_key: new Uint8Array(57), public_key: new Uint8Array(57) },
      } as any,
      deviceKeyset: {} as any,
    };

    it('strips them from the payload that gets encrypted and uploaded', async () => {
      // Assert on the PLAINTEXT handed to crypto.subtle.encrypt — that is
      // literally the blob the server stores, so this cannot pass by testing a
      // copy that never went over the wire.
      mockDeps.messageDB.getSpaces = vi.fn().mockResolvedValue([{ spaceId: 'space-1' }]);
      mockDeps.messageDB.getSpaceKeys = vi.fn().mockResolvedValue([]);
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([{ id: 'enc-1' }]);
      mockDeps.messageDB.getBookmarks = vi
        .fn()
        .mockResolvedValue([legacyBookmark('bm-1'), legacyBookmark('bm-2')]);
      mockDeps.messageDB.getAllUserNotes = vi.fn().mockResolvedValue([]);
      mockDeps.apiClient.postUserSettings = vi.fn().mockResolvedValue({});

      vi.spyOn(global.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
      const encrypt = vi
        .spyOn(global.crypto.subtle, 'encrypt')
        .mockResolvedValue(new Uint8Array(16).buffer as ArrayBuffer);

      await configService.saveConfig({
        config: {
          address: 'user-sync',
          spaceIds: ['space-1'],
          allowSync: true,
          timestamp: 0,
        } as any,
        keyset: mockKeyset,
      });

      expect(encrypt).toHaveBeenCalled();
      const uploaded = Buffer.from(encrypt.mock.calls[0][2] as ArrayBuffer).toString('utf-8');

      expect(uploaded).not.toContain('senderIcon');
      expect(uploaded).not.toContain(AVATAR);
      // 2 x 34 KB is what the old payload carried; the whole blob is now smaller
      // than one of those avatars.
      expect(uploaded.length).toBeLessThan(AVATAR.length);

      // The bookmarks themselves still sync — only the avatar is gone, and the
      // address it is re-resolved from survives.
      const parsed = JSON.parse(uploaded);
      expect(parsed.bookmarks).toHaveLength(2);
      expect(parsed.bookmarks[0].cachedPreview.senderAddress).toBe(
        'QmSender000000000000000000000000000000'
      );
      expect(parsed.bookmarks[0].cachedPreview.textSnippet).toBe('still here');
    });

    it('strips them from an inbound config published by an un-migrated device', async () => {
      // A sibling device on an older build keeps publishing the fat payload.
      // Without this, the bytes flow into IndexedDB and back out of this
      // device's own uploads, and the sweep never converges.
      const address = 'user-address-123';
      const decryptedConfig = {
        address,
        spaceIds: ['space-1'],
        items: [{ type: 'space', id: 'space-1' }],
        spaceKeys: [],
        bookmarks: [legacyBookmark('bm-1'), legacyBookmark('bm-2')],
        timestamp: 1000,
      };
      const jsonBytes = new TextEncoder().encode(JSON.stringify(decryptedConfig));
      const decryptedBuffer = jsonBytes.buffer.slice(
        jsonBytes.byteOffset,
        jsonBytes.byteOffset + jsonBytes.byteLength
      );

      mockDeps.messageDB.getUserConfig = vi
        .fn()
        .mockResolvedValue({ address, spaceIds: ['space-1'], timestamp: 500 });
      mockDeps.messageDB.getSpaces = vi.fn().mockResolvedValue([{ spaceId: 'space-1' }]);
      mockDeps.messageDB.getBookmarks = vi.fn().mockResolvedValue([]);
      mockDeps.apiClient.getUserSettings = vi.fn().mockResolvedValue({
        data: {
          user_config: 'aabbccdd' + '000000000000000000000000',
          timestamp: 1000,
          signature: 'aabbcc',
        },
      });
      vi.spyOn(global.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
      vi.spyOn(global.crypto.subtle, 'decrypt').mockResolvedValue(
        decryptedBuffer as ArrayBuffer
      );

      const result = await configService.getConfig({
        address,
        userKey: {
          user_key: { private_key: new Uint8Array(57), public_key: new Uint8Array(57) },
        } as any,
      });

      // Nothing fat reaches IndexedDB...
      const written = mockDeps.messageDB.addBookmark.mock.calls.map((c: any[]) => c[0]);
      expect(written).toHaveLength(2);
      for (const bookmark of written) {
        expect(bookmark.cachedPreview.senderIcon).toBeUndefined();
        expect(bookmark.cachedPreview.senderAddress).toBe(
          'QmSender000000000000000000000000000000'
        );
      }

      // ...nor the config this device now believes is current and will re-publish.
      const saved = mockDeps.messageDB.saveUserConfig.mock.calls[0][0];
      expect(JSON.stringify(saved)).not.toContain('senderIcon');
      expect(JSON.stringify(result)).not.toContain('senderIcon');
    });
  });
});
