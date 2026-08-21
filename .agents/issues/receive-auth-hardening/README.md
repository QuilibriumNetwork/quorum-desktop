---
type: task
title: "Receive-side authorization hardening — master tracker"
status: in-progress
priority: high
created: 2026-08-21
updated: 2026-08-21
---

# Receive-side authorization hardening

> **What this folder is.** The execution queue for the durability half of the
> receive-side authorization work. The *reasoning* lives in a private design doc
> (see below); this folder holds one brief per PR so the work is visible,
> ownable, and picked up one item at a time.

## Read this first

The rationale, the threat model and the slice numbering all live in
`.agents/issues/.secret/2026-08-20-sender-authentication-is-opt-in-mechanism-level-fix-design.md`
— **gitignored, not in this public repo.** Ask the operator for it. Every brief
here links back to a specific section of that document rather than restating it,
so the two cannot drift.

Also relevant and public:
[`../.open/2026-06-25-MASTER-RECAP-control-message-auth.md`](../.open/2026-06-25-MASTER-RECAP-control-message-auth.md)
— the hub for the whole control-message-auth effort.

## Why this folder exists at all

The design doc's own §7 makes an argument about itself worth repeating here:

> This codebase's measured track record is that narrow per-type fixes ship, and
> mechanism-level proposals sit.

The same mechanism-level conclusion has now been reached twice (2026-06-25 and
2026-08-20) and executed zero times, while five per-type patches shipped around
it. Part of that is ownership. Part of it is plain **visibility**: "slices 3-7 of
a design document" appears in no index, no `recap`, no progress view, and nothing
ever reports it as outstanding.

Discrete files in `.open/` do. That is the entire reason for the folder.

## Two failure modes, two tracks

These address **different diseases**, and neither track covers the other. That is
the single most important thing to understand before picking anything up.

| | Track 1 — unauthorized handler | Track 2 — wrong authorization |
|---|---|---|
| Shape | the permission check is never called | the check runs, answers correctly, and is about the wrong question or the wrong object |
| Fix | make classification a compile error | make the authorized object and the acted-on object the same object |
| Briefs | the policy map, dispatch, the lint boundary | the audit, and the identifier-derivation work |

## The queue

**Do the audit first.** It is read-only, it is cheap, and its result changes what
the rest of this list is worth. Do not start the policy map before it.

| Order | Brief | Track | Nature |
|---|---|---|---|
| 1 | [Handler identifier-mismatch audit](2026-08-21-handler-identifier-mismatch-audit.md) | 2 | Investigation — produces a list, not a diff |
| 2 | *(three briefs held privately — see below)* | 2 | Small, self-contained fixes |
| 3 | [Deduplicate the DM control verdict](2026-08-21-deduplicate-the-dm-control-verdict.md) | 1 | Pure refactor. Lowest risk here — a reasonable first PR |
| 4 | [ESLint boundary for `senderId` reads](2026-08-21-eslint-boundary-for-senderid-reads.md) | 1 | Build-time only |
| 5 | [Exhaustive message-auth policy map](2026-08-21-exhaustive-message-auth-policy-map.md) | 1 | The centrepiece. Hard type design, then mechanical classification |
| 6 | [Table-driven receive dispatch](2026-08-21-table-driven-receive-dispatch.md) | 1 | Most invasive. Risk assessment first, and may be dropped |

**Three briefs are held in `.agents/issues/.secret/` for now**, because they
describe weaknesses in code that is merged but **not yet released**. They move
into this folder once a build reaches users. Ask the operator. They are small,
independent, and slot in at position 2.

### Layout

Open briefs sit at the root of this folder. Completed ones move to
[`.done/`](.done/) with `status: done`. There is deliberately no `.open/`
subfolder — inside an epic, the root *is* the open queue.

Note this differs from the top-level `.agents/issues/` convention, where the root
means "in progress" and `.open/` means "not started". Within an epic that split
buys nothing, because the README's ordering already says what is next.

## Rules for anyone working here

- **One PR per brief.** Never fold two together. The design doc's §7 names this
  exactly: folding the durable work into the urgent PR is how the urgent half
  ships and the durable half quietly does not.
- **Every brief must end in something observable or test-provable.** If you
  cannot say what the operator would be able to see, check, or run afterwards,
  the brief is wrong — fix the brief before writing code.
- **Prove the test could fail.** Revert the change, watch the new test go red,
  restore. A test that passes either way is worse than no test.
- **Independent adversarial review on every PR, in a fresh context.** This is not
  optional and not a nice-to-have. On 2026-08-21 an independent review of a fix
  found a higher-severity bug than the one being fixed, in code the implementer
  had just read carefully. Reviews have a higher hit rate here than the
  implementation work does.
- **A finding that describes a live weakness goes to `.secret/`,** never into
  this folder, never into a PR body or commit message. This repo is public.

## Status

Nothing started. The audit (position 1) is the next action.

---
*Last updated: 2026-08-21*
