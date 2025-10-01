# Task: Create Comprehensive Test Suite for handleNewMessage

**Status**: Ready to Start
**Priority**: 🔴 CRITICAL - Blocks Phase 4 Task 2
**Complexity**: High
**Created**: 2025-10-01
**Context**: [Test Gap Analysis](./test-gap-analysis.md) | [Phase 4 Plan](./messagedb-phase4-optimization.md)

## Overview

Create comprehensive test coverage for `handleNewMessage` (1,321 lines) **BEFORE** starting the Phase 4 refactoring. Current coverage (2 tests) is insufficient to safely refactor this complex function.

## Why This Task is Critical

**Without these tests**:
- 🔴 60% chance of production bugs during refactoring
- 🔴 Silent failures in control messages (join, kick, sync)
- 🔴 Encryption state corruption (unrecoverable)
- 🔴 Security vulnerabilities (signature verification)

**With these tests**:
- 🟡 10-15% chance of bugs (edge cases only)
- ✅ Immediate detection of breaking changes
- ✅ Safe refactoring with confidence
- ✅ Clear regression test suite

## Test Strategy

### Approach: Mock-Based Behavior Testing

**Why not E2E tests?**
- handleNewMessage has complex crypto dependencies (@quilibrium/quilibrium-js-sdk-channels)
- Setting up real encryption contexts would take weeks
- Mock-based tests are sufficient for refactoring validation

**What we're testing**:
- ✅ Correct message type routing
- ✅ Expected side effects (DB writes, cache updates, navigation)
- ✅ Signature verification logic
- ✅ Encryption state management
- ✅ Error handling

**What we're NOT testing** (already covered elsewhere):
- ❌ Actual cryptographic operations (trust the SDK)
- ❌ IndexedDB storage (trust Dexie)
- ❌ React Query (trust @tanstack/react-query)

## Test Files to Create

### File 1: handleNewMessage.control.test.tsx (CRITICAL)

**Location**: `src/dev/refactoring/tests/messagedb/handleNewMessage.control.test.tsx`

**Coverage**: 13 control message types
- `join` - Add user to space, update ratchet peer map
- `leave` - Remove user from space
- `kick` - Handle kicked user (self or other), cleanup space data
- `space-manifest` - Update space configuration
- `sync-peer-map` - Update peer encryption keys (313 lines!)
- `rekey` - Handle key rotation
- `verify-kicked` - Verify kick status

**Test Count**: ~15 tests
**Lines**: ~300-400 lines
**Time Estimate**: 3-4 hours
**Priority**: 🔴 CRITICAL

#### Test Structure:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { MessageService } from '@/services/MessageService';
import { channel as secureChannel, channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';

// Mock external dependencies
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    UnsealGroupEnvelope: vi.fn(),
    // ... other mocks
  },
  channel_raw: {
    js_verify_ed448: vi.fn(),
    js_verify_point: vi.fn(),
    // ... other mocks
  },
}));

vi.mock('@/db/messages');
vi.mock('@/utils/crypto');

