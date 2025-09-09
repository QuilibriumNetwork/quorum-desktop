# Search Results Page Refresh and Focus Stealing Bug

**Status**: UNRESOLVED - Critical UX Issue  
**Priority**: High  
**Date**: 2025-01-20  
**Session Duration**: Extended debugging session  

## Problem Statement

When users type 3+ characters in the search input and search results appear, two critical issues occur:

### Primary Issues

1. **Page Refresh on Search Results Appearance**
   - Occurs immediately when user types the 3rd character
   - Search results panel appears but page refreshes instantly
   - Happens consistently, not dependent on user input after results appear
   - Not related to Enter key presses or form submissions

2. **Focus Stealing from Search Input**
   - Search input loses focus when results appear
   - Input border remains accent color but cursor disappears
   - User must click in search input again to continue typing
   - Affects both typing flow and user experience

## Root Cause Analysis

**CONFIRMED ROOT CAUSE**: The issue is caused by **data-fetching hooks in SearchResultItem components** making simultaneous API/database calls when search results mount.

### Exact Culprit Code

**Location**: `/src/components/search/SearchResultItem.tsx`

**Problematic Hooks**:
1. `useSearchResultDisplayDM` - Makes async database calls via `messageDB.getConversation()`
2. `useSearchResultDisplaySpace` - Makes React Query API calls via `useUserInfo()` and `useSpace()`

**What Happens**:
1. User types 3rd character → `setShowResults(query.trim().length >= minQueryLength)` in `useGlobalSearchState.ts:31`
2. SearchResults component renders with `isOpen={true}`
3. Multiple SearchResultItem components mount simultaneously (typically 8-10 results)
4. Each SearchResultItem calls data-fetching hooks immediately on mount
5. **Cascade of simultaneous async operations overwhelms the system**
6. This somehow triggers browser form submission behavior → page refresh
7. Async state updates interfere with input focus management → focus stealing

### Technical Evidence

**Isolation Test Results**:
- ✅ **Search without results panel**: No issues when `setShowResults(false)` always
- ✅ **Results panel with simple content**: No issues with basic `<div>` elements  
- ❌ **Results panel with SearchResultItem**: Issues reproduce immediately
- ❌ **SearchResultItem without data hooks**: No issues when hooks disabled
- ❌ **SearchResultItem with data hooks**: Issues reproduce consistently

This confirms the data-fetching hooks are the exact root cause.

## Code Architecture Analysis

### Current Search Result Display Architecture

```typescript
// SearchResultItem.tsx
const { channelName, icon } = useSearchResultDisplayDM({ result }); // DATABASE CALLS
const { displayName, channelName } = useSearchResultDisplaySpace({ result }); // API CALLS
```

### Hook Details

**useSearchResultDisplayDM** (`/src/hooks/business/search/useSearchResultDisplayDM.ts`):
- Makes `messageDB.getConversation()` database calls in useEffect
- Updates multiple state variables (`setIcon`, `setDisplayName`, `setIsLoading`)
- Designed for individual component use, not bulk operations

**useSearchResultDisplaySpace** (`/src/hooks/business/search/useSearchResultDisplaySpace.ts`):
- Uses React Query hooks (`useUserInfo`, `useSpace`) for API calls
- Makes simultaneous network requests for user and space data
- Each search result triggers separate API calls

### The Fundamental Problem

**Anti-Pattern**: Multiple components making expensive async operations simultaneously on mount.

When 8-10 SearchResultItem components mount at once:
- 8-10 database calls via `useSearchResultDisplayDM`
- 16-20 API calls via `useSearchResultDisplaySpace` (user + space per result)
- Multiple React state updates happening concurrently
- Browser overwhelmed by async operation cascade

## Failed Solution Attempts

### Attempt 1: Fix DropdownPanel useEffect Cleanup
**Approach**: Fixed useEffect cleanup function in DropdownPanel.tsx
**Result**: ❌ FAILED - No impact on the issue
**Reason**: The issue was not in DropdownPanel event listeners

### Attempt 2: Prevent Enter Key Form Submission
**Approach**: Always prevent Enter key in `useKeyboardNavigation.ts`
**Result**: ❌ FAILED - No impact on the issue  
**Reason**: Issue occurs when panel appears, not from keyboard input

