#!/usr/bin/env node
/**
 * Decide what to run from what changed.
 *
 * The live-tier trigger is an ALLOWLIST of provably safe paths, not a denylist
 * of dangerous ones, and the direction is the whole design. A denylist rots
 * silently: someone adds a receive path, nobody lists it, live coverage lapses
 * and there is no signal. An allowlist rots loudly — it costs an unnecessary
 * fifteen minutes, which is visible the moment it happens.
 *
 * Paths arrive prefixed with their repo: `desktop/src/...`, `shared/src/...`.
 */
import { dirname, resolve } from 'node:path';

/**
 * Safe: cannot change what goes on the wire or what comes off it.
 *
 * Every pattern here must match a path that actually exists in one of the three
 * repos. A pattern that matches nothing is not harmless — it reads as coverage
 * that isn't there, and hides the real directory it was meant to name. MEASURED
 * 2026-08-23 by classifying every tracked file in all three repos: the original
 * `src/locales/` matched ZERO files anywhere, while desktop's real translation
 * catalogues live under `src/i18n/<locale>/` and were all routing to the live
 * tier — roughly 100 files paying six minutes of real-relay traffic to change a
 * translated string.
 */
const SAFE = [
  /\.md$/,
  /\.mdx$/,
  /\.s?css$/,
  /^[^/]+\/\.agents\//,
  /^[^/]+\/\.claude\//,
  /^[^/]+\/public\//,
  // Only files INSIDE a locale folder. `src/i18n/i18n.ts` and
  // `src/i18n/locales.ts` sit at that directory's root and are real code, so
  // the trailing `[^/]+\/` is load-bearing: it requires a locale segment.
  /^[^/]+\/src\/(i18n|locales)\/[^/]+\//,
  /\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
];

/**
 * Safe ONLY when nothing riskier is in the same diff. A component cannot reach
 * the wire on its own, but a diff that touches a component and a service is not
 * a UI change with a service file in it — it is a service change.
 *
 * The three repos do NOT share a layout, and assuming they did was the second
 * measured gap. Desktop and shared put source under `src/`; quorum-mobile has
 * no `src/` directory at all (MEASURED: zero tracked files under `mobile/src/`).
 * So the `src/`-prefixed patterns silently covered desktop only, leaving
 * mobile's 208 components, its 173 icon components under `assets/icons/`, and
 * its whole harness unclassified — 74% of that repo routing to a live tier that
 * cannot observe any of it.
 */
const SAFE_ALONE = [
  // Desktop + shared components, EXCEPT the subtrees that reach past the view
  // layer. "A component cannot reach the wire" is a claim about capability,
  // and a directory name is not capability — this pattern used to clear
  // `src/components/context/WebsocketProvider.tsx`, which owns the literal
  // `new WebSocket(...)` (`:167`), so a change to the transport itself skipped
  // every live arm. Found by adversarial review 2026-08-23; the comment above
  // asserting components are safe was the justification for the bug.
  //
  // MEASURED: 7 of 196 files under `src/components/` import from `services/`
  // or `api/` — 4 in `context/`, 3 in those two modal subtrees. So the
  // category is right and its boundary was wrong, which is why this is a
  // carve-out rather than a deletion.
  //
  // The list is kept honest by `componentsRoutingScope.contract.test.ts`,
  // which fails the fast tier if any OTHER file under `src/components/` starts
  // importing a service. Without that, this is a hole that reopens silently
  // the first time someone adds an import.
  /^[^/]+\/src\/components\/(?!context(?:\/|$)|modals\/UserSettingsModal(?:\/|$)|modals\/SpaceSettingsModal(?:\/|$))/,
  // `src/primitives/` is shared's home for the same UI primitives desktop
  // re-exports. MEASURED: nothing under it imports a service.
  /^[^/]+\/src\/primitives\//,
  // Everything under `src/dev/tests/` EXCEPT the harness. The harness is the
  // live tier's own instrument — `spaceState.ts`, the scenario files, the bot
  // helpers — so a change there is precisely the change that needs a live run
  // to mean anything. Excluding it from the safe list is not conservatism, it
  // is the only way the gate can check its own measuring equipment.
  //
  // `(?:\/|$)` rather than a bare `harness\/`: the bare form only rejects the
  // literal 8 characters, so a sibling named `harness-legacy/` or
  // `harnessing/` would slip through and be treated as ordinary test code.
  /^[^/]+\/src\/dev\/tests\/(?!harness(?:\/|$))/,
  // quorum-mobile's flat layout. `components/` is deliberately ABSENT:
  // MEASURED, mobile components import services directly and widely (unlike
  // desktop's, where it is 7 files), so the same capability argument that
  // carves out desktop's `context/` disqualifies the whole mobile tree. A
  // mobile-only change already runs just the two cross-client arms, so the
  // cost of being careful here is small.
  //
  // `dev/harness/` is absent for the same reason desktop's is: it is the
  // instrument the two cross-client arms actually run.
  /^[^/]+\/assets\//,
  /^[^/]+\/__tests__\//,
  // Native build config. MEASURED: `android/` and `ios/` hold no `.js`/`.ts`
  // at all (png, webp, xml, json, swift, plist, gradle, kt), so they cannot
  // change any JavaScript path the live tier drives.
  /^[^/]+\/(android|ios)\//,
];

