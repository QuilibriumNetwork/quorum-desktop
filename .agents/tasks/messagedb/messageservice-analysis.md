# MessageService.ts Analysis

**Last Updated**: 2025-12-16
**File**: `src/services/MessageService.ts`
**Current Size**: 4,337 lines
**Status**: Large but well-structured - refactoring deferred (low ROI)

> **⚠️ AI-Generated**: May contain errors. Verify before use.

---

## Current State

### Size & Growth

| Period | Lines | Change | Cause |
|--------|-------|--------|-------|
| Oct 2025 | 2,314 | - | Initial extraction from MessageDB |
| Dec 14, 2025 | 3,527 | +52% | Feature growth |
| Dec 16, 2025 | **4,337** | +23% | Message sending indicator |

**Growth rate**: +87% since initial extraction (Oct 2025)

### Method Breakdown (10 methods)

| Method | Lines | Change | Description |
|--------|-------|--------|-------------|
| `saveMessage()` | 428 | +8 | Save message to DB (handles 7 message types) |
| `updateMessageStatus()` | 44 | **NEW** | Optimistic status updates in cache |
| `addMessage()` | 737 | +95 | React Query cache updates |
| `submitMessage()` | 663 | **+257** | DM submission with sending indicator |
| `handleNewMessage()` | 1,354 | +9 | Incoming message handler |
| `sanitizeError()` | 20 | **NEW** | Private helper for error sanitization |
| `submitChannelMessage()` | 521 | +64 | Space/channel submission with sending indicator |
| `retryMessage()` | 118 | **NEW** | Retry failed channel messages |
| `retryDirectMessage()` | 193 | **NEW** | Retry failed direct messages |
| `deleteConversation()` | 101 | 0 | Cleanup operations |

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

## Duplication Patterns Found

### 1. Retry Method Structure (~50 lines duplicated)

`retryMessage()` and `retryDirectMessage()` share identical patterns:
- Status validation check (`sendStatus !== 'failed'`)
- Optimistic update to 'sending' (React Query cache update boilerplate)
- Try/catch with `sanitizeError` + `updateMessageStatus` on failure

### 2. Cache Update Boilerplate (10 occurrences)

```typescript
queryClient.setQueryData(key, (oldData) => ({
  pageParams: oldData.pageParams,
  pages: oldData.pages.map((page) => ({ ... }))
}))
```

This React Query infinite query update pattern appears 10 times throughout the file.

---

## Low-Risk Refactoring Opportunities

| Opportunity | Lines Saved | Risk | Verdict |
|-------------|-------------|------|---------|
| Extract `setOptimisticSendingStatus()` helper | ~30 | Low | Worth doing when touching retry logic |
| Unify retry method structure | ~40 | Medium | Different encryption (Triple vs Double Ratchet) |
| Extract cache update utility | ~50 | Medium | Loses context-specific clarity |

### Recommended: Extract setOptimisticSendingStatus()

The only low-risk extraction worth implementing:

```typescript
// Could extract from both retry methods (lines 3931-3948 and 4066-4083)
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

**Defer refactoring unless already touching the code.**

The file is large (4,337 lines) but well-structured:
- Consistent optimistic update flow
- Proper error handling with `sanitizeError()`
- Reuses `updateMessageStatus()` for status changes
- Clear separation between channel and DM retry logic

The ~30 lines saved from `setOptimisticSendingStatus()` extraction isn't worth a dedicated PR, but should be done opportunistically when modifying retry logic.

---

## Related Files

- [MessageDB Current State](./messagedb-current-state.md) - Overall refactoring status
- [handleNewMessage Refactor Plan](./messageservice-handlenewmessage-refactor.md) - ON HOLD

---

_Last updated: 2025-12-16_
_Next action: Extract `setOptimisticSendingStatus()` when modifying retry logic_
