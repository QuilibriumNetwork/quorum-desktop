---
type: reference
title: Cross-repo PR workflow when Kyn can't merge mobile PRs
status: reference
created: 2026-05-28
audience: Kyn + future agents
---

# Cross-repo PR workflow for the quorum-shared migration

> **The constraint that shapes everything:** Kyn merges his own PRs on `quorum-desktop` and `quorum-shared`, but `quorum-mobile` PRs go to the lead dev for review and merge. Lead is busy; mobile PRs can sit for weeks. This doc is how we work around that without blocking ourselves.

## The mental model

Three independent streams that occasionally touch:

```
quorum-shared:    [Kyn pushes] → [Kyn merges] → [Kyn publishes]
quorum-desktop:   [Kyn pushes] → [Kyn merges]
quorum-mobile:    [Kyn pushes] → [lead reviews] → [lead merges]   ← potential bottleneck
```

**The bottleneck only matters for work that has to ship on mobile.** Most migration work doesn't — mobile is usually the bystander, catching up to types/services that already shipped on shared and desktop. Notifications is the canonical example: shared and desktop ship the user-visible win, mobile catches up whenever it catches up.

## Core rule: small, granular, independent PRs

Not one big bundled PR at the end. Reasons:

1. **You can't ship desktop until lead merges mobile** if PRs are bundled.
2. **Review fatigue** — small PRs get real review, big ones get a 5-minute skim.
3. **Rebase pain** — mobile devs keep shipping while big PRs sit; every day = more conflicts.
4. **Bisect-ability** — if mobile breaks after merge, small PRs make the cause obvious.

Concrete sizing rule: **one job per PR**, ideally <50 lines diff. The smaller the PR, the more drift it survives.

## Standard per-migration sequence

For each cross-repo migration (e.g. `NotificationSettings` alignment):

1. **Shared PR first.** Push to `quorum-shared`, open PR, Kyn merges, publish new version.
2. **Desktop PR next.** Bumps shared dep to the new version, does the desktop-side dedup. Kyn merges.
3. **Mobile PR last.** Bumps shared dep, does the mobile-side cleanup. Lead reviews and merges *whenever*.

**Why mobile last:** if mobile is the bottleneck, you don't want shared or desktop sitting behind it. Mobile lagging is the *expected* state, not the failure state.

**While the shared PR is in review**, you can prep desktop and mobile branches locally using the `link:../quorum-shared` symlink — but don't open consumer PRs until shared merges and publishes (otherwise consumer PRs reference a non-existent npm version).

## The three drift scenarios

When a PR sits open, three things can change underneath it. Only one is genuinely risky.

### Case 1: Your next work is independent of the unmerged PR ✅ safe

Example: notifications mobile PR is stalled. You start the `UserConfig` mirror catch-up (different files, different scope). Branch from `mobile/main`, do the work, open a new PR.

**No problem.** Lead can merge in any order.

### Case 2: Your next work depends on the unmerged PR ⚠️ manageable

Example: shared PR is unmerged; your next desktop PR needs the new type to exist. Stack: child branch is based on the parent unmerged branch.

This is what the existing [stacked-PRs workflow doc](2026-03-15-stacked-prs-workflow.md) covers. It works, but:
- When parent finally merges, **rebase** each child onto `main`.
- If parent gets *changed* during review, every change ripples down.

**Practical depth limit:** stack 2 deep without thinking, 3 deep with caution, never 4+. If at depth 3 and parent is still stalled, switch to Case 1 work.

### Case 3: Lead changes things underneath you 🟥 the real risk

#### 3a. Lead bumps shared on mobile while your mobile PR is open

Example: your mobile PR bumps shared from `2.1.0` to `2.1.0-17`. Lead independently merges something that bumps shared to `2.1.0-18`. `mobile/main` is now at `-18`; your PR is at `-17`.

**Resolution:**
- Rebase your branch onto `mobile/main`.
- Git will conflict in `package.json` (and likely `yarn.lock`).
- Accept the newer version (`-18`), re-run `yarn install`, push.
- Your PR's logic still works because shared versions are additive — your `NotificationSettings` change is still present in `-18`.

