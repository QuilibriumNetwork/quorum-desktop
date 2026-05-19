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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@/services/ConfigService';
import { QueryClient } from '@tanstack/react-query';

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
});
