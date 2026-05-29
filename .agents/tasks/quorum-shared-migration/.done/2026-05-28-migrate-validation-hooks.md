---
type: task
title: "Validation hooks — move logic to shared with errorKey i18n pattern"
status: ready
complexity: medium
created: 2026-05-28
updated: 2026-05-28
related_tasks:
  - .agents/tasks/quorum-shared-migration/designs/2026-05-28-hooks-audit-refresh.md
  - .agents/tasks/quorum-shared-migration/shipped-log.md
  - .agents/tasks/quorum-shared-migration/2026-05-28-cross-repo-workflow.md
---

# Validation hooks — move logic to shared with errorKey i18n pattern

> **Second hook migration after `useTwoStepConfirm`.** Establishes the `errorKey` i18n pattern in practice. The shared validators carry the logic; desktop's existing hooks become thin Lingui-translating wrappers.

## What & Why

Desktop has 6 pure validation hooks under `src/hooks/business/validation/` that validate user-facing identifiers (channel name, channel topic, display name, group name, space name, space description, user bio, user note, device name, message length). Each hook bundles the validation logic + Lingui-translated error strings.

Mobile has parallel inline validation in components (`SpaceModal.tsx`, `SpaceSettingsModal.tsx`) with a comment "matches desktop" — meaning the lead-dev intends convergence but had to inline duplicates because no shared API existed. Mobile uses hardcoded English strings (no i18n system today).

This migration moves the validation **logic** to shared (returning `errorKey` codes per the new i18n rule in the workflow doc), keeps desktop's hooks as thin Lingui-translating wrappers, and unblocks mobile to consume the same validators later (with English-string wrappers OR Lingui-string wrappers if mobile adopts Lingui).

## Rules being applied

- **i18n-in-shared rule** (codified 2026-05-28 in the workflow doc): shared returns `{ ok: false, errorKey, errorVars? }`, never user-facing text. Each platform owns a thin wrapper that materializes strings.
- **Follow mobile patterns rule**: where shared values diverge from desktop (`MAX_NAME_LENGTH` was 40 on desktop, 50 on mobile), align to mobile (`50`). Lead-dev's choice for mobile is the working pattern; desktop adjusts.
- **Bundle-by-shape rule**: all 6 validation hook files migrate together (same shape, same plumbing). Splitting one-hook-per-PR would be ceremony, not safety.

## Constant changes

