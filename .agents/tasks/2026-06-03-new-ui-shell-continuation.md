# New UI Shell — Continuation

Continuation of [2026-06-02-new-ui-shell-implementation.md](./2026-06-02-new-ui-shell-implementation.md). The shell migration is **shipped and committed** on `feat/new-UI` (10 commits ahead of `main`). This doc captures everything that still needs attention.

## Branch state

- `feat/new-UI` (this repo): 10 commits, ~2.1k inserts / 2.5k deletes
- `feat/new-ui-shell-icons` (quorum-shared): adds `users-group` + `compass` to IconName. **[PR #28](https://github.com/QuilibriumNetwork/quorum-shared/pull/28) open, awaiting merge.** This repo's `feat/new-UI` depends on it being merged + a yarn-install bump.

---

## 1 · Code-review findings — deferred

The session ran a comprehensive review (see `feat/new-UI` commit `c2e2d625` for what got fixed). Two findings were deferred because they're bigger than quick-win scope:

### [HIGH] Phone drawer needs `aria-modal` + focus management

**Location**: `src/components/shell/AppShell.tsx` (the off-canvas drawer block).

**What to do**:
1. Add `aria-modal="true"` on `.app-shell__drawer`.
2. On `drawerOpen` becoming true, focus the first focusable element in the drawer (the first rail item). Save a ref to the trigger button beforehand.
3. On `drawerOpen` becoming false, restore focus to the saved trigger button.
4. Trap focus inside the drawer while open (Tab cycles within the dialog).

**Pattern**: use a small `useFocusTrap` helper or React Aria's `<FocusScope contain restoreFocus>`. The triggers live in chat headers (DirectMessage, Channel, EmptyDirectMessage, SpacesPage's PhoneHeader) — each one needs to expose its button ref to the drawer state. Easiest: store a `triggerRef` on the ShellState context that AppShell reads when closing.

**Acceptance**: VoiceOver on iOS Safari only reads drawer contents while open; closing drawer returns focus to the hamburger button in the chat header.

### [LOW] `ShellStateContext` value identity churn

**Location**: `src/components/shell/useShellState.ts` lines 127-138.

**What to do**: wrap the returned object in `React.useMemo` keyed on all 8 fields (`railCollapsed`, `sidebarCollapsed`, `viewport`, `drawerOpen`, plus the 4 setters which are already stable via `useCallback`). Or split into two contexts: state (changes often) vs actions (stable forever).

**Acceptance**: in React DevTools profiler, opening/closing the drawer no longer re-renders unrelated consumers like `NavRail`.

---

## 2 · Step 8b — SpacesSidebar polish

The current SpacesSidebar (`src/components/shell/SpacesSidebar.tsx`) is the **minimal-first** version: flat list of spaces, square avatar (via legacy `SpaceIcon`), name, unread badge. Per the original handoff, the real design also needs:

### Folders + DnD reordering

Reuse the existing infrastructure (kept alive in `src/components/navbar/`):
- `FolderContainer.tsx` — the expandable folder row
- `FolderButton.tsx` — the folder's icon/title
- `SpaceButton.tsx` — wraps `SpaceIcon` with @dnd-kit `useSortable`
- Hooks: `useFolderDragAndDrop`, `useNavItems`, `useFolderStates`, `useSpaceOrdering`

The legacy `NavMenu` (now deleted) was the reference call site. Adapt those patterns to render rows (not circular icons) inside the new sidebar. The existing `DragStateProvider` + `DndContext` + `DragOverlay` setup all transfers verbatim.

### Member count + timestamps + previews

Per the design handoff:
- Square avatar 42px (current uses `SpaceIcon size="regular"` → check pixel match)
- Name + timestamp on the first line
- `users` icon + member count number only (no "members" word) on the second line
- Unread badge (accent bg, white text, pill) at the right

Member count comes from `useSpaceMembers({ spaceId }).data?.length ?? 0` (already used by the old `MySpacesTab`). Per-row hook calls are fine here.

Last-message preview + timestamps will need a per-space data fetch — check what `useConversationPreviews` does for DMs and adapt.

### Hide-muted-spaces filter — DROP this feature

