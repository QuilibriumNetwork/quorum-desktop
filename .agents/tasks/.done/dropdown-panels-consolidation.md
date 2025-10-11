# Dropdown Panels Consolidation & Mobile Bottom Sheet Implementation

## Overview

Consolidate the three dropdown panels (SearchResults, PinnedMessagesPanel, NotificationPanel) to fix the stacking bug and implement proper mobile touch device support using bottom sheets.

**Status**: 🔴 Not Started

**Priority**: High (Bug Fix) + Medium (Mobile Enhancement)

---

## Problem Statement

### Current Issues

1. **Bug: Multiple Panels Can Stack**
   - All three panels have independent state variables
   - Multiple panels can be open simultaneously and overlap each other
   - User confusion and poor UX

2. **Z-Index Inconsistency**
   - `PinnedMessagesPanel.scss:5` has `z-index: 1000 !important` override
   - Inconsistent with `DropdownPanel` base z-index of 10001
   - Code smell indicating past patchy fix

3. **No Mobile Optimization**
   - All panels use desktop dropdown pattern on touch devices
   - Should use bottom sheet pattern (MobileDrawer) for better mobile UX

4. **State Management Split**
   - PinnedMessages & Notifications: State in `Channel.tsx`
   - SearchResults: State in `GlobalSearch.tsx` via hooks
   - Makes coordination difficult

---

## Solution Approach

### Phase 1: Fix Mutual Exclusion & Z-Index (Desktop)

**Goal**: Fix the stacking bug and clean up z-index issues

**Implementation**:

1. **Create unified panel state in Channel.tsx**
   ```tsx
   type ActivePanel = 'pinned' | 'notifications' | 'search' | null;
   const [activePanel, setActivePanel] = useState<ActivePanel>(null);
   ```

2. **Update GlobalSearch integration**
   - Pass `isActive`, `onOpen`, `onClose` props to GlobalSearch
   - GlobalSearch uses these instead of internal state
   - Opening search closes other panels

3. **Update button handlers**
   ```tsx
   <Button onClick={() => setActivePanel('pinned')}>
     {/* Pinned Messages */}
   </Button>

   <Button onClick={() => setActivePanel('notifications')}>
     {/* Notifications */}
   </Button>
   ```

4. **Update panel isOpen props**
   ```tsx
   <PinnedMessagesPanel
     isOpen={activePanel === 'pinned'}
     onClose={() => setActivePanel(null)}
     {...otherProps}
   />

   <NotificationPanel
     isOpen={activePanel === 'notifications'}
     onClose={() => setActivePanel(null)}
     {...otherProps}
   />
   ```

5. **Fix Z-Index Override**
   - Remove `z-index: 1000 !important;` from `PinnedMessagesPanel.scss:5`
   - Let DropdownPanel's z-index (10001) be inherited naturally

6. **Optional: Create constants for shared props**
   ```tsx
   // constants/ui.ts
   export const RIGHT_PANEL_PROPS = {
     position: 'absolute' as const,
     positionStyle: 'right-aligned' as const,
     maxWidth: 500,
     showCloseButton: true,
   };
   ```

**Files to Modify**:
- `src/components/space/Channel.tsx` (lines 94-95, 535-594)
- `src/components/search/GlobalSearch.tsx` (add props)
- `src/components/message/PinnedMessagesPanel.scss` (remove line 5)
- Optional: `src/constants/ui.ts` (create new file)

**Testing**:
- [ ] Opening PinnedMessages closes Notifications if open
- [ ] Opening Notifications closes PinnedMessages if open
- [ ] Opening Search closes both PinnedMessages and Notifications
- [ ] Opening PinnedMessages closes Search if open
- [ ] All panels close properly with close button
- [ ] All panels close properly with Escape key
- [ ] All panels close properly with outside click
- [ ] Z-index is consistent (no stacking issues)

---

### Phase 2: Mobile Bottom Sheet Implementation

**Goal**: Use MobileDrawer bottom sheet pattern for touch devices

**Implementation Strategy**:

#### 2.1. Enhance DropdownPanel for Mobile Support

**File**: `src/components/ui/DropdownPanel.tsx`

