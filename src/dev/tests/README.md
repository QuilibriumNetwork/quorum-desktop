# MessageDB Service Tests

Comprehensive unit test suite for all MessageDB services extracted during the MessageDB refactoring.

These are **unit tests** using mocks and spies (`vi.fn()`), **NOT** integration tests.

### What We Test:
- ✅ Services call correct methods with correct parameters
- ✅ Services handle errors properly (invalid inputs, missing data)
- ✅ Service construction with dependency injection
- ✅ Method signatures (parameter counts)
- ✅ Early return conditions and validation logic

### What We DON'T Test:
- ❌ Real database operations (we trust MessageDB class)
- ❌ Real encryption (we trust Quilibrium SDK)
- ❌ Real IndexedDB (we trust browser API)
- ❌ Real WebSocket operations

**Philosophy**: We trust underlying implementations work correctly. We test that our services **use them correctly**.

### Why These Tests Matter

**If tests pass**, you know:
- Control flow executes correctly (enqueue → process → handler → success/failure)
- Services call each other with correct parameters
- Error routing works (permanent vs retryable errors, auth errors)
- Business logic is correct (deduplication, backoff timing, gating conditions)

**If tests pass but app doesn't work**, the issue is in:
- Real encryption (SDK behavior)
- Real database (IndexedDB schema mismatch)
- Real network (API/WebSocket failures)

**Practical value**: Regression protection during refactoring. If you restructure code and tests still pass, the behavior contract is preserved. Manual testing still required for end-to-end verification.

---

## 📁 Directory Structure

```
src/dev/tests/
├── services/                    # Service unit tests
│   ├── ActionQueueService.unit.test.ts   (42 tests)
│   ├── ActionQueueHandlers.unit.test.ts  (56 tests)
│   ├── MessageService.unit.test.tsx      (24 tests)
│   ├── SpaceService.unit.test.tsx        (12 tests)
│   ├── InvitationService.unit.test.tsx   (15 tests)
│   ├── SyncService.unit.test.tsx         (15 tests)
│   ├── EncryptionService.unit.test.tsx   (8 tests)
│   └── ConfigService.unit.test.tsx       (8 tests)
├── utils/                       # Utility function tests
│   ├── messageGrouping.unit.test.ts      (message grouping)
│   ├── mentionHighlighting.test.ts       (mention highlighting)
│   ├── mentionUtils.enhanced.test.ts     (mention extraction)
│   └── README.md                          (utility testing guide)
├── components/                  # React component tests
│   └── README.md                          (component testing guide)
├── hooks/                       # React hooks tests
│   └── README.md                          (hooks testing guide)
├── integration/                 # Integration tests
│   └── README.md                          (integration testing guide)
├── e2e/                         # End-to-end tests
│   └── README.md                          (E2E testing guide)
├── docs/                        # Manual testing guides (reference)
│   ├── manual-test_ConfigService.md
│   ├── manual-test_EncryptionService.md
│   ├── manual-test_InvitationService.md
│   ├── manual-test_MessageService.md
│   ├── manual-test_SpaceService.md
│   └── manual-test_SyncService.md
├── setup.ts                     # Global test setup (WebSocket/crypto mocks)
└── README.md                    # This file
```

---

## 🏗️ Test Categories

### Service Tests (`services/`)
Comprehensive unit tests for all MessageDB services. Tests service construction, method signatures, and business logic with mocked dependencies.

### Utility Tests (`utils/`)
Tests for utility functions and helper modules. Includes message grouping, mention processing, and other shared utilities.

### Component Tests (`components/`)
React component unit and integration tests. Test rendering, user interactions, props handling, and accessibility.

### Hook Tests (`hooks/`)
Custom React hooks testing. Verify hook return values, state updates, and effect dependencies in isolation.

### Integration Tests (`integration/`)
Tests that verify multiple components/services working together. Focus on complete user workflows and service interactions.

### End-to-End Tests (`e2e/`)
Full application tests simulating real user scenarios. Test critical user journeys, cross-browser compatibility, and performance.

---

