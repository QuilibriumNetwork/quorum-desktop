---
type: task
title: "Config sync overhaul: make the off switch real, the payload bounded, and the feature honest about what it did"
status: open
complexity: very-high
priority: high
ai_generated: true
created: 2026-08-07
updated: 2026-08-07
area: config sync / cross-client parity / privacy UX
repos: quorum-desktop + quorum-mobile + quorum-shared
related:
  - ".agents/issues/.open/2026-08-05-config-upload-has-no-size-guard-and-fails-silently-on-mobile.md"
  - ".agents/issues/.open/2026-08-05-config-merge-lists-are-asymmetric-between-desktop-and-mobile.md"
  - ".agents/issues/.open/2025-12-09-encryption-state-evals-bloat.md"
  - ".agents/issues/.open/2026-07-31-spaces-list-cross-device-sync.md"
  - ".agents/docs/features/privacy-settings.md"
  - ".agents/docs/config-sync-system.md"
---

# Config sync overhaul

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> Claims are labelled **READ** (verified at the cited `file:line`, 2026-08-07),
> **MEASURED** (a recorded observation exists, cited), or **INFERRED**. Nothing
> here was observed at runtime; every citation was checked against source on
> disk. Two independent passes have been made over this file — see Review Log.

## What this document is

A design for reworking the `allowSync` feature across both clients. It is **not
approved for implementation.** §10 lists what has to be settled first, in order;
only the last of those is a product decision, and it belongs to the file's owner.

**One naming warning before anything else.** Today `allowSync` is a **single
switch**: when it is on, the upload always includes your Space keys, and there is
no way to have one without the other. This document proposes splitting that into
two, and refers to the proposed second control as the **"keys tier"** (draft UI
label: "Also back up Space keys", §6.2). **That control does not exist yet.**
Where §5 and §10 talk about it being on or off, they are describing the proposal,
not current behaviour.

**Scope boundary:** everything proposed here is client-side. Four questions only
the lead dev or the SDK can answer are collected in §4; one of them (§4.1) blocks
part of the work, the rest do not.

**Out of scope but relevant:** there is a separate product idea for privacy-level
presets in User Settings (Low / Normal / High / Custom, each setting a
combination of the existing privacy toggles). Nothing here should make that
harder. §6.4 checks the proposal against it.

---

## §1. The current architecture, on both clients

**There is no shared config-sync module.** Desktop's
[`ConfigService.ts`](../../../src/services/ConfigService.ts) and mobile's
[`services/config/configService.ts`](../../../../quorum-mobile/services/config/configService.ts)
are two independent implementations of the same wire protocol. They share only
the `UserConfig` type
([quorum-shared/src/types/user.ts:66](../../../../quorum-shared/src/types/user.ts))
and two merge helpers (`utils/conversationSettingsUtils.ts`,
`utils/bookmarkPayload.ts`). `quorum-shared/src/sync/` is the **message** sync
manifest service (hash-based delta sync for messages, members and peer maps) and
is unrelated to config sync. (READ)

That duplication is the root cause of the drift documented in
[the merge-asymmetry issue](2026-08-05-config-merge-lists-are-asymmetric-between-desktop-and-mobile.md),
and it is why every item below has to be specified twice or extracted once.

### 1.1 What both clients do identically

| Step | Desktop | Mobile |
|---|---|---|
| Gate the upload on `config.allowSync` | `ConfigService.ts:524` | `configService.ts:662` |
| Stamp `timestamp = Date.now()` **before** the gate — but every path that does not reach the server now restores the incoming value (Rule 1, shipped 2026-08-07) | `:525` capture; `:660`, `:725` restore | `:651` capture; `:675`, `:678`, `:810`, `:871` restore |
| Encrypt AES-GCM under `SHA-512(privkey)[0:32]`, sign Ed448, POST | `:693` | `:673+` |
| Write the local row **regardless** of upload outcome | `:711` | after the branch |
| Resolve inbound by a single top-level `timestamp`, last-write-wins | `:71-78` | same shape |
| Filter `spaceIds`↔`spaceKeys` bidirectionally before publishing | `:608-627` | `:728-746` |
| Refuse to publish a narrowed Space list | `:644` | `:780` |
| **Adopt the winning remote config verbatim**, except for fields with an explicit merge | `:417` (`{...config}`) | `:519` (`...decryptedConfig`) |

(All READ.)

The last row is the one that matters most and is easiest to get wrong: **both
clients spread the decrypted remote config wholesale.** Mobile then re-overrides
about ten fields, but those re-overrides exist for merging or defensive
redundancy, not as a gate. Mobile's own comment at `configService.ts:528-530`
says as much ("the spread above should include it… so list it"). A field absent
from that list still rides through on both clients. There is no allow-list on
either side.

