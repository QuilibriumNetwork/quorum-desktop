---
type: task
title: "Identity announce: cap the retries instead of re-sending forever, and fix what un-converges a row"
status: STEPS 1-3 DONE 2026-08-01 (announce implemented, awaiting live verification). Step 4 remains
priority: medium — the two live bugs it uncovered are fixed and merged
created: 2026-08-01
updated: 2026-08-01
severity: a bandwidth and battery problem at scale, plus one live correctness bug (Slice 2)
area: identity propagation (DMs and spaces)
repos: quorum-desktop + quorum-mobile
related_tasks:
  - ".agents/tasks/2026-08-01-dm-partner-identity-lost-on-established-sessions.md"
  - ".agents/tasks/2026-08-01-space-member-identity-announce-on-connect.md"
  - ".agents/tasks/transport/README.md"
related_bugs:
  - ".agents/bugs/2026-08-01-space-sync-member-delta-blind-to-and-erases-global-slot.md"
related_docs:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
---

# Identity announce: cap the retries

> **One file.** Research, decision and work all live here. The only separate
> document is a distinct defect this uncovered, with its own repro:
> `.agents/bugs/2026-08-01-space-sync-member-delta-blind-to-and-erases-global-slot.md`.

---

## 🔴 HANDOVER — read this first (written 2026-08-01, end of session)

**Steps 1-3 are SHIPPED and merged. One piece of Step 3 remains, plus Step 4.**

Everything below this box is the reasoning and the record. Here is the state.

### Merged

