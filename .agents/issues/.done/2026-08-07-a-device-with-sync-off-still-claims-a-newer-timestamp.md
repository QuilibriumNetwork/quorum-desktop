---
type: bug
title: "A device with sync off still advances its config timestamp, so turning sync on can wipe your other devices"
status: done
priority: high
ai_generated: true
created: 2026-08-07
updated: 2026-08-07
severity: silent data loss between a user's own devices, triggered by the ordinary act of enabling a setting
area: config sync / timestamp authority / multi-device
repos: quorum-desktop + quorum-mobile
related:
  - ".agents/issues/.open/2026-08-07-config-sync-overhaul-design.md"
  - ".agents/issues/.open/2026-08-05-config-merge-lists-are-asymmetric-between-desktop-and-mobile.md"
  - ".agents/docs/config-sync-system.md"
---

# A device with sync off still claims a newer timestamp

## Status

**2026-08-07 — shipped in desktop #320 and mobile #243**
(`fix: a device that never published can no longer overwrite the ones that did`).

What landed: every path that does not reach the server now restores the timestamp
it came in with, on both clients — sync off (both), no keypair and failed POST
(mobile), plus desktop's `getDefaultUserConfig`, which stamped the clock and so
let a device that had published nothing outrank the account's real config.
Mobile's enable-sync path now pulls before it publishes, via a new `setAllowSync`
in the service. Each fix was reverted independently and confirmed to turn its
tests red, with a control arm that stayed green throughout. Desktop 1133 tests,
mobile 631, both typecheck clean.

**2026-08-07 — verified on two real devices and closed.** A physical Android
phone and the desktop app on one account, captured with
`adb logcat -v time ReactNativeJS:V '*:S'`. Four of the five fixed paths are now
MEASURED in the field, not inferred. Evidence in Verification below.

## Symptom

Turning sync **on** for the first time on a device that has been in use can
silently overwrite newer configuration on the user's other devices: Spaces list,
nav folders, notification settings, mutes, favourites and profile fields.

There is a second symptom, present today and easier to hit than the first: **a
device with sync off stops receiving.** From its first local edit it is
permanently "newer" than the server, so it discards every remote config
unopened. The user did nothing unusual in either case.

## The mechanism

`saveConfig` stamps a fresh timestamp **before** it checks whether it is allowed
to publish, and then writes that timestamp to local storage whether or not
anything was uploaded.

| | Desktop | Mobile |
|---|---|---|
| Stamp `timestamp = Date.now()` | `ConfigService.ts:521-522` | `configService.ts:650-652` |
| Gate on `allowSync` | `:524` | `:662` / `:673` |
| Save locally regardless | `:711` (`saveUserConfig(config)`) | `:857` (`saveLocalUserConfig(config)`, comment: "Always save locally") |

So **every local change on a device with sync off advances that device's
timestamp**, even though nothing was published and the server never agreed.

Inbound resolution is purely by that timestamp, with the loser discarded rather
than merged (`ConfigService.ts:71-78`, mobile `:427`/`:437` — same shape).

### The failure, end to end

1. **Device A**, sync on, in daily use. Publishes normally. The server blob's
   timestamp only advances when A publishes.
2. **Device B**, sync off, also in use. Its local timestamp advances on every
   local change, unpublished and unwitnessed. It drifts *ahead* of the server —
   and from that moment stops adopting anything A publishes.
