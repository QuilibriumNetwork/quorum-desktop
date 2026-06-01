---
type: task
title: "Unified /spaces page (PR 2 of 2) — Join via link tab + Create space tab + retire legacy modals"
status: deferred
created: 2026-06-01
updated: 2026-06-01
candidate: "#1 (port-from-mobile) — PR 2"
depends-on: "2026-06-01-port-discover-spaces.md (PR 1) — must ship and be in real use before PR 2 starts"
---

# Unified `/spaces` page — PR 2 of 2

> **Status: deferred.** This task is committed but not picked up until PR 1 ([`2026-06-01-port-discover-spaces.md`](2026-06-01-port-discover-spaces.md)) ships and has been in real use for a window (~1-2 weeks). The "real use" delay matters — some PR 2 decisions (paste-invite placement, sort/filter options on My Servers, layout adjustments) benefit from observing how PR 1 actually feels in practice.

> **Commitment window:** PR 2 ships within ~2-4 weeks of PR 1 (user confirmed 2026-06-01). The half-shipped state (new page exists, legacy modals also exist) should be short-lived — keeping both around long-term would be worse UX than either extreme.

## Why this PR 2 task file exists now (before PR 1 ships)

Created 2026-06-01 immediately after PR 1's task file to capture the design decisions reached during the same session. Half the value of the design discussion is the rationale chain that led to "4 tabs, page-is-the-hub, retire modals" — without recording PR 2's locked scope, the next session would have to re-litigate the same decisions cold.

Decisions ratified in PR 1's task file apply here too. PR 2 inherits all of them. The deltas below are PR 2-specific.

## Goal

Complete the "unified `/spaces` page" vision by:
1. Filling in the remaining two tabs (**Join via link** + **Create space**) with full functionality
2. Retiring the legacy modals they replace (`AddSpaceModal`, `CreateSpaceModal`)
3. Removing the now-redundant navbar `+` button
4. Keeping `JoinSpaceModal` + `InviteRoute` alive permanently (orthogonal deep-link flow — not touched by either PR)

After PR 2 merges, `/spaces` is the canonical hub for everything space-related from outside-a-space. The navbar `icon-layout-grid-add` button is the sole entry point.

## Inherited decisions from PR 1 (do not re-litigate)

These were locked in PR 1's task file and apply unchanged to PR 2:

- **Route:** `/spaces` (already exists from PR 1)
- **Tab IA:** 4 tabs (My Servers · Discover · Join via link · Create space)
- **Navbar entry:** `icon-layout-grid-add` at top of space list (already exists from PR 1; PR 2 removes the `+` button alongside)
- **Architectural commitment:** "the page is the hub for everything" → no tab routes to a modal
- **JoinSpaceModal + InviteRoute:** permanently kept for deep-link `#join=...` URL handling. Not touched.

## PR 2-specific locked decisions

### 1. Create space tab: full form rendered immediately ✅
When the user clicks "Create space" tab, the full creation form appears immediately. No intermediate landing card, no "Get started" button. Users clicking the tab already committed to creating; don't make them click again. The form layout should mirror the existing `CreateSpaceModal` (which renders the form directly today).

### 2. Join via link tab: gets a tab even though content is small ✅
The content is genuinely small (one input field, validation, manual-mode fallback for spaceId/configKey). But the "page is the hub" commitment means it deserves a tab rather than being hidden in a modal or header action.

The empty-feeling concern is real and addressed by designing the tab thoughtfully:
- Centered form, not full-width
- Helpful contextual copy ("Have an invite link? Paste it here to join a private space.")
- Include the existing "manual mode" affordance from `AddSpaceModal` (spaceId + configKey fields) so users with partial invite info aren't stuck
- Possibly: future-proof for invite history or recent links (NOT in PR 2 scope, but design with room to grow)

### 3. Code lift strategy: extract reusable hooks, not copy components ✅
Both `AddSpaceModal` and `CreateSpaceModal` use existing business hooks (`useSpaceJoining`, `useInviteValidation`, the create-space mutation). PR 2 lifts the **UI layout** from each modal into the corresponding tab, but the **business logic stays in the existing hooks**. This:
- Avoids duplicating logic
- Means the modals can be deleted without ripping out their logic dependencies
- Keeps a smaller diff per file change