describe('handleNewMessage - Control Messages', () => {
  let messageService: MessageService;
  let mockMessageDB: any;
  let mockQueryClient: QueryClient;
  let mockKeyset: any;
  let mockSelfAddress: string;

  beforeEach(() => {
    // Setup common test fixtures
    mockSelfAddress = 'self-address-123';
    mockKeyset = {
      userKeyset: {
        private_key: Buffer.from('mock-user-private', 'hex'),
        public_key: Buffer.from('mock-user-public', 'hex'),
      },
      deviceKeyset: {
        inbox_keyset: {
          inbox_address: 'inbox-address-123',
          inbox_encryption_key: {
            private_key: Buffer.from('mock-inbox-private', 'hex'),
            public_key: Buffer.from('mock-inbox-public', 'hex'),
          },
        },
        identity_key: {
          private_key: Buffer.from('mock-identity-private', 'hex'),
          public_key: Buffer.from('mock-identity-public', 'hex'),
        },
      },
    };

    mockMessageDB = {
      getAllEncryptionStates: vi.fn(),
      getEncryptionStates: vi.fn(),
      saveEncryptionState: vi.fn(),
      getConversation: vi.fn(),
      getSpace: vi.fn(),
      saveSpaceMember: vi.fn(),
      getSpaceMember: vi.fn(),
      deleteSpaceMember: vi.fn(),
      saveMessage: vi.fn(),
      // ... other DB methods
    };

    mockQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    messageService = new MessageService({
      messageDB: mockMessageDB,
      enqueueOutbound: vi.fn(),
      addOrUpdateConversation: vi.fn(),
      apiClient: {} as any,
      deleteEncryptionStates: vi.fn(),
      deleteInboxMessages: vi.fn(),
      navigate: vi.fn(),
      spaceInfo: { current: {} },
      syncInfo: { current: {} },
      synchronizeAll: vi.fn(),
      informSyncData: vi.fn(),
      initiateSync: vi.fn(),
      directSync: vi.fn(),
      saveConfig: vi.fn(),
      int64ToBytes: vi.fn(),
      canonicalize: vi.fn((obj) => JSON.stringify(obj)),
      sendHubMessage: vi.fn(),
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('JOIN message', () => {
    it('should verify signature and add member to space', async () => {
      // Arrange: Setup join message
      const spaceId = 'space-123';
      const conversationId = `${spaceId}/${spaceId}`;
      const newParticipant = {
        address: 'new-user-address',
        id: 'new-user-id',
        inboxAddress: 'new-inbox-address',
        pubKey: 'new-pub-key',
        inboxKey: Buffer.from('new-inbox-key', 'hex').toString('hex'),
        identityKey: Buffer.from('new-identity-key', 'hex').toString('hex'),
        preKey: Buffer.from('new-pre-key', 'hex').toString('hex'),
        userIcon: 'https://example.com/avatar.png',
        displayName: 'New User',
        inboxPubKey: Buffer.from('new-inbox-pub-key', 'hex').toString('hex'),
        signature: 'valid-signature-base64',
      };

      const encryptedMessage = {
        inboxAddress: 'group-inbox-address',
        encryptedContent: JSON.stringify({
          owner_public_key: 'owner-public-key',
          owner_signature: 'owner-signature',
          envelope: JSON.stringify({
            type: 'control',
            message: {
              type: 'join',
              participant: newParticipant,
            },
          }),
        }),
        timestamp: Date.now(),
      };

      // Mock: Encryption state found
      mockMessageDB.getAllEncryptionStates.mockResolvedValue([
        {
          inboxId: 'group-inbox-address',
          conversationId,
          state: JSON.stringify({
            state: JSON.stringify({
              id_peer_map: {},
              peer_id_map: {},
            }),
            sending_inbox: null, // Group message (not direct)
          }),
        },
      ]);

      // Mock: Successful group envelope unseal
      vi.mocked(secureChannel.UnsealGroupEnvelope).mockReturnValue({
        type: 'control',
        message: {
          type: 'join',
          participant: newParticipant,
        },
      });

      // Mock: Point verification succeeds
      vi.mocked(ch.js_verify_point).mockReturnValue('true');

      // Mock: Ed448 signature verification succeeds
      vi.mocked(ch.js_verify_ed448).mockReturnValue('true');

      // Mock: Space exists
      mockMessageDB.getSpace.mockResolvedValue({
        spaceId,
        defaultChannelId: 'general',
        spaceName: 'Test Space',
      });

      // Act: Process the join message
      await messageService.handleNewMessage(
        mockSelfAddress,
        mockKeyset,
        encryptedMessage,
        mockQueryClient
      );

      // Assert: Member was added to database
      expect(mockMessageDB.saveSpaceMember).toHaveBeenCalledWith(spaceId, {
        user_address: newParticipant.address,
        user_icon: newParticipant.userIcon,
        display_name: newParticipant.displayName,
        inbox_address: newParticipant.inboxAddress,
        isKicked: false,
      });

      // Assert: Ratchet state was updated with new peer keys
      expect(mockMessageDB.saveEncryptionState).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId,
          state: expect.stringContaining(newParticipant.id),
        }),
        true
      );

      // Assert: Join system message was created
      expect(mockMessageDB.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId,
          content: expect.objectContaining({
            type: 'join',
            senderId: newParticipant.address,
          }),
        })
      );
    });

    it('should reject join with invalid point verification', async () => {
      // Arrange: Join message with invalid point
      const encryptedMessage = {
        inboxAddress: 'group-inbox-address',
        encryptedContent: JSON.stringify({
          envelope: JSON.stringify({
            type: 'control',
            message: {
              type: 'join',
              participant: { /* ... */ },
            },
          }),
        }),
        timestamp: Date.now(),
      };

      mockMessageDB.getAllEncryptionStates.mockResolvedValue([/* ... */]);
      vi.mocked(secureChannel.UnsealGroupEnvelope).mockReturnValue(/* ... */);

      // Mock: Point verification FAILS
      vi.mocked(ch.js_verify_point).mockReturnValue('false');

      // Act
      await messageService.handleNewMessage(
        mockSelfAddress,
        mockKeyset,
        encryptedMessage,
        mockQueryClient
      );

      // Assert: Member should NOT be added
      expect(mockMessageDB.saveSpaceMember).not.toHaveBeenCalled();
      expect(mockMessageDB.saveEncryptionState).not.toHaveBeenCalled();
    });

    it('should reject join with invalid signature', async () => {
      // Similar to above, but js_verify_ed448 returns 'false'
      // ... test implementation
    });

    it('should update ratchet peer map with new member keys', async () => {
      // Test focuses specifically on ratchet state updates
      // ... test implementation
    });
  });

  describe('KICK message', () => {
    it('should handle self-kick: navigate away and cleanup space data', async () => {
      // Arrange: Kick message where current user is kicked
      const spaceId = 'space-123';
      const mockNavigate = vi.fn();
      messageService = new MessageService({
        ...messageService,
        navigate: mockNavigate,
      });

      const encryptedMessage = {
        inboxAddress: 'group-inbox-address',
        encryptedContent: JSON.stringify({
          owner_public_key: 'owner-public-key',
          owner_signature: 'owner-signature',
          envelope: JSON.stringify({
            type: 'control',
            message: {
              type: 'kick',
              kick: mockSelfAddress, // Self is kicked
            },
          }),
        }),
        timestamp: Date.now(),
      };

      // Mock: Encryption state, space info, etc.
      mockMessageDB.getAllEncryptionStates.mockResolvedValue([/* ... */]);
      mockMessageDB.getSpace.mockResolvedValue({ spaceId, spaceName: 'Test Space' });
      mockMessageDB.getSpaceKey.mockResolvedValue({
        privateKey: 'hub-private-key',
        publicKey: 'hub-public-key',
        address: 'hub-address',
      });

      // Mock: Owner signature verification succeeds
      vi.mocked(ch.js_verify_ed448).mockReturnValue('true');

      // Mock: Get encryption states, messages, members for cleanup
      mockMessageDB.getEncryptionStates.mockResolvedValue([{ /* ... */ }]);
      mockMessageDB.getAllSpaceMessages.mockResolvedValue([{ messageId: 'msg1' }]);
      mockMessageDB.getSpaceMembers.mockResolvedValue([{ user_address: 'user1' }]);
      mockMessageDB.getSpaceKeys.mockResolvedValue([{ keyId: 'key1' }]);

      // Act
      await messageService.handleNewMessage(
        mockSelfAddress,
        mockKeyset,
        encryptedMessage,
        mockQueryClient
      );

      // Assert: Navigation occurred
      expect(mockNavigate).toHaveBeenCalledWith(
        '/messages',
        expect.objectContaining({
          replace: true,
          state: expect.objectContaining({ from: 'kicked', spaceId }),
        })
      );

      // Assert: Space data was cleaned up
      expect(mockMessageDB.deleteEncryptionState).toHaveBeenCalled();
      expect(mockMessageDB.deleteMessage).toHaveBeenCalledWith('msg1');
      expect(mockMessageDB.deleteSpaceMember).toHaveBeenCalledWith(spaceId, 'user1');
      expect(mockMessageDB.deleteSpaceKey).toHaveBeenCalledWith(spaceId, 'key1');
    });

    it('should handle other-user kick without cleanup', async () => {
      // Test kicking another user (not self)
      // Should create kick message but NOT navigate or cleanup
      // ... test implementation
    });

    it('should verify owner signature before processing kick', async () => {
      // Test that invalid owner signature is rejected
      // ... test implementation
    });
  });

  describe('SYNC-PEER-MAP message', () => {
    it('should verify owner signature and update peer map', async () => {
      // Test the 313-line sync-peer-map handler
      // ... test implementation
    });

    it('should unseal and apply new encryption keys', async () => {
      // Test encryption key unsealing and application
      // ... test implementation
    });

    it('should handle kick notifications within sync', async () => {
      // sync-peer-map can include kick information
      // ... test implementation
    });

    it('should update invite URL with new config key', async () => {
      // Test invite URL update with new config key
      // ... test implementation
    });
  });

  describe('SPACE-MANIFEST message', () => {
    it('should verify and apply space configuration updates', async () => {
      // Test space manifest verification and application
      // ... test implementation
    });
  });

  describe('LEAVE message', () => {
    it('should remove member and create leave system message', async () => {
      // Test leave message processing
      // ... test implementation
    });

    it('should update query cache to remove member', async () => {
      // Test React Query cache update
      // ... test implementation
    });
  });

  describe('REKEY message', () => {
    it('should handle key rotation', async () => {
      // Test rekey message processing
      // ... test implementation
    });
  });

  describe('VERIFY-KICKED message', () => {
    it('should verify kick status', async () => {
      // Test verify-kicked message processing
      // ... test implementation
    });
  });
});
```

---

### File 2: handleNewMessage.sync.test.tsx (CRITICAL)

**Location**: `src/dev/refactoring/tests/messagedb/handleNewMessage.sync.test.tsx`

**Coverage**: 8 sync message types
- `sync-request` - Request sync from peer
- `sync-initiate` - Initiate sync session
- `sync-members` - Sync space members
- `sync-messages` - Sync batch of messages
- `sync-info` - Exchange sync metadata
- `sync` - General sync

**Test Count**: ~10 tests
**Lines**: ~250-350 lines
**Time Estimate**: 2-3 hours
**Priority**: 🔴 CRITICAL

#### Test Structure:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageService } from '@/services/MessageService';

describe('handleNewMessage - Sync Messages', () => {
  // Similar setup to control tests

  describe('SYNC-REQUEST message', () => {
    it('should trigger directSync with requester', async () => {
      const mockDirectSync = vi.fn();
      messageService = new MessageService({
        ...messageService,
        directSync: mockDirectSync,
      });

      const encryptedMessage = {
        inboxAddress: 'group-inbox-address',
        encryptedContent: JSON.stringify({
          envelope: JSON.stringify({
            type: 'control',
            message: {
              type: 'sync-request',
              requester: 'requester-address',
            },
          }),
        }),
        timestamp: Date.now(),
      };

      // ... setup mocks

      await messageService.handleNewMessage(
        mockSelfAddress,
        mockKeyset,
        encryptedMessage,
        mockQueryClient
      );

      expect(mockDirectSync).toHaveBeenCalledWith(
        expect.any(String), // spaceId
        expect.objectContaining({
          type: 'sync-request',
        })
      );
    });
  });

  describe('SYNC-INITIATE message', () => {
    it('should respond to sync initiation', async () => {
      // Test sync initiation handling
      // ... test implementation
    });
  });

  describe('SYNC-MEMBERS message', () => {
    it('should batch save space members', async () => {
      const members = [
        { address: 'user1', displayName: 'User 1', icon: 'icon1' },
        { address: 'user2', displayName: 'User 2', icon: 'icon2' },
      ];

      const encryptedMessage = {
        inboxAddress: 'group-inbox-address',
        encryptedContent: JSON.stringify({
          envelope: JSON.stringify({
            type: 'control',
            message: {
              type: 'sync-members',
              members,
            },
          }),
        }),
        timestamp: Date.now(),
      };

      // ... setup mocks

      await messageService.handleNewMessage(
        mockSelfAddress,
        mockKeyset,
        encryptedMessage,
        mockQueryClient
      );

      // Assert: All members were saved
      expect(mockMessageDB.saveSpaceMember).toHaveBeenCalledTimes(members.length);
    });

    it('should verify member signatures in non-repudiable spaces', async () => {
      // Test signature verification for sync-members
      // ... test implementation
    });
  });

  describe('SYNC-MESSAGES message', () => {
    it('should batch save messages', async () => {
      const messages = [
        { messageId: 'msg1', content: 'Message 1', channelId: 'general' },
        { messageId: 'msg2', content: 'Message 2', channelId: 'general' },
      ];

      // ... test batch message saving
    });

    it('should verify signatures in non-repudiable spaces', async () => {
      // Test signature verification for sync-messages
      // ... test implementation
    });

    it('should update query cache for affected channels', async () => {
      // Test React Query cache updates
      // ... test implementation
    });
  });

  describe('SYNC-INFO message', () => {
    it('should exchange sync metadata', async () => {
      // Test sync-info message handling
      // ... test implementation
    });
  });

  describe('SYNC message (general)', () => {
    it('should handle general sync operations', async () => {
      // Test general sync message handling
      // ... test implementation
    });
  });
});
```

