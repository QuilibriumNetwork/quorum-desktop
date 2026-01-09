---
type: task
title: Future Search Optimization Phases
status: in-progress
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Future Search Optimization Phases


**Last Updated**: 2025-11-12

This document outlines the remaining optimization work planned for search functionality. These phases build on the quick wins already implemented.

---

## 📅 Phase 1.2: Lazy Loading

**Goal**: Eliminate startup blocking by building search indices on-demand instead of at startup.

**Estimated Effort**: 2-3 days

**Current Problem**:
- All search indices built at startup for ALL spaces/DMs
- Blocks UI for 2-5 seconds
- Wastes CPU for spaces user may never search

**Solution**:
Build indices lazily when user actually searches that space/DM.

### Key Changes

1. **Remove upfront index building**
   - Delete call to `initializeSearchIndices()` at startup
   - Index building time: 2-5s → 0s ✅

2. **Add on-demand loading**
   ```typescript
   async ensureIndexReady(context: SearchContext): Promise<void> {
     const indexKey = this.getIndexKey(context);

     if (this.searchIndices.has(indexKey)) {
       return; // Already loaded
     }

     // Build index on first search
     await this.loadIndexLazily(context);
   }
   ```

3. **Update search to use lazy loading**
   ```typescript
   async searchMessages(query, context, limit): Promise<SearchResult[]> {
     await this.ensureIndexReady(context); // Lazy load if needed

     const searchIndex = this.searchIndices.get(indexKey);
     return searchIndex.search(query);
   }
   ```

### Impact

- ✅ Zero startup blocking (0ms instead of 2-5s)
- ✅ 80% memory reduction (only loaded indices in memory)
- ✅ First search in a space takes ~200ms (build + search)
- ✅ Subsequent searches instant (index already loaded)

### Files to Modify

- `src/db/messages.ts` - Add `ensureIndexReady()`, `loadIndexLazily()`
- `src/services/SearchService.ts` - Remove `initialize()` call

### Success Criteria

- [ ] App starts instantly (no search index building)
- [ ] First search in space completes in < 200ms
- [ ] Subsequent searches use cached index
- [ ] All existing functionality preserved

---

## 📅 Phase 1.3: IndexedDB Persistence

**Goal**: Save search indices to IndexedDB so they don't need to be rebuilt every app restart.

**Estimated Effort**: 2-3 days

**Current Problem**:
- Indices rebuilt from scratch every app restart
- Wastes CPU
- First search after restart takes ~200ms to build index

**Solution**:
Persist serialized search indices to IndexedDB, load on demand.

### Key Changes

1. **Add IndexedDB object store**
   ```typescript
   // Add to database schema
   if (!db.objectStoreNames.contains('search_indices')) {
     const indexStore = db.createObjectStore('search_indices', {
       keyPath: 'indexKey'
     });
     indexStore.createIndex('lastUpdated', 'lastUpdated');
   }
   ```

2. **Save/Load methods**
   ```typescript
   async saveSearchIndexToDB(indexKey, searchIndex): Promise<void> {
     const serialized = JSON.stringify(searchIndex.toJSON());
     await db.put('search_indices', {
       indexKey,
       serializedIndex: serialized,
       messageCount: searchIndex.documentCount,
       lastUpdated: Date.now(),
     });
   }

   async loadSearchIndexFromDB(indexKey): Promise<MiniSearch | null> {
     const stored = await db.get('search_indices', indexKey);
     if (!stored) return null;

     const searchIndex = new MiniSearch({...});
     searchIndex.addAll(JSON.parse(stored.serializedIndex));
     return searchIndex;
   }
   ```

3. **Update lazy loading to check IndexedDB first**
   ```typescript
   async loadIndexLazily(context): Promise<void> {
     // Try IndexedDB first
     const cached = await this.loadSearchIndexFromDB(indexKey);
     if (cached) {
       this.searchIndices.set(indexKey, cached);
       return; // Done in ~10ms!
     }

     // Build from scratch if not in cache
     await this.buildFreshIndex(context);
     await this.saveSearchIndexToDB(indexKey, index);
   }
   ```

4. **Update on message changes**
   ```typescript
   async addMessageToIndex(message): Promise<void> {
     spaceIndex.add(this.messageToSearchable(message));

     // Also update persisted index
     await this.saveSearchIndexToDB(spaceIndexKey, spaceIndex);
   }
   ```

### Impact

- ✅ First search after restart: 200ms → ~10ms (20x faster)
- ✅ No CPU waste rebuilding indices
- ✅ Works offline (no backend needed)

### Files to Modify

- `src/db/messages.ts` - Add persistence methods, update schema
- Update `addMessageToIndex()` and `removeMessageFromIndex()`

### Success Criteria

- [ ] Indices persist across app restarts
- [ ] First search uses cached index (< 20ms)
- [ ] Automatic invalidation of stale indices
- [ ] Incremental updates maintain consistency

---

## 📅 Phase 1.4: Memory Management (LRU)

**Goal**: Prevent unbounded memory growth as user searches more spaces.

**Estimated Effort**: 1-2 days

**Current Problem**:
- Every space searched adds index to memory
- Memory usage grows unbounded
- No eviction strategy

**Solution**:
LRU (Least Recently Used) eviction with configurable memory limits.

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

     // Evict oldest
     const toEvict = entries.slice(0, entries.length - MAX_INDICES);
     for (const [indexKey] of toEvict) {
       this.searchIndices.delete(indexKey); // Index is in IndexedDB
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
| **1.2 Lazy Loading** | 2-3 days | Very High (90% startup improvement) | 🔥 Critical | 📋 Planned |
| **1.3 Persistence** | 2-3 days | High (20x faster subsequent searches) | 🔥 Critical | 📋 Planned |
| **1.4 Memory Mgmt** | 1-2 days | Medium (prevents leaks) | High | 📋 Planned |
| **2.1 Metrics** | 1 day | High (enables data-driven decisions) | High | 📋 Planned |
| **2.2 Ranking** | 1 day | Low (only if needed) | Optional | 📋 Conditional |
| **2.3 Chunking** | 3-4 days | Medium (if large spaces exist) | Optional | 📋 Conditional |
| **3.x Advanced** | 1 week+ | Low (edge cases) | Low | 📋 Optional |

**Recommended Next Step**: Start with Phase 1.2 (Lazy Loading) after validating current quick wins work well.

---

**Last Updated**: 2025-11-12
**Next Review**: After Phase 1.2 implementation
