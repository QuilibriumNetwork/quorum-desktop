---
type: task
title: "Triage of the 87 live issues: what is actually in the backlog, and what the folder taxonomy would and would not fix"
status: done
created: 2026-08-16
updated: 2026-08-16
area: process / issue tracking
---

# Triage of the 87 live issues

Run to answer one question before changing the issue taxonomy: **what is actually
sitting in `issues/` root and `.open/`, and would new folders fix it?**

Scope: the 87 files that are neither done nor archived (11 in root, 76 in
`.open/`). No file was moved and no frontmatter was changed.

## Method, and how much to trust each number

- **MEASURED**: file counts, folder locations, `updated:` dates and therefore
  ages, checkbox tallies, and whether a file's text contains a shipped-PR
  reference. These come from parsing every file.
- **INFERRED**: the per-category assignments below (needs-verification, blocked
  on a decision). These come from keyword matching over the body text and
  **have not been confirmed by reading each file**. Treat the counts as an
  order of magnitude, not a roster. Files also appear in more than one list.

> ## ⚠️ CORRECTION, 2026-08-16 (same day)
>
> **The first version of this report published wrong age figures.** It claimed
> 31 files older than six months and 18 older than a year. The real numbers are
> **25** and **4**.
>
> Cause: a parser bug in the triage script, not a property of the repo. Many
> files write `updated: '2026-01-09'` with **single** quotes, and the script
> stripped only double quotes, so those dates failed to parse and were bucketed
> as maximally old.
>
> The corrected figures are below. The section that drew a conclusion from the
> bad numbers has been rewritten, and its recommendation withdrawn.
>
> Second correction, from the operator and unrelated to the bug: **stale does not
> mean archivable.** An old issue is often just something there has not been time
> for. `.deferred/` means "might never be implemented, in limbo pending a
> decision", and `.archived/` means overtaken. Neither describes a valid, wanted,
> unstarted bug. The original recommendation to sweep old files into those
> folders was wrong on that ground too.

## The headline

| | count | share |
|---|---|---|
| Live files total | **87** | |
| ...in `issues/` root ("being worked on right now") | 11 | |
| ...in `.open/` | 76 | |
| Older than 6 months | 25 | 29% |
| Older than 1 year | 4 | 5% |
| Updated within 30 days | 44 | 51% |
| Carrying one bulk `2026-01-09` stamp | **17** | 20% |
| No parseable date at all | 1 | 1% |
| Mention a PR that already shipped | **12** | 14% |
| Design/plan pairs (10 files, 5 features) | 10 | 11% |

## The age pile is smaller and tamer than it first looked

Only **4** files are over a year old, and 25 are over six months. Of those 25:

| priority | count |
|---|---|
| high | 4 |
| medium | 9 |
| low | 12 |

So 21 of the 25 are medium or low. That is what a backlog looks like, not a
graveyard. They are correctly filed as `open`: still valid, still wanted, nobody
has had time. Moving them would mislabel them.

**17 of the 25 share one `2026-01-09` stamp**, which is a bulk edit rather than
real activity. For those files the age number measures nothing except when the
migration ran, so "219 days untouched" should not be read as neglect.

The genuinely interesting subset is small: **4 high-priority bugs that have been
buried for six months or more.**

```
360d  high  bug  2025-08-21-messagedb-cross-platform-storage-issue.md
246d  high  bug  2026-01-09-config-sync-space-loss-race-condition.md
219d  high  bug  2026-01-09-safari-passkey-session-loss-random-logout.md
219d  high  bug  2026-01-09-space-owner-privacy-limitation.md
```

That is the real cost of the current scan: not that old files exist, but that
four high-priority bugs are indistinguishable, at a glance, from twelve
low-priority ones filed the same week.

Which points at ordering rather than relocation. Nothing needs to move; the list
needs to be read in priority order.

One file, `2026-04-14-display-name-input-layout-shift-on-error.md`, has no
`created:` or `updated:` field at all and cannot be aged.

## Category 2: work that already shipped, still filed as live (12 files)

This is the pollution originally reported, and it is real. Every one of these
contains a shipped-PR reference in its own body while sitting in root or
`.open/`:

```
ROOT   2026-08-10-identity-resolution-architecture-plan.md      shipped #327
ROOT   2026-08-10-identity-resolution-architecture-design.md    shipped #327
ROOT   2026-08-10-name-surfaces-that-never-reached-the-resolver shipped #325
ROOT   2026-08-13-notification-toggle-freeze-...                shipped #341
ROOT   2026-08-01-dm-partner-identity-lost-...                  shipped, partial
ROOT   2026-07-19-per-device-signing-keys-...                   shipped, partial
open   2026-08-04-desktop-shows-a-stale-name-...                #313, "DEVICE-VERIFIED, deliberately NOT closed"
open   2026-08-04-desktop-avatar-resolver-...                   §3-A closed in #313
open   2026-08-08-make-allowsync-a-per-device-setting.md        desktop #322, mobile remains
open   2026-08-08-record-and-show-what-the-last-config-publish   desktop shipped, mobile blocked on a package publish
open   2026-08-09-backup-restore-overhaul-design.md             slices shipped #324
open   2026-08-12-dependabot-78-alerts-triage-...               action shipped #337
```

**Most are legitimately still open**, and that is the important nuance. They are
not forgotten closures: they are issues where the desktop half shipped and the
mobile half has not, or where three of four slices landed. A single `status:`
field cannot express "60% done", so the file stays fully open and reads, at a
glance, exactly like work not started.

Only a handful look genuinely closable. The rest are **partial**, which is a
state the current taxonomy has no word for.

## Category 3: design/plan pairs inflate the count (10 files, 5 features)

```
2026-04-20-invite-with-role            design + implementation
2026-06-01-polls                       design + plan
2026-06-04-spaces-highlights-feed      design + plan
2026-08-10-composer-drafts             design + plan
2026-08-10-identity-resolution-architecture   design + plan
```

Both halves are `status: open`, so scanning shows ten entries for five pieces of
work. Once a plan exists the design is reference material, not a separate task.

## Category 4 and 5: the states we were about to build folders for

**Awaiting verification (~10, INFERRED).** Includes real examples worth naming:
`2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days` (mechanism confirmed
from WebKit docs, never run against a live Safari) and
`2026-08-12-unshipped-security-branches` (a branch waiting on a manual soak).

**Blocked on a decision (~10, INFERRED).** Includes
`2026-08-14-security-tab-key-warning-understates-wallet-access` (explicitly
blocked on two product decisions) and
`2026-07-20-announce-keys-flooding-unbounded-admissions` ("likely a lead-dev
call").

Both are genuine, both are smaller than the stale pile, and both keyword counts
will shrink once actually read: files mentioning "product decision" in passing
are caught by the same pattern.

## Recommendation, revised by the data

Ordered by measured impact, not by how interesting the change is. Revised after
the correction above; the original list led with a file sweep that should not
happen.

1. **Sort the scan by priority, not by date. Move nothing.** The age pile is a
   normal backlog, mostly low and medium, correctly filed as `open`. The actual
   defect is that 4 high-priority bugs sit undifferentiated among 21 low and
   medium ones. Ordering fixes that; relocation would only mislabel valid work.
2. **Add a way to say "partial".** 12 files are partly shipped and there is no
   vocabulary for it: the desktop half landed and mobile has not, or three of
   four slices are done. A single `status:` cannot express that, so two-thirds
   finished work reads exactly like work not started. Most of these files already
   spell it out in a `## Status` line, so the cheapest fix is for scanning tools
   to *surface* that line rather than for a new folder to exist.
3. **Then** add `blocked` and `needs-verification`. Correct and cheap; moves
   15-20 files.
4. **`type: reference` for epic tracking docs** (roadmap, runbook, workflow,
   README, candidates). Roughly 30 files outside this 87 which will never be
   done and appear in every in-progress scan. Independent of everything above,
   and probably the best effort-to-benefit ratio in the list.

**Fix the parser bug in whatever reads these files.** Single-quoted YAML dates
broke this report's own numbers; anything else parsing frontmatter by regex will
hit the same thing. Normalising the 17 quoted `updated:` values and adding the
missing dates on the one undated file is a two-minute cleanup.

## What this report does NOT establish

- Per-file category assignments are keyword-derived, not read. Before any file
  moves, each needs a human or a careful pass to confirm.
- Whether quorum-mobile has the same distribution. Assumed similar, unmeasured.
- The `2026-01-09` cluster is assumed to be a migration stamp because 17 files
  share the exact value. Not confirmed against git history.
- Whether the 4 buried high-priority bugs are still real. They are old enough
  that some may already be fixed incidentally.
- How the index and other scanning tools currently order issues. The
  sort-by-priority recommendation assumes they do not already, which was not
  checked.

---

*Last updated: 2026-08-16*