const REPO_OF = (path) => path.split('/')[0];

export function planFromPaths(paths) {
  const reasons = [];
  const touched = new Set(paths.map(REPO_OF).filter(Boolean));

  // Channel A: desktop symlinks shared and mobile pins the published copy, so a
  // shared change is the only one that fans out on its own.
  const repos = [];
  if (touched.has('shared')) repos.push('shared', 'desktop', 'mobile');
  else {
    if (touched.has('desktop')) repos.push('desktop');
    if (touched.has('mobile')) repos.push('mobile');
  }

  const risky = paths.filter(
    (p) => !SAFE.some((r) => r.test(p)) && !SAFE_ALONE.some((r) => r.test(p))
  );
  const live = risky.length > 0;
  if (live) {
    reasons.push(`(not on the safe list: ${risky.slice(0, 3).join(', ')})`);
    if (risky.length > 3) reasons.push(`(… and ${risky.length - 3} more)`);
  } else if (paths.length) {
    reasons.push('(every changed path is on the safe list — fast tier only)');
  }

  // WHICH live arms can observe this change, as opposed to WHETHER any can.
  //
  // The live tier is desktop-only: every arm is a desktop vitest scenario, and
  // only the two cross-client runners (`run-cross.mjs`, `run-config-cross.mjs`)
  // reach into quorum-mobile at all — READ 2026-08-23, `grep -rl quorum-mobile
  // src/dev/tests/harness/` returns those two plus the scenarios they drive and
  // the README. So when the ONLY risky paths are mobile's, the four same-client
  // arms load no changed code whatsoever. Running them is not caution, it is
  // six minutes of real-relay traffic that could not have gone red.
  //
  // This is narrower than it looks and deliberately so. A shared change puts
  // `shared/…` in `risky`, so it is never mobile-only; a diff touching both
  // repos is never mobile-only. The rule fires only when every risky path is
  // physically incapable of reaching desktop's process.
  const mobileOnly = live && risky.every((p) => REPO_OF(p) === 'mobile');
  const liveScope = mobileOnly ? 'cross-only' : 'all';
  if (mobileOnly) {
    reasons.push(
      '(only quorum-mobile changed — running the cross-client arms; the four ' +
        'same-client arms load no mobile code and cannot observe it)'
    );
  }

  // `skipped` and `notes` are two channels on purpose, and the distinction is
  // the same one `report.mjs`'s SEVERITY comment defends: `skipped` means THIS
  // RUN PROVED LESS, and forces `PASS (PARTIAL)`. `notes` is advisory — true,
  // worth printing, and never a reduction in coverage, so it must not touch the
  // verdict. Without the second channel, telling the reader something useful
  // (a stale exemption, a debt count that improved) would cost a downgraded
  // verdict, and a warning that fires when nothing is wrong stops being read.
  return { repos: [...new Set(repos)], live, liveScope, reasons, skipped: [], notes: [] };
}

