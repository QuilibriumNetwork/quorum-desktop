# 🚀 Search Performance Optimization - Revised Implementation Plan

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> _Revised based on feature-analyzer recommendations_

**Status**: Ready for Implementation
**Priority**: High
**Approach**: Start Simple, Measure Impact, Add Complexity Only If Needed
**Timeline**: 1-2 weeks for core improvements

---

## 📊 Current State Analysis

### The Problem

**Startup Performance**:
- Search index building blocks main thread (2-5 seconds)
- All indices built upfront for ALL spaces/DMs on app startup
- Indices rebuilt from scratch every app restart (no persistence)
- Unbounded memory growth (all indices kept in memory)

**Current Implementation** (`src/db/messages.ts:891-934`):
```typescript
async initializeSearchIndices(): Promise<void> {
  // ❌ Blocks UI: Builds ALL indices synchronously
  // ❌ Wasteful: Builds indices for spaces that may never be searched
  // ❌ No persistence: Rebuilds from IndexedDB messages every restart

  const spaces = await this.getSpaces();  // All spaces
  const dmConversations = await this.getConversations({ type: 'direct' });

  for (const space of spaces) {
    const messages = await this.getAllSpaceMessages({ spaceId: space.spaceId });
    const searchIndex = this.createSearchIndex();
    searchIndex.addAll(messages.map(msg => this.messageToSearchable(msg)));
    this.searchIndices.set(`space:${space.spaceId}`, searchIndex);  // All in memory
  }
  // ... similar for DMs
}
```

**Search Results UI**:
- No virtualization (unlike MessageList and UsersList which use Virtuoso)
- Renders all results at once causing performance issues with 50+ results
- Existing `useSearchResultsVirtualization.ts` hook not being used

### What's Already Good ✅

- **MessageDB refactored**: Clean architecture (81% reduction from 5,650 to 1,090 lines)
- **SearchService exists**: Has caching (5min TTL), debouncing (300ms), LRU eviction
- **Incremental updates work**: `addMessageToIndex()` and `removeMessageFromIndex()` handle new/deleted messages correctly
- **IndexedDB ready**: Infrastructure exists, just need to add search index object store
- **Virtuoso pattern exists**: Already used in MessageList, UsersList, and hook exists for search results

### Performance Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Startup time | 2-5 seconds | < 200ms | 90%+ reduction |
| Memory usage | 5-10MB per space | < 50MB total | 80%+ reduction |
| Search response | < 100ms | < 50ms | 50% improvement |
| UI blocking | 2-5 seconds | 0ms | 100% elimination |
| Index build strategy | Upfront all | On-demand lazy | 80% resource savings |

---

## 🎯 Implementation Strategy

### Philosophy: Start Simple → Measure → Add Complexity Only If Needed

**Phase 1** solves 80% of the problem with simple, cross-platform solutions.
**Phase 2** measures impact and optimizes based on real data.
**Phase 3** adds advanced features ONLY if metrics show they're needed.

---

## 📅 Phase 1: Foundation (Week 1) - Quick Wins

### 1.1 Integrate Existing Virtuoso ⚡ QUICK WIN

**Effort**: 1-2 hours
**Impact**: High (smooth scrolling with 50+ results)
**Risk**: Very Low
**Status**: Not Started

**Problem**:
`SearchResults.tsx` uses `.map()` to render all results, but `useSearchResultsVirtualization.ts` hook already exists and is unused.

**Solution**:
Update `src/components/search/SearchResults.tsx:113-127`:

**Before**:
```tsx
<Container className="search-results-list">
  {results.map((result, index) => (
    <SearchResultItem
      key={`${result.message.messageId}-${index}`}
      result={result}
      onNavigate={handleNavigate}
      highlightTerms={highlightTerms}
      searchTerms={searchTerms}
      index={index}
      displayData={resultsData.get(result.message.messageId)}
    />
  ))}
</Container>
```

**After**:
```tsx
<Virtuoso
  data={results}
  itemContent={(index, result) => (
    <SearchResultItem
      key={`${result.message.messageId}-${index}`}
      result={result}
      onNavigate={handleNavigate}
      highlightTerms={highlightTerms}
      searchTerms={searchTerms}
      index={index}
      displayData={resultsData.get(result.message.messageId)}
    />
  )}
  style={{ height: maxHeight }}
  className="search-results-list"
/>
```

**Success Criteria**:
- [ ] Smooth 60fps scrolling with 100+ search results
- [ ] Reduced memory usage for large result sets
- [ ] No performance regression for small result sets

---

### 1.2 Lazy Loading Architecture 🎯 HIGHEST IMPACT

**Effort**: 2-3 days
**Impact**: Very High (80% of performance improvement)
**Risk**: Low
**Status**: Not Started
**Priority**: Do this FIRST (before persistence, before workers)

**Problem**:
Building indices for ALL spaces/DMs on startup, even if user never searches them.

**Solution**:
Build indices on-demand when user actually searches that context.

**Implementation** (`src/db/messages.ts`):

