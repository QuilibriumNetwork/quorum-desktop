---
type: task
title: MessageDB Refactoring - Current State
status: in-progress
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# MessageDB Refactoring - Current State

**Last Updated**: 2025-12-20


> **⚠️ AI-Generated**: May contain errors. Verify before use.

---

## Overview

The MessageDB refactoring successfully extracted 6 services from the original 5,650-line monolithic file. MessageService.ts has grown to ~4,150 lines with 5 distinct concerns.

**Dec 20, 2025**: New direction based on [best practices research](../../reports/file-size-best-practices_2025-12-20.md):
- `handleNewMessage` refactoring is **NOT RECOMMENDED** (high risk, tightly coupled)
- **Service extraction IS RECOMMENDED** (move code to separate files by concern)
- Priority 1: Extract `MessageCacheService` (~800 lines, low risk)

---

## Current Architecture

### Original State (Before Refactoring)
- **File**: `src/components/context/MessageDB.tsx`
- **Size**: 5,650 lines

### Current State (Dec 2025)
- **MessageDB.tsx**: 1,020 lines (82% reduction)
- **6 Original Services**: ~7,500 lines total
- **2 ActionQueue Services**: ~1,030 lines total

---

## Service Breakdown

| Service | Lines | Status |
|---------|-------|--------|
| **MessageService** | ~4,150 | ⚠️ Large — extraction recommended |
| SpaceService | 1,178 | ✅ Complete |
| InvitationService | 902 | ✅ Complete |
| ConfigService | 531 | ✅ Complete |
| SyncService | 512 | ✅ Complete |
| EncryptionService | 264 | ✅ Complete |
| ActionQueueService | 292 | ✅ Complete |
| ActionQueueHandlers | 738 | ✅ Complete |

---

## Next Steps: Service Extraction

Per [MessageService Analysis](./messageservice-analysis.md), the file has 5 distinct concerns:

| Concern | Lines | Extraction Target |
|---------|-------|-------------------|
| Cache operations | ~800 | `MessageCacheService` ← **Priority 1** |
| DM submission | ~520 | `DirectMessageService` |
| Channel submission | ~470 | `ChannelMessageService` |
| Incoming messages | ~1,350 | Keep in MessageService (too coupled) |
| Retry/cleanup | ~390 | Keep in MessageService |

**Recommended first extraction**: `MessageCacheService` — pure React Query logic, zero crypto, highly testable.

---

## Completed Work

| Date | What | Impact |
|------|------|--------|
| Dec 20, 2025 | Extracted `encryptAndSendToSpace()` helper | -200 lines, 7 unit tests |
| Dec 18, 2025 | Removed dead fallback code | -249 lines |
| Oct 2025 | Extracted 6 services from MessageDB | -82% reduction |

---

## Archived (Not Recommended)

The `handleNewMessage` refactoring was analyzed and **deprioritized**:
- Risk outweighs benefit
- Tightly coupled to encryption context
- Import chain blocks testing

Archived files in `.archived/`:
- `messageservice-handlenewmessage-refactor.md`
- `messageservice-handlenewmessage-tests.md`
- `messagedb-optimization-2.md`

---

## Related Documentation

### Active
- [MessageService Analysis](./messageservice-analysis.md) — Detailed breakdown & extraction opportunities
- [File Size Best Practices](../../reports/file-size-best-practices_2025-12-20.md) — When to split files
- [Action Queue](../../docs/features/action-queue.md) — Background task processing

### Reference Only
- [Low-Risk Optimizations](./messagedb-optimization-1.md) — Type safety, React types removal
- [High-Risk Optimizations](./messagedb-optimization-3.md) — SpaceService, InvitationService functions

---

_Last updated: 2025-12-20_