**Rationale**: Instead of creating a wrapper component (ResponsivePanel), enhance DropdownPanel directly to handle both desktop dropdown and mobile bottom sheet. This:
- Follows the project's primitives pattern (Modal, Input, Button all handle platform differences internally)
- Requires zero migration for existing usages (automatic mobile support)
- Reduces abstraction layers (one component instead of three)
- Makes edge cases simple (opt-out with single prop)

**Changes**:

1. **Add prop to interface**:
```tsx
export interface DropdownPanelProps {
  // ... existing props
  useMobileBottomSheet?: boolean;  // Default: true (use bottom sheet on touch devices)
}
```

2. **Add imports and platform detection**:
```tsx
import { isTouchDevice } from '../../utils/platform';
import MobileDrawer from './MobileDrawer';
```

3. **Update component implementation**:
```tsx
export const DropdownPanel: React.FC<DropdownPanelProps> = ({
  isOpen,
  onClose,
  title,
  position = 'absolute',
  positionStyle = 'search-results',
  maxWidth = 500,
  maxHeight = 400,
  className = '',
  style,
  children,
  showCloseButton = true,
  resultsCount,
  useMobileBottomSheet = true,  // NEW: Default to mobile bottom sheet
}) => {
  const isTouch = isTouchDevice();

  // Mobile bottom sheet mode (touch devices with useMobileBottomSheet=true)
  if (isTouch && useMobileBottomSheet) {
    return (
      <MobileDrawer
        isOpen={isOpen}
        onClose={onClose}
        title={title || (resultsCount !== undefined
          ? (resultsCount === 1 ? `${resultsCount} result` : `${resultsCount} results`)
          : undefined
        )}
        showCloseButton={showCloseButton}
        enableSwipeToClose={true}
      >
        {children}
      </MobileDrawer>
    );
  }

  // Desktop dropdown mode (existing implementation)
  const panelRef = useRef<HTMLDivElement>(null);

  // ... rest of existing dropdown implementation (no changes)
};
```

**Key Points**:
- `useMobileBottomSheet` defaults to `true` - all panels get mobile support automatically
- IconPicker can opt-out with `useMobileBottomSheet={false}`
- No changes needed to PinnedMessagesPanel, NotificationPanel, or SearchResults
- Desktop behavior completely unchanged

#### 2.2. Update PinnedMessagesPanel

**File**: `src/components/message/PinnedMessagesPanel.tsx`

**Changes**: **NONE REQUIRED** ✨

**Explanation**:
- PinnedMessagesPanel already uses `<DropdownPanel>`
- DropdownPanel now automatically detects touch devices and uses MobileDrawer
- Content (Virtuoso list) works in both modes
- Mobile functionality inherited automatically

**Current code (no changes needed)**:
```tsx
<DropdownPanel
  isOpen={isOpen}
  onClose={onClose}
  position="absolute"
  positionStyle="right-aligned"
  maxWidth={500}
  maxHeight={420}
  title={...}
>
  {/* content - works on both desktop and mobile */}
</DropdownPanel>
```

**What happens automatically**:
- Desktop: Renders as dropdown (existing behavior)
- Touch devices: Renders as bottom sheet via MobileDrawer
- Zero code changes needed!

#### 2.3. Update NotificationPanel

**File**: `src/components/notifications/NotificationPanel.tsx`

**Changes**: **NONE REQUIRED** ✨

**Explanation**:
- NotificationPanel already uses `<DropdownPanel>`
- DropdownPanel now automatically detects touch devices and uses MobileDrawer
- Filter controls and content work in both modes
- Mobile drawer automatically provides full-height scrolling

**Current code (no changes needed)**:
```tsx
<DropdownPanel
  isOpen={isOpen}
  onClose={onClose}
  position="absolute"
  positionStyle="right-aligned"
  maxWidth={500}
  title={...}
>
  {/* filter controls - work on both desktop and mobile */}
  {/* notification list - scrolls properly in both modes */}
</DropdownPanel>
```

**What happens automatically**:
- Desktop: Renders as dropdown (existing behavior)
- Touch devices: Renders as bottom sheet via MobileDrawer
- Zero code changes needed!

