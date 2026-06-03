# Docs refresh after new-UI shell migration

The new shell (AppShell + NavRail + Sidebar + SpacesSidebar) replaced the old NavMenu. Several `.agents/docs/features/` files still describe the old architecture or point at deleted paths. This task collects them in one place for a careful refresh.

## Scope

Read each file end-to-end, then update references to match the new code. Don't just sed paths — re-explain the architecture sections where the substance changed. Keep the file's voice and structure; refresh only what's stale.

## Files (with confidence + scope)

### Already path-rewritten this session
- [avatar-initials-system.md](../../.agents/docs/features/avatar-initials-system.md) — only paths, done. Re-verify it still reads coherently.

### Path-only updates (small)
- [channel-space-mute-system.md](../../.agents/docs/features/channel-space-mute-system.md) — references `NavMenu.tsx` at lines 66, 222 as the "Space context menu" entry point. The actual entry is now `useSpaceContextMenu` inside `SpacesSidebar` (right-click on a row). Update both references.
- [mute-conversation-system.md](../../.agents/docs/features/mute-conversation-system.md) — line ~18 and ~74 mention "NavMenu DM badge" as the muted indicator. The badge moved to `NavRail` (cross-section unread dot via `useDirectMessageUnreadCount`) and per-row in `DirectMessageContact`. Also `useDirectMessageUnreadCount.ts:11` has a JSDoc comment referencing NavMenu — update it.
- [modals.md](../../.agents/docs/features/modals.md) — lines 21, 24, 40 say modals are "triggered from NavMenu" and warn about NavMenu z-index. The triggering surface is now `SpacesSidebar` ("+" button context menu → Join / Create). The z-index warning may still be valid but the named surface is stale.

### Architecture rewrites (substantive)
- [notification-indicators-system.md](../../.agents/docs/features/notification-indicators-system.md) — component map at lines 285-289 lists `navbar/FolderContainer.tsx`, `navbar/NavMenu.tsx`, `navbar/SpaceIcon.tsx` as authoritative. New map: `shell/NavRail.tsx` (cross-section unread dots), `space/SpacesSidebar.tsx` + `space/SpacesSidebarRow.tsx` + `space/SpacesSidebarFolder.tsx` (per-space and per-folder mention/reply bubbles via `useSpaceMentionCounts` + `useSpaceReplyCounts`), `direct/DirectMessageContact.tsx` (per-DM unread dot), `space/SpaceIcon.tsx` (the icon primitive). Also document the new shared `.icon-unread-dot` and `.icon-mention-bubble` classes in `_components.scss` as the canonical visuals.
- [space-folders.md](../../.agents/docs/features/space-folders.md) — extensive: §75-93 (architecture), §108 (component diagram), §234 (data flow), §317 (where context menu lives), §412-468 (DnD), §478, §537-547 (drop indicators), §584, §597. Whole sections describe `navbar/FolderContainer.tsx`, `navbar/SpaceButton.tsx`, `navbar/FolderContextMenu.tsx`. New implementation: `space/SpacesSidebarFolder.tsx` (forks the old FolderContainer, renders nested rows via `SpacesSidebarRow` instead of `SpaceButton` for two-line layout), `space/SpacesSidebarRow.tsx` with `compact` prop for the 72px strip. DnD wiring still uses `useFolderDragAndDrop` and `useNavItems` — those references are still correct. Drop indicators are now `.spaces-sidebar__row-drop-indicator` (above/below) and `.sidebar-row-chrome--merge-target` (translucent accent fill, no wiggle on rows; wiggle preserved on folders + space avatars via `.spaces-sidebar__row-avatar--wiggle`).
- [responsive-layout.md](../../.agents/docs/features/responsive-layout.md) — lines 25, 57, 65, 71, 76, 98 describe NavMenu width (74px / 50px) and `navbar/NavMenu.scss`. New shell: NavRail width via `$rail-width-collapsed` (72px) / `$rail-width-expanded` (236px), Sidebar width via `$sidebar-width` (300px) / `$sidebar-width-collapsed` (72px), user-resizable via drag handle and persisted in `shell.sidebarWidth` localStorage key. Viewport breakpoints in `useShellState`: phone ≤767, tablet ≤1023, desktop >1023. AppShell drawer pattern on phone is new.

### JSDoc + inline comment refresh
While in those areas, sweep these comments that still say "NavMenu":
- `src/hooks/business/messages/useDirectMessageUnreadCount.ts:11` — "used for the NavMenu Direct Messages icon indicator" → "used by NavRail's DM unread dot via useDirectMessageUnreadCount"
- `src/hooks/business/spaces/useSpaceTagStartupRefresh.ts:14-19` — fine as-is; the doc explains behaviour, not call site
- `src/components/space/SpacesSidebar.tsx:54-66` — JSDoc still says "minimal first pass (step 8)" and lists deferred items most of which are now shipped or removed. Rewrite to describe the current scope.
- `src/components/space/SpacesSidebar.tsx:79-81` — comment mentions `FolderContainer` as a child; rename to `SpacesSidebarFolder`.

## Task file housekeeping

Several active task files (in `.agents/tasks/`) also have stale references to deleted code. Lower priority but worth a sweep:
- `2026-01-07-channel-ordering-feature.md` — line refs into `NavMenu.tsx:574, 634-674` and `SpaceButton.tsx`. Replace with the analogous lines in `SpacesSidebar.tsx` / `SpacesSidebarRow.tsx` or note the file move.

## Approach

1. Read each file in full first; understand the original intent before touching anything.
2. For path-only files: simple sed + manual coherence check.
3. For architecture rewrites: structure the change as "what's the same / what's different / new diagrams." Keep historical context where useful (e.g. "the old NavMenu had X; the new SpacesSidebar replaces it with Y").
4. Cross-link the new files (e.g. `space-folders.md` should link to `[SpacesSidebarFolder.tsx](src/components/space/SpacesSidebarFolder.tsx)`).
5. Verify each updated doc by grepping for `navbar/`, `NavMenu`, `FolderContainer`, `SpaceButton`, `nav-menu` — should return zero hits when done.

## Out of scope

- Doc updates for plans already in `.agents/tasks/.done/` — those are historical, not current docs.
- Building new feature docs (e.g. for drag-to-resize sidebar, shared row chrome). If those gaps are felt, file a separate task.

---

*Created: 2026-06-04 — captures the doc-refresh queue identified during the new-UI shell migration audit. Not started in this session due to remaining context budget; needs careful per-file reading.*
