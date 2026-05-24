---
type: task
title: Design Decisions & Rationale
status: in-progress
created: 2025-11-12T00:00:00.000Z
updated: '2026-05-24'
---

# Design Decisions & Rationale

**Last Updated**: 2026-05-24

This document captures key design decisions made during search optimization, including alternatives considered and rationale for choices.

---

## 1. Display Strategy: Virtuoso vs Database Pagination

### Decision: **Virtuoso (Virtual Scrolling)**


**Context**:
Users could only see first 50 search results. Need to show hundreds of results without performance degradation.

**Options Considered**:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Database Pagination** | Handles unlimited results, lower memory | Multiple queries, complex state, slower UX | ❌ Rejected |
| **Virtuoso (Virtual Scrolling)** | Single query, smooth UX, simple code | Memory limit (~500 results) | ✅ **Selected** |
| **Increase limit only** | Trivial implementation | Would lag with 100+ results | ❌ Not sufficient alone |

**Rationale**:
- Virtuoso provides 80% of benefit with 20% of effort
- Single query is faster than multiple offset queries
- Most searches return < 100 results (500 limit sufficient)
- Virtuoso already used elsewhere in codebase (MessageList, UsersList)
- Keeps architecture compatible with future lazy loading optimization

**Implementation**: `src/components/search/SearchResults.tsx:161-176`

**Trade-offs Accepted**:
- Hard limit at 500 results (acceptable for now)
- Slightly higher memory usage (negligible with 500 items)

**Future Options**:
- If users need 1000+ results, can add database pagination
- If memory becomes issue, reduce limit or add chunking

---

## 2. Sort Strategy: Relevance vs Recency

### Decision: **Relevance-First**


**Context**:
Need to decide how to order search results for best UX in a messaging app.

**Attempts**:

#### Attempt 1: Recency-First ❌
```typescript
// Primary sort: newest first
// Secondary: relevance within same day
return results.sort((a, b) => {
  const recencyDiff = dateB - dateA;
  if (Math.abs(recencyDiff) < oneDayMs) {
    return b.score - a.score;
  }
  return recencyDiff;
});
```

**Problems Identified**:
- Breaks search expectations (users expect relevant results, not chronological)
- "Login bug fix" discussion from last week hidden by irrelevant "logging in" message from today
- Arbitrary threshold (why 1 day? what about 23 vs 25 hours?)
- Makes search act like chronological filter instead of semantic search

#### Attempt 2: Relevance-First ✅
```typescript
// Sort by relevance score (best match first)
return results.sort((a, b) => b.score - a.score);
```

**Rationale**:
- ✅ Matches user expectations (Google/Slack/Discord behavior)
- ✅ Trust MiniSearch's well-tuned relevance algorithm
- ✅ Simpler code (3 lines vs 15 lines)
- ✅ More maintainable
- ✅ "Search" means "find relevant content", not "show recent mentions"

**Implementation**: `src/db/messages.ts:1062-1064`

**Alternative Considered: Relevance with Recency Boost**
```typescript
// Boost recent messages' scores slightly
const ageDays = (Date.now() - messageDate) / (1000 * 60 * 60 * 24);
const recencyBoost = ageDays < 1 ? 1.2 : ageDays < 7 ? 1.1 : 1.0;
const finalScore = relevanceScore * recencyBoost;
```


**Reasoning**: Wait for user feedback - add only if needed
**When to reconsider**: If users complain that old messages dominate results

---

## 3. Result Limit: 25 vs 500

### Decision: **500 Results**


**Context**:
Need to balance between showing enough results and preventing performance issues.

**Original Plan**: Reduce from 50 to 25
**Actual Implementation**: Increase from 50 to 500

