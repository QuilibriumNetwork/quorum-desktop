---
type: task
title: "Space Tag Click — Space Info Modal"
status: blocked
complexity: medium
ai_generated: true
reviewed_by: null
created: 2026-02-24
updated: 2026-02-24
blocked_by: "Public Space Directory API (tasks/public-space-directory.md)"
related_docs:
  - docs/features/space-tags.md
related_tasks:
  - tasks/space-tags.md
  - tasks/public-space-directory.md
---

# Space Tag Click — Space Info Modal

> **AI-Generated**: May contain errors. Verify before use.

**Files** (estimated):
- `src/components/space/SpaceTag/SpaceTag.tsx` — click handler, popover trigger
- `src/components/space/SpaceTag/SpaceTag.scss` — cursor, hover styles
- `src/components/space/SpaceTag/SpaceTagInfoPopover.tsx` — new popover component

## What & Why

**Current state**: Space tags render as static pill badges next to usernames in messages. Clicking them does nothing.

**Desired state**: Clicking a space tag opens a popover showing the source space's name, icon, and description — enabling space discovery directly from the message list.

**Why this matters**: Space tags are the only visual hint that a user belongs to another space. Without clickable info, they're just decoration. Making them interactive turns every tagged message into a potential space discovery moment, which is critical for a decentralized app with no centralized directory.

## Blocked By: Public Space Directory API

This task requires a public space directory API endpoint that resolves `spaceId` to space metadata (name, icon, description). Without it, non-members have no way to fetch space information — and non-members are the primary audience for space discovery.

**Why not embed metadata in `BroadcastSpaceTag`?**

An earlier design (see Updates section) proposed embedding `spaceName`, `spaceDescription`, and a 48x48 `iconThumb` directly into `BroadcastSpaceTag`. Expert panel review (arch 7/10, impl 6/10, pragmatism 8/10) identified serious concerns:

| Concern | Impact |
|---------|--------|
| Payload bloat: 4-7 KB per broadcast per space | A user in 100 spaces triggers ~400-700 KB per profile update |
| Broadcast amplification | `update-profile` fans out to every member of every space — O(spaces x members) |
| Staleness detection complexity | 3 new fields to compare across 3 broadcast sites |
| Expanded SVG XSS surface | New `iconThumb` field doubles inbound attack surface |
| Type extensions across 10+ files | High implementation cost for a workaround |

**The directory API makes all these concerns disappear.** The click flow becomes:

1. User clicks space tag → extract `spaceId`
2. Fetch `GET /api/spaces/{spaceId}` → name, icon, description, member count
3. Popover renders fresh data

Zero payload changes, zero type extensions, zero staleness issues. A clean, self-contained UI feature.

## Implementation (when directory API is available)

### Phase 1: Click Handler & Popover

- [ ] **Add click handler to `SpaceTag` component** (`src/components/space/SpaceTag/SpaceTag.tsx`)
  - Add `onClick` prop or internal click state
  - Show cursor pointer on hover
  - Prevent click from propagating to parent message handlers (`e.stopPropagation()`)
  - Done when: clicking a space tag triggers a callback

- [ ] **Build `SpaceTagInfoPopover` component** (`src/components/space/SpaceTag/SpaceTagInfoPopover.tsx`)
  - On open: fetch space metadata from directory API using `tag.spaceId`
  - Display: space icon, space name, description, member count
  - Loading state: skeleton/spinner while fetching
  - Error state: "Could not load space info" with retry
  - Position: popover anchored to the clicked tag (use existing popover patterns)
  - Dismiss: click outside or press Escape
  - Escape listener must use `useEffect` cleanup (e.g., `AbortController`) to prevent leaks
  - Done when: clicking a space tag shows a popover with space info fetched from directory

- [ ] **Update `SpaceTag.scss`** (`src/components/space/SpaceTag/SpaceTag.scss`)
  - Add `cursor: pointer` on hover
  - Add hover style using existing `--color-bg-space-tag-hover` variable
  - Done when: tag visually indicates it's clickable

### Phase 2: Caching & Polish

- [ ] **Cache directory responses** (React Query or similar)
  - Same `spaceId` should not trigger multiple API calls within a session
  - Stale-while-revalidate pattern — show cached data immediately, refresh in background
  - Done when: second click on same tag shows data instantly

- [ ] **Graceful degradation for unavailable spaces**
  - If directory returns 404 (private space or delisted): show "This space is not publicly listed"
  - If network error: show error with retry button
  - Done when: all error states handled without broken UI

## Verification

- Test: Click space tag → popover opens with loading state → space info appears
- Test: Click same tag again → instant (cached)
- Test: Non-member clicks tag → sees space info from directory API
- Test: Member clicks tag → sees space info (can also fall back to local data)
- Test: Private/unlisted space tag → graceful "not available" message
- Test: Network error → error state with retry
- Test: Click outside popover → dismisses
- Test: Press Escape → dismisses
- Test: Click tag inside message → does NOT trigger parent message click handler
- Test: TypeScript compiles: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

## Definition of Done

- [ ] All implementation steps complete
- [ ] All verification tests pass
- [ ] TypeScript compiles cleanly
- [ ] No console errors
- [ ] Feature docs updated

---

## Updates

**2026-02-24 — Claude**: Initial task creation with embedded metadata approach (6 phases, 10+ files).
**2026-02-24 — Claude**: Expert panel review (arch 7/10, impl 6/10, pragmatism 8/10). Key findings: payload amplification (4-7 KB × spaces × members), SVG XSS surface, staleness detection complexity. Consensus: embedding metadata is a workaround, not the right solution.
**2026-02-24 — Claude**: Rewrote task as directory-dependent. Removed all payload/type extension phases. Simplified to a pure UI feature (click handler + popover + API fetch). Status changed to `blocked` pending public space directory API.

---

_Created: 2026-02-24_
_Updated: 2026-02-24_