```typescript
// Remove old initializeSearchIndices() - replace with lazy loading

private indexLoadingPromises: Map<string, Promise<void>> = new Map();

async ensureIndexReady(context: SearchContext): Promise<void> {
  const indexKey = this.getIndexKey(context);

  // Already loaded
  if (this.searchIndices.has(indexKey)) {
    return;
  }

  // Currently loading - return existing promise
  if (this.indexLoadingPromises.has(indexKey)) {
    return this.indexLoadingPromises.get(indexKey)!;
  }

  // Start loading
  const loadPromise = this.loadIndexLazily(context);
  this.indexLoadingPromises.set(indexKey, loadPromise);

  try {
    await loadPromise;
  } finally {
    this.indexLoadingPromises.delete(indexKey);
  }
}

private async loadIndexLazily(context: SearchContext): Promise<void> {
  const indexKey = this.getIndexKey(context);

  // Try to load from IndexedDB first (Phase 1.3)
  const stored = await this.loadSearchIndexFromDB(indexKey);
  if (stored) {
    this.searchIndices.set(indexKey, stored);
    return;
  }

  // Build fresh index
  const searchIndex = this.createSearchIndex();

  if (context.type === 'space') {
    const messages = await this.getAllSpaceMessages({ spaceId: context.spaceId });
    const searchableMessages = messages.map(msg => this.messageToSearchable(msg));
    searchIndex.addAll(searchableMessages);
  } else {
    const messages = await this.getDirectMessages(context.conversationId);
    const searchableMessages = messages.map(msg => this.messageToSearchable(msg));
    searchIndex.addAll(searchableMessages);
  }

  this.searchIndices.set(indexKey, searchIndex);

  // Save to IndexedDB for next time (Phase 1.3)
  await this.saveSearchIndexToDB(indexKey, searchIndex);
}

// Update searchMessages to use lazy loading
async searchMessages(
  query: string,
  context: SearchContext,
  limit: number = 50
): Promise<SearchResult[]> {
  // Ensure index is ready (lazy load if needed)
  await this.ensureIndexReady(context);

  const indexKey = this.getIndexKey(context);
  const searchIndex = this.searchIndices.get(indexKey);

  if (!searchIndex) {
    return [];
  }

  // ... rest of search logic
}
```

**UI Updates** (`src/services/SearchService.ts`):

```typescript
async search(searchQuery: SearchQuery): Promise<SearchResult[]> {
  const { query, context, limit = this.config.maxResults } = searchQuery;

  if (!query.trim()) {
    return [];
  }

  const cacheKey = this.getCacheKey(query, context);
  const cached = this.searchCache.get(cacheKey);
  if (cached && this.isValidCache(cached)) {
    return cached.results.slice(0, limit);
  }

  try {
    // This will now trigger lazy loading if index not ready
    const results = await this.messageDB.searchMessages(query, context, limit);

    this.searchCache.set(cacheKey, {
      results,
      timestamp: Date.now(),
      query,
      contextKey: this.getCacheKey('', context),
    });

    this.cleanCache();
    return results;
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}
```

**Success Criteria**:
- [ ] No index building on app startup (0ms startup impact)
- [ ] Indices built only when user searches that space/DM
- [ ] 80% reduction in memory usage (only loaded indices in memory)
- [ ] Smooth loading experience with proper UI feedback
- [ ] All existing search functionality preserved

**Mobile Compatibility**: ✅ Cross-platform (no web-only APIs)

---

### 1.3 IndexedDB Persistence 💾

**Effort**: 2-3 days
**Impact**: High (90% startup time reduction)
**Risk**: Low (leverage existing IndexedDB setup)
**Status**: Not Started
**Dependencies**: 1.2 (builds on lazy loading)

**Problem**:
Indices rebuilt from scratch every app restart.

**Solution**:
Persist serialized search indices to IndexedDB, load on demand.

**Implementation**:

**1. Add IndexedDB Object Store** (`src/db/messages.ts` - update schema):

```typescript
private async initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('QuorumMessagesDB', 6); // Increment version

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // ... existing object stores ...

      // New: Search indices object store
      if (!db.objectStoreNames.contains('search_indices')) {
        const indexStore = db.createObjectStore('search_indices', { keyPath: 'indexKey' });
        indexStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

**2. Save/Load Methods**:

```typescript
interface StoredSearchIndex {
  indexKey: string;           // "space:xxx" or "dm:xxx"
  serializedIndex: string;    // JSON.stringify(miniSearchIndex.toJSON())
  version: number;            // For invalidation (increment on schema change)
  messageCount: number;       // For staleness detection
  lastUpdated: number;        // Timestamp
}

private async saveSearchIndexToDB(indexKey: string, searchIndex: MiniSearch<SearchableMessage>): Promise<void> {
  const db = await this.init();
  const tx = db.transaction('search_indices', 'readwrite');
  const store = tx.objectStore('search_indices');

  const stored: StoredSearchIndex = {
    indexKey,
    serializedIndex: JSON.stringify(searchIndex.toJSON()),
    version: 1, // Increment when search schema changes
    messageCount: searchIndex.documentCount,
    lastUpdated: Date.now(),
  };

  await store.put(stored);
}

