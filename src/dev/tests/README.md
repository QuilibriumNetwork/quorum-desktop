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

---

## 🚀 Running Tests

### Run All Service Tests
```bash
yarn vitest src/dev/tests/services/ --run
```

### Run Specific Service
```bash
# MessageService tests
yarn vitest src/dev/tests/services/MessageService.unit.test.tsx --run

# SpaceService tests
yarn vitest src/dev/tests/services/SpaceService.unit.test.tsx --run

# InvitationService tests
yarn vitest src/dev/tests/services/InvitationService.unit.test.tsx --run

# SyncService tests
yarn vitest src/dev/tests/services/SyncService.unit.test.tsx --run

# EncryptionService tests
yarn vitest src/dev/tests/services/EncryptionService.unit.test.tsx --run

# ConfigService tests
yarn vitest src/dev/tests/services/ConfigService.unit.test.tsx --run
```

### Watch Mode (Development)
```bash
yarn vitest src/dev/tests/services/ --watch
```

---

## 📁 Directory Structure

```
src/dev/tests/
├── services/                    # Service unit tests
│   ├── MessageService.unit.test.tsx      (16 tests)
│   ├── SpaceService.unit.test.tsx        (13 tests)
│   ├── InvitationService.unit.test.tsx   (15 tests)
│   ├── SyncService.unit.test.tsx         (15 tests)
│   ├── EncryptionService.unit.test.tsx   (8 tests)
│   └── ConfigService.unit.test.tsx       (8 tests)
├── docs/                        # Manual testing guides (reference)
│   ├── TEST-MANUAL_ConfigService.md
│   ├── TEST-MANUAL_InvitationService.md
│   ├── TEST-MANUAL_SpaceService.md
│   └── test-implementation-guide.md
├── setup.ts                     # Global test setup (WebSocket/crypto mocks)
└── README.md                    # This file
```

---

## 📝 Test File Descriptions

### 1. MessageService.unit.test.tsx (16 tests)

**Purpose**: Validates MessageService message handling, routing, and persistence.

**Test Coverage**:
- Service construction and dependency injection (2 tests)
- Method signatures verification (6 tests)
- `submitMessage()` - P2P message submission (1 test)
- `handleNewMessage()` - Message routing for 7 message types (7 tests):
  - POST (text messages)
  - REACTION (emoji reactions)
  - REMOVE (message deletion)
  - JOIN (user join events)
  - LEAVE (user leave events)
  - KICK (user kick events)
  - UPDATE_PROFILE (profile updates)

**Key Validations**:
- Correct parameter order in method calls
- Message routing logic (inbox vs group messages)
- Database method calls (saveMessage, deleteMessage)
- Cache updates (queryClient.setQueryData)

---

### 2. SpaceService.unit.test.tsx (13 tests)

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

## 🛠️ Test Setup

### Global Setup (`setup.ts`)

Provides global mocks for:
- **WebSocket**: Mock WebSocket implementation
- **crypto**: Mock crypto API (getRandomValues, subtle)
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

_Last updated: 2025-10-03_
_Tests created: 2025-10-02 to 2025-10-03_
_Total test coverage: 75 tests across 6 services (100% passing)_
