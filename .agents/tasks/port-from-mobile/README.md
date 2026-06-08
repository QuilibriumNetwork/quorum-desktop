---
type: index
title: "Port from Mobile — Master Tracker"
status: ongoing
created: 2026-06-01
updated: 2026-06-01
---

# Cross-app feature diff (port-from-mobile) — Master Tracker

> **🔴 New session? Read these first, in order:**
> 1. **[workflow.md](workflow.md)** — workflow rulebook for this effort. Session branching, PR sizing, pulling all three repos, when to promote to shared, **mandatory capability-verification step** (read this — symbol-grep is not enough), "port the capability, not the UX pattern" rule. Re-read at the start of every session.
> 2. **[candidates.md](candidates.md)** — running list of mobile features that don't exist on desktop. Filter for what to pick next.
> 3. **[desktop-better-than-mobile.md](desktop-better-than-mobile.md)** — inverse inventory: capabilities where desktop's implementation is materially better than mobile's. Reference doc for the lead dev / future port-to-mobile work. Read when verifying that a candidate isn't already on desktop under a different name.
> 4. **[shipped-log.md](shipped-log.md)** — chronological history of what's been ported + lessons learned.

> **What this folder is.** Conceptually a **two-way feature diff** between `quorum-desktop` and `quorum-mobile`. Active work runs through [candidates.md](candidates.md) — features mobile has and desktop is missing, ported selectively to desktop. The sibling [desktop-better-than-mobile.md](desktop-better-than-mobile.md) tracks the inverse (capabilities where desktop is better), which we do NOT act on directly (mobile is read-only for this effort) but record so the lead dev has a curated convergence list when there's bandwidth.

> **What we do.** Pick features that make sense on desktop UX, port them, opportunistically promote pure logic to `@quilibrium/quorum-shared`. When porting, port the *capability*, not the mobile UX pattern (see workflow.md).

> **What we do NOT do.** We do NOT push code to `quorum-mobile`. Mobile is read-only context.

> **Relationship to [quorum-shared-migration/](../quorum-shared-migration/).** That folder moves existing code into shared. This folder is a two-way feature diff between apps. They overlap when a port surfaces shareable logic — in that case, follow the shared-migration's [cross-repo-workflow.md](../quorum-shared-migration/cross-repo-workflow.md) for the shared piece, and consider whether a `mobile-tasks-pending.md` entry over there is warranted (concrete swap task) vs. a `desktop-better-than-mobile.md` entry here (broader capability-shaped observation).

## Architecture principle

We are NOT trying to mirror mobile feature-for-feature. We pick features that:
1. Make sense on desktop UX (e.g. wallet / governance might, calling might not, voice notes might not).
2. Don't require a major desktop architectural shift to land.
3. Either already exist in `@quilibrium/quorum-shared` (easy port) or have portable pure logic worth promoting.

When a feature doesn't fit those criteria, we skip it — desktop doesn't need to be a mobile clone.

## Folder layout

```
port-from-mobile/
├── README.md                          ← this file (catalog: status table + pointers)
├── workflow.md                        ← workflow rulebook (read every session)
├── candidates.md                      ← mobile features not on desktop (running inventory + per-candidate notes)
├── desktop-better-than-mobile.md      ← inverse: where desktop is better than mobile (port-to-mobile candidates for the lead dev)
├── shipped-log.md                     ← chronological history + lessons learned
├── 2026-XX-XX-port-<slug>.md          ← active per-feature task files (date-prefixed)
└── .done/                             ← completed per-task files land here
```

**Doc separation of concerns** (no overlap):
- **README.md** = catalog. Status table of features being ported + pointers. What exists.
- **candidates.md** = mobile→desktop inventory + per-candidate notes/decisions. What we could pick.
- **desktop-better-than-mobile.md** = desktop→mobile inventory. Where desktop is better. Reference for the lead dev's future convergence work; we don't act on it directly.
- **shipped-log.md** = history. Chronological entries per port + lessons learned. What changed and why.

**Convention.** Per-feature executable tasks live at the root, dated `YYYY-MM-DD-port-<slug>.md`, and move into `.done/` once merged. Evergreen workflow/reference docs (workflow, candidates, shipped-log, README) live at the root WITHOUT date prefixes.

