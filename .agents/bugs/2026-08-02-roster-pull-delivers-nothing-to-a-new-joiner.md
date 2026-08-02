---
type: bug
title: "A new joiner receives ZERO member rows from the roster pull, even with a fully-populated desktop peer online"
status: CONFIRMED by a two-client measurement 2026-08-02 — cause not yet located
priority: HIGH — this is the mechanism the whole identity effort assumed was working
created: 2026-08-02
updated: 2026-08-02
severity: a new member of a space sees every existing member as a truncated address, indefinitely
area: space member roster / SyncService / requestSync → MemberDigest → MemberDelta
repos: quorum-desktop
related_bugs:
  - "2026-06-13-space-members-missing-no-join-row.md"
  - "2026-08-01-space-sync-member-delta-blind-to-and-erases-global-slot.md"
related_docs:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
related_tasks:
  - ".agents/tasks/2026-08-01-identity-announce-cadence-research.md (Step 4)"
  - ".agents/tasks/port-from-mobile/candidates.md (#32 — assumes this works)"
---

# The roster pull delivers nothing to a new joiner

## §1. The measurement (both clients, `/dev/identity-coverage`)

User B joined the space **"Quilibrium Community"** (`QmZM3AKwKf…itprrG`) while user
A — already a member, on desktop, app open — held a full roster for it.

| | User A | User B (just joined) |
|---|---|---|
| member rows in that space | **78** | **1** (their own) |
| after 3 further minutes | 78 | **1** |

**B received zero member rows.** Not a partial delta, not a stale one — nothing.
Both clients were the local dev build, same machine, same dev server.

This is the decisive observation, because it **refutes the benign explanation**.
The earlier same-space A↔A test showed no movement either, and the leading theory
was "both peers are missing the same people, so there is nothing to exchange".
Here A demonstrably HAS 78 rows and B demonstrably received none of them.

## §2. Why this matters more than the number it produces

Everything shipped 2026-08-01 (desktop #287-#292, shared #71) was aimed at making
this exchange work, and the digest fix (#71 + #290) was specifically the repair
that made it *capable* of detecting a disagreement. **We never verified that the
exchange itself completes.**

It also invalidates an assumption in two other documents until resolved:

- `.agents/docs/features/identity-resolution-and-profile-sync.md` describes the
  pull as the main repair mechanism and says one informed peer can populate a
  whole roster. That is the DESIGN; this bug says the implementation does not
  currently do it.
- `.agents/tasks/port-from-mobile/candidates.md` #32 reasons about deleting this
  path. Deleting something that does not work is a different (easier) decision
  than deleting something that does — but do not conclude that from here until
  the cause is known. It may be a small fix.

## §3. Ruled out already

- **Not the diff logic.** `computeMemberDiff` (`quorum-shared/src/sync/utils.ts:392`)
  correctly puts addresses present in the responder's digests and absent from the
  requester's into `missingAddresses`, and `buildMemberDelta` (`:514`) includes
  exactly `[...missingAddresses, ...outdatedAddresses]`. The call site
  (`src/sync/service.ts:669`) passes the arguments in the right order
  (`computeMemberDiff(theirMemberDigests, ourMemberDigests)`), so the responder
  builds a delta of members the requester lacks. Traced 2026-08-02.
- **Not "the peer had nothing to give"** — see §1.
- **Not a build mismatch** — both clients were the same local dev build.

## §4. Where to look next — the chain is fully logged

`logger` is live in a dev build (it is a no-op in production, see
`2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md`), and the sync
path logs every step. Open DevTools on BOTH clients, filter `sync`, and have B
join or reload. Walk the chain and find the first missing step:

| Step | Emitted by | Log line |
|---|---|---|
| 1. B asks | B | `requestSync` → broadcasts `sync-request` (30s expiry, `SyncService.ts:461-525`) |
| 2. A hears | A | `[MessageService] sync-request from: … isOurOwn: … expiry: … now: …` (`:5424`) |
| 3. A accepts | A | `[MessageService] sync-request: Calling informSyncData` (`:5428`) — or `Expired, ignoring` (`:5437`) |
| 4. A offers | A → B | `sync-info` |
| 5. B evaluates | B | `[MessageService] sync-info from: … hasSession: … isExpired: …` (`:5444`) |
| 6. exchange | both | `sync-initiate` → `sync-members` / `sync-manifest` → `sync-delta` |

Prime suspects, in the order the chain would expose them:

1. **Step 2 never happens** — the request is not reaching A. Then it is transport
   or subscription, not sync logic.
2. **Step 3 says `Expired, ignoring`** — the 30-second window is being missed, or
   clocks disagree. Note both clients here were on ONE machine, so a clock skew
   explanation would require the expiry to be set wrongly rather than the clocks
   to differ.
3. **The chain completes but the member delta is empty** — then look at
   `getPayloadCache` / `cache.memberMap` on the responder: the diff is provably
   correct, so an empty delta means the responder's member map was empty or
   stale when it was built.
4. **B receives a delta and does not apply it** — check the member-delta apply
   path in `MessageService` (the one that gained a staleness guard in #290;
   verify that guard is not rejecting rows that have no local counterpart).

Suspect 3 deserves particular attention: `getPayloadCache(spaceId, channelId)` is
channel-scoped, while members are space-scoped.

## §5. How to reproduce

1. Two accounts, two browser profiles, both on the local dev build (`yarn dev`).
2. A is an established member of a space with many members; confirm A's count at
   `/dev/identity-coverage`.
3. B joins that space while A's app is open.
4. B takes a snapshot immediately and again after ~3 minutes.

**Expected:** B's member row count for that space approaches A's.
**Actual:** B has exactly 1 (their own), and it does not change.

---
*Last updated: 2026-08-02*
