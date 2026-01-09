---
type: task
title: Cache Space Key Metadata to Reduce Config Save Overhead
status: on-hold
complexity: medium
ai_generated: true
created: 2025-12-13T00:00:00.000Z
updated: '2026-01-09'
---

# Cache Space Key Metadata to Reduce Config Save Overhead

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Archived**: 2025-12-13

## ❌ Why This Task Was Archived

**Performance testing revealed the original premise was incorrect.**

The task assumed DB queries in `saveConfig()` took 300-800ms. Actual timing instrumentation showed:

| Component | Time | % of Total |
|-----------|------|------------|
| DB queries (fetchAllSpaceKeys) | **~40ms** | 0.6% |
| Ed448 signing | ~1,000ms | 14% |
| API call (postUserSettings) | **~5,500ms** | 80% |
| **Total** | ~7,000ms | 100% |

**Conclusion**: Caching would save ~40ms out of 7 seconds. The real bottlenecks are:
1. **API latency** (5.5 seconds) - needs backend investigation
2. **Ed448 WASM signing** (1 second) - covered by background-action-queue task

This task would provide negligible improvement. The effort is better spent on the background action queue task which addresses the actual bottlenecks.

---

## Original Task (For Reference)

**Files**:
- `src/services/ConfigService.ts` (main changes)
- `src/services/SpaceService.ts` (cache invalidation triggers)
- `src/services/EncryptionService.ts` (cache invalidation triggers)

## Objective

**Eliminate redundant database queries during config saves by caching space key metadata (NOT private keys), reducing save time from 300-800ms to near-zero for repeated saves.**

This is a **quick win** optimization that can be implemented independently of the larger action queue task.

## What Operations Will Be Faster?

**Any operation that triggers `saveConfig()` will benefit**, including:
- ✅ Avatar/profile changes
- ✅ Folder drag-and-drop
- ✅ Creating/deleting folders
- ✅ User settings changes
- ✅ Space reordering
- ✅ Any config modification

**Why?** All these operations call `saveConfig()`, which currently re-fetches ALL space keys every time - even when the change has nothing to do with spaces. The space keys are needed for encrypting the synced config, but they rarely change.

## Problem

**Current behavior** in `ConfigService.saveConfig()` (lines 392-411):

```typescript
// EVERY save does this, even for simple changes like avatar update:
const spaces = await this.messageDB.getSpaces();  // Query 1

const spaceKeysPromises = spaces.map(async (space) => {
  const [keys, encryptionState] = await Promise.all([
    this.messageDB.getSpaceKeys(space.spaceId),      // Query 2 per space
    this.messageDB.getEncryptionStates({...}),       // Query 3 per space
  ]);
  ...
});
```

**Impact with 30 spaces**:
- 1 + (30 × 2) = **61 database queries per save**
- ~300-800ms just for DB queries
- Happens on EVERY config change (avatar, folder drag, settings, etc.)

**The irony**: Changing your avatar takes 300-800ms because it's re-fetching space data that has nothing to do with avatars!

**The reality**: Space keys almost never change! They only change when:
- User joins a new space
- User creates a new space
- A space rotates keys (after kicking a user)
- User leaves a space
- Encryption state migration occurs

## Security Considerations

> ⚠️ **CRITICAL**: This implementation caches **metadata references only**, NOT private keys.

### Why NOT Cache Private Keys Directly

Caching private keys in plaintext JavaScript objects creates serious security risks:
1. **Memory dumps** from DevTools, crash dumps expose all keys
2. **XSS vulnerabilities** anywhere in the app could exfiltrate all cached keys
3. **Browser extensions** with content script access could read the cache
4. **Electron renderer memory** is not protected from code injection

### Safe Approach: Cache References Only

Instead of caching the actual key material, we cache:
- Space IDs (list of spaces)
- Key IDs (references to keys in IndexedDB)
- Encryption state IDs (references to states)

Then perform a **fast batch lookup** when needed, which is much faster than iterating all spaces.

## Solution

```
Config Save Request
       │
       ▼
┌─────────────────────┐
│ Is metadata cache   │
│ valid? (exists +    │
│ not stale)          │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    │           │
   YES          NO
    │           │
    ▼           ▼
┌────────┐  ┌────────────────┐
│ Batch  │  │ Fetch space    │
│ fetch  │  │ list + update  │
│ by IDs │  │ metadata cache │
└────────┘  └────────────────┘
    │           │
    └─────┬─────┘
          │
          ▼
    Fetch keys by cached IDs
    (single batch query)
          │
          ▼
    Continue with
    encryption/signing
```

