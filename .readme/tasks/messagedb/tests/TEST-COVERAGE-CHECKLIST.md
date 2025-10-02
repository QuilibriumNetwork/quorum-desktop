# MessageDB Test Coverage - Unit Test Checklist

**Quick Reference for Implementing Unit Test Suite**

**Approach**: Simple unit tests with mocks and spies (not integration tests)
**Target**: 50+ unit tests covering all service functions
**Timeline**: 6-8 hours estimated

---

## 📋 Phase 1: MessageService Unit Tests

**File**: `src/dev/tests/services/MessageService.unit.test.tsx`
**Status**: ✅ COMPLETE
**Estimated Tests**: ~15 tests
**Current Progress**: 16 / 16 tests passing (100%)

### Test Suite 1: `submitMessage()` - P2P Message Submission
- [x] Should call enqueueOutbound for WebSocket ✅
- [x] Should handle reply messages with replyTo parameter ✅

### Test Suite 2: `handleNewMessage()` - Message Routing
- [x] Should route POST_MESSAGE type correctly ✅
- [x] Should route REACTION_MESSAGE type correctly ✅
- [x] Should route REMOVE_MESSAGE type correctly ✅
- [x] Should route JOIN_MESSAGE type correctly ✅
- [x] Should route LEAVE_MESSAGE type correctly ✅
- [x] Should route KICK_MESSAGE type correctly ✅
- [x] Should route UPDATE_PROFILE_MESSAGE type correctly ✅

### Test Suite 3: `addMessage()` - Cache Updates
- [x] Should update queryClient cache when adding message ✅
- [x] Should handle reaction message cache updates ✅

### Test Suite 4: `saveMessage()` - Database Persistence
- [x] Should call messageDB.saveMessage for post messages ✅
- [x] Should handle reaction messages by updating target message ✅
- [x] Should handle remove-message type by calling deleteMessage ✅

### Test Suite 5: `deleteConversation()` - Message Deletion
- [x] Should execute deletion workflow without errors ✅

### Test Suite 6: `submitChannelMessage()` - Channel Message Submission
- [x] Should execute channel message submission without errors ✅

**Progress**: 16 / 16 tests passing (100% COMPLETE) ✅

---

## 📋 Phase 2: SpaceService Unit Tests

**File**: `src/dev/tests/services/SpaceService.unit.test.tsx`
**Status**: ✅ COMPLETE
**Estimated Tests**: ~10 tests
**Current Progress**: 13 / 13 tests passing (100%)

### Test Suite 1: Service Construction
- [x] Should construct SpaceService with all required dependencies ✅
- [x] Should have all required methods ✅

### Test Suite 2: Method Signatures
- [x] Should have correct parameter count for createSpace ✅
- [x] Should have correct parameter count for updateSpace ✅
- [x] Should have correct parameter count for deleteSpace ✅
- [x] Should have correct parameter count for kickUser ✅
- [x] Should have correct parameter count for createChannel ✅
- [x] Should have correct parameter count for sendHubMessage ✅

### Test Suite 3: sendHubMessage() - Hub Message Sending
- [x] Should call getSpaceKey when sending hub message ✅

### Test Suite 4: deleteSpace() - Space Deletion
- [x] Should throw error if hub key is missing address ✅
- [x] Should throw error if hub key is null ✅

### Test Suite 5: kickUser() - User Kick Validation
- [x] Should throw error if space not found ✅
- [x] Should validate canKickUser returns false for space owner ✅

**Progress**: 13 / 13 tests passing (100% COMPLETE) ✅

**Note**: SpaceService methods use complex crypto operations (js_generate_ed448, js_generate_x448) that require WASM initialization. Tests focus on service construction, method signatures, error handling, and simpler methods rather than full execution which would require integration testing.

---

## 📋 Phase 3: InvitationService Unit Tests

**File**: `src/dev/tests/services/InvitationService.unit.test.tsx`
**Status**: ⬜ Not Started
**Estimated Tests**: ~10 tests

### Test Coverage
- [ ] `generateNewInviteLink()` - Creates invite with correct structure
- [ ] `generateNewInviteLink()` - Sets encryption flag for private spaces
- [ ] `generateNewInviteLink()` - Saves invite to database
- [ ] `processInviteLink()` - Validates invite structure
- [ ] `processInviteLink()` - Returns space info for valid invite
- [ ] `processInviteLink()` - Throws error for invalid invite
- [ ] `processInviteLink()` - Throws error for expired invite
- [ ] `joinInviteLink()` - Calls key exchange methods
- [ ] `joinInviteLink()` - Adds member to space
- [ ] `sendInviteToUser()` - Creates and sends invite message

**Progress**: 0 / 10 tests

---

## 📋 Phase 4: SyncService Unit Tests

