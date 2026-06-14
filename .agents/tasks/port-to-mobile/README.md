---
type: index
title: "Port to Mobile — Master Tracker"
status: ongoing
created: 2026-06-12
updated: 2026-06-12
---

# Port-to-mobile — desktop → mobile feature diff

> The **mirror image** of [port-from-mobile/](../port-from-mobile/). That folder tracks what mobile has and desktop is missing (and we port INTO desktop). **This folder tracks the inverse**: what desktop has and mobile is missing or implements worse — work that should flow OUT to mobile.

> **🔴 New session? The whole port-to-mobile concern is just two docs + one shared tracker:**
> 1. **[candidates.md](candidates.md)** — desktop → mobile candidates. Both kinds in one place via a `Type` column: `feature-port` (mobile lacks it entirely) and `convergence` (both have it, desktop's is better). This is where "what should mobile get?" gets answered.
> 2. **[../quorum-shared-migration/mobile-tasks-pending.md](../quorum-shared-migration/mobile-tasks-pending.md)** — **as of 2026-06-14, a signpost, not a list.** It used to be the hand-maintained "unified tracker" of every dropped mobile task, but a desktop-side list of mobile tasks rots (status changes in mobile sessions). It now just points at the live mobile-side homes: `quorum-shared-migration/STATUS.md` (migration triage) and `RECAP.md` (overall dashboard) in the **mobile** repo, plus the per-task files. When a candidate here graduates into a concrete task, drop the task file in the **mobile** repo — don't add a row to the signpost.

> **What we do NOT do.** We do **not** push code to `quorum-mobile`. Mobile is read-only context for this effort (same rule as [port-from-mobile/workflow.md](../port-from-mobile/workflow.md)). These docs are a curated reference for the lead dev and future sessions, not an action list we execute against mobile.

## Why this folder exists

`port-from-mobile/` was already conceptually a two-way diff, but it only had a home for ONE direction's *candidates* (mobile→desktop, in its `candidates.md`) plus a single inverse-inventory file (`desktop-better-than-mobile.md`). As the desktop→mobile backlog grows (true feature ports, not just convergence observations), that one file wasn't enough and lived in the wrong folder. This folder gives the desktop→mobile direction a clean, symmetric home so nothing gets scattered.

## The system at a glance

```
port-from-mobile/          ← mobile HAS it, desktop is missing → port INTO desktop (we act on this)
  candidates.md            ← mobile→desktop candidates
  workflow.md, shipped-log.md, .done/ ...

port-to-mobile/            ← desktop HAS it (better/at all), mobile is missing → flows OUT to mobile (lead-dev reference)
  README.md                ← this file
  candidates.md            ← desktop→mobile candidates (Type: feature-port | convergence)

quorum-shared-migration/
  mobile-tasks-pending.md  ← SIGNPOST → points at the live mobile-side trackers
                             (mobile repo: STATUS.md, RECAP.md, per-task files)

quorum-mobile/.agents/  (gitignored — the live mobile-side homes)
  tasks/quorum-shared-migration/STATUS.md  ← migration-task triage
  RECAP.md                                 ← overall mobile dashboard
  tasks/…                                  ← per-task files (the real status)
```

**Separation of concerns (no overlap):**
- **port-to-mobile/candidates.md** = observations. "Mobile should get X." Not yet a task.
- **A dropped task** = a task file in the **mobile** repo (status tracked there, in its frontmatter + `STATUS.md`). The desktop `mobile-tasks-pending.md` is just a signpost to those homes — not a queue you add rows to.

A candidate becomes a real task at the moment it stops being "an observation" and becomes "a thing we've written a mobile task file for." See [candidates.md → Lifecycle](candidates.md#lifecycle).

## Relationship to the other task folders

- **[port-from-mobile/](../port-from-mobile/)** — the opposite direction. Read its [workflow.md](../port-from-mobile/workflow.md) for the cross-repo rules (mobile read-only, "port the capability not the UX pattern", capability-verification step). They apply here too, just reversed.
- **[quorum-shared-migration/](../quorum-shared-migration/)** — moves existing code into `@quilibrium/quorum-shared`. Overlaps with port-to-mobile when a convergence candidate's shared piece is a promotion. Follow that folder's [cross-repo-workflow.md](../quorum-shared-migration/cross-repo-workflow.md) for the shared leg; the mobile-adoption leg lands as a task file in the **mobile** repo (tracked in mobile's `STATUS.md`).

---

*Last updated: 2026-06-14 — clarified that `mobile-tasks-pending.md` is now a thin INDEX (slug + pointer per row), not a status store: live status lives in the mobile repo (`STATUS.md` / per-task files) where the work happens.*

*Previously: 2026-06-12 — folder created. Holds the desktop→mobile candidate inventory (`candidates.md`, which absorbed the former `port-from-mobile/desktop-better-than-mobile.md` and adds a `feature-port` lane). Points at the now-unified `mobile-tasks-pending.md` as the single task tracker rather than spawning a second one.*