## Implementation

### Step 1: Add Metadata Cache to ConfigService

**File**: `src/services/ConfigService.ts`

```typescript
import type { SpaceKey, EncryptionState } from '../db/messages';

// Add these properties to ConfigService class
private spaceMetadataCache: {
  version: number;
  spaceIds: string[];
  keyIdsBySpace: Map<string, string[]>;
  encryptionStateIds: Map<string, string>;
  timestamp: number;
} | null = null;

private cacheVersion: number = 0;
private cacheRebuildInProgress: Promise<void> | null = null;
private readonly CACHE_TTL = 30 * 1000; // 30 seconds (security: minimize exposure window)
private readonly MAX_CACHED_SPACES = 100; // Prevent memory exhaustion

/**
 * Invalidate the space key metadata cache.
 * Call this when space membership or keys actually change.
 */
invalidateSpaceKeyCache(): void {
  this.cacheVersion++; // Atomic increment for race condition safety
  this.spaceMetadataCache = null;
  // Note: No debug logging in production to prevent metadata leakage
  if (process.env.NODE_ENV === 'development') {
    console.debug('Space key cache invalidated');
  }
}

/**
 * Get space keys using cached metadata for fast batch lookup.
 * Caches REFERENCES only, not actual key material.
 */
private async getSpaceKeysWithCache(): Promise<Array<{
  spaceId: string;
  encryptionState: EncryptionState;
  keys: SpaceKey[];
}>> {
  const now = Date.now();
  const currentVersion = this.cacheVersion;

  // Wait for any in-progress rebuild to prevent concurrent rebuilds
  if (this.cacheRebuildInProgress) {
    await this.cacheRebuildInProgress;
  }

  // Check if cache is valid
  const cache = this.spaceMetadataCache;
  if (
    cache &&
    cache.version === currentVersion &&
    (now - cache.timestamp) < this.CACHE_TTL
  ) {
    // Cache hit: batch fetch keys by cached IDs
    return this.fetchKeysByMetadata(cache);
  }

  // Cache miss: rebuild metadata cache
  this.cacheRebuildInProgress = this.rebuildMetadataCache(currentVersion);
  await this.cacheRebuildInProgress;
  this.cacheRebuildInProgress = null;

  // Now fetch using fresh cache
  return this.fetchKeysByMetadata(this.spaceMetadataCache!);
}

/**
 * Rebuild the metadata cache (space IDs and key references).
 */
private async rebuildMetadataCache(forVersion: number): Promise<void> {
  const spaces = await this.messageDB.getSpaces();

  // Safety: don't cache if too many spaces (prevents memory exhaustion)
  if (spaces.length > this.MAX_CACHED_SPACES) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Too many spaces (${spaces.length}) to cache efficiently`);
    }
    return;
  }

  const keyIdsBySpace = new Map<string, string[]>();
  const encryptionStateIds = new Map<string, string>();
  const spaceIds: string[] = [];

  for (const space of spaces) {
    const conversationId = `${space.spaceId}/${space.spaceId}`;
    const [keys, encryptionStates] = await Promise.all([
      this.messageDB.getSpaceKeys(space.spaceId),
      this.messageDB.getEncryptionStates({ conversationId }),
    ]);

    const encState = encryptionStates[0];
    if (encState) {
      spaceIds.push(space.spaceId);
      keyIdsBySpace.set(space.spaceId, keys.map(k => k.keyId));
      encryptionStateIds.set(space.spaceId, encState.id || conversationId);
    }
  }

  // Only update cache if version hasn't changed (prevents race condition)
  if (this.cacheVersion === forVersion) {
    this.spaceMetadataCache = {
      version: forVersion,
      spaceIds,
      keyIdsBySpace,
      encryptionStateIds,
      timestamp: Date.now(),
    };
  }
}

/**
 * Fetch actual keys using cached metadata references.
 * This is a fast batch operation.
 */
