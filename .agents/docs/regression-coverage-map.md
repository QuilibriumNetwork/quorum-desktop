---
type: doc
title: Regression Coverage Map
status: done
ai_generated: true
created: 2026-08-23
updated: 2026-08-23
---

# Regression coverage map

## Purpose

`yarn verify` prints a `NOT COVERED` line on every run so a `PASS` can never be
read as more than it is. This document is where that line comes from. Every
row below cites a file, a `file:line`, or says "none found" — it is a record
of what was actually measured on 2026-08-23, not an estimate of what probably
exists. Where a claim could not be verified from the code, it says
`UNKNOWN — not yet measured` rather than guessing.

The scope is the regression harness under `src/dev/tests/harness/` (the
`*.scenario.test.ts` files; six of them now also run automatically as part of
`yarn verify`'s live tier, see below — every one of them, wired in or not,
remains runnable by hand via `yarn harness <name>`) plus the component test
suite under `src/dev/tests/components/`. Unit tests elsewhere in the repo
exist and pass, but they mock the SDK and check logic in isolation — they are
not what this map is about, which is "does a message or action survive a real
send/receive round trip."

**The live tier is wired in as of Task 12 (2026-08-23).** This replaces the
earlier version of this section, which warned that none of it ran
automatically — that warning no longer describes the code and would now
understate what a `PASS` means. `yarn verify --all` runs six live arms after
the fast tier, driving real bots against a real relay (`scripts/verify/steps.mjs`,
the `tier === 'live'` branch, desktop-only since every arm, including the two
cross-client ones, is driven from this repo): `dm-basic`, `dm-delivery`,
`space-basic`, `space-delivery`, `cross-dm`, `config-cross`. Desktop's own
routing (`scripts/verify/routing.mjs`) puts real code changes on this tier
automatically.

**Updated 2026-08-23 — a per-change run is FIVE of those six.** `space-basic`
is marked `exhaustiveOnly` in `steps.mjs` and runs on `--all` only, because it
creates a permanent, undeletable Space every time and cannot reuse one (that IS
its subject). Runs that leave it out print a `HELD BACK` line naming it, so the
omission is visible on the run rather than only in a doc. Routing also narrows
by repo now: a quorum-mobile-only diff runs just the two cross-client arms,
since the other four are desktop vitest scenarios that load no mobile code
(READ: only `run-cross.mjs` and `run-config-cross.mjs` reach that repo). And
docs, styles, images, **translation catalogues under `src/i18n/<locale>/`**,
components, shared primitives, mobile's flat component/asset/native tree, and
non-harness tests all stay on the fast tier. `yarn verify --explain` prints the
resolved plan without running anything.

MEASURED 2026-08-23, full `yarn verify --all` from this worktree: verdict
**`PASS (PARTIAL)`**, total **393s (6.5 min)** — this is the measured actual,
replacing the plan's budgeted estimate of 15-20 minutes
(`.agents/issues/.open/2026-08-22-verify-regression-gate-plan.md`, Task 12 Step 3):

| live step | status | seconds |
|---|---|---|
| dm-basic | PASS | 28 |
| dm-delivery | PASS | 31 |
| space-basic | PASS | 21 |
| space-delivery | PASS | 97 |
| cross-dm | SKIP | 0 |
| config-cross | SKIP | 0 |

**Re-MEASURED 2026-08-23 after the routing, held-back and coverage work**, plain
`yarn verify` on this branch (no flags): verdict **`PASS (PARTIAL)`**, total
**377s**, **0 new accounts and 0 new Spaces**. `space-basic` was held back with
its reason printed; the two cross-client arms still SKIP from a worktree, which
is what makes the verdict PARTIAL rather than PASS.

| step | status | seconds |
|---|---|---|
| shared build / typecheck / unit | PASS / KNOWN-RED / PASS | 6 / 5 / 5 |
| desktop typecheck / lint / unit | PASS / PASS / PASS | 14 / 35 / 95 |
| desktop harness-offline | PASS | 14 |
| desktop build | PASS | 19 |
| mobile lint / unit | KNOWN-RED / PASS | 3 / 17 |
| dm-basic | PASS | 28 |
| dm-delivery | PASS | 31 |
| space-delivery | PASS | 93 |
| space-basic | held back (`--all`) | — |
| cross-dm, config-cross | SKIP | 0 |

