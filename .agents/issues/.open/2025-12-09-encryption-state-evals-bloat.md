---
type: bug
title: Encryption State Evals Causing Config Sync Bloat
status: open
created: 2026-01-09T00:00:00.000Z
updated: 2025-12-09T00:00:00.000Z
related_issues:
  - '#108'
---

# Encryption State Evals Causing Config Sync Bloat

https://github.com/QuilibriumNetwork/quorum-desktop/issues/108

## Problem

When a user **creates** a space, the encryption state stores ~10,000 polynomial evaluations (`evals`) for private invite generation. Each eval is ~200 bytes, resulting in **~2MB per created space**.

A test user who created 2+ spaces hit the API config sync limit (`invalid config missing data` 400 error) because the total payload exceeded the server limit (~4MB).

Users who **join** spaces are not affected (they get 0 evals, ~12KB per space).

**Important**: Only **private invites** consume evals. Public invites don't use evals at all. In practice, most spaces will use public invites (especially large communities), making the 10K pre-allocation largely unnecessary.

## Root Cause

In `SpaceService.createSpace()`, the SDK is called without a `total` parameter, defaulting to ~10,000 evals:

```typescript
// src/services/SpaceService.ts:343-347
const session = await secureChannel.EstablishTripleRatchetSessionForSpace(
  keyset.userKeyset,
  keyset.deviceKeyset,
  registration
  // No 'total' parameter → defaults to ~10,000
);
```

**This is a pre-existing issue in the `develop` branch** (same pattern at `MessageDB.tsx:2860`), not something introduced by feature branches.

## Workaround

**Disable config sync**: Users who hit this issue can disable "Allow Sync" in Privacy settings. This prevents the API call that fails, while still allowing local space creation.

The bloated encryption states remain in local IndexedDB (no size limit) and spaces work normally. The tradeoff is no cross-device sync until the SDK issue is fixed.

## Proposed Solution

**On-demand eval generation**: Can the SDK generate evals incrementally when needed, rather than all upfront at space creation?

This would allow:
- Spaces to start with 0 or minimal evals (~12KB like joiners)
- Evals generated only when creating private invites
- No arbitrary limit that's either too small (runs out) or too large (bloats sync)

Note: Consumed evals are already removed from state when private invites are sent (`InvitationService.ts:95-102`). The issue is the initial 10K allocation.

## Update 2026-07-19 — desktop-vs-mobile: same bloat, different failure surface

Investigated on the security multi-device signing-key work's critical path.
The prompting question was "mobile creates spaces flawlessly even after
several, desktop 400s after a few created ones — is mobile a different invite
architecture we should port?" Answer: **no, the invite architecture is the
same; what differs is how each platform handles a FAILED config upload.**

### The bloat is identical on both platforms

- Both store/upload a ~10K-eval pool (~2MB) per *created* space. Desktop
  `SpaceService.ts:350` calls the SDK with no `total` (defaults ~10K); mobile
  `quorum-mobile/services/space/spaceService.ts:352` passes `10000` explicitly.
  Both upload the full untrimmed state in the config blob
  (desktop `ConfigService.ts:433-448`, mobile `configService.ts:448-455`).
- The public-invite rework (`MAX_PUBLIC_EVALS = 1`) is already on desktop
  (`InvitationService.ts:25`, "Matches mobile") and does NOT shrink the blob.
- So a space *created* on mobile bloats mobile's own upload too. Mobile is not
  immune to the bloat.

### Why mobile FEELS flawless (the real answer)

Different failure surface, not different data:
- **Mobile** treats config save as non-fatal during create
  (`quorum-mobile/services/space/spaceService.ts:398-411`, comment
  "Non-fatal - space is created") and its `saveConfig` swallows an upload 400
  as a logged warning, then still saves locally
  (`configService.ts:566-579`). The user always sees space creation succeed —
  even when the sync silently failed. Cost: silent cross-device sync breakage
  (matches the tracker test-log D: a mobile-created space never reached desktop).