private async fetchKeysByMetadata(cache: NonNullable<typeof this.spaceMetadataCache>): Promise<Array<{
  spaceId: string;
  encryptionState: EncryptionState;
  keys: SpaceKey[];
}>> {
  const results = await Promise.all(
    cache.spaceIds.map(async (spaceId) => {
      const conversationId = `${spaceId}/${spaceId}`;
      const [keys, encryptionStates] = await Promise.all([
        this.messageDB.getSpaceKeys(spaceId),
        this.messageDB.getEncryptionStates({ conversationId }),
      ]);

      return {
        spaceId,
        encryptionState: encryptionStates[0],
        keys,
      };
    })
  );

  return results.filter(r => r.encryptionState !== undefined);
}
```

### Step 2: Update saveConfig to Use Cache

**File**: `src/services/ConfigService.ts`

Replace the space key fetching section in `saveConfig()`:

```typescript
async saveConfig({ config, keyset }: SaveConfigParams) {
  const ts = Date.now();
  config.timestamp = ts;

  if (config.allowSync) {
    const userKey = keyset.userKeyset;
    const derived = await crypto.subtle.digest(
      'SHA-512',
      Buffer.from(new Uint8Array(userKey.user_key.private_key))
    );

    const subtleKey = await window.crypto.subtle.importKey(
      'raw',
      derived.slice(0, 32),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // ✅ USE METADATA CACHE for fast batch lookup
    const allSpaceKeys = await this.getSpaceKeysWithCache();
    config.spaceKeys = allSpaceKeys;

    // Rest of the method unchanged...
    // (filtering, encryption, signing, API call)
  }
}
```

### Step 3: Add Cache Invalidation Triggers (Comprehensive)

**File**: `src/services/SpaceService.ts`

Add invalidation after ALL operations that change space membership or keys:

```typescript
// After creating a space
async createSpace(...) {
  // ... existing create logic ...
  await this.messageDB.saveSpace(space);

  // Invalidate cache since we have a new space
  this.configService.invalidateSpaceKeyCache();
}

// After joining a space
async joinSpace(...) {
  // ... existing join logic ...

  this.configService.invalidateSpaceKeyCache();
}

// After kicking a user (keys are rotated)
async kickUser(...) {
  // ... existing kick logic ...

  // Invalidate cache since keys were rotated
  this.configService.invalidateSpaceKeyCache();
}

// After leaving a space
async leaveSpace(...) {
  // ... existing leave logic ...

  this.configService.invalidateSpaceKeyCache();
}

// After deleting/archiving a space
async deleteSpace(...) {
  // ... existing delete logic ...

  this.configService.invalidateSpaceKeyCache();
}

// After transferring ownership (if applicable)
async transferOwnership(...) {
  // ... existing transfer logic ...

  this.configService.invalidateSpaceKeyCache();
}
```

**File**: `src/services/EncryptionService.ts`

```typescript
// After key rotation or migration
async rotateSpaceKeys(...) {
  // ... existing rotation logic ...

  this.configService.invalidateSpaceKeyCache();
}

// After encryption state migration
async migrateEncryptionState(...) {
  // ... existing migration logic ...

  this.configService.invalidateSpaceKeyCache();
}
```

### Step 4: Dependency Injection Pattern (Avoid Circular Dependencies)

To avoid tight coupling between services, use dependency injection:

**File**: `src/components/context/MessageDB.tsx` (or service setup)

```typescript
// When initializing services
const configService = new ConfigService(deps);
const spaceService = new SpaceService({
  ...deps,
  invalidateSpaceKeyCache: () => configService.invalidateSpaceKeyCache(),
});
```

This keeps services decoupled while enabling cache invalidation.

### Step 5: Add Cache Stats for Observability (Development Only)

```typescript
/**
 * Get cache statistics for debugging (development only).
 */
getCacheStats(): { size: number; age: number; isValid: boolean } | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!this.spaceMetadataCache) {
    return { size: 0, age: 0, isValid: false };
  }

  const now = Date.now();
  return {
    size: this.spaceMetadataCache.spaceIds.length,
    age: now - this.spaceMetadataCache.timestamp,
    isValid: (now - this.spaceMetadataCache.timestamp) < this.CACHE_TTL,
  };
}
```

## Verification

### Functional Tests
- [ ] First save after login works (metadata cache built)
- [ ] Subsequent saves use cached metadata (faster)
- [ ] Creating new space invalidates cache
- [ ] Joining new space invalidates cache
- [ ] Kicking user invalidates cache
- [ ] Leaving space invalidates cache
- [ ] Cache expires after TTL (30 seconds)
- [ ] Config data is correct (all space keys present)
- [ ] No private keys stored in cache (verify in DevTools heap snapshot)

### Race Condition Tests
- [ ] Concurrent saves don't cause duplicate rebuilds
- [ ] Invalidation during rebuild doesn't cause stale data
- [ ] Save immediately after joining space gets fresh data

### Edge Cases
- [ ] Save immediately after joining space (should re-fetch)
- [ ] Multiple rapid saves (all use same cache)
- [ ] Save after cache TTL expires (should re-fetch)
- [ ] User with 100+ spaces (cache disabled, falls back to direct queries)

### Security Verification
- [ ] DevTools heap snapshot shows NO private keys in cache
- [ ] Only metadata (IDs, timestamps) visible in memory
- [ ] No console.debug output in production builds
- [ ] Cache cleared on invalidation (no lingering references)

## Definition of Done

- [ ] Metadata cache implementation complete (NO private key caching)
- [ ] Cache versioning with race condition protection
- [ ] Concurrent rebuild prevention (mutex pattern)
- [ ] 30-second TTL (not 5 minutes)
- [ ] MAX_CACHED_SPACES limit (100)
- [ ] Invalidation triggers added to ALL relevant operations:
  - [ ] createSpace
  - [ ] joinSpace
  - [ ] kickUser
  - [ ] leaveSpace
  - [ ] deleteSpace
  - [ ] rotateSpaceKeys
  - [ ] migrateEncryptionState
- [ ] Dependency injection pattern (no circular dependencies)
- [ ] No debug logging in production
- [ ] Proper TypeScript types (no `any`)
- [ ] Performance improvement verified (>50% reduction in save time)
- [ ] All functional tests pass
- [ ] All security tests pass
- [ ] No regressions in config sync
- [ ] TypeScript compiles: `npx tsc --noEmit`

## Why This Works

**Space keys are stable**:
- They only change during specific operations (create, join, leave, kick, rotate)
- 99% of config saves don't need fresh space metadata
- Even with conservative 30-second TTL, most saves hit cache

**Safe caching approach**:
- We cache REFERENCES (IDs), not private keys
- Private keys are fetched from IndexedDB only when needed
- Minimal exposure window (30 seconds vs 5 minutes)
- Cache versioning prevents race conditions

**Safe invalidation**:
- We invalidate on ALL operations that could change keys
- Comprehensive list includes create, join, leave, kick, delete, rotate, migrate
- Worst case: one extra DB fetch (not data corruption or security breach)
- TTL ensures eventual consistency even if we miss an invalidation

## Security Trade-offs

| Aspect | Risk | Mitigation |
|--------|------|------------|
| Metadata in memory | Low | Only IDs cached, not key material |
| Stale cache race | Medium | Cache versioning + mutex |
| TTL window | Low | 30 seconds is brief |
| Memory exhaustion | Low | MAX_CACHED_SPACES limit |
| Debug log leakage | Low | Stripped in production |

## Alternative Approaches Considered

### 1. Cache Encrypted Config Blob (Not Chosen)
Cache the final encrypted config instead of keys. **Pro**: No key exposure. **Con**: Must re-encrypt on ANY config change, not just space changes.

### 2. Cache Private Keys Directly (REJECTED)
**Security risk**: Too dangerous. Memory dumps, XSS, extensions could extract all keys.

### 3. Web Worker Isolation (Future Enhancement)
Move all crypto to Web Worker for memory isolation. Aligns with background action queue task.

### 4. No Cache, Optimize Queries Instead (Not Sufficient)
IndexedDB queries are inherently slow. Caching metadata provides bigger wins.

## Related Tasks

- **Complementary to**: `.agents/tasks/background-action-queue-with-worker-crypto.md`
  - This task reduces DB query overhead
  - Action queue task reduces crypto/UI blocking
  - Together they provide maximum improvement

- **GitHub Issue**: [#65 - UserSettingsModal Performance Analysis](https://github.com/QuilibriumNetwork/quorum-desktop/issues/65)

## Future Enhancements

### Web Worker Crypto Isolation
Move encryption operations to Web Worker for better memory isolation:
- Worker has separate memory space
- Harder to access from main thread
- Aligns with background action queue architecture

### Incremental Sync
Instead of sending ALL space keys every time, track which changed:
```typescript
interface ConfigDiff {
  changedSpaceIds: string[];
  addedSpaceIds: string[];
  removedSpaceIds: string[];
}
```
This requires API changes and is out of scope for this task.

### User Control (Feature Flag)
Allow security-conscious users to disable caching:
```typescript
interface UserConfig {
  performanceMode?: 'fast' | 'secure';  // Default: 'secure'
}
```

---


_Risk: Low-Medium (with security mitigations)_
_Dependencies: None_
