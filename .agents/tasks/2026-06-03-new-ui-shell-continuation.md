# New UI Shell — Continuation Dispatcher

Continuation of [2026-06-02-new-ui-shell-implementation.md](./2026-06-02-new-ui-shell-implementation.md). The shell migration is **shipped and committed** on `feat/new-UI` (15 commits ahead of `main`). This doc is the **dispatcher**: it identifies the remaining tracks, their dependencies, and how to parallelize across sessions.

## Branch state

- `feat/new-UI` (this repo): 15 commits ahead of `main`.
- `feat/new-ui-shell-icons` (quorum-shared): adds `users-group` + `compass` to `IconName`. **[PR #28](https://github.com/QuilibriumNetwork/quorum-shared/pull/28)** open — must merge before `feat/new-UI` can land in `main`.

## How to use this doc

Each track below is a self-contained work unit. Pick one, read its scope, and either start coding (small tracks) or write a per-track implementation plan first (larger tracks). The **dependency graph** at the bottom shows what can run in parallel.

Tracks marked **TODO: write plan** need a dedicated planning step (use `feature-dev` or write inline) before implementation. Tracks marked **inline-ready** can be tackled directly from the scope here.

---

## Track A — Drawer accessibility (HIGH) · inline-ready

**Severity**: HIGH (from code review). Currently fails WCAG 2.4.3 (focus order) and ARIA 1.2 dialog pattern.

**Files**: `src/components/shell/AppShell.tsx` (drawer block, lines ~70-100), `src/components/shell/useShellState.ts` (add trigger ref state).

**Scope**:
1. Add `aria-modal="true"` to `.app-shell__drawer`.
2. When `drawerOpen` becomes `true`, focus the first focusable element inside the drawer (first rail item).
3. When `drawerOpen` becomes `false`, restore focus to the trigger button that opened it. To do this, the hamburger buttons in chat headers (`DirectMessage`, `Channel`, `EmptyDirectMessage`, `SpacesPage`'s `PhoneHeader`) need to share a ref with the shell state — easiest: store a `lastTriggerRef: React.RefObject<HTMLButtonElement> | null` on `ShellState` that triggers set on click before calling `openDrawer()`.
4. Trap focus inside the drawer while open (Tab cycles within the dialog, Shift+Tab cycles backward, Esc closes).

**Suggested implementation**: pull in `@react-aria/focus`'s `<FocusScope contain restoreFocus autoFocus>` or write a small `useFocusTrap` hook. Esc-close can be a single keydown listener on the scrim or the drawer.

**Acceptance**: VoiceOver on iOS Safari (mobile-DevTools-emulated is fine for a first pass) only reads drawer contents while open; closing returns focus to the hamburger in the chat header; keyboard Tab is trapped inside the drawer; Esc closes the drawer.

**Estimated session size**: small (~1 session).

**Dependencies**: none.

---

## Track B — `ShellStateContext` value memoization (LOW) · inline-ready

**Severity**: LOW (from code review). Currently re-renders all consumers (NavRail, Sidebar, every sidebar variant, AppShellInner) on every state change because the context value is a new object identity each render.

**Files**: `src/components/shell/useShellState.ts` (lines 127-138, the return statement of `useShellStateInternal`).

**Scope**: wrap the returned object in `React.useMemo` keyed on `railCollapsed`, `sidebarCollapsed`, `viewport`, `drawerOpen`. The setters/togglers are already stable via `useCallback([])` so they don't need to be deps. Alternatively split into two contexts: a fast-changing "state" context and a stable "actions" context.

**Acceptance**: React DevTools profiler shows that opening/closing the drawer no longer re-renders `NavRail` or `Sidebar` (their inputs didn't change).

**Estimated session size**: tiny (~15 min).

**Dependencies**: none.

---

## Track C — Banner shrink min-height bump · inline-ready

**Severity**: cosmetic. The space banner currently shrinks from 132px → 48px on scroll. The new overlay layout (back arrow top-left, settings top-right, name bottom-left over a bottom-up gradient) needs more room.

**Files**: `src/hooks/business/channels/useSpaceHeader.ts` (`HEADER_MIN_HEIGHT` constant), `src/styles/_variables.scss` (if `$header-height: 49px` needs adjusting too).

**Scope**: bump `HEADER_MIN_HEIGHT` from 48 → 72px. Then visually verify in both themes whether the **chat-header** next to the banner (which uses `$header-height: 49px`) creates a visible step at full scroll. Two outcomes:
- Step is acceptable (banner edge sits ~23px below chat-header bottom) → ship it.
- Step is too jarring → bump `$header-height` to 72px too. This cascades to **every** chat header in the app (Channel, DM, Thread); test all three.

**Acceptance**: at full scroll, all three banner-overlay elements (back arrow, settings, space name) are still visible and readable. No visual regression in the chat header heights elsewhere.

**Estimated session size**: small (~30 min).

**Dependencies**: none.

---

## Track D — SpacesSidebar polish (folders + DnD + rows) · **TODO: write plan**

**Severity**: medium — the current `SpacesSidebar` is the "minimal-first" version. The handoff design calls for folders, drag-and-drop reordering, member counts, timestamps, last-message previews.

**Files (primary)**: `src/components/shell/SpacesSidebar.tsx`, `src/components/shell/SpacesSidebar.scss`. Will reuse code from `src/components/navbar/` (`FolderContainer`, `FolderButton`, `SpaceButton`) that was deliberately kept alive in the cleanup pass for this track.

**Files (related)**: hooks `useFolderDragAndDrop`, `useNavItems`, `useFolderStates`, `useSpaceOrdering`, `useSpaceMembers`. `DragStateProvider` from `src/context/DragStateContext.tsx` needs to be re-mounted somewhere persistent now that `NavMenu` (its old mount point) is gone — likely inside `SpacesSidebar` itself or in `AppShell`. Decide before implementation.

**Scope (high level)**:
1. **Folders**: render `FolderContainer` rows interleaved with space rows using `useNavItems`. Expansion state via `useFolderStates` (already localStorage-backed).
2. **DnD**: adopt `useFolderDragAndDrop` with the same DndContext + DragOverlay setup. Adapt the wiggle/drop-indicator visuals from the old NavMenu to the new row shape.
3. **Row visuals**: square avatar (42px, gentle radius — `$rounded-md`), name + timestamp on row 1, `users` icon + member count number-only on row 2, accent unread badge on the right. Member count via `useSpaceMembers({ spaceId }).data?.length ?? 0` (already used pattern in old `MySpacesTab`). Timestamps + previews need a per-space data fetch; check what `useConversationPreviews` does for DMs and adapt for spaces.
4. **Drop hide-muted filter** (already decided — see git log, never implemented in the new sidebar).
5. **Muted spaces**: render with reduced opacity / muted icon styling so they're visually distinct without being hidden.

**Plan deliverables**: per-track plan should specify (a) the `DragStateProvider` re-mount location, (b) the data flow for member counts and last-message previews (per-row hook vs aggregated fetch), (c) the visual treatment of muted rows, (d) the keyboard/touch interaction for folder expand/collapse.

**Acceptance**: feature parity with the old NavMenu's space list, in the new row format, with all four visual states (active, hover, muted, drop-target) verified across themes.

**Estimated session size**: large (1-2 sessions). Worth a dedicated planning pass with `feature-dev:code-explorer` to map all the hook + context dependencies before writing code.

**Dependencies**: **none for starting**, but **conflicts with Track E** if both run in parallel (both touch `SpacesSidebar.tsx` header markup). If running in parallel, coordinate the merge or sequence them.

**Mock data**: `?spaces=30` URL param or `localStorage.debug_mock_spaces='true'` injects fake joined spaces for stress-testing (commit `40d0c357` in this branch). Use during development to verify scrolling, badge layouts, and folder behavior at scale.

---

## Track E — Drag-to-resize sidebar (replaces collapse buttons) · **TODO: write plan**

**Severity**: medium — UX iteration on the sidebar collapse interaction. The explicit collapse/expand icons are removed and replaced with a draggable border between sidebar and main content. The NavRail collapse toggle is **NOT** affected.

**Files (primary)**: `src/components/shell/AppShell.tsx` (mount the drag handle on the sidebar's right edge), `src/components/shell/AppShell.scss` (hover and dragging styles), `src/components/shell/useShellState.ts` (add `sidebarWidth: number | null` state and migration logic).

**Files (touched)**: `src/components/shell/SpacesSidebar.tsx` (delete the collapse/expand `<button>` in header), `src/components/direct/DirectMessageContactsList.tsx` (delete the collapse/expand buttons in expanded and collapsed-strip headers).

**Scope**:
- **Drag handle**: 6px-wide invisible hit area on the right edge of `.app-shell__sidebar`, `cursor: col-resize`. Not rendered when `sidebarMode === 'channels'` (channels sidebar is non-resizable per the handoff).
- **Hover state**: immediate cursor change. After 1000ms hover, the border thickens to ~3px and gets a soft theme-aware accent tint:
  - Light theme: `var(--accent-300)` (use as test value; not the strong `--accent-500`)
  - Dark theme: `var(--accent-700)`
  - Expose via a CSS custom property `--shell-drag-handle-hover-color` set in light/dark theme blocks
- **Drag mechanics**: `mousedown` captures pointer, `mousemove` updates width clamped to bounds (200-400px is a starting bound — discuss), `mouseup` writes to localStorage. During drag, `body { user-select: none }` to prevent text selection.
- **Snap-to-strip**: dragging below ~130px snaps to the 72px collapsed avatar strip. Snap zone is one-way (release below 130 → snap to 72); expanding from 72 starts a fresh drag, restoring the most recent freely-dragged width.
- **State migration**: new key `shell.sidebarWidth: number | null` in localStorage. `sidebarCollapsed` becomes a derived boolean (`sidebarWidth === null` or `<= 72`). Existing `sidebarCollapsed` consumers continue to work.
- **Touch handling**: drag handle disabled (`pointer-events: none`) on tablet/phone. Phone drawer pattern unchanged.

**Remove these collapse buttons** (sidebar only — NavRail untouched):
- `SpacesSidebar.tsx` header: the collapse `<button>` (expanded mode) and the expand button in `--collapsed` header
- `DirectMessageContactsList.tsx` header: the `Tooltip`-wrapped collapse `Button` (expanded mode) and the centered expand button in the collapsed strip

**Plan deliverables**: specify (a) exact bounds for free-drag width, (b) hover-delay implementation (timer reset on mouseleave or on movement?), (c) how the drag handle interacts with the OfflineBanner's top offset, (d) state migration for existing users (read existing `sidebarCollapsed` on first load and translate to `sidebarWidth`).

**Acceptance**:
- No collapse icons in DM or Spaces sidebar headers (rail collapse toggle in NavRail's bottom row stays)
- Hovering the sidebar→main border for ~1s reveals a soft accent-tinted ribbon
- Dragging is smooth (no jank, no text selection)
- Width persists across reloads
- Avatar-strip snap works at low widths
- Channels sidebar (inside a space) is non-resizable
- Phone and tablet behavior unchanged
- Theme-aware accent verified in both light and dark

**Estimated session size**: medium-large (1-2 sessions). Worth a planning pass before implementation to nail down the snap-zone math and migration logic.

**Dependencies**: conflicts with **Track D** if both run in parallel (both touch sidebar header markup). Sequence them or coordinate the merge.

---

## Track F — Visual polish (minor) · inline-ready

Small visual issues noted during the session, never finalized:

1. **Space title legibility on light theme over very colorful banners**: the theme-aware `--surface-00-rgb` gradient was the chosen compromise but the title can still look washy. Possible follow-up: small CSS mask or subtle text-stroke for extra contrast against arbitrary photos. Try first; if the result looks good, ship.
2. **Hamburger padding in `EmptyDirectMessage` and `SpacesPage`'s `PhoneHeader`**: those phone-only header rows render the hamburger inside a `.chat-header` div but the surrounding flex layout is minimal. May need a touch more padding around the icon to match the chat-header icons in real chats. Compare visually on a phone breakpoint, adjust the padding/margin of the `<Button>` if it looks off.

**Estimated session size**: tiny each (~15 min).

**Dependencies**: none.

---

## Dependency graph

```
Track A (drawer a11y) ────┐
Track B (context memo) ───┼── all independent, parallel
Track C (banner shrink) ──┘

Track D (SpacesSidebar) ─┐
                         ├── conflict on sidebar headers → sequence
Track E (drag-resize) ───┘

Track F (visual nits) ──── independent
```

**Suggested order**:
1. **Now / first available session**: Track A (highest severity) + Track B + Track C in parallel (3 separate sessions, no overlap)
2. **After A/B/C land**: write the plan for Track D, execute it
3. **After D lands**: write the plan for Track E, execute it
4. **Anytime**: Track F as filler

If parallel sessions aren't an option, sequential order is A → C → B → D → E → F (HIGH severity first, then cosmetic, then large features, then nits).

---

## Definition of done before merging `feat/new-UI` to `main`

- [ ] quorum-shared PR #28 merged + this repo's `yarn install --force` to pick up the new icons
- [ ] Track A (drawer a11y) complete
- [ ] Track C (banner shrink) decided + applied
- [ ] Track D (SpacesSidebar polish) complete OR explicitly punted to a follow-up PR with documented scope
- [ ] Manual smoke test across both themes, all viewports (mobile/tablet/desktop), all routes (DM list, DM conversation, Spaces list, Channel chat, Public/Discover, Empty states)
- [ ] PR opened against `main` referencing this dispatcher and the original plan doc

Tracks B, E, and F can ship in follow-up PRs without blocking the initial merge.

---

*Last updated: 2026-06-03*