- **Desktop** awaits `saveConfig` on the create path and wraps the config POST
  in a blocking 30s save modal (mutate 22s timeout ×retries, `baseTypes.ts`),
  so the same 400/timeout surfaces as a loud error that blocks creation.

So mobile isn't immune to the bloat — it is immune to *showing* the failure,
which is arguably worse (the sync is broken but nobody is told). Desktop just
tells the truth loudly.

### Actionable

- The desktop SDK already accepts a `total?` arg
  (`quilibrium-js-sdk-channels/dist/index.d.ts:796`); desktop's create call
  omits it → pool size is tunable with a one-line change, no SDK bump.
- Real fix is a blob-contract change on BOTH platforms: shrink the pool at
  creation (small `total`), or trim evals from the config upload only (keep
  full pool local). Must match across platforms. Deferred to lead-dev decision
  (raise via Telegram).

---

## Compounding bug 2026-07-19 — space deletion LEAKS the bloated state (garbage accumulation)

Found while cleaning a real test account. The diagnostic
(`window.__messageDB.analyzeEncryptionStates()`) showed **10 bloated ~2MB
created-space states = 19.4MB local**, while the UI showed only **2 created
spaces**. So ~8 created-space encryption states (~16MB) were orphaned debris
from spaces "deleted" earlier — the space vanished from the UI but its ~2MB
encryption state (plus keys/members/messages) was never removed.

Root cause — `SpaceService.deleteSpace()` (`src/services/SpaceService.ts:563`)
runs all LOCAL cleanup LAST, gated behind a network call and an early throw:

- `:569-576` throws immediately if the hub key is missing ("incomplete
  configuration") → no cleanup (the tracker's D7 corrupted-space case).
- `:619` `postHubDelete()` is a network call; if it fails/times out the
  function throws here, BEFORE the local cleanup at `:654-685`.
- `:654-685` (delete encryption state, messages, members, keys, space row)
  only runs if the network delete succeeded.

There is also NO garbage collector: nothing ever removes encryption
states/keys/members for a spaceId no longer in `getSpaces()`. Spaces removed
via config-sync from another device (which drops the space row but not the
encryption state) leak the same way.

Impact: local IndexedDB accumulates ~2MB per abandoned created space. NOTE the
config upload filters spaceKeys to `config.spaceIds` (`ConfigService.ts:476-479`),
so ghosts are NOT uploaded — the 400/timeout is caused by the REAL created
spaces still in the config (each ~2MB; 2 created ≈ 4MB ≈ the server limit).
So garbage cleanup fixes local storage but does NOT fix the 400 on its own —
the real created spaces still need the #108 shrink (trim pool / smaller total).
Confirmed on a live account 2026-07-19: config.spaceIds = 4 (2 created + 2
joined), getSpaces() = 13 → 9 ghost space rows (8 carrying ~2MB states = ~16MB
local garbage; 1 is the empty `QmVBXRsHg…` missing-state row). Server-side data
for orphaned created spaces (manifest/hub/evals) is also never cleaned.

Proposed fix (lead's call):
1. Make local cleanup network-independent — run the `deleteEncryptionState /
   deleteMessage / deleteSpaceMember / deleteSpaceKey / deleteSpace` block
   regardless of whether `postHubDelete` succeeds (best-effort network leave,
   guaranteed local purge). Wrap in try/finally.
2. Add a force-delete path for corrupted spaces (missing hub key) that skips
   the network leave and purges local rows (D7).
3. Add an orphan sweep: on startup or on demand, delete encryption
   states/keys/members/messages whose spaceId is absent from `getSpaces()`
   (guard the space-self conversation pattern `id/id` so DM states are never
   touched).

Manual unblock used meanwhile: console script — purge orphan space states
fully (state+keys+members+messages), trim live created spaces' eval pool to
~256. Both operate only on `id/id` space conversations, never DMs.

---
