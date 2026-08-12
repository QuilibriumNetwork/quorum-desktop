---
type: task
title: "Dev pages design system: implementation plan"
status: done
priority: medium
created: 2026-08-11
updated: 2026-08-12
area: dev tools / layout / design consistency
repos: quorum-desktop
related:
  - ".agents/issues/.done/2026-08-11-dev-pages-design-system-design.md (the design this executes)"
---

# Dev pages design system — implementation plan

Executes [the design](2026-08-11-dev-pages-design-system-design.md). Branch:
`dev-pages-design-overhaul`.

## Status

**2026-08-12 — shipped in PR #330** (`refactor(dev): the /dev pages share one
layout, and navigating them stops going blank`)

What landed: all nine slices. The eleven `/dev` pages share one shell
(`src/dev/shell/`) and one width; nav routes client-side so it no longer blanks
the screen for ~1.6s; the `Text` primitive is gone from `src/dev` (154 uses);
`/playground` moved to `/dev/playground` and the dead `/dev/dependencies` route
was removed; Home is a grid, Fake QNS is neutral, and the Component Audit is
flagged obsolete.

Verified with a headless browser over CDP: collision sweep clean on every page
from a baseline of five hits on two, nav clicks record no document navigation
(with a control run that does), 1407 tests pass, and the production build
carries no dev code.

One finding was spun out rather than fixed:
[`.open/2026-08-12-typography-classes-have-no-working-colour.md`](2026-08-12-typography-classes-have-no-working-colour.md)
— it changes production appearance app-wide and wants its own reviewed change.

---

## Slice 1 — Navigating dev pages stops going blank ✅ done 2026-08-11

Shipped as `dev-pages-design-overhaul`. Outcome verified both ways:

- Clicking a nav link: a flag set on `window` **survives** the navigation,
  `performance` navigation entries stay at 1, the URL and heading update and the
  nav bar stays mounted. No document teardown.
- Control, driving the same navigation with `location.href` (the old
  behaviour): the CDP session dies with *"Inspected target navigated or
  closed"*, because the document really is replaced. The assertion can fail,
  so passing it means something.
- Operator confirmed the UI by hand.

One addition beyond the original scope: `DevNavMenu`'s `currentPath` became
optional, defaulting to `useLocation().pathname`. `DevPageLoading` needs the
correct highlight without knowing the destination, and it incidentally fixes
Fake QNS's missing highlight (§1-B) ahead of slice 6.

One correction worth recording: `DevPageLoading` cannot be imported statically
into `Router.web.tsx`. `web/vite.config.ts` marks `/src/dev/` **external** in
production builds, so a static import would emit a bare unresolvable import into
the production bundle. It goes through `lazyDevImport` like every other dev
component, with an inner `<Suspense fallback={null}>` for the shell's own chunk.



**Observable outcome:** click any tab in the dev nav. The nav bar stays on
screen and the content swaps. No white/black flash, no 1.6 s of nothing.

**Changes**

- `src/dev/DevNavMenu.tsx` — `<a href>` → `<Link to>` from `react-router`.
- `src/dev/DevMainPage.tsx` — drop `handleNavigate`/`window.location.href`,
  use `useNavigate()`. Cards become `<Link>` so middle-click and
  ctrl-click still open a new tab.
- `src/dev/shell/DevPageLoading.tsx` — new. Centered spinner and
  "Loading <name>…", rendered inside the page shell so the nav stays put.
- `src/components/Router/Router.web.tsx` — replace the eleven
  `<div>Loading …</div>` fallbacks with `<DevPageLoading name="…" />`.

**Verify**

- Timing probe on a nav *click* (not a cold load): assert no new `navigation`
  entry is recorded, i.e. the document was never replaced.
- Baseline for comparison, already measured: cold load of `/dev/audit` is
  first-paint 1640 ms, FCP 1884 ms, 250 resources.
- Revert check: put one `<a href>` back and confirm the blank screen returns.
  If it does not, the diagnosis was wrong and slice 1 needs re-thinking before
  going further.

**Watch for:** `DevNavMenu` is rendered by pages that are themselves lazy-loaded
inside `Suspense`; `Link` requires a router context, which is present, but Fake
QNS currently renders `<DevNavMenu />` with no props — confirm it still mounts.

---

## Slice 2 — Stat labels stop colliding with their numbers ✅ done 2026-08-12

Sweep returns `[]` on all eleven pages, from a baseline of five hits on two.
The nine control pages stayed `[]` throughout. Captures confirm label, value and
hint now stack, with the tone colour on the number. Typecheck clean; lint
unchanged at 0 errors / 278 warnings, so nothing new was introduced.

Three things worth recording:

- **The baseline was five, not six.** The sixth was a detector artifact — see
  the corrected table in design §1-D. Found by tightening the instrument before
  trusting it, which is why it did not turn into a phantom fix.
- **`tone` being semantic paid for itself immediately.** Typing it as
  `good | bad | warn | neutral` rather than a class string made the compiler
  surface six further call sites that were passing raw Tailwind classes,
  including two `text-yellow-500` that no one had classified. Added a `warn`
  tone and a `deltaTone()` helper — deltas have the opposite polarity to counts
  (an increase is bad), which the old shared `countTone` silently got wrong.
- **`countTone` had to split in two.** Six table cells use it as a `className`
  rather than through a stat, so they now call `countToneClass()`.

Not verified by instrument: the ~15 stats inside Identity Coverage's snapshot
results, which need a signed-in account with data to render. Converted and
typechecked, but unproven visually.



**Observable outcome:** on Identity Coverage, `Degraded` and `0` sit on separate
lines with the number below the label. Same on DM Doctor's three warning
counters. Nothing reads as `Degraded0` any more.

**Changes**

- `src/dev/shell/DevStat.tsx` — new. Label, value and hint each block-level
  plain HTML with typography classes, no `Text` primitive.
  `tone: 'good' | 'bad' | 'neutral'` instead of a raw Tailwind class.
- `src/dev/identity-coverage/IdentityCoverage.tsx` — delete the local `Stat`
  (lines 46-67) and `countTone` (40-44), use `DevStat`.
- `src/dev/dm-doctor/DmDoctor.tsx` — warning counter tiles (around lines
  428-445) use `DevStat`. Also fix the `Sequence scan` header collision, which
  is the same inline-`Text` cause.

This slice fixes the six visible collisions. Slice 8 removes the primitive that
causes them, so they cannot recur — that ordering is deliberate: the visible bug
gets fixed early and cheaply, the structural cause is dealt with in the risky
slice at the end.

**Verify**

- Sweep must return `[]` on Identity Coverage and DM Doctor.
- Control arm: the other nine pages must *still* return `[]`. If any of them
  starts reporting hits, stop — the shared component is wrong.
- Revert check: restore the old `Stat` and confirm the sweep reports the six
  known hits again. An assertion that passes either way is worthless here.

---

## Slice 3 — The shell exists, and three pages prove it ✅ done 2026-08-12

All three pilots measured identical: titleTop 69, 24px h1 (later 30px, slice 4),
content column 1024. DB Inspector's narrowing from `6xl` to `5xl` did not crowd
its two-column layout.


**Observable outcome:** DM Doctor, Identity Coverage and DB Inspector have
identical header geometry and identical content width. Put their screenshots
side by side and the chrome is indistinguishable.

**Changes**

- `src/dev/shell/DevPage.tsx` — new. `min-h-screen bg-app`, always-sticky nav,
  width tier prop (`narrow | standard | wide | full`). Derives `currentPath`
  from `useLocation()`.
- `src/dev/shell/DevPageHeader.tsx` — new. Icon, title, subtitle, optional
  right-aligned `actions`.
- `src/dev/shell/index.ts` — barrel.
- Adopt in DM Doctor, Identity Coverage (`standard`) and DB Inspector
  (`standard`, with its Refresh/Copy buttons passed as `actions`).

Three pilots chosen because between them they exercise every header feature:
subtitle, action buttons, and a live-updating title suffix.

**Verify** Captures of all three; header y-offsets and content column width must
match. DB Inspector narrows from `6xl` to `5xl` — confirm its two-column layout
does not crowd.

---

## Slice 4 — Every remaining page adopts the shell ✅ done 2026-08-12

All eleven pages measured at titleTop 69, a 30px h1, four width tiers
(768/1024/1280/full) and no horizontal scroll — the risk flagged for the Audit
table. Playground was initially left on its own frame, then folded in fully once
the operator asked for the sticky sub-header to go (see below).


**Observable outcome:** all eleven dev pages share one header and one of four
named widths. Clicking through the whole nav feels like one product.

**Changes** — Docs, Issues, Reports (`wide`); Audit, Playground (`full`);
Error States (`narrow`); Home (`standard`); Fake QNS (`narrow`, header added —
it currently has none).

Per page: delete the hand-rolled `min-h-screen` wrapper, the `DevNavMenu` call
and the `max-w-*` div; wrap in `DevPage`; replace the bespoke title block with
`DevPageHeader`.

**Verify** Capture all eleven. Assert content column width is one of exactly
four values. Audit gains a max width, so confirm the table still fits and does
not gain a horizontal scrollbar at 1440px — it is the page most likely to
regress here.

**Watch for:** Playground has its own sticky sub-header
([PrimitivesPlayground.tsx:146](src/dev/primitives-playground/PrimitivesPlayground.tsx#L146))
that will now sit under the shell's sticky nav. Both sticky, so the offsets need
checking or they overlap.

---

## Slice 5 — Home becomes a grid ✅ done 2026-08-12

Measured docH 900 at 1440x900, from a 1597px single column. Two extras the
operator caught: card titles went to 20px, and descriptions were rendering
accent blue. That second one was a regression from slice 1 (the card became an
`<a>`, and `Text variant="main"` emits no colour class so it inherited the link
colour) compounded by a real stylesheet bug — filed as
`.open/2026-08-12-typography-classes-have-no-working-colour.md`.


**Observable outcome:** all ten tool cards visible at 1440x900 without
scrolling. Two columns on a medium window, one on narrow.

**Changes** `src/dev/DevMainPage.tsx` — `space-y-4` single column becomes
`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`, cards get `h-full`.

**Verify** Capture at 1440x900, 1024x768 and 768x900. Assert `scrollHeight <=
900` at 1440x900 (currently 1597).

---

## Slice 6 — Fake QNS looks like the rest of the app ✅ done 2026-08-12

No `yellow-500` and no `border-dashed` remain, and the page highlights itself in
the nav.


**Observable outcome:** Fake QNS uses the same background, borders, text colours
and card treatment as every other dev page. No amber, no dashed borders, not
full-bleed. It highlights itself in the nav bar, which it does not today.

**Changes** `src/dev/fake-qns/FakeQns.tsx` — remove amber/dashed styling
throughout, adopt standard `bg-surface-1 rounded-lg border border-default`
cards, `narrow` tier. The nav highlight fixes itself via `DevPage`'s
`useLocation()`.

Per the decision on record: fully neutral, no conditional warning banner.

**Verify** Capture. Assert no `border-dashed` and no amber token remains in the
file. Confirm the nav highlight now appears — that is a real defect being closed,
not cosmetics.

---

## Slice 7 — Routes line up ✅ done 2026-08-12

`/dev/playground` loads; `/dev/dependencies` returns 404. `App.tsx` lost its
now-redundant `/playground` branch.


**Observable outcome:** `/dev/playground` loads the playground.
`/dev/dependencies` is gone rather than silently serving a copy of the Audit
page.

**Changes**

- `Router.web.tsx` — move `/playground` to `/dev/playground`; delete the
  `/dev/dependencies` route and the `DependencyAuditViewer` alias (lines 51-54).
- `src/dev/DevNavMenu.tsx`, `src/dev/DevMainPage.tsx` — update the path.
- Grep `.agents/` and `src/` for `/playground` and `/dev/dependencies` and fix
  the references.

No redirect for the old `/playground` — decided against on 2026-08-11. It is a
dev-only route with no external consumers, so a stale bookmark landing on
`NotFound` is the correct and cheaper outcome.

**Verify** Assert `/dev/playground` loads, and that `/playground` and
`/dev/dependencies` both render `NotFound` rather than a page.

---

## Slice 8 — Retire the `Text` primitive, and small text becomes readable ✅ done 2026-08-12

Shipped as two commits, deliberately: a size-preserving conversion first (so any
visual diff is only the colour becoming explicit), then the readability bump.
`grep -rn "<Text" src/dev` returns 0, from 154 uses across 11 files.

The plan said not to batch this as a regex. In practice a converter that
decomposed `variant`/`size`/`weight`/`as` into utilities handled 151 of 154
mechanically and *refused* the 3 with a dynamic `variant`, which were done by
hand. The judgment the plan was protecting is real, but it lives in the
readability pass, not the conversion.

text-xs counts, before -> after: DM Doctor 7 -> 0, Identity Coverage 6 -> 0,
Fake QNS 9 -> 1; DB Inspector 24, Issues 1214, Audit 1016 all unchanged.


**Observable outcome:** explanatory paragraphs on the dev pages are comfortably
readable at 14px. Badges, pills and table headers are unchanged. Nothing looks
different in kind — this should read as the same pages, better set.

Sequenced last because it touches every string on the surface and is the most
likely to need a second pass. Everything before it is already shippable.

**Changes** Replace all 182 `<Text>` uses across twelve files with plain HTML
plus a semantic class from `src/styles/_typography.scss`, per the mandatory web
rule (design §1-H). Mapping table is in design §2-F. Highest-count files first
so the pattern is settled before the long tail: ComponentAuditViewer 48,
DmDoctor 32, IdentityCoverage 21, DbInspector 20, FakeQns 13, FrontmatterPanel
11, FilterableList 9, Reports 7, Issues 7, Docs 7, MarkdownViewer 4, DevMainPage
3.

The type-scale decision is applied here, once per call site: prose and hints go
to `.text-label` (14px), genuine metadata and chips to `.text-small` (12px).

Do **not** batch this as a regex. `variant`/`size` pairs do not map cleanly onto
classes that carry their own colour (design §4), so each site needs a look.

**Verify**

- `grep -rn "<Text" src/dev --include=*.tsx` returns nothing.
- Remove the now-unused `Text` import from all twelve files; `yarn lint` catches
  any that are missed.
- Capture every page and compare against the slice-7 baseline. Watch DB
  Inspector's store list and the Audit table — the tightest layouts, and the
  ones where a 12px → 14px bump is most likely to wrap or overflow.
- Re-run the `.text-xs` inventory for the record (baseline: Issues 1214, Audit
  1016, Playground 190, Docs 78, Reports 40, DB Inspector 24, Fake QNS 9, DM
  Doctor 7, Identity Coverage 6, Home 0, Error States 0). Expect the small pages
  to drop near zero and Issues/Audit to stay high — their counts are chrome.
- Sweep must still return `[]` everywhere.

**Consider** a lint rule or CI grep banning `<Text` under `src/dev/`, so the
rule is enforced rather than remembered. The dev pages drifted precisely because
nothing checked.

---

## Slice 9 — Docs match reality ✅ done 2026-08-12

The Dependency Map section is gone, routes corrected, and `shell/` documented as
the contract for new tools with the two rules that caused the worst bugs here
(use `<Link>`, never `<a href>`; never the `Text` primitive). Also swept four
stale `/playground` references out of `.agents/docs/`, and removed the
"exception is dev/playground files" carve-out from the primitives guide, which
is no longer true.


**Observable outcome:** `src/dev/README.md` describes the tools that exist, at
the URLs they actually live at.

**Changes** `src/dev/README.md` — remove the Dependency Map section (component
and JSON are gone), correct `/playground` → `/dev/playground`, fix the stale
`/dev/tasks` and `/dev/bugs` routes (both are `/dev/issues` now), drop
`Container` from the playground's primitive list (removed per AGENTS.md), and
document `src/dev/shell/` as the layout contract for new tools.

Then run the index script so the two new issue files land in `.agents/INDEX.md`.

**Verify** Every route named in the README returns a real page.

---

## Parallelisation — where it helps, and where it would cause the bug

This plan is deliberately **not** structured for `subagent-driven-development`
end to end. That skill gates on "tasks mostly independent"; slices 1-3 fail that
gate outright, since 2 and 3 both create and consume `src/dev/shell/` and both
edit DM Doctor and Identity Coverage. Running them concurrently means two agents
writing the same files.

The shape is a **hybrid**: a serial spine with two fan-out phases hanging off it.

| Slice | Parallelisable | Why |
|---|---|---|
| 1 routing | No | Three files, one coherent change |
| 2 DevStat | No | Creates shell API that 3 depends on |
| 3 shell + pilots | No | Defines the contract everything else adopts |
| **4 page adoption** | **Yes — 8 pages** | Disjoint files, shell API already fixed |
| 5 Home grid | No | One file, trivial |
| 6 Fake QNS | No | One file |
| 7 routes | No | Cross-cutting, touches the router |
| **8 Text removal** | **Yes — 12 files** | Disjoint files, mechanical mapping |
| 9 docs | No | One file, needs 1-8 finished |

Files are disjoint within each fan-out phase, so no git worktrees are needed —
agents can work in the same checkout.

**The caveat that matters more than the speedup.** This is a *consistency* task.
The eleven pages drifted apart in the first place because eleven independent
authors each made a reasonable local judgment. Slice 8 requires exactly that
kind of judgment 182 times ("is this string prose or a chip?"). Fanning it
across 12 agents reproduces the original failure mode at speed, and the output
would need a normalisation pass that costs more than the parallelism saved.

If slice 8 is fanned out, it needs the pattern locked first: do two or three
files by hand, extract the resulting decisions into an explicit call-site
mapping, and give every agent that exact table with instructions not to exercise
discretion beyond it. The mapping in design §2-F is the starting point, not a
sufficient brief.

**Recommendation.** Run the spine serially. Consider fan-out only for slice 4,
where the shell API constrains the work so tightly that there is little left to
judge. Note also that implementation speed is not the binding constraint here —
verification is, and every slice still has to be checked against captures one
page at a time regardless of how many agents produced the diff.

---

## Checks before this is done

- [ ] `npx tsc --noEmit --jsx react-jsx --skipLibCheck` clean
- [ ] `yarn lint` clean
- [ ] Test suite green — and note that `src/dev/tests/` covers DB inspector
      store coverage, which slice 3 touches
- [ ] Collision sweep returns `[]` on all eleven pages
- [ ] Captures of all eleven pages reviewed against baselines
- [ ] Manual pass, the one thing the harness cannot judge: click every nav item
      in order and confirm no blank frame and no layout jump. DM Doctor's
      "since app start" counters need a real look, because client-side routing
      changes when its module scope is torn down (design §4).

---

*Last updated: 2026-08-12*
