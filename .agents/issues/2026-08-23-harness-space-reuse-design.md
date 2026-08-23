---
type: task
title: 'Harness: reuse a persistent space instead of minting a permanent one every run'
status: in-progress
created: 2026-08-23
updated: 2026-08-23
---

# Harness: reuse a persistent space instead of minting one every run

Sibling of [2026-08-23-harness-mints-permanent-accounts-every-run.md](.done/2026-08-23-harness-mints-permanent-accounts-every-run.md),
which fixed the account half of the same problem. Read that one first — it holds
the measurements this design rests on.

## Problem

Spaces are create-only. There is no delete endpoint anywhere in the API surface
(`src/api/quorumApi.ts`, `src/api/baseTypes.ts`): `/inbox/delete`, `/hub/delete`
and `DELETE /users/<addr>/public-profile` exist, but nothing removes an account
or a space. Registrations do not expire either.

Two live arms create a space on every run:

| Arm | Creates | Is creation the point of the test? |
|---|---|---|
| `space-delivery` | 1 space | **No** — it just needs somewhere to post |
| `space-basic` | 1 space | **Yes** — it tests create → invite → join |

So `yarn verify --all` leaves **2 permanent spaces** behind every time. The
AGENTS.md rule makes that per-code-change.

## Why the account fix does not transfer

Accounts could simply be reused because isolation never depended on them:
`storage.ts` backs `MessageDB` with in-memory `fake-indexeddb`, so every run
already starts from an empty database.

That same fact is what blocks space reuse. A space's **owner** needs the space in
local storage to post into it. With an empty database the owner does not know the
space exists, so it creates another one.

## Options considered

1. **Move space-creating arms off the per-change tier.** No redesign, cuts
   minting roughly tenfold, keeps coverage. Rejected as the primary fix — it
   reduces the rate rather than the behaviour — but remains a good fallback for
   `space-basic`.
2. **Recover the space through `ConfigService.getConfig`**, the real
   returning-user path that `space-wipe-restore.scenario.test.ts:191-199` already
   exercises. Rejected: it makes the delivery arm depend on config sync, so a
   config-sync regression would turn `space-delivery` red for an unrelated
   reason.
3. **Persist local storage selectively.** Chosen. See below.

## Design: persist space identity, keep evidence ephemeral

The initial objection to persistence was that a test could pass on yesterday's
state. That risk is real but narrow, and does not apply to message assertions:
every scenario stamps its message text with the run timestamp
(`honest-post-A-${stamp}`), so a stale message cannot satisfy a current
assertion. Only **structural** assertions ("B holds a member row for A") are
exposed.

So the split is by object store, not all-or-nothing. `src/db/messages.ts`
declares roughly 20 stores; the relevant ones:

**Persist — this is what makes a space reusable:**

```
spaces  ·  space_keys  ·  space_members  ·  space_member_devices
encryption_states  (space rows ONLY — conversationId === `<spaceId>/<spaceId>`)
```

**Never persist — this is what assertions read, and it must start empty:**

```
messages  ·  deleted_messages  ·  action_queue  ·  channel_threads
latest_states  ·  conversations  ·  encryption_states (every DM row)
```

Any store not explicitly listed as persistable stays ephemeral. Default to
ephemeral so the list rots loudly (a scenario fails because state it expected is
gone) rather than silently (an assertion quietly stops proving anything).

### ⚠️ Correction: `encryption_states` had to move sides

This document originally put `encryption_states` under "never persist". That was
**wrong**, and it would have produced a space that restored cleanly and then
heard nothing. READ from the production code while implementing:

- `handleNewMessage` builds an `inboxId → state` map from
  `getAllEncryptionStates()` and looks the arriving frame up in it
  (`MessageService.ts:4557`). No space row, no route.
- `spaceBot`'s `refreshSubscriptions` derives the socket subscription list from
  the same store, so a restored bot would not even subscribe to the space inbox.