3. The user enables sync on **B**.
4. On desktop, `useUserSettings` calls `getConfig()` first
   ([useUserSettings.ts:350](../../../src/hooks/business/user/useUserSettings.ts#L350)),
   which is the right instinct — but `getConfig` compares timestamps and B's
   local one is higher, so `savedConfig.timestamp < storedConfig.timestamp` holds
   at [`ConfigService.ts:71`](../../../src/services/ConfigService.ts#L71) and it
   **returns the local config, discarding the remote entirely.**
5. B then publishes that local config with a fresh `Date.now()`.
6. **Device A** pulls, sees a newer timestamp, and adopts B's config verbatim
   (`:417`). Everything A had that B did not is gone.

The blast radius is the set of fields with no explicit merge: `spaceIds`,
`items`, `spaceKeys`, `notificationSettings`, `mutedChannels`,
`mutedConversations`, `favoriteDMs`, and the profile fields. `bookmarks`,
`userNotes`, `deviceNames` and `conversationSettings` are protected on desktop by
their merge blocks; mobile protects only `bookmarks` and `conversationSettings`
(see [the merge-asymmetry issue](../.open/2026-08-05-config-merge-lists-are-asymmetric-between-desktop-and-mobile.md)).

## Corrections to the first draft of this issue

Verified against the code on 2026-08-07. Three things the first draft got wrong
or missed, recorded because they changed the fix.

**Refuted — desktop was not starting from zero.** The draft said *"Desktop has no
equivalent restore at all, in either path."* It does, at
`ConfigService.ts:652-659`, with the same comment and the same rule, landed
2026-07-31 in commit `4a04a8b24` (PR #282). Desktop's gap was the same single
gap mobile had, not a total absence. The rule was already agreed on both
clients; only its coverage was short.

**Missed — a third broken path on mobile.** The POST-failure `catch`
(`configService.ts:844-853`) falls through to the local save with the advanced
timestamp still set. The warning immediately above it names this exact
consequence ("the local copy keeps a fresh timestamp — the cross-device 'nothing
syncs' black hole") and it was never acted on. One transient 413 or 400 makes a
device deaf to every other device permanently, long after the request that
caused it.

**Missed — the pull is not gated on `allowSync` on either client.** "Sync off"
means publish-off, not receive-off. That is what turns the drift into the second
symptom above: a sync-off device would otherwise keep quietly catching up, and
instead goes permanently deaf after one local edit.

*Decided 2026-08-07: always-pull is correct and stays.* Both clients present this
as a **privacy** setting whose stated cost is metadata visibility — desktop:
*"increases metadata visibility of your account, which can reveal when you have
joined new Spaces"*; mobile: *"Increases metadata visibility."* Publishing is
what creates that trail; reading the blob creates none. So gating the download
would cost the user freshness and buy no privacy. Sync off means "don't
broadcast from this device", not "isolate this device".

**Missed — desktop's default config claims authority it has not earned.**
`getDefaultUserConfig` stamped `timestamp: Date.now()` (`src/utils.ts:21`);
mobile has always used `0`. A desktop device that has published nothing and read
nothing therefore outranked the account's real blob at `ConfigService.ts:71`,
discarded it unopened, and on enabling sync published an **empty** config over
every other device. Same catastrophic outcome as the drift, reached without any
drift at all, and it fires through `RegistrationPersister.tsx:226-232` — which
persists that default exactly when the remote config could not be verified or
decrypted, i.e. when claiming authority is most destructive. Now `0` on both.

**Missed — mobile's enable-sync path never pulls first.**
`useUserConfig.ts:94` → `updateConfig` (`configService.ts:866-874`) reads only
`getLocalUserConfig` and publishes it. Desktop pulls first
(`useUserSettings.ts:350`); mobile did not. The timestamp fix alone does not
close this: when the user flips sync on, the device genuinely publishes and so
genuinely earns a fresh timestamp — a *correct* timestamp on a *stale* picture,
which the other devices then adopt. Fixed separately, below.

**Deliberately not changed — desktop's POST failure.** Desktop's `saveConfig`
has no try/catch, so a failed POST throws and `:711` never runs: the change is
lost locally rather than mis-timestamped. That is a different defect, and
[useUserSettings.ts:428-432](../../../src/hooks/business/user/useUserSettings.ts#L428-L432)
deliberately relies on the throw to roll back a public-profile publish. Making
desktop match mobile here needs its own issue.

## The rule this violates is already written in our own code

Mobile stated the principle in a comment at `configService.ts:790-796`:

> *"Keep the timestamp we came in with. getConfig resolves purely by timestamp
> and never merges the losing side, so a device that advanced its local timestamp
> without the server agreeing would treat its own config as newer than every
> remote one and quietly stop applying other devices' changes for as long as it
> kept holding. **Publishing is what earns the right to a newer timestamp.**"*

Both clients applied it to exactly one of the four paths that needed it. This is
not a new principle to invent.

## Fix (as shipped on the branch)

**Every path that does not reach the server restores the timestamp it came in
with.** The local write stays unconditional — the user's change must still
persist. Only the *claim to authority* is withheld.

**Desktop** ([`ConfigService.ts`](../../../src/services/ConfigService.ts)):
- Capture `incomingTimestamp` before stamping (`:525`).
- Restore it on the `!allowSync` path (new `else` branch).
- Reuse it in the refuse-to-publish branch, replacing the inline
  `configInput.timestamp ?? 0` — same value, one named source.

**Mobile** ([`configService.ts`](../../../../quorum-mobile/services/config/configService.ts)):
- Restore on `!allowSync` and on `!privateKey || !publicKey`.
- Restore in the POST-failure `catch`, guarded by a `published` flag set
  immediately after the POST returns. A throw from the bookkeeping *after* a
  successful POST must not be mistaken for a failed publish — the server already
  holds that timestamp, and withdrawing it locally would make the device pull
  its own config back.

**Desktop, additionally** ([`src/utils.ts`](../../../src/utils.ts)):
- `getDefaultUserConfig` now stamps `timestamp: 0`, matching mobile. A config
  that has published nothing has earned no timestamp — the same rule, applied to
  the one place that fabricated one out of the clock.

**Mobile, additionally** — new `setAllowSync(address, enabled)` in
[`configService.ts`](../../../../quorum-mobile/services/config/configService.ts),
called by `useUserConfig`:
- Enabling sync pulls before it publishes, matching desktop. Turning sync *off*
  publishes nothing and needs no pull. A failed pull falls through to the
  previous behaviour rather than blocking the toggle.
- Deliberately in the **service**, not the settings hook. This is a property of
  the sync protocol, not of a screen, and a second caller toggling `allowSync`
  through `updateConfig` directly would silently reintroduce the wipe. That is
  precisely how the timestamp rule came to cover one of its four paths.

### The trade-off, stated honestly

With this fix, local changes made while sync was off will **lose** to the synced
state when sync is turned on. That is a real cost and users may notice it.

It is still strictly better than today, because today it is not only the offline
device's *changes* that win — its entire picture wins, **including everything
missing from it.** Losing edits you made offline is recoverable and
comprehensible; losing Spaces and settings on a device you were not even touching
is neither.

The complete answer is per-field merge (P6 in
[the config sync overhaul](../.open/2026-08-07-config-sync-overhaul-design.md)), which lets
both sides survive. This fix removes the worst case cheaply while that is built.

## Verification

**MEASURED** — tests written to fail, confirmed red on revert, then restored:

- [x] Desktop `ConfigService.unit.test.tsx` §4b: timestamp withheld when sync is
      off; no drift across repeated offline saves; **the device still adopts a
      newer remote config after an offline save** (the end-to-end failure, in
      miniature).
- [x] Desktop §4b: a fresh device claims no authority (`timestamp` 0) and adopts
      the account config even when the remote is older than the clock.
- [x] Mobile `configSpaceListPublish.test.ts`: timestamp withheld on all three
      non-publishing paths (sync off, no keypair, failed POST).
- [x] Mobile `setAllowSync`: the pull is asserted to happen **before** the
      publish (via `invocationCallOrder`, so it tests ordering rather than mere
      occurrence); no pull when disabling; the toggle still works offline.
- [x] **Control arm on both**: a config that reaches the server *does* advance
      the timestamp, and the stored value matches what the server was told. This
      stayed green across the revert — the assertions are not simply
      "timestamps never advance".
- [x] **Revert confirms red**, each fix reverted independently. Desktop
      timestamp restore: 4 failures. Desktop default timestamp: 1 failure.
      Mobile restores: 4 failures. Mobile pull-before-enable: 1 failure. Mobile's
      pre-existing refuse-to-publish test stayed green throughout, confirming
      only the new behaviour was neutralised each time.
- [x] The user's local change still persists when sync is off — asserted
      alongside every withheld-timestamp case, not assumed.
- [x] Full suites green: desktop 1133, mobile 631. Both typecheck clean.

**MEASURED ON DEVICE 2026-08-07** — physical Android phone + desktop, one
account, captured with `adb logcat -v time ReactNativeJS:V '*:S'`.

- [x] **A sync-off write does not advance the timestamp.** Toggled delivery
      receipts with sync off at `14:22:53` (`NOT publishing — allowSync is off`),
      then force-closed and reopened the app. New PID, and the startup pull read
      `pull: UP TO DATE (ts=1786024351822)` — byte-identical to before the write.
      `UP TO DATE` only prints when remote equals local, so the local value
      provably had not moved.

- [x] **A sync-off device keeps receiving — with a discriminating ordering.**
      Desktop published `1786106043764` at ≈`14:34:06`; the phone made a local
      change *after* that, at `14:29:06`/`14:31:03`; the next pull still read
      `TOOK REMOTE … (local was <the older value>)`. This is the arm that matters:
      under the old code the phone would have stamped itself *later* than
      desktop's publish, outranked it, and printed `KEPT LOCAL` — going deaf
      permanently. The old code cannot produce the observed line.

- [x] **A failed POST does not advance the timestamp — observed in the wild, not
      staged.** At `14:35:32` a 4.35 MB upload hit
      `settings POST FAILED … Request timeout`. The next pull at `14:35:48` read
      `TOOK REMOTE`, not `KEPT LOCAL`. This is the exact "black hole" the mobile
      warning describes, and before the fix this single ordinary timeout would
      have stopped that phone applying any other device's config permanently.

- [x] **Enabling sync does not wipe the other device.** The phone was
      deliberately left stale (no restart) while desktop published; sync was then
      enabled. The phone pulled before publishing (`TOOK REMOTE` at `14:35:48`,
      then `published ts=1786106119904` at `14:36:01`, `server read-back CONFIRMS`),
      and desktop was checked afterwards with **nothing lost**.

- [x] The user's local change still persists when sync is off — every held save
      in the run wrote through; only the timestamp was withheld.

- [x] Incidental: per-field `conversationSettings` merge survived every adoption
      (`remote=3 merged=3` on all four pulls).

**Not covered, and accepted:** the no-keypair path. It is the same one-line
restore as the other three, is exercised by a unit test, and cannot be staged on
a real device without breaking the keystore.

### Notes from the device run worth keeping

**The old behaviour was never reproduced**, because the fix shipped first. What
was done instead is stronger than a demonstration would have been: the run was
arranged so the *ordering* of timestamps makes the old code's output impossible,
and the observed line is the one only fixed code can print. Recorded plainly so
nobody later reads this as a before/after A/B that it was not.

**A long in-flight save racing a pull can roll back that pull's adoption.** At
`14:35:19` a pull adopted `1786106043764`; the save that failed at `14:35:32` had
read its config *before* that pull, so its restore wrote the older value back and
the device re-pulled at `14:35:48`. Harmless and self-healing, and it is a
property of `saveConfig` persisting the caller's whole config at the end, not of
this fix. Worth knowing: the fix makes that rollback **benign** — without it the
rollback would have carried a fresh timestamp and become authoritative.

**Two findings sent elsewhere rather than filed as new issues:** the 4566 KB
accepted payload and the `Request timeout` failure mode went into
[the size-guard issue §6-A-bis](../.open/2026-08-05-config-upload-has-no-size-guard-and-fails-silently-on-mobile.md),
which already owns that question and whose limit bracket this measurement
changes.

## Prevention

**"Publishing earns the timestamp" should be stated once, in
`quorum-shared`, and applied by both clients** rather than living as a comment
inside one branch of one client. It was correct, it was written down, and it
still did not reach the other three code paths that needed it — including one
whose own warning message described the consequence.

That is the sharpest lesson here: a rule recorded as a comment at the site that
obeys it is invisible from the sites that don't. The comment was not too vague;
it was in the wrong place to be found.

More generally: any field that decides *authority* between devices must only
advance when the authority is actually witnessed. A local write is not a witness.

---

*Last updated: 2026-08-07*
