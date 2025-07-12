# 🔍 Global Message Search Implementation Plan

## 📋 Overview
Implementation of a Discord-like global search feature that allows users to search messages within their current context (DM or Space) with real-time results and proper scoping.

## 🎯 Requirements Analysis
- **Context-aware search**: DM view searches only DMs, Space view searches only that space
- **Permission-based**: Only search accessible content
- **Real-time**: Instant search results as user types
- **UI/UX**: Search bar in top-right, Discord-like interface
- **Performance**: Efficient IndexedDB queries for large message sets

## 🏗️ Architecture Strategy

### 1. Data Layer (IndexedDB Search)
- Leverage existing `MessageDB` class in `src/db/messages.ts`
- Create search indices for efficient text matching
- Implement full-text search across message content
- Scope queries by context (spaceId/channelId for spaces, conversationId for DMs)

### 2. Search Service Layer
- Create `src/services/searchService.ts` for search logic abstraction
- Implement search result ranking/scoring
- Handle search debouncing and caching
- Support different search contexts (DM vs Space)

### 3. React Hooks Layer
- Create `src/hooks/queries/search/` directory structure
- Implement `useGlobalSearch` hook with React Query integration
- Handle search state management and caching
- Support infinite loading for large result sets

### 4. UI Components
- **SearchBar**: Top-right positioned search input
- **SearchResults**: Dropdown/modal with message results
- **SearchResultItem**: Individual message result with context
- **SearchFilters**: Optional filters (date, channel, user)

## 🔍 Search Technology Decision

### Recommended: **MiniSearch** + Custom IndexedDB Integration

**Why MiniSearch:**
- **Bundle size**: Only ~15KB gzipped (important for Electron app)
- **TypeScript native**: Perfect fit for our codebase
- **Performance**: Fast indexing and search
- **Features**: Supports fuzzy search, auto-suggestions, field boosting
- **Flexibility**: Can integrate with our existing IndexedDB structure

**Alternative considered**: FlexSearch (faster but larger, more complex integration)

### Search Architecture
```
┌─────────────────┬──────────────────┬─────────────────┐
│   MiniSearch     │   IndexedDB      │   React Query   │
│   (In-Memory     │   (Persistent    │   (Caching &    │
│    Indices)      │    Message       │    State Mgmt)  │
│                  │    Storage)      │                 │
└─────────────────┴──────────────────┴─────────────────┘
```

## 🔧 Implementation Steps

### Phase 1: Core Search Infrastructure
1. **Install MiniSearch**
   ```bash
   yarn add minisearch
   yarn add -D @types/minisearch
   ```

2. **Enhance MessageDB for search**
   - Add search index creation methods to `src/db/messages.ts`
   - Create `buildSearchIndex()` and `rebuildSearchIndex()` methods
   - Implement context-aware search query methods
   - Add search result caching

3. **Create Search Service**
   - Build `src/services/searchService.ts` with MiniSearch integration
   - Implement search algorithms and ranking
   - Add result deduplication and sorting
   - Handle index management and updates

### Phase 2: React Integration
1. **Search Hooks**
   - Create `src/hooks/queries/search/useGlobalSearch.ts`
   - Integrate with React Query for caching
   - Handle loading states and error handling

2. **Context Detection**
   - Determine current view context (DM vs Space)
   - Extract relevant IDs for scoped search
   - Handle permission checking

### Phase 3: UI Implementation
1. **Search Bar Component**
   - Position in top-right of main layout
   - Implement search input with debouncing
   - Add keyboard shortcuts (Ctrl+K/Cmd+K)

2. **Search Results UI**
   - Create dropdown/modal for results
   - Implement result item components
   - Add navigation to original message context

### Phase 4: UX Enhancements
1. **Search Filtering**
   - Add date range filters
   - Channel/conversation filtering
   - User filtering for search results

2. **Performance Optimization**
   - Implement search result virtualization
   - Add search history and suggestions
   - Optimize IndexedDB queries

## 📁 File Structure Plan

```
src/
├── components/
│   └── search/
│       ├── SearchBar.tsx
│       ├── SearchResults.tsx
│       ├── SearchResultItem.tsx
│       └── SearchFilters.tsx
├── hooks/
│   └── queries/
│       └── search/
│           ├── index.ts
│           ├── useGlobalSearch.ts
│           ├── buildSearchFetcher.ts
│           └── buildSearchKey.ts
├── services/
│   └── searchService.ts
└── db/
    └── messages.ts (enhanced)
```

## 🎨 UI/UX Design Approach

### Search Bar
- Position: Top-right corner of main layout
- Style: Consistent with app's design system
- Placeholder: "Search messages..." with context hint
- Keyboard shortcut: Ctrl/Cmd + K to focus

### Search Results
- Format: Dropdown below search bar
- Content: Message preview with sender, timestamp, channel/DM context
- Navigation: Click to jump to original message location
- Highlighting: Search terms highlighted in results

### Context Awareness
- DM View: "Search in Direct Messages"
- Space View: "Search in [Space Name]"
- Visual indicators for result source context

## 🔍 Search Algorithm Design

