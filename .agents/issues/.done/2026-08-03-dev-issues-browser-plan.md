---
type: task
title: "Dev viewer: replace Tasks + Bugs with one filterable Issues browser"
status: in-progress
created: 2026-08-03
priority: medium
area: dev tooling / .agents markdown viewer
related_docs:
  - ".agents/agents-workflow.md"
---

# Dev viewer: one Issues browser instead of Tasks + Bugs

The `.agents/` tree was reorganised: `bugs/` and `tasks/` merged into a single
`issues/` folder whose subfolders carry state (`.open/`, `.deferred/`, `.done/`,
`.archived/`, root = in progress) and whose `type: bug | task` frontmatter carries
the old bugs-vs-tasks distinction. The dev viewer at `localhost:5173/dev` still
models the old world: separate **Tasks** and **Bugs** pages reading folders that
no longer exist.

Both pages currently render **empty**, and the underlying data is dirtier than it
looks.

## 1. Current state

| Piece | File | What it does |
|---|---|---|
| Scanner | `src/dev/docs/utils/scanMarkdownFiles.cjs` | `yarn scan-docs` walks `.agents/{docs,tasks,bugs,reports}` and writes `markdownFiles.json` |
| Manifest | `src/dev/docs/utils/markdownFiles.json` | Committed build artifact the frontend imports |
| Hook | `src/dev/docs/hooks/useMarkdownFiles.ts` | Derives title/slug/status/priority from path + frontmatter |
| List UI | `src/dev/docs/components/FilterableList.tsx` | Search + status/complexity/priority chips, folder-tree grouping |
| Pages | `Docs.tsx`, `Tasks.tsx`, `Bugs.tsx`, `Reports.tsx` | Four near-identical page shells |
| Detail | `src/dev/docs/MarkdownViewer.tsx` | Fetches the raw `.md`, renders it, shows a metadata box |
| Routes | `src/components/Router/Router.web.tsx:295-330` | `/dev/{docs,tasks,bugs,reports}/:id?`, dev-only |
| Nav | `src/dev/DevNavMenu.tsx`, `src/dev/DevMainPage.tsx` | Tabs and cards |

Vite already serves `.agents/` in dev (`web/vite.config.ts` → `server.fs.allow`).

## 2. What the data actually looks like

Survey of all **517** markdown files under `.agents/issues/`:

**Folder distribution** — `.done` 317, `.open` 55, `.archived` 31, `.deferred` 5,
root 6, plus 7 named epic folders (`transport` 17, `mobile-dev`,
`port-from-mobile`, `port-to-mobile`, `quorum-shared-migration`, `messagedb`,
`search-optimization`) which carry their own nested `.done/` / `.archived/`.

**By folder-derived state** — in-progress 65, open 55, deferred 5, done 342,
archived 50.

**Type** — `task` 411, `bug` 98. Every file that parses has a `type`.

**Four data problems:**

1. **8 files have YAML so malformed that `gray-matter` throws** — their entire
   frontmatter is lost, so they would render with no title, no type, no state.
   Causes: an unquoted `:` inside long prose (`severity: … (see Update): the
   button is disabled…`), and prose continuation lines indented under `status:`.
   The current scanner calls `matter()` unguarded, so this is also a crash risk.
2. **13 of the 65 `priority:` values are prose**, e.g.
   `priority: medium — downgraded from HIGH once the mechanism was shown to work`,
   `priority: high (a test suite that under-reports coverage is worse…)`,
   `priority: medium-high`. Unfilterable as-is.
3. **42 files have a `status:` that contradicts the folder they live in** — 26
   `.done/` files still say `in-progress`, 13 `.archived/` files say
   `in-progress`, 3 say `on-hold`.
4. **Priority is nearly absent** — 65/517 overall, and only **19 of the 125
   actionable** (in-progress + open + deferred) issues have one.

Beyond the core fields, agents have invented ~90 one-off frontmatter keys
(`severity` 34, `area` 38, `related` 43, `repos`, `scope`, `spans-repos`,
`root-cause`, `verified-by`, …). These are display-only; nothing filters on them.

## 3. Decisions

| Question | Decision |
|---|---|
| Priority scale | **low / medium / high** only. `critical` is not used today; the reader still maps any stray `critical` → `high` so nothing disappears. |
| Priority backfill | **Actionable issues only** — the 125 in-progress/open/deferred files. Done/archived keep whatever they have. |
| Frontmatter fix scope | **Everything broken, everywhere** — all 8 parse errors, all 13 messy priorities, all 42 status/folder mismatches, across the full 517. |
| Rescued prose | **Dropped.** `priority:` is reduced to the bare word. |

