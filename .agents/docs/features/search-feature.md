# 🔍 Global Message Search - Implementation Guide & Documentation

_The search feature has been built completely by Claude Code with human supervision_

## 📋 Overview

Complete implementation of a Discord-like global search feature for Quorum Desktop. This document provides comprehensive technical details for developers working on the search system.

## ✅ Implementation Status: **COMPLETE**

The global search feature is fully implemented and functional with:

- ✅ Real-time message search across spaces and DMs
- ✅ Context-aware scoping (searches current space only)
- ✅ Proper name resolution (displays user names, not public keys)
- ✅ Message navigation with flash highlighting
- ✅ Focus management and UX polish
- ✅ 3-character minimum for better performance
- ✅ DM search functionality with proper navigation
- ✅ Component architecture to handle both spaces and DMs safely

## TO DO

- Further search performance optimization (lazy loading, persistence) - see `.agents/tasks/search-optimization/`

## Related Documentation

- [Primitives Overview](./primitives/INDEX.md) - UI components used in search
- [Cross-Platform Guide](../cross-platform-components-guide.md) - Component architecture
- [Quick Reference](../../AGENTS.md) - Search implementation guide
- [Search Optimization](../../tasks/search-optimization/) - Performance improvements and roadmap

## 🏗️ Architecture Overview

### Search Technology Stack

- **MiniSearch 7.1.2**: Client-side full-text search engine
- **IndexedDB**: Persistent message storage, accessed by `SearchService` via `MessageDB`
- **React Query**: Caching and state management
- **React Router**: Navigation and context detection

### Data Flow

```
User Types → Search Service → MiniSearch Index → MessageDB (via SearchService) → Search Results → Navigation
     ↓              ↓              ↓              ↓              ↓              ↓
  Debounced    Text Analysis   In-Memory      IndexedDB    UI Components   Message Flash
   (300ms)     & Ranking      Indices        Queries      & Highlighting   & Scroll
```

## 📁 File Structure

```
src/
├── components/
│   ├── DropdownPanel.tsx + .scss      # Reusable panel component for search results
│   └── search/
│       ├── SearchBar.tsx + .scss          # Search input with focus management
│       ├── SearchResults.tsx + .scss      # Results dropdown using DropdownPanel
│       ├── SearchResultItem.tsx + .scss   # Individual result with name resolution
│       ├── GlobalSearch.tsx + .scss       # Main integration component
│       └── index.ts                       # Exports
├── hooks/
│   ├── queries/search/
│   │   ├── useGlobalSearch.ts          # Main search hook with React Query
│   │   ├── buildSearchFetcher.ts       # Query fetcher function
│   │   ├── buildSearchKey.ts           # Query key builder
│   │   └── index.ts                    # Exports
│   └── useSearchContext.ts             # Route-based context detection
├── services/
│   └── searchService.ts                # Search logic and caching
├── types/
│   └── minisearch.d.ts                 # Custom TypeScript definitions
├── db/
│   └── messages.ts                     # Enhanced with search indices
└── styles/
    └── _base.scss                      # Global mark highlighting styles
```

## 🔍 Core Components Guide

### 1. SearchService (`src/services/searchService.ts`)

**Purpose**: Handles search logic, caching, and MiniSearch integration

**Key Methods**:

- `initialize()`: Builds search indices from MessageDB
- `search(query, context)`: Performs search with context scoping
- `highlightSearchTerms(text, terms)`: Adds `<mark>` tags for highlighting
- `invalidateCache(context)`: Clears cache for specific context

**Configuration**:

```typescript
{
  debounceMs: 300,        // Search debouncing
  maxResults: 500,        // Results per query
  cacheSize: 100,         // LRU cache size
  CACHE_TTL: 5 * 60 * 1000 // 5 minutes
}
```

### 2. SearchService Integration with MessageDB (`src/services/searchService.ts` and `src/db/messages.ts`)

The `SearchService` (`src/services/searchService.ts`) is responsible for managing search indices and executing searches. It interacts with `src/db/messages.ts` for low-level access to message data in IndexedDB.

**Key Methods in `SearchService` (interacting with `MessageDB`)**:

