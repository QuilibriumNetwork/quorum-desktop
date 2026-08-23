---
type: bug
title: 'quorum-mobile: yarn lint fails with 302 pre-existing errors on master'
status: open
priority: medium
created: 2026-08-23
updated: 2026-08-23
---

# quorum-mobile: yarn lint fails with 302 pre-existing errors on master

**Affected repo: `quorum-mobile`** (not desktop). Filed here because this
repo's `.agents/issues/` is where this repo's `yarn verify` cross-repo
regression gate keeps its tracking issues, to keep the sibling repos' own PRs
free of source changes. See
`quorum-desktop/.agents/issues/.open/2026-08-22-verify-regression-gate-plan.md`
for the gate itself, and `quorum-desktop/scripts/verify/baseline.mjs` for why
this specific exemption exists.

## Symptoms

`yarn lint` in `quorum-mobile` fails on a clean `master` checkout — not caused
by any change from this plan. MEASURED by the controller on 2026-08-23,
directly, not inferred:

```
475 problems (302 errors, 173 warnings)
```

`yarn verify` in quorum-desktop currently exempts this step via a `KNOWN_RED`
entry in `scripts/verify/baseline.mjs` (`mobile:lint`, baseline `errors: 302`).
**That exemption must be deleted the moment this is fixed** (or reduced, its
`errors` figure must be lowered to match) — leaving a stale count in place
would let a future, unrelated regression in `quorum-mobile`'s lint hide behind
an exemption sized for a bug that no longer exists.

## Root Cause

Not investigated as part of this task — 302 errors is far beyond what the
`quorum-desktop` regression-gate work that filed this issue is scoped to fix,
and the errors live entirely in `quorum-mobile`'s own source. This issue
exists to make the debt visible and bounded, not to diagnose or resolve it.

Whoever picks this up should start with `cd quorum-mobile && yarn lint` to get
the current, itemized error list (rule-by-rule breakdown), since the figure
recorded here is only the aggregate count `yarn verify` classifies against.

## Prevention

None yet — this is a tracking report, not a fix. Once addressed (in full or in
part), update `scripts/verify/baseline.mjs`'s `mobile:lint` entry in
`quorum-desktop` to match the new, lower error count, or delete the entry
entirely if it reaches zero.
