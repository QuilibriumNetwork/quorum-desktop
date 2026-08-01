---
type: doc
title: "Identity resolution and profile sync (canonical model)"
status: done
ai_generated: true
created: 2026-07-16
updated: 2026-08-01
related_docs:
  - "qns-username-display.md"
  - "user-config-sync.md"
  - "../config-sync-system.md"
related_tasks:
  - ".agents/tasks/port-from-mobile/.done/2026-06-08-port-public-profile.md"
  - ".agents/tasks/.done/2026-06-10-space-message-list-public-profile-fallback.md"
---

# Identity resolution and profile sync (canonical model)

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> Applies to BOTH apps (desktop + mobile). Written 2026-07-16 during the
> per-space-profile follow-global work, after tracing every write/read path
> in both codebases. This is the one place that explains how a user's
> name/avatar/bio flows through the system. Read this BEFORE touching any
> profile, member-roster, or public-profile code.

## The question this answers

"Which name/avatar/bio does user X show, on which surface, and how does a
change made on one device reach everyone else?"

## The three storage channels

A user's identity lives in three places. Each has ONE job. Most historical
bugs came from these three competing instead of layering.

| # | Channel | What it is | Audience | How it moves |
|---|---------|-----------|----------|--------------|
| A | **Encrypted UserConfig** (`name`, `profile_image`, `bio`) | Your private, encrypted settings blob on the Quorum API | **Your own other devices** | `saveConfig` on edit; `getConfig` on startup/login (timestamp LWW). No live push — other devices see it on restart or incidental re-pull. |
| B | **Published public profile** (`GET/POST /users/:addr/public-profile`) | Signed plaintext record: `display_name`, `profile_image`, `bio`, `primary_username` | **Everyone else** — both strangers (DM headers, lookups) AND spacemates (as the global fallback in the precedence ladder) | Published on global-profile save when `isProfilePublic=true`; fetched on demand with a 1h React Query cache (`publicProfileQueryKey`). Opt-in. |
| C | **Space member roster** (`SpaceMember.display_name` / `user_icon` / `bio`) | Per-space member rows, one per (space, member) | **Members of that space** | `update-profile` messages sent into the space; receivers upsert with a `profileTimestamp` staleness guard (skip if `existing >= msg.createdDate`). |

Plus render-only inputs: QNS `primary_username` (travels ONLY in B, never in
messages) and the truncated address as final fallback.

## What the public-profile feature IS (and is not)

It is the **opt-in "be discoverable" feature**: when ON, people who do NOT
share a space with you (a stranger DMing you, an address lookup) see your
name/avatar/bio instead of your raw address. It is also the only carrier of
`primary_username` (the `.q` name) and of your **global** display name as
data that the precedence ladder can fall back to inside spaces.

It is NOT the primary mechanism by which spacemates see your name — that is
the space roster (channel C), fed by `update-profile` messages. The
public-profile server is consulted for a spacemate only as a FALLBACK when
their roster entry lacks a field (see precedence below).

The toggle does NOT gate reachability (QNS resolution is public); it only
gates whether Quorum displays your profile data to non-spacemates.

## The precedence ladder (render time)

From `qns-username-display.md`, implemented by the shared
`resolveDisplayName` + per-app adapters (`resolveSpaceMemberName` /
`resolveMemberName` on desktop; mobile merges via
`useMembersWithPublicProfileFallback.pickField`):

```
custom per-space name (C override)  →  QNS primary username .q (B)
  →  global display name (C global slot, else B)  →  truncated address
```

- **Space surfaces:** deliberate per-space override wins; else QNS; else the
  member's global name (from the roster GLOBAL SLOT if present — the live push,
  works for non-public users — else the public profile); else address.
- **DM / global surfaces** (no per-space concept): QNS → global → address.
- Avatar and bio follow the same "override → global slot → public" idea (no QNS
  step). The global slot is the tier added by the two-slot model (below); it
  sits between the override and the public profile.

