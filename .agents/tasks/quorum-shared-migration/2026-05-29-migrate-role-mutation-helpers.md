---
type: task
title: Extract toggleRolePermission and setRolePermissions to shared
phase: Phase 2 (C4 extract pure helpers)
status: open
created: 2026-05-29
updated: 2026-05-29
priority: medium
---

# Extract role-mutation pure helpers to `@quilibrium/quorum-shared`

## What

Add two pure role-mutation utility functions to `quorum-shared`:

```ts
// shared API
export function toggleRolePermission(role: Role, permission: Permission): Role;
export function setRolePermissions(role: Role, permissions: Permission[]): Role;
```

Both are byte-for-byte identical logic currently inlined in BOTH platforms. This is a clean C4 (extract-pure-helpers) Phase 2 candidate verified 2026-05-29.

## Why

Both platforms inline the same logic in their role-management code:

**Desktop `src/hooks/business/spaces/useRoleManagement.ts`:**
- `toggleRolePermission` callback (lines ~96-112) inlines the include/filter/spread pattern.
- `updateRolePermissions` callback (lines ~114-124) inlines the spread-with-new-array pattern.

**Mobile `hooks/chat/useRoleManagement.ts`:**
- `useToggleRolePermission.mutationFn` (lines ~417-422) inlines the SAME include/filter/spread.
- `useUpdateRole.mutationFn` (lines ~199-210) inlines the SAME spread-with-new-array (alongside other field updates).

Promoting these two pure functions to shared eliminates the duplication once, AND any future role-mutation hook on either platform reaches for the shared util by default.

## Scope guardrails (what NOT to extract)

Phase 2 verification surfaced several "almost shareable" candidates that we DO NOT extract here:

- **`createRole` / UUID generation**: desktop uses `crypto.randomUUID()` (Web Crypto); mobile uses a `generateUUID()` polyfill over `globalThis.crypto.getRandomValues`. Same Trap E pattern as AES-GCM — platform-correct primitive divergence. Don't force convergence on UUID gen.
- **`toggleRolePublic`**: desktop uses `role.isPublic === false` (strict equality, preserves undefined-as-false); mobile uses `??` coalescing. Tiny semantic difference, 2 LOC each — extraction overhead exceeds payoff.
- **Per-field setters (`setRoleDisplayName`, `setRoleTag`, `setRoleColor`)**: 1-2 LOC spread operations. Too thin to warrant shared API surface.
- **Member assignment helpers (`assignMember`, `removeMember`)**: mobile has them in `useAssignRole`/`useRemoveFromRole`; desktop's `useRoleManagement` doesn't manage membership at all. No duplication to eliminate.

## Files

### quorum-shared

**ADD**: `src/utils/roleUtils.ts` (new file)

```ts
import type { Permission, Role } from '../types';

/**
 * Add or remove a permission from a role.
 * If the role already has the permission, removes it.
 * If not, adds it.
 * Returns a new Role; does not mutate the input.
 */
export function toggleRolePermission(role: Role, permission: Permission): Role {
  return {
    ...role,
    permissions: role.permissions.includes(permission)
      ? role.permissions.filter((p) => p !== permission)
      : [...role.permissions, permission],
  };
}

/**
 * Replace a role's permissions with a new list.
 * Returns a new Role; does not mutate the input.
 */
export function setRolePermissions(role: Role, permissions: Permission[]): Role {
  return { ...role, permissions };
}
```

**EDIT**: `src/utils/index.ts` — add `export * from './roleUtils';`.

**Tests**: `src/utils/roleUtils.test.ts` — small. Three cases per function: add-when-absent, remove-when-present, idempotent set.

### quorum-desktop

**EDIT**: `src/hooks/business/spaces/useRoleManagement.ts`

Replace inline implementations with shared imports:

```ts
import { toggleRolePermission, setRolePermissions } from '@quilibrium/quorum-shared';

// inside the hook:
const toggleRoleAtIndex = useCallback((roleIndex: number, permission: Permission) => {
  setRoles((prev) =>
    prev.map((role, i) => (i === roleIndex ? toggleRolePermission(role, permission) : role)),
  );
}, []);

const updateRolePermissions = useCallback((roleIndex: number, permissions: Permission[]) => {
  setRoles((prev) =>
    prev.map((role, i) => (i === roleIndex ? setRolePermissions(role, permissions) : role)),
  );
}, []);
```

Net: ~10 LOC removed inline; 1 import + 2 1-line calls added.

