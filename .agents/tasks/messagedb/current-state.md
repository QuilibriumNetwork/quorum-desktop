---
type: task
title: MessageDB Refactoring - Current State
status: in-progress
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: '2026-05-19'
---

# MessageDB Refactoring - Current State

**Last Updated**: 2026-05-19

> **⚠️ AI-Generated**: May contain errors. Verify before use.

---

## Overview

The MessageDB refactoring successfully extracted services from the original 5,650-line monolithic file. MessageService.ts has continued to grow (now 5,465 lines) but four additional services have been spun off in the interim: ReceiptService, SearchService, ThreadService, TypingService — plus BackupService and NotificationService which existed before but weren't tracked in earlier versions of this doc.

**Dec 20, 2025 direction (still current)** based on [best practices research](../../reports/file-size-best-practices_2025-12-20.md):
- `handleNewMessage` refactoring is **NOT RECOMMENDED** (high risk, tightly coupled)
- **Service extraction IS RECOMMENDED** (move code to separate files by concern)
- Priority 1: Extract `MessageCacheService` (~800 lines, low risk)

---

## Cross-cutting context: relationship to quorum-shared migration

The MessageDB refactor and the [quorum-shared migration](../quorum-shared-migration/README.md) are **largely orthogonal**. Services explicitly classified as "stays per-app" in the [services-design audit](../quorum-shared-migration/designs/2026-05-18-services-design.md) include MessageService, ConfigService, EncryptionService, SpaceService, InvitationService, SyncService (desktop wrapper), NotificationService, ActionQueueHandlers — so the pending desktop refactor (Cache/DM/Channel sub-services, kickUser/createSpace/joinInviteLink breakdown) doesn't expand or shrink the shared migration backlog.

**Two narrow places where this refactor touches shared at all:**

