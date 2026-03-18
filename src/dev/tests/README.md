# Quorum Desktop Test Suite

Comprehensive test suite covering services, utilities, components, and database layers.

**19 test files | 384 tests total**

### What We Test:
- Services call correct methods with correct parameters
- Services handle errors properly (invalid inputs, missing data)
- Service construction with dependency injection
- Method signatures (parameter counts)
- Early return conditions and validation logic
- React component rendering, interactions, and accessibility
- Utility function correctness and edge cases
- Database store operations (save, retrieve, delete)

### What We DON'T Test:
- Real database operations (we trust MessageDB class)
- Real encryption (we trust Quilibrium SDK)
- Real IndexedDB (we trust browser API)
- Real WebSocket operations

**Philosophy**: We trust underlying implementations work correctly. We test that our services **use them correctly**.

### Why These Tests Matter

**If tests pass**, you know:
- Control flow executes correctly (enqueue -> process -> handler -> success/failure)
- Services call each other with correct parameters
- Error routing works (permanent vs retryable errors, auth errors)
- Business logic is correct (deduplication, backoff timing, gating conditions)
- Components render correctly and handle user interactions
- Utility functions produce correct output for all inputs

**If tests pass but app doesn't work**, the issue is in:
- Real encryption (SDK behavior)
- Real database (IndexedDB schema mismatch)
- Real network (API/WebSocket failures)

**Practical value**: Regression protection during refactoring. If you restructure code and tests still pass, the behavior contract is preserved. Manual testing still required for end-to-end verification.

---

## Directory Structure

