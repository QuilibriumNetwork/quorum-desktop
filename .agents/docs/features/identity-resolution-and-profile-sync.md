---
type: doc
title: "Identity resolution and profile sync (canonical model)"
status: done
ai_generated: true
created: 2026-07-16
updated: 2026-08-11
related_docs:
  - "qns-username-display.md"
  - "user-config-sync.md"
  - "../config-sync-system.md"
related_tasks:
  - ".agents/issues/port-from-mobile/.done/2026-06-08-port-public-profile.md"
  - ".agents/issues/.done/2026-06-10-space-message-list-public-profile-fallback.md"
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

From `qns-username-display.md`, implemented by shared `resolveIdentity` over a
complete `MemberIdentity`, fed by `src/identity/` on desktop (mobile still merges
via `useMembersWithPublicProfileFallback.pickField` until it ports). The desktop
adapters this section used to name — `resolveSpaceMemberName` / `resolveMemberName`
— were deleted in PR #327; scope (`'space'` vs `'global'`) is now an argument, not
a choice of function:

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
override fields. The comparison trick is now a legacy safety net (it neutralizes
old stamped rows for free) rather than load-bearing. Since PR #327 it lives in
shared `resolveIdentity` as the space-vs-global echo check, not in a desktop
adapter — and it is exactly why `globalName` is a REQUIRED field there: omit it
and the comparison can never fire, so every roster name looks deliberate and the
`.q` is silently buried.

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

## 🗺️ MAP — everything about "people show as an address" (updated 2026-08-02)

> One entry point, so nobody has to know which of a dozen files to open. If you
> are here because of a missing-name report, read the convergence model directly
> below, then the open items.

**The state — and it is DIFFERENT per platform. Do not collapse these into one
sentence; doing so has already misled a reader once.**