### 4. Navbar `+` button removal: happens in PR 2, not earlier ✅
Removing the `+` button in PR 1 would leave users without create/paste-invite access (since PR 1 doesn't ship those tabs). Removing in PR 2 happens *after* the replacement tabs ship in the same PR, so users always have a path. Both old and new entry points coexist briefly during PR 1's window; PR 2 collapses to just the new one.

### 5. PR 2 also revisits a few PR 1 deferrals ✅
Items PR 1 marked as "decide during PR 2 with the page in real use":
- Sort options on My Servers (alphabetical / by member count / etc.) — based on PR 1 feedback
- "Hide muted servers" filter on My Servers — based on PR 1 feedback
- Discover layout adjustment if "search + dropdown" feels wrong in practice (could swap to chip row or sidebar)
- Tab state persistence in URL (`/spaces?tab=create`) if not done in PR 1

These are NOT scope additions to PR 2 by default — they're "while we're in the file, consider these" notes. Each is independently small enough to defer further if PR 2 grows too large.

## Architecture

### Navbar topology (after PR 2)

```
[icon-layout-grid-add]   ← sole entry point (added in PR 1, stays)
─────────────────────
  [Space icon 1]
  [Space icon 2]
  ...
  [Space icon N]
                          ← `+` button REMOVED in PR 2
```

### Page after PR 2

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [ My Servers ]  [ Discover ]  [ Join via link ]  [ Create space ]        │  ← all 4 tabs populated
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Active tab content (one of four)                                        │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Join via link tab layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│              ┌────────────────────────────────────────────┐               │
│              │                                            │               │
│              │  Have an invite link?                     │               │
│              │  Paste it here to join a private space.   │               │
│              │                                            │               │
│              │  🔗 [ Invite link...                  ]   │               │
│              │                                            │               │
│              │  [ Use manual mode (spaceId + key)  ▾]   │               │
│              │                                            │               │
│              │              [ Join Space ]               │               │
│              │                                            │               │
│              └────────────────────────────────────────────┘               │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

(Centered card, not full-width, to avoid the "lonely single input" look.)

### Create space tab layout

Mirrors the existing `CreateSpaceModal` form layout. Full creation form rendered directly on the tab. Confirm exact field list during implementation by reading `CreateSpaceModal.tsx` — at minimum: space name, icon, description, banner, initial channels, initial roles.

## File plan

### New files (PR 2)

| File | Purpose |
|---|---|
| `src/components/spaces-page/JoinViaLinkTab.tsx` (+ `.scss`) | Centered form lifting the paste-invite + manual-mode logic from `AddSpaceModal` |
| `src/components/spaces-page/CreateSpaceTab.tsx` (+ `.scss`) | Full creation form lifting the layout from `CreateSpaceModal` |

### Modified files (PR 2)

| File | Change |
|---|---|
| `src/components/spaces-page/SpacesPage.tsx` | Add two more tab buttons (Join via link, Create space) + route active-tab content to the new components |
| `src/components/spaces-page/index.ts` | Barrel exports for new tab components |
| `src/components/navbar/NavMenu.tsx` (or wherever) | **Remove** the `+` button. Keep the `icon-layout-grid-add` button. |
| `src/components/Layout.tsx` | Remove `AddSpaceModal` + `CreateSpaceModal` from the rendered modal stack. Remove `showAddSpaceModal` / `showCreateSpaceModal` plumbing. |
| `src/components/navbar/ExpandableNavMenu.tsx` | Remove `showCreateSpaceModal` + `showJoinSpaceModal` props (if no longer used elsewhere) |
| Wherever modal state lives (Layout state or context) | Remove `showAddSpaceModal` / `hideAddSpaceModal` / `showCreateSpaceModal` / `hideCreateSpaceModal` |

### Deleted files (PR 2)

| File | Reason |
|---|---|
| `src/components/modals/AddSpaceModal.tsx` (+ `.scss`) | Content lifted into Join via link tab; modal retired |
| `src/components/modals/CreateSpaceModal.tsx` (+ `.scss`) | Content lifted into Create space tab; modal retired |

### Untouched permanently

- `src/components/modals/JoinSpaceModal.tsx` — kept for `InviteRoute` deep-link handling
- `src/components/InviteRoute.tsx` — kept for deep-link handling

## Deep-link `InviteRoute` boundary (still applies)

When someone clicks `app.quorummessenger.com#join=...` outside the app, `InviteRoute` opens `JoinSpaceModal`. That flow is orthogonal to the in-app `/spaces` page and is untouched by PR 2. Do NOT delete `JoinSpaceModal` even though it looks like dead code from a desktop-UI perspective — it's the deep-link handler's render target.

## Implementation phases

### Phase 1 — Pre-flight (catch up to PR 1 state)

- [ ] Confirm PR 1 has shipped and merged
- [ ] Confirm `/spaces` page works in real use (1-2 weeks of usage is the rough commitment)
- [ ] Gather PR 1 feedback (UX-level — any items from PR 1's deferred-decision list that need addressing in PR 2?)
- [ ] Pull all three repos; check `quorum-mobile/main`, `quorum-shared/main`, `quorum-desktop/main`
- [ ] Create new session branch `session-YYYY-MM-DD` (PR 2 is its own session)

### Phase 2 — Read existing modals to plan the lift

- [ ] Read `src/components/modals/AddSpaceModal.tsx` in full — identify the paste-invite section vs the create-space sub-button
- [ ] Read `src/components/modals/CreateSpaceModal.tsx` in full — list every form field, validation rule, mutation called
- [ ] Identify any shared logic between `AddSpaceModal` paste-invite and the existing `JoinSpaceModal` (used by `InviteRoute`) — both validate invite links; the validation hook (`useInviteValidation`) probably handles both
- [ ] Decide field-level decomposition: which fields become reusable subcomponents vs inline JSX

### Phase 3 — Join via link tab

- [ ] Create `src/components/spaces-page/JoinViaLinkTab.tsx`
- [ ] Centered card layout (max-width ~`max-w-md`, centered horizontally)
- [ ] Heading + helper copy (Lingui)
- [ ] Invite link input + validation via `useInviteValidation` (existing hook, no changes needed)
- [ ] Manual-mode collapsible section (spaceId + configKey fields, mirroring `AddSpaceModal`'s manual mode)
- [ ] Join button wired through `useSpaceJoining` + `useModalSaveState` (or equivalent; verify whether the modal-save-state pattern translates to a tab context — probably yes with minor adaptation)
- [ ] Validation error display
- [ ] "Already a member" detection (lift from `AddSpaceModal`)
- [ ] Accessibility: label, error announcements (`role="alert"`), keyboard navigation
- [ ] Lingui copy

### Phase 4 — Create space tab

- [ ] Create `src/components/spaces-page/CreateSpaceTab.tsx`
- [ ] Lift the full form layout from `CreateSpaceModal` — every field, in the same order, with same validation
- [ ] Wire the create-space mutation (whichever hook `CreateSpaceModal` uses)
- [ ] Handle success: navigate the user into the newly-created space
- [ ] Handle errors: inline error display
- [ ] Adapt the "modal save state" pattern to a tab context (no `props.onClose` callback; either reset the form or navigate away on success)
- [ ] Accessibility + Lingui
- [ ] Form layout responsive: full-width-on-narrow, max-width-on-wide

### Phase 5 — Wire tabs into SpacesPage

- [ ] Extend `SpacesPage.tsx` to render 4 tab buttons instead of 2
- [ ] Add `<JoinViaLinkTab />` and `<CreateSpaceTab />` to the active-tab content routing
- [ ] Consider URL query param sync (`?tab=create`) if not done in PR 1 — this is also the point at which deep-link to `/spaces?tab=create` becomes useful (e.g. for "create your first space" empty-state CTAs elsewhere)
- [ ] Keep tab order consistent: My Servers · Discover · Join via link · Create space

### Phase 6 — Retire legacy modals

- [ ] Delete `src/components/modals/AddSpaceModal.tsx` + `.scss`
- [ ] Delete `src/components/modals/CreateSpaceModal.tsx` + `.scss`
- [ ] Remove imports + render sites from `src/components/Layout.tsx`
- [ ] Remove `showAddSpaceModal`/`hideAddSpaceModal`/`showCreateSpaceModal`/`hideCreateSpaceModal` plumbing from Layout state and any context they live in
- [ ] Remove `showCreateSpaceModal` + `showJoinSpaceModal` props from `ExpandableNavMenu.tsx` (and any other consumers)
- [ ] Grep for any other consumers and clean up
- [ ] Confirm `JoinSpaceModal` still works for the deep-link `InviteRoute` flow

### Phase 7 — Remove navbar `+` button

- [ ] Remove the `+` "Add space" button from the navbar
- [ ] Verify `icon-layout-grid-add` is now the sole space-management entry point
- [ ] If there are any user-help tooltips / onboarding flows that reference the `+` button, update them

### Phase 8 — PR 1 deferred items (judgment call per item)

These are not required for PR 2 but the file change is already open. Add per-item, skip per-item:

- [ ] If decided: add sort dropdown to My Servers tab (alphabetical / by member count)
- [ ] If decided: add "Hide muted servers" filter to My Servers tab
- [ ] If real use shows Discover layout (search + dropdown) feels wrong: swap to chip row or sidebar
- [ ] If not done in PR 1: tab state persistence via URL query param

### Phase 9 — Verification

- [ ] TypeScript clean
- [ ] Lint clean
- [ ] Format check
- [ ] Build clean
- [ ] Smoke test in dev:
  - [ ] All 4 tabs render and switch correctly
  - [ ] Join via link tab: paste valid invite → join success; paste invalid → error display; manual mode toggle works
  - [ ] Create space tab: fill form → space created → user lands in new space
  - [ ] Deep-link `#join=...` URLs still work via `InviteRoute` + `JoinSpaceModal`
  - [ ] Navbar shows only `icon-layout-grid-add`, no `+` button
  - [ ] No regressions in My Servers + Discover tabs (PR 1 functionality intact)
  - [ ] No regressions in existing space-list, channel views, DM views
  - [ ] Modals confirmed deleted (grep for `AddSpaceModal` returns no imports)
- [ ] Check for any in-app help / onboarding copy referencing the old `+` button

## Done criteria (PR 2)

- [ ] All implementation phases above complete
- [ ] Smoke test passed in dev
- [ ] User confirmed smoke test in PR review
- [ ] PR self-merged
- [ ] Task file moved to `.done/`
- [ ] `shipped-log.md` updated with PR 2 entry
- [ ] Closure note in PR description: "Completes the unified `/spaces` page vision. Companion PR 1: <link>."
- [ ] Update `candidates.md` to mark #1 as ✅ shipped (both PRs)

## What this PR explicitly does NOT cover

- **`reportSpace` directory-level abuse flag.** Still out of scope (Reporting deprioritization).
- **Per-space online count / last-seen on My Servers.** Still out of scope; new infrastructure required.
- **`InviteRoute` deep-link flow.** Untouched permanently.
- **Discover tab layout overhaul** unless PR 1 feedback explicitly demands it.
- **#6 Public profile UI port.** Separate candidate, separate task file when picked up.

## Risks / unknowns

- **Lifting `CreateSpaceModal` form into a tab context might surface state-management issues** (modal `onClose` callback paradigm doesn't translate 1:1 to a tab). Mitigation: read `CreateSpaceModal` thoroughly in Phase 2 before scoping.
- **`useModalSaveState` pattern** may need a tab-friendly equivalent or an adapter. Mitigation: investigate during Phase 3.
- **PR 1 may surface UX issues that change PR 2 scope.** That's expected — PR 2 is intentionally deferred precisely to absorb those learnings.
- **If PR 2 doesn't ship within the committed window**, the navbar has two entry points (`+` and `icon-layout-grid-add`) which is the worst long-term state. Mitigation: this risk is the entire reason for committing to the 2-4-week PR 2 window.

---

*Last updated: 2026-06-01 — task file created immediately after PR 1's task file to preserve the design discussion. Status `deferred` until PR 1 ships.*
