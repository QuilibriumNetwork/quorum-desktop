---
type: task
title: "Spaces: members render as a truncated address because desktop never re-announces identity on connect"
status: open — not started; design proven on the DM side 2026-08-01
priority: high
created: 2026-08-01
updated: 2026-08-01
severity: user-visible — over half the active posters in a test space render as a 6-char address
area: space member roster / identity announce / mobile parity
repos: quorum-desktop (implement here). quorum-mobile already announces on connect — see §6.
related_bugs:
  - ".agents/bugs/2026-06-13-space-members-missing-no-join-row.md"
related_tasks:
  - ".agents/tasks/2026-08-01-dm-partner-identity-lost-on-established-sessions.md"
related_docs:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
related_tools:
  - ".agents/tools/dm-debug/06-space-member-sources.js"
---

# Spaces: desktop never re-announces identity on connect

## §0. The short version

In a space channel, many senders render as a 6-char truncated address with
initials instead of their real name and avatar. The receiving side is no longer
the problem — a previous fix made the `update-profile` handler CREATE a missing
member row instead of dropping the message. What is missing is the **sending**
side: **desktop never re-announces its identity when it connects**, so a member
whose original `join` broadcast you missed has no second chance to tell you who
they are. Mobile already announces on connect. This is the same bug, and the
same fix, as the DM one that shipped 2026-08-01 — with the design already proven
and three implementation traps already paid for.

> **Do not re-derive the root cause.** It is fully characterised in
> `.agents/bugs/2026-06-13-space-members-missing-no-join-row.md`, including a
> live diagnostic run. This task is the *fix*, and exists because the fix shape
> is now known from the DM work.

## §1. Why this is now worth doing (what changed)

The bug doc listed three candidate approaches and parked all of them pending a
lead-dev call, because at the time the cheapest option (an on-connect
`update-profile` rebroadcast) was only a guess. Two things changed:

1. **The receive half already landed.** Fix 1 in that doc made the
   established-session `update-profile` handler upsert a missing `space_members`
   row rather than bailing (`MessageService.ts` update-profile handler; mirrors
   mobile). So an announcement now *creates* the missing row. Before that fix,
   announcing more would have changed nothing — which is exactly why the doc
   concluded "Fix 1 alone does not resolve the symptom".
2. **The identical fix was built, shipped and verified on the DM side**
   (`2026-08-01-dm-partner-identity-lost-on-established-sessions.md`). A partner
   stuck on a placeholder recovered with no user action once both clients
   announced on connect. The design, the failure modes and the traps are known.

So this is no longer "adopt mobile's hub-log transport" (candidate #32, still a
lead-dev architecture call). It is a contained, precedented change.

## §2. The one-line root cause

Desktop's only `update-profile` space broadcast lives inside
`rebroadcastTagIfChanged` (`MessageService.ts:~909`), which fires when an
incoming space manifest changes the user's selected TAG. It is **not** connect
triggered. The actual on-connect block (`MessageDB.tsx`, the 10s timer) does
`requestSync` + `announceDeviceKeys` and nothing else.

> ⚠️ `.agents/docs/features/identity-resolution-and-profile-sync.md` labels the
> `MessageService.ts:~595` site "On-connect rebroadcast". **That label is wrong**
> — it is tag-rotation triggered. Fix the doc as part of this task; it cost real
> time to disprove.

## §3. Mobile has its OWN version of this bug — it is not just a desktop sender problem

> Corrected 2026-08-01 after operator pushback. An earlier draft of this section
> claimed the mobile symptom was caused entirely by desktop senders failing to
> announce. That is one real cause, but it does NOT explain the reported case,
> where the affected members **have only ever used mobile**. The real mechanism
> is below. Do not revert to the simpler story.

Identity is **push-based**: it exists on your device only because someone
announced it. So there are two independent ways to end up with no identity, and
mobile is exposed to both.

**Cause A — the sender never re-announced (desktop senders).** Desktop announces
only at join and on tag rotation (§2). A desktop member who joined while you
were offline never gets a second chance. Fixing Slice 1 fixes this for everyone,
on every platform, with no mobile change.

**Cause B — mobile's announce gate never expires (mobile senders).** Verified in
`quorum-mobile/services/space/spaceMessageService.ts` (`maybeSendUpdateProfileMessage`):

```ts
const last = store.getString(key);
if (last === sig) return null;   // persisted in MMKV, per (spaceId, senderAddress)
```

There is **no expiry and no retry**. A mobile member announces a given identity
to a given space exactly ONCE, ever, across app launches. Consequences:

- A member who joins the space LATER never receives it — it was broadcast before
  they were listening, and it will never be sent again.
- A member who was simply offline at that moment never receives it either.
- Hub-log replay only rescues them if the log both retains that far back AND
  their cursor starts before the announcement. **Unverified** — if replay does
  cover it, Cause B is much weaker than it looks. Establish this first (§5,
  Slice 0).

