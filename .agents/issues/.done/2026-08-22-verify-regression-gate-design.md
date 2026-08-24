---
type: task
title: '`yarn verify` — a routed, cross-repo regression gate with a readable verdict'
status: done
priority: high
created: 2026-08-22
updated: 2026-08-24
area: testing / developer confidence
---

# `yarn verify` — a routed, cross-repo regression gate with a readable verdict

Design doc. Answers the brainstorm item
`2026-08-22-regression-safety-net-what-would-it-take.md`, which asked whether a
whole-app regression net is worth building and in what shape.

## 1. Why this exists

The receive-auth hardening epic converts *accept* into *refuse* across the
message receive paths of two independent clients. That is the highest
silent-regression category this codebase has: an over-broad refusal looks
exactly like a network hiccup, and nobody notices for weeks.

Independent agent review catches real defects and will continue to. What review
cannot do is **demonstrate that untouched behaviour still works** — it reasons
about the diff, not about the app. The gap this fills is a deterministic,
repeatable verdict on the behaviour the diff did *not* mention.

The gate's output is therefore designed to be conclusive **without reading the
diff**: it states what ran, against exactly which code, what it does not cover,
and whether the result is reproducible.

## 2. The measured position (2026-08-22)

Everything in this table was run, not inferred.

| | desktop | shared | mobile |
|---|---|---|---|
| Unit tests | 177 files / **1680 pass / 103s** | 34 files | 130 files |
| Typecheck + lint | **49s, 0 errors, 232 warnings** | available | available |
| Live harness | 40 scenarios (prod relay) | — | ~12 scenarios |
| Component tests | 16 of 169 components | — | — |
| End-to-end (real browser) | zero | — | — |
| **Automatic enforcement** | **none** | **none** | **none** |

That last row is the finding the original brainstorm item missed. A green
103-second suite covering 1680 behaviours already exists in this repo and
nothing causes it to run. The gap was never primarily "not enough tests".

Two stale artefacts found while measuring, worth fixing separately:
`vitest.config.ts` refers to a `vitest.security.config.ts` and a `yarn
test:security` script; neither exists.

## 3. The two channels of cross-repo breakage

A change in one repo can break another through exactly two channels, and they
behave differently enough that conflating them produces the wrong design.

**Channel A — shared code. Detectable from file paths. Asymmetric wiring.**

```
quorum-desktop/node_modules/@quilibrium/quorum-shared
    → symlink → ../quorum-shared          (LIVE local checkout)

quorum-mobile/node_modules/@quilibrium/quorum-shared
    → real copy, published 2.1.0-45       (FROZEN)
```

Editing `quorum-shared` reaches desktop as soon as its `dist` is rebuilt, and
reaches mobile **not at all** until it is published and mobile bumps. Both
currently report `2.1.0-45` while potentially holding different code. A gate that
does not say this out loud will hand out a green mobile result that proves
nothing about the change under test.

Editing only `quorum-desktop/src/**` cannot break mobile through this channel.

**Channel B — the wire. Not detectable from file paths. The real risk.**

Desktop and mobile interoperate through the relay. A change to what a client
*sends* or *accepts* breaks interop with zero shared-code changes: if desktop
starts refusing a frame shape mobile still sends, mobile users' messages stop
arriving on desktop, and each repo's unit suite stays green because each repo is
individually correct.

Every change in the receive-auth epic is this kind of change. Channel B is the
reason routing cannot be a pure per-repo decision.

## 4. Command shape

One implementation, `quorum-desktop/scripts/verify.mjs`. `quorum-shared` and
`quorum-mobile` expose a thin `yarn verify` that delegates to it. Precedent
exists: `run-cross.mjs` and `run-config-cross.mjs` already live in desktop and
drive mobile without modifying it.

**If the desktop checkout is absent**, the thin wrapper does not fail. It runs
that repo's own fast tier directly and reports
`PASS (PARTIAL) — orchestrator not found, single-repo fast tier only`. Someone
who has cloned one repo still gets a useful answer; they just cannot get a bare
`PASS`. Same rule as §9.

```
yarn verify
   │
   ├─ ENV        resolve each dependency: linked or published, which commit, dirty?
   ├─ ROUTE      git diff --name-only across available repos → repos × tiers
   ├─ PLAN       print in plain English what will run and why, before spending time
   ├─ REBUILD    if quorum-shared changed → build its dist FIRST
   ├─ RUN        fast tier per routed repo, then live tier if routed
   └─ REPORT     printed verdict block + .verify-receipt.json (gitignored)
```