**Cost:** ~5-10 minutes per drift event. Annoying, not blocking.

#### 3b. Lead touches the same mobile files you're modifying

Example: you delete `useNotificationSettings()`. Lead independently adds a new function nearby.

**Trivial case:** small additions → rebase, resolve, push. Few minutes.

**Bad case:** lead refactors `useUserConfig.ts` entirely. Your change has to be redone against the new structure. Could be 5 minutes, could be an hour.

**This is why small PRs win.** A 3-line PR survives almost any refactor. A 300-line PR doesn't.

## Cross-linking PRs

Every PR in a cross-repo migration must reference the other repos' PRs in the description. This is non-negotiable — without it, reviewers (especially the lead on mobile) can't see the full context, and future-you can't reconstruct what shipped together.

### Standard PR description template

For **shared** PR (opened first):

```markdown
## What
[one-line summary]

## Cross-repo migration
This is part of a 3-repo change:
- **quorum-shared** (this PR): <description>
- **quorum-desktop**: PR will follow once this merges and publishes
- **quorum-mobile**: PR will follow — TBD link

## Why
[context]

## Verification
- [ ] `yarn test` in shared
- [ ] Build succeeds
```

For **desktop** PR (opened after shared merges):

```markdown
## What
[one-line summary]

## Cross-repo migration
This is part of a 3-repo change:
- **quorum-shared**: ✅ MERGED — QuilibriumNetwork/quorum-shared#NN (version 2.1.0-XX)
- **quorum-desktop** (this PR): <description>
- **quorum-mobile**: open PR QuilibriumNetwork/quorum-mobile#NN (or "TBD")

## Why
[context]

## Verification
- [ ] `yarn test:run` in desktop
- [ ] `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
- [ ] Manual QA: [what to test]
```

For **mobile** PR (opened last, to the lead):

```markdown
## What
[one-line summary]

## Cross-repo migration
This is part of a 3-repo change, both already shipped:
- **quorum-shared**: ✅ MERGED — QuilibriumNetwork/quorum-shared#NN (version 2.1.0-XX, available on npm)
- **quorum-desktop**: ✅ MERGED — QuilibriumNetwork/quorum-desktop#NN
- **quorum-mobile** (this PR): <description>

## Why
[context]

## Why this is safe to merge whenever
Mobile has been on the old shared version (`2.1.0`) the whole time and continues to work. This PR bumps mobile to the new shared version and adapts to any breaking changes. No production users affected by merge timing.

## Verification
- [ ] Build succeeds
- [ ] [whatever else applies]
```

### Cross-link syntax

GitHub auto-links across repos with `OrgName/RepoName#PRNumber`. Use that form, not bare URLs — it renders as a clickable badge and shows the PR's open/merged/closed state inline. Example: `QuilibriumNetwork/quorum-shared#18`.

### When to update the cross-links

- **Right after opening each PR**, edit the previously-opened PRs' descriptions to add the new PR's reference (so each PR points at all siblings, not just predecessors).
- **When shared merges**, update desktop and mobile PR descriptions: change `quorum-shared` line from "open" to `✅ MERGED — link (version X.Y.Z-NN)`.
- **When desktop merges**, update the mobile PR description similarly.

This sounds tedious but takes ~30 seconds per update and is invaluable when the lead opens a mobile PR three weeks later and needs to reconstruct what shipped.

## Operating rules

1. **Always branch from current tip of `<repo>/main` before starting a new PR.** Don't branch from your last unmerged branch unless required (Case 2). Minimises drift exposure.

2. **Watch `mobile/main` while a mobile PR is open.** Once a week run `git fetch && git log HEAD..origin/main` on your branch. If main has moved, rebase eagerly while conflicts are small. Don't wait for the lead to ping about merge conflicts.

3. **Keep a buffer of 2-3 independent ready-to-push PRs.** If PR-A is stalled, push PR-B (independent). Don't gate yourself on lead's response time.

4. **If a PR sits >2 weeks, ping specifically.** Not "any updates?" but: *"PR #X has been open 2 weeks, blocking PR #Y and #Z on my side. Can you take 10 min today?"* Make the cost visible.