- `MAX_NAME_LENGTH`: **40 → 50** (align to mobile)
- Add `MIN_NAME_LENGTH = 2` (mobile has this; desktop didn't enforce a minimum but should — empty trim is currently the only guard)

These are exported from `quorum-shared/src/utils/validation.ts`. Desktop hooks already import from shared, so the constant changes propagate automatically.

## Files

### Added in `quorum-shared`

- `src/validation/spaceName.ts` — `validateSpaceName(name): { ok } | { ok: false, errorKey, errorVars? }`
- `src/validation/displayName.ts` — `validateDisplayName(name)` (includes reserved-name + impersonation checks)
- `src/validation/channelName.ts` — `validateChannelName(name)`
- `src/validation/channelTopic.ts` — `validateChannelTopic(topic)`
- `src/validation/groupName.ts` — `validateGroupName(name)`
- `src/validation/deviceName.ts` — `validateDeviceName(name)` (includes the `DEVICE_NAME_PATTERN` regex)
- `src/validation/spaceDescription.ts` — `validateSpaceDescription(description, maxLength)`
- `src/validation/userBio.ts` — `validateUserBio(bio)` + `MAX_BIO_LENGTH = 160` constant
- `src/validation/userNote.ts` — `validateUserNote(note)` + `MAX_USER_NOTE_LENGTH = 256` constant
- `src/validation/index.ts` — barrel
- Tests for each (vitest, pure logic — these CAN have tests since they're pure functions, not React hooks)

### Updated in `quorum-shared`

- `src/utils/validation.ts` — bump `MAX_NAME_LENGTH = 40 → 50`, add `MIN_NAME_LENGTH = 2`
- `src/index.ts` — `export * from './validation'` added
- `package.json` — `2.1.0-18 → 2.1.0-19`

### Updated in `quorum-desktop`

- `src/hooks/business/validation/useChannelValidation.ts` — refactor to thin Lingui wrapper around shared validators
- `src/hooks/business/validation/useDisplayNameValidation.ts` — same
- `src/hooks/business/validation/useGroupNameValidation.ts` — same
- `src/hooks/business/validation/useSpaceNameValidation.ts` — same (also wraps `validateSpaceDescription`, `validateUserBio`, `validateUserNote`)
- `src/hooks/business/validation/useDeviceNameValidation.ts` — same
- Public surface (`{ error, isValid }` hook return + non-hook `validateXxx(name): string | undefined`) unchanged. Consumers untouched.

### NOT changed

- `useMessageValidation.ts` — already has zero strings (returns numbers and booleans). The `t\`\`` calls in it are gone (verified). Skip from this PR's scope; can be migrated separately later if there's a reason.

  *Correction during work: if `useMessageValidation` has zero i18n strings, it's a candidate for a different pattern (move the whole hook to shared, not just the logic). Punt on this unless it's clean to add.*

- `useProfileValidation.ts` — already a pure function `validateProfileImage` with no `t\`\`` calls. Could be moved as-is in a different scope. Not part of this PR.

- `useAddressValidation.ts` / `.native.ts` — uses `useQuorumApiClient` context (Category B). Not migrated in this batch.

## Mobile

- **No mobile PR in this batch.** Shared additions are purely additive. Mobile keeps its inlined validation untouched.
- **Future mobile follow-up**: when the lead-dev is ready, mobile can replace its inlined `validateSpaceName` (etc.) with a thin English-string wrapper around the shared validator. ~50 LOC across affected components. Requires runtime testing per the mobile-testing constraint.

## Verification

- [x] `yarn build` in shared ✅ (CJS + ESM + native targets)
- [x] `yarn test` in shared ✅ (231 passed, up from 189 — added 42 validator tests)
- [x] `npx tsc --noEmit --jsx react-jsx --skipLibCheck` in desktop ✅ (one pre-existing unrelated error in `ImportKeyStep.tsx`)
- [x] `yarn test:run` in desktop ✅ (321/321)
- [x] `yarn build` in desktop ✅ (16s)
- [x] Manual smoke test: verified by user across create-space, display-name, channel/group, etc. Caught one bug (unilateral MIN added to display name) — fixed before commit. Final behaviour matches mobile patterns + pre-refactor desktop.

## Cross-repo workflow

- **Additive only** for shared. Mobile keeps building. Pattern A in the workflow doc.
- **No mobile PR.**
- **Sequence**: shared PR first → desktop PR second.

## Done criteria

- [x] Shared validators added with errorKey return shape
- [x] Desktop hooks refactored to Lingui-translating wrappers
- [x] All verification gates pass
- [x] Manual smoke test of validation flows
- [x] Shared PR opened, self-merged — PR #TBD (filled in at push time)
- [x] Desktop PR opened, self-merged — PR #TBD
- [x] [shipped-log.md](../shipped-log.md) entry added
- [x] Mobile task file dropped at `quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-28-adopt-shared-validators.md`
- [x] Mobile-tasks tracker updated at [`../mobile-tasks-pending.md`](../mobile-tasks-pending.md)
- [x] Existing docs updated for new MAX/MIN constants: `input-validation-reference.md`, `device-naming.md`, `space-folders.md`
- [x] This file moved to `.done/`

## PR links

- quorum-shared: [#20](https://github.com/QuilibriumNetwork/quorum-shared/pull/20) ✅ merged
- quorum-desktop: TBD (fill at push time)
- quorum-mobile: dropped as local task — see [mobile-tasks-pending.md](../mobile-tasks-pending.md)
