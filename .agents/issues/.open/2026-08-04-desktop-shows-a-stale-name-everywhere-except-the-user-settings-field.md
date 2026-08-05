---
type: bug
title: "Desktop shows a stale display name everywhere except the User Settings field"
status: open
priority: medium
created: 2026-08-04
updated: 2026-08-05
severity: cosmetic but permanent and self-contradicting — two surfaces in the same app show two different names for the same person, and the wrong one never corrects itself
area: identity resolution / space member roster / name precedence
repos: quorum-desktop (visible) + quorum-mobile (sender)
related:
  - ".agents/issues/.open/2026-08-05-own-identity-cross-device-sync-design.md (the design this bug produced — read it before implementing)"
  - ".agents/issues/.open/2026-08-04-desktop-avatar-resolver-and-cross-client-name-tier-drift.md"
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
  - ".agents/docs/features/qns-username-display.md"
---

# Desktop shows a stale display name everywhere except the User Settings field

## Status

**2026-08-05 — fix shipped in PR #313, DEVICE-VERIFIED, deliberately NOT closed.**

What landed: self surfaces reconcile from the synced config; nothing authors our
own per-space override any more; an incoming join is filed as a global identity;
a one-time broadcast migration cleared the existing stamps; and the global slot
became a real resolver tier for name, avatar and bio. Design and plan:
`2026-08-05-own-identity-cross-device-sync-design.md` / `-plan.md`.

Verified on the reporter's device after the merge candidate: source A now equals
source B, no space holds a diverged override, the tripwire is clean, the migration
cleared 4 legacy overrides, and name + avatar + member list all render correctly.
A rename on mobile reaches desktop without a reload.

**Why this stays open — two device checks are outstanding**, and this is a
`type: bug`, so it does not move to `.done` on reasoning:

- [ ] The **notifications drawer** shows sender names, not truncated addresses.
      Highest-value remaining check: that surface had its own resolver reading only
      the override slot, and the join change would have made it worse for every
      future joiner had the fix not landed alongside.
- [ ] **Other members render normally in a busy space.** The widest blast radius of
      the join and resolver changes. The reporter has one space with few users, so
      this is a wait-and-see over days rather than a single look.

Close this once both are confirmed.

⚠️ **Do not read this as fixing "members show as a truncated address".** That is
the P2P roster pull/announce gap and is untouched. This helps only the subset
whose identity had arrived in the global slot and was being read from the wrong
one.

## §1. Symptom, as reported

Change your own username on mobile. On desktop:

- **User Settings → display name field** shows the **new** name. Correct.
- **Everywhere else** — message authors, the NavRail avatar hover tooltip, member
  lists in Spaces — shows an **old** name.

Not "never updates": it updated once and froze. During a `name1..name8` test
series on 2026-08-04 every surface except User Settings sat at **`name2`** while
the field tracked `name8`. Surviving a page refresh and DM navigation.

Two surfaces in the same app, two different names, same person.

## §2. What is already ruled out (MEASURED 2026-08-04)

Do not re-investigate these; they were measured on a real device pair.

