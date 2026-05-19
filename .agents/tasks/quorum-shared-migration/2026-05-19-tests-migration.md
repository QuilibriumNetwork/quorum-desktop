---
type: task
title: "Util Tests — Relocate to quorum-shared"
status: ready
complexity: low
created: 2026-03-19
updated: 2026-05-19
related_tasks:
  - .agents/tasks/quorum-shared-migration/designs/2026-03-18-utils-design.md
---

# Util Tests — Relocate to quorum-shared

> **2026-05-19 refresh.** Previously titled "move tests to quorum-shared" and dated 2026-03-19. Rewritten to reflect actual current state: utils migration is done, hooks migration is blocked (so hook tests stay put), and the only loose ends are 2–3 util test files in desktop that test functions which already live in shared.

## What & Why

Three util test files in `quorum-desktop/src/dev/tests/utils/` test pure functions that **already live in `@quilibrium/quorum-shared`** (migrated as part of the utils PR in March 2026). The tests should be co-located with the source — they currently work because they import from the published shared package, but the tests themselves should run in the shared repo's test suite so:

- Both desktop and mobile (future) benefit from the same coverage without duplicating
- The shared package's `yarn test:run` is the canonical pass/fail for shared functions
- Adding new utils to shared has a natural test home (no friction)

## Per-file disposition (verified against current state)

| Test file | Imports from | Disposition |
|---|---|---|
| `reservedNames.test.ts` | `@quilibrium/quorum-shared` | ✅ **Migrate.** Tests `normalizeHomoglyphs`, `isImpersonationName`, `isReservedName`, etc. — all live in shared `validation.ts`. |
| `mentionUtils.enhanced.test.ts` | `@quilibrium/quorum-shared` | ✅ **Migrate.** Tests `extractMentionsFromText` — lives in shared `mentions.ts`. |
| `messageGrouping.unit.test.ts` | `@quilibrium/quorum-shared` + local `../../../utils/dayjs` | ✅ **Migrate with adjustment.** Tests `shouldShowDateSeparator`, `getStartOfDay`, `getDateLabel`, `groupMessagesByDay`, `generateListWithSeparators` — all in shared `messageGrouping.ts`. The local `dayjs` import is just for constructing test fixtures; shared has its own `dayjs.ts` module, so swap to that. |
| `mentionHighlighting.test.ts` | local `../../../utils/mentionHighlighting` | ❌ **Stay in desktop.** The source file `mentionHighlighting.ts` is DOM-coupled and explicitly stays per-app per the utils design doc. The test must stay with it. |
| `deviceInfo.unit.test.ts` | local `../../../utils/deviceInfo` | ❌ **Stay in desktop.** Tests desktop-local utility. |

So three files migrate, two stay.

## Service tests are out of scope here

Service tests (`src/dev/tests/services/*`) travel with their respective service migrations (see [2026-05-18-typing-shared-migration.md](2026-05-18-typing-shared-migration.md) and [2026-05-19-receipts-shared-migration.md](2026-05-19-receipts-shared-migration.md)). They are not part of this task.

## Hook tests are out of scope here

The hooks migration is blocked on mobile codebase access ([designs/2026-03-19-hooks-design.md](designs/2026-03-19-hooks-design.md)). Hook tests stay in desktop until the hooks themselves migrate. Currently `src/dev/tests/hooks/` contains only `useDeviceNameValidation.unit.test.ts`, which tests a desktop-only validation hook.

## Steps

### 1. Move test files to quorum-shared

Destination convention: co-locate next to the source (matches the existing `quorum-shared/src/sync/service.test.ts` pattern), or use `src/utils/__tests__/` if Vitest config prefers a flat tests folder. Both patterns work — pick whichever the maintainer prefers.

Recommended layout (co-located, mirrors the sync precedent):

- `quorum-shared/src/utils/reservedNames.test.ts` — copy from desktop `src/dev/tests/utils/reservedNames.test.ts`
- `quorum-shared/src/utils/mentions.test.ts` — copy from desktop `src/dev/tests/utils/mentionUtils.enhanced.test.ts` (rename to match the source file `mentions.ts` in shared)
- `quorum-shared/src/utils/messageGrouping.test.ts` — copy from desktop `src/dev/tests/utils/messageGrouping.unit.test.ts`

### 2. Adjust imports in moved test files

- Change `from '@quilibrium/quorum-shared'` to relative imports (e.g. `from './validation'`, `from './mentions'`, `from './messageGrouping'`).
- In `messageGrouping.test.ts`, change `import dayjs from '../../../utils/dayjs'` to `import dayjs from './dayjs'` (shared has its own `dayjs.ts`).

### 3. Verify shared test infrastructure

- `cd d:/GitHub/Quilibrium/quorum-shared && yarn test:run` — moved tests pass alongside existing `sync/service.test.ts`
- No new dev dependencies required (shared already has `vitest`)

### 4. Clean up quorum-desktop

- Delete `src/dev/tests/utils/reservedNames.test.ts`
- Delete `src/dev/tests/utils/mentionUtils.enhanced.test.ts`
- Delete `src/dev/tests/utils/messageGrouping.unit.test.ts`
- Update `src/dev/tests/README.md` to drop the three removed files from the list
- `cd d:/GitHub/Quilibrium/quorum-desktop && yarn test:run` — remaining tests still pass (mentionHighlighting + deviceInfo + all service tests + the hook test)

## Verification

- [ ] Shared: `yarn test:run` passes with the three new test files
- [ ] Desktop: `yarn test:run` passes after the three deletions
- [ ] Desktop: `npx tsc --noEmit --skipLibCheck` clean
- [ ] No regression in CI for either repo

## Definition of done

- [ ] Three util test files moved to `quorum-shared/src/utils/` (or whatever co-location the maintainer prefers)
- [ ] Tests pass in quorum-shared
- [ ] Desktop's `src/dev/tests/utils/` retains only `mentionHighlighting.test.ts` + `deviceInfo.unit.test.ts`
- [ ] Desktop's test README updated
- [ ] No new dependencies in shared

## Effort

1 to 2 hours. Mechanical move, single import adjustment per file, no logic changes.

## Future test migrations

These will be triggered by **their parent code migrations**, not by this task:

- **Service tests** — travel with the typing and receipts service migrations (and any future Tier 1B/2 service migrations once mobile access lands).
- **Hook tests** — travel with the hooks migration (currently blocked).
- **Component / primitive tests** — primitives don't have tests today; if they get tests, they'd live in shared from the start.

---

*Created: 2026-03-19. Refreshed 2026-05-19 against current codebase state.*
