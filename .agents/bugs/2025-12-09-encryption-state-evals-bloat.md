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

---
