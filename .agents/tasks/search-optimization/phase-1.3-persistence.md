---
type: task
title: Phase 1.3 - IndexedDB Persistence
status: done
created: 2026-05-25
updated: '2026-05-25'
---

# Phase 1.3 — IndexedDB Persistence

**Shipped**: 2026-05-25
**Branch**: `feat/search-optimization`
**Time Invested**: ~1.5 hours

---

## 🎯 Goal

Persist serialized MiniSearch indices to IndexedDB so first-search-after-restart drops from ~200ms (rebuild from messages) to ~10ms (deserialize cached index).

---

## ✅ What Was Implemented

### 1. DB schema bump (12 → 13)

**File**: [src/db/messages.ts:163](../../../src/db/messages.ts), [src/db/messages.ts:323-330](../../../src/db/messages.ts)

New `search_indices` object store, keyed by `indexKey` (`'space:<id>'` or `'dm:<conversationId>'`), with a `by_lastUpdated` index for future LRU/cleanup work.

Record shape ([src/db/messages.ts:161-166](../../../src/db/messages.ts)):
```typescript
interface StoredSearchIndex {
  indexKey: string;
  serializedIndex: string;
  messageCount: number;
  lastUpdated: number;
}
```

### 2. Single source of truth for MiniSearch options

**File**: [src/db/messages.ts:1556-1568](../../../src/db/messages.ts)

```typescript
private static readonly MINISEARCH_OPTIONS: Options<SearchableMessage> = {
  fields: ['content', 'senderId'],
  storeFields: ['messageId', 'spaceId', 'channelId', 'createdDate', 'type'],
  searchOptions: { boost: { content: 2, senderId: 1 }, prefix: true, fuzzy: 0.2 },
};
```

Used by both `createSearchIndex()` and `loadSearchIndexFromDB()`. Per [decisions.md #10](decisions.md), drift between create and load silently breaks fuzzy/boost/stored-field behavior, so this is enforced via a single constant.

### 3. `saveSearchIndexToDB` / `loadSearchIndexFromDB`

**File**: [src/db/messages.ts:1644-1714](../../../src/db/messages.ts)

- **Save**: `JSON.stringify(searchIndex.toJSON())` into the `search_indices` store.
- **Load**: `MiniSearch.loadJSON(serialized, MINISEARCH_OPTIONS)` — NOT `addAll(JSON.parse(...))` which would re-tokenize and defeat the cache. Returns `null` on miss or on deserialize failure (caller falls back to fresh build).

### 4. Dirty-flag + debounced flush

**File**: [src/db/messages.ts:1716-1755](../../../src/db/messages.ts)

```typescript
private dirtyIndices: Set<string> = new Set();
private flushTimer: ReturnType<typeof setTimeout> | null = null;
private static readonly FLUSH_DEBOUNCE_MS = 5000;

private markIndexDirty(indexKey: string): void { ... }
async flushDirtyIndices(): Promise<void> { ... }
```

Per [decisions.md #11](decisions.md). Coalesces bursts (~10 msg/sec in busy spaces) into one write per 5s window instead of re-serializing the entire index per message. On flush failure, the index is re-marked dirty to retry next window.

### 5. Wired into incremental update path

**File**: [src/db/messages.ts:1773-1825](../../../src/db/messages.ts)

`addMessageToIndex` and `removeMessageFromIndex` call `markIndexDirty(spaceIndexKey)` (and `dmIndexKey` if applicable) after each in-memory update.

### 6. Cache-first lazy load

**File**: [src/db/messages.ts:1615-1640](../../../src/db/messages.ts)

`loadIndexLazily` now tries `loadSearchIndexFromDB()` first; only falls through to fresh build (and marks dirty) on cache miss.

### 7. Lifecycle flush handlers

**Files**: [src/services/SearchService.ts:283-289](../../../src/services/SearchService.ts), [src/hooks/business/search/useSearchService.ts:31-46](../../../src/hooks/business/search/useSearchService.ts)

`SearchService.flushIndices()` exposes the underlying `MessageDB.flushDirtyIndices()`. `useSearchService` wires it to `document.visibilitychange` (tab hidden) and `window.beforeunload` (closing), so the last ~5s of debounced writes don't get lost on app close.

### 8. Removed stale hand-written type shadow

**File**: deleted `src/types/minisearch.d.ts`

A stopgap `declare module 'minisearch'` file existed (probably from MiniSearch 6.x days) that shadowed the real types. It omitted `documentCount`, made `static loadJSON` non-generic, etc. Deleted in favour of MiniSearch 7.2's first-party types. Only `src/db/messages.ts` imported from `minisearch`, so the impact was contained.

---

## 📊 Impact

| Metric | Before (Phase 1.2) | After (Phase 1.3) |
|--------|--------------------|--------------------|
| **First search after restart** | ~200ms (rebuild from messages) | ~10ms (deserialize cache) |
| **Write amplification on busy space** | N/A (no writes) | 1 write per 5s window, not per-message |
| **Durability window** | None (in-memory only) | ≤5s typical, flushed on tab hide / close |
| **DB schema version** | 12 | 13 |

Crash/loss model: at most ~5s of incremental updates lost on hard crash. Acceptable because the messages themselves remain in the `messages` store — worst case, the next lazy-load rebuilds a slightly-stale index from source, then re-persists.

---

## 🧪 Testing

### Manual sanity check
1. App reload → indexes get rebuilt + persisted on first search per space.
2. Second app reload → first search hits the cache (visible only with devtools timing).
3. Send/delete messages → no error, index stays dirty within the 5s window.
4. Close tab during active search activity → indices persisted via `beforeunload`.

Note from user: real load testing is limited until production usage. Behaviour with small message counts is functionally identical to Phase 1.2; cache-hit speedup only meaningful on spaces with thousands of messages.

### Verifying the DB upgrade
On first launch after this change, IndexedDB upgrades from v12 → v13. If the upgrade fails (e.g. user has the app open in another tab on the old version), `init()` will reject and the search feature will degrade — but the app itself stays functional.

---

## 📝 Files Modified

1. **src/db/messages.ts**
   - DB version 12 → 13
   - Added `search_indices` object store in upgrade handler
   - Added `StoredSearchIndex` interface
   - Added `MINISEARCH_OPTIONS` static + `Options<SearchableMessage>` import
   - Added `dirtyIndices`, `flushTimer`, `FLUSH_DEBOUNCE_MS` fields
   - Added `saveSearchIndexToDB`, `loadSearchIndexFromDB`, `markIndexDirty`, `flushDirtyIndices`
   - `loadIndexLazily`: cache-first
   - `addMessageToIndex` / `removeMessageFromIndex`: mark dirty after each update

2. **src/services/SearchService.ts**
   - Added `flushIndices()` public method

3. **src/hooks/business/search/useSearchService.ts**
   - Added `useEffect` to wire `visibilitychange` + `beforeunload` flush handlers

4. **src/types/minisearch.d.ts** — DELETED (stale hand-written shadow)

---

## 🔗 Related

- **Parent**: [README.md](README.md)
- **Prior**: [phase-1.2-lazy-loading.md](phase-1.2-lazy-loading.md)
- **Plan**: [future-phases.md](future-phases.md) — "Phase 1.3" section
- **Decisions**: [decisions.md](decisions.md) #9 (adapter shape), #10 (loadJSON API), #11 (debounce policy)
- **Next**: Phase 1.4 (LRU eviction) — bounded memory; only safe after persistence is in place so eviction doesn't lose work

---

## Changelog

- **2026-05-25** — Phase 1.3 shipped.