1. **Intercept normalization (Tier 0 #3)** — has a real **sequencing constraint**: must land before or with the receipts shared migration so the wire format doesn't get locked with an ambiguity. See [shared-migration-cross-check.md §Sequencing constraint on #3](./shared-migration-cross-check.md#sequencing-constraint-on-3-intercept-normalization).
2. **Type-safety pass** (replace `any`, remove `React.MutableRefObject` from services — see [optimizations-low-risk.md §2.1–2.2](./optimizations-low-risk.md)). Desktop hygiene; necessary-but-not-sufficient for any future reconsideration of MessageService/ConfigService for shared migration (each has multiple other coupling points). Not a real precondition for the planned migrations.

**BaseService extraction** was earlier flagged as carrying shared-migration risk; on cross-check that risk doesn't exist in practice — no migration-eligible service fits the BaseService shape. See [shared-migration-cross-check.md §Issue C](./shared-migration-cross-check.md#issue-c-overstated-baseservice-risk-to-shared-migration).

The single highest-leverage unblock for shared migration remains **mobile codebase access**, not desktop refactoring. The full verification is in [shared-migration-cross-check.md](./shared-migration-cross-check.md).

---

## Current Architecture

### Original State (Before Refactoring)
- **File**: `src/components/context/MessageDB.tsx`
- **Size**: 5,650 lines

### Current State (May 2026)
- **MessageDB.tsx**: 1,458 lines (74% reduction from original)
- **All extracted services**: ~12,940 lines total across 14 files

---

## Service Breakdown

| Service | Dec 2025 | Mar 2026 | May 2026 | Change vs Mar | Status |
|---------|----------|----------|----------|---------------|--------|
| **MessageService** | ~4,150 | ~5,261 | **5,465** | +4% | ⚠️ Large — extraction still recommended |
| SpaceService | 1,178 | 1,222 | 1,222 | 0% | ✅ Complete |
| InvitationService | 902 | 906 | 904 | 0% | ✅ Complete |
| ConfigService | 531 | 544 | **610** | +12% | ✅ Complete |
| SyncService | 512 | 1,000 | 1,003 | 0% | ✅ |
| EncryptionService | 264 | 264 | 264 | 0% | ✅ Complete |
| ReceiptService | — | 204 | 204 | 0% | ✅ |
| SearchService | — | 290 | 290 | 0% | ✅ |
| **ThreadService** | — | — | **607** | new (tracked) | ✅ Threads feature |
| **TypingService** | — | — | **300** | new (tracked) | ✅ Typing indicators feature |
| **BackupService** | — | — | **225** | now tracked | ✅ (pre-existing) |
| **NotificationService** | — | — | **342** | now tracked | ✅ (pre-existing) |
| **channelThreadHelpers** | — | — | **56** | now tracked | ✅ (pre-existing helper module) |
| ActionQueueService | 292 | 401 | 401 | 0% | ✅ Complete |
| ActionQueueHandlers | 738 | 1,196 | 1,082 | -10% | ✅ |

**Key changes since Mar 2026:**
- MessageService: +204 lines, mostly typing-indicator integration (`sendEphemeralDMControl`, `sendEphemeralSpaceControl`, `setTypingService`, expanded `processDeliveryReceiptData` to dispatch typing as well as ack control messages)
- ConfigService: +66 lines (device-name related additions confirmed by `ConfigService.deviceNames.unit.test.ts` being the newest test file)
- ThreadService spun off (607 lines) for the threads feature
- TypingService spun off (300 lines) for typing indicators
- ActionQueueHandlers shrunk slightly (1,196 → 1,082) — likely from thread logic moving into ThreadService

**Services missing from earlier breakdowns but present in the repo:** BackupService, NotificationService, channelThreadHelpers. These were not new in May 2026 but are now documented for completeness.

---

## Next Steps: Service Extraction

Per [MessageService Deep Dive](./messageservice-deep-dive.md), the file now has 8 distinct concerns:

| Concern | Lines | Extraction Target |
|---------|-------|-------------------|
| Cache operations | ~800 | `MessageCacheService` ← **Priority 1** |
| DM submission | ~560 | `DirectMessageService` |
| Channel submission | ~590 | `ChannelMessageService` |
| Incoming messages | ~1,850 | Re-evaluate per-message-type extraction — see [handleNewMessage-reconsidered.md](./handleNewMessage-reconsidered.md) |
| Receipts integration | ~110 | Keep in MessageService (pipeline-coupled; bulk logic already in ReceiptService) |
| Typing integration | ~55 | Keep in MessageService (pipeline-coupled; bulk logic already in TypingService) |
| Tags | ~130 | Keep in MessageService (or move to SpaceService if it grows) |
| Retry/cleanup | ~400 | Keep in MessageService |

**Recommended first extraction**: `MessageCacheService` — pure React Query logic, zero crypto, highly testable.

---

## Completed Work

| Date | What | Impact |
|------|------|--------|
| May 2026 | Created `TypingService` (300 lines) | New service for typing-indicator buffering, freshness, scope routing |
| Apr–May 2026 | Created `ThreadService` (607 lines) | New service for message threads feature |
| Mar 2026 | Created `ReceiptService` (204 lines) | New service for delivery + read receipt buffering |
| Mar 2026 | Created `SearchService` (290 lines) | New service for global message search |
| Mar 24, 2026 | Extracted piggyback helpers in MessageService | DRY'd duplicated code, fixed readAckUpTo strip bug |
| Dec 20, 2025 | Extracted `encryptAndSendToSpace()` helper | -200 lines, 7 unit tests |
| Dec 18, 2025 | Removed dead fallback code | -249 lines |
| Oct 2025 | Extracted 6 services from MessageDB | -82% reduction |

---

## Archived plans (with May 2026 update)

The original `handleNewMessage` decomposition plan was analyzed in Dec 2025 and deprioritized:
- Risk outweighs benefit (under that plan's monolithic decomposition approach)
- Tightly coupled to encryption context
- Import chain blocks testing

**May 2026 update**: a fresh re-evaluation is in [handleNewMessage-reconsidered.md](./handleNewMessage-reconsidered.md). The ThreadService extraction (April–May 2026) demonstrated a per-message-type extraction pattern that sidesteps the original plan's blockers. Status: worth a fresh design pass, not urgent.

Archived files in `.archived/`:
- `messageservice-handlenewmessage-refactor.md` (Dec 2025 plan, superseded)
- `messageservice-handlenewmessage-tests.md`
- `messagedb-optimization-2.md`

---

## Related Documentation

### In this folder
- [README.md](./README.md) — folder index + master action plan (safest-to-riskiest)
- [MessageService Deep Dive](./messageservice-deep-dive.md) — Detailed breakdown & extraction opportunities for the 5,465-line file
- [Low-Risk Optimizations](./optimizations-low-risk.md) — Type safety, React types removal, new May 2026 small wins
- [High-Risk Optimizations](./optimizations-high-risk.md) — SpaceService, InvitationService function breakdowns
- [handleNewMessage Reconsidered](./handleNewMessage-reconsidered.md) — Fresh take in light of the ThreadService precedent
- [Shared-Migration Cross-Check](./shared-migration-cross-check.md) — Verification that the plan doesn't conflict with shared architecture

### External references
- [File Size Best Practices](../../reports/file-size-best-practices_2025-12-20.md) — When to split files
- [Cryptographic Code Best Practices](../../reports/cryptographic-code-best-practices_2025-12-20.md) — Abstraction for crypto
- [Action Queue](../../docs/features/action-queue.md) — Background task processing

---

_Last updated: 2026-05-19 — file renamed from `messagedb-current-state.md` → `current-state.md` as part of folder reorganization. Cross-references updated to point at the new file names. Cross-cutting context section refined during the same-day cross-check: surfaced Tier 0 #3 sequencing constraint, softened the "narrow exceptions" framing, removed the overstated BaseService-extraction risk. See [shared-migration-cross-check.md](./shared-migration-cross-check.md)._
