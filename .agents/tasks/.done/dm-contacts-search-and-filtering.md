# DM Contacts Search and Filtering Feature

> **AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Status**: Pending
**Complexity**: Medium
**Created**: 2025-12-29
**Files**:
- `src/components/ui/ListSearchInput.tsx` (new)
- `src/components/space/Channel.tsx:659-693, 1181-1217, 1378-1391` (refactor)
- `src/components/direct/DirectMessageContactsList.tsx:1-243`
- `src/components/direct/DirectMessages.tsx:1-74`

## What & Why

The Direct Messages contact list currently lacks search and filtering capabilities, making it difficult to find specific contacts when the list grows. Users need:
1. **Search contacts** - Filter the list by display name or address
2. **Favorites** - Mark contacts as favorites and filter to show only favorites
3. **Message requests** - Filter out/show "Unknown user" contacts (privacy feature for non-contacts)

This improves UX for users with many conversations by providing quick access to frequent contacts and separating unsolicited messages.

## Context

- **Existing pattern**: Channel.tsx has a user search implementation with minimal Input variant and underline styling (lines 1181-1217)
- **UI Decision**: Search icon in header toggles a search row (progressive disclosure)
- **Filter location**: Dropdown on the same row as search input when search is active
- **Constraints**: Must persist favorites; must detect "unknown user" status
- **Storage decision**: Use `UserConfig.favoriteDMs: string[]` (conversation IDs) - simpler than IndexedDB, already syncs across devices
- **Filter persistence**: Filter resets to "All" when search row closes (simpler UX)

## Design Specification

### Default State
```
┌─────────────────────────────────┐
│ Direct Messages      [🔍] [+]   │
├─────────────────────────────────┤
│ Alice                     2:29PM│
│ ...                             │
└─────────────────────────────────┘
```

### Search Active State
```
┌─────────────────────────────────┐
│ Direct Messages      [🔍] [+]   │  ← 🔍 shows "active" style
├─────────────────────────────────┤
│ 🔍 Search...        [All ▼]     │  ← Search + filter on same row
├─────────────────────────────────┤
│ Alice                     2:29PM│  ← No star - filter tab indicates favorites
│ ...                             │
└─────────────────────────────────┘
```

### Favorites Behavior (No Visual Indicator)
- **No star in list** - keeps UI clean, avoids future badge clutter (Q names, subscriptions, etc.)
- **Filter tab** indicates you're viewing favorites
- **Favorites sort to top** when viewing "All" (subtle hierarchy)
- **Context menu** shows favorite status and toggle action

### Filter Dropdown Options
- **All** - Show all conversations (default)
- **Favorites** - Show only favorited contacts (strict filter)
- **Requests** - Show only "Unknown user" contacts

## Implementation

### Phase 0: Create Reusable ListSearchInput Component

The search input pattern is duplicated 3x in Channel.tsx alone. Before adding a 4th instance, centralize into a reusable component.

- [ ] **Create ListSearchInput component** (`src/components/ui/ListSearchInput.tsx`)
  ```tsx
  // Simplified props - component handles UI only, parent handles "no results" logic
  interface ListSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    variant?: 'underline' | 'bordered';
    className?: string;
    clearable?: boolean; // For bordered variant on mobile
  }
  ```
  - `underline` variant: Icon + minimal input with accent underline on focus (desktop style)
  - `bordered` variant: Bordered input with optional clear button (mobile drawer style)
  - Encapsulates focus state and transitions only
  - Parent components handle "no results" messaging based on their filtered data
  - Done when: Component renders both variants correctly

- [ ] **Refactor Channel.tsx desktop sidebar** (lines 1181-1217)
  - Replace inline search with `<ListSearchInput variant="underline" />`
  - Done when: Desktop sidebar search works identically

- [ ] **Refactor Channel.tsx mobile sidebar** (lines 659-693)
  - Replace inline search with `<ListSearchInput variant="underline" />`
  - Done when: Mobile sidebar search works identically

- [ ] **Refactor Channel.tsx MobileDrawer** (lines 1378-1391)
  - Replace inline search with `<ListSearchInput variant="bordered" />`
  - Done when: Mobile drawer search works identically

- [ ] **Export from ui/index.ts**
  - Add ListSearchInput to barrel export
  - Done when: Can import from `../ui`

### Phase 1: Data Model & Persistence

- [ ] **Add favorites to UserConfig** (`src/api/quorumApi.ts` or types file)
  - Add `favoriteDMs?: string[]` to UserConfig type (array of conversation IDs)
  - Reference: See existing UserConfig structure in `docs/config-sync-system.md`

- [ ] **Create useDMFavorites hook** (`src/hooks/business/dm/useDMFavorites.ts`)
  - Read favorites from UserConfig
  - Provide `toggleFavorite(conversationId: string)` function
  - Provide `isFavorite(conversationId: string)` helper
  - Use existing config save/sync mechanism
  - Done when: Favorites persist across page refreshes and sync across devices

