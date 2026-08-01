---
type: task
title: "Research: a better rule than 'announce your identity once a day' before the user base grows"
status: open — research, no implementation authorised
priority: medium (low urgency, rises sharply with user count)
created: 2026-08-01
updated: 2026-08-01
severity: none today; a bandwidth and battery problem at scale
area: identity propagation cadence (DMs and spaces)
repos: quorum-desktop + quorum-mobile (+ likely a wire-format change, so lead-dev input)
related_tasks:
  - ".agents/tasks/2026-08-01-dm-partner-identity-lost-on-established-sessions.md"
  - ".agents/tasks/2026-08-01-space-member-identity-announce-on-connect.md"
related_docs:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
---

# Research: a better identity-announce cadence

## §0. The question

The DM identity fix (shipped 2026-08-01) makes each client re-announce its name
and avatar to every DM partner **once every 24 hours**, even when nothing has
changed, so that a lost announcement cannot leave a partner stuck on a
placeholder forever.

**24h is a placeholder value. Nobody researched it.** It was chosen to bound the
cost of an anti-loss retry, not because it is right.

This task is to find the right shape. **It is research: produce a recommendation
and a cost model, do not implement.**

## §1. Why it needs replacing — the operator's objection, which is correct

> "if the app gets many thousands of users it can become a big waste of data
> transfer... reporting name and pfp once a day will be a waste in most cases
> since a missing pfp and avatar is kinda rare"

That is the crux: **the cost is paid on every pair, to fix a failure that occurs
on a small fraction of pairs.** The mechanism does not scale with the problem,
it scales with the population.

Order of magnitude for DMs (avatar sizes are real, measured from live logs on
2026-08-01: 9 KB and 51 KB for the two test accounts):

| Users | Avg DM partners | Avatar | Announcements/day | Daily bytes |
|---|---|---|---|---|
| 100 | 10 | 30 KB | 1,000 | ~30 MB |
| 10,000 | 20 | 30 KB | 200,000 | **~6 GB** |
| 100,000 | 20 | 30 KB | 2,000,000 | **~60 GB** |

To fix something that likely affects low single-digit percentages of pairs. On
mobile this is also battery and radio wake-ups, not just bytes.

**Spaces are far less exposed** (one broadcast per space reaches every member,
rather than one message per recipient), so the DM side is where this bites. Any
recommendation should say whether the two should even share a cadence.

## §2. Constraints any answer must respect

1. **Identity is push-based.** There is no directory to query for a user who has
   not published a public profile. If nobody announces, nobody can know.
2. **The transport loses messages.** This is documented and measured, not
   hypothetical. Any design that assumes one delivery is enough will reproduce
   the permanent-placeholder bug (see the DM task's §6 trap 2).
3. **The receiver is the only party that knows there is a problem.** It can see
   its own row is a placeholder. The sender cannot.
4. **The avatar is essentially the entire payload.** Name and bio are bytes;
   the image is tens of kilobytes.
5. **Cross-platform parity.** Desktop and mobile must agree, and a new message
   type is a wire change needing lead-dev sign-off.
6. **Privacy.** Anything that makes a client advertise or request identity must
   not leak more than the current model does — particularly for users who have
   deliberately NOT published a public profile.

## §3. Candidates to evaluate (not exhaustive — better ideas welcome)

### A. Receiver-driven request — most likely the right shape
The receiver knows its roster/conversation row is a placeholder, so let it ASK
that specific peer, instead of everyone broadcasting on the off-chance. Cost
becomes proportional to the actual problem rather than to the population.
- Needs a new control message (`request-profile` or similar): wire change.
- Questions: rate-limit it (an attacker could ask repeatedly); what if the peer
  is offline (retry policy); does asking reveal anything the peer would rather
  not disclose?

### B. Fingerprint first, bytes on demand
Announce a short hash of name+avatar rather than the payload. The peer requests
the full image only when its hash differs or is absent. ~99% reduction, since
the avatar dominates.
- Composes with every other option, including keeping a periodic announce.
- Questions: where does the hash live on the wire; is it worth doing alone,
  without A?

### C. Backoff instead of a flat interval
Retry at 1 day, then 1 week, then stop. Keeps the anti-loss property for the
window where loss actually matters, kills the steady-state cost.
- Cheapest to implement — it is a change to one comparison in the existing gate.
- Good fallback if A is blocked on a wire-format decision.

### D. Piggyback on existing traffic
Attach the fingerprint to messages already being sent rather than generating
dedicated ones. Near-zero marginal cost between active partners.
- Does nothing for inactive pairs, which may be exactly the stale ones.
- Interacts with the DM ack piggybacking already in `MessageService`.

### E. Do nothing periodic; rely on the per-frame profile
The decrypt union already exposes `user_profile` on some frames and desktop now
keeps it. If that fired often enough, no periodic announce would be needed.
- **Measured 2026-08-01: it does NOT fire on ordinary established-session
  frames** (`hasUserProfile: false`, every observation). Recorded so nobody
  re-runs this experiment. Would need an SDK change to be viable.

## §4. Deliverable

A short recommendation document containing:

- [ ] A cost model with real numbers at 1k / 10k / 100k users, for DMs and
      spaces separately
- [ ] An estimate, however rough, of how often identity actually goes missing —
      this is the denominator the whole argument turns on, and nobody has
      measured it. The `.agents/tools/dm-debug/06-space-member-sources.js`
      diagnostic gives a real data point (46 of 89 senders had no row in one
      test space) but test spaces are not representative.
- [ ] A recommended option, with the wire change spelled out if there is one
- [ ] A migration path from the current 24h gate that does not stampede on the
      first connect after deploy (see the DM task's legacy-record note — the
      stored value is a bare signature and reads as "absent" if parsed naively)
- [ ] Whether DMs and spaces should share a cadence or diverge

## §5. Where the current behaviour lives

| Piece | File |
|---|---|
| The 24h constant | `src/utils/dmProfileGate.ts` (`RESEND_INTERVAL_MS`) |
| Gate read / claim / record | `src/utils/dmProfileGate.ts` |
| Send loop that consults it | `src/services/MessageService.ts` (`broadcastProfileToAllDMs`) |
| On-connect trigger | `src/components/context/MessageDB.tsx` |
| Mobile equivalent (NO expiry) | `quorum-mobile/services/dm/dmProfileService.ts`, `quorum-mobile/services/space/spaceMessageService.ts` |

---
*Last updated: 2026-08-01*