| Viewer → member | State |
|---|---|
| **desktop → desktop** | ✅ largely repaired. The dominant cause was a case-mismatched React Query key discarding every roster update (#295). A new joiner goes from 1 member row to 72 in a two-client test and the list renders them. **Hardened 2026-08-03** — see below; #295 made the pull *render*, but the pull could still be starved before it delivered anything. |
| **desktop → mobile** | ❌ **broken, and the fix is written but NOT SHIPPED.** That member announced once long ago and does not participate in the pull. Mobile #215 fixes it — **merged to mobile `master` 2026-08-02, and the last mobile build shipped 2026-07-31, so it is NOT in users' hands.** This is a RELEASE action, not a coding one. |
| **mobile → desktop** | ✅ repaired — the desktop push reaches it; mobile's receive side was never the problem. |
| **mobile → mobile** | ❌ **broken.** Mobile neither asks nor answers. ⚠️ But note: #215 plus mobile's hub-log replay should repair much of this too, because a member who re-announces on connect is replayed to mobile peers from their join point. **Re-measure after a build ships before treating the ask/answer gap as the blocker.** |

### What changed 2026-08-03 (desktop) — the pull's reliability layer

#295 fixed the *view* layer: rows arrived and were discarded before render. But
the pull could still deliver nothing at all, and three separate causes were found
and fixed:

| PR | what it fixed |
|---|---|
| **#300** | the roster convergence re-ask never armed when the sync window had expired — the exact case it existed for. 300-message backlog: **0% → 100%** roster delivery |
| **#305** | a space frame that failed to decrypt was **deleted from the relay** — the only copy. Silent permanent message loss, now retried instead |
| **#308** | typing indicators were processed and never acked, so the relay re-pushed every one of them on every reconnect, forever. MEASURED 2x redelivery vs 0x for a control post |

**Why #308 belongs in an identity doc:** queue depth is what decides whether a
perishable control frame is read before it expires. A `sync-info` reply is valid
30 s; the wait for it is simply the number of frames ahead of it. An unbounded
pile of un-acked typing frames is a permanent, growing tax on every roster pull.

⚠️ **Also measured and FALSIFIED:** bounded chunking of the inbound queue. Built,
measured, discarded — the wait is the number of frames *ahead*, and chunking only
changes how they are packaged. Do not re-propose it without explaining how it
moves queue POSITION. See `issues/2026-08-02-sync-requests-arrive-four-minutes-late-…`.

> ⚠️ #295 repaired the **desktop viewer's** ability to render what it already
> received. It did nothing for mobile, and nothing for a mobile *member's*
> discoverability. "The truncated-address bug is fixed" is only true for the
> first row of that table.

| | |
|---|---|
| **The architecture** | this document — read "Why a name goes missing" next |
| **The measurement tool** | `/dev/identity-coverage` (dev builds only). Take a snapshot before and after any change |
| **The LIVE resolver instrument** | `src/identity/diagnostics.ts` — fires the instant a resolution degrades, not on a snapshot. Session counter on the same `/dev/identity-coverage` page. See "The root-provider class of bug" below |
| **Your OWN identity** | `.agents/tools/dm-debug/08-self-identity-sources.js` — one console paste; prints all four stores your own name lives in, your roster row per space, and the config blob's size budget. Run this FIRST for any "my own name is wrong" report |
| **Tripwire** | `localStorage['quorum:diag:selfOverrideWrites']` — every non-empty write to your OWN per-space override, with a stack. Should stay empty; only the Space Settings editor may appear |
| **Migration record** | `localStorage['quorum:diag:clearedSpaceOverrides']` — what the one-time legacy-override clear destroyed, since it is irreversible |
| **The full record** | `.agents/issues/.done/2026-08-01-identity-announce-cadence-research.md` — CLOSED, its box has every shipped PR and both measurements |

**Open, with next steps written:**

| Item | Where |
|---|---|
| **MOBILE cannot ask or answer** — the largest remaining gap, and the only one that needs a lead-dev decision | "What would actually close the gap" below. Do NOT ship a mobile fix for this unilaterally |
| 🔴 **SHIP A MOBILE BUILD — the single highest-value action available.** Mobile #215 (`ca9309e`, "a mobile member is no longer invisible to everyone who joins later") is **merged to mobile `master` on 2026-08-02**. The last mobile build shipped **2026-07-31**, two days earlier, so it does NOT contain the fix. Until a build ships, **no further client work on either repo will move the two broken quadrants** — and re-measuring before it ships will measure the old behaviour | mobile #215; `issues/2026-08-01-space-member-identity-announce-on-connect.md` §10 |
| Sync peer selection is message-first (`memberCount` is a tiebreaker that never fires); the member half is one payload with no retry | `issues/2026-08-02-roster-pull-delivers-nothing-to-a-new-joiner.md` → NEXT STEPS |
| A per-space name/avatar never reaches your own other devices | `issues/.open/2026-08-01-per-space-override-does-not-reach-your-own-other-devices.md` |
| Members that **no peer holds** — only the person re-announcing recovers them | same roster-pull file, NEXT STEP C. Blocked on a mobile release carrying #215 |
| A deleted space tag still shows on **mobile** | `issues/.done/2026-08-01-space-tag-can-no-longer-be-cleared-from-a-member-roster.md` §5 |
| Every `logger` call is a no-op in production — why none of this was visible | `issues/.open/2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md` |
| Hub-log migration; would delete the (working) pull | `issues/port-from-mobile/candidates.md` #32 |

**Two corrections this effort had to make about itself**, both worth knowing
before trusting any older wording:

1. The roster pull was claimed to have "never worked". **False** — missing members
   are found by ADDRESS, not by hash. Shared #71 fixed stale identities not
   refreshing, which is narrower.
2. The fix was believed to be a join-triggered announce. **Killed by arithmetic**
   before it was built: broadcast fan-out makes it N² in traffic.

## The root-provider class of bug, and the instrument that watches for it (2026-08-11)

Two more defects, found by the operator with `/dev/fake-qns` after the eight
surfaces in `.agents/issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md`
were fixed. Both are the SAME shape as each other, and a different shape from
that file's "read a name by hand" bugs: here every surface correctly called
`<MemberName>`/`useResolvedMemberName` — the resolver just had nothing to
resolve FROM.

**Bug A — the operator's own name fell to their own address.** Self's
identity deliberately stopped reading `currentPasskeyInfo` as a PRIMARY
source (it carries no QNS name — see `identityFromMaps`'s `isSelf` branch in
`src/identity/identityProvider.tsx`), which fixed four real bugs recorded in
the file above. That left self with only the fetched public profile as a
name source. Desktop never publishes a primary username (`/dev/fake-qns`
says so explicitly), so a user whose public profile also carries no
`display_name` had NO name source anywhere and fell to a truncated address —
in the nav rail (no roster, no spaceId) and in their own DM messages (a DM's
`rostersBySpace` is always `{}`, no space roster concept).

**Fix:** `selfLocalNameEntry(address, displayName)` — the device's own
`currentPasskeyInfo.displayName`, fed into `IdentitySources.locallyKnownNames`
as the LAST `globalName` tier, below the roster global slot and the
published profile. Same shape as a DM partner's own `locallyKnownNames`
entry (a name known locally, no network round-trip, last resort before the
address) — it can never supply a `.q`, because a device display name is not
a QNS name. Wired into App.tsx's root provider and `DirectMessage.tsx`'s own
provider, the two places self had no other source.

**Bug B — Kick/Mute/Block confirmations rendered a member's address.**
These three modals are mounted by `ModalProvider` (`Router.web.tsx`), which
wraps `<Space />`, not the reverse — so they sit ABOVE every Space/DM
`<IdentityScopeProvider>` and only ever see the ROOT one (`App.tsx`). That
root shipped with a PERMANENT `rostersBySpace={}` (a stable empty object,
literally no keys, ever) — so a member with no cached public profile had
nothing to resolve from, no matter which space the action was in, even
though the SAME member's name was rendering correctly one provider layer
down in the channel behind the modal.

**Fix:** `useRootIdentityScope` (`src/hooks/business/identity/`) feeds the
root provider real data — the user's own rosters via `useMultiSpaceRosters`
(the same hook `GlobalNotificationsModal`/`MessagePreview`/`ReactionsModal`
already use for their own detached surfaces) plus `selfLocalNameEntry`. A
deliberately NON-suspense read (`useSpaces()` is suspense-backed, and this
hook runs in `App.tsx` above the Router's own Suspense boundary, wrapping
every branch including onboarding and the "Connecting" screen — a suspense
read there would force ALL of them through a fallback-then-remount on first
load). A plain `useQuery` against the same query key (`buildSpacesKey({})`)
instead just re-renders once the local IndexedDB read resolves, sharing its
cache with every other `useSpaces()` caller. Cost: one extra IndexedDB read
per space the user belongs to, at startup once authenticated, cached 60s and
shared with `useSpaceMembers` — the same cost `GlobalNotificationsModal`
already paid on open, just paid once at startup instead of per-open.

Swept every other app-level host (`ModalProvider`, `ConfirmationModalProvider`
via `Layout.tsx`, the toast host) for the same shape: everything else either
mounts its own scoped provider already (`MessagePreview`, `ReactionsModal`,
`ConversationSettingsModal`, `SpaceSettingsModal`, `SearchResults`,
`BookmarksPage`, `GlobalNotificationsModal`, `DirectMessage`,
`DirectMessageContactsList`, `ThreadPanel`, `Channel`) or resolves from a
hook called by a component that is a DESCENDANT of one of those (`Message.tsx`,
`useMessageActions`, `useSearchResultDisplay`, ...). Kick/Mute/Block were the
only three with no provider of their own anywhere above them.

### Why the component tests could not catch this class

Every test in `src/dev/tests/identity/` mounts its OWN `<IdentityScopeProvider>`
with hand-built `rostersBySpace`/`locallyKnownNames` — that is the whole point
of the identity module's design (constraint 1: a virtualised list must not
register 200 query observers, so the merge is a pure function tested with
plain objects). But it means a component test can only ever prove "this
component resolves correctly GIVEN a provider with the right data" — it
can never prove "the provider this component actually gets, in the real
tree, HAS the right data". `KickUserModal.test.tsx` passed a populated
roster to its wrapping provider and always had, for exactly this reason:
nothing in that test's setup could have caught that the REAL app mounts
`KickUserModal` under a provider with a permanently empty one.

