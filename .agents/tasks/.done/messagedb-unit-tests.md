# CRITICAL: Improve MessageDB Test Coverage for Refactoring Safety

**Status**: IN PROGRESS
**Priority**: CRITICAL - BLOCKING Phase 4
**Complexity**: Medium
**Created**: 2025-10-02
**Updated**: 2025-10-02
**Dependencies**: Phase 2 Complete (all services extracted)

## Problem Statement

The current test suite (`src/dev/tests/`) provides **insufficient coverage** for safely validating the MessageDB refactoring. While 61 tests pass, they primarily test **mocks rather than implementation**, leaving critical gaps that could allow bugs to slip through during Phase 4 optimization.

### Current Test Limitations

#### 1. **Testing Mocks, Not Real Logic**
```typescript
// Current approach - just checks mock was called
expect(result.current.messageDB.saveMessage).toHaveBeenCalled();
```
**Problem**: Doesn't verify the message was actually saved, encrypted correctly, or that data integrity is maintained.

#### 2. **Hardcoded Behavior Assertions**
```typescript
const expectedBehavior = {
  encryptionApplied: true,  // ❌ Hardcoded to true!
  storedInDatabase: true,   // ❌ Not actually verified
  cacheUpdated: true,       // ❌ Not tested properly
};
```
**Problem**: These assertions always pass regardless of actual behavior.

#### 3. **Minimal Coverage of Complex Functions**
For `handleNewMessage` (1,324 lines with 15+ message types):
```typescript
const mockHandleNewMessage = vi.fn().mockImplementation(async (message) => {
  expect(message.type).toBe('POST_MESSAGE');
  return Promise.resolve();
});
```
**Problem**: Only 2 lines tested out of 1,324 lines of critical routing logic.

### What Current Tests Can/Cannot Catch

✅ **Can Catch:**
- Function signature changes
- Missing function calls
- Return type changes
- TypeScript compilation errors

❌ **Cannot Catch:**
- Logic errors in extracted code
- Data corruption issues
- State management bugs
- Encryption/decryption failures
- Race conditions
- Message routing errors
- Cache synchronization issues
- IndexedDB transaction errors

## Risk Assessment

### Severity: **CRITICAL**

Without comprehensive tests, Phase 4 optimization could introduce:
- **Data Loss**: Messages not saved correctly
- **Encryption Failures**: Messages readable by unintended parties
- **State Corruption**: React Query cache out of sync with DB
- **Message Routing Errors**: Messages sent to wrong recipients
- **Performance Regressions**: Undetected slowdowns
- **Race Conditions**: Concurrent operations corrupting data

**Confidence Level for Current Refactoring**: 🔴 **LOW (~30%)**

We need: 🟢 **HIGH (~90%+)** confidence before Phase 4 optimization.

---

## Solution: Behavior Verification Tests (Unit Tests with Spies)

### Strategy: Simple Unit Tests Without Complex Integration

**Lead Dev Requirement**: Create "unit tests" to validate refactoring

**What Are Unit Tests?**
Unit tests verify individual functions in isolation using mocks and spies. Instead of testing with real databases, we:
- Use **mocks** for dependencies (database, query client, WebSocket)
- Use **spies** (vi.fn()) to verify function calls and parameters
- Test **behavior** rather than implementation details
- Keep tests **fast** and **simple**

**Critical Constraint**: Prefer NOT changing app code to enable tests.

### Approach Comparison

#### ❌ Integration Tests (Too Complex - ABANDONED)
```typescript
// Uses real IndexedDB (fake-indexeddb), real encryption, real everything
const messageDB = await createRealDB(); // Complex setup
await messageService.submitMessage(...); // Real operations
const message = await messageDB.getMessage(...); // Real query
expect(message).toBeDefined(); // Verify actual DB state
```
**Problems**: Complex setup, fake-indexeddb issues, slow, hard to debug

#### ✅ Unit Tests (Simple - NEW APPROACH)
```typescript
// Uses mocks and spies
const messageDB = { saveMessage: vi.fn(), getMessage: vi.fn() };
await messageService.submitMessage(...);
expect(messageDB.saveMessage).toHaveBeenCalledWith(
  expect.objectContaining({
    messageId: expect.any(String),
    content: 'Test message',
    encrypted: true,
  })
);
```
**Benefits**: Simple, fast, easy to debug, no complex dependencies