## The two-state per-space model (follow-global, 2026-07-15/16)

A per-space field is an OPTIONAL OVERRIDE with exactly two states:
- **absent/empty = follow global** (default): the space renders your current
  global value, dynamically.
- **non-empty = override**: replaces the global value in that space only.

There is NO per-space "explicitly blank" state. Wire semantics for
`update-profile` fields: **omitted = no change; `''` = deliberate clear
(revert to follow-global); value = set override.**

### Why: the roster-stamping problem

Historically BOTH apps copied the user's global name/avatar into the space
roster (channel C) at join, at space creation, on every reconnect
rebroadcast, and on every global save. Consequences:

1. Roster rows couldn't distinguish "deliberate per-space name" from
   "copied global default" — desktop built the comparison trick in
   `resolveSpaceMemberName` (roster == global ⇒ treat as default) to guess.
2. Global changes did NOT propagate to spaces (rows were frozen copies).
3. "Clear my per-space name" was inexpressible (clearing re-showed the
   global, which then got re-stamped).
4. Your own devices raced each other: each device's global save re-stamped
   every space with ITS value; last device to save/reconnect won the roster.

The follow-global work removes the OVERRIDE-field stamping so a non-empty
override roster field means a REAL override. This SHIPPED 2026-07-16 (branch
`follow-global-profile`, both repos): the on-connect/tag-rotation rebroadcasts,
space creation, and the editor saves no longer write the global value into the
override fields. The `resolveSpaceMemberName` comparison trick is now a legacy
safety net (it neutralizes old stamped rows for free) rather than load-bearing.

## The TWO-SLOT wire model (what actually shipped)

Rather than remove the global-save space broadcast entirely (which would have
left spacemates dependent on channel B's 1h cache, and broken it for
non-public users), `update-profile` messages carry TWO clearly-labeled groups
of fields, stored SEPARATELY on the member row:

- **Override slot** — `displayName` / `userIcon` / `bio` (wire) →
  `display_name` / `user_icon`(desktop) or `profile_image`(mobile) / `bio`
  (storage). A deliberate per-space override. Guarded by `profileTimestamp`.
- **Global slot** — `globalDisplayName` / `globalUserIcon` / `globalBio` (wire)
  → `global_display_name` / `global_user_icon`(desktop) or
  `global_profile_image`(mobile) / `global_bio` (storage). The sender's current
  global identity. Guarded (mobile) by a SEPARATE `globalProfileTimestamp`.

The wire field names are identical across apps (byte-for-byte); only the local
STORAGE field names differ (desktop `global_user_icon` vs mobile
`global_profile_image` — each app reads its own storage). The global* fields
are additive; old clients ignore them; the message signature is unaffected
(`canonicalize` only hashes `type + displayName + userIcon`).

> Not yet in the shared `UpdateProfileMessage` type — carried via casts. See
> the follow-up task `2026-07-16-quorum-shared-type-two-slot-global-identity-fields`.

## How a global profile change propagates (shipped model)

User edits global name/avatar/bio on device D1 (`UnifiedProfileEditModal.
saveQuorum` on mobile / `useUserSettings` → `MessageDB.updateUserProfile` on
desktop):

1. **Local + channel A:** update local user state; `saveConfig` (encrypted,
   timestamped). D2 picks it up on restart/next pull (no live push — known gap).
2. **Channel B:** if `isProfilePublic`, publish the signed public profile
   (server keeps latest by timestamp = LWW across devices). Local
   `publicProfileQueryKey` cache is optimistically updated + invalidated on
   the saving device.
3. **Channel C — GLOBAL SLOT (the live push):** send an `update-profile` to
   every space carrying ONLY the global* slot (never the override fields).
   Spacemates store it in the separate global slot and render it via the
   precedence ladder immediately — no dependence on B's 1h cache, and it works
   for NON-PUBLIC users too. The editing device also writes its own roster
   global slots locally for instant self-render.