The instinct behind the original placement was still right, and it is why the
split is now **by conversation rather than by store**: for a DM the row holds an
advancing double ratchet, and carrying a stale one across runs is exactly the
silent corruption the rule was guarding against. For a space it holds no such
thing on the current path — `SpaceService.sendHubMessage`
(`SpaceService.ts:1202`) seals with the static `hub` and `config` keys out of
`space_keys`, the receive branch unseals with the same two
(`MessageService.ts:5421-5471`), and `TripleRatchetEncrypt` appears nowhere in
`src/services/`. Nothing advances **on the message path this harness
exercises**, so a restored space key is as good as a fresh one however old it
is. The `state` field IS mutated elsewhere — the `peerMapDelta` apply on a
member join and `rekey` — neither of which fires in a fixed two-member space
where nobody joins after the first run. See finding 3 below.

### ⚠️ Second correction: reuse forces the assertions to change

Not in the original design at all, and it is the more important of the two. The
relay holds a frame until it is acked, so **a run that fails partway leaves its
frames queued and the next run's `listen` gets them re-pushed.** The old
per-type check was `typesSeenBy('v').has('embed')`, which cannot tell last run's
embed from this run's — so with a reused space the arm could report green on
evidence produced by a *failing* run. That is the worst shape a test can have,
and it is a direct regression of the property this whole gate exists to provide.

Every delivery check is therefore scoped to a token only the current run could
have produced: a stamped payload string (`sticker-123456`, `thread-123456`) or
the id of a target row minted this run. Scoping by the frame's own messageId was
tried first and abandoned — MEASURED: `thread` produces no local echo on the
sender, because its send path writes `channel_threads` rather than saving a
message row, so there is no sender-side id to compare against.

Net effect: the arm is **stronger** after this change than before it, not merely
cheaper.

## Steps

- [x] Snapshot the space stores to `.state/<bot>-space.json` at scenario end
      (`spaceState.ts`). Saved in the `finally`, so a FAILING run still persists
      the space it already made permanent — otherwise a red arm becomes a source
      of exactly the litter this removes
- [x] Restore them into the fresh in-memory database at startup, **before**
      `start()` — `refreshSubscriptions` runs there and reads `encryption_states`
- [x] Point `space-delivery` at the restored space; create only when absent
- [x] Verify the restore round-trips, and throw if it does not. These rows go to
      disk as JSON; a `hub` key that lost a byte still looks like a restored
      space to every caller and just silently fails to decrypt
- [x] Bypass flag for clean-room reproduction. Shipped as `HARNESS_FRESH=1`
      rather than `--fresh`: scenarios run under `vitest --run`, which parses
      argv itself and rejects options it does not know
- [x] Scope every delivery check to this run (see the second correction above)
- [x] **Falsify**: break the delivery path, confirm the arm still goes red with a
      restored space, restore. An arm that has not been seen to fail is not
      evidence — this step is the deliverable, not a formality
- [x] Independent review before merge — this changes test isolation. Ran
      adversarial, in a fresh context. Three findings, all fixed (below)
- [ ] Decide `space-basic` separately: same treatment for the joiner only, or
      option 1 (lower frequency). Creation is genuinely its subject — this is
      the ONLY remaining source of per-run space minting

## What independent review caught

Worth recording because two of the three were mistakes of *reasoning stated as
fact*, which is the failure mode this repo keeps paying for.

1. **CRITICAL — the per-run token was not actually unique per run.**
   `stamp` was `String(Date.now()).slice(-6)`, which repeats exactly for any two
   runs whose start times differ by a multiple of 1,000,000 ms (≈16m40s). Every
   content token derived from it. Since the space is now kept forever, a frame a
   failing run left un-acked stays on the relay indefinitely — so a later run
   drawing the same six digits would match that old frame and report PASS on a
   broken receive path. Per-pair odds ~1e-6; the birthday bound puts it at 50%
   within ~1,200 runs, which this arm will reach. **This is the very false pass
   the redesign existed to remove, reintroduced by a weak token.** Fixed by
   appending a `crypto.randomUUID()` slice. Also hardened the same seed in
   `dm-delivery`, which is currently protected only by its inbox drain.
