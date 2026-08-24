---
type: bug
title: "quorum-shared's single-repo verify fallback reports FAIL on every change"
status: done
priority: medium
created: 2026-08-24
updated: 2026-08-24
---

# `yarn verify` in quorum-shared always FAILs without a desktop checkout

## Status

**2026-08-24 — FIXED in quorum-shared PR #89.**

Closed by fixing the cause, which was **option A** in the list below — the
one-line coercion in `Input.native.tsx`. Options B and C were not needed.

MEASURED after, in quorum-shared with no sibling desktop checkout carrying the
orchestrator:

```
VERDICT  PASS (PARTIAL) — orchestrator not found, single-repo fast tier only (typecheck, unit, build)
```

That is the fallback working as designed: it proves less than a full run and says
so, rather than reporting a red that has nothing to do with the change under
test.

The warning added to quorum-shared's `AGENTS.md` while this was open has been
removed, since it described a state that no longer exists. What remains there is
the operational fact — the fallback stops at the first failing step and has no
`KNOWN-RED` notion, so keeping that repo typechecking clean is what keeps it
useful.


Found by independent review of quorum-shared PR #89, 2026-08-24, before merge.

## Symptom

MEASURED 2026-08-24, in `quorum-shared`, clean tree:

```
$ yarn verify
  VERDICT  FAIL — single-repo fast tier failed at 'typecheck' (exit 2)
```

On **any** change, including a no-op. And `AGENTS.md` in that repo instructs
contributors to run exactly this and paste the verdict, so the first thing a new
contributor sees is a red verdict that has nothing to do with their work.

## Mechanism

`quorum-shared/scripts/verify.mjs` delegates to quorum-desktop's orchestrator
when a sibling checkout carries it, and otherwise runs its own fast tier:
`typecheck → unit → build`, **fail-fast**.

Two facts combine:

1. **quorum-shared has one pre-existing type error.** `src/primitives/Input/Input.native.tsx:164`,
   TS2769. `(showFloatingLabel || leftIcon || rightIcon) && styles.floatingContainer`
   sits in a style array; `leftIcon`/`rightIcon` are `React.ReactNode`, so a falsy
   `0` or `''` flows through the `||` chain and lands in a slot that React
   Native's style union does not accept (it accepts `undefined | null | false`,
   not `0` or `''`). Tracked separately in
   [2026-08-23-shared-typecheck-zero-in-native-style-union.md](2026-08-23-shared-typecheck-zero-in-native-style-union.md).
2. **The fallback has no `KNOWN-RED` notion.** The orchestrator records this as a
   baseline of 1 and correctly does not fail a run over it. The fallback knows
   nothing about baselines, and stops at the first non-zero step — so `unit`
   (785 tests, all passing) and `build` (which succeeds, because
   `tsconfig.build.json` excludes `*.native.tsx`) never run at all.

Note the asymmetry that makes this easy to miss: on a machine with a sibling
quorum-desktop checkout on a branch carrying the orchestrator, this never
happens. It only bites the single-repo contributor the fallback exists to serve.

## Why it was not caught before merging

The fallback and the `AGENTS.md` instruction shipped in the same PR. Every run
during development used the orchestrator, via a real worktree or the
`VERIFY_ORCHESTRATOR` override, so the fallback path was exercised for its
*routing* but never for its *verdict* against this repo's real current state.

## Options

**A. Fix the type error.** The one-line form is
`Boolean(showFloatingLabel || leftIcon || rightIcon) && styles.floatingContainer`,
which is **runtime-identical**: React Native's style flattening ignores `0`,
`''` and `false` alike, so every input that previously produced a falsy slot
still produces one. It also lets the `shared:typecheck` entry be deleted from
`scripts/verify/baseline.mjs` — the gate already prints a note asking for that
when a KNOWN-RED step starts passing.

This is the real fix and it removes the cause rather than tolerating it.
Deliberately NOT done at merge time on 2026-08-24: it is a UI primitive both
clients render, no reviewer had seen it, and slipping an unreviewed change into
a PR that had just come back clean is exactly the habit that makes reviews
worthless. It wants its own small PR.

**B. Teach the fallback about known-red.** Rejected as written — it would
duplicate `baseline.mjs`'s table in a second place that cannot import it (the
fallback runs when quorum-desktop is *absent*), and a duplicated rule that drifts
is worse than the problem.

**C. Stop the fallback failing fast**, so `unit` and `build` still run and the
report shows the whole picture. Worth doing regardless of A — a fail-fast tier
tells you less than it could — but on its own it does not change the verdict,
which would still be `FAIL`.

**Recommended: A, with C as a small independent improvement.**

## Meanwhile

`quorum-shared/AGENTS.md` carries a warning describing the exact symptom, so the
red verdict is at least legible rather than mysterious. Remove that warning when
A lands.

## Related

- The root type error: [2026-08-23-shared-typecheck-zero-in-native-style-union.md](2026-08-23-shared-typecheck-zero-in-native-style-union.md)
- The gate: [verify-gate.md](../../docs/verify-gate.md)

*Last updated: 2026-08-24*
