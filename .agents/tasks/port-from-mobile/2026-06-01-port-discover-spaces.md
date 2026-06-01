---
type: task
title: "Port: Discover Spaces (public space directory) from mobile to desktop"
status: ready
created: 2026-06-01
updated: 2026-06-01
candidate: "#1 (port-from-mobile)"
mobile-source: quorum-mobile master 0fa63d4 (2026-05-30)
---

# Port: Discover Spaces

> Port mobile's public space directory ("Discover spaces") to desktop. Lets the user browse curated public spaces by category, search by name, and join without an invite link.

## Mobile source

- [`app/(tabs)/spaces/discover.tsx`](../../../../quorum-mobile/app/(tabs)/spaces/discover.tsx) — screen, ~284 LOC
- [`hooks/chat/useExploreSpaces.ts`](../../../../quorum-mobile/hooks/chat/useExploreSpaces.ts) — hook, ~85 LOC
- [`services/api/quorumClient.ts`](../../../../quorum-mobile/services/api/quorumClient.ts) lines 67-84 (`DirectoryEntry`, `DirectoryResponse` types) + lines 869-891 (`exploreSpaces`, `reportSpace` methods)

## Why

Capability gap: desktop currently has no way to discover spaces. `JoinSpaceModal` and `AddSpaceModal` are invite-link-only (paste link → validate → join). New users have nothing to do until they receive an invite. Mobile already ships a browse-by-category directory view that calls a server endpoint Quorum runs.

## Capability verification (done 2026-06-01)

Confirmed missing on desktop:
- No `directory`, `discover`, `explore`, `browseSpaces`, `publicSpaces`, `catalog`, `exploreSpaces`, `DirectoryEntry`, or `getDirectory` references anywhere in `src/` outside i18n files
- `src/components/modals/JoinSpaceModal.tsx` + `src/components/modals/AddSpaceModal.tsx` both flow through `useInviteValidation` → `useSpaceJoining`. No alternative entry point.

## Cross-repo summary

