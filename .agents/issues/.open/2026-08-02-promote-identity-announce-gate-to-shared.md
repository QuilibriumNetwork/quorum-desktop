---
type: task
title: "Promote the identity-announce gate to quorum-shared — but only once we know it isn't temporary"
status: open
priority: low — no drift exists today; this prevents a future one
created: 2026-08-02
updated: 2026-08-02
severity: none currently. The risk it addresses is silent constant drift, which has bitten once already
area: identity announce / quorum-shared / cross-platform parity
repos: quorum-shared (destination), quorum-desktop + quorum-mobile (callers)
related_tasks:
  - ".agents/issues/.done/2026-08-01-identity-announce-cadence-research.md"
  - ".agents/issues/2026-08-01-space-member-identity-announce-on-connect.md"
  - ".agents/issues/port-from-mobile/candidates.md (#32 — the reason to wait)"
related_docs:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
---

# Promote the identity-announce gate to shared

## §0. What exists today

The same rule — skip a byte-identical resend, expire it a **bounded** number of
times, migrate legacy records, claim in-flight — is now implemented twice:

| | Decision logic | Constants | Persistence |
|---|---|---|---|
| desktop | `src/utils/profileSendGate.ts` (factory) | 24h / 3 (DM), 5min / 3 (space) | `localStorage` |
| mobile | `services/identity/profileAnnounceGate.ts` (factory) | 24h / 3 (DM and space) | MMKV |

Both were deliberately built as **decision logic with persistence injected**, so
the portable half is already isolated. Promotion would be close to a file move.

## §1. ⚠️ Why this is PARKED, and what unparks it

**The operator's objection is the right one: this may be a temporary patch, and
promoting a patch to a shared library buys the coupling cost twice.**

Mobile consumes `quorum-shared` as a **published npm version** (`2.1.0-39`),
while desktop uses `link:`. So promotion is not free — it needs a publish and a
mobile version bump before mobile can use it, and every later tweak needs the
same cycle. Paying that for something we intend to delete would be a poor trade.

And we do intend to delete part of it. Every doc on this says the same thing:

> ⚠️ This retry is a TRANSITIONAL SAFETY NET, not architecture. With reliable
> delivery ONE send per identity is enough, and the cap should shrink toward 1.

### The distinction that decides it — the gate has TWO halves

1. **Dedup** — "do not re-send a byte-identical payload". **Permanent.** Under
   any architecture, including post-#32, a client should not re-broadcast an
   unchanged avatar on every connect. This half survives.
2. **Capped retry / expiry** — the interval, the attempt cap, the legacy-record
   migration. **Transitional.** It exists because delivery was unreliable and
   because joining is a one-way identity exchange. If #32 lands with a roster
   bootstrap, most of the reason for it goes away.

So the honest answer is not "promote it" or "don't", it is **promote the half
that survives, and leave the half that might not**.

### Trigger to unpark

Do this when **any one** of these becomes true:

- [ ] #32's direction is decided (either way — the answer tells us whether the
      retry half survives)
- [ ] the constants diverge again between the two repos, or between DM and space
      on one repo, without a documented reason
- [ ] a third caller appears (a fourth and fifth implementation of the same rule
      is where this stops being theoretical)

Until then the two copies are identical, freshly written, and cross-checked by a
parity test in the mobile suite. **There is no drift to fix right now.**

## §2. Why it is worth doing eventually

Not code reuse — the decision logic is ~100 lines and copying it is cheap.

**It is the constants.** Before 2026-08-01 the same rule ran at opposite
extremes: desktop expired every 24h with **no cap** (365 sends a year per pair to
say nothing new), mobile sent **exactly once, ever** (a single lost or unheard
frame was a permanent, silent failure). Both were defensible in isolation and
together they were incoherent, and nothing structural prevented it. A shared
constant makes that specific failure impossible.

The current parity test (`quorum-mobile/__tests__/spaceAnnounceGate.test.ts`,
"parity with the DM gate") only pins DM-vs-space **within mobile**. Nothing pins
desktop against mobile. That gap is the actual exposure.

## §3. Work, if unparked

**User-visible outcome: none.** This is a structural change with no behavioural
delta — which is exactly why it needs the parity tests to be the deliverable.

- [ ] Move the pure factory to `quorum-shared/src/identity/profileAnnounceGate.ts`
      (decision only — no storage, no logger binding, no platform imports)
- [ ] Export the constants as named values, not magic numbers, so a divergence
      requires an explicit override rather than a copy-paste
- [ ] Port the tests: desktop `src/dev/tests/utils/*ProfileGate.test.ts`
      (52 tests across the two files) and mobile `__tests__/dmProfileGate.test.ts`
      + `spaceAnnounceGate.test.ts` (39) — the shared suite should hold the rule,
      leaving each repo only its persistence shim to test
- [ ] Rebind desktop (`link:`, immediate) and mobile (needs a publish + bump)
- [ ] Verify each repo's existing gate tests pass **unchanged** — that is what
      makes the move safe to claim, and it is how the desktop and mobile
      extractions were both validated

### Do NOT move

- the persistence shims (`localStorage` vs MMKV)
- the logger binding (desktop logs, mobile does not — and desktop's logs are
  no-ops in production anyway, see
  `.agents/issues/.open/2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md`)
- the payload/signature builders — the wire payloads genuinely differ (mobile
  carries `farcasterFid`/`farcasterUsername`, desktop does not)

## §4. Sequencing note

If #32 lands first and replaces the announce with a roster bootstrap, revisit
this task before starting it: the dedup half still belongs in shared, the retry
half may be dead code by then, and promoting dead code is worse than duplicating
live code.

---
*Last updated: 2026-08-02*
