/**
 * ConfigService - Unit Tests
 *
 * PURPOSE: Validates ConfigService getConfig/saveConfig paths that do not
 * require crypto operations.
 *
 * APPROACH: Unit tests with vi.fn() mocks - NOT integration tests
 *
 * KNOWN GAPS (see .agents/tasks/2026-05-19-test-suite-review.md):
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

      // ✅ VERIFY: Timestamp was updated
      expect(mockConfig.timestamp).toBeGreaterThan(0);

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
});