### Attempt 3: Remove SearchResultItem tabIndex
**Approach**: Changed `tabIndex={0}` to `tabIndex={-1}` to prevent focus stealing
**Result**: ❌ FAILED - No impact on the issue
**Reason**: Focus stealing was caused by async operations, not focusable elements

### Attempt 4: Defensive Async Operations
**Approach**: Added defensive checks, timeouts, and requestAnimationFrame to database calls
**Result**: ❌ FAILED - Issue persisted
**Reason**: Any async operation in the hooks still caused the problem

### Attempt 5: Staggered Loading with useState
**Approach**: Used `useState` and `useEffect` to delay API calls with increasing timeouts
**Result**: ❌ FAILED - Issue persisted
**Reason**: The state changes themselves (`setShouldLoadData(true)`) triggered page refresh

### Attempt 6: Conditional Hook Execution
**Approach**: Added `enabled` flag to hooks to disable API calls
**Result**: ❌ FAILED - Couldn't implement due to React Rules of Hooks
**Reason**: Hooks cannot be called conditionally

### Attempt 7: Complete Hook Elimination (Current State)
**Approach**: Removed all data-fetching hooks, show truncated IDs instead
**Result**: ✅ FIXES PAGE REFRESH - ❌ BREAKS USER EXPERIENCE
**Reason**: Users see cryptographic keys instead of readable names

## Current State

**Status**: RESTORED PROPER DISPLAY NAMES - Issue Has Returned

As of 2025-01-20 evening, proper display names have been restored:
- ✅ Real channel names (e.g., "#general", "#dev-chat")
- ✅ Real user names (e.g., "John Smith", "Alice Johnson") 
- ✅ Proper DM display names

**Consequence**: The original issues have returned:
- ❌ Page refresh when search results appear (after 3+ characters typed)
- ❌ Focus stealing from search input (cursor disappears, requires click to continue)

**Code Status**: All data-fetching hooks restored to original state:
- `useSearchResultDisplayDM` - Making database calls for DM user info
- `useSearchResultDisplaySpace` - Making API calls for user and space info

This confirms the root cause analysis - the display hooks are indeed the culprit causing both issues.

## Required Real Solution

**Must Have Requirements**:
1. ✅ No page refresh when search results appear
2. ✅ No focus stealing from search input
3. ✅ **Real channel names and user display names** (not IDs)
4. ✅ Fast search results appearance
5. ✅ Full search functionality

## Potential Approaches to Investigate

### Option 1: Batch API Strategy
- Pre-load all user and space data in a global cache
- Search results use cached data instead of individual API calls
- Challenge: Cache invalidation and memory usage

### Option 2: Server-Side Search Enhancement  
- Modify search API to include display names in results
- Eliminate need for client-side data fetching
- Challenge: Requires backend changes

### Option 3: Virtualized Loading
- Only load display names for visible search results
- Use intersection observer for lazy loading
- Challenge: Complex implementation, may still have timing issues

### Option 4: Search Results Refactor
- Move from individual SearchResultItem hooks to bulk data loading
- Single API call for all search result metadata
- Challenge: Requires architectural changes to hook system

## Files Involved

- `/src/components/search/SearchResultItem.tsx` - Main component with problematic hooks
- `/src/hooks/business/search/useSearchResultDisplayDM.ts` - Database call hook
- `/src/hooks/business/search/useSearchResultDisplaySpace.ts` - API call hook  
- `/src/components/search/SearchResults.tsx` - Results container
- `/src/hooks/business/search/useGlobalSearchState.ts` - Controls when results show

## Conclusion

This is a **fundamental architecture issue** where the current search result display pattern (individual async hooks per component) is incompatible with bulk search result rendering. 

**Current Trade-off Choice**: 
- ✅ **Proper user experience** (real display names) 
- ❌ **Technical issues** (page refresh and focus stealing)

This demonstrates that any real solution requires either:
1. **Changing how display data is fetched** (bulk/cached instead of individual)
2. **Changing when display data is fetched** (pre-loaded instead of on-demand)  
3. **Changing what display data is available** (server-side inclusion)

**Immediate Impact**: Users can now see proper channel and user names in search results, but must deal with page refresh and focus issues until architectural solution is implemented.

**Next Steps**: Architectural decision needed on which approach to pursue for maintaining user-friendly display names while eliminating performance issues.

---
*Updated: 2025-01-20 (Evening) - Reverted to proper display names*