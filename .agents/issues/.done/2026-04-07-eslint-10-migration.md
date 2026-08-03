---
type: task
title: "ESLint 10 + React Compiler Lint Migration"
status: done
complexity: medium
ai_generated: true
created: 2026-04-07
updated: 2026-04-07
related_docs:
  - ".agents/docs/development/dependency-upgrade-guide.md"
related_tasks:
  - ".agents/tasks/dependency-updates-audit.md"
---

# ESLint 10 + React Compiler Lint Migration

> **Warning: AI-Generated**: May contain errors. Verify before use.

**Files**:
- `eslint.config.js`
- `package.json`

## What & Why

ESLint 9.x is the current version. ESLint 10 is available and brings new built-in rules. Additionally, `eslint-plugin-react-hooks@7` bundles the React Compiler linter which adds enforcement for React's rules of hooks, purity, immutability, and memoization.

Upgrading improves code quality enforcement, catches real bugs (e.g. setState in effects, impure render functions), and keeps the toolchain current.

## Context

- **Current versions**: ESLint 9.39.4, @eslint/js 9.39.4, eslint-plugin-react-hooks 5.2.0, eslint-plugin-react-refresh 0.4.26, globals 15.15.0
- **Target versions**: ESLint 10.x, @eslint/js 10.x, eslint-plugin-react-hooks 7.x, eslint-plugin-react-refresh 0.5.x, globals 17.x
- **Config format**: Already using flat config (`eslint.config.js`), no migration needed
- **Baseline**: 78 errors, 291 warnings (pre-existing)
- **Constraint**: `eslint-plugin-react@7.37.5` has peer dep `eslint@^3 || ... || ^9.7` (does not include 10). May need updating or may work despite the warning.

## Findings from Initial Attempt

Upgrading all packages at once introduced 87 new errors from these new rules:

| Rule | Count | Source | Description |
|------|-------|--------|-------------|
| `preserve-caught-error` | 13 | ESLint 10 built-in | Error thrown without preserving original cause |
| `no-useless-assignment` | 8 | ESLint 10 built-in | Assignment to variable that is never read |
| `no-unassigned-vars` | 1 | ESLint 10 built-in | Variable declared but never assigned |
| `react-hooks/immutability` | 22 | react-hooks 7 (React Compiler) | Mutating values that React expects immutable |
| `react-hooks/set-state-in-effect` | 21 | react-hooks 7 (React Compiler) | Calling setState synchronously in effects |
| `react-hooks/preserve-manual-memoization` | 10 | react-hooks 7 (React Compiler) | Manual memoization can't be preserved |
| `react-hooks/purity` | 8 | react-hooks 7 (React Compiler) | Impure function calls during render |
| `react-hooks/refs` | 3 | react-hooks 7 (React Compiler) | Accessing refs during render |
| `react-hooks/use-memo` | 1 | react-hooks 7 (React Compiler) | Memoization issue |

## Implementation

### Phase 1: Upgrade Packages
- [x] Upgrade `eslint`, `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`
- [x] Check if `eslint-plugin-react` needs an update for ESLint 10 compatibility (works despite peer dep warning)
- [x] Verify lint runs without crashes

### Phase 2: Triage New Rules
- [x] Review each new ESLint 10 rule (`preserve-caught-error`, `no-useless-assignment`, `no-unassigned-vars`)
- [x] Decide per rule: fix violations, disable, or set to warn
- [x] Review React Compiler rules from react-hooks 7
- [x] Decide per rule: fix violations, disable, or set to warn
- [x] For rules set to warn: create follow-up tasks to fix the violations

### Phase 3: Fix or Disable
- [x] Fix easy violations (no-useless-assignment, no-unassigned-vars)
- [x] Add rule overrides in `eslint.config.js` for deferred rules
- [x] Verify final error/warning count matches expected baseline

### Phase 4: Fix Pre-existing Errors (extended scope)
- [x] Fix `no-empty` violations (empty catch blocks — add `/* ignore */` comments or remove empty else)
- [x] Fix `no-useless-escape` in regex patterns
- [x] Fix `no-empty-pattern` in destructuring (buildSpacesKey, useSpaces)
- [x] Fix `prefer-const` / `no-useless-catch` / `no-async-promise-executor`
- [x] Disable `react/prop-types` (TypeScript already enforces this)
- [x] Disable `func-params-args/func-args` (plugin not installed; remove inline disable comment)
- [x] Fix `react-hooks/rules-of-hooks` real violations in DropdownPanel.tsx and useSearchResultDisplay.ts
- [x] Delete `MessageDB.bak.tsx` (stale backup file, tracked by git)
- [x] Fix `no-undef` for `module` in `mobile/__empty.js` (add node globals via flat config)

## Triage Decisions

| Rule | Decision | Rationale |
|------|----------|-----------|
| `preserve-caught-error` | **warn** | 13 violations, deferred — real but non-trivial |
| `no-useless-assignment` | **fix** | 8 violations — removed redundant initializers |
| `no-unassigned-vars` | **disable-line** | 1 violation — intentional closure capture in baseTypes.ts |
| `react-hooks/immutability` | **off** | Requires React Compiler adoption |
| `react-hooks/set-state-in-effect` | **off** | Requires React Compiler adoption |
| `react-hooks/preserve-manual-memoization` | **off** | Requires React Compiler adoption |
| `react-hooks/purity` | **off** | Requires React Compiler adoption |
| `react-hooks/refs` | **off** | Requires React Compiler adoption |
| `react-hooks/use-memo` | **off** | Requires React Compiler adoption |
| `react/prop-types` | **off** | TypeScript already validates prop types |
| `func-params-args/func-args` | **off** | Plugin not installed |

## Verification
- [x] `yarn lint` runs without crashes
- [x] Error count: **0 errors**, 265 warnings (all acknowledged)
- [x] `yarn build` still passes
- [x] `yarn test:run` still passes (383 tests, 0 failures)

## Definition of Done
- [x] All ESLint ecosystem packages on latest versions
- [x] Each new rule explicitly triaged (enabled, warned, or disabled with rationale)
- [x] No unexpected regressions in build or tests
- [ ] Dependency upgrade guide updated with ESLint findings (follow-up)

## Follow-up Work
- Fix `preserve-caught-error` violations (13 instances) — add `{ cause: originalError }` to thrown errors
- Fix remaining warnings (265 total, mostly `@typescript-eslint/no-unused-vars` and `react-refresh/only-export-components`)
- Enable React Compiler rules once React Compiler is adopted

---

*Created: 2026-04-07 | Updated: 2026-04-07*
