---
type: task
title: "useTwoStepConfirm — extract two-step confirmation primitive to shared"
status: ready
complexity: low
created: 2026-05-28
updated: 2026-05-28
related_tasks:
  - .agents/tasks/quorum-shared-migration/designs/2026-05-28-hooks-audit-refresh.md
  - .agents/tasks/quorum-shared-migration/shipped-log.md
---

# useTwoStepConfirm — extract two-step confirmation primitive to shared

> **First hook migration to ship after the May 2026 audit refresh.** Establishes the per-task workflow: one candidate (or one bundled-by-shape group), one task file, ship it, move to `.done/`.

## What & Why

Desktop had the same two-step "arm-then-confirm-within-5s" state machine inlined in at least two hooks: `useUserKicking` and `useSpaceLeaving`. Mobile's `useUserKicking` inlines the character-identical state machine (only `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` differs). The audit's side-by-side comparison flagged this as a candidate for extraction.

This migration extracts the primitive to `@quilibrium/quorum-shared` as `useTwoStepConfirm`, then refactors desktop's two hooks to consume it. Mobile is NOT touched in this PR — the lead-dev can later adopt the shared primitive in mobile's `useUserKicking` as a ~5-LOC change (deferred because it requires runtime testing per the workflow's mobile-testing constraint).

**Why not `useKickConfirmation` or `useConfirmation`?**
- `useKickConfirmation` was too specific — desktop uses the pattern in both kick AND space-leave flows.
- `useConfirmation` is already a desktop-only hook with a completely different shape (UI orchestration: shift-click bypass, modal escalation, React mouse events). Mobile would never use it. **VERIFIED-AND-REJECTED** during this session — see [shipped-log.md](shipped-log.md#2026-05-28--usetwostepconfirm) lesson 1.

## Files

### Added in `quorum-shared`

- `src/hooks/useTwoStepConfirm.ts` — the new hook. ~100 LOC with JSDoc.

### Updated in `quorum-shared`

- `src/hooks/index.ts` — barrel export added (top-level `src/index.ts` already `export *`s from `./hooks`, so no change needed there).
- `package.json` — version bump `2.1.0-17` → `2.1.0-18`.

### Updated in `quorum-desktop`

- `src/hooks/business/user/useUserKicking.ts` — refactored to use `useTwoStepConfirm`. Public surface (`{ kicking, confirmationStep, handleKickClick, kickUserFromSpace, resetConfirmation }`) unchanged. Consumer `KickUserModal.tsx` untouched.
- `src/hooks/business/spaces/useSpaceLeaving.ts` — refactored to use `useTwoStepConfirm`. Public surface (`{ confirmationStep, handleLeaveClick, leaveSpace, resetConfirmation, error }`) unchanged. Consumers `LeaveSpaceModal.tsx`, `SpaceSettingsModal/Account.tsx` untouched.

## Shared hook surface

```ts
export interface UseTwoStepConfirmOptions {
  timeoutMs?: number; // default 5000
}

export interface UseTwoStepConfirmResult {
  confirmationStep: 0 | 1;
  armOrConfirm: (onConfirm: () => void | Promise<void>) => void;
  resetConfirmation: () => void;
}

export function useTwoStepConfirm(
  options?: UseTwoStepConfirmOptions
): UseTwoStepConfirmResult;
```

Semantics:
- First call to `armOrConfirm` arms (sets step to 1) and starts the auto-reset timeout.
- Second call within the window invokes `onConfirm()` and resets state.
- If the timeout elapses, state auto-resets; the next call re-arms.
- `resetConfirmation` cancels the timeout and resets state.
- Cleanup on unmount.

## Verification

- ✅ `yarn build` in `quorum-shared` (CJS + ESM + native targets)
- ✅ `yarn test` in `quorum-shared` (189 tests pass, none added — see lesson 2 in shipped-log)
- ✅ `npx tsc --noEmit --jsx react-jsx --skipLibCheck` in `quorum-desktop` (one pre-existing unrelated error in `ImportKeyStep.tsx`, untouched by this work)
- ✅ `yarn test:run` in `quorum-desktop` (321/321 pass)
- ✅ `yarn build` in `quorum-desktop` (succeeded in 35.6s)
- ⏳ Manual smoke test of the kick flow and the leave-space flow in the desktop UI — TODO at commit time. Both should: (a) require two clicks within 5 seconds to commit, (b) auto-reset if the user waits, (c) the modal close should reset state.

## Cross-repo workflow

Per [2026-05-28-cross-repo-workflow.md](2026-05-28-cross-repo-workflow.md):

- **Shape**: additive to shared. Mobile keeps building unchanged — Pattern A in the workflow's gut-check.
- **No mobile PR.** Mobile doesn't import `useTwoStepConfirm` (mobile still inlines the state machine). Adoption is a deferred follow-up that needs runtime testing.
- **Sequence**: shared PR first → desktop PR second. Both self-merged.

## Mobile follow-up (deferred)

Future task, when mobile testing is on the table:
- Refactor mobile's `hooks/chat/useUserKicking.ts` to consume `useTwoStepConfirm` from shared. ~5-LOC change. Needs to be runtime-tested (per the workflow's mobile-testing constraint — touching a hook that runs in a user-facing flow).

## Out of scope (do not bundle in this PR)

- Mobile-side adoption (see above).
- Desktop's `ChannelEditorModal.tsx` has a `deleteConfirmation` object that may use the same pattern — not refactored in this PR. If it's a third consumer of the same state machine, a future PR can refactor it. Verify before scoping.
- `useConfirmation` (the bigger desktop hook) — different shape, not migrated, see lesson 1 in shipped-log.

## Done criteria

- [x] Shared hook lands on `feat/use-two-step-confirm` branch
- [x] Desktop refactors land on `chore/quorum-shared-hooks-migration` branch
- [x] All verification gates pass
- [ ] Manual smoke test of kick + leave-space flows
- [ ] Shared PR opened, self-merged, published
- [ ] Desktop PR opened, self-merged
- [ ] [shipped-log.md](shipped-log.md) entry updated with merged PR URLs

When the last three items are checked, move this file to `.done/`.

---

*Created 2026-05-28 — first migration after the audit refresh. Establishes the per-task workflow.*