The two skips are why the verdict reads `PASS (PARTIAL)`, not `PASS`:
`cross-dm` and `config-cross` both spawn `run-cross.mjs` /
`run-config-cross.mjs`, which resolve `quorum-mobile` relative to the desktop
checkout in a way that is correct from the main checkout but wrong from a
linked worktree (`.worktrees/secondary`, where this was measured).

> **Superseded 2026-08-24** (commit `79080e5fa`). The path bug is fixed:
> `mobileRepo.mjs` resolves it once via `mainCheckoutFrom()`, and the two `.ts`
> scenarios that carried the same bug are fixed too. `config-cross` now runs
> from a worktree — MEASURED, both directions, 34.6s. `cross-dm` runs as well,
> and immediately reported a reproducible message loss, so it is now held back
> to `--all` for a different reason:
> `.agents/issues/.open/2026-08-24-cross-client-dm-loses-the-first-desktop-to-mobile-message.md`.
> The table above is kept as the record of what the run looked like before that.

This closes the "space delivery" and "DM delivery" gaps named in the previous
version of this warning: those two now run on every `yarn verify --all`, not
just on a manual `yarn harness <name>`. **Kick and storage eviction/restore
remain outside the live tier** — `space-kick.scenario.test.ts`,
`dm-itp-wipe.scenario.test.ts` and `space-wipe-restore.scenario.test.ts` exist
and pass when run by hand, but none of the three is one of the six wired
arms, so a `PASS` still says nothing about them. `config-cross` (config sync)
IS one of the six, but is currently one of the two arms skipped from a
worktree checkout, so in this development setup it is not actually exercised
by `yarn verify` either, until the tracked issue above is fixed.

Every "Asserted" or "Covered" cell in the tables below still describes what
the underlying scenario tests, independent of whether that scenario is one of
the six wired live arms — check this section, not the cell, for what runs
automatically today.

When coverage changes (a new scenario ships, a gap closes, or a live arm's
wiring changes), update this document and `NOT_COVERED` in
`scripts/verify/report.mjs` together — a stale map is worse than no map,
because it makes the gate's silence look deliberate when it is really just
unmeasured.

## Scenario inventory — all 42, classified

The tables above answer "what is covered". This one answers a different
question the gate review asked: **of the 42 scenario files, which are
regression arms that belong in `yarn verify`, which are one-off instruments,
and which are dead?**

Three buckets, plus the cost that decides whether an arm can be wired in at
all. Classification is from each file's own header (READ 2026-08-23) and its
identity handling (READ: `createBot` / `createSpaceBot` call sites).

**Nothing is dead.** That is a finding, not an omission — every one of the 42
still answers a question, and the reason 36 of them do not run automatically is
cost and identity, not rot.

### The cost column, and why it gates everything else

A scenario whose bot names carry a timestamp mints a **permanent** relay
account on every run. There is no endpoint that deletes one. So "wire this arm
in" and "this arm mints" are the same decision, and the identity fix
(fixed names + `drainInbox()` before `start()`, see the harness README) is a
prerequisite for wiring anything in, not a follow-up.

- **reuses** — fixed bot names, nothing new is created
- **mints N/run** — a timestamped name; N permanent accounts per run
- **+space** — creates a Space, which is also permanent and undeletable

> ✅ **`cross-dm` no longer mints** (fixed 2026-08-24, commit `f26ed9c43`). The
> desktop bot was named `cross-desktop-${ROLE}-${stamp}`, registering one more
> permanent account every run. It had been invisible because both cross-client
> arms skipped from a linked worktree; lifting that skip is what made it urgent.
> Now a fixed `cross-desktop-${ROLE}`, with `drainInbox()` moved before
> `start()`. MEASURED across five consecutive runs: the account-file count went
> 94 → 95 (the one-time mint of the fixed name) and then stayed at 95.
>
> The drain ordering is load-bearing on this arm specifically. Labels here are
> bare round numbers and the format is shared with quorum-mobile, which this
> repo does not modify, so unlike `dm-delivery` there is no per-run stamp in the
> CONTENT to fall back on. The drain is the only thing preventing a frame queued
> for a previous run from being counted as an arrival.

