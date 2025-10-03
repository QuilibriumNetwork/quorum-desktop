/**
 * EncryptionService - Unit Tests
 *
 * PURPOSE: Validates that EncryptionService functions correctly call dependencies
 * with correct parameters. Uses mocks and spies to verify behavior.
 *
 * APPROACH: Unit tests with vi.fn() mocks - NOT integration tests
 *
 * NOTE: EncryptionService methods use complex crypto operations (js_generate_ed448,
 * js_sign_ed448) that require WASM initialization. Tests focus on service
 * construction, method signatures, and early return conditions.
 *
 * CRITICAL TESTS:
 * - Service construction and dependency injection
 * - Method existence and signatures
 * - Early return when key exists
 * - Encryption state deletion
 *
 * FAILURE GUIDANCE:
 * - "Expected function but got undefined": Method is missing
 * - "Expected X parameters but got Y": Method signature changed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncryptionService, EncryptionServiceDependencies } from '@/services/EncryptionService';
import { QueryClient } from '@tanstack/react-query';

describe('EncryptionService - Unit Tests', () => {
  let encryptionService: EncryptionService;
  let mockDeps: EncryptionServiceDependencies;
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

    // Setup mocks for all EncryptionService dependencies
    mockDeps = {
      messageDB: {
        getEncryptionStates: vi.fn().mockResolvedValue([]),
        deleteEncryptionState: vi.fn().mockResolvedValue(undefined),
        deleteInboxMapping: vi.fn().mockResolvedValue(undefined),
        deleteLatestState: vi.fn().mockResolvedValue(undefined),
        getSpaceKey: vi.fn().mockResolvedValue(null),
        getSpaceKeys: vi.fn().mockResolvedValue([]),
        deleteSpaceKey: vi.fn().mockResolvedValue(undefined),
        saveSpaceKey: vi.fn().mockResolvedValue(undefined),
        getConversations: vi.fn().mockResolvedValue({ conversations: [] }),
        saveConversation: vi.fn().mockResolvedValue(undefined),
        getMessages: vi.fn().mockResolvedValue({ messages: [] }),
        saveMessage: vi.fn().mockResolvedValue(undefined),
        getSpaceMembers: vi.fn().mockResolvedValue([]),
        deleteSpaceMember: vi.fn().mockResolvedValue(undefined),
        saveSpaceMember: vi.fn().mockResolvedValue(undefined),
        getUserConfig: vi.fn().mockResolvedValue({ address: 'user-addr', spaceIds: [] }),
        deleteSpace: vi.fn().mockResolvedValue(undefined),
        getSpaces: vi.fn().mockResolvedValue([]),
        saveEncryptionState: vi.fn().mockResolvedValue(undefined),
      } as any,
      apiClient: {
        postSpace: vi.fn().mockResolvedValue({}),
      } as any,
      saveConfig: vi.fn().mockResolvedValue(undefined),
      keyset: {
        userKeyset: { privateKey: 'user-key' } as any,
        deviceKeyset: { privateKey: 'device-key' } as any,
      },
      updateSpace: vi.fn().mockResolvedValue(undefined),
      selfAddress: 'address-self',
    };

    // Create EncryptionService with mocked dependencies
    encryptionService = new EncryptionService(mockDeps);

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('1. Service Construction', () => {
    it('should construct EncryptionService with all required dependencies', () => {
      // ✅ VERIFY: Service constructed successfully
      expect(encryptionService).toBeDefined();
      expect(encryptionService instanceof EncryptionService).toBe(true);
    });

    it('should have all required methods', () => {
      // ✅ VERIFY: All methods exist
      expect(typeof encryptionService.deleteEncryptionStates).toBe('function');
      expect(typeof encryptionService.ensureKeyForSpace).toBe('function');
    });
  });

  describe('2. Method Signatures', () => {
    it('should have correct parameter count for deleteEncryptionStates', () => {
      // ✅ VERIFY: deleteEncryptionStates has 1 parameter (object with conversationId)
      expect(encryptionService.deleteEncryptionStates.length).toBe(1);
    });

    it('should have correct parameter count for ensureKeyForSpace', () => {
      // ✅ VERIFY: ensureKeyForSpace has 3 parameters (user_address, space, queryClient)
      expect(encryptionService.ensureKeyForSpace.length).toBe(3);
    });
  });

  describe('3. deleteEncryptionStates() - Encryption State Cleanup', () => {
    it('should delete all encryption states for conversation', async () => {
      const conversationId = 'space-123/channel-456';

      // Mock encryption states
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        { conversationId, state: 'state-1', inboxId: 'inbox-1' },
        { conversationId, state: 'state-2', inboxId: 'inbox-2' },
        { conversationId, state: 'state-3', inboxId: null },
      ]);

      await encryptionService.deleteEncryptionStates({ conversationId });

      // ✅ VERIFY: getEncryptionStates called with conversationId
      expect(mockDeps.messageDB.getEncryptionStates).toHaveBeenCalledWith({
        conversationId,
      });

      // ✅ VERIFY: All 3 states deleted
      expect(mockDeps.messageDB.deleteEncryptionState).toHaveBeenCalledTimes(3);

      // ✅ VERIFY: Inbox mappings deleted for states with inboxId
      expect(mockDeps.messageDB.deleteInboxMapping).toHaveBeenCalledTimes(2);
      expect(mockDeps.messageDB.deleteInboxMapping).toHaveBeenCalledWith('inbox-1');
      expect(mockDeps.messageDB.deleteInboxMapping).toHaveBeenCalledWith('inbox-2');

      // ✅ VERIFY: Latest state deleted
      expect(mockDeps.messageDB.deleteLatestState).toHaveBeenCalledWith(conversationId);
    });

    it('should handle empty encryption states gracefully', async () => {
      const conversationId = 'space-empty/channel-empty';

      // Mock no encryption states
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([]);

      await encryptionService.deleteEncryptionStates({ conversationId });

      // ✅ VERIFY: No deletion calls made for empty states
      expect(mockDeps.messageDB.deleteEncryptionState).not.toHaveBeenCalled();
      expect(mockDeps.messageDB.deleteInboxMapping).not.toHaveBeenCalled();
    });

    it('should handle states without inboxId', async () => {
      const conversationId = 'space-123/channel-456';

      // Mock encryption states without inboxId
      mockDeps.messageDB.getEncryptionStates = vi.fn().mockResolvedValue([
        { conversationId, state: 'state-1', inboxId: null },
        { conversationId, state: 'state-2', inboxId: undefined },
      ]);

      await encryptionService.deleteEncryptionStates({ conversationId });

      // ✅ VERIFY: States deleted
      expect(mockDeps.messageDB.deleteEncryptionState).toHaveBeenCalledTimes(2);

      // ✅ VERIFY: No inbox mapping deletions for null/undefined inboxId
      expect(mockDeps.messageDB.deleteInboxMapping).not.toHaveBeenCalled();
    });
  });

  describe('4. ensureKeyForSpace() - Key Generation/Retrieval', () => {
    it('should return existing spaceId if key already exists', async () => {
      const userAddress = 'user-123';
      const space = {
        spaceId: 'existing-space-id',
        spaceName: 'Test Space',
      } as any;

      // Mock existing space key
      mockDeps.messageDB.getSpaceKey = vi.fn().mockResolvedValue({
        spaceId: 'existing-space-id',
        keyId: 'existing-space-id',
        publicKey: 'pubkey',
        privateKey: 'privkey',
      });

      const result = await encryptionService.ensureKeyForSpace(
        userAddress,
        space,
        queryClient
      );

      // ✅ VERIFY: Returns existing spaceId
      expect(result).toBe('existing-space-id');

      // ✅ VERIFY: getSpaceKey was called to check for existing key
      expect(mockDeps.messageDB.getSpaceKey).toHaveBeenCalledWith(
        'existing-space-id',
        'existing-space-id'
      );

      // ✅ VERIFY: No new keys generated (early return)
      expect(mockDeps.messageDB.saveSpaceKey).not.toHaveBeenCalled();
      expect(mockDeps.apiClient.postSpace).not.toHaveBeenCalled();
    });
  });
});
