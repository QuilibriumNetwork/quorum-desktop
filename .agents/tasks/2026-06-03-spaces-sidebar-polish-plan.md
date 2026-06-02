# SpacesSidebar Polish — Implementation Plan (Track D)

Plan for Track D of [2026-06-03-new-ui-shell-continuation.md](./2026-06-03-new-ui-shell-continuation.md). Upgrades the minimal `SpacesSidebar` shipped with the new shell to support folders, drag-and-drop reordering, member counts, last-message previews, the hide-muted toggle, and the muted-row visual treatment.

---

## Decisions made up-front

These were the four plan deliverables flagged in the dispatcher. Resolutions:

### a) Where to mount `DragStateProvider`

Mount **inside `SpacesSidebar.tsx`**, wrapping the list region. Rationale:

- DnD is local to the spaces list. Mounting at `AppShell` level would leak the provider into NavRail, Sidebar (DM mode), and Main — none of which use it.
- The provider has zero cost when no drag is active (state is `null`/`false`).
- Spaces and folders are the only sortable surface in the new UI; the old NavMenu's broader scope is gone.
- `SpaceIcon` and `FolderButton` already wrap their `useDragStateContext` calls in try/catch, so they degrade silently outside the provider. We only need it inside `SpacesSidebar`.

Nesting order (mirrors what NavMenu used):

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

### b) Data flow for member counts and last-message previews

**Member counts**: per-row hook (`useSpaceMembers({ spaceId })`). Each `SpacesSidebarRow` calls it inside its own `<Suspense fallback={null}>` boundary so a slow row doesn't block the list. Rationale: `useSpaceMembers` is already a `useSuspenseQuery` reading from IndexedDB; aggregating it at the sidebar level would couple every row's re-render to every other row's data, and would also require building a custom batched query. Per-row is simpler and IndexedDB reads are cheap.

**Last-message previews**: build a new `useSpacePreviews(spaces)` hook modelled on `useConversationPreviews`. Spaces don't have a `lastMessageId` field today, so the hook will:
- Iterate each space's channels (need `useSpaceChannels` or the channel store) and pick the most recent message across channels
- Batch the IndexedDB reads with one `Promise.all`
- Key the query on a `lastActivity` signature derived from `useSpaceUnreadCounts` (which already tracks per-space activity)

This is **the scope risk** — last-message previews require a non-trivial new hook. **Punt for v1**: ship the timestamp column wired to a placeholder (`—`) and the row layout reserving space for the preview line. Land previews in a follow-up PR once the row layout, folders, and DnD are stable.

### c) Visual treatment of muted spaces

- Row opacity: `0.55` on the entire row (`.spaces-sidebar__row--muted`)
- Replace the unread badge with the muted icon (`Icon name="bell-off"`) only when the user hasn't hidden muted spaces entirely
- Tooltip still shows full info on hover
- Active state (current route inside the space) overrides muted opacity → full opacity even when muted

Hide-muted toggle: surfaced as a small filter chip in the sidebar header next to the title. Persisted via `config.hideMutedSpacesFromSidebar`. Default `false`.

### d) Keyboard + touch interaction for folder expand/collapse

