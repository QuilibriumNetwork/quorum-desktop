---
type: task
title: "Unified /spaces page (PR 1 of 2) — My Servers tab + Discover tab"
status: ready
created: 2026-06-01
updated: 2026-06-01
candidate: "#1 (port-from-mobile)"
mobile-source: quorum-mobile master 0fa63d4 (2026-05-30)
shared-source: quorum-shared master 9d1c08f (2026-05-30)
---

# Unified `/spaces` page — PR 1 of 2

> **PR 1 of a committed two-PR plan.** Ship a new top-level `/spaces` route with the four-tab IA in place but only the two browsing tabs populated: **My Servers** + **Discover**. PR 2 (next session, committed within ~2-4 weeks of PR 1) fills in the **Join via link** + **Create space** tabs and retires `AddSpaceModal`, `CreateSpaceModal`, and the navbar `+` button.

## Mobile source (for Discover tab)

- [`app/(tabs)/spaces/discover.tsx`](../../../../quorum-mobile/app/(tabs)/spaces/discover.tsx) — screen, ~284 LOC
- [`hooks/chat/useExploreSpaces.ts`](../../../../quorum-mobile/hooks/chat/useExploreSpaces.ts) — hook, ~85 LOC
- [`services/api/quorumClient.ts`](../../../../quorum-mobile/services/api/quorumClient.ts) lines 67-84 (`DirectoryEntry`, `DirectoryResponse` types) + lines 869-884 (`exploreSpaces` method)

## Why

Two intertwined motivations:

1. **Capability gap:** desktop has no public space directory. `JoinSpaceModal` (used by `InviteRoute` for deep-link invite URLs) and `AddSpaceModal` (paste-invite + create combo, opened from navbar `+`) are invite-link-only. New users have nothing to do until they receive an invite.
2. **Surface consolidation:** desktop's space management is fragmented across three modals (`AddSpaceModal`, `JoinSpaceModal`, `CreateSpaceModal`) producing a confusing "which modal do I want?" mental model. A unified `/spaces` page becomes the single canonical hub for everything space-related from outside-a-space.

PR 1 ships the foundation + the browsing experience. PR 2 ships creation/join-by-link inside the same page and cleans up the legacy modals.

## Capability verification (done 2026-06-01)

- No `directory`, `discover`, `explore`, `browseSpaces`, `publicSpaces`, `catalog`, `exploreSpaces`, `DirectoryEntry`, or `getDirectory` references in `src/` outside i18n files.
- `JoinSpaceModal` + `AddSpaceModal` both flow through `useInviteValidation` → `useSpaceJoining`. No alternative discovery entry point exists.
- "My Servers" grid view (your spaces shown as cards) does not exist anywhere on desktop today — the navbar sidebar is the only existing list.

## Locked decisions

All decisions resolved across 2026-06-01 design conversation.

### 1. Architecture: dedicated route at `/spaces` ✅
Not a modal. Page needs real estate for grid + tabs + filters; modal would be cramped.

### 2. Navbar entry point: `icon-layout-grid-add` button at top of space list ✅
Already exported from `@quilibrium/quorum-shared`. **PR 1: added alongside the existing `+` button** (both coexist). PR 2: the `+` button is removed and this becomes the sole entry point.

### 3. Tab IA: four tabs ✅
`My Servers` (default) · `Discover` · `Join via link` · `Create space`

Reasoning: once we commit to "the page is the hub for everything", routing buttons to legacy modals is a half-measure. All four major space actions should live as page-level destinations. 4 tabs is at the upper bound of "still scannable" but is the right cardinality given the commitment.

### 4. PR 1 ships tabs 1 + 2 only ✅
**My Servers** + **Discover** ship in PR 1. **Join via link** + **Create space** are NOT in PR 1 — neither the tabs nor the tab content. (No "Coming soon" stubs either.)

### 5. PR 2 commitment ✅
PR 2 ships within ~2-4 weeks of PR 1 and adds the remaining two tabs + retires `AddSpaceModal` and `CreateSpaceModal` + removes the navbar `+` button. User confirmed commitment 2026-06-01.

### 6. Category list: verbatim from mobile (7 categories) ✅
`community`, `gaming`, `tech`, `crypto`, `social`, `education`, `other`. Server already supports these.

### 7. Shared promotion of wire types: yes ✅
`DirectoryEntry`, `DirectoryResponse`, `SpaceCategory` to `@quilibrium/quorum-shared`. Additive only. Mobile keeps working unchanged. Drop a mobile task in `mobile-tasks-pending.md` for the lead dev to swap mobile's local types when convenient.

### 8. `reportSpace` directory-level abuse flag: skip ✅
Out of scope per the broader reporting deprioritization.

### 9. Mock data semantics: replace real data when mocks active ✅
When `?spaces=N` URL param OR `localStorage.debug_mock_spaces === 'true'` is set in dev, the `/directory` fetch is skipped entirely and `useExploreSpaces` returns generated mocks (with client-side filtering by `search` + `category` so the UI behaves identically). Matches the existing `?users=N` pattern in `DirectMessageContactsList`.

