---
type: task
title: Future Search Optimization Phases
status: in-progress
created: 2026-01-09T00:00:00.000Z
updated: '2026-05-24'
---

# Future Search Optimization Phases


**Last Updated**: 2026-05-24

This document outlines the remaining optimization work planned for search functionality. These phases build on the quick wins already implemented.

## Cross-cutting constraints (read before any phase)

These apply to every phase below; they were not captured in the original doc.

### C1. Stay aligned with the planned `SearchAdapter` migration

`SearchService` is on the quorum-shared migration roadmap as Tier 1B (blocked on mobile codebase access). See [../quorum-shared-migration/designs/2026-05-18-services-design.md §3](../quorum-shared-migration/designs/2026-05-18-services-design.md). When migration unblocks:

- A `SearchAdapter` interface (~4–5 methods: `searchMessages`, `initializeSearchIndices`, `addMessageToIndex`, `removeMessageFromIndex`, plus the persistence hooks introduced in Phase 1.3) gets defined in shared.
- `SearchService` moves verbatim to shared.
- Desktop keeps an IndexedDB-backed adapter; mobile writes a SQLite/MMKV adapter.

**Implication for this work:**
- Service-level logic (Phase 1.2 lazy loading, Phase 1.4 LRU eviction) belongs in `SearchService`, not `MessageDB`. It moves with the migration verbatim.
- Storage-level logic (Phase 1.3 persistence) belongs in `MessageDB`, but designed to be the IndexedDB-shaped implementation of the future `SearchAdapter` interface. Don't inline IndexedDB calls into `SearchService`.

### C2. Use MiniSearch's actual persistence API

The original draft of Phase 1.3 had `searchIndex.addAll(JSON.parse(stored.serializedIndex))`. This is wrong — `addAll` expects source documents and re-tokenizes them, defeating the point of caching. The correct API in MiniSearch 7.2 (the installed version) is:

```typescript
// Serialize
const serialized = JSON.stringify(searchIndex.toJSON());

// Deserialize — MUST pass the same options used to create the original index
const searchIndex = MiniSearch.loadJSON(serialized, {
  fields: ['content', 'senderId'],
  storeFields: ['messageId', 'spaceId', 'channelId', 'createdDate', 'type'],
  searchOptions: { boost: { content: 2, senderId: 1 }, prefix: true, fuzzy: 0.2 },
});
```

`MiniSearch.loadJSONAsync` is also available for large indices that would block on parse.

Centralize the create-options in `createSearchIndex()` (already done at [src/db/messages.ts:1531-1541](../../../src/db/messages.ts)) and reuse them in the load path — otherwise the deserialized index will silently misbehave.

### C3. Don't persist on every message

Original draft suggested calling `saveSearchIndexToDB(spaceIndex)` from inside `addMessageToIndex()`. That re-serializes and writes the entire index to IndexedDB on every incoming message — expensive in busy spaces and noisy on disk. Use a **dirty-flag + debounced flush** instead:

- Mark the index dirty on add/remove.
- Flush dirty indices every N seconds (e.g. 5s), on `visibilitychange` to hidden, and on `beforeunload`.
- On LRU eviction (Phase 1.4), flush synchronously before dropping from memory.

---

## ✅ Phase 1.2: Lazy Loading (COMPLETED 2026-05-25)

See `phase-1.2-lazy-loading.md` for what shipped.

---

## 📅 Phase 1.2 — Original Plan (kept for reference)

**Goal**: Eliminate startup blocking by building search indices on-demand instead of at startup.

**Estimated Effort**: 2-3 days

**Current Problem**:
- All search indices built at startup for ALL spaces/DMs
- Blocks UI for 2-5 seconds
- Wastes CPU for spaces user may never search

**Where the startup cost actually comes from** (verified 2026-05-24):
- [src/hooks/business/search/useSearchService.ts:22-28](../../../src/hooks/business/search/useSearchService.ts) — `useSearchService` instantiates `SearchService` and immediately calls `service.initialize()` in a `useMemo`.
- `service.initialize()` ([src/services/SearchService.ts:39-41](../../../src/services/SearchService.ts)) calls `messageDB.initializeSearchIndices()`.
- `initializeSearchIndices()` ([src/db/messages.ts:1551-1594](../../../src/db/messages.ts)) iterates every space and DM, calls `getAllSpaceMessages` / `getDirectMessages`, and `addAll`s each into a fresh MiniSearch — synchronously from the caller's perspective.

**Solution**:
Build indices lazily when user actually searches that space/DM.

### Key Changes