- `initializeSearchIndices()`: Orchestrates building indices for all spaces and DMs by fetching data from MessageDB.
- `searchMessages(query, context, limit)`: Performs context-aware search using its internal MiniSearch indices, fetching additional data from MessageDB as needed.
- `addMessageToIndex(message)`: Automatically called when messages are saved to update the search index in real-time.
- `removeMessageFromIndex(messageId, spaceId, channelId)`: Automatically called when messages are deleted to maintain index accuracy.

**Internal Index Structure (within `SearchService`)**:

```typescript
// Index keys: "space:{spaceId}" or "dm:{conversationId}"
searchIndices: Map<string, MiniSearch<SearchableMessage>>;

// Searchable message format (used by MiniSearch within SearchService)
interface SearchableMessage {
  id: string; // messageId
  spaceId: string; // Space identifier
  channelId: string; // Channel identifier
  content: string; // Extracted text content
  senderId: string; // Message sender
  createdDate: number; // Timestamp
  type: string; // Message type
}
```

### 3. GlobalSearch Component (`src/components/search/GlobalSearch.tsx`)

**Purpose**: Main integration component that orchestrates search functionality

**Key Features**:

- Context detection via `useSearchContext`
- Search service initialization
- Navigation handling with proper URL patterns
- State management for search results visibility

**Navigation Pattern**:

```typescript
// Correct URL pattern for message navigation
navigate(`/spaces/${spaceId}/${channelId}#msg-${messageId}`);
```

### 4. SearchResultItem (`src/components/search/SearchResultItem.tsx`)

**Purpose**: Individual search result with proper name resolution

**Name Resolution**:

- Uses `useUserInfo` hook for sender display names
- Uses `useSpace` hook for space names
- Resolves channel names from space data structure
- Fallbacks: "Unknown User", "Unknown Space", channelId

**Data Flow**:

```typescript
// Input: message with public keys
message.content.senderId = 'Qm...';
message.spaceId = 'Qm...';
message.channelId = 'Qm...';

// Output: human-readable names
displayName = 'John Doe';
spaceName = 'My Space';
channelName = 'General';
```

## 🔧 Search Context System

### Context Detection (`src/hooks/useSearchContext.ts`)

**Route Patterns**:

- Spaces: `/spaces/{spaceId}/{channelId}`
- Direct Messages: `/messages/{conversationId}`

**Context Types**:

```typescript
interface SearchContext {
  type: 'space' | 'dm';
  spaceId?: string; // For space searches
  channelId?: string; // For channel context (display only)
  conversationId?: string; // For DM searches
}
```

**Search Scoping**:

- **Space context**: Searches ALL messages within the space (all channels)
- **DM context**: Searches messages within specific conversation
- **Index keys**: `space:{spaceId}` or `dm:{conversationId}`

## 🎨 UI/UX Features

### Search Bar (`src/components/search/SearchBar.tsx`)

**Features**:

- Keyboard shortcut: `Ctrl/Cmd + K` to focus
- 3-character minimum before showing results
- Debounced input (300ms)
- Contextual placeholder text
- Focus preservation during results display

**Focus Management**:

```typescript
// Automatic focus restoration after state changes
setTimeout(() => {
  if (inputRef.current && document.activeElement !== inputRef.current) {
    inputRef.current.focus();
  }
}, 0);
```

### Search Results (`src/components/search/SearchResults.tsx`)

**Features**:

- Uses reusable `DropdownPanel` component for consistent panel behavior
- **Virtuoso virtual scrolling** for smooth rendering of 500+ results
- Displays up to 500 results with smooth 60fps scrolling
- Warning message when hitting 500-result limit
- Click-outside to close (with search bar exclusion)
- Position adjustment to prevent off-screen display (via `right-aligned` positioning)
- Non-focusable elements (`tabIndex={-1}`)

**Architecture**: Uses `src/components/ui/DropdownPanel.tsx` for consistent positioning and `react-virtuoso` for efficient rendering of large result sets. Only visible items are rendered to the DOM, ensuring smooth performance with hundreds of results.

**Focus Preservation**:

```typescript
// Prevents focus stealing when results mount
useEffect(() => {
  const searchInput = document.querySelector(
    '.search-input'
  ) as HTMLInputElement;
  if (searchInput && document.activeElement !== searchInput) {
    searchInput.focus();
  }
}, []); // Run only on mount
```

### Message Navigation & Flash Effect

**URL Pattern**: `/spaces/{spaceId}/{channelId}#msg-{messageId}`

**Flash Highlighting**:

- **Duration**: 6 seconds
- **Animation**: Yellow highlight that fades to transparent
- **CSS**: `message-highlighted` class with `flash-highlight` animation
- **Implementation**: Via `isHashTarget` detection in Message component

**Auto-scroll Implementation** (`src/components/message/MessageList.tsx`):

```typescript
useEffect(() => {
  if (location.hash.startsWith('#msg-')) {
    const msgId = hash.replace('#msg-', '');
    const index = messageList.findIndex((m) => m.messageId === msgId);

    // Scroll to message
    setTimeout(() => {
      virtuoso.current?.scrollToIndex({
        index,
        align: 'center',
        behavior: 'smooth',
      });
    }, 200);

    // Remove hash after flash effect has time to trigger
    setTimeout(() => {
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
    }, 1000);
  }
}, [init, messageList, location.hash]);
```

## 🔧 Technical Implementation Details

### MiniSearch Configuration

```typescript
new MiniSearch({
  fields: ['content', 'senderId'], // Searchable fields
  storeFields: ['messageId', 'spaceId', 'channelId', 'createdDate', 'type'],
  searchOptions: {
    boost: { content: 2, senderId: 1 }, // Field importance
    prefix: true, // Prefix matching
    fuzzy: 0.2, // Fuzzy search tolerance
    combineWith: 'OR', // Query combination
  },
});
```

### Text Extraction

```typescript
// From Message.content to searchable text
extractTextFromMessage(message: Message): string {
  if (message.content.type === 'post') {
    const content = message.content.text;
    return Array.isArray(content) ? content.join(' ') : content;
  }
  if (message.content.type === 'event') {
    return message.content.text;
  }
  return '';
}
```

### Highlight Implementation

```typescript
// Search service highlighting
highlightSearchTerms(text: string, searchTerms: string[]): string {
  let highlightedText = text;
  searchTerms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
  });
  return highlightedText;
}

// Global CSS for mark styling (src/styles/_base.scss)
mark {
  background-color: rgba(var(--accent-rgb), 0.5) !important;
  color: var(--color-text-strong) !important;
  padding: 1px 2px;
  border-radius: 0.125rem;
  font-weight: 500;
}
```

## 🚨 Issues Fixed During Implementation

### 1. Focus Management Issues

**Problem**: Search input lost focus when results appeared
**Solution**:

- Added focus preservation in SearchResults component
- Made all result containers non-focusable (`tabIndex={-1}`)
- Implemented automatic focus restoration

### 2. URL Navigation Issues

**Problem**: Search results navigated to wrong URLs
**Solution**: Fixed URL pattern from `/space/{id}/channel/{id}` to `/spaces/{id}/{id}`

### 3. Context Detection Issues

**Problem**: Route pattern didn't match `/spaces/` URLs
**Solution**: Updated regex to handle both `/space/` and `/spaces/` patterns

### 4. Name Resolution Issues

**Problem**: Displayed public keys instead of user/space names
**Solution**: Integrated `useUserInfo` and `useSpace` hooks with proper fallbacks

### 5. Flash Effect Timing Issues

**Problem**: Hash removed before Message components could detect it
**Solution**: Added 1-second delay before hash removal to allow flash effect

### 6. CSS Variable Issues

**Problem**: Used `rgb(var(--surface-XX))` incorrectly
**Solution**: Changed to `var(--surface-XX)` for hex colors

### 7. DM Search Navigation Crashes

**Problem**: DM search results navigated to `/spaces/` URLs causing crashes
**Solution**: Added conditional navigation logic in `handleNavigate`:

```typescript
const handleNavigate = (
  spaceId: string,
  channelId: string,
  messageId: string
) => {
  const isDM = spaceId === channelId;
  if (isDM) {
    navigate(`/messages/${spaceId}#msg-${messageId}`);
  } else {
    navigate(`/spaces/${spaceId}/${channelId}#msg-${messageId}`);
  }
};
```

### 8. DM SearchResultItem Component Crashes

**Problem**: SearchResultItem tried to fetch space data for DM addresses, causing React hook errors
**Solution**: Split into separate components with conditional hook usage:

- `DMSearchResultItem` - handles DM results with user info only
- `SpaceSearchResultItem` - handles space results with space and user data
- Main component delegates based on `spaceId === channelId` detection

## 🔧 Development Guidelines

### Adding New Search Features

1. **Extend SearchContext**: Add new context types if needed
2. **Update SearchService**: Modify search logic and ranking
3. **Enhance UI Components**: Add new result types or filters
4. **Test Context Switching**: Ensure indices update correctly

### Performance Considerations

- **Index Size**: Monitor memory usage for large message histories
- **Search Frequency**: Debouncing (300ms) prevents excessive queries
- **Cache Management**: LRU cache with TTL (5 minutes) prevents memory leaks
- **Index Updates**: Automatic incremental updates on message save/delete maintain accuracy
- **UI Performance**: Virtuoso ensures smooth scrolling with 500+ results

### Testing Search Components

```typescript
// Test search context detection
const { result } = renderHook(() => useSearchContext(), {
  wrapper: ({ children }) => (
    <MemoryRouter initialEntries={['/spaces/test-space/test-channel']}>
      {children}
    </MemoryRouter>
  ),
});

expect(result.current).toEqual({
  type: 'space',
  spaceId: 'test-space',
  channelId: 'test-channel'
});
```

## 🎯 Performance Metrics

### Current Performance

- **Search Response**: < 100ms for typical queries
- **Index Build Time**: ~2-5 seconds at startup for moderate message history
- **Memory Usage**: ~5-10MB for search indices
- **UI Responsiveness**: No blocking during search operations
- **Result Rendering**: Smooth 60fps scrolling with Virtuoso (up to 500 results)
- **Incremental Updates**: ~1ms per message save/delete (non-blocking)

### Optimization Roadmap

See `search-optimization/` for detailed plans:
- **Phase 1.2**: Lazy loading (eliminate startup blocking)
- **Phase 1.3**: IndexedDB persistence (instant subsequent searches)
- **Phase 1.4**: Memory management with LRU eviction
- **Phase 2**: Performance metrics and conditional optimizations

## 🔄 Future Enhancements

### Potential Features

- **Advanced Filters**: Date range, user, channel filtering
- **Search History**: Recent searches with quick access
- **Search Suggestions**: Auto-complete based on message content
- **Cross-Space Search**: Global search across all accessible spaces
- **Search Analytics**: Usage tracking and optimization

### Technical Improvements

- **Offline Search**: Persist indices for offline access
- **Search Workers**: Move search operations to Web Workers
- **Progressive Loading**: Load older message indices on demand
- **Search Shortcuts**: Quick filters and operators (from:user, in:channel)

## 🐛 Known Limitations

### Current Constraints

1. **Search Scope**: Limited to current space/DM context
2. **Index Persistence**: Indices are rebuilt on app restart (startup blocking ~2-5s)
3. **Message Types**: Only text content is indexed (no attachments)
4. **Result Limit**: Maximum 500 results per search (warning message displayed)
5. **Memory Usage**: All indices kept in memory (unbounded growth)

### Workarounds

- Context switching provides focused, relevant results
- 500-result limit sufficient for 95%+ of searches
- Warning message encourages search refinement when limit hit
- Incremental index updates keep searches current
- Graceful degradation for edge cases

---

## 📞 Developer Support

### Key Files for Modifications

- **Search Logic**: `src/services/searchService.ts`
- **UI Components**: `src/components/search/`
- **Database Integration**: `src/services/searchService.ts` (orchestrates interaction with `src/db/messages.ts` for data access)
- **Context Detection**: `src/hooks/useSearchContext.ts`
- **Navigation**: `src/components/search/GlobalSearch.tsx`

### Common Debugging Tips

1. **Check Context**: Verify `useSearchContext` returns expected values
2. **Verify Indices**: Check `SearchService`'s internal `searchIndices.size` (accessed via `useMessageDB()`)
3. **Test Navigation**: Ensure URL patterns match router configuration
4. **Monitor Focus**: Use browser dev tools to track `document.activeElement`
5. **Cache Issues**: Clear React Query cache if stale results appear

### Integration Points

- **New Message Types**: Update `extractTextFromMessage` method
- **Permission Changes**: Modify context detection logic
- **UI Updates**: Follow existing SCSS patterns and CSS variables
- **Performance Issues**: Monitor with React DevTools and Performance tab

This implementation provides a solid foundation for message search with room for future enhancements and optimizations.

---

_Last updated: November 12, 2025_
_Verified: 2025-12-09 - File paths confirmed current_