5. **Don't stack desktop PRs on unmerged mobile PRs.** Each cross-repo migration: ship shared first → desktop second → mobile last. Shared and desktop merges happen locally; mobile merge waits on lead review. Mobile lagging is fine.

6. **Accept that some mobile PRs may sit indefinitely.** Cleanup PRs (deleting dead scaffolds) are low-value to the lead. If `useNotificationSettings` deletion sits 3 months, nothing breaks — the user-visible win already shipped on shared and desktop.

## Communication: the one-time setup message

Before opening your first mobile PR, send the lead a short async message. Something like:

> *"I'm starting work on the quorum-shared migration items that need mobile-side changes. The first one is small (deleting an unused `useNotificationSettings` hook scaffold that's never imported anywhere). Setting expectations: I'll open PRs against `quorum-mobile` and tag you for review. Most will be small and focused. Any preferences on branch naming, PR template, or review cadence?*
>
> *Also — I noticed quorum-shared now has a Farcaster module and `UserConfig` got `isProfilePublic` + `farcasterLink`. Mobile already has its own Farcaster hooks under `hooks/`. Is there work in flight to point mobile at the shared module? Don't want to step on toes."*

The second paragraph is the more important question — there's a real chance the lead is mid-Farcaster-integration on mobile, and you'd discover that the hard way otherwise.

## Mobile testing constraint: we don't run the mobile app

> **Hard rule established 2026-05-28:** Kyn does NOT run/test the mobile app as part of normal migration work. He *can* (Expo dev build is available locally), but it's time-consuming and not part of the default loop.

This shapes which mobile PRs are safe to open:

| Mobile change | Safe to open without running the app? | Why |
|---|---|---|
| Delete unused code (verified by grep — zero importers) | ✅ Yes | If nothing imports it, removing it can't break anything. |
| Bump shared dep when shared change is purely additive | ✅ Yes | Mobile keeps using same APIs; new exports just become available. |
| Fix a TypeScript-only error (`as any` removal, type narrowing) | ✅ Yes | TS errors don't affect runtime; if it builds clean, mobile behaves identically. |
| Rename a field on a type that mobile reads | 🟥 No — test first | Runtime data shapes change; need to verify mobile UI still renders. |
| Change a function mobile actually calls | 🟥 No — test first | Behavior change; need device verification. |
| Add UI to mobile | 🟥 No — test first | New visual surface; needs eyes on real device. |
| Touch any of mobile's runtime files (`*.tsx` screens, hooks that are imported) | 🟥 No — test first | Live code path. |

### The pre-PR checklist for any mobile PR

Before opening a mobile PR, answer all three:

1. **Is this change verifiable by static analysis alone?** (TypeScript builds, lint passes, grep confirms no consumers.)
2. **Does the change touch any code path that runs at app startup or on user interaction?** If yes, static analysis isn't enough.
3. **If something this PR introduces was wrong at runtime, would I notice without running the app?** If no, runtime testing is required.

**All three "static-analysis-only" → safe to open without testing the mobile app.**
**Any "no" → must run the mobile app locally first, OR don't open the PR.**

### When testing is required, the path is

1. `cd D:\GitHub\Quilibrium\quorum-mobile && yarn install`
2. `yarn start` (Expo dev server)
3. Connect a physical device via Expo Go, or run `yarn ios` / `yarn android` for a simulator build
4. Manually exercise the code path the PR touches
5. Document the test result in the PR description

This is time-consuming (15-60 min for setup + test). **For migration work, prefer PRs that don't require it.** The `useNotificationSettings` deletion fits the "safe without testing" pattern: grep confirms zero importers, so removing it cannot affect any code path.

### Implication for migration sequencing

When picking next steps, **prefer mobile PRs that are statically verifiable.** Mobile PRs that require runtime testing become long-tail work — they get done when there's specific time allocated for mobile testing, not as part of the migration's normal flow.

For each migration, ask early: *"What's the smallest possible mobile-side change here?"* If the answer involves "delete dead code" or "bump dep + adapt to additive type changes", that's a good migration to pick. If the answer involves "rewrite this hook's runtime behavior", deprioritize unless mobile UI work is the actual goal.

