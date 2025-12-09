# Encryption State Evals Causing Config Sync Bloat

https://github.com/QuilibriumNetwork/quorum-desktop/issues/108

## Problem

When a user **creates** a space, the encryption state stores ~10,000 polynomial evaluations (`evals`) for private invite generation. Each eval is ~200 bytes, resulting in **~2MB per created space**.

A test user who created 10+ spaces hit the API config sync limit (`invalid config missing data` 400 error) because the total payload exceeded the server limit.

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

## Temporary Fix (Not Production-Ready)

Added a filter in `ConfigService.saveConfig` to skip encryption states >100KB:

```typescript
// src/services/ConfigService.ts:406-415
const MAX_STATE_SIZE = 100000;
config.spaceKeys = allSpaceKeys.filter(sk => {
  const stateSize = JSON.stringify(sk.encryptionState).length;
  if (stateSize > MAX_STATE_SIZE) {
    console.warn('Skipping bloated encryption state for space:', sk.spaceId);
    return false;
  }
  return true;
});
```

**This is not suitable for production** - it silently skips syncing encryption states for all newly created spaces, breaking cross-device private invite generation. This is just so I can keep using my test user without deleting Spaces.

## Proposed Solution

**On-demand eval generation**: Can the SDK generate evals incrementally when needed, rather than all upfront at space creation?

This would allow:
- Spaces to start with 0 or minimal evals (~12KB like joiners)
- Evals generated only when creating private invites
- No arbitrary limit that's either too small (runs out) or too large (bloats sync)

Note: Consumed evals are already removed from state when private invites are sent (`InvitationService.ts:95-102`). The issue is the initial 10K allocation.

---

_Created: 2025-12-09_