private async loadSearchIndexFromDB(indexKey: string): Promise<MiniSearch<SearchableMessage> | null> {
  const db = await this.init();
  const tx = db.transaction('search_indices', 'readonly');
  const store = tx.objectStore('search_indices');

  const stored = await store.get(indexKey) as StoredSearchIndex | undefined;

  if (!stored) {
    return null;
  }

  // Version check (invalidate if schema changed)
  if (stored.version !== 1) {
    await this.deleteSearchIndexFromDB(indexKey);
    return null;
  }

  // Staleness check (optional: rebuild if message count changed significantly)
  const currentMessageCount = await this.getMessageCount(indexKey);
  if (Math.abs(currentMessageCount - stored.messageCount) > 10) {
    // Index is stale, rebuild
    await this.deleteSearchIndexFromDB(indexKey);
    return null;
  }

  // Restore from JSON
  const searchIndex = this.createSearchIndex();
  searchIndex.addAll(JSON.parse(stored.serializedIndex));

  return searchIndex;
}

private async deleteSearchIndexFromDB(indexKey: string): Promise<void> {
  const db = await this.init();
  const tx = db.transaction('search_indices', 'readwrite');
  const store = tx.objectStore('search_indices');
  await store.delete(indexKey);
}
```

**3. Update on Message Changes**:

```typescript
async addMessageToIndex(message: Message): Promise<void> {
  // Add to in-memory index
  const spaceIndexKey = `space:${message.spaceId}`;
  const spaceIndex = this.searchIndices.get(spaceIndexKey);
  if (spaceIndex) {
    spaceIndex.add(this.messageToSearchable(message));
    // Update IndexedDB
    await this.saveSearchIndexToDB(spaceIndexKey, spaceIndex);
  }

  // Same for DM index...
}

async removeMessageFromIndex(messageId: string, spaceId: string, channelId: string): Promise<void> {
  // Remove from in-memory index
  const spaceIndexKey = `space:${spaceId}`;
  const spaceIndex = this.searchIndices.get(spaceIndexKey);
  if (spaceIndex) {
    spaceIndex.removeById(messageId);
    // Update IndexedDB
    await this.saveSearchIndexToDB(spaceIndexKey, spaceIndex);
  }

  // Same for DM index...
}
```

**Success Criteria**:
- [ ] Indices persist across app restarts
- [ ] First search after restart uses cached index (< 200ms)
- [ ] Automatic invalidation of stale indices
- [ ] Incremental updates maintain index consistency

**Mobile Compatibility**: ✅ Cross-platform (IndexedDB exists in React Native via polyfill)

---

### 1.4 Memory Management with LRU 🧠

**Effort**: 1-2 days
**Impact**: Medium (prevent memory leaks)
**Risk**: Low
**Status**: Not Started
**Dependencies**: 1.2, 1.3

**Problem**:
Unbounded memory growth as more spaces/DMs are searched.

**Solution**:
LRU (Least Recently Used) eviction with configurable memory limits.

**Implementation** (`src/db/messages.ts`):

```typescript
interface MemoryConfig {
  maxIndicesCount: number;      // Default: 10 loaded indices
  maxTotalMemoryMB: number;     // Default: 50MB
  evictionThresholdMB: number;  // Default: 40MB (trigger eviction)
}

class MessageDB {
  private config: MemoryConfig = {
    maxIndicesCount: 10,
    maxTotalMemoryMB: 50,
    evictionThresholdMB: 40,
  };

  private indexAccessTimes: Map<string, number> = new Map();

  private trackIndexAccess(indexKey: string): void {
    this.indexAccessTimes.set(indexKey, Date.now());
  }

  private async evictLeastRecentlyUsed(): Promise<void> {
    // Check if eviction needed
    if (this.searchIndices.size <= this.config.maxIndicesCount) {
      return;
    }

    // Sort by last access time (oldest first)
    const entries = Array.from(this.indexAccessTimes.entries());
    entries.sort((a, b) => a[1] - b[1]);

    // Evict oldest indices until under limit
    const toEvict = entries.slice(0, entries.length - this.config.maxIndicesCount);

    for (const [indexKey] of toEvict) {
      // Index is already in IndexedDB (saved in Phase 1.3)
      this.searchIndices.delete(indexKey);
      this.indexAccessTimes.delete(indexKey);
      console.log(`[Memory] Evicted search index: ${indexKey}`);
    }
  }

