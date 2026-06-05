# New UI Shell Implementation Plan

**Source**: `.agents/tasks/design_handoff_quorum_ui/` (README + wireframe JSX)
**Branch**: `feat/new-UI` (already checked out)
**Scope**: build the new 3-column shell — left **nav rail** + contextual **sidebar** + main chat area — replacing the current `NavMenu` header.

Out of scope for now (deferred — features not ready):
- Farcaster rail item
- Wallet rail item
- FAVORITES section in the rail

---

## 1. What exists today (current shell)

| Piece | Location | Notes |
|---|---|---|
| Root layout | [src/components/Layout.tsx](../../src/components/Layout.tsx) | Renders `<NavMenu>` (fixed left header, 74px) + `<main class="main-content">` |
| Current left strip | [src/components/navbar/NavMenu.tsx](../../src/components/navbar/NavMenu.tsx) | DM icon + Spaces hub icon + draggable space/folder list + bottom buttons (`ExpandableNavMenu` opens createspacemodal, settings, etc.) |
| Width tokens | [src/styles/_variables.scss#L114-L116](../../src/styles/_variables.scss#L114) | `$nav-header-width: 74px` / `$nav-header-width-mobile: 54px` |
| Color tokens | [src/styles/_colors.scss](../../src/styles/_colors.scss) | `--color-bg-app`, `--color-bg-sidebar`, `--color-bg-sidebar-hover`, `--color-bg-sidebar-active-accent`, `--accent`, `--accent-rgb` already exist |
| Routing | [src/components/Router/Router.web.tsx](../../src/components/Router/Router.web.tsx) | `/messages`, `/messages/:address`, `/spaces`, `/spaces/:spaceId/:channelId` |
| DM sidebar (current) | [src/components/direct/DirectMessageContactsList.tsx](../../src/components/direct/DirectMessageContactsList.tsx) | Lives inside `DirectMessages.tsx` next to the chat — has its own header, search, filters |
| Channel list sidebar | inside `Space` → keep as-is (handoff §2c) | |
| UI prefs persistence pattern | [src/hooks/business/ui/useAccentColor.ts](../../src/hooks/business/ui/useAccentColor.ts), [src/hooks/business/folders/useFolderStates.ts](../../src/hooks/business/folders/useFolderStates.ts) | `localStorage` directly inside a small hook. This is the project pattern we'll match. |

**Key insight**: the new shell decouples *navigation* (rail) from *list views* (sidebar). Currently the DM list lives next to the chat and the space/folder list lives in `NavMenu`. The new design pulls both list views into a unified **sidebar slot** controlled by the rail selection.

---

## 2. Target structure

```
┌──────────┬─────────────┬──────────────────────────┐
│ NavRail  │  Sidebar    │  main content (chat /    │
│ 72/236   │  300 / 72   │  spaces page / etc.)     │
└──────────┴─────────────┴──────────────────────────┘
```

- Rail and sidebar both replace the current `<NavMenu>` slot.
- Main area keeps current behavior — `Routes` still drive what renders to the right.
- Channel list sidebar (inside a Space) keeps current style — we just make sure it composes correctly next to the new rail (rail visible, sidebar slot occupied by channels list).

---

## 3. File plan

### New files

```
src/components/shell/
├── AppShell.tsx              # 3-column flex container, replaces NavMenu in Layout
├── AppShell.scss
│
├── NavRail.tsx               # left rail (collapsed/expanded)
├── NavRail.scss
├── RailItem.tsx              # primary nav row (icon + label, accent bar when active)
├── RailTooltip.tsx           # light tooltip for collapsed state
│
├── Sidebar.tsx               # contextual sidebar slot (renders DM | Spaces | Channels | empty)
├── Sidebar.scss
├── SidebarHeader.tsx         # 56px title + action icons + collapse toggle
├── SidebarCollapsed.tsx      # 72px avatar-only strip used by DM/Spaces
│
├── DmSidebar.tsx             # contact list rows (existing DirectMessageContactsList composition reused/refactored)
├── SpacesSidebar.tsx         # space rows + "+" header button → createspacemodal
├── ChannelsSidebar.tsx       # thin wrapper that reuses the current channel-list panel from <Space>
│
└── useShellState.ts          # rail collapsed + sidebar collapsed + active rail section (localStorage)
```

### Modified files

| File | Change |
|---|---|
| [src/components/Layout.tsx](../../src/components/Layout.tsx) | Replace `<NavMenu …>` with `<AppShell>{children}</AppShell>`. Pass create-space modal trigger via context (existing `useModals()` already supplies it, so AppShell can call it directly — no prop drilling). |
| [src/styles/_variables.scss](../../src/styles/_variables.scss) | Add new tokens at the "Semantic Component Sizes" block (bottom of file). |
| [src/styles/_colors.scss](../../src/styles/_colors.scss) | Add the few additional semantic tokens the new shell needs (rail bg, rail-item-hover). |
| [src/components/direct/DirectMessages.tsx](../../src/components/direct/DirectMessages.tsx) | Stop rendering `DirectMessageContactsList` inline — the sidebar slot now renders it. Keep mobile/tablet behavior (sidebar overlay) wired via the new shell. |

**Not deleted yet**: `NavMenu.tsx`, `ExpandableNavMenu.tsx`, etc. The old shell stays in the tree until the new one is verified — then we remove dead code in a follow-up commit on the same branch. Avoids one big risky swap.

---

## 4. New SCSS tokens to add

Append to `_variables.scss` at the bottom (semantic block, per handoff note):

```scss
/* === NEW UI SHELL === */
$rail-width-collapsed:    72px;
$rail-width-expanded:    236px;
$sidebar-width:          300px;
$sidebar-width-collapsed: 72px;
$sidebar-header-height:   56px;
$rail-item-height:        46px;
$rail-fav-item-height:    38px; // reserved for when FAVORITES ships
$rail-accent-bar-width:    3px;
$rail-accent-bar-height:  24px;
```

Add to `_colors.scss` (`:root` and dark theme override where it differs):

```scss
/* nav rail */
--color-bg-rail:         var(--surface-00);
--color-bg-rail-hover:   var(--surface-1);
--color-bg-rail-active:  transparent;       // active = no fill, only accent bar + tinted icon
--color-rail-icon:       var(--color-text-subtle);
--color-rail-icon-active: var(--accent);
```

(Sidebar reuses existing `--color-bg-sidebar`, `--color-bg-sidebar-hover`, `--color-bg-sidebar-active-accent`.)

---

## 5. `useShellState` hook

Mirrors `useAccentColor` / `useFolderStates`. Single source of truth for shell prefs.

```ts
type RailSection = 'dm' | 'spaces' | 'public' /* | 'farcaster' | 'wallet' — TBD */;

interface ShellState {
  railCollapsed: boolean;
  sidebarCollapsed: boolean;          // DM and Spaces sidebars only
  activeSection: RailSection;
  setRailCollapsed: (v: boolean) => void;
  setSidebarCollapsed: (v: boolean) => void;
  setActiveSection: (s: RailSection) => void;
}
```

- localStorage keys: `shell.railCollapsed`, `shell.sidebarCollapsed`. Active section is derived from the URL (`/messages*` → `dm`, `/spaces*` → `spaces`), not persisted — route is the source of truth.
- Default: rail collapsed = `true`, sidebar collapsed = `false`.

---

## 6. Active section ↔ routing mapping

Clicking a rail item navigates to that section's route. Active state derives from `location.pathname` + search params. **Updated 2026-06-02 with architecture change: the sidebar (not a separate page) drives Spaces navigation.**

| Rail item | Icon | Click behavior | Sidebar | Main area | Section id |
|---|---|---|---|---|---|
| Direct messages | `message` | navigate to `/messages/${sessionStorage.lastDmAddress}` if set, else `/messages` | DmSidebar (contact list) | DM conversation or empty hint | `dm` |
| Spaces | `users-group` | navigate to `/spaces/${sessionStorage.lastSpaceId}/${sessionStorage.lastChannelId}` if set, else `/spaces` | SpacesSidebar (own spaces list) when no space selected; ChannelsSidebar when a space is open | empty hint when none selected; channel content when a channel is open | `spaces` |
| Public spaces | `compass` | navigate to `/spaces?tab=discover` | **hidden** (sidebar slot width 0) | DiscoverTab cards (existing SpacesPage Discover content) | `public` |
| Farcaster | `world` | — *do not add yet* | — | — | — |
| Wallet | `wallet` | — *do not add yet* | — | — | — |

**Key change from earlier draft**: clicking "Spaces" in the rail does NOT route to the SpacesPage with cards. It opens the spaces list in the sidebar and either auto-selects the last visited space (sessionStorage) or shows an empty hint in the main area.

**MySpacesTab fate**: orphaned (no longer routed to). Keep in code through this iteration; decision on removal deferred to step 13.

**Last-position persistence (session-only)**:
- DMs: `sessionStorage.lastDmAddress` (existing behavior, untouched)
- Spaces: `sessionStorage.lastSpaceId` + `sessionStorage.lastChannelId` (new — write on space/channel navigation, read on rail click)
- "Last position" survives navigation within a session but resets on app restart, matching DM behavior.

**Spaces sidebar visibility logic**:
- `pathname.startsWith('/spaces')` AND no `?tab=discover` AND no space selected → SpacesSidebar shows own spaces list, main = empty hint
- Same path AND a space is open (`/spaces/:spaceId/:channelId`) → ChannelsSidebar (existing ChannelList component), main = channel chat
- `pathname.startsWith('/spaces')` AND `?tab=discover` → sidebar hidden (slot width 0), main = DiscoverTab

---

## 7. Component breakdown

### 7.1 `AppShell.tsx`
```tsx
<div className="app-shell">
  <NavRail />
  <Sidebar />
  <div className="app-shell__main">{children}</div>
</div>
```
- `position: fixed; inset: 0` with a flex row. `main` is `flex: 1; min-width: 0; overflow: hidden`.
- Mobile/tablet behavior: rail collapses to 72px below `$screen-lg`; sidebar overlays the main area like today (`leftSidebarOpen` from `ResponsiveLayoutProvider` keeps working).

### 7.2 `NavRail.tsx`
- Items array as in table above; filter out Farcaster + Wallet for now.
- Renders `RailItem` rows; bottom area has collapse toggle + 1px divider + user avatar row.
- User avatar row → opens `usersettingsmodal` via `useModals().openUserSettings()` (verify exact API in `ModalProvider`).
- No FAVORITES section yet — leave a code comment with `TODO: FAVORITES — depends on favorites feature`.

### 7.3 `RailItem.tsx`
- Props: `{ icon, label, active, collapsed, onClick, badge? }`.
- Active state: vertical accent bar (3px × 24px) at the left edge + icon tinted `var(--accent)` + label `font-weight: 600`. **No background fill.**
- Hover: full-bleed `var(--color-bg-rail-hover)`, no radius, no inset.
- Collapsed: render `<RailTooltip>` on hover.

### 7.4 `Sidebar.tsx`
Decides which sidebar to render based on URL:
```tsx
if (pathname.startsWith('/messages')) return <DmSidebar collapsed={sidebarCollapsed} />;
if (pathname.startsWith('/spaces/') && spaceId) return <ChannelsSidebar />;  // no collapse
if (pathname.startsWith('/spaces')) return <SpacesSidebar collapsed={sidebarCollapsed} />;
return null;
```

### 7.5 `SidebarHeader.tsx`
- 56px tall, 1px bottom border, title + action icons (`search`, `user-plus` or `plus`) + collapse toggle on the right.
- **No search input field** — search is an icon that opens an inline search input (reuse `ListSearchInput` from `src/components/ui` — already used in `DirectMessageContactsList`).

### 7.6 `DmSidebar.tsx`
- Reuse `DirectMessageContactsList` rendering, but the wrapping `<SidebarHeader title="Direct messages" actions={['search', 'user-plus']}>` replaces the existing header inside the list. Plan: extract the list-only piece (rows + empty state) from `DirectMessageContactsList` into a `DmList` body, and let the sidebar provide the header chrome.
- Active row: full-bleed background = `var(--color-bg-sidebar-active-accent)` + accent vertical bar at left edge.
- Hover: `var(--color-bg-sidebar-hover)`, full-bleed, no radius.
- Collapsed (72px): avatar-only strip with unread dot badge + tooltips on hover.

### 7.7 `SpacesSidebar.tsx`
- Header: title "Spaces" + `search` + **`+` icon → `showAddSpaceModal()`** (this is where the existing AddSpace/CreateSpace flow lives, per handoff "where to put this?" note).
- Rows: square avatar (42px, `border-radius: $rounded-md`) · name + timestamp · `users` icon + member count (number only, no "members" label) · unread badge.
- Data source: `useSpaces({})` (already in `NavMenu`). Member count from `space.memberCount` or whatever the existing list uses (verify when wiring).
- Active row + hover + collapsed: same rules as DM sidebar (collapsed shows square-icon strip).

### 7.8 `ChannelsSidebar.tsx`
- Section 2c says "maintains pretty much the current layout and style." → import / mount the existing channel-list panel from `Space.tsx`. No collapse toggle.
- **Back-to-spaces-list nav** (decided 2026-06-02 — see `back-to-spaces-refined.html`):
  - Banner is the primary UI for back nav. Three elements overlaid on the banner image with translucent dark backdrops:
    - **Top-left: back arrow** (`arrow-left`) → navigates to `/spaces`. Visible at all banner sizes.
    - **Top-right: settings** (`adjustments`) — current behavior.
    - **Bottom-left: space name** — current behavior.
  - **No header row above the banner** (avoids name duplication, saves vertical space).
  - **Shrinking banner clamps at 72px minimum** (2-row state) so all three elements stay visible while scrolling. If the existing banner already shrinks-on-scroll, just adjust the min height. If it doesn't, defer that polish — the back arrow stays anchored at the top regardless.
  - **Rail "Spaces" item re-click also returns to the spaces list** (secondary muscle-memory path). When the user is inside a space (`/spaces/:spaceId/:channelId`):
    - Rail item stays visually active (accent bar + tinted icon).
    - Clicking it navigates to `/spaces` → sidebar swaps back to spaces list.
    - Tooltip text becomes "Back to spaces list" (vs "Spaces" elsewhere). Implement by passing a dynamic label to the `RailItem` based on `useLocation()`.
  - Both paths land on the same route — no special state to manage.

### 7.9 `RailTooltip.tsx`
- Light tooltip: white bg (`var(--color-bg-tooltip)`), 1px border (`var(--color-border-default)`), dark text, small shadow, arrow on the left. Position: absolute, right of the rail item. Could reuse `Tooltip` primitive if it supports this style; otherwise build a thin local component (handoff spec is explicit and slightly custom).

---

## 8. Build sequence (smallest verifiable steps)

1. **Tokens first** — add `_variables.scss` + `_colors.scss` additions. Build, no visible change.
2. **`useShellState` hook** + unit-mental-test in isolation.
3. **`AppShell` skeleton** — three empty divs with correct widths and borders. Drop it in `Layout.tsx` behind a feature-flag-style boolean (`const USE_NEW_SHELL = true;` constant at top of `Layout.tsx` for now). When false → old `<NavMenu>`. When true → `<AppShell>`. Flip on locally to verify layout math.
4. **`NavRail` (expanded only)** — primary items + active state derived from URL + click → navigate. No collapse toggle yet. No user/settings row yet.
5. **`NavRail` collapse toggle + tooltips + persistence** via `useShellState`.
6. **`NavRail` bottom row** — collapse toggle + divider + user avatar → settings modal.
7. **`Sidebar` slot + `DmSidebar`** — extract `DmList` body from current `DirectMessageContactsList`, render under new `SidebarHeader`. Verify DM flow end-to-end.
8. **`SpacesSidebar`** — basic list, "+" header button wires to `showAddSpaceModal`. Verify creating a space still works.
9. **`ChannelsSidebar`** — reuse existing channel panel, mount when route is `/spaces/:spaceId/:channelId`.
10. **Sidebar collapsed state** for DM + Spaces — avatar-only strip + tooltips.
11. **Mobile/tablet behavior** — rail forced collapsed below `$screen-lg`; sidebar overlay reuses existing `leftSidebarOpen` mechanism.
12. **Flip the flag on by default**, manual smoke test (light + dark + accent-purple at minimum).
13. **Remove old `NavMenu` / `ExpandableNavMenu` / dead styles** in a separate commit on the same branch.

Each step ends with `yarn lint && npx tsc --noEmit --jsx react-jsx --skipLibCheck` clean, and the dev server still renders.

---

## 9. Decisions + verified facts

**Decisions (confirmed 2026-06-02):**
- **Spaces sidebar — keep folders + DnD.** Reuse `useFolderDragAndDrop`, `useNavItems`, `FolderContainer` from the current `NavMenu` so user folder data and reorder behavior survive. Apply the new row visuals (square avatar 42px, name + timestamp, `users` icon + member count, unread badge) without changing the list structure.
- **"Public spaces" rail item → `/spaces?tab=discover`.** Reuses the existing `Discover` tab in `SpacesPage`. The sidebar for that section can be empty for now (or mirror the discover content later — out of scope for this task).

**Verified by code exploration (2026-06-02):**
- **UserSettingsModal API**: `const { openUserSettings } = useModals();` from `src/components/context/ModalProvider`. Real call site: [src/components/navbar/ExpandableNavMenu.tsx:55](../../src/components/navbar/ExpandableNavMenu.tsx#L55).
- **AddSpaceModal API**: currently NOT in `ModalProvider` context — `showAddSpaceModal` is owned by `useModalManagement` (Layout scope) and prop-drilled down to `NavMenu`. **Plan adjustment**: as part of step 8, lift `showAddSpaceModal` into `ModalProvider` so the new `SpacesSidebar` can call `useModals().showAddSpaceModal()` consistently. Small, well-scoped refactor.
- **ChannelList is already standalone**: [src/components/space/ChannelList.tsx](../../src/components/space/ChannelList.tsx), single prop `{ spaceId: string }`. Mount from `ChannelsSidebar` with `<ChannelList spaceId={spaceId} />`. The space banner is inline inside `ChannelList` (lines 137-152), not separately extractable — we'll modify it in place to add the back arrow.
- **Member count is derived, not a field**: use `useSpaceMembers({ spaceId }).data?.length ?? 0`. Pattern already used in [src/components/spaces-page/MySpacesTab.tsx:25-32](../../src/components/spaces-page/MySpacesTab.tsx#L25).
- **Banner shrink-on-scroll already implemented** by `useCollapsingHeader` ([src/hooks/business/channels/useSpaceHeader.ts:64-143](../../src/hooks/business/channels/useSpaceHeader.ts#L64)). Current range: `HEADER_MAX_HEIGHT` 132px → `HEADER_MIN_HEIGHT` 48px. **Plan adjustment**: bump `HEADER_MIN_HEIGHT` from 48 → 72px so the new 3-element banner (back arrow top-left, settings top-right, name bottom) stays readable. Verify it doesn't break the chat header alignment that uses `$header-height: 49px`.
- **Settings icon already overlaid** on the banner at `z-10` ([ChannelList.tsx:159-172](../../src/components/space/ChannelList.tsx#L159)).

---

## 10. Risk notes

- The current `NavMenu` is doing a lot (DnD, folder context menus, mention/reply/unread counts). The new `SpacesSidebar` needs to keep all of that working. Plan keeps DnD intact by reusing the same hooks (`useFolderDragAndDrop`, `useNavItems`, etc.) just rendered with the new row shape.
- `Layout.tsx` currently sets `<main class="main-content nav-hidden">` based on `navMenuOpen`. The new shell will need an equivalent `nav-hidden` toggle so existing chat-area CSS rules that key off `.main-content.nav-hidden` keep working on mobile. Easiest: keep the `nav-hidden` class on `main` in AppShell.
- Tab order / a11y: rail items must be focusable, `aria-current="page"` on the active one, sidebar headers should have proper landmark roles. Standing accessibility rule applies (per AGENTS.md).

---

---

## Post-launch follow-ups

- **Drag-to-resize sidebar edge** — once the shell is shipped, add a draggable right edge on the AppShell sidebar slot for custom widths. Compose on top of the existing collapse toggle (toggle stays as primary affordance, drag adds spatial fine-tuning). Snap zones: snap to 72px below ~130px (auto-collapse), free width 200-400px otherwise. Persist actual pixel width in localStorage. Discord / VSCode / Slack desktop pattern.

*Last updated: 2026-06-02*
