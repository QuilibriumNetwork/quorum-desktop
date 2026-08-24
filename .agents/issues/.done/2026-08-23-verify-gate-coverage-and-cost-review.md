---
type: task
title: 'Review the verify gate: is it running the right tests, cheaply, and what is missing?'
status: done
created: 2026-08-23
updated: 2026-08-24
---

# Review the verify gate: right tests, cheap, and what is missing

## Status

**Closed 2026-08-24.** Questions 1, 2 and 4 are answered and shipped. Question 3
delivered its first slice; the remaining slice — the ten authorization arms —
is a project in its own right and is NOT part of this review. It needs an
identity fix plus space reuse per scenario before any of them can be allowed to
run automatically. Read the git log on `feat/verify-regression-gate` rather than
the checkboxes below, which predate the work.

What happened after this review closed, in order:

1. Three pre-ship defects, scoped and fixed in
   [2026-08-24-verify-gate-pre-ship-fixes.md](2026-08-24-verify-gate-pre-ship-fixes.md).
2. `cross-dm` became runnable for the first time and immediately found a real
   cross-client message loss, now diagnosed to a mechanism:
   [the issue](../.open/2026-08-24-cross-client-dm-loses-the-first-desktop-to-mobile-message.md).
3. Independent adversarial review; one real defect found and fixed.
4. `KNOWN-RED` stopped forcing `PASS (PARTIAL)`, because the two tracked
   baselines on main were making every cross-repo run partial for reasons
   unrelated to the change.

For how the tool behaves now, read [verify-gate.md](../../docs/verify-gate.md).

**Q1 — routing.** Three defects found and fixed, all falsified by mutation
against a green control:

- `src/locales/` matched no file in any repo; desktop's catalogues are under
  `src/i18n/<locale>/`, so ~100 translation files were forcing a 6-minute run.
- The safe list assumed one layout for three repos. quorum-mobile has no `src/`
  directory at all, so the component and test patterns silently covered desktop
  only. Mobile went 74% → 32% of files forcing the live tier; shared 99% → 66%.
- The live tier ran all six arms whichever repo changed. Only the two
  cross-client runners spawn quorum-mobile, so a mobile-only diff now runs just
  those two.

A fourth, found by adversarial review afterwards and more serious than any of
them: the safe list cleared `src/components/context/WebsocketProvider.tsx`,
which owns the literal `new WebSocket(...)`. A change to the transport skipped
every live arm and printed a clean PASS. Carved out, and policed by a contract
test so the carve-out cannot silently reopen.

Also added `yarn verify --explain`, which prints the resolved plan and the arms
it would run without running any of them.

**The most important finding was not in the four questions.** The gate read
only the working tree, so a clean tree meant "nothing changed" however much the
branch contained. MEASURED on this branch: 31 files changed versus `main`,
including services, hooks and the harness, and `yarn verify` ran zero live arms
and reported a baseline PASS. The documented flow is commit, verify, open a PR
— so the gate was useless at exactly the moment it was meant to matter. It now
diffs `merge-base(HEAD, base)..HEAD` as well.

**Q2 — the 42-scenario audit.** Written into
[regression-coverage-map.md](../../docs/regression-coverage-map.md) as a new
"Scenario inventory" section: 27 regression arms, 11 instruments, 3 offline, 1
needing a human. **Nothing is dead.** Two findings worth acting on: `cross-dm`
is already wired in and still mints one permanent account per run, and ten
authorization scenarios exist of which none runs.

**Q3 — wiring, slice 1 of 3 done** (the operator chose the free wins first):

- The three offline scenarios now run on the fast tier. 15s, mints nothing, and
  they previously ran nowhere at all.
- `space-delivery` now asserts the mute PERMISSION GATE. Asserting the mute was
  honoured went red on the first run, and correctly: muting needs a role
  granting `user:mute` with no owner bypass. What is pinned instead is that an
  unprivileged mute is refused, bound to the delivery assertion so it cannot
  pass vacuously.
- The channel message filter is extracted as `selectVisibleMessages` and
  tested, and quorum-shared's block helpers now have tests. Block had none
  anywhere. It is viewer-side only, so no live arm could ever have covered it.

Still to do on Q3: the identity fix plus space reuse for the ten authorization
arms (the operator chose this over a separate `--deep` tier), then wire them in.
Then `cross-dm`'s minting, which needs the worktree path bug fixed first so the
change can be verified at all.

**Before shipping**, three fixes are scoped in
[2026-08-24-verify-gate-pre-ship-fixes.md](2026-08-24-verify-gate-pre-ship-fixes.md):
`cross-dm`'s minting, the worktree path bug that makes every verdict PARTIAL,
and one real `--all` run. That file is startable cold; start there.

**Q4 — `space-basic`.** Held back to `yarn verify --all`. Every run that leaves
it out prints a `HELD BACK` line naming it and the flag that runs it.

MEASURED, plain `yarn verify` on this branch after all of the above: **383s,
`PASS (PARTIAL)`, 0 new accounts, 0 new Spaces.** The PARTIAL is the two
cross-client arms, which still skip from a linked worktree (tracked separately).

