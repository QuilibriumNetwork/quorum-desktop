---
type: index
title: "Port from Mobile — Master Tracker"
status: ongoing
created: 2026-06-01
updated: 2026-06-01
---

# Port from Mobile — Master Tracker

> **🔴 New session? Read these first, in order:**
> 1. **[workflow.md](workflow.md)** — workflow rulebook for this effort. Session branching, PR sizing, pulling all three repos, when to promote to shared. Re-read at the start of every session.
> 2. **[candidates.md](candidates.md)** — running list of mobile features that don't exist on desktop. Filter for what to pick next.
> 3. **[shipped-log.md](shipped-log.md)** — chronological history of what's been ported + lessons learned.

> **What this folder is.** Single source of truth for the effort to port features from `quorum-mobile` to `quorum-desktop`. Mobile is partially ahead of desktop on several features (notifications stack, Farcaster hooks, calling, wallet, governance, QNS marketplace, etc., per the 2026-05-28 public-repo dump). This effort closes the gap selectively: we pick features that make sense on desktop, port them, and opportunistically promote logic to `@quilibrium/quorum-shared` when it's portable.

> **Relationship to [quorum-shared-migration/](../quorum-shared-migration/).** That folder moves existing code into shared. This folder ports features from one app to the other. They overlap when a feature port surfaces shareable logic — in that case, follow the shared-migration's [cross-repo-workflow.md](../quorum-shared-migration/cross-repo-workflow.md) for the shared piece.

## Architecture principle

We are NOT trying to mirror mobile feature-for-feature. We pick features that:
1. Make sense on desktop UX (e.g. wallet / governance might, calling might not, voice notes might not).
2. Don't require a major desktop architectural shift to land.
3. Either already exist in `@quilibrium/quorum-shared` (easy port) or have portable pure logic worth promoting.

When a feature doesn't fit those criteria, we skip it — desktop doesn't need to be a mobile clone.

## Folder layout

```
port-from-mobile/
├── README.md                    ← this file (catalog: status table + pointers)
├── workflow.md                  ← workflow rulebook (read every session)
├── candidates.md                ← mobile features not on desktop (running inventory)
├── shipped-log.md               ← chronological history + lessons learned
├── 2026-XX-XX-port-<slug>.md    ← active per-feature task files (date-prefixed)
└── .done/                       ← completed per-task files land here
```

**Three-doc separation of concerns** (no overlap):
- **README.md** = catalog. Status table of features being ported + pointers. What exists.
- **candidates.md** = inventory. Mobile features not on desktop, classified. What we could pick.
- **shipped-log.md** = history. Chronological entries per port + lessons learned. What changed and why.

**Convention.** Per-feature executable tasks live at the root, dated `YYYY-MM-DD-port-<slug>.md`, and move into `.done/` once merged. Evergreen workflow/reference docs (workflow, candidates, shipped-log, README) live at the root WITHOUT date prefixes.

## Status table

Legend: ✅ done · 🟢 ready to start · 🚧 in progress · ⏸️ blocked · ❌ won't port · 📋 investigating

| Feature | Mobile location | Status | Reference |
|---|---|---|---|
| _(none yet — initial inventory in progress)_ | | | |

## Next up

See [candidates.md](candidates.md) for the running list of mobile features not on desktop. Pick a candidate, create a `2026-XX-XX-port-<slug>.md` task file, branch, ship.

## Branch / session workflow

- **[workflow.md](workflow.md)** — full rules. Headline: session branches (`session-YYYY-MM-DD`), rename on ship, pull all three repos first, feature-scoped PRs.

## Open questions / parking lot

(Add anything that doesn't fit yet but might matter later.)

---

*Last updated: 2026-06-01 — folder created. Initial inventory pass scheduled this session.*
