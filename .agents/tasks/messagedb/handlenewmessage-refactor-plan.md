# handleNewMessage Refactoring Plan

**Status**: ⚠️ BLOCKED - Test blocker must be resolved first
**Priority**: 🔴 CRITICAL
**Last Updated**: 2025-10-03

---

## Executive Summary

`handleNewMessage` is a 1,321-line God Function that mixes encryption, message routing, and business logic. Refactoring it requires a **Handler Registry Pattern** approach, NOT delegation to other services (encryption context cannot be leaked).

**Current Tests**: Insufficient (only 2 basic tests)
**Test Blocker**: MessageService cannot be imported in tests due to dependency chain
**Recommended Approach**: Incremental refactoring with manual testing + minimal snapshot tests

---

## Current State Analysis

### Function Structure (1,321 lines)

```
handleNewMessage
├─ Initialization Envelopes (140 lines, 796-936)
│  └─ New conversation setup, key exchange
├─ Direct Messages (201 lines, 947-1148)
│  ├─ Sender Confirmation (49 lines)
│  └─ Regular Double Ratchet (143 lines)
└─ Group Messages (857 lines, 1149-2006)
   ├─ Control Messages (13 types)
   │  ├─ join (119 lines)
   │  ├─ kick (134 lines)
   │  ├─ sync-peer-map (313 lines) ⚠️ LARGEST
   │  ├─ space-manifest (100 lines)
   │  ├─ leave (49 lines)
   │  ├─ rekey (22 lines)
   │  └─ verify-kicked (9 lines)
   └─ Sync Messages (8 types)
      ├─ sync-request (11 lines)
      ├─ sync-initiate (11 lines)
      ├─ sync-members (37 lines)
      ├─ sync-messages (38 lines)
      └─ sync-info (minimal)
```

### Why Delegation to Other Services Won't Work

**Problem**: All messages are decrypted within the group message ratchet. Delegating control/sync handlers to SpaceService/SyncService would require:
- ❌ Passing encryption state (breaks encapsulation)
- ❌ Duplicating crypto logic (code duplication)
- ❌ Creating distributed transactions (consistency issues)

**Solution**: Keep ALL handlers in MessageService, selectively delegate only pure business logic.

---

## Test Coverage Status

### Current Coverage: ❌ INSUFFICIENT

**Existing tests (2)**:
- `handleNewMessage` - preserves WebSocket routing
- `handleNewMessage` - handles different message types

**Coverage gaps**:
- ❌ No tests for 13 control message types
- ❌ No tests for 8 sync message types
- ❌ No signature verification tests
- ❌ No encryption state management tests
- ❌ No error path tests

**Risk**: 60% chance of production bugs without additional tests

### Test Blocker: Import Chain Issue

```
Test Files → MessageService
  → @/hooks (query keys)
    → hooks/index.ts → ./business/search + ./business/channels
      → IconName from @/components/primitives
        → primitives barrel tries to load .web.tsx/.native.tsx
          → ❌ FAILS in test environment
```

**Resolution**: Extract query key builders to `src/utils/queryKeys.ts` (~30 min work)

---

## Recommended Refactoring Strategy

### Option A: Fix Test Blocker + Comprehensive Tests (Safest)
**Time**: 2-3 days
**Risk**: 10-15% chance of bugs

1. Extract query keys to `src/utils/queryKeys.ts` (30 min)
2. Create 40-50 integration tests (12-18 hours) - see [handlenewmessage-tests.md](./handlenewmessage-tests.md)
3. Extract handlers incrementally with test safety net
4. 90% confidence in refactoring

**Pros**: Safe, comprehensive test coverage
**Cons**: High upfront time investment

---

### Option B: Incremental Refactoring with Manual Testing (Pragmatic) ✅ RECOMMENDED
**Time**: 4-6 days
**Risk**: 20-30% chance of bugs (mitigated by manual testing)

#### Phase 1: Fix Query Keys Import (30 min)
```bash
# Unblocks future testing
1. Create src/utils/queryKeys.ts
2. Move/re-export build*Key functions from hooks
3. Update MessageService imports
```

#### Phase 2: Extract Smallest Handlers First (1 day)
```typescript
// Start with handlers <25 lines (low risk)
1. handleVerifyKickedMessage (9 lines)
2. handleSyncRequestMessage (11 lines)
3. handleSyncInitiateMessage (11 lines)
4. handleRekeyMessage (22 lines)

// Manual test after EACH extraction
// Git commit after EACH success
```

#### Phase 3: Extract Medium Handlers (2 days)
```typescript
// Handlers 37-100 lines
1. handleSyncMessagesMessage (38 lines)
2. handleSyncMembersMessage (37 lines)
3. handleLeaveMessage (49 lines)
4. handleSpaceManifestMessage (100 lines)

// Manual test + snapshot test after each
```

#### Phase 4: Extract Large Handlers (2-3 days)
```typescript
// Handlers 119-313 lines (higher risk)
1. handleJoinMessage (119 lines)
2. handleKickMessage (134 lines)
3. handleSyncPeerMapMessage (313 lines) ← Do LAST

// Intensive manual testing + snapshot tests
```