**Stated assumption** (flagged, correct me if wrong): "drop the prose" is applied
to `priority:`, the field that gets filtered. `severity:` is display-only and
several of its values are *entirely* prose with no grade word ("user-visible —
space members render as a truncated address…"). Reducing those to one word would
delete the only information they carry, so **`severity:` keeps its full text and
is simply quoted properly** to make the YAML valid.

**Source of truth for state:** the folder, per `docs-manager`. The one exception
the convention allows is `on-hold`, which lives in the root alongside
in-progress — so a root file that declares `status: on-hold` is shown as on-hold.
Everywhere else the folder wins and the frontmatter is rewritten to agree.

**Two divergences from the global `docs-manager` skill**, both out of scope here
and both tolerated by the reader either way:

1. It documents `critical` as a valid priority; this drops it from the filter and
   folds it into `high` on read.
2. Its four task templates all mandate `complexity:`, which agents have in
   practice stopped writing (see the filter table below). If it should go, the
   skill needs the edit — the viewer just stops filtering on it.

## 4. Design

Follows the repo's existing three-way split (pure core / reader / page), the same
shape as `dm-doctor` and `identity-coverage`.

### 4.1 New pure module — `src/dev/docs/utils/issueTaxonomy.ts`

All the folder-and-frontmatter semantics in one testable place, no I/O:

- `deriveState(folder, frontmatterStatus)` → `in-progress | open | deferred | done | archived | on-hold`
  - last dot-segment of the folder path wins (`mobile-dev/.archived` → archived)
  - no dot-segment → `in-progress`; root file declaring `on-hold` → `on-hold`
- `deriveEpic(folder)` → first non-dot path segment, or `null`
- `normalizePriority(raw)` → `low | medium | high | null` (leading word, lowercased, `critical` → `high`)
- `normalizeType(raw)` → `bug | task | null`

Unit-tested under `src/dev/tests/dev/issueTaxonomy.test.ts`.

### 4.2 Scanner — `scanMarkdownFiles.cjs`

- Scan `.agents/issues` instead of `.agents/tasks` + `.agents/bugs`; `docs` and
  `reports` untouched.
- Wrap `matter()` in try/catch: a malformed file degrades to empty frontmatter
  with a `parseError` string rather than killing the whole scan.
- Print a summary line per section and a loud warning listing any `parseError`
  files, so a future YAML break is visible at scan time.

### 4.3 Hook — `useMarkdownFiles.ts`

- Accept `'issues'` as a type; drop the `tasks`/`bugs` branches and their
  filename-sniffing heuristics (`determinePriority` guessing from words like
  "crash" in the filename goes away — priority comes from frontmatter only).
- Populate `state`, `epic`, `type`, `priority` via `issueTaxonomy`.
- Fix `generateSlug` to strip the `issues/` prefix.
- Sort newest-first by `created` (falling back to the filename date prefix).

### 4.4 Page — `src/dev/docs/Issues.tsx`

Replaces `Tasks.tsx` and `Bugs.tsx` (both deleted). Route `/dev/issues/:issueId?`;
`/dev/tasks` and `/dev/bugs` routes removed. `DevNavMenu` and `DevMainPage` get a
single **Issues** entry.

### 4.5 Filters — `FilterableList.tsx`, `issues` mode

| Filter | Chips |
|---|---|
| **Type** | All · Bug · Task |
| **State** | All · In progress · Open · Deferred · Done · Archived (· On hold, only if any) |
| **Priority** | All · High · Medium · Low · None |
| Search | unchanged (title + path) |

Chip counts are cross-filtered: "Bug (22)" next to an active **Open** chip means
twenty-two *open* bugs. A count that ignored the other filters would promise
results that clicking it does not deliver.

**No complexity filter.** The field is abandoned: 94% of issues filed in December
2025 carried one, versus **0% of those filed in July and August 2026**. Filtering
on it would sort the backlog by when it was written rather than by anything about
the work. It still renders in the detail view for the 116 older issues that have
one. (`docs-manager` still mandates it via its task templates — a separate
decision, noted below.)

Zero-count chips stay hidden, as today. Grouping keeps epic folders as headings
but flattens nested dot-folders, so `transport/.done/x.md` groups under
**transport**, not under **transport → .done** — state is a filter now, not a
heading. Default view is **All**, newest first; the chip counts make the shape
obvious and one click narrows it. Easy to change once it's on screen.

### 4.6 Detail view — `MarkdownViewer.tsx`

Metadata box gains **Priority**, **Severity**, **Area**, and the `related_*`
arrays as links. Then a generic **"Other fields"** section renders every
remaining frontmatter key, so none of the ~90 improvised fields is invisible and
no future field needs a code change.

### 4.7 Cleanup

- Delete `src/dev/docs/utils/markdownLoader.ts` — dead code, nothing imports it,
  and it hardcodes `.agents/tasks/…` paths that no longer exist.
- ~10 source comments still point at `.agents/tasks/…` / `.agents/bugs/…` paths
  (e.g. `ActionQueueContext.tsx:11`, `indexedDbAdapter.ts:149`,
  `dmDoctorCore.ts:521`). Repoint them at their `issues/` homes.

## 5. Slices

Each ends in something observable in the browser.

- [x] **1 — The Issues page exists and lists everything.** — PR #304
      Taxonomy module + tests, scanner rescoped, hook updated, `Issues.tsx`,
      routes, nav. Tasks and Bugs gone.
      *Observable:* `/dev` shows one **Issues** tab; it lists all 517 files
      grouped by epic, each row badged with type, state and priority.
- [x] **2 — Filters work.** — PR #304
      Type / state / priority / complexity chips with live counts, plus sorting.
      *Observable:* clicking "Bug" + "Open" narrows to open bugs; the counter
      tracks it.
- [x] **3 — Every field is visible on an issue.** — PR #307
      Metadata box + generic other-fields section.
      *Observable:* opening an issue shows priority, severity, area, related
      links, and anything else its frontmatter carries.
- [x] **4 — Frontmatter is mechanically clean.**
      8 parse errors fixed, 13 messy priorities reduced, 42 status/folder
      mismatches reconciled. A verification script re-runs the survey and reports
      zero of each.
      *Observable:* the 8 previously-blank files show real titles and badges; the
      priority chips add up.
- [x] **5 — Actionable issues have a priority.**
      Backfill low/medium/high on the ~106 in-progress/open/deferred issues that
      lack one, reading each issue's own severity/impact wording.
      *Observable:* filtering "Open + High" returns a real, useful worklist
      instead of near-empty results.
- [x] **6 — Stale path references repointed.** — PR #307

## 6. Verification

- `yarn validate` (tsc + eslint) clean.
- `yarn test:run` — new `issueTaxonomy` unit tests green alongside the existing suite.
- `yarn scan-docs` completes and reports **0 parse errors**.
- A scratch survey script re-run after slice 4 reports: 0 parse errors, 0 messy
  priorities, 0 status/folder mismatches.
- Manual pass on `localhost:5173/dev/issues`: counts, chips, epic grouping, and a
  detail page render correctly.

## 7. Outcome

All six slices landed on 2026-08-03. Code in PRs **#304** and **#307**; the data
pass is `.md`-only and therefore sits uncommitted on `main` per the docs
workflow.

**Verified after the data pass** (520 issue files):

| Check | Before | After |
|---|---|---|
| Files whose YAML fails to parse | 8 | **0** |
| `priority:` values that are prose | 13 | **0** |
| `status:` contradicting its folder | 44 | **0** |
| Files missing `type:` or `status:` | 0 | **0** |
| Actionable issues carrying a priority | 19 / 127 | **126 / 127** |

`tsc --noEmit` and `eslint` clean; suite **941/941** (44 new unit tests across
`issueTaxonomy` and `frontmatterDisplay`). `yarn scan-docs` reports no parse
errors.

**Backfill distribution** — 12 high, 31 medium, 62 low. The high ones are the
security and data-integrity issues (Electron key at rest, reset not deleting the
master key, join-binding rebind, config-sync space loss, Safari passkey session
loss, the evals bloat that breaks config sync) plus the four live transport
items. Epic trackers, READMEs, shipped logs and historical `mobile-dev/` material
were graded `low` deliberately: they are reference material, not work, and
grading them anything else would crowd the real backlog.

**One issue is deliberately left ungraded** —
`2026-08-03-a-typing-frame-is-never-acked-so-the-relay-may-redeliver-it-forever.md`.
Its author wrote `priority: unknown until the one open question is answered`,
which is a genuine statement about the issue, not sloppiness: it is trivial if
typing frames are not retained and significant if they are. Inventing a grade
would fake certainty, so the field was removed and the reasoning moved into the
body. It shows under the **None** chip, which is the honest answer.

**Two YAML repairs kept text rather than dropping it**, against the general
"drop the prose" rule, because dropping would have destroyed the only content
the field carried:

- `severity:` values that are entirely prose were quoted, not truncated to a
  grade word — severity is display-only and never filtered.
- The prose wedged under `status:` in
  `2026-07-19-space-deletion-ghost-cleanup.md` (defects B and C fixed and
  operator-verified 2026-08-01) was moved into the body as a callout.

**Still open:** nobody has looked at the page in a browser. `tsc`, `eslint` and
the suite all pass, but that is not the same as seeing it render.

---
*Last updated: 2026-08-03*