/**
 * Does this live arm spawn quorum-mobile?
 *
 * READ 2026-08-23: `grep -rl quorum-mobile src/dev/tests/harness/` names only
 * `run-cross.mjs`, `run-config-cross.mjs` and the scenarios they drive. Every
 * other arm is a desktop vitest scenario that never loads a line of mobile.
 */
export const needsMobile = (step) => step.id.includes('cross');

/**
 * The live arms a plan can actually learn something from.
 *
 * Deliberately shared by the runner and by `--explain`. If `--explain`
 * re-implemented this filter it would be a second source of truth about what
 * runs, and the moment the two drifted the cheap answer would be the wrong
 * one — a tool for predicting cost that quietly mispredicts is worse than not
 * having it, because it is trusted.
 */
export function liveArmsFor(plan, steps) {
  if (!plan.live) return [];
  const inScope =
    (plan.liveScope ?? 'all') === 'cross-only' ? steps.filter(needsMobile) : steps;
  return plan.exhaustive ? inScope : inScope.filter((s) => !s.exhaustiveOnly);
}

/**
 * Arms that WOULD have run but were held back for cost.
 *
 * Returned so the report can name them on every run. An arm that silently
 * stops running is the failure this whole gate exists to prevent, and "it is
 * documented in AGENTS.md" is not a substitute for the run itself saying so —
 * the person reading a PASS is not usually the person who read the doc.
 */
export function heldBackArms(plan, steps) {
  if (!plan.live || plan.exhaustive) return [];
  const inScope =
    (plan.liveScope ?? 'all') === 'cross-only' ? steps.filter(needsMobile) : steps;
  return inScope.filter((s) => s.exhaustiveOnly);
}

/**
 * The branch this work will be merged into, as a ref name.
 *
 * Prefers the local `refs/remotes/origin/HEAD` because it is offline and
 * instant, then falls back through the usual names. Returns `null` when none
 * resolves, which callers must treat as "cannot tell what changed" rather than
 * "nothing changed".
 *
 * The `(unknown)` placeholder is rejected explicitly. `--short` strips only the
 * `refs/remotes/` prefix, NOT the remote name, so what actually comes back when
 * the remote HEAD was never properly set is `origin/(unknown)` — checking for a
 * bare `(unknown)` (as this did until adversarial review caught it on
 * 2026-08-23) is a comparison real git never satisfies. Both forms are handled
 * now. The consequence of missing it was mild rather than dangerous — a bogus
 * ref makes `merge-base` fail, which forces the live tier — but the guard read
 * as tested when it was not.
 */
export function branchBaseRef(repoPath, execGit) {
  const symbolic = execGit(repoPath, [
    'symbolic-ref',
    '--short',
    'refs/remotes/origin/HEAD',
  ])?.trim();
  const placeholder = symbolic === '(unknown)' || symbolic?.endsWith('/(unknown)');
  if (symbolic && !placeholder) return symbolic;
  for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
    if (execGit(repoPath, ['rev-parse', '--verify', '--quiet', candidate])) return candidate;
  }
  return null;
}