### Bucket 1 — regression arms (27)

Asserts behaviour that must keep working. "In gate" marks the six live arms.

| Scenario | What it holds down | In gate | Cost |
|---|---|---|---|
| `dm-basic` | DM text round-trips both ways | ✅ | reuses |
| `dm-delivery` | every DM content type reaches the receiver's store | ✅ | reuses |
| `space-basic` | a joiner gets both the post and the roster row | `--all` only | reuses, **+space** |
| `space-delivery` | every space content type survives the receive path | ✅ | reuses |
| `cross-dm` (file: `dm-cross`) | mobile↔desktop DM delivery | `--all` only | reuses |
| `config-cross` | a desktop-written config decrypts on mobile | ✅ | reuses |
| `config-from-mobile` | the reverse direction | via `harness:config-cross` | reuses |
| `space-kick` | a kicked member stays out, and a backup cannot re-admit them | — | reuses, **+space** |
| `dm-selfdelete-forgery` | a stranger cannot delete your conversations | — | reuses |
| `dm-selfdelete-control` | your own second device still can (the other half) | — | **mints 2/run** (3 bots, but two share one throwaway account key — `:34-45`) |
| `dm-reveal` | the sender is revealed, the receiver is not until they engage | — | reuses |
| `dm-reveal-forgery` | a crafted message cannot forge consent and unmask you | — | reuses |
| `dm-auto-reveal` | consent survives a peer's reinstall, and fires exactly once | — | reuses |
| `dm-reset-recover` | a conversation recovers after one side's session is wiped | — | reuses |
| `dm-multidevice` | self-sync copies and a peer's second device both arrive | — | reuses |
| `dm-itp-wipe` | what a DM account actually loses to storage eviction | — | reuses |
| `space-wipe-restore` | login restores Spaces/profile/keys, and never DMs | — | **mints 2/run, +space** |
| `space-manifest-scope` | a manifest may only write the space that delivered it | — | **mints 2/run, +space** |
| `space-message-id-derivation` | a message may only be stored under the id its content derives | — | **mints 2/run, +space** |
| `space-sync-delta-scope` | a delta may only delete its own space's messages | — | **mints 2/run, +space** |
| `space-sync-delta-launder` | a delta cannot launder a row to bypass that scope check | — | **mints 2/run, +space** |
| `space-sync-owner-key-forgery` | a sync frame verifies only against an already-bound key | — | **mints 2/run, +space** |
| `space-thread-forgery` | thread removal is authorized by crypto, not by plaintext | — | **mints 2/run, +space** |
| `space-thread-reply-wipe` | a thread creator cannot delete other people's replies | — | **mints 2/run, +space** |
| `space-thread-target-mismatch` | the checked id and the deleted id must be the same id | — | **mints 2/run, +space** |
| `space-typing` | typing frames are acked, not redelivered forever | — | **mints 2/run, +space** |
| `space-create` | a created space publishes a manifest that reads back | — | **mints 1/run, +space** |

Ten of these twenty-seven are authorization arms (`*-forgery`,
`*-scope`, `*-launder`, `*-mismatch`, `*-wipe`, `selfdelete-*`). **None of them
runs in the gate**, and every one of them mints. That is the sharpest mismatch
the audit found: the work actually being shipped is almost entirely
authorization, and the gate checks none of it.

### Bucket 2 — instruments (11)

Built to answer one investigation. Keep them, do not wire them in: they measure
rates and reproduce conditions rather than asserting an invariant, so a red one
means "the number moved", which is not a regression signal. Most also need
volume, which is what makes them expensive.

