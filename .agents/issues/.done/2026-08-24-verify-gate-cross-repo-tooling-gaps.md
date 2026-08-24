---
type: task
title: 'verify: two checks the gate did not run, in the two repos it does not own'
status: done
priority: medium
created: 2026-08-24
updated: 2026-08-24
---

# Two checks the gate does not run

Found 2026-08-24 while mapping the whole test system across the three repos, at
the operator's request. Neither is urgent; both are the kind of gap that stays
invisible precisely because the gate looks comprehensive.

## Status

**Both fixed, 2026-08-24. This issue is done.**

**B** — quorum-mobile now has a `typecheck` script and the gate runs it, as
`KNOWN-RED` at a baseline of 11. The errors are deliberately unfixed; the
baseline makes them a ceiling. Tracked in
[mobile typecheck: 11 errors](../.open/2026-08-24-mobile-typecheck-11-errors.md).

**A** — eslint installed in quorum-shared (operator's call: "install it"), config
written, and the step wired into the gate. First run on 255 files: **45 problems,
11 errors, none of them a bug.** All 11 **fixed, not baselined** — see below for
why the two halves were closed differently.

MEASURED after: **0 errors, 34 warnings.** quorum-shared lint is the only one of
the three repos' lint steps that runs green.

### Why fix here and baseline there

Not inconsistency. A baseline is justified when fixing is genuinely impractical
— mobile's 302 errors are a project, and its 11 type errors sit in
`services/calling/`, which has zero test coverage, so no change there can be
shown to be safe.

Eleven cosmetic errors in code with tests is neither. And a baseline is not free:
a ceiling of 11 would let someone swap in eleven **different** errors with the
gate staying green. Baselining trivia also trains people to ignore baselines,
which is what makes the mobile ones dangerous to have.

### What the 11 actually were

| Rule | n | What it was |
|---|---|---|
| `no-useless-escape` | 5 | `\/` and `\[` **inside a character class**, where a backslash means nothing |
| `no-useless-assignment` | 3 | `let top = 0` then a `switch` assigning on every branch, `default` included |
| `prefer-const` | 1 | `let` never reassigned |
| `no-case-declarations` | 1 | a `const` in an unbraced `case` |
| `no-control-regex` | 1 | `validation.ts` stripping control characters — **deliberate**, suppressed with a comment, not "fixed" |

### How each was verified, and what that exposed

The escapes were the interesting ones, because three are in security-sensitive
code (`DANGEROUS_HTML_PATTERN`, XSS name sanitising). Rather than argue from
regex semantics, the equivalence was **measured**: old pattern vs new pattern
over a 1680-case corpus (every ASCII character, plus structured inputs per
pattern). **0 behavioural differences**, with a guard in the probe that fails if
the two patterns are textually identical, so the comparison cannot be vacuous.

The `no-useless-assignment` three were fixed by declaring without a value
(`let top: number`), which hands the check to TypeScript's definite-assignment
analysis — strictly stronger than the dead `= 0`, which would have silently
placed a tooltip at the origin if a future branch forgot to assign. Typecheck
stayed at its baseline of 1, confirming every branch does assign.

**A mutation probe then found something worse than any of the lint errors.** Of
the six files touched, only `validation.ts` had ANY test coverage — mutating the
other five left the whole 766-test suite green. Three new test files were written
(`messageLinkUtils`, `markdownStripping`, `messagePreview`, 19 tests) and
falsified by mutation.

Two of those tests initially could NOT fail, and both were fixed:

- `messageLinkUtils`: the `[^/]` vs greedy `.+` case needs **three** path
  segments to diverge. With `/spaces/a/b#msg-x` both give the same answer, so
  the first version passed either way — the exact "assertion that manufactures
  confidence" failure. Now uses `/spaces/a/b/c#msg-m1`.
- `messagePreview`: dropping a label from the system-message fallthrough chain
  is **undetectable**, because `default` returns the same `{ text: '' }`. No
  assertion can distinguish them. Recorded honestly in the test as a
  documentation test rather than left implying a guarantee it cannot give.

### Left alone deliberately

`package-lock.json` was deleted (tracked, last touched 2026-05-28, and after the
eslint install it did not know about eslint at all while `yarn.lock` did).
Nothing referenced `npm ci`; the only npm mentions are a consumer install line in
the README and `prepublishOnly: npm run build`, which installs nothing.

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