This is the same flaw the DM code review caught on desktop ("a gate with no
expiry converts one lost message into a permanent failure", §6 trap 2), except
mobile's has no expiry at all rather than a too-long one. Circumstantial support
that the gap is already felt: the same file carries a `MIGRATIONS_KEY` mechanism
that WIPES every stored signature to force a re-announce when the payload shape
changes — a manual, one-off workaround for exactly the "the gate is shut and we
need everyone to speak again" problem.

**Therefore: Slice 1 here does NOT fully fix the mobile symptom.** It fixes the
desktop-sender half. The mobile half needs an expiry in the mobile repo — see
§10.

## §4. Cost — cheaper here than it was for DMs

A DM announcement is **one encrypted message per partner** (N messages). A space
`update-profile` is **one broadcast per space**, delivered to all members via the
hub. So announcing to 10 spaces costs 10 messages regardless of member count,
where 10 DM partners cost 10 messages for one person.

This means the cost objection that applies to the DM retry cadence (see §7)
applies much more weakly here. Still gate it — see §5, Slice 2.

## §5. Work — vertical slices

### Slice 0 — Settle whether hub-log replay already rescues Cause B

**User-visible outcome:** none; this is a 30-minute question whose answer decides
whether §10 (the mobile expiry) is urgent or unnecessary.

If mobile's `log-since` replay retains and replays `update-profile` messages
from BEFORE a member's cursor, Cause B mostly self-heals and only Cause A
matters. If the cursor starts at join/first-connect, Cause B is real and §10 is
required. **Do not build §10 before answering this.**

- [ ] Read `quorum-mobile` `hubLogSync.ts` + `hubLogCursor.ts`: where does a
      NEW member's cursor start, and is there a server-side retention window?
- [ ] Record the answer here, in one paragraph, with file:line

### Slice 1 — Announce identity to every space on connect

**User-visible outcome:** a space member who has been rendering as
`e9AouU`-style truncated text gets their real name and avatar, without either
user touching settings, shortly after the *other* person opens the app.

Broadcast `update-profile` carrying the GLOBAL slot (`globalDisplayName` /
`globalUserIcon` / `globalBio`) to every joined space on connect. The payload
shape already exists — copy it from `rebroadcastTagIfChanged`
(`MessageService.ts:~940-970`), which builds exactly this message. Do NOT send
the per-space OVERRIDE fields; that would re-introduce the roster-stamping
problem the follow-global work removed (see the identity-resolution doc).

- [ ] Add the broadcast alongside the existing on-connect space loop in
      `MessageDB.tsx` (the one already doing `requestSync` + `announceDeviceKeys`)
- [ ] Global slot only — no override fields
- [ ] Verify against the live diagnostic in §8
- [ ] `npx tsc --noEmit --jsx react-jsx --skipLibCheck` + `yarn lint` clean

### Slice 2 — Gate it, and give the gate an expiry

**User-visible outcome:** none directly; this is what stops Slice 1 becoming a
broadcast storm on a flapping connection.

Reuse the DM design (`src/utils/dmProfileGate.ts`) rather than inventing one —
per-(self, space) signature, persisted, skip an unchanged payload, **with an
expiry** so a lost broadcast cannot break convergence permanently.

- [ ] Extract/generalise the DM gate rather than copy-pasting it
- [ ] Claim in-flight synchronously (see §6 trap 3)
- [ ] Unit tests mirroring `src/dev/tests/utils/dmProfileGate.test.ts`

### Slice 3 — Fix the mislabelled doc

**User-visible outcome:** the next person doesn't lose an hour to it.

- [ ] Correct the "On-connect rebroadcast" row in
      `.agents/docs/features/identity-resolution-and-profile-sync.md` §"File map"
- [ ] Note that the space announce is now genuinely on-connect once Slice 1 lands

## §6. The three traps — all three cost a cycle on the DM side

Read these before writing code. Each one produced a "the fix doesn't work"
result that looked like a wrong diagnosis.

1. **Do NOT wire it only into `setResubscribe`.** On a cold page load the
   WebSocket opens BEFORE `MessageDB` registers that callback (it waits on
   `keyset` and an async `selfAddress`), so the callback fires on later
   *re*-connects and never on startup. Symptom: zero logs, looks like the code
   isn't running. Fire from a startup timer **and** from `setResubscribe`, and
   `clearTimeout` the pending one so a flapping socket replaces rather than
   stacks. See `MessageDB.tsx` — the listen-frame block has the same race and has
   always worked around it the same way.
2. **A gate with no expiry converts one lost message into a permanent failure.**
   Observed live: both clients had a CLOSED gate while one still rendered a
   placeholder. The send had gone out and been recorded as success; the identity
   had not landed. On a transport with this one's delivery record, "announced
   once, never again" makes convergence depend on a single frame surviving.
3. **Claim the gate BEFORE the await, not after.** The persisted record is only
   written once the network send resolves, so two overlapping runs both read
   "not yet sent" and both transmit. Needs a synchronous in-flight claim,
   released in a `finally`.

Plus one that is space-specific and NOT shared with DMs:

4. **`space_members` is canonical shared protocol state**, unlike the DM
   `conversations` row which is a private local note. The existing bug doc
   deliberately rejected several shortcuts on that basis, and that reasoning
   still stands. Announcing is safe (it is a normal control message through the
   normal handler); inventing rows from message traffic is not.

## §7. Open question inherited from the DM fix — retry cadence ✅ ANSWERED

> ✅ **2026-08-01: answered in
> `.agents/tasks/2026-08-01-identity-announce-cadence-research.md` Slice 3.**
>
> **Spaces should get no cadence at all.** They already ship a receiver-driven,
> fingerprint-first member reconciliation — `requestSync` fires on every connect
> (`MessageDB.tsx:611-631`) and exchanges `MemberDigest` → `MemberDelta`. That is
> candidates A+B from the list below, already on the wire. It is broken in two
> specific ways, filed as
> `.agents/bugs/2026-08-01-space-sync-member-delta-blind-to-and-erases-global-slot.md`
> (digest hashes only the override slot, which is empty post-follow-global; and
> applying a delta full-row-`put`s away the global slot). **Fix those, and
> Slice 1 here becomes a bootstrap for members nobody has a row for** — gate it
> with the same capped retry as DMs (3 attempts, then stop), not a flat interval.
>
> 🔴 **§4 above is also corrected there.** "Cheaper here than it was for
> DMs" is true for the *sender's uplink* only. One broadcast is read by every
> member, so total transfer is `spaces × members` — at 5 spaces × 50 members
> that is ~6× the total bytes of a daily DM announce, not less.

The DM gate currently re-sends an unchanged identity **once per 24h per
partner**. That is a placeholder value, not a researched one, and it is
**probably the wrong shape at scale**: it pays a cost on EVERY pair to fix a
failure that occurs on a SMALL FRACTION of pairs. Rough order of magnitude for
DMs: 10k users × 20 partners × ~50KB avatar ≈ 10 GB/day of announcements to fix
something that affects perhaps 1% of pairs.

Do not blindly copy 24h into the space implementation. Better shapes, roughly in
order of how much they'd help:

- **Receiver-driven request (best shape).** The receiver is the only party that
  KNOWS its roster entry is a placeholder. Let it ask, instead of everyone
  broadcasting on the off-chance. Cost becomes proportional to the actual
  problem rather than to the population. Needs a new control message type, so it
  is a wire change and a lead-dev call.
- **Fingerprint first, bytes on demand.** Announce a short hash of the avatar;
  send the image only if the peer says it doesn't have it. ~99% reduction, since
  the avatar is essentially the entire payload.
- **Backoff rather than a flat interval.** Retry at 1 day, then 1 week, then
  stop. Keeps the anti-loss property, kills the steady-state cost.
- **Piggyback.** Attach the fingerprint to traffic already being sent instead of
  generating a dedicated message.

Note §4: because a space announce is one broadcast per space rather than one per
member, spaces are far less exposed to this than DMs. The DM side is where the
cadence question actually bites.

## §8. How to verify

1. Open the affected space. DevTools console, log level "All levels".
2. Paste `.agents/tools/dm-debug/06-space-member-sources.js`.
3. `__spaceMissingSenders('<spaceId>')` — senders with no member row. This is
   the number that must go DOWN.
4. `__spaceMemberSources('<spaceId>')` — classifies existing rows by source.

Baseline from the 2026-06-13 run on test space "Quorum Test 2": 89 distinct
senders, **46 with no member row**. Re-run before and after, with the other
client having reconnected in between.

Reload between steps: the point is that the roster row PERSISTS, not that it
renders once from an in-memory fallback.

## §10. Mobile follow-up — give the announce gate an expiry

Gated on Slice 0. If replay does NOT rescue Cause B, mobile needs the same
change desktop got: an expiry on the persisted announce gate, so a member who
was not listening at announce time eventually learns the identity anyway.

Desktop's implementation is the reference (`src/utils/dmProfileGate.ts`):
persisted `{signature, timestamp}`, re-send when the signature changed OR the
record is older than the interval, plus a synchronous in-flight claim. The
migration detail matters — see §6 trap 3 and the note about legacy bare-signature
records, which mobile would hit too since its stored value is a bare signature
today.

Pick the interval from the outcome of
`2026-08-01-identity-announce-cadence-research.md`, NOT by copying desktop's
placeholder 24h.

Lives in `quorum-mobile`. Note that repo's `.agents/` is gitignored, so restate
anything important inline rather than only linking.

## §9. Relationship to the hub-log migration (#32)

This does NOT replace candidate #32 ("Hub-log sync transport"). #32 is the
robust long-term answer and remains a lead-dev architecture call. This task is
the cheap, precedented mitigation that removes the user-visible symptom in the
meantime, using a mechanism now proven in production on the DM side. If #32
lands later, the on-connect announce becomes redundant and can be removed.

---
*Last updated: 2026-08-01*
