---
type: doc
title: "Identity resolution and profile sync (canonical model)"
status: done
ai_generated: true
created: 2026-07-16
updated: 2026-07-16
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
custom per-space name (C, deliberate)  →  QNS primary username .q (B)
  →  global display name (B)  →  truncated address
```

- **Space surfaces:** deliberate per-space override wins; else QNS; else
  global; else address.
- **DM / global surfaces** (no per-space concept): QNS → global → address.
- Avatar and bio follow the same "override else global" idea (no QNS step).

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

The follow-global work removes the stamping so a non-empty roster field
means a REAL override. De-stamped so far (2026-07-16, branch
`follow-global-profile` in both repos): the on-connect/tag-rotation
rebroadcasts, space creation, and (desktop) the editor save. STILL STAMPING
as of this writing: the global-profile save path on both apps (desktop
`MessageDB.updateUserProfile` all-spaces loop; mobile
`UnifiedProfileEditModal.saveQuorum` per-space loop) — removing that is the
remaining planned change. Once removed, the comparison trick becomes a
legacy safety net rather than load-bearing.

## How a global profile change propagates (target model)

User edits global name/avatar/bio on device D1:

1. **Local + channel A:** update local user state; `saveConfig` (encrypted,
   timestamped). D2 picks it up on restart/next pull (no live push — known
   gap, acceptable).
2. **Channel B:** if `isProfilePublic`, publish the signed public profile
   (server keeps latest by timestamp = LWW across devices). Local
   `publicProfileQueryKey` cache is optimistically updated + invalidated on
   the saving device.
3. **Channel C:** NOTHING (after the remaining de-stamping change lands).
   Spacemates see the new global value via the precedence ladder: their
   roster row for you is empty (no override) → falls to B on their next
   profile fetch (1h cache, so up to ~1h staleness for them; DM partners
   still get the live DM identity broadcast).
4. **DMs:** unchanged — DM identity is pushed to partners via the existing
   DM profile broadcast (global value; DMs have no override concept).

Per-space override edit (Space Settings → Account) is the ONLY thing that
writes channel C: value / `''` / omitted per the wire semantics above.

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
- **Non-public users** (`isProfilePublic=false`) have no channel B: to
  spacemates they render their per-space override if any, else placeholder/
  address; to strangers always the address. This is the privacy-consistent
  reading of the opt-in.
- **Legacy stamped rosters**: rows stamped with old global values before the
  de-stamping look like deliberate overrides until manually cleared in that
  space's settings. Decision 2026-07-16: NO auto-migration (tiny user base,
  manual clear is easy).

## File map (where each piece lives)

| Piece | Desktop | Mobile |
|---|---|---|
| Global editor save | `src/hooks/business/user/useUserSettings.ts` | `components/UnifiedProfileEditModal.tsx` (`saveQuorum`) |
| Publish/unpublish B | `src/services/PublicProfileService.ts` | `services/profile/publicProfile.ts` |
| B fetch hook (1h cache) | `src/hooks/business/user/useUserPublicProfile.ts` | `hooks/useUserPublicProfile.ts` |
| Member fallback (precedence merge) | `src/hooks/business/user/useMembersWithPublicProfileFallback.ts` | `hooks/useMembersWithPublicProfileFallback.ts` |
| Name resolvers | `src/utils/resolveMemberName.ts` (+ shared `resolveDisplayName`) | merged inside the fallback hook (`pickField`) |
| Space editor (override) | `useSpaceProfile.ts` + `SpaceSettingsModal/Account.tsx` | `components/SpaceSettingsModal.tsx` |
| C receive/upsert | `MessageService.ts` (update-profile handler) | `context/WebSocketContext.tsx` (~2100, ~3578) |
| On-connect rebroadcast | `MessageService.ts` (~577, tag rotation) | `context/WebSocketContext.tsx` (~4770) |
| Global-save space broadcast (TO BE REMOVED) | `MessageDB.tsx` `updateUserProfile` (~421) | `UnifiedProfileEditModal.tsx` `saveQuorum` space loop |
| Channel A sync | `src/services/ConfigService.ts` | `services/config/configService.ts` |

---
*Last updated: 2026-07-16*
