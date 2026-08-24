---
type: task
title: 'verify: two checks the gate does not run, in the two repos it does not own'
status: open
priority: medium
created: 2026-08-24
updated: 2026-08-24
---

# Two checks the gate does not run

Found 2026-08-24 while mapping the whole test system across the three repos, at
the operator's request. Neither is urgent; both are the kind of gap that stays
invisible precisely because the gate looks comprehensive.

## Status

**B is fixed** (2026-08-24) — quorum-mobile now has a `typecheck` script and the
gate runs it, as `KNOWN-RED` at a baseline of 11. The 11 errors are deliberately
unfixed; the baseline makes them a ceiling. Tracked separately in
[mobile typecheck: 11 errors](2026-08-24-mobile-typecheck-11-errors.md).

**A is still open** — quorum-shared has no eslint at all. It needs a decision
(install eslint, or delete the dead script), not just wiring.

This issue stays open for A.

## What the gate runs today

READ, `scripts/verify/steps.mjs`, fast tier:

| Repo | typecheck | lint | unit | build |
|---|---|---|---|---|
| quorum-desktop | ✅ | ✅ | ✅ 1808 tests | ✅ |
| quorum-shared | ✅ | **❌ absent** | ✅ 766 tests | ✅ |
| quorum-mobile | ✅ *(added 2026-08-24)* | ✅ | ✅ 1222 tests | ❌ (no build script) |

The two gaps are not symmetrical, and only one of them is really the gate's
fault.

---

## A. quorum-shared has a `lint` script that cannot run

MEASURED 2026-08-24, in `quorum-shared`:

```
$ yarn lint
$ eslint src --ext .ts,.tsx
"eslint" is not recognized as an internal or external command
```

- `node_modules/.bin/` contains **zero** eslint binaries
- **no** eslint config file exists (`eslint.config.*`, `.eslintrc*`)
- **no** eslint dependency is declared in `package.json`

So it is not "lint is failing". It is a script that names a tool the repo has
never had. The gate not running it is the only reason nobody has hit the error.

**This is why the gate does not run it** — and that turns out to be correct
behaviour for the wrong reason. It was never a deliberate exclusion; nobody
noticed.

**Decision needed:** either give quorum-shared a real eslint setup (config +
dependency) and add the step, or delete the dead script. Adding the step without
the first half would put a hard FAIL on every shared change.

Note quorum-shared is where most primitives and shared logic now live, so it is
not a small or unimportant surface to have unlinted.

---

## B. quorum-mobile is never typechecked, by anything — FIXED 2026-08-24

> **Wording correction.** "Never typechecked by anything" overstated it, as the
> operator pointed out: agents run `npx tsc --noEmit` in that repo by hand, and
> that is real typechecking. What was missing was **automation** — no script, no
> gate, so whether it happened depended on somebody choosing to. That is what
> was added.


There is no `typecheck` script in `quorum-mobile/package.json`. TypeScript
**is** installed (5.9.2) and `tsconfig.json` exists, so it can be typechecked —
nothing has ever asked it to.

MEASURED 2026-08-24, `npx tsc --noEmit` in quorum-mobile: **11 errors**, exit 2.

| Area | Errors |
|---|---|
| `services/calling/` | 10 |
| `app/explore.tsx` | 1 |

Ten of the eleven are in the calling code — `webrtc-manager.ts` assigning
handlers (`onicecandidate`, `ontrack`, `onconnectionstatechange`) that the
typed `RTCPeerConnection` does not declare, plus `farcaster-link.ts` passing a
`string` where a `Uint8Array` is expected and calling `.toCompactHex()` /
`.recovery` on it.

Worth noting against the gate's own `NOT COVERED` line, which already says
**"calling — zero coverage of all 9 WebRTC message types"**. So the one
subsystem with no test coverage is also the one with no type coverage. That is
not a coincidence worth ignoring.

**DONE 2026-08-24**, exactly as proposed: `"typecheck": "tsc --noEmit"` added to
quorum-mobile, wired in as a fast-tier step, and recorded as a `KNOWN-RED`
baseline of 11 (`scripts/verify/baseline.mjs`) — exactly as `mobile:lint`'s 302
and `shared:typecheck`'s 1 already are. The count can only go down; a twelfth
error fails the run. The errors themselves are untouched.

⚠️ Do not add a step without its baseline entry, or every mobile change fails
from the moment it lands. A new guard test enforces the inverse too: **every
`KNOWN_RED` entry must have a matching extractor**, because an entry without one
silently classifies nothing and the step hard-fails every run while the table
looks correct. Falsified by removing the extractor and watching it go red.

---

## Not a gap: things deliberately outside the gate

Recorded so nobody re-discovers these as problems:

- **`yarn bench`** (2 files under `src/dev/tests/perf/`) — excluded on purpose.
  They generate CPU load, and `vitest.config.ts` documents that this raises the
  failure rate of timing-sensitive tests. Running them inside the gate would
  make it flaky.
- **`yarn format:check`** (prettier) — cosmetic. eslint covers real defects. A
  gate that goes red over a blank line teaches people to ignore red.
- **`yarn validate`** (desktop) — just `tsc --noEmit && eslint .`, both already
  separate steps in the gate. Redundant, harmless.
- **36 of the 42 harness scenarios** — cost and account-permanence, documented in
  [regression-coverage-map.md](../../docs/regression-coverage-map.md).
- **quorum-mobile has no `build` script** — Expo builds are done through EAS, not
  a local script, so there is nothing to run.

## Also fixed while looking

`vitest.config.ts` excluded `src/dev/tests/security/**` and its comment pointed
at `vitest.security.config.ts` and a `yarn test:security` script. **None of the
three exists.** The exclusion was inert and the comment sent readers looking for
a suite that was never written. Removed; MEASURED unchanged at 1808 tests before
and after, which is the control that proves the exclusion was doing nothing.

*Last updated: 2026-08-24*