**File**: `src/dev/tests/services/SyncService.unit.test.tsx`
**Status**: ⬜ Not Started
**Estimated Tests**: ~8 tests

### Test Coverage
- [ ] `requestSync()` - Calls sync with correct parameters
- [ ] `requestSync()` - Handles sync errors gracefully
- [ ] `synchronizeAll()` - Processes all spaces
- [ ] `synchronizeAll()` - Handles empty space list
- [ ] `initiateSync()` - Sends sync request message
- [ ] `initiateSync()` - Includes correct sync metadata
- [ ] `directSync()` - Calls direct sync with peer address
- [ ] `directSync()` - Validates peer registration

**Progress**: 0 / 8 tests

---

## 📋 Phase 5: EncryptionService Unit Tests

**File**: `src/dev/tests/services/EncryptionService.unit.test.tsx`
**Status**: ⬜ Not Started
**Estimated Tests**: ~5 tests

### Test Coverage
- [ ] `ensureKeyForSpace()` - Retrieves existing key if present
- [ ] `ensureKeyForSpace()` - Generates new key if missing
- [ ] `ensureKeyForSpace()` - Saves generated key to database
- [ ] `deleteEncryptionStates()` - Calls delete for space encryption states
- [ ] `deleteEncryptionStates()` - Handles missing encryption states

**Progress**: 0 / 5 tests

---

## 📋 Phase 6: ConfigService Unit Tests

**File**: `src/dev/tests/services/ConfigService.unit.test.tsx`
**Status**: ⬜ Not Started
**Estimated Tests**: ~5 tests

### Test Coverage
- [ ] `getConfig()` - Retrieves config from database
- [ ] `getConfig()` - Returns default config if none exists
- [ ] `getConfig()` - Handles decryption errors
- [ ] `saveConfig()` - Encrypts config before saving
- [ ] `saveConfig()` - Saves config to database

**Progress**: 0 / 5 tests

---

## 📊 Coverage Summary

| Phase | Service | Tests | Status |
|-------|---------|-------|--------|
| 1 | MessageService | 16 | ✅ COMPLETE (100%) |
| 2 | SpaceService | 13 | ✅ COMPLETE (100%) |
| 3 | InvitationService | 10 | ⬜ Not Started |
| 4 | SyncService | 8 | ⬜ Not Started |
| 5 | EncryptionService | 5 | ⬜ Not Started |
| 6 | ConfigService | 5 | ⬜ Not Started |
| **TOTAL** | **6 services** | **57** | **🟡 51% (29/57)** |

**Target**: 50+ unit tests covering all service functions
**Current**: 29 tests passing (51% complete)

---

## ✅ Success Criteria

### Before Starting Phase 4 Optimization:
- [ ] All 53 unit tests implemented
- [ ] All tests passing (100% pass rate)
- [ ] No app code changes required
- [ ] Full test suite runs in <5 seconds
- [ ] No TypeScript compilation errors
- [ ] All service functions have at least one test

### Validation Tests:
- [ ] Remove function call → test fails (detects missing calls)
- [ ] Pass wrong parameters → test fails (detects incorrect parameters)
- [ ] Skip error handling → test fails (detects missing error handling)
- [ ] All tests have clear failure messages

---

## 🚨 Red Flags - Stop If You See These

❌ **Tests passing but code broken** → Tests are too lenient
❌ **Tests failing intermittently** → Flaky tests, need fixing
❌ **Tests take >10 seconds to run** → Too slow, optimize
❌ **TypeScript errors in test files** → Fix compilation first
❌ **Tests don't catch injected bugs** → Insufficient assertions

---

## 📈 Progress Tracking

**Current Status**: 🟡 In Progress (51% - 29/57 tests)

**Last Updated**: 2025-10-02

**Completed**:
1. ✅ Phase 1: MessageService (16/16 tests passing)
2. ✅ Phase 2: SpaceService (13/13 tests passing)

**Next Steps**:
1. Create `InvitationService.unit.test.tsx` file
2. Follow same pattern as MessageService/SpaceService
3. Continue with SyncService, EncryptionService, ConfigService
4. Run full test suite validation

---

## 🎯 Final Goal

**MEDIUM-HIGH CONFIDENCE (70-80%)** that Phase 4 optimization won't break functionality.

Unit tests verify:
- ✅ Services call correct methods (using vi.fn())
- ✅ Services pass correct parameters (using expect.objectContaining)
- ✅ Services handle errors properly (using rejects.toThrow)
- ✅ Services update state correctly (checking mock calls)
- ✅ Fast feedback (<5 seconds full suite)

**When all checkboxes are complete, we can proceed with Phase 4 optimization! 🚀**

---

_Last updated: 2025-10-02_
