# MessageService.ts Analysis

**File**: `src/services/MessageService.ts`
**Current Size**: ~4,150 lines
**Last Updated**: 2025-12-20

> **AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent (partial)

---

## Quick Summary

MessageService.ts is large (~4,150 lines) but handles 4-5 distinct concerns that could be separated. Per [best practices research](../../reports/file-size-best-practices_2025-12-20.md), size alone isn't the issue — the file has **multiple reasons to change**.

**Recommended action**: Extract `MessageCacheService` (~800 lines) as the safest, highest-value refactoring.

---

## Table of Contents

1. [Current State](#current-state) — Size history, method breakdown
2. [Service Extraction Opportunities](#service-extraction-opportunities) — **NEW** — Moving code to separate files
3. [Code Deduplication](#code-deduplication) — Extracting helper methods within the file
4. [Completed Refactoring](#completed-refactoring) — What's been done
5. [On Hold](#on-hold) — Deferred work
6. [Related Files](#related-files)

---

## Current State

### Size History

| Period | Lines | Change | Cause |
|--------|-------|--------|-------|
| Oct 2025 | 2,314 | - | Initial extraction from MessageDB |
| Dec 14, 2025 | 3,527 | +52% | Feature growth |
| Dec 16, 2025 | 4,337 | +23% | Message sending indicator |
| Dec 18, 2025 (AM) | 4,397 | +1.4% | Action Queue integration |
| Dec 18, 2025 (PM) | 4,148 | -5.7% | Removed dead fallback code |
| Dec 19, 2025 | 4,350 | +4.9% | Restored update-profile handler |
| Dec 20, 2025 | **~4,150** | **-4.6%** | Extracted `encryptAndSendToSpace()` helper |

**Growth rate**: +79% since initial extraction (Oct 2025)

### Method Breakdown (13 methods)

| Method | Lines | Concern | Description |
|--------|-------|---------|-------------|
| `addMessage()` | 750 | Cache | React Query cache updates |
| `updateMessageStatus()` | 44 | Cache | Optimistic status updates |
| `submitMessage()` | 521 | DM Submission | DM submission via Action Queue |
| `submitChannelMessage()` | ~470 | Channel Submission | Space/channel message submission |
| `handleNewMessage()` | 1,354 | Incoming | Incoming message handler (decryption + dispatch) |
| `saveMessage()` | 472 | Persistence | Save message to DB (7 message types) |
| `retryMessage()` | ~95 | Retry | Retry failed channel messages |
| `retryDirectMessage()` | 196 | Retry | Retry failed direct messages |
| `deleteConversation()` | 101 | Cleanup | Cleanup operations |
| `encryptAndSendToSpace()` | 70 | Crypto | Triple Ratchet encryption helper |
| `getEncryptAndSendToSpace()` | 10 | Crypto | Getter for ActionQueueHandlers |
| `sanitizeError()` | 20 | Utility | Error message sanitization |
| `setActionQueueService()` | 7 | DI | ActionQueue dependency injection |

### Concerns Analysis

The file handles **5 distinct concerns** (different "reasons to change"):

| Concern | Methods | Lines | Changes When... |
|---------|---------|-------|-----------------|
| **Cache** | `addMessage`, `updateMessageStatus` | ~800 | React Query patterns change |
| **DM Submission** | `submitMessage` | ~520 | DM encryption/ActionQueue changes |
| **Channel Submission** | `submitChannelMessage` | ~470 | Space permissions/Triple Ratchet changes |
| **Incoming Messages** | `handleNewMessage` | ~1,350 | New message types added |
| **Retry/Cleanup** | `retryMessage`, `retryDirectMessage`, `deleteConversation` | ~390 | Error handling strategy changes |

---

## Service Extraction Opportunities

> **Research**: See [File Size Best Practices Report](../../reports/file-size-best-practices_2025-12-20.md) for decision framework.

### Priority 1: MessageCacheService (~800 lines)

**Extract**: `addMessage()` + `updateMessageStatus()`

| Factor | Assessment |
|--------|------------|
| **Lines moved** | ~800 |
| **Risk** | Low |
| **Reason to extract** | Pure React Query logic, no crypto, no DB writes |
| **Testability gain** | High — can unit test cache operations in isolation |
| **Dependencies** | QueryClient (injected), messageDB (read-only lookups) |

**New file**: `src/services/MessageCacheService.ts`

```typescript
export class MessageCacheService {
  constructor(private messageDB: MessageDB) {}

  addMessage(queryClient, spaceId, channelId, message, options): void
  updateMessageStatus(queryClient, spaceId, channelId, messageId, status, error?): void
}
```

### Priority 2: MessageReactionService (~200 lines)

**Extract**: Reaction handling from `saveMessage()` and `addMessage()`

| Factor | Assessment |
|--------|------------|
| **Lines moved** | ~200 |
| **Risk** | Low |
| **Reason to extract** | Self-contained, duplicated logic across save/add |
| **Testability gain** | Medium |

### Priority 3: ChannelMessageService (~470 lines)

**Extract**: `submitChannelMessage()`

| Factor | Assessment |
|--------|------------|
| **Lines moved** | ~470 |
| **Risk** | Medium |
| **Reason to extract** | Clear boundary, uses already-extracted `encryptAndSendToSpace` |
| **Complication** | Needs access to messageDB, queryClient, encryptAndSendToSpace |

### Not Recommended

| What | Why Not |
|------|---------|
| `handleNewMessage()` | Too tightly coupled to decryption + 7 injected callbacks |
| Decryption logic | High risk of crypto bugs, complex error handling |
| `submitMessage()` | Tied to ActionQueue initialization flow |

---

## Code Deduplication

Small helpers that reduce duplication **within** the file (not extraction to new files).

### Remaining Opportunities

| Pattern | Lines Saved | Risk | Status |
|---------|-------------|------|--------|
| Extract `generateMessageId()` helper | ~25 | Low | Worth doing |
| Extract `signMessage()` helper | ~30 | Medium | Worth doing |
| Extract `setOptimisticSendingStatus()` | ~30 | Low | Low priority |

#### generateMessageId() — Recommended

```typescript
private async generateMessageId(
  nonce: string,
  type: string,
  senderId: string,
  content: object
): Promise<ArrayBuffer> {
  return crypto.subtle.digest(
    'SHA-256',
    Buffer.from(nonce + type + senderId + canonicalize(content), 'utf-8')
  );
}
```

**Location**: Duplicated in edit-message, pin-message, update-profile handlers.

#### signMessage() — Recommended

```typescript
private async signMessage(
  spaceId: string,
  message: Message,
  messageId: ArrayBuffer,
  options: { forceSign?: boolean } = {}
): Promise<void> {
  if (!options.forceSign) return; // Simplified; actual logic checks repudiability

  const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
  message.publicKey = inboxKey.publicKey;
  message.signature = Buffer.from(
    JSON.parse(ch.js_sign_ed448(...)),
    'base64'
  ).toString('hex');
}
```

**Note**: `update-profile` always signs; `edit`/`pin` check repudiability setting.

---

## Completed Refactoring

| Date | What | Lines Saved | Details |
|------|------|-------------|---------|
| Dec 20, 2025 | Extracted `encryptAndSendToSpace()` | ~200 | [Task file](./messageservice-extract-encrypt-helper.md) |
| Dec 18, 2025 | Removed dead fallback code | 249 | Cleaned up `enqueueOutbound` paths |

### encryptAndSendToSpace() Details

Centralized Triple Ratchet encryption pattern with options:
- `stripEphemeralFields` — For retry scenarios
- `saveStateAfterSend` — For ActionQueue (saves state after send)

**Unit tests added**: 7 tests in `MessageService.unit.test.tsx`

---

## On Hold

### handleNewMessage Refactoring

**Size**: 1,354 lines → target 400-500 lines

**Blockers**:
- Requires comprehensive test coverage first
- Import chain issue blocks test creation
- Risk outweighs benefit for current feature velocity

**Plan**: [messageservice-handlenewmessage-refactor.md](./messageservice-handlenewmessage-refactor.md)

### Retry Method Consolidation

`retryMessage()` and `retryDirectMessage()` could potentially use ActionQueue's retry mechanism, but manual retry is still needed for UI-triggered retries of permanently failed messages.

---

## Related Files

### Documentation
- [MessageDB Current State](./messagedb-current-state.md) — Overall refactoring status
- [File Size Best Practices](../../reports/file-size-best-practices_2025-12-20.md) — When to split files
- [Cryptographic Code Best Practices](../../reports/cryptographic-code-best-practices_2025-12-20.md) — Abstraction for crypto

### Task Files
- [Extract encryptAndSendToSpace](./messageservice-extract-encrypt-helper.md) — ✅ Completed
- [handleNewMessage Refactor Plan](./messageservice-handlenewmessage-refactor.md) — On Hold

### Feature Documentation
- [Action Queue](../../docs/features/action-queue.md) — Background task processing

---

_Last updated: 2025-12-20_
