# Service Unit Tests

This directory contains unit tests for the extracted services from MessageDB refactoring.

## Test Approach

These are **unit tests** using mocks and spies (`vi.fn()`), not integration tests.

### What We Test:
- ✅ Services call correct methods
- ✅ Services pass correct parameters
- ✅ Services handle errors properly
- ✅ Services update state correctly

### What We DON'T Test:
- ❌ Real database operations (we trust MessageDB class)
- ❌ Real encryption (we trust Quilibrium SDK)
- ❌ Real IndexedDB (we trust browser API)

### Philosophy:
We trust that the underlying implementations (MessageDB, encryption SDK, IndexedDB) work correctly.
We test that our services **use them correctly** by verifying function calls and parameters.

---

## Running Tests

```bash
# Run all service tests
yarn vitest src/dev/tests/services/

# Run specific service
yarn vitest src/dev/tests/services/MessageService.unit.test.tsx

# Watch mode for development
yarn vitest src/dev/tests/services/ --watch
```

---

## Test Structure

Each service test file follows this pattern:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceName } from '@/services/ServiceName';

describe('ServiceName - Unit Tests', () => {
  let service: ServiceName;
  let mockDeps: any;

  beforeEach(() => {
    // Setup mocks for all dependencies
    mockDeps = {
      messageDB: {
        saveMessage: vi.fn().mockResolvedValue(undefined),
        getMessage: vi.fn().mockResolvedValue(null),
      },
      queryClient: {
        setQueryData: vi.fn(),
        getQueryData: vi.fn().mockReturnValue(null),
      },
    };

    // Create service with mocked dependencies
    service = new ServiceName(mockDeps);
  });

  describe('functionName()', () => {
    it('should call correct methods with correct parameters', async () => {
      await service.functionName(params);

      // ✅ VERIFY: Method called
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalled();

      // ✅ VERIFY: Parameters correct
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: expect.any(String),
          content: 'expected content',
        })
      );
    });
  });
});
```

---

## Status

### Phase 3: Service Validation Tests

| Service | File | Tests | Status |
|---------|------|-------|--------|
| MessageService | `MessageService.unit.test.tsx` | 0/15 | ⬜ Not Started |
| SpaceService | `SpaceService.unit.test.tsx` | 0/10 | ⬜ Not Started |
| InvitationService | `InvitationService.unit.test.tsx` | 0/10 | ⬜ Not Started |
| SyncService | `SyncService.unit.test.tsx` | 0/8 | ⬜ Not Started |
| EncryptionService | `EncryptionService.unit.test.tsx` | 0/5 | ⬜ Not Started |
| ConfigService | `ConfigService.unit.test.tsx` | 0/5 | ⬜ Not Started |
| **TOTAL** | **6 files** | **0/53** | **⬜ 0%** |

---

## Success Criteria

Before Phase 4 optimization can begin:

- [ ] All 53 unit tests implemented
- [ ] All tests passing (100% pass rate)
- [ ] No app code changes required
- [ ] Full test suite runs in <5 seconds
- [ ] No TypeScript compilation errors
- [ ] All service functions have at least one test

---

## Documentation

For detailed implementation guidance, see:
- `.readme/tasks/messagedb/tests/CRITICAL_improve-test-coverage.md` - Full unit test strategy
- `.readme/tasks/messagedb/tests/TEST-COVERAGE-CHECKLIST.md` - Progress tracking

---

_Last updated: 2025-10-02_