/**
 * Repo-prefixed changed paths: this branch's own commits, PLUS staged and
 * unstaged work, PLUS untracked files.
 *
 * The branch half was missing until 2026-08-23 and it silently voided the gate
 * at the exact moment it matters. MEASURED on this very branch: 31 files
 * changed versus `main`, including `src/services/`, `src/hooks/` and the
 * harness itself, and with a clean working tree `yarn verify` reported "no
 * changes detected — desktop fast tier as a baseline" and ran zero live arms.
 * The normal flow is commit, then verify, then open a PR; under that flow the
 * gate was answering a question nobody asked and returning a PASS that had
 * tested none of the work. The function's own doc comment already claimed it
 * compared against the merge base, so the code and its description had
 * disagreed since it was written.
 *
 * On the base branch itself with a clean tree, `merge-base(HEAD, origin/main)`
 * IS `HEAD`, so the extra diff is empty and this changes nothing — which is
 * correct, because there is then nothing under review.
 *
 * Every failure mode contributes one synthetic path that no `SAFE`/
 * `SAFE_ALONE` pattern can match, forcing `live` and naming the repo in the
 * printed reasons exactly like any other risky, unclassified change — because
 * from routing's point of view, that is what it is. `execGit` returning `null`
 * on a failed command (as opposed to `''` for "ran fine, nothing to report",
 * mirroring `environment.mjs`'s `git()`) is what makes that distinction
 * possible: collapsing the two would let a corrupted repo, an index lock or a
 * permission error read as "this repo has no changes", silently suppressing
 * both its fan-out and the live-tier trigger. An allowlist has to fail toward
 * running MORE, not less.
 */
export function changedPaths(repoName, repoPath, execGit) {
  const reads = [
    execGit(repoPath, ['diff', '--name-only', 'HEAD']),
    execGit(repoPath, ['diff', '--name-only', '--staged']),
    execGit(repoPath, ['ls-files', '--others', '--exclude-standard']),
  ];

  const base = branchBaseRef(repoPath, execGit);
  if (!base) {
    return [`${repoName}/<no base branch — cannot tell what this branch changed>`];
  }
  const mergeBase = execGit(repoPath, ['merge-base', 'HEAD', base])?.trim();
  if (!mergeBase) {
    return [`${repoName}/<no merge base with ${base} — cannot tell what this branch changed>`];
  }
  reads.push(execGit(repoPath, ['diff', '--name-only', `${mergeBase}..HEAD`]));

  if (reads.some((r) => r === null)) {
    return [`${repoName}/<unreadable — git command failed>`];
  }
  const out = reads.join('\n');
  return [...new Set(out.split('\n').map((l) => l.trim()).filter(Boolean))].map(
    (p) => `${repoName}/${p}`
  );
}

/**
 * Which platform plays which role in the cross-client DM arm.
 *
 * Role `a` initiates and `b` echoes, so this decides whether the run measures
 * mobile→desktop or the reverse. The default puts MOBILE as the initiator,
 * because mobile→desktop is the field's reported bad direction.
 *
 * Lives HERE, beside `resolveMobileRepo`, for exactly the same reason that one
 * does: two places need the answer and they must not compute it separately.
 * `run-cross.mjs` needs it to launch the two processes; `mintGuard.mjs` needs it
 * to know WHICH bot names the run will use, because the role decides the names
 * (`cross-desktop-${ROLE}`, `dm-bot-${ROLE}`) and therefore which identity files
 * have to exist for the arm to run without registering new accounts.
 *
 * Found by adversarial review 2026-08-24. The guard had the default names
 * hardcoded with a comment noting the env var existed — so with
 * `HARNESS_DESKTOP_ROLE=a` exported in the shell (`runner.mjs` spawns steps
 * without an `env` override, so it reaches them), the guard checked
 * `cross-desktop-b`/`dm-bot-a`, found them, reported the arm safe, and the arm
 * then minted `cross-desktop-a` and `dm-bot-b` — two permanent accounts, one on
 * each platform, under a clean report.
 */
export function crossRoles(env = process.env) {
  const desktop = env?.HARNESS_DESKTOP_ROLE === 'a' ? 'a' : 'b';
  return { desktop, mobile: desktop === 'a' ? 'b' : 'a' };
}