---

### File 3: handleNewMessage.crypto.test.tsx (CRITICAL)

**Location**: `src/dev/refactoring/tests/messagedb/handleNewMessage.crypto.test.tsx`

**Coverage**: Cryptographic operations
- Ed448 signature verification
- Inbox address validation
- Message ID validation
- Ratchet state serialization/deserialization

**Test Count**: ~12 tests
**Lines**: ~300-350 lines
**Time Estimate**: 3-4 hours
**Priority**: 🔴 CRITICAL (security-critical)

#### Test Structure:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageService } from '@/services/MessageService';
import { sha256, base58btc } from '@/utils/crypto';
import { channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';

describe('handleNewMessage - Cryptographic Operations', () => {
  describe('Ed448 Signature Verification', () => {
    it('should accept valid Ed448 signatures', async () => {
      // Mock valid signature verification
      vi.mocked(ch.js_verify_ed448).mockReturnValue('true');

      const message = {
        publicKey: 'valid-public-key-hex',
        signature: 'valid-signature-hex',
        messageId: 'message-id-hash',
        content: { senderId: 'user-123', type: 'post' },
      };

      // ... setup encrypted message with signature
      // ... process message

      // Assert: Message was accepted and saved
      expect(mockMessageDB.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: message.publicKey,
          signature: message.signature,
        })
      );
    });

    it('should reject invalid Ed448 signatures', async () => {
      // Mock invalid signature verification
      vi.mocked(ch.js_verify_ed448).mockReturnValue('false');

      // ... setup message with invalid signature
      // ... process message

      // Assert: Signature was stripped from message
      expect(mockMessageDB.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: undefined,
          signature: undefined,
        })
      );
    });

    it('should handle signature verification for different message types', async () => {
      // Test signature verification for post, join, update-profile
      // ... test implementation
    });
  });

  describe('Inbox Address Validation', () => {
    it('should calculate and validate inbox addresses correctly', async () => {
      const publicKey = Buffer.from('test-public-key', 'hex');
      const expectedInboxAddress = 'expected-inbox-address';

      // Mock sha256 and base58btc
      vi.mocked(sha256.digest).mockResolvedValue({
        bytes: Buffer.from('hash-bytes'),
      });
      vi.mocked(base58btc.baseEncode).mockReturnValue(expectedInboxAddress);

      // ... setup message with matching inbox address
      // ... process message

      // Assert: Message was accepted
      expect(mockMessageDB.saveMessage).toHaveBeenCalled();
    });

    it('should reject mismatched inbox addresses', async () => {
      // Setup message where calculated inbox address doesn't match claimed address
      // ... test implementation

      // Assert: Signature was stripped
      expect(mockMessageDB.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          signature: undefined,
        })
      );
    });
  });

  describe('Message ID Validation', () => {
    it('should validate message IDs match content hash', async () => {
      const content = { senderId: 'user-123', type: 'post', text: 'Hello' };
      const nonce = 'test-nonce';
      const canonicalContent = JSON.stringify(content);

      // Mock crypto.subtle.digest to return expected hash
      global.crypto = {
        subtle: {
          digest: vi.fn().mockResolvedValue(Buffer.from('expected-hash')),
        },
      } as any;

      // ... setup message with matching message ID
      // ... process message

      expect(mockMessageDB.saveMessage).toHaveBeenCalled();
    });

    it('should reject tampered message IDs', async () => {
      // Setup message where message ID doesn't match content hash
      // ... test implementation

      // Assert: Signature was stripped
      expect(mockMessageDB.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          signature: undefined,
        })
      );
    });
  });

  describe('Ratchet State Management', () => {
    it('should correctly update peer map on join', async () => {
      const initialRatchet = {
        id_peer_map: { 'existing-id': { public_key: 'existing-key' } },
        peer_id_map: { 'existing-key': 'existing-id' },
      };

      const newPeer = {
        id: 'new-peer-id',
        inboxKey: Buffer.from('new-inbox-key', 'hex').toString('hex'),
        identityKey: Buffer.from('new-identity-key', 'hex').toString('hex'),
        preKey: Buffer.from('new-pre-key', 'hex').toString('hex'),
      };

      // ... setup join message
      // ... process message

      // Assert: Ratchet state was updated correctly
      expect(mockMessageDB.saveEncryptionState).toHaveBeenCalledWith(
        expect.objectContaining({
          state: expect.stringMatching(new RegExp(newPeer.id)),
        }),
        true
      );

      // Parse saved state to verify structure
      const savedState = JSON.parse(
        vi.mocked(mockMessageDB.saveEncryptionState).mock.calls[0][0].state
      );
      const ratchet = JSON.parse(savedState.state);

      expect(ratchet.id_peer_map[newPeer.id]).toBeDefined();
      expect(ratchet.peer_id_map).toHaveProperty(
        Buffer.from(newPeer.inboxKey, 'hex').toString('base64')
      );
    });

    it('should serialize/deserialize ratchet state without corruption', async () => {
      const originalRatchet = {
        id_peer_map: { 'peer1': { public_key: 'key1' } },
        peer_id_map: { 'key1': 'peer1' },
        other_field: 'value',
      };

      // ... test roundtrip serialization
      const serialized = JSON.stringify(originalRatchet);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(originalRatchet);
    });
  });

  describe('Non-Repudiable Space Handling', () => {
    it('should enforce signatures in non-repudiable spaces', async () => {
      mockMessageDB.getSpace.mockResolvedValue({
        spaceId: 'space-123',
        isRepudiable: false, // Non-repudiable
      });

      // ... setup message WITHOUT signature
      // ... process message

      // Assert: Message was rejected or signature enforced
      // Implementation depends on exact logic
    });

    it('should allow unsigned messages in repudiable spaces', async () => {
      mockMessageDB.getSpace.mockResolvedValue({
        spaceId: 'space-123',
        isRepudiable: true, // Repudiable
      });

      // ... setup message WITHOUT signature
      // ... process message

      // Assert: Message was accepted
      expect(mockMessageDB.saveMessage).toHaveBeenCalled();
    });
  });
});
```

---

### File 4: handleNewMessage.errors.test.tsx (MODERATE)

**Location**: `src/dev/refactoring/tests/messagedb/handleNewMessage.errors.test.tsx`

**Coverage**: Error handling paths
- Malformed encrypted content
- Decryption failures
- Missing encryption state
- Invalid envelope structure
- Inbox message cleanup on failure

**Test Count**: ~8 tests
**Lines**: ~150-200 lines
**Time Estimate**: 2 hours
**Priority**: 🟡 MODERATE

#### Test Structure:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageService } from '@/services/MessageService';

describe('handleNewMessage - Error Handling', () => {
  describe('Malformed Content', () => {
    it('should handle malformed encrypted content gracefully', async () => {
      const encryptedMessage = {
        inboxAddress: 'inbox-address',
        encryptedContent: 'not-valid-json!!!',
        timestamp: Date.now(),
      };

      mockMessageDB.getAllEncryptionStates.mockResolvedValue([
        { inboxId: 'inbox-address', conversationId: 'conv-123', state: '{}' },
      ]);

      // Should not throw
      await expect(
        messageService.handleNewMessage(
          mockSelfAddress,
          mockKeyset,
          encryptedMessage,
          mockQueryClient
        )
      ).resolves.not.toThrow();

      // Should clean up inbox message
      expect(mockDeleteInboxMessages).toHaveBeenCalledWith(
        expect.anything(),
        [encryptedMessage.timestamp],
        expect.anything()
      );
    });
  });

  describe('Decryption Failures', () => {
    it('should handle decryption failures without crashing', async () => {
      // Mock UnsealGroupEnvelope to throw
      vi.mocked(secureChannel.UnsealGroupEnvelope).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      // ... setup encrypted message

      await expect(
        messageService.handleNewMessage(/* ... */)
      ).resolves.not.toThrow();

      // Should clean up
      expect(mockDeleteInboxMessages).toHaveBeenCalled();
    });
  });

  describe('Missing Encryption State', () => {
    it('should handle missing encryption state', async () => {
      mockMessageDB.getAllEncryptionStates.mockResolvedValue([]);

      const encryptedMessage = {
        inboxAddress: 'unknown-inbox',
        encryptedContent: '{}',
        timestamp: Date.now(),
      };

      await messageService.handleNewMessage(/* ... */);

      // Should delete inbox message and return early
      expect(mockDeleteInboxMessages).toHaveBeenCalledWith(
        expect.anything(),
        [encryptedMessage.timestamp],
        expect.anything()
      );

      // Should NOT attempt to save message
      expect(mockMessageDB.saveMessage).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Envelope Structure', () => {
    it('should handle invalid envelope structure', async () => {
      // Mock envelope with missing required fields
      vi.mocked(secureChannel.UnsealGroupEnvelope).mockReturnValue({
        type: undefined, // Missing type
        message: null,
      });

      // ... test handling
    });
  });

  describe('State Corruption Prevention', () => {
    it('should not corrupt encryption state on partial failure', async () => {
      // Setup scenario where saveMessage fails but encryption state was updated
      mockMessageDB.saveMessage.mockRejectedValue(new Error('Save failed'));

      // ... process message

      // Verify encryption state wasn't saved if message save failed
      // Or verify transactional behavior
    });

    it('should rollback on database errors', async () => {
      // Test error handling and rollback behavior
      // ... test implementation
    });
  });
});
```