1. **Remove upfront index building**
   - Remove the `service.initialize().catch(...)` call in `useSearchService` (or change `SearchService.initialize()` to a no-op kept for API back-compat).
   - Optionally delete `SearchService.initialize()` and `MessageDB.initializeSearchIndices()` once nothing else calls them. Grep `initializeSearchIndices` to confirm no other callers.
   - Index building time at app start: 2-5s → 0s ✅

2. **Add on-demand loading on `MessageDB`** (storage-level — this becomes part of the future `SearchAdapter` surface, per C1)
   ```typescript
   async ensureIndexReady(context: SearchContext): Promise<void> {
     const indexKey = this.getIndexKey(context);

     if (this.searchIndices.has(indexKey)) {
       return; // Already loaded
     }

     await this.loadIndexLazily(context);
   }

   private async loadIndexLazily(context: SearchContext): Promise<void> {
     const indexKey = this.getIndexKey(context);
     const messages = context.type === 'space'
       ? await this.getAllSpaceMessages({ spaceId: context.spaceId! })
       : await this.getDirectMessages(context.conversationId!);

     const searchIndex = this.createSearchIndex();
     searchIndex.addAll(messages.map((m) => this.messageToSearchable(m)));
     this.searchIndices.set(indexKey, searchIndex);
   }
   ```

3. **Update `searchMessages()` to lazy-load** ([src/db/messages.ts:1644-1696](../../../src/db/messages.ts))
   ```typescript
   async searchMessages(query, context, limit): Promise<SearchResult[]> {
     await this.ensureIndexReady(context);
     const searchIndex = this.searchIndices.get(this.getIndexKey(context));
     if (!searchIndex) return [];
     // ... existing search logic
   }
   ```

4. **UI feedback for the first-search-in-space case**
   - First search builds the index synchronously (~200ms for a typical space).
   - Add a subtle "indexing…" indicator in `SearchResults` while `searchMessages` is in flight — most of the time it's invisible (subsequent searches), but the first one in a fresh space will hit it.

### Impact

- ✅ Zero startup blocking (0ms instead of 2-5s)
- ✅ 80% memory reduction (only loaded indices in memory)
- ✅ First search in a space takes ~200ms (build + search)
- ✅ Subsequent searches instant (index already loaded)

### Files to Modify

- `src/db/messages.ts` — add `ensureIndexReady()` and `loadIndexLazily()`; update `searchMessages()` to lazy-load
- `src/hooks/business/search/useSearchService.ts` — remove the `service.initialize()` call
- `src/services/SearchService.ts` — either delete `initialize()` or make it a no-op
- `src/components/search/SearchResults.tsx` — add "indexing…" loading state for the first search

### Success Criteria

- [ ] App starts instantly (no search index building)
- [ ] First search in space completes in < 200ms
- [ ] Subsequent searches use cached index
- [ ] All existing functionality preserved
- [ ] No regression in incremental indexing (new/deleted messages still tracked correctly when their space's index is loaded; ignored otherwise — that's fine, lazy load will rebuild fresh)

---

## ✅ Phase 1.3: IndexedDB Persistence (COMPLETED 2026-05-25)

See `phase-1.3-persistence.md` for what shipped.

---

## 📅 Phase 1.3 — Original Plan (kept for reference)

**Goal**: Save search indices to IndexedDB so they don't need to be rebuilt every app restart.

**Estimated Effort**: 2-3 days

**Current Problem**:
- Indices rebuilt from scratch every app restart
- Wastes CPU
- First search after restart takes ~200ms to build index

**Solution**:
Persist serialized search indices to IndexedDB, load on demand. Writes are debounced (per C3) and use MiniSearch's `loadJSON` / `toJSON` correctly (per C2).

### Key Changes

1. **Bump DB version and add object store**
   - Current DB version: 12 (see [src/db/messages.ts:163](../../../src/db/messages.ts)). Bump to 13.
   ```typescript
   if (event.oldVersion < 13) {
     const indexStore = db.createObjectStore('search_indices', {
       keyPath: 'indexKey',
     });
     indexStore.createIndex('by_lastUpdated', 'lastUpdated');
   }
   ```
   Stored record shape:
   ```typescript
   interface StoredSearchIndex {
     indexKey: string;            // 'space:<id>' | 'dm:<conversationId>'
     serializedIndex: string;     // JSON.stringify(MiniSearch.toJSON())
     messageCount: number;
     lastUpdated: number;
     // Optional, for future schema migrations:
     indexVersion?: number;       // bump when MiniSearch options change
   }
   ```

