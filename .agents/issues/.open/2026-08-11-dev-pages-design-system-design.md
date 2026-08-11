---
type: task
title: "Dev pages: one layout system, so the eleven /dev tools stop drifting apart"
status: open
priority: medium
created: 2026-08-11
updated: 2026-08-11
area: dev tools / layout / design consistency
repos: quorum-desktop
related:
  - ".agents/docs/styling-guidelines.md (token and Tailwind-vs-CSS rules this follows)"
  - ".agents/docs/features/primitives/03-when-to-use-primitives.md (§Web vs Mobile Text Usage — the rule the dev pages break)"
  - "src/styles/_typography.scss (the semantic classes that replace the Text primitive)"
  - "src/dev/README.md (documents routes that no longer exist — corrected by this work)"
---

# Dev pages: one layout system

The `/dev` surface has grown to eleven tools, each built in isolation. Every one
re-implements the page shell by hand, so they have drifted apart on width,
header shape, sticky behaviour and type scale. This design fixes the drift at
the source — shared shell components — rather than restyling eleven pages that
would then drift again.

## Status

Design agreed 2026-08-11. Scope decisions taken with the operator:

- **Type scale:** bump prose, hints, help text and stat labels to `text-sm`;
  leave badges, pills, counts and dense table column headers at `text-xs`.
  Not a blanket sweep.
- **Fake QNS:** fully neutral. Adopt the standard chrome and drop the amber
  entirely, including any conditional warning banner.

Revised the same day, on the operator's observation that the `Text` primitive is
obsolete on web. Confirmed — see §1-H. This turned out to be the root cause of
the misalignment rather than a separate concern, and it supersedes the mechanical
`text-xs → text-sm` sweep with adoption of the existing semantic typography
classes. §2-F is rewritten accordingly.

---

## 1. What is actually wrong (measured, not assumed)

Every claim below was measured against the running dev server at 1440x900 using
a headless browser driven over CDP, not inferred from reading the source. The
harness and the exact figures are in §6.

### 1-A. Navigation is a full page reload