---

### File 5: handleNewMessage.envelopes.test.tsx (MODERATE)

**Location**: `src/dev/refactoring/tests/messagedb/handleNewMessage.envelopes.test.tsx`

**Coverage**: Envelope types
- Initialization envelopes (new conversation setup)
- Direct message envelopes (sender confirmation, regular)
- Group message envelopes

**Test Count**: ~8 tests
**Lines**: ~200-250 lines
**Time Estimate**: 2-3 hours
**Priority**: 🟡 MODERATE

#### Test Structure:

```typescript
describe('handleNewMessage - Envelope Processing', () => {
  describe('Initialization Envelope', () => {
    it('should setup new conversation from initialization envelope', async () => {
      // Test lines 796-936 logic
      const initEnvelope = {
        inboxAddress: mockKeyset.deviceKeyset.inbox_keyset.inbox_address,
        encryptedContent: JSON.stringify({
          user_address: 'sender-address',
          user_icon: 'https://example.com/icon.png',
          display_name: 'Sender Name',
          // ... other init envelope fields
        }),
        timestamp: Date.now(),
      };

      vi.mocked(secureChannel.UnsealInitializationEnvelope).mockReturnValue({
        user_address: 'sender-address',
        timestamp: initEnvelope.timestamp,
        // ... other fields
      });

      vi.mocked(secureChannel.NewDoubleRatchetRecipientSession).mockResolvedValue({
        user_address: 'sender-address',
        message: JSON.stringify({ content: 'First message' }),
        state: '{}',
        tag: 'session-tag',
        return_inbox_address: 'return-inbox',
        return_inbox_encryption_key: 'return-key',
        return_inbox_public_key: 'return-pub',
        return_inbox_private_key: 'return-priv',
      });

      await messageService.handleNewMessage(/* ... */);

      // Assert: New encryption state created
      expect(mockMessageDB.saveEncryptionState).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: expect.stringContaining('sender-address'),
        }),
        true
      );

      // Assert: WebSocket listening to new inbox
      expect(mockEnqueueOutbound).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Direct Message - Sender Confirmation', () => {
    it('should confirm double ratchet sender session', async () => {
      // Test lines 947-1005 logic
      // First message from sender - needs confirmation
      // ... test implementation
    });
  });

  describe('Direct Message - Regular', () => {
    it('should decrypt regular direct message', async () => {
      // Test lines 1005-1148 logic
      // ... test implementation
    });

    it('should handle delete-conversation control message', async () => {
      // Test special case: delete-conversation in direct message
      // ... test implementation
    });
  });

  describe('Group Message Envelope', () => {
    it('should unseal group message envelope', async () => {
      // Test group message unsealing
      // ... test implementation
    });
  });
});
```