#### 2.4. Update SearchResults (Special Case) ✅ COMPLETED

**File**: `src/components/search/SearchResults.tsx`

**Special Requirement**: On mobile, the search input field must appear at the top of the bottom sheet, above the results list. The search input field in Channel Header is replaced with a Search Icon that opens the bottom sheet (this icon has the same style as the existing users and bell icons).

**Status**: ✅ All steps completed successfully

**Implementation Steps**:

##### Step 1: Update Channel.tsx - Add Search Icon for Mobile

**File**: `src/components/space/Channel.tsx` (around line 612)

**Changes**:
```tsx
{/* Search: Desktop uses inline search, Mobile uses icon to open bottom sheet */}
{isTouchDevice() ? (
  <Tooltip
    id={`search-${channelId}`}
    content={t`Search Messages`}
    showOnTouch={false}
  >
    <Button
      type="unstyled"
      onClick={() => setActivePanel('search')}
      className="header-icon-button"
      iconName="search"
      iconOnly
    />
  </Tooltip>
) : (
  <GlobalSearch className="channel-search ml-2" />
)}
```

**State Management Integration**:
- Search icon triggers `setActivePanel('search')` (already part of unified state from Phase 1)
- Opening search closes other panels automatically
- GlobalSearch component receives `isOpen` and `onClose` props for mobile control

##### Step 2: Update GlobalSearch.tsx - Mobile Conditional Logic

**File**: `src/components/search/GlobalSearch.tsx`

**Changes**:
```tsx
import { isTouchDevice } from '../../utils/platform';

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  className,
  isOpen,      // Add: Controlled by Channel.tsx on mobile
  onClose,     // Add: Controlled by Channel.tsx on mobile
}) => {
  const isTouch = isTouchDevice();

  // On mobile, visibility is controlled externally via isOpen prop
  // On desktop, use internal state
  const showResults = isTouch ? isOpen : internalShowResults;

  return (
    <Container className={`global-search ${className || ''}`}>
      {/* Desktop: Show search bar inline */}
      {!isTouch && (
        <SearchBar
          query={query}
          onQueryChange={(newQuery) => handleQueryChange(newQuery, setQuery)}
          onClear={() => handleClear(clearSearch)}
          placeholder={placeholder}
          suggestions={suggestions}
          onSuggestionSelect={(suggestion) =>
            handleSuggestionSelect(suggestion, setQuery)
          }
          className="global-search-bar"
          isResultsVisible={showResults}
        />
      )}

      <SearchResults
        // Pass query management props for mobile
        query={query}
        onQueryChange={setQuery}
        onClear={() => clearSearch()}
        // Pass search context for mobile display
        searchContext={{
          name: currentChannelName,
          type: 'channel',
        }}
        // Existing props
        results={results}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onNavigate={handleNavigate}
        highlightTerms={highlightTerms}
        onClose={isTouch ? onClose : handleCloseResults}
        className="global-search-results"
        isOpen={showResults}
      />
    </Container>
  );
};
```

**Key Points**:
- Desktop: SearchBar renders in Channel header, results dropdown below
- Mobile: SearchBar is hidden, SearchResults contains full search UI in bottom sheet
- State controlled by Channel.tsx on mobile via `isOpen`/`onClose` props

##### Step 3: Update SearchResults.tsx - Integrate Search Input on Mobile

**File**: `src/components/search/SearchResults.tsx`

