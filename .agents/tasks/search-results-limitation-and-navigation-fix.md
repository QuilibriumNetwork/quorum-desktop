# Task: Fix Search Results Limitation and Pagination

**Status**: 📋 Planned
**Priority**: Medium
**Type**: Enhancement
**Component**: Search
**Affects**: Search functionality
**Created**: 2025-11-11
**Updated**: 2025-11-11

---

## Summary

**Issue**: Search results are limited to 50 items with no way to load additional results beyond the initial batch.

**Solution**:

1. Keep initial search results at 50 items for fast initial response
2. Implement infinite scroll to automatically load more results as user scrolls
3. Add "searchWithOffset" method to SearchService for pagination
4. Display end-of-results message when all matches have been loaded

**Note**: Navigation to old messages is handled separately in `.agents/tasks/fix-hash-navigation-to-old-messages.md`

---

## Current State Analysis

### Search Results Limitation

**Location**: `src/services/SearchService.ts:33`

- Default `maxResults: 50` in SearchServiceConfig
- `search()` method has default limit of 50
- No pagination/offset-based loading mechanism
- No way to fetch additional results beyond initial batch

**Impact**: Users only see first 50 matching results, even if there are more

### UI State

**Location**: `src/components/search/SearchResults.tsx`

- Uses simple `.map()` rendering for results
- Scrolling is handled by DropdownPanel component (`DropdownPanel.scss:68-71`)
- No infinite scroll detection
- No end-of-results indicator
- Virtuoso library is imported but not used

---

## Proposed Solution

### Infinite Scroll with Batch Loading

**Changes**:

1. **Add Offset-Based Search**: Implement `searchWithOffset()` method in SearchService
2. **Implement Infinite Scroll**: Detect when user scrolls near bottom, automatically load next batch
3. **Batch Size**: Keep at 50 results per batch for optimal performance
4. **End-of-Results Indicator**: Show message when no more results exist
5. **Loading States**: Display spinner while fetching additional results

**UX Benefits**:
- Fast initial response (50 results)
- Seamless browsing experience (no button clicks needed)
- Consistent with messaging app expectations
- Keyboard-friendly (arrow keys work without interruption)

**Note**: Navigation fix is handled in separate task - `.agents/tasks/fix-hash-navigation-to-old-messages.md`

---

## Implementation Plan

### Phase 1: Backend - Add Pagination Support (Day 1)

1. **Add `searchWithOffset()` method to SearchService**:
   ```typescript
   async searchWithOffset(
     searchQuery: SearchQuery,
     offset: number
   ): Promise<SearchResult[]>
   ```
   - Accept offset parameter for pagination
   - Query MessageDB starting from offset position
   - Return next batch of 50 results
   - Handle edge cases (offset beyond total results)

2. **Update MessageDB if needed**:
   - Verify `searchMessages()` supports offset parameter
   - Ensure database queries are optimized for offset-based retrieval

### Phase 2: Frontend - Infinite Scroll UI (Day 2)

1. **Add Infinite Scroll Detection**:
   - Detect when user scrolls to ~80% of current results
   - Trigger loading of next batch automatically
   - Prevent multiple simultaneous requests

2. **Update SearchResults Component**:
   - Track current offset state
   - Track if more results exist (`hasMore` flag)
   - Show loading spinner at bottom while fetching
   - Append new results to existing list

3. **Add End-of-Results Message**:
   - Display when `hasMore === false`
   - Show message like: "End of results • X messages found"
   - Optional: Add helpful text like "Try different keywords"

4. **Loading States**:
   - Show inline spinner at bottom: "Loading more results..."
   - Ensure smooth UX during loading (no jumps/flickers)

---

## Technical Considerations

### 1. SearchService - Add Offset-Based Search

```typescript
// src/services/SearchService.ts - add new method
async searchWithOffset(
  searchQuery: SearchQuery,
  offset: number
): Promise<SearchResult[]> {
  const { query, context, limit = this.config.maxResults } = searchQuery;

  if (!query.trim()) {
    return [];
  }

  try {
    // Pass offset to messageDB search
    const results = await this.messageDB.searchMessages(
      query,
      context,
      limit,
      offset // NEW: offset parameter
    );

    return results;
  } catch (error) {
    console.error('Search with offset failed:', error);
    return [];
  }
}
```

### 2. MessageDB - Verify Offset Support

Check `src/db/messages.ts` to ensure `searchMessages()` accepts offset:

```typescript
// May need to update signature:
async searchMessages(
  query: string,
  context: SearchContext,
  limit: number,
  offset?: number // Add if missing
): Promise<SearchResult[]>
```

### 3. SearchResults Component - Infinite Scroll