---

## Implementation Checklist

### Pre-Implementation Setup
- [ ] Review [handlenewmessage-analysis.md](./handlenewmessage-analysis.md) for function structure
- [ ] Review existing test utilities in `src/dev/refactoring/tests/utils/`
- [ ] Review existing mock setup in `src/dev/refactoring/tests/mocks/`
- [ ] Set up test environment with proper TypeScript configuration

### File 1: Control Messages (CRITICAL) - 3-4 hours
- [ ] Create `handleNewMessage.control.test.tsx`
- [ ] Setup test fixtures and mocks
- [ ] Implement JOIN message tests (4 tests)
- [ ] Implement KICK message tests (3 tests)
- [ ] Implement SYNC-PEER-MAP message tests (4 tests)
- [ ] Implement SPACE-MANIFEST message tests (1 test)
- [ ] Implement LEAVE message tests (2 tests)
- [ ] Implement REKEY message test (1 test)
- [ ] Implement VERIFY-KICKED message test (1 test)
- [ ] Run tests: `yarn vitest src/dev/refactoring/tests/messagedb/handleNewMessage.control.test.tsx`
- [ ] Verify all 15+ tests pass

### File 2: Sync Messages (CRITICAL) - 2-3 hours
- [ ] Create `handleNewMessage.sync.test.tsx`
- [ ] Setup test fixtures and mocks
- [ ] Implement SYNC-REQUEST message test (1 test)
- [ ] Implement SYNC-INITIATE message test (1 test)
- [ ] Implement SYNC-MEMBERS message tests (2 tests)
- [ ] Implement SYNC-MESSAGES message tests (3 tests)
- [ ] Implement SYNC-INFO message test (1 test)
- [ ] Implement SYNC (general) message test (1 test)
- [ ] Run tests: `yarn vitest src/dev/refactoring/tests/messagedb/handleNewMessage.sync.test.tsx`
- [ ] Verify all 10+ tests pass