2. **Save/Load methods (correct MiniSearch API)** — see C2

   ```typescript
   private static readonly MINISEARCH_OPTIONS = {
     fields: ['content', 'senderId'],
     storeFields: ['messageId', 'spaceId', 'channelId', 'createdDate', 'type'],
     searchOptions: { boost: { content: 2, senderId: 1 }, prefix: true, fuzzy: 0.2 },
   };

   private createSearchIndex(): MiniSearch<SearchableMessage> {
     return new MiniSearch(MessageDB.MINISEARCH_OPTIONS); // single source of truth
   }

   async saveSearchIndexToDB(indexKey: string, searchIndex: MiniSearch<SearchableMessage>): Promise<void> {
     const record: StoredSearchIndex = {
       indexKey,
       serializedIndex: JSON.stringify(searchIndex.toJSON()),
       messageCount: searchIndex.documentCount,
       lastUpdated: Date.now(),
     };
     // standard idb put on the 'search_indices' store
   }

   async loadSearchIndexFromDB(indexKey: string): Promise<MiniSearch<SearchableMessage> | null> {
     const stored = await /* idb get */;
     if (!stored) return null;

     // ✅ CORRECT: loadJSON restores the index structure directly (no re-tokenization)
     // ❌ DO NOT use addAll(JSON.parse(...)) — that defeats the cache and is wrong API usage
     return MiniSearch.loadJSON(stored.serializedIndex, MessageDB.MINISEARCH_OPTIONS);
   }
   ```

   For very large indices, use `MiniSearch.loadJSONAsync` instead of `loadJSON` to avoid blocking the main thread on parse.

3. **Update lazy loading to check IndexedDB first**
   ```typescript
   private async loadIndexLazily(context: SearchContext): Promise<void> {
     const indexKey = this.getIndexKey(context);

     // Try IndexedDB first
     const cached = await this.loadSearchIndexFromDB(indexKey);
     if (cached) {
       this.searchIndices.set(indexKey, cached);
       return; // Done in ~10ms
     }

     // Build from scratch and persist
     await this.buildFreshIndex(context);
     this.markIndexDirty(indexKey);
     await this.flushDirtyIndices(); // immediate first flush; subsequent writes debounced
   }
   ```

4. **Debounced flush on message changes** (per C3 — NOT immediate)

   ```typescript
   private dirtyIndices: Set<string> = new Set();
   private flushTimer: NodeJS.Timeout | null = null;
   private static readonly FLUSH_DEBOUNCE_MS = 5000;

   private markIndexDirty(indexKey: string): void {
     this.dirtyIndices.add(indexKey);
     if (this.flushTimer) return;
     this.flushTimer = setTimeout(() => this.flushDirtyIndices(), MessageDB.FLUSH_DEBOUNCE_MS);
   }

   async flushDirtyIndices(): Promise<void> {
     if (this.flushTimer) {
       clearTimeout(this.flushTimer);
       this.flushTimer = null;
     }
     const toFlush = Array.from(this.dirtyIndices);
     this.dirtyIndices.clear();
     for (const indexKey of toFlush) {
       const index = this.searchIndices.get(indexKey);
       if (index) await this.saveSearchIndexToDB(indexKey, index);
     }
   }
   ```

   Wire `markIndexDirty(spaceIndexKey)` (and dmIndexKey when applicable) into `addMessageToIndex()` and `removeMessageFromIndex()`. Also call `flushDirtyIndices()` from:
   - `visibilitychange` → hidden
   - `beforeunload`
   - LRU eviction path (Phase 1.4) — synchronously before dropping from memory

### Impact

- ✅ First search after restart: 200ms → ~10ms (20x faster)
- ✅ No CPU waste rebuilding indices
- ✅ Works offline (no backend needed)
- ✅ Write amplification bounded (debounced flush, not per-message)

### Files to Modify

- `src/db/messages.ts` — DB schema bump, persistence methods, dirty-flag plumbing, hook flush into `addMessageToIndex`/`removeMessageFromIndex`/eviction
- App shell or `useSearchService` — wire `visibilitychange` and `beforeunload` flush handlers (one-line each)

### Adapter-shape considerations (per C1)

The four methods this phase adds (`saveSearchIndexToDB`, `loadSearchIndexFromDB`, `markIndexDirty`, `flushDirtyIndices`) are the IndexedDB implementation of what will eventually be `SearchAdapter` interface methods. Name them as if `MessageDB` were already implementing that interface. When migration day arrives, the interface declaration is a copy-paste of these method signatures — no logic change in `SearchService`.

### Success Criteria

