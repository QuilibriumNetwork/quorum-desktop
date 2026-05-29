---
type: log
title: Quorum-shared migration — shipped log
status: ongoing
created: 2026-05-28
audience: future sessions wanting a chronological view of what's been migrated
---

# Quorum-shared migration — shipped log

> **What this is.** A chronological log of completed migration work. Each entry is dated, lists what shipped, and captures the lesson learned (if any). The [README.md](README.md) status table is the authoritative row-by-row view; this log is the longitudinal view.
>
> **What this is NOT.** Not for in-flight work, not for paused tracks, not for design docs. Those live elsewhere in this folder.
>
> **Append-only.** New entries go at the TOP (most recent first). Don't edit old entries except to fix factual errors — add a follow-up entry instead if context changes.

---

## 2026-05-28 — `useTwoStepConfirm`

**Scope**: extract a generic two-step confirmation primitive (arm-then-confirm-within-N-seconds) to shared, refactor two desktop hooks to use it.

**Shipped**:
- `quorum-shared` `2.1.0-17` → `2.1.0-18`
  - New: `src/hooks/useTwoStepConfirm.ts` (~100 LOC)
  - Updated: `src/hooks/index.ts` barrel
- `quorum-desktop`
  - `src/hooks/business/user/useUserKicking.ts` refactored (~30 LOC removed)
  - `src/hooks/business/spaces/useSpaceLeaving.ts` refactored (~25 LOC removed)
  - Public surface of both hooks unchanged — consumers (`KickUserModal`, `LeaveSpaceModal`) untouched.

**Net code impact**: shared +~100, desktop −~55. Real deduplication, not shuffling.

**Mobile**: NOT touched in this PR pair. Mobile's `hooks/chat/useUserKicking.ts` still inlines the same state machine (verified character-identical to desktop's pre-refactor version, except `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` which mobile already uses). A future mobile PR can adopt the shared hook in ~5 LOC; needs runtime test, so deferred until mobile testing is planned.

**How it was verified**:
- `yarn build` in shared (CJS + ESM + native targets) ✅
- `yarn test` in shared (189 tests pass, none added — see "lesson 2" below) ✅
- `npx tsc --noEmit --jsx react-jsx --skipLibCheck` in desktop ✅ (one pre-existing unrelated error in `ImportKeyStep.tsx`, untouched by this work)
- `yarn test:run` in desktop ✅ (321/321 pass)
- `yarn build` in desktop ✅ (35.6s)
- Manual smoke test of kick + leave-space flows: TODO before final PR open

**Lessons**:

1. **Pure imports ≠ shareable.** The audit's first-PR recommendation was Category A2 query helpers (`build*Key.ts` etc.). Spot-checking revealed desktop's `buildSpacesKey() = ['Spaces']` (capital S) conflicts with shared's existing `queryKeys.spaces.all = ['spaces']` (lowercase). The fetchers also reference desktop-specific `MessageDB`. Withdrawn. Same trap caught `useConfirmation` — looked pure but bundles desktop UI orchestration (shift-click bypass, modal escalation) that mobile would never use.

2. **No React hook tests in shared yet.** Shared's existing tests are pure-logic (vitest only, no `@testing-library/react`). Adding `useTwoStepConfirm` tests would have required adding testing-library as a dev dep — scope creep for this PR. The desktop refactors exercise the hook in production paths; verification happens via desktop typecheck + manual smoke test. If we want hook tests in shared later, that's a separate infra PR.

3. **Two hooks instead of one bundled cleanly.** Desktop had the same inlined state machine in `useUserKicking` AND `useSpaceLeaving` (and probably `ChannelEditorModal`'s `deleteConfirmation` too — not refactored this PR). Migrating one without the other would have left half the duplication in place. Bundle by shape, not by minimal-scope.

**Mobile follow-up (deferred)**:
- Mobile's `hooks/chat/useUserKicking.ts` could adopt `useTwoStepConfirm` (5-LOC change)
- Desktop's `ChannelEditorModal.tsx` may also have a `deleteConfirmation` object using a similar pattern — verify in a future audit pass

**PR links**:
- quorum-shared: TODO (fill in when PR opens)
- quorum-desktop: TODO (fill in when PR opens)

---

*Created 2026-05-28 — replaces ad-hoc "Last updated" trailers in the master tracker as the canonical place to log what shipped. Status table still gets a row per shipped item.*