---

## Implementation Plan

### Phase 1: MessageService Unit Tests

**File**: `src/dev/tests/services/MessageService.unit.test.tsx`

#### Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from '@/services/MessageService';

describe('MessageService - Unit Tests', () => {
  let messageService: MessageService;
  let mockDeps: any;

  beforeEach(() => {
    // Setup mocks for all dependencies
    mockDeps = {
      messageDB: {
        saveMessage: vi.fn().mockResolvedValue(undefined),
        getMessage: vi.fn().mockResolvedValue(null),
        getMessages: vi.fn().mockResolvedValue({ messages: [] }),
        deleteMessagesForConversation: vi.fn().mockResolvedValue(undefined),
      },
      queryClient: {
        setQueryData: vi.fn(),
        getQueryData: vi.fn().mockReturnValue(null),
        invalidateQueries: vi.fn(),
      },
      enqueueOutbound: vi.fn(),
      addOrUpdateConversation: vi.fn(),
      updateLastMessage: vi.fn(),
    };

    // Create service with mocked dependencies
    messageService = new MessageService(mockDeps);
  });

  describe('1. submitMessage() - P2P Message Submission', () => {
    it('should call saveMessage with correct parameters', async () => {
      const messageContent = 'Test message';
      const selfAddress = 'address-self';
      const counterpartyAddress = 'address-counterparty';

      const mockRegistration = {
        address: selfAddress,
        pubkey: 'pubkey-self',
      };

      const mockCounterpartyRegistration = {
        address: counterpartyAddress,
        pubkey: 'pubkey-counterparty',
      };

      const mockPasskeyInfo = {
        passkey: { identityKey: 'key' },
        address: selfAddress,
      };

      const mockKeyset = {
        userKeyset: { privateKey: 'privkey' },
        deviceKeyset: { privateKey: 'devkey' },
      };

      // Execute
      await messageService.submitMessage(
        selfAddress,
        messageContent,
        mockRegistration,
        mockCounterpartyRegistration,
        mockDeps.queryClient,
        mockPasskeyInfo,
        mockKeyset
      );

      // ✅ VERIFY: saveMessage called with correct structure
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: expect.any(String),
          spaceId: selfAddress,
          channelId: counterpartyAddress,
          content: expect.objectContaining({
            senderId: selfAddress,
            type: 'post',
            text: messageContent,
          }),
          encrypted: true,
          encryptedContent: expect.any(String),
        })
      );

      // ✅ VERIFY: queryClient updated
      expect(mockDeps.queryClient.setQueryData).toHaveBeenCalled();

      // ✅ VERIFY: WebSocket enqueue called
      expect(mockDeps.enqueueOutbound).toHaveBeenCalled();
    });

    it('should link reply messages correctly', async () => {
      const replyToMessageId = 'msg-original';

      await messageService.submitMessage(
        'address',
        'Reply text',
        mockRegistration,
        mockRegistration,
        mockDeps.queryClient,
        mockPasskeyInfo,
        mockKeyset,
        replyToMessageId // Reply parameter
      );

      // ✅ VERIFY: Reply linkage in message
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            replyTo: replyToMessageId,
          }),
        })
      );
    });

    it('should handle encryption errors gracefully', async () => {
      // Mock encryption failure
      const badKeyset = null;

      // ✅ VERIFY: Throws error on encryption failure
      await expect(
        messageService.submitMessage(
          'address',
          'message',
          mockRegistration,
          mockRegistration,
          mockDeps.queryClient,
          mockPasskeyInfo,
          badKeyset
        )
      ).rejects.toThrow();

      // ✅ VERIFY: saveMessage NOT called on failure
      expect(mockDeps.messageDB.saveMessage).not.toHaveBeenCalled();
    });
  });

  describe('2. handleNewMessage() - Message Routing', () => {
    it('should route POST_MESSAGE type correctly', async () => {
      const incomingMessage = {
        type: 'POST_MESSAGE',
        messageId: 'msg-123',
        content: {
          senderId: 'sender',
          type: 'post',
          text: 'Hello',
        },
        spaceId: 'space-123',
        channelId: 'channel-123',
        createdDate: Date.now(),
        modifiedDate: Date.now(),
      };

      await messageService.handleNewMessage(
        incomingMessage,
        'self-address',
        mockKeyset,
        mockDeps.queryClient
      );

      // ✅ VERIFY: Message saved to DB
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-123',
          spaceId: 'space-123',
          channelId: 'channel-123',
        })
      );

      // ✅ VERIFY: Cache updated
      expect(mockDeps.queryClient.setQueryData).toHaveBeenCalled();
    });

    it('should route REACTION_MESSAGE type correctly', async () => {
      const reactionMessage = {
        type: 'REACTION_MESSAGE',
        messageId: 'reaction-123',
        content: {
          senderId: 'sender',
          type: 'reaction',
          emoji: '👍',
          targetMessageId: 'msg-456',
        },
        spaceId: 'space-123',
        channelId: 'channel-123',
        createdDate: Date.now(),
        modifiedDate: Date.now(),
      };

      await messageService.handleNewMessage(
        reactionMessage,
        'self-address',
        mockKeyset,
        mockDeps.queryClient
      );

      // ✅ VERIFY: Reaction saved
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            type: 'reaction',
            emoji: '👍',
          }),
        })
      );
    });

    it('should route REMOVE_MESSAGE type correctly', async () => {
      const removeMessage = {
        type: 'REMOVE_MESSAGE',
        messageId: 'remove-123',
        content: {
          senderId: 'sender',
          type: 'remove',
          targetMessageId: 'msg-to-remove',
        },
        spaceId: 'space-123',
        channelId: 'channel-123',
        createdDate: Date.now(),
        modifiedDate: Date.now(),
      };

      await messageService.handleNewMessage(
        removeMessage,
        'self-address',
        mockKeyset,
        mockDeps.queryClient
      );

      // ✅ VERIFY: Remove message handled
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalled();
    });

    it('should handle all message types without throwing', async () => {
      const messageTypes = [
        'POST_MESSAGE',
        'REACTION_MESSAGE',
        'REMOVE_MESSAGE',
        'JOIN_MESSAGE',
        'LEAVE_MESSAGE',
        'KICK_MESSAGE',
        'UPDATE_PROFILE_MESSAGE',
      ];

      for (const type of messageTypes) {
        const message = {
          type,
          messageId: `msg-${type}`,
          content: { senderId: 'sender', type: type.toLowerCase() },
          spaceId: 'space',
          channelId: 'channel',
          createdDate: Date.now(),
          modifiedDate: Date.now(),
        };

        // ✅ VERIFY: No errors thrown for any message type
        await expect(
          messageService.handleNewMessage(message, 'self', mockKeyset, mockDeps.queryClient)
        ).resolves.not.toThrow();
      }
    });
  });

  describe('3. addMessage() - Message Creation', () => {
    it('should create message with all required fields', async () => {
      const message = await messageService.addMessage(
        'Test message',
        'sender-address',
        'space-123',
        'channel-123',
        mockKeyset
      );

      // ✅ VERIFY: Message structure
      expect(message.messageId).toBeDefined();
      expect(message.content.text).toBe('Test message');
      expect(message.content.senderId).toBe('sender-address');
      expect(message.spaceId).toBe('space-123');
      expect(message.channelId).toBe('channel-123');
      expect(message.createdDate).toBeGreaterThan(0);
    });
  });

  describe('4. saveMessage() - Database Persistence', () => {
    it('should call messageDB.saveMessage with correct parameters', async () => {
      const testMessage = {
        messageId: 'msg-123',
        content: { type: 'post', text: 'Hello' },
        spaceId: 'space',
        channelId: 'channel',
        createdDate: Date.now(),
        modifiedDate: Date.now(),
      };

      await messageService.saveMessage(testMessage);

      // ✅ VERIFY: saveMessage called
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalledWith(testMessage);
    });
  });

  describe('5. deleteConversation() - Message Deletion', () => {
    it('should delete messages from specific conversation', async () => {
      const spaceId = 'space-123';
      const channelId = 'channel-123';

      await messageService.deleteConversation(spaceId, channelId, mockDeps.queryClient);

      // ✅ VERIFY: Delete called with correct conversationId
      expect(mockDeps.messageDB.deleteMessagesForConversation).toHaveBeenCalledWith(
        `${spaceId}/${channelId}`
      );

      // ✅ VERIFY: Cache invalidated
      expect(mockDeps.queryClient.invalidateQueries).toHaveBeenCalled();
    });
  });
});
```

**Test Count**: ~15 tests covering core MessageService functions

---

### Phase 2: SpaceService Unit Tests

**File**: `src/dev/tests/services/SpaceService.unit.test.tsx`

#### Coverage Areas:
- ✅ `createSpace()` - Verifies space structure, default channel creation, member addition
- ✅ `updateSpace()` - Verifies space update parameters
- ✅ `deleteSpace()` - Verifies deletion method calls
- ✅ `kickUser()` - Verifies kick message creation and member removal
- ✅ `createChannel()` - Verifies channel creation and space update

**Test Count**: ~10 tests

---

### Phase 3: InvitationService Unit Tests

**File**: `src/dev/tests/services/InvitationService.unit.test.tsx`

#### Coverage Areas:
- ✅ `generateNewInviteLink()` - Verifies invite structure and encryption flag
- ✅ `processInviteLink()` - Verifies invite validation logic
- ✅ `joinInviteLink()` - Verifies join workflow parameters
- ✅ Invalid invite handling
- ✅ Expired invite handling

**Test Count**: ~10 tests

---

### Phase 4: SyncService Unit Tests

**File**: `src/dev/tests/services/SyncService.unit.test.tsx`

#### Coverage Areas:
- ✅ `requestSync()` - Verifies sync request parameters
- ✅ `synchronizeAll()` - Verifies all spaces are processed
- ✅ `initiateSync()` - Verifies sync initiation
- ✅ `directSync()` - Verifies direct sync parameters

**Test Count**: ~8 tests

---

### Phase 5: EncryptionService Unit Tests

**File**: `src/dev/tests/services/EncryptionService.unit.test.tsx`

#### Coverage Areas:
- ✅ `ensureKeyForSpace()` - Verifies key generation or retrieval
- ✅ `deleteEncryptionStates()` - Verifies encryption state cleanup

**Test Count**: ~5 tests

---

### Phase 6: ConfigService Unit Tests

**File**: `src/dev/tests/services/ConfigService.unit.test.tsx`

#### Coverage Areas:
- ✅ `getConfig()` - Verifies config retrieval
- ✅ `saveConfig()` - Verifies config saving
- ✅ Default config handling

**Test Count**: ~5 tests

---

## Test Coverage Goals

### Quantitative Targets
- **Total Tests**: 50+ unit tests (down from 240+ integration tests)
- **Service Coverage**: 100% of exported service functions tested
- **Execution Time**: <5 seconds for full suite (vs <30s for integration tests)

### Qualitative Targets
- ✅ All service functions called correctly
- ✅ All parameters passed correctly
- ✅ All side effects verified (DB saves, cache updates, WebSocket calls)
- ✅ Error handling verified (throws errors when expected)
- ✅ Fast and deterministic (no flaky tests)

---

## Success Criteria

### Test Suite Completion
- [ ] Phase 1: MessageService unit tests (~15 tests)
- [ ] Phase 2: SpaceService unit tests (~10 tests)
- [ ] Phase 3: InvitationService unit tests (~10 tests)
- [ ] Phase 4: SyncService unit tests (~8 tests)
- [ ] Phase 5: EncryptionService unit tests (~5 tests)
- [ ] Phase 6: ConfigService unit tests (~5 tests)

### Quality Gates
- [ ] **All tests pass**: 100% pass rate
- [ ] **No app code changes**: Tests work with existing code
- [ ] **Fast execution**: Full suite runs in <5 seconds
- [ ] **Clear failures**: Test failures clearly indicate root cause
- [ ] **No TypeScript errors**: All test files compile cleanly

### Validation Criteria
- [ ] Tests verify function calls happen (using vi.fn())
- [ ] Tests verify correct parameters passed (using expect.objectContaining)
- [ ] Tests verify side effects (DB saves, cache updates, WebSocket calls)
- [ ] Tests handle error scenarios (using rejects.toThrow)

---

## Advantages of Unit Tests Over Integration Tests

### ✅ Simpler
- No complex fake-indexeddb setup
- No IDBKeyRange errors
- No database cleanup issues
- Just mocks and spies

### ✅ Faster
- No real database operations
- No encryption operations
- No async waiting
- Tests run in milliseconds

### ✅ Easier to Debug
- Clear expectations (vi.fn() calls)
- Simple assertions
- No complex state to track
- Fast feedback loop

### ✅ More Maintainable
- Tests focus on behavior, not implementation
- Less brittle (don't break on internal changes)
- Easy to understand and modify

---

## What Unit Tests Can/Cannot Catch

### ✅ Can Catch:
- Function not called
- Wrong parameters passed
- Missing side effects (DB save, cache update, WebSocket call)
- Error handling missing
- Logic flow errors (if/else branches)
- Return value errors

### ❌ Cannot Catch:
- Real database corruption (but we trust MessageDB is tested separately)
- Real encryption failures (but we trust SDK is tested separately)
- Real IndexedDB quota issues (but this is rare)
- Real race conditions (but we can test with concurrent calls)

### 💡 Philosophy:
We trust that:
- MessageDB class works correctly (it's tested separately)
- Encryption SDK works correctly (it's maintained by Quilibrium team)
- IndexedDB browser API works correctly (it's a web standard)

We test that:
- Services call the right methods
- Services pass the right parameters
- Services handle errors correctly
- Services update state correctly

---

## Execution Timeline

### Estimated Effort: 6-8 hours (vs 16-24 hours for integration tests)

**Phase 1: MessageService Tests** (2 hours)
- Setup test structure
- Write 15 unit tests

**Phase 2-6: Other Service Tests** (4 hours)
- SpaceService (1 hour)
- InvitationService (1 hour)
- SyncService (1 hour)
- EncryptionService (30 minutes)
- ConfigService (30 minutes)

**Cleanup & Validation** (1 hour)
- Fix TypeScript errors
- Run full suite
- Validate tests catch injected bugs

---

## Post-Implementation Validation

### How to Validate Test Quality

1. **Remove Function Call**
   ```typescript
   // In MessageService.ts, comment out DB save:
   async submitMessage(...) {
     // await this.messageDB.saveMessage(message); // COMMENTED OUT
   }

   // Test should fail: ✅ "Expected saveMessage to be called but was not"
   ```

2. **Pass Wrong Parameters**
   ```typescript
   // In MessageService.ts, pass wrong spaceId:
   async submitMessage(...) {
     await this.messageDB.saveMessage({
       ...message,
       spaceId: 'WRONG_ID', // INTENTIONAL BUG
     });
   }

   // Test should fail: ✅ "Expected spaceId to be 'space-123' but got 'WRONG_ID'"
   ```

3. **Skip Error Handling**
   ```typescript
   // In MessageService.ts, remove try/catch:
   async submitMessage(...) {
     // try {
       await this.encrypt(message);
     // } catch (error) {
     //   throw new Error('Encryption failed');
     // }
   }

   // Test should fail: ✅ "Expected to throw but did not"
   ```

### Expected Results
- ✅ Tests fail when function calls are missing
- ✅ Tests fail when parameters are wrong
- ✅ Tests fail when error handling is missing
- ✅ Clear failure messages indicating exact problem

---

## Final Confidence Level

**Current**: 🔴 LOW (30%) - Mock tests with no real verification
**After Unit Tests**: 🟡 MEDIUM-HIGH (70-80%) - Behavior verified with spies
**Note**: Not as high as integration tests (90%+), but much faster to implement and maintain

This unit test suite will provide **sufficient confidence** that:
- ✅ Services call correct methods
- ✅ Services pass correct parameters
- ✅ Services handle errors properly
- ✅ Services update state correctly
- ✅ Fast feedback (<5 seconds)
- ✅ Easy to maintain

**Phase 4 optimization can proceed with reasonable confidence using this test coverage.**

---

## Notes

- Tests must be **fast** (<5s total) for rapid feedback
- Tests must be **deterministic** (no flaky tests)
- Tests must be **clear** (obvious what failed and why)
- Tests must be **maintainable** (simple mocks and spies)
- Tests focus on **behavior** (what functions do) not **implementation** (how they do it)

---

_Last updated: 2025-10-02_
