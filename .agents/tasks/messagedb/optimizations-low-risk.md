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

#### 2.1 Replace `any` Types
**Risk**: ⚠️ LOW per service, but volume is high
**Time**: **1–2 days** (corrected — was previously listed as "1–2 hours")
**Impact**: Better type safety, catches bugs at compile time

**Current usage counts (May 2026, includes `: any`, `<any>`, `as any`):**

| Service | Count |
|---------|-------|
| MessageService | 67 |
| InvitationService | 12 |
| SpaceService | 8 |
| SyncService | 8 |
| ConfigService | 2 |
| **Total (5 main services)** | **97** |

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

#### 2.2 Remove React Types from Services
**Risk**: ⚠️ LOW
**Time**: 30 minutes – 1 hour
**Impact**: Better separation of concerns (services shouldn't know about React)

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

### 4.1 Rename `processDeliveryReceiptData` → `interceptControlMessages`

**Risk**: ⚠️ LOW
**Time**: ~15 min
**Impact**: Method name reflects reality

**Problem**: `processDeliveryReceiptData` (MessageService.ts:314) is named for receipts, but as of May 2026 it also intercepts `typing-start` / `typing-stop` (lines 357–363). The name lies, and the next ephemeral control message type added (presence? reactions-as-control?) will make this worse.

**Proposed**:
- Rename to `interceptControlMessages` (or split into `interceptControlMessage()` + `processPiggybackedAcks()` since the method does two unrelated things: intercepts at steps 1/1b/1c, and processes piggybacks at steps 2/3).
- The two callers (DM decrypt paths around MessageService.ts:4220) need a one-line update.
- Update the JSDoc to describe both responsibilities.

**Why now**: ahead of any further ephemeral control-message additions; before adding presence or any new dispatch branch.

### 4.2 Convert NotificationService singleton to a normal class

**Risk**: ⚠️ LOW–MEDIUM
**Time**: ~half-day
**Impact**: Testability; consistency with all other services

**Problem**: NotificationService uses `private static instance` + `getInstance()` (NotificationService.ts:39, 45). Every other service in `src/services/` is a normal class instantiated by MessageDB and wired via dependency injection. NotificationService has no unit test file — directly correlated with the singleton being hard to mock.

**Proposed**:
- Convert to a normal class with a constructor.
- Have MessageDB instantiate it like every other service.
- All current callers use `notificationService` (a lowercase singleton import from `./NotificationService`) — refactor those call sites to take it through context.

**Caveats**:
- NotificationService.ts has DOM-coupled code (`document.visibilitychange`, `Notification`, Safari sniffing). It stays per-app forever per the [services-design audit](../quorum-shared-migration/designs/2026-05-18-services-design.md), so this is purely a desktop hygiene win, not a shared-migration enabler.
- Module-level state in this file (`isProcessing`, `pendingNotifications`, `mutedConversations`) needs to move onto the instance.

**Why now**: NotificationService is the only service in the folder that isn't testable via the standard pattern. Worth one focused cleanup pass.

### 4.3 Normalize control-message intercept shape

**Risk**: ⚠️ LOW (with a sequencing constraint)
**Time**: ~30 min
**Impact**: Removes defensive triple-fallback reads

> **Cross-check sequencing constraint (2026-05-19).** This must land BEFORE or WITH the [receipts shared migration](../quorum-shared-migration/2026-05-19-receipts-shared-migration.md), otherwise the wire-format ambiguity gets codified into the shared `DeliveryAckMessage` / `ReadAckMessage` types and mobile inherits only one of the two shapes desktop emits. See [shared-migration-cross-check.md §Sequencing constraint on #3](./shared-migration-cross-check.md#sequencing-constraint-on-3-intercept-normalization) for the full reasoning.

**Problem**: In `processDeliveryReceiptData` (MessageService.ts:326–351), every intercept reads with a triple-fallback pattern:

```ts
const isDeliveryAck = raw.type === 'delivery-ack' || raw.content?.type === 'delivery-ack';
const ackIds = raw.messageIds ?? raw.content?.messageIds ?? [];
```

This pattern suggests an unresolved wire-format ambiguity: control messages arrive as flat objects from some send paths and nested-under-`.content` from others. The defensive reads work, but they conceal the underlying inconsistency.

**Proposed (preferred)**: Identify which sender paths produce flat-vs-nested control messages and unify them at the source. The ActionQueueHandlers paths around `ActionQueueHandlers.ts:957` (delivery-ack) and `:1014` (read-ack) are the obvious places to start.

**Proposed (fallback)**: If unifying senders proves harder than expected, normalize once at the top of the intercept:
```ts
const ctl = raw.content?.type ? raw.content : raw;
const isDeliveryAck = ctl.type === 'delivery-ack';
// ...read ctl.messageIds etc.
```

**Why now**: Before any further intercept branches are added, and ideally before the receipts shared migration locks in the wire-type shape.

### 4.4 Type the piggybacked ack fields

**Risk**: ⚠️ LOW
**Time**: ~30 min
**Impact**: Removes 4 `(message as any)` casts in `attachPiggybackedAcks` / `stripPiggybackedAcks`

**Problem**: `attachPiggybackedAcks` (MessageService.ts:281) and `stripPiggybackedAcks` (:299) write/delete `ackMessageIds` and `readAckUpTo` on messages via `(message as any).foo = ...`. These are transient wire fields, not part of the `Message` type.

**Proposed (after receipts shared migration lands)**:

```ts
// In quorum-shared/src/types/receipt.ts (or wherever the receipt types land)
export interface PiggybackedReceiptFields {
  ackMessageIds?: string[];
  readAckUpTo?: { messageId: string; timestamp: number };
}

// In MessageService
private attachPiggybackedAcks(address: string, message: Message & PiggybackedReceiptFields): void {
  // no more `as any`
}
```

**Why now**: Already flagged in [the receipts-shared-migration task](../quorum-shared-migration/2026-05-19-receipts-shared-migration.md#actionqueuehandlersts-send-paths--stays-per-app-narrows-against-shared-types) as optional cleanup. Track it here too so it doesn't get lost.

---

_Last updated: 2026-05-19 — file renamed from `messagedb-optimization-1.md` → `optimizations-low-risk.md` as part of folder reorganization. §2.1 time estimate corrected from "1–2 hours" to "1–2 days" against the actual 97 `any` count. Added usage counts for `any` and `MutableRefObject`. Added §4 (four new May 2026 findings: rename `processDeliveryReceiptData`, NotificationService singleton refactor, intercept-shape normalization, piggyback type cleanup). Updated "Recommended order" to include all six items, in order. Cross-check pass (2026-05-19 PM): added shared-migration framing notes to §2.1 and §2.2 (desktop hygiene, not shared-migration enabler); added sequencing constraint to §4.3 (must land before or with receipts shared migration)._
_Status: actionable items prioritized in [README.md](./README.md#master-action-plan-safest-to-riskiest); shared-architecture verification in [shared-migration-cross-check.md](./shared-migration-cross-check.md)._