- [ ] Indices persist across app restarts
- [ ] First search uses cached index (< 20ms)
- [ ] Automatic invalidation of stale indices
- [ ] Incremental updates maintain consistency
- [ ] Write throughput sane in busy spaces (one flush per 5s window, not per message)
- [ ] No data loss on app close (`beforeunload` flush succeeds in <100ms typical)

---

## ✅ Phase 1.4: LRU Memory Management (COMPLETED 2026-05-25)

See `phase-1.4-lru-eviction.md` for what shipped.

---

## 📅 Phase 1.4 — Original Plan (kept for reference)

**Goal**: Prevent unbounded memory growth as user searches more spaces.

**Estimated Effort**: 1-2 days

**Hard prerequisite**: Phase 1.3 must ship first. LRU is only safe to do when evicted indices can be reloaded from IndexedDB — otherwise eviction destroys work and the next search has to rebuild from messages (~200ms instead of ~10ms). Sequencing: 1.2 → 1.3 → 1.4.

**Current Problem**:
- Every space searched adds index to memory
- Memory usage grows unbounded
- No eviction strategy

**Solution**:
LRU (Least Recently Used) eviction with configurable memory limits. Evicted indices are reloaded transparently from IndexedDB on next access.

### Key Changes

1. **Track index access times**
   ```typescript
   private indexAccessTimes: Map<string, number> = new Map();

   private trackIndexAccess(indexKey: string): void {
     this.indexAccessTimes.set(indexKey, Date.now());
   }
   ```

2. **Evict LRU indices when limit reached**
   ```typescript
   private async evictLeastRecentlyUsed(): Promise<void> {
     const MAX_INDICES = 10; // Configurable limit

     if (this.searchIndices.size <= MAX_INDICES) {
       return;
     }

     // Sort by access time, oldest first
     const entries = Array.from(this.indexAccessTimes.entries())
       .sort((a, b) => a[1] - b[1]);

     // Evict oldest — but flush dirty state first so we don't lose pending writes
     const toEvict = entries.slice(0, entries.length - MAX_INDICES);
     for (const [indexKey] of toEvict) {
       if (this.dirtyIndices.has(indexKey)) {
         const index = this.searchIndices.get(indexKey);
         if (index) await this.saveSearchIndexToDB(indexKey, index);
         this.dirtyIndices.delete(indexKey);
       }
       this.searchIndices.delete(indexKey); // Safe to drop — persisted in IndexedDB
       this.indexAccessTimes.delete(indexKey);
     }
   }
   ```

3. **Call eviction after each search**
   ```typescript
   async searchMessages(query, context, limit): Promise<SearchResult[]> {
     await this.ensureIndexReady(context);
     this.trackIndexAccess(indexKey);

     const results = searchIndex.search(query);

     await this.evictLeastRecentlyUsed(); // Cleanup
     return results;
   }
   ```

### Impact

- ✅ Memory stays under 50MB regardless of spaces searched
- ✅ LRU preserves most-used indices
- ✅ Evicted indices seamlessly reloaded from IndexedDB

### Files to Modify

- `src/db/messages.ts` - Add LRU tracking and eviction

### Success Criteria

- [ ] Memory usage bounded (< 50MB)
- [ ] Most-used indices stay in memory
- [ ] Evicted indices reload transparently
- [ ] No memory leaks during long sessions

---

## 📅 Phase 2: Optimization & Metrics

**Goal**: Measure actual performance and optimize based on real usage data.

**Estimated Effort**: 3-5 days

**When to Start**: After Phase 1.2-1.4 complete

### 2.1 Performance Metrics

**Goal**: Collect data to guide optimization decisions.

**Metrics to Track**:
- Average query time
- Slow queries (>500ms)
- Index build times
- Index sizes (message count per space)
- Cache hit rate
- Memory usage
- User search patterns

**Implementation**:
```typescript
class SearchMetricsCollector {
  trackQuery(query, duration, resultCount): void;
  trackIndexBuild(indexKey, duration, size): void;
  trackCacheHit(wasHit): void;

  getReport(): SearchMetrics;
  exportToConsole(): void;
}
```

**Decision Point**:
After 1 week of metrics, answer:
- Do any spaces have >50k messages? (If yes, consider chunking)
- Are >10% of queries taking >500ms? (If yes, investigate bottleneck)
- Is memory exceeding 50MB? (If yes, reduce LRU limit)

### 2.2 Smart Result Ranking (Optional)

**Goal**: Improve search quality with recency boost if users complain.

**When to Implement**: Only if metrics show old messages dominating results

