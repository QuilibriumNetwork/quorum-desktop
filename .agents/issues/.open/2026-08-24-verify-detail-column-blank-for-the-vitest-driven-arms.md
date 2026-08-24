---
type: bug
title: 'verify: the detail column is blank for four of the six live arms'
status: open
priority: low
created: 2026-08-24
updated: 2026-08-24
---

# `verify`: the detail column is blank for four of the six live arms

Cosmetic. Filed rather than fixed because it was found during pre-ship review
and is not a regression — it has been true since the live tier was wired.

## Symptom

MEASURED, from the `yarn verify --all` run of 2026-08-24:

```
  desktop  dm-basic       PASS       28s
  desktop  dm-delivery    PASS       31s
  desktop  space-basic    PASS       21s
  desktop  space-delivery PASS       92s
  desktop  cross-dm       FAIL      369s    LOSS DETECTED — 1/40 messages did not arrive.
  desktop  config-cross   PASS       34s    arms green
```

Four passing arms say nothing. One says `arms green`. Every fast-tier row
carries a real figure (`1796 passed`, `0 errors, 232 warnings`), so the live
tier reads as though it has less to report than it does.

## Cause

`scripts/verify/steps.mjs`'s `harnessDetail` falls back to
`out.includes('PASS') ? 'arms green' : ''`.

Vitest's default reporter does not print a bare `PASS` line — it prints
`Test Files  1 passed (1)` / `Tests  1 passed (1)`. Jest does print `PASS`. So
the fallback only ever fires for the two cross-client arms, which spawn
quorum-mobile's Jest and capture its output.

READ: `vitest.harness.config.ts` configures no custom reporter, and
`scripts/verify/steps.mjs`'s `harnessDetail`. Raised by adversarial review
2026-08-24 as an inference; the table above is the measurement that confirms it.

## Fix

Extract Vitest's own counts, the way the other extractors in `steps.mjs` already
extract tsc's and eslint's:

```js
const tests = out.match(/Tests\s+(\d+) passed/)?.[1];
if (tests) return `${tests} passed`;
```

Keep the ordering that already exists: a `LOSS DETECTED` line wins, a non-PASS
status blanks the detail, and only then the count.

Guard it the way the loss line is guarded, in
`src/dev/tests/verify/routing.test.ts` → `describe('harness detail lines')`,
using real captured output rather than an invented string. A detail extractor
must never be able to fail the run it describes
(`scripts/verify/runner.mjs`'s `safeDetail`), so the test should also cover
output that matches nothing.

*Last updated: 2026-08-24*