| Scenario | The question it was built to answer | Cost |
|---|---|---|
| `dm-loss` | desktop↔desktop transport loss, per direction | mints 2/run |
| `dm-volume` | does volume alone age a DM session | reuses |
| `dm-reorder` | can the ratchet be poisoned deliberately | mints 2/run |
| `dm-stale-bucket` | does the stale-bucket retry ever break a good frame | mints 2/run |
| `dm-session-churn` | session replacement while frames are in flight | mints 2/run |
| `space-backlog` | does a reconnect backlog starve the roster handshake | mints 2/run, +space |
| `space-payload` | is the member delta lost when it is the last payload (refuted) | mints 2/run, +space |
| `space-rate` | how OFTEN a joiner gets the roster, at scale | mints 2/run, +space |
| `replay-captured` | does the shipped helper handle real captured production state | needs a captured corpus |
| `lock-probe` | does the lock probe measure what it claims | offline |
| `ping` | is the stack real at all — register, connect, subscribe | reuses |

### Bucket 3 — offline sanity (3), and one that needs a human (1)

| Scenario | What it checks | Cost |
|---|---|---|
| `smoke` | the crypto/identity pipeline loads and runs headlessly | **offline, no relay** |
| `integration-check` | MessageDB opens; the MessageService import graph loads | **offline, no relay** |
| `xpdump-format` | harness `[XPDUMP]` output still parses with the dr-ablate reader | **offline, no relay** |
| `dm-receive` | a real DM sent by hand from a browser decrypts headlessly | needs a person at a browser |

The three offline ones are the cheapest coverage in the repo and they run
**nowhere**: `vitest.config.ts` excludes `src/dev/tests/harness/` (its setup
mocks WebSocket and crypto, which the harness needs real), and the fast tier
only runs `vitest.config.ts`. They cost no relay traffic and mint nothing, and
`integration-check` in particular fails loudly if the harness's own load-bearing
seams break — which is exactly the failure that currently shows up as four live
arms erroring out three minutes into a run.

## Content types

`@quilibrium/quorum-shared`'s `src/types/message.ts` defines **27** content
types (`grep -n "  type: '" quorum-shared/src/types/message.ts`), not the 28
this document's originating brief expected — recorded here as a measured
correction, not silently fixed.

The **space arm**'s authority is the assertion loop in
`space-message-id-derivation.scenario.test.ts:691-708`: each listed type is
asserted on the bot that did *not* send it, so a pass means the frame crossed
the wire and cleared the id-derivation gate, not that it was the sender's own
local copy. The **DM arm** has no equivalent single loop; each DM scenario
asserts what it asserts locally, cited per row. The **cross-client arm** is
`dm-cross.scenario.test.ts` (desktop↔mobile DMs) and
`config-cross.scenario.test.ts` / `config-from-mobile.scenario.test.ts`
(config, not a message content type, but the only other cross-client wire
format exercised) — there is no space cross-client scenario.