The `REBUILD` step is not optional. Desktop consumes shared through its built
`dist`; skipping it means desktop silently tests the previous shared build and
reports a green that describes code nobody changed.

**Flags:** `--all` (force every repo and tier), `--fast` (skip the live tier),
`--strict` (any skip becomes a failure), `--show-receipt` (print the last run's
receipt and exit).

## 5. Routing — fail toward running more

The trigger for the live tier is an **allowlist of provably safe paths**, not a
denylist of dangerous ones.

Safe (fast tier only): `*.md`, `*.scss`, `*.css`, `.agents/**`, `public/**`,
locale files, and `src/components/**` when no service or api file changed in the
same diff.

**Everything else runs the live tier.** An unclassified new file counts as
dangerous.

This direction is deliberate. A denylist goes stale silently — a new receive path
is added, nobody lists it, live coverage quietly lapses and there is no signal.
An allowlist fails the other way: it costs an unnecessary 15 minutes, which is
immediately visible and immediately fixable.

**Repo routing:**

| Diff touches | Fast tier runs in |
|---|---|
| `quorum-desktop/src/**` | desktop |
| `quorum-shared/src/**` | shared, desktop, mobile |
| `quorum-mobile/**` | mobile |

Plus the live tier whenever the path allowlist above does not clear the diff.

**Mandatory warning when shared changed:**

> ⚠️ shared changed, but mobile resolves the published `2.1.0-45` — **mobile is
> NOT testing your change**. Publish and bump before trusting a green mobile
> result.

## 6. The two tiers

### Fast tier — offline, deterministic

`typecheck → lint → unit tests → build`. About 4 minutes for desktop. No network,
no relay traffic, same answer every time.

**Flakiness rule.** `vitest.config.ts` documents `websocketInboundPickup` and
`fetchSpaceReplies` as intermittently load-sensitive. A test that passes only on
retry reports **`FLAKY`**, which is a third verdict distinct from `PASS` and
`FAIL`. A retry must never be allowed to manufacture green — a gate that cries
wolf gets ignored, and a gate that silently launders a flake into a pass is
worse than no gate.

### Live tier — real client, real relay, throwaway accounts

Phase 1 assembles what already exists plus one new scenario. Roughly 10-15
minutes.

| Arm | Proves | Status |
|---|---|---|
| `dm-basic` | DMs send, arrive, decrypt | exists |
| `space-basic` | join works; post and member row both arrive | exists |
| **`space-delivery`** | one honest frame of **each** space content type still arrives — see the list below | **NEW** |
| **`dm-delivery`** | one honest frame of **each** DM content type still arrives | **NEW** |
| `harness:cross` | desktop↔mobile DM, both directions, computes loss | exists |
| `harness:config-cross` | desktop↔mobile settings sync, both directions | exists |

> **`dm-delivery` was added after this section was first written**, when a
> coverage check found the hole it fills. **No DM scenario asserts any content
> type beyond plain text** — `dm-basic` sends numbered strings, and nothing in
> the harness sends a DM `embed`, `sticker`, `reaction`, `edit-message` or
> `remove-message`. The receive-auth epic touches the DM path, so a fix that
> broke DM attachments would have shipped with every check green.
>
> It also needs a harness change first: `HarnessBot` exposes only
> `send(toAddress, text)`, with no `sendControl` as `spaceBot` has. And a DM bot
> has no `graph`, so the space arm's `outbound.failures` diagnostic has no DM
> equivalent. Both measured 2026-08-22; see the plan's Task 10.
>
> `remove-reaction` turned out to be asserted **nowhere**, for spaces either. It
> is added to `space-delivery` as part of the same work.

`space-delivery` is promoted from the DELIVERY arm already inside
`space-message-id-derivation.scenario.test.ts`, which sends and asserts all of
this today. Extracting it makes "did this fix drop a feature" answerable on its
own, without running an attack scenario to get the answer.

**The content types it covers, read from the scenario's assertion loop at
`space-message-id-derivation.scenario.test.ts:691-708` (not from memory):**

| Asserted on the receiver | 9 types |
|---|---|
| observed on the victim | `post`, `embed`, `sticker`, `reaction`, `edit-message`, `thread`, `remove-message`, `update-profile` |
| observed on the attacker | `mute` |

A reply is exercised too, sent as a `post` carrying `repliesToMessageId` rather
than as a type of its own.

**`pin` is sent but deliberately NOT asserted.** Documented at line 433: its send
branch requires an explicit role holding `message:pin` with no owner bypass, so a
freshly created space's owner cannot produce one, and the frame never reaches the
wire. Giving it a real arm means creating a role and broadcasting a manifest
first. `space-delivery` inherits this limitation as-is and must carry the same
comment — quietly adding a `pin` assertion would produce a scenario that fails
for a reason unrelated to delivery.