| What | Where |
|---|---|
| Step 1 — saving a message no longer erases a conversation's name/avatar | desktop #288 `19e79da41` |
| Step 2 — retry cap, 3 attempts (desktop ∞→3, mobile 1→3) | desktop #289, mobile #213 |
| Step 3a — space digest can see the global slot | **shared** #71 `5a49829` |
| Step 3b — sync no longer erases the global slot, nor reverts a per-space name | desktop #290 `4be71e3fd` |
| Lint made usable again (`.worktrees` was breaking every file's parse) | desktop #287 |

All three repos are on their base branch, clean, nothing unpushed. Desktop
**749 tests**, shared **567**, mobile **210**. `tsc` and `eslint` clean on desktop.

### What is left, in priority order

**1. ✅ The bootstrap announce — DONE 2026-08-01.** Desktop now announces on
connect: `MessageService.announceProfileToAllSpacesOnConnect`, fired from
`MessageDB.tsx` on the startup timer and from `setResubscribe`, bounded by
`src/utils/spaceProfileGate.ts` (3 attempts per identity, minutes apart, then
silent — a bootstrap, not a cadence). The DM gate was extracted to
`src/utils/profileSendGate.ts` and both now sit on it.

Two deviations from the spec, both argued in
`2026-08-01-space-member-identity-announce-on-connect.md`'s status box: the
announce carries the **override slot as well as** the global one (global-only
would show a member's global name to anyone bootstrapping a row, breaking the
"a per-space name is what spacemates see" requirement), and the gate is spaced in
**minutes rather than 24h** (a bootstrap should finish inside a session; the
floor exists only so a flapping socket cannot spend the allowance in one outage).

⚠️ **Unit-tested, not yet verified on a real space.** That is item 2.

**2. Step 4, the diagnostic — now the top item.** A count of "rows with no
identity from any source", run before and after. Without it, none of this is
measured, and the announce above is the first change whose whole purpose is to
move that number. Baseline to beat, from the 2026-06-13 run on "Quorum Test 2":
**46 of 89 distinct senders had no member row at all.** Tool and procedure:
`.agents/tools/dm-debug/06-space-member-sources.js`, `__spaceMissingSenders(id)`.
Reload between runs — the point is that the row PERSISTS.

**3. Two things I did NOT verify** and which are adjacent to a question the
operator raised (does a per-space name always win?):
   - does the space UI feed `resolveSpaceMemberName` its `globalDisplayName` from
     the **roster global slot** or only from the **public profile**?
   - how does a **non-public** user's global name reach that comparison? They have
     no public profile, so if the comparison only reads channel B it sees nothing.

   The precedence *rule* is confirmed correct
   (`override → QNS → global → address`, and `resolveSpaceMemberName` lets a
   deliberate per-space name beat QNS). What is unverified is the **plumbing**
   that feeds it. Nothing shipped depends on this; it is the next thing to trace.

**4. `.agents/bugs/2026-08-01-vitest-intermittently-runs-4-percent-of-the-suite.md`**
— the test suite silently ran 29 of 749 tests on 5 occasions today. Read that file
before trusting any suite result. **Quote the FILE COUNT alongside the test
count**; a collapsed run is invisible otherwise.

### Two lessons worth carrying

- **Reach for headless verification first.** This task twice claimed a step
  "needs the operator, two clients, 20 minutes". Both times it did not: the digest
  is a pure function, and the erasure was a DB write path testable against
  `fake-indexeddb`. Device time was never needed to *establish* a defect — only to
  confirm a fix end to end.
- **Write the failing test before the fix.** Every defect here was converted from
  "found by reading code" to "demonstrated" that way, and one of them (the space
  half of Step 1) had been mis-specified in an earlier doc precisely because
  nobody had run it.

## §0. Doesn't this already work? Yes, almost.

The intended design is the simple one, and both halves work:

| # | Path | When | Status |
|---|---|---|---|
| 1 | **Session init** — B's first frame carries `user_profile` in the envelope; A stores it in the `conversations` row | once, when the DM session is created | ✅ works |
| 2 | **`dm-update-profile`** — B edits their profile → pushed to every DM partner | on every change | ✅ works |

**One hole, and it is narrow.** Identity rides only on the **init** frame. Once
the session is established, ordinary messages carry nothing — measured 2026-08-01,
`hasUserProfile: false` on every observation. So if that init frame is lost, B can
send a thousand more messages and none re-assert who they are. And path 2 fires
only on *change*, so if B never edits their profile again it never fires again.

The failure needs **both** conditions: A's row is empty **and** B never changes
their profile. Then it is permanent. That is the reported bug.

### The honest bottom line

> **If messages landed 100% of the time, no retry would be needed at all.**
> One announce per identity would be enough. The retry exists *only* because a
> lost frame had no second chance.

That is correct, and it is the frame this whole task should be read in. The
transport was losing **15–20% of messages** (rounds X/Y/Z/Q/R,
`.agents/tasks/transport/measurements.md`); **send retention shipped** in
`quorum-shared` 2.1.0-39 and took rounds Q/R (16-17/20) to S/U and the
published-build round at **20/20**.

Two things are still true, from `transport/README.md`:
- desktop **does not consume that fix yet** (item **B1**, `READY-TO-BUILD`), so
  desktop's loss rate is unchanged today;
- the cause is still upstream (item **U1**) — connections died 9 times in 51
  seconds during the round that scored 20/20. Retention makes loss survivable,
  not absent.

**So: a capped retry is a transitional safety net, not architecture.** As delivery
is proven, the cap should shrink toward 1 and eventually be removed. Nothing in
this task should be built as if the retry were permanent.

### What is actually wrong today: the two platforms sit at opposite extremes

Neither is right, and this is the real finding.

| | Desktop | Mobile |
|---|---|---|
| **Trigger** | `setTimeout(…, 10000)` on startup + ~4s after every reconnect (`MessageDB.tsx:558-596`) | 4s after connect, but a per-launch ref (`lastProfileRebroadcastSigRef`) makes it **once per app launch** (`WebSocketContext.tsx:6201-6310`) |
| **Gate** | localStorage `{sig, at}`, **expires after 24h** (`dmProfileGate.ts:40`) | MMKV **bare signature, no expiry** (`dmProfileService.ts`) |
| **Net effect** | re-sends to every partner **every day, forever** | sends **once, ever**, per identity |
| **Failure mode** | pure waste at scale | one lost frame = permanent failure |

The answer is a number between 1 and infinity, applied to both. That is the whole
change.

---

## §1. The plan — four steps, in this order

**The order matters.** Capping the retries is only safe once identity can no
longer be erased, because today's daily resend is accidentally repairing that
erasure within 24h.

| # | Step | Status | Needs the operator? |
|---|---|---|---|
| **1** | **Stop identity being erased.** `db.saveMessage` overwrote the conversation row's name/avatar on every save. | ✅ **SHIPPED** — desktop #288 (`19e79da41`). 8 tests, 4 fail against the old code. Mobile was never affected. | no |
| **2** | **Cap the retries.** Keep the 24h check, add "and fewer than 3 sends". Both platforms, moving in opposite directions. | ✅ **DONE, both repos** — desktop `fix/cap-identity-announce-retries` (24 tests), mobile same branch name (16 tests). Not yet merged. | no |
| **3** | **Spaces: no cadence.** Verify + fix the digest/apply defects, then add the bootstrap announce behind the same cap. | 🟡 **defects SHIPPED** (shared #71, desktop #290). **Bootstrap announce still to do.** | **no** — both defects were proven headlessly |
| **4** | **Prove it.** A diagnostic counting rows with no identity from any source. Run before and after. | not started | no |

| Rejected | Why |
|---|---|
| ~~Cap the encoded avatar size~~ | Rejected by the operator 2026-08-01. Do not re-propose. |
| ~~Receiver-driven `request-profile`~~ | Not needed once steps 1-3 land. See §4 — recorded so it is not re-derived. |

**Do DMs and spaces share a cadence? No.** Spaces already ship a receiver-driven
member reconciliation that runs on every connect. The space answer is to repair
it, not to add traffic. Step 3.

**Outside this task:** desktop still has no send retention (`transport/README.md`
item **B1**). Until that lands, desktop drops sends and step 2's retries are
earning their keep. Once it lands the cap can drop toward 1.

---

## §2. Work

### Step 1 — Stop identity being erased ✅ DONE

**User-visible outcome:** a DM partner's name and avatar, once learned, stay.
They could previously revert to "Unknown User".

**What was wrong.** `db.saveMessage` also upserts the conversation row, and that
`put` replaces the whole record — it wrote whatever identity the caller passed,
unconditionally. Both call paths hand it non-identity:

| Path | What it passed | Effect |
|---|---|---|
| DM **send** (`MessageService.ts:3269`, `:3464`) | the row as read at the **top** of the send, falling back to `'Unknown User'` / the default icon | a `dm-update-profile` landing mid-send was overwritten by the stale snapshot — a name we had already learned, silently reverted |
| **Space** paths (`MessageService.ts:5593`, `:5608`, …) | `{}`, which the wrapper turns into `updatedUserProfile.user_icon!` → **`undefined`** | **blanked the channel row's `icon` and `displayName` on every space message saved** |

> 🔴 **The space half was not previously known.** The original Slice 4 note in the
> DM identity task describes only the DM send path. Found 2026-08-01 while
> implementing: six `messageDB.saveMessage` call sites, and the space ones pass an
> empty object through a non-null assertion.

**The fix** (`src/db/messages.ts`, `saveMessage`): a real incoming value always
wins; otherwise keep what is stored; and only when the row is new do we fall back
to the incoming placeholder, so a brand-new row keeps the shape `Conversation`
requires (`icon` and `displayName` are non-optional). Uses the existing,
locale-aware `isPlaceholderDisplayName` / `isPlaceholderIcon`
(`src/utils/identityPlaceholder.ts`) rather than a new literal check.

- [x] Preserve-on-placeholder in `db.saveMessage`
- [x] Tests — `src/dev/tests/db/saveMessageConversationIdentity.test.ts`, 8 cases
      against the real DB via `fake-indexeddb`. **4 of them fail against the
      pre-fix code**, including both the DM race and the space blanking.
- [x] Full suite green (720 tests), `tsc` clean
- [x] **Mobile checked — it does NOT have this bug.** Its adapter takes
      `_icon` / `_displayName` and **ignores them**
      (`services/storage/mmkvAdapter.ts:115-123`); `messagesDb.saveMessage` only
      writes the message. Its send path re-reads the conversation immediately
      before writing and touches only timestamp / preview / sender-name, never
      identity (`hooks/chat/useSendDirectMessage.ts:634-648`). **No mobile work
      needed** — this is desktop catching up, same shape as the original DM
      identity parity fix.
- [ ] One-shot cleanup of rows already holding the `'Unknown User'` /
      `/unknown.png` literals, so they fall back cleanly to the address render.
      Deliberately NOT bundled — it is a data migration, not a write-path fix.

> ⚠️ `yarn lint` is currently broken repo-wide by a stale `.worktrees/secondary`
> directory (eslint cannot resolve `tsconfigRootDir`): 1383 errors on a clean
> `HEAD`, 1384 with this branch — the +1 is the new test file hitting the same
> parse error. Unrelated to this work.

### Step 2 — Cap the retries

**User-visible outcome:** a DM partner whose identity never landed still recovers,
and the app stops emitting a message per partner per day forever. Verifiable in the
DevTools console: after the cap is reached for a partner, reconnecting no longer
produces a `[DMProfile]` send for them — today it does every 24 hours indefinitely.

**The change is deliberately small.** Keep `RESEND_INTERVAL_MS = 24h` exactly as
it is. Add a counter and a cap:

```
send if:  never sent before
      OR  the identity changed (signature differs)
      OR  (24h has passed since the last send  AND  we have sent < 3 times)
```

- **3 attempts total**, spread over at least 2 days.
- **Convergence:** residual after k attempts is p^k. At p = 0.15 (desktop today,
  before B1) three attempts leave **0.34%**; at p = 0.02 (post-B1) they leave
  **0.0008%**.
- **Cost:** 3 sends per (pair, identity-version) instead of 365 per year. **~99%
  cut.**
- **The cap is the only new concept.** No ladder of intervals, no new scheduling.
  If a shorter first retry is ever wanted, that is a follow-up, not this change.
- **3 is a transitional number.** Drop it to 2 once desktop consumes send
  retention (B1), and consider 1 if U1 is fixed upstream and the miss rate
  measured in §5 is at zero.

#### How it actually works — no magic, no scheduling

This is the part that sounds more complicated than it is:

1. **Nothing runs while the app is closed.** There is no timer, no background job,
   no scheduled resend. The whole mechanism is a small record in local storage:
   `{signature, lastSentAt, attempts}`, one per DM partner.
2. **The check runs when the app connects.** Desktop: 10s after startup and ~4s
   after each reconnect. It walks the DM list and asks the question above for each
   partner. Almost always the answer is no, and nothing goes on the wire.
3. **The sender must be online; the receiver does not.** Messages go into the
   receiver's inbox on the relay and are picked up next time *they* connect. So a
   partner who is offline for a week still gets it.
4. **The user does nothing and sees nothing.** There is no UI, no prompt, no
   setting.
5. **An identity change resets everything.** Changing name or avatar produces a
   new signature, which resets the counter — correct, because new bytes genuinely
   have to be pushed.

Worked example. B sets an avatar on Monday and never touches their profile again:

| When | What happens |
|---|---|
| Mon, B connects | attempt 1 to each partner. Counter = 1. |
| Mon-Tue, B reconnects 40 times | nothing — 24h has not passed |
| Tue, B connects | attempt 2. Counter = 2. |
| Wed, B connects | attempt 3. Counter = 3. |
| Thu onwards, forever | **nothing.** Today this would send every single day. |

#### Migration — the part that stampedes if you get it wrong

The gate record has had two shapes (`src/utils/dmProfileGate.ts:76-113`): the
current `{sig, at}`, and a **bare signature string** from before the expiry
existed. Note a signature is itself valid JSON, which is why the shape check
matters more than the try/catch.

Add `attempts`. Migrate **both** legacy shapes to
`{sig, at: Date.now(), attempts: 2}`:

- **`at = Date.now()`, NOT the stored value.** Keeping the old `at` puts every
  existing pair instantly past the 24h check, so the entire fleet fires on the
  first connect after deploy. That is the stampede.
- **`attempts = 2` leaves exactly one more try** for anything broken right now,
  then stops. Users do not all connect at the same moment, so it spreads across a
  day.

- [x] Add `attempts` to the record + migration for both legacy shapes
- [x] The cap in `shouldSendDmProfile`
- [x] Tests — `src/dev/tests/utils/dmProfileGate.test.ts`, 24 total. Verified to
      fail against the old behaviour: **3 fail with the cap check disabled**, and
      **5 fail when the migration does not re-anchor the timestamp**.
- [x] Desktop: 728 tests, `tsc` clean, `eslint` clean
- [x] **Mobile: the same cap, moving in the opposite direction.** Its gate had no
      expiry *and* no retry — one send ever, so a lost frame was permanent. Now
      the same `{sig, at, attempts}` record and the same rule, an *increase* from
      1 attempt to 3. Constants and migration semantics match desktop exactly.
      - Decision logic split into `services/dm/dmProfileGate.ts`, free of MMKV so
        it is unit-testable — importing the MMKV-backed service into a jest test
        pulls in NitroModules and fails. Mirrors the existing `dmBurstPrefix`
        pattern, and now mirrors desktop's file name too.
      - 16 new tests; full mobile suite 204 pass. `tsc` unchanged at 11
        pre-existing errors (all in `services/calling`, none in these files —
        confirmed by counting against `master`).

> **A migration asymmetry worth knowing.** Both platforms credit legacy records
> 2 attempts, so both land on "exactly one more try, then stop". But that is a
> *reduction* on desktop (from unbounded) and an *increase* on mobile (from
> zero). Mobile therefore gets a small, bounded, one-time rise in traffic on
> first deploy — one extra announce per existing pair — which is the price of
> closing its permanent-failure hole.

### Step 3 — Spaces: repair the existing mechanism, do not add a cadence

**User-visible outcome:** space members stop rendering as a 6-character address,
without either user touching settings.

Spaces already have what everyone keeps proposing to build. On every connect,
`MessageDB.tsx:611-631` calls `requestSync` for every joined space, which drives a
**receiver-driven, fingerprint-first member identity reconciliation** — already on
the wire, no new type needed:

| Piece | Location |
|---|---|
| `MemberDigest { address, inboxAddress, displayNameHash, iconHash }` | `quorum-shared/src/sync/types.ts:82-91` |
| digest construction | `quorum-shared/src/sync/utils.ts:140-147`, `:241-249` |
| diff → missing / outdated | `quorum-shared/src/sync/utils.ts:364-395` |
| responder ships full rows for exactly those | `quorum-shared/src/sync/utils.ts:486-501` |
| delta applied on receive | `src/services/MessageService.ts:5645-5669` |

It does not work for identity, for two reasons filed as
`.agents/bugs/2026-08-01-space-sync-member-delta-blind-to-and-erases-global-slot.md`
(**unverified — code reading only; that file's §4 is the repro**): the digest
hashes only the per-space **override** slot, which the follow-global work
deliberately emptied, so most members hash to `hash('')` on both fields; and
applying a delta does a full-row `put` that **erases** `global_display_name` /
`global_user_icon` / the profile timestamps.

- [x] **Verify both defects — done headlessly, no device time and no second
      client.** An earlier draft of this task said this step needed the operator
      for ~20 minutes. It did not: the digest is a pure function, and the
      erasure is a DB write path testable against `fake-indexeddb`. Reach for
      that first next time.
      - Defect 1: a member with a real global identity hashed **identically** to
        one with no identity at all, and to one with a **completely different**
        identity (2 of 4 tests failed against the old code).
      - Defect 2: the global slot, the bio, **and both staleness guards** were
        destroyed by a delta-shaped write (4 of 8 tests failed).
- [x] Fix them (defect 2 first — destructive and independent). Also required
      carrying the global slot through the desktop adapter, which was dropping it
      before the digest ever saw it, and declaring it on the shared `SpaceMember`
      type — a field the type will not admit cannot be hashed. That closes the
      long-outstanding two-slot-types follow-up.
- [ ] End-to-end confirmation once merged: two clients, one space, check the
      roster actually heals (bug file §4). This is confirming the FIX, not the
      defect.
- [ ] Then ship the sibling task's Slice 1 (announce-on-connect, global slot only)
      as a **bootstrap** for members nobody has a row for, behind the Step 2 cap
- [ ] **Do not copy 24h**, and do not give spaces a periodic cadence
- [ ] Mobile's `spaceMessageService.maybeSendUpdateProfileMessage` gate has no
      expiry either — same cap

> 🔴 **Corrects `2026-08-01-space-member-identity-announce-on-connect.md` §4.**
> "Cheaper here than it was for DMs" holds for the *sender's uplink* only. One
> broadcast is read by **every member**, so total transfer is `spaces × members`.
> At 5 spaces × 50 members that is **250 payload-deliveries per user per day
> versus 40 for DMs** — a daily space cadence is ~6× more total transfer than a
> daily DM one, not less.

### Step 4 — Prove it

**User-visible outcome:** a single number you can read before and after, instead
of taking anyone's word for it.

Everything above is argued from code reading and small manual rounds. Without a
measurement, "fixed forever" is a claim rather than a fact — and the cap in Step 2
is sized from a loss rate nobody has measured in production.

Build a diagnostic that counts, on one client: **how many DM conversation rows and
space member rows carry no identity from any source** (no real name, no real
avatar, no public-profile fallback). The per-client logic already exists in
`.agents/tools/dm-debug/05-profile-sources.js` and `06-space-member-sources.js` —
the gap is a single headline number and somewhere to record it.

- [ ] One console snippet that prints the count for DMs and spaces
- [ ] Baseline it before Step 2 and Step 3 land
- [ ] Re-run after. The number going to near-zero **and staying there across a
      week** is the acceptance criterion for this whole task
- [ ] If the number does NOT settle, that is the signal to revisit
      `request-profile` (§4) — and the only legitimate reason to

---

## §3. Cost model (reference)

Kept so the numbers are not re-derived. **Parameterised** — re-read with real
values once they exist.

**Fan-out is easy to miss.** `encryptAndSendDm` builds `targetInboxes` from every
established session inbox for the conversation minus our own device
(`MessageService.ts:1138-1140`) and emits one sealed frame per inbox (`:1200-1208`).
So cost is **per destination inbox** — partner devices plus our own other devices,
ghosts included and never pruned. Bench row B of `transport/index.md` §3.1 measured
**~9 frames per message** on aged multi-device accounts. Use D = 2 healthy, 9 aged.

Avatars are base64 data URLs, measured at **9 KB and 51 KB** on two real accounts
(2026-08-01). Use A = 30 KB.

**DMs, today's flat 24h**, per user per day = `P × D × A`. Downstream is the same
volume again, so relay transfer is ~2× the upstream column.

| Scenario | P | D | Per user/day | 1k users | 10k | 100k |
|---|---|---|---|---|---|---|
| conservative | 10 | 2 | 600 KB | 0.6 GB/d | 6 GB/d | 60 GB/d |
| **central** | 20 | 2 | **1.2 MB** | **1.2 GB/d** | **12 GB/d** | **120 GB/d** |
| aged accounts | 20 | 9 | 5.4 MB | 5.4 GB/d | 54 GB/d | 540 GB/d |

Central case at 10k users ≈ **4.4 TB/yr upstream, ~8.8 TB/yr total transfer.**

**With Slice 1** (3 sends per identity-version; assume ~2 identity changes per user
per year → ~9 announces per pair per year instead of 365): 10k users central →
**~110 GB/yr upstream. A ~97% cut.**

**Spaces:** one Triple-Ratchet hub broadcast regardless of member count
(`MessageService.ts:1044-1071`), so the sender pays `S × A` but total transfer is
`S × M × A`. At S = 5, M = 50, 10k users: 150 KB/user/day sender-side, **75 GB/day
fleet-wide**.

---

## §4. Considered and rejected — do not re-derive

**Receiver-driven `request-profile`** (a new control message: the receiver, which
is the only party that knows its row is a placeholder, asks that specific peer).
Structurally the most elegant option — it is the only **closed-loop** design, since
an announcer can never know whether its send worked, while a receiver can see its
own row is empty.

**Rejected anyway**, because the two problems it solves are being removed more
cheaply:

- the transport-loss tail is shrinking on its own as delivery is fixed;
- the state-loss tail (a converged row going bad) is Slice 2, which fixes the cause
  rather than adding a mechanism to compensate for it.

A new wire type needs lead-dev sign-off and handlers on both platforms. Not worth
it for a residual measured in fractions of a percent. **Revisit only if §5's
measurement shows a real, persistent tail after Slices 1-3 have shipped.**

**Capping the encoded avatar size.** Avatars are uncapped after compression (a
≤750 KB PNG stays PNG and can reach ~500 KB on the wire, since `isPNGPhoto` only
converts PNG→JPEG above a 750 KB *input*). **Rejected by the operator 2026-08-01.**

---

## §5. What is still unmeasured

| Question | Why it matters | How |
|---|---|---|
| Real per-pair identity-miss rate in production | Sets the cap, and whether it can go to 1 | Ship a counter: at render, how many DM rows and space member rows have no identity from any source. `05-profile-sources.js` / `06-space-member-sources.js` already compute this per client — the gap is aggregation |
| Whether the space sync defects are live | Decides whether spaces need anything beyond a bootstrap announce | Bug file §4, ~20 min, two clients |
| Desktop loss rate after send retention | Desktop does not consume the fix | Blocked on `transport/README.md` B1 |
| Real distribution of P (partners) and S/M (spaces) | Every fleet number scales linearly | Not knowable pre-launch; §3 is parameterised |

---

## §6. Files

| Concern | File |
|---|---|
| The 24h constant + the gate | `src/utils/dmProfileGate.ts` |
| Its tests | `src/dev/tests/utils/dmProfileGate.test.ts` |
| DM send loop that consults it | `src/services/MessageService.ts:543` (`broadcastProfileToAllDMs`) |
| Desktop on-connect trigger | `src/components/context/MessageDB.tsx:558-596` |
| Mobile on-connect trigger (once per launch) | `quorum-mobile/context/WebSocketContext.tsx:6201-6310` |
| Mobile DM gate (no expiry) | `quorum-mobile/services/dm/dmProfileService.ts` |
| Mobile space gate (no expiry) | `quorum-mobile/services/space/spaceMessageService.ts` |
| Placeholder re-stamp (Slice 2) | `src/db/messages.ts:1360-1370`, `src/services/MessageService.ts:3455` |
| Space digest blindness | `quorum-shared/src/sync/utils.ts:140-147`, `src/adapters/indexedDbAdapter.ts:142-166` |
| Space delta erasure | `src/services/MessageService.ts:5645-5669`, `src/db/messages.ts:1203-1216` |

---
*Last updated: 2026-08-01*
