---
type: doc
title: Message Search Feature
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-05-25T00:00:00.000Z
---

# Message Search Feature

## Overview

Client-side full-text search over messages, scoped to the current space or DM conversation. Built on MiniSearch with per-context indices that are lazily built, persisted to IndexedDB, and evicted under an LRU cap. Search is invoked via the global search bar (`Ctrl/Cmd + K`) and produces a dropdown of ranked, highlighted results that navigate to the message in place with a flash highlight.

## Architecture

### Core Components

1. **SearchService** ([src/services/SearchService.ts](../../../src/services/SearchService.ts))
   - Search facade between the UI and `MessageDB`
   - 300ms input debounce and an in-memory result cache (LRU, 5-minute TTL, 100 entries)
   - Cache invalidation on `addMessage` / `removeMessage`
   - HTML- and regex-escaped highlight via `highlightSearchTerms`
   - `flushIndices()` exposes `MessageDB.flushDirtyIndices()` for lifecycle hooks
   - `initialize()` is a back-compat no-op (indices are lazy)

2. **MessageDB search layer** ([src/db/messages.ts](../../../src/db/messages.ts))
   - Owns the per-context MiniSearch indices (`Map<indexKey, MiniSearch>`)
   - `MINISEARCH_OPTIONS` static: single source of truth used by both `createSearchIndex()` and `MiniSearch.loadJSON()`. Drift between create and load would silently break fuzzy/boost/stored-field behavior, so it lives in one place
   - Lazy build: `ensureIndexReady(context)` → `loadIndexLazily(context, indexKey)`. Concurrent first-search calls for the same key are deduplicated via `indexLoadPromises`
   - Persistence: `saveSearchIndexToDB` / `loadSearchIndexFromDB` (IndexedDB v13, `search_indices` object store). Uses `MiniSearch.loadJSON` to restore the index structure directly (NOT `addAll(JSON.parse(...))`, which would re-tokenize and defeat the cache)
   - Incremental updates: `addMessageToIndex` / `removeMessageFromIndex` mutate the in-memory index and call `markIndexDirty`
   - Debounced flush: `markIndexDirty` schedules a `flushDirtyIndices` 5s out, coalescing bursts into one IndexedDB write per window per index
   - LRU eviction: `evictLeastRecentlyUsed` caps in-memory indices at 10; dirty indices are flushed before being dropped so eviction is non-destructive

3. **useSearchService hook** ([src/hooks/business/search/useSearchService.ts](../../../src/hooks/business/search/useSearchService.ts))
   - Instantiates `SearchService` and memoizes by `messageDB` identity
   - Wires `document.visibilitychange` and `window.beforeunload` to `searchService.flushIndices()` so the debounce window doesn't lose updates on tab switch / app close

4. **React Query integration** ([src/hooks/queries/search/](../../../src/hooks/queries/search/))
   - `useGlobalSearch` is the main consumer-facing search hook
   - `buildSearchFetcher` / `buildSearchKey` adapt the service to React Query's contract

5. **Context detection** ([src/hooks/useSearchContext.ts](../../../src/hooks/useSearchContext.ts))
   - Maps the current route to a `SearchContext` (`space` or `dm`)
   - Spaces: `/spaces/{spaceId}/{channelId}`
   - DMs: `/messages/{conversationId}`

6. **UI components** ([src/components/search/](../../../src/components/search/))
   - `GlobalSearch.tsx` — orchestrator: search bar + results dropdown, navigation handler
   - `SearchBar.tsx` — input with `Ctrl/Cmd + K` focus shortcut, 3-char minimum, contextual placeholder
   - `SearchResults.tsx` — uses [DropdownPanel](../../../src/components/ui/DropdownPanel.tsx) and `react-virtuoso` to render up to 500 results smoothly; shows a "500-result" warning callout when the cap is hit
   - `SearchResultItem.tsx` — resolves sender names via `useUserInfo`, space/channel names via `useSpace`; splits into space- vs DM-specific subcomponents to avoid conditional hook usage across context types

### Data Flow

```
User types in SearchBar
  → useGlobalSearch (React Query)
    → SearchService.searchWithDebounce (300ms)
      → SearchService.search (cache check)
        → MessageDB.searchMessages
          → ensureIndexReady(context)
            ├── cache hit: trackIndexAccess, return
            └── cache miss:
                  ├── loadSearchIndexFromDB (IndexedDB v13)
                  │     ├── hit: deserialize via MiniSearch.loadJSON
                  │     └── miss: build from messages, mark dirty
                  └── store in searchIndices map, trackIndexAccess
          → searchIndex.search(query)
          → resolve full Message objects
          → fire-and-forget evictLeastRecentlyUsed
          → sort by relevance score
  → SearchResults dropdown
    → navigation handler routes to /spaces/.../#msg-... or /messages/.../#msg-...
    → MessageList scrolls to message, triggers 6-second flash highlight
```

## MiniSearch Configuration

Single source of truth: `MessageDB.MINISEARCH_OPTIONS` ([src/db/messages.ts](../../../src/db/messages.ts)).

```typescript
{
  fields: ['content', 'senderId'],
  storeFields: ['messageId', 'spaceId', 'channelId', 'createdDate', 'type'],
  searchOptions: {
    boost: { content: 2, senderId: 1 },
    prefix: true,
    fuzzy: 0.2,
  },
}
```

`SearchableMessage` is produced by `messageToSearchable(message)`, which extracts text via `extractTextFromMessage` (handles `post` and `event` message types; other types index as empty string).