#### Safety Measures
- ✅ Keep original function alongside handlers until validated
- ✅ Create snapshot tests as you go (5 min per handler)
- ✅ Manual test after EVERY extraction (use `.agents/tasks/messagedb/test-manual_MessageService.md`)
- ✅ Git commit after each successful extraction
- ✅ Rollback plan ready

#### Snapshot Test Pattern (Quick Safety Net)
```typescript
// Takes 5 min per handler
describe('handleJoinMessage', () => {
  it('should process join message correctly', async () => {
    const mockParams = createJoinMessageParams();
    const result = await messageService.handleJoinMessage(mockParams);
    expect(result).toMatchSnapshot(); // Baseline
  });
});
```

**Pros**:
- Start immediately
- Build test coverage incrementally
- Lower upfront time
- Rollback points at each commit

**Cons**:
- Higher risk than Option A
- Requires disciplined manual testing
- 20-30% chance of bugs

---

### Option C: Minimal Refactor (Conservative)
**Time**: 1-2 days
**Risk**: <5% chance of bugs

Don't extract handlers. Just organize:
1. Add section comments
2. Extract reusable crypto utils
3. Keep handlers inline but readable
4. Add JSDoc documentation

**Result**: Still 1,321 lines, but more maintainable

**Pros**: Very low risk, quick
**Cons**: Doesn't solve God Function problem

---

## Refactoring Target Metrics

| Metric | Before | Target |
|--------|--------|--------|
| `handleNewMessage` lines | 1,321 | 400-500 |
| Handler methods | 0 | 13+ (50-150 lines each) |
| Total MessageService | 2,314 | 1,500-1,700 |
| Test coverage | 2 tests | 40+ tests |

**Note**: Target is 400-500 lines (NOT <200) because encryption context must stay in MessageService

---

## Implementation Steps (Option B)

### Pre-Refactoring
- [ ] Fix query keys import issue (30 min)
- [ ] Set up snapshot testing infrastructure (30 min)
- [ ] Review manual test guide
- [ ] Create rollback checklist

### Extraction Order (by complexity)
1. [ ] `handleVerifyKickedMessage` (9 lines) + snapshot test
2. [ ] `handleSyncRequestMessage` (11 lines) + snapshot test
3. [ ] `handleSyncInitiateMessage` (11 lines) + snapshot test
4. [ ] `handleRekeyMessage` (22 lines) + snapshot test
5. [ ] `handleSyncInfoMessage` (minimal) + snapshot test
6. [ ] `handleSyncMessagesMessage` (38 lines) + snapshot test
7. [ ] `handleSyncMembersMessage` (37 lines) + snapshot test
8. [ ] `handleLeaveMessage` (49 lines) + snapshot test
9. [ ] `handleSpaceManifestMessage` (100 lines) + snapshot test
10. [ ] `handleJoinMessage` (119 lines) + comprehensive manual test
11. [ ] `handleKickMessage` (134 lines) + comprehensive manual test
12. [ ] `handleSyncPeerMapMessage` (313 lines) + intensive testing ⚠️

### Post-Extraction
- [ ] Extract crypto utilities (reduce duplication)
- [ ] Add JSDoc to all handlers
- [ ] Run full manual test suite
- [ ] Production build test
- [ ] Performance baseline comparison

---

## Risk Mitigation

### Rollback Procedure
```bash
# If anything breaks
git reset --hard HEAD~1  # Rollback last commit
yarn dev  # Test manually
# Analyze issue, fix, try again
```

### Critical Testing Points
After EVERY handler extraction:
1. ✅ Manual test the specific message type
2. ✅ Test related message types (e.g., join + leave)
3. ✅ Test in dev environment with real WebSocket
4. ✅ Check browser console for errors
5. ✅ Git commit if successful

### Red Flags to Watch
- Encryption state not updating
- Messages not appearing in UI
- Console errors about missing keys
- Navigation not working (kick messages)
- Sync not propagating changes

---

## Decision: Which Option?

### If you have 2-3 days for tests upfront:
→ **Option A** (safest, highest confidence)

### If you want to start immediately:
→ **Option B** (pragmatic, incremental) ✅ **RECOMMENDED**

### If extremely time-constrained:
→ **Option C** (minimal risk, doesn't solve core problem)

---

## Next Steps

1. **Decide on approach** (A, B, or C)
2. **If Option B**: Start with query keys fix
3. **Create tracking todo list** for extraction progress
4. **Begin with smallest handler** (verify-kicked, 9 lines)
5. **Build momentum** with quick wins

---

## Related Files

- [Integration Tests Plan](./handlenewmessage-tests.md) - Detailed test creation guide
- [Manual Test Guide](./test-manual_MessageService.md) - Manual testing procedures
- [Architecture Analysis](./handlenewmessage-analysis.md) - Full 400-line analysis (archive)
- [Phase 4 Plan](./messagedb-phase4-optimization.md) - Overall optimization plan (archive)

---

_Last updated: 2025-10-03_
_Created by consolidating: handlenewmessage-analysis.md, test-gap-analysis.md, messagedb-phase4-optimization.md, create-handlenewmessage-tests.md_