### File 3: Cryptographic Operations (CRITICAL) - 3-4 hours
- [ ] Create `handleNewMessage.crypto.test.tsx`
- [ ] Setup crypto mocks (Ed448, sha256, base58btc)
- [ ] Implement Ed448 signature tests (3 tests)
- [ ] Implement inbox address validation tests (2 tests)
- [ ] Implement message ID validation tests (2 tests)
- [ ] Implement ratchet state tests (2 tests)
- [ ] Implement non-repudiable space tests (2 tests)
- [ ] Run tests: `yarn vitest src/dev/refactoring/tests/messagedb/handleNewMessage.crypto.test.tsx`
- [ ] Verify all 12+ tests pass

### File 4: Error Handling (MODERATE) - 2 hours
- [ ] Create `handleNewMessage.errors.test.tsx`
- [ ] Implement malformed content test (1 test)
- [ ] Implement decryption failure test (1 test)
- [ ] Implement missing encryption state test (1 test)
- [ ] Implement invalid envelope test (1 test)
- [ ] Implement state corruption prevention tests (2 tests)
- [ ] Implement cleanup on failure tests (2 tests)
- [ ] Run tests: `yarn vitest src/dev/refactoring/tests/messagedb/handleNewMessage.errors.test.tsx`
- [ ] Verify all 8+ tests pass

