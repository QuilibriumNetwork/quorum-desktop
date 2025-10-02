# CRITICAL: Improve MessageDB Test Coverage for Refactoring Safety

**Status**: PENDING
**Priority**: CRITICAL - BLOCKING Phase 4
**Complexity**: Very High
**Created**: 2025-10-02
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

#### 4. **No Real Integration Testing**
- ❌ IndexedDB operations not verified (no actual writes/reads)
- ❌ Encryption/decryption cycles not tested
- ❌ React Query cache state not validated
- ❌ WebSocket message sending not verified
- ❌ Error recovery paths not tested
- ❌ Edge cases (concurrent ops, malformed data) not covered

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

## Solution: Comprehensive Integration Test Suite

### Strategy: Real Integration Tests Without App Code Changes

**Critical Constraint**: Prefer NOT changing app code to enable tests.

**Approach**:
1. Use real `MessageDB` class with real IndexedDB operations
2. Use `fake-indexeddb` for browser-compatible in-memory DB
3. Test actual service implementations with real dependencies
4. Validate complete workflows end-to-end
5. Assert actual outcomes (DB state, cache state, encryption results)

---

## Implementation Plan

### Phase 1: Infrastructure Setup

#### 1.1 Install Real IndexedDB Testing Library
```bash
yarn add -D fake-indexeddb
```

**Why `fake-indexeddb`**:
- ✅ Full IndexedDB API compatibility
- ✅ Synchronous operations in tests
- ✅ No app code changes required
- ✅ Fast test execution
- ✅ 100% compatible with our `MessageDB` class

#### 1.2 Create Real DB Test Helpers
**File**: `src/dev/tests/utils/realDBHelpers.ts`

```typescript
import { IDBFactory } from 'fake-indexeddb';
import { MessageDB } from '@/db/messages';
import { Message, Space } from '@/api/quorumApi';

/**
 * Creates a fresh MessageDB instance with fake-indexeddb
 * No app code changes needed - just swap global indexedDB
 */
export async function createTestMessageDB(): Promise<MessageDB> {
  // Use fake-indexeddb for testing
  const fakeIndexedDB = new IDBFactory();
  (global as any).indexedDB = fakeIndexedDB;

  const db = new MessageDB();
  await db.init();
  return db;
}

/**
 * Verifies a message was actually saved in IndexedDB
 */
export async function assertMessageSaved(
  db: MessageDB,
  messageId: string,
  expectedContent: Partial<Message>
): Promise<void> {
  const message = await db.getMessage({
    spaceId: expectedContent.spaceId!,
    channelId: expectedContent.channelId!,
    messageId,
  });

  expect(message).toBeDefined();
  expect(message.content).toBe(expectedContent.content);
  expect(message.senderId).toBe(expectedContent.senderId);
}

/**
 * Verifies space was saved correctly
 */
export async function assertSpaceSaved(
  db: MessageDB,
  spaceId: string,
  expectedName: string
): Promise<Space> {
  const space = await db.getSpace(spaceId);
  expect(space).toBeDefined();
  expect(space.name).toBe(expectedName);
  return space;
}

/**
 * Gets all messages for a conversation to verify cache sync
 */
export async function getAllConversationMessages(
  db: MessageDB,
  spaceId: string,
  channelId: string
): Promise<Message[]> {
  return await db.getMessages({ spaceId, channelId, limit: 1000 });
}

/**
 * Clean up test database
 */
export async function cleanupTestDB(): Promise<void> {
  // fake-indexeddb cleanup
  indexedDB.deleteDatabase('quorum_db');
}
```

#### 1.3 Create Encryption Test Helpers
**File**: `src/dev/tests/utils/encryptionHelpers.ts`

