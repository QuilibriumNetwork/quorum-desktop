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

---

## Mid-stream design-feedback addendum (2026-06-03, evening session)

A second session received screenshot feedback on the shipped folder UI before steps 7–9 were polished. Changes landed in this branch as uncommitted edits, then handed back so the original session can resume. Summary of what's in the working tree and the rationale:

### What changed

1. **Folder header (expanded sidebar) — centered tile → left-aligned row.** Before: `FolderButton` centered with no name visible. After: left-aligned small `FolderButton` (`size="small"`) + folder name (top) + member icon with space count (bottom), mirroring `SpacesSidebarRow`'s two-line layout. Driven by the screenshot: folder rows now align flush with space rows in the same sidebar.
   - New CSS: `.folder-header--row`, `.folder-header__icon/__meta/__name/__count` in [Folder.scss](../../src/components/navbar/Folder.scss).
   - Old centered layout preserved as `.folder-header--strip` for the collapsed (72px rail) variant.

2. **Folder expanded background — less rounded, more transparent.**
   - Was: `border-radius: $rounded-xl`, `color-mix(..., 25%, transparent)`, `padding: $s-1`.
   - Now (row variant): `border-radius: 0`, `color-mix(..., 12%, transparent)`, no padding.
   - Strip variant keeps the rounded tile but drops to 12% opacity for consistency.

3. **Nested spaces inside expanded folder — alignment matches top-level rows.**
   - `.folder-spaces--row`: `align-items: stretch`, no centering. Nested rows now visually line up exactly like top-level spaces (left edge, name, badge column).
   - `.folder-spaces--strip` keeps the original centered/gap layout for the rail.

4. **Drop-target highlight on rows — jiggle removed.**
   - Was: `.spaces-sidebar__row--drop-target { animation: wiggle ...; outline: 2px solid var(--accent); }` — too aggressive at row scale (looked fine on 72px tiles, wrong on full-width rows). The sub-plan flagged this exact risk: "Drop indicators on full-width rows look different from icon-tile rows."
   - Now: `background-color: color-mix(in srgb, var(--accent) 14%, transparent)` + accent left-bar (`::before` opacity 1). Calmer, theme-aware.

5. **Folder right-click context menu wired into `SpacesSidebar`.** Mirrors the old NavMenu pattern (`Edit Folder` + `Delete Folder` with confirm). State + handlers live in `SpacesSidebarInner`; `ContextMenu` rendered in both expanded and collapsed branches. Uses `useDeleteFolder` from the existing folders hook bundle.

6. **Collapsed strip now renders folders too** (closes step 7's "Collapsed strip" item — partial).
   - Old behavior: collapsed branch iterated a flat `spaces` list, folders were invisible.
   - New behavior: iterates `navItems`. Folder items render via `SpacesSidebarFolder` with a new `collapsed` prop that switches to a centered-tile layout (`folder-header--strip` + `folder-spaces--strip`). Clicking expands inline showing nested space icons.
   - **DnD is NOT wired in the collapsed strip** — matches pre-change behavior. Sub-plan step 7 leaves this open ("Make the 72px strip rows sortable too" — not done).

### Files touched (uncommitted)

- `src/components/shell/SpacesSidebar.tsx` — folder context menu state/handlers, `IconColor`+`NavItem` type imports, `useDeleteFolder`, collapsed branch switched to `navItems` + `SpacesSidebarFolder`, expanded branch passes `onContextMenu` to folders, both branches render the folder `ContextMenu`.
- `src/components/shell/SpacesSidebarFolder.tsx` — `collapsed` prop, conditional strip vs row layout for header and nested rendering, `Tooltip` wrapper for strip mode.
- `src/components/navbar/Folder.scss` — split `.folder-container`, `.folder-header`, `.folder-spaces` into `--row` and `--strip` modifiers. New `.folder-header__icon/__meta/__name/__count` rules.
- `src/components/shell/SpacesSidebar.scss` — `.spaces-sidebar__row--drop-target` rewritten (no wiggle, translucent tint).

Also two unrelated fixes shipped earlier in the session (out of scope for this plan, but in the same working tree):
- Search-box filter icon hover unified between Spaces and DMs (`src/styles/_components.scss`, `src/components/direct/DirectMessageContactsList.{tsx,scss}`).

### What's still open vs the sub-plan DoD

- [ ] **Collapsed-strip DnD** — folders render but can't be reordered/dragged in the strip. Decision deferred again. Probably wants its own follow-up: either fork into `SpacesSidebarStripRow` or extend the existing wiring conditionally.
- [ ] **Touch long-press for folder edit in the strip** — exists in `SpacesSidebarFolder` already (preserved verbatim); should work in collapsed mode too since the same component is rendered, but not verified.
- [ ] **Auto-expand collapsed folder when dragging a space over it** — untested in either expanded or collapsed mode after these visual changes.
- [ ] **Verify all 9 DnD scenarios** still work after the drop-target visual change. The behavior wiring wasn't touched, only the CSS — but worth a smoke test.
- [ ] **Visual states across light + dark** — none of the new CSS was checked in dark mode.
- [ ] **Browser smoke test** — none of the above changes have been verified in a running app yet. TypeScript clean (`tsc --noEmit` passes, ignoring one pre-existing unrelated error in `ImportKeyStep.tsx`).

### Risk notes for whoever resumes

- The `FolderButton` `size="small"` (40px) inside the row-variant header is smaller than the 48px default; verify it doesn't look cramped next to the 42px space avatars.
- `Folder.scss` is only consumed by `SpacesSidebarFolder` on this branch (`FolderContainer.tsx` exists as dead code — only `NavMenu` on `origin/main` imports it). Edits are safe here, but if the old UI ever comes back as a reference, the SCSS split will need awareness.
- Folder member-count in the header shows `spaces.length` (the number of spaces inside the folder), not a sum of members across those spaces. Matches the screenshot request ("user's icon ... number of the spaces that are inside the folder").

*Last updated: 2026-06-03*