  async searchMessages(
    query: string,
    context: SearchContext,
    limit: number = 50
  ): Promise<SearchResult[]> {
    await this.ensureIndexReady(context);

    const indexKey = this.getIndexKey(context);
    const searchIndex = this.searchIndices.get(indexKey);

    if (!searchIndex) {
      return [];
    }

    // Track access for LRU
    this.trackIndexAccess(indexKey);

    // Evict if needed
    await this.evictLeastRecentlyUsed();

    // ... rest of search logic
  }
}
```

**Success Criteria**:
- [ ] Memory usage stays under 50MB regardless of spaces searched
- [ ] LRU eviction preserves most-used indices
- [ ] Evicted indices can be reloaded from IndexedDB seamlessly
- [ ] No memory leaks during long-running sessions

**Mobile Compatibility**: ✅ Cross-platform

---

### 1.5 Quick Config Optimization ⚡

**Effort**: 5 minutes
**Impact**: Low-Medium
**Risk**: None
**Status**: Not Started

**Change** (`src/services/SearchService.ts:33`):

```typescript
this.config = {
  debounceMs: 300,
  maxResults: 25,  // ← Change from 50 to 25
  cacheSize: 100,
  ...config,
};
```

**Rationale**:
- Users rarely need 50 results
- Smaller result sets = faster searches
- Less memory usage
- Better UX (fewer results to scan)

**Success Criteria**:
- [ ] Faster search responses
- [ ] Reduced memory usage
- [ ] User can still find relevant results

---

## 📅 Phase 2: Measure & Optimize (Week 2)

### 2.1 Performance Metrics & Analytics 📊 REQUIRED

**Effort**: 1 day
**Impact**: High (enables data-driven decisions)
**Risk**: Low
**Status**: Not Started
**Priority**: Do this BEFORE any advanced optimizations

**Problem**:
No data to inform optimization decisions. We don't know:
- What % of spaces have >10k, >50k, >100k messages?
- What % of searches take >500ms?
- Which optimizations actually help?

**Solution**:
Implement comprehensive performance tracking.

**Implementation** (`src/services/SearchMetrics.ts` - NEW FILE):

```typescript
export interface SearchMetrics {
  // Query metrics
  queryCount: number;
  averageQueryTime: number;
  slowQueries: Array<{ query: string; time: number; context: string }>;

  // Index metrics
  indexBuildTimes: Map<string, number>;
  indexSizes: Map<string, number>;
  indexHitRate: number; // % of searches using cached index

  // Memory metrics
  totalMemoryUsage: number;
  evictionCount: number;

  // User behavior
  mostSearchedSpaces: Array<{ spaceId: string; count: number }>;
  searchPatterns: Map<string, number>;
}

export class SearchMetricsCollector {
  private metrics: SearchMetrics;

  trackQuery(query: string, context: SearchContext, duration: number): void {
    this.metrics.queryCount++;
    this.updateAverage(duration);

    if (duration > 500) {
      this.metrics.slowQueries.push({
        query,
        time: duration,
        context: this.getContextKey(context),
      });
    }
  }

  trackIndexBuild(indexKey: string, duration: number, size: number): void {
    this.metrics.indexBuildTimes.set(indexKey, duration);
    this.metrics.indexSizes.set(indexKey, size);
  }

  trackCacheHit(wasHit: boolean): void {
    // Update hit rate calculation
  }

  getReport(): SearchMetrics {
    return this.metrics;
  }

  exportToConsole(): void {
    console.group('🔍 Search Performance Metrics');
    console.log('Average query time:', this.metrics.averageQueryTime, 'ms');
    console.log('Slow queries (>500ms):', this.metrics.slowQueries.length);
    console.log('Index hit rate:', this.metrics.indexHitRate, '%');
    console.log('Total memory usage:', this.metrics.totalMemoryUsage, 'MB');
    console.table(Array.from(this.metrics.indexSizes.entries()));
    console.groupEnd();
  }
}
```

**Integration** (`src/db/messages.ts`):

```typescript
import { SearchMetricsCollector } from '../services/SearchMetrics';

class MessageDB {
  private metrics = new SearchMetricsCollector();

  async searchMessages(...): Promise<SearchResult[]> {
    const startTime = performance.now();

    // ... search logic ...

    const duration = performance.now() - startTime;
    this.metrics.trackQuery(query, context, duration);

    return results;
  }

  // Expose metrics for debugging
  getSearchMetrics(): SearchMetrics {
    return this.metrics.getReport();
  }
}
```

**Success Criteria**:
- [ ] Track all search operations
- [ ] Identify slow queries and large indices
- [ ] Measure actual memory usage
- [ ] Export metrics for analysis

**Decision Point**:
After 1 week of metrics collection, answer:
- Do any spaces have >50k messages? (If yes, consider chunking)
- Are >10% of queries taking >500ms? (If yes, investigate bottlenecks)
- Is memory usage exceeding 50MB? (If yes, adjust LRU limits)

---

### 2.2 Search Result Optimization

**Effort**: 1-2 days
**Impact**: Medium
**Risk**: Low
**Status**: Not Started

**Improvements**:

**2.2.1 Smarter Result Ranking** (`src/db/messages.ts`):

```typescript
async searchMessages(...): Promise<SearchResult[]> {
  // ... existing search ...

  // Add recency boost
  const searchResults = searchIndex.search(query, {
    boost: { content: 2 },
    fuzzy: 0.2,
  }).map(result => {
    const message = this.getMessageById(result.id);
    const recencyScore = this.calculateRecencyScore(message.createdDate);
    return {
      ...result,
      score: result.score * recencyScore, // Boost recent messages
    };
  });

  // Re-sort by adjusted score
  searchResults.sort((a, b) => b.score - a.score);

  return searchResults.slice(0, limit);
}

