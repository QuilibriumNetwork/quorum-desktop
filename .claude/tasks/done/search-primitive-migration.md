# Search Components Primitive Migration

## Overview
Complete migration of search feature components to use primitive architecture for consistency and mobile compatibility.

## Current State Analysis

### Components Structure
- **GlobalSearch.tsx**: Main orchestrator component (✅ Clean - no primitives needed)
- **SearchBar.tsx**: Contains raw HTML `<input>` and `<button>` with FontAwesome icons
- **SearchResults.tsx**: Results container with FontAwesome icons for loading/error states
- **SearchResultItem.tsx**: Individual result items with FontAwesome icons for message types

### Key Issues
- Raw HTML `<input>` field in SearchBar (line 167-180)
- Raw HTML clear `<button>` in SearchBar (line 182-190) 
- FontAwesome icons throughout all components instead of Icon primitive
- Custom SCSS styling instead of leveraging primitive styles
- Complex focus management needs to work with Input primitive

### Usage Locations
- **DirectMessage.tsx**: `<GlobalSearch className="dm-search flex-1 lg:flex-none max-w-xs lg:max-w-none" />`
- **Channel.tsx**: `<GlobalSearch className="channel-search flex-1 lg:flex-none max-w-xs lg:max-w-none" />`

## Migration Plan

### Phase 1: SearchBar.tsx Primitive Migration 🔄
**Target**: Replace raw HTML elements with primitives

**Changes Required**:
- Replace raw `<input>` (line 167-180) with Input primitive
- Replace clear `<button>` (line 182-190) with Button primitive
- Replace FontAwesome icons:
  - `faSearch` → Icon primitive with name="search"
  - `faTimes` → Icon primitive with name="times"

**Critical Considerations**:
- **Focus Management**: Complex anti-focus-stealing logic (lines 36-46) must work with Input primitive
- **Keyboard Navigation**: Ctrl/Cmd+K shortcuts (lines 49-66) need Input primitive compatibility
- **Suggestion Dropdown**: Arrow key navigation (lines 68-104) integration with Input
- **Mobile Detection**: Window width checks for mobile overlay (lines 41-44)

**Testing Requirements**:
- Keyboard shortcuts (Ctrl/Cmd+K to focus, Escape to blur)
- Suggestion selection with arrow keys and Enter/Tab
- Anti-focus-stealing during typing (isUserTyping logic)
- Mobile overlay detection and focus prevention

### Phase 2: SearchResults.tsx Icon Migration 🔄
**Target**: Replace FontAwesome icons with Icon primitive

**Changes Required**:
- Replace FontAwesome icons in state rendering:
  - `faSearch` → Icon primitive with name="search" (empty/no-results state)
  - `faSpinner` → Icon primitive with name="spinner" (loading state)
  - `faExclamationTriangle` → Icon primitive with name="exclamation-triangle" (error state)

**Preserve Existing Logic**:
- React Virtuoso integration for large result sets (lines 243-259)
- Dynamic width calculation and mobile positioning (lines 50-90)
- Click-outside-to-close behavior (lines 115-144)

**Testing Requirements**:
- Loading state with spinner animation
- Error state display
- Empty/no-results state
- Result virtualization for large datasets
- Mobile responsive positioning

### Phase 3: SearchResultItem.tsx Icon Migration 🔄
**Target**: Replace FontAwesome icons with Icon primitive

**Changes Required**:
- Replace FontAwesome icons:
  - `faHashtag` → Icon primitive with name="hashtag" (post messages)
  - `faUser` → Icon primitive with name="user" (user indicator)
  - `faCalendarAlt` → Icon primitive with name="calendar" (event messages)

**Preserve Complex Logic**:
- DM vs Space result differentiation (line 135: `message.spaceId === message.channelId`)
- User info fetching for DM results (DMSearchResultItem component)
- Space/channel info fetching (SpaceSearchResultItem component)  
- Contextual snippet generation with search term highlighting (lines 202-259)

**Testing Requirements**:
- DM result display with user avatars
- Space result display with channel/space info
- Message type icon display (posts vs events)
- Search term highlighting in results
- Result navigation to correct routes

### Phase 4: Cleanup & Optimization 🔄
**Target**: Remove legacy code and optimize styles

**Changes Required**:
- Remove FontAwesome imports from all search components
- Update SCSS files to leverage primitive styles where possible
- Consolidate common styling patterns
- Remove unused CSS rules after primitive migration

**SCSS Files to Review**:
- `SearchBar.scss`: Focus styles, suggestion dropdown
- `SearchResults.scss`: Result container and state styling  
- `SearchResultItem.scss`: Individual result item styling
- `GlobalSearch.scss`: Overall container (minimal changes needed)

## Mobile Bottom Sheet Considerations 📱

### Future Mobile Implementation Notes
- Search will open in bottom sheet on mobile devices
- Current positioning logic in SearchResults.tsx may need adjustment
- Focus management in SearchBar.tsx should account for bottom sheet behavior
- Consider viewport height constraints for bottom sheet search results

### Potential Conflicts
- Z-index management (GlobalSearch.scss has mobile-specific z-index: 30)
- Touch vs mouse interaction patterns
- Keyboard behavior on mobile devices
- Virtual keyboard overlay considerations

## Testing Strategy

### Manual Testing Checklist
- [ ] Search bar focus with Ctrl/Cmd+K shortcut
- [ ] Search suggestions dropdown navigation (arrow keys)
- [ ] Search result navigation to correct message
- [ ] Loading states and error handling
- [ ] Mobile responsive behavior
- [ ] Cross-browser compatibility (especially focus behavior)

### Integration Testing
- [ ] Search from DirectMessage page
- [ ] Search from Channel page  
- [ ] Search context switching (DM vs Space results)
- [ ] Large result set virtualization
- [ ] Search term highlighting accuracy

## Implementation Notes

### Input Primitive Integration
The Input primitive expects:
```tsx
<Input 
  value={query}
  onChange={setQuery} // Direct value, not event
  placeholder={placeholder}
  className="search-input"
/>
```

But SearchBar currently uses:
```tsx
<input 
  value={query}
  onChange={(e) => onQueryChange(e.target.value)} // Event-based
  // ... other props
/>
```

### Button Primitive Integration  
The clear button should become:
```tsx
<Button
  variant="ghost"
  size="small"
  onClick={handleClear}
  className="search-clear-button"
>
  <Icon name="times" />
</Button>
```

### Icon Primitive Mapping
FontAwesome → Icon primitive mappings:
- `faSearch` → `name="search"`
- `faTimes` → `name="times"`  
- `faSpinner` → `name="spinner"`
- `faExclamationTriangle` → `name="exclamation-triangle"`
- `faHashtag` → `name="hashtag"`
- `faUser` → `name="user"`
- `faCalendarAlt` → `name="calendar"`

---

**Created**: 2025-01-28  
**Status**: Planned  
**Priority**: Medium  
**Dependencies**: Input, Button, Icon primitives  
**Related**: mobile-app-architecture.md, primitive-migration-progress.md