## The most important rule: additive vs. breaking changes in shared

**Mobile is naturally insulated from shared changes** because it depends on a published npm version (e.g. `^2.1.0`), not a symlink. Mobile doesn't see your shared changes until someone explicitly bumps that version number in mobile's `package.json`.

This means whether you need to coordinate with mobile depends entirely on whether your shared change is **additive** or **breaking**.

### The gut-check question

Before merging a shared PR alone, ask:

> *"If a mobile dev bumped `@quilibrium/quorum-shared` in mobile's `package.json` right now without any other code changes, would mobile still build and work?"*

- **Yes → ship shared alone.** Mobile catches up whenever.
- **No → coordinate.** Open both shared and mobile PRs. Don't ship shared until the mobile PR is at least open and ready.

That's the entire rule. The complexity collapses to one question.

### What counts as additive (safe to ship shared alone)

- Adding a new export (type, function, hook, constant)
- Adding an **optional** field to a type (`foo?: string`)
- Widening a type (`'a' | 'b'` → `string`) — old consumers still compile
- Adding a new overload to a function

Mobile keeps building because nothing it currently uses has changed.

### What counts as breaking (coordinate with mobile)

- Removing an export (function, type, constant)
- Renaming a field on a type that consumers read
- Narrowing a type (`string` → `'a' | 'b' | 'c'`) such that previously-valid values become invalid
- Changing a function signature in a non-additive way (param removal, return type change)
- Adding a **required** field to a type (consumers that construct that type now fail to compile)

For breaking changes, **first check what mobile actually imports**:

```bash
# In quorum-mobile, grep for every symbol the shared PR will rename/remove:
cd D:\GitHub\Quilibrium\quorum-mobile
grep -rE "\b(OldSymbolA|OldSymbolB|OldSymbolC)\b" --include="*.ts" --include="*.tsx" .
```

The answer determines the PR pattern.

### Pattern A — Mobile imports at least one affected symbol → **same-session triplet**

