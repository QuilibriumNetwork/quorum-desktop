# MessageDB Test Coverage - Implementation Checklist

**Quick Reference for Implementing Comprehensive Test Suite**

---

## 📋 Phase 1: Infrastructure Setup

### Dependencies
- [ ] Install `fake-indexeddb`: `yarn add -D fake-indexeddb`
- [ ] Verify vitest is installed (already present)
- [ ] Verify @testing-library/react is installed (already present)

### Test Helpers

#### `src/dev/tests/utils/realDBHelpers.ts`
- [ ] `createTestMessageDB()` - Creates real MessageDB with fake-indexeddb
- [ ] `assertMessageSaved()` - Verifies message in IndexedDB
- [ ] `assertSpaceSaved()` - Verifies space in IndexedDB
- [ ] `getAllConversationMessages()` - Gets all messages for verification
- [ ] `cleanupTestDB()` - Cleanup after each test

#### `src/dev/tests/utils/encryptionHelpers.ts`
- [ ] `createTestKeyset()` - Generate test keypairs
- [ ] `testEncryptionCycle()` - Test encrypt → decrypt
- [ ] `assertEncryptionIntegrity()` - Verify encryption worked

#### `src/dev/tests/utils/reactQueryHelpers.ts`
- [ ] `createTestQueryClient()` - Fresh QueryClient per test
- [ ] `assertMessageInCache()` - Verify message in RQ cache
- [ ] `getCacheMessages()` - Get cache data for debugging

---

## 📋 Phase 2: MessageService Tests

**File**: `src/dev/tests/services/MessageService.integration.test.tsx`

### Test Suite 1: `submitMessage()` - P2P Messages
- [ ] Complete workflow: encrypt → save → cache → WebSocket
- [ ] Reply message linkage works correctly
- [ ] Rollback on encryption failure
- [ ] Concurrent submissions without data loss
- [ ] **Assertions**: Message in DB, message in cache, encrypted correctly

### Test Suite 2: `handleNewMessage()` - Message Routing
- [ ] Routes POST_MESSAGE correctly
- [ ] Routes all 7 message types correctly
- [ ] Decrypts encrypted messages
- [ ] Updates cache after processing
- [ ] Handles malformed messages gracefully
- [ ] **Assertions**: Message saved, cache updated, decrypted correctly

### Test Suite 3: `addMessage()` - Message Creation
- [ ] Creates message with all required fields
- [ ] Generates unique messageId
- [ ] Sets correct timestamps
- [ ] **Assertions**: Message structure correct

### Test Suite 4: `saveMessage()` - DB Persistence
- [ ] Saves message to IndexedDB
- [ ] Handles duplicate messageId
- [ ] Updates existing messages
- [ ] **Assertions**: Message persisted, retrievable

### Test Suite 5: `deleteConversation()` - Deletion
- [ ] Deletes all messages in conversation
- [ ] Updates cache correctly
- [ ] Preserves other conversations
- [ ] **Assertions**: Messages deleted, cache updated

### Estimated: **50+ tests**

---

## 📋 Phase 3: SpaceService Tests

**File**: `src/dev/tests/services/SpaceService.integration.test.tsx`

### Test Coverage
- [ ] `createSpace()` - Space saved with correct structure
- [ ] `createSpace()` - Default channel created
- [ ] `createSpace()` - Member added as owner
- [ ] `createSpace()` - Public vs private space handling
- [ ] `updateSpace()` - Space updates persist
- [ ] `deleteSpace()` - Cascade deletion (messages, members, keys)
- [ ] `kickUser()` - Member removed, message sent
- [ ] `createChannel()` - Channel created, space updated

### Estimated: **30+ tests**

---

## 📋 Phase 4: InvitationService Tests

**File**: `src/dev/tests/services/InvitationService.integration.test.tsx`

### Test Coverage
- [ ] `generateNewInviteLink()` - Invite saved to DB
- [ ] `generateNewInviteLink()` - Invite encrypted correctly (private spaces)
- [ ] `processInviteLink()` - Valid invite returns space info
- [ ] `processInviteLink()` - Invalid invite throws error
- [ ] `processInviteLink()` - Expired invite throws error
- [ ] `joinInviteLink()` - Key exchange works
- [ ] `joinInviteLink()` - Member added to space
- [ ] `joinInviteLink()` - Space synced after join
- [ ] `sendInviteToUser()` - Direct invite sent via P2P

### Estimated: **35+ tests**

---

## 📋 Phase 5: SyncService Tests

**File**: `src/dev/tests/services/SyncService.integration.test.tsx`

### Test Coverage
- [ ] `requestSync()` - Sync workflow executes
- [ ] `synchronizeAll()` - All spaces synchronized
- [ ] `initiateSync()` - Sync initiated correctly
- [ ] `directSync()` - Direct peer sync works
- [ ] Conflict resolution (newer message wins)
- [ ] Incremental sync (only new messages)
- [ ] Sync with offline/online transitions

### Estimated: **30+ tests**

---

## 📋 Phase 6: EncryptionService Tests

**File**: `src/dev/tests/services/EncryptionService.integration.test.tsx`

### Test Coverage
- [ ] `ensureKeyForSpace()` - Key generated and saved
- [ ] `ensureKeyForSpace()` - Existing key retrieved
- [ ] `deleteEncryptionStates()` - Encryption states cleaned up
- [ ] Key rotation workflow
- [ ] Multi-device key synchronization