4. **DMs:** unchanged — DM identity is pushed to partners via the existing
   `dm-update-profile` broadcast (global value; DMs have no override concept).

A per-space override edit (Space Settings → Account) is the ONLY thing that
writes the OVERRIDE slot: value / `''` (clear = follow global) / omitted (no
change) per the wire semantics above.

The on-connect announce and the tag-rotation rebroadcast both send the
override-or-omit fields AND the current global slot, so a spacemate who missed a
live save still learns the identity on the next reconnect.

> ⚠️ Until 2026-08-01 desktop had NO on-connect announce — only join and tag
> rotation, and tag rotation is not connect-triggered despite what an earlier
> version of the table below claimed. A member who joined while you were offline
> therefore never got a second chance and rendered as a truncated address
> indefinitely (46 of 89 senders on one test space). The announce added then is a
> **bootstrap, not a cadence**: it is capped at 3 attempts per identity
> (`src/utils/spaceProfileGate.ts`) because past that the receiver-driven member
> digest exchange (`requestSync` → `MemberDigest` → `MemberDelta`) is the repair
> path. The digest can reconcile rows two peers disagree about; it cannot invent
> a member neither side has heard of, and that gap is the only thing the
> announce exists to close.

## Why a name goes missing, and what repairs it (convergence model)

> Added 2026-08-01. Everything above describes what the data IS. This section
> describes how it CONVERGES — which is where every "member shows as a
> 6-character address" report actually comes from. If you read one section
> before touching this area, read this one.

### The premise that explains every symptom

**A user's name and avatar are not stored anywhere that others look up.** In a
space, another member has a copy only because somebody's client SENT it while
that member's client was listening. Miss that moment and you have nothing, and
for a long time nothing ever said it again.

The single exception is channel B (the published public profile), which IS a
server-side lookup available at any time to anyone. **It is OFF by default**
(`config?.isProfilePublic ?? false`, `useUserSettings.ts`). So for most users the
safety net people assume exists catches nothing, and identity depends entirely
on peer-to-peer traffic.

### Three mechanisms, and which platform has which

| Mechanism | What it does | Desktop | Mobile |
|---|---|---|---|
| **Roster PULL** — `requestSync` → `MemberDigest` → `MemberDelta` | On connect, ask the space "here is a fingerprint of every member I know; what am I missing?" Any online peer replies with the missing rows — **for every member it knows about, not just itself**. One informed peer can populate your whole roster in one exchange, including members who are offline right now. | ✅ | ❌ removed (`WebSocketContext.tsx:1297-1303`) |
| **Identity PUSH — on change** | A global profile save broadcasts `update-profile` to every joined space immediately. | ✅ | ✅ |
| **Identity PUSH — on connect (bootstrap)** | Announce our identity on connect, so members who have NO row for us get one. Capped (3 per identity) because it only has to cover what the pull cannot. | ✅ since 2026-08-01 | ⚠️ once ever, no expiry |
| **Durable replay** | Does a member who was OFFLINE receive it later? | ❌ none for control messages | ✅ hub log replays `update-profile` on reconnect — **but only from their join point**; pre-join history is never delivered |

**The pull is the main mechanism, not the push.** This is the thing most easily
misread: an announce reaches only whoever is listening at that instant, whereas
one pull can repair an entire roster. The push exists to cover the one case the
pull cannot — a member nobody has ever heard of, so there is no row to compare.

### Why it was broken for so long