This is a structural blind spot, not an oversight in any one test. A test
mounts its own provider; it can never observe what the real tree provides.
The wiring bug lives one level up from anything a component test's `render()`
call can see.

**This is what `src/identity/diagnostics.ts` is for.** It runs inside the
real resolver hooks (`useResolvedMemberName`, `useNameResolver`), in the real
app, and fires the moment a resolution falls through to the truncated-address
fallback — which is observable regardless of which provider produced it, or
why. It distinguishes (best-effort; see the module's own docstring for the
exact classification and its acknowledged limits) a provider that is missing
data it should have had (`self-no-local-source`, `space-roster-not-loaded` —
DEGRADED, warned to the console) from a genuinely unknown member
(`no-source-anywhere` — reported for visibility, never warned). Dev builds
only (`process.env.NODE_ENV === 'production'` gate, dead-code-eliminated by
Vite, same pattern as `src/dev/dm-doctor/warningCounters.ts`), wrapped in
try/catch throughout, and it can never affect what renders.

Session counters and the last 100 events (deduped, occurrence-counted) are on
`/dev/identity-coverage` under "Live resolution diagnostics (this session)",
updating live via `useSyncExternalStore` as you click around — no snapshot
button, no special mode. "0 degraded resolutions this session" is meant to
read as a positive signal: the instrument is live and has caught nothing, not
merely that nobody has looked.

