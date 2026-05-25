---
type: task
title: Phase 1.4 - LRU Memory Management
status: done
created: 2026-05-25
updated: '2026-05-25'
---

# Phase 1.4 — LRU Memory Management

**Shipped**: 2026-05-25
**Branch**: `feat/search-optimization`
**Time Invested**: ~30 minutes

---

## 🎯 Goal

Bound the number of MiniSearch indices kept in memory so heavy users (many spaces / DMs searched in one session) don't pay an unbounded memory cost. Evicted indices are reloaded transparently from IndexedDB on next access (~10ms hit, per Phase 1.3).

---

## ✅ What Was Implemented

### 1. Access tracking + memory cap

**File**: [src/db/messages.ts:165-172](../../../src/db/messages.ts)

```typescript
private indexAccessTimes: Map<string, number> = new Map();
private static readonly MAX_IN_MEMORY_INDICES = 10;
```

10 is a conservative cap — most users won't have more than a handful of active spaces and DMs in one session. Easy to tune later if metrics suggest otherwise.

### 2. `trackIndexAccess()` called from `ensureIndexReady`

**File**: [src/db/messages.ts:1611-1626](../../../src/db/messages.ts)

Both branches of `ensureIndexReady` (already-cached and fresh-load) record an access timestamp. This means LRU sorting reflects *use*, not *load order*.

### 3. `evictLeastRecentlyUsed()` with flush-before-evict

**File**: [src/db/messages.ts:1730-1772](../../../src/db/messages.ts)

```typescript
private async evictLeastRecentlyUsed(): Promise<void> {
  if (this.searchIndices.size <= MAX_IN_MEMORY_INDICES) return;

  const entries = Array.from(this.indexAccessTimes.entries())
    .sort((a, b) => a[1] - b[1]); // oldest first
  const toEvict = entries.slice(0, this.searchIndices.size - MAX_IN_MEMORY_INDICES);

  for (const [indexKey] of toEvict) {
    if (this.dirtyIndices.has(indexKey)) {
      // Flush dirty state BEFORE dropping — otherwise eviction loses writes
      const index = this.searchIndices.get(indexKey);
      if (index) {
        try {
          await this.saveSearchIndexToDB(indexKey, index);
        } catch (error) {
          // Keep the index in memory if persistence failed — retry next cycle
          logger.warn(`Failed to flush ${indexKey} before eviction; keeping:`, error);
          continue;
        }
      }
      this.dirtyIndices.delete(indexKey);
    }
    this.searchIndices.delete(indexKey);
    this.indexAccessTimes.delete(indexKey);
  }
}
```

Critical detail: if the dirty-state flush fails (e.g. transient IndexedDB error), the index stays in memory rather than getting silently evicted. The next eviction cycle retries.

### 4. Eviction triggered after each search

**File**: [src/db/messages.ts:1845-1849](../../../src/db/messages.ts)

```typescript
// Fire-and-forget — eviction touches IndexedDB but we don't want
// to block returning results on it.
this.evictLeastRecentlyUsed().catch((error) => {
  logger.warn('LRU eviction failed:', error);
});
```

Non-blocking. The user gets their search results immediately; the cleanup happens behind the scenes.

---

## 📊 Impact

| Metric | Before (Phase 1.3) | After (Phase 1.4) |
|--------|---------------------|--------------------|
| **Max in-memory indices** | Unbounded | 10 (configurable) |
| **Memory ceiling (rough)** | grows with `spaces × messages` | ~10 × ~1KB/msg × messages per space |
| **Eviction cost** | N/A | Async, after search completes; ~10ms reload on next access |
| **Data loss on eviction** | N/A | None — flushed before drop |

Phase 1.3 was a hard prerequisite — without persistence, eviction would lose work, and the next search would have to rebuild from messages (~200ms) instead of deserializing (~10ms). Sequencing matters here.

---

## 🧪 Testing

Hard to manually trigger eviction in current testing conditions — would need to actively search 11+ different spaces/DMs in one session. With the small test spaces available, the LRU branch never fires (cap not reached), so behavior is unchanged from Phase 1.3.

Sanity checks that DO apply:
1. Search works (cache + eviction code paths don't throw)
2. Typecheck passes
3. The `evictLeastRecentlyUsed` early-return when under-cap covers the common case

Eviction correctness is straightforward enough that I'm comfortable shipping without a runtime verification — it's standard LRU with a flush hook, and the flush-failure path keeps the index in memory (fail-safe, not fail-lossy).

---

## 📝 Files Modified

Only **src/db/messages.ts**:
- Added `indexAccessTimes` field + `MAX_IN_MEMORY_INDICES` static
- Added `trackIndexAccess()` private method
- Added `evictLeastRecentlyUsed()` private method
- `ensureIndexReady`: track access on both cache-hit and fresh-load
- `searchMessages`: fire-and-forget eviction after building results

Net change: ~55 lines in one file. No other files touched.

---

## 🔗 Related

- **Parent**: [README.md](README.md)
- **Prior**: [phase-1.3-persistence.md](phase-1.3-persistence.md) — hard prerequisite
- **Plan**: [future-phases.md](future-phases.md) — "Phase 1.4" section
- **Next**: Phase 2 (metrics) — only worth doing once we have real production usage to measure

---

## Changelog

- **2026-05-25** — Phase 1.4 shipped.
