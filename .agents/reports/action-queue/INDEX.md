# Action Queue Bug Index

> Quick reference for all Action Queue related bugs and issues.
>
> **Start here**: [000-action-queue-summary.md](000-action-queue-summary.md) - High-level overview of design decisions, bugs fixed, and lessons learned.

## Testing Purpose

**Primary Goal**: Verify that implementing the Action Queue has NOT introduced new bugs.

When investigating issues, we must determine:
1. **Is this a NEW bug introduced by Action Queue?** - Fix required
2. **Is this a PRE-EXISTING bug?** - Document, but not blocking Action Queue release
3. **Is this a NETWORK/INFRASTRUCTURE issue?** - External, not our code

### Classification Labels

| Label | Meaning |
|-------|---------|
| `action-queue-bug` | Bug introduced by Action Queue implementation |
| `pre-existing` | Bug exists in legacy path too |
| `network-issue` | External network/infrastructure problem |
| `test-environment` | Issue specific to test setup (e.g., many devices) |

## Bug Overview

| # | Bug | Status | Severity | Classification |
|---|-----|--------|----------|----------------|
| 001 | [DM Sending Indicator Hang](001-dm-sending-indicator-hang.md) | ✅ Fixed | High | `action-queue-bug` (error handling) + `pre-existing` (slow crypto) |
| 002 | [WebSocket Queue Starvation](002-websocket-queue-starvation.md) | 📋 Documented | Medium | `pre-existing` - Not Action Queue related |
| 003 | [DM Code Comparison Audit](003-DM-message-code-comparison-audit.md) | ✅ Complete | N/A | Audit - No new bugs found |
| 004 | [Space Message Code Comparison Audit](004-space-message-code-comparison-audit.md) | ✅ Fixed | 🚨 Critical | Audit - Found & fixed `pre-existing` bug in `submitChannelMessage()` |
| 005 | [DM Sync Non-Deterministic Failures](005-dm-sync-non-deterministic-failures.md) | 📋 Documented | Medium | `network-issue` - Messages sent but not delivered by network |
| 006 | [Plaintext Private Keys Bug](006-plaintext-private-keys-bug.md) | ✅ Fixed | 🚨 Critical | `action-queue-bug` - Identity keys stored unencrypted |
| 007 | [Plaintext Private Keys Fix](007-plaintext-private-keys-fix.md) | ✅ Implemented | N/A | Fix for 006 - Keys pulled from memory, not stored |
| 008 | [Endpoint Dependencies](008-endpoint-dependencies.md) | 📋 Reference | N/A | Quick reference for debugging endpoint failures |
| 009 | [DM Offline Registration Persistence](009-dm-offline-registration-persistence-fix.md) | ✅ Superseded | Medium | Replaced by offline-only routing (see 010) |
| 010 | [DM Registration Inbox Mismatch Fix](010-dm-registration-inbox-mismatch-fix.md) | ✅ Implemented | High | Offline-only Action Queue + stale state cleanup |

## Important: Network Issues

The Quorum network can experience intermittent issues unrelated to our code:
- Message delivery delays
- WebSocket disconnections
- Server-side timeouts

**Always consider network issues when debugging.** If an issue is intermittent and logs show messages being sent correctly, it may be network-related.

## Patterns Observed

### Error Handling Gaps
- Crypto operations (`NewDoubleRatchetSenderSession`) can throw unexpectedly
- Missing try/catch causes silent hangs

### Race Conditions
- Multiple `setQueryData` calls can cause React Query batching issues
- Cache state can change between operations

### Performance Issues
- Double Ratchet session creation is inherently slow (~1 sec/inbox)
- First-time messages to contacts with many devices are slow
- NOT caused by Action Queue - same in legacy path

## Common Diagnostic Commands

```javascript
// Check queue stats
await window.__actionQueue.getStats()

// View all tasks
await window.__messageDB.getAllQueueTasks()

// Force process queue
window.__actionQueue.processQueue()
```

## Feature Flags

| Flag | Location | Purpose |
|------|----------|---------|
| `DM_ACTION_QUEUE` | `src/config/features.ts` | Enable/disable Action Queue for DM sending |

## Related Documentation

- [Action Queue Feature Docs](../../docs/features/action-queue.md)
- [Message Sending Indicator Task](../../tasks/.done/message-sending-indicator.md)
- [DM Action Queue Handlers Task](../../tasks/dm-action-queue-handlers.md)

## Key Files

| File | Purpose |
|------|---------|
| `src/services/ActionQueueService.ts` | Core queue service |
| `src/services/ActionQueueHandlers.ts` | Task handlers |
| `src/components/context/ActionQueueContext.tsx` | React context |
| `src/types/actionQueue.ts` | Type definitions |

---

_Last Updated: 2025-12-23_