```
src/dev/tests/
├── services/                    # Service unit tests (174 tests)
│   ├── ActionQueueHandlers.unit.test.ts  (63 tests)
│   ├── ActionQueueService.unit.test.ts   (41 tests)
│   ├── ThreadService.unit.test.ts        (45 tests)
│   ├── MessageService.unit.test.tsx      (26 tests)
│   ├── SpaceService.unit.test.tsx        (9 tests)
│   ├── InvitationService.unit.test.tsx   (11 tests)
│   ├── SyncService.unit.test.tsx         (11 tests)
│   ├── EncryptionService.unit.test.tsx   (7 tests)
│   ├── ConfigService.unit.test.tsx       (6 tests)
│   └── channelThreadsWritePaths.test.ts  (4 tests)
├── utils/                       # Utility function tests (106 tests)
│   ├── reservedNames.test.ts             (42 tests)
│   ├── mentionUtils.enhanced.test.ts     (31 tests)
│   ├── mentionHighlighting.test.ts       (20 tests)
│   ├── messageGrouping.unit.test.ts      (13 tests)
│   └── README.md
├── components/                  # React component tests (52 tests)
│   ├── Button.test.tsx                   (27 tests)
│   ├── Modal.test.tsx                    (14 tests)
│   ├── ThreadListItem.test.tsx           (6 tests)
│   ├── ThreadsListPanel.test.tsx         (5 tests)
│   └── README.md
├── db/                          # Database store tests (3 tests)
│   └── channelThreads.test.ts            (3 tests)
├── hooks/                       # React hooks tests (placeholder)
│   └── README.md
├── integration/                 # Integration tests (placeholder)
│   └── README.md
├── e2e/                         # End-to-end tests (placeholder)
│   └── README.md
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

## Test Summary

| Category | Files | Tests | Description |
|----------|-------|-------|-------------|
| Services | 10 | 174 | Service unit tests with mocked dependencies |
| Utils | 4 | 106 | Utility function tests |
| Components | 4 | 52 | React component rendering and accessibility |
| Database | 1 | 3 | IndexedDB store operations |
| **Total** | **19** | **384** | |

---

## Test Naming Conventions

- **Service tests**: `ServiceName.unit.test.tsx`
- **Utility tests**: `utilityName.test.ts` or `utilityName.unit.test.ts`
- **Component tests**: `ComponentName.test.tsx`
- **Hook tests**: `useHookName.test.ts`
- **Integration tests**: `featureName.integration.test.tsx`
- **E2E tests**: `userFlow.e2e.test.ts`

---

## Running Tests

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

# Database tests only
yarn vitest src/dev/tests/db/ --run

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

## Detailed Test Descriptions

### Services

#### 1. ActionQueueHandlers.unit.test.ts (63 tests)

**Purpose**: Validates all 16 ActionQueue task handlers for Space and DM actions.

**Test Coverage**:
- Handler registry (2 tests): all 15 action types registered, unknown types return undefined
- save-user-config (3 tests)
- update-space (3 tests)
- kick-user (3 tests)
- mute-user (2 tests), unmute-user (1 test)
- reaction - Space (2 tests)
- pin-message (2 tests), unpin-message (1 test)
- edit-message (2 tests)
- delete-message (3 tests)
- send-channel-message (5 tests): encrypt/send via Triple Ratchet, deleted handling, permanent errors, onFailure
- send-dm (4 tests): keyset required, no sessions error, permanent errors, onFailure
- reaction-dm (2 tests), delete-dm (2 tests), edit-dm (3 tests)
- Error sanitization (2 tests): network and encryption errors
- Handler messages (3 tests): failureMessage, silent handlers, silent success
- Context contract validation (4 tests): send-channel-message, send-dm, kick-user, reaction fields
- SDK call verification (2 tests): DoubleRatchetInboxEncrypt, getEncryptAndSendToSpace
- Error classification edge cases (3 tests): "was deleted", network retryable, delete idempotent
- Message status update contracts (2 tests): Space and DM patterns

---

#### 2. ActionQueueService.unit.test.ts (41 tests)

**Purpose**: Validates ActionQueueService queue mechanics for background task processing.

**Test Coverage**:
- Service construction (2 tests)
- Keyset management (4 tests): get/set/clear, processQueue trigger
- Task enqueueing (6 tests): add/return ID, deduplication, size limits, prune old
- Queue processing (7 tests): online/offline, keyset gate, handler init, sequential
- Task execution (6 tests): success, permanent/transient error, max retries, auth error, onFailure
- Multi-tab safety (4 tests): status gating, timestamps, grace period
- Start/stop (3 tests): reset stuck, interval management, stop
- Handler not found (1 test)
- Exponential backoff (2 tests): increasing delays, max cap
- Context integrity (1 test): keyset leakage detection
- Task key format (2 tests): lookup consistency, deduplication
- Handler-service contract (3 tests): context unchanged, error to isPermanentError, onFailure

---

#### 3. ThreadService.unit.test.ts (45 tests)

**Purpose**: Validates comprehensive thread service operations.

**Test Coverage**:
- `isThreadAuthorized` - Authorization checks
- `handleThreadReceive` - Thread creation, updates, removal, closure
- `handleThreadReplyReceive` - Reply handling
- `handleThreadCache` - Cache management for threads
- `handleThreadReplyCache` - Cache management for replies
- `handleThreadDeletedMessageCache` - Deleted message cleanup
- `handleThreadSend` - Thread send operations
- `handleThreadSendPostBroadcast` - Post-broadcast operations with idempotency and permission enforcement

---

#### 4. MessageService.unit.test.tsx (26 tests)

**Purpose**: Validates MessageService message handling, routing, and persistence.

**Test Coverage**:
- `submitMessage()` - P2P message submission (2 tests)
- `handleNewMessage()` - Message routing for 7 message types (7 tests): POST, REACTION, REMOVE, JOIN, LEAVE, KICK, UPDATE_PROFILE
- `addMessage()` - Cache updates for DM and Space messages (3 tests)
- `saveMessage()` - Database persistence (3 tests)
- `deleteConversation()` - Message deletion (1 test)
- `submitChannelMessage()` - Channel message submission (1 test)
- `encryptAndSendToSpace()` - Triple Ratchet encryption helper (7 tests): save timing options, ephemeral field stripping

---

#### 5. InvitationService.unit.test.tsx (11 tests)

**Purpose**: Validates InvitationService invite creation, validation, and processing.

**Test Coverage**:
- Service construction (2 tests)
- Method signatures (5 tests)
- `constructInviteLink()` - Invite URL construction (1 test)
- `processInviteLink()` - Invite validation (4 tests): invalid format, missing spaceId/configKey, API call
- `sendInviteToUser()` - Invite sending workflow (1 test)
- `joinInviteLink()` - Join validation (1 test)
- `generateNewInviteLink()` - Method existence (1 test)

---

#### 6. SyncService.unit.test.tsx (11 tests)

**Purpose**: Validates SyncService space synchronization operations.

**Test Coverage**:
- Service construction (2 tests)
- Method signatures (6 tests)
- `initiateSync()` - Early return conditions (2 tests): no sync info, empty candidates
- `sendVerifyKickedStatuses()` - Kicked user detection (3 tests): no kicked, detect kicks, join after kick
- `informSyncData()` - Sync info validation (2 tests): matching inbox, equal/greater remote data

---

#### 7. SpaceService.unit.test.tsx (9 tests)

**Purpose**: Validates SpaceService space/channel management operations.

**Test Coverage**:
- Service construction (2 tests)
- Method signatures (6 tests)
- `sendHubMessage()` - Hub message creation (1 test)
- `deleteSpace()` - Space deletion with hub key validation (2 tests)
- `kickUser()` - User kick with permission checks (2 tests)

**Note**: Uses WASM crypto operations. Tests focus on signatures and error handling.

---

#### 8. EncryptionService.unit.test.tsx (7 tests)

**Purpose**: Validates EncryptionService encryption state management and key operations.

**Test Coverage**:
- Service construction (2 tests)
- Method signatures (2 tests)
- `deleteEncryptionStates()` - State cleanup (3 tests): delete all, empty states, states without inboxId
- `ensureKeyForSpace()` - Key generation/retrieval (1 test): early return for existing key

---

#### 9. ConfigService.unit.test.tsx (6 tests)

**Purpose**: Validates ConfigService user configuration management.

**Test Coverage**:
- Service construction (2 tests)
- Method signatures (2 tests)
- `getConfig()` - Configuration retrieval (2 tests): default config, stored config
- `saveConfig()` - Configuration persistence (2 tests): updated timestamp, skip sync when allowSync=false

---

#### 10. channelThreadsWritePaths.test.ts (4 tests)

**Purpose**: Validates channel thread helper functions.

**Test Coverage**:
- `buildChannelThreadFromCreate` - Thread creation with hasParticipated logic
- `updateChannelThreadOnReply` - Reply count increment and lastActivityAt updates

---

### Utils

#### 11. reservedNames.test.ts (42 tests)

**Purpose**: Validates reserved name validation and anti-impersonation logic.

**Test Coverage**:
- `normalizeHomoglyphs` - Homoglyph normalization (1->i, 0->o, @->a, etc.)
- `isMentionReserved` / `isEveryoneReserved` - Mention keyword detection (everyone, here, mod, manager)
- `isImpersonationName` - Impersonation detection with word boundary analysis
- `getReservedNameType` - Name type classification
- `isReservedName` - Combined validation

---

#### 12. mentionUtils.enhanced.test.ts (31 tests)

**Purpose**: Validates mention extraction with backward compatibility.

**Test Coverage**:
- User mentions - old (@<id>) and new (@[name]<id>) formats
- Channel mentions extraction
- @everyone handling with permissions
- Role mentions extraction
- Backward compatibility with legacy formats
- Rate limiting - security cap at 20 mentions per message

---

#### 13. mentionHighlighting.test.ts (20 tests)

**Purpose**: Validates mention detection and highlighting in message text.

**Test Coverage**:
- `containsMentions` - Mention detection for users, channels, roles, @everyone
- `highlightMentions` - HTML generation for highlighted mentions
- Performance optimizations - HTML escaping, code block exclusion

---

#### 14. messageGrouping.unit.test.ts (13 tests)

**Purpose**: Validates message grouping utilities for chat display.

**Test Coverage**:
- `getStartOfDay` - Day boundary calculation
- `shouldShowDateSeparator` - Separator detection between messages
- `getDateLabel` - Date label formatting
- `groupMessagesByDay` - Message grouping by day
- `generateListWithSeparators` - List generation with date separators

---

### Components

#### 15. Button.test.tsx (27 tests)

**Purpose**: Validates Button component rendering and accessibility.

**Test Coverage**:
- CSS class rendering for all type variants (primary, secondary, subtle, danger, etc.)
- Size variants, disabled state, icon rendering, full-width layout
- Tooltip support, click handling
- Accessibility: focus, keyboard navigation, aria-label

---

#### 16. Modal.test.tsx (14 tests)

**Purpose**: Validates Modal component rendering and accessibility.

**Test Coverage**:
- Visibility control, title rendering, close button handling
- Size variants (small, medium, large), padding control, title alignment
- Escape key handling
- Accessibility: role="dialog", aria-modal, aria-labelledby

---

#### 17. ThreadListItem.test.tsx (6 tests)

**Purpose**: Validates ThreadListItem component rendering.

**Test Coverage**:
- Custom title and titleSnapshot fallback
- Closed thread lock icon display
- Click handling
- Reply count display with singular/plural handling

---

#### 18. ThreadsListPanel.test.tsx (5 tests)

**Purpose**: Validates ThreadsListPanel component rendering.

**Test Coverage**:
- Section headers (joined, active, older)
- Empty state handling
- Search filtering
- No-results state

---

### Database

#### 19. channelThreads.test.ts (3 tests)

**Purpose**: Validates MessageDB channel_threads IndexedDB store.

**Test Coverage**:
- Save and retrieve threads by channel
- Channel-specific filtering
- Deletion by threadId

---

## Test Setup

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

      // VERIFY: Method called with correct parameters
      expect(mockDeps.messageDB.methodName).toHaveBeenCalledWith(
        expect.objectContaining({ /* expected params */ })
      );
    });
  });
});
```

---

## Additional Documentation

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

_Last updated: 2026-03-18_
