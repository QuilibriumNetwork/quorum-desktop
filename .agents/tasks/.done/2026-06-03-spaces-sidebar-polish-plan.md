# SpacesSidebar Polish — Implementation Plan (Track D, expanded)

Plan for Track D of [2026-06-03-new-ui-shell-continuation.md](./2026-06-03-new-ui-shell-continuation.md). Upgrades the minimal `SpacesSidebar` shipped with the new shell to feature parity with the old NavMenu, plus four user-requested additions: row right-click context menu, muted-state icon overlay on the avatar, search filter chip (all / muted / favorites), and a favorites system for spaces.

The plan went through one expansion pass — it now bundles eight features into a single PR rather than the original five. Order is chosen so the data-bearing pieces (favorites, mute state) land before the UI surfaces that consume them.

---

## Scope, summary

In:
- Two-line row layout (avatar + name + timestamp slot + member count + unread badge)
- **Muted-state icon overlay on the avatar** (NEW)
- **Right-click context menu on rows** via `useSpaceContextMenu` (NEW — hook already exists)
- **Favorites system** for spaces (`UserConfig.favoriteSpaces` + new `useSpaceFavorites` hook + star toggle in row context menu) (NEW)
- **Search filter chip** in the row (all / muted / favorites) (NEW — mirrors DM filter pattern)
- Hide-muted-spaces toggle (the older idea, kept)
- Folders (via reused `FolderContainer` from `src/components/navbar/`)
- DnD reordering (via reused `useFolderDragAndDrop`)