### 10. Both tabs use the same shape: search input + `<Select>` filter dropdown ✅

Both tabs share an identical header row: search input on the left, a `<Select>` filter dropdown on the right. The filter's content is what differs:
- **Discover:** category dropdown (8 entries: "All categories" + 7 server-defined categories)
- **My Servers:** folder dropdown (1 + N entries: "All folders" + user's existing navbar folders)

Rationale: matches the established desktop pattern used in `BookmarksPanel.tsx` and `DirectMessageContactsList.tsx` (both use `<Select>` for filtering alongside a search input). Multiple alternatives were considered and rejected:
- Chip row below tabs: visual collision (two stacked pill-rows look alike)
- Left-rail sidebar (Discord-style): inconsistent across tabs because the dimensions are different scales; adds chrome that the existing app doesn't use; creates a "two folder UIs" risk on My Servers
- Search-only with no filter: 7 categories + folders are real filter dimensions worth surfacing
- Filter-icon button: less discoverable for first-time users; existing app pattern is actually `<Select>`, not filter-icon

**Folder dropdown semantics on My Servers** (important to avoid the two-UI confusion the user raised):
- Folder dropdown is **READ-ONLY** filter view. It lists folders for filtering only.
- Folder creation, edit, reorder, drag-and-drop all stay in the navbar — the canonical organize surface.
- Selecting a folder filters the grid to spaces in that folder. Selecting "All folders" shows all.
- If the user has no folders, the dropdown still renders with just the "All folders" entry (for layout consistency across users).
- The dropdown options reflect the navbar's folder structure live — no separate state.

Marked as "play with it a bit"; if discovery / find-a-server feels awkward in practice, swap to a different filter affordance in a follow-up.

### 11. "My Servers" tab in PR 1: search + folder filter dropdown ✅
- Grid of cards (icon, name, member count, owner badge if applicable)
- "Find a server" client-side search input + folder filter dropdown (see decision #10)
- No "Sort by Last active" (desktop has no per-space last-activity data)
- No online-count badge per card (desktop has no per-space presence aggregation)
- No "Hide muted servers" filter — covered by the folder dropdown structure if needed later, otherwise out of scope

### 12. Card design — side-by-side layout, no hero / banner area in PR 1 ✅

Card design resolved after iterating through hero-block options without a banner field on `DirectoryEntry`:

**Discover cards** (2-column grid at desktop widths):
```
┌──────────────────────────────────┐
│ ┌──┐  Space Name                  │
│ │ic│  Crypto · 1.2K members       │
│ └──┘  Two-line description excerpt│
│       that takes the rest of the  │
│       card width...               │
│                          [Join]   │
└──────────────────────────────────┘
```
Side-by-side layout (icon on the left, content on the right). No hero area, no banner placeholder. Cards are visually substantial because they carry meaningful content (description + category + member count + Join action) — that's enough differentiation from My Servers without inventing chrome.

**My Servers cards** (3-column grid at desktop widths):
```
┌──────────────────────────┐
│ ┌──┐ Space Name [👑]     │
│ │ic│ 1.2K members        │
│ └──┘                     │
└──────────────────────────┘
```
Compact side-by-side. No description (we don't track per-space metadata users care about here), no Join button (card clickable to enter space).

**Why this resolution:**
- We rejected color-hero-block (option 1) because the user's gut said it would look tacky
- We rejected naive icon enlargement because space icons are small symbol/logo assets that don't enlarge gracefully
- We rejected blocking on server-side banner field because that's external dependency with unknown timing
- Side-by-side layout is honest about the data we have. Content asymmetry between Discover (rich) and My Servers (compact) IS the visual differentiation; we don't need invented chrome

**Banner deferred for iteration after PR 1.** When the server adds a `banner` field to `DirectoryEntry` (see Phase 12 — mobile task drop), the Discover card design will be revisited. Banner could replace the side-by-side layout entirely (Discord-style hero card). Until then, side-by-side is the working design.

### 13. "Hide muted servers from sidebar" feature — bundled into PR 1 ✅

Desktop-original feature inspired by a Discord screenshot. Not a port from mobile (mobile has no "sidebar" to hide things from — flat tab-bar IA).

**Mental model shift this enables:**
- Navbar = high-priority view (your active spaces only, when the toggle is on)
- My Servers tab = full inventory (everything you've joined, including muted)

Reframes the relationship between the two surfaces from "same data, different layout" to "different signal density." Real product win.

**Capability verification (done 2026-06-01):**
- Per-space "is muted" is an explicit, persisted, synced concept on desktop today: `UserConfig.notificationSettings[spaceId].isMuted: boolean`
- Toggle handlers already exist via `useChannelMute` (lines 267-337) — it exposes `isSpaceMuted` derived value + `muteSpace` / `unmuteSpace` mutations
- Already consumed by `useReplyNotificationCounts` (muted spaces return 0 reply counts)
- "What counts as muted" is fully resolved — no design work needed for the underlying concept

**What this feature adds (the work of bundling into PR 1):**

1. **New `UserConfig` field** (shared additive PR — same PR as `DirectoryEntry` etc., or its own — decide during Phase 1):
   - `hideMutedSpacesFromSidebar?: boolean` (optional, defaults to `false` when unset)
2. **UI toggle** in the My Servers header — inline checkbox-style, mirroring the Discord screenshot pattern ("✓ Hide muted servers from sidebar")
3. **Navbar filter logic** — when toggle is on, filter the navbar's space list to exclude any space where `notificationSettings[spaceId]?.isMuted === true`
4. **Empty-state handling** in the navbar — if filter removes all spaces, the navbar still renders cleanly (just the `icon-layout-grid-add` button at top, no space icons)

**Why bundling into PR 1 makes sense even though PR 1 is already big:**
- The toggle naturally lives on the My Servers tab (which PR 1 already ships)
- All infrastructure exists — this is a config-field + UI-toggle + filter-condition addition, not new architecture
- Without this feature, My Servers and the navbar are visually redundant. WITH this feature, they have distinct purposes that justify both surfaces existing
- Estimated additional scope: ~150-200 LOC (shared field, toggle UI, navbar filter), spread across already-modified files

**Toggle UI placement on My Servers header:**

```
🔍 Find a server...   [ All folders  ▾ ]   ✓ Hide muted servers from sidebar
```

Inline at the right edge of the header row. Right-aligned. Persistent visual indicator of which mode the user is in.

**Default state:** `false` (matches today's behavior — all spaces visible in navbar). Feature is opt-in.

### 14. Banner field on `DirectoryEntry`: drop as a server-side task for the lead dev ✅

`DirectoryEntry` today carries `icon` but not `banner`. `Space.bannerUrl` exists in shared (uploaded via `SpaceSettingsModal.General.tsx`), but the `/directory` server endpoint doesn't surface it. To enable Discord-style hero cards in Discover (eventual goal, not PR 1), the server needs to add `banner` to the `DirectoryEntry` wire shape.

Phase 12 includes dropping a mobile task in shared-migration's `mobile-tasks-pending.md` requesting this server-side change. Doesn't block PR 1; benefits both apps when it ships.

## Cross-repo summary

- **quorum-shared**: additive PR (new exports: `DirectoryEntry`, `DirectoryResponse`, `SpaceCategory`). Self-merge after build verification.
- **quorum-desktop**: PR 1 — this task file. Consumes the shared types.
- **quorum-mobile**: not touched. Task drop in shared-migration's `mobile-tasks-pending.md` so the lead can swap mobile's local types for shared ones.

## Architecture

### Mobile pattern (reference, Discover only)

```
                  GET /directory?search=…&category=…&offset=…&limit=…
                                  │
              QuorumMobileClient.exploreSpaces(params)
                                  │
        useExploreSpaces() — React Query, 60s staleTime, 300ms debounce
                                  │
      DiscoverSpacesScreen (search input + category chips + FlatList + Join button)
```

### Desktop port (PR 1)

```
                Navbar (existing chrome unchanged in PR 1):
                ┌──────────────────────────────┐
                │  [icon-layout-grid-add]      │  ← NEW: links to /spaces
                │  ──────────────────          │
                │   [Space icon 1]              │
                │   [Space icon 2]              │
                │   ...                         │
                │   [Space icon N]              │
                │  ──────────────────          │
                │  [+ Add space]               │  ← UNCHANGED in PR 1 (opens AddSpaceModal)
                └──────────────────────────────┘

                Page at /spaces:
                ┌────────────────────────────────────────────────────────────┐
                │ [ My Servers ]  [ Discover ]                                │  ← tabs (only 2 in PR 1)
                ├────────────────────────────────────────────────────────────┤
                │                                                             │
                │  Tab content (see Tab content layouts below)                │
                │                                                             │
                └────────────────────────────────────────────────────────────┘
```

### Tab content layouts

**My Servers tab** (3-column compact grid):
```
┌────────────────────────────────────────────────────────────────────────┐
│ 🔍 Find a server...  [ All folders ▾ ]  ✓ Hide muted servers from sidebar│
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌──┐ Space A         ┌──┐ Space B [👑]   ┌──┐ Space C                  │
│ │ic│ 1.2K members    │ic│ 800 members     │ic│ 5.3K members            │
│ └──┘                 └──┘                 └──┘                          │
│                                                                         │
│ ┌──┐ Space D         ┌──┐ Space E         ┌──┐ Space F                  │
│ │ic│ 234 members     │ic│ 12K members     │ic│ 567 members             │
│ └──┘                 └──┘                 └──┘                          │
└────────────────────────────────────────────────────────────────────────┘
```

**Discover tab** (2-column side-by-side cards with descriptions):
```
┌────────────────────────────────────────────────────────────────────────┐
│ 🔍 Search public spaces...           [ All categories         ▾ ]      │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌────────────────────────────┐   ┌────────────────────────────┐         │
│ │ ┌──┐ Space A                │   │ ┌──┐ Space B                │        │
│ │ │ic│ Crypto · 1.2K members  │   │ │ic│ Tech · 800 members     │        │
│ │ └──┘ Two-line description    │   │ └──┘ Two-line description   │        │
│ │      excerpt of the space... │   │      excerpt of the space...│        │
│ │                     [Join]   │   │                     [Join]  │        │
│ └────────────────────────────┘   └────────────────────────────┘         │
│                                                                         │
│ ┌────────────────────────────┐   ┌────────────────────────────┐         │
│ │ ┌──┐ Space C                │   │ ┌──┐ Space D                │        │
│ │ │ic│ Gaming · 5.3K members  │   │ │ic│ Community · 234 members│        │
│ │ └──┘ Description...          │   │ └──┘ Description...         │        │
│ │                     [Join]   │   │                     [Join]  │        │
│ └────────────────────────────┘   └────────────────────────────┘         │
│                                                                         │
│                          [ Load more ]                                  │
└────────────────────────────────────────────────────────────────────────┘
```

The visual asymmetry between tabs is intentional: compact 3-col for utility (My Servers) vs richer 2-col side-by-side for browsing (Discover). Same chrome (search + filter Select), different card density per tab.

### Architecture diagram (data path)

```
                Discover tab                            My Servers tab
                     │                                       │
                     ▼                                       ▼
        useExploreSpaces()                           useSpaces() (existing)
        ↳ mock mode (dev): generateMockSpaces        ↳ also: useSpaceOwner per card
        ↳ real: QuorumApiClient.exploreSpaces                useSpaceMembers per card (count)
                     │                                       │
                     ▼                                       ▼
        getDirectoryUrl(params)                       (existing data only)
                     │
                     ▼
        GET /directory?...
```

## UX redesign rationale

Deliberate divergence from mobile UX. Mobile has a 5-tab bottom-nav where "Spaces" is one tab containing a `discover.tsx` screen. Desktop's existing space management is fragmented across three modals. The unified `/spaces` page is desktop's better fit because:

- Desktop has persistent sidebar chrome → a dedicated page works naturally; mobile's full-screen-list pattern doesn't translate
- Three currently-fragmented modals (`AddSpaceModal`, `JoinSpaceModal`, `CreateSpaceModal`) create a confusing mental model — a single page with sections is clearer
- A page hosts real list + filter chrome; modals would be cramped at this many features
- The `icon-layout-grid-add` icon at the top of the navbar gives discovery a stable, discoverable home

User confirmed (2026-06-01) this UX divergence is intentional and aligned with desktop product direction. No lead-dev coordination needed.

## File plan

### New files (PR 1)

| File | Purpose |
|---|---|
| `quorum-shared/src/types/directory.ts` (in shared) | `DirectoryEntry`, `DirectoryResponse`, `SpaceCategory` |
| `src/hooks/business/spaces/useExploreSpaces.ts` | Port of mobile's hook. Mock-mode aware. |
| `src/components/spaces-page/SpacesPage.tsx` (+ `.scss`) | Top-level route component. Tab shell + active-tab content router. |
| `src/components/spaces-page/MyServersTab.tsx` (+ `.scss`) | Grid of user's spaces + find-server search. |
| `src/components/spaces-page/DiscoverTab.tsx` (+ `.scss`) | Search input + category dropdown + results grid + Load more. |
| `src/components/spaces-page/SpaceCard.tsx` (+ `.scss`) | Shared card component used by both tabs. Variants for "my server" vs "public space". |
| `src/components/spaces-page/index.ts` | Barrel |
| `src/utils/mock/mockSpaces.ts` | `generateMockSpaces(count)`, `isMockSpacesEnabled()`, `getMockSpacesCount()`. Matches `mockConversations.ts` / `mockUsers.ts` pattern. |

### Modified files (PR 1)

| File | Change |
|---|---|
| `quorum-shared/src/types/index.ts` | Barrel export of `directory.ts` |
| `quorum-shared/src/index.ts` | Top-level export |
| `quorum-shared/src/types/user.ts` (or wherever `UserConfig` lives) | Add optional `hideMutedSpacesFromSidebar?: boolean` field to `UserConfig` |
| `src/api/quorumApi.ts` | Add `getDirectoryUrl(params)` URL builder (mirrors `getSpaceUrl` pattern) |
| `src/api/baseTypes.ts` | Add `async exploreSpaces(params): Promise<DirectoryResponse>` method on `QuorumApiClient`. Import types from `@quilibrium/quorum-shared`. |
| `src/hooks/business/spaces/index.ts` | Barrel export for `useExploreSpaces` |
| `src/components/Router/Router.web.tsx` | Add `<Route path="/spaces" element={<SpacesPage />} />` |
| `src/components/Router/Router.native.tsx` | Equivalent route (TBD — confirm during implementation; likely vestigial) |
| `src/components/navbar/NavMenu.tsx` (or wherever the navbar renders the space list) | (a) Add `icon-layout-grid-add` button at top of space list. DO NOT remove existing `+` button. (b) Filter the space-list rendering by `!isSpaceMuted(spaceId)` when `UserConfig.hideMutedSpacesFromSidebar === true`. |
| `src/utils/mock/index.ts` | Export the new `mockSpaces` module |

### Untouched in PR 1 (retired in PR 2)

- `src/components/modals/AddSpaceModal.tsx` — left alone (retired PR 2)
- `src/components/modals/CreateSpaceModal.tsx` — left alone (retired PR 2, content lifted into Create space tab)
- `src/components/modals/JoinSpaceModal.tsx` — left alone (kept permanently for `InviteRoute` deep-link handling)
- `src/components/InviteRoute.tsx` — left alone permanently
- The existing navbar `+` button — left alone (removed in PR 2)

## Deep-link `InviteRoute` boundary

Explicit non-goal: PR 1 and PR 2 both do NOT touch the deep-link invite-URL handler (`src/components/InviteRoute.tsx` + `JoinSpaceModal`). When someone clicks `app.quorummessenger.com#join=...` outside the app, that flow still works exactly as today via `InviteRoute`. The "paste an invite link" surface that migrates into the `/spaces` page in PR 2 is specifically the in-app paste-invite tab inside `AddSpaceModal` — a different code path from the deep-link handler.

## PR 2 scope (NOT this PR — committed for follow-up)

Will be a separate task file in a later session.

1. Build **Join via link** tab — lift validation + join logic from `AddSpaceModal`'s paste-invite section
2. Build **Create space** tab — lift the full creation form from `CreateSpaceModal` (form rendered directly on the tab; no intermediate landing card)
3. Retire `AddSpaceModal` (the combo paste-invite + create modal)
4. Retire `CreateSpaceModal` (content lifted into Create space tab)
5. Remove the navbar `+` button (now redundant — `icon-layout-grid-add` is the canonical entry point)
6. Keep `JoinSpaceModal` and `InviteRoute` alive permanently for deep-link handling

## Implementation phases

### Phase 1 — Shared types (additive shared PR)

- [ ] Create `quorum-shared/src/types/directory.ts` with `DirectoryEntry`, `DirectoryResponse`, `SpaceCategory` (verbatim from mobile's `quorumClient.ts` lines 67-84 + `SPACE_CATEGORIES` enum from mobile's `useExploreSpaces.ts` lines 13-24)
- [ ] Barrel exports: `quorum-shared/src/types/index.ts` + `quorum-shared/src/index.ts`
- [ ] Add `hideMutedSpacesFromSidebar?: boolean` to `UserConfig` (find the existing `UserConfig` type in shared `src/types/user.ts` or similar and extend it — purely additive optional field, no breaking change to mobile)
- [ ] `yarn build` in `quorum-shared/`; confirm types emitted in `dist/`
- [ ] Bump shared version (next `2.1.0-NN`)
- [ ] Open shared PR (additive — see [shared-migration cross-repo-workflow.md](../quorum-shared-migration/cross-repo-workflow.md))
- [ ] Self-merge shared PR (library-only changes; no smoke test required)
- [ ] Verify desktop picks up new exports via `link:` symlink

### Phase 2 — Desktop API surface

- [ ] Add `getDirectoryUrl(params)` to `src/api/quorumApi.ts`, mirroring `getSpaceUrl` pattern with query-string assembly
- [ ] Add `async exploreSpaces(params): Promise<DirectoryResponse>` method on `QuorumApiClient` in `src/api/baseTypes.ts`, mirroring `getSpace` / `getInbox` patterns at lines 350/360
- [ ] Import `DirectoryEntry` / `DirectoryResponse` / `SpaceCategory` from `@quilibrium/quorum-shared`
- [ ] `npx tsc --noEmit --jsx react-jsx --skipLibCheck` clean

### Phase 3 — Mock fixture

- [ ] Create `src/utils/mock/mockSpaces.ts` matching the established pattern (`mockConversations.ts` / `mockUsers.ts`):
  - [ ] Cycling arrays: `MOCK_SPACE_NAMES` (~25 entries with realistic variety), `MOCK_SPACE_DESCRIPTIONS` (~15 entries multi-language like `MOCK_PREVIEWS`), `MOCK_SPACE_ICONS` (small set of placeholder data URLs or empty strings to trigger initials fallback in `SpaceIcon`)
  - [ ] `generateMockSpaces(count)` returns `DirectoryEntry[]` with cycling name/description, deterministic per-index category assignment (cycle through all 7 categories so each is represented), random member counts in realistic ranges (5-5000)
  - [ ] `isMockSpacesEnabled()` checks `NODE_ENV === 'development'` AND (`localStorage.debug_mock_spaces === 'true'` OR `?spaces=N` URL param present)
  - [ ] `getMockSpacesCount()` reads `?spaces=N` or `localStorage.debug_mock_spaces_count`, default 30
- [ ] Export from `src/utils/mock/index.ts`
- [ ] TypeScript check clean

### Phase 4 — useExploreSpaces hook

- [ ] Create `src/hooks/business/spaces/useExploreSpaces.ts`
- [ ] Port from mobile's hook. Drop RN imports.
- [ ] Mock-mode integration: when `isMockSpacesEnabled()`, skip the React Query fetch entirely and return generated mocks. Apply `search` + `category` filters client-side over the mock list so UI behaves identically to real mode.
- [ ] Match mobile's return shape: `{ entries, total, hasMore, isLoading, error, search, setSearch, category, setCategory, loadMore, refetch, offset }`
- [ ] 300ms search debounce, 60s React Query staleTime
- [ ] Add to `src/hooks/business/spaces/index.ts` barrel
- [ ] TypeScript check clean

### Phase 5 — Spaces page shell + tab navigation

- [ ] Create `src/components/spaces-page/SpacesPage.tsx` — top-level route component:
  - [ ] Tab state managed locally with `useState` (or URL query param like `?tab=discover` if we want deep-linkable tabs — consider during implementation)
  - [ ] Two tab buttons rendered: "My Servers" (default active) + "Discover"
  - [ ] Active tab content rendered below: `<MyServersTab />` or `<DiscoverTab />`
- [ ] Use existing primitives (no new tab component if `<Button>` or existing nav components suffice; otherwise add a minimal `<Tabs>` primitive — coordinate with primitives barrel)
- [ ] Page-level header / title, Lingui-localized

### Phase 6 — SpaceCard shared component

- [ ] Create `src/components/spaces-page/SpaceCard.tsx` — shared card with two variants:
  - [ ] `variant="my-server"` (compact, side-by-side icon + content):
    - Icon (left), name + member count + owner badge (right)
    - Whole card clickable to navigate into the space
    - Used in 3-column grid on My Servers tab
  - [ ] `variant="public"` (richer, side-by-side icon + content with description):
    - Icon (left), name + category badge + member count + 2-line description excerpt + Join button (right)
    - Join wires to `useSpaceJoining`
    - Used in 2-column grid on Discover tab
- [ ] Use existing `SpaceIcon` component for the icon area
- [ ] Use `formatMemberCount` from `@quilibrium/quorum-shared` (don't reimplement; mobile reimplements it inline at line 30 of `discover.tsx`)
- [ ] Description truncation: 2 lines max, CSS line-clamp + ellipsis. Tooltip with full description on hover (existing `<Tooltip>` primitive).
- [ ] **No hero area, no banner placeholder in PR 1** — side-by-side layout for both variants. When server adds `banner` field to `DirectoryEntry`, revisit the `variant="public"` shape (likely promote to a Discord-style hero card).

### Phase 7 — My Servers tab

- [ ] Create `src/components/spaces-page/MyServersTab.tsx`
- [ ] Data: existing `useSpaces()` for the spaces list. For each card: `useSpaceOwner` + `useSpaceMembers` (or whatever existing hook gives the count cheaply)
- [ ] Top row layout: "Find a server" `<Input>` (max-width matches Discover's search) on the left, `<Select>` folder filter dropdown in the middle, `<Switch>` or checkbox-style toggle "Hide muted servers from sidebar" on the right
- [ ] Folder filter dropdown options:
  - Top entry: "All folders" (no filter applied)
  - Then user's existing folders from `useFolderManagement` / `useFolderStates` (whichever exposes the folder list cleanly)
  - **Read-only filter view** — folder creation/edit/reorder still happens in the navbar; this dropdown only filters the grid
  - If user has no folders, dropdown renders with just "All folders" entry (still rendered for layout consistency)
- [ ] "Hide muted servers from sidebar" toggle:
  - Reads `UserConfig.hideMutedSpacesFromSidebar` (defaults to `false` when unset)
  - On toggle, writes back to `UserConfig` via the existing config-save flow (find the existing pattern by reading how other `UserConfig` fields are mutated — e.g. `notificationSettings`, `mutedChannels`)
  - Lingui-localized label
  - State change immediately reflects in the navbar (Phase 9)
- [ ] Client-side filter: combine name-match from search + folder match from filter dropdown (the "hide muted" toggle doesn't filter this grid — only the navbar; My Servers tab is the full inventory)
- [ ] Grid: 3 columns at desktop widths (xl+), 2 at medium (md-lg), 1 at narrow (sm). Use `SpaceCard variant="my-server"`.
- [ ] Empty state if no spaces ("No spaces yet — discover public spaces or paste an invite link" — but no buttons routing to those tabs in PR 1 since they don't exist yet)
- [ ] Lingui i18n on all copy

### Phase 8 — Discover tab

- [ ] Create `src/components/spaces-page/DiscoverTab.tsx`
- [ ] Top row mirrors My Servers structurally: search `<Input>` (max-width ~`max-w-md`) on the left, category `<Select>` dropdown on the right
- [ ] Category dropdown options: "All categories" + the 7 categories (use the shared `SpaceCategory` enum, Lingui-localize the labels)
- [ ] Results grid: 2 columns at desktop widths (xl+), 1 at medium/narrow. Use `SpaceCard variant="public"`.
- [ ] "Load more" button at the bottom of the grid when `hasMore` is true
- [ ] Join action wired through existing `useSpaceJoining`
- [ ] Empty state ("No spaces match your search")
- [ ] Loading state (skeleton cards or spinner)
- [ ] Error state with retry
- [ ] Accessibility: `aria-label` on search + dropdown, focus management, keyboard navigation

### Phase 9 — Router + navbar entry point + navbar mute filter

- [ ] Add `<Route path="/spaces" element={<SpacesPage />} />` in `src/components/Router/Router.web.tsx`
- [ ] Check `Router.native.tsx` — if vestigial (per workflow doc), skip; otherwise mirror
- [ ] Add `icon-layout-grid-add` button at top of navbar space list — wire as a `<Link to="/spaces">` (or whatever navigation primitive desktop uses elsewhere)
- [ ] Selected state when on `/spaces`
- [ ] Style to match existing space-icon sizing/spacing
- [ ] DO NOT remove the existing `+` button — it stays in PR 1
- [ ] **Navbar mute filter wiring** (the "Hide muted servers from sidebar" feature):
  - [ ] Read `UserConfig.hideMutedSpacesFromSidebar` (defaults to `false` when unset)
  - [ ] When `true`, filter the rendered space list in the navbar to exclude any space where `notificationSettings[spaceId]?.isMuted === true`. Use `useChannelMute`'s `isSpaceMuted(spaceId)` helper if it's exported, or inline the check
  - [ ] Empty-state in navbar: if filter removes all spaces, navbar still renders cleanly (icon-layout-grid-add + `+` button + folders structure, just no space icons in between). Avoid a "broken-looking" empty navbar by not removing any chrome — only the space icons go
  - [ ] Folders containing only muted spaces: hide the folder entirely (don't show empty folders). Verify folder rendering logic handles a zero-children folder gracefully
  - [ ] Live update: toggling the My Servers checkbox immediately reflects in the navbar (no page reload). React Query / `UserConfig` reactivity should handle this if existing patterns are followed

### Phase 10 — Styling pass

- [ ] SCSS files for `SpacesPage`, `MyServersTab`, `DiscoverTab`, `SpaceCard` use the project's `_variables.scss` tokens
- [ ] No `@apply` per project styling rules (use raw CSS where Tailwind utilities are insufficient)
- [ ] No em dashes in user-facing copy (Italian/English/Lingui copy applies)
- [ ] Mobile-first sizing: minimum 44px touch targets, `text-sm` minimum for descriptions
- [ ] Run `style-guide` skill or load it before any new SCSS to confirm token usage

### Phase 11 — Verification

- [ ] TypeScript clean: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
- [ ] Lint clean: `yarn lint`
- [ ] Format check: `yarn format`
- [ ] Build clean: `yarn build`
- [ ] Smoke test in dev (`yarn dev`):
  - [ ] Activate mocks via `?spaces=30` URL param
  - [ ] Navbar shows `icon-layout-grid-add` at top of space list
  - [ ] Clicking it navigates to `/spaces`
  - [ ] `/spaces` opens on "My Servers" tab by default
  - [ ] My Servers shows the user's actual spaces (zero or more — verify with multiple accounts if possible)
  - [ ] Find-server search filters the My Servers grid by name
  - [ ] Folder filter dropdown lists user's existing folders + "All folders" entry. Selecting a folder filters the grid.
  - [ ] Owner badge appears on spaces the user owns (if any in the test account)
  - [ ] "Hide muted servers from sidebar" toggle starts in OFF state for a fresh user
  - [ ] Muting a space in `SpaceSettingsModal` → My Servers grid still shows it (My Servers is full inventory regardless of toggle state)
  - [ ] Turning the toggle ON → navbar immediately hides that muted space (live update, no reload)
  - [ ] Turning the toggle OFF → muted space reappears in navbar
  - [ ] Toggle state persists across page reload (synced via `UserConfig`)
  - [ ] Folders containing only muted spaces are hidden from navbar when toggle is ON
  - [ ] Folders with mixed muted + non-muted spaces show only non-muted children when toggle is ON
  - [ ] Clicking the Discover tab switches to Discover content
  - [ ] Discover shows 30 mock spaces spread across categories
  - [ ] Discover search debounces, filters mocks by name
  - [ ] Category dropdown filters mocks to selected category
  - [ ] "Load more" appears and works if mock count exceeds page size
  - [ ] Clicking "Join" on a public-space card triggers `useSpaceJoining` (may fail gracefully on mock data — verify error path is reasonable)
  - [ ] Existing navbar `+` button still works exactly as before (opens `AddSpaceModal`, both paste-invite and create flows unchanged)
  - [ ] Existing deep-link invite URL handler still works (`#join=...` URL → `InviteRoute` opens `JoinSpaceModal`)
  - [ ] Direct navigation to `/spaces#discover` or `?tab=discover` (if implemented) lands on Discover
  - [ ] Tab switching is keyboard-accessible
  - [ ] No regressions in existing space list, channel views, DM views

### Phase 12 — Mobile task drops (two related tasks for the lead dev)

**Task drop 1 — Shared promotion follow-up:**
- [ ] Create task file at `quorum-mobile/.agents/tasks/quorum-shared-migration/2026-XX-XX-adopt-shared-directory-types.md` (gitignored — local artifact for the lead dev)
- [ ] Add a row to [`../quorum-shared-migration/mobile-tasks-pending.md`](../quorum-shared-migration/mobile-tasks-pending.md): "Adopt shared `DirectoryEntry` / `DirectoryResponse` / `SpaceCategory` (shared `2.1.0-NN`)"
- [ ] Task should describe: swap mobile's local `DirectoryEntry`/`DirectoryResponse` types in `services/api/quorumClient.ts` lines 67-84 for imports from `@quilibrium/quorum-shared`. Pure swap, no behavior change, statically verifiable.

**Task drop 2 — Server-side `banner` field on `DirectoryEntry`:**
- [ ] Create task file at `quorum-mobile/.agents/tasks/quorum-shared-migration/2026-XX-XX-add-banner-to-directory-entry.md`
- [ ] Add a row to [`../quorum-shared-migration/mobile-tasks-pending.md`](../quorum-shared-migration/mobile-tasks-pending.md): "Add `banner` field to `DirectoryEntry` server response (enables hero-card design on Discover)"
- [ ] Task should describe: Quorum spaces have `bannerUrl` (uploaded via `SpaceSettingsModal.General.tsx`, present on the shared `Space` type at `quorum-shared/src/types/space.ts:71`). The `/directory` server endpoint currently returns `icon` but not `banner` on `DirectoryEntry`. Request: add `banner` (or `banner_url`) field to the server's `DirectoryEntry` response, source from the space's existing `bannerUrl`. When this ships, both desktop and mobile will be able to render Discord-style hero cards on their Discover surfaces instead of the current side-by-side fallback design. Additive shared PR follows (extend `DirectoryEntry` type), then each app's `<SpaceCard variant="public">` can be promoted to a hero shape.

- [ ] Run `python .agents/update-index.py` in mobile to regenerate INDEX after both task drops

## Done criteria (PR 1)

- [ ] All implementation phases above complete
- [ ] Smoke test passed in dev (with `?spaces=N` mock mode)
- [ ] User confirmed smoke test in PR review
- [ ] Shared PR self-merged before desktop PR opens
- [ ] Desktop PR self-merged (after user smoke-test confirmation)
- [ ] Mobile task dropped in `mobile-tasks-pending.md`
- [ ] Task file moved to `.done/`
- [ ] `shipped-log.md` updated with PR 1 entry
- [ ] PR 2 task file drafted before merging PR 1 (so the follow-up commitment has a concrete next step)
- [ ] Existing add/join/create flows still work unchanged (no regression)

## What this PR explicitly does NOT cover

- **PR 2 work**: Join via link tab + Create space tab + retire `AddSpaceModal` + retire `CreateSpaceModal` + remove navbar `+` button.
- **`reportSpace` directory-level abuse flag.** Out of scope per Reporting deprioritization.
- **Per-space online count.** Desktop has no presence aggregation; would be its own feature.
- **Per-space "last seen / last active".** Would require adding per-space activity tracking similar to mobile's `useSpaceActivity` (which we ruled out in the navbar context — would need re-evaluation if added here later).
- **Sort options on My Servers** (by last active / member count / alphabetical). Skipped in PR 1; revisit if useful in PR 2 or later.
- **`InviteRoute` deep-link flow.** Untouched permanently.
- **Mobile-side type swap.** Dropped as a task for the lead dev; not part of this PR.
- **Search ranking / fuzzy matching for Discover.** Server returns ranked results; we trust the server. Mock mode does naive substring match.
- **Real public spaces seeded on the server.** Out of our control; mocks make PR 1 testable without it.

## Open follow-ups surfaced during scoping

- Mobile's `useExploreSpaces` returns `total` but the screen doesn't display it. Decide during UI build whether to show "234 public spaces" header text or skip it.
- `Router.native.tsx` is likely vestigial (per the workflow doc, `.native.ts*` files in desktop are leftovers from when this repo was meant to be cross-platform). Confirm or skip during implementation.
- Tab state persistence: should the active tab be reflected in the URL (`/spaces?tab=discover`) so it's deep-linkable and survives reload? Probably yes — decide during Phase 5.
- "Search + filter Select" pattern flagged as "play with it a bit" — both tabs use it; if either feels wrong in practice, swap to a different filter affordance (chip row, sidebar, filter-icon-popover) in a follow-up.
- Description tooltip on hover: PR 1 truncates to 2 lines on Discover cards; long descriptions need a way to see the full text. Tooltip on hover is the planned approach (use existing `<Tooltip>` primitive) — verify during UI build that it doesn't conflict with cards being clickable.
- Hero / banner card redesign deferred until server adds `banner` field to `DirectoryEntry` (Phase 12 task drop 2). When that ships, revisit `SpaceCard variant="public"` for a Discord-style hero shape.

---

*Last updated: 2026-06-01 — extended to 14 locked decisions. Card design resolved (side-by-side, no hero, banner deferred via server-side task drop). Both tabs share the "search + `<Select>` filter" header pattern (Discover: category filter; My Servers: read-only folder filter). Card density asymmetry between tabs (2-col side-by-side on Discover, 3-col compact on My Servers) carries the visual differentiation. **"Hide muted servers from sidebar" feature bundled into PR 1** — new `UserConfig.hideMutedSpacesFromSidebar` field + toggle in My Servers header + navbar filter. Reframes navbar = high-priority view vs My Servers = full inventory. Capability fully verified: `notificationSettings[spaceId].isMuted` exists today, `useChannelMute` exposes the helpers. Ready to start Phase 1 in the next session.*
