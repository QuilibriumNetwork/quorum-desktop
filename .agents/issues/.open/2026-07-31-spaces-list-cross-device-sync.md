---
type: task
title: "Make the Spaces list identical on every device (umbrella — start here)"
status: open
priority: high
created: 2026-07-31
updated: 2026-08-04
severity: data-integrity (Spaces vanish from a device's list) + cross-device divergence
area: UserConfig spaces list / space add + removal propagation / ghost cleanup
repos: quorum-desktop + quorum-mobile (+ quorum-shared for the wire type)
owns: the per-device-pair state matrix (§2). Implementation detail lives in the linked sub-docs (§6).
---

# Make the Spaces list identical on every device

**The requirement:** *the Spaces list must be identical on every device, always.* It is
not, today. This is the umbrella task for getting there, and the single place to start.

> **To brief an agent, paste this:**
>
> ```
> Read quorum-desktop/.agents/tasks/2026-07-31-spaces-list-cross-device-sync.md first.
> It is the umbrella task for Spaces-list cross-device sync across quorum-desktop and
> quorum-mobile. Read §1 and §2 before forming any theory, and §5 before writing code.
> ```

⚠️ **Do not start implementing from this file.** §5 lists decisions that need the lead
dev, including a wire-format change. This task states what is true and what is left; it
does not authorise the change.

## §0. Paths, and one thing that will trip you up

Paths are repo-qualified, not relative, because this task is read from both repos.
The repos are siblings, so `../quorum-mobile/...` also resolves from inside either one.

| repo | root (this machine) |
|---|---|
| `quorum-desktop/` | `quorum-desktop/` |
| `quorum-mobile/` | `quorum-mobile/` |

> 🔴 **`quorum-mobile/.agents/` is gitignored** (`.gitignore:56`) — it is local-only and
> invisible to anyone else's checkout, unlike `quorum-desktop/.agents/`, which is tracked.
> Every mobile finding that matters is therefore **restated inline in this file** rather
> than only linked. If you are on a fresh machine and a `quorum-mobile/.agents/...` link
> below does not resolve, that is expected — the content is here.

## §1. The whole situation in seven sentences

The Spaces list travels inside the synced `UserConfig` blob, resolved last-write-wins by
timestamp, with no per-field merge. Desktop renders its sidebar **from that config**
(`useNavItems.ts:49-53` walks `config.items` and resolves each entry against the DB), so
whatever the config says is what the user sees. Mobile renders its list **from local
storage** (`app/(tabs)/spaces/index.tsx` → `useSpaces()` → storage adapter, no config
filter anywhere), so the config has no power to remove anything from mobile's screen.
Adding a Space works on every pair. Removing one only works when the receiver is a
desktop. On top of that, `saveConfig` on both platforms rebuilds the list from local
state at save time and used to publish a truncated version whenever local storage was
incomplete, which silently emptied the list on every *other* device. That last part is
fixed; the receive-side asymmetry is not.

## §2. Verified state, per device pair

Verified against both codebases 2026-07-31. **This matrix is the one piece of status this
index owns** — no other doc has it.

**Adding a Space (create / join): works on every pair.** Mobile shows it one app-launch
late — see `quorum-mobile/.agents/bugs/2026-07-19-new-desktop-space-appears-one-launch-late-on-mobile.md`
(low severity: the sync is deferred via `InteractionManager` and fire-and-forget, so the
write lands after the list has rendered; fix is to invalidate the spaces query after
`syncSpacesFromConfig`).

**Removing a Space (leave / delete / kicked):**

| acted on → should disappear on | before 2026-07-31 | now | why |
|---|---|---|---|
| desktop → other desktop | ✅ | ✅ | desktop publishes the removal; the receiving desktop's list is config-driven |
| mobile → desktop | ❌ | ✅ | **fixed 2026-07-31** — mobile now publishes removals (§3) |
| desktop → mobile | ❌ | ❌ | mobile's list ignores the config; nothing arriving over sync can remove a Space from it |
| mobile → mobile | ❌ | ❌ | same receive-side gap |

**Read this matrix as: the breakage is "mobile as receiver".** It was never broken
between two desktops. That is the single most useful orientation fact in this file.

### Why the original symptom hit desktop and never mobile

The bug that started this (all Spaces vanishing from the desktop list, recoverable via
Settings → Restore Spaces) was a *different* failure from the removal gap above: a device
with incomplete local storage published a truncated list, which won on timestamp, and
every other device adopted it.

A truncated config empties desktop's list instantly, because desktop renders from it. The
same truncated config is **invisible on mobile**, whose list reads storage. So mobile was
both the likely publisher and structurally incapable of showing the symptom — which is
exactly what the reporter observed ("desktop lost its Spaces, mobile looked fine").

## §2b. Still firing after the 2026-07-31 fixes — three reproductions, 2026-08-04

The desktop sidebar emptied three more times on 2026-08-04, all recoverable with
Settings → Restore Spaces. **The 2026-07-31 work did not close this, and was never going
to: it hardened desktop as a *publisher* and left desktop defenceless as a *receiver*,
while mobile's publisher guard was deliberately reverted (`3a03b6f`, §3).** Desktop is the
victim of mobile's publish, and there is no guard on the path that actually hurts it.

**What the reporter did, in order:**

| # | action on mobile | result on desktop |
|---|---|---|
| 1 | created a test Space | after refresh: the test Space showed, **every other Space gone** |
| 2 | deleted that test Space | Spaces gone again |
| 3 | changed the username — no Space operation at all | Spaces gone again |

**All three are the same event: mobile called `saveConfig`.** Reproduction 3 is the
decisive one — it touches nothing about Spaces, so the trigger cannot be any Space
operation. It is the publish path itself. Reproduction 1 is the confirming detail: the
survivor was exactly the one Space mobile had just created locally and could therefore
key.

Note for the reporter's own hypothesis: "removing a Space on mobile doesn't sync yet" was
true before 2026-07-31 and is **no longer true** — `df6b198` added `removeSpaceFromConfig`,
so reproduction 2 published too.

### The chain, read end to end (file:line, verified 2026-08-04)

1. Any mobile `saveConfig` rebuilds the published blob narrowed to Spaces this device can
   currently key — `quorum-mobile/services/config/configService.ts:615-645`. Username
   changes, mutes, bookmarks and settings all land here.
2. Mobile **warns and publishes anyway** (`:666-671`) with a fresh `ts = Date.now()`
   (`:591`). Desktop refuses in the identical situation
   (`quorum-desktop/src/services/ConfigService.ts:512-529`).
3. `collectSpaceKeysForSync` (`:507-546`) drops a Space if it is missing from
   `getAllSpaces()`, has no keys, **or has no encryption state** for `spaceId/spaceId`.
4. Mobile's blob import saves the keys first (`spaceSyncService.ts:129-141`) but writes
   `saveSpace` and `saveEncryptionState` only *after* two network round-trips
   (`fetchSpace`, `getSpaceManifest`) that each `return false` on failure (`:145-160`), and
   it walks Spaces sequentially with a **1-second delay each** (`:312-327`). A Space that
   failed, or that sync has simply not reached yet, is unkeyable and gets dropped.
5. Desktop `getConfig` takes remote on a newer timestamp, applies it **verbatim**, writes
   it to IndexedDB and pushes it into the React Query config cache
   (`ConfigService.ts:374-384`). No merge, no floor, no log.
6. The sidebar renders from `config.items` (`useNavItems.ts:49-53`) → empty. The Space rows
   are untouched in IndexedDB, which is exactly why Restore Spaces
   (`useSpaceRecovery.ts:30-72`) brings them all back.

### Epistemic status

Steps 1-6 are **READ** (cited above). That mobile's list was narrow *on these three
occasions* is **INFERRED** from the symptom shape, not measured — no log was captured.

The decisive measurement is mobile's `[ConfigSync] publishing a NARROWER Space list`
warning. Two obstacles to collecting it:

- In a release mobile build that line does not exist: `logger.warn` is compiled to a no-op.
  See [`2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md`](2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md).
  A dev build will show it.
- **Desktop logs nothing at all when an adopted config shrinks its Space list.** That is
  the missing instrument, and it is the cheapest thing to build here: it turns a
  "spaces vanished again, no idea why" report into a timestamped count.

### The instrument (PR #311)

Built 2026-08-04, behaviour-neutral. When `getConfig` adopts a config that drops Spaces
this device still holds, it warns and appends to a bounded ring in `localStorage`:

```js
JSON.parse(localStorage.getItem('quorum:diag:configSpaceShrink'))
```

Each entry has the winning blob's timestamp, before/after counts, dropped ids, and
`stillInDb`. **`stillInDb > 0` is this bug; `stillInDb === 0` is a legitimate removal from
another device.** That single number is what separates them, and it is why the next report
of this will not be guesswork.

Uses `console.warn` rather than `logger.warn` on purpose — see the no-op logger bug above.

### Next actions, in order

1. ~~**Stop the publisher.**~~ **Done, and verified on a device 2026-08-04** —
   quorum-mobile #228 (`35b3fc8`) and #229 (`93f9172`). Mobile no longer publishes a Space
   list narrowed by incomplete local storage. It holds rather than truncating, keeps its
   incoming timestamp while holding, and carries previously-synced Space keys forward from
   the config blob so an incomplete local import does not narrow the list in the first
   place. The stale comment that argued no removal path prunes `config.spaceIds` — the
   premise `3a03b6f` reverted the guard on — is replaced.

   **Read this before porting the desktop guard anywhere: #228 alone was wrong.** Holding
   the whole publish on one unkeyable Space is all-or-nothing, and on a device that
   imported its Spaces rather than creating them it is the steady state, not the rare dead
   end §3 assumes. It measured `0/3` Spaces keyable on a real phone and silently stopped
   that device syncing every setting. Desktop carries the same all-or-nothing guard;
   whether it is equally exposed has not been checked.

   Verified end to end on device: `carrying 3 previously-synced Space key(s)` →
   `published ts=…` → `server read-back CONFIRMS`, with the desktop sidebar intact
   afterwards.

   Two residues, both filed in quorum-mobile: a device already wedged cannot heal itself
   (it needs another device to publish first), and **nothing yet explains why that phone
   keys 0 of 3 Spaces** — `2026-08-04-mobile-cannot-key-any-space-it-imported-from-the-config-blob.md`
   is the root cause under this entire umbrella and is still open.
2. **Make them converge.** Slice 2 tombstones, per §5 — still needs the lead dev. This is
   now the only thing standing between here and the requirement at the top of this file:
   desktop → mobile removal still cannot reach mobile's screen.

## §3. What shipped 2026-07-31, and what it does not fix

Two branches, **both merged later the same day** (desktop `4a04a8b24` / #282, mobile
`2368084` / #204; the original "neither merged at time of writing" was true only for the
hours between). Both are narrow, defensive fixes — they stop corruption, they do not make
the lists converge.

**`quorum-desktop` — branch `fix/config-save-filter-wipes-local-spaces`**

| commit | what |
|---|---|
| `9f5cbb76c` | `saveConfig`'s narrowing built a separate `uploadConfig` instead of mutating the object that is persisted to IndexedDB and pushed to the React Query cache. A device can no longer delete Spaces from its own nav. |
| `31bd214d4` | Refuse to POST when narrowing dropped a Space the caller still wanted: save locally, warn, let a later save publish. Stops one device's incomplete storage truncating everyone's list. |
| `227db74d1` | A held save must not advance `config.timestamp`. `getConfig` resolves purely by timestamp and never merges the losing side, so a holding device would treat its own config as newer than every remote one and silently stop applying other devices' changes. |

**`quorum-mobile` — branch `fix/mobile-space-removal-publishes`** (stacked on
`fix/config-save-filter-wipes-local-spaces`)

| commit | what |
|---|---|
| `a0573c1` | Same `uploadConfig` separation as desktop. Mobile's `saveConfig` calls `saveLocalUserConfig(config)` at the end, so the narrowing was corrupting mobile's stored list too. |
| `3a03b6f` | **Reverted** the refuse-to-publish guard on mobile. See the ordering constraint in §4 — it would have wedged mobile's config sync permanently. |
| `df6b198` | Leaving, deleting or being kicked from a Space now writes the removal into the synced config, via one new `removeSpaceFromConfig` helper. This is what makes the mobile → desktop row in §2 green. |

**Not fixed by any of the above:** the desktop → mobile and mobile → mobile rows, and the
ghost rows both platforms leave in local storage after a removal.

### Accepted limitation of the desktop guard (`31bd214d4`) — know this before debugging

Nothing retries a held save. The action-queue handler only retries on a thrown error, and
the hold resolves normally, so the queue records success and never revisits it. "A later
save publishes it" is passive: it depends on some unrelated user action calling
`saveConfig` again after the missing Space finally syncs.

For a Space that can *never* be keyed — a bloated encryption state (#108), or one never
synced to this device — that means the device stops publishing **any** config change
(settings, mutes, bookmarks, profile) until the Space syncs or is removed. It fails safe
(stale settings) rather than destructive (lost Spaces), and the
`[ConfigService] NOT publishing` warning makes it visible instead of silent, but it is a
real dead end: `useSpaceRecovery` cannot clear it either, because it only re-adds Spaces
orphaned *out* of `spaceIds`, not Spaces still listed there that lack keys.

Slice 2's tombstones remove the dead end by making such a Space explicitly deletable.

## §4. The three things a fresh agent will otherwise rediscover the hard way

**1. The mobile kick path wrote to an orphaned store.** Before `df6b198`,
`context/WebSocketContext.tsx` did try to prune `config.spaceIds` when the user was
kicked — but through `mmkvAdapter`, whose user-config helpers use MMKV instance
`quorum-cache` and key prefix `userConfig:` (`services/storage/mmkvAdapter.ts:31,198-205`),
while the real synced config lives in instance `quorum-config` under `user_config:`
(`services/config/configService.ts:42,47`). Different database, different key. Nothing
else writes that key, so on a device's first kick the read returned `undefined` and the
whole cleanup block was skipped. Fixed, but the two-store split still exists — do not
reach for `adapter.getUserConfig` / `adapter.saveUserConfig` for anything config-related.

**2. Ordering constraint: the write side MUST land before any refuse-to-publish.** The
desktop guard (`31bd214d4`) is safe there because a deliberate removal takes the Space out
of `config.spaceIds` *before* `saveConfig` runs, so nothing is dropped by narrowing. That
premise was false on mobile until `df6b198`: a left Space kept its id with its keys
deleted, permanently unkeyable, so the guard would have held **every** publish forever and
the device would have silently stopped syncing any config change. Tried and reverted the
same day. Correct order: write side → tombstones + reconciliation → port the guard.

**3. "Absent from config" is overloaded and must never drive a purge.** Desktop's Restore
Spaces tool (`useSpaceRecovery.ts:47`) treats "in the DB but not in the config" as
*lost, re-add it*. Naive reconciliation would treat the identical set as *deleted, purge
it*. They contradict. This is why the agreed fix is explicit `deletedSpaceIds` tombstones
and never inference from absence — it also makes reconciliation safe against a partial or
failed config fetch.

## §5. What is left, and what needs the lead

The remaining work is **the receive side on both platforms**, already designed but not
implemented:

- `quorum-desktop/.agents/tasks/2026-07-19-space-deletion-ghost-cleanup.md` — the owning
  task. Five slices; Slice 2 (`deletedSpaceIds` tombstones + purge only tombstoned ids) is
  the one that makes the lists converge. Slices 1/3/4/5 cover offline leave via the action
  queue, corrupted-space deletion, reconciling the Restore button, and bounding encryption
  state history.
- Mobile mirrors that contract, **plus** it needs its list to become config-aware, or a
  tombstone purge of local storage — otherwise a removal still cannot reach mobile's
  screen. This is the mobile-specific half and is not in the desktop task.

**Needs a decision before implementation:**

1. `deletedSpaceIds` is an additive `UserConfig`/wire change shared by both apps and
   typed in `quorum-shared`. The owning task says to confirm it with the lead alongside
   the encryption-state bloat issue (#108). Keep it strictly optional-typed so a client
   that has not shipped its side cannot break.
2. Tombstone retention. The existing `deletedBookmarkIds` pattern clears tombstones right
   after one successful sync, which means a device offline longer than that never sees
   them. Harmless for bookmarks, resurrection for Spaces. The retention window must be
   agreed across both apps.
3. Whether mobile's Spaces list should become config-driven (matching desktop) or stay
   storage-driven with a tombstone purge. This is an architecture call, not a detail — it
   decides how much of the mobile list code changes.

## §6. Document index

Everything below is a symptom, a cause, or a design for the above. Statuses live in the
linked docs, not here.

### The work itself

| doc | covers |
|---|---|
| `quorum-desktop/.agents/tasks/2026-07-19-space-deletion-ghost-cleanup.md` | **The owning task.** 5 slices, design agreed. Tombstones, offline leave, Restore-button conflict. Cross-repo contract notes. |
| `quorum-mobile/.agents/bugs/2026-07-19-config-sync-add-only-deleted-spaces-linger.md` | Mobile side: add-only receive + the write-side gap + (added 2026-07-31) the orphaned-store kick path and the ordering constraint. **Gitignored — content restated in §2/§4 here.** |
| `quorum-desktop/.agents/bugs/2026-01-09-config-sync-space-loss-race-condition.md` | The original data-loss race: `saveConfig` filter-and-overwrite deleting Spaces. Partially fixed 2026-07-31 (§3); its Option A merge is Slice 2 of the owning task. |

### Adjacent, do not confuse with the above

| doc | covers | relationship |
|---|---|---|
| `quorum-desktop/.agents/tasks/transport/2026-07-31-dm-fix-shipped-confirm-and-measure-spaces.md` | Whether messages **sent into** a Space actually arrive (WebSocket transport / send durability). | **Different layer, same word.** That one is about message *delivery*; this one is about which Spaces appear in the *list*. A fix in either has no bearing on the other. Both dated 2026-07-31, so check which you actually want. |
| `quorum-mobile/.agents/bugs/2026-06-22-userconfig-blob-not-live-synced-cross-device-master.md` | Umbrella for config **staleness** — no live refetch trigger; the blob only re-pulls on restart or incidental UI paths. | Different axis. That doc explicitly says **do not fold the space-loss work in**. A live refetch would make convergence *faster*; it would not make it *correct*. |
| `quorum-desktop/.agents/bugs/2026-06-13-config-not-refetched-stale-until-restart.md` | The desktop half of the staleness umbrella. | Same — adjacent, not this. |
| `quorum-mobile/.agents/bugs/2026-07-19-new-desktop-space-appears-one-launch-late-on-mobile.md` | New Space invisible on mobile until the next launch. | The *add* path's latency. Small and independent. |
| `quorum-desktop/.agents/bugs/2025-12-09-encryption-state-evals-bloat.md` | ~2MB per created Space; pushes the config toward the upload limit. | Compounds everything here — a Space whose state is bloated can never be keyed, which is exactly the permanently-unkeyable case §4.2 warns about. Ghost Spaces multiply it. |

### Code entry points

| what | where |
|---|---|
| Desktop config sync | `quorum-desktop/src/services/ConfigService.ts` — `getConfig` (add-loop `:110`, verbatim apply `:376`), `saveConfig` (narrowing + guard `:429-509`) |
| Desktop list rendering | `quorum-desktop/src/hooks/business/folders/useNavItems.ts:49-53` (config-driven), `src/components/space/SpacesSidebar.tsx` |
| Desktop removal paths | `SpaceService.ts:675` (delete/leave), `MessageService.ts:5088` (self kicked) |
| Desktop recovery tool | `quorum-desktop/src/hooks/business/user/useSpaceRecovery.ts` (Settings → Data Recovery) |
| Mobile config sync | `quorum-mobile/services/config/configService.ts` — `getConfig:342`, `saveConfig:587`, `removeSpaceFromConfig` (new 2026-07-31) |
| Mobile list rendering | `quorum-mobile/app/(tabs)/spaces/index.tsx` → `hooks/chat/useSpaces.ts` (storage-driven) |
| Mobile removal paths | `hooks/chat/useSpaceSettings.ts` (`useDeleteSpace`/`useLeaveSpace`), `context/WebSocketContext.tsx` (kicked) |
| Shared wire type | `quorum-shared/src/types/user.ts` — `UserConfig`, `NavItem` |

## §7. How to check the real behaviour

Unit tests cover the publish/narrowing logic on both platforms
(`quorum-desktop/src/dev/tests/services/ConfigService.unit.test.tsx`,
`quorum-mobile/__tests__/configSpaceListPublish.test.ts`). They do **not** cover the hook
wiring on mobile — `useDeleteSpace`/`useLeaveSpace`/the kicked handler calling
`removeSpaceFromConfig` is verified only by typecheck and reading, because the repo has no
React Native hook-render setup.

The behaviours that matter are two-device and must be checked on real devices:

1. Leave a Space on mobile → it disappears from desktop. *(should pass since `df6b198`)*
2. Leave a Space on desktop → it disappears from mobile. *(expected to FAIL until the
   receive side lands — this is the headline gap)*
3. Join a Space on either → it appears on the other. *(passes; mobile may need one
   relaunch)*
4. Partial/failed config fetch removes nothing anywhere. *(the safety property that must
   never regress)*

Note for (2): a desktop receiver re-pulls the config whenever any DM is opened, so use
that instead of restarting — see the staleness umbrella in §6.

---

*Created 2026-07-31 to give the Spaces-list work one entry point. Consolidates findings
from the 2026-07-31 space-loss investigation with the four pre-existing docs listed in §6.*

*Last updated: 2026-08-04*