- [ ] **Define "Unknown user" detection**
  ```typescript
  // Unknown user = no profile revealed yet (privacy feature)
  const isUnknownUser = (conversation: Conversation) =>
    conversation.displayName === t`Unknown User` ||
    !conversation.displayName;
  ```
  - These are contacts who messaged us but haven't shared their profile
  - Allows users to filter out unsolicited messages

### Phase 2: UI Components

- [ ] **Update DirectMessageContactsList header** (`src/components/direct/DirectMessageContactsList.tsx`)
  - Add search icon button next to the existing [+] button
  - Add state for `searchOpen: boolean`
  - Toggle search row visibility on icon click
  - Done when: Search icon toggles search row visibility

- [ ] **Create search row component** (`src/components/direct/DirectMessageContactsList.tsx`)
  - Use `<ListSearchInput variant="underline" />` from Phase 0
  - Filter dropdown on the right side of search row
  - Done when: Search input and dropdown render correctly

- [ ] **Implement filter using Select primitive**
  - Use `<Select compactMode compactIcon="filter" />` (same pattern as NotificationPanel, BookmarksPanel)
  - Options: "All", "Favorites", "Requests"
  - State: `filter: 'all' | 'favorites' | 'requests'`
  - Reference: `src/components/notifications/NotificationPanel.tsx:201-211`
  - Done when: Filter dropdown changes filter state

### Phase 3: Filtering Logic

- [ ] **Implement search filtering**
  - Filter by `displayName` (case-insensitive)
  - Filter by `address` (case-insensitive)
  - Debounce search input (200ms) using existing pattern
  - No minimum character threshold (DM lists are typically small)
  - Done when: Typing filters the list in real-time

- [ ] **Implement favorites filtering**
  - When filter is "favorites", show only favorited contacts
  - When filter is "all", sort favorites to top (then by timestamp)
  - Search within favorites when both search and favorites filter are active
  - Done when: Favorites filter shows only favorited contacts

- [ ] **Implement requests filtering**
  - When filter is "requests", show only "Unknown user" contacts
  - Search within requests when both search and requests filter are active
  - Done when: Requests filter shows only unknown users

### Phase 4: Context Menu Integration

- [ ] **Add favorite toggle to context menu** (`src/components/direct/DirectMessageContactsList.tsx:136-163`)
  - Add "Add to Favorites" / "Remove from Favorites" menu item
  - Toggle favorite status on click
  - Done when: Context menu allows toggling favorites
  - Reference: Existing context menu pattern at lines 136-163

## Verification

**Search works**
- Type in search field, list filters by name/address
- Clear search, full list returns

**Favorites work**
- Right-click contact → "Add to Favorites"
- In "All" view, favorites sort to top
- Filter to "Favorites" → only favorited contacts shown
- Search within favorites works

**Requests work**
- Filter to "Requests" → only "Unknown user" contacts shown
- Search within requests works

**Progressive disclosure**
- Click search icon → search row appears
- Click again (or X) → search row hides
- Filter resets to "All" when search row closes

**TypeScript compiles**
- Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

## Definition of Done

- [ ] ListSearchInput component created and exported
- [ ] Channel.tsx refactored to use ListSearchInput (3 locations)
- [ ] Search icon toggles search row visibility
- [ ] Search filters by display name and address
- [ ] Filter dropdown with All/Favorites/Requests options
- [ ] Favorites can be toggled via context menu
- [ ] Favorites persist via UserConfig (syncs across devices)
- [ ] Favorites sort to top in "All" view (no visual star indicator)
- [ ] Unknown users can be filtered as "Requests"
- [ ] Filter resets to "All" when search closes
- [ ] TypeScript passes
- [ ] Manual testing successful
- [ ] No console errors

## Related Documentation

- [DM Conversation List Previews](../docs/features/messages/dm-conversation-list-previews.md)
- [Users List Filtering Feature](../tasks/.done/users-list-filtering-feature.md) - Similar filtering pattern in Channel.tsx
- [Config Sync System](../docs/config-sync-system.md) - For UserConfig storage pattern

---

_Created: 2025-12-29_
_Updated: 2025-12-29 - Added Phase 0 for ListSearchInput component centralization_
_Updated: 2025-12-29 - Applied feature-analyzer recommendations: simplified ListSearchInput props, changed storage from IndexedDB to UserConfig, defined "Unknown user" detection, clarified filter persistence_
_Updated: 2025-12-29 - Removed star indicator to keep UI clean; favorites now sort to top instead (avoids future badge clutter for Q names, subscriptions, etc.)_
_Updated: 2025-12-29 - Use Select primitive with compactMode for filter (consistent with NotificationPanel, BookmarksPanel)_
