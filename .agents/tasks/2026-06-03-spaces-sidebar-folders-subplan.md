# SpacesSidebar — Folders + DnD (sub-plan)

Sub-plan for step 7+8 of [2026-06-03-spaces-sidebar-polish-plan.md](./2026-06-03-spaces-sidebar-polish-plan.md). Forks the old NavMenu's `FolderContainer` so nested rows match the new two-line `SpacesSidebarRow` format, while reusing every hook from the old DnD stack verbatim.

---

## Reuse vs fork

**Reuse verbatim:**
- `useFolderDragAndDrop` — drop intent detection, 9 scenarios, action queue persistence
- `useNavItems` — ordered nav items + flat allSpaces
- `useFolderStates` — localStorage-backed expand/collapse
- `DragStateContext` / `DragStateProvider` — visual-feedback state (wiggle, drop indicators, tooltip suppression)
- `useSpaceContextMenu` — already used for top-level rows; folders also need it for nested rows
- `FolderButton` — colored folder tile (no DnD deps, presentational)
- `useSpaces`, `useConfig` — already wired

**Fork:**
- `FolderContainer` → new `SpacesSidebarFolder.tsx`. Same DnD wiring, same expand/collapse animation, but renders `<SpacesSidebarRow>` for nested space rows instead of `<SpaceButton>` (icon tile).

**Extend:**
- `SpacesSidebarRow` — add `useSortable` so the row participates in DnD. New optional `parentFolderId` prop. Drop-indicator visuals (`showDropBefore` / `showDropAfter` via `useDragStateContext`).

**New CSS classes:**
- `.spaces-sidebar__row--drop-target` — wiggle when this row is the merge target
- `.spaces-sidebar__row--dragging` — opacity/pointer-events while dragging
- Drop indicator bars (above/below row) — accent bar 12×1px, same visual language as the old NavMenu

---

## Build order

Order matters — each step ends with a working app:

1. **Make `SpacesSidebarRow` sortable.** Add `useSortable({ id: space.id, data: { type: 'space', parentFolderId } })` to the row. Wire `setNodeRef`, `attributes`, `listeners`, plus `isDragging` styling. NO DnD context above yet → `useSortable` is a no-op without it. Verify: rows still render normally, no regressions.

2. **Add drop-indicator rendering inside `SpacesSidebarRow`.** Read `dropTarget` + `activeItem` from `useDragStateContext` (already try/catch-safe per the existing `SpaceIcon` pattern). When `dropTarget.id === space.id`, render the bar above (`reorder-before`) or below (`reorder-after`), or apply the merge class (`merge`). Still no context above → degrades silently. Verify: no regressions.

3. **Create `SpacesSidebarFolder.tsx`.** Copy `FolderContainer.tsx` whole, swap `<SpaceButton>` → `<SpacesSidebarRow>`. Keep all the dnd-kit `useSortable` wiring, expand/collapse animation, long-press handler, drop-target visuals. Adapt the nested space render loop to pass through `isMuted`, `isFavorite`, unread, mute set, etc. (parent needs to pass these as props or via context — see step 5). Verify: file compiles, lints clean.

4. **Mount the provider stack in `SpacesSidebar`.** Wrap the list region in `<DragStateProvider><DndContext sensors={sensors} onDragStart={...} onDragMove={...} onDragEnd={...}><SortableContext items={sortableIds}>...</SortableContext><DragOverlay>...</DragOverlay></DndContext></DragStateProvider>`. Sortable IDs come from `deriveSpaceIds(config.items)` (already exported by `folderUtils`). Verify: existing rows still render and are clickable; no DnD yet.

5. **Switch the render loop to `navItems`.** Call `useNavItems(spaces, config)` and `useFolderStates()`. Iterate `navItems`: if `item.type === 'folder'`, render `<SpacesSidebarFolder>`; if `'space'`, render `<SpacesSidebarRow>`. Pass `mutedSpacesSet`, `favoriteSpacesSet`, `spaceUnreadCounts`, `openRowContextMenu` down to both. **Filter handling:** when the search filter chip is on ("All" filter), render the folder tree as-is; when it's "Muted" or "Favorites", flatten to a filtered top-level list (folders don't make sense in a filtered view). Verify: folders render via `FolderButton`, expand/collapse works, top-level rows still right-clickable.

