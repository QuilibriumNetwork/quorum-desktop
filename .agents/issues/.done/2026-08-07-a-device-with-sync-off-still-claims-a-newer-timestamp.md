---
type: bug
title: "A device with sync off still advances its config timestamp, so turning sync on can wipe your other devices"
status: in-progress
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

**Deliberately left open, not moved to `.done/`.** The mechanism is verified in
code and in tests; the **user-facing consequence has never been observed on two
real devices**, and the four device checks below are still unticked. A `type: bug`
does not close on a green suite alone when its own verification plan asks for a
reproduction. Close it after the device run, or after the second symptom is
confirmed gone in ordinary use.

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
   ([useUserSettings.ts:350](../../src/hooks/business/user/useUserSettings.ts#L350)),
   which is the right instinct — but `getConfig` compares timestamps and B's
   local one is higher, so `savedConfig.timestamp < storedConfig.timestamp` holds
   at [`ConfigService.ts:71`](../../src/services/ConfigService.ts#L71) and it
   **returns the local config, discarding the remote entirely.**
5. B then publishes that local config with a fresh `Date.now()`.
6. **Device A** pulls, sees a newer timestamp, and adopts B's config verbatim
   (`:417`). Everything A had that B did not is gone.

The blast radius is the set of fields with no explicit merge: `spaceIds`,
`items`, `spaceKeys`, `notificationSettings`, `mutedChannels`,
`mutedConversations`, `favoriteDMs`, and the profile fields. `bookmarks`,
`userNotes`, `deviceNames` and `conversationSettings` are protected on desktop by
their merge blocks; mobile protects only `bookmarks` and `conversationSettings`
(see [the merge-asymmetry issue](.open/2026-08-05-config-merge-lists-are-asymmetric-between-desktop-and-mobile.md)).

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
[useUserSettings.ts:428-432](../../src/hooks/business/user/useUserSettings.ts#L428-L432)
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

**Desktop** ([`ConfigService.ts`](../../src/services/ConfigService.ts)):
- Capture `incomingTimestamp` before stamping (`:525`).
- Restore it on the `!allowSync` path (new `else` branch).
- Reuse it in the refuse-to-publish branch, replacing the inline
  `configInput.timestamp ?? 0` — same value, one named source.

**Mobile** ([`configService.ts`](../../../quorum-mobile/services/config/configService.ts)):
- Restore on `!allowSync` and on `!privateKey || !publicKey`.
- Restore in the POST-failure `catch`, guarded by a `published` flag set
  immediately after the POST returns. A throw from the bookkeeping *after* a
  successful POST must not be mistaken for a failed publish — the server already
  holds that timestamp, and withdrawing it locally would make the device pull
  its own config back.

**Desktop, additionally** ([`src/utils.ts`](../../src/utils.ts)):
- `getDefaultUserConfig` now stamps `timestamp: 0`, matching mobile. A config
  that has published nothing has earned no timestamp — the same rule, applied to
  the one place that fabricated one out of the clock.

**Mobile, additionally** — new `setAllowSync(address, enabled)` in
[`configService.ts`](../../../quorum-mobile/services/config/configService.ts),
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
[the config sync overhaul](.open/2026-08-07-config-sync-overhaul-design.md)), which lets
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

**NOT YET OBSERVED** — the remaining work before this closes:

- [ ] **Reproduce on two real devices.** Device A with sync on and several
      Spaces. Device B with sync off, then make local changes on B (rename a
      folder, mute a channel). Enable sync on B. Confirm A loses state on its
      next pull. Capture the timestamps on both sides.
- [ ] **Control arm.** Repeat with B's local timestamp *behind* the server's
      (make no local changes on B before enabling). A should be unaffected. If
      both arms lose data, the instrument is measuring something else.
- [ ] After the fix: repeat run 1. B should adopt A's config on enable, then
      publish the merged result. A keeps everything.
- [ ] Confirm the second symptom directly: a sync-off device that made one local
      edit should now still pick up a change made on the other device.

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
