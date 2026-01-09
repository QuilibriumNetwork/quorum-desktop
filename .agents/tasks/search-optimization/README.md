---
type: task
title: Search Performance Optimization
status: in-progress
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Search Performance Optimization


**Priority**: High
**Last Updated**: 2025-11-12

---

## 📖 Overview

This folder contains the search performance optimization initiative for Quorum Desktop. The goal is to improve search functionality from a slow, limited, blocking operation to a fast, scalable, non-blocking feature.

---

## 🎯 Goals

| Goal | Current State | Target | Status |
|------|--------------|--------|--------|
| **Startup time** | 2-5 seconds (blocking) | < 200ms | 🔄 Quick wins done, lazy loading needed |
| **Result limit** | 50 results | 500+ results | ✅ Done (500 limit) |
| **UI performance** | Laggy with 50+ results | Smooth 60fps | ✅ Done (Virtuoso) |
| **Index updates** | Manual rebuild | Automatic | ✅ Done (incremental) |
| **Memory usage** | Unbounded growth | < 50MB total | 📋 Planned (LRU) |
| **Persistence** | Rebuild every startup | Cached in IndexedDB | 📋 Planned |

---

## 📁 Folder Structure

```
search-optimization/
├── README.md           # Overview, goals, roadmap (start here!)
├── quick-wins.md       # ✅ What we did (2025-11-12)
├── future-phases.md    # 📋 What's next (lazy loading, persistence, etc.)
└── decisions.md        # 🧠 Design decisions & rationale
```

---

## 🗺️ Roadmap

### ✅ Phase 1.1: Quick Wins (COMPLETED 2025-11-12)

**Goal**: Provide immediate value with minimal effort

**What was done**:
- Virtuoso integration for smooth scrolling
- Increased result limit (50 → 500)
- Fixed incremental index updates (new/deleted messages)
- Fixed UI bugs and added user feedback
- **Time**: ~1.5 hours total

**Details**: See `quick-wins.md`

---

### 📋 Phase 1.2-1.4: Foundation (PLANNED)

**Goal**: Eliminate startup blocking and enable scalability

**Key features**:
- Lazy loading: Build indices on-demand, not at startup
- IndexedDB persistence: Save/load indices, no rebuild
- Memory management: LRU eviction, bounded memory usage

**Impact**: 90%+ startup time reduction, instant subsequent searches

**Estimated time**: 1-2 weeks

**Details**: See `future-phases.md`

---

### 📋 Phase 2: Optimization (PLANNED)

**Goal**: Measure and optimize based on real usage data

**Key features**:
- Performance metrics collection
- Smarter result ranking (recency boost if needed)
- Index chunking for very large spaces (conditional)

**Impact**: Data-driven improvements, better search quality

**Estimated time**: 3-5 days

**Details**: See `future-phases.md` (Phase 2 section)

---

### 📋 Phase 3: Advanced Features (OPTIONAL)

**Goal**: Add advanced capabilities only if Phase 1-2 insufficient

**Key features**:
- Web Workers (if UI blocking persists)
- Advanced caching strategies
- Search filters (date, sender, media)
- Performance monitoring dashboard

**Impact**: Last 10% of edge case improvements

**Estimated time**: 1 week+

**Condition**: Only implement if metrics show clear need

**Details**: See `future-phases.md` (Phase 3 section)

---

## 🔍 Current State (As of 2025-11-12)

### What Works ✅

- Search returns up to 500 results (vs 50 before)
- Smooth scrolling through hundreds of results (Virtuoso)
- New messages instantly searchable (incremental updates)
- Deleted messages removed from results automatically
- Results sorted by relevance (best match first)
- Warning when hitting 500-result limit

### Known Issues ⚠️

1. **Stale index after bulk history**
   - **Issue**: Messages posted before incremental update fix not indexed
   - **Workaround**: Reload app to rebuild index
   - **Proper fix**: Will be resolved when users update to this version

2. **Startup blocking (2-5 seconds)**
   - **Issue**: All search indices built synchronously at startup
   - **Impact**: Delays app launch
   - **Fix**: Phase 1.2 (Lazy loading)

3. **No persistence**
   - **Issue**: Indices rebuilt from scratch every app start
   - **Impact**: Slow startup, wasted CPU
   - **Fix**: Phase 1.3 (IndexedDB persistence)

4. **500 result hard limit**
   - **Issue**: Can't see more than 500 results
   - **Impact**: Rare (most searches return < 100)
   - **Status**: Acceptable for now, may add pagination later

### Performance Impact 📊

- Message save/delete: +1ms (non-blocking, negligible)
- Search query: ~50-100ms (unchanged)
- Memory: ~1KB per indexed message
- Startup: Still 2-5 seconds (Phase 1.2 will fix)

---

## 🧪 Testing Checklist

### Quick Wins (Phase 1.1)
- [x] Virtuoso smooth scrolling with 100+ results
- [x] 500-result limit working
- [x] Warning message displays correctly
- [x] New messages appear in search immediately
- [ ] Deleted messages removed from search (needs testing)
- [ ] No performance degradation during messaging (monitoring needed)

### Foundation (Phase 1.2-1.4)
- [ ] Lazy loading eliminates startup blocking
- [ ] IndexedDB persistence works across restarts
- [ ] LRU eviction prevents memory leaks
- [ ] All cross-platform (mobile + desktop)

---

## 🔗 Related Files

**Code locations**:
- `src/db/messages.ts` - Search index management, query logic
- `src/services/SearchService.ts` - Search API, caching, debouncing
- `src/components/search/SearchResults.tsx` - Search UI (Virtuoso)
- `src/hooks/queries/search/` - React Query integration

**Related tasks**:
- `../.archived/search-results-limitation-and-navigation-fix.md` - Database pagination approach (not implemented, superseded by Virtuoso)
- `../fix-hash-navigation-to-old-messages.md` - Message navigation (separate concern)

---

## 💡 Key Insights

### What Worked Well ✅

1. **Incremental approach**: Quick wins first, full optimization later
2. **Virtuoso**: Easier than pagination, better UX, proven library
3. **Relevance-first sorting**: Simpler and matches user expectations
4. **Automatic indexing**: Small code change, big UX improvement

### Lessons Learned 📚

1. **Search UX is critical**: Users expect Google-like behavior (relevant results first)
2. **Recency ≠ Relevance**: Tried recency-first sorting, broke search expectations
3. **Measure before optimizing**: Phase 2 metrics will guide Phase 3 decisions
4. **Cross-platform constraints**: Must work on mobile (no Web Workers without fallback)

### Future Considerations 🤔

1. **Recency boost**: If users complain old messages dominate, add gentle recency multiplier
2. **Search filters**: Date range, sender, media type (nice-to-have)
3. **Fuzzy search tuning**: Adjust MiniSearch fuzzy parameter based on feedback
4. **Full-text excerpts**: Show context around match (like Google snippets)

---

## 📞 Who to Ask

- **Performance issues**: Check `decisions.md` for architecture rationale
- **Implementation details**: See specific task files in `implemented/` and `planned/`
- **Testing concerns**: See testing checklists in each task file
- **UX questions**: See design decisions in `decisions.md`

---

**Last Updated**: 2025-11-12
**Next Review**: After Phase 1.2 implementation (lazy loading)
