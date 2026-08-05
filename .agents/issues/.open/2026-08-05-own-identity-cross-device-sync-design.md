---
type: task
title: "Your own identity, on your own devices: give it one author"
status: open
priority: high
created: 2026-08-05
updated: 2026-08-05
area: identity resolution / config sync / cross-device / desktop-mobile parity
repos: quorum-desktop now; quorum-shared + quorum-mobile only if Phase 2 is triggered
related:
  - ".agents/issues/.open/2026-08-04-desktop-shows-a-stale-name-everywhere-except-the-user-settings-field.md (the bug this came from, with the 2026-08-05 measurement)"
  - ".agents/issues/.open/2026-08-01-per-space-override-does-not-reach-your-own-other-devices.md"
  - ".agents/issues/.open/2026-06-13-config-not-refetched-stale-until-restart.md"
  - ".agents/issues/.open/2026-08-05-config-upload-has-no-size-guard-and-fails-silently-on-mobile.md"
  - ".agents/issues/.open/2026-08-05-config-merge-lists-are-asymmetric-between-desktop-and-mobile.md"
  - ".agents/issues/.open/2026-08-05-roster-sync-has-no-self-exclusion-a-peer-can-overwrite-your-own-row.md"
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
---

# Your own identity, on your own devices

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
  keys and encryption states** for every space — are already inside that blob.
  Adding a map keyed by space ID therefore reveals **nothing new**; the space list
  is already there, beside far more sensitive material.
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

### 5-B. Nothing authors your own roster override

Four writers, all local:

| site | change |
|---|---|
| `InvitationService.ts:768-773` (join) | write the **global** slot with a `globalProfileTimestamp`, sourced from the config blob; leave the override empty |
| `SpaceSettingsModal.tsx:99-104` (`addOwnerToMembers`) | same |
| `MessageService.ts:6131-6139` (sync-delta apply) | refuse an override-slot write for our **own** address; a peer is never authoritative about our per-space choice. Also fix the guard failing open on a row with no `profileTimestamp` |
| `MessageService.ts:1066-1078` (`buildSpaceProfilePayload`) | **no code change — but read the note below.** This is the site that keeps the stale value alive, and it is fixed by starving it, not by editing it |

The Space Settings → Account editor stays exactly as it is. It is the only
legitimate author of an override, and it already goes through `applyProfileUpdate`.

> **Why the announce needs no edit, and what that depends on.** "Stop echoing an
> override we did not author" is unimplementable on its own in Phase 1, because
> nothing yet records authorship. It does not need to be implemented: once the
> other three writers are fixed **and** the one-time clear (§5-D) has run, the only
> way a non-empty override can exist on our own row is the Space Settings editor.
> At that point the echo is correct and desirable — a member who set a per-space
> name expects spacemates to see it.
>
> This makes §5-D a **hard dependency** of §5-B, not a convenience. Ship the clear
> in the same change, or the announce keeps refreshing the old value forever.
>
> An override arriving from your own *other device* via `update-profile` is a
> legitimate author and must keep working.

### 5-C. Receive-side classification

`MessageService.ts:4922-4945` — file an incoming `join`'s identity under the
**global** slot stamped with `joinedAt`, not the override slot. Today every join
creates the same permanent trap for the joiner on every member's client, which is
why the identity doc's "legacy stamped rosters — accepted, decaying" note is wrong:
nothing decays, new traps are still being created.

### 5-D. One-time clear

On first run after the change, clear every per-space override on our own rows.
Approved by the reporter 2026-08-05: they are indistinguishable from deliberate
choices (§2.2), the user base is tiny, and re-setting one is cheap. No migration UI.

Clearing is `display_name: ''` — a present empty string, which the two-slot model
already treats as a deliberate clear. `saveSpaceMember`'s `clearFields` escape hatch
is **not** needed here; it exists for `spaceTag`, whose deletion is signalled by
absence.

### 5-E. Surfaces to verify, including two that are easy to miss

NavRail tooltip · DM self entry · message authors · member list · mention pills and
autocomplete · reactions list and modal · thread panels · pinned messages ·
**your own profile card** (`UserProfile.tsx` — only the bio is special-cased today,
the name is not) · **the global notification panel** (`resolveGlobalSender.ts` reads
the roster through its own hand-rolled map, so it does not come along for free with
a fix scoped to `useMembersWithPublicProfileFallback`).

## §6. Phase 2 — only if measured necessary

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
- [ ] The on-connect announce no longer re-stamps an override it did not author
- [ ] Existing stale overrides are gone after one run
- [ ] Each fix has a test that goes **red** when the fix is reverted — verified, not assumed
- [ ] `identity-resolution-and-profile-sync.md` corrected: legacy stamps are not decaying, and the join path still stamps
- [ ] `config-sync-system.md` corrected: the server cannot validate `spaceIds`/`spaceKeys`, it only receives ciphertext

**Phase 2 gate**

- [ ] Cross-device per-space propagation measured in both directions, result recorded
- [ ] Phase 2 built only if that measurement shows it is needed

---

*Last updated: 2026-08-05*