> **Doc correction to make when this lands.** The comment at
> [`ConfigService.ts:406-414`](../../../src/services/ConfigService.ts#L406) and
> the matching passage in `config-sync-system.md` state that *"mobile currently
> only warns and publishes anyway"* on a narrowed Space list. That is stale.
> Mobile's refuse-to-publish guard is real, at `configService.ts:780-796`
> (`configService.ts:761` comment: *"desktop refused to be that publisher since
> #282; this is the mobile half"*). Fix both.

### 1.2 Where they genuinely differ

| Concern | Desktop | Mobile | Consequence |
|---|---|---|---|
| **Which fields merge** | 4 groups: deviceNames `:283-291`, conversationSettings `:296-299`, userNotes `:301-330`, bookmarks `:332-404` | 2 groups: bookmarks `:467-475`, conversationSettings `:511-514` | Pre-existing bug, [already filed](2026-08-05-config-merge-lists-are-asymmetric-between-desktop-and-mobile.md). Do not fix here; depend on it. |
| **Space-key collection** | One condition: `encryptionState !== undefined` (`:561`) | Three conditions: present in `getAllSpaces()`, non-empty `getSpaceKeys`, non-empty encryption state (`:563-604`) | Mobile can produce an empty key set where desktop would not. Live today: [mobile can key 0 of 3 imported Spaces](../../../../quorum-mobile/.agents/issues/.open/2026-08-04-mobile-cannot-key-any-space-it-imported-from-the-config-blob.md). |
| **What drives the Spaces list in the UI** | Config-driven: `useNavItems.ts:52-57` walks `config.items` and looks each id up in the local Space table, skipping any it cannot resolve | Storage-driven: renders from the local storage adapter with no config filter anywhere | **An incoming config can empty desktop's sidebar. It cannot empty mobile's.** This asymmetry decides §5.3 Trap 2. |
| **Local config store** | IndexedDB | MMKV, plus a module-level cache in `useDMConversationSettings.ts:72` refreshed once per address | Any setting read through that cache needs an explicit refresh on write (same trap as the [signing-toggle task](../../../../quorum-mobile/.agents/issues/.open/2026-08-07-no-global-always-sign-dms-toggle-on-mobile.md)). |
| **Logging in release** | `console.warn` used deliberately for the shrink diagnostic (`:476`) because `logger.*` compiles out | POST failure goes through `logger.warn` (`:849-851`) — **a no-op in release builds** | Any user-facing signal added here must not go through `logger.*` on mobile. |

---

## §2. The six problems

Ordered by how much user harm they cause today, not by effort.

### P1 — The payload is unbounded and the failure is silent

MEASURED 2026-08-05 on a real account: a **4205 KB** blob, **98% encryption
states**, of which two *created* test Spaces were 1976 KB and 1975 KB. A joined
Space costs 34-63 KB; a created one costs ~2 MB. The real server limit is
bracketed between "4205 KB accepted" and "~4 MB rejected (2025-12-09)" — that
account was sitting **on** the threshold, not under it.

Failure mode: the device keeps working, the UI looks correct, the local row is
written, and nothing leaves. Ever. With no error.

Fully specified in
[the size-guard issue](2026-08-05-config-upload-has-no-size-guard-and-fails-silently-on-mobile.md).
This design depends on it and does not restate it.

### P2 — "Off" is not durable, and there is no delete

Two defects with one user-facing meaning: *turning sync off does not mean what a
user thinks it means.*

- **No delete.** The API client exposes only `getUserSettings` (GET) and
  `postUserSettings` (POST) — [`baseTypes.ts:410`](../../../src/api/baseTypes.ts#L410),
  [`:470`](../../../src/api/baseTypes.ts#L470). A full-file grep for
  `UserSettings`/`delete` finds no delete endpoint anywhere. (READ) Disabling
  suppresses future uploads; the last snapshot stays.
- **Off silently reverts.** The remote config is adopted verbatim at
  [`ConfigService.ts:417`](../../../src/services/ConfigService.ts#L417),
  `allowSync` included. So (a) losing local storage restores the old blob *with
  sync back on* — the timestamp check at `:71` compares against `?? 0`, so remote
  always wins when there is no local row — and (b) a second device still syncing
  flips this device back on at its next newer publish. (READ)

The second point is the sharper one: **`allowSync` is a per-device decision
stored in an account-level synced field.** Wanting sync on a desktop and off on a
borrowed phone is currently unexpressible.

### P3 — It is all-or-nothing

One boolean governs two things with completely different risk and size profiles:

| | size | recovery value | privacy weight |
|---|---|---|---|
| Settings, profile, bookmarks, mutes, prefs | ~40 KB (MEASURED: bookmarks 37.1 KB after the avatar strip) | convenience | activity timeline |
| `spaceKeys` + encryption states | **98% of the blob**, MB-scale | **the only backup of Space access** | a durable, retroactively-decryptable key archive |

There is one switch. A user who wants their Space keys backed up must also
publish their behavioural settings; a user who wants their settings on two
devices must also publish their key archive. Neither is a choice anyone asked
for, and today neither is avoidable.

### P4 — Three publish outcomes are indistinguishable

`allowSync` off, a refuse-to-publish hold, and a genuine successful upload all
write the local row and all look identical to the user. **"My setting saved" has
never been evidence that it synced.** A size rejection would become a fourth
indistinguishable member of that set.

### P5 — It is not live

Config is pulled on startup and login. No push, no poll, no focus refetch. Filed
on both sides:
[mobile](../../../../quorum-mobile/.agents/issues/.open/2026-06-22-userconfig-blob-not-live-synced-cross-device-master.md),
[desktop](2026-06-13-config-not-refetched-stale-until-restart.md). Users read
"changed it on desktop, mobile still shows the old value" as *sync is broken*,
which is a fair reading.

### P6 — Whole-blob last-write-wins clobbers concurrent edits

One timestamp resolves the entire blob, so any field without an explicit merge
loses. `recordSpaceListShrinkOnAdopt`
([`ConfigService.ts:450-500`](../../../src/services/ConfigService.ts#L450))
exists because of this: it is an instrument, not a fix, added because every
report of *"all my Spaces vanished"* arrived with no evidence.

---

## §3. Dependencies — do NOT re-solve here

All four were re-derived from current source on 2026-08-07 rather than trusted
from their own text. **None are stale; all four are live.**

| Issue | Verified against code | Relationship |
|---|---|---|
| [Size guard](2026-08-05-config-upload-has-no-size-guard-and-fails-silently-on-mobile.md) | Grepped both `saveConfig` implementations for any byte-length or size-constant guard: **zero matches on either client**. Mobile's POST failure still routes through `logger.warn` (`:849-851`). | **Hard dependency.** §5.4 extends its publish-outcome item. |
| [Eval bloat](2025-12-09-encryption-state-evals-bloat.md) | `SpaceService.ts:350` still calls `EstablishTripleRatchetSessionForSpace` with no 4th argument, so it still defaults to ~10k evals per created Space. No mitigation has landed in 8 months. | **Dependency for defaulting the keys tier on.** Not blocking for tiering itself. |
| [Merge asymmetry](2026-08-05-config-merge-lists-are-asymmetric-between-desktop-and-mobile.md) | Re-counted from source: desktop 4 groups, mobile 2. Matches §1.2 exactly. | Should land **before** this; it proposes the shared-declaration pattern §7 builds on. |
| [Mobile 0/3 keys](../../../../quorum-mobile/.agents/issues/.open/2026-08-04-mobile-cannot-key-any-space-it-imported-from-the-config-blob.md) | The failing predicate still cannot be identified from static code (needs a device). But the code shape that produces this failure class is unchanged: `spaceSyncService.ts:133-142` saves keys unconditionally first, while `saveSpace`/`saveEncryptionState` run only after two network calls (`:145-151`, `:153-159`) that each silently `return false` on failure. | **Blocks the keys tier being useful on mobile.** See Trap 3. |
| [Spaces list cross-device](2026-07-31-spaces-list-cross-device-sync.md) | — | The exact precedent for Trap 2 and for the §5.2 cascade. Read before touching either. |
| [P5 freshness](2026-06-13-config-not-refetched-stale-until-restart.md) | — | Independent. Ship whenever. |

---

## §4. Questions only the lead dev / SDK can answer

1. **What is the real maximum payload for `POST /api/settings/{address}`, and what
   does the server return on overrun?** 🔴 **Blocks the size guard's threshold.**
   The two known observations nearly touch (4205 KB accepted, ~4 MB rejected). The
   measurement can be built without this; the threshold cannot.
2. **Can we get a `DELETE /api/settings/{address}`?** So that "off" can mean
   "removed". §5.2 explores a client-side approximation and concludes it cannot
   ship safely as drafted, which makes this question more important, not less.
3. **Does `POST` fully replace the stored blob, or is any prior version
   retained?** (INFERRED that it replaces, from `getConfig` reading a single blob
   — not verified.) Determines whether any client-side approximation of delete is
   worth building at all.
4. **Are the ~10k pre-allocated polynomial evals per created Space required for a
   restored device to function, or can they be re-derived?** Highest-leverage
   question on the list: if they can be re-derived, P1 and P3 both shrink
   dramatically and tiering becomes an optimisation rather than a necessity.

---

## §5. Proposed design

### 5.1 Make `allowSync` device-local

**Addresses P2 (silent re-enable), and the conceptual error that a per-device
decision lives in an account-level field.**

**The semantics, decided:** *off* means **this device does not publish**. It does
**not** mean "this device does not pull".

- Stop reading `allowSync` from an inbound config on both clients. The local
  value is authoritative, always. A new device does not inherit it from anywhere.
- Keep publishing the field for backward compatibility with older clients, but
  treat it as advisory on receipt.
- **Leave the pull ungated**, as it is today (`getConfig` fetches
  unconditionally at `:60`). Rationale: publishing writes a durable, decryptable
  archive; pulling issues one GET to a server the client is already in constant
  conversation with for messages, spaces, inboxes and hub registration. The
  marginal exposure of the config GET is close to zero, and leaving it on is what
  makes recovery work on a device that has not opted into publishing.

**This is what dissolves the fresh-device question.** Once `allowSync` is
device-local, there is no "what do we adopt from the blob" case at all — a fresh
install simply starts at the local default (§10). The only reason that question
ever existed was that a per-device decision was being carried in an
account-level field.

> **That argument silently assumed the local default is inert, and on desktop it
> was not.** `getDefaultUserConfig` stamped `timestamp: Date.now()`, so a fresh
> install did not start neutral — it started *outranking the server*, discarded
> the account's real config unopened, and published an empty one over every other
> device on enabling sync. Fixed 2026-08-07 (`src/utils.ts:27`, now `0`, matching
> mobile), so the argument above holds — but it holds for a reason worth stating,
> not by construction. Anything else this design adds to the fresh-device default
> must carry no timestamp either. Rule 1 covers defaults, not only saves.

**The pull stays ungated — reaffirmed 2026-08-07 by the file's owner.** Both
clients present `allowSync` as a **privacy** control whose stated cost is
metadata visibility (desktop: *"increases metadata visibility of your account,
which can reveal when you have joined new Spaces"*; mobile: *"Increases metadata
visibility."*). Publishing is what creates that trail; reading the blob creates
none. Gating the download would cost freshness and buy no privacy, and it would
strand a sync-off device on a stale picture it can never reconcile.

**One consequence worth stating: an ungated pull makes §5.1 mandatory, not
optional.** A device that pulls but must not publish would otherwise still adopt
`allowSync: true` from a remote blob and start publishing. The two halves only
work together.

**Client work — symmetric on both sides.** Desktop: exclude `allowSync` from the
verbatim spread at `:417`. Mobile: exclude it from the verbatim spread at `:519`.
Same shape, same fix, because neither client has an allow-list (§1.1). Mobile
additionally needs a module-cache refresh if the value is ever read through one.

### 5.2 Publish once on disable — **PARKED, not part of this work**

> **Decision 2026-08-07: parked.** This was only ever a client-side workaround for
> the missing server DELETE (§4.2). It cannot ship safely (the trace below), and
> the proper fix is the endpoint itself, which is already requested. **Nothing
> else in this design depends on it.**
>
> Parking it also removes the one dependency this design had on
> [the ghost-cleanup task](2026-07-19-space-deletion-ghost-cleanup.md). That task
> is now independent and should be scheduled on its own merits.
>
> The analysis is kept because it documents *why* the obvious workaround is
> wrong, which is worth knowing if someone proposes it again. **Until §4.2 is
> answered, the honest UI copy is simply "cannot be deleted yet".**

**Addressed P2 (no delete). Cannot ship in this form.**

The idea: on the transition `true → false`, publish one final minimal config
(`{address, timestamp, allowSync: false}` — no `spaceKeys`, no bookmarks, no
profile), then stop. The readable content at rest becomes an empty object. It
would not be deletion, and the UI copy could not claim it was.

**It does not work, and the failure is worse than a no-op.** Traced end to end
against `getConfig`/`saveConfig` on both clients:

1. The minimal blob's `timestamp` is `Date.now()`, almost certainly newer than
   anything the user's other devices have seen.
2. A second device pulls it, wins on timestamp (`:71-78`), and adopts it
   **verbatim** for every field without an explicit merge (`:417`). Protected:
   `deviceNames`, `conversationSettings`, and `userNotes`/`bookmarks` — the latter
   two live in dedicated CRUD stores and their merge blocks (`:301-330`,
   `:332-404`) only run when the incoming list is non-empty, so an empty remote
   list leaves the real local store alone. **Not protected:** `spaceIds`, `items`,
   `spaceKeys`, `notificationSettings`, `mutedChannels`, `mutedConversations`,
   `favoriteDMs`, and the profile fields.
3. That device's sidebar empties immediately. `recordSpaceListShrinkOnAdopt`
   fires but is diagnostic-only and does not block adoption. Desktop can recover
   Spaces via Settings → Restore Spaces, since the Space rows are not deleted.
   Notification settings, mutes, favourites and profile fields have **no
   equivalent recovery** and simply reset.
4. **It cascades.** That device's next `saveConfig` narrows `uploadConfig.spaceIds`
   by intersecting the caller-provided `config.spaceIds` (now empty) against
   freshly-collected `spaceKeys` (`:608-627` desktop, `:728-746` mobile). It does
   **not** re-derive `spaceIds` from the real local Space table. Because
   `config.spaceIds` started empty, `droppedSpaceIds` computes to empty, so the
   refuse-to-publish guard does **not** trip, and the device re-publishes an empty
   Space list with a newer timestamp — propagating the wipe to every other device,
   including the one that disabled sync.
5. Present symmetrically on both clients. This is not a new bug in isolation; it
   is a new *trigger* for the failure class
   [the cross-device umbrella task](2026-07-31-spaces-list-cross-device-sync.md)
   §2b already documents, reproduced three times on 2026-08-04.

(INFERRED-from-code: strongly evidenced by trace, not observed on devices.
Confirm with a real two-device test before treating as settled.)

**Two ways forward, neither yet chosen:**

- **(a)** Fix the pull side first — stop trusting an empty or absent
  `spaceIds`/`items`/`spaceKeys` verbatim. This is what the umbrella task is
  already working toward for a different trigger, so §5.2 would come free once it
  lands.
- **(b)** Make the final publish safe some other way: refuse or defer it when
  more than one device is known, or publish the account's real Space list
  unchanged and clear only the fields actually meant to go away.

Until one of those exists, the honest UI copy is "cannot be deleted yet", and the
real answer is §4.2.

### 5.3 Tier the payload

**Addresses P3, and it is the prerequisite for any sensible default.**

Same endpoint, same blob, same encryption. The client decides whether `spaceKeys`
is included. Because the server sees only ciphertext, this is entirely a
client-side protocol change.

- **Settings tier** — profile, bookmarks, mutes, notification settings, privacy
  toggles, device names, user notes, conversation settings. ~40 KB. Always fits.
- **Keys tier** — `spaceKeys` and their encryption states. MB-scale. The durable
  archive. The thing that actually breaks.

#### 🔴 Trap 1: the bidirectional filter would disable sync entirely — CONFIRMED

`saveConfig` filters `spaceIds` down to those with keys, then filters keys down to
those in `spaceIds`: [`ConfigService.ts:608-627`](../../../src/services/ConfigService.ts#L608)
desktop, [`configService.ts:728-746`](../../../../quorum-mobile/services/config/configService.ts#L728)
mobile. Same shape on both.

> **Terminology, because it is easy to misread.** There is **no key-backup
> control in the app today** — `allowSync` is a single switch, and when it is on
> the upload always includes `spaceKeys`. "Keys tier" throughout this section
> means the **proposed** child toggle introduced above, whose draft label is
> "Also back up Space keys" (§6.2). Trap 1 is therefore a hazard in this design,
> not a defect users are hitting now.

**In plain terms — what a save does today:**

1. Collect your Spaces and their keys.
2. Drop any Space that has no keys, so we never publish a Space we cannot prove
   we are in.
3. Drop any keys whose Space is no longer in the list.
4. If step 2 dropped anything at all, refuse to publish the whole config.

**Now suppose we ship the keys tier and a user switches it off, changing nothing
else in `saveConfig`:**

1. Collect your Spaces, but deliberately collect **no** keys.
2. Step 2 sees "no keys" for *every* Space, so it drops *every* Space. The list is
   now empty.
3. Nothing left to reconcile.
4. Step 4 sees that everything was dropped, and refuses to publish.

**Result: turning off key backup turns off sync entirely.** Nothing uploads
again, and per P4 nothing tells the user. Traced through the real conditionals:
`validSpaceIds` empty → `uploadConfig.spaceIds` filters to `[]` → `finalSpaceIds`
empty → `droppedSpaceIds` equals the entire input list → the
`if (droppedSpaceIds.length > 0)` branch holds → the `else` containing the POST
never runs.

**The fix is one requirement:** steps 2-4 must distinguish *"no keys because the
user opted out of key backup"* from *"no keys because something is broken or
mid-sync"*. The first should publish the Space list with no keys attached; only
the second should hold.

**The Space list keeps being published either way.** That is not a separate
design choice, it is part of this same requirement, and it matters for a reason
that is easy to miss: the list is not for a fresh device, which legitimately gets
nothing without keys. It is for the user's **other existing devices**, which
already hold those Spaces locally and use the list for sidebar order and folder
grouping. Publishing an empty list instead is precisely what empties desktop's
sidebar — see [the cross-device umbrella](2026-07-31-spaces-list-cross-device-sync.md).

This is the single most likely way to ship a regression here.

#### Trap 2: who is hurt if the Space list ever does go out empty

Trap 1's requirement is what prevents this, so this section is here to record the
blast radius rather than to pose a second question.

**The exposure is one-sided, and it is desktop.** Desktop's nav is config-driven:
`useNavItems.ts:52-57` walks `config.items` and resolves each id against the local
Space table, silently skipping what it cannot resolve. It degrades rather than
crashing, but what it renders is still whatever the config says. Mobile's nav is
storage-driven — `app/(tabs)/spaces/index.tsx:98` calls `useSpaces()`, which
resolves through `hooks/chat/useSpaces.ts:8-14` to the storage adapter, with no
reference to `config.items` or `spaceIds` anywhere in the screen (READ, verified
directly 2026-08-07). **An incoming config cannot remove a Space from mobile's
screen.** It can only affect what mobile subsequently publishes, which Trap 1
covers.

Two things follow:

- A fresh device restoring from a settings-tier blob shows an **empty sidebar**,
  not a list of Spaces it cannot open — because the nav resolves against a local
  Space table that is empty on a fresh device. That is the correct and expected
  consequence of having key backup off, not a defect needing an empty-state.
- The precedent for getting this wrong is real and recent:
  [the cross-device umbrella](2026-07-31-spaces-list-cross-device-sync.md) §2b,
  three reproductions on 2026-08-04. Its publisher-side trigger has since been
  fixed (#228/#229), but **the receiver still trusts any list it is handed**, so
  the protection here has to come from the publish side — i.e. from Trap 1.

#### Trap 3: mobile may not be able to use the keys tier at all

A mobile device has been observed unable to key **any** Space it imported from
the blob, and that issue is still live (§3). Shipping a "Back up Space keys"
control on mobile would promise a recovery that does not work. **Resolve that
issue first, or scope the keys tier to desktop for its first release and say so
in the UI.**

### 5.4 Report the outcome

**Addresses P4.** Extends the size-guard issue's proposal to store
`lastPublishedAt` / `lastPublishOutcome`, with one addition: **surface it in
Settings**, next to the toggle. "Last synced: 3 minutes ago" / "Not syncing:
payload too large" / "Sync is off".

Without it, none of the above is verifiable by a user, and tiering adds a fifth
indistinguishable state rather than removing the existing four. On mobile this
must not go through `logger.*` (§1.2).

---

## §5.5 Multi-device resilience — the three rules

Everything fragile in this subsystem comes from one root: **a single shared slot,
one timestamp, whole-blob overwrite.** Any design here has to survive a user with
three or four devices toggling sync on and off over months, in any order. These
rules are what make that safe. They are stated here because they were previously
implicit, and every failure this document records is one of them being broken.

### Rule 1 — Publishing earns the timestamp

A device that did not publish must not advance its timestamp. Otherwise it drifts
ahead of the server while nobody is watching, and the moment it *does* publish, it
wins every comparison and overwrites devices that were more current than it.

> **✅ SHIPPED 2026-08-07** in desktop #320 and mobile #243, ahead of the slices
> in §8. Rule 1 is no longer an aspiration for this
> design to deliver; it is a property the code now has, and later slices must not
> regress it. See
> [the issue](../2026-08-07-a-device-with-sync-off-still-claims-a-newer-timestamp.md).

Worked example, which is the scenario this design must not make worse: device A
syncs daily; device B has sync off but is still used, so its timestamp climbs;
the user enables sync on B; B ignores the server as "older", publishes its
months-stale picture, and A adopts it wholesale.

**What was actually wrong, corrected from the original filing.** The rule existed
as a comment in *each* client's refuse-to-publish branch — desktop's landed
2026-07-31 in `4a04a8b24` (PR #282), so the claim that it was missing "from
desktop at all" was wrong. Both clients had it in exactly one of the paths that
needed it. Four were fixed:

| Path | Client | Was |
|---|---|---|
| `allowSync === false` | both | advanced the timestamp |
| no keypair to sign with | mobile | advanced the timestamp |
| POST failed | mobile | advanced the timestamp — the "black hole" its own warning at `:865` described |
| `getDefaultUserConfig` | desktop | stamped `Date.now()` (`src/utils.ts:27`, mobile always used `0`) |

The last one is the one this design most needs to know about, because it is not a
drift at all: a device that had published nothing and read nothing still
outranked the account's real blob, discarded it unopened, and on enabling sync
published an **empty** config over every other device. Same catastrophic outcome,
reached on a brand-new install.

Each fix was reverted independently and confirmed to turn its test red, with a
control arm asserting that a config which *does* reach the server still advances
its timestamp. Desktop 1133 tests, mobile 631.

**Not fixed, and deliberately so:** desktop's `saveConfig` has no `try/catch`
around the POST, so a failed publish throws and the local write never happens —
the change is lost rather than mis-timestamped.
[`useUserSettings.ts:428-432`](../../../src/hooks/business/user/useUserSettings.ts#L428)
relies on that throw to roll back a public-profile publish. Making desktop match
mobile here needs its own issue.

### Rule 2 — Absence is never deletion

A field or list entry that is missing from an incoming config means *"not sent"*,
never *"removed"*. Removal has to be explicit.

This is the same principle as the tombstones in
[the ghost-cleanup task](2026-07-19-space-deletion-ghost-cleanup.md), and it is
what makes §5.3's keys tier safe: a blob with no `spaceKeys` must not be read as
"this user has no Spaces". It is also the rule that §5.2 broke, which is why §5.2
is parked.

### Rule 3 — Merge per field, not per blob

One timestamp for the whole object means any concurrent edit on another device is
discarded rather than combined. This is P6, it is the largest piece of work in
this plan, and it is the only thing that makes "changes made while sync was off"
survivable rather than merely safe.

Rules 1 and 2 are cheap and remove the catastrophic cases. Rule 3 is expensive and
removes the merely annoying ones. Ship them in that order.

### What these rules mean for the toggle matrix

With all three, the on/off/on matrix behaves predictably no matter how many
devices the user has:

| Situation | Behaviour | Status |
|---|---|---|
| Device has sync off | Drifts locally. Never claims authority. Never publishes. | ✅ true today (Rule 1 shipped) |
| Device turns sync on after a long time off | Adopts the server's state first, then publishes the merged result. Cannot clobber. | ✅ true today — desktop already pulled first at `useUserSettings.ts:350`; mobile now does via `setAllowSync` |
| Device turns sync off | Simply stops publishing. Nothing is sent, so no other device is affected. | ⚠️ not yet — `allowSync` is still account-level and rides the blob. Needs §5.1 |
| Two devices edit different things | Both survive (Rule 3). | ❌ not yet — needs P6 |
| A device cannot key its Spaces mid-sync | Holds rather than publishing a short list, and keeps its old timestamp (Rule 1). | ✅ true today |

**Note on row 2.** The timestamp rule alone does not deliver it. When the user
flips the toggle the device genuinely publishes, so it genuinely earns a fresh
timestamp — a *correct* timestamp on a *stale* picture, which the other devices
then adopt. Pulling before publishing is what closes it, and it is now a property
of `setAllowSync` in mobile's service rather than of a settings screen, so a
future caller toggling `allowSync` through `updateConfig` cannot reintroduce the
wipe. Any work in §8 that adds another way to flip this field must route through
that function.

**Test the matrix, not the happy path.** §9's two-device checks are the minimum;
a three-device run with staggered toggling is what actually exercises these rules.

---

## §6. The UX question

Settings → Privacy is already dense (eight rows on desktop). A second sync switch
sounds like it makes that worse. It does not, for one specific reason.

### 6.1 The parent/child pattern already exists in this exact panel

Delivery receipts → Read receipts is already a parent with an indented child,
**hidden when the parent is off** ([`Privacy.tsx:190`](../../../src/components/modals/UserSettingsModal/Privacy.tsx#L190))
and **cascading off with it** ([`:169`](../../../src/components/modals/UserSettingsModal/Privacy.tsx#L169)).
Mobile mirrors it (`ProfileModal.tsx:4429`). (READ)

So tiered sync is not a new UX concept here. It is the same shape users already
meet two rows down:

```
[x] Sync settings across devices
     └ [ ] Also back up Space keys
```

**Recommendation:** match the receipts treatment exactly — child indented, hidden
while the parent is off, cascading off with the parent. Net change to the panel
at rest: **zero extra rows when sync is off**, one when it is on.

### 6.2 Naming carries most of the weight

The two tiers are not "more sync" and "less sync"; they are different promises.

- Parent: **"Sync settings across devices"** — *"Your profile, bookmarks and
  preferences stay the same on every device. Your device tells the server when
  something changes, but never what."*
- Child: **"Also back up Space keys"** — *"Lets you get your Spaces back on a new
  device. Stores an encrypted copy of your Space keys on the server. This is the
  only way to recover a Space if you lose this device, and it cannot currently be
  deleted once uploaded."*

The last clause stays until §4.2 is answered. It is unpleasant and it is true.

### 6.3 Tiering alone does NOT fix the data-loss problem

The recovery value is almost entirely in the **child**. Defaulting parent ON and
child OFF gives a product that *feels* synced while still losing every Space on
device loss. Oversold, that manufactures confidence. The copy above deliberately
avoids overselling it.

| Stage | Parent default | Child default | Blocked on |
|---|---|---|---|
| Now | OFF | OFF | — (today's behaviour) |
| After §5.3 + size guard + §5.4 | **ON** | OFF | nothing external |
| After [eval bloat](2025-12-09-encryption-state-evals-bloat.md) + §4.1 + mobile 0/3 | ON | **ON** | lead dev (§4.1), SDK (§4.4) |

### 6.4 Compatibility with the privacy-levels idea

A preset (Low / Normal / High / Custom) works cleanly over two booleans — it just
writes both. Two notes for whoever builds it:

- The tiers do **not** sit on the same privacy axis. The parent leaks an activity
  timeline; the child leaves a durable key archive. A "High privacy" preset should
  turn the child off before the parent.
- Tiering **helps** the preset idea: with one boolean, a privacy preset has to
  choose between "no sync at all" and "full key archive", which is exactly the
  false choice P3 describes.

---

## §7. What belongs in quorum-shared

The merge-asymmetry issue argues for a **single shared declaration** rather than
mirrored implementations, on the grounds that a declaration is harder to let
drift. This design agrees and extends it.

| Candidate | Why shared |
|---|---|
| Tier composition (which fields belong to which tier) | Both clients must agree exactly, or a blob written by one is misread by the other. A declared list, not two switch statements. Follows the `conversationSettingsUtils.ts` precedent: shared helper plus shared tests. |
| The tier-aware `spaceIds`↔`spaceKeys` consistency filter | Trap 1 is a correctness rule, not a preference. Currently duplicated and already divergent in its inputs (§1.2). |
| `syncTiers` marker on `UserConfig` (if B2/B3) | Type change; additive. Needs a shared declaration so both clients can read it. It does **not** need registering anywhere else — an undeclared field already rides through both clients' verbatim spread. |
| Publish-outcome type (`lastPublishOutcome` enum) | Both clients store and render it. Additive. |
| **Rule 1 itself — "publishing earns the timestamp"** | Shipped 2026-08-07 as two parallel implementations, which is exactly the shape that produced the merge asymmetry. It was already written down, correctly, as a comment inside one branch of each client — and still failed to reach the other four paths that needed it, including one whose own warning described the consequence. A rule recorded at the site that obeys it is invisible from the sites that do not. A shared `earnedTimestamp(incoming, published)` helper, or at minimum a shared test suite both clients run, is the durable form. |

**Not shared:** transport, storage adapters, UI. Those are legitimately
platform-specific.

**Sequencing:** shared is additive-and-publish, so shared changes must land and be
published before either client can consume them, and desktop needs `yarn build`
on shared's dist before its app sees them.

---

## §8. Proposed sequencing (vertical slices)

Each slice ends in something observable without reading a diff.

**Slice 0 — "A device that did not publish cannot overwrite one that did." ✅ SHIPPED
2026-08-07**, ahead of this plan, in desktop #320 and mobile #243. Rule 1 across all four non-publishing paths, plus desktop's
fresh-device default, plus pull-before-enable on mobile. *Observable:* a device
used with sync off no longer stops receiving the other devices' changes, and
enabling sync on it no longer wipes them. It is listed here so the numbering
below reads as "what is left", not "what was planned".

1. **Slice 1 — "Sync tells you what it did."** §5.4 plus the size guard's measure
   and warn. *Observable:* Settings shows "Last synced: …" or a real reason it did
   not. **No behaviour change.** Ship first: it is the instrument every later
   slice is verified with.
2. **Slice 2 — "Off stays off."** §5.1 device-local `allowSync`. *Observable:*
   turn sync off on device A, use device B, restart A, it is still off.
3. **Slice 3 — "Choose what leaves."** §5.3 tiering, with Traps 1-3 resolved.
   *Observable:* turning off key backup keeps settings syncing and shrinks the
   blob by ~98%.
4. **Slice 4 — defaults.** Flip the parent per OPEN DECISION C.
5. **Slice 5 — freshness (P5) and field-level merge (P6).** Independent, largest,
   last.

§5.2 is deliberately absent from this list: it is **parked**, and the real answer
to what it was trying to do is the server DELETE (§4.2). Nothing in slices 1-5
depends on it, and with it parked **this design depends on no other in-flight
task** — only on §4.1 for the size-guard threshold.

---

## §9. Verification strategy

The instrument is `.agents/tools/dm-debug/08-self-identity-sources.js`, which
prints blob size broken down by part, plus the publish states.

**Non-negotiable rules, both learned the hard way on this subsystem:**

- **Any blob measurement taken without forcing a fresh `saveConfig` is a lower
  bound.** `config.spaceKeys` is a snapshot written by the last save, not a live
  view. The same account read 873 KB and 4205 KB an hour apart with no user action
  in between beyond a settings toggle. Measure the payload **about to be sent**,
  never `sizeOf(storedConfig)`.
- **Revert each fix and confirm the test goes red.** Named explicitly because
  three of the four states in P4 are indistinguishable, so a test that "passes"
  here proves very little by default.
- **Include a control arm.** When measuring a size reduction, include a field that
  should not change.

Cross-cutting checks:

- [ ] Two-device matrix: every combination of (parent on/off) × (child on/off) on
      each client, in both directions, including desktop↔mobile.
- [ ] **Three-device staggered-toggle run** (§5.5). One device off for a while and
      used locally, then switched on; a second publishing throughout; a third
      offline and joining late. This is the run that exercises Rules 1-3, and the
      two-device matrix does not substitute for it.
- [ ] Old-client compatibility: a current production build reading a tiered blob.
      This is Trap 2 and it must be tested against a real older build, not a mock.
- [ ] Turning the child off does not stop settings publishing (Trap 1).
- [ ] A fresh device restoring from a settings-tier blob does not lose its sidebar
      and does not silently re-enable anything.
- [ ] If §5.2 is ever unblocked: a two-device test confirming the disable-publish
      does not empty or cascade to the second device.

---

## §10. Open decisions

Deal with these in order. Only the last one is a genuine product decision; the
first three are unblocks and scoping calls.

### 1. Get the real payload limit from the lead dev (§4.1)

Blocks the size guard's threshold, which is Slice 1, which is the instrument
every later slice is verified with. It is also the only item here you cannot
unblock yourself.

### 2. Settle whether the keys tier can ship on mobile at all (Trap 3)

A mobile device has been observed unable to key any Space it imported from the
blob, and that issue is still live. Either resolve it, or scope key backup to
desktop for its first release and say so in the UI. This is a scoping call with
product consequences, not a technical unknown.

### 3. The defaults — the one real product decision

Default the settings tier ON while key backup stays OFF, per the staged table in
§6.3? No objection on its own terms, and the copy in §6.2 is written to avoid
overselling what it does. Two constraints on the timing:

- It must not ship in the same wave as any unmitigated §5.2 work. More devices
  actively syncing means more chances for one to land on a minimal disable-blob
  as "newest".
- Be honest in the release notes that it does not protect Spaces. The recovery
  value is in the child toggle, and §6.3 exists to keep that from being oversold.

### Resolved, recorded here so they are not reopened

- **Off means "do not publish", not "do not pull".** Publishing writes a durable
  decryptable archive; pulling is one GET to a server the client already talks to
  constantly. Decided in §5.1.
- **A new device does not inherit `allowSync` from anywhere.** Making it
  device-local removes the question rather than answering it. §5.1.
- **The Space list is always published, whatever the key tier says.** This is a
  requirement inside Trap 1, not a design choice with alternatives. §5.3.
- **"Publish an empty config on disable" is parked.** It was a workaround for the
  missing server DELETE, it cannot ship safely, and the real answer is §4.2. §5.2.
- **This design has no dependency on the ghost-cleanup / Spaces-list work.**
  Parking §5.2 removed the only link. That task stands on its own.
- **Rule 1 ships independently of this design, and already has** (2026-08-07,
  Slice 0 — desktop #320, mobile #243). It was cheap, it removed the catastrophic case, and nothing in §8
  depended on it landing first — but everything in §8 must now avoid regressing
  it. §5.5 carries the detail.

---

## Definition of Done

This document is a design. It is done when:

- [ ] §4 questions are put to the lead dev, and §4.1 has an answer
- [x] An independent review pass has verified the architecture claims (2026-08-07)
- [x] The fresh-device and tier-absence questions are resolved and folded into
      §5.1/§5.3 (2026-08-07) — see §10 "Resolved"
- [ ] The defaults decision (§10.3) is made by the owner
- [x] §5.2 parked, removing this design's only dependency on other work (2026-08-07)
- [ ] Each slice in §8 is split into its own issue with its own verification
- [ ] The stale doc claims found here are corrected (§1.1 mobile publish guard;
      `config-sync-system.md` §Bidirectional filtering)

---

*Last updated: 2026-08-07*

## Change Log

**2026-08-07 — Rule 1 shipped, doc reconciled against it.** Desktop #320 and
mobile #243 landed §5.5 Rule 1 ahead of this plan. Updated here: §1.1 stamp row now cites the capture and
restore points on both clients; §5.5 Rule 1 rewritten from "currently violated on
both clients" to shipped, with the corrected history (desktop was **not** missing
it entirely — PR #282 added it to the refuse-to-publish branch on 2026-07-31) and
the two paths the original filing missed (mobile's no-keypair and POST-failure
branches); §5.5's toggle matrix now marks each row true-today vs still-pending;
§5.1 gained a callout that its fresh-device argument depended on the local
default being inert, which desktop's `getDefaultUserConfig` was not; §5.1 records
the owner's reaffirmation that the pull stays ungated, with the reasoning from the
clients' own privacy copy; §7 gained Rule 1 as a shared-declaration candidate;
§8 gained Slice 0. No claim in §2-§4, §6 or §9 changed.

## Review Log
**2026-08-07 - claude-opus-5**: Independent adversarial pass across quorum-desktop, quorum-mobile, quorum-shared. Verified every READ-labeled claim against current source (not trusted from the doc), re-verified the four dependency issues against current code per an explicit code-is-law instruction mid-review, traced Trap 1/Trap 2 through actual conditionals, and found one new severe risk in Section 5.2 the author had not considered.
- §1.2's central claim that mobile uses an inbound 'allow-list' was WRONG — mobile's getConfig spreads ...decryptedConfig verbatim (configService.ts:519) then re-overrides ~10 fields for merge/defensive reasons, exactly like desktop; a field not in that list still survives. Corrected the table, added a sourced callout, and fixed downstream assumptions in §5.1, Trap 2, and the OPEN DECISION B note.
- Trap 1 (bidirectional filter disables sync when keys tier is off) CONFIRMED on both clients by tracing the real conditionals at ConfigService.ts:608-627 (desktop) and configService.ts:728-746 (mobile) — the doc's citation had pointed at the architecture doc's illustrative snippet, not real source; corrected. Trap 2 PARTIALLY CONFIRMED: desktop's nav (useNavItems.ts) degrades gracefully by Space-row presence rather than crashing, and mobile's Spaces UI is storage-driven per the cross-device umbrella doc (2026-07-31-spaces-list-cross-device-sync.md), so it is structurally immune to this trap as a receiver — this makes B1 safer than the original framing credited, not riskier.
- New finding not in the original doc: §5.2's 'publish once on disable' can cascade-wipe a SECOND device rather than merely 'achieve nothing.' Traced end to end (getConfig verbatim-adopts non-merged fields on a fresh higher timestamp; that device's own next saveConfig then re-publishes the now-empty spaceIds because it narrows from its own caller-provided list rather than re-deriving from the local Space table, propagating the wipe with a newer timestamp). Filed as a Blocker recommending §5.2 not ship unmitigated. Also re-verified all four dependency issues (mobile 0/3 keys, size-guard, merge-asymmetry, eval-bloat) directly against current code per the file owner's mid-review instruction — none were stale; all four remain live, current problems with citations refreshed where needed. Recorded (not resolved) recommendations on OPEN DECISIONS A/B/C in a new Blockers section, and added a full Independent Review Findings section documenting every verified/corrected claim.
