---
type: task
title: Bookmarks page in NavRail
status: done
created: 2026-06-04
---

# Bookmarks page in NavRail

Add a dedicated Bookmarks page reachable from a new NavRail item. The existing `BookmarksPanel` (chat-header dropdown) stays as-is.

## Why

The dropdown panel is great for "I want to peek at a bookmark while I'm in a conversation", but there's no surface for "show me everything I've saved across the whole app". A full page also gives us room for text search, which the panel doesn't have.

## Scope

In:
- New NavRail item `Bookmarks` (icon `bookmark`), route `/bookmarks`
- New `BookmarksPage` component with search + source-type filter
- Route registration in `Router.web.tsx`
- Sidebar mode `hidden` for `/bookmarks` (full-width main area, NavRail stays)

Out:
- Touching `BookmarksPanel` (kept as-is)
- New filter dimensions beyond DM/Space/All
- Schema or sync changes
- Thread-level drilldown

## Reference points

- NavRail: [src/components/shell/NavRail.tsx](../../src/components/shell/NavRail.tsx) — already has a `TODO: FAVORITES section` comment in the same slot
- Routing: [src/components/Router/Router.web.tsx](../../src/components/Router/Router.web.tsx) — Discover route is the closest model (no `:id` params)
- Sidebar mode: [src/components/shell/useSidebarMode.ts](../../src/components/shell/useSidebarMode.ts)
- Search + filter layout: [src/components/discover-page/DiscoverTab.tsx](../../src/components/discover-page/DiscoverTab.tsx)
- Bookmark hook: [src/hooks/business/bookmarks/useBookmarks.ts](../../src/hooks/business/bookmarks/useBookmarks.ts) — already exposes `filterBySourceType('all' | 'channel' | 'dm')`
- Item rendering: [src/components/bookmarks/BookmarkItem.tsx](../../src/components/bookmarks/BookmarkItem.tsx) — reused as-is
- Feature doc: [.agents/docs/features/messages/bookmarks.md](../docs/features/messages/bookmarks.md)

## Steps

- [x] NavRail: add `bookmarks` rail item between `spaces` and `discover`, update `activeId` regex, update `onItemClick` (plain `navigate('/bookmarks')`, no sessionStorage)
- [x] `useSidebarMode.ts`: return `'hidden'` for `/bookmarks`
- [x] `Router.web.tsx`: add `/bookmarks` route mirroring the Discover route shape (ModalProvider → MobileProvider → SidebarProvider → Layout → BookmarksPage)
- [x] New file `src/components/bookmarks/BookmarksPage.tsx`:
  - Pull `userAddress` from `usePasskeysContext`
  - Use `useBookmarks({ userAddress })`
  - Local state: `search: string`, `sourceFilter: 'all' | 'channel' | 'dm'`
  - Header: search `Input` + filter `Select` side by side (DiscoverTab layout)
  - Filtered list = `filterBySourceType(sourceFilter)` then client-side text-search over `cachedPreview.senderName + textSnippet + sourceName` (case-insensitive)
  - Virtuoso list of `BookmarkItem`, reusing the same handlers as `BookmarksPanel` (jump-to-message via hash, remove)
  - Empty / loading / error states matching the panel
  - PhoneHeader pattern from `DiscoverPage` for the drawer trigger
- [x] Export `BookmarksPage` from `src/components/bookmarks/index.ts`
- [x] `BookmarksPage.scss` minimal styling (page chrome + header row); extend the existing `.bookmarks-panel` selectors to also scope under `.bookmarks-page` for item styles

## Verification

- [x] `npx tsc --noEmit --jsx react-jsx --skipLibCheck` passes (only pre-existing unrelated error in `ImportKeyStep.tsx`)
- [x] `eslint` passes on changed files
- [ ] Manual: NavRail shows Bookmarks item, clicking navigates to `/bookmarks`, page lists bookmarks, search filters, source filter filters, Jump button navigates and highlights the message, Remove deletes — **needs user verification**
- [ ] Phone viewport: drawer trigger visible, NavRail behaves correctly when re-entering from drawer — **needs user verification**

---

*Last updated: 2026-06-04*
