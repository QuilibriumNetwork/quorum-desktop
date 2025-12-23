# Action Queue Summary

> **Start here** for a high-level overview of the Action Queue system, its current state, bugs fixed, and lessons learned.

**Status**: Production-ready with known limitations
**Created**: 2025-12-23

---

## Current State

The Action Queue is **fully operational** with the following capabilities:

| Category | Works Fully | Works Offline-Only | Requires Online |
|----------|-------------|-------------------|-----------------|
| Space messages | ✅ Send, edit, delete, pin, react | - | - |
| DM messages | - | ⚠️ Send, edit, delete, react | New conversations |
| User config | ✅ Folders, settings, profile | - | - |
| Space settings | ✅ Update | - | Create/delete |
| Moderation | ✅ Kick, mute, unmute | - | - |

**Why DMs are "offline-only"**: The Action Queue routes DM actions only when `navigator.onLine === false`. When online, DMs use the legacy path which handles new devices and session creation. This hybrid approach was a deliberate design decision (see [010](010-dm-registration-inbox-mismatch-fix.md)).

---

## Design Decisions

### 1. Private Keys Never Stored in Queue

**Decision**: Keys pulled from memory at processing time, never serialized to IndexedDB.

**Why**: Converting from memory-only to persistent queue initially stored keysets in task context. This bypassed the SDK's AES-GCM encryption, exposing keys in plaintext.

**Implementation**: Queue gates on `setUserKeyset()` after passkey auth. Handlers call `actionQueueService.getUserKeyset()` at processing time.

**Report**: [006](006-plaintext-private-keys-bug.md) → [007](007-plaintext-private-keys-fix.md)

---

### 2. DM Actions: Offline-Only Routing

**Decision**: Use Action Queue for DMs **only when offline**. Online DMs use legacy path.

**Why**: The Action Queue can't create new Double Ratchet sessions for counterparty's new devices (would require storing registration data, which is a security concern). The legacy path handles this correctly.

**Trade-off**:
- Online (99% of cases): Full functionality via legacy path
- Offline: Queue to existing sessions only; new devices wait until back online

**Report**: [010](010-dm-registration-inbox-mismatch-fix.md)

---

### 3. Sign Once, Encrypt on Retry

**Decision**: Message signing happens **before** queueing; encryption happens **in** the handler.

**Why**:
- Signing uses Ed448 with the same nonce → produces identical signature
- Encryption advances ratchet state → different ciphertext on retry
- This ensures retries don't create duplicate messages

---

### 4. Sequential Processing (No Parallelism)

**Decision**: Tasks processed one at a time, not in parallel.

**Why**:
- Simpler to reason about
- Avoids race conditions in encryption state updates
- Prevents server overload
- Maintains message ordering

---

### 5. Stale Encryption State Cleanup

**Decision**: Clean stale DM encryption states on DM page load, not in the queue handler.

**Why**: Keeps queue handler offline-capable (no network calls during execution). Cleanup runs when fresh registration data is available from React Query.