> The brainstorm item this design answers lists the set wrong: it names `reply`
> and `join` as types of their own and omits `pin` entirely. The table above is
> the measured one. Any implementation must re-read the scenario rather than
> trust either document, because the set will grow.

Read the harness README's batching and post-reconnect traps before changing how
that arm batches its sends. Both were measured; both produce a symptom identical
to "the receiver rejected it".

### The arm must be provable

`space-delivery` does not count until it has been seen to fail. The harness
README records a security scenario that was green against vulnerable code on its
first draft. The delivery equivalent: deliberately break one content type,
confirm the arm goes red, restore. Required step, not a nice-to-have. An arm that
cannot fail manufactures confidence, which is worse than no arm.

## 7. Environment block — turn invisible state into a readable line

Local dependency wiring is machine-local and silent. Measured on this checkout:
`quorum-desktop/package.json` declares the SDK as `^2.1.0-2` (published), but
`node_modules` resolves through a global `yarn link` to the local
`../quilibrium-js-sdk-channels` checkout at version `2.1.1`. A teammate cloning
the repo resolves the published package and is testing different code.

That is benign today (clean checkout, and `2.1.1` satisfies `^2.1.0-2`), and it
is exactly the sort of thing a green run must not hide. The gate reports it:

```
  ENVIRONMENT
    desktop   e2e5f1a  clean
    shared    LINKED   → ../quorum-shared @ 2.1.0-45  (a1b2c3d, clean)
    sdk       LINKED   → ../quilibrium-js-sdk-channels @ 2.1.1  (882d8e1, clean)
              ⚠ package.json declares ^2.1.0-2 (published) — you are NOT testing that
    mobile    NOT FOUND
```

A dirty linked checkout escalates to
`⚠ uncommitted changes — this result is not reproducible`.

**No changes are made to the SDK repo.** It has no meaningful test suite and does
not need one for this purpose; its own `test` script runs `node test/serve.js`,
which starts a server and would hang the gate. The gate only *reports* which SDK
it used.

## 8. Verdict block — the actual product

Everything above exists to produce this. It is written to be conclusive without
reading any code.

```
── VERIFY ──────────────────────────────────────────────
  ENVIRONMENT
    desktop   e2e5f1a  clean
    shared    LINKED   → ../quorum-shared @ 2.1.0-45  (a1b2c3d, clean)
    sdk       LINKED   → ../quilibrium-js-sdk-channels @ 2.1.1  (882d8e1, clean)
    mobile    published deps, 9f3c1b2, clean

  ROUTED    desktop + shared + mobile   (diff touched quorum-shared/src/sync/)
  TIER      fast + live                 (not on the safe list: src/services/SyncService.ts)

  desktop  typecheck      PASS    12s
  desktop  lint           PASS    37s   0 errors, 232 warnings
  desktop  unit           PASS   103s   1680 / 1680
  desktop  build          PASS    48s
  shared   unit           PASS    14s   34 files
  mobile   unit           PASS    61s   130 files
  live     dm-basic       PASS    72s   40 sent, 40 arrived
  live     space-delivery PASS   214s   11 / 11 behaviours arrived (10 types)
  live     cross-dm       PASS   118s   0% loss, both directions
  live     config-cross   PASS    96s   both directions

  NOT COVERED  UI rendering · Electron packaging · iOS/Android native builds
               · any component without a test (153 of 169)

  VERDICT  PASS — nothing regressed in what this covers
─────────────────────────────────────────────────────────
```

Three properties are load-bearing:

1. **`FLAKY` is its own verdict.** See §6.
2. **The receipt records the commit SHA and dirty state.** `.verify-receipt.json`
   (gitignored) plus `--show-receipt`. If a run is reported as done and the
   receipt's SHA is not the current HEAD, that is a checkable fact rather than a
   claim to be taken on trust. This is not tamper-proof — the printed block could
   be fabricated — but it catches the realistic failure, which is a run being
   skipped rather than evidence being forged.
3. **It names its own blind spots.** The `NOT COVERED` line means a `PASS` never
   overstates itself.

## 9. Degrade loudly, never silently

A teammate may have only one repo cloned. The command runs what it can, and a
reduced run may **never** print a bare `PASS`:

```
  VERDICT  PASS (PARTIAL) — 2 of 3 repos checked
           ⚠ quorum-mobile not found at ../quorum-mobile — MOBILE COVERAGE SKIPPED
           ⚠ live tier cross-client arms SKIPPED (need both repos)
           This does NOT clear a change that touches shared or the wire.
```

Each prerequisite gets its own named skip line: missing sibling repo, missing
harness `.env.local`, no network. `--strict` promotes any skip to a failure.

`PASS (PARTIAL)` is the design's most important small decision. Silent scope
reduction is how a gate becomes theatre.

## 10. Enforcement

No CI, no git hooks — a deliberate choice, so the gate stays inert unless
invoked. Instead, a rule in each repo's `.agents/AGENTS.md`:

> Before reporting any code change complete, run `yarn verify` and paste the
> verdict block verbatim. Do not summarise it, do not report a subset, and do not
> report `PASS` when the block says `PASS (PARTIAL)` or `FLAKY`.

## 11. Phase 2 — the remaining hole

**`space-cross`: desktop↔mobile space delivery.** Cross-client arms exist for DM
and for config sync; none exists for spaces. That is precisely the surface the
receive-auth epic is changing, and Channel B breakage there is invisible to every
other check in this design.

Separate scope, a few days, and it should be planned only after phase 1 is
running and its arms have been proven able to fail.

## 12. What this explicitly does not cover

The authoritative list lives in `.agents/docs/regression-coverage-map.md`, which
the plan's Task 7 creates by measurement — every row cites a file or says "none
found". The gate's `NOT COVERED` line is derived from it, so the two cannot
drift apart silently. What follows is the summary as of 2026-08-22.

Stated so a `PASS` is never read as more than it is:

- UI rendering, layout, blank-screen-on-boot
- Electron packaging and the desktop installer
- iOS / Android native builds
- 153 of 169 components have no test
- Anything only a human eye catches

A browser end-to-end smoke test (Playwright) was considered and deliberately
declined for now. UI regressions are loud, visible and cheap; the coverage this
design buys sits on the silent half. Revisit only if a UI regression actually
ships unnoticed.

## 13. Risks

1. **~15 minutes is long enough to get skipped.** The routing is the mitigation —
   most diffs should never reach the live tier. If the live tier starts firing on
   routine work, the allowlist is wrong and should be widened, not ignored.
2. **The live tier writes real frames to the production relay** on every run.
   Already true of the harness today; running it routinely multiplies it.
3. **A green fast tier can still hide a wire regression.** That is the entire
   reason the live tier exists, and the reason `PASS (PARTIAL)` must be visually
   distinct.
4. **The path allowlist is the one piece that can rot.** It fails safe (toward
   running more), but a diff that lands entirely in `src/components/**` while
   changing behaviour would slip through. Accepted: that is the loud half.

## Related

- `2026-08-22-regression-safety-net-what-would-it-take.md` — the brainstorm item
  this answers. Its option 1 becomes `space-delivery`; its option 2 (Playwright)
  is declined in §12; option 3 is superseded.
- `src/dev/tests/harness/README.md` — the delivery-arm discipline, the batching
  and post-reconnect traps, and the "an arm that cannot fail" warning.
- `.agents/docs/transport-measurements.md` — append a row for any live run that
  produces a number.

---

_Last updated: 2026-08-22_

## Status (2026-08-24) — design delivered

**Built, reviewed and documented.** This design is closed; the tool it describes
exists and is measured. User-facing documentation now lives at
[verify-gate.md](../../docs/verify-gate.md) — read that rather than this
document for how the tool behaves today.

Follow-on records:

- [implementation plan](2026-08-22-verify-regression-gate-plan.md) — what was built
- [coverage and cost review](2026-08-23-verify-gate-coverage-and-cost-review.md) — whether it runs the right things
- [pre-ship fixes](2026-08-24-verify-gate-pre-ship-fixes.md) — the last three defects

**Four design assumptions did not survive contact.** All are corrected in the
issues above; recorded here because a design doc that hides its own misses is
worse than none:

1. The harness was minting permanent, undeletable relay state on every run.
2. Reusing state across runs required delivery assertions to be scoped per run,
   or a failing run could turn the next one green.
3. "What changed" read only the working tree, so a committed-clean branch
   reported no changes and ran nothing at all.
4. `KNOWN-RED` was specified to render `PASS (PARTIAL)`. Since two repos carry
   tracked breakage on main, that made **every** cross-repo change partial for
   reasons unrelated to it — turning the one verdict that means "coverage was
   reduced" into noise. Corrected 2026-08-24: it no longer downgrades the
   verdict, and is named separately on the verdict line instead.

*Last updated: 2026-08-24*