Follow-on from the two harness-cost issues, both now closed:
[accounts](2026-08-23-harness-mints-permanent-accounts-every-run.md) and
[space reuse](2026-08-23-harness-space-reuse-design.md). Those made the gate
stop littering the network. This one asks a different question: **is it running
the right things, and only those?**

## Why now

Cost was the blocker and it is largely gone — the live tier now mints zero
accounts and zero spaces per run, except `space-basic`. With that pressure off,
the remaining questions are about coverage and time, not litter.

Framing from the operator (2026-08-23), which should drive the priorities:

> for the kind of fixes I am doing, the most important things to test are
> whether all kinds of messages still land correctly in DMs and spaces (send and
> receive), and whether operations on users work — kick, mute, block.

That is the target. Everything below is in service of it.

## Where things stand

**42 scenario files exist** in `src/dev/tests/harness/`. **Six** are wired into
the live tier (`scripts/verify/steps.mjs:73-85`):

```
dm-basic  ·  dm-delivery  ·  space-basic  ·  space-delivery
cross-dm  ·  config-cross
```

So roughly 36 scenarios exist and never run under `yarn verify`. Some of that is
correct — several are one-off investigation instruments, not regression arms —
but it has never been audited scenario by scenario, and the operator's stated
priorities (kick / mute / block) are **not** obviously covered by the six.

Measured cost today: fast tier ~3 min; fast + live ~6.5 min.

## The four questions to answer, in order

### 1. Is the routing as tight as it should be?

`scripts/verify/routing.mjs` decides which tier runs from the diff. It is an
allowlist of provably-safe paths, so anything unclassified defaults to the live
tier — deliberately, so it rots loudly rather than silently. Worth checking:

- Which paths currently fall through to live that arguably should not?
- Is there a middle tier worth having (message-path changes → delivery arms
  only, skipping the two slow cross-client ones)?
- Do not weaken the allowlist principle to buy speed. If a path is genuinely
  safe, classify it; do not add a denylist.

### 2. Audit all 42 scenarios: regression arm, instrument, or dead?

One pass, one line each, three buckets:

- **Regression arm** — asserts behaviour that must keep working. Candidate for
  the gate. Note what it costs and whether it mints anything.
- **Instrument** — built to answer one investigation. Keep, do not wire in.
- **Dead** — superseded or broken. Say so.

There is prior art: [regression-coverage-map.md](../../docs/regression-coverage-map.md),
from the audit that produced `dm-delivery`. Read it before starting; it may
already answer half of this, and where it disagrees with the current tree it
should be corrected rather than worked around.

### 3. Wire in what is missing, priority order from the operator

Highest value first, since these are the fixes actually being shipped:

1. **User operations: kick, mute, block.** `space-kick.scenario.test.ts` exists.
   Nothing obviously covers block. Mute is *sent* inside `space-delivery` but
   only as a delivery check — it asserts the frame arrived, not that muting took
   effect.
2. **Authorization.** From the earlier coverage audit: roughly ten auth
   scenarios exist and none run in the gate. Recent shipped work has been
   almost entirely auth-related, so this is the sharpest mismatch between what
   is being changed and what is being verified.
3. Anything else the audit in step 2 turns up.

For each one wired in: it must be **falsified** before it counts. Break the real
code, watch the arm go red, restore. An arm that has never failed is not
evidence — this is repo policy and it has caught real problems every time it was
applied.

### 4. Decide `space-basic`, the last per-run space minter

Inherited from the space-reuse issue. Creating a space IS its subject, so reuse
cannot fix it the way it fixed `space-delivery`. Two options:

- **Reuse the joiner half only.** A persisted joiner rejoining a persisted space
  still exercises invite → join, but not create. Cheaper, and less coverage.
- **Move it off the per-change tier.** Full coverage, run less often (nightly,
  or on a `--all` flag). Costs one space per run, not per change.

Lean: the second. Creation is exactly the thing that should not be exercised on
every code change, and the routing work in step 1 is where that decision
belongs.

## Constraints that must not be traded away

- **No new false-pass surface.** The space-reuse work found that a run which
  fails partway leaves frames on the relay for the next run to trip over. Any
  new arm that reuses state must scope its assertions to the current run. See
  `sawThisRun` in `space-delivery.scenario.test.ts` and the header of
  `spaceState.ts`.
- **Nothing new that mints accounts or spaces** unless minting is the subject.
  Fixed bot names, `drainInbox()` before `start()`, per-run uniqueness from
  content. Full rule in the harness README.
- **Falsify before wiring in.** Non-negotiable, see step 3.
- **Independent review** for anything that changes test isolation or routing.

## Not in scope

- The ~20 manually-run scenarios that still use stamped bot names. They do not
  run under `yarn verify`, so they cost nothing per code change.
- The two KNOWN-RED baselines (shared typecheck, mobile lint) — separately
  tracked.
- The two cross-client arms skipping from a linked worktree — separately tracked
  in
  [2026-08-23-cross-client-harness-scripts-resolve-mobile-wrong-from-worktree.md](2026-08-23-cross-client-harness-scripts-resolve-mobile-wrong-from-worktree.md).
- Shipping the three `yarn verify` branches. Held by the operator, unpushed.

*Last updated: 2026-08-23*