**Implementation**: [DirectMessage.tsx:198-245](src/components/direct/DirectMessage.tsx#L198-L245)

---

## Bugs Fixed

| # | Bug | Severity | Root Cause | Key Insight |
|---|-----|----------|------------|-------------|
| [001](001-dm-sending-indicator-hang.md) | DM "Sending..." hangs | High | Missing try/catch in session loop | Always wrap crypto operations |
| [004](004-space-message-code-comparison-audit.md) | Encryption state not saved | Critical | `submitChannelMessage()` missing save | Audit found pre-existing bug |
| [006](006-plaintext-private-keys-bug.md) | Keys stored in plaintext | Critical | Serialized keysets to IndexedDB | Don't store what you can retrieve |
| [010](010-dm-registration-inbox-mismatch-fix.md) | DMs to stale inboxes | Critical | Three-layer caching | Cleanup on page load + offline-only routing |

---

## Key Lessons Learned

### 1. Don't Store What You Don't Need

When serializing to persistence, ask:
- Does this data **need** to be persisted?
- Can it be retrieved from an already-authenticated context?
- Am I bypassing encryption used elsewhere?

**Example**: Keys exist in memory after auth → don't store in queue

### 2. Audit Both Paths

The Action Queue audit ([003](003-DM-message-code-comparison-audit.md), [004](004-space-message-code-comparison-audit.md)) found bugs in the **legacy** code, not the new code. Code comparison audits catch more than just new bugs.

### 3. Crypto Operations Need Defensive Code

Crypto libraries throw unexpectedly. Always:
- Wrap in try/catch
- Log progress for long operations
- Continue to next item on failure when appropriate

### 4. Caching Creates Staleness

Three-layer caching (API → React Query → IndexedDB encryption states) caused DM failures. Solutions:
- Reduce `staleTime` (5 min vs Infinity)
- Cleanup on data refresh
- Route to code that handles edge cases when online

### 5. Hybrid Routing Beats All-Or-Nothing

Instead of "always use Action Queue" or "never use it", the offline-only pattern gives the best of both:
- Online: Full session creation and cleanup
- Offline: Persistence and crash recovery

---

## Known Limitations

| Limitation | Why | Impact |
|------------|-----|--------|
| Can't create new DM sessions offline | Would require storing registration data | New conversations fail offline (expected) |
| New counterparty devices while offline | Queue can't create sessions without registration | Messages miss new devices until resend online |
| Cleanup requires page visit | Runs in DirectMessage.tsx | Stale states persist until user views DM |

---

## Architecture Summary

```
User Action → Optimistic UI Update → Queue to IndexedDB → Background Processing
                    ↓                        ↓                     ↓
              React Query cache         Survives refresh      Keyset gate
              (instant feedback)        (offline support)     (security)
```

Key files:
- [ActionQueueService.ts](src/services/ActionQueueService.ts) - Core queue logic
- [ActionQueueHandlers.ts](src/services/ActionQueueHandlers.ts) - 15 task handlers
- [ActionQueueContext.tsx](src/components/context/ActionQueueContext.tsx) - React integration

---

## Testing

```bash
# Run all Action Queue tests (98 tests)
yarn vitest src/dev/tests/services/ActionQueue --run
```

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `ActionQueueService.unit.test.ts` | 42 | Queue mechanics, retry logic, multi-tab safety |
| `ActionQueueHandlers.unit.test.ts` | 56 | All 15 handlers, context contracts, error classification |

---

## Report Index

All reports in chronological order:

| # | Report | Type |
|---|--------|------|
| 001 | [DM Sending Indicator Hang](001-dm-sending-indicator-hang.md) | Bug fix |
| 002 | [WebSocket Queue Starvation](002-websocket-queue-starvation.md) | Pre-existing doc |
| 003 | [DM Code Comparison Audit](003-DM-message-code-comparison-audit.md) | Audit |
| 004 | [Space Message Code Comparison Audit](004-space-message-code-comparison-audit.md) | Audit + fix |
| 005 | [DM Sync Non-Deterministic Failures](005-dm-sync-non-deterministic-failures.md) | Network issue |
| 006 | [Plaintext Private Keys Bug](006-plaintext-private-keys-bug.md) | Security bug |
| 007 | [Plaintext Private Keys Fix](007-plaintext-private-keys-fix.md) | Fix |
| 008 | [Endpoint Dependencies](008-endpoint-dependencies.md) | Reference |
| 009 | [DM Offline Registration Persistence](009-dm-offline-registration-persistence-fix.md) | Superseded |
| 010 | [DM Registration Inbox Mismatch Fix](010-dm-registration-inbox-mismatch-fix.md) | Final fix |

---

## Related Documentation

- **Feature doc**: [Action Queue](../../docs/features/action-queue.md) - Full technical documentation
- **Bug index**: [INDEX.md](INDEX.md) - Quick reference for all bugs
- **Feature flag**: `ENABLE_DM_ACTION_QUEUE` in [features.ts](src/config/features.ts)

---

*Created: 2025-12-23*