private calculateRecencyScore(date: Date): number {
  const age = Date.now() - new Date(date).getTime();
  const daysOld = age / (1000 * 60 * 60 * 24);

  // Recent messages get higher score
  if (daysOld < 1) return 1.5;
  if (daysOld < 7) return 1.2;
  if (daysOld < 30) return 1.0;
  return 0.8;
}
```

**2.2.2 Search Filters** (optional):

```typescript
interface SearchOptions {
  dateRange?: [number, number];
  senders?: string[];
  hasMedia?: boolean;
}

async searchMessages(
  query: string,
  context: SearchContext,
  limit: number = 50,
  options?: SearchOptions
): Promise<SearchResult[]> {
  // ... existing search ...

  let results = searchResults;

  // Apply filters
  if (options?.dateRange) {
    const [start, end] = options.dateRange;
    results = results.filter(r => {
      const date = new Date(r.message.createdDate).getTime();
      return date >= start && date <= end;
    });
  }

  if (options?.senders?.length) {
    results = results.filter(r =>
      options.senders.includes(r.message.content.senderId)
    );
  }

  return results;
}
```

**Success Criteria**:
- [ ] More relevant results appear first
- [ ] Users find what they're looking for faster
- [ ] Optional filters work correctly

---

### 2.3 Index Chunking (CONDITIONAL) ⚠️

**Effort**: 3-4 days
**Impact**: High (IF needed)
**Risk**: High (complex implementation)
**Status**: Not Started
**Prerequisites**: Phase 2.1 metrics show >50k messages in spaces

**Decision Point**:
- If <5% of spaces have >50k messages → **SKIP THIS**
- If >5% of spaces have >50k messages → **IMPLEMENT THIS**

**Problem** (only if data shows it exists):
Very large indices (50k+ messages) cause slow search even with lazy loading.

**Solution**:
Time-based chunking (e.g., 30-day chunks).

**Implementation** (only if metrics justify it):

```typescript
interface IndexChunk {
  chunkId: string;
  startTimestamp: number;
  endTimestamp: number;
  messageCount: number;
  index: MiniSearch<SearchableMessage>;
}

class ChunkedSearchIndex {
  private chunks: Map<string, IndexChunk[]> = new Map();
  private readonly CHUNK_AGE_DAYS = 30;

  async buildChunkedIndex(context: SearchContext): Promise<void> {
    const messages = await this.getMessages(context);

    // Group messages into 30-day chunks
    const chunks = this.groupMessagesByTime(messages, this.CHUNK_AGE_DAYS);

    // Build index for each chunk
    for (const chunk of chunks) {
      const searchIndex = this.createSearchIndex();
      searchIndex.addAll(chunk.messages.map(m => this.messageToSearchable(m)));

      this.chunks.set(context, [...(this.chunks.get(context) || []), {
        chunkId: chunk.id,
        startTimestamp: chunk.start,
        endTimestamp: chunk.end,
        messageCount: chunk.messages.length,
        index: searchIndex,
      }]);
    }
  }

  async searchAcrossChunks(query: string, context: SearchContext): Promise<SearchResult[]> {
    const chunks = this.chunks.get(context) || [];

    // Search recent chunks first (better UX)
    const sortedChunks = [...chunks].sort((a, b) => b.startTimestamp - a.startTimestamp);

    const results: SearchResult[] = [];

    for (const chunk of sortedChunks) {
      const chunkResults = chunk.index.search(query);
      results.push(...chunkResults);

      // Early termination if we have enough results
      if (results.length >= 50) {
        break;
      }
    }

    return results;
  }
}
```

**Success Criteria**:
- [ ] Large indices (>50k messages) search in <100ms
- [ ] Memory usage independent of total message count
- [ ] Incremental updates work across chunks

**Note**: This is a last resort. Phase 1 lazy loading should handle most cases.

---

## 📅 Phase 3: Advanced Features (Week 3 - OPTIONAL)

### 3.1 Web Workers (OPTIONAL) ⚠️

**Effort**: 3-4 days
**Impact**: Medium (IF lazy loading insufficient)
**Risk**: High (complex, web-only, hard to debug)
**Status**: Not Started
**Prerequisites**: Phase 2.1 metrics show UI blocking issues

**⚠️ IMPORTANT**:
- **Only implement if lazy loading still causes UI blocking**
- **Web-only solution** (violates cross-platform architecture)
- **Requires `.native.ts` alternative for mobile**

**Decision Point**:
- If Phase 1 lazy loading eliminates UI blocking → **SKIP THIS**
- If metrics show >100ms UI blocking during index builds → **CONSIDER THIS**

**Implementation** (only if justified):

```typescript
// web/workers/searchWorker.ts (web-only)
import MiniSearch from 'minisearch';