- **quorum-shared**: ⚠️ decision pending — `DirectoryEntry` + `DirectoryResponse` + `SpaceCategory` are good shared-promotion candidates (pure wire-shape types, both apps consume the same server endpoint). See [Open decisions](#open-decisions) #4.
- **quorum-desktop**: this PR (or PR stack if shared promotion happens)
- **quorum-mobile**: not touched directly. If shared promotion happens, drop a mobile task in [`../quorum-shared-migration/mobile-tasks-pending.md`](../quorum-shared-migration/mobile-tasks-pending.md) so the lead dev can swap mobile's local type for the shared one later.

## Architecture

### Mobile pattern (reference)

```
                  GET /directory?search=…&category=…&offset=…&limit=…
                                  │
                                  ▼
              QuorumMobileClient.exploreSpaces(params)
                                  │
                                  ▼
        useExploreSpaces() — React Query, 60s staleTime, 300ms debounce
                                  │
        ┌─────────────────────────┼──────────────────────────┐
        │                         │                          │
   { search, setSearch }   { category, setCategory }   { entries, hasMore, loadMore, refetch }
                                  │
                                  ▼
      DiscoverSpacesScreen (search input + category chips + FlatList + Join button)
                                  │
                                  ▼
                       useJoinSpace mutation
```

### Desktop port

Same overall shape, adapted to desktop conventions:

```
        getDirectoryUrl(params) — new URL builder in src/api/quorumApi.ts
                                  │
                                  ▼
        QuorumApiClient.exploreSpaces() — new method in src/api/baseTypes.ts
                                  │
                                  ▼
        useExploreSpaces() — React Query, 60s staleTime, 300ms debounce
                                  │
                                  ▼
        DiscoverSpacesModal | DiscoverSpacesRoute (UX call — see Open decisions #1)
                                  │
                                  ▼
        useSpaceJoining (already exists) — join action
```

## File plan

### New files

- `src/hooks/business/spaces/useExploreSpaces.ts` — port of mobile's hook
- `src/components/modals/DiscoverSpacesModal.tsx` + `.scss` (if decision is modal — see Open decisions #1)
  - OR `src/routes/DiscoverSpaces.tsx` (if dedicated route)

### Modified files

- `src/api/quorumApi.ts` — add `getDirectoryUrl` URL builder (mirrors `getSpaceUrl` pattern)
- `src/api/baseTypes.ts` — add `DirectoryEntry`, `DirectoryResponse`, `SpaceCategory` types + `exploreSpaces` method on `QuorumApiClient` (mirrors `getSpace`, `getInbox` method patterns at lines 350, 360, 382, 443)
- `src/hooks/business/spaces/index.ts` — barrel export
- Wherever the discovery entry point lives (sidebar button / `AddSpaceModal` / navbar) — wire the trigger

### Possibly modified (if shared promotion happens)

- `quorum-shared/src/types/directory.ts` — new file with `DirectoryEntry`, `DirectoryResponse`, `SpaceCategory`
- `quorum-shared/src/types/index.ts` — barrel export
- `quorum-shared/src/index.ts` — top-level export
- Desktop's `src/api/baseTypes.ts` then imports from `@quilibrium/quorum-shared` instead of defining locally

## Open decisions

These need answers before drafting the UI half of the port. Capture the answers here once decided.

### 1. Modal vs dedicated route on desktop

Mobile uses a dedicated screen (`discover.tsx`). Desktop's existing space-management surfaces are all modals (`JoinSpaceModal`, `AddSpaceModal`, `CreateSpaceModal`).

| Option | Pros | Cons |
|---|---|---|
| Modal | Matches existing desktop patterns. No router work. Easy to dismiss back to current context. | Modal real estate is limited; long lists feel cramped. |
| Dedicated route (`/discover` or similar) | More space for the directory list + filters. Sharable URL. | Router plumbing. Inconsistent with rest of space management. |
| Modal with "expand to full view" affordance | Hybrid — start small, escalate if needed. | Two UI states to maintain. |

**Recommendation:** modal, matching existing patterns. Discover the directory in a familiar shape; if it grows enough to need its own route, that's a future refinement.

**Decision:** _(pending user input)_

### 2. Entry point on desktop

Where does the user trigger discovery? Options:

- Button inside `AddSpaceModal` ("Browse public spaces" tab alongside "Paste invite link")
- New button in the navbar/sidebar (next to the existing "+" or space list)
- Empty-state CTA when user has zero spaces
- All of the above

**Recommendation:** start with the button in `AddSpaceModal` — it's the canonical "I want to add a space" entry point on desktop today, and it naturally extends the existing flow. Empty-state CTA can be added as a v2 polish.

**Decision:** _(pending user input)_

### 3. Category list

Mobile ships 7 categories: `community`, `gaming`, `tech`, `crypto`, `social`, `education`, `other`. Keep them verbatim?

| Option | Notes |
|---|---|
| Use mobile's list verbatim | Server already supports these categories. No new server-side work. Consistent UX across apps. |
| Subset (drop e.g. `gaming` or `social` if they don't match desktop user base) | Cleaner list, but introduces an artificial desktop/mobile divergence with no server enforcement. |
| Add categories | Requires server changes + mobile coordination. Out of scope. |

**Recommendation:** verbatim. Anything else is a separate product conversation.

**Decision:** _(pending user input)_

### 4. Shared promotion of types

`DirectoryEntry`, `DirectoryResponse`, `SpaceCategory` are pure wire-shape types from the server, used identically by both apps. Strong shared promotion candidate.

| Option | What ships | Risk |
|---|---|---|
| Promote to shared in this PR | One shared PR (additive — new exports) + this desktop PR consuming the shared types + mobile task drop for the lead to swap mobile's local types later | Standard additive shared PR. Low risk. Follows the existing shared-migration workflow. |
| Define locally on desktop now, promote later if mobile converges | Just this desktop PR. Simpler scope. | Two-source-of-truth situation. Easy to drift. Lead dev sees the same wire shape redefined in two places. |

**Recommendation:** promote to shared. The types are unambiguous wire shapes. The shared PR is additive; mobile keeps working unchanged. Drop a mobile task so the lead can swap mobile's local definitions when convenient.

**Decision:** _(pending user input — if yes, this becomes a 2-PR stack: shared additive PR first, then desktop PR consuming it)_

### 5. `reportSpace` method

Mobile's `quorumClient.ts` line 886 also defines `reportSpace(spaceAddress, reason)` — a directory-level abuse flag, separate from the message/profile reporting in `services/reporting/reportService.ts`. Reporting overall has been deprioritized for desktop (see [`candidates.md` `### #5`](candidates.md#5-reporting--deprioritized)), but the directory has its own "Report this space" affordance that's UX-adjacent to the discovery flow.

**Recommendation:** skip `reportSpace` in this PR. Don't add the wire method until we have a UI for it. Note it in this task file for follow-up.

**Decision:** _(pending user input — if you want it in scope, scope creeps slightly but stays small)_

## Implementation steps

(Order assumes Modal + AddSpaceModal entry + verbatim categories + shared-promotion = yes. Adjust once Open decisions are answered.)

### Phase 1 — shared types (only if shared promotion = yes)

- [ ] Create `quorum-shared/src/types/directory.ts` with `DirectoryEntry`, `DirectoryResponse`, `SpaceCategory` (verbatim from mobile's `quorumClient.ts` lines 67-84 + the `SPACE_CATEGORIES` enum from mobile's `useExploreSpaces.ts` lines 13-24)
- [ ] Add barrel exports: `quorum-shared/src/types/index.ts` + `quorum-shared/src/index.ts`
- [ ] Verify build on shared: `yarn build` in `quorum-shared/`
- [ ] Bump shared version, publish locally via `link:` symlink (desktop picks up automatically)
- [ ] Open shared PR (additive — see [shared-migration cross-repo-workflow.md](../quorum-shared-migration/cross-repo-workflow.md))
- [ ] Self-merge shared PR (library-only changes, no smoke test needed per shared workflow)

### Phase 2 — desktop API surface

- [ ] Add `getDirectoryUrl(params)` to `src/api/quorumApi.ts`, mirroring `getSpaceUrl` pattern with query-string assembly
- [ ] Add `DirectoryEntry`, `DirectoryResponse`, `SpaceCategory` types to `src/api/baseTypes.ts` (or import from shared if Phase 1 ran)
- [ ] Add `async exploreSpaces(params): Promise<DirectoryResponse>` method on `QuorumApiClient` in `src/api/baseTypes.ts`, mirroring the GET-with-typed-response pattern at line 350 / 360
- [ ] TypeScript check: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

### Phase 3 — hook port

- [ ] Create `src/hooks/business/spaces/useExploreSpaces.ts` — port from mobile, dropping any RN imports
- [ ] Hook signature should match mobile's: returns `{ entries, total, hasMore, isLoading, error, search, setSearch, category, setCategory, loadMore, refetch, offset }`
- [ ] Use desktop's existing React Query setup + 300ms debounce + 60s staleTime
- [ ] Add to `src/hooks/business/spaces/index.ts` barrel
- [ ] TypeScript check

### Phase 4 — UI (assuming Modal + AddSpaceModal entry)

- [ ] Create `src/components/modals/DiscoverSpacesModal.tsx` + `.scss`
- [ ] Layout: header with search input, category chip row, results list (`SpaceIcon` + name + member count + description + Join button), empty state, loading state, "Load more" or infinite scroll
- [ ] Use existing primitives (`Modal`, `Input`, `Button`, `Flex`) and existing `SpaceIcon` component
- [ ] Use `formatMemberCount` helper (port mobile's inline formatter to `src/utils/` or shared if portable)
- [ ] Wire Join action through existing `useSpaceJoining`
- [ ] Add Lingui i18n strings (no plain English in user-facing copy)
- [ ] Accessibility baseline: `aria-label` on search input + chips, keyboard navigation through results
- [ ] Mobile-first sizing: minimum 44px touch targets, `text-sm` minimum for descriptions

### Phase 5 — wire entry point

- [ ] Add "Browse public spaces" button / tab inside `AddSpaceModal`, opening `DiscoverSpacesModal`
- [ ] Handle the back-stack: closing discover modal should return to whichever modal/state was open before, or to neutral context

### Phase 6 — verification

- [ ] TypeScript clean: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
- [ ] Lint clean: `yarn lint`
- [ ] Format check: `yarn format`
- [ ] Smoke test in dev (`yarn dev`):
  - [ ] Open `AddSpaceModal` → click "Browse public spaces" → directory modal opens
  - [ ] Empty search shows full directory
  - [ ] Typing a search query debounces, results update after ~300ms
  - [ ] Selecting a category filters the list
  - [ ] Pagination: "Load more" works, exhausts at `has_more = false`
  - [ ] Joining a space from the list triggers `useSpaceJoining` and the space appears in the user's space list
  - [ ] Network error → graceful error UI, retry works
  - [ ] Closing the modal returns to expected previous state

## Done criteria

- [ ] All implementation steps above checked
- [ ] Smoke test passed in dev
- [ ] User confirmed smoke test in PR review
- [ ] PR self-merged
- [ ] Task file moved to `.done/`
- [ ] `shipped-log.md` updated with entry
- [ ] If shared promotion happened: mobile task dropped at `quorum-mobile/.agents/tasks/quorum-shared-migration/` AND row added to [`../quorum-shared-migration/mobile-tasks-pending.md`](../quorum-shared-migration/mobile-tasks-pending.md)

## What this task explicitly does NOT cover

- **`reportSpace` directory-level abuse flag.** Logged for follow-up; not in this PR.
- **Empty-state CTA on the spaces sidebar.** v2 polish if discovery sees adoption.
- **Mobile-side changes.** Mobile is read-only for this effort. Any mobile-side benefit from shared promotion is a future task drop, not part of this work.
- **Search ranking / fuzzy matching.** Server returns ranked results; we don't re-rank client-side. If mobile does any client-side filtering on top, we keep it.

## Open follow-ups surfaced during scoping

- Mobile's `useExploreSpaces` returns `total` but the screen doesn't seem to display it. Worth showing on desktop ("234 public spaces") or skip it.
- Mobile's `discover.tsx` does its own `formatMemberCount` (1K / 1M). Desktop already has `formatMemberCount` exported from shared (`@quilibrium/quorum-shared`) — use that, don't reimplement.

---

*Last updated: 2026-06-01 — initial draft. Ready for user review of the 5 Open decisions before implementation starts.*
