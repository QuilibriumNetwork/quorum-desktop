---
type: task
title: "Is a whole-app regression net worth building, and if so what shape?"
status: done
priority: medium
created: 2026-08-22
updated: 2026-08-22
area: testing / developer confidence
---

# Is a whole-app regression net worth building, and if so what shape?

## Status

**Answered 2026-08-22.** Decision and full design:
`2026-08-22-verify-regression-gate-design.md`.

Outcome in one line: **yes, but the framing in this file was wrong about where
the gap is.**

- The biggest missing piece was not tests. Desktop already has 1680 unit tests
  that pass in 103 seconds, and **nothing causes them to run** — no CI, no git
  hooks, in any of the three repos. That was unmeasured when this file was
  written.
- Option 1 (core-feature smoke) is adopted, as the `space-delivery` arm. Its
  content-type list in §"Options to weigh" below is slightly wrong: the scenario
  sends `pin`, and does not send `reply` or `join` as types of their own. Read
  the scenario, not this file.
- Option 2 (Playwright UI smoke) is **declined for now**, for the reason this
  file itself argues: UI regressions are loud and self-announcing.
- Option 3 (do neither) is superseded.
- Two things this file did not consider and the design does: cross-repo breakage
  through `quorum-shared` (desktop symlinks it, mobile pins the published copy),
  and through the wire (desktop↔mobile interop, invisible to file-path analysis).

## Why this exists

Raised 2026-08-22 by the operator, at the end of the receive-auth-hardening work:
*"do we have a system to ensure we don't break anything?"* The honest answer is
partly, and the shape of the gap is worth deciding on deliberately rather than
discovering during a bad week.

**This is a brainstorm-first item.** Do NOT start building. The first question is
whether the biggest piece is worth it at all; the answer may well be "only the
cheap half".

## The measured position (2026-08-22)

| Layer | Coverage | What it proves |
|---|---|---|
| Unit tests | 1680 tests / 179 files | Logic in isolation |
| Live harness | 40 scenarios (16 space, 16 DM, plus config-cross) | The **real** client against the **real** production relay, real crypto, real accounts |
| Component tests | **16 of 169 components** | Almost nothing |
| End-to-end | **zero** | `src/dev/tests/e2e/` holds one aspirational README describing Playwright, which is not installed |

## The thing most people get backwards, and the reason this matters

The instinct is that the UI gap is the scary one. It is not.

A UI regression is **loud, visible and cheap** — someone opens the app and sees
it. A receive-path regression is **silent**: a legitimate frame gets refused, it
looks exactly like a network hiccup, and nobody notices for weeks.

Almost every change in the security epic converts an *accept* into a *refuse*,
which is precisely the high-silent-risk category. So the coverage that already
exists (the live harness) happens to sit on the dangerous half, and the missing
coverage sits on the cheap half. That is a much better position than the raw
table above suggests, and it should shape how much is worth spending here.

Two near-misses from a single day, both from careful write-ups, both would have
broken the app silently:

- "verify against the registered owner key — small, strictly narrowing, and
  correct regardless" → would have refused **every peer-to-peer sync**, because
  only the owner-broadcast path signs with that key.
- "at minimum honour the 30s expiry" → would have **dropped real data** under the
  reconnect backlog this repo has already measured.

Neither was caught by reading. Both were caught by tracing the SEND side, and
would have been caught by a delivery arm in the harness.

## Options to weigh (do not pick here)

**1. Core-feature smoke scenario — cheap, and most of it already exists.**
`space-message-id-derivation` already sends post, embed, sticker, reply,
reaction, edit-message, thread, remove-message, mute, update-profile and join,
and asserts each one arrives. Promoting that into a standalone scenario that runs
after any receive-path change would directly answer "did this fix drop a
feature". Roughly an afternoon.

⚠️ It costs ~3-4 minutes per run against the production relay, so decide whether
it runs per-change or per-release; a slow gate people skip is worse than none.

**2. UI smoke via Playwright — the real build.** Open the app, create a space,
invite, join, post, edit, delete, leave. Catches the whole class currently
invisible. Days, not hours, and adds a dependency plus CI wiring. **This is the
part that needs the worth-it conversation**, not an assumption.

**3. Do neither, deliberately.** Defensible: the silent-failure half is already
covered, and the visible half is caught by ordinary use. Write that down as a
decision so it stops being re-litigated.

## What to decide

1. Is option 1 worth an afternoon? (Probably yes — the parts exist.)
2. Is option 2 worth the build and the ongoing maintenance, given the operator
   cannot review code and the UI half is self-announcing anyway?
3. If neither, record option 3 as a decision with its reasoning.

## Related

- The delivery-arm discipline that makes the harness worth anything:
  `src/dev/tests/harness/README.md`, and the PEER arm in
  `space-sync-owner-key-forgery.scenario.test.ts` — an arm whose only job is to
  prove the fix did NOT break legitimate traffic.

---
*Last updated: 2026-08-22*