**Rationale for Reversal**:
- Original plan assumed rendering was expensive (it's not with Virtuoso)
- User testing revealed need for MORE results, not fewer
- Virtuoso handles 500 items smoothly
- 500 provides good UX without memory concerns
- Warning message guides users to refine searches if needed

**Implementation**:
- `src/services/SearchService.ts:33` - `maxResults: 500`
- `src/components/search/SearchResults.tsx:177-183` - Warning callout

**Trade-offs**:
- Slight memory increase (~500KB for 500 results)
- Potential for search to return less relevant results at bottom
- Mitigated by warning message encouraging refinement

**Future Tuning**:
- Monitor user behavior (how often do they scroll past result #100?)
- Consider reducing if analytics show < 1% scroll past 200
- Consider increasing to 1000 if users frequently hit limit

---

## 4. Index Updates: Manual vs Automatic

### Decision: **Automatic Incremental Updates**


**Context**:
New messages were invisible to search until app reload because index wasn't updated.

**Options**:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Manual rebuild** (original) | Simple, no ongoing cost | Terrible UX, requires reload | ❌ Bad UX |
| **Automatic updates** | Great UX, instant search | +1ms per message save | ✅ **Selected** |
| **Batch updates** | Lower overhead | Complex, delayed updates | ❌ Over-engineering |

**Implementation**:
```typescript
// In saveMessage()
transaction.oncomplete = () => {
  this.addMessageToIndex(message).catch(...);
  resolve();
};
```

**Performance Analysis**:
- Runs AFTER DB transaction (non-blocking for save)
- `spaceIndex.add()` is in-memory only (~1ms)
- Async with error handling (fails gracefully)
- Matches planned Phase 1.3 architecture

**Verdict**: Negligible performance impact (~1ms), massive UX improvement

**Future Enhancement**:
- Phase 1.3 will add IndexedDB persistence of index
- Will need to also update persisted index on message save/delete

---

## 5. Startup Performance: Fix Now vs Later

### Decision: **Fix Later (Phase 1.2)**


**Context**:
Search index building blocks UI for 2-5 seconds on app startup.

**Why Not Fix Now**:
- Quick wins (Virtuoso, limit increase) provide immediate value
- Startup fix requires architectural changes (lazy loading)
- Lazy loading is 2-3 days of work vs 2 hours for quick wins
- Better to get value fast, then optimize

**When to Fix**:
- Phase 1.2: Lazy loading (build indices on-demand, not at startup)
- Phase 1.3: IndexedDB persistence (load cached indices instantly)

**Rationale**:
- 80/20 rule: Get 80% of benefit with 20% of effort first
- Validate quick wins before investing in complex optimization
- Startup blocking is annoying but not critical (happens once per session)
- Search functionality is critical (happens many times per session)

---

## 6. Cross-Platform Strategy: Web Workers vs Simpler Solutions

### Decision: **Avoid Web Workers (for now)**


**Context**:
Debated using Web Workers to offload search index building from main thread.

**Concerns**:
- Web Workers are web-only (requires `.native.ts` alternative for mobile)
- Adds complexity (serialization, message passing, debugging)
- May not be needed if lazy loading + persistence solve startup blocking

**Decision**:
- Skip Web Workers in Phase 1
- Collect metrics in Phase 2
- Only implement in Phase 3 if data shows UI blocking persists

**Rationale**:
- Start simple, measure impact, add complexity only if needed
- Cross-platform compatibility is critical (single codebase)
- Lazy loading + persistence likely sufficient (90% solution)
- Can always add Workers later if metrics justify it

**When to Reconsider**:
- If Phase 1.2 lazy loading still shows >100ms UI blocking during index builds
- If metrics show users regularly searching huge spaces (50k+ messages)

---

## 7. Architecture Compatibility

### Decision: **Keep Changes Compatible with Future Optimization**


**Principle**: Quick wins should NOT create technical debt or block future improvements.

**How We Ensured This**:

1. **Incremental indexing** matches planned Phase 1.3 approach
   - Can easily extend to also persist to IndexedDB
   - No refactoring needed

2. **Virtuoso** compatible with lazy loading
   - Results come from search service (single interface)
   - Whether index is lazy-loaded or prebuilt doesn't affect UI

3. **500 limit** doesn't preclude future improvements
   - Can add pagination later if needed
   - Can increase limit if memory allows
   - Reversible decision

4. **Relevance-first sorting** allows future recency boost
   - Simple to multiply scores by recency factor
   - No structural changes needed

**Anti-patterns Avoided**:
- ❌ Hardcoding assumptions in multiple places
- ❌ Creating circular dependencies
- ❌ Using quick hacks that need rewrite later
- ❌ Breaking mobile compatibility

---

## 8. Testing Strategy: Manual vs Automated

### Decision: **Manual Testing for Phase 1, Automated Later**


**Rationale**:
- Phase 1 changes are UI/UX focused (hard to automate)
- Time spent on tests > time spent on implementation (30min vs 90min)
- Better to get user feedback first, then add tests for stable features

**Manual Testing Done**:
- ✅ Scroll performance with 100+ results
- ✅ 500-result limit and warning
- ✅ New message indexing (after reload)
- ✅ UI bug fixes

**When to Add Automated Tests**:
- Phase 1.2: Unit tests for lazy loading logic
- Phase 1.3: Unit tests for IndexedDB persistence
- Phase 1.4: Unit tests for LRU eviction
- Phase 2: Performance benchmarks

**Testing Philosophy**:
- Test complex logic (lazy loading, persistence, eviction)
- Don't test UI integration (Virtuoso is already tested)
- Add tests when refactoring would be risky (after Phase 1 complete)

---

## 9. Migration-Aware Design (added 2026-05-24)

### Decision: **Shape Phase 1.3 persistence to mirror the planned `SearchAdapter` interface**

**Context**:
A session-start check of `D:\GitHub\Quilibrium\quorum-shared\src` confirmed `SearchService` and `MessageDB` are not yet in the shared package. The quorum-shared migration roadmap (see [../quorum-shared-migration/README.md](../quorum-shared-migration/README.md) status table) lists `SearchService + SearchAdapter` as Tier 1B: **blocked on mobile codebase access**. The services-design audit ([../quorum-shared-migration/designs/2026-05-18-services-design.md §3](../quorum-shared-migration/designs/2026-05-18-services-design.md)) classifies `SearchService` as portable verbatim once a `SearchAdapter` interface exists in shared.

**Options Considered**:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Inline IndexedDB calls directly in `SearchService` | Simplest now | Service becomes non-portable; full rewrite at migration day | ❌ Rejected |
| Wait for migration to unblock before Phase 1.3 | Cleanest architecture | Indefinite wait (mobile access has been blocked for months); meanwhile users keep paying the 2-5s startup cost | ❌ Rejected |
| **Add persistence to `MessageDB` with method shapes that mirror the future `SearchAdapter` interface** | Migration-day refactor is near-zero; service stays storage-agnostic; ships value now | ~30 min extra design thinking now | ✅ **Selected** |

**Rationale**:
- Service-level logic (lazy load, LRU) goes in `SearchService` — moves verbatim on migration day.
- Storage logic (persistence) goes in `MessageDB` — desktop's IndexedDB implementation of what will become the `SearchAdapter` interface.
- Mobile already has its own search story; the migration audit explicitly warns against codifying desktop's logic as the shared abstraction before mobile inspection. Phase 1.3's persistence layer being adapter-shaped, not inlined, leaves that decision open.

**Anti-pattern avoided**: building optimization work that gets thrown away at migration time.

---

## 10. MiniSearch Persistence API (added 2026-05-24)

### Decision: **Use `MiniSearch.loadJSON()` for deserialization, not `addAll(JSON.parse(...))`**

**Context**:
The original Phase 1.3 pseudo-code in `future-phases.md` had:
```typescript
const searchIndex = new MiniSearch({...});
searchIndex.addAll(JSON.parse(stored.serializedIndex)); // ❌ wrong
```

`addAll` expects an array of source documents and re-tokenizes them. This:
1. Defeats the entire point of persistence (re-tokenization is most of the build cost).
2. Is the wrong API shape — `toJSON()` returns a serialized index structure, not a doc array, so `JSON.parse` of it isn't even shaped right for `addAll`.

**Correct API** (verified against installed MiniSearch 7.2):
```typescript
// Serialize
const serialized = JSON.stringify(searchIndex.toJSON());

// Deserialize — must pass SAME options used to create the original
const searchIndex = MiniSearch.loadJSON(serialized, MINISEARCH_OPTIONS);
```

Also available: `MiniSearch.loadJSONAsync` for very large indices (avoids blocking on parse).

**Implication**:
The MiniSearch constructor options must be the single source of truth — stored in a static `MINISEARCH_OPTIONS` constant and reused by both `createSearchIndex()` and `loadSearchIndexFromDB()`. If they drift, the deserialized index silently misbehaves (wrong fuzzy, wrong boost, wrong stored fields).

---

## 11. Persistence Write Policy (added 2026-05-24)

### Decision: **Debounced flush of dirty indices, not per-message saves**

**Context**:
The original Phase 1.3 sketch suggested:
```typescript
async addMessageToIndex(message): Promise<void> {
  spaceIndex.add(searchable);
  await this.saveSearchIndexToDB(spaceIndexKey, spaceIndex); // ❌ per-message
}
```

In a busy space (~10 msg/sec during active conversation), this re-serializes the entire index and writes it to IndexedDB on every single message. The index for a 5k-message space is hundreds of KB of JSON — the write amplification is unacceptable.

**Options Considered**:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Per-message save | Always durable | Massive write amplification; jank in busy spaces | ❌ Rejected |
| **Dirty flag + debounced flush (5s)** | Bounded writes; coalesces bursts | Need lifecycle hooks for durability | ✅ **Selected** |
| Batch incoming messages, flush every N adds | Simpler logic | Doesn't handle quiet periods well | ❌ Worse than debounce |
| Periodic timer regardless of dirtiness | Predictable | Wastes writes when nothing changed | ❌ Rejected |

**Durability strategy**:
- 5-second debounce captures bursts.
- Flush on `visibilitychange` → hidden (user tabbed away).
- Flush on `beforeunload` (user closing).
- Flush synchronously before LRU eviction (Phase 1.4 wires this in).
- Acceptable loss window: ~5s of messages on crash — which on next launch get rebuilt from the messages store anyway (the source of truth is IndexedDB messages, not the cached index).

---

## Summary Table

| Decision | Choice | Rationale | Reversible? |
|----------|--------|-----------|-------------|
| **Display** | Virtuoso | Fast, simple, proven | Yes (can add pagination) |
| **Sorting** | Relevance-first | Matches expectations | Yes (can add recency boost) |
| **Limit** | 500 results | Balances UX and performance | Yes (can adjust) |
| **Index Updates** | Automatic | Great UX, negligible cost | No (but correct choice) |
| **Startup Fix** | Defer to Phase 1.2 | Quick wins first | N/A (timing decision) |
| **Web Workers** | Avoid for now | Measure before adding complexity | Yes (can add later) |
| **Testing** | Manual first | Fast iteration, user feedback | Yes (will add automated) |
| **Migration alignment** | Adapter-shaped persistence in `MessageDB` | Migration-day refactor is near-zero | Yes (can be hardened later) |
| **MiniSearch persistence** | `loadJSON` + shared options constant | Correct API; avoids silent misbehavior | No (correct choice) |
| **Persistence writes** | Debounced flush + lifecycle hooks | Bounds write amplification | Yes (can tune debounce window) |

---

**Last Updated**: 2026-05-24
**Next Review**: After Phase 1.2 implementation (lazy loading)

## Changelog

- **2026-05-24** — Added decisions 9 (migration-aware design), 10 (MiniSearch `loadJSON` API correction), 11 (debounced flush policy) based on session research. Summary table extended.
- **2025-11-12** — Initial decisions 1-8 documented alongside Phase 1.1 quick wins.