## Verification gates

### shared
- [ ] `yarn tsc --noEmit` passes
- [ ] `yarn test src/utils/roleUtils.test.ts` passes (6 cases)
- [ ] `yarn build` produces clean output, new exports visible in d.ts

### desktop
- [ ] `npx tsc --noEmit --jsx react-jsx --skipLibCheck` passes
- [ ] Manual smoke: open Space Settings → Roles → toggle a permission on a role → save → reload → confirm the change persisted

## Mobile leg

Mobile adoption is **statically verifiable** — TypeScript and grep confirm completeness without running Expo:

1. Add import: `import { toggleRolePermission, setRolePermissions } from '@quilibrium/quorum-shared';`
2. In `useToggleRolePermission.mutationFn`: replace the inline include/filter/spread block with `const updatedRole = toggleRolePermission(existingRole, params.permission);`.
3. Bump `@quilibrium/quorum-shared` version in mobile's `package.json` to whatever this PR publishes.
4. Verification: `yarn tsc --noEmit && yarn lint && grep -rn "permissions.includes(.*permission)" hooks/` returns zero results in mobile.

Mobile task drop required. Path: `D:\GitHub\Quilibrium\quorum-mobile\.agents\tasks\quorum-shared-migration\2026-05-29-mobile-adopt-shared-role-mutation-helpers.md`.

## Cross-repo PR sequencing

Standard shared → desktop → mobile per [cross-repo-workflow.md](cross-repo-workflow.md):

1. **quorum-shared PR**: add roleUtils + tests + barrel re-export. Self-merge.
2. **quorum-desktop PR**: import + use the new utils. Self-merge.
3. **quorum-mobile**: task drop (not PR — see workflow doc, statically verifiable mobile changes are PR-able but require careful version coordination; task drop lets a future runtime-test session bundle this with other queued mobile work).

## Bonus finding (track separately — NOT part of this task)

The Phase 2 verification surfaced a higher-LOC mobile-side opportunity:

Mobile re-implements three pure read-side helpers as React hooks instead of using shared's existing exports:

- Mobile's `useHasPermission(spaceId, userAddress, permission)` → shared has `hasPermission(userAddress, permission, space, isSpaceOwner)`.
- Mobile's `useUserPermissions(spaceId, userAddress)` → shared has `getUserPermissions(userAddress, space, isSpaceOwner)`.
- Mobile's `useUserRoles(spaceId, userAddress)` → shared has `getUserRoles(userAddress, space)`.

**Nuance** (why it's not a trivial rewire): mobile's hooks take `spaceId` and use `useRoles(spaceId)` reactively, whereas shared's pure functions take a pre-fetched `Space` object. The rewire shape is: mobile's hooks become thin wrappers that call `useRoles(spaceId)` themselves to fetch the data, build a partial `Space`-shaped object, then call into shared's pure functions. Plus a correctness gain: shared's `isSpaceOwner` parameter is missing from mobile's version — current mobile incorrectly returns `false` for space owners' permissions.

This is a Category C1 (mobile eliminating inline reimplementations of shared utilities) task, ~60 LOC payoff, separate from this Phase 2 extraction. Mobile task dropped at: `D:\GitHub\Quilibrium\quorum-mobile\.agents\tasks\quorum-shared-migration\2026-05-29-mobile-adopt-shared-permission-helpers.md`. Statically verifiable but the composition refactor is bigger than a 1-line import swap.

## Done criteria

- [ ] quorum-shared PR opened and merged with `roleUtils` exports + tests
- [ ] quorum-desktop PR opened and merged consuming the new utils
- [ ] Mobile task file dropped at `D:\GitHub\Quilibrium\quorum-mobile\.agents\tasks\quorum-shared-migration\2026-05-29-mobile-adopt-shared-role-mutation-helpers.md`
- [ ] Row added to `mobile-tasks-pending.md`
- [ ] Entry added to `shipped-log.md`
- [ ] This task file moved to `.done/`
- [ ] `roadmap.md` Phase 2 candidate list updated to mark this resolved

## What this task explicitly does NOT cover

- The bonus C1 mobile-side rewire of `useHasPermission`/`useUserPermissions`/`useUserRoles` (separate task).
- Any role-mutation logic beyond `toggleRolePermission` and `setRolePermissions` (excluded per scope guardrails above).
- The desktop-internal AES-GCM config-decrypt cleanup (separate task in Paused tracks).