self.onmessage = (e: MessageEvent) => {
  const { type, data, requestId } = e.data;

  switch (type) {
    case 'BUILD_INDEX':
      const index = new MiniSearch({ fields: ['content'], storeFields: ['messageId'] });
      index.addAll(data.messages);

      self.postMessage({
        type: 'INDEX_READY',
        requestId,
        data: { serializedIndex: JSON.stringify(index.toJSON()) },
      });
      break;

    case 'SEARCH':
      const searchIndex = new MiniSearch({ fields: ['content'] });
      searchIndex.addAll(JSON.parse(data.serializedIndex));
      const results = searchIndex.search(data.query);

      self.postMessage({
        type: 'SEARCH_RESULTS',
        requestId,
        data: { results },
      });
      break;
  }
};
```

**Mobile Alternative** (`src/db/messages.native.ts`):

```typescript
// React Native doesn't support Web Workers
// Use background task scheduling instead
import { InteractionManager } from 'react-native';

class MessageDB {
  async buildIndexInBackground(context: SearchContext): Promise<void> {
    return new Promise((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        // Build index after UI interactions complete
        this.buildIndexSync(context);
        resolve();
      });
    });
  }
}
```

**Success Criteria**:
- [ ] Zero UI blocking during index builds
- [ ] Cross-platform functionality maintained
- [ ] Graceful fallback if Workers unavailable

**Note**: This is the most complex optimization. Only implement if absolutely necessary based on metrics.

---

### 3.2 Advanced Caching Strategies

**Effort**: 1-2 days
**Impact**: Low-Medium
**Risk**: Low
**Status**: Not Started

**Improvements to existing SearchService cache**:

```typescript
class SearchService {
  private resultCache: Map<string, CachedSearchResult> = new Map();
  private prefetchQueue: string[] = [];

  // Predictive prefetching based on user behavior
  private async prefetchLikelySearches(context: SearchContext): Promise<void> {
    // Analyze recent search patterns
    const recentSearches = this.getRecentSearches(context);

    // Prefetch common follow-up queries
    for (const query of recentSearches.slice(-3)) {
      const variations = this.generateQueryVariations(query);

      for (const variation of variations) {
        this.prefetchQueue.push(this.getCacheKey(variation, context));
      }
    }
  }