- **Mouse**: click on the folder row toggles expand/collapse (existing `FolderContainer` behavior)
- **Keyboard**: Enter or Space on a focused folder row triggers expand/collapse; arrow-down moves focus to the first child if expanded, otherwise to the next sibling
- **Touch**: tap toggles expand/collapse; long-press (existing handler) opens the edit context menu
- Drop target during drag: hovering a collapsed folder for 600ms auto-expands it (this is already in `useFolderDragAndDrop` — verify, don't reimplement)

---

## Build sequence

1. **Skeleton swap (no behavior change)**
   - Replace the inline row JSX in [SpacesSidebar.tsx](../../src/components/shell/SpacesSidebar.tsx) with a `<SpacesSidebarRow>` component file (`src/components/shell/SpacesSidebarRow.tsx`)
   - Move the existing row styles from `SpacesSidebar.scss` to `SpacesSidebarRow.scss`
   - Wire mock data through the row component
   - Verify: visual parity with current shipped version, mock toggle still works (`?spaces=30`)

2. **Two-line row layout (no folders yet)**
   - Avatar 42px on the left (`$rounded-md`)
   - Row 1: name (truncate) + timestamp (right-aligned, `text-xs`, muted color) → timestamp shows `—` for now
   - Row 2: `users-group` icon + member count (via per-row `useSpaceMembers` + `<Suspense fallback={null}>`) + accent unread badge (right-aligned)
   - Active state highlight via `aria-current`
   - Muted variant: `.spaces-sidebar__row--muted` with opacity 0.55, replace badge with `bell-off` icon
   - Verify: all four visual states (active / hover / muted / default) in light + dark

3. **Folder rendering**
   - Add `useNavItems` + `useFolderStates` calls in `SpacesSidebar`
   - Mount `<DragStateProvider>` wrapping the list
   - Render `<FolderContainer>` for folder items, `<SpacesSidebarRow>` for space items (top-level spaces and folder children)
   - Folder rows already have their own visual treatment — `FolderContainer` brings its own styles
   - Verify: folders render with correct expand/collapse, child spaces respect folder state, no folders defined = list looks identical to step 2

4. **DnD wiring**
   - Pull in `useFolderDragAndDrop`, `DndContext`, `SortableContext`, `DragOverlay`
   - Make `<SpacesSidebarRow>` sortable via `useSortable({ id: space.id })` — match the pattern in `SpaceButton`
   - `DragOverlay` renders a clone of the dragging row
   - Verify all 9 drag scenarios from `useFolderDragAndDrop` (space-to-space reorder, space-into-folder, space-out-of-folder, folder-reorder, etc.)
   - Verify mocks: with `?spaces=30`, ensure drag-and-drop on mock spaces does not crash; gate DnD persistence behind `space.id.startsWith('mock-')` check (mocks shouldn't write to user config)

5. **Hide-muted toggle**
   - Add `hideMutedSpacesFromSidebar` to `UserConfig` type (one-line type extension, default false in migration)
   - Filter chip in `SpacesSidebar` header: small `<button>` next to title, toggles the config value via the existing config-update flow (likely an action queue `save-user-config` or whatever `useFolderDragAndDrop` uses)
   - When `true`: filter muted spaces out of the `useNavItems` result before rendering
   - When `false`: render muted spaces with the muted variant from step 2
   - Verify: toggle persists across reloads, takes effect immediately

6. **Context menu**
   - Right-click / long-press on a space row opens the existing context menu (mute, leave, etc.)
   - Reuse the handler signature already present in `SpaceButton` (`onContextMenu`)
   - This is straight reuse — no new design needed

7. **Last-message previews (deferred — separate PR)**
   - Build `useSpacePreviews(spaces)` modelled on `useConversationPreviews`
   - Replace the placeholder `—` timestamp with the real `formatRelativeTime(lastMessageAt)`
   - Add the preview line below the member count row
   - This is its own follow-up PR after the rest of Track D ships

---

## Files touched

**Primary:**
- [SpacesSidebar.tsx](../../src/components/shell/SpacesSidebar.tsx) — wraps `DragStateProvider` + `DndContext`, replaces inline rows with `<SpacesSidebarRow>` + `<FolderContainer>`
- [SpacesSidebar.scss](../../src/components/shell/SpacesSidebar.scss) — strip old row styles, add header filter-chip styles
- `src/components/shell/SpacesSidebarRow.tsx` — **new file**, the two-line row
- `src/components/shell/SpacesSidebarRow.scss` — **new file**

**Reused (no edits):**
- [FolderContainer.tsx](../../src/components/navbar/FolderContainer.tsx)
- [FolderButton.tsx](../../src/components/navbar/FolderButton.tsx)
- [DragStateContext.tsx](../../src/context/DragStateContext.tsx)
- [useFolderDragAndDrop.ts](../../src/hooks/business/folders/useFolderDragAndDrop.ts)
- [useNavItems.ts](../../src/hooks/business/folders/useNavItems.ts)
- [useFolderStates.ts](../../src/hooks/business/folders/useFolderStates.ts)
- [useSpaceMembers.ts](../../src/hooks/queries/spaceMembers/useSpaceMembers.ts)
- [useChannelMute.ts](../../src/hooks/business/channels/useChannelMute.ts) — for `isSpaceMuted` check

**Type extension:**
- `UserConfig` type — add `hideMutedSpacesFromSidebar?: boolean`

**Not reused:** `SpaceButton.tsx` and `NavMenu`'s row component. The new row format is too different (two lines, member counts, timestamps) to fork `SpaceButton`. Better to write `SpacesSidebarRow` fresh and let `SpaceButton` continue serving any legacy entry points until those are removed.

---

## Risks

- **`useSpaceMembers` per-row at 30+ spaces**: 30 simultaneous IndexedDB reads on first render. Mitigate via row-level Suspense (each loads independently) and React's automatic batching. If perf is bad with `?spaces=100`, fall back to an aggregated `useAllSpaceMemberCounts` hook.
- **`DragStateProvider` re-mount on sidebar collapse**: when `sidebarCollapsed` toggles, if `SpacesSidebar` unmounts/remounts the provider, any active drag is lost. Verify the provider sits at a level that survives collapse — likely fine since the sidebar component itself stays mounted, only its rendered output changes.
- **Mock spaces + DnD persistence**: mocks shouldn't write to the user's real config. Add an `isMock` short-circuit in the drag-end handler.

---

## Definition of done

- [ ] Two-line row layout with avatar + name + timestamp placeholder + member count + unread badge
- [ ] Folders render via `FolderContainer`, expand/collapse persists in localStorage
- [ ] DnD: all 9 scenarios work (verify against `useFolderDragAndDrop` source comments)
- [ ] Active / hover / muted / drop-target visual states verified in light + dark
- [ ] `hideMutedSpacesFromSidebar` toggle works, persists, defaults `false`
- [ ] Context menu (right-click + long-press) reachable from rows
- [ ] No regressions in mock mode (`?spaces=30`, `?spaces=100`)
- [ ] No regressions in collapsed sidebar strip (`sidebarCollapsed === true`)
- [ ] Last-message previews **explicitly punted** to follow-up PR with documented scope

---

*Last updated: 2026-06-03*