The pull existed all along and **never worked**. `computeMemberHash` built its
fingerprint from the OVERRIDE slot only, which the follow-global work (2026-07-16)
deliberately stopped populating — so nearly every member hashed as "no identity".
Two clients with completely different rosters therefore always agreed they were
in sync and exchanged nothing. Fixed 2026-08-01 (shared #71 + desktop #290); see
`.agents/bugs/2026-08-01-space-sync-member-delta-blind-to-and-erases-global-slot.md`.

So the pull went from "never worked" to "works", and the bootstrap push was added
on top. Both landed the same day and **neither has been measured on a live space**
(that is Step 4 of `2026-08-01-identity-announce-cadence-research.md`).

### Where it stands per platform pairing

| Viewer | Looking at a DESKTOP member | Looking at a MOBILE member |
|---|---|---|
| **Desktop** | repaired — pull, plus the bootstrap push | **still broken** — that member announced once, long ago, and does not participate in the pull |
| **Mobile** | repaired — the desktop push reaches it, and mobile's receive/upsert/two-slot merge are all correct | **still broken** — same cause, and mobile cannot pull either |

Mobile's RECEIVE side is not the problem and never was: it upserts a missing row,
stores both slots with independent timestamp guards, and renders the precedence
ladder correctly. **Mobile's problem is entirely on the SEND side plus the absent
pull.**

### What would actually close the gap

> ⚠️ **Corrected 2026-08-01.** An earlier version of this section recommended
> "give mobile the roster pull". **Do not do that.** It reads as the obvious fix
> and it points against the architecture. Reasoning below.

**Mobile did not lose a feature when its sync handlers were removed.** It moved
to a strictly better transport, and the P2P roster pull became redundant *for the
job it was doing*. From `quorum-mobile/.agents/docs/message-transport-architecture.md`:

- Spaces are **a durable append-only log with a per-hub cursor**, replayed via
  `log-since` on every reconnect/foreground. The log carries control messages,
  `update-profile` among them, and **replays every handler on every reconnect**.
- That doc names desktop's current behaviour — "fetch-once at startup" — as a
  **staleness bug class**, and says the durable log "is also the general fix" for
  it.
- It also warns, in as many words: *"Mobile was written by the Lead Dev;
  divergences are often intentional — verify against the SDK before 'fixing' one
  to match the other."*

**Desktop is slated to migrate to the hub log** (lead-confirmed; see
`2026-07-19-per-device-signing-keys-registration-anchored.md` and the
`edited-message-signature-badge` task, both of which already reason about the
interaction). So the direction of travel is desktop → mobile's model, not the
reverse. Re-adding P2P roster sync to mobile would be building something slated
for deletion, and would widen a divergence the lead deliberately closed.

**The two mechanisms actually cover different gaps**, which is what makes this
easy to get wrong:

| Who is missing identity | Hub log | P2P roster pull |
|---|---|---|
| An EXISTING member who was offline when it was announced | ✅ replayed from their cursor | ✅ if a peer is online |
| A member who joined LATER | ❌ their cursor starts at join; pre-join entries are never delivered | ✅ if a peer is online |

So the hub log's one hole is the **late joiner**, and that is the seam to work
on — *inside* the hub-log model, not by reviving the pull:

1. **Give the announce an expiry** (mobile's §10; desktop already has this as of
   2026-08-01). With durable replay behind it, a single announce reaches every
   current member for good. Cheapest, and already specced.
2. **Announce on JOIN, not only on connect.** A `join` control message is itself
   in the hub log, so every member sees exactly when somebody new arrives — the
   one moment when a broadcast is known to be needed rather than speculative.
   This converts a blind timer into a targeted response and is the natural shape
   once both platforms are on the log. Cost is one broadcast per member per join,
   bounded and proportional to the actual need.
3. **A roster served by the relay.** Cleanest and the only one that works when
   nobody else is online, but it is a relay change and a lead-dev call.

Do 1 first, consider 2, and treat 3 as the long answer. And when desktop lands
the hub-log migration, the P2P `sync-request`/`MemberDigest`/`MemberDelta` path
becomes redundant there too and should be retired rather than maintained.

### Debugging checklist

When someone reports a member rendering as an address:

1. **Which platforms?** Use the matrix above before anything else. A mobile→mobile
   report is expected today and needs no investigation.
2. **Was anyone else online?** The pull needs a peer. Nothing repairs in isolation.
3. **Is the announce gate exhausted?** 3 attempts per identity, then silent until
   the identity changes (`src/utils/spaceProfileGate.ts`). While testing, having
   the other user change their name or avatar resets the counter — otherwise you
   are testing a gate that is already closed.
4. **Count it.** `.agents/tools/dm-debug/06-space-member-sources.js` →
   `__spaceMissingSenders(spaceId)`. Baseline from 2026-06-13 on "Quorum Test 2":
   89 distinct senders, 46 with no member row.
5. Reload before concluding it worked — the row must PERSIST, not render once
   from an in-memory fallback.

## Known limitations (accepted)

- **Channel A has no live cross-device push** — your own second device
  learns a global change on restart/incidental pull. (Historical; see
  `config-blob-syncs-only-on-restart-not-live` behavior.)
- **Channel B 1h cache** — OTHER users can render your old global identity
  for up to ~1h after a rename (documented in qns-username-display.md).
  The renaming device refreshes its own cache immediately.
- **`Date.now()` LWW** — B and C timestamps come from the writing device's
  clock; severe clock skew can make an older edit win. Accepted (2026-07-16
  decision) — normal skew is seconds.
- **Non-public users** (`isProfilePublic=false`) have no channel B, but they DO
  reach spacemates: their global identity is pushed via the channel-C GLOBAL
  SLOT (that's the whole point of the two-slot design). Only STRANGERS (no
  shared space) see the address for a non-public user. Privacy-consistent: the
  public toggle governs stranger visibility, not what spacemates see.
- **Bio to DMs vs spaces**: global bio propagates to SPACEMATES ungated (via the
  global slot). The DM identity broadcast still gates bio on `isProfilePublic`
  (legacy DM behavior, unchanged). So a non-public user shows their bio to
  spacemates but not to DM-only partners — accepted asymmetry.
- **Channel B 1h cache** — still relevant for STRANGERS (people with no shared
  space) and for the QNS `.q` name, which travels only in B. Spacemates no
  longer depend on it for name/avatar/bio (the global slot is the live push).
- **`Date.now()` LWW** — B and C timestamps come from the writing device's
  clock; severe clock skew can make an older edit win. Accepted (2026-07-16).
- **Legacy stamped rosters**: rows stamped with old global values before the
  de-stamping look like deliberate overrides until manually cleared in that
  space's settings. Decision 2026-07-16: NO auto-migration (tiny user base).
  Side effect: such a row can render a different name on desktop vs mobile
  (desktop's comparison trick demotes a roster==global name to QNS; mobile
  doesn't) until cleared — folds into the same accepted limitation.

## Receive-side authorization (security, 2026-07-19)

`update-profile` is authorized against the **verified signer**, never the
spoofable payload `senderId` (`isUpdateProfileAuthorized`, both `saveMessage` +
`addMessage` handlers): a signing key already registered to a member may only
update THAT member; a key matching no member is accepted as a rotation/bootstrap
announcement. The handler **never writes the announced key onto the member row**
— it upserts display fields only, creating rows with an empty `inbox_address`
and leaving any existing `inbox_address` untouched. The authoritative
`inbox_address` comes solely from the verified join control.

This closes an escalation where a forged `senderId` + attacker key repointed a
victim's `inbox_address` and poisoned the `resolveVerifiedSender` reverse-lookup
that control-message auth relies on (#243; see
`.agents/docs/features/security.md` → "Profile-Update Authorization"). Accepted
residual: an unregistered key can still set the display name/avatar on a claimed
`senderId` (needed for the missing-join-row bootstrap) — cosmetic only, no
`inbox_address` poisoning.

## Verification status (2026-07-16)

- **Spaces, desktop↔desktop:** CONFIRMED working by the user — space text lands
  and per-space + global profile updates render correctly.
- **DM profile propagation:** BLOCKED by a pre-existing, unrelated DM-transport
  delivery issue (~6 months old; master bug
  `.agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md`). The DM
  path is UNTOUCHED by this work; DM verification is parked on that transport
  issue, not on this feature.
- **Mobile→desktop global propagation:** CONFIRMED 2026-07-16. A display-name
  changed on mobile propagated to desktop once the (flaky) transport recovered
  and messages started landing — the name update rode in with the space
  messages, exactly as the shared-transport model predicts. Validates the full
  chain: mobile send → wire field parse → separate-global-slot store → render.
  The earlier "not landing" was the pre-existing transport flakiness, not this
  feature.
- **Rapid two-device LWW race** (near-simultaneous renames on two devices →
  strictly-latest wins everywhere): not yet exercised behaviorally; the
  independent per-slot timestamp guards were verified by review. Low residual
  risk.
- **Static confidence:** three independent code reviews (delivery-safety, LWW
  correctness, regressions) found no delivery risk and two minor bugs, both
  fixed (desktop optimistic-cache override wipe; mobile stale-message drop
  guard). Both repos typecheck clean.

## File map (where each piece lives)

| Piece | Desktop | Mobile |
|---|---|---|
| Global editor save | `src/hooks/business/user/useUserSettings.ts` | `components/UnifiedProfileEditModal.tsx` (`saveQuorum`) |
| Publish/unpublish B | `src/services/PublicProfileService.ts` | `services/profile/publicProfile.ts` |
| B fetch hook (1h cache) | `src/hooks/business/user/useUserPublicProfile.ts` | `hooks/useUserPublicProfile.ts` |
| Member fallback (precedence merge) | `src/hooks/business/user/useMembersWithPublicProfileFallback.ts` | `hooks/useMembersWithPublicProfileFallback.ts` |
| Name resolvers | `src/utils/resolveMemberName.ts` (+ shared `resolveDisplayName`) | merged inside the fallback hook (`pickField`) |
| Space editor (override) | `useSpaceProfile.ts` + `SpaceSettingsModal/Account.tsx` | `components/SpaceSettingsModal.tsx` |
| C receive/upsert (two-slot merge) | `MessageService.ts` (update-profile handlers + `applyGlobalProfileSlots`) | `context/WebSocketContext.tsx` (~2100 JS path, ~3589 batch path) |
| C wire send (both slots) | `MessageService.ts` rebroadcast + `MessageDB.updateUserProfile` | `services/space/spaceMessageService.ts` (`sendUpdateProfileMessage`) |
| Tag-rotation rebroadcast (override-or-omit + global slot) | `MessageService.ts` `rebroadcastTagIfChanged` — fires when an incoming manifest changes the selected TAG, **not** on connect | `context/WebSocketContext.tsx` (~4783) |
| On-connect announce (override-or-omit + global slot, no tag) | `MessageService.ts` `announceProfileToAllSpacesOnConnect`, fired from `MessageDB.tsx` (startup timer **and** `setResubscribe`). Bounded by `src/utils/spaceProfileGate.ts` — 3 attempts per identity, then silent | `services/space/spaceMessageService.ts` (`maybeSendUpdateProfileMessage`) — gate has NO expiry, see below |
| Announce payload rule (two-slot) | `src/utils/spaceProfilePayload.ts` (pure, tested) | inline in `spaceMessageService.ts` |
| Global-save space broadcast (GLOBAL SLOT only) | `MessageDB.tsx` `updateUserProfile` | `UnifiedProfileEditModal.tsx` `saveQuorum` space loop |
| useChannelData (surfaces global slots) | `src/hooks/business/channels/useChannelData.ts` | (mobile reads slots directly in the fallback hook) |
| Channel A sync | `src/services/ConfigService.ts` | `services/config/configService.ts` |

---
*Last updated: 2026-08-01*