**Changes**:
```tsx
import { isTouchDevice } from '../../utils/platform';
import { ResponsivePanel } from '../ui/ResponsivePanel';
import { Input, Button, Text } from '../primitives';

interface SearchResultsProps {
  // ... existing props
  query: string;              // Add: For mobile input
  onQueryChange: (q: string) => void;  // Add: For mobile input
  onClear: () => void;        // Add: For mobile clear
  searchContext?: {           // Add: Display context on mobile
    name: string;
    type: 'channel' | 'space';
  };
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  // ... existing props
  query,
  onQueryChange,
  onClear,
  searchContext,
}) => {
  const isTouch = isTouchDevice();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when bottom sheet opens on mobile
  useEffect(() => {
    if (isTouch && isOpen && inputRef.current) {
      // Delay to allow bottom sheet animation to complete
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, isTouch]);

  return (
    <DropdownPanel
      isOpen={isOpen}
      onClose={onClose}
      position="absolute"
      positionStyle="right-aligned"
      maxWidth={500}
      maxHeight={maxHeight}
      title={searchContext ? t`Search ${searchContext.name}` : t`Search Messages`}
      className={`search-results ${className || ''}`}
      showCloseButton={true}
      // useMobileBottomSheet defaults to true - bottom sheet on touch devices
    >
      {/* Mobile: Search input at top of bottom sheet */}
      {isTouch && (
        <div className="search-mobile-header">
          <div className="search-input-container">
            <Input
              ref={inputRef}
              type="search"
              placeholder={t`Search messages...`}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="search-mobile-input"
              autoComplete="off"
            />
            {query && (
              <Button
                type="subtle"
                size="small"
                onClick={onClear}
                iconName="times"
                iconOnly
                className="search-clear-btn"
              />
            )}
          </div>
          {searchContext && (
            <Text variant="subtle" size="sm" className="search-context-text">
              {searchContext.type === 'channel'
                ? t`Searching in #${searchContext.name}`
                : t`Searching in ${searchContext.name}`}
            </Text>
          )}
        </div>
      )}

      {/* Results list (same for both desktop and mobile) */}
      <Container className="search-results-list">
        {isLoading && <LoadingState />}
        {isError && <ErrorState error={error} />}
        {!isLoading && !isError && results.length === 0 && (
          <EmptyState query={query} />
        )}
        {!isLoading && !isError && results.length > 0 && (
          <VirtualList results={results} onNavigate={onNavigate} />
        )}
      </Container>
    </DropdownPanel>
  );
};
```

**Key Features**:
- Mobile search input auto-focuses when bottom sheet opens
- Context display shows which channel/space is being searched
- Clear button appears when query is not empty
- Desktop behavior unchanged (no search input in results panel)

##### Step 4: Update Prop Types

**File**: `src/components/search/GlobalSearch.tsx`

**Add Interface**:
```tsx
interface GlobalSearchProps {
  className?: string;
  isOpen?: boolean;      // Mobile: controlled by Channel.tsx
  onClose?: () => void;  // Mobile: controlled by Channel.tsx
}
```

##### Step 5: Update Channel.tsx State Management

**File**: `src/components/space/Channel.tsx`

**Ensure Unified State**:
```tsx
// From Phase 1
type ActivePanel = 'pinned' | 'notifications' | 'search' | null;
const [activePanel, setActivePanel] = useState<ActivePanel>(null);

// Pass to GlobalSearch on mobile
<GlobalSearch
  className="channel-search ml-2"
  isOpen={activePanel === 'search'}
  onClose={() => setActivePanel(null)}
/>
```

**Integration with Phase 1**:
- Search uses same `activePanel` state as PinnedMessages and Notifications
- Opening search automatically closes other panels
- Mutual exclusion works seamlessly

#### 2.5. Add Mobile-Specific Styling

**File**: `src/components/search/SearchResults.scss` (or create new section)

```scss
// Mobile search header - sticky at top of bottom sheet
.search-mobile-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: var(--surface-0);
  border-bottom: 1px solid var(--surface-3);
  padding: 12px 16px 16px 16px;

  // Keyboard avoidance - leverages CSS solution from MessageComposer
  // Safe area handling for devices with bottom bars/notches
  // Note: Bottom sheet already handles this, but included for consistency
  margin-bottom: env(safe-area-inset-bottom, 0);
}

.search-input-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background-color: var(--surface-2);
  border-radius: 8px;
  border: 1px solid var(--surface-4);
  transition: border-color 0.2s ease;

  &:focus-within {
    border-color: var(--accent);
  }
}

.search-mobile-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  // Prevent iOS zoom on focus - matches MessageComposer approach
  font-size: 16px;
  color: var(--color-text-main);

  &::placeholder {
    color: var(--color-text-subtle);
  }
}

