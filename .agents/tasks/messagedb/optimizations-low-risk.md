---
type: task
title: Low/Medium Risk Optimization Opportunities
status: in-progress
created: 2025-10-03T00:00:00.000Z
updated: '2026-05-19'
---

# Low/Medium Risk Optimization Opportunities

**Context**: Future optimization opportunities for all MessageDB services.

> **2026-05-19 refresh.** Estimates for the `any`-type pass corrected (previous "1–2 hours" was wildly optimistic — there are 97 `any` usages across the 5 main services, not a handful). New May 2026 findings appended at the bottom in §4 (misnamed `processDeliveryReceiptData`, NotificationService singleton cleanup, intercept normalization, piggyback type cleanup). The master ordering across all docs lives in [README.md](./README.md#master-action-plan-safest-to-riskiest); high-risk function breakdowns live in [optimizations-high-risk.md](./optimizations-high-risk.md); a reconsideration of the once-archived `handleNewMessage` decomposition lives in [handleNewMessage-reconsidered.md](./handleNewMessage-reconsidered.md).

---

## Overview

After completing quick wins (code cleanup, hex utilities, JSDoc), this document tracks remaining **low and medium risk** optimization opportunities. High-risk tasks (large function refactoring) are documented separately in [optimizations-high-risk.md](./optimizations-high-risk.md).

**Current Status**: items prioritized in the master plan ([README.md](./README.md#master-action-plan-safest-to-riskiest)).

**Quick Wins Completed** ✅:
- Extracted `int64ToBytes` and `canonicalize` to utilities
- Extracted hex conversion utilities (74 replacements)
- Added concise JSDoc to all 28 service methods
- Removed obsolete "EXACT COPY" comments

---

## Current State (May 2026)

**Service Sizes** (updated May 2026):
| Service | Oct 2025 | Dec 2025 | Mar 2026 | May 2026 | Change (total) |
|---------|----------|----------|----------|----------|----------------|
| MessageService | 2,311 | 4,337 | 5,261 | **5,465** | +136% |
| SpaceService | 1,144 | 1,175 | 1,222 | 1,222 | +7% |
| InvitationService | 887 | 902 | 906 | 904 | +2% |
| ConfigService | 394 | 531 | 544 | **610** | +55% |
| SyncService | 565 | 512 | 1,000 | 1,003 | +78% |
| EncryptionService | 262 | 264 | 264 | 264 | +1% |
| ReceiptService | — | — | 204 | 204 | (Mar 2026 new) |
| SearchService | — | — | 290 | 290 | (Mar 2026 new) |
| **ThreadService** | — | — | — | **607** | new (May 2026) |
| **TypingService** | — | — | — | **300** | new (May 2026) |
| **BackupService** | — | — | — | **225** | now tracked (pre-existing) |
| **NotificationService** | — | — | — | **342** | now tracked (pre-existing) |
| **channelThreadHelpers** | — | — | — | **56** | now tracked (pre-existing) |
| ActionQueueHandlers | — | 738 | 1,196 | 1,082 | (-10% Mar→May, thread logic moved out) |
| ActionQueueService | — | 292 | 401 | 401 | +37% |

*Note: MessageService growth since Mar 2026 is mostly typing-indicator integration. ConfigService growth from device-name additions. ThreadService + TypingService spun off as separate services for the threads and typing-indicator features.*

**Remaining Code Quality Opportunities**:
- ⚠️ Many `any` types (poor type safety)
- ⚠️ React types in services (wrong layer)
- ⚠️ Duplicate dependency injection boilerplate

---

## Optimization Categories

### 🟡 Category 2: Type Safety Improvements (Low Risk)

#### 2.1 Replace `any` Types — Partially Done (2026-05-20)
**Risk**: ⚠️ LOW per service, but volume is high
**Time**: **1–2 days** (corrected — was previously listed as "1–2 hours")
**Impact**: Better type safety, catches bugs at compile time

> **2026-05-20 partial progress.** The `spaceInfo` and `syncInfo` ref types — previously `Ref<{ [key: string]: any }>` across all 5 services — are now properly typed via the new `SpaceInfoMap` and `SyncInfoMap` aliases in `src/types/spaceRefs.ts`. ConfigService is now `any`-free. 12 `any` occurrences removed across the 5 services (was 105 → now 93). Done on branch `refactor/type-spaceinfo-syncinfo-refs`. The remaining ~93 `any`s are mostly in MessageService's wire-message dispatch (`handleNewMessage` and friends) and should be addressed as Tier 2 per-message-type extractions land — typing each handler at extraction time is smaller-scope than retrofitting the monolith.

**Current usage counts (May 2026 → 2026-05-20):**

| Service | May 2026 | 2026-05-20 |
|---------|----------|------------|
| MessageService | 67 → 74 (grew with features) | **70** |
| InvitationService | 12 → 13 | **11** |
| SpaceService | 8 | **6** |
| SyncService | 8 | **6** |
| ConfigService | 2 | **0** ✅ |
| **Total** | **97 → 105** | **93** |

Newer services already do this right: TypingService, ReceiptService, ThreadService, SearchService, BackupService have **zero** `any` usages.

> **Cross-check note (2026-05-19).** All 5 affected services are classified per-app in the [services-design audit](../quorum-shared-migration/designs/2026-05-18-services-design.md). This pass is desktop hygiene — it does NOT make MessageService or ConfigService migratable to shared (each has multiple other coupling points: Web Crypto, React Query keys, `@lingui`, etc.). See [shared-migration-cross-check.md §Issue A](./shared-migration-cross-check.md#issue-a-overstating-shared-migration-enablement).

**Current Issues**:

```typescript
// SpaceService.ts
metadata: any  // ❌ Should be MessageMetadata

// ConfigService.ts
config: any    // ❌ Should be UserConfig
keyset: any    // ❌ Should be Keyset type

// MessageService.ts
pendingMessage: any  // ❌ Should be union of message types
```

**Solution**: Define proper interfaces

```typescript
// src/types/services.ts
export interface MessageMetadata {
  timestamp: number;
  nonce: string;
  signature?: string;
  publicKey?: string;
}

export interface Keyset {
  userKeyset: UserKeyset;
  deviceKeyset: DeviceKeyset;
}
```

**Approach**:
1. Create `src/types/services.ts` with shared types
2. Update service interfaces one at a time
3. Run TypeScript check after each service
4. Fix any type errors revealed

**Benefits**:
- IDE autocomplete improves
- Catches parameter errors at compile time
- Safer refactoring during the `handleNewMessage` breakdown

---

#### 2.2 Remove React Types from Services ✅ DONE (2026-05-20)
**Risk**: ⚠️ LOW
**Time**: ~30 min (as estimated)
**Impact**: Better separation of concerns (services shouldn't know about React)

**What was changed**: Added `src/types/ref.ts` with a platform-agnostic `Ref<T> { current: T }` interface. Replaced all 12 `React.MutableRefObject<…>` annotations across ConfigService, InvitationService, SpaceService, SyncService, MessageService with `Ref<…>`. `React.MutableRefObject<T>` is structurally compatible with `Ref<T>`, so MessageDB and other React-land callers pass their existing refs unchanged. Done as part of Tier 0 cleanup batch on branch `refactor/messageservice-rename-and-typing`.

**Current usage counts (May 2026, `React.MutableRefObject`):**

| Service | Count |
|---------|-------|
| MessageService | 4 |
| ConfigService | 2 |
| InvitationService | 2 |
| SpaceService | 2 |
| SyncService | 2 |
| **Total** | **12** |

Newer services already do this right: TypingService, ReceiptService, ThreadService, SearchService, BackupService, NotificationService have **zero** `MutableRefObject` references.

> **Cross-check note (2026-05-19).** All 5 affected services are per-app forever per the [services-design audit](../quorum-shared-migration/designs/2026-05-18-services-design.md). Removing `MutableRefObject` is desktop hygiene; it's necessary-but-not-sufficient for any future reconsideration of these services for shared (each has at least two other coupling points). The proposed `Ref<T>` interface should live in **desktop** for this refactor (only used by per-app services). If a future shared service ever needs the same pattern, the interface should be added to **shared** at that point, not pre-emptively.

**Problem**:
```typescript
// All services have this
spaceInfo: React.MutableRefObject<{ [key: string]: any }>;
syncInfo: React.MutableRefObject<{ [key: string]: any }>;
```

**Issue**: Business logic services shouldn't depend on React types

**Solution**: Create platform-agnostic ref wrapper

```typescript
// src/types/ref.ts
export interface Ref<T> {
  current: T;
}

// Services use this instead
spaceInfo: Ref<Record<string, any>>;
syncInfo: Ref<Record<string, any>>;

// MessageDB.tsx provides React.MutableRefObject (implements Ref interface)
```

**Benefits**:
- Services are truly platform-independent
- Can use services in Node.js scripts
- Better for testing (no React imports needed)

---

---

### 🟡 Category 3: Dependency Injection Cleanup (Low Risk)

#### 3.1 Extract Common Dependencies to Base Class
**Risk**: ⚠️ LOW
**Time**: 1 hour
**Impact**: Reduces boilerplate by ~300 lines

**Problem**: All services repeat these dependencies:

```typescript
export interface ServiceDependencies {
  messageDB: MessageDB;
  apiClient: QuorumApiClient;
  enqueueOutbound: (action: () => Promise<string[]>) => void;
}

export class Service {
  private messageDB: MessageDB;
  private apiClient: QuorumApiClient;
  private enqueueOutbound: (action: () => Promise<string[]>) => void;

  constructor(deps: ServiceDependencies) {
    this.messageDB = deps.messageDB;
    this.apiClient = deps.apiClient;
    this.enqueueOutbound = deps.enqueueOutbound;
    // ... repeated 6 times
  }
}
```

**Solution**: Create base service class

```typescript
// src/services/BaseService.ts
export interface BaseServiceDependencies {
  messageDB: MessageDB;
  apiClient: QuorumApiClient;
  enqueueOutbound: (action: () => Promise<string[]>) => void;
}

export abstract class BaseService {
  protected messageDB: MessageDB;
  protected apiClient: QuorumApiClient;
  protected enqueueOutbound: (action: () => Promise<string[]>) => void;

  constructor(deps: BaseServiceDependencies) {
    this.messageDB = deps.messageDB;
    this.apiClient = deps.apiClient;
    this.enqueueOutbound = deps.enqueueOutbound;
  }
}

// Services extend it
export interface SpaceServiceDependencies extends BaseServiceDependencies {
  saveConfig: (args: { config: any; keyset: any }) => Promise<void>;
  int64ToBytes: (num: number) => Uint8Array;
  // ... only service-specific deps
}

export class SpaceService extends BaseService {
  private saveConfig: (args: { config: any; keyset: any }) => Promise<void>;
  private int64ToBytes: (num: number) => Uint8Array;

  constructor(deps: SpaceServiceDependencies) {
    super(deps); // Base class handles common deps
    this.saveConfig = deps.saveConfig;
    this.int64ToBytes = deps.int64ToBytes;
  }
}
```

**Benefits**:
- Reduces ~50 lines per service
- Clear common/specific dependency separation
- Easier to add new common dependencies

**Caution**: Do this AFTER int64ToBytes extraction (reduces one dependency)

---

## Recommended Implementation Order

### ✅ Quick Wins (Completed 2025-10-03)

**Tasks completed**:
- ✅ int64ToBytes extraction (10 min, ZERO risk)
- ✅ Hex conversion utilities (30 min, VERY LOW risk)
- ✅ JSDoc documentation (1 hour, ZERO risk)

**Results**:
- Reduced ~200 lines of crypto boilerplate
- Added professional documentation to 28 methods
- Zero behavior changes, all tests passing

---

### 📋 Recommended order within this doc

The cross-doc master order is in [README.md](./README.md#master-action-plan-safest-to-riskiest). Within this doc:

**1. Remove React types** (30 min – 1 hour, LOW risk) — smallest blast radius, 12 spots across 5 services. Do first.
**2. Misnamed `processDeliveryReceiptData` rename + intercept normalization** (§4.1 + §4.3, ~1 hour combined, LOW risk) — addresses the awkward "delivery receipt" method now also dispatching typing.
**3. Piggyback type cleanup** (§4.4, ~30 min, LOW risk) — typed once the receipts shared migration lands; safe to do alongside.
**4. Replace `any` types** (1–2 days, LOW risk per service, BUT volume is large) — 97 occurrences, do per-service in small commits.
**5. Base service class** (1 hour, LOW risk) — do AFTER the type-safety pass so the base class can reference the proper types.
**6. NotificationService singleton refactor** (§4.2, half-day, LOW–MEDIUM risk) — testability win, no behavior change.

**Rationale**:
- Better foundation before large refactorings
- TypeScript will catch errors at compile time
- Compile errors are easy to fix
- Newer services (TypingService, ReceiptService, ThreadService, SearchService, BackupService) already do all of this right — they're the reference

---

## §4. New May 2026 findings

These were surfaced during the 2026-05-19 audit prompted by the typing/receipts shared-migration planning. They are low-risk small-scope improvements specific to the post-typing/threads state of MessageService.

### 4.1 Rename `processDeliveryReceiptData` → `interceptControlMessages` ✅ DONE (2026-05-20)

**Risk**: ⚠️ LOW
**Time**: ~15 min (as estimated)
**Impact**: Method name reflects reality

**What was changed**: `MessageService.processDeliveryReceiptData` → `interceptControlMessages` (declaration at MessageService.ts:313 + two callers at :2680, :4225). JSDoc rewritten to describe both responsibilities (intercept + piggyback processing). The split into `interceptControlMessage()` + `processPiggybackedAcks()` was considered but deferred — the single-method form is fine until a third unrelated responsibility appears.

**Why now (history)**: ahead of any further ephemeral control-message additions (presence, reactions-as-control). Done as part of Tier 0 cleanup batch on branch `refactor/messageservice-rename-and-typing`.

### 4.2 Convert NotificationService singleton to a normal class ✅ DONE (2026-05-20, scope reduced)

**Risk**: ⚠️ LOW (smaller than originally rated)
**Time**: ~10 min (vs. half-day estimate)
**Impact**: Testability; constructor is no longer private

**What was changed** (branch `refactor/notificationservice-dependency-injection`):
- Removed `private static instance` and `getInstance()` from NotificationService.
- Made the constructor `public` (was `private`).
- Kept the module-level `export const notificationService = new NotificationService()` as the canonical shared instance, with a comment explaining why this remains a per-tab singleton (it wraps `window.Notification` and `document.visibilityState`, which are themselves tab-global).
- Zero call-site changes: 5 consumers (MessageService, useNotificationSettings, useMutedConversationsSync, WebsocketProvider, services/index re-export) keep importing `notificationService` by the same name.

**Scope reduction vs. original plan**:
- The original §4.2 proposed instantiating NotificationService in MessageDB and threading it through React context, matching the ReceiptService/TypingService pattern. On second look that was over-engineered: NotificationService is genuinely a per-tab singleton (it wraps tab-global browser APIs), the React-land call sites have no per-user/per-session lifecycle to track, and threading it through context would add a hook + 3 consumer-site rewrites for zero behavior or testability gain that isn't already won by dropping `private constructor`.
- The §4.2 caveat about "module-level state (`isProcessing`, `pendingNotifications`, `mutedConversations`) needs to move onto the instance" was incorrect on inspection — all three of those were already instance fields. Nothing had to move.
- Tests that want isolation can now `new NotificationService()` directly. That's the testability win the original §4.2 was after.

**What this is NOT**:
- Not a "per-app forever vs. shared" change — NotificationService stays per-app forever per the [services-design audit](../quorum-shared-migration/designs/2026-05-18-services-design.md). DOM coupling unchanged.

### 4.3 Normalize control-message intercept shape ✅ DONE (2026-05-20)

**Risk**: ⚠️ LOW
**Time**: ~5 min (turned out smaller than estimated)
**Impact**: Removes dead defensive code

> **Resolved as a cleanup commit on the receipts-shared-migration branch.** Investigation (see [shared-migration-cross-check.md §Sequencing constraint on #3](./shared-migration-cross-check.md#sequencing-constraint-on-3-intercept-normalization)) revealed there was never a real wire-format ambiguity — only one sender path exists (`ActionQueueHandlers.ts:957, 1014`), it has always emitted the flat shape, and the `raw.content?.type` branches in the receiver were unreverted dead code from the original receiver bug ([2026-03-19-standalone-delivery-ack-unreliable.md](../../bugs/.solved/2026-03-19-standalone-delivery-ack-unreliable.md) line 28).

**What was changed**: `MessageService.ts:325, 328, 339, 342–343` — dropped the `raw.content?.type` and `raw.content?.messageIds` / `raw.content?.upToMessageId` / `raw.content?.upToTimestamp` fallbacks. The receiver now reads only the flat shape, which is the only shape that ever flies on the wire.

**Why it was safe**: no external peer ever shipped the nested shape; the only producer is local code that emits flat. The nested branches were unreachable.

### 4.4 Type the piggybacked ack fields ✅ DONE (2026-05-20)

**Risk**: ⚠️ LOW
**Time**: ~10 min (smaller than estimated — `ReceiptEnvelopeFields` already existed in `quorum-shared`)
**Impact**: Removed 4 `(message as any)` casts in `attachPiggybackedAcks` / `stripPiggybackedAcks`

**What was changed**: Imported `ReceiptEnvelopeFields` from `@quilibrium/quorum-shared` (already exported as part of the receipts shared migration, see `quorum-shared/src/types/receipt.ts`). The two methods now widen `message` once at the top via `const envelope = message as Message & ReceiptEnvelopeFields;` and access typed `envelope.ackMessageIds` / `envelope.readAckUpTo` afterwards. No remaining `(message as any).ackMessageIds` / `.readAckUpTo` in MessageService.

**Note**: The unrelated `(message as any)` cast at MessageService.ts:574 (for `sendStatus` / `sendError` destructuring) is out of scope for this item — it's about transient send-state fields, not piggybacked receipts.

**Why now (history)**: Unblocked by the receipts shared migration landing (PR #147, 2026-05-20). Done as part of Tier 0 cleanup batch on branch `refactor/messageservice-rename-and-typing`.

---

_Last updated: 2026-05-19 — file renamed from `messagedb-optimization-1.md` → `optimizations-low-risk.md` as part of folder reorganization. §2.1 time estimate corrected from "1–2 hours" to "1–2 days" against the actual 97 `any` count. Added usage counts for `any` and `MutableRefObject`. Added §4 (four new May 2026 findings: rename `processDeliveryReceiptData`, NotificationService singleton refactor, intercept-shape normalization, piggyback type cleanup). Updated "Recommended order" to include all six items, in order. Cross-check pass (2026-05-19 PM): added shared-migration framing notes to §2.1 and §2.2 (desktop hygiene, not shared-migration enabler); added sequencing constraint to §4.3 (must land before or with receipts shared migration)._
_Status: actionable items prioritized in [README.md](./README.md#master-action-plan-safest-to-riskiest); shared-architecture verification in [shared-migration-cross-check.md](./shared-migration-cross-check.md)._