- **Mobile does broadcast.** All three Spaces, no failures, no gate suppression:
  ```
  [ProfileSync] broadcast sent space=QmZM3AKwKfMp
  [ProfileSync] broadcast sent space=Qma7EGH7RdfE
  [ProfileSync] broadcast sent space=QmbdLB6bAAdi
  ```
  (Logging added in quorum-mobile #230, which exists because this path had none.)
- **The config blob publishes and lands.** `published ts=…` followed by
  `server read-back CONFIRMS`. That is why the User Settings field is right — it
  reads channel A, the config blob.
- **Not the Space-key failure.** The same device keys 0 of 3 Spaces for config
  sync (`2026-08-04-mobile-cannot-key-any-space-it-imported-from-the-config-blob.md`
  in quorum-mobile). The obvious theory was that a device which cannot key a Space
  also cannot broadcast into it. **Refuted** by the log above on its first run.

So the sender is healthy and the break is on the desktop receive or render side.

## §2-B. The premise the rest of this file got wrong (READ 2026-08-05)

Everything below §3 was written assuming "everywhere else" is **one** surface with
**one** source, so one stale value explains all of it. It is not. Traced through
the source, the affected surfaces read **three different stores**, and only one of
them is the roster:

| Surface | Reads | File |
|---|---|---|
| User Settings field | `user_config.name` — channel A, the config blob | [useUserSettings.ts:140-142](../../../src/hooks/business/user/useUserSettings.ts#L140-L142) |
| NavRail avatar + hover tooltip | `localStorage['passkeys-list'][0].displayName` | [NavRail.tsx:94](../../../src/components/shell/NavRail.tsx#L94) |
| DM self entry | the same localStorage record | [DirectMessage.tsx:301](../../../src/components/direct/DirectMessage.tsx#L301) |
| Message authors, Space member lists | `space_members[you].display_name` — channel C override slot | [useChannelData.ts:75](../../../src/hooks/business/channels/useChannelData.ts#L75) → [Message.tsx:459](../../../src/components/message/Message.tsx#L459) |
| Mention pills + autocomplete, reactions list, thread panels, pinned messages, typing indicator | same roster override, via `Channel.tsx`'s shared `mapSenderToUser` | [Channel.tsx:280-322](../../../src/components/space/Channel.tsx#L280-L322) |
| **Your own profile card** | same roster override. Only the **bio** is special-cased to the config blob for your own profile; the **name is not** | [UserProfile.tsx:108,129-145,169](../../../src/components/user/UserProfile.tsx#L129-L145) |
| **Global notification panel** | roster override, through its **own hand-rolled map** — not the shared fallback hook | [resolveGlobalSender.ts:29-48](../../../src/utils/resolveGlobalSender.ts#L29-L48) |

The last two were added 2026-08-05 by independent review and are easy to miss: the
profile card is the natural manual test step ("click my own avatar"), and
`resolveGlobalSender` is a **second read site** that does not come along for free
with a fix scoped to `useMembersWithPublicProfileFallback`.

So there are at least **two independent defects** producing one symptom, and
§3 addresses only the second of them. Fixing §3 alone would leave the NavRail
tooltip exactly as wrong as it is today.

### §2-B-i. The NavRail name comes from a store nothing can sync — READ

`currentPasskeyInfo` is loaded once on mount from `localStorage['passkeys-list']`
(SDK `PasskeysContext.tsx`, `getStoredPasskeys`) and is rewritten **only** by
`updateStoredPasskey`. Desktop calls that in exactly three places: the onboarding
flows, `UserProfileEdit`, and `useUserSettings.saveChanges` — that is, only when
**this device** saves a profile.

Nothing on the config-pull path writes it. `useUserSettings` reads `config.name`
into React state for the form field and stops there; it never pushes the pulled
name back into the passkey record.

**Consequence: a rename made on any other device can never reach the NavRail
tooltip on this one.** It is not lag, and it is not a decaying trap — it is a
store with no writer on the receive side. This alone explains "the field is right
and the tooltip is wrong", with no stale override required anywhere.

> **Qualification (independent review, 2026-08-05).** Two onboarding call sites
> DO fetch the remote config and write `decryptedConfig.name` into the passkey
> record ([useUnifiedOnboardingFlow.ts:200-247, 261-369](../../../src/hooks/business/user/useUnifiedOnboardingFlow.ts#L200-L247)),
> but only when `completedOnboarding` is false, or during post-import profile
> sync on a new device. An already-onboarded device takes the early return at
> `:277-286` and reads the stale stored value. So the steady-state claim holds —
> and the frozen NavRail value dates from whenever this device last completed or
> re-detected onboarding, **not** from any particular rename. Do not reason
> backwards from it to a point in time.
>
> It also means the write already exists and is proven; the fix can reuse it
> rather than invent one.

### §2-B-ii. …and that same frozen value gets stamped into the roster — READ

The value in §2-B-i does not stay local. Three desktop call sites copy it into
the channel-C **override** slot, which is the slot the follow-global work of
2026-07-16 exists to keep empty:

- [InvitationService.ts:768-773](../../../src/services/InvitationService.ts#L768-L773) —
  on join, writes our own row with `display_name: currentPasskeyInfo.displayName`.
  It also puts the same value in the `join` broadcast (`participant.displayName`,
  line 837), so every other member stores it too.
- [SpaceSettingsModal.tsx:99-104](../../../src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx#L99-L104) —
  `addOwnerToMembers` does the same for the legacy-owner repair path.
- [MessageService.ts:6131-6139](../../../src/services/MessageService.ts#L6131-L6139) —
  the `sync-delta` apply has **no self-exclusion**, so a peer holding an old copy
  of our row can write its `display_name` back onto ours. The join stamp sets no
  `profileTimestamp`, so the per-slot staleness guard on that line is comparing
  against `undefined` and does not block it.

This is the writer §3 was looking for. The roster stamping was removed from the
editor saves and the rebroadcasts; **it was never removed from the join path**,
and for your own row that is the one that runs.

Desktop's own global-profile save does not correct it either:
[MessageService.ts:7141-7155](../../../src/services/MessageService.ts#L7141-L7155)
self-applies the just-sent edit to the **global** slot only, deliberately leaving
the override untouched. So the stamp survives a rename made on this device too.

## §3. Leading hypothesis — a stale override outranks everything (INFERRED)

Per [identity-resolution-and-profile-sync.md](../../docs/features/identity-resolution-and-profile-sync.md),
a member row carries two name slots, and the ladder is:

```
per-space override (display_name)  →  QNS .q name  →  global slot (global_display_name)  →  address
```

`applyProfileUpdate` ([MessageService.ts:269-306](../../../src/services/MessageService.ts#L269-L306))
updates them independently. Mobile's profile editor sends only
`globalDisplayName` / `globalUserIcon` / `globalBio`, so `hasOverride` is false
and **the override slot is never touched by anything mobile does today**.

If desktop holds `display_name = name2` as a per-space override — plausibly
written by an older mobile build that sent `displayName`, before the
follow-global work of 2026-07-16 — then that override outranks the global slot
forever, and every global update mobile sends lands in a slot the ladder never
reaches.

### §3-A. Why desktop's echo detection does not save it

Desktop already demotes a roster row that merely *echoes* the global name
(§3-B of the name-tier-drift task). That check compares the override against the
**current** global value.

A row that was an echo when written and has since diverged — exactly `name2`
against a global of `name8` — is indistinguishable from a deliberate per-space
override, and is therefore promoted rather than demoted. **Echo detection catches
a row that is still an echo; it cannot catch a row that used to be one.** If this
hypothesis holds, that asymmetry is the actual defect, and it is a permanent trap
rather than a decaying one.

Also note the override wins the merge **before** the resolver ever runs:
[useMembersWithPublicProfileFallback.ts:147](../../../src/hooks/business/user/useMembersWithPublicProfileFallback.ts#L147)
is `local?.displayName || rosterGlobalName || pub?.display_name`, so a non-empty
override slot shadows the global slot for every consumer of that map — with or
without a QNS name in play.

### §3-B. Confidence, stated honestly

The **mechanism** is now READ, not inferred: §2-B-ii names the writer, the slot,
and the three call sites, with the guard that fails to stop it. What is still
**INFERRED** is that this mechanism is what produced `name2` specifically on the
2026-08-04 run — nothing read so far explains why the frozen value was the
second name in the series rather than the pre-test one. Run §4 before treating
the diagnosis as closed.

## §4. Cheapest falsification — one console paste

`.agents/tools/dm-debug/08-self-identity-sources.js` reads all four stores in one
pass and prints a verdict. It exists because §4 previously asked for the roster
row alone, which cannot distinguish the two defects in §2-B. Paste it into the
DevTools console of the affected desktop client.

What each outcome means:

| Reading | Conclusion |
|---|---|
| `passkeys-list` name ≠ `user_config.name` | §2-B-i confirmed. The NavRail tooltip is unreachable by any cross-device rename, independently of anything else here. |
| roster `display_name` non-empty and ≠ `global_display_name` | §3 confirmed. The stale override outranks the global slot permanently. |
| every `global_display_name` matches `user_config.name` | mobile's broadcast IS landing; the fault is entirely precedence, not transport. |
| some `global_display_name` behind `user_config.name` | the receive path is also implicated and needs its own trace. |

Then, as a behavioural cross-check: **clear the per-space override** in Space
Settings → Account. The name should fall through to the global slot immediately.
A working workaround confirms the second defect without touching code.

If the row does NOT hold a diverged override, the fault is downstream in
rendering, and §3-A of the name-tier-drift task becomes the suspect: desktop's
global slot is a comparator, not a tier, and reaches the right output only via
`useMembersWithPublicProfileFallback.ts:147`. Any surface resolving without that
hook is on its own.

## §4-A. MEASURED 2026-08-05 — the run, and what it changed

Run of `08-self-identity-sources.js` on the affected desktop client. Display names
genericised; the shape is what matters. This supersedes §3-B's caveats and §4-B
below, which it **falsifies**.

**Sources**

| store | value |
|---|---|
| A. `localStorage['passkeys-list']` | `<name> Mobile 2` |
| B. `user_config.name` (config blob) | `<name> Mobile 8` |
| D. public profile | not readable from the dev origin (CORS); QNS state unknown |

**Own roster row, per space (5 spaces)**

| # | override `display_name` | global slot | `profileTimestamp` | `globalProfileTimestamp` | renders as |
|---|---|---|---|---|---|
| 1 | `<name> Desktop 3` | `<name> Mobile 2` | …653359818 | …855014624 | `<name> Desktop 3` |
| 2 | `<name> Mobile` | `<name> Mobile 8` | …921634415 | …921634415 | `<name> Mobile` |
| 3 | `<name> - new identity` | `<name> Mobile 8` | …921634566 | …921634566 | `<name> - new identity` |
| 4 | `<name> Desktop 3` | `<name> Mobile 8` | …921634735 | …921634735 | `<name> Desktop 3` |
| 5 | *(empty)* | `<name> Mobile 2` | *(none)* | …855015297 | `<name> Mobile 2` |

### §4-A-i. ✅ CONFIRMED — the NavRail store is stale and unreachable

A ≠ B, exactly as §2-B-i predicts. Nothing on the receive side writes A.

### §4-A-ii. ❌ FALSIFIED — §4-B's repair discriminator

All four stale overrides carry a `profileTimestamp`. In rows 2-4 it is **identical
to `globalProfileTimestamp`** and the three values are consecutive milliseconds —
one loop over three spaces, ~2 minutes before the run. So "no timestamp ⟺ join
stamp" is wrong, and a repair keyed on it would match zero rows.

### §4-A-iii. 🔴 THE ACTUAL MECHANISM — the announce refreshes its own stale override

Identical override/global timestamps mean one `update-profile` carrying **both**
slots. That is the announce payload shape, and
[buildSpaceProfilePayload](../../../src/services/MessageService.ts#L1066-L1078)
builds it by reading `ownMember.display_name` — our own roster override — straight
back onto the wire beside the current global name.

**So the override is not a decaying legacy stamp. It is re-sent and re-stamped on
every connect.** Consequences, and they are worse than the issue originally assumed:

1. It can never expire. The "accepted, decaying limitation" in the identity doc is
   wrong about this case: nothing decays, it is refreshed.
2. After the first announce, a legacy stamp is **byte-for-byte indistinguishable**
   from a deliberately chosen per-space name. No automatic repair can tell them
   apart. Any migration has to ask the user or clear unconditionally.
3. It propagates. The announce goes to the space, so this value reaches the user's
   other devices too — which complicates
   `2026-08-01-per-space-override-does-not-reach-your-own-other-devices.md` rather
   than simply confirming it.

### §4-A-iv. ✅ The transport is healthy — an earlier framing here was wrong

The global slot is current in exactly the three spaces mobile broadcast to (§2),
and stale in the two it did not. **Nothing is being dropped.** Any wording in this
file suggesting a receive-side transport fault applies only to spaces that were
never sent to.

### §4-A-v. The symptom is more varied than reported

Not one frozen name: four different names across five spaces, none of them the
current global. "Everywhere shows name2" is really "the NavRail shows name2, and
each space shows its own stale value".

### §4-A-vi. MEASURED — the config blob cannot take per-space avatars

| part | size |
|---|---|
| **whole blob** | **873 KB** (~1 MB observed working ceiling, `config-sync-system.md`) |
| bookmarks | **656 KB** — 75% of the blob |
| spaceKeys / encryption states | 160 KB |
| one avatar (`profile_image`) | 49.6 KB |

Five per-space avatars ≈ +248 KB → ~1.12 MB, over the ceiling. Per-space **names
and bios** cost a few hundred bytes and are safe. Per-space **avatars are not**,
and must not be put in the blob without first addressing bookmarks.

> Bookmarks at 656 KB is a separate problem squeezing the same budget the
> spaces-list bug fails on. File it independently.

## §4-B. The repair discriminator — ❌ FALSIFIED 2026-08-05, see §4-A-ii. Kept for the record.

Existing stamped rows cannot be fixed by changing the writers; they are already on
disk. And in general a non-empty `display_name` is ambiguous: deliberate override,
or legacy stamp?

For **desktop** it is not ambiguous, because the two writers leave different
traces. `profileTimestamp` is written in exactly two places —
[MessageService.ts:297](../../../src/services/MessageService.ts#L297) (`applyProfileUpdate`,
which every deliberate override goes through, including the user's own Space
Settings → Account save via `submitChannelMessage`) and the `sync-delta` apply. The
three join-stamp sites write `display_name` and **no** `profileTimestamp` at all.

> **`display_name` non-empty AND `profileTimestamp` absent ⟺ a join stamp, never a
> deliberate override.**

That makes a one-shot repair safe: clear the override slot on exactly those rows
and they fall through to the global slot, which is already correct. Rows with a
timestamp are left alone, because those really are the user's choice.

⚠️ Verify this against the live rows before relying on it — `08-self-identity-sources.js`
prints `profileTimestamp` per space for exactly this reason. If a diverged override
turns up carrying a timestamp, the discriminator is wrong and the repair must not
ship.

> 🔴 **It did. Measured 2026-08-05: all four diverged overrides carry a
> `profileTimestamp`, because the on-connect announce re-stamps them.** See
> §4-A-ii and §4-A-iii. This section is retained only to show which idea was
> tested and why it failed; do not build the repair described here.

## §4-C. Proposed fix, as vertical slices

Desktop-only. **No wire change** — the `join` control still carries the sender's
global name, because it is load-bearing bootstrap for members who would otherwise
have no row at all (see the identity doc's cost model). What changes is which
**slot** a receiver files it under.

**Slice 1 — "my name in the NavRail tooltip follows a rename made on my phone".**
Stop treating the localStorage passkey record as an identity source. The config
blob is the cross-device truth and is already pulled; reconcile the passkey record
from it on load, so `NavRail`, the DM self entry and every future join stamp
converge with no call-site changes.

> ⚠️ **Slice 2 predates the 2026-08-05 measurement and is now partly wrong.** Its
> automatic repair rests on §4-B, which §4-A-ii falsified. The join stamp is also
> not the whole story: §4-A-iii shows the on-connect announce keeps the stale value
> alive whatever the join path does, so the announce's override-echo has to be
> addressed too. Slices 1 and 3 stand.

**Slice 2 — "my name in message authors and member lists follows a rename made on
my phone".** The one-shot repair of §4-B, plus the join-stamp fix so it does not
come back: [InvitationService.ts:768-773](../../../src/services/InvitationService.ts#L768-L773)
and [SpaceSettingsModal.tsx:99-104](../../../src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx#L99-L104)
write our own row's **global** slot (sourced from the config blob, with a
`globalProfileTimestamp`), never the override slot.

**Slice 3 — "a member who joins today does not get permanently frozen".** Two
receive-side classifications:
- [MessageService.ts:4922-4945](../../../src/services/MessageService.ts#L4922-L4945) —
  file an incoming `join`'s identity under the GLOBAL slot, stamped with
  `joinedAt`. Today every join creates the same permanent trap for the joiner, on
  every member's client. **This means the identity doc's "legacy stamped rosters"
  entry is wrong to call itself decaying** — the stamping was removed from the
  editor saves and the rebroadcasts, never from the join path, so new traps are
  still being created. Correct that doc when this lands.
- [MessageService.ts:6131-6139](../../../src/services/MessageService.ts#L6131-L6139) —
  refuse an override-slot write for our OWN address. A peer's copy of our row is
  never authoritative about our per-space choice.

## §4-D. Decisions taken 2026-08-05 (design in progress)

These were decided with the reporter after the §4-A measurement. The full design
lives in `2026-08-05-own-identity-cross-device-sync-design.md`; recorded here so
the decision survives if that file lags.

1. **The config blob becomes the single AUTHOR of the user's own identity**, global
   and per-space. The space roster becomes a derived outbound broadcast, never
   authored locally for oneself.

   The reason is not that the blob syncs better. It is that **the system currently
   has no way to know which per-space names the user actually chose** — the roster
   row is the only record and the announce keeps rewriting it (§4-A-iii), so a
   deliberate name and a copied global name are the same bytes. Every previous
   attempt tried to infer the difference from the row. That is why they failed.
   An author makes it knowable.

2. **Per-space names and bios go in the blob. Avatars do NOT** — measured, §4-A-vi.

3. **Existing stale overrides: clear all, once.** On first run after the change,
   clear every per-space override with no counterpart in the blob. Rationale: they
   are indistinguishable from deliberate ones (§4-A-iii), the user base is tiny,
   and re-setting one is cheap in a system that will then actually sync it. No
   migration UI.

4. **Leaving a space clears its per-space profile — as an empty entry, never a
   deleted key.** Requested by the reporter 2026-08-05.

   ⚠️ `delete spaceProfiles[spaceId]` is the obvious implementation and it is
   **wrong**. A removed key is invisible to a per-entry LWW merge: the other device
   still holds the entry with its old `updatedAt`, so it merges straight back in and
   the name returns — or is inherited by a space you later rejoin.

   Write `spaceProfiles[spaceId] = { updatedAt: Date.now() }` instead. An entry with
   no override fields is its own tombstone (newer empty beats older non-empty), which
   is exactly what `ConversationSettingOverrides` already documents and does.

   Rejoin then works for free: an empty entry means "follow global", the correct
   default.

   **Never prune these.** An empty entry is ~40 bytes, so retention costs nothing,
   and it avoids the tombstone-retention question the spaces-list task lists as an
   open cross-repo decision (`deletedBookmarkIds` clears after one sync, so a device
   offline longer than that never sees the tombstone).

   Hook the same three exits as the spaces list: leave, delete, kicked
   (`SpaceService.ts` delete/leave, `MessageService.ts` self-kicked).

5. **This does NOT address other members rendering as a truncated address.** That
   is the P2P roster pull/announce problem in the identity doc, and it is
   untouched here. Stated because the two are easy to conflate and testing this
   against that symptom would read as a failure.

## §5. Scope note — do not fold this into the name-tier task

`2026-08-04-desktop-avatar-resolver-and-cross-client-name-tier-drift.md` is a
**design** task: cross-client decisions about where the avatar rule lives and how
three tiers should agree. It needs the lead, and it has no user-visible symptom.

This is an **observed bug** with a reproduction, a measured sender, and a
falsifiable cause. Folding it in would bury a reproducible defect inside a
decision that is waiting on someone else. Cross-link them; keep them apart.

They do share a root, and if §3 holds the fix likely belongs in the same resolver
that task is about — which is a reason to sequence them together, not to merge
the files.

## §6. Also relevant

- The User Settings field lags by design until desktop re-pulls the config —
  [2026-06-13-config-not-refetched-stale-until-restart.md](2026-06-13-config-not-refetched-stale-until-restart.md).
  Observed here as a delay of a minute or two, and mistaken for a second bug
  during the session. Not part of this issue.
- DM surfaces travel a **third** channel (`dm-update-profile`,
  `services/dm/dmProfileService.ts` on mobile), so a stale name in a DM header
  may have its own cause and should not be assumed to share this one. Note
  though that the DM **self** entry is not on that channel at all — it is the
  localStorage record of §2-B-i ([DirectMessage.tsx:301](../../../src/components/direct/DirectMessage.tsx#L301)).
- `2026-08-01-per-space-override-does-not-reach-your-own-other-devices.md` is the
  mirror image of §2-B: there, an override set on one device never reaches your
  others; here, a value that should never have been an override is stamped onto
  your own row and cannot be dislodged. Both are "your own second device has no
  path to your identity". Worth reading together, still separate files.

---

*Last updated: 2026-08-05*
