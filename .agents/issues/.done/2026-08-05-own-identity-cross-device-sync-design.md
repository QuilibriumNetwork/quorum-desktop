---
type: task
title: "Your own identity, on your own devices: give it one author"
status: done
priority: high
created: 2026-08-05
updated: 2026-08-11
area: identity resolution / config sync / cross-device / desktop-mobile parity
repos: quorum-desktop now; quorum-shared + quorum-mobile only if Phase 2 is triggered
related:
  - ".agents/issues/2026-08-10-identity-resolution-architecture-design.md (supersedes the READ side of this doc — see the 2026-08-11 note)"
  - ".agents/issues/2026-08-10-identity-resolution-architecture-plan.md"
  - ".agents/issues/.open/2026-08-04-desktop-shows-a-stale-name-everywhere-except-the-user-settings-field.md (the bug this came from, with the 2026-08-05 measurement)"
  - ".agents/issues/.open/2026-08-01-per-space-override-does-not-reach-your-own-other-devices.md"
  - ".agents/issues/.open/2026-06-13-config-not-refetched-stale-until-restart.md"
  - ".agents/issues/.open/2026-08-05-config-upload-has-no-size-guard-and-fails-silently-on-mobile.md"
  - ".agents/issues/.open/2026-08-05-config-merge-lists-are-asymmetric-between-desktop-and-mobile.md"
  - ".agents/issues/.open/2026-08-05-roster-sync-has-no-self-exclusion-a-peer-can-overwrite-your-own-row.md"
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
---

# Your own identity, on your own devices

## Status

**CLOSED 2026-08-11. Both phases are resolved and this document has no work of
its own left.** Phase 1 shipped in PR #313 and was device-verified; Phase 2 was
killed by measurement rather than built. It is retained as the record of both.

Three Definition-of-Done items were still unticked when this closed. All three
were checked against the code on 2026-08-11 rather than assumed:

- **The `saveSpaceMember` instrument** this document asked for (see §7's ⚠️ note)
  **exists and is wired in**: `src/utils/selfOverrideTripwire.ts`, called from
  `saveSpaceMember` in `src/db/messages.ts`, with its own test. Device-verified
  clean on the reporter's account.
- **`identity-resolution-and-profile-sync.md` was corrected** — it now states
  outright that stamped rows were "neither decaying nor legacy".
- **`config-sync-system.md` was NOT corrected, and has been now.** Its
  "Encryption State Filtering" section claimed the filtering exists "to prevent
  server validation errors", which is false: the whole config is AES-GCM
  encrypted before upload, so the server only ever sees ciphertext (§4 of this
  document). Fixed 2026-08-11.

**What remains open is verification, and it belongs to the bug, not here.** The
two outstanding device checks — the notifications drawer, and other members
rendering normally in a busy space — live on
`2026-08-04-desktop-shows-a-stale-name-everywhere-except-the-user-settings-field.md`,
which is `type: bug` and will not close without them. Holding this design open as
a second copy of those checks tracked nothing extra.

> ### 2026-08-11 — the READ side of this document has been superseded
>
> `2026-08-10-identity-resolution-architecture-design.md` and its plan rebuilt
> how a name is *resolved*: one provider keyed on `(address, spaceId?)`, one
> `<MemberName>` / `useResolvedName` API, and a lint rule that stops anything
> outside `src/identity/` resolving a name at all.
>
> **That is a different axis from this document, which is about who *authors*
> your identity and whether it reaches your other devices.** Phase 1 stands as
> shipped, Phase 2 stays dead, and the privacy argument in §4 is untouched. The
> Phase 1 artifacts are still on disk and still running: `useReconcileSelfIdentity.ts`,
> `useClearLegacySpaceOverrides.ts`, and `spaceProfilePayload.ts:96`'s presence
> semantics (READ 2026-08-11).
>
> Three parts are now stale and are marked inline where they appear:
>
> - **§5-C-ii is dead.** `src/utils/resolveGlobalSender.ts` no longer exists
>   (deleted 2026-08-10 in `f647895a8`, absorbed by the identity provider).
>   There is no `buildGlobalSenderMap` left to teach.
> - **§5-E is no longer the checklist.** Its surfaces are covered structurally
>   now rather than site by site.
> - **§7's notification-drawer item** describes an outcome that still matters
>   and a mechanism that no longer exists.
>
> One surface §5-E named specifically is still worth an action, just not the one
> it describes: `useSearchResultDisplayDM.ts` was found to be **dead code** (no
> call site in `src/`) during the 2026-08-11 audit tranche, so it is a deletion,
> not a resolver fix.

**2026-08-05 — Phase 1 shipped in PR #313. Phase 2 killed by measurement, not
built.** Kept open only for the two outstanding device checks in
`2026-08-04-desktop-shows-a-stale-name-everywhere-except-the-user-settings-field.md`.

Phase 1 landed as specified, plus three fixes this document did not foresee: the
tag rebroadcast was a second ungated broadcast site, the migration's `await`
guaranteed nothing because the send queue is fire-and-forget, and the legacy
`sync-members` path had no self-exclusion. All three came from independent review
rather than from re-reading.

**Phase 2 is dead — see §6.** Its premise was that channel C cannot carry per-space
overrides between a user's own devices. A device test showed it can, live, which is
better than the config blob would have managed. The design is retained as the
record of a decision **not** taken.

One correction this document made about itself, worth keeping: it claimed the
on-connect announce needed no change because the clear would starve it. A passing
test in the repo proved otherwise — `''` and "absent" produced identical wire
output, so the clear could never leave the device. That was the third confident
reading of this subsystem falsified in a day, and the first two were already
recorded here when it was written.

## §1. The problem in one sentence

**The system has no way to know which name you actually chose**, so it cannot tell
a name you picked for a space from a copy of an old global name — and every attempt
to fix the symptom has tried to infer that difference from the data rather than
recording it.

## §2. What is true today (MEASURED / READ, 2026-08-05)

Your own identity lives in **three** stores, and each rendering surface picks one:

| store | syncs across your devices? | who reads it |
|---|---|---|
| `localStorage['passkeys-list']` | **never** — written only by this device's own save | NavRail avatar + tooltip, DM self entry, join-time roster stamp |
| `UserConfig` blob (channel A) | yes, on startup and several ordinary actions | the User Settings field, and nothing else |
| `space_members[self]` roster row (channel C) | reaches other members live | message authors, member lists, mention pills, reactions, threads, pinned messages, your own profile card, the global notification panel |

Two consequences, both measured:

1. A rename made on another device **cannot** reach the localStorage store. It has
   no writer on the receive side. Not lag — no path at all.
2. The roster **override** slot outranks everything, in every case, and the
   on-connect announce **re-sends and re-stamps it on every connect**. So a stale
   value does not decay; it is actively refreshed, and after the first announce it
   is byte-for-byte identical to a deliberate choice.

Full evidence, including the five-space measurement, is in the bug file's §4-A.

## §3. What we are NOT doing, and why

**Not making the config blob the sole author.** This was the original proposal.
Three independent reviews found two problems with it and both are real:

- The blob is **not live**. It re-pulls on startup and incidental triggers. The
  roster broadcast is live. Cutting per-space identity over to the blob would turn
  an instant update into a restart-gated one, which reads as a regression.
- The cutover is **unsafe during version skew**. If a new desktop trusts only the
  blob while the phone is on an old build, an edit made on the phone reaches the
  roster and never the blob, so desktop shows a **wrong** name indefinitely, with
  no self-heal until the phone updates. Mobile's own history makes this concrete:
  its last identity fix merged 2026-08-02 and the last build shipped 2026-07-31.

**Not touching the wire format.** The `join` control keeps carrying the joiner's
name; it is load-bearing bootstrap for members who would otherwise have no row.
What changes is which **slot** a receiver files it under.

**Not putting per-space avatars in the blob.** MEASURED: the blob is 873 KB against
a ~1 MB working ceiling, and five per-space avatars would add ~248 KB.

**Not fixing "other members show as a truncated address".** Different problem, the
P2P roster pull, documented in the identity doc. Testing this work against that
symptom would read as a failure.

## §4. Privacy — checked, and it does not get worse

READ, `ConfigService.saveConfig`:

- The **entire** config object is AES-GCM encrypted on-device (key derived from the
  user's Ed448 private key) before upload. The POST carries only `user_address`,
  `user_public_key`, the ciphertext, a timestamp and a signature. **The server sees
  no config field in plaintext.**
- `spaceIds`, `items` and `spaceKeys` — the latter holding the actual **private
  keys and encryption states** for every space — are already inside that blob. So
  the space list this addition is keyed by is already present, beside far more
  sensitive material, and the addition discloses no *new category* of information.

  > Stated precisely, because the loose version is nearly circular: "it is inside an
  > encrypted blob, so it reveals nothing" would license adding anything at all. The
  > real argument is narrower — the **keys** of the new map are space IDs already
  > present in the same blob, and its **values** are names the user already
  > broadcasts in plaintext to every member of that space. The only genuine
  > incremental exposure is ciphertext length, addressed next.
- Metadata: ciphertext length is visible. A few hundred bytes per space is noise
  against 160 KB of space keys and 656 KB of bookmarks, and the "how many spaces"
  signal already exists more strongly.
- With `allowSync` off, nothing is encrypted or uploaded at all; the feature stays
  local.
- Direction of travel: a per-space nickname today lives in the roster, readable by
  **every member of that space**. A copy in your own encrypted blob is the *least*
  exposed of the three channels.

Caveat stated honestly: this is a reading of what the client sends, not a server
audit.

## §5. Phase 1 — the desktop fix (do this now)

Desktop-only. No wire change, no `quorum-shared` change, no mobile dependency, no
publish. This is what makes your name correct everywhere.

### 5-A. Self surfaces read the synced value

Stop treating the localStorage passkey record as an identity source. Reconcile it
from the config blob when the config loads, so every existing reader converges with
no call-site changes.

The write already exists and is proven: `useUnifiedOnboardingFlow.ts:200-247` and
`:261-369` already fetch the remote config and write `decryptedConfig.name` into the
passkey record — they are just gated to un-onboarded and post-import devices. Reuse
that, do not invent a second mechanism.

Keep the passkey value as a **fallback**, not a replacement, so a cold or
never-synced state cannot blank the name.

#### 🔴 5-A-i. Never write an empty name into the passkey record

The existing onboarding precedent guards this: `if (validatedName) {
updateStoredPasskey(...) }`. **Keep that guard.** It is not defensive style, it is
load-bearing.

`currentPasskeyInfo.displayName` / `.pfpUrl` is read **directly** — not through this
reconciliation — by roughly fifteen sites, including `App.tsx`, `NavRail.tsx`,
`DirectMessage.tsx`, outgoing DM sender denormalisation in `MessageService.ts` and
`MessageEditTextarea.tsx`, `useProfileImage.ts`, and the settings and space-settings
modals. They all read the same in-memory object, so **one bad write blanks every one
of them at once.**

And `getConfig` returns `getDefaultUserConfig(address)` — which has **no `name`** —
whenever there is neither a network response nor a stored config. That is the exact
cold-start, fresh-onboarding and offline-first-run state.

Note also that `allowSync` gates only the **upload** path (`ConfigService.ts:494`).
`getConfig` has no `allowSync` check, so a device with sync switched off still
downloads and would still feed a previously-uploaded config into this
reconciliation. "Sync is off" is not an isolation guarantee here.

### 5-B. Nothing authors your own roster override

Four writers, all local:

| site | change |
|---|---|
| `InvitationService.ts:768-773` (join) | write the **global** slot with a `globalProfileTimestamp`, sourced from the config blob; leave the override empty |
| `SpaceSettingsModal.tsx:99-104` (`addOwnerToMembers`) | same |
| `MessageService.ts:6131-6139` (sync-delta apply) | refuse an override-slot write for our **own** address. A peer is never authoritative about our per-space choice |

> **Do NOT also tighten that site's "guard fails open on a row with no
> `profileTimestamp`".** An earlier draft of this design said to. Independent
> review 2026-08-05 showed why that is wrong: failing open on an unstamped row is
> the **intended bootstrap** for members we have never heard of, and it is pinned
> by `saveSpaceMemberGlobalSlot.test.ts` ("but it CAN populate a row that has no
> timestamp yet"). Self-exclusion already covers our own row, which is the case
> that mattered. Tightening it globally would break a working path to fix a case
> that is already fixed.
| `src/utils/spaceProfilePayload.ts:80` (`buildSpaceProfileWirePayload`) | **needs a real change — see 5-B-i.** An earlier draft said "no code change, it is fixed by starving it". That was wrong |

The Space Settings → Account editor stays exactly as it is. It is the only
legitimate author of an override, and it already goes through `applyProfileUpdate`.

> An override arriving from your own *other device* via `update-profile` is a
> legitimate author and must keep working. That carve-out is necessary, and it is
> also the reason 5-B-ii below exists.

#### 🔴 5-B-i. The announce cannot express a clear — FALSIFIED CLAIM, corrected

An earlier draft argued the announce needed no edit: once nothing else authors the
override and the clear had run, the echo would become correct by starvation. That
argument was **wrong**, and there is a checked-in, currently-passing test proving it.

[spaceProfilePayload.ts:80](../../../src/utils/spaceProfilePayload.ts#L80) reads
`ownMember?.display_name || undefined` — **`||`, not `!== undefined`**. So a
present-but-empty `''` and an absent field collapse to the identical wire output:
`displayName` is omitted entirely.
[spaceProfilePayload.test.ts:60-69](../../../src/dev/tests/utils/spaceProfilePayload.test.ts#L60-L69)
asserts exactly this and is green today.

Note the contrast: the Space Settings editor
([useSpaceProfile.ts:279-323](../../../src/hooks/business/spaces/useSpaceProfile.ts#L279-L323))
builds its payload with `changed.displayName !== undefined`, so a deliberate clear
really is sent. **Two independent implementations of "should I include the override
field", disagreeing on the one case 5-D depends on.**

Consequence: the clear persists locally and fixes this device's own render, but it
is **invisible on the wire**. Spacemates holding a poisoned copy of our row keep
showing the stale name, and so do our own other devices.

**Fix:** give `buildSpaceProfileWirePayload` presence semantics for the override
fields, matching the editor. `''` is already valid wire semantics (the two-slot
model documents `'' = deliberate clear`), so this is not a wire change — it is the
builder finally being able to say what the protocol already allows.

#### 🔴 5-B-ii. The clear must be BROADCAST, not just written locally

Same review, second failure of the same claim, and this one can actively undo the fix.

An un-migrated second instance of the app — another machine, another browser
profile, an Electron build that has not restarted — still holds the stale override
on **its** row and keeps announcing it with a **fresh** `createdDate` on every
reconnect. The receiving migrated device must accept it, because of the carve-out
above. A `profileTimestamp` on our clear does **not** save us: the sibling's
timestamp is newer, so it wins the comparison and restarts the never-decays clock
that §4-A-iii measured.

So the clear cannot be a local write. **It must send an `update-profile` carrying
`displayName: ''` to each affected space.** That single change:

- clears spacemates' poisoned copies of our row,
- clears our own other devices' rows,
- and therefore stops the sibling re-announcing, because its own builder then reads
  an empty override.

It depends on 5-B-i: without presence semantics the payload cannot carry the clear.

Cost is one small broadcast per space, with no avatar in it. Bounded and one-off.

### 5-C. Receive-side classification

`MessageService.ts:4922-4945` — file an incoming `join`'s identity under the
**global** slot stamped with `joinedAt`, not the override slot. Today every join
creates the same permanent trap for the joiner on every member's client, which is
why the identity doc's "legacy stamped rosters — accepted, decaying" note is wrong:
nothing decays, new traps are still being created.

Hashing is unaffected: `computeMemberHash` hashes `display_name ||
global_display_name` — the resolved string, not the slot it came from — so a
joiner produces an identical digest either way (READ, independent review
2026-08-05, corroborated by `memberDigestGlobalSlot.test.ts`).

#### 🔴 5-C-i. This change BREAKS the global notification panel unless 5-C-ii ships with it

Found by independent regression review 2026-08-05. This is the finding that would
otherwise have shipped a new, growing bug.

`buildGlobalSenderMap` ([resolveGlobalSender.ts:29-48](../../../src/utils/resolveGlobalSender.ts#L29-L48))
builds its lookup from `row.display_name` / `row.user_icon` **only**. It never reads
the global slot — its own `ResolvedGlobalSender` declares a `globalDisplayName` the
builder never populates, and
[NotificationPanel.tsx:315-323](../../../src/components/notifications/NotificationPanel.tsx#L315-L323)
passes that permanently-`undefined` value into `resolveSpaceMemberName`.

It has worked **by accident** since the two-slot model shipped, because every
incoming join unconditionally stamped `display_name` — which is exactly what this
file reads, and exactly what 5-C stops doing.

So after 5-C alone, **every member who joins any space from then on** renders
correctly in the member list, message list, mentions, reactions, threads and pinned
messages, and as a **truncated address in the global notifications drawer** —
permanently, growing with every new joiner.

#### 5-C-ii. Required, ships with 5-C

> ⛔ **DEAD as written, 2026-08-11 — the file it names no longer exists.**
> `src/utils/resolveGlobalSender.ts` and `useGlobalSenderResolver.ts` were deleted
> on 2026-08-10 (`f647895a8`) and absorbed into the identity provider, which
> implements the full ladder including the QNS tier the old map could never
> produce. There is no `buildGlobalSenderMap` to teach. The *requirement* was met,
> by replacement rather than by the edit described here.

Teach `buildGlobalSenderMap` the ladder: override → global slot → public profile.
`identityCoverageCore.ts:164-172` already implements it and can be followed.

This is a **fix site**, not merely a surface to verify. An earlier draft listed it
only under 5-E, which is exactly how the regression would have reached production.

### 5-D. One-time clear

On first run after the change, clear every per-space override on our own rows.
Approved by the reporter 2026-08-05: they are indistinguishable from deliberate
choices (§2.2), the user base is tiny, and re-setting one is cheap. No migration UI.

Clearing is `display_name: ''` — a present empty string, which the two-slot model
already treats as a deliberate clear. `saveSpaceMember`'s `clearFields` escape hatch
is **not** needed here; it exists for `spaceTag`, whose deletion is signalled by
absence.

#### 5-D-0. It clears the name and avatar, NOT the bio — deliberately

This looks like an omission and is not. Nothing ever stamped a per-space **bio**
automatically: the join path does not write one, the legacy-owner repair does not,
and the global profile save sends `globalBio`, never the override `bio`. The only
writer is the Space Settings → Account editor.

So a non-empty per-space bio is **always** deliberate, and clearing it would destroy
something the user actually typed — the opposite of the reasoning that justifies
clearing names.

If a future change starts stamping bios, this reasoning expires with it.

#### 🔴 5-D-i. The clear MUST stamp a `profileTimestamp`, or a sibling device undoes it

Found by independent regression review 2026-08-05, with the path traced end to end.

An un-updated second device still holds the old override on **its** row, and
`buildSpaceProfileWirePayload` reads `ownMember?.display_name` and keeps announcing
it. That announcement arrives as an ordinary `update-profile` and is applied by
`applyProfileUpdate` — **not** by the sync-delta site 5-B self-excludes, a different
path entirely, and one that must stay open because an override from your own other
device is a legitimate author.

`applyProfileUpdate` is deliberately fail-open on an unstamped row — its own test is
titled *"legacy row = always apply"*. So a clear written **without** a
`profileTimestamp` produces exactly the row shape that a stale sibling's announce
overwrites unconditionally.

**Therefore: write `display_name: ''` together with `profileTimestamp: Date.now()`.**
The clear then wins the last-write-wins comparison against any older announce.

Bounded, but real: the announce gate caps at 3 attempts per identity
(`src/utils/spaceProfileGate.ts`), and the sibling's identity never changes because
it never ran the clear — so it goes quiet after 3 reconnects. Without the timestamp
the name still comes back up to 3 times, which is 3 times too many for a user
watching to see whether the fix worked.

#### 🔴 5-D-iii. Sequence the clear BEFORE the first announce, or it races

`announceProfileToAllSpacesOnConnect` fires from **two** independent triggers — a
startup timer and `setResubscribe` ([MessageDB.tsx:571-591](../../../src/components/context/MessageDB.tsx#L571-L591)).
The startup timer exists precisely because that path already raced app
initialisation once; the comment there says so.

"Ship them in the same change" governs code review, not runtime ordering. Without an
explicit gate, the first post-upgrade connect can re-announce the pre-clear value
with a fresh timestamp **before** the migration's async IndexedDB write lands, and
the row is repoisoned by the exact mechanism §4-A-iii measured.

The migration must complete before the first announce is allowed to build a payload.

#### 5-D-iv. Follow the existing one-shot migration pattern

[useMigrateConversationSettings.ts](../../../src/hooks/business/dm/useMigrateConversationSettings.ts)
is the template: a versioned `localStorage` flag keyed by address, a `useEffect`
plus a `ranRef` guard, and — importantly — it does **not** set the flag when the
migration fails, so a failure retries rather than silently skipping. Copy that
shape rather than inventing one.

#### 5-D-ii. Log what it destroyed

The clear is irreversible, unconditional, and runs once. If anything surfaces days
later there is otherwise **no artifact** to distinguish "this user never had a
per-space name" from "the clear ate it".

Record the pre-clear values to a bounded `localStorage` ring, the same shape PR #311
used for config shrink (`quorum:diag:configSpaceShrink`). Use `console.warn`, not
`logger.warn` — see the no-op-logger bug.

### 5-E. Surfaces to verify, including two that are easy to miss

> ⚠️ **Superseded as a checklist, 2026-08-11.** Every surface below now resolves
> through `src/identity/`, and the regression checklist that replaced this one is
> the eighteen surfaces in
> `2026-08-10-name-surfaces-that-never-reached-the-resolver.md`, swept with a
> control arm via `/dev/fake-qns`. Two corrections to what is written here:
>
> - The **search results** note is half right and half stale.
>   `useSearchResultDisplay.ts` and `useBatchSearchResultsDisplay.ts` were migrated
>   to `src/identity` on 2026-08-11; `useSearchResultDisplayDM.ts` was **not**,
>   because it turned out to have no call site anywhere in `src/`. It is dead code
>   awaiting deletion, not a live stale-name path.
> - The **global notification panel** entry is superseded by the note on 5-C-ii.
>
> The two carry-forward writers named at the end (`EncryptionService.ts:174-187`
> and the optimistic `setQueryData` beside the join write) are **not** superseded —
> they are write sites, which this refactor never touched. They stay live here.

NavRail tooltip · DM self entry · message authors · member list · mention pills and
autocomplete · reactions list and modal · thread panels · pinned messages ·
**your own profile card** (`UserProfile.tsx` — only the bio is special-cased today,
the name is not) · **the global notification panel** (see 5-C-i — a fix site, not
just a verify site) · **search results** (`useSearchResultDisplay.ts:77-86` and
`useSearchResultDisplayDM.ts:57-66` both special-case `senderId === self` and render
`currentPasskeyInfo` directly — the same stale store as NavRail; likely fixed for
free by 5-A, but nobody will check it unless it is named).

Two more writers found by review that are not in 5-B, both carry-forward rather than
author, and both can perpetuate a poisoned value:

- [EncryptionService.ts:174-187](../../../src/services/EncryptionService.ts#L174-L187)
  — a space re-key / address migration deletes and re-saves every member row with a
  `...member` spread, copying whatever `display_name` currently holds into the new
  `spaceId`. If it runs on a device that has not yet cleared, it carries the poison
  across the migration.
- [MessageService.ts:4930-4945](../../../src/services/MessageService.ts#L4930-L4945)
  — the optimistic `queryClient.setQueryData` that rides along with the join DB
  write still patches `display_name: participant.displayName`. 5-C changes the DB
  write; **change this companion cache write with it**, or the cache and the DB
  disagree about which slot holds a new joiner's name until the next refetch.

## §6. Phase 2 — ⛔ MEASURED UNNECESSARY 2026-08-05. Do not build it.

**The gate was run and Phase 2 failed it, which is the good outcome.**

MEASURED on a real device pair: a per-space name set **on mobile** reached
**desktop** correctly, immediately, over channel C.

That kills the premise. Phase 2 existed because
`2026-08-01-per-space-override-does-not-reach-your-own-other-devices.md` assumed
per-space overrides never reach a user's own other devices — an assumption that
was **never traced**, and is now shown to be false in at least one direction. The
space roster already carries them, live, which is better than the config blob
would have managed: the blob has no live push and only re-pulls on startup and a
handful of incidental actions.

So the elaborate design below would have traded a working live channel for a
restart-gated one, to solve a problem that did not exist. It is retained as the
record of a decision **not** taken, and of what it would cost if the premise ever
turns out to hold after all.

⚠️ **Still open, and the reason this is not simply deleted:** only
**mobile → desktop** was measured. The 2026-08-01 issue observed the
**desktop → mobile** direction. If that direction is genuinely broken, the fix is
to repair channel C in that direction — not to move authorship into the blob.
Tracked in `2026-08-05-mobile-identity-parity-after-the-desktop-phase-1-fix.md`.

**Everything below is the un-built design. Read it only if the gate is reopened.**

### The original gate and design

**First, measure.** Set a per-space name on desktop; check whether it reaches the
phone, and the reverse. The 2026-08-01 issue assumed it never does and was never
traced — and the 2026-08-05 measurement shows desktop's own rows *do* receive
override values with fresh timestamps, so at least one direction works. This one
test decides whether Phase 2 is needed at all.

**If it is**, the shape is fixed by the review findings and is **not a cutover**:

- Add `spaceProfiles?: { [spaceId]: { displayName?, bio?, updatedAt } }` to
  `UserConfig` in `quorum-shared`. **Names and bios only.** Additive, so it ships
  alone.
- Merge it **per entry by `updatedAt`**, copying `mergeConversationSettings`, in
  both clients' `getConfig`. Blocked on the merge-asymmetry bug — mobile currently
  merges two fields where desktop merges four, and adding a fifth to only one side
  repeats that failure.
- **Write to both** the blob and the roster/broadcast. The broadcast is what
  reaches spacemates, keeps delivery live, and keeps working on a device that
  cannot publish its config — a real phone was measured at 0 of 3 spaces keyable,
  and the publish guard is all-or-nothing.
- **Read `spaceProfiles[spaceId] ?? roster override`.** The fallback is what lets a
  new desktop see an edit made on an old phone. Never remove it.
- Leaving, deleting or being kicked from a space writes
  `spaceProfiles[spaceId] = { updatedAt: now }` — an **empty entry, never a deleted
  key**. A removed key is invisible to a per-entry merge and the name returns.
  Never prune; ~40 bytes each, and any retention window reintroduces the bug.

### Sequencing constraints that are not negotiable

- `quorum-shared` merges before desktop, and needs `npm run build` green — it has
  no runtime smoke test.
- **Mobile pins shared by npm version and cannot use desktop's symlink**, because
  EAS Build's upload archive only contains mobile's own git root. Every shared
  change needs a real publish before mobile can compile against it.
- "Merged" is not "shipped". Verify against mobile's last **build** date.

## §7. Definition of done

**Phase 1**

- [ ] Renaming on the phone updates the NavRail tooltip on desktop after a config pull
- [ ] Every surface in §5-E shows the same name as the User Settings field
- [ ] A per-space name set in Space Settings → Account still wins, and still clears
- [ ] No code path writes our own roster override except that editor

> ⚠️ **That item is not provable by tests, and pretending otherwise is how this
> design already went wrong twice.** It is an exhaustive negative claim, and review
> found two write vectors (`EncryptionService.ts:177`, the two `applyProfileUpdate`
> receive sites) while the claim was being written. A fixed list of unit tests
> pinned to N known call sites cannot show the N+1th does not exist.
>
> ✅ **DONE.** The instrument exists and is wired in: `src/utils/selfOverrideTripwire.ts`,
> called from `saveSpaceMember` in `src/db/messages.ts`, with its own test at
> `src/dev/tests/utils/selfOverrideTripwire.test.ts`. Device-verified clean on the
> reporter's account after PR #313 (see the bug file's Status).
>
> **Build an instrument instead:** a guard inside `saveSpaceMember` that warns when
> a non-empty `display_name` is written for `user_address === selfAddress` from
> anywhere not explicitly tagged as the editor. That is an exhaustive check, it
> keeps working as the code changes, and it is the kind of thing that has found
> more in this subsystem than reading ever has.
- [ ] The on-connect announce no longer re-stamps an override it did not author
- [ ] Existing stale overrides are gone after one run
- [ ] A member who joins **after** this ships renders with a name in the **global notifications drawer**, not a truncated address (the 5-C-i regression) — outcome still required, but 5-C-ii's mechanism is gone; verify it against the identity provider instead (see the 2026-08-11 note)
- [ ] The clear survives a sibling device re-announcing the old override (5-D-i)
- [ ] A cold start with no config and no network still shows a name, not a blank (5-A-i)
- [ ] Each fix has a test that goes **red** when the fix is reverted — verified, not assumed

> ⚠️ **Trap when writing those tests.** `saveSpaceMemberGlobalSlot.test.ts`
> hand-duplicates the sync-delta apply decision inline instead of importing it, so
> changing the real code in `MessageService.ts` will **not** turn that file red. It
> will keep passing while certifying behaviour the shipped code no longer has.
> Either make it import the real logic, or update the copy deliberately and say so.
- [x] `identity-resolution-and-profile-sync.md` corrected: legacy stamps are not decaying, and the join path still stamps — done, see that doc's "It described stamped rows as a decaying legacy condition" correction
- [x] `config-sync-system.md` corrected: the server cannot validate `spaceIds`/`spaceKeys`, it only receives ciphertext — done 2026-08-11, "Encryption State Filtering"

**Phase 2 gate**

- [ ] Cross-device per-space propagation measured in both directions, result recorded
- [ ] Phase 2 built only if that measurement shows it is needed

---

*Last updated: 2026-08-11*
