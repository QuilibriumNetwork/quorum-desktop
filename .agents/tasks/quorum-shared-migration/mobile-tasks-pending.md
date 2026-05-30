---
type: tracker
title: Mobile tasks pending (dropped during desktop migration sessions)
status: ongoing
created: 2026-05-28
audience: future sessions wanting to see what's queued on the mobile side
---

# Mobile tasks pending

> Mobile's `.agents/` is gitignored, so mobile task files have no GitHub visibility. This table is the desktop-side bookkeeping: a list of mobile tasks dropped during our migration sessions, so we don't lose track of work that's been handed off.
>
> **Maintenance**: when a mobile task file moves to `.done/` (or is closed), update the row here. Append new rows at the BOTTOM (chronological by drop date).
>
> **Shared version note for executors**: task files written before today may pin older shared versions (e.g. `2.1.0-18`, `2.1.0-19`). Those are "available since" floors, not exact pins. When picking up any task, bump mobile's `@quilibrium/quorum-shared` to the **latest published version** (currently `2.1.0-21` as of 2026-05-30 — check npm for newer). All APIs referenced by these tasks were verified present in `2.1.0-21` on 2026-05-30.

## Currently queued

| Drop date | Task file | What it covers | Triggered by (desktop PR) | Runtime test? | Status |
|---|---|---|---|---|---|
| 2026-05-28 | [`2026-05-28-adopt-shared-validators.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-28-adopt-shared-validators.md) | Drop mobile's local `validateSpaceName` + inline length constants in `SpaceModal.tsx` and `SpaceSettingsModal.tsx`; consume `@quilibrium/quorum-shared@2.1.0-19` validators via a thin English-string translator. Adds XSS check on space name (defense-in-depth). | [quorum-desktop#162](https://github.com/QuilibriumNetwork/quorum-desktop/pull/162) (validation hooks migration) | ✅ required | 📋 open |
| 2026-05-29 | [`2026-05-29-mobile-adopt-useTwoStepConfirm-in-useUserKicking.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-29-mobile-adopt-useTwoStepConfirm-in-useUserKicking.md) | Replace inlined two-step confirmation state machine in mobile's `hooks/chat/useUserKicking.ts` with shared's `useTwoStepConfirm` (already at `2.1.0-18`). Desktop already adopted in [#161](https://github.com/QuilibriumNetwork/quorum-desktop/pull/161). Mobile is the last inline holdout. Public hook surface unchanged. | [quorum-shared#19](https://github.com/QuilibriumNetwork/quorum-shared/pull/19) + [quorum-desktop#161](https://github.com/QuilibriumNetwork/quorum-desktop/pull/161) | ✅ required | 📋 open |
| 2026-05-29 | [`2026-05-29-mobile-adopt-shared-permission-helpers.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-29-mobile-adopt-shared-permission-helpers.md) | Refactor mobile's `useHasPermission`/`useUserPermissions`/`useUserRoles` (in `hooks/chat/useRoleManagement.ts:56-115`) to delegate to shared's existing `hasPermission`/`getUserPermissions`/`getUserRoles` pure functions. Removes ~60 LOC of duplicated logic and picks up the `isSpaceOwner` short-circuit mobile is missing (current mobile silently returns false for owners' permissions — intentional behavior fix). | Phase 2 verification 2026-05-29 (no triggering PR — finding from desktop's `useRoleManagement` audit) | ✅ required | 📋 open |
| 2026-05-29 | [`2026-05-29-mobile-rewire-invite-helpers-to-shared.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-29-mobile-rewire-invite-helpers-to-shared.md) | Mobile has THREE local reimplementations of invite helpers shared already exports: `getInviteUrlBase` (in `services/space/inviteService.ts:68-72`), `VALID_INVITE_PREFIXES` (in `inviteService.ts:26-36` AND `hooks/chat/useSpaceActions.ts:26-36`), `parseInviteLink` (in both files). Mobile's `getInviteUrlBase` hardcodes the prod domain — staging/localhost builds generate wrong invite links. Rewire all three to shared's exports (`getInviteUrlBase`, `getValidInvitePrefixes`, `parseInviteParams`). ~80 LOC removed + correctness fix. | Phase 2 verification 2026-05-29 (no triggering PR — finding from desktop's manifest/invite audit) | ✅ required | 📋 open |
| 2026-05-30 | [`2026-05-30-mobile-adopt-shared-role-mutation-helpers.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-30-mobile-adopt-shared-role-mutation-helpers.md) | Adopt shared `toggleRolePermission` (from `@quilibrium/quorum-shared@2.1.0-21`) in `useToggleRolePermission.mutationFn` (`hooks/chat/useRoleManagement.ts`). Pure mechanical refactor, byte-for-byte equivalent. `useUpdateRole.mutationFn` stays inline (multi-field update, out of scope). | [quorum-shared#21](https://github.com/QuilibriumNetwork/quorum-shared/pull/21) + [quorum-desktop#163](https://github.com/QuilibriumNetwork/quorum-desktop/pull/163) | ❌ not required | 📋 open |
| 2026-05-30 | [`2026-05-30-mobile-dedup-deriveAddress.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-30-mobile-dedup-deriveAddress.md) | Dedupe `deriveAddress` — 3 local copies (`spaceService`, `useChannelManagement`, `useSpaceActions`) → 1 import from `services/onboarding/keyService.ts`. Mobile-internal cleanup, no shared change, ~15 LOC removed. Surfaced during bonus C1 sweep. | None — finding from 2026-05-30 mobile sweep | ❌ not required | 📋 open |

## Completed

(empty)

---

*Created 2026-05-28. Workflow rationale in [cross-repo-workflow.md](cross-repo-workflow.md) section "Proactive mobile task drop".*