2. **IMPORTANT — the round-trip check did not verify the hop its comment
   claimed.** `restoreSpaceState` compared the restored rows against `snap`,
   which has *already* been through `JSON.parse`. So it could only catch
   corruption from the IndexedDB put/get, never the `JSON.stringify` step the
   comment said it was guarding. No live impact (every field in these stores is
   a string, number or boolean today), but the documented safety property was
   not the delivered one. Fixed by verifying serialization in `saveSpaceState`,
   where it actually happens, and by correcting the comment.
3. **MINOR — "nothing ratchets" was broader than the code supports.** True for
   the message path this harness exercises; the `state` field IS mutated by the
   `peerMapDelta` apply on a member join and by `rekey`. Neither fires in a
   fixed two-member space, but the sentence is now scoped to what was actually
   established.

Post-fix: `space-delivery` reran GREEN on the reused space at 91.6s.

## Measurements

MEASURED 2026-08-23, against the production relay:

| Run | Space | Verdict | Duration |
|---|---|---|---|
| 1 | **CREATED** (no state file yet) | fail — `thread` had no sender echo, caught by the scoping guard | — |
| 2 | **REUSED** (0.1h old) | **pass** | 92.3s |

Run 2 created **zero** spaces, at a timing unchanged from the pre-reuse baseline
(~92-97s).

### Falsification, on a RESTORED space

Dropping every `sticker` frame before `saveMessage` in the space receive dispatch
(`MessageService.ts`, the `decryptedContent = envelope.message` line in
`handleNewMessage`'s non-DM branch) turns the arm **RED**:

```
types accepted by victim : post, embed, reaction, edit-message, thread,
                           remove-message, mute, update-profile, remove-reaction
phases that timed out    : batch1 posts+embed+sticker at victim
outbound failures v / x  : 0 / 0
receive failures  NOVEL  : victim=0 sender=0
```

`sticker` cleanly absent, every counter clean, space `REUSED (0.1h old)`. Probe
reverted; production code confirmed unchanged by `git status`.

### Control: does the run-scoping actually reject a stale frame?

The falsification above proves the arm can fail. It does **not** by itself prove
the new per-run token scoping works, because the probe suppressed every sticker,
old and new alike. So a second, separate probe: leave the receive path intact and
**skip sending a sticker this run**, against a relay that (thanks to the probe
above returning before the ack) still held un-acked stickers from earlier runs.

```
types accepted by victim : post, sticker, embed, reaction, edit-message, thread,
                           mute, remove-message, update-profile, remove-reaction
phases that timed out    : batch1 posts+embed+sticker at victim
```

**`sticker` IS in the accepted list.** A stale sticker really did arrive and
really did reach `saveMessage` — so the old `typesSeenBy('v').has('sticker')`
check would have reported the arm GREEN in a run that never sent a sticker. The
run-scoped check reported RED.

That makes the stale-frame false pass a measured fact rather than a worry, and
the scoping a measured fix rather than an argument. It is also the control arm
the falsification lacked: something that should NOT have changed (an old frame
arriving) is shown to change nothing.

## Known cost

Persisted state is machine-local, so `.state/` differs between machines and CI. A
failure may reproduce on one and not another. Mitigated by keeping the persisted
surface to four stores and by the `--fresh` flag, not eliminated. Record it in
the harness README rather than discovering it later.

## Acceptance

- `space-delivery` creates **zero** spaces on its second and subsequent runs
- The arm still goes red when the delivery path is broken (demonstrated, not
  argued)
- Message assertions still start from an empty `messages` store
- A `--fresh` run creates a space and passes, proving the bypass works

## Out of scope

- The 20 manually-run scenarios that still mint accounts per run (`wipe-*`,
  `mid-*`, `sm-*`, `sokf-*`, `thr-*`, `tgt-*`, `sds-*`, `sdl-*`)
- The unattributed 1-in-10 `space-delivery` failure (9 passes, 1 failure across
  10 runs on 2026-08-23; failed after all sends succeeded, during the settle
  phase; not reproduced). Full stdout capture is the agreed next step, not a
  control run — a control costs ~20 permanent accounts
- Wiring the authorization scenarios into the gate, which is a separate and
  higher-value gap

*Last updated: 2026-08-23*
