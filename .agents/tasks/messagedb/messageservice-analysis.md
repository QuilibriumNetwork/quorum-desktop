# MessageService.ts Analysis

**Last Updated**: 2025-12-18
**File**: `src/services/MessageService.ts`
**Current Size**: 4,148 lines
**Status**: Large but well-structured - refactoring deferred (low ROI)

> **⚠️ AI-Generated**: May contain errors. Verify before use.

---

## Current State

### Size & Growth

| Period | Lines | Change | Cause |
|--------|-------|--------|-------|
| Oct 2025 | 2,314 | - | Initial extraction from MessageDB |
| Dec 14, 2025 | 3,527 | +52% | Feature growth |
| Dec 16, 2025 | 4,337 | +23% | Message sending indicator |
| Dec 18, 2025 (AM) | 4,397 | +1.4% | Action Queue integration |
| Dec 18, 2025 (PM) | **4,148** | **-5.7%** | Removed dead fallback code |

**Growth rate**: +79% since initial extraction (Oct 2025)

### Method Breakdown (11 methods)

| Method | Lines | Change | Description |
|--------|-------|--------|-------------|
| `saveMessage()` | 472 | 0 | Save message to DB (handles 7 message types) |
| `updateMessageStatus()` | 44 | 0 | Optimistic status updates in cache |
| `addMessage()` | 745 | 0 | React Query cache updates |
| `submitMessage()` | 521 | **-159** | DM submission via Action Queue (fallback removed) |
| `handleNewMessage()` | 1,354 | 0 | Incoming message handler |
| `sanitizeError()` | 20 | 0 | Private helper for error sanitization |
| `submitChannelMessage()` | 451 | **-90** | Space/channel submission via Action Queue (fallback removed) |
| `retryMessage()` | 122 | 0 | Retry failed channel messages |
| `retryDirectMessage()` | 196 | 0 | Retry failed direct messages |
| `deleteConversation()` | 101 | 0 | Cleanup operations |
| `setActionQueueService()` | 7 | 0 | Setter for ActionQueue dependency injection |

---

## Analysis History

### Dec 2025: Initial Refactoring Assessment

**What Was Analyzed:**
1. Extract edit time window constant (`15 * 60 * 1000` appears 4 times)
2. Extract edit validation logic (~30 lines duplicated 4 times)
3. Extract reaction handlers (~180 lines in 2 places)
4. Extract permission checks (~70 lines in 3+ places)
5. Extract edit history logic (~100 lines in 2 places)

**Feature Analyzer Verdict: Most Refactoring is Over-Engineering**

**Approved (minimal value):**
- Edit time constant → Add to `validation.ts` (saves ~0 lines, improves maintainability)
- Edit validation → Extract as private method (saves ~30 lines)

**Rejected as over-engineering:**
- **ReactionHandler.ts** - The "duplication" is intentional parallel implementation (DB vs Cache). They SHOULD mirror each other for consistency.
- **PermissionEvaluator.ts** - Already have `utils/permissions.ts`. The duplication is defense-in-depth security (validate on send AND receive).
- **Edit history extraction** - Too complex (6+ params), different contexts, minimal benefit.