  private generateQueryVariations(query: string): string[] {
    // Add common word variations, partial queries, etc.
    return [
      query + ' ',  // Space triggers different results
      query.slice(0, -1),  // One less character
      // ... more variations
    ];
  }
}
```

**Success Criteria**:
- [ ] Faster perceived search (prefetched results)
- [ ] Smarter cache warming
- [ ] No performance regression

---

### 3.3 Performance Monitoring Dashboard

**Effort**: 2-3 days
**Impact**: Low (nice to have)
**Risk**: Low
**Status**: Not Started

**Create debug dashboard** (`src/dev/SearchDebugPanel.tsx`):

```tsx
export const SearchDebugPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<SearchMetrics | null>(null);

  useEffect(() => {
    // Get metrics from MessageDB
    const db = useMessageDB();
    setMetrics(db.getSearchMetrics());
  }, []);

  if (!metrics) return null;

  return (
    <div className="search-debug-panel">
      <h3>Search Performance Metrics</h3>

      <div className="metric-card">
        <h4>Query Performance</h4>
        <p>Average: {metrics.averageQueryTime}ms</p>
        <p>Slow queries: {metrics.slowQueries.length}</p>
      </div>

      <div className="metric-card">
        <h4>Index Statistics</h4>
        <table>
          <thead>
            <tr>
              <th>Index</th>
              <th>Size</th>
              <th>Build Time</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(metrics.indexSizes.entries()).map(([key, size]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{size} docs</td>
                <td>{metrics.indexBuildTimes.get(key)}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="metric-card">
        <h4>Memory Usage</h4>
        <p>Total: {metrics.totalMemoryUsage}MB</p>
        <p>Evictions: {metrics.evictionCount}</p>
      </div>
    </div>
  );
};
```

**Success Criteria**:
- [ ] Real-time performance visibility
- [ ] Easy debugging of search issues
- [ ] Exportable metrics for analysis

---

## ✅ Success Metrics

### Phase 1 Targets (Week 1)
- [ ] **Startup time**: 0ms (no upfront index building)
- [ ] **First search**: <200ms (lazy load + IndexedDB cache)
- [ ] **Memory usage**: <50MB total (LRU eviction)
- [ ] **Search UI**: Smooth 60fps with 100+ results (Virtuoso)

### Phase 2 Targets (Week 2)
- [ ] **Query performance**: <50ms average
- [ ] **Metrics collection**: Complete dataset for decisions
- [ ] **Result relevance**: Improved ranking

### Phase 3 Targets (Week 3 - if needed)
- [ ] **Large indices**: <100ms search for 50k+ messages
- [ ] **UI blocking**: 0ms (Web Workers if needed)
- [ ] **Cache efficiency**: >80% hit rate

---

## 🧪 Testing Strategy

### Unit Tests

**Test 1.2 - Lazy Loading**:
```typescript
describe('Lazy Loading', () => {
  it('should not build indices on startup', async () => {
    const db = new MessageDB();
    await db.init();

    expect(db.searchIndices.size).toBe(0);
  });

  it('should build index on first search', async () => {
    const db = new MessageDB();
    const context = { type: 'space', spaceId: 'test-space' };

    await db.searchMessages('hello', context);

    expect(db.searchIndices.has('space:test-space')).toBe(true);
  });

  it('should reuse existing index', async () => {
    const db = new MessageDB();
    const context = { type: 'space', spaceId: 'test-space' };

    const buildSpy = jest.spyOn(db, 'loadIndexLazily');

    await db.searchMessages('hello', context);
    await db.searchMessages('world', context);

    expect(buildSpy).toHaveBeenCalledTimes(1); // Only once
  });
});
```

**Test 1.3 - IndexedDB Persistence**:
```typescript
describe('IndexedDB Persistence', () => {
  it('should save index to IndexedDB', async () => {
    const db = new MessageDB();
    const context = { type: 'space', spaceId: 'test-space' };

    await db.searchMessages('hello', context);

    const stored = await db.loadSearchIndexFromDB('space:test-space');
    expect(stored).not.toBeNull();
  });

  it('should load index from IndexedDB on restart', async () => {
    const db1 = new MessageDB();
    await db1.searchMessages('hello', { type: 'space', spaceId: 'test-space' });

    const db2 = new MessageDB();
    const buildSpy = jest.spyOn(db2, 'buildIndexSync');

    await db2.searchMessages('hello', { type: 'space', spaceId: 'test-space' });

    expect(buildSpy).not.toHaveBeenCalled(); // Loaded from DB
  });
});
```

**Test 1.4 - Memory Management**:
```typescript
describe('Memory Management', () => {
  it('should evict LRU indices when limit reached', async () => {
    const db = new MessageDB();
    db.config.maxIndicesCount = 3;

    // Load 4 indices
    await db.searchMessages('test', { type: 'space', spaceId: 'space1' });
    await db.searchMessages('test', { type: 'space', spaceId: 'space2' });
    await db.searchMessages('test', { type: 'space', spaceId: 'space3' });
    await db.searchMessages('test', { type: 'space', spaceId: 'space4' });

    // Should only have 3 (evicted space1)
    expect(db.searchIndices.size).toBe(3);
    expect(db.searchIndices.has('space:space1')).toBe(false);
  });
});
```

### Performance Tests

```typescript
describe('Performance Benchmarks', () => {
  it('should lazy load index in <200ms', async () => {
    const db = new MessageDB();
    const start = performance.now();

    await db.searchMessages('test', { type: 'space', spaceId: 'large-space' });

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(200);
  });

  it('should search 10k messages in <50ms', async () => {
    const db = new MessageDB();
    // Pre-load index
    await db.searchMessages('warmup', { type: 'space', spaceId: 'large-space' });

    const start = performance.now();
    await db.searchMessages('test query', { type: 'space', spaceId: 'large-space' });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });
});
```

### Integration Tests

```typescript
describe('Search Integration', () => {
  it('should maintain consistency after message changes', async () => {
    const db = new MessageDB();
    const context = { type: 'space', spaceId: 'test-space' };

    // Initial search
    await db.searchMessages('hello', context);

    // Add message
    const newMessage = { id: 'new-msg', content: 'hello world', ... };
    await db.addMessageToIndex(newMessage);

    // Search again
    const results = await db.searchMessages('hello', context);

    expect(results.find(r => r.id === 'new-msg')).toBeDefined();
  });
});
```

---

## ⚠️ Risk Assessment

### Phase 1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Lazy loading delays search | Low | Medium | Show loading state, cache in IndexedDB |
| IndexedDB quota exceeded | Low | Medium | Implement cleanup, monitor storage |
| LRU evicts frequently used index | Low | Low | Tune maxIndicesCount, track access patterns |
| Cross-platform issues | Very Low | High | Use cross-platform APIs only |

### Phase 2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Metrics impact performance | Low | Low | Async collection, sampling |
| Chunking complexity | Medium | High | Only implement if data shows need |

### Phase 3 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Web Workers break mobile | High | Critical | Provide `.native.ts` alternative |
| Worker debugging difficulty | Medium | Medium | Comprehensive logging, fallback |
| Over-engineering | High | High | Only implement if Phase 1/2 insufficient |

---

## 📋 Implementation Checklist

### Week 1 (Phase 1)

- [ ] **Day 1-2**: Lazy Loading
  - [ ] Remove `initializeSearchIndices()` startup call
  - [ ] Implement `ensureIndexReady()` and `loadIndexLazily()`
  - [ ] Update `searchMessages()` to use lazy loading
  - [ ] Add loading states in UI
  - [ ] Write unit tests

- [ ] **Day 2-3**: IndexedDB Persistence
  - [ ] Add `search_indices` object store to schema
  - [ ] Implement `saveSearchIndexToDB()` and `loadSearchIndexFromDB()`
  - [ ] Update `addMessageToIndex()` to persist changes
  - [ ] Add staleness detection
  - [ ] Write persistence tests

- [ ] **Day 3-4**: Memory Management
  - [ ] Implement LRU tracking with `indexAccessTimes`
  - [ ] Add `evictLeastRecentlyUsed()` method
  - [ ] Configure memory limits
  - [ ] Write eviction tests

- [ ] **Day 4**: Virtuoso Integration
  - [ ] Update `SearchResults.tsx` to use Virtuoso
  - [ ] Test with 100+ results
  - [ ] Verify smooth scrolling

- [ ] **Day 5**: Testing & Polish
  - [ ] Run full test suite
  - [ ] Performance benchmarking
  - [ ] Bug fixes
  - [ ] Documentation

### Week 2 (Phase 2)

- [ ] **Day 1**: Performance Metrics
  - [ ] Create `SearchMetrics.ts`
  - [ ] Integrate metrics collection
  - [ ] Add debug console export
  - [ ] Begin data collection

- [ ] **Day 2-3**: Result Optimization
  - [ ] Implement recency scoring
  - [ ] Add optional filters
  - [ ] Test ranking improvements

- [ ] **Day 4-5**: Analyze Metrics & Decide
  - [ ] Review collected metrics
  - [ ] Identify bottlenecks
  - [ ] Decide on Phase 3 features (if any)

### Week 3 (Phase 3 - CONDITIONAL)

- [ ] **Only if metrics justify**:
  - [ ] Index chunking (if large indices found)
  - [ ] Web Workers (if UI blocking persists)
  - [ ] Advanced caching
  - [ ] Performance dashboard

---

## 📊 Decision Framework

### After Week 1 (Phase 1)

**Measure**:
- Startup time improvement?
- Memory usage reduction?
- Search responsiveness?

**Decision**:
- ✅ If 90%+ improvement → Phase 1 success, proceed to Phase 2
- ⚠️ If <90% improvement → Debug Phase 1 before continuing

### After Week 2 (Phase 2)

**Analyze Metrics**:
- What % of spaces have >50k messages?
- What % of searches take >500ms?
- Is memory exceeding 50MB?

**Decision Tree**:
```
IF <5% of spaces have >50k messages:
  → SKIP chunking (edge case, not worth complexity)

IF >10% of searches take >500ms:
  → INVESTIGATE bottleneck (likely not index size)
  → Consider incremental building instead of Workers

IF memory >50MB with LRU:
  → REDUCE maxIndicesCount (config change, not code)

IF Phase 1+2 solve 95%+ of issues:
  → DECLARE SUCCESS, skip Phase 3
```

---

## 🎯 Expected Outcomes

### Optimistic Scenario (90% likely)
- **Week 1**: Phase 1 solves 80%+ of performance issues
- **Week 2**: Phase 2 adds 15% improvement + metrics infrastructure
- **Week 3**: No Phase 3 needed, focus on other features
- **Result**: Simple, maintainable, cross-platform solution

### Realistic Scenario (70% likely)
- **Week 1**: Phase 1 solves 70% of issues, minor tweaks needed
- **Week 2**: Phase 2 optimization adds 20% improvement
- **Week 3**: One Phase 3 feature needed (likely chunking OR caching, not both)
- **Result**: Moderate complexity, high performance

### Pessimistic Scenario (10% likely)
- **Week 1**: Phase 1 solves 50% of issues, architecture problems found
- **Week 2**: Metrics reveal unexpected bottlenecks
- **Week 3**: Multiple Phase 3 features needed
- **Result**: Re-evaluate approach, possibly use external search library

---

## 📚 Related Documentation

### Project Context
- **MessageDB refactoring state**: `.readme/tasks/messagedb/messagedb-current-state.md`
- **Cross-platform architecture**: `.readme/tasks/mobile-dev/docs/component-architecture-workflow-explained.md`
- **Lazy loading patterns**: `.readme/tasks/.done/lazy-loading-implementation.md`
- **Feature analysis report**: `.readme/tasks/ANALYSIS_search-performance-optimization.md`
- **Executive summary**: `.readme/tasks/SUMMARY_search-performance-analysis.md`

### Implementation Files
- **MessageDB**: `src/db/messages.ts`
- **SearchService**: `src/services/SearchService.ts`
- **SearchResults UI**: `src/components/search/SearchResults.tsx`
- **Virtualization hook**: `src/hooks/business/search/useSearchResultsVirtualization.ts`

---

## 🔑 Key Takeaways

1. **Start Simple**: Lazy loading + persistence solves 80% of the problem
2. **Measure First**: Collect metrics before adding complexity
3. **Cross-Platform**: Use platform-agnostic solutions (no Web Workers unless absolutely necessary)
4. **Data-Driven**: Only implement advanced features if metrics show clear need
5. **Maintainability**: Prefer simple solutions over complex optimizations

---

**Last Updated**: 2025-10-06
**Status**: Ready for Implementation
**Timeline**: 1-2 weeks for core improvements (80%+ of benefit)
**Risk**: Low (leverages existing infrastructure)
**Success Probability**: 90% (simple, proven patterns)

_Created: 2025-10-06 by Claude Code_
_Revised based on feature-analyzer recommendations_