## Search Context System

```typescript
interface SearchContext {
  type: 'space' | 'dm';
  spaceId?: string;       // for space searches
  channelId?: string;     // display only — search covers all channels in the space
  conversationId?: string; // for DM searches
}
```

Index key shape: `space:{spaceId}` or `dm:{conversationId}`. Scoping rules:

- **Space context**: searches all messages across all channels in the space
- **DM context**: searches messages within the specific conversation
- **No cross-space search** — each context has its own index

## Behavior

| Aspect | Setting |
|--------|---------|
| Input debounce | 300ms |
| Min query length | 3 characters |
| Result cap | 500 (warning callout when reached) |
| Result ordering | Relevance score descending (MiniSearch built-in) |
| Result cache | 100 entries, 5-minute TTL, LRU |
| Highlight | `<mark>` tags via HTML- + regex-escaped substitution |
| Keyboard | `Ctrl/Cmd + K` focuses search |
| Scrolling | `react-virtuoso` (smooth 60fps with hundreds of results) |
| Navigation | `/spaces/{spaceId}/{channelId}#msg-{messageId}` or `/messages/{conversationId}#msg-{messageId}` |
| Post-navigation | 6-second yellow flash highlight on target message |

## Persistence and Memory Model

| Property | Value |
|----------|-------|
| Storage | IndexedDB `search_indices` object store (schema v13) |
| Serialization | `JSON.stringify(searchIndex.toJSON())` |
| Deserialization | `MiniSearch.loadJSON(serialized, MINISEARCH_OPTIONS)` |
| Write policy | Dirty flag + 5-second debounced flush; one write per window per index |
| Lifecycle flush | `visibilitychange` (hidden), `beforeunload`, before LRU eviction |
| In-memory cap | 10 indices (`MAX_IN_MEMORY_INDICES`) |
| Eviction | LRU; dirty indices flushed before drop |

### Performance

- App startup search cost: 0ms (no upfront indexing)
- First search in a space, cold IndexedDB cache: ~200ms (build from messages + persist)
- First search in a space, warm cache: ~10ms (deserialize)
- Subsequent searches: instant
- Incremental index update on message save/delete: ~1ms, non-blocking

## Adding a New Searchable Field

1. Add the field to `SearchableMessage` interface in `src/db/messages.ts`
2. Populate it in `messageToSearchable()` (extract from `Message` as needed)
3. Update `MessageDB.MINISEARCH_OPTIONS`:
   - Add to `fields` if the field should be tokenized and searched
   - Add to `storeFields` if it should be returned with search results
   - Add to `searchOptions.boost` to weight it
4. Bump the persisted index format if you want existing caches invalidated. The current schema has no `indexVersion` field — option drift will silently misbehave on cached records. See [decisions.md §12b](../../tasks/search-optimization/decisions.md) for the deferred mitigation pattern (`SEARCH_INDEX_VERSION` constant + filter on load). The simplest workaround today: bump `DB_VERSION` (12→13→14...) and add a no-op upgrade step, which wipes the `search_indices` store on next launch via deletion-and-recreation if you choose to delete-then-create the store

## Extending the Context System

To add a new scope (e.g. cross-space search, channel-specific search):

1. Extend the `SearchContext` interface in `src/db/messages.ts` with a new `type` discriminant
2. Update `getIndexKey(context)` to emit a unique key shape for the new type
3. Update `loadIndexLazily(context, indexKey)` to fetch the right message set for the new type
4. Update `useSearchContext` to detect the new route pattern and emit the new context shape
5. Update `SearchService.invalidateCache` so cache invalidation reaches the new key shape

## Known Limitations

- **500 result hard cap.** Most queries return well under 100, so the cap is rarely hit. When it is, the UI shows a warning callout suggesting refinement.
- **Text-only indexing.** Only message `content.text` (for `post` and `event` types) is indexed. Attachments, images, and media are not searchable.
- **Single-context scope.** No cross-space global search. Each search is confined to the current space or DM.
- **`beforeunload` flush is best-effort.** Browsers don't await Promises returned from `beforeunload` handlers, so on a hard close (window X, browser quit) the in-flight IndexedDB write may not complete. At most one 5-second debounce window of incremental updates is lost. Source-of-truth is the `messages` store, so the next lazy load rebuilds from messages. See [decisions.md §12a](../../tasks/search-optimization/decisions.md).
- **Persisted index can be stale for cold spaces.** `markIndexDirty` only fires when the index is loaded in memory. Messages arriving for a space whose index has been evicted are NOT reflected in the persisted version until the next lazy load triggers a fresh build. See [decisions.md §12c](../../tasks/search-optimization/decisions.md).

## Related Documentation

- [Search optimization tasks](../../tasks/search-optimization/) — phase docs, design decisions, performance roadmap
- [Decisions log](../../tasks/search-optimization/decisions.md) — rationale for sorting, persistence, debounce, eviction
- [Data management architecture guide](../data-management-architecture-guide.md) — MessageDB and IndexedDB schema context
- [Dropdown panels](./dropdown-panels.md) — reusable panel used by `SearchResults`
- [Primitives](./primitives/) — UI components used in search
- [Cross-platform components guide](../cross-platform-components-guide.md) — shared component architecture

---

_Last updated: 2026-05-25 — rewritten from scratch to reflect Phase 1.2-1.4 (lazy loading, IndexedDB persistence, LRU eviction). Stripped status/roadmap/history sections that belong in `.agents/tasks/search-optimization/`._
