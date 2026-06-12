---
type: reference
title: Workflow for porting features from mobile to desktop
status: reference
created: 2026-06-01
updated: 2026-06-01
audience: any agent working on the port-from-mobile effort
---

# Workflow for porting features from mobile to desktop

> **The mental model:** desktop is the only repo we're shipping runtime code to. Mobile is read-only context. Shared is touched only when a port surfaces portable logic.
>
> **Note (updated 2026-06-12):** this effort is conceptually a **two-way feature diff** between desktop and mobile, split across two sibling folders. This folder (`port-from-mobile/`) is the active port direction (features mobile has that desktop is missing — run through [candidates.md](candidates.md)). When the inverse surfaces — a desktop feature mobile lacks, or a capability where desktop's implementation is materially better — log it in [../port-to-mobile/candidates.md](../port-to-mobile/candidates.md) (the `feature-port` / `convergence` lanes). We do NOT push to mobile, but the lead dev uses that doc as a curated convergence list. When a desktop→mobile item becomes a concrete dropped task, it graduates into the unified tracker [../quorum-shared-migration/mobile-tasks-pending.md](../quorum-shared-migration/mobile-tasks-pending.md).

```
quorum-mobile:    [read-only context — pull, inspect, never push]
quorum-shared:    [touched only when a port surfaces portable logic — same workflow as the shared-migration effort]
quorum-desktop:   [main delivery target — feature-scoped PRs, self-merged after smoke test]
```

## Pre-flight (every session)

Always pull all three repos before starting work.

```bash
git -C "D:/GitHub/Quilibrium/quorum-desktop" pull --ff-only
git -C "D:/GitHub/Quilibrium/quorum-mobile" pull --ff-only
git -C "D:/GitHub/Quilibrium/quorum-shared" pull --ff-only

# Verify latest commits — confirms mobile mirror isn't stale
git -C "D:/GitHub/Quilibrium/quorum-mobile" log -1 --format="%h %ad %s" --date=short
git -C "D:/GitHub/Quilibrium/quorum-shared" log -1 --format="%h %ad %s" --date=short
```

**Mobile working tree IS usable as of 2026-06-01.** The roadmap's prior warning about a stale Jan 14 working tree was for the shared-migration effort's snapshot in time — verify each session with `git pull` + `git log -1` but normally you can `cat`/`Read` mobile files directly. If `git log` shows a date wildly older than expected, fall back to `git show origin/master:<path>`.

## Mobile repo layout (2026-06-01)

Mobile uses a flat top-level structure (Expo Router style), NOT `src/`:

```
quorum-mobile/
├── app/           ← Expo Router screens (the entry points)
├── components/    ← UI components
├── hooks/         ← Custom hooks
├── services/      ← Business logic services
├── context/       ← React contexts
├── modules/       ← Native modules (iOS/Android bridges)
├── data/          ← Static data / fixtures
├── theme/         ← Theme tokens
├── utils/         ← Helpers
├── constants/     ← Constants
└── ios/, android/ ← Native projects
```

When inspecting, start with `app/` to see what screens exist (= what user-facing features ship), then drill into `components/`, `hooks/`, `services/` for each feature.

## Capability verification — mandatory before drafting a task

> **Hard-learned 2026-06-01.** Symbol-grep for the mobile hook name is NOT enough. The same capability can exist on desktop under a different name and a fundamentally different architecture. Two candidates were knocked off the list this way in one session: #2 Message search (mobile uses MiniSearch over loaded messages; desktop uses `GlobalSearch` scoped to current conversation via `SearchService` over IndexedDB) and #3 Reply tracking (mobile uses MMKV counter; desktop uses `useReplyNotificationCounts` derived from `MessageDB` with read-state tracking).

Before drafting a `YYYY-MM-DD-port-<slug>.md` task file, run a structured capability check on desktop, NOT a name-grep:

1. **State the capability in plain terms.** Not "port `useFooBar`" — "let the user X". E.g. "let the user browse a public directory of spaces and join one without an invite link." If you can't state it in plain terms, you don't understand the feature yet.
2. **Grep desktop for the capability concept, not the mobile name.** For "browse a directory of spaces": search for `directory`, `discover`, `explore`, `browseSpaces`, `publicSpaces`, `catalog`. For "report abuse": `report`, `abuse`, `moderation`, `flag`. For "public profile": `publicProfile`, `isProfilePublic`, `profileFetch`, `MembersWithFallback`.
3. **Check the relevant component / hook folders directly.** Desktop's tree is well-organized — `src/components/<area>/`, `src/hooks/business/<area>/`. If the capability is "abuse reporting", look in `components/modals/`, `services/`, `hooks/business/`. Don't rely on grep alone.
4. **Read at least one adjacent file in full.** For #3 we'd have found `useReplyNotificationCounts` immediately by reading `src/hooks/business/replies/`. Cheap.
5. **If the capability is present** — log the finding in [candidates.md](candidates.md) per-candidate notes and consider whether to add an entry in [../port-to-mobile/candidates.md](../port-to-mobile/candidates.md) (`convergence` type). Don't draft a task file.
6. **If the capability is genuinely missing** — proceed to drafting the task file.

This rule is non-optional. It costs 5 minutes; skipping it costs a task file written for nothing.

## Port the capability, not the mobile UX pattern

> **From 2026-06-01 discussion.** When porting a mobile feature, port the *capability*, not the mobile UX pattern. Mobile UX choices reflect mobile chrome (tab bars, full-screen lists, activity-driven sort, telegram-style unified inbox) and mobile constraints (cold boot, app suspension, MMKV instead of IndexedDB). Desktop has different chrome (sidebars, multi-panel layout, modal overlays) and a different UX model.

A feature being shipped on mobile means the *capability* is real. Whether the *UX pattern* fits desktop is a separate judgment.

**Worked example: desktop is intentionally Discord-style, not Telegram-style.**
- Desktop treats spaces as *commitments* (communities the user chose, manually ordered, foldered). No auto-sort by activity.
- Desktop treats DMs as *inbox* (recency-sorted with favorites pinning to top).
- The split is deliberate and matches Discord/Slack — not Telegram.
- Mobile's `useSpaceActivity` (sort spaces by recency + show last-message preview under each) fits Telegram's unified-list model. Trying to port it would regress desktop's UX without an obvious win — desktop's icon-only sidebar has no room for a preview snippet and auto-sort would shuffle the user's anchor communities every time they go quiet.

**Default to desktop's existing UX language.** Don't replicate mobile widgets just because they exist. When in doubt, ask the user — UX choices are product decisions, not engineering ones. "Mobile ships X" is data, not a directive.

**Don't decide for the lead.** When desktop has an implementation that's deliberately different from mobile (and arguably better), record that observation in [../port-to-mobile/candidates.md](../port-to-mobile/candidates.md) (`convergence` type) so it can inform mobile's future convergence. Don't try to "fix" desktop to match mobile.

## The workflow at a glance

For each feature port:

1. **Candidate selected** from [candidates.md](candidates.md). Run the [Capability verification](#capability-verification--mandatory-before-drafting-a-task) pass — NOT a symbol-grep. Confirm the *capability* (stated in plain terms) is genuinely missing on desktop.
2. **Create task doc** at this folder root: `YYYY-MM-DD-port-<slug>.md`. Frontmatter + what/why + mobile files referenced + desktop files to create or modify + shared promotion candidates + verification checkboxes.
3. **Rename session branch** to describe what ships (`feat/port-<slug>` or similar).
4. **Code + verify.**
   - Read mobile implementation thoroughly. Don't blindly copy — desktop has its own conventions (Lingui i18n, SCSS, primitives barrel).
   - Adapt to desktop's component conventions ([CLAUDE.md](../../../CLAUDE.md), [docs/quorum-shared-architecture.md](../../docs/quorum-shared-architecture.md)).
   - If you spot logic that belongs in shared, follow the [shared-migration cross-repo workflow](../quorum-shared-migration/cross-repo-workflow.md) for that piece.
5. **Smoke test desktop in dev** before opening the PR. Visual smoke test rules from the shared-migration workflow apply — see "Visual smoke test" section there.
6. **Open desktop PR.** Feature-scoped is fine, doesn't need to be <50 lines. Post smoke-test steps in PR description. Wait for user confirmation before self-merge.
7. **Move task doc to `.done/`** in the same commit.
8. **Update [shipped-log.md](shipped-log.md).**
9. **If shared was touched**: add a row to the shared-migration's [mobile-tasks-pending.md](../quorum-shared-migration/mobile-tasks-pending.md) if mobile would benefit from consuming the shared version.

**Terminal state for a feature port:**
- ✅ desktop PR merged + (optionally) shared PR merged + (optionally) mobile task dropped if mobile should consume the shared version.

## PR sizing

**Feature-scoped, not granular.** This is the key deviation from the shared-migration workflow:

- One PR = one feature. "Port mobile's wallet view" = one PR even if it's 800 lines.
- We can afford this because desktop work is self-merged and self-tested. No cross-repo coordination is required unless we touch shared.
- Sub-features can be split if they're independent UX (e.g. "wallet send" vs "wallet receive" might be two PRs if they ship at different times).

Sub-50-line discipline only applies to:
- Shared package changes (still review-sensitive even when self-merged because mobile consumes shared).
- Pure mechanical refactors with no behavior change (rare in this effort).

## Branch workflow

Same as the shared-migration's "Always work on a branch" rule, with one tweak: session branch first, rename when the work crystallizes.

1. **Start of session**: create a session branch using the naming rule below. Generic on purpose — you don't yet know what the session will become.
2. **During inventory / scoping**: commit freely to the session branch. Docs, candidate-list updates, all fine.
3. **When a feature port crystallizes**: rename the branch to `feat/port-<slug>` (or `chore/port-<slug>` for non-feature work).
   ```bash
   git branch -m feat/port-<slug>
   ```
4. **Ship**: push, open PR, wait for smoke-test confirmation, self-merge.
5. **After merge**: `git checkout main && git pull`, new session = new branch.

If a session's work doesn't crystallize into a shippable PR (e.g. inventory-only), still squash-merge the session branch into main when the docs are worth keeping — that's the existing "doc-bundle PR" pattern from the shared-migration workflow.

### Doc commits piggy-back on the next feature PR

This is a **repo-wide rule** documented in [`.agents/agents-workflow.md` → "PR & Commit Workflow"](../../agents-workflow.md#pr--commit-workflow). Summary: commit doc edits locally on the current session branch and let the next feature PR carry them. Don't open doc-only PRs for small updates. See the canonical version for the full rationale, procedure, and exceptions.

Specific to this effort: when a session's doc commits include shipped-log entries that need a PR number, write them *after* the feature PR merges (and before the session's other commits ship). The merge commit + your in-progress doc commits naturally line up so the PR number is known.

### Session branch naming

The repo has a **primary working tree** at the repo root (`D:/GitHub/Quilibrium/quorum-desktop`) plus one or more **named worktrees** at `.worktrees/<name>/` (currently `.worktrees/secondary/`; could grow to `tertiary/` etc). All worktrees share `.git`, so branch names must be unique across them — naming has to encode where the session is happening.

Naming rule:

| Workspace | First session of the day | Second+ session same day |
|---|---|---|
| Primary clone (repo root) | `session-YYYY-MM-DD` | `session-YYYY-MM-DD-2`, `-3`, … |
| `.worktrees/<name>/` | `session-<name>-YYYY-MM-DD` | `session-<name>-YYYY-MM-DD-2`, `-3`, … |

Examples on 2026-06-08:
- `session-2026-06-08` — first session in the primary clone
- `session-2026-06-08-2` — second session same day, primary clone
- `session-secondary-2026-06-08` — first session in `.worktrees/secondary/`
- `session-secondary-2026-06-08-2` — second session same day in the secondary worktree

**To detect which workspace you're in:** run `git rev-parse --show-toplevel`. If the path matches `.worktrees/<name>$`, you're in that named worktree (capture `<name>`). Otherwise you're in the primary clone (no qualifier).

**To check what's already taken before picking a counter:** `git branch -a | grep "^[* ]*session-"` lists every existing session branch across all worktrees. Pick the next available suffix.

The counter (`-2`, `-3`, ...) is only appended when the un-suffixed name is already taken — keeps the common case (one session per workspace per day) short.

## When to promote to shared

The opportunistic-shared-promotion rule. When porting a mobile feature, you'll often see pure portable logic that could live in shared. Decision tree:

1. **Does shared already export something equivalent?** If yes, use it. Done.
2. **Is the logic pure / portable** (no DOM, no React Native, no platform-specific storage / crypto)? If no, just port to desktop. Done.
3. **Would mobile benefit from consuming the shared version someday?** If no (e.g. desktop-only UX helper), keep it desktop-local. Done.
4. **All three yes?** Promote to shared as part of the same effort. Follow [shared-migration's cross-repo workflow](../quorum-shared-migration/cross-repo-workflow.md):
   - Open shared PR (additive only — never break mobile while it's a bystander).
   - Open desktop PR consuming the new shared export.
   - Drop a mobile task in [`mobile-tasks-pending.md`](../quorum-shared-migration/mobile-tasks-pending.md) so the lead dev sees mobile could simplify by consuming shared too.
   - We do NOT open a mobile PR for this — mobile work stays read-only in this effort.

## Following mobile patterns

Same rule as shared-migration: mobile is mostly written by the lead dev. When porting, treat mobile's implementation as the **starting point** for shape (state machine, hook signature, mutation pattern). Adapt only for:
- Desktop conventions (Lingui i18n, SCSS, primitives barrel, React Query keys).
- Concrete technical reason (mobile pattern has a bug, blocks a needed feature, uses a primitive desktop lacks).

If mobile uses split mutation hooks and desktop has a single fat controller for similar features, the port follows mobile's split pattern. Document any deviation.

## Don't decide for the lead

If a feature exists on mobile that desktop fundamentally can't host (e.g. iOS Notification Service Extension), don't conclude "desktop won't port it." Document the limitation in candidates.md instead. The user / lead may have ideas (web push, system notifications via Electron).

If the port reveals an architectural divergence that needs a cross-repo decision (e.g. "mobile uses MMKV-keyed storage X, desktop's IndexedDB schema Y doesn't match"), pause and file a GitHub issue on the relevant repo. Don't decide unilaterally.

## What we do NOT do

1. **Don't run the mobile app.** Inspection only via the repo. (If the user runs it visually and reports findings, that's the visual half of this effort.)
2. **Don't push to `quorum-mobile`.** Mobile is read-only.
3. **Don't open a mobile PR for shared additions during a port.** Drop a mobile task instead.
4. **Don't mirror mobile feature-for-feature.** Pick what makes sense for desktop UX.
5. **Don't skip the smoke test on desktop PRs touching runtime code.** Same rules as shared-migration's "Visual smoke test" section.

## Memory bookmarks

If you discover a persistent fact during a port (mobile uses pattern X for Y, mobile and desktop disagree on Z, etc.), update the relevant doc:
- Implementation patterns / project state → `~/.agents/memory/projects/quilibrium/quorum-desktop/<topic>.md`.
- Cross-repo workflow learnings that should generalize → consider adding to [`../quorum-shared-migration/cross-repo-workflow.md`](../quorum-shared-migration/cross-repo-workflow.md) and link from here.

## PR description template

```markdown
## What
Port the [feature name] from `quorum-mobile` to `quorum-desktop`.

## Mobile source
- `quorum-mobile/app/<screen>.tsx`
- `quorum-mobile/hooks/<hook>.ts`
- `quorum-mobile/services/<service>.ts`

## Why
[Why this feature makes sense on desktop. UX gap, parity reason, user-requested, etc.]

## Cross-repo summary
- **quorum-shared**: [not touched | new exports — see PR #NN | additive bump 2.1.0-XX]
- **quorum-desktop**: THIS PR
- **quorum-mobile**: not touched (read-only for this effort) [+ task drop if shared changed]

## Smoke test
- [ ] [Golden path step 1]
- [ ] [Edge case step 1]
- [ ] [Any regression check on adjacent features]
```

---

*Last updated: 2026-06-08 — added session-branch naming rule for multi-worktree setups (primary clone vs `.worktrees/<name>/`); slimmed the "Doc commits piggy-back on the next feature PR" section to defer to the new repo-wide canonical version in [`agents-workflow.md`](../../agents-workflow.md#pr--commit-workflow).*

*Previously: 2026-06-01 — added mandatory "Capability verification" step (symbol-grep is not enough) and the "Port the capability, not the mobile UX pattern" rule with the Discord-vs-Telegram model worked example. Introduced two-way diff framing — sibling [`desktop-better-than-mobile.md`](desktop-better-than-mobile.md) tracks capabilities where desktop is materially better than mobile.*