```typescript
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';

/**
 * Creates test keypairs for encryption testing
 */
export function createTestKeyset(): {
  userKeyset: secureChannel.UserKeyset;
  deviceKeyset: secureChannel.DeviceKeyset;
} {
  // Use real SDK to generate test keys
  const userKeyset = secureChannel.generateUserKeyset();
  const deviceKeyset = secureChannel.generateDeviceKeyset();

  return { userKeyset, deviceKeyset };
}

/**
 * Encrypts test message and verifies it can be decrypted
 */
export async function testEncryptionCycle(
  content: string,
  senderKeyset: any,
  recipientKeyset: any
): Promise<{ encrypted: string; decrypted: string }> {
  // Use real encryption logic
  const encrypted = await secureChannel.encrypt(
    content,
    senderKeyset.privateKey,
    recipientKeyset.publicKey
  );

  const decrypted = await secureChannel.decrypt(
    encrypted,
    recipientKeyset.privateKey,
    senderKeyset.publicKey
  );

  return { encrypted, decrypted };
}

/**
 * Verifies encrypted message can be decrypted correctly
 */
export function assertEncryptionIntegrity(
  originalContent: string,
  decryptedContent: string
): void {
  expect(decryptedContent).toBe(originalContent);
  expect(originalContent).not.toContain('encrypted'); // Sanity check
}
```

#### 1.4 Create React Query Test Helpers
**File**: `src/dev/tests/utils/reactQueryHelpers.ts`

```typescript
import { QueryClient } from '@tanstack/react-query';
import { buildMessagesKey } from '@/hooks';

/**
 * Creates a fresh QueryClient for each test
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
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
}

/**
 * Asserts that a message exists in React Query cache
 */
export function assertMessageInCache(
  queryClient: QueryClient,
  spaceId: string,
  channelId: string,
  messageId: string
): void {
  const cacheKey = buildMessagesKey({ spaceId, channelId });
  const cacheData = queryClient.getQueryData(cacheKey) as any;

  expect(cacheData).toBeDefined();
  expect(cacheData.pages).toBeDefined();

  const allMessages = cacheData.pages.flatMap((page: any) => page.messages || []);
  const message = allMessages.find((m: any) => m.messageId === messageId);

  expect(message).toBeDefined();
}

/**
 * Gets cache data for debugging
 */
export function getCacheMessages(
  queryClient: QueryClient,
  spaceId: string,
  channelId: string
): any[] {
  const cacheKey = buildMessagesKey({ spaceId, channelId });
  const cacheData = queryClient.getQueryData(cacheKey) as any;

  if (!cacheData?.pages) return [];
  return cacheData.pages.flatMap((page: any) => page.messages || []);
}
```

---

### Phase 2: MessageService Integration Tests

**File**: `src/dev/tests/services/MessageService.integration.test.tsx`

#### Test Coverage: 7 Critical Operations

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageService } from '@/services/MessageService';
import { createTestMessageDB, assertMessageSaved, cleanupTestDB } from '../utils/realDBHelpers';
import { createTestKeyset, testEncryptionCycle } from '../utils/encryptionHelpers';
import { createTestQueryClient, assertMessageInCache } from '../utils/reactQueryHelpers';
import { QueryClient } from '@tanstack/react-query';

