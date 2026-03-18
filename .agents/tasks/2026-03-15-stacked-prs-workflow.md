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
    └── feat/shared-primitives-migration      ← PR #2 (base: types branch)
          └── feat/shared-utils-migration       ← PR #3 (base: primitives branch)
                └── feat/shared-hooks-migration    ← PR #4 (base: utils branch)

quorum-desktop:
  feat/shared-types-migration          ← PR #1 (open, waiting for merge)
    └── feat/shared-primitives-migration      ← PR #2 (base: types branch)
          └── feat/shared-utils-migration       ← PR #3 (base: primitives branch)
                └── feat/shared-hooks-migration    ← PR #4 (base: utils branch)
```

## How to Create Each Branch

### Primitives migration (next up)
```bash
# quorum-shared
cd d:/GitHub/Quilibrium/quorum-shared
git checkout feat/shared-types-migration
git checkout -b feat/shared-primitives-migration

# quorum-desktop
cd d:/GitHub/Quilibrium/quorum-desktop
git checkout feat/shared-types-migration
git checkout -b feat/shared-primitives-migration
```

### Utils migration (after primitives)
```bash
# Branch off primitives in both repos
git checkout feat/shared-primitives-migration
git checkout -b feat/shared-utils-migration
```

### Hooks migration (after utils)
```bash
# Branch off utils in both repos
git checkout feat/shared-utils-migration
git checkout -b feat/shared-hooks-migration
```

## PR Creation Rules

- Each PR's **base branch** = the previous feature branch (not develop)
- GitHub will show only the diff for that PR's work
- When a parent PR merges into develop, rebase the child onto develop and change PR base to develop

## Rebase After Parent Merges

When types PR merges:
```bash
git checkout feat/shared-primitives-migration
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

## Plan 2: Utils Migration

**Separate plan file:** TBD (brainstorming session needed)

**Scope:** Migrate platform-agnostic utility functions from desktop to quorum-shared.

**Rationale for splitting from hooks:** Utils are mostly pure functions with zero platform dependencies — straightforward copy → export → re-import, same pattern as types migration. Low risk, fast PR, easy to review. Hooks depend on many of these utils, so having them in quorum-shared first simplifies hook imports later.

**Candidates:** `dateFormatting.ts`, `messageGrouping.ts`, `mentionUtils.ts`, `validation.ts`, `permissions.ts`, `channelUtils.ts`, `bytes.ts`, `avatar.ts`, `markdownFormatting.ts`, `rateLimit.ts`, and other pure functions.

**Excluded (stay in desktop):** DOM-specific utils (`modalPositioning.ts`, `caretCoordinates.ts`, `cursor.ts`, `mentionPillDom.ts`, `mentionHighlighting.ts`), image processing (Web File APIs), and platform-specific utils that already have `.web`/`.native` splits (like `crypto`).

## Plan 3: Hooks Migration

**Separate plan file:** TBD (requires dedicated discussion)

**Scope:** Migrate shared-compatible hooks from desktop to quorum-shared.

**This is the biggest effort** — 230+ hook files, many with deep dependency chains. Hooks need careful evaluation for platform dependencies. Many business logic hooks were already extracted to `business/` folders during Phase 1 of the business logic extraction plan, making them good candidates. DOM-coupled hooks (drag/drop, scroll tracking, mention pills, search DOM manipulation) stay in desktop with native equivalents written fresh for mobile.

---

_Created: 2026-03-15_
_Updated: 2026-03-18_
