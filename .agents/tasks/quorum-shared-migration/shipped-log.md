---
type: log
title: Quorum-shared migration — shipped log
status: ongoing
created: 2026-05-28
audience: future sessions wanting a chronological view of what's been migrated
---

# Quorum-shared migration — shipped log

> Chronological view of completed migrations. Each entry is tight: scope, what shipped, the 1–2 lessons worth carrying forward, mobile status, PR links. Verification details and full narrative live in the per-task doc in this folder.
>
> [README.md](README.md) is the authoritative row-by-row table. This log is the longitudinal view.
>
> **Append-only.** New entries at the TOP. Fix factual errors in place; otherwise add a follow-up entry.

---

## 2026-05-28 — Field validators (`validateSpaceName`, `validateDisplayName`, …)

**Scope**: extract 9 pure field validators to shared with the `errorKey` i18n pattern; refactor 5 desktop validation hooks to thin Lingui-translating wrappers.
**Shipped**: shared `2.1.0-18` → `2.1.0-19` (new `validation/` module: spaceName/displayName/channelName/channelTopic/groupName/deviceName/spaceDescription/userBio/userNote + 42 new tests); desktop validation hooks now route through shared via `errorTranslator.ts`. `MAX_NAME_LENGTH` 40 → 50, new `MIN_NAME_LENGTH = 2` (Space names only — aligned to mobile). Folder names left at 40 (separate `maxLength` prop; flagged in `space-folders.md` for a future PR).
**Lessons**: (1) **i18n-in-shared rule established** (codified in workflow doc) — shared exports `errorKey` codes, platforms own a thin translator. Lets desktop keep Lingui, mobile keep hardcoded English, future mobile-Lingui adoption changes only the wrapper. (2) **Verify rules per-field, not by category** — first pass added `MIN_NAME_LENGTH = 2` to displayName too; turned out mobile only enforces MIN on space names, pre-refactor desktop had no MIN at all. Caught during user smoke test, fixed before ship. (3) **Existing docs lag the migration** — `input-validation-reference.md`, `device-naming.md`, `space-folders.md` all referenced 40-char limit; updated alongside the code change.
**Mobile**: not touched. Mobile has duplicate `validateSpaceName` + inline `MIN_NAME_LENGTH = 2 / MAX_NAME_LENGTH = 50 / MAX_DESCRIPTION_LENGTH = 300` in `SpaceModal.tsx` and `SpaceSettingsModal.tsx`. Adoption task dropped at [`quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-28-adopt-shared-validators.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-28-adopt-shared-validators.md) — needs runtime testing (per the workflow's mobile-testing rule), so deferred. Tracked at [`mobile-tasks-pending.md`](mobile-tasks-pending.md).
**PRs**: shared [#20](https://github.com/QuilibriumNetwork/quorum-shared/pull/20) ✅, desktop [#TBD-FILL-AFTER-OPEN](https://github.com/QuilibriumNetwork/quorum-desktop/pull/TBD).

---

## 2026-05-28 — `useTwoStepConfirm`

**Scope**: extract two-step confirm primitive (arm → confirm-within-N-seconds) to shared, refactor two desktop hooks.
**Shipped**: shared `2.1.0-17` → `2.1.0-18` (new `useTwoStepConfirm.ts` ~100 LOC); desktop `useUserKicking` + `useSpaceLeaving` refactored (−~55 LOC). Public hook surface unchanged, consumer modals untouched.
**Lessons**: (1) pure imports ≠ shareable — query-key helpers and `useConfirmation` both looked migratable, both withdrew on inspection (key-casing conflict with shared, desktop-only modal orchestration); (2) bundle by shape, not minimal scope — both desktop consumers in one PR avoided leaving half the duplication behind.
**Mobile**: not touched. `hooks/chat/useUserKicking.ts` adoption is ~5 LOC, deferred to a mobile-test session. `ChannelEditorModal.deleteConfirmation` uses the bigger `useConfirmation` orchestration, not this primitive — not a third consumer.
**PRs**: shared [#19](https://github.com/QuilibriumNetwork/quorum-shared/pull/19) ✅, desktop [#161](https://github.com/QuilibriumNetwork/quorum-desktop/pull/161) ✅.

---

*Created 2026-05-28. Compressed 2026-05-29 — verification lists and full narrative now stay in per-task docs; this log keeps only what's worth re-reading later.*