6. **Wire DnD live.** Plug `handleDragStart` / `handleDragMove` / `handleDragEnd` from `useFolderDragAndDrop({ config, onFolderCreated })` into `DndContext`. Pass `sensors` too. `DragOverlay` renders a clone of the dragging row (use `activeItem` from `DragStateContext` to know what to clone). Gate mock-space drags so they don't write to the user config (`if (id.startsWith('mock-')) return`). Verify all 9 scenarios:
   - SPACE_TO_SPACE (creates folder from 2 standalone spaces)
   - SPACE_TO_FOLDER (drop on folder header)
   - SPACE_TO_FOLDER_SPACE (drop on a row inside a folder)
   - FOLDER_SPACE_TO_FOLDER (move from folder A to folder B)
   - FOLDER_SPACE_TO_SPACE (create folder from folder-space + standalone)
   - SPACE_OUT_OF_FOLDER (drop outside any folder)
   - FOLDER_REORDER (reorder folders in list)
   - SPACE_REORDER_STANDALONE (reorder standalone spaces)
   - SPACE_REORDER_IN_FOLDER (reorder spaces within a folder)

7. **Collapsed strip.** Make the 72px strip rows sortable too. Either reuse `SpacesSidebarRow` with a `compact` mode prop, or build a slim `SpacesSidebarStripRow`. The hooks (DnD provider stack) sit above the conditional render of expanded vs collapsed, so both branches share state. Verify: drag/reorder works in the strip; folders show their colored tile.

8. **Polish + verify.** Touch long-press (existing `SpaceButton` pattern — `LONG_PRESS_DELAY`). Empty-folder auto-cleanup (`useNavItems` already filters empty folders). Auto-expand folder on hover-during-drag (existing in `useFolderDragAndDrop` — verify it fires). Visual states across light + dark.

---

## Files touched

**Primary:**
- [SpacesSidebar.tsx](../../src/components/shell/SpacesSidebar.tsx) — provider stack, navItems-driven render
- [SpacesSidebarRow.tsx](../../src/components/shell/SpacesSidebarRow.tsx) — sortable, drop indicators
- `src/components/shell/SpacesSidebarFolder.tsx` — **new**, fork of `FolderContainer`
- [SpacesSidebar.scss](../../src/components/shell/SpacesSidebar.scss) — drop-indicator rules, dragging state

**Reused (no edits):**
- `useFolderDragAndDrop`, `useNavItems`, `useFolderStates`
- `DragStateContext`, `FolderButton`
- `useSortable` from `@dnd-kit/sortable`
- `DndContext`, `DragOverlay`, `SortableContext`, `useSensors`, `PointerSensor` from `@dnd-kit/core`
- `deriveSpaceIds` from `folderUtils`

---

## Risks

- **Drop indicators on full-width rows look different from icon-tile rows.** The old visual was a centered 12×1px accent bar above/below a 72px icon. On a 280px+ wide row that bar feels lonely. May need to widen it (60px? full row width minus padding?). Decide once we see it.
- **Long-press conflict.** `SpacesSidebarRow` doesn't currently have touch-specific handlers. Adding long-press for folder-edit on the folder header is fine (header is `SpacesSidebarFolder`'s concern). Top-level row long-press could open the row context menu on touch — separate concern, defer.
- **Mock spaces + persistence.** Same gate as discussed: short-circuit before writing user config in the drag-end handler.
- **`SpacesSidebarStripRow` complexity.** If the collapsed strip needs many divergent props (no name, no member count, no badges in same form), it might be cleaner to fork rather than add a `compact` mode. Decide in step 7.

---

## Definition of done

- [ ] `SpacesSidebarRow` participates in DnD as both source and drop target
- [ ] `SpacesSidebarFolder` renders folder header (via `FolderButton`) + nested `SpacesSidebarRow` rows
- [ ] All 9 drag scenarios from `useFolderDragAndDrop` work
- [ ] Folder expand/collapse persists in localStorage
- [ ] Drop indicators visible during drag, theme-aware
- [ ] Search filter chip composes correctly (filtered views flatten the folder tree)
- [ ] Collapsed strip supports DnD too
- [ ] Touch long-press opens folder edit
- [ ] Auto-expand collapsed folder when dragging a space over it (existing behavior — verify)
- [ ] Mock spaces drag without writing to user config
- [ ] No regressions on right-click context menu, favorites border, muted badge, owner crown

---

*Last updated: 2026-06-03*
