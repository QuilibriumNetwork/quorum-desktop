---
type: task
title: Phase 1.2 - Lazy Loading
status: done
created: 2026-05-25
updated: '2026-05-25'
---

# Phase 1.2 — Lazy Loading

**Shipped**: 2026-05-25
**Branch**: `feat/search-optimization`
**Time Invested**: ~1 hour

---

## 🎯 Goal

Eliminate the 2-5s startup blocking caused by building search indices for every space and DM at app launch. Build indices on first search per space/DM instead.

---

## ✅ What Was Implemented

### 1. New `ensureIndexReady()` + `loadIndexLazily()` on MessageDB

**File**: [src/db/messages.ts:1558-1599](../../../src/db/messages.ts)

```typescript
async ensureIndexReady(context: SearchContext): Promise<void> {
  const indexKey = this.getIndexKey(context);
  if (this.searchIndices.has(indexKey)) return;

  const existing = this.indexLoadPromises.get(indexKey);
  if (existing) return existing;

  const loadPromise = this.loadIndexLazily(context, indexKey).finally(() => {
    this.indexLoadPromises.delete(indexKey);
  });
  this.indexLoadPromises.set(indexKey, loadPromise);
  return loadPromise;
}

private async loadIndexLazily(
  context: SearchContext,
  indexKey: string
): Promise<void> {
  await this.init();
  const messages =
    context.type === 'space'
      ? await this.getAllSpaceMessages({ spaceId: context.spaceId! })
      : await this.getDirectMessages(context.conversationId!);

  const searchIndex = this.createSearchIndex();
  searchIndex.addAll(messages.map((msg) => this.messageToSearchable(msg)));
  this.searchIndices.set(indexKey, searchIndex);
}
```

**Concurrency**: `indexLoadPromises` deduplicates concurrent first-search calls for the same context (user mashing the search button before the build resolves).

**Adapter-shape**: `ensureIndexReady` is named to mirror the future `SearchAdapter` interface per [decisions.md decision #9](decisions.md). When the quorum-shared migration unblocks, this becomes the IndexedDB implementation of an adapter method with no logic change.

### 2. `initializeSearchIndices()` → no-op (back-compat)

**File**: [src/db/messages.ts:1551-1557](../../../src/db/messages.ts)

```typescript
async initializeSearchIndices(): Promise<void> {
  return;
}
```

Kept as a no-op so any in-flight callers (e.g. `SearchService.initialize()`) don't break. Grep confirmed no other callers outside `SearchService` itself.

### 3. `searchMessages()` uses lazy loading

**File**: [src/db/messages.ts:1648-1651](../../../src/db/messages.ts)

```typescript
async searchMessages(query, context, limit = 50): Promise<SearchResult[]> {
  await this.ensureIndexReady(context);

  const indexKey = this.getIndexKey(context);
  const searchIndex = this.searchIndices.get(indexKey);
  if (!searchIndex) return [];
  // ... existing search logic unchanged
}
```

### 4. `SearchService.initialize()` → no-op

**File**: [src/services/SearchService.ts:39-46](../../../src/services/SearchService.ts)

Kept for API back-compat; comment notes it's safe to delete once no callers remain.

### 5. Removed upfront initialization from `useSearchService`

**File**: [src/hooks/business/search/useSearchService.ts:19-24](../../../src/hooks/business/search/useSearchService.ts)

```typescript
const searchService = useMemo(() => {
  if (!messageDB) return null;
  // Indices are built lazily on first search per-space/DM (Phase 1.2).
  return new SearchService(messageDB);
}, [messageDB]);
```

### 6. Removed unused `indexInitialized` flag

The `indexInitialized` boolean only guarded the now-removed upfront init path. Replaced with `indexLoadPromises: Map<string, Promise<void>>` for the concurrency guard.

---

## 📊 Impact

| Metric | Before | After |
|--------|--------|-------|
| **App start (search indexing)** | 2-5s blocking | 0ms |
| **First search in a space** | Instant (already built) | ~200ms (lazy build) |
| **Subsequent searches** | Instant | Instant |
| **Memory at startup** | All indices loaded | Empty — populated on demand |

Net win: ~5s of startup latency moved to a one-time ~200ms hit on first search per space. Users who never search a space never pay the cost.

---

## 🧪 Testing

Verified by hand:
1. App restart → opens without errors, no console warnings
2. Open a space, search for a known term → result appears
3. Search again in same space → instant (cached index)
4. Search in a DM → works (separate index path)
5. Send a new message, search for a word from it → appears (incremental `addMessageToIndex` still works because the space's index was loaded by the previous search)
6. Delete a message, search for it → not in results

**Edge case noted**: if a user posts a message in a space whose index hasn't been lazy-loaded yet, `addMessageToIndex` is a no-op for that space (no `spaceIndex` in the map yet). That's correct — when the user eventually does search that space, `loadIndexLazily` will rebuild from messages, picking up the new message naturally. No data loss.

---

## 📝 Files Modified

1. `src/db/messages.ts`
   - Removed `indexInitialized` field; added `indexLoadPromises` map
   - `initializeSearchIndices()` → no-op
   - Added `ensureIndexReady()` + `loadIndexLazily()`
   - `searchMessages()` calls `ensureIndexReady()` instead of `initializeSearchIndices()`

2. `src/services/SearchService.ts`
   - `initialize()` → no-op with deprecation note

3. `src/hooks/business/search/useSearchService.ts`
   - Removed `service.initialize().catch(...)` call at mount

**Total**: ~30 lines net change across 3 files.

---

## 🔗 Related

- **Parent**: [README.md](README.md)
- **Plan (original)**: [future-phases.md](future-phases.md) — "Phase 1.2 — Original Plan" section
- **Decisions**: [decisions.md](decisions.md) #9 (adapter-shaped design)
- **Next**: Phase 1.3 (IndexedDB persistence) — turns the ~200ms first-search cost into ~10ms by caching serialized indices across restarts

---

## Changelog

- **2026-05-25** — Phase 1.2 shipped.