### Text Matching
1. **Exact phrase matching**: Highest priority
2. **Word boundary matching**: Medium priority
3. **Partial word matching**: Lower priority
4. **Fuzzy matching**: Lowest priority (optional)

### Result Ranking Factors
- Recency of message
- Exact vs partial matches
- User interaction history
- Channel/conversation relevance

### Performance Considerations
- Debounce search input (300ms)
- Limit initial results (50 items)
- Implement virtual scrolling for large result sets
- Cache recent searches

## 🚧 Technical Constraints & Solutions

### IndexedDB + MiniSearch Integration
- **Issue**: MiniSearch is in-memory, IndexedDB is persistent
- **Solution**: 
  - Build MiniSearch indices on app startup from IndexedDB
  - Incrementally update indices when new messages arrive
  - Store index snapshots in IndexedDB for faster startup
  - Implement lazy loading for large message histories

### Memory Management
- **Issue**: Large message histories could consume too much memory
- **Solution**:
  - Implement index chunking by date ranges
  - Use LRU cache for search indices
  - Only index recent messages initially (last 30 days)
  - Load older indices on demand

### Context Switching Performance
- **Issue**: Rebuilding indices when switching contexts is expensive
- **Solution**: 
  - Pre-build indices for all accessible spaces/DMs
  - Use Map<contextId, MiniSearch> for instant context switching
  - Implement background index updates

### Search Result Accuracy
- **Issue**: Ensuring relevant results across different message types
- **Solution**:
  - Configure MiniSearch with field boosting (content > username > timestamp)
  - Implement result post-processing for relevance scoring
  - Add search term highlighting in results

## 📈 Success Metrics

### Performance Targets
- Search response time: < 200ms for typical queries
- UI responsiveness: No blocking during search
- Memory usage: Efficient IndexedDB utilization

### User Experience Goals
- Intuitive Discord-like search behavior
- Accurate, relevant search results
- Smooth navigation to original messages
- Clear context indicators

## 🔄 Implementation Status
- [x] Phase 1: Core Search Infrastructure ✅
- [x] Phase 2: React Integration ✅
- [x] Phase 3: UI Implementation ✅
- [x] Phase 4: UX Enhancements ✅

---

## 📝 Development Notes

### Implementation Completed ✅

**MiniSearch Integration:**
- Successfully integrated MiniSearch 7.1.2 for client-side full-text search
- Created custom TypeScript definitions since @types/minisearch doesn't exist
- Implemented hybrid architecture with in-memory indices and IndexedDB persistence

**Enhanced MessageDB:**
- Added search index creation and management methods
- Implemented context-aware search with space/DM scoping
- Added real-time index updates for new/deleted messages
- Configured field boosting (content: 2x, senderId: 1x)

**React Integration:**
- Built complete hook system with React Query integration
- Implemented debounced search with 300ms delay
- Added comprehensive caching and invalidation strategies
- Created reusable search components following app design patterns

**UI Components:**
- **SearchBar**: Discord-like search input with Ctrl/Cmd+K support, suggestions, and contextual placeholders
- **SearchResults**: Virtualized results list with loading/error states and click-outside handling
- **SearchResultItem**: Rich result display with metadata, highlighting, and score indicators
- **GlobalSearch**: Integrated component with automatic context detection

**Context Detection:**
- Intelligent route parsing for space vs DM context
- Dynamic placeholder text based on current location
- Proper scoping to prevent cross-context information leakage

### Technical Achievements

1. **Performance Optimizations:**
   - Virtualized large result sets with react-virtuoso
   - Debounced search queries to prevent excessive API calls
   - LRU cache with 5-minute TTL for search results
   - Efficient IndexedDB querying with proper indices

2. **User Experience:**
   - Real-time search as user types
   - Keyboard navigation through suggestions
   - Search term highlighting in results
   - Contextual search scoping (space/DM awareness)
   - Responsive design for mobile devices

3. **Integration Quality:**
   - Seamless integration with existing MessageDB and React Query
   - Follows app's design system and styling patterns
   - Proper TypeScript typing throughout
   - Error handling and loading states

### File Structure Created
```
src/
├── components/search/
│   ├── SearchBar.tsx + .scss
│   ├── SearchResults.tsx + .scss  
│   ├── SearchResultItem.tsx + .scss
│   ├── GlobalSearch.tsx + .scss
│   └── index.ts
├── hooks/
│   ├── queries/search/
│   │   ├── useGlobalSearch.ts
│   │   ├── buildSearchFetcher.ts
│   │   ├── buildSearchKey.ts
│   │   └── index.ts
│   └── useSearchContext.ts
├── services/
│   └── searchService.ts
└── types/
    └── minisearch.d.ts
```

## 🐛 Known Issues & TODOs

### Future Enhancements
- [ ] **Search Filters**: Add date range, user, and channel filters
- [ ] **Search History**: Store and display recent searches
- [ ] **Advanced Search**: Support for exact phrases, boolean operators
- [ ] **Performance**: Implement search result pagination for very large datasets
- [ ] **Analytics**: Track search usage patterns and optimize accordingly

### Integration Notes
- Search indices are built on app startup - may need optimization for large message histories
- Index updates happen in real-time but could benefit from batching for high-volume spaces
- Consider implementing search result caching in IndexedDB for offline access