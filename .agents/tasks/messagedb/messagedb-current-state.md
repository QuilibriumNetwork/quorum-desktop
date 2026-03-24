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

### Current State (Mar 2026)
- **MessageDB.tsx**: 1,344 lines (76% reduction from original)
- **8 Original + Derived Services**: ~10,350 lines total
- **2 ActionQueue Services**: ~1,600 lines total

---

## Service Breakdown

| Service | Dec 2025 | Mar 2026 | Change | Status |
|---------|----------|----------|--------|--------|
| **MessageService** | ~4,150 | **~5,261** | +27% | ⚠️ Large — extraction still recommended |
| SpaceService | 1,178 | 1,222 | +4% | ✅ Complete |
| InvitationService | 902 | 906 | +0.4% | ✅ Complete |
| ConfigService | 531 | 544 | +2% | ✅ Complete |
| SyncService | 512 | 1,000 | +95% | ✅ (sync v2 additions) |
| EncryptionService | 264 | 264 | 0% | ✅ Complete |
| **ReceiptService** | — | **204** | new | ✅ New (delivery + read receipts) |
| **SearchService** | — | **290** | new | ✅ New (global message search) |
| ActionQueueService | 292 | 401 | +37% | ✅ Complete |
| ActionQueueHandlers | 738 | 1,196 | +62% | ✅ (receipt + thread handlers) |

**Key growth areas since Dec 2025:**
- MessageService: +1,100 lines from delivery/read receipts integration, threads, tag rebroadcast, DM handling
- SyncService: +488 lines from sync v2 protocol
- ActionQueueHandlers: +458 lines from receipt ack handlers and thread handlers
- Two new services added: ReceiptService, SearchService

---

## Next Steps: Service Extraction

Per [MessageService Analysis](./messageservice-analysis.md), the file now has 7 distinct concerns:

| Concern | Lines | Extraction Target |
|---------|-------|-------------------|
| Cache operations | ~800 | `MessageCacheService` ← **Priority 1** |
| DM submission | ~560 | `DirectMessageService` |
| Channel submission | ~590 | `ChannelMessageService` |
| Incoming messages | ~1,850 | Keep in MessageService (too coupled) |
| Receipts integration | ~90 | Keep in MessageService (pipeline-coupled; bulk logic already in ReceiptService) |
| Tags | ~130 | Keep in MessageService (or move to SpaceService if it grows) |
| Retry/cleanup | ~400 | Keep in MessageService |

**Recommended first extraction**: `MessageCacheService` — pure React Query logic, zero crypto, highly testable.

---

## Completed Work

| Date | What | Impact |
|------|------|--------|
| Mar 2026 | Created `ReceiptService` (204 lines) | New service for delivery + read receipt buffering |
| Mar 2026 | Created `SearchService` (290 lines) | New service for global message search |
| Mar 24, 2026 | Extracted piggyback helpers in MessageService | DRY'd duplicated code, fixed readAckUpTo strip bug |
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

_Last updated: 2026-03-24_
