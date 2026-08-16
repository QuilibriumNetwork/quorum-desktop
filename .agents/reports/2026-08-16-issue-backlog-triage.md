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

## The headline

| | count | share |
|---|---|---|
| Live files total | **87** | |
| ...in `issues/` root ("being worked on right now") | 11 | |
| ...in `.open/` | 76 | |
| Older than 6 months | **31** | 36% |
| Older than 1 year | **18** | 21% |
| Updated within 30 days | 44 | 51% |
| Mention a PR that already shipped | **12** | 14% |
| Design/plan pairs (10 files, 5 features) | 10 | 11% |

## The finding that changes the plan

**The dominant problem is not the missing folders. It is a legacy graveyard.**

31 of 87 files have not been touched in six months; 18 have not been touched in
over a year. A large cluster shares the exact date `2026-01-09`, which looks like
a bulk migration stamp rather than real activity, so those files' `updated:`
dates overstate how live they are.

That is roughly a third of the backlog which nobody is going to action, sitting
in the same list as this week's work. No new status folder addresses it, because
these files are not blocked and not awaiting verification. They are simply not
going to be done, and nothing has ever said so.

The proposed `.blocked/` and `.needs-verification/` folders would relocate
somewhere between 15 and 20 files. Worth doing, and correct, but a second-order
win against 31.

Oldest examples, all `status: open`:

```
585d  2025-01-08-pinned-messages-panel-clicks-and-message-list-disappearing.md
572d  2025-01-21-markdown-line-break-inconsistency.md
378d  2025-08-03-message-hash-navigation-conflict.md
371d  2025-08-10-modal-gesture-handling-technical-debt.md
360d  2025-08-21-messagedb-cross-platform-storage-issue.md
280d  2025-11-09-expired-invite-card-validation-timing.md
```

One file (`2026-04-14-display-name-input-layout-shift-on-error.md`) has an
unparseable date field, so it has no age at all.

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

Ordered by measured impact, not by how interesting the change is.

1. **Decide the fate of the 31 stale files.** They belong in `.deferred/` (still
   want it, not now) or `.archived/` (overtaken, never doing it). Both folders
   already exist, so this needs no new machinery at all: it is a judgement pass,
   probably an hour, and it removes a third of the noise.
2. **Add a way to say "partial".** 12 files are partly shipped and there is no
   vocabulary for it. This is the real gap the original complaint pointed at, and
   it is a different gap from "blocked". Simplest form: keep `status: open` and
   require a `## Status` line naming what shipped and what remains, which most of
   these already do — then the fix is that scanning tools *surface* that line
   rather than a new folder.
3. **Then** add `blocked` and `needs-verification`. Still correct, still cheap,
   but it moves 15-20 files, not 31.
4. **`type: reference` for epic tracking docs** (roadmap, runbook, workflow,
   README, candidates). Roughly 30 files outside this 87 which will never be
   done and appear in every in-progress scan. Independent of everything above.

## What this report does NOT establish

- Per-file category assignments are keyword-derived, not read. Before any file
  moves, each needs a human or a careful pass to confirm.
- Whether the stale files should be deferred or archived. That is a product
  call, not a mechanical one.
- Whether quorum-mobile has the same distribution. Assumed similar, unmeasured.
- The `2026-01-09` cluster is assumed to be a migration stamp because so many
  files share it. Not confirmed against git history.

---

*Last updated: 2026-08-16*