| Content type | Space arm | DM arm | Cross-client arm | Notes |
|---|---|---|---|---|
| `post` | Asserted — `space-message-id-derivation.scenario.test.ts:692` | Asserted (delivery) — `dm-basic.scenario.test.ts:78-79`, and the receive path is exercised across most `dm-*` scenarios | Asserted — `dm-cross.scenario.test.ts:108,158` | The only type exercised on every arm |
| `update-profile` | Asserted — `:699` | None found | None found | |
| `dm-update-profile` | N/A (DM-only type) | **Sent only** — counted at the send seam, `dm-auto-reveal.scenario.test.ts:56`, asserted as a count at lines 111 and 115; never confirmed to arrive/decrypt at the peer | None found | Same shape as space's `pin`: proven to leave the client, not proven to land |
| `remove-message` | Asserted — `:698`, and in `space-delivery` | Asserted via APPLIED STATE — `dm-delivery`, the target row is gone at the receiver | None found | |
| `event` | None found | None found | None found | |
| `embed` | Asserted — `:693`, and in `space-delivery` | Asserted — `dm-delivery.scenario.test.ts`, type-presence on the receiver | None found | |
| `reaction` | Asserted — `:695`, and in `space-delivery` | Asserted via APPLIED STATE — `dm-delivery`, the receiver's row carries the emoji and the sender's id | None found | Applied state is stronger than type presence: it can only be true if the mutation ran |
| `remove-reaction` | Asserted — `space-delivery`, on the bot that did not send it | Asserted via APPLIED STATE — `dm-delivery` | None found | **Corrected 2026-08-23.** The previous version of this row read "None found ... zero coverage on any arm", written before `dm-delivery` and the `space-delivery` extraction existed. Both now cover it, and the DM arm covers it the stronger way |
| `join` | Not a wire frame — receiver-synthesized, deliberately excluded from the id-derivation check (`space-message-id-derivation.scenario.test.ts:562-566`); the underlying *effect* (roster growth) is asserted in `space-basic.scenario.test.ts:191` | N/A | N/A | The content type itself is architecturally untestable by this gate; the membership effect is covered separately (see critical paths) |
| `leave` | Same as `join`: synthesized, excluded at `:562-566` | N/A | N/A | No scenario exercises a member leaving |
| `kick` | Same as `join`: synthesized, excluded at `:562-566`; the *action* (`kickUser`) is covered in `space-kick.scenario.test.ts:124` | N/A | N/A | Content type itself untestable by the id gate; the effect is covered (see critical paths) |
| `mute` | DELIVERY asserted — `:700`, and in `space-delivery`. **The EFFECT is asserted as a REFUSAL**, not an application: MEASURED 2026-08-23, an owner holding no `user:mute` role is correctly denied (`quorum-shared/src/utils/channelPermissions.ts:136-137`, no owner bypass), so `space-delivery` pins that the check does not fail open. Asserting an honoured mute needs a role helper the harness does not have | None found | None found | Same blocker as `pin`: see gap 1 |
| `sticker` | Asserted — `:694`, and in `space-delivery` | Asserted — `dm-delivery`, type-presence on the receiver | None found | |
| `pin` | **Sent but never asserted** — `space-message-id-derivation.scenario.test.ts:433`. Requires a role holding `message:pin` with no owner bypass, and the harness has no role-creation helper (`spaceBot.ts` has none) | None found | None found | See Gaps — highest-priority content-type gap alongside `remove-reaction` |
| `delete-conversation` | None found | None found | None found | Distinct from `delete-conversation-self`, below |
| `delete-conversation-self` | N/A (DM-only type) | Asserted via storage effect, not a `content.type` equality check — `dm-selfdelete-control.scenario.test.ts:107-110` (own second device honours the delete; preconditions checked at `:103-104`) and `dm-selfdelete-forgery.scenario.test.ts:146-149` (a forged one from a stranger is rejected; the forged payload itself is built at `:95`) | None found | Real coverage, just not the pattern the brief's grep (`content?.type ===`) would find — flagged here so it isn't miscounted as a gap |
| `edit-message` | Asserted — `:696`, and in `space-delivery` | Asserted via APPLIED STATE — `dm-delivery`, the receiver's row carries the edited text | None found | |
| `thread` | Asserted — `:697` | None found (DMs have no threads) | None found | |
| `call-offer` | None found | None found | None found | No scenario touches any of the 9 call/WebRTC content types |
| `call-answer` | None found | None found | None found | |
| `call-reject` | None found | None found | None found | |
| `call-hangup` | None found | None found | None found | |
| `call-event` | None found | None found | None found | |
| `call-ice-candidate` | None found | None found | None found | |
| `call-renegotiate` | None found | None found | None found | |
| `space-call-start` | None found | None found | None found | |
| `space-call-end` | None found | None found | None found | |

**Tally**, re-derived from the table above rather than asserted:
**9** asserted delivered on the space arm (`post`, `update-profile`,
`remove-message`, `embed`, `reaction`, `mute`, `sticker`, `edit-message`,
`thread` — matching the pre-measured finding; `post`'s DM-arm assertion is
the same type, not an additional one, so it is not counted twice) **+ 1**
(`delete-conversation-self`) asserted via effect rather than type-equality on
the DM arm **+ 2** (`pin`, `dm-update-profile`) sent but never confirmed
delivered **+ 3** (`join`/`leave`/`kick`) architecturally excluded from the
id-derivation gate with their effects covered elsewhere **+ 12** (`event`,
`remove-reaction`, `delete-conversation`, and all 9 call/WebRTC types) with no
coverage of any kind on any arm **= 27**.

## Non-message critical paths