.search-clear-btn {
  flex-shrink: 0;
  color: var(--color-text-muted);

  &:hover {
    color: var(--color-text-main);
  }
}

.search-context-text {
  display: block;
  margin-top: 8px;
  padding: 0 4px;
}

// Results list adjustments for mobile
.search-results-list {
  // On mobile, let MobileDrawer handle scrolling
  @media (max-width: 768px) {
    max-height: none;
    overflow-y: visible;
    // Safe area handling for bottom sheet content
    // Matches MessageComposer and MobileDrawer patterns
    padding-bottom: calc(8px + env(safe-area-inset-bottom, 0));
  }
}

// Ensure results are touch-optimized
@media (max-width: 768px) {
  .search-result-item {
    // Larger touch targets (minimum 44px height per mobile guidelines)
    min-height: 44px;
    padding: 12px 16px;

    // More spacing between items for easier tapping
    &:not(:last-child) {
      border-bottom: 1px solid var(--surface-3);
    }
  }
}
```

**Keyboard Avoidance Strategy**:
- Uses `env(safe-area-inset-bottom)` CSS variable (same as MessageComposer.scss:53)
- MobileDrawer.scss:15 already applies `padding-bottom: calc(8px + env(safe-area-inset-bottom))`
- Search input uses `font-size: 16px` to prevent iOS auto-zoom (matches MessageComposer.scss:18)
- No JavaScript needed - pure CSS solution

**Reference Files**:
- `src/components/message/MessageComposer.scss:53` - Safe area implementation
- `src/components/ui/MobileDrawer.scss:15` - Bottom sheet safe area

#### 2.6. Update IconPicker (Edge Case - Opt Out of Mobile Bottom Sheet)

**File**: `src/components/space/IconPicker/IconPicker.web.tsx`

**Why**: IconPicker should stay as a compact dropdown on mobile, not a full-screen bottom sheet. It's a quick selection UI that works better as a dropdown.

**Changes**:
```tsx
// Line 116 - Add useMobileBottomSheet={false} prop
<DropdownPanel
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  position="fixed"
  maxWidth={320}
  maxHeight={340}
  showCloseButton={false}
  useMobileBottomSheet={false}  // NEW: Stay as dropdown on mobile
  style={{
    top: `${dropdownPosition.top}px`,
    left: `${dropdownPosition.left}px`,
    zIndex: 15000,
    backgroundColor: 'var(--color-bg-sidebar)',
  }}
>
  {/* Icon grid - unchanged */}
