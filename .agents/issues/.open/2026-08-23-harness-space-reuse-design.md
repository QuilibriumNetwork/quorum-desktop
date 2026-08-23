---
type: task
title: 'Harness: reuse a persistent space instead of minting a permanent one every run'
status: open
created: 2026-08-23
updated: 2026-08-23
---

# Harness: reuse a persistent space instead of minting one every run

Sibling of [2026-08-23-harness-mints-permanent-accounts-every-run.md](../2026-08-23-harness-mints-permanent-accounts-every-run.md),
which fixed the account half of the same problem. Read that one first — it holds
the measurements this design rests on.

## Problem

Spaces are create-only. There is no delete endpoint anywhere in the API surface
(`src/api/quorumApi.ts`, `src/api/baseTypes.ts`): `/inbox/delete`, `/hub/delete`
and `DELETE /users/<addr>/public-profile` exist, but nothing removes an account
or a space. Registrations were MEASURED on 2026-08-23 to still resolve in full 26
days after minting.

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
```

**Never persist — this is what assertions read, and it must start empty:**

```
messages  ·  encryption_states  ·  deleted_messages  ·  action_queue
channel_threads  ·  latest_states
```

Any store not explicitly listed as persistable stays ephemeral. Default to
ephemeral so the list rots loudly (a scenario fails because state it expected is
gone) rather than silently (an assertion quietly stops proving anything).

## Steps

- [ ] Snapshot the four space stores to `.state/<bot>-space.json` at scenario end
- [ ] Restore them into the fresh in-memory database at startup, before connect
- [ ] Point `space-delivery` at the restored space; create only when absent
- [ ] Add `--fresh` to bypass the persisted space and create a new one, for
      clean-room reproduction
- [ ] **Falsify**: break the delivery path, confirm the arm still goes red with a
      restored space, restore. An arm that has not been seen to fail is not
      evidence — this step is the deliverable, not a formality
- [ ] Decide `space-basic` separately: same treatment for the joiner only, or
      option 1 (lower frequency). Creation is genuinely its subject
- [ ] Independent review before merge — this changes test isolation

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