| Path | Status | Evidence |
|---|---|---|
| Space create | Covered | `space-create.scenario.test.ts` — asserts the local row, the manifest reads back through the real join-side decode path, encryption state, space key, member row, and a second channel |
| Invite (generate + accept) | Covered | Link generation + relay readback: `space-create.scenario.test.ts:42-50`. Link consumption via a real invite: `space-basic.scenario.test.ts:104-105`. Invite *expiry or revocation* is not exercised — none found |
| Join | Covered | `space-basic.scenario.test.ts:105,188,191` — both the post-join message and the roster row are asserted |
| Kick | Covered | `space-kick.scenario.test.ts` — asserts pre-kick control (B can read A), the kick itself (`:124`), post-kick exclusion, and that a pre-kick backup restore does not let the kicked member back in (`:179-202`) |
| Rejoin (reconnect) | Covered, with a caveat | `space-backlog.scenario.test.ts:149` (`b.reconnect()`) measures whether a reconnect backlog starves the roster handshake. This is a socket-reconnect scenario, not a leave-then-rejoin-as-a-new-member scenario — the latter is `UNKNOWN — not yet measured` |
| Role permissions | **None found** | No scenario creates a role or grants a permission. `spaceBot.ts` has no role-creation helper at all — this is a harness capability gap, not just a missing test (confirmed by the `pin` comment at `space-message-id-derivation.scenario.test.ts:439-440`: "Giving it a real arm means creating a role and broadcasting a manifest first") |
| Config sync | Covered, both directions | Desktop→mobile: `config-cross.scenario.test.ts:92`. Mobile→desktop: `config-from-mobile.scenario.test.ts:97-106`. Each direction asserts publish-then-read-back; concurrent-edit merge conflict (the "known merge-asymmetry issue" the file's own header references) is not separately exercised. As of Task 12, the desktop→mobile direction (`config-cross`) is one of `yarn verify --all`'s six live arms, but is currently one of the two skipped from a worktree checkout — see the wiring note above |
| Storage eviction and restore | Covered, both DM and Space | DM: `dm-itp-wipe.scenario.test.ts:89-163` (history and sessions lost, conversation resumes fresh). Space: `space-wipe-restore.scenario.test.ts:156-250` (Spaces/profile/keys restore from a published config; DMs do not; the sync-off arm is the control and restores nothing) |
| Login | Partial | Only exercised as the config-restore path inside `space-wipe-restore.scenario.test.ts` (title: "login rebuilds Spaces and profile only for a published config, and never DMs", `:126`) — this is `ConfigService.getConfig` on a fresh device, not an authentication/passkey/session flow. No scenario or component test drives an actual login UI or session-creation path — that part is `UNKNOWN — not yet measured` |

## Gaps, ranked by silence

Ranked by whether a user would notice the underlying failure on their own,
not by how many types or files are affected — a gap nobody would ever notice
outranks one they would hit on the very next click, because the loud failures
take care of themselves.

1. **Role/permission gating has no coverage of any kind, and the harness
   cannot currently produce one.** A regression that makes a permission check
   fail open (grant an action to someone who shouldn't have it) produces no
   symptom visible to any ordinary user — it is only ever discovered by an
   attacker exploiting it or a manual audit. This is the single most silent
   category measured: not "untested," but "the test infrastructure to even
   attempt it doesn't exist" (`spaceBot.ts` has no role helper).

2. **Ten authorization scenarios exist and not one of them runs in the gate.**
   `space-manifest-scope`, `space-sync-delta-scope`, `space-sync-delta-launder`,
   `space-sync-owner-key-forgery`, `space-message-id-derivation`,
   `space-thread-forgery`, `space-thread-reply-wipe`,
   `space-thread-target-mismatch`, `dm-selfdelete-forgery` and
   `dm-reveal-forgery` each pin a rule that, if it failed open, would let one
   member destroy or unmask another with nothing unusual visible in either
   client. Every one of them mints permanent accounts, which is why none is
   wired in — so the fix is the identity work, not the wiring. This is the
   sharpest mismatch in the whole audit: the code being shipped is
   overwhelmingly authorization, and the gate checks none of it.

   *(This slot previously read "`remove-reaction` is asserted nowhere on either
   arm". That is no longer true — `space-delivery` asserts it on the bot that
   did not send it, and `dm-delivery` asserts it via applied state. Corrected
   2026-08-23 rather than left to rot.)*

3. **`pin` is sent but never confirmed delivered, on either arm**
   (`space-message-id-derivation.scenario.test.ts:433`), and
   **`dm-update-profile` is sent but never confirmed delivered**
   (`dm-auto-reveal.scenario.test.ts:56`). Both fail the same way: the
   sender's own view looks correct because the send succeeded locally, so
   only someone else's client would show the miss, and a missing pin or a
   stale profile is easy to misread as "nobody did that" rather than "this
   broke."

4. **Calling has zero coverage.** All 9 WebRTC content types
   (`call-offer` through `space-call-end`) appear in no scenario. The
   headline failure (a call never connects) is loud and would be caught by
   anyone testing the feature by hand. The quieter regressions this leaves
   unguarded — a dropped `call-renegotiate` during a network change, a lost
   `call-ice-candidate` — surface as vague "bad call quality" that a user
   attributes to their own network, not to a specific regression.

5. **No end-to-end or integration test exists at all** —
   `src/dev/tests/integration/` and `src/dev/tests/e2e/` each contain only a
   `README.md` (`ls` both). A regression in the glue between two
   individually-tested pieces (a click that no longer wires through to the
   handler it used to, a multi-step flow that silently drops a step) has no
   automated path to being caught; it ships until a human happens to walk
   the exact flow by hand.

Named for completeness, but ranked lowest deliberately — these are large or
structurally excluded, but a failure in any of them is loud almost by
definition, which is exactly why they do not need to occupy one of the five
`NOT_COVERED` slots:

- **155 of 169 components have no test** (see Component count below) — a
  broken render is normally a blank screen, a thrown error boundary, or an
  obviously wrong layout, all things a user hits on the very next screen
  they open.
- ~~**DMs are never tested past plain text.**~~ **Closed 2026-08-23** by
  `dm-delivery.scenario.test.ts`, which sends `embed`, `sticker`, `reaction`,
  `edit-message`, `remove-message` and `remove-reaction` the real way and
  asserts the last four on APPLIED STATE at the receiver rather than on type
  presence. It is one of the six wired live arms. Kept here, struck through,
  because a gap that silently disappears from a list is indistinguishable from
  one nobody re-checked.
- **Electron packaging and iOS/Android native builds** are outside what a
  Node-based `yarn verify` can exercise at all — the loudest possible
  failure mode (the build itself fails) takes care of surfacing itself.

### Component count

The pre-measured finding "16 of 169 components have a test" does not survive
a strict count and is corrected here. `find src/components -name "*.tsx"`
returns exactly **169** files. Of the 22 test files under
`src/dev/tests/components/` (23 minus `README.md`), only **14** import a
component that actually exists as one of those 169 `.tsx` files:
`AppErrorScreen`, `BackupStatus`, `DangerZone`, `EmojiPicker`,
`FloatingPopover`, `MessageMarkdownRenderer`, `PasskeyStatus`,
`ReactionsModal`, `RouteBoundary` (via `routeErrorBoundary.test.tsx`,
which also renders `AppErrorScreen`), `Security` (two test files),
`SyncStatusLine`, `ThreadListItem`, `ThreadsListPanel`, and
`WebsocketProvider` (two test files). Two more test files —
`Button.test.tsx` and `Modal.test.tsx` — render primitives re-exported from
`quorum-shared`; those primitives have no local `.tsx` source under
`src/components/` at all (`src/components/primitives/` contains only
`index.ts`, a re-export barrel), so they are not part of the 169 being
measured and do not belong in this count. The remaining test files
(`channelThreadRawRosterGate.contract.test.ts`,
`cssColourVariableFormat.test.ts`, `emojiPickerFrequentLookup.unit.test.ts`,
`iconNames.test.ts`, `messageListSenderMapper.contract.test.ts`,
`tailwindClassesGenerate.test.ts`) test file-format/contract invariants, not
a rendered component.

**Corrected: 14 of 169 components have a test; 155 of 169 do not.**

---

*Last updated: 2026-08-23*