</DropdownPanel>
```

**Rationale**:
- Icon selection is quick (1-2 taps)
- Grid layout works well in compact dropdown
- Full-screen bottom sheet would be overkill
- Demonstrates opt-out flexibility of the enhanced DropdownPanel

**Files to Modify**:
- `src/components/ui/DropdownPanel.tsx` (enhance for mobile support)
- `src/components/search/SearchResults.tsx` (add mobile search input)
- `src/components/search/SearchResults.scss` (add mobile styles)
- `src/components/search/GlobalSearch.tsx` (mobile conditional logic)
- `src/components/space/Channel.tsx` (add search icon for mobile)
- `src/components/space/IconPicker/IconPicker.web.tsx` (opt-out of bottom sheet)

**Files with No Changes Required**:
- `src/components/message/PinnedMessagesPanel.tsx` ✅ (automatic mobile support)
- `src/components/notifications/NotificationPanel.tsx` ✅ (automatic mobile support)

**Testing (Mobile/Touch Devices)**:

*Search Activation*:
- [ ] Search icon appears on mobile (< 768px width)
- [ ] Search icon has same style as users/bell icons
- [ ] Tapping search icon opens bottom sheet
- [ ] Bottom sheet slides up smoothly from bottom
- [ ] Search input appears at top of bottom sheet
- [ ] Search input auto-focuses when sheet opens

*Search Input Functionality*:
- [ ] Typing in search input updates results real-time
- [ ] Search debouncing works (not searching on every keystroke)
- [ ] Clear button appears when query is not empty
- [ ] Clear button removes query and refocuses input
- [ ] Virtual keyboard appears when input is focused
- [ ] Virtual keyboard doesn't cover search input (safe area handling)
- [ ] Search context text displays correctly ("Searching in #channel-name")
- [ ] Font size is 16px (prevents iOS auto-zoom)

*Search Results Navigation*:
- [ ] Results list scrolls properly within bottom sheet
- [ ] Tapping a result closes the bottom sheet
- [ ] Navigation to selected message works correctly
- [ ] Highlight animation appears on selected message
- [ ] Loading state displays properly
- [ ] Error state displays properly
- [ ] Empty state displays with helpful message

*Bottom Sheet Behavior*:
- [ ] Swipe down closes the search bottom sheet
- [ ] Close button (X) closes the bottom sheet
- [ ] Back button (Android) closes the bottom sheet
- [ ] Tapping backdrop/outside closes the bottom sheet
- [ ] Bottom sheet respects safe-area-inset-bottom (notches/home indicator)

*Panel Mutual Exclusion*:
- [ ] Opening search closes PinnedMessages if open
- [ ] Opening search closes Notifications if open
- [ ] Opening PinnedMessages closes search if open
- [ ] Opening Notifications closes search if open
- [ ] Only one panel can be open at a time

*Touch-Optimized UI*:
- [ ] Result items have minimum 44px height (touch targets)
- [ ] Adequate spacing between result items
- [ ] No hover-only features (all actions accessible on touch)
- [ ] Tap targets are easily hittable

*Edge Cases*:
- [ ] Orientation change (portrait ↔ landscape) maintains state
- [ ] Keyboard appearing/dismissing doesn't break layout
- [ ] Very long results list scrolls properly
- [ ] Rapidly opening/closing sheet doesn't cause issues
- [ ] Low-end device performance is acceptable
- [ ] Sheet behavior with system gestures (iOS Control Center, etc.)

**Testing (Desktop/Non-Touch)**:
- [ ] Search bar still appears inline in Channel header
- [ ] Search icon does NOT appear (inline search bar shows instead)
- [ ] GlobalSearch behavior unchanged from Phase 1
- [ ] Results still appear as dropdown below search bar
- [ ] All Phase 1 functionality preserved (no regressions)
- [ ] Keyboard shortcuts still work (Cmd/Ctrl+F, arrow keys, etc.)
- [ ] Dropdown positioning correct relative to search bar

**Cross-Platform Testing**:
- [ ] Platform detection (`isTouchDevice()`) works correctly
- [ ] Hybrid devices (iPad with keyboard, Surface) work reasonably
- [ ] No console errors or warnings
- [ ] No performance regressions
- [ ] Accessibility features work (screen readers, keyboard navigation)

---

## Architecture Decisions

### ✅ What We're Doing

1. **Unified state management** - Single source of truth for active panel in Channel.tsx
2. **Enhanced DropdownPanel** - Platform detection built into the component itself (follows primitives pattern)
3. **Zero migration for simple panels** - PinnedMessages and Notifications get mobile support automatically
4. **Opt-out flexibility** - IconPicker can disable bottom sheet with single prop
5. **Keep content components independent** - Don't unify PinnedMessages/Notifications/Search content

### ❌ What We're NOT Doing (Avoiding Over-Engineering)

1. **No wrapper component (ResponsivePanel)** - Enhancement at the right layer (DropdownPanel itself)
2. **No ContentDropdownPanel wrapper** - Panels have different content/behavior
3. **No forced unification of panel internals** - Each has legitimate differences
4. **No unnecessary abstraction layers** - Keep it simple and maintainable
5. **No changing working desktop behavior** - Only enhance for mobile

### Why Enhance DropdownPanel Instead of Creating ResponsivePanel?

**Decision**: Enhance DropdownPanel directly with `useMobileBottomSheet` prop

**Rationale**:
1. **Follows project patterns** - Modal, Input, Button all handle platform differences internally
2. **Zero migration effort** - Existing usages automatically get mobile support
3. **Simpler architecture** - One component instead of wrapper + two implementations
4. **Clearer semantics** - "DropdownPanel" describes purpose, not implementation
5. **Easy edge cases** - IconPicker opts out with one prop, not different component
6. **Less cognitive load** - Developers work with familiar DropdownPanel component

**Alternative Rejected**: Creating ResponsivePanel wrapper
- Would require changing all usages (`<DropdownPanel>` → `<ResponsivePanel>`)
- Adds unnecessary abstraction layer
- Creates naming confusion (what's the difference?)
- Makes edge cases more complex (different component vs simple prop)

---

## Implementation Order

### Phase 1 (Desktop Bug Fix) - Est. 2-4 hours
1. Update Channel.tsx state management (add `activePanel` state)
2. Update panel components to use unified state
3. Update GlobalSearch to accept `isOpen`/`onClose` props (prep for Phase 2)
4. Remove z-index override from PinnedMessagesPanel.scss
5. Test mutual exclusion on desktop
6. (Optional) Extract shared constants

**Verification**: Run desktop tests, ensure no regressions

### Phase 2 (Mobile Enhancement) - Est. 6-10 hours

**Sub-phase 2.1**: Enhance DropdownPanel (1-2 hours)
1. Add `useMobileBottomSheet` prop to DropdownPanelProps interface
2. Add imports: `isTouchDevice` and `MobileDrawer`
3. Add platform detection and conditional rendering logic
4. Test DropdownPanel switches correctly (desktop dropdown, mobile bottom sheet)
5. Verify PinnedMessagesPanel and NotificationPanel work automatically on mobile

**Sub-phase 2.2**: IconPicker Opt-Out (15 minutes)
1. Update IconPicker.web.tsx - add `useMobileBottomSheet={false}` prop
2. Test IconPicker stays as dropdown on mobile

**Sub-phase 2.3**: SearchResults Complex Integration (4-6 hours)
1. Update Channel.tsx - add search icon for mobile (conditional render)
2. Update GlobalSearch.tsx - hide SearchBar on mobile, add platform detection
3. Update SearchResults.tsx - add mobile search input header
4. Add SearchResults prop interfaces (query, onQueryChange, searchContext, etc.)
5. Wire up state between Channel → GlobalSearch → SearchResults
6. Test search flow end-to-end on mobile

**Sub-phase 2.4**: Styling & Polish (2-3 hours)
1. Add mobile-specific styles for search header
2. Optimize result items for touch (44px min-height, spacing)
3. Verify keyboard avoidance (safe-area-inset-bottom)
4. Test animations and transitions
5. Cross-browser/device testing

**Final Verification**:
- Run full test checklist (mobile + desktop)
- Performance testing on low-end devices
- Accessibility audit
- Code review and cleanup

---

## Files Reference

### Phase 1
- `src/components/space/Channel.tsx` (lines 94-95, 535-594)
- `src/components/search/GlobalSearch.tsx`
- `src/components/message/PinnedMessagesPanel.scss` (line 5)
- Optional: `src/constants/ui.ts` (new)

### Phase 2
- `src/components/ui/DropdownPanel.tsx` (enhance with mobile support)
- `src/components/search/SearchResults.tsx` (add mobile search input)
- `src/components/search/SearchResults.scss` (add mobile styles)
- `src/components/search/GlobalSearch.tsx` (mobile conditional logic)
- `src/components/space/Channel.tsx` (add search icon for mobile)
- `src/components/space/IconPicker/IconPicker.web.tsx` (opt-out of bottom sheet)

### Utilities Used
- `src/utils/platform.ts` - `isTouchDevice()` function (line 83)
- `src/components/ui/MobileDrawer.tsx` - Bottom sheet component
- `src/components/ui/DropdownPanel.tsx` - Desktop dropdown component

---

## Success Criteria

### Phase 1
- ✅ Only one panel can be open at a time (desktop)
- ✅ No z-index stacking issues
- ✅ Clean, maintainable code
- ✅ All existing functionality preserved

### Phase 2
- ✅ Touch devices use bottom sheet pattern
- ✅ Desktop devices continue using dropdown pattern
- ✅ Search works properly with input in bottom sheet
- ✅ Smooth animations and gestures
- ✅ No regressions in functionality
- ✅ Consistent behavior across all three panels

---

## Potential Issues & Mitigations

### High-Risk Areas

#### 1. State Synchronization Between Components
**Risk**: Query state could desync between Channel, GlobalSearch, and SearchResults

**Mitigation**:
- Use single source of truth via unified `activePanel` state
- Props flow one-way: Channel → GlobalSearch → SearchResults
- Avoid duplicate state in multiple components
- Test state updates thoroughly

#### 2. Focus Management on Mobile
**Risk**: Search input focus issues with virtual keyboard

**Mitigation**:
- Use `useRef` for input element
- Delay auto-focus by 300ms to allow animation to complete
- Test on actual iOS and Android devices
- Handle focus restoration when keyboard dismisses

#### 3. Platform Detection Edge Cases
**Risk**: `isTouchDevice()` may not be 100% accurate on hybrid devices

**Current Implementation** (`src/utils/platform.ts:83`):
```typescript
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}
```

**Known Limitations**:
- Surface devices with touch + keyboard may register as touch
- iPad with Magic Keyboard may register as touch
- Desktop with touchscreen may register as touch

**Mitigation**:
- Accept that both UX modes (desktop/mobile) should work well
- Consider future enhancement: user preference toggle
- Ensure desktop dropdown is usable on hybrid devices
- Ensure mobile bottom sheet works with external keyboards

#### 4. Performance with Large Result Lists
**Risk**: Bottom sheet animation janky with 100+ results

**Mitigation**:
- Profile on mid-range Android devices
- Consider pagination (load more on scroll)
- Optimize React re-renders (memo, useCallback)
- Test with 200+ results

#### 5. Virtual Keyboard Covering Content
**Risk**: Keyboard hides search results or input

**Mitigation** (Already Implemented):
- Use `env(safe-area-inset-bottom)` CSS variable
- MobileDrawer already handles this (line 15)
- Search input uses 16px font to prevent iOS auto-zoom
- Test on iPhone with notch, Android with gesture navigation

### Medium-Risk Areas

#### 6. Animation Conflicts
**Risk**: Slide-up animation conflicts with keyboard animation

**Mitigation**:
- Delay input focus until bottom sheet animation completes (300ms)
- Use `transition: none` during drag (MobileDrawer.scss:22)
- Test rapidly opening/closing sheet

#### 7. Accessibility on Mobile
**Risk**: Screen readers don't announce search state changes

**Mitigation**:
- Add ARIA live regions for result count
- Ensure focus trap in bottom sheet
- Test with VoiceOver (iOS) and TalkBack (Android)
- Support external keyboard navigation

## Notes

- **Architecture decision**: Enhanced DropdownPanel directly instead of creating ResponsivePanel wrapper
  - **Why**: Follows primitives pattern, zero migration effort, simpler architecture
  - **Result**: PinnedMessages and Notifications get mobile support automatically
- **Feature-analyzer recommendation**: Phase 1 approach is pragmatic, Phase 2 adds real value for mobile without over-engineering
- **Complexity justified**: SearchResults IS different from other panels - needs integrated search input on mobile
- **Not over-engineered**: Enhancing DropdownPanel is the right abstraction level, complexity is inherent to the feature
- **Keyboard avoidance**: CSS-only solution using `env(safe-area-inset-bottom)` (matches MessageComposer pattern)
- **isTouchDevice()**: Already available in `src/utils/platform.ts:83`
- **MobileDrawer**: Already implemented with swipe gestures and animations
- **SearchResults special case**: Needs search input at top of bottom sheet on mobile
- **IconPicker edge case**: Stays as dropdown on mobile via `useMobileBottomSheet={false}` prop
- **Z-index cleanup**: Remove `!important` override - it's a code smell
- **Total estimated effort**: 8-14 hours (Phase 1: 2-4h, Phase 2: 6-10h)
  - Reduced from original 10-16h due to simpler DropdownPanel enhancement approach

---

## Related Documentation

- `.agents/docs/features/touch-long-press-system.md` - Touch interaction patterns
- `.agents/docs/cross-platform-components-guide.md` - Cross-platform development guide
- `.agents/docs/component-management-guide.md` - Component architecture

---

_Task created: 2025-10-11_
_Last updated: 2025-10-11 (Improved with feature-analyzer recommendations + simplified architecture)_
