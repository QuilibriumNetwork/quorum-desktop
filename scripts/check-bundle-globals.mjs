#!/usr/bin/env node
/**
 * Fail the build if a debug global reached the production bundle.
 *
 * Second half of the guard whose first half is the ESLint rule
 * `quorum/no-ungated-debug-globals`. The lint rule reads the source; this
 * reads the artifact users actually download. Both exist because source can
 * be correct while output is not — a guard that does not strip, a bundler
 * config change, or a lint rule that was disabled with a comment.
 *
 * What it looks for
 * -----------------
 * Assignments of a `__`-prefixed property onto the global object, **in the
 * built output**:
 *
 *     window.__x = …        globalThis.__x = …        window['__x'] = …
 *     const w = window; w.__x = …          (alias, see below)
 *
 * It deliberately does NOT decide what to look for by scanning `src/`. An
 * earlier version did, which made it blind by construction to anything the
 * source-side regex could not express — notably assignment through a local
 * alias, where the secret shipped and this check still reported OK. Reading
 * only the artifact removes that whole class, and also stops a code comment
 * that happens to mention `window.__something` from being mistaken for a real
 * assignment.
 *
 * Aliases: minifiers keep `window` as-is (it is a global) but rename locals,
 * so `const w = window; w.__x = y` emits as `const a=window;a.__x=y`. The
 * scan therefore collects identifiers assigned from `window`/`globalThis` and
 * checks property writes on those too. Measured against the real bundle this
 * adds zero false positives.
 *
 * Property names survive minification, which is what makes any of this sound.
 *
 * Usage: node scripts/check-bundle-globals.mjs [bundleDir]
 * Runs automatically after `yarn build`.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const bundleDir = process.argv[2]
  ? join(repoRoot, process.argv[2])
  : join(repoRoot, 'dist');

const SCANNED_EXTENSIONS = ['.js', '.mjs', '.cjs', '.html'];

/**
 * Third-party globals that legitimately appear in a production bundle.
 * EXACT names only, never prefixes: a `startsWith` test let a crafted name
 * like `__vite__mySecret` inherit an entry's trust silently.
 */
const ALLOWED = new Set([
  '__reactRouterVersion', // react-router, sets this on window by design
]);

/**
 * Names removed outright, which must never reappear in any form. Matched as a
 * bare substring rather than as an assignment, because for these the bar is
 * "does not occur at all".
 */
const FORBIDDEN_ANYWHERE = ['__keyset'];

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (SCANNED_EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Identifiers that hold `window` / `globalThis`, so `a.__x =` is caught too. */
function collectAliases(text) {
  const aliases = new Set();
  const pattern =
    /(?:^|[;,{}()\s=])([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:window|globalThis)\b(?!\s*\.)/g;
  for (const match of text.matchAll(pattern)) aliases.add(match[1]);
  return aliases;
}

/** Every `<base>.__name =` / `<base>['__name'] =` write in this text. */
function findGlobalWrites(text) {
  const bases = ['window', 'globalThis', ...collectAliases(text)];
  const found = [];
  for (const base of bases) {
    const b = escape(base);
    const patterns = [
      new RegExp(`\\b${b}\\s*\\.\\s*(__[A-Za-z0-9_$]{1,60})\\s*=(?!=)`, 'g'),
      new RegExp(`\\b${b}\\s*\\[\\s*["'](__[A-Za-z0-9_$]{1,60})["']\\s*\\]\\s*=(?!=)`, 'g'),
    ];
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        found.push({ name: match[1], base, index: match.index ?? 0 });
      }
    }
  }
  return found;
}

const bundleFiles = walk(bundleDir);

if (bundleFiles.length === 0) {
  console.error(
    `[check-bundle-globals] No bundle found under ${relative(repoRoot, bundleDir) || bundleDir}.\n` +
      '  Run `yarn build` first. Refusing to report success on an unbuilt tree —\n' +
      '  a check that passes because it looked at nothing is worse than no check.'
  );
  process.exit(1);
}

const violations = [];
const seen = new Set();

for (const file of bundleFiles) {
  const text = readFileSync(file, 'utf8');
  const shortPath = relative(repoRoot, file);

  for (const { name, base, index } of findGlobalWrites(text)) {
    if (ALLOWED.has(name)) continue;
    const key = `${shortPath}::${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    violations.push({
      file: shortPath,
      name,
      detail: `assigned to \`${base}\``,
      excerpt: text.slice(Math.max(0, index - 40), index + 60).replace(/\s+/g, ' '),
    });
  }

  for (const name of FORBIDDEN_ANYWHERE) {
    const index = text.indexOf(name);
    if (index === -1) continue;
    const key = `${shortPath}::${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    violations.push({
      file: shortPath,
      name,
      detail: 'removed outright, must not appear in any form',
      excerpt: text.slice(Math.max(0, index - 40), index + 60).replace(/\s+/g, ' '),
    });
  }
}

if (violations.length > 0) {
  console.error('\n[check-bundle-globals] DEBUG GLOBALS FOUND IN THE PRODUCTION BUNDLE\n');
  for (const v of violations) {
    console.error(`  ✗ ${v.name}  (${v.detail})  in ${v.file}`);
    console.error(`      …${v.excerpt}…`);
  }
  console.error(
    '\n  These are readable by any script running in the page, including browser\n' +
      '  extensions and injected or compromised third-party code. Check what the\n' +
      '  exposed object can reach before assuming it is harmless.\n\n' +
      "  Fix: wrap the assignment in `if (typeof window !== 'undefined' &&\n" +
      '  import.meta.env?.DEV) { … }` (see src/dev/db-inspector/dbDumpUtil.ts),\n' +
      '  or delete it. Do not add it to the allowlist in this script.\n'
  );
  process.exit(1);
}

console.log(
  `[check-bundle-globals] OK — ${bundleFiles.length} bundle file(s) scanned, ` +
    'no ungated debug globals on window/globalThis.'
);
