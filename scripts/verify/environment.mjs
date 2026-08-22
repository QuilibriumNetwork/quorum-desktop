#!/usr/bin/env node
/**
 * Report what this run actually tested against.
 *
 * Local dependency wiring is machine-local and silent. MEASURED 2026-08-22:
 * desktop declares the SDK as a published `^2.1.0-2` but resolves it through a
 * global `yarn link` to a local checkout at 2.1.1, so a teammate cloning this
 * repo tests different code. That difference must appear in the report, or a
 * green run means something different on every machine.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Deviation from the plan's verbatim source, ruled authorized on review
// (2026-08-22): returns null on failure instead of '', so callers can tell
// "command failed" apart from "command succeeded with empty output". The
// commit lookup doesn't care (both are falsy, both fall back to 'no-git'),
// but the dirty check below does — collapsing a failed `git status` into the
// same '' a clean tree produces silently reports "clean" when we actually
// don't know, which is the false negative this module exists to prevent.
const git = (cwd, args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

function describeDep(desktopPath, name) {
  const modulePath = join(desktopPath, 'node_modules', name);
  if (!existsSync(modulePath)) {
    return { name: shortName(name), summary: 'NOT INSTALLED', warnings: [] };
  }

  const real = realpathSync(modulePath);
  const linked = real !== modulePath;
  const pkg = readJson(join(real, 'package.json'));
  const version = pkg?.version ?? 'unknown';
  const declared =
    readJson(join(desktopPath, 'package.json'))?.dependencies?.[name] ?? '';

  const warnings = [];
  if (!linked) {
    return {
      name: shortName(name),
      summary: `published @ ${version}`,
      warnings,
    };
  }

  const commit = git(real, ['rev-parse', '--short', 'HEAD']) || 'no-git';
  const status = git(real, ['status', '--porcelain']);
  // null (command failed) is a distinct, worse state than '' (command
  // succeeded, nothing to report) — see the note on git() above. Do not
  // collapse it back into "clean".
  const dirty = status === null ? null : status !== '';
  if (dirty === null) {
    warnings.push(
      'could not determine whether this checkout has uncommitted changes (git status failed) — treat this run as unverified, not clean'
    );
  } else if (dirty) {
    warnings.push('uncommitted changes in this checkout — the result is not reproducible');
  }
  // A `link:` specifier is honest about being local. A semver range is not:
  // it claims the published package while resolving to a working copy.
  if (declared && !declared.startsWith('link:')) {
    warnings.push(
      `package.json declares ${declared} (published) — you are NOT testing that`
    );
  }
  const dirtyLabel = dirty === null ? 'UNKNOWN' : dirty ? 'DIRTY' : 'clean';
  return {
    name: shortName(name),
    summary: `LINKED → ${version} (${commit}, ${dirtyLabel})`,
    warnings,
  };
}

const shortName = (name) => (name.includes('sdk') ? 'sdk' : 'shared');

export async function describeEnvironment(desktopPath) {
  const commit = git(desktopPath, ['rev-parse', '--short', 'HEAD']) || 'no-git';
  // git() can now return null on failure (see the note above). Guard the
  // `.split` so a failed `git status` here can't crash the whole report;
  // this call site's dirty/clean duplication vs. describeDep's is a known,
  // separately-tracked deferral, not something this fix expands the scope to
  // restructure.
  const dirtyFiles = (git(desktopPath, ['status', '--porcelain']) ?? '')
    .split('\n')
    .filter(Boolean).length;

  const deps = [
    {
      name: 'desktop',
      summary: `${commit}${dirtyFiles ? `  ⚠ working tree dirty (${dirtyFiles} files)` : '  clean'}`,
      warnings: [],
    },
    describeDep(desktopPath, '@quilibrium/quorum-shared'),
    describeDep(desktopPath, '@quilibrium/quilibrium-js-sdk-channels'),
  ];
  return { deps };
}