Out (deferred to follow-up PR):
- Last-message previews. Requires a new `useSpacePreviews` hook similar to `useConversationPreviews` but with a per-space last-message pointer (spaces don't have a `lastMessageId` field today). Row layout reserves space; placeholder `—` ships.

---

## Decisions made up-front

### a) `DragStateProvider` mount location

Inside `SpacesSidebar.tsx`, wrapping the list region. DnD is local to spaces; mounting at AppShell would leak into NavRail, DM sidebar, Main. The provider has zero cost when no drag is active. `SpaceIcon` and `FolderButton` already wrap `useDragStateContext` in try/catch, so they degrade silently outside the provider.

Nesting order (matches old NavMenu):

```tsx
<DragStateProvider>
  <DndContext sensors={sensors} onDragStart={...} onDragMove={...} onDragEnd={...}>
    <SortableContext items={sortableIds}>
      {/* folders + spaces */}
    </SortableContext>
    <DragOverlay>...</DragOverlay>
  </DndContext>
</DragStateProvider>
```

### b) Data flow for per-row data

- **Mute state**: build a `mutedSpacesSet: Set<string>` from `config.notificationSettings` at sidebar level, pass to each row as a derived `isMuted` boolean. Pattern mirrors DM `mutedSet`.
- **Favorites set**: from the new `useSpaceFavorites` hook (see below). Same pattern.
- **Member counts**: per-row `useSpaceMembers({ spaceId })` inside `<Suspense fallback={null}>` so a slow row doesn't block the list. Cheap IndexedDB read.
- **Last-message previews**: punted to follow-up PR. Placeholder `—` ships.

### c) Visual treatment of muted spaces

- **Muted icon overlay**: small circular badge with `bell-off` icon, positioned absolute top-left of the avatar — same `dm-muted-badge` class pattern as DMs. We'll add a `spaces-sidebar__muted-badge` class to `_components.scss` (or generalise the existing `.dm-muted-badge` into a shared `.muted-badge` class).
- **Row opacity** (when not hidden by the `hideMutedSpacesFromSidebar` toggle): `opacity: 0.55` on the entire row. Active state (current route inside the space) overrides → full opacity.
- **Hide-muted toggle**: surfaced as `UserConfig.hideMutedSpacesFromSidebar?: boolean` (default `false`). When `true`, muted spaces are filtered out of the list entirely. UI surface: small filter chip in the sidebar header next to the title (NOT the search filter chip — that's per-session, this is a persisted preference).

### d) Search filter chip semantics

Filter type: `'all' | 'muted' | 'favorites'`. Mirrors DM `FilterType` but drops `'unknown'` (no concept of unknown spaces).

`filterOptions`:
- always: `{ value: 'all', label: t\`All\`, icon: 'users-group' }`
- if `mutedSpacesSet.size > 0`: `{ value: 'muted', label: t\`Muted\`, icon: 'bell-off' }`
- if `favoriteSpacesSet.size > 0`: `{ value: 'favorites', label: t\`Favorites\`, icon: 'star' }`

`hasAnyFilter = mutedSpacesSet.size > 0 || favoriteSpacesSet.size > 0`. Filter Select shown only when `hasAnyFilter`. Lives inside `.sidebar-search-row` to the left of `ListSearchInput`. Reuses the `Select` primitive with `compactMode + compactIcon="filter"`.

### e) Favorites system

New field in `UserConfig`:

```ts
favoriteSpaces?: string[];
```

Must be added in two places:
1. `node_modules/@quilibrium/quorum-shared/src/types/user.ts` (canonical, needs upstream PR)
2. `src/db/messages.ts` local mirror (`// MUST match shared type`)

New hook `src/hooks/business/spaces/useSpaceFavorites.ts`. Near-clone of `useDMFavorites`:

```ts
export function useSpaceFavorites(): {
  favorites: string[];
  favoritesSet: Set<string>;
  isFavorite: (spaceId: string) => boolean;
  addFavorite: (spaceId: string) => Promise<void>;
  removeFavorite: (spaceId: string) => Promise<void>;
  toggleFavorite: (spaceId: string) => Promise<void>;
}
```

Star toggle is surfaced in the row context menu (handled by `useSpaceContextMenu` — we extend that hook with an extra menu item conditional on `useSpaceFavorites`).

### f) Keyboard / touch for folder expand/collapse

- Mouse: click on folder row toggles expand/collapse (existing `FolderContainer` behavior)
- Keyboard: Enter or Space on focused folder row toggles; ArrowDown moves to first child if expanded, else to next sibling
- Touch: tap toggles; long-press opens edit context menu (existing `FolderContainer` behavior)
- Drop target during drag: hovering a collapsed folder for 600ms auto-expands (already in `useFolderDragAndDrop` — verify, don't reimplement)

---

## Build sequence

Order chosen so the data layers land before the UI surfaces that consume them. Each step ends with a working app; nothing is half-baked between steps.

### Step 1 — Data layer: favorites + mute set

- Add `favoriteSpaces?: string[]` to the local mirror in [src/db/messages.ts](../../src/db/messages.ts) (with the `// MUST match shared type` comment), and open a parallel PR upstream in `@quilibrium/quorum-shared` to add it to `src/types/user.ts`. Don't wait for that PR to merge — the local mirror lets the desktop build succeed.
- New hook `src/hooks/business/spaces/useSpaceFavorites.ts`. Copy `useDMFavorites.ts`, swap `favoriteDMs` → `favoriteSpaces`, swap `conversationId` → `spaceId`.
- New hook `src/hooks/business/spaces/useMutedSpacesSet.ts` — reads `config.notificationSettings` and returns a `Set<string>` of muted space IDs. Mirrors the `mutedSet` shape from `useDMMute`.
- Verify: both hooks return correct sets when called from a dev console.

### Step 2 — Row skeleton swap (no behaviour change yet)

- Extract the current inline row JSX in [SpacesSidebar.tsx](../../src/components/shell/SpacesSidebar.tsx) into a new component file `src/components/shell/SpacesSidebarRow.tsx`. SCSS in `SpacesSidebarRow.scss`.
- Wire mock data through. Wire the existing `useSpaceUnreadCounts` overlay through.
- Verify: visual parity with current shipped version, mock toggle still works (`?spaces=30`).

### Step 3 — Two-line row layout + muted icon overlay

- Two-line row: avatar 42px (`$rounded-md`) on the left.
  - Row 1: name (truncate) + timestamp (right-aligned, `text-xs`, muted color, `—` placeholder).
  - Row 2: `users-group` icon + member count + accent unread badge (right-aligned).
- Member count: per-row `useSpaceMembers({ spaceId })` wrapped in `<Suspense fallback={null}>`.
- Muted icon: small circular badge with `bell-off` icon, positioned absolute top-left of the avatar wrapper. Use `mutedSpacesSet` from step 1 to drive `isMuted`.
- Muted row visual: `opacity: 0.55` on row when `isMuted && !isActive`. Active row stays full opacity even when muted.
- Active state via `aria-current="page"`.
- Verify all four visual states (active / hover / muted / default) in light + dark.

### Step 4 — Row right-click context menu

- Import `useSpaceContextMenu` from `src/hooks/business/spaces/useSpaceContextMenu.tsx` into `SpacesSidebar`.
- Call `openContextMenu` from each row's `onContextMenu` handler with `{ spaceId, spaceName, iconUrl, event, hasNotifications: unread > 0 }`.
- Render `{contextMenu}` at the end of `SpacesSidebar`'s JSX tree.
- Extend `useSpaceContextMenu` with a new "Add/Remove Favorites" item using `useSpaceFavorites`. The item is always present (not owner-gated). Item sits above the mute toggle.
- Verify: right-click on a space opens the menu, all items work (mute, unmute, mark-all-read for spaces with unread, settings/invites/roles for owners, leave for non-owners, favorite toggle).

### Step 5 — Search filter chip

- Add `filter` state to `SpacesSidebar` (`'all' | 'muted' | 'favorites'`).
- Build `filterOptions` array as described in decision (d).
- Wrap the existing `<ListSearchInput>` in a `<Flex>` containing the filter `<Select>` to its left (when `hasAnyFilter`). Match the DM pattern.
- Apply the filter when computing `filteredSpaces`:
  - `'all'`: no filter beyond the search query
  - `'muted'`: only spaces where `mutedSpacesSet.has(spaceId)`
  - `'favorites'`: only spaces where `favoriteSpacesSet.has(spaceId)`
- Empty-state message tweaks per filter (`No muted spaces`, `No favorite spaces`, `No spaces found`).
- Verify: each filter narrows the list correctly; filter persists while search input is active.

### Step 6 — Hide-muted persistent toggle

- Add `hideMutedSpacesFromSidebar?: boolean` to the `UserConfig` local mirror and the upstream PR.
- Surface a small filter chip in the sidebar header (NOT the search filter chip — this is the persisted preference). Default `false`. Toggle via the existing action-queue config-save flow.
- When `true`, filter muted spaces out of the rendered list (independent of the search filter chip — they compose).
- Verify: toggle persists across reloads; takes effect immediately; composes correctly with the per-session filter.

### Step 7 — Folder rendering

- Add `useNavItems` + `useFolderStates` calls in `SpacesSidebar`.
- Mount `<DragStateProvider>` wrapping the list region.
- Render `<FolderContainer>` for folder items, `<SpacesSidebarRow>` for space items (top-level + folder children).
- Pass `onSpaceContextMenu` down to `FolderContainer` so right-click works on rows nested inside folders too.
- Verify: folders render with correct expand/collapse, child spaces respect folder state, no folders defined = list looks identical to step 5.

### Step 8 — DnD wiring

- Pull in `useFolderDragAndDrop`, `DndContext`, `SortableContext`, `DragOverlay`.
- Make `SpacesSidebarRow` sortable via `useSortable({ id: space.id })` — match the pattern in `SpaceButton`.
- `DragOverlay` renders a clone of the dragging row.
- Gate DnD persistence behind `!space.id.startsWith('mock-')` so mocks don't write to user config.
- Verify all 9 drag scenarios from `useFolderDragAndDrop` (space-to-space reorder, space-into-folder, space-out-of-folder, folder-reorder, etc.).

### Step 9 — Polish + verify

- Spot-check every visual state with `?spaces=30`, `?spaces=100`, and the real (small) joined list:
  - Active / hover / muted / drop-target rows in light + dark
  - Filter chip with each value (all / muted / favorites)
  - Hide-muted persistent toggle on + off, composed with filter
  - Right-click menu on regular row, owner row, muted row, favorite row
  - Folder expand / collapse persistence across reloads
  - DnD all scenarios
  - Collapsed strip (`sidebarCollapsed === true`) still works
  - Phone drawer still works
- Run `yarn build` to catch SCSS regressions.

### Step 10 (separate PR) — Last-message previews

Build `useSpacePreviews(spaces)` modelled on `useConversationPreviews`. Spaces lack `lastMessageId`, so iterate `useSpaceChannels` and pick the most recent message across channels, batched with `Promise.all`. Key on a `lastActivity` signature derived from `useSpaceUnreadCounts`. Replace the placeholder `—` with `formatRelativeTime(lastMessageAt)`, add the preview line below the member-count row.

---

## Files touched

**Primary:**
- [SpacesSidebar.tsx](../../src/components/shell/SpacesSidebar.tsx) — wraps DragStateProvider + DndContext, adds filter + favorites + muted derivations, replaces inline rows with `<SpacesSidebarRow>` + `<FolderContainer>`
- [SpacesSidebar.scss](../../src/components/shell/SpacesSidebar.scss) — strip old row styles, add header filter-chip styles, hide-muted toggle styles
- `src/components/shell/SpacesSidebarRow.tsx` — **new**, the two-line row with muted-badge wrapper
- `src/components/shell/SpacesSidebarRow.scss` — **new**

**Data layer (new):**
- `src/hooks/business/spaces/useSpaceFavorites.ts` — **new**, clone of `useDMFavorites`
- `src/hooks/business/spaces/useMutedSpacesSet.ts` — **new**, derives `Set<string>` from `config.notificationSettings`

**Modified (small):**
- [useSpaceContextMenu.tsx](../../src/hooks/business/spaces/useSpaceContextMenu.tsx) — add Favorite/Unfavorite item using `useSpaceFavorites`
- [src/db/messages.ts](../../src/db/messages.ts) — add `favoriteSpaces?: string[]` and `hideMutedSpacesFromSidebar?: boolean` to local mirror
- `_components.scss` or new shared file — add `.spaces-sidebar__muted-badge` (or promote `dm-muted-badge` to a shared `.muted-badge` class — preferred)

**Upstream PR (parallel, doesn't block desktop build):**
- `@quilibrium/quorum-shared/src/types/user.ts` — add `favoriteSpaces?: string[]` and `hideMutedSpacesFromSidebar?: boolean`

**Reused (no edits):**
- `FolderContainer`, `FolderButton`, `SpaceButton`'s context-menu pattern, `DragStateContext`, `useFolderDragAndDrop`, `useNavItems`, `useFolderStates`, `useSpaceMembers`, `useChannelMute`, `useSpaceLeaving`

---

## Risks

- **`useSpaceMembers` per-row at 30+ spaces**: 30 IndexedDB reads on first render. Mitigate via row-level Suspense (each loads independently) + React batching. If `?spaces=100` is slow, fall back to an aggregated `useAllSpaceMemberCounts` hook.
- **Shared package PR lag**: `favoriteSpaces` and `hideMutedSpacesFromSidebar` exist in the local mirror first; users on a build pre-shared-PR get the field locally but it won't sync across devices. Acceptable for a few days, not for weeks. Track the shared PR.
- **`DragStateProvider` re-mount on sidebar collapse**: when `sidebarCollapsed` toggles, the rendered output of `SpacesSidebar` changes but the component itself stays mounted. Provider survives. If it doesn't (verify in step 7), move the provider one level up.
- **Mock spaces + DnD persistence**: gated by the `!space.id.startsWith('mock-')` check in step 8.
- **Right-click on phone**: `onContextMenu` doesn't fire on touch. The existing `SpaceButton` uses a long-press handler; we need to replicate that in `SpacesSidebarRow`. Verify in step 4 on a phone breakpoint.

---

## Definition of done

- [ ] Two-line row with avatar + name + timestamp placeholder + member count + unread badge
- [ ] Muted icon overlay on the avatar (top-left badge)
- [ ] Right-click context menu (mute, mark-read, settings/invites/roles for owners, leave for non-owners, favorite toggle)
- [ ] Favorites system: `UserConfig.favoriteSpaces` + `useSpaceFavorites` hook + star toggle in menu + favorites filter
- [ ] Search filter chip works for `all` / `muted` / `favorites`
- [ ] Hide-muted persistent toggle works, persists, defaults `false`, composes with filter chip
- [ ] Folders render via `FolderContainer`, expand/collapse persists in localStorage
- [ ] DnD: all 9 scenarios work (verify against `useFolderDragAndDrop` source comments)
- [ ] Active / hover / muted / drop-target visual states verified in light + dark
- [ ] Collapsed strip + phone drawer unchanged
- [ ] Last-message previews **explicitly punted** to follow-up PR (step 10) with documented scope
- [ ] Upstream shared PR for `favoriteSpaces` + `hideMutedSpacesFromSidebar` is open (not necessarily merged)

---

*Last updated: 2026-06-03*