## 🎯 Test Naming Conventions

- **Service tests**: `ServiceName.unit.test.tsx`
- **Utility tests**: `utilityName.test.ts` or `utilityName.unit.test.ts`
- **Component tests**: `ComponentName.test.tsx`
- **Hook tests**: `useHookName.test.ts`
- **Integration tests**: `featureName.integration.test.tsx`
- **E2E tests**: `userFlow.e2e.test.ts`

---

## ⚡ Running Tests

### All Tests
```bash
yarn vitest src/dev/tests/ --run
```

### By Category
```bash
# Service tests only
yarn vitest src/dev/tests/services/ --run

# Utility tests only
yarn vitest src/dev/tests/utils/ --run

# Component tests only
yarn vitest src/dev/tests/components/ --run

# Hook tests only
yarn vitest src/dev/tests/hooks/ --run

# Integration tests only
yarn vitest src/dev/tests/integration/ --run
```

### Watch Mode (Development)
```bash
yarn vitest src/dev/tests/ --watch
```

---

## 📝 Detailed Test Descriptions

### 1. MessageService.unit.test.tsx (24 tests)

**Purpose**: Validates MessageService message handling, routing, and persistence.

**Test Coverage**:
- `submitMessage()` - P2P message submission (2 tests)
- `handleNewMessage()` - Message routing for 7 message types (7 tests):
  - POST (text messages)
  - REACTION (emoji reactions)
  - REMOVE (message deletion)
  - JOIN (user join events)
  - LEAVE (user leave events)
  - KICK (user kick events)
  - UPDATE_PROFILE (profile updates)
- `addMessage()` - Cache updates for DM and Space messages (3 tests)
- `saveMessage()` - Database persistence (3 tests)
- `deleteConversation()` - Message deletion (1 test)
- `submitChannelMessage()` - Channel message submission (1 test)
- `encryptAndSendToSpace()` - Triple Ratchet encryption helper (7 tests)

**Key Validations**:
- Correct parameter order in method calls
- Message routing logic (inbox vs group messages)
- Database method calls (saveMessage, deleteMessage)
- Cache updates for both DM and Space scenarios
- ActionQueueService integration
- Encryption state management

---

### 2. SpaceService.unit.test.tsx (12 tests)

**Purpose**: Validates SpaceService space/channel management operations.

**Test Coverage**:
- Service construction (2 tests)
- Method signatures for all 7 methods (6 tests)
- `sendHubMessage()` - Hub message creation (1 test)
- `deleteSpace()` - Space deletion validation (2 tests)
- `kickUser()` - User kick permission validation (2 tests)

