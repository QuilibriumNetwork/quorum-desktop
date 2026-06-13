---
type: bug
title: "Space members show truncated address — no space_members row (join broadcast never arrived)"
status: open
priority: high
ai_generated: false
created: 2026-06-13
updated: 2026-06-13
related_docs:
  - ".agents/docs/debugging/dm-architecture-and-debug-playbook.md"
  - ".agents/tasks/.done/2026-06-10-space-message-list-public-profile-fallback.md"
  - ".agents/tasks/.done/per-space-profile-data-flow-analysis.md"
related_files:
  - "src/services/MessageService.ts"
  - "src/hooks/business/user/useMembersWithPublicProfileFallback.ts"
related_tools:
  - ".agents/tools/dm-debug/06-space-member-sources.js"
---

# Space members show truncated address — no `space_members` row

## Symptom

In a space channel's message list, many senders render as a 6-char truncated
address with an initials-only avatar instead of their real name/pfp — even
though they have joined the space AND posted many messages. The earlier
public-profile-fallback fix (PR #191) does not help them.

## Root cause (confirmed by live diagnostic, 2026-06-13)

**These senders have no row in `space_members` at all.** Their `join` control
message never reached this client (offline at join time, dropped broadcast, or
joined-before-us with no historical replay). Identity is therefore unresolvable
and the render falls back to `senderId.slice(-6)`.

### Live evidence

Diagnostic `.agents/tools/dm-debug/06-space-member-sources.js` run against test
space `QmZM3AKwKfMprQZvSk3Mpgii2JS31TS5izHrwJe1itprrG` ("Quorum Test 2"):

- **89 distinct senders** have posted messages.
- **46 of them (52%) have NO `space_members` row** — including every
  truncated-address user from the reported screenshot (E9AouU, teSNCf, eH6cNY,
  XHUczm, plus high-volume posters CRcRk8=64 msgs, eH6cNY=63, XHUczm=38).
- The 43 "has row" senders are the ones whose `join` did arrive.
- The space's `space_members` table has 69 rows but 89 senders posted — even the
  rows present don't cover everyone active.

### Why normal message traffic does NOT recover identity

`space_members` is only ever WRITTEN by three paths, none triggered by receiving
a normal `post`:

1. `join` control message → `MessageService.ts:3246` creates the row.
2. `update-profile` → only *updates* an existing row. On the established-session
   path (`MessageService.ts:1783`) it `return`s early if the row is missing.
   (The new-session path `MessageService.ts:1262` was already fixed to upsert.)
3. `sync-members` / roster sync from owner → `MessageService.ts:4023`, `:4301`.

The regular message-receive path (`MessageService.ts:3154`) only READS
`space_members` to verify the sender's signature (non-repudiability). It never
writes identity. So a sender with a missing row posts forever as a truncated
address.

### Latent secondary bug: null-deref on non-repudiable spaces

At `MessageService.ts:3178`, the non-repudiability check reads
`participant.inbox_address` with **no null guard**:

```ts
const participant = await this.messageDB.getSpaceMember(space.spaceId, decryptedContent.content.senderId);
// ...
const inboxMismatch =
  !isUpdateProfile &&
  participant.inbox_address !== inboxAddress &&   // participant may be null
  participant.inbox_address;
```

When `participant` is null (the 46-sender case) AND the space is
non-repudiable (`!space.isRepudiable`, line 3150), this throws a TypeError.
The throw propagates to the outer catch at `MessageService.ts:4348`
(`'Error processing hub/sync message'`), which logs and swallows it — so on a
**non-repudiable space these senders' messages are silently dropped entirely.**

The reported space renders the messages (truncated name) because it is
**repudiable** — the `!space.isRepudiable` guard is false, the block is skipped,
no deref. So the visible symptom (truncated name) and the latent symptom
(dropped message) depend on the space's repudiability setting.

## Why this is the transport/sync gap, not a render bug

This is the same unsolved cluster flagged in the DM playbook ("Known sync issues
— NOT yet fixed"): control-message delivery between clients is unreliable. The
`join` broadcasts for half the roster never landed. The public-profile fallback
(PR #191) can't help because it enriches *existing* rows — with no row, there's
nothing to enrich.

## Mobile parity check (2026-06-13)

Investigated `quorum-mobile` `context/WebSocketContext.tsx` to see whether
mobile already solves this, since desktop changes must not diverge from mobile
on shared protocol behaviour.

**Mobile is identical to desktop on the core gap: a plain `post`/`embed`/`sticker`
NEVER writes `space_members`** (mobile live path lines 2067-2148, batch path
3291-3335 — zero `saveSpaceMember` calls; they only READ a member row to build a
notification preview). Mobile also has no signature-verification-driven
inbox-address derivation that would seed a row from a raw post. So the
"upsert-from-message-traffic" idea would be a desktop-only divergence, not a
parity fix — **do NOT pursue it as the primary fix.**

**Mobile IS ahead of desktop on one path:** its `update-profile` handler is a
true upsert. When no member row exists (join missed), it creates one with
`inbox_address: ''` rather than bailing. Mobile live path
`WebSocketContext.tsx:1925-1985`, batch path `:3195-3241`, with an explicit
comment naming the "join control was missed" recovery case. Desktop only has
this upsert on the new-session path (`MessageService.ts:1262`); the
established-session path (`:1783`) still bails. **This is the real parity gap to
close.**

Mobile's render-time recovery is the same as desktop's: `useMembersWithPublicProfileFallback`
(`hooks/useMembersWithPublicProfileFallback.ts`) — render-only, no MMKV
write-back. Field convention on mobile: `address` / `profile_image` (vs desktop
`user_address` / `user_icon`); storage key `spaceMembers:<spaceId>` in MMKV.

## Proposed fix (revised after mobile check)

### Fix 1 (parity, do this): apply the line-1262 upsert to line 1783

Desktop's established-session `update-profile` handler (`MessageService.ts:1783`)
bails with `if (!participant) return`. Mirror the new-session upsert at
`:1262` (and mobile's `:1925`) so a profile update from a sender whose `join`
was missed CREATES the row instead of dropping the update. This is a true
cross-platform parity fix, low-risk, and directly recovers identity for the
affected users the moment they next save their profile.

### Fix 2 (correctness, do this): null-guard line 3178

`participant.inbox_address` at `MessageService.ts:3178` derefs a possibly-null
`participant`. On a non-repudiable space this throws and the message is silently
dropped (swallowed at the outer catch, `:4348`). Guard with
`participant?.inbox_address`. Independent of Fix 1; fixes the message-dropping
regression on non-repudiable spaces. Mobile does not have this bug because it
does not do desktop's inbox-from-publicKey derivation in the receive path.

### Fix 3 (deeper, needs design + lead-dev input): reliable `join`/roster delivery

Root cause now characterized (investigation 2026-06-13): **desktop and mobile
use different transports for space control messages, and mobile's is
self-healing while desktop's is not.**

**Desktop (broken):** `join` / `update-profile` are ephemeral hub *group
broadcasts*, fire-and-forget (`InvitationService.ts:848`, sealed via
`SpaceService.ts:1201`). No durable replay. An existing member offline at
broadcast time misses the `join` permanently. The only recovery is a one-shot
`requestSync` (`SyncService.ts`) with a **30-second** acceptance window
(`MessageService.ts:3961`), fired only on join (`InvitationService.ts:860`) and
once on startup with a 10s delay (`MessageDB.tsx:528`). Miss that window and the
rosters never reconcile. There is no `getHub` poll, no periodic re-sync, and
`join`/`requestSync` are NOT in the durable ActionQueue (they use ephemeral
`enqueueOutbound`, `WebsocketProvider.tsx:222`, lost on refresh). Secondary
silent-failure: `js_verify_point` on a stale ratchet drops a received `join`
with only `console.error` (`MessageService.ts:3243`), and non-owner
`sync-members` is dropped unless an active 30s sync session exists
(`MessageService.ts:4024`).

**Mobile (self-healing):** uses a durable **hub log**. On every reconnect /
foreground (`AppState` active), it issues `log-since` from a stored cursor and
replays ALL missed `join`/`update-profile` control messages through the same
member-writing pipeline (`WebSocketContext.tsx:4121-4248`, `hubLogSync.ts`,
`hubLogCursor.ts`). It also re-broadcasts `update-profile` on every connect
(`WebSocketContext.tsx:4270-4345`), and its receive handler upserts a row even
with no prior `join` (`:1953-2023`). A mobile client that missed a join heals on
next connect; desktop has no equivalent.

So this is NOT a "mirror the DM fix" tweak and NOT a small client patch — it is
adopting (a slice of) mobile's durable hub-log catch-up on desktop, OR adding a
desktop periodic/on-reconnect re-sync, OR an owner periodic roster re-broadcast.
Each is an architecture decision with a cross-platform / wire-format dimension.
**Raise with the lead dev (Telegram, per project convention) before building.**

**Already tracked:** this is candidate **#32 "Hub-log sync transport (replace
desktop P2P)"** in
[port-from-mobile/candidates.md](../tasks/port-from-mobile/candidates.md) —
surfaced 2026-06-11, parked as a lead-dev call, with a verified ~4-8 eng-day
scope (port `buildListenHubFrame`/`buildLogSinceFrame` + cursor store + ingest;
delete `SyncService.ts` + the 7 sync-* handlers + the `requestSync` loop), the
privacy tradeoff (server retains the sealed log vs P2P device-only history), and
two infra unknowns. This bug is the concrete user-facing symptom that motivates
#32. The control-handler replay audit below is the receive-side prep that #32
needs regardless of direction.
Candidate approaches, by risk:
- Desktop on-reconnect `requestSync` (re-fire the existing mechanism on every
  WS (re)connect, not just join+startup) — smallest change, stays within the
  existing sync protocol, no new wire type. Likely the safest first step.
- Desktop `update-profile` re-broadcast on connect (mirrors mobile F2) — pairs
  with Fix 1's upsert to heal rosters without a new transport.
- Full hub-log catch-up parity with mobile — largest, most robust, biggest blast
  radius.

### Explicitly NOT doing: upsert `space_members` from raw message traffic

Considered (would seed an inbox-only row from a verified post) and rejected:
(a) mobile doesn't do it → desktop-only divergence on shared protocol state;
(b) it writes canonical membership state from a derived source, the same
correctness risk the PR #191 task already rejected for write-through;
(c) it only seeds inbox+address, still no name/avatar from a `post`, so the
user-visible win is marginal over Fix 1 + the existing public-profile fallback.

## Implementation status

**Partial mitigation landed** on branch `fix/space-member-upsert-and-null-guard`
(commit `05f04c8c`):

- **Fix 1 (done):** `update-profile` established-session handler
  (`MessageService.ts:1783`) now upserts a missing `space_members` row instead
  of bailing on `!participant`. Mirrors the new-session handler (`:1262`) and
  mobile (`WebSocketContext.tsx:1925`).
- **Fix 2 (done):** null-guarded `participant?.inbox_address` at
  `MessageService.ts:3178`, preventing the silent message-drop on non-repudiable
  spaces.
- Verified: `npx tsc --noEmit --skipLibCheck` clean; `eslint` on the file clean
  (0 errors; 2 pre-existing warnings unrelated to the change).

**Bug remains `open`** — Fixes 1+2 are correct and ship-worthy but do NOT resolve
the reported symptom. Fix 1 only recovers identity when a missing member *next
saves their profile*, and desktop (unlike mobile) does not re-broadcast profiles
on reconnect, so a silent member's row still never appears. The headline symptom
(joined + posted members showing as truncated addresses) is caused by the
transport divergence in Fix 3, which is unaddressed pending lead-dev input.
Do not move to `.solved/` until the symptom no longer reproduces via the
diagnostic below.

## Control-handler replay audit (for the hub-log migration)

The lead dev is bringing the durable **hub log** to desktop (mobile already has
it). On adoption it will replay ALL past space control messages through the
existing receive handlers on every reconnect. Any handler that bails or
null-derefs when the sender/target has no `space_members` row will silently drop
or crash on replayed messages for members whose `join` was missed — the same
trap Fixes 1+2 close for `update-profile` and the non-repudiability check.

Full audit of `MessageService.ts` space/group receive handlers (2026-06-13):

**Already upsert-safe (no action):** `join` (`:3246`), `update-profile`
new-session (`:1262`) + established (`:1783`, fixed here), `sync-members`
(`:4023`), `sync-delta` member section (`:4325`), non-repudiability check
(`:3178`, fixed here).

**Fixed directly (2nd batch, branch `fix/control-handler-replay-safety`):**
- `verify-kicked` — now upserts a kicked tombstone (`isKicked: true`,
  `inbox_address: ''`) when no row exists, so an address kicked before we saw
  their join can't render as active after replay.
- `kick` other-member path — now upserts the inactive tombstone
  (`inbox_address: ''`) when no row exists.
- `join` / `leave` / `rekey` — the "X joined/left/was kicked" system-message
  emission is now guarded behind a `space` null-check instead of `space!`
  assertions (which threw, and were swallowed, when the space row was absent).
- Verified: tsc + eslint clean.

**Attempted then reverted (code review):** durable-path read-only enforcement.
A fail-secure reject on the durable path could permanently drop legitimate
manager messages that arrive before their space row during sync replay — worse
than the bug it fixed. Deferred to the hub-log migration (#32), where replay
ordering is deterministic. See
2026-06-12-readonly-channel-receive-side-enforcement-gaps.

**Known limitation (pre-existing, not fixed here):** the `sync-members` cache
merge reads `isKicked` from the React Query cache, not IndexedDB. A tombstone
upserted this session for a previously-unknown member is correct in IndexedDB
but may render as active in the *same session* until reload (the upsert's
`setQueryData` maps existing entries only). Self-heals on reload. Belongs to the
`sync-members` handler, untouched here.

**Fine to leave bailing:** `mute`/`unmute`, `pin`/`unpin`, `reaction`,
`edit`/`remove-message` — these depend on the target message or `space.roles`,
not a member row (their replay concern is message ordering, a separate matter).

With these in, the membership handlers (kick/leave/verify-kicked/join/rekey) are
replay-safe against missing rows and null space data. Read-only durable
enforcement remains for #32.

## How to reproduce / diagnose

1. Open the affected space in the app.
2. DevTools console (log level "All levels"), paste
   `.agents/tools/dm-debug/06-space-member-sources.js`.
3. `__spaceMissingSenders('<spaceId>')` — lists senders with no member row.
4. `__spaceMemberSources('<spaceId>')` — classifies existing rows by source.

---
*Last updated: 2026-06-13*