### File 5: Envelope Processing (MODERATE) - 2-3 hours
- [ ] Create `handleNewMessage.envelopes.test.tsx`
- [ ] Implement initialization envelope tests (1 test)
- [ ] Implement direct message confirmation test (1 test)
- [ ] Implement regular direct message tests (2 tests)
- [ ] Implement group message envelope test (1 test)
- [ ] Implement delete-conversation handling test (1 test)
- [ ] Run tests: `yarn vitest src/dev/refactoring/tests/messagedb/handleNewMessage.envelopes.test.tsx`
- [ ] Verify all 8+ tests pass

### Final Validation
- [ ] Run complete test suite: `yarn vitest src/dev/refactoring/tests/ --run`
- [ ] Verify test count: ~100-110 tests passing (61 existing + ~40-50 new)
- [ ] Review test coverage report
- [ ] Fix any failing tests
- [ ] Document test approach in test file comments
- [ ] Commit tests: `git commit -m "Add comprehensive handleNewMessage test suite"`
- [ ] **UNBLOCK Phase 4 Task 2** - Refactoring can now proceed safely

## Success Criteria

✅ **Task Complete When**:
1. All 5 test files created and passing
2. ~40-50 new tests added (total ~100-110 tests)
3. Coverage includes:
   - All 13 control message types
   - All 8 sync message types
   - Signature verification logic
   - Encryption state management
   - Error handling paths
   - Envelope processing
