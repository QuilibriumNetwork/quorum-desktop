---
type: reference
title: Cross-repo PR workflow when mobile PRs need a different reviewer
status: reference
created: 2026-05-28
updated: 2026-05-29
audience: future agents working on this migration
---

# Cross-repo PR workflow for the quorum-shared migration

> **The constraint that shapes everything:** `quorum-desktop` and `quorum-shared` PRs are self-merged. `quorum-mobile` PRs go to the lead dev (often busy — PRs can sit for weeks). This doc is how we work around that without blocking ourselves.

## Mental model

```
quorum-shared:    [push] → [self-merge]
quorum-desktop:   [push] → [self-merge]
quorum-mobile:    [push] → [lead reviews] → [lead merges]   ← potential bottleneck
```

The bottleneck only matters for work that has to ship on mobile. Most migration work doesn't — mobile is usually the bystander, catching up to types/services that already shipped on shared and desktop.

## The workflow at a glance

For each cross-repo migration:

1. **Investigate first.** Check what shared has, what desktop has, what mobile has (`git show origin/master:<path>` — mobile's working tree is stuck on a Jan 14 commit). Decide whether the migration is even viable per the rules below.
2. **Create one task doc** at this folder root: `2026-XX-XX-migrate-<thing>.md`. Write it as the final record (frontmatter + what/why + files + verification checkboxes + done criteria + PR URL slots).
3. **Branch** in shared (and desktop if needed). Branch name = what ships.
4. **Code + verify.** Check verification boxes as gates pass.
5. **Open shared PR first → self-merge → open desktop PR → self-merge.** Fill in PR URLs everywhere (task doc, shipped-log, status table, mobile task if applicable) **in the same feature-branch commit** before push.
6. **Move task doc to `.done/`** in the same final commit.
7. **Update [shipped-log.md](shipped-log.md)** with a tight entry (see existing entries for format).
8. **Mobile leg**: open a mobile PR if statically verifiable, OR drop a mobile task file at `quorum-mobile/.agents/tasks/quorum-shared-migration/` and add a row to [mobile-tasks-pending.md](mobile-tasks-pending.md).

**Terminal state for a migration is one of:**
- ✅ shared merged + desktop merged + mobile PR opened (lead reviews whenever)
- ✅ shared merged + desktop merged + mobile task dropped

Both count as done. Mobile sitting in review is normal.

## Sizing and bundling

**Default rule:** one job per PR, ideally <50 lines diff. Smaller PRs survive drift, get real review, bisect cleanly.

**Escape hatch:** for self-merged shared+desktop PRs with no mobile leg, **bundle by shape**. If multiple desktop hooks share an inlined pattern, refactor them all at once. The "<50 lines" target is about review fatigue and cross-repo coordination — when neither applies (self-merged, no lead-dev review), bundling 2-5 same-shape changes is fine. Example: `useTwoStepConfirm` (PR #19 + #161) bundled the shared primitive + two desktop consumer refactors.

What "same shape" means: the changes share a migration pattern (e.g. "extract inlined state machine X to shared, replace inline copies with shared import"). Different shapes = different PRs.

## Docs-only work on main (2026-05-29)

When working on docs **directly on `main`** (re-audits, design docs, status table updates, INDEX, README, workflow rule additions), batch ALL the doc work into **one commit**. Don't split granularly.

The granular-commits guidance is for code work where bisect-ability matters. Doc work has no runtime behavior to bisect — splitting commits just creates more push events for no benefit.

Examples of work that goes in one commit on main:
- A re-audit doc + status table row update + INDEX entry → one commit
- Multiple unrelated doc cleanups → one commit (titled "doc: housekeeping" or similar)
- A workflow rule addition + the example that motivated it → one commit

This rule does NOT apply when committing on a feature branch as part of a PR — there, follow the per-migration ceremony (one logical commit per PR, which may include both code and docs).

## Following mobile patterns (2026-05-28)

> Mobile is mostly written by the lead dev. When mobile has already shipped a working implementation of something we're about to design for shared, **mobile's pattern is the starting point**, not desktop's.

### Decision rule for shared API design

Before writing any shared code:

1. **Grep mobile** for the same feature/pattern. Mobile working tree is stale — use `git ls-tree -r origin/master --name-only | grep -i <feature>` and `git show origin/master:<path>`.
2. **If mobile has it**: shape the shared API to match mobile's pattern. Adapt desktop to fit. Only deviate for a concrete technical reason (mobile pattern has a bug, blocks a needed feature, violates a wire-format invariant). Document the reason.
3. **If mobile doesn't have it**: free to design shared around desktop's pattern. Mobile catches up later on their schedule.

### Don't decide for the lead

When desktop has a feature mobile lacks, don't conclude "mobile would have to build it, so let's skip." That's a decision the lead should make. Frame it as a question, not a recommendation:

- ❌ "Mobile doesn't have granular notification filtering, so we'll keep that desktop-only."
- ✅ "Desktop has granular notification filtering; mobile doesn't. Want mobile to add it, want desktop to drop it, or want the asymmetry to stay?"

Implementation cost on the other platform is NEVER a reason to drop the question.

### Cautionary tale: notifications

Earlier sessions assumed mobile would adopt desktop's `NotificationSettings` shape. Investigation found mobile has fundamentally different storage (MMKV-based, iOS NSE, NOT synced via `UserConfig`). Forcing convergence would mean asking the lead to rewire mobile's whole notification system. The real shared migration question became "does shared even need notification types?" — open, separate investigation. Track is paused on lead-dev reply.

## Additive vs. breaking changes

**The gut-check question:** *"If a mobile dev bumped `@quilibrium/quorum-shared` in mobile's `package.json` right now without any other code changes, would mobile still build and work?"*

- **Yes → ship shared alone.** Mobile catches up whenever.
- **No → coordinate.** Open shared + mobile in lockstep.

| Type of shared change | Breaks mobile? | Ship shared alone? |
|---|---|---|
| Add new type / function / hook / export | No | ✅ Yes |
| Add **optional** field to type | No | ✅ Yes |
| Widen a type (`'a' \| 'b'` → `string`) | No | ✅ Yes |
| Change existing type's shape | Maybe | ⚠️ Check mobile imports first |
| Rename / delete existing export | Yes | 🟥 Coordinate |
| Change function signature non-additively | Yes | 🟥 Coordinate |
| Add **required** field to type | Yes | 🟥 Coordinate |

For breaking changes, grep mobile first:
```bash
cd D:\GitHub\Quilibrium\quorum-mobile
git grep -E "\b(OldSymbolA|OldSymbolB)\b" origin/master -- "*.ts" "*.tsx"
```

### Two routing patterns for breaking changes

**Pattern A — Mobile imports at least one affected symbol.** Open all three: shared + desktop (merge in quick succession) + mobile (sits with lead). Mobile keeps using old shared version until the rename PR merges.

**Pattern B — Mobile imports zero affected symbols.** Ship shared + desktop only. Do NOT open an empty mobile PR. Document the breaking change in the shared PR description under a "Breaking changes" heading so when the lead bumps shared in mobile later, they see context.

**Sub-case (dead consumer code):** mobile imports the symbol but only in unused scaffolding. Default to Pattern A — open the mobile PR. Dead code today can become live tomorrow.

## Mobile-side work

### We don't run the mobile app (hard rule, 2026-05-28)

The mobile app is NOT run or tested as part of normal migration sessions. Expo dev builds are available locally but time-consuming. Open mobile PRs that are **statically verifiable** (TypeScript builds + lint passes + grep confirms no consumers).

| Mobile change | Statically verifiable? |
|---|---|
| Delete unused code (grep confirms zero importers) | ✅ Yes |
| Bump shared dep when change is additive | ✅ Yes |
| Fix TS-only error (`as any` removal, narrowing) | ✅ Yes |
| Rename a field on a type mobile reads | 🟥 No — runtime test required |
| Change a function mobile actually calls | 🟥 No — runtime test required |
| Touch any mobile runtime file (screens, live hooks) | 🟥 No — runtime test required |

### Proactive mobile task drop (2026-05-29)

When a migration ships on shared + desktop and has a mobile-side change we can't open as a PR immediately (needs runtime testing, batching, or out of session time), drop a mobile task file inside `quorum-mobile` so a future session can pick it up cold.

**Where**: `D:\GitHub\Quilibrium\quorum-mobile\.agents\tasks\quorum-shared-migration\`. Mobile's `.agents/` is gitignored — these are local-only artifacts, no commits, no lead visibility through git.

**When to drop** (vs. skip): if mobile imports affected symbols AND we can't open the PR this session, drop a task. If mobile imports zero affected symbols (Pattern B), skip — there's nothing to do.

**Task file requirements** (so a future session can execute cold without re-investigating):

1. **Frontmatter**: `status: open`, `created: YYYY-MM-DD`, links to shared + desktop PRs that triggered it, `runtime-test: required | not-required`.
2. **What shipped on shared + desktop** — exports, types, hooks now available, npm version of shared.
3. **Concrete mobile file list** — actual paths gathered by grepping live, NOT from memory.
4. **Shape of mobile change** — what to bump/delete/replace, with exact symbols.
5. **Static-analysis verification gates** — TS check, lint, grep that proves zero residual references. What "done" looks like without running the Expo app.
6. **Runtime test requirements** — if `runtime-test: required`, name the specific code paths to exercise.
7. **Pre-filled mobile PR description** (see template below).

**After dropping**:
1. Run `cd D:\GitHub\Quilibrium\quorum-mobile && python .agents/update-index.py` to regenerate mobile's INDEX.
2. Add a row to [mobile-tasks-pending.md](mobile-tasks-pending.md) so we can see queued tasks at a glance. Mobile is gitignored — without a desktop-side tracker, we lose visibility.

## i18n in shared (2026-05-28)

**Shared modules SHOULD NOT contain user-facing text.** Strong default. Shared returns data, state, codes, or structured violation info. The UI layer (components, or thin platform wrappers around shared hooks) materializes strings.

Applies to:
- Component labels, headings, tooltips, button text → live in each app's components
- Hook return values → return data + booleans + codes, NOT translated strings
- Service responses → structured results, NOT user-facing error messages

Does NOT apply to:
- Internal/debug strings (logger messages, dev-only error objects) — plain English in shared is fine.

### The `errorKey` pattern (when shared MUST return error info)

```ts
// In shared
export function validateSpaceName(name: string):
  | { ok: true }
  | { ok: false; errorKey: string; errorVars?: Record<string, string | number> } {
  if (!name.trim()) return { ok: false, errorKey: 'spaceName.required' };
  if (name.length > MAX_NAME_LENGTH)
    return { ok: false, errorKey: 'spaceName.tooLong', errorVars: { max: MAX_NAME_LENGTH } };
  return { ok: true };
}
```

Each platform owns a thin wrapper that maps codes to localized strings:

```ts
// Desktop wrapper (Lingui)
const errorMessages = {
  'spaceName.required': () => t`Space name is required`,
  'spaceName.tooLong': (vars) => t`Space name must be ${vars.max} characters or less`,
};

// Mobile wrapper (hardcoded English today; later: same shape, Lingui calls)
const errorMessages = {
  'spaceName.required': () => 'Space name is required',
  'spaceName.tooLong': (vars) => `Space name must be ${vars.max} characters or less`,
};
```

**Why this works**: shared has zero i18n dependency. Desktop keeps Lingui. Mobile keeps English. Mobile-Lingui adoption later changes only the wrapper file — no shared or consumer changes.

**Error key naming**: `<domain>.<errorType>` (e.g. `spaceName.required`, `displayName.reservedImpersonation`). Stable once exported: additions are additive, removals/renames are breaking.

## Operational notes

### Versioning (the `link:` symlink)

Desktop's `node_modules/@quilibrium/quorum-shared` is a symlink to the local clone (via `link:../quorum-shared`). Pulling shared instantly updates desktop's view — no `yarn install` needed *for shared updates themselves*. But:

- If shared adds a new **peer dependency**, desktop won't have it installed → runtime crash. Check shared's `package.json` diff after `git pull`.
- Mobile depends on a *published npm version* (`^2.1.0-NN`), not a symlink. Mobile PRs need explicit version bump + `yarn install`.

### Drift while a mobile PR sits open

Mobile PRs can sit weeks. Three things can shift underneath:

1. **Your next work is independent of the unmerged PR**: no problem. Lead merges in any order.
2. **Your next work depends on the unmerged PR**: stack (child branch from parent unmerged branch). See [stacked-PRs doc](2026-03-15-stacked-prs-workflow.md). Practical depth limit: 2 without thinking, 3 with caution, never 4+. If stalled at depth 3, switch to independent work.
3. **Lead changes things underneath you** (the real risk):
   - **Lead bumps shared on mobile while your mobile PR is open**: rebase, accept newer version, push. ~5-10 min per drift event.
   - **Lead touches the same mobile files**: rebase, resolve. Trivial conflicts are fast; full refactors can cost an hour. **This is why small PRs win** — a 3-line PR survives almost any refactor; a 300-line PR doesn't.

### Cross-linking PRs

Use `OrgName/RepoName#PRNumber` syntax (e.g. `QuilibriumNetwork/quorum-shared#18`) — GitHub auto-links across repos and shows state inline. Update cross-links right after opening each PR so each sibling points at the others.

### Operating rules

1. Branch fresh from `<repo>/main` (not from your last unmerged branch, unless stacking).
2. Watch `mobile/main` while a mobile PR is open — `git fetch && git log HEAD..origin/main` weekly. Rebase eagerly while conflicts are small.
3. Keep 2-3 independent ready-to-push PRs as a buffer. Don't gate on lead's response time.
4. If a PR sits >2 weeks, ping specifically: "PR #X has been open 2 weeks, blocking PR #Y and #Z. Can you take 10 min today?" Make the cost visible.
5. Accept that some mobile PRs may sit indefinitely. Cleanup PRs (dead scaffolds) are low-value to the lead. Nothing breaks while they sit.

## PR description template

Single template with conditional sections:

```markdown
## What
[one-line summary]

## Cross-repo migration
This is part of a multi-repo change:
- **quorum-shared**: [✅ MERGED — Org/Repo#NN (version 2.1.0-XX) | THIS PR | open Org/Repo#NN]
- **quorum-desktop**: [✅ MERGED — Org/Repo#NN | THIS PR | open Org/Repo#NN | not needed]
- **quorum-mobile**: [✅ MERGED | THIS PR | open Org/Repo#NN | not needed (Pattern B) | task dropped — see mobile-tasks-pending.md]

## Why
[context]

## Why this is safe to merge whenever (mobile PRs only)
Mobile has been on the old shared version (`2.1.0-OLD`) the whole time and continues to work. This PR bumps mobile and adapts. No production users affected by merge timing.

## Verification
- [ ] [build/test/lint commands as applicable]
- [ ] Manual QA: [what to test, if any]
```

**Update cadence**: edit previously-opened PR descriptions when later PRs open, and again when each merges. ~30s per update — invaluable for the lead reconstructing what shipped weeks later.

---

*Created 2026-05-28. Compacted 2026-05-29 — folded redundant sections (additive/breaking duplicated, three sub-rules on mobile patterns, two PR templates, two ceremony sections) into single sources of truth. Added "docs-only work on main" rule.*