/**
 * Skip any persisted space and mint a fresh one.
 *
 * Lives here for the same reason `crossRoles` does, and it arrived here the
 * same way: adversarial review 2026-08-24 found it hand-copied into
 * `mintGuard.mjs`, because `spaceState.ts` is TypeScript and the guard is a
 * plain `.mjs` run directly by node, which cannot import TS without a loader.
 * The two copies agreed at the time, and nothing coupled them — so a later edit
 * to one (a third truthy value, a renamed variable) would silently leave the
 * guard under-protecting: it would clear `space-delivery` as safe while the
 * scenario went on to create a permanent, undeletable Space.
 *
 * A plain-JS module is importable from BOTH sides — `.ts` files in this repo
 * already import `mobileRepo.mjs` — so one definition can serve both. That
 * asymmetry is the whole trick: TypeScript can import `.mjs`, the reverse needs
 * a loader.
 *
 * `spaceState.ts` re-exports this so the harness's own surface is unchanged.
 */
export const wantsFreshSpace = (env = process.env) =>
  env?.HARNESS_FRESH === '1' || env?.HARNESS_FRESH === 'true';

/**
 * Resolve the MAIN checkout root from any worktree, linked or not.
 *
 * Deviation from the plan's verbatim source, ruled authorized on review
 * (2026-08-22): the brief has the caller default siblings to `resolve(desktop,
 * '..')`, which is wrong from a linked worktree — there, `..` is just the
 * `.worktrees/` directory, not the checkout that actually sits next to the
 * sibling repos. `execGit` here is expected to run `git rev-parse
 * --git-common-dir` from `desktop` and return its (untrimmed) stdout, or
 * `null` on failure. A linked worktree gets an ABSOLUTE `.git` path back; the
 * main checkout gets a RELATIVE one (just `.git`), which collapses
 * `dirname(resolve(desktop, commonDir))` right back onto `desktop` itself —
 * that is what makes this a no-op in the shipped, non-worktree case
 * (MEASURED 2026-08-22 in both a linked worktree and the main checkout).
 * A git failure (missing git, not a repo, …) falls back to `desktop` too:
 * there is no better answer available, and failing open here just reproduces
 * the brief's original expression one call site up.
 */
export function mainCheckoutFrom(desktop, execGit) {
  const commonDir = execGit(desktop, ['rev-parse', '--git-common-dir']);
  if (!commonDir) return desktop;
  return dirname(resolve(desktop, commonDir.trim()));
}

/**
 * Where quorum-mobile is. THE one rule — both the gate and the harness scripts
 * it spawns must ask this, or they can disagree about which checkout is under
 * test.
 *
 * That disagreement is not hypothetical, and it was introduced by making
 * `HARNESS_MOBILE_REPO` real on 2026-08-24. Before then the variable was
 * printed in error messages and read by nobody, so it could not cause a split.
 * After, the harness honoured it and `index.mjs` still computed its own sibling
 * path — so with the variable set to a different checkout, the gate would diff
 * repo A, decide the live tier was needed, find repo A present, run the arms,
 * and the arms would test repo B. A green run that had never executed the code
 * that triggered it. Caught by adversarial review the same day.
 *
 * `execGit` is injected rather than imported so this module stays pure and
 * testable; callers supply the real one. `env` is passed in for the same
 * reason.
 */
export function resolveMobileRepo(desktop, env, execGit, siblingsRoot) {
  // Precedence, most explicit first. `siblingsRoot` is `yarn verify`'s
  // `--repos-root=` flag: a CLI argument beats an ambient variable, and it is
  // handled HERE rather than at the call site so the repo name is written down
  // in exactly one file — which is the entire point of this function.
  if (siblingsRoot) return resolve(siblingsRoot, 'quorum-mobile');
  // An explicit answer beats an inferred one, and it is the only route that
  // works when the two repos genuinely are not siblings. An exported-but-empty
  // variable is how a shell says "unset", so it must not count.
  const override = env?.HARNESS_MOBILE_REPO;
  if (override) return resolve(override);
  return resolve(mainCheckoutFrom(desktop, execGit), '..', 'quorum-mobile');
}
