# handleNewMessage Integration Tests Guide

> **📦 ARCHIVED (Dec 20, 2025)**: This test guide has been archived because the parent refactoring plan is **NOT RECOMMENDED**.
>
> **Reason**: The `handleNewMessage` refactoring was deprioritized — the function is tightly coupled to encryption and decryption, making refactoring high-risk with low ROI.
>
> **Note**: The import chain blocker (MessageService can't be imported in tests) was never resolved. If tests are needed in the future, first extract query key builders to `src/utils/queryKeys.ts`.

---

**Status**: 📦 ARCHIVED
**Priority**: ⚪ N/A
**Last Updated**: 2025-12-16
**Archived**: 2025-12-20

---

## Purpose

Create comprehensive integration tests for `handleNewMessage` (1,354 lines) to enable safe refactoring. This guide provides detailed test specifications for all control messages, sync messages, crypto operations, and error paths.

**Note**: This is only needed if pursuing **Option A** (comprehensive tests upfront) from the refactoring plan. For **Option B** (incremental), use snapshot tests instead.

**Current Status**: ON HOLD - The refactoring this test suite would enable has been deprioritized.

---

## Test Blocker: Import Chain Issue

### The Problem
```
Test Files → MessageService
  → @/hooks (query keys)
    → hooks/index.ts → ./business/search + ./business/channels
      → IconName from @/components/primitives
        → primitives barrel tries to load .web.tsx/.native.tsx
          → ❌ FAILS in test environment
```

MessageService cannot be imported in tests because Vitest parses platform-specific files (.web.tsx/.native.tsx) before mocks are applied.

### Failed Attempts
- ❌ Mocking @/components/primitives (Vitest parses real files first)
- ❌ Mocking individual hooks (too many, hoisting issues)
- ❌ Adding .web.tsx to Vite resolve extensions (Rollup parsing errors)
- ❌ Aliasing primitives in vitest.config (Vite still loads actual files)

### Solution (30 min)
1. Create `src/utils/queryKeys.ts`
2. Move/re-export all `build*Key` functions from `src/hooks/queries/*/build*Key.ts`
3. Update `MessageService.ts` imports: `@/hooks` → `@/utils/queryKeys`
4. Add re-export in `hooks/index.ts` for backward compatibility
5. Tests will work ✨

**Impact**: Clean architectural fix (services shouldn't import from UI layer)

---

## Test Strategy

### Approach: Mock-Based Behavior Testing

**What we test**:
- ✅ Correct message type routing
- ✅ Expected side effects (DB writes, cache updates, navigation)
- ✅ Signature verification logic
- ✅ Encryption state management
- ✅ Error handling

**What we DON'T test** (trust underlying implementations):
- ❌ Real crypto operations (trust SDK)
- ❌ IndexedDB storage (trust Dexie)
- ❌ React Query (trust @tanstack/react-query)

---

## Test Files Structure

### File 1: Control Messages (CRITICAL)
**Path**: `src/dev/tests/messagedb/handleNewMessage.control.test.tsx`
**Tests**: 15 tests
**Lines**: ~400 lines
**Time**: 3-4 hours

#### Coverage
- `join` - Add user to space, update ratchet (4 tests)
- `kick` - Handle kicked user, cleanup (3 tests)
- `sync-peer-map` - Update peer encryption keys (4 tests)
- `space-manifest` - Update space config (1 test)
- `leave` - Remove user from space (2 tests)
- `rekey` - Key rotation (1 test)
- `verify-kicked` - Verify kick status (1 test)

#### Sample Test: JOIN Message
```typescript
describe('JOIN message', () => {
  it('should verify signature and add member to space', async () => {
    // Arrange: Setup join message
    const newParticipant = {
      address: 'new-user-address',
      id: 'new-user-id',
      displayName: 'New User',
      // ... other fields
    };

    const encryptedMessage = {
      inboxAddress: 'group-inbox-address',
      encryptedContent: JSON.stringify({
        owner_public_key: 'owner-key',
        owner_signature: 'owner-sig',
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
    mockMessageDB.getAllEncryptionStates.mockResolvedValue([{
      inboxId: 'group-inbox-address',
      conversationId: 'space-123/space-123',
      state: JSON.stringify({
        state: JSON.stringify({ id_peer_map: {}, peer_id_map: {} }),
        sending_inbox: null,
      }),
    }]);

    // Mock: Successful group envelope unseal
    vi.mocked(secureChannel.UnsealGroupEnvelope).mockReturnValue({
      type: 'control',
      message: { type: 'join', participant: newParticipant },
    });

    // Mock: Point verification succeeds
    vi.mocked(ch.js_verify_point).mockReturnValue('true');

    // Mock: Ed448 signature verification succeeds
    vi.mocked(ch.js_verify_ed448).mockReturnValue('true');

    // Act: Process the join message
    await messageService.handleNewMessage(
      mockSelfAddress,
      mockKeyset,
      encryptedMessage,
      mockQueryClient
    );

    // Assert: Member was added
    expect(mockMessageDB.saveSpaceMember).toHaveBeenCalledWith(
      'space-123',
      expect.objectContaining({
        user_address: newParticipant.address,
        display_name: newParticipant.displayName,
        isKicked: false,
      })
    );

    // Assert: Ratchet state updated
    expect(mockMessageDB.saveEncryptionState).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'space-123/space-123',
        state: expect.stringContaining(newParticipant.id),
      }),
      true
    );

    // Assert: Join message created
    expect(mockMessageDB.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          type: 'join',
          senderId: newParticipant.address,
        }),
      })
    );
  });

  it('should reject join with invalid point verification', async () => {
    // ... similar setup
    vi.mocked(ch.js_verify_point).mockReturnValue('false');

    await messageService.handleNewMessage(/* ... */);

    // Assert: Member NOT added
    expect(mockMessageDB.saveSpaceMember).not.toHaveBeenCalled();
  });

  it('should reject join with invalid signature', async () => {
    // ... similar setup
    vi.mocked(ch.js_verify_ed448).mockReturnValue('false');

    await messageService.handleNewMessage(/* ... */);

    expect(mockMessageDB.saveSpaceMember).not.toHaveBeenCalled();
  });

  it('should update ratchet peer map with new member keys', async () => {
    // Test focuses on ratchet state structure
    // ... test implementation
  });
});
```

#### Sample Test: KICK Message
```typescript
describe('KICK message', () => {
  it('should handle self-kick: navigate away and cleanup', async () => {
    const mockNavigate = vi.fn();
    const encryptedMessage = {
      // ... kick message where self is kicked
      envelope: { type: 'control', message: { type: 'kick', kick: mockSelfAddress } },
    };

    // ... setup mocks for space data

    await messageService.handleNewMessage(/* ... */);

    // Assert: Navigation occurred
    expect(mockNavigate).toHaveBeenCalledWith(
      '/messages',
      expect.objectContaining({
        replace: true,
        state: expect.objectContaining({ from: 'kicked' }),
      })
    );

    // Assert: Space data cleaned up
    expect(mockMessageDB.deleteEncryptionState).toHaveBeenCalled();
    expect(mockMessageDB.deleteMessage).toHaveBeenCalled();
    expect(mockMessageDB.deleteSpaceMember).toHaveBeenCalled();
  });

  it('should handle other-user kick without cleanup', async () => {
    // Test kicking another user (not self)
    // Should create kick message but NOT navigate/cleanup
  });

  it('should verify owner signature before processing kick', async () => {
    vi.mocked(ch.js_verify_ed448).mockReturnValue('false');

    await messageService.handleNewMessage(/* ... */);

    expect(mockMessageDB.deleteSpaceMember).not.toHaveBeenCalled();
  });
});
```

---

### File 2: Sync Messages (CRITICAL)
**Path**: `src/dev/tests/messagedb/handleNewMessage.sync.test.tsx`
**Tests**: 10 tests
**Lines**: ~300 lines
**Time**: 2-3 hours

#### Coverage
- `sync-request` - Request sync (1 test)
- `sync-initiate` - Initiate sync (1 test)
- `sync-members` - Batch save members (2 tests)
- `sync-messages` - Batch save messages (3 tests)
- `sync-info` - Exchange metadata (1 test)
- `sync` - General sync (1 test)

#### Sample Test: SYNC-MEMBERS
```typescript
describe('SYNC-MEMBERS message', () => {
  it('should batch save space members', async () => {
    const members = [
      { address: 'user1', displayName: 'User 1', icon: 'icon1' },
      { address: 'user2', displayName: 'User 2', icon: 'icon2' },
    ];

    const encryptedMessage = {
      encryptedContent: JSON.stringify({
        envelope: JSON.stringify({
          type: 'control',
          message: { type: 'sync-members', members },
        }),
      }),
    };

    // ... setup mocks

    await messageService.handleNewMessage(/* ... */);

    // Assert: All members saved
    expect(mockMessageDB.saveSpaceMember).toHaveBeenCalledTimes(members.length);
    expect(mockMessageDB.saveSpaceMember).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ user_address: 'user1' })
    );
  });

  it('should verify member signatures in non-repudiable spaces', async () => {
    mockMessageDB.getSpace.mockResolvedValue({ isRepudiable: false });

    // ... test signature verification
  });
});
```

---

### File 3: Crypto Operations (CRITICAL - Security)
**Path**: `src/dev/tests/messagedb/handleNewMessage.crypto.test.tsx`
**Tests**: 12 tests
**Lines**: ~350 lines
**Time**: 3-4 hours

#### Coverage
- Ed448 signature verification (3 tests)
- Inbox address validation (2 tests)
- Message ID validation (2 tests)
- Ratchet state management (2 tests)
- Non-repudiable space handling (2 tests)

#### Sample Test: Signature Verification
```typescript
describe('Ed448 Signature Verification', () => {
  it('should accept valid Ed448 signatures', async () => {
    vi.mocked(ch.js_verify_ed448).mockReturnValue('true');

    const message = {
      publicKey: 'valid-key',
      signature: 'valid-sig',
      messageId: 'msg-id',
      content: { senderId: 'user-123', type: 'post' },
    };

    // ... process message

    expect(mockMessageDB.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: message.publicKey,
        signature: message.signature,
      })
    );
  });

  it('should reject invalid Ed448 signatures', async () => {
    vi.mocked(ch.js_verify_ed448).mockReturnValue('false');

    // ... process message

    // Assert: Signature stripped
    expect(mockMessageDB.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: undefined,
        signature: undefined,
      })
    );
  });

  it('should handle signature verification for different message types', async () => {
    // Test for post, join, update-profile
  });
});
```

---

### File 4: Error Handling (MODERATE)
**Path**: `src/dev/tests/messagedb/handleNewMessage.errors.test.tsx`
**Tests**: 8 tests
**Lines**: ~200 lines
**Time**: 2 hours

#### Coverage
```typescript
describe('handleNewMessage - Error Handling', () => {
  it('should handle malformed encrypted content gracefully')
  it('should handle decryption failures without crashing')
  it('should handle missing encryption state')
  it('should handle invalid envelope structure')
  it('should clean up inbox messages on failure')
  it('should not corrupt state on partial failures')
  it('should rollback on database errors')
  it('should handle WebSocket disconnection during processing')
});
```

---

### File 5: Envelope Processing (MODERATE)
**Path**: `src/dev/tests/messagedb/handleNewMessage.envelopes.test.tsx`
**Tests**: 8 tests
**Lines**: ~250 lines
**Time**: 2-3 hours

#### Coverage
```typescript
describe('handleNewMessage - Envelope Processing', () => {
  describe('Initialization Envelope', () => {
    it('should setup new conversation from init envelope')
  })

  describe('Direct Message - Sender Confirmation', () => {
    it('should confirm double ratchet sender session')
  })

  describe('Direct Message - Regular', () => {
    it('should decrypt regular direct message')
    it('should handle delete-conversation control message')
  })

  describe('Group Message Envelope', () => {
    it('should unseal group message envelope')
  })
});
```

---

## Test Setup Pattern

### Common Setup (All Test Files)
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { MessageService } from '@/services/MessageService';
import { channel, channel_raw } from '@quilibrium/quilibrium-js-sdk-channels';

// Mock external dependencies
vi.mock('@quilibrium/quilibrium-js-sdk-channels');
vi.mock('@/db/messages');
vi.mock('@/utils/crypto');

describe('handleNewMessage - [Test Category]', () => {
  let messageService: MessageService;
  let mockMessageDB: any;
  let mockQueryClient: QueryClient;
  let mockKeyset: any;
  let mockSelfAddress: string;

  beforeEach(() => {
    // Setup fixtures
    mockSelfAddress = 'self-address-123';
    mockKeyset = {
      userKeyset: {
        private_key: Buffer.from('mock-user-private', 'hex'),
        public_key: Buffer.from('mock-user-public', 'hex'),
      },
      deviceKeyset: {
        inbox_keyset: {
          inbox_address: 'inbox-address-123',
          inbox_encryption_key: { /* ... */ },
        },
        identity_key: { /* ... */ },
      },
    };

    // Mock MessageDB methods
    mockMessageDB = {
      getAllEncryptionStates: vi.fn(),
      saveEncryptionState: vi.fn(),
      getSpace: vi.fn(),
      saveSpaceMember: vi.fn(),
      saveMessage: vi.fn(),
      // ... other methods
    };

    // Create QueryClient
    mockQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    // Create MessageService with mocked dependencies
    messageService = new MessageService({
      messageDB: mockMessageDB,
      enqueueOutbound: vi.fn(),
      apiClient: {} as any,
      navigate: vi.fn(),
      // ... other dependencies
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Tests go here...
});
```

---

## Implementation Checklist

### Pre-Implementation
- [ ] Resolve import blocker (extract query keys)
- [ ] Review existing test utilities
- [ ] Set up test environment with TypeScript config

### Test File Creation
- [ ] File 1: Control Messages (15 tests, 3-4 hours)
- [ ] File 2: Sync Messages (10 tests, 2-3 hours)
- [ ] File 3: Crypto Operations (12 tests, 3-4 hours)
- [ ] File 4: Error Handling (8 tests, 2 hours)
- [ ] File 5: Envelope Processing (8 tests, 2-3 hours)

### Validation
- [ ] Run complete test suite: `yarn vitest src/dev/tests/messagedb/ --run`
- [ ] Verify ~100 tests passing (61 existing + 40-50 new)
- [ ] Fix any failing tests
- [ ] Commit: `git commit -m "Add comprehensive handleNewMessage test suite"`

---

## Success Criteria

✅ **Tests Complete When**:
1. All 5 test files created and passing
2. ~40-50 new tests added
3. Coverage includes all 13 control message types
4. Coverage includes all 8 sync message types
5. Signature verification tested
6. Encryption state management tested
7. Error paths tested
8. Tests run quickly (<15 seconds total)
9. Zero flaky tests

---

## Alternative: Snapshot Testing (Quick & Pragmatic)

If comprehensive tests are too time-consuming, use **snapshot tests** during incremental refactoring:

```typescript
// Quick test per handler (5 min each)
describe('handleJoinMessage', () => {
  it('should process join message correctly', async () => {
    const mockParams = createJoinMessageParams();
    const result = await messageService.handleJoinMessage(mockParams);
    expect(result).toMatchSnapshot(); // Baseline behavior
  });
});
```

**Pros**:
- Fast to create (5 min per handler)
- Catches regressions
- Works incrementally

**Cons**:
- Less explicit about what's tested
- Harder to debug failures
- Only catches changes, not bugs

---

## Related Files

- [Refactoring Plan](./messageservice-handlenewmessage-refactor.md) - Overall strategy and decision guide
- [Manual Test Guide](./test-manual_MessageService.md) - Manual testing procedures

---

_Last updated: 2025-12-16_
_Status: ⏸️ ON HOLD - Refactoring deprioritized, tests not needed_
_Import chain blocker: Unresolved (was estimated 30 min fix)_
_Total time estimate: 12-18 hours for comprehensive tests (if ever resumed)_
