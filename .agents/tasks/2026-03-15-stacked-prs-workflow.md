---
type: task
title: "Stacked PRs Workflow: Primitives + Hooks/Utils Migration"
status: open
complexity: medium
created: 2026-03-15
depends_on:
  - "tasks/2026-03-15-shared-types-migration-plan.md"
---

# Stacked PRs Workflow

## Branch Strategy

```
quorum-shared:
  feat/shared-types-migration          ← PR #1 (open, waiting for merge)
    └── feat/primitives-migration      ← PR #2 (base: types branch)
          └── feat/hooks-utils-migration  ← PR #3 (base: primitives branch)

quorum-desktop:
  feat/shared-types-migration          ← PR #1 (open, waiting for merge)
    └── feat/primitives-migration      ← PR #2 (base: types branch)
          └── feat/hooks-utils-migration  ← PR #3 (base: primitives branch)
```

## How to Create Each Branch

### Primitives migration (next up)
```bash
# quorum-shared
cd d:/GitHub/Quilibrium/quorum-shared
git checkout feat/shared-types-migration
git checkout -b feat/primitives-migration

# quorum-desktop
cd d:/GitHub/Quilibrium/quorum-desktop
git checkout feat/shared-types-migration
git checkout -b feat/primitives-migration
```

### Hooks/utils migration (after primitives)
```bash
# Branch off primitives in both repos
git checkout feat/primitives-migration
git checkout -b feat/hooks-utils-migration
```

## PR Creation Rules

- Each PR's **base branch** = the previous feature branch (not develop)
- GitHub will show only the diff for that PR's work
- When a parent PR merges into develop, rebase the child onto develop and change PR base to develop

## Rebase After Parent Merges

When types PR merges:
```bash
git checkout feat/primitives-migration
git rebase develop
git push --force-with-lease
# Then change PR base to develop on GitHub
```

## Desktop `file:` Dependency

Keep `"@quilibrium/quorum-shared": "file:../quorum-shared"` on ALL working branches.
Only switch to published npm version right before final merge of each PR.

---

## Plan 1: Primitives Migration

**Separate plan file:** `tasks/2026-03-15-primitives-migration-plan.md`

**Scope:** Migrate desktop primitives to quorum-shared so mobile can use them.

**Pre-work (CRITICAL):**
1. Launch mobile primitives playground (`yarn mobile` or expo dev)
2. Test every existing shared primitive on mobile
3. Fix any broken primitives BEFORE migrating new ones
4. Document which primitives exist in shared vs desktop-only

**Migration work:**
1. Identify which desktop primitives should be shared (cross-platform)
2. Add them to quorum-shared with proper .web.tsx / .native.tsx splits
3. Update desktop imports to use shared primitives
4. Test on mobile playground again after migration
5. Version bump quorum-shared

**Needs detailed plan** — create with `writing-plans` skill in fresh session.

## Plan 2: Hooks & Utils Migration

**Separate plan file:** TBD (may need multiple plans)

**Scope:** Migrate shared-compatible hooks and utils from desktop to quorum-shared.

**This is the biggest effort** — many hooks will need refactoring to be platform-agnostic.
Stay generic until primitives migration is complete. Will likely split into:
- Utils migration (simpler — pure functions)
- Hooks migration (harder — may need platform abstractions)

---

_Created: 2026-03-15_