## Status table

Legend: ✅ done · 🟢 ready to start · 🚧 in progress · ⏸️ deprioritized · ❌ won't port · 📋 investigating

| Feature | Mobile location | Status | Reference |
|---|---|---|---|
| Unified /spaces page — PR 1 (My Spaces + Discover) (#1) | `app/(tabs)/spaces/discover.tsx`, `hooks/chat/useExploreSpaces.ts` (Discover only); My Spaces tab is desktop-original | ✅ shipped (PR #170, 2026-06-04) | [Task file](.done/2026-06-01-port-discover-spaces.md) · [candidates.md `### #1`](candidates.md#1-discover-spaces--shipped) |
| Unified /spaces page — PR 2 (Join via link + Create space tabs + retire old modals) | Obsoleted by new UI shell (PR #171, 2026-06-03) | ❌ obsolete | [Task file](.done/2026-06-01-port-discover-spaces-pr2.md) |
| Public profile + remove `/discover/people` (#6) | `services/profile/publicProfile.ts`, `hooks/useUserPublicProfile.ts`, `hooks/useMembersWithPublicProfileFallback.ts` | 🚧 in progress (2026-06-08) | [Task file](2026-06-08-port-public-profile.md) · [candidates.md `### #6`](candidates.md#6-public-profile-ui--in-progress-2026-06-08) |
| Reporting (#5) | `services/reporting/reportService.ts`, `components/ReportModal.tsx` | ⏸️ deprioritized | [candidates.md `### #5`](candidates.md#5-reporting--deprioritized) |
| Message search (#2) | — | ❌ already on desktop | [candidates.md `### #2`](candidates.md#2-message-search--ruled-out) |
| Reply tracking (#3) | — | ❌ desktop strictly better | [desktop-better-than-mobile.md #1](desktop-better-than-mobile.md#1-reply-notification-counts) |
| Last-message-preview / spaces sort (#4) | — | ❌ UX-pattern conflict | [candidates.md `### #4`](candidates.md#4-last-message-preview--spaces-list-sort--wont-port) |
| OG metadata (#8) | — | ⚠️ Farcaster-only on mobile | [candidates.md `### #8`](candidates.md#8-og-metadata---farcaster-only-on-mobile) |

## Next up

**🚧 In progress (2026-06-08, branch `session-2026-06-08`).** [2026-06-08-port-public-profile.md](2026-06-08-port-public-profile.md) — port what mobile actually ships of the public-profile capability (publish toggle, DM-header resolve-by-address, member fallback resolver) and remove the speculative `/discover/people` People tab + the now-degenerate `DiscoverSidebar`. The NavRail "Discover" entry becomes "Public spaces" pointing directly at `/discover/spaces`. Scope clarified during pickup: the server exposes no user-enumeration endpoint, so a profile directory isn't viable on either app — see [`candidates.md` #6 notes](candidates.md#6-public-profile-ui--in-progress-2026-06-08).

## Branch / session workflow

- **[workflow.md](workflow.md)** — full rules. Headline: session branches (`session-YYYY-MM-DD`), rename on ship, pull all three repos first, feature-scoped PRs.

## Open questions / parking lot

(Add anything that doesn't fit yet but might matter later.)

---

*Last updated: 2026-06-08 — #6 Public profile UI picked up on `session-2026-06-08`. Scope clarified during pickup: backend has no user-enumeration endpoint, so neither app has a profile directory. The port = publish toggle + DM-header resolve-by-address + member fallback resolver. Bundled: removal of speculative `/discover/people` + simplified Discover chrome. Status table updated to reflect #1 shipped and PR 2 obsolete.*

*Previously: 2026-06-01 — discover-spaces port scoped up to a unified `/spaces` page; PR 1 task file drafted with all 11 design decisions locked; PR 2 task file drafted alongside it (deferred status) to preserve the same-session design context.*

*Previously: 2026-06-01 — reframed as a two-way feature diff after several "same capability under different names" discoveries. Added [`desktop-better-than-mobile.md`](desktop-better-than-mobile.md). Capability-verified #6 and #1 missing on desktop; user picked #1 as first port. #2, #3, #4, #8 ruled out for various reasons (see status table).*
