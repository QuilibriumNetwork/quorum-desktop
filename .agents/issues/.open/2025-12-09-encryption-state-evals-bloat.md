---
type: bug
title: Encryption State Evals Causing Config Sync Bloat
status: open
priority: high
created: 2026-01-09T00:00:00.000Z
updated: 2026-08-05
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

## MEASURED 2026-08-05 — now 98% of the config blob, and a 4.2 MB upload SUCCEEDED

Taken with `.agents/tools/dm-debug/08-self-identity-sources.js` on a real
account, immediately after the bookmark-avatar strip
(`2026-08-05-bookmarks-are-75-percent-of-the-config-blob.md`) landed and forced a
fresh `saveConfig`.

| part | KB | share |
|---|---|---|
| **whole blob** | **4205.4** | — |
| **spaceKeys (encryption states)** | **4112.1** | **98%** |
| profile_image | 49.6 | 1% |
| bookmarks (post-fix) | 37.1 | <1% |
| everything else | 6.5 | — |

Per space:

| space | kb | classification |
|---|---|---|
| **Cross device test** | **1976.1** | CREATED (~10k evals) |
| **Test Leave** | **1975.4** | CREATED (~10k evals) |
| Quorum Test Community Space | 63.4 | joined |
| Polar bears and cubs | 63.3 | joined |
| Quilibrium Community | 34.0 | joined |

**Both fat states are throwaway TEST spaces**, and both are live — each has rows
in `spaces`, `space_members` and `config.spaceKeys`. So this is not the
leaked-orphan bug below; it is the plain cost of having created two spaces. Two
disposable test spaces are carrying 94% of a real account's sync payload.

Exactly the predicted shape: ~2 MB per created space, ~12-63 KB per joined one.
Two fat states, 3952 KB between them.

### Three things this settles

1. **A 4205 KB config uploaded successfully.** `allowSync` was on, the
   refuse-to-publish guard was not holding, and `ConfigService.saveConfig` runs
   `postUserSettings` BEFORE `saveUserConfig` with no try/catch between them
   (`ConfigService.ts:700-712`) — so a thrown POST skips the local save. The
   local config was observably rewritten, therefore the POST returned.
   **The "~1 MB maximum observed working" figure in `config-sync-system.md` is
   conservative by at least 4x.** The real ceiling is still unknown; the ~21 MB
   failure figure remains the only known-bad point.

2. **Every blob measurement before a fresh save was a LOWER BOUND.** The same
   account read 873 KB minutes earlier with `spaceKeys` at 160.6 KB.
   `config.spaceKeys` is a snapshot refreshed only by `saveConfig`, so the blob
   had been multi-megabyte in substance for some time and nothing showed it.
   This is why the bloat kept being characterised as an occasional
   space-creation failure rather than a standing condition.

3. **The doc's mitigation does not exist.** `config-sync-system.md` claimed "the
   100KB per-encryption-state filter keeps total payload well under limits".
   There is no such filter — `ConfigService.ts:561` filters on
   `encryptionState !== undefined`, a presence check. Corrected in that doc
   2026-08-05. Nothing bounds a state entering the blob, and nothing checks the
   blob's size before uploading.

### ~~Still open here~~ ANSWERED 2026-08-05

Both fat states are live created spaces, named above, neither orphaned. The tool
now prints space names — it read the wrong field (`name` instead of `spaceName`)
until 2026-08-05 and rendered every space as "(unknown)", which is why earlier
readings could not answer this and why the bloat was never attributable to a
specific space.

**Next decision, and it is not ours to make alone.** The issue's own "Actionable"
section already scopes it: shrink the pool at creation (the SDK accepts `total`,
one line, desktop-local) and/or trim evals from the config upload while keeping
the full pool locally. The second helps EXISTING accounts and the first does not,
but it changes the blob contract and must match mobile — the lead-dev call this
issue has been waiting on since 2025-12-09. What this measurement adds is the
argument: it is no longer "space creation occasionally 400s", it is "two
throwaway test spaces permanently occupy 94% of the payload that carries every
synced setting, on an account that is otherwise healthy".
