---
type: task
title: Low/Medium Risk Optimization Opportunities
status: in-progress
created: 2025-10-03T00:00:00.000Z
updated: '2026-01-09'
---

# Low/Medium Risk Optimization Opportunities


**Context**: Future optimization opportunities for all MessageDB services

> **Note**: The "Quick Wins" section was completed in Oct 2025. Remaining items (Type Safety, React types removal, Base Service class) are general improvements across all services. These were deprioritized in favor of feature development but remain valid opportunities for future work.

---

## Overview

After completing quick wins (code cleanup, hex utilities, JSDoc), this document tracks remaining **low and medium risk** optimization opportunities. High-risk tasks (large function refactoring) are documented separately.

**Current Status**: ON HOLD - Deprioritized in favor of feature development. Quick Wins completed.

**Quick Wins Completed** ✅:
- Extracted `int64ToBytes` and `canonicalize` to utilities
- Extracted hex conversion utilities (74 replacements)
- Added concise JSDoc to all 28 service methods
- Removed obsolete "EXACT COPY" comments

---

## Current State (Mar 2026)

**Service Sizes** (updated Mar 2026):
| Service | Oct 2025 | Dec 2025 | Mar 2026 | Change (total) |
|---------|----------|----------|----------|----------------|
| MessageService | 2,311 | 4,337 | **5,261** | +128% |
| SpaceService | 1,144 | 1,175 | 1,222 | +7% |
| InvitationService | 887 | 902 | 906 | +2% |
| ConfigService | 394 | 531 | 544 | +38% |
| SyncService | 565 | 512 | 1,000 | +77% |
| EncryptionService | 262 | 264 | 264 | +1% |
| ReceiptService | — | — | **204** | new |
| SearchService | — | — | **290** | new |
| ActionQueueHandlers | — | 738 | 1,196 | +62% |
| ActionQueueService | — | 292 | 401 | +37% |

*Note: MessageService growth since Dec 2025 is from delivery/read receipts, threads, tag rebroadcast. SyncService growth from sync v2 protocol. ActionQueueHandlers growth from receipt ack + thread handlers.*

**Remaining Code Quality Opportunities**:
- ⚠️ Many `any` types (poor type safety)
- ⚠️ React types in services (wrong layer)
- ⚠️ Duplicate dependency injection boilerplate

---

## Optimization Categories

### 🟡 Category 2: Type Safety Improvements (Low Risk)

#### 2.1 Replace `any` Types
**Risk**: ⚠️ LOW
**Time**: 1-2 hours
**Impact**: Better type safety, catches bugs at compile time

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
**Time**: 30 minutes
**Impact**: Better separation of concerns (services shouldn't know about React)

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

### 📋 Next Step: Type Safety Improvements (2-3 hours)

**1. Replace `any` types** (2 hours, LOW risk)
- Create `src/types/services.ts` with proper interfaces
- Update service interfaces one at a time
- Run TypeScript check after each service
- Fix any type errors revealed

**2. Remove React types** (30 min, LOW risk)
- Replace `React.MutableRefObject<T>` with platform-agnostic `Ref<T>`
- Services shouldn't depend on React types
- Better for testing and portability

**3. Base service class** (1 hour, LOW risk)
- Extract common dependencies (messageDB, apiClient, enqueueOutbound)
- Reduces ~50 lines per service
- Clear separation of common vs specific dependencies

**Rationale**:
- Better foundation before large refactorings
- TypeScript will catch errors at compile time
- Low risk - compile errors are easy to fix
- Improves code maintainability

---

_Last updated: 2026-03-24_
_Status: ⏸️ ON HOLD - Quick Wins completed, remaining items deprioritized_