`DevNavMenu` renders each item as `<a href="/dev/...">`
([DevNavMenu.tsx:86-97](src/dev/DevNavMenu.tsx#L86-L97)) and `DevMainPage`
navigates with `window.location.href = path`
([DevMainPage.tsx:87-89](src/dev/DevMainPage.tsx#L87-L89)). Both are document
navigations, not client-side routing, so every click tears down and re-bootstraps
the entire React app.

MEASURED on a cold navigation to `/dev/audit`:

| Metric | Value |
|---|---|
| first-paint | **1640 ms** |
| first-contentful-paint | **1884 ms** |
| domComplete | 1901 ms |
| resource requests | **250** |

That 1.64 s of nothing is precisely the "screen completely blank for 1-2 secs"
symptom. It is not slow rendering and not a heavy page — it is the app booting
from scratch on every nav click. Client-side routing skips all 250 requests and
loads only the new page's lazy chunk.

This also means the `Suspense` fallbacks already wired in the router
([Router.web.tsx:241-355](src/components/Router/Router.web.tsx#L241-L355)) never
render. They are dead code today: a full reload replaces the document before
React can show `Loading audit viewer...`. Fixing routing is what makes a
transition design possible at all.

### 1-B. Six different container widths

| Page | Container | Sticky nav | `currentPath` passed |
|---|---|---|---|
| Home | `max-w-2xl` | no | hardcoded |
| Docs / Issues / Reports | `max-w-6xl` | no | `window.location.pathname` |
| Playground | `max-w-screen-2xl` | **yes** | hardcoded |
| Audit | *(none — full bleed)* | no | `window.location.pathname` |
| DB Inspector | `max-w-6xl` | **yes** | hardcoded |
| DM Doctor | `max-w-5xl` | **yes** | hardcoded |
| Identity Coverage | `max-w-5xl` | **yes** | hardcoded |
| Fake QNS | *(none — full bleed)* | no | **none** |
| Error States | `max-w-4xl` | no | hardcoded |

Three independent axes drifted at once. The `currentPath` column matters
beyond tidiness: Fake QNS passes nothing, so it is the one page that never
highlights itself in the nav bar.

### 1-C. Header shape is different on nearly every page

At least five distinct treatments exist: centered icon+title with no subtitle
(Home); icon+title+subtitle (DM Doctor, Identity Coverage); the same plus
right-aligned actions (DB Inspector); a bare `<h1 className="text-2xl">` with no
icon (Error States, [ErrorStates.tsx:119](src/dev/error-states/ErrorStates.tsx#L119));
and no page header at all (Fake QNS).

### 1-D. Stat labels collide with their numbers

The reported misalignment. The `Text` primitive renders as an **inline**
`<span>` on web. `Stat` in
[IdentityCoverage.tsx:53-67](src/dev/identity-coverage/IdentityCoverage.tsx#L53-L67)
stacks a label `Text` and a value `Text` as siblings, so they flow onto one line
and read as `Degraded0`. The `hint` below it renders correctly only because it
carries an explicit `className="block"` — the label does not.

MEASURED via DOM probe: label is `SPAN`, `display: inline`; next sibling is
`SPAN`, `display: inline`, text `"0"`.

A sweep across all eleven pages found **exactly six collisions on two pages**:

| Page | Collision | Sizes |
|---|---|---|
| Identity Coverage | `Degraded \| 0` | 12px → 20px |
| Identity Coverage | `Expected (no source anywhere) \| 0` | 12px → 20px |
| DM Doctor | `SESSION REPLACED by init envelope \| 0` | 12px → 24px |
| DM Doctor | `DM frame for unknown inbox \| 0` | 12px → 24px |
| DM Doctor | `decrypt fail/error/unable \| 0` | 12px → 24px |
| DM Doctor | `Sequence scan \| Scans the WH…` | 18px → 12px |

The other nine pages return zero collisions — they are the control arm, and they
must still return zero after the change.

Note the Audit page's stat tiles are *not* affected: they use
`<div className="text-2xl font-bold">`
([ComponentAuditViewer.tsx:1108](src/dev/components-audit/ComponentAuditViewer.tsx#L1108)),
and a `div` is block-level. The bug is specific to the `Text` primitive, which is
why it hits only the two pages that used it for stats.

### 1-E. `/dev/dependencies` is a dead duplicate route

The router maps `/dev/dependencies` to `DependencyAuditViewer`, which is
imported as `ComponentAuditViewer`
([Router.web.tsx:51-54](src/components/Router/Router.web.tsx#L51-L54)) — the same
component `/dev/audit` already uses. `DependencyMapViewer.tsx` and
`dependency-map.json` no longer exist; `components-audit/index.ts` exports only
`ComponentAuditViewer`.

MEASURED: `/dev/dependencies` and `/dev/audit` render byte-identically
(scrollHeight 9059 px and 1016 `.text-xs` nodes on both).

`src/dev/README.md` still documents the dependency map, its JSON and a
`mobile-roadmap.md` as if they exist.

### 1-F. `/playground` sits outside the `/dev` namespace

Every other tool is `/dev/*`. The playground is top-level `/playground`, in the
router, in `DevNavMenu`, in `DevMainPage` and throughout the README.

### 1-G. `text-xs` is doing work it should not

MEASURED `.text-xs` node counts: Issues 1214, Audit 1016, Playground 190, Docs
78, Reports 40, DB Inspector 24, Fake QNS 9, DM Doctor 7, Identity Coverage 6,
Home 0, Error States 0. Total 2584.

Most of the Issues and Audit counts are legitimately chrome — badges, pills and
dense table headers, which the global rule permits at `text-xs`. The problem is
the smaller pages, where multi-sentence explanatory paragraphs are set at 12px:
the Fake QNS body copy, the Identity Coverage snapshot explanation, the DM
Doctor scan description.

### 1-H. The dev pages are the last holdout of a primitive removed from web

`.agents/docs/features/primitives/03-when-to-use-primitives.md:171` is
unambiguous:

> **CRITICAL: Text primitive is NOT USED on web production code. It is REQUIRED
> on native (React Native).**
>
> For web code, always use plain HTML with CSS typography classes (mandatory —
> Text primitive has been removed from all web production code)

`AGENTS.md` repeats it: the Text primitive is native-only.

MEASURED usage of `<Text>` across the repo:

| Where | Files | Notes |
|---|---|---|
| Production, `.native.tsx` | 4 | Correct — required on native |
| Production, web `.tsx` | 2 | `JoinSpaceModal.tsx`, `SpaceSettingsModal/Account.tsx` — stragglers, out of scope here |
| **`src/dev/`** | **12 files, 182 uses** | The bulk of remaining web usage |

Per file: ComponentAuditViewer 48, DmDoctor 32, IdentityCoverage 21, DbInspector
20, FakeQns 13, FrontmatterPanel 11, FilterableList 9, Reports 7, Issues 7, Docs
7, MarkdownViewer 4, DevMainPage 3.

**This is the root cause of §1-D, not a separate issue.** The collision happens
precisely because `Text` is a native-shaped API whose web shim renders an inline
`<span>`. Fixing the stats without removing `Text` would treat the symptom and
leave 176 other opportunities for it to recur.

It also supersedes the planned `text-xs → text-sm` sweep. The repo already has a
semantic typography scale in `src/styles/_typography.scss` that encodes the
right sizes:

| Class | Size | Intended for |
|---|---|---|
| `.text-title-large` | 24px bold | page titles |
| `.text-title` | 20px bold | section titles |
| `.text-subtitle` | 18px bold | secondary headings |
| `.text-subtitle-2` | 14px bold caps | section dividers |
| `.text-body` | 16px | body copy |
| `.text-label-strong` | 14px bright | control labels |
| `.text-label` | 14px subtle | **descriptions, help text, hints** |
| `.text-small` | 12px subtle | minor annotations, metadata |

`.text-label` is exactly the "bump prose to 14px" decision, already named and
already themed. Adopting these classes delivers the type-scale fix as a
consequence of doing the migration correctly, instead of as a separate hand-tuned
pass over 2584 nodes.

---

## 2. Design

### 2-A. Three shared shell components

New folder `src/dev/shell/`, exported through `src/dev/shell/index.ts`.

**`DevPage`** — owns the outer frame for every tool.

```tsx
<DevPage width="standard">   // narrow | standard | wide | full
  …page content…
</DevPage>
```

It renders `min-h-screen bg-app`, the nav, and the width-constrained content
column. It derives `currentPath` from the router itself (`useLocation`), so no
page passes it and no page can forget to — which is what fixes Fake QNS's
missing highlight structurally rather than by hand.

The nav is **always sticky**. It was already sticky on four pages and the
inconsistency has no rationale; on long pages like Audit and Issues, being able
to switch tools without scrolling back to the top is strictly better.

**`DevPageHeader`** — one header shape.

```tsx
<DevPageHeader
  icon="id-badge"
  title="Identity Coverage"
  subtitle="How many people cannot render as anything but a truncated address"
  actions={<Button …>Refresh</Button>}   // optional, right-aligned
/>
```

Icon left, title, subtitle beneath, optional actions right-aligned and
top-aligned with the title. This absorbs all five existing treatments including
DB Inspector's action row, so nothing has to regress to adopt it.

**`DevStat`** — the stat tile, block-level by construction.

```tsx
<DevStat label="Degraded" value={0} hint="provider missing data…" tone="good" />
```

Renders label, value and hint as plain block-level HTML with typography classes
(`.text-small` label, a sized value, `.text-small` hint) — no `Text` primitive,
per §1-H. `tone` takes `good | bad | neutral` rather than a raw class string,
replacing the ad-hoc `countTone()` helper that returns Tailwind classes.

All three shell components are built from plain HTML for the same reason. They
are the pattern new dev tools will copy, so they have to model the rule
correctly.

`DevCard` is deliberately **not** created. The existing
`bg-surface-1 rounded-lg p-6 border border-default` card is already consistent
across pages and is not a source of drift; wrapping it would be churn.

### 2-B. Width tiers

Four named tiers replace six ad-hoc values:

| Tier | Value | For | Pages |
|---|---|---|---|
| `narrow` | `max-w-3xl` | reading, forms | Error States, Fake QNS |
| `standard` | `max-w-5xl` | most tools | Home, DM Doctor, Identity Coverage, DB Inspector |
| `wide` | `max-w-7xl` | doc browsers | Docs, Issues, Reports |
| `full` | `max-w-screen-2xl` | dense tables | Audit, Playground |

The tiers exist because the needs are genuinely different — a data table and a
three-field form should not share a width. What matters is that a page picks a
named tier rather than inventing a number.

Two deliberate changes beyond normalisation: DB Inspector drops `6xl → 5xl`
(its two-column layout has significant dead space at 1440px, visible in the
capture), and Audit gains `max-w-screen-2xl` so it stops running edge-to-edge
on wide monitors.

### 2-C. Home becomes a grid

Ten tool cards in a single column produce a 1597 px page that needs scrolling to
see the last three. A responsive grid — `grid-cols-1 md:grid-cols-2
lg:grid-cols-3` — fits all ten above the fold at 1440px.

Card content stays as it is (icon, name, description); only the container
changes. Cards get `h-full` so a long description does not make one card taller
than its row neighbours.

### 2-D. Navigation and transitions

Two changes, in order:

1. **Client-side routing.** `DevNavMenu` uses `<Link to>` from `react-router`
   and `DevMainPage` uses `useNavigate()`. This alone removes the blank screen —
   there is no document teardown, so nothing goes blank.

2. **A real loading state for the lazy chunk.** With routing fixed, the router's
   `Suspense` fallbacks finally render. They currently say
   `<div>Loading audit viewer...</div>` — unstyled, top-left, eleven near-copies.
   Replace them with one `DevPageLoading` component: centered spinner plus
   "Loading <page name>", rendered inside the standard shell so the nav bar
   stays put and only the content area swaps.

The second is what the operator asked for as a fallback, but it is worth doing
even though the first removes most of the wait: the lazy chunk still has to
arrive, and on a cold cache that is a real if short gap.

### 2-E. Route moves

- `/playground` → `/dev/playground`, with `/playground` kept as a
  `<Navigate replace>` redirect so existing bookmarks and any links in
  `.agents/` docs keep working.
- `/dev/dependencies` → **removed**, along with the `DependencyAuditViewer`
  import alias. It renders a duplicate of `/dev/audit` and its backing component
  no longer exists.

### 2-F. Retire the `Text` primitive from `src/dev/`, which is also the type-scale fix

All 182 `<Text>` uses across the twelve dev files are replaced with plain HTML
carrying a semantic typography class, per the mandatory web rule (§1-H).

The mapping is mechanical, because the old props encode the same intent:

| Current | Becomes |
|---|---|
| `<Text as="h1" size="3xl" weight="bold">` | `<h1 className="text-title-large">` |
| `<Text variant="strong" size="lg">` | `<h2 className="text-subtitle">` |
| `<Text variant="main">` | `<p className="text-body">` |
| `<Text variant="subtle" size="sm">` | `<p className="text-label">` |
| `<Text variant="subtle" size="xs">` *(prose)* | `<p className="text-label">` |
| `<Text variant="subtle" size="xs">` *(metadata, badge, count)* | `<span className="text-small">` |

The last two rows are where the agreed type-scale decision gets applied. The
judgment — is this a sentence someone reads, or a chip they glance at — is made
once per call site during the migration, and the result is a named class rather
than a raw size. Prose lands on `.text-label` (14px), chrome stays on
`.text-small` (12px).

Two further benefits fall out of this rather than needing separate work:

- **The collision cannot recur.** `<p>` and `<div>` are block-level, so a label
  and a value stacked as siblings simply stack. §1-D is fixed structurally
  everywhere, not patched in the six places it currently shows.
- **The classes are responsive.** `.text-label` is `$text-sm-responsive` (16px
  mobile → 14px desktop) and `.text-small` is `$text-xs-responsive` (14px → 12px).
  The current hardcoded `text-xs` is 12px at every width.

Issues and Audit still keep most of their `text-xs` chrome: those nodes are
overwhelmingly badges, pills and dense table headers, which the rule exempts and
which map to `.text-small`.

**Scope note.** This is the largest slice by file count and the one most likely
to produce visual regressions, because it touches every piece of text on the dev
surface. It is sequenced last for that reason, and verified page by page against
captures taken before it starts.

---

## 3. What this explicitly does not do

- **No redesign of page internals.** The Audit table, the Issues filter panel
  and the Playground example boxes keep their current structure. This is a shell
  and consistency pass.
- **No `DevCard`.** See §2-A.
- **Nothing moves to `quorum-shared`.** These are desktop-only dev tools with no
  mobile counterpart.
- **No production surface is touched.** Everything under `src/dev/` is excluded
  from production builds; the only non-dev file edited is
  `Router.web.tsx`, and only inside its `NODE_ENV === 'development'` blocks.

---

## 4. Risks

**The `Text` removal is broad and touches every string on the surface.** 182
call sites across twelve files. The sweep only detects siblings with a ≥4px size
difference on a shared line, so it will not catch a same-size collision or a
subtly wrong colour. Mitigation: per-page captures before and after, and the
migration is sequenced last so a regression there cannot mask the earlier
slices. This is the slice most likely to need a second pass.

**Colour is not a pure mapping.** `Text`'s `variant` sets colour and the
typography classes bake their own colour in — `.text-label` and `.text-small`
are `--color-text-subtle`, `.text-body` is `--color-text-main`. Where a call
site paired an unusual `variant`/`size` combination, the class that matches the
size may not match the colour, and needs a colour utility alongside it. Expect a
handful of these rather than a clean 1:1.

**`.text-label` and `.text-small` are responsive.** They are larger on mobile
(16px and 14px) than the flat `text-xs` they replace. Dev pages are desktop
tools and are not used on phones, but the Audit and Issues tables are dense
enough that a narrow window will now wrap differently.

**Client-side routing changes mount behaviour.** Pages that today get a fresh
module scope on every visit will keep component state across navigations. Any
page relying on a full reload to reset itself would behave differently. DM
Doctor's warning counters explicitly track "since app start" and read from a
module-level installed counter, so they are the one to verify by hand.

**Verification is visual.** The instrument in §6 catches collisions and can
diff screenshots, but "does the grid look right" is a judgment call. Captures
before and after each slice are attached to the plan for exactly this reason.

---

## 5. Success criteria

1. Navigating between any two dev pages shows no blank screen — the nav bar
   never disappears. Verifiable: after the change, `performance.navigation`
   records no new document navigation on a nav click.
2. The collision sweep returns `[]` on all eleven pages (it currently returns
   six hits on two pages, and `[]` on the other nine as control).
3. Every page renders the same header shape and picks a named width tier.
4. `/dev/playground` works; `/playground` redirects to it; `/dev/dependencies`
   is gone.
5. Home fits all ten tools without scrolling at 1440x900.
6. `grep -rn "<Text" src/dev --include=*.tsx` returns nothing, bringing the dev
   pages in line with the mandatory web rule. Verifiable as a one-line check,
   and worth adding as a lint guard so it cannot silently come back.

---

## 6. The instrument

Verification is done with a small CDP driver rather than by eye. It needs no
dependencies: Node 22 has a global `WebSocket` and `fetch`, and Edge is present
on Windows, so it launches `msedge --headless=new --remote-debugging-port`,
attaches, and drives the page.

It lives in a local scratch directory, not in the repo. Ask the operator for it,
or rebuild it — it is roughly 100 lines. It takes a JSON job file listing steps
(`url`, `wait`, `eval`, screenshot on/off) and writes a PNG per step plus a
`result.json`.

Three probes were used here and should be re-run after each slice:

- **Collision sweep** — walks the DOM for inline sibling pairs with a ≥4px font
  size delta that share a line. Returns `[]` when clean.
- **Timing** — reads `performance.getEntriesByType('navigation'|'paint')` for
  first-paint, FCP and resource count.
- **Inventory** — `scrollHeight`, `.text-xs` node count and content column width
  per page, which is how the width and type-scale tables above were built.

Because nine pages already return `[]` from the collision sweep, it has a
built-in control: if a change makes those nine start reporting hits, the
instrument or the change is wrong, not the two target pages.

---

*Last updated: 2026-08-11*