**Implementation**:
```typescript
function calculateRecencyBoost(messageDate): number {
  const ageDays = (Date.now() - messageDate) / (1000 * 60 * 60 * 24);

  if (ageDays < 1) return 1.2;   // Today: 20% boost
  if (ageDays < 7) return 1.1;   // This week: 10% boost
  if (ageDays < 30) return 1.0;  // This month: neutral
  return 0.95;                    // Older: slight penalty
}

// Apply when sorting results
const finalScore = relevanceScore * calculateRecencyBoost(messageDate);
```

### 2.3 Index Chunking (Conditional)

**Goal**: Handle very large spaces (50k+ messages) efficiently.

**When to Implement**: ONLY if metrics show spaces with >50k messages

**Approach**: Time-based chunking (e.g., 30-day chunks)

**Why Conditional**:
- Adds significant complexity
- May not be needed (most spaces < 10k messages)
- Lazy loading + persistence likely sufficient

---

## 📅 Phase 3: Advanced Features (Optional)

**Goal**: Add advanced capabilities only if Phase 1-2 insufficient.

**Estimated Effort**: 1 week+

**When to Start**: ONLY if metrics show clear need

### Potential Features

1. **Web Workers** (if UI blocking persists)
   - Requires `.native.ts` alternative for mobile
   - High complexity
   - Only implement if lazy loading shows >100ms blocking

2. **Search Filters**
   - Date range picker
   - Sender filter
   - Media type filter
   - Nice-to-have, not critical

3. **Advanced Caching**
   - Predictive prefetching
   - Query variation caching
   - Diminishing returns

4. **Performance Dashboard**
   - Real-time metrics display
   - Debugging tool for developers
   - Low priority

### Decision Framework

**Ask before implementing**:
- Does Phase 1-2 solve 95%+ of issues?
- Do metrics show clear need for this feature?
- Is the complexity justified by the benefit?
- Is there a simpler alternative?

**If answer is NO to any question → Don't implement**

---

## Summary Timeline

| Phase | Duration | Impact | Priority | Status |
|-------|----------|--------|----------|--------|
| **1.1 Quick Wins** | 2 hours | High (immediate value) | ✅ Done | ✅ Complete |
| **1.2 Lazy Loading** | ~1 hour | Very High (eliminates startup blocking) | ✅ Done | ✅ Complete |
| **1.3 Persistence** | ~1.5 hours | High (20x faster first search after restart) | ✅ Done | ✅ Complete |
| **1.4 Memory Mgmt** | ~30 min | Medium (bounds memory) | ✅ Done | ✅ Complete |
| **2.1 Metrics** | 1 day | High (enables data-driven decisions) | High | 📋 Planned |
| **2.2 Ranking** | 1 day | Low (only if needed) | Optional | 📋 Conditional |
| **2.3 Chunking** | 3-4 days | Medium (if large spaces exist) | Optional | 📋 Conditional |
| **3.x Advanced** | 1 week+ | Low (edge cases) | Low | 📋 Optional |

**Recommended Next Step**: Phase 2 (metrics) — but defer until there's enough production usage to make the measurements meaningful. Foundation phases 1.2-1.4 are now complete.

---

**Last Updated**: 2026-05-25
**Next Review**: After Phase 1.3 implementation

## Changelog

- **2026-05-25** — Phase 1.4 marked complete; see `phase-1.4-lru-eviction.md`. Foundation phases 1.2-1.4 complete; next step is Phase 2 metrics (deferred until production usage).
- **2026-05-25** — Phase 1.3 marked complete; see `phase-1.3-persistence.md` for shipped work. Recommended next step updated to Phase 1.4.
- **2026-05-25** — Phase 1.2 marked complete; see `phase-1.2-lazy-loading.md` for shipped work.
- **2026-05-24** — Major revision after session research:
  - Added Cross-cutting constraints section (C1 SearchAdapter alignment, C2 MiniSearch `loadJSON`/`toJSON` correct API, C3 debounced flush instead of per-message save).
  - Phase 1.2: pointed at actual startup-blocker location (`useSearchService` hook, not just `SearchService.initialize()`); added UI loading state requirement.
  - Phase 1.3: fixed pseudo-code that used `addAll(JSON.parse(...))` (wrong) → `MiniSearch.loadJSON(...)` (correct); centralized MiniSearch options as a static so create + load match; replaced per-message persistence with dirty-flag + debounced flush + lifecycle hooks; added DB version bump note (12 → 13); added adapter-shape naming guidance.
  - Phase 1.4: marked Phase 1.3 as a hard prerequisite; added flush-before-evict step.
- **2025-11-12** — Initial roadmap drafted alongside Phase 1.1 quick wins.