Proven against Bug A itself: with `selfLocalNameEntry` temporarily reverted
to always return `{}`, both `rootScopeSelfName.test.tsx` and the DM
own-message test went red (the address rendered, as expected) AND the
diagnostic printed, naming the exact address and `self-no-local-source` as
the reason, before the revert was undone. See the task report for the full
transcript:
`.superpowers/sdd/2026-08-10-identity-resolution-architecture-plan/root-scope-and-diagnostic-report.md`.

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

### What "P2P" actually means here (and why the two apps differ so much)

There is no server that stores "who is in this space and what are they called"
and hands it out. Identity spreads **between clients**. So the only question that
matters for any given client is: **does it ASK, and does it ANSWER?**

| | Announces about itself | **Asks** others for the roster | **Answers** someone else's request |
|---|---|---|---|
| **Desktop** | ✅ on join, on connect, on profile change | ✅ `requestSync` on join and on every launch | ✅ replies with `MemberDelta` — rows for **everyone it knows**, not just itself |
| **Mobile** | ✅ on connect and on profile change | ❌ never | ❌ never — `sync-request` is in the removed-handlers list (`WebSocketContext.tsx:1297-1303`) |

Read the third column twice. It is the one people miss, and it has a consequence
that is not obvious:

> **A desktop client that joins a mostly-mobile space gets nothing, no matter how
> many people are online.** It sends its `requestSync` and nobody can reply,
> because no mobile client implements the responder. Being online is necessary
> but not sufficient — there has to be a **desktop** peer online.

So the picture is not "a P2P network with two kinds of node". It is a **P2P
network made of desktop clients, with mobile clients attached as leaves**. A
mobile client can be *told* about somebody (it receives announcements and stores
them correctly — its receive side is not the problem), but it will never *ask*,
and it can never *tell you about a third person*. Its knowledge only flows
outward about itself.