### Estimated: **20+ tests**

---

## 📋 Phase 7: ConfigService Tests

**File**: `src/dev/tests/services/ConfigService.integration.test.tsx`

### Test Coverage
- [ ] `getConfig()` - Config retrieved and decrypted
- [ ] `getConfig()` - Default config returned if none exists
- [ ] `saveConfig()` - Config encrypted and saved
- [ ] Config migration from v1 to v2
- [ ] Config persistence across sessions

### Estimated: **15+ tests**

---

## 📋 Phase 8: End-to-End Workflows

**File**: `src/dev/tests/workflows/CompleteWorkflows.integration.test.tsx`

### Workflow Tests
- [ ] **Space Invitation Flow**: Create space → Generate invite → Process invite → Join space
  - Verify space created
  - Verify invite saved
  - Verify member added
  - Verify encryption keys exchanged

- [ ] **P2P Messaging Flow**: Send message → Receive → Reply
  - Verify message encrypted
  - Verify message saved in both DBs
  - Verify cache updated
  - Verify reply linkage

- [ ] **Channel Messaging Flow**: Create space → Create channel → Send message → Receive
  - Verify channel created
  - Verify message broadcast to all members
  - Verify all members have message

- [ ] **Space Management Flow**: Create space → Add member → Kick member → Delete space
  - Verify member added
  - Verify kick message sent
  - Verify member removed
  - Verify cascade deletion

### Estimated: **20+ tests**

---

## 📋 Phase 9: Error Scenarios

**File**: `src/dev/tests/error-scenarios/ErrorHandling.test.tsx`

### Error Coverage
- [ ] Network failure during message send
- [ ] Encryption failure (corrupt keys)
- [ ] IndexedDB quota exceeded
- [ ] Concurrent race conditions (10 simultaneous submits)
- [ ] Invalid message format
- [ ] Malformed invite link
- [ ] Permission denied (kick unauthorized user)
- [ ] Database transaction failure
- [ ] WebSocket connection lost

### Estimated: **25+ tests**

---

## 📋 Phase 10: Performance Baselines

**File**: `src/dev/tests/performance/PerformanceBaseline.test.tsx`

### Performance Tests
- [ ] `submitMessage()` completes within 200ms
- [ ] `handleNewMessage()` processes 100 messages within 5s
- [ ] `createSpace()` completes within 1000ms
- [ ] `requestSync()` completes within 2000ms
- [ ] No memory leaks after 1000 operations
- [ ] Performance within 5% of baseline after refactoring

### Estimated: **15+ tests**

---

## 📊 Coverage Summary

| Phase | Test File | Est. Tests | Status |
|-------|-----------|------------|--------|
| 1 | Infrastructure | - | ⬜ Not Started |
| 2 | MessageService | 50+ | ⬜ Not Started |
| 3 | SpaceService | 30+ | ⬜ Not Started |
| 4 | InvitationService | 35+ | ⬜ Not Started |
| 5 | SyncService | 30+ | ⬜ Not Started |
| 6 | EncryptionService | 20+ | ⬜ Not Started |
| 7 | ConfigService | 15+ | ⬜ Not Started |
| 8 | Workflows | 20+ | ⬜ Not Started |
| 9 | Error Scenarios | 25+ | ⬜ Not Started |
| 10 | Performance | 15+ | ⬜ Not Started |
| **TOTAL** | **10 files** | **240+** | **⬜ 0%** |

**Target**: 250+ real integration tests with 85%+ code coverage

---

## ✅ Success Criteria

### Before Starting Phase 4 Optimization:
- [ ] All 240+ tests implemented
- [ ] All tests passing (100% pass rate)
- [ ] No app code changes required
- [ ] Full test suite runs in <30 seconds
- [ ] Coverage reports show 85%+ line coverage
- [ ] All critical workflows tested end-to-end
- [ ] All error scenarios covered
- [ ] Performance baselines established

### Validation Tests:
- [ ] Inject intentional bug → test fails immediately
- [ ] Remove encryption → test detects plaintext
- [ ] Skip DB save → test detects missing data
- [ ] Break cache sync → test detects desync

---

## 🚨 Red Flags - Stop If You See These

❌ **Tests passing but code broken** → Tests are too lenient
❌ **Tests failing intermittently** → Flaky tests, need fixing
❌ **Tests take >1 minute to run** → Too slow, optimize
❌ **App code changes needed** → Re-evaluate approach
❌ **Tests don't catch injected bugs** → Insufficient assertions

---

## 📈 Progress Tracking

**Current Status**: ⬜ Not Started

**Last Updated**: 2025-10-02

**Next Steps**:
1. Install `fake-indexeddb`
2. Create test helper utilities
3. Start with MessageService tests (highest priority)

---

## 🎯 Final Goal

**HIGH CONFIDENCE (90%+)** that Phase 4 optimization won't break functionality.

Tests must:
- ✅ Test real implementation, not mocks
- ✅ Verify actual DB state
- ✅ Validate cache synchronization
- ✅ Confirm encryption integrity
- ✅ Cover all error paths
- ✅ Establish performance baselines

**When all checkboxes are complete, we can safely optimize Phase 4! 🚀**

---

_Last updated: 2025-10-02_