**Key Validations**:
- Error handling for missing hub keys
- Permission checks (can't kick space owner)
- Method parameter counts match implementation
- Service properly constructs with all dependencies

**Note**: SpaceService uses complex crypto operations (js_generate_ed448, js_generate_x448) that require WASM. Tests focus on signatures and error handling rather than full execution.

---

### 3. InvitationService.unit.test.tsx (15 tests)

**Purpose**: Validates InvitationService invite creation, validation, and processing.

**Test Coverage**:
- Service construction (2 tests)
- Method signatures for all 5 methods (5 tests)
- `constructInviteLink()` - Invite URL construction (1 test)
- `processInviteLink()` - Invite validation (4 tests):
  - Invalid format detection
  - Missing spaceId detection
  - Missing configKey detection
  - API call for valid invites
- `sendInviteToUser()` - Invite sending workflow (1 test)
- `joinInviteLink()` - Join validation (1 test)
- `generateNewInviteLink()` - Method existence (1 test)

**Key Validations**:
- Invite link format validation
- Required parameters (spaceId, configKey)
- Database and API method calls
- Error handling for invalid invites

**Note**: Uses complex crypto operations (js_generate_x448, js_sign_ed448, js_decrypt_inbox_message). Tests focus on validation logic and method signatures.

---

### 4. SyncService.unit.test.tsx (15 tests)

**Purpose**: Validates SyncService space synchronization operations.

**Test Coverage**:
- Service construction (2 tests)
- Method signatures for all 6 methods (6 tests)
- `initiateSync()` - Early return conditions (2 tests):
  - No sync info exists
  - Empty candidates array
- `sendVerifyKickedStatuses()` - Kicked user detection (3 tests):
  - No kicked users
  - Detects kick events
  - Handles join after kick
- `informSyncData()` - Sync info validation (2 tests):
  - Early return for matching inbox
  - Early return for equal/greater remote data

**Key Validations**:
- Early return logic (prevents unnecessary operations)
- Kicked user detection from message history
- Sync candidate filtering
- Database method calls for sync operations

**Note**: SyncService uses crypto operations (SealSyncEnvelope, SealHubEnvelope). Tests focus on business logic and early returns.

---

### 5. EncryptionService.unit.test.tsx (8 tests)

**Purpose**: Validates EncryptionService encryption state management and key operations.

**Test Coverage**:
- Service construction (2 tests)
- Method signatures (2 tests)
- `deleteEncryptionStates()` - State cleanup (3 tests):
  - Deletes all states for conversation
  - Handles empty states
  - Handles states without inboxId
- `ensureKeyForSpace()` - Key generation/retrieval (1 test):
  - Returns existing key if present (early return)

**Key Validations**:
- Encryption state deletion workflow
- Inbox mapping cleanup
- Early return when key exists
- Database method calls (deleteEncryptionState, deleteInboxMapping)

**Note**: Uses crypto operations (js_generate_ed448, js_sign_ed448). Tests focus on deletion logic and early returns.

---

### 6. ConfigService.unit.test.tsx (8 tests)

**Purpose**: Validates ConfigService user configuration management.

**Test Coverage**:
- Service construction (2 tests)
- Method signatures (2 tests)
- `getConfig()` - Configuration retrieval (2 tests):
  - Returns default config when none exists
  - Returns stored config when no remote config
- `saveConfig()` - Configuration persistence (2 tests):
  - Saves with updated timestamp
  - Skips remote sync when allowSync is false

**Key Validations**:
- Config retrieval priority (remote > stored > default)
- Timestamp updates on save
- Conditional remote sync (based on allowSync flag)
- Database method calls (getUserConfig, saveUserConfig)

**Note**: Uses crypto operations (crypto.subtle.digest, js_sign_ed448). Tests focus on retrieval logic and sync conditions.

---

### 7. ActionQueueService.unit.test.ts (42 tests)

**Purpose**: Validates ActionQueueService queue mechanics for background task processing.

**Test Coverage**:
- Service construction (2 tests)
- Keyset management (4 tests):
  - Get/set/clear user keyset
  - Trigger processQueue when keyset is set
- Task enqueueing (6 tests):
  - Add task and return ID
  - Deduplication by key
  - Queue size limits
  - Prune old tasks
- Queue processing (7 tests):
  - Online/offline behavior
  - Keyset gate (waits for auth)
  - Handler initialization check
  - Sequential task processing
- Task execution (6 tests):
  - Success (delete task)
  - Permanent error (mark failed)
  - Transient error (retry with backoff)
  - Max retries exceeded
  - Auth error (401 session-expired)
  - onFailure callback
- Multi-tab safety (4 tests):
  - Status-based gating
  - processingStartedAt timestamps
  - Grace period handling
- Start/stop (3 tests):
  - Reset stuck tasks
  - Interval management
  - Stop processing interval
- Handler not found (1 test)
- Exponential backoff (2 tests):
  - Increasing delays
  - Max delay cap
- Context integrity (1 test):
  - Keyset leakage detection
- Task key format (2 tests):
  - Key lookup consistency
  - Deduplication with multiple tasks
- Handler-service contract (3 tests):
  - Context passed unchanged
  - Error passed to isPermanentError
  - onFailure called with context and error

**Key Validations**:
- Queue deduplication and size limits
- Online/offline processing behavior
- Retry logic with exponential backoff
- Multi-tab coordination
- Keyset security (never stored in tasks)
- Handler-service interface contract

---

### 8. ActionQueueHandlers.unit.test.ts (56 tests)

**Purpose**: Validates all 16 ActionQueue task handlers for Space and DM actions.

**Test Coverage**:
- Handler registry (2 tests):
  - All 15 action types registered
  - Unknown types return undefined
- save-user-config (3 tests)
- update-space (3 tests)
- kick-user (3 tests)
- mute-user (2 tests)
- unmute-user (1 test)
- reaction (Space) (2 tests)
- pin-message (2 tests)
- unpin-message (1 test)
- edit-message (2 tests)
- delete-message (3 tests)
- send-channel-message (5 tests):
  - Encrypt and send via Triple Ratchet
  - Space/channel deleted handling
  - Permanent error classification
  - onFailure callback
- send-dm (4 tests):
  - Keyset required
  - No established sessions error
  - Permanent error classification
  - onFailure callback
- reaction-dm (2 tests)
- delete-dm (2 tests)
- edit-dm (3 tests)
- Error sanitization (2 tests):
  - Network errors
  - Encryption errors
- Handler messages (3 tests):
  - failureMessage for toast handlers
  - Silent handlers (no toast)
  - No success messages (silent success)
- Context contract validation (4 tests):
  - send-channel-message context fields
  - send-dm context fields
  - kick-user context fields
  - reaction currentPasskeyInfo
- SDK call verification (2 tests):
  - DoubleRatchetInboxEncrypt parameters
  - getEncryptAndSendToSpace call
- Error classification edge cases (3 tests):
  - "was deleted" permanent errors
  - Network errors retryable
  - Delete handlers idempotent
- Message status update contracts (2 tests):
  - Space message pattern (spaceId/channelId)
  - DM pattern (address/address)

**Key Validations**:
- Each handler's execute() method
- isPermanentError() classification
- onFailure() callbacks
- Keyset availability checks
- Error sanitization for user-facing messages
- Context contract between enqueue and handler
- SDK encryption call signatures

---

## 🛠️ Test Setup

### Global Setup (`setup.ts`)

Provides global mocks for:
- **WebSocket**: Mock WebSocket implementation
- **crypto**: Mock crypto API (getRandomValues, randomUUID, subtle.digest, subtle.generateKey, etc.)
- **React Testing Library**: Automatic cleanup after each test

### Test Structure Pattern

All service tests follow this pattern:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceName } from '@/services/ServiceName';

