---
type: bug
title: "The roster pull works, but it is unreliable and it picks its peer badly (originally filed as 'delivers nothing')"
status: ⚠️ ORIGINAL HEADLINE DISPROVEN 2026-08-02 — the pull works (1 → 72 rows). Two smaller defects remain open; see §0
priority: medium — downgraded from HIGH once the mechanism was shown to work
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

# The roster pull: what it actually does

## §0. ⚠️ READ FIRST — the original conclusion was WRONG

This file was opened after a two-client test where a new joiner received zero
member rows. **That conclusion did not survive instrumentation.** Everything from
§1 down is the investigation as it happened, kept because the ruled-out list is
still valuable; but the headline was wrong and the priority is downgraded.

**With logging added, the same test succeeded outright:**

```
A:  member delta: ours=79 theirs=1 missing=78 outdated=0 resolved=78 (cache.memberMap=79)
B:  sync-delta: memberDelta=71 members → saved 71 member row(s) for QmZM3AKwKfMp
```

B's snapshot afterwards: **72 member rows** for that space, up from 1, read
straight from IndexedDB — so it persisted. **And the member list UI then showed
them all**, confirmed visually, so this is verified at the level that actually
matters to a user, not just in storage.

One observation worth keeping: immediately after the rows landed, the member list
still showed only B ("No Role - 1") and caught up shortly after. So there is a
lag between the write and the render. Not chased — but if a future report says
"the data is there and the list is empty", start here rather than assuming the
sync failed.

### What remains genuinely open

**1. It is unreliable.** The first run delivered nothing at all, with the same
two clients and the same code. The member half is a SINGLE payload (message
chunks go first, members ride one final payload — `service.ts:698-755`), so
losing it loses the entire roster exchange with no partial result and no retry
until the next connect. Desktop does not consume the send-retention fix that
shipped in shared `2.1.0-39` (transport item B1), which makes whole-payload loss
the leading explanation. **Nothing about this is specific to identity** — it is
the documented transport problem, surfacing somewhere expensive.

**2. Peer selection ignores roster completeness.** B was offered, in the same
window, peers advertising **90**, **79** and **72** members
(`sync-info payload: {memberCount: …}`). It synced with the **72** one. The
arithmetic is exact: 72 − 1 (B's own row, which that peer also holds) = the 71
received. So B ended 7 rows short of A and 18 short of the best peer on offer.

The cause is in the candidate handling (`MessageService.ts:5451-5466`): every
sync-info is pushed into `candidates` if it has `messageCount || summary` —
**`memberCount` is never consulted**, and `initiateSync` then picks one. The
selection is message-centric, so the roster is whatever the message-optimal peer
happens to have. Cheapest fix: weigh `memberCount` when choosing, or sync members
from the best member peer independently of the message peer.

### What this changes elsewhere

- The identity doc's claim that "one informed peer can populate a whole roster"
  is **correct in principle and verified in practice** — with the caveat that the
  peer is not chosen for that, and the exchange can silently deliver nothing.
- Candidate #32's removal list is back to deleting something that **works**. That
  is the harder version of the decision, not the easier one.
- The instrumentation that settled this is on `debug/log-sync-member-delta-counts`
  in both repos. It should ship: this was undiagnosable without it, and `logger`
  is a no-op in production so it costs nothing.


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

## §3b. 🔵 The chain COMPLETES — logs captured 2026-08-02, both clients

Console logs from both clients (dev build, so `logger` is live) show the sync
handshake succeeding end to end. Steps confirmed, in order:

| # | Evidence |
|---|---|
| 1 | B: `[SyncService] requestSync: Sending sync-request for space QmZM3AKwKfMp…` |
| 2 | A: `sync-request from: QmY36Yq6kaSi, ourInbox: QmaqgoJ4MuW3, isOurOwn: false` — not expired |
| 3 | A: `sync-request: Calling informSyncData` → `informSyncData called for space QmZM3AKwKfMp` |
| 4 | A: `buildSyncInfo: returning sync-info response - we have data they don't` → `Queued sync-info response` |
| 5 | B: `sync-info payload: {inboxAddress: 'QmaqgoJ4MuW3', messageCount: 1, memberCount: 78}` — **B is told, explicitly, that A has 78 members** |
| 6 | B: `sync-info: Adding candidate and scheduling sync` (hasSession true, not expired) |
| 7 | A: `sync-initiate from: QmY36Yq6kaSi` … `has memberDigests: true` … **`Built 2 delta payload(s)`** |
| 8 | B: `Control message received: sync-delta` |

So the handshake, the peer selection, the digest exchange and the delta build all
work. **The break is between A building the delta and B's roster changing.**

### Also ruled out by reading the code (do not re-check these)

- **Payload assembly is correct.** `buildSyncDeltaPayloads`
  (`quorum-shared/src/sync/service.ts:698-755`) emits message chunks first, then a
  SEPARATE final payload carrying `memberDelta`. A built **2** payloads for **1**
  message digest, which is consistent with payload 2 being the member/peer one.
- **Address keying is consistent.** Digests key on `member.address`
  (`createMemberDigest`, `utils.ts:269`), `memberMap` keys on `m.address`
  (`service.ts:172`), and desktop's adapter populates `address` from
  `user_address`. So the `memberMap.get(addr)` in `buildMemberDelta` is not
  silently missing.
- **The apply block exists and is not mis-nested.** `MessageService.ts:5827`
  handles `memberDelta` at the same level as the message delta, not inside it.

### Remaining candidates, now narrow

1. **The member payload was LOST in transit.** Leading theory. It is payload 2 of
   2, and desktop is documented as not consuming the send-retention fix that
   shipped in shared `2.1.0-39` (transport item B1). B logged only two
   `sync-delta` receipts across ALL spaces, so it is entirely possible only the
   message payload arrived for this space.
2. **The delta was built empty** despite the diff being correct — would mean
   `cache.memberMap` was populated for the digest count (78, per the sync-info)
   but not for the lookup, which is hard to square with the keying above.
3. **The apply threw** partway. Nothing is logged there either way.

### The one-line experiment that separates them

None of the three can be told apart from the current logs, because **the
sync-delta handler logs nothing about what it received**. Add a single line at
`MessageService.ts:5827` recording `envelope.message.memberDelta?.members?.length`
(and one on the send side for what was built), re-run the two-client join, and the
answer is immediate:

- built 77, received 0 → **transport loss** (candidate 1)
- built 0 → **empty delta** (candidate 2)
- received 77, roster unchanged → **apply failure** (candidate 3)

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
