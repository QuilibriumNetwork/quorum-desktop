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
import { resolve, join } from 'node:path';

const git = (cwd, args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  } catch {
    return '';
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
  const dirty = git(real, ['status', '--porcelain']) !== '';
  if (dirty) {
    warnings.push('uncommitted changes in this checkout — the result is not reproducible');
  }
  // A `link:` specifier is honest about being local. A semver range is not:
  // it claims the published package while resolving to a working copy.
  if (declared && !declared.startsWith('link:')) {
    warnings.push(
      `package.json declares ${declared} (published) — you are NOT testing that`
    );
  }
  return {
    name: shortName(name),
    summary: `LINKED → ${version} (${commit}${dirty ? ', DIRTY' : ', clean'})`,
    warnings,
  };
}

const shortName = (name) => (name.includes('sdk') ? 'sdk' : 'shared');

export async function describeEnvironment(desktopPath) {
  const commit = git(desktopPath, ['rev-parse', '--short', 'HEAD']) || 'no-git';
  const dirtyFiles = git(desktopPath, ['status', '--porcelain'])
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