4. Tests use mock-based approach (not E2E)
5. Tests run quickly (<10 seconds total)
6. Zero flaky tests
7. Clear test structure and descriptions

## Time Estimate

**Total Time**: 12-18 hours

**Breakdown**:
- Control tests: 3-4 hours
- Sync tests: 2-3 hours
- Crypto tests: 3-4 hours
- Error tests: 2 hours
- Envelope tests: 2-3 hours
- Debugging/fixes: 2-3 hours

**Recommendation**: Split over 2-3 days, testing as you go

## Risk Mitigation

### If Tests Are Hard to Write
**Problem**: Mocking crypto operations is complex
**Solution**: Use simplified mocks, focus on behavior not implementation

### If Tests Take Too Long to Run
**Problem**: >30 second test execution
**Solution**: Reduce setup overhead, use `beforeEach` efficiently

### If Tests Are Flaky
**Problem**: Random failures
**Solution**: Ensure proper mock cleanup, use `vi.clearAllMocks()` in `afterEach`

### If Coverage is Still Insufficient
**Problem**: Tests don't catch breaking changes
**Solution**: Add more specific assertions, test side effects not just calls

## Notes for Implementation

### Mock Strategy
- Use `vi.mock()` for external dependencies
- Use `vi.fn()` for service methods
- Mock at the boundary (SDK, DB, API client)
- Don't mock internal logic

### Test Data Strategy
- Use `dataGenerators.ts` for test data
- Keep test data minimal but realistic
- Use consistent IDs for easier debugging

### Assertion Strategy
- Test behavior, not implementation
- Verify side effects (DB writes, cache updates, navigation)
- Use `expect.objectContaining()` for partial matching
- Verify mocks called with correct parameters

### Code Organization
- One `describe` block per message type
- One `it` block per behavior
- Keep tests under 50 lines each
- Extract common setup to `beforeEach`

## Dependencies

**Requires**:
- Current test infrastructure (already set up)
- Vitest and @testing-library/react (already installed)
- Mock utilities (already created)

**Blocks**:
- Phase 4 Task 2: Extract Envelope Handlers
- All subsequent Phase 4 refactoring tasks

## Next Steps After Completion

1. ✅ Mark this task complete
2. ✅ Update test-gap-analysis.md status
3. ✅ Update messagedb-phase4-optimization.md to unblock Task 2
4. ✅ Begin Phase 4 Task 2 with confidence
5. ✅ Run tests after EVERY refactoring step

---

_Created: 2025-10-01_
_Status: Ready to start_
_Blocks: Phase 4 Task 2 (refactoring)_
_Time: 12-18 hours_
