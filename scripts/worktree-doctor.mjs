#!/usr/bin/env node
/**
 * Worktree doctor — repair a linked git worktree's locally-linked dependencies.
 *
 * ## The problem this exists for
 *
 * Some of this project's dependencies are not installed from the registry, they
 * are LINKED into `node_modules` from elsewhere on the machine:
 *
 *   - `@quilibrium/quorum-shared`            → the sibling checkout
 *   - `@quilibrium/quilibrium-js-sdk-channels` → a `yarn link` target
 *
 * A linked worktree (`git worktree add`) gets its own `node_modules`, and those
 * links do NOT come along. Whatever is sitting there when the worktree is
 * created is frozen: a physical copy that never updates, or a symlink pointing
 * at a path that has since moved. Both fail in the same quiet way — the code
 * compiles against a months-old build of a package whose version number never
 * changed, so nothing looks wrong until a type that exists everywhere else is
 * suddenly "not exported".
 *
 * Observed 2026-08-02 in `.worktrees/secondary`: the SDK was a stale physical
 * copy from January (same "2.1.1" version string as the current one, 2 KB of
 * missing type declarations), and `quorum-shared` pointed at a worktree path
 * that no longer existed. `tsc` reported three errors that do not reproduce on
 * `main`, which reads as "my branch broke something" rather than "my
 * node_modules is stale" — the expensive kind of wrong.
 *
 * ## What it does
 *
 * For each linked package, it reads the MAIN worktree's link target at runtime
 * and mirrors it into the current worktree as a junction. Nothing about any
 * machine's layout is written down here: the target is whatever the main
 * worktree already resolves to, so this stays correct when that path changes
 * and never embeds a user-profile path in a tracked file.
 *
 * Junctions rather than symlinks deliberately: creating a symlink on Windows
 * needs Developer Mode or elevation, and Git Bash's `ln -s` silently degrades
 * to a recursive COPY when it cannot — which is how a "link" becomes the stale
 * copy this script exists to clean up. Directory junctions need no privilege
 * and Node resolves them identically. On Linux and macOS real symlinks are
 * used, where no such restriction applies.
 *
 * ## Usage
 *
 *   node scripts/worktree-doctor.mjs          # check, report, and repair
 *   node scripts/worktree-doctor.mjs --check  # report only, non-zero if broken
 *
 * Safe and idempotent: a healthy worktree is left untouched. Run it after
 * creating a worktree, and any time a worktree behaves differently from `main`
 * for no reason the diff explains.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Packages that are linked rather than installed. Add to this list if another
 *  local link is ever introduced. */
const LINKED_PACKAGES = [
  '@quilibrium/quorum-shared',
  '@quilibrium/quilibrium-js-sdk-channels',
];

/** A file every one of these packages ships, used as a cheap "is this actually
 *  reachable and populated" probe rather than trusting the directory exists. */
const HEALTH_PROBE = 'package.json';

const checkOnly = process.argv.includes('--check');
const isWindows = process.platform === 'win32';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/**
 * The main worktree's root — the one holding the canonical links. `git
 * rev-parse --git-common-dir` points at the main `.git` even from inside a
 * linked worktree, so its parent is the main checkout.
 */
function findMainWorktree(cwd) {
  const commonDir = path.resolve(cwd, git(['rev-parse', '--git-common-dir'], cwd));
  return path.dirname(commonDir);
}

function describeLink(linkPath) {
  let stat;
  try {
    stat = fs.lstatSync(linkPath);
  } catch {
    return { kind: 'missing' };
  }
  if (stat.isSymbolicLink()) {
    let target = null;
    try {
      target = fs.readlinkSync(linkPath);
    } catch {
      /* dangling */
    }
    return { kind: 'link', target };
  }
  if (stat.isDirectory()) {
    // A junction reports as a directory to lstat on Windows, so a plain
    // directory here is either a junction (fine) or a physical copy (stale).
    // realpath tells them apart: a junction resolves elsewhere.
    try {
      const real = fs.realpathSync(linkPath);
      if (path.resolve(real) !== path.resolve(linkPath)) {
        return { kind: 'link', target: real };
      }
    } catch {
      /* fall through */
    }
    return { kind: 'copy' };
  }
  return { kind: 'other' };
}

function isHealthy(linkPath, expectedTarget) {
  const info = describeLink(linkPath);
  if (info.kind !== 'link') return false;
  if (!fs.existsSync(path.join(linkPath, HEALTH_PROBE))) return false;
  if (!expectedTarget) return true;
  try {
    return (
      path.resolve(fs.realpathSync(linkPath)) ===
      path.resolve(fs.realpathSync(expectedTarget))
    );
  } catch {
    return false;
  }
}

function createLink(linkPath, target) {
  fs.rmSync(linkPath, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  // 'junction' is Windows-only in Node's API and always uses an absolute
  // target; elsewhere a plain directory symlink is correct and unprivileged.
  fs.symlinkSync(path.resolve(target), linkPath, isWindows ? 'junction' : 'dir');
}

function main() {
  const cwd = process.cwd();

  let mainWorktree;
  try {
    mainWorktree = findMainWorktree(cwd);
  } catch {
    console.error('worktree-doctor: not inside a git repository.');
    process.exit(2);
  }

  const repoRoot = git(['rev-parse', '--show-toplevel'], cwd);

  if (path.resolve(repoRoot) === path.resolve(mainWorktree)) {
    console.log(
      'worktree-doctor: this IS the main worktree — its links are the reference, nothing to repair.'
    );
    return;
  }

  console.log(`worktree-doctor: checking ${path.relative(mainWorktree, repoRoot) || repoRoot}`);

  let broken = 0;
  let repaired = 0;

  for (const pkg of LINKED_PACKAGES) {
    const linkPath = path.join(repoRoot, 'node_modules', pkg);
    const referencePath = path.join(mainWorktree, 'node_modules', pkg);

    let target = null;
    try {
      target = fs.realpathSync(referencePath);
    } catch {
      console.log(`  SKIP ${pkg} — the main worktree has no such package installed.`);
      continue;
    }

    if (isHealthy(linkPath, target)) {
      console.log(`  ok   ${pkg}`);
      continue;
    }

    broken += 1;
    const { kind } = describeLink(linkPath);
    const reason =
      kind === 'copy'
        ? 'physical copy (will go stale silently)'
        : kind === 'missing'
          ? 'absent'
          : 'link does not resolve to the main worktree target';
    console.log(`  BAD  ${pkg} — ${reason}`);

    if (checkOnly) continue;

    try {
      createLink(linkPath, target);
      if (isHealthy(linkPath, target)) {
        repaired += 1;
        console.log(`       repaired — now a ${isWindows ? 'junction' : 'symlink'}`);
      } else {
        console.log('       REPAIR FAILED — link created but still unhealthy.');
      }
    } catch (err) {
      console.log(`       REPAIR FAILED — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (broken === 0) {
    console.log('worktree-doctor: all linked dependencies healthy.');
    return;
  }

  if (checkOnly) {
    console.log(
      `worktree-doctor: ${broken} linked dependenc${broken === 1 ? 'y' : 'ies'} need repair. ` +
        'Run `node scripts/worktree-doctor.mjs` (no flag) to fix.'
    );
    process.exit(1);
  }

  if (repaired < broken) {
    console.log(
      `worktree-doctor: repaired ${repaired} of ${broken}. Re-run typecheck before trusting the worktree.`
    );
    process.exit(1);
  }

  console.log(
    `worktree-doctor: repaired ${repaired}. Re-run \`npx tsc --noEmit --jsx react-jsx --skipLibCheck\` to confirm.`
  );
}

main();
