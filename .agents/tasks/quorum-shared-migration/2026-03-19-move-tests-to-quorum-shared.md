---
type: task
title: "Move utility tests to quorum-shared"
status: open
complexity: medium
ai_generated: true
created: 2026-03-19
updated: 2026-03-19
---

# Move Utility Tests to quorum-shared

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Repos**:
- `quorum-desktop` — source of existing tests
- `quorum-shared` — destination

## What & Why

Utility tests currently live in quorum-desktop (`src/dev/tests/`) but test pure functions from quorum-shared. Tests should be co-located with the source code they test. This ensures any consumer of quorum-shared (web, mobile, future apps) benefits from the same test coverage without duplicating effort.

## Phase 1: Move Existing Utility Tests

### 1. Move test files from quorum-desktop to quorum-shared

Source: `quorum-desktop/src/dev/tests/`
Destination: `quorum-shared/src/utils/__tests__/` (or co-located with source files)

- [ ] `reservedNames.test.ts` (42 tests) — tests `normalizeHomoglyphs`, `isImpersonationName`, `isReservedName`, etc.
- [ ] `mentionUtils.enhanced.test.ts` (31 tests) — tests `extractMentionsFromText`
- [ ] `messageGrouping.unit.test.ts` (13 tests) — tests `shouldShowDateSeparator`, `getStartOfDay`, `groupMessagesByDay`, etc.
- [ ] `mentionHighlighting.test.ts` (20 tests) — **verify first**: if it tests functions from `quorum-shared/src/utils/mentions.ts`, move it; if it tests local `src/utils/mentionHighlighting.ts` only, keep it in quorum-desktop

### 2. Update imports in moved test files
- [ ] Change package imports (`from 'quorum-shared'`) to relative imports (`from '../mentions'`)
- [ ] Remove any quorum-desktop-specific test setup dependencies

### 3. Verify quorum-shared test infrastructure
- [ ] Confirm `vitest.config.ts` picks up the new test location
- [ ] Run `yarn test:run` in quorum-shared — all moved tests pass

### 4. Clean up quorum-desktop
- [ ] Remove the moved test files from `src/dev/tests/`
- [ ] Update test README (`src/dev/tests/README.md`) to reflect removed files
- [ ] Run `yarn test:run` in quorum-desktop — remaining tests still pass

## Phase 2: Add Tests for Migrated Hooks (Future)

When hooks are migrated to quorum-shared, write tests for hooks that contain **business logic**:
- [ ] Hooks with data transformation, conditional behavior, or state management → write tests
- [ ] Hooks that are thin wrappers around library calls (e.g., simple `useQuery` wrappers) → skip

## What NOT to Test in quorum-shared

- **Primitives** — UI components need DOM/native rendering. Keep testing via manual test screens in each app (`mobile/test/` screens, Storybook, etc.)
- **Platform-specific behavior** — anything that depends on browser APIs or React Native

## Verification

✅ **All moved tests pass in quorum-shared**
   - Run: `cd quorum-shared && yarn test:run`

✅ **quorum-desktop tests unaffected**
   - Run: `cd quorum-desktop && yarn test:run`

✅ **TypeScript compiles in both repos**
   - Run: `npx tsc --noEmit --skipLibCheck`

## Definition of Done
- [ ] All applicable test files moved to quorum-shared
- [ ] Tests pass in quorum-shared
- [ ] quorum-desktop tests unaffected
- [ ] TypeScript compiles in both repos
- [ ] Hook tests added as hooks are migrated (ongoing)