1. Shared PR (the breaking change)
2. Desktop PR (fixes desktop's consumers — needed immediately because desktop's `link:` symlink sees shared changes instantly, so desktop's local build will break the moment shared changes land)
3. Mobile PR (renames mobile's consumers to the new symbol names)

Merge 1 and 2 in quick succession; mobile PR can sit until lead reviews. Mobile keeps using the old shared version until the bump+rename PR merges, so nothing is broken in production.

### Pattern B — Mobile imports none of the affected symbols → **shared + desktop only**

If grep returns zero hits in mobile, there is **nothing for a mobile PR to contain**.

- ✅ Ship shared PR + desktop PR.
- 🟥 Do NOT open an "empty" mobile PR. There's nothing to put in it; the only "change" would be a `package.json` version bump, which is the lead's territory and not something to drive from a migration PR.
- **Document the breaking change in the shared PR description** — list the renamed/removed exports under a "Breaking changes" heading so when the lead bumps shared in mobile later, they see "X was renamed to Y, mobile didn't use X, no code change needed."
- When the lead does bump shared in mobile, the mobile build will pass first try.

This pattern came up during the 2026-05-28 notifications dedup: three settings types in shared got the `Space` prefix, but grep confirmed zero references in mobile, so no mobile PR was opened.

### Sub-cases that look similar but route differently

**Sub-case A: Additive shared change that mobile *should* eventually adopt**

Example: shared gets a new `useFarcasterFeed` hook. Mobile has its own copy. Eventually mobile should switch.

- ✅ Ship shared alone (additive — see "additive vs. breaking" section).
- 🟡 Open a mobile PR to switch over. Lead reviews whenever.
- **Mobile is not broken if the PR sits.** Mobile keeps using its own implementation. The migration is just incomplete, not broken.

**Sub-case B: Technically breaking, mobile has *dead* consumer code**

Example: a placeholder shared type gets a different shape. Mobile imports it but only in scaffolding that's never called at runtime (verified by grep — the importer hook itself has zero callers).

This is the edge case to be careful about. Two interpretations:

- **Treat as Pattern A** (open a mobile PR even though the dead code "would probably work"): cleanest. The mobile PR is tiny (delete or fix the dead scaffold). Stops future bumps from surfacing a build error in dead code.
- **Treat as Pattern B** (skip the mobile PR): defensible if the dead code is so dead that no one would ever look at the build error. Cheaper.

**Recommendation: default to Pattern A for this sub-case.** Dead code today can become live code tomorrow; a future contributor who tries to wire up the scaffold should find it compiling against current shared, not against a six-month-old API. The mobile PR cost is small, the future-clarity cost of skipping it can be larger.

### Decision summary

| Type of shared change | Breaks mobile? | Can you merge shared alone? |
|---|---|---|
| Add new type / function / hook | No | ✅ Yes |
| Add optional field to existing type | No | ✅ Yes |
| Add new export | No | ✅ Yes |
| Change existing type's shape | Maybe | ⚠️ Coordinate |
| Rename / delete existing export | Yes | 🟥 Coordinate |
| Change function signature | Yes | 🟥 Coordinate |
| Add required field | Yes | 🟥 Coordinate |

## Versioning and the `link:` symlink

During development, desktop's `node_modules/@quilibrium/quorum-shared` is a symlink to your local `D:\GitHub\Quilibrium\quorum-shared` clone (via `link:../quorum-shared` in `package.json`). This means:

- Pulling shared instantly updates desktop's view of shared. No `yarn install` needed in desktop *for shared updates*.
- But: if shared adds a new peer dependency (like `@noble/curves` did in the 2026-05-28 upstream pull), desktop won't have that dep installed unless you `yarn install`. Runtime crash if you import code that uses the new dep.
- **Rule:** check shared's `package.json` diff after every `git pull`. If `peerDependencies` grew, `yarn install` in desktop. If only the dependencies of shared itself changed, skip it.

For mobile, the relationship is different — mobile depends on a *published npm version* of shared (e.g. `^2.1.0`), not a symlink. So mobile PRs need an explicit version bump in `package.json` and a `yarn install` whenever shared publishes.

## When in doubt: which repo do I push to first?

A decision tree for new migration work:

```
Does the change require a new type/function/service in @quilibrium/quorum-shared?
├── YES → Shared PR first. Wait for merge + publish. Then desktop, then mobile.
└── NO
    ├── Is the change shared-internal-only (e.g. fixing shared's own bug)?
    │   └── YES → Shared PR alone. No consumer changes needed.
    │
    └── Is the change consumer-only (using existing shared API)?
        ├── Desktop only → Desktop PR, Kyn merges. Done.
        ├── Mobile only → Mobile PR, lead reviews. Done (eventually).
        └── Both consumers → Open both PRs in parallel; they're independent.
```

## What "done" means for a cross-repo migration

A migration is **done from your perspective** when:

1. ✅ Shared PR merged + published.
2. ✅ Desktop PR merged.
3. 🟡 Mobile PR **opened**. Not necessarily merged.

Mobile sitting in review queue is **not** an open task on your side. Move on. Track the open PR in this folder's status table so future-you knows what's outstanding, but don't treat it as blocking.

## Worked example: the notifications migration sequence

To make this concrete, here's how the upcoming `NotificationSettings` alignment maps to the workflow:

| Step | Repo | Action | Reviewer | Status when done |
|---|---|---|---|---|
| 1 | shared | Replace placeholder `NotificationSettings` + add `NotificationTypeId` | Kyn self-review | ✅ merged, version bumped, published |
| 2 | desktop | Bump shared dep, replace local types with re-exports from shared | Kyn self-review | ✅ merged |
| 3 | mobile | Bump shared dep, delete or fix dead `useNotificationSettings` hook | Lead | 🟡 PR opened |

**Total active work for Kyn:** steps 1 and 2 (~30-60 minutes combined). Step 3 is a 5-line mobile PR that ships when the lead gets to it. If lead never gets to it, nothing breaks — the user-visible migration already shipped via steps 1 and 2.

---

*Created 2026-05-28 — written after Kyn flagged the realistic worry that mobile PRs sit unreviewed while the lead keeps pushing. Documents the workflow we'll use for the rest of the quorum-shared migration. Designed to be re-read at the start of any new migration session.*