describe('ServiceName - Unit Tests', () => {
  let service: ServiceName;
  let mockDeps: any;

  beforeEach(() => {
    // Create mocks for all dependencies
    mockDeps = {
      messageDB: {
        methodName: vi.fn().mockResolvedValue(expectedValue),
      },
      // ... other dependencies
    };

    // Create service with mocked dependencies
    service = new ServiceName(mockDeps);

    // Clear mocks
    vi.clearAllMocks();
  });

  describe('functionName()', () => {
    it('should verify expected behavior', async () => {
      await service.functionName(params);

      // ✅ VERIFY: Method called with correct parameters
      expect(mockDeps.messageDB.methodName).toHaveBeenCalledWith(
        expect.objectContaining({ /* expected params */ })
      );
    });
  });
});
```

---

## 📚 Additional Documentation

### Manual Testing Guides

Quick reference guides for manually testing each service in the UI are available in `docs/`:

- `manual-test_MessageService.md` - Message operations (send, receive, delete, reactions)
- `manual-test_SpaceService.md` - Space operations (create, update, delete, kick)
- `manual-test_InvitationService.md` - Invite operations (generate, send, join)
- `manual-test_SyncService.md` - Sync operations (automatic syncing, data exchange)
- `manual-test_EncryptionService.md` - Encryption operations (key management, cleanup)
- `manual-test_ConfigService.md` - Config operations (save, load, cross-device sync)

Each guide includes:
- Quick test checklist for rapid testing
- Detailed step-by-step procedures
- Expected results and verification steps
- Common errors and troubleshooting

**Note**: Manual testing guides complement the automated unit tests. Use them to verify end-to-end functionality in the actual UI.


---

_Last updated: 2025-12-23_