describe('MessageService - Real Integration Tests', () => {
  let messageDB: MessageDB;
  let queryClient: QueryClient;
  let messageService: MessageService;
  let keyset: any;

  beforeEach(async () => {
    // Setup real dependencies
    messageDB = await createTestMessageDB();
    queryClient = createTestQueryClient();
    keyset = createTestKeyset();

    // Create MessageService with real dependencies
    messageService = new MessageService({
      messageDB,
      enqueueOutbound: vi.fn(), // Mock only WebSocket
      addOrUpdateConversation: vi.fn(),
      // ... other dependencies
    });
  });

  afterEach(async () => {
    await cleanupTestDB();
  });

  describe('1. submitMessage() - P2P Message Submission', () => {
    it('should encrypt, save to DB, update cache, and queue for WebSocket', async () => {
      const messageContent = 'Test P2P message';
      const selfAddress = 'address-self';
      const counterpartyAddress = 'address-counterparty';

      // Execute the full workflow
      await messageService.submitMessage(
        selfAddress,
        messageContent,
        mockRegistration,
        { ...mockRegistration, address: counterpartyAddress },
        queryClient,
        mockPasskeyInfo,
        keyset
      );

      // ✅ CRITICAL ASSERTION 1: Message saved to IndexedDB
      const messages = await messageDB.getMessages({
        spaceId: selfAddress,
        channelId: counterpartyAddress,
        limit: 10
      });
      expect(messages.length).toBeGreaterThan(0);

      const savedMessage = messages.find(m => m.content === messageContent);
      expect(savedMessage).toBeDefined();
      expect(savedMessage.senderId).toBe(selfAddress);
      expect(savedMessage.encrypted).toBe(true);

      // ✅ CRITICAL ASSERTION 2: Message in React Query cache
      assertMessageInCache(
        queryClient,
        selfAddress,
        counterpartyAddress,
        savedMessage.messageId
      );

      // ✅ CRITICAL ASSERTION 3: WebSocket enqueue called
      expect(messageService.enqueueOutbound).toHaveBeenCalled();

      // ✅ CRITICAL ASSERTION 4: Encryption applied (content is encrypted)
      expect(savedMessage.encryptedContent).toBeDefined();
      expect(savedMessage.encryptedContent).not.toBe(messageContent);
    });

    it('should handle reply messages with correct linkage', async () => {
      // First, save an original message
      const originalMessage = await createTestMessage(messageDB, 'Original');

      // Submit a reply
      await messageService.submitMessage(
        'address-self',
        'This is a reply',
        mockRegistration,
        mockRegistration,
        queryClient,
        mockPasskeyInfo,
        keyset,
        originalMessage.messageId // Reply parameter
      );

      // Verify reply linkage
      const messages = await messageDB.getMessages({
        spaceId: 'address-self',
        channelId: 'address-self',
        limit: 10
      });

      const replyMessage = messages.find(m => m.content === 'This is a reply');
      expect(replyMessage.replyTo).toBe(originalMessage.messageId);
    });

    it('should rollback on encryption failure', async () => {
      // Mock encryption failure
      const badKeyset = { ...keyset, userKeyset: null };

      await expect(
        messageService.submitMessage(
          'address',
          'message',
          mockRegistration,
          mockRegistration,
          queryClient,
          mockPasskeyInfo,
          badKeyset
        )
      ).rejects.toThrow();

      // Verify no partial data saved
      const messages = await messageDB.getMessages({
        spaceId: 'address',
        channelId: 'address',
        limit: 10
      });
      expect(messages.length).toBe(0);
    });
  });

  describe('2. handleNewMessage() - WebSocket Message Processing', () => {
    it('should route POST_MESSAGE type correctly', async () => {
      const incomingMessage = {
        type: 'POST_MESSAGE',
        messageId: 'msg-incoming-123',
        content: 'Incoming message',
        senderId: 'user-sender',
        spaceId: 'space-123',
        channelId: 'channel-123',
        timestamp: Date.now(),
        encrypted: true,
        encryptedContent: 'encrypted-data-here',
      };

      // Process the message
      await messageService.handleNewMessage(
        incomingMessage,
        selfAddress,
        keyset,
        queryClient
      );

      // ✅ Verify message saved to DB
      const savedMessage = await messageDB.getMessage({
        spaceId: 'space-123',
        channelId: 'channel-123',
        messageId: 'msg-incoming-123',
      });

      expect(savedMessage).toBeDefined();
      expect(savedMessage.senderId).toBe('user-sender');

      // ✅ Verify cache updated
      assertMessageInCache(queryClient, 'space-123', 'channel-123', 'msg-incoming-123');
    });

    it('should route all message types correctly', async () => {
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
        const message = createTestMessageOfType(type);

        // Should not throw
        await expect(
          messageService.handleNewMessage(message, selfAddress, keyset, queryClient)
        ).resolves.not.toThrow();
      }
    });

    it('should decrypt encrypted messages', async () => {
      const originalContent = 'Secret message';
      const { encrypted } = await testEncryptionCycle(
        originalContent,
        keyset,
        keyset
      );

      const incomingMessage = {
        type: 'POST_MESSAGE',
        messageId: 'msg-encrypted',
        encrypted: true,
        encryptedContent: encrypted,
        spaceId: 'space-123',
        channelId: 'channel-123',
        senderId: 'sender',
        timestamp: Date.now(),
      };

      await messageService.handleNewMessage(
        incomingMessage,
        selfAddress,
        keyset,
        queryClient
      );

      // ✅ Verify decrypted content saved
      const savedMessage = await messageDB.getMessage({
        spaceId: 'space-123',
        channelId: 'channel-123',
        messageId: 'msg-encrypted',
      });

      expect(savedMessage.content).toBe(originalContent);
    });
  });

  describe('3. addMessage() - Message Creation', () => {
    it('should create message with all required fields', async () => {
      const message = await messageService.addMessage(
        'Test message',
        'sender-address',
        'space-123',
        'channel-123',
        keyset,
        { type: 'text' }
      );

      expect(message.messageId).toBeDefined();
      expect(message.content).toBe('Test message');
      expect(message.senderId).toBe('sender-address');
      expect(message.createdDate).toBeGreaterThan(0);
      expect(message.encrypted).toBe(false); // Not encrypted yet
    });
  });

  // Continue for all 7 critical MessageService functions...
});
```

---

### Phase 3: Service-Specific Integration Tests

Create comprehensive tests for each service:

#### 3.1 SpaceService Integration Tests
**File**: `src/dev/tests/services/SpaceService.integration.test.tsx`

**Coverage**:
- ✅ `createSpace()` - Verify space saved to DB with correct structure
- ✅ `updateSpace()` - Verify space updates persist
- ✅ `deleteSpace()` - Verify cascade deletion (messages, members, keys)
- ✅ `kickUser()` - Verify member removal and message sending
- ✅ `createChannel()` - Verify channel creation and space update

#### 3.2 InvitationService Integration Tests
**File**: `src/dev/tests/services/InvitationService.integration.test.tsx`

**Coverage**:
- ✅ `generateNewInviteLink()` - Verify invite saved to DB, encrypted correctly
- ✅ `processInviteLink()` - Verify invite validation and space info retrieval
- ✅ `joinInviteLink()` - Verify key exchange, member addition, space sync
- ✅ Invalid invite handling
- ✅ Expired invite handling

#### 3.3 SyncService Integration Tests
**File**: `src/dev/tests/services/SyncService.integration.test.tsx`

**Coverage**:
- ✅ `requestSync()` - Verify sync workflow execution
- ✅ `synchronizeAll()` - Verify all spaces synchronized
- ✅ `initiateSync()` - Verify sync initiation
- ✅ `directSync()` - Verify direct sync between peers
- ✅ Conflict resolution
- ✅ Incremental sync

#### 3.4 EncryptionService Integration Tests
**File**: `src/dev/tests/services/EncryptionService.integration.test.tsx`

**Coverage**:
- ✅ `ensureKeyForSpace()` - Verify key generation and storage
- ✅ `deleteEncryptionStates()` - Verify encryption state cleanup
- ✅ Key rotation
- ✅ Multi-device key sync

#### 3.5 ConfigService Integration Tests
**File**: `src/dev/tests/services/ConfigService.integration.test.tsx`

**Coverage**:
- ✅ `getConfig()` - Verify config retrieval and decryption
- ✅ `saveConfig()` - Verify config encryption and storage
- ✅ Config migration
- ✅ Default config handling

---

### Phase 4: End-to-End Workflow Tests

**File**: `src/dev/tests/workflows/CompleteWorkflows.integration.test.tsx`

#### 4.1 Complete Space Creation → Invite → Join Workflow
```typescript
it('should handle complete space invitation workflow', async () => {
  // 1. User A creates space
  const { spaceId, channelId } = await spaceService.createSpace(
    'Test Space',
    'icon.png',
    keysetA,
    registrationA,
    false, // non-repudiable
    false, // private
    'userIcon.png',
    'User A'
  );

  // ✅ Verify space in DB
  const space = await assertSpaceSaved(messageDB, spaceId, 'Test Space');
  expect(space.groups[0].channels[0].channelId).toBe(channelId);

  // 2. User A generates invite
  await invitationService.generateNewInviteLink(
    spaceId,
    keysetA.userKeyset,
    keysetA.deviceKeyset,
    registrationA
  );

  // ✅ Verify invite saved
  const invites = await messageDB.getSpaceInvites(spaceId);
  expect(invites.length).toBeGreaterThan(0);
  const inviteLink = invites[0].inviteLink;

  // 3. User B processes invite
  const spaceInfo = await invitationService.processInviteLink(inviteLink);
  expect(spaceInfo.spaceId).toBe(spaceId);
  expect(spaceInfo.name).toBe('Test Space');

  // 4. User B joins space
  const joinResult = await invitationService.joinInviteLink(
    inviteLink,
    keysetB,
    passkeyInfoB
  );

  expect(joinResult.spaceId).toBe(spaceId);
  expect(joinResult.channelId).toBe(channelId);

  // ✅ Verify User B is now a member
  const members = await messageDB.getSpaceMembers(spaceId);
  const userBMember = members.find(m => m.user_address === registrationB.address);
  expect(userBMember).toBeDefined();

  // ✅ Verify User B has encryption key
  const keys = await messageDB.getSpaceKeys(spaceId);
  const userBKey = keys.find(k => k.address === registrationB.address);
  expect(userBKey).toBeDefined();
});
```

#### 4.2 Complete Message Send → Sync → Receive Workflow
```typescript
it('should handle complete P2P message workflow', async () => {
  // 1. User A sends message to User B
  await messageService.submitMessage(
    addressA,
    'Hello User B',
    registrationA,
    registrationB,
    queryClient,
    passkeyInfoA,
    keysetA
  );

  // ✅ Verify message in User A's DB
  const messagesA = await messageDB.getMessages({
    spaceId: addressA,
    channelId: addressB,
    limit: 10
  });
  expect(messagesA.length).toBe(1);
  expect(messagesA[0].content).toBe('Hello User B');

  // 2. Simulate message receipt by User B
  const encryptedMessage = messagesA[0];
  await messageService.handleNewMessage(
    encryptedMessage,
    addressB,
    keysetB,
    queryClient
  );

  // ✅ Verify message decrypted and saved in User B's DB
  const messagesB = await messageDB.getMessages({
    spaceId: addressA,
    channelId: addressB,
    limit: 10
  });
  expect(messagesB.length).toBe(1);
  expect(messagesB[0].content).toBe('Hello User B');

  // 3. User B replies
  await messageService.submitMessage(
    addressB,
    'Hi User A!',
    registrationB,
    registrationA,
    queryClient,
    passkeyInfoB,
    keysetB,
    messagesB[0].messageId // Reply to original
  );

  // ✅ Verify reply linkage
  const replies = await messageDB.getMessages({
    spaceId: addressB,
    channelId: addressA,
    limit: 10
  });
  expect(replies[0].replyTo).toBe(messagesB[0].messageId);
});
```

---

### Phase 5: Error Scenario Tests

**File**: `src/dev/tests/error-scenarios/ErrorHandling.test.tsx`

#### Coverage:
- ✅ Network failures during message send
- ✅ Encryption failures
- ✅ IndexedDB quota exceeded
- ✅ Concurrent message submission race conditions
- ✅ Invalid message format handling
- ✅ Malformed invite links
- ✅ Permission denied scenarios
- ✅ Database transaction failures

```typescript
describe('Error Scenario Handling', () => {
  it('should rollback DB transaction on encryption failure', async () => {
    // Corrupt the keyset
    const corruptKeyset = { ...keyset, userKeyset: null };

    await expect(
      messageService.submitMessage(
        'address',
        'message',
        registration,
        registration,
        queryClient,
        passkeyInfo,
        corruptKeyset
      )
    ).rejects.toThrow('Encryption failed');

    // ✅ Verify no partial data saved
    const messages = await messageDB.getMessages({
      spaceId: 'address',
      channelId: 'address',
      limit: 10
    });
    expect(messages.length).toBe(0);
  });

  it('should handle concurrent message submissions without data loss', async () => {
    // Submit 10 messages concurrently
    const promises = Array.from({ length: 10 }, (_, i) =>
      messageService.submitMessage(
        'address',
        `Message ${i}`,
        registration,
        registration,
        queryClient,
        passkeyInfo,
        keyset
      )
    );

    await Promise.all(promises);

    // ✅ Verify all messages saved
    const messages = await messageDB.getMessages({
      spaceId: 'address',
      channelId: 'address',
      limit: 20
    });
    expect(messages.length).toBe(10);
  });
});
```

---

### Phase 6: Performance Baseline Tests

**File**: `src/dev/tests/performance/PerformanceBaseline.test.tsx`

```typescript
describe('Performance Baseline Tests', () => {
  it('submitMessage should complete within 200ms', async () => {
    const start = Date.now();

    await messageService.submitMessage(
      'address',
      'test message',
      registration,
      registration,
      queryClient,
      passkeyInfo,
      keyset
    );

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  it('handleNewMessage should process 100 messages within 5 seconds', async () => {
    const messages = Array.from({ length: 100 }, (_, i) =>
      createTestMessage(`Message ${i}`)
    );

    const start = Date.now();

    for (const message of messages) {
      await messageService.handleNewMessage(
        message,
        selfAddress,
        keyset,
        queryClient
      );
    }

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });

  it('should maintain performance within 5% of baseline after refactoring', async () => {
    // Baseline performance metrics
    const baseline = {
      submitMessage: 150, // ms
      handleNewMessage: 40, // ms
      createSpace: 800, // ms
      requestSync: 1500, // ms
    };

    // Measure current performance
    const current = await measurePerformance();

    // Assert within 5% tolerance
    Object.keys(baseline).forEach(func => {
      const tolerance = baseline[func] * 0.05;
      expect(current[func]).toBeLessThanOrEqual(baseline[func] + tolerance);
    });
  });
});
```

---

## Test Coverage Goals

### Quantitative Targets
- **Line Coverage**: >85% for all services
- **Branch Coverage**: >80% for all services
- **Function Coverage**: 100% for exported functions
- **Integration Coverage**: 100% for critical workflows

### Qualitative Targets
- ✅ All message types handled correctly
- ✅ All error scenarios tested
- ✅ All encryption paths validated
- ✅ All database operations verified
- ✅ All cache synchronization tested
- ✅ All performance baselines established

---

## Success Criteria

### Test Suite Completion
- [ ] Phase 1: Infrastructure setup complete
- [ ] Phase 2: MessageService integration tests (100+ tests)
- [ ] Phase 3: All service integration tests (200+ tests)
- [ ] Phase 4: End-to-end workflow tests (50+ tests)
- [ ] Phase 5: Error scenario tests (50+ tests)
- [ ] Phase 6: Performance baseline tests (20+ tests)

### Quality Gates
- [ ] **All tests pass**: 100% pass rate
- [ ] **No app code changes**: Tests work with existing code
- [ ] **Fast execution**: Full suite runs in <30 seconds
- [ ] **High confidence**: Can detect 90%+ of potential bugs
- [ ] **Clear failures**: Test failures clearly indicate root cause

### Validation Criteria
- [ ] Tests catch intentional bugs (inject bug → test fails)
- [ ] Tests pass on current codebase (all services extracted)
- [ ] Tests provide clear failure messages
- [ ] Tests are maintainable and well-documented

---

## Execution Timeline

### Estimated Effort: 16-24 hours

**Phase 1: Infrastructure** (4 hours)
- Install dependencies
- Create test helpers
- Setup fake-indexeddb

**Phase 2: MessageService Tests** (6 hours)
- 7 critical function tests
- Edge cases and error scenarios

**Phase 3: Other Service Tests** (8 hours)
- SpaceService (2 hours)
- InvitationService (2 hours)
- SyncService (2 hours)
- EncryptionService (1 hour)
- ConfigService (1 hour)

**Phase 4: Workflow Tests** (4 hours)
- End-to-end scenarios
- Cross-service integration

**Phase 5: Error & Performance** (2 hours)
- Error scenarios
- Performance baselines

---

## Dependencies & Constraints

### Technical Dependencies
- `fake-indexeddb` package for real IndexedDB testing
- All services must be extracted (Phase 2 complete)
- React Query testing utilities
- Encryption SDK for key generation

### Constraints
- **No app code changes** - Tests must work with existing code
- **Fast execution** - Full suite must run quickly for rapid feedback
- **No external services** - All tests must be self-contained

---

## Risk Mitigation

### If Tests Are Too Slow
- Use `fake-indexeddb` synchronous mode
- Parallelize independent tests
- Use test.concurrent for IO-heavy tests

### If App Changes Are Required
- Document minimal changes needed
- Create separate test-only utilities
- Use dependency injection patterns

### If Coverage Is Insufficient
- Add more edge case tests
- Increase error scenario coverage
- Add stress tests for concurrent operations

---

## Post-Implementation Validation

### How to Validate Test Quality

1. **Inject Intentional Bugs**
   ```typescript
   // In MessageService.ts, temporarily break logic:
   async submitMessage(...) {
     // INTENTIONAL BUG: Don't save to DB
     // await this.messageDB.saveMessage(message);

     // Test should fail immediately ✅
   }
   ```

2. **Remove Critical Code**
   ```typescript
   // In MessageService.ts, remove encryption:
   async submitMessage(...) {
     // INTENTIONAL BUG: Skip encryption
     // message.encryptedContent = await encrypt(message.content);
     message.encryptedContent = message.content; // Plaintext!

     // Test should detect plaintext ✅
   }
   ```

3. **Break Cache Sync**
   ```typescript
   // In MessageService.ts, skip cache update:
   async submitMessage(...) {
     await this.messageDB.saveMessage(message);
     // INTENTIONAL BUG: Don't update cache
     // queryClient.setQueryData(...);

     // Test should fail on cache assertion ✅
   }
   ```

### Expected Results
- ✅ All intentional bugs caught by tests
- ✅ Clear failure messages indicating exact problem
- ✅ No false positives (tests don't fail on correct code)

---

## Documentation Requirements

### Test Documentation
Each test file must include:
- **Purpose**: What is being tested and why
- **Setup**: How test data is created
- **Assertions**: What outcomes are verified
- **Failure guidance**: What to check if test fails

### Example:
```typescript
/**
 * MessageService.integration.test.tsx
 *
 * PURPOSE: Validates that MessageService functions correctly save messages
 * to IndexedDB, update React Query cache, and maintain encryption integrity.
 *
 * CRITICAL TESTS:
 * - submitMessage: Verifies complete message submission workflow
 * - handleNewMessage: Verifies message routing and decryption
 * - addMessage: Verifies message creation
 *
 * FAILURE GUIDANCE:
 * - "Message not in DB": Check saveMessage logic
 * - "Message not in cache": Check cache update logic
 * - "Decryption failed": Check encryption key handling
 */
```

---

## Final Confidence Level

**Current**: 🔴 LOW (30%) - Mock tests only
**After Implementation**: 🟢 HIGH (90%+) - Real integration tests

This comprehensive test suite will provide **high confidence** that:
- ✅ All services work correctly
- ✅ Data integrity is maintained
- ✅ Encryption is applied correctly
- ✅ Cache stays synchronized with DB
- ✅ Error scenarios are handled properly
- ✅ Performance is acceptable

**Phase 4 optimization can proceed safely with this test coverage.**

---

## Notes

- Tests must be **fast** (<30s total) for rapid feedback
- Tests must be **deterministic** (no flaky tests)
- Tests must be **clear** (obvious what failed and why)
- Tests must be **maintainable** (well-structured and documented)
- Tests must work **without app code changes** (use real APIs, not mocks)

---

_Last updated: 2025-10-02_