The legacy `NavMenu` had a "Hide muted Spaces from sidebar" toggle in user settings. With the old UI this was safe because the **My Spaces** screen always listed every joined space, so muted-and-hidden spaces remained discoverable there.

In the new shell the sidebar is the **only** view of joined spaces. Hiding muted spaces from it would make them effectively invisible — the user has no way to find them, unmute them, or even remember they exist. That's a worse UX than the legacy behaviour it was designed to improve.

**Plan**:
- Remove the toggle from `UserSettingsModal` (find the setting row and delete; check `Privacy.tsx` / `Notifications.tsx` / wherever it lives)
- Don't apply the filter in `SpacesSidebar`
- Leave `config.hideMutedSpacesFromSidebar` in the shared types for now (quorum-mobile may still use it; removing the field would be a sync-breaking change). Mark it deprecated in a follow-up shared PR if mobile also drops it.
- Muted spaces should render as before but with the standard muted styling (lower opacity / muted icon) so they're visually distinct without being hidden.

### Mock data already in place

A dev-mode mock-spaces generator is wired up (commit `40d0c357`). Enable with `?spaces=30` URL param or `localStorage.debug_mock_spaces='true'`. Useful for stress-testing folders, scrolling, badge layouts. Production builds tree-shake the mock module.

---

## 3 · Banner shrink — bump `HEADER_MIN_HEIGHT` to 72px

**Location**: `src/hooks/business/channels/useSpaceHeader.ts`.

The space banner currently shrinks from 132px → **48px** on scroll. The new overlay layout (back-arrow top-left, settings top-right, name bottom-left over a bottom-up gradient) needs ~72px minimum to keep all three elements visible.

**Risk to verify**: the chat-header next to the banner uses `$header-height: 49px`. At full scroll, banner (72px) will be taller than chat-header (49px) → visual step instead of flush line. Either accept the step (it's minor on actual banner images) or also bump `$header-height` to 72px (cascading visual change across all chat headers).

Discuss with Kyn before merging.

---

## 4 · Open visual nits to revisit

These came up during the session, never finalized:

- **Space title legibility on light theme**: theme-aware `--surface-00-rgb` gradient was the chosen compromise but the title can still look washy over very bright/colorful banner images. Possible follow-up: small bottom-up CSS mask or subtle text-stroke for extra contrast against arbitrary photos.
- **Hamburger placement on phone**: settled on "inside chat header, left side, styled as a header-icon-button". Test on EmptyDirectMessage and SpacesPage's PhoneHeader — those render the icon inside a `.chat-header` div but the surrounding flex layout is minimal. May need a touch more padding around the icon to match the chat-header icons in real chats.

---

## 5 · Post-launch (out of scope until shell is merged)

- **Drag-to-resize sidebar edge** — Discord/VSCode/Slack pattern. Adds a draggable right edge on the sidebar slot for custom widths. Snap zones: snap to 72px below ~130px, free width 200-400px otherwise. Persist actual pixel width in localStorage. Composes cleanly with the existing collapse toggle (toggle = primary affordance, drag = spatial fine-tuning).

- **DragStateProvider scope review** — when SpacesSidebar adopts folders+DnD, the existing `DragStateProvider` is mounted inside the old `NavMenu` (now deleted). It needs to be re-mounted somewhere persistent — likely AppShell or a dedicated `SpacesSidebar` internal wrapper. Don't double-mount it across DM and Spaces sidebars unless they share a drop-target plane.

---

## 6 · Definition of done before merging `feat/new-UI`

- [ ] quorum-shared PR #28 merged + this repo's `yarn install --force` to pick up the new icons
- [ ] Code review findings #6 (a11y focus management) addressed
- [ ] SpacesSidebar polish (folders + DnD + member count) implemented OR explicitly punted to a follow-up PR with documented scope
- [ ] Manual smoke test across both themes, all viewports (mobile/tablet/desktop), all routes (DM list, DM conversation, Spaces list, Channel chat, Public/Discover)
- [ ] Banner shrink min-height decision made + applied
- [ ] PR opened against `main` referencing the original plan doc

---

*Last updated: 2026-06-03*