**Key Insights:**
1. **Not all duplication is bad** — Reaction handling duplication ensures DB and cache stay in sync.
2. **Defense-in-depth is intentional** — Permission checks appear twice because:
   - `submitChannelMessage()` validates outgoing (current user's permissions)
   - `addMessage()` validates incoming (sender's permissions)
3. **File size isn't the problem** — Large but has clear method boundaries and consistent patterns.

---

### Dec 16, 2025: Message Sending Indicator Analysis

**New Code Added: +810 lines**

**New Methods:**
1. `updateMessageStatus()` (44 lines) - Clean helper for cache status updates
2. `sanitizeError()` (20 lines) - Private error sanitization helper
3. `retryMessage()` (118 lines) - Retry channel messages
4. `retryDirectMessage()` (193 lines) - Retry direct messages

**Expanded Methods:**
- `submitMessage()` +257 lines - Optimistic update logic, pre-signing, status management
- `submitChannelMessage()` +64 lines - Same pattern for channel messages

---

### Dec 18, 2025: Action Queue Integration

**Change: -189 lines** (net after cleanup)

Message sending now routes through the Action Queue for persistence and crash recovery.

**Key Changes:**
1. `setActionQueueService()` - New method for dependency injection (avoids circular deps)
2. `submitMessage()` & `submitChannelMessage()` - Now queue to ActionQueue instead of direct send
3. Signing happens **before** queueing, encryption happens **in handler** (enables safe retries)

**Architecture Impact:**
- MessageService no longer sends directly via WebSocket for messages
- Actual encryption + send logic moved to `ActionQueueHandlers.ts`
- Retry logic (`retryMessage`, `retryDirectMessage`) remains but is now secondary to queue retries

**See**: [Action Queue Documentation](../../docs/features/action-queue.md) for full architecture

**✅ Cleanup Completed:**
Dead `enqueueOutbound` fallback paths in `submitMessage()` and `submitChannelMessage()` were removed (~249 lines). These were defensive code from initial implementation that became dead code once ActionQueue was always initialized. Now includes a runtime guard that throws an error if ActionQueue is not initialized (fail-fast for bugs).

---

## Duplication Patterns Found

### ~~1. Dead Fallback Code (~250 lines)~~ — ✅ REMOVED

~~**Location**: `submitMessage()` lines 1510-1670, `submitChannelMessage()` lines 3609-3700~~

**Removed on Dec 18, 2025.** The dead `enqueueOutbound` fallback branches were removed, saving 249 lines. Now uses a runtime guard that throws an error if ActionQueue is not initialized.

### 2. Retry Methods Partially Obsolete (~300 lines)

**Location**: `retryMessage()` (122 lines), `retryDirectMessage()` (196 lines)

With ActionQueue's automatic retry mechanism, manual retry methods are now secondary. They duplicate:
- Triple Ratchet encryption (same as `sendChannelMessage` handler)
- Double Ratchet encryption (same as `sendDm` handler)
- Status update patterns
- Error handling

**Note**: These may still be needed for UI-triggered retry of messages that failed permanently (after max retries).

### 3. Retry Method Structure (~50 lines duplicated)

`retryMessage()` and `retryDirectMessage()` share identical patterns:
- Status validation check (`sendStatus !== 'failed'`)
- Optimistic update to 'sending' (React Query cache update boilerplate)
- Try/catch with `sanitizeError` + `updateMessageStatus` on failure

### 4. Cache Update Boilerplate (10 occurrences)

```typescript
queryClient.setQueryData(key, (oldData) => ({
  pageParams: oldData.pageParams,
  pages: oldData.pages.map((page) => ({ ... }))
}))
```

This React Query infinite query update pattern appears 10 times throughout the file.

---

## Refactoring Opportunities

### Action Queue Related

| Opportunity | Lines Saved | Risk | Verdict |
|-------------|-------------|------|---------|
| ~~Remove dead fallback code~~ | ~~249~~ | ~~Low~~ | ✅ **DONE** |
| Refactor retry methods to use ActionQueue | ~200 | Medium | Worth considering |
| Move encryption entirely to handlers | ~100 | Medium-High | Over-engineering |

#### ✅ COMPLETED: Remove Dead Fallback Code

**Completed Dec 18, 2025** — Saved 249 lines.

The dead `enqueueOutbound` fallback branches in `submitMessage()` and `submitChannelMessage()` were removed. Added runtime guards that throw an error if ActionQueue is not initialized (fail-fast for bugs).

#### Consider: Refactor Retry Methods

**Risk: Medium** | **Lines Saved: ~200**

`retryMessage()` and `retryDirectMessage()` could potentially be simplified to just:
1. Re-enqueue the failed message to ActionQueue
2. Let ActionQueue handlers do the encryption

**Why medium risk:**
- Need to verify retry UI still works correctly
- Must handle edge case of permanent failures (max retries exceeded)
- ActionQueue retry uses exponential backoff, manual retry is immediate

#### Not Recommended: Move All Encryption to Handlers

**Risk: High** | **Over-Engineering**

Moving all encryption logic from MessageService to ActionQueueHandlers would centralize it but:
- Edit/pin/reaction messages still use `enqueueOutbound` (not ActionQueue)
- Would require significant restructuring
- Current split (sign in MessageService, encrypt in handlers) is intentional

---

### Original Low-Risk Opportunities

| Opportunity | Lines Saved | Risk | Verdict |
|-------------|-------------|------|---------|
| Extract `setOptimisticSendingStatus()` helper | ~30 | Low | Worth doing when touching retry logic |
| Unify retry method structure | ~40 | Medium | Different encryption (Triple vs Double Ratchet) |
| Extract cache update utility | ~50 | Medium | Loses context-specific clarity |

### Low Priority: Extract setOptimisticSendingStatus()

```typescript
// Could extract from both retry methods (lines 3991-4008 and 4126-4143)
private setOptimisticSendingStatus(
  queryClient: QueryClient,
  spaceId: string,
  channelId: string,
  messageId: string
) {
  queryClient.setQueryData(
    buildMessagesKey({ spaceId, channelId }),
    (oldData: InfiniteData<any>) => {
      if (!oldData?.pages) return oldData;
      return {
        pageParams: oldData.pageParams,
        pages: oldData.pages.map((page) => ({
          ...page,
          messages: page.messages.map((msg: Message) =>
            msg.messageId === messageId
              ? { ...msg, sendStatus: 'sending' as const, sendError: undefined }
              : msg
          ),
          nextCursor: page.nextCursor,
          prevCursor: page.prevCursor,
        })),
      };
    }
  );
}
```

**Impact**: Saves ~30 lines, improves consistency, zero risk.

---

## handleNewMessage Refactoring (ON HOLD)

The `handleNewMessage` function (1,354 lines) remains the only meaningful size-reduction opportunity.

**Target**: 1,354 lines → 400-500 lines using Handler Registry Pattern

**Blockers:**
- Requires comprehensive test coverage first
- Import chain issue blocks test creation (MessageService can't be imported in tests)
- Risk outweighs benefit for current feature velocity

**See**: [messageservice-handlenewmessage-refactor.md](./messageservice-handlenewmessage-refactor.md) for full plan (ON HOLD)

---

## Verdict

**No immediate action required.**

The file is large (4,148 lines) but well-structured:
- Consistent optimistic update flow
- Proper error handling with `sanitizeError()`
- Reuses `updateMessageStatus()` for status changes
- Clear separation between channel and DM retry logic

### Completed

✅ **Removed dead `enqueueOutbound` fallback paths** — saved 249 lines (Dec 18, 2025)

### Defer

- Retry method refactoring (medium risk, needs careful testing)
- `setOptimisticSendingStatus()` extraction (low value)
- `handleNewMessage` refactoring (blocked by test infrastructure)

---

## Related Files

- [MessageDB Current State](./messagedb-current-state.md) - Overall refactoring status
- [handleNewMessage Refactor Plan](./messageservice-handlenewmessage-refactor.md) - ON HOLD
- [Action Queue](../../docs/features/action-queue.md) - Background task processing system

---

_Last updated: 2025-12-18_
_Next action: None - file is in good shape_