That single asymmetry explains why mobile shows the most missing names despite
having the better message transport, and why "mobile has the hub log, so mobile
is fine" is wrong.

### Why it was broken for so long — corrected 2026-08-02

> ⚠️ An earlier version of this section said the pull "never worked" because
> every member hashed as "no identity", so two clients always agreed they were in
> sync. **That was wrong**, and it mis-ranked the whole investigation. Corrected
> below after the mechanism was instrumented and measured.

There were **two independent defects**, and the smaller one got the attention:

**1. Stale identities never refreshed** (shared #71). `computeMemberHash` built
its fingerprint from the OVERRIDE slot only, which the follow-global work
(2026-07-16) deliberately stopped populating, so nearly every member hashed as
"no identity". But note what that does and does not break:
`computeMemberDiff` (`quorum-shared/src/sync/utils.ts:392-413`) finds **missing**
members by **address**, not by hash — `if (!ourDigest) missingAddresses.push(…)`.
So a member you had never heard of was always detected and always sent. The hash
governs only the **outdated** branch. #71 therefore fixed "a peer's changed name
never propagates", **not** "the pull does not work". Applying those deltas
without erasing the global slot is desktop #290, and that one was live all along.

**2. The view layer discarded every roster update** (desktop #295). The
`sync-delta` handler refetched `['spaceMembers', spaceId]` while every subscriber
builds `['SpaceMembers', spaceId]`. React Query keys are case-sensitive, so the
refetch hit a key nobody was subscribed to. Rows landed in IndexedDB and the
member list never learned. Measured: **72 rows on disk, 1 person in the list**,
recovered only after several manual reloads.

**Defect 2 was almost certainly the dominant cause of the user-visible symptom**,
and it had nothing to do with the wire, the crypto, or the announce cadence. It
was found last, by instrumenting the delta counts, because every layer looked
healthy in isolation and nobody was looking at the seam between storage and view.

**Lesson: when storage and UI disagree, suspect the cache key before
re-litigating the transport.**

### Where it stands per platform pairing

| Viewer | Looking at a DESKTOP member | Looking at a MOBILE member |
|---|---|---|
| **Desktop** | repaired — pull, plus the bootstrap push | **still broken** — that member announced once, long ago, and does not participate in the pull |
| **Mobile** | repaired — the desktop push reaches it, and mobile's receive/upsert/two-slot merge are all correct | **still broken** — same cause, and mobile cannot pull either |

Mobile's RECEIVE side is not the problem and never was: it upserts a missing row,
stores both slots with independent timestamp guards, and renders the precedence
ladder correctly. **Mobile's problem is entirely on the SEND side plus the absent
pull.**

### What joining a space actually gives you (read this before proposing a fix)

> Corrected twice on 2026-08-01. The first version said "give mobile the roster
> pull"; the second said the hub log had superseded it. **Both were wrong**, and
> the second was wrong because it came from a doc rather than from the code.
> What follows is traced from source.

Three separate things arrive when you join a space, and only two of them are
about identity:

| What | Carries | Where from |
|---|---|---|
| **The space manifest** | `members: string[]` — **addresses only, no names or avatars** (`quorum-shared/src/types/space.ts:29`) | owner-published, encrypted with the space config key, fetched via the invite link |
| **Your own `join` control message** | your `participant` record, WITH your identity (`InvitationService.ts:869`) | you broadcast it to the space |
| **`requestSync`** → `sync-members` / `MemberDelta` | full member rows for everyone, with identity (`MessageService.ts:5491,5521`) | a peer, on request. **Desktop only** — `InvitationService.ts:875` fires it immediately after the join broadcast |

So the manifest tells you **who is in the space**. It does not tell you **what
they are called**. That is the whole symptom: a new joiner has a complete member
list and no identities, which renders as a list of truncated addresses.

### The defect, in one sentence

**Joining is a ONE-WAY identity exchange.** Your `join` message announces you to
everyone; nothing announces everyone to you. Desktop papers over this by calling
`requestSync` right after joining. Mobile removed the sync handlers
(`WebSocketContext.tsx:1297-1303`) and did not replace that half, so on mobile
the exchange stays one-way and a joiner learns each member's identity only when
that member happens to speak again.

⚠️ **On why mobile removed it: unknown, and do not assume.** The code comments
describing the removal may have been written by our side rather than by the lead
dev, and the mobile git history arrives in large squashed commits, so intent is
not recoverable from either. What IS established is the mechanical consequence
above. The hub log genuinely replaced the P2P sync for **message catch-up** — it
is durable, replays on reconnect, and is structurally better for that job. It did
**not** replace the **roster bootstrap**, because that was never the same job.

### ✅ MEASURED 2026-08-01 — delivery to an offline mobile member IS durable

Run against two real users, since the relay is not in either repo and this could
not be settled by reading code:

1. User A's mobile app **fully closed** (not backgrounded).
2. User B, on desktop, changed their global display name and avatar.
3. A opened mobile.

**Result: A saw B's new name and avatar.** So a desktop `'group'` broadcast
reaches a member who was completely offline when it was sent, and lands on their
next open. Whether the relay does that via the hub log or the legacy per-member
space inbox is still unknown (and does not matter for design).

**Why this is the finding that unblocks the work:** it means an announcement does
not need the receiver to be online at that instant. So a **join-triggered
announce** — existing members announcing when a `join` arrives — will actually
reach the new joiner, even if they close the app immediately after joining. That
was the precondition, and it holds.

Scope of the measurement, stated honestly:

- ✅ confirmed: **desktop sender → mobile receiver**, receiver offline, existing member.
- ❔ untested: **desktop as the receiver**. Desktop has no `log-since` catch-up at
  all (verified: zero references to `log-append`/`log-since`/`listen-hub` in the
  desktop source), so it likely still needs a live connection, and leans on
  `requestSync` instead. This asymmetry is expected to disappear when desktop
  migrates to the hub log.
- ❔ untested: the **late joiner** case specifically — this test used a member who
  had already joined. It confirms the delivery property the fix depends on, not
  the fix itself.
- ❔ unknown: the retention window. One trial, minutes-scale.

### What would actually close the gap

> This section has been rewritten four times on 2026-08-01/02. The costed
> analysis below is why it should stop moving. **Read the cost model before
> proposing anything** — three of the four earlier answers died on it or on a
> code trace, not on taste.

#### ⛔ The naive join-triggered announce is QUADRATIC — do not build it

The appealing idea: when a `join` arrives, every existing member announces their
identity, so the new joiner learns everyone. It is the exact inverse of the
defect, it needs no new message type, and the `join` is already visible to all.

It is also unaffordable. A space `update-profile` is **broadcast**, so the relay
fans out one copy per member. With `N` members and a payload `P` (dominated by a
base64 avatar, ~30 KB):

| Shape | Messages per join | Bytes delivered |
|---|---|---|
| every member announces (broadcast) | N | **N² × P** |
| one member answers, **directed** | 1 | **N × P** |

At N=50 that is **~75 MB per join** versus ~1.5 MB. At N=20, 12 MB versus 0.6 MB.
A single join in a mid-size space would cost more traffic than the space's entire
message history. Any "everyone responds" design has this shape regardless of how
the responders are chosen, because the response itself is a broadcast.

#### The affordable shape, and why it is a lead-dev question

The linear column is a **directed** response carrying the roster — which is
precisely what `sync-members` / `MemberDelta` over `SealSyncEnvelope` already is.
So the affordable fix is not a new mechanism; it is the existing one with a
different **trigger**: fire it from the `join` event rather than from a
`requestSync` that the joiner has to send.

That matters because it moves the requirement from "the joiner must be able to
ASK" (which mobile cannot) to "the joiner must be able to RECEIVE" (a smaller
change). But it still means mobile re-implements a slice of what was deliberately
removed, and desktop is lead-confirmed to migrate to the hub log — so the trigger,
the transport and the eventual retirement of the P2P path all interact.

**This is a design question for the lead dev, not a fix to ship unilaterally.**
Bring the cost table; it is the part that is not obvious.

Add herd suppression to whatever lands: a randomised delay per responder, cancelled
on seeing somebody else's response. Without it, "one member answers" degrades into
the quadratic case the moment several are online.

#### What to do in the meantime — uncontested and cheap

1. ✅ **DONE, awaiting release — give mobile's announce an expiry** (§10 of
   `2026-08-01-space-member-identity-announce-on-connect.md`, shipped as mobile
   #215). Mobile used to announce a given identity to a given space **once, ever**,
   with no expiry and no retry; the one escape hatch its comments describe
   (`clearProfileBroadcastState`) is **never called from anywhere**. It now expires
   at most 3 times per identity, the same rule desktop got on 2026-08-01.

   ⚠️ **This is written but not in anyone's hands.** Until a mobile build ships,
   every mobile member is still discoverable only by whoever happened to be
   listening the one time they announced. **The desktop→mobile and mobile→mobile
   rows of the state table above do not improve until that release.** If the
   number has to move for real users soon, chasing this release is worth more
   than any code we can write.

2. ✅ **DONE — measure first** (Step 4). The measurement is what found #295, which
   turned out to matter more than everything else shipped that day. Record and
   both snapshots are in
   `issues/.done/2026-08-01-identity-announce-cadence-research.md` (CLOSED). Tool:
   `/dev/identity-coverage`.

3. **A roster served by the relay** remains the only option that works when no
   other member is online at all. Relay change, lead-dev call, long answer.

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
- **Legacy stamped rosters** — ⚠️ **this entry was wrong until 2026-08-05, in a way
  that mattered.** It described stamped rows as a decaying legacy condition. They
  were neither decaying nor legacy:

  1. **The join path never stopped stamping.** The de-stamping of 2026-07-16 removed
     the editor saves and the rebroadcasts, but both `InvitationService` (our own
     row) and the `join` receive handler (every other member's row) kept writing the
     global name into the OVERRIDE slot. New traps were still being created daily.
  2. **The on-connect announce refreshed them.** `buildSpaceProfilePayload` read our
     own override straight off the row and re-sent it beside the current global name,
     and the receiver re-stamped both. So a stale value did not age out — it was
     renewed on every connect, and after the first announce it was byte-for-byte
     indistinguishable from a deliberately chosen per-space name.

  MEASURED 2026-08-05: four of five spaces on one account held a diverged override,
  all carrying fresh timestamps, rendering four different names none of which was the
  user's current one.

  **Fixed** in the Phase 1 work (see
  `.agents/issues/.done/2026-08-05-own-identity-cross-device-sync-design.md`): joins
  file identity under the global slot, nothing authors our own override but the Space
  Settings editor, and a one-time broadcast clear removes the existing ones. The
  2026-07-16 "no auto-migration" decision was reversed for exactly this reason — the
  rows could not be told apart, so they could not be left to expire.

  Side effect while any un-migrated client remains: such a row can still render a
  different name on desktop vs mobile (desktop's comparison trick demotes a
  roster==global name to QNS; mobile doesn't).

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
  `.agents/issues/.done/2026-07-02-dm-message-delivery-unreliable-master.md`). The DM
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
| Member fallback (precedence merge) | `src/hooks/business/user/useVisibleSenderProfileFallback.ts` (renamed from `useMembersWithPublicProfileFallback`, PR #327) | `hooks/useMembersWithPublicProfileFallback.ts` |
| Name resolvers | `src/identity/` (+ shared `resolveIdentity`) — `resolveMemberName.ts` deleted in PR #327 | merged inside the fallback hook (`pickField`) |
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
*Last updated: 2026-08-11*