```typescript
// src/components/search/SearchResults.tsx
const [allResults, setAllResults] = useState<SearchResult[]>(results);
const [offset, setOffset] = useState(50); // Start at 50 (first batch loaded)
const [hasMore, setHasMore] = useState(true);
const [isLoadingMore, setIsLoadingMore] = useState(false);

// Detect scroll near bottom
const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
  const target = e.currentTarget;
  const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;

  // Trigger at 80% scroll
  if (scrollPercentage > 0.8 && hasMore && !isLoadingMore) {
    loadMoreResults();
  }
}, [hasMore, isLoadingMore]);

const loadMoreResults = useCallback(async () => {
  setIsLoadingMore(true);

  const newResults = await searchService.searchWithOffset(
    { query, context, limit: 50 },
    offset
  );

  // If we get fewer than 50, we've hit the end
  if (newResults.length < 50) {
    setHasMore(false);
  }

  setAllResults((prev) => [...prev, ...newResults]);
  setOffset((prev) => prev + newResults.length);
  setIsLoadingMore(false);
}, [searchService, query, context, offset]);

// Render with scroll handler
<Container
  className="search-results-list"
  onScroll={handleScroll}
>
  {allResults.map((result, index) => (
    <SearchResultItem key={...} {...props} />
  ))}

  {isLoadingMore && (
    <FlexCenter className="py-3">
      <Icon name="spinner" className="icon-spin" />
      <Text>{t`Loading more results...`}</Text>
    </FlexCenter>
  )}

  {!hasMore && allResults.length > 0 && (
    <FlexCenter className="py-3">
      <Text variant="subtle">
        {t`End of results • ${allResults.length} messages found`}
      </Text>
    </FlexCenter>
  )}
</Container>
```

### 4. Performance Considerations

- **Database**: Verify that MessageDB queries with offset are indexed properly
- **Memory**: 50 results per batch keeps memory usage reasonable
- **Debouncing**: Ensure scroll handler doesn't fire too frequently (add 200ms debounce if needed)
- **Cache**: Consider if SearchService cache should handle offset-based results differently

---

## Relationship to Navigation Fix

This task focuses **only** on search results display and does **not** address navigation issues.

**Navigation fix** is handled separately in:

- `.agents/tasks/fix-hash-navigation-to-old-messages.md`

This separation allows:

- Independent implementation and testing
- Clearer focus on specific UX improvements
- Better task management and prioritization

---

## Testing Requirements

1. **Infinite Scroll Behavior**:
   - Test automatic loading when scrolling to ~80% of results
   - Verify loading spinner appears during fetch
   - Test that multiple requests don't fire simultaneously
   - Verify smooth scrolling during load (no jumps)

2. **Batch Loading**:
   - Test initial 50 results load correctly
   - Test next 50 results append properly (not replace)
   - Test offset increments correctly (50, 100, 150, etc.)
   - Verify no duplicate results appear

3. **End-of-Results State**:
   - Test message appears when no more results exist
   - Test that loading stops after all results fetched
   - Verify message shows correct total count

4. **Edge Cases**:
   - Test with exactly 50 results (should show end message)
   - Test with 0 results (no infinite scroll)
   - Test with 1-49 results (no infinite scroll)
   - Test with 51 results (should allow one more batch load)
   - Test rapid scrolling doesn't break pagination

5. **Performance**:
   - Test with 500+ total results across multiple batches
   - Verify no memory leaks from accumulated results
   - Test database query performance with offset

---

## Dependencies

- Existing SearchService infrastructure
- MessageDB `searchMessages()` method (may need offset parameter added)
- DropdownPanel scrolling container (already exists)
- Search results UI components

---

## Risk Assessment

**Medium Risk**:

- New pagination logic introduces state management complexity
- Potential for duplicate results if offset tracking is incorrect
- Database queries with offset may have performance implications
- Infinite scroll could cause memory issues with very large result sets

**Mitigation**:

- Thoroughly test offset calculation and state management
- Add safeguards to prevent duplicate result IDs
- Test database query performance with offsets
- Monitor memory usage with large result sets
- Add debouncing to scroll handler
- Consider adding a max total results cap (e.g., 500) if performance issues arise

---

## Success Criteria

1. ✅ Initial search returns 50 results quickly
2. ✅ Infinite scroll automatically loads next batch when user scrolls to ~80%
3. ✅ Each batch loads 50 additional results seamlessly
4. ✅ Loading spinner appears during batch fetch
5. ✅ End-of-results message displays when no more matches exist
6. ✅ No duplicate results across batches
7. ✅ No memory leaks or performance degradation with large result sets
8. ✅ Smooth scrolling experience (no jumps or flickers)
9. ✅ Works correctly on both desktop and mobile
10. ✅ No conflicts with separate navigation fix task

---

**Updated**: 2025-11-11
