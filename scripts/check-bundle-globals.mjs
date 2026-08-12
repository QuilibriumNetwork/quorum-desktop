/**
 * Fail the build if a debug global reached the production bundle.
 *
 * Second half of the guard whose first half is the ESLint rule
 * `quorum/no-ungated-debug-globals`. The lint rule reads the source; this
 * reads the artifact users actually download. Both exist because source can
 * be correct while output is not — a guard that does not strip, a dependency
 * re-exposing something, a bundler config change.
 *
 * How the watchlist is built
 * --------------------------
 * NOT a hardcoded denylist, which would go stale as soon as someone adds a
 * new global. Every `__`-prefixed global assigned to `window`/`globalThis`
 * anywhere in src/ or web/ is discovered by scanning the source, then
 * asserted absent from the bundle. Add a new dev-only global and it is
 * covered automatically, with no edit here.
 *
 * DELETED_GLOBALS is the one hardcoded part: names removed outright, which by
 * definition no longer appear in source and so cannot be rediscovered. They
 * are listed so they cannot quietly return.
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
const sourceDirs = ['src', 'web'].map((d) => join(repoRoot, d));

/** Removed outright. Not discoverable from source, so listed explicitly. */
const DELETED_GLOBALS = ['__keyset'];

/** Third-party globals that legitimately appear in a production bundle. */
const ALLOWED = [
  '__REACT_DEVTOOLS_GLOBAL_HOOK__',
  '__vite__',
  '__VITE_',
  '__esModule',
];

function walk(dir, extensions) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === '.git') continue;
    if (statSync(full).isDirectory()) out.push(...walk(full, extensions));
    else if (extensions.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

// `(window as any).__x =`, `window.__x =`, `globalThis.__x =`,
// `window['__x'] =`, `(window as unknown as {…}).__x =`
const SOURCE_GLOBAL = /(?:window|globalThis)[^\n;]{0,200}?\.\s*(__[A-Za-z0-9_]+)\s*=[^=]|(?:window|globalThis)\s*\[\s*['"](__[A-Za-z0-9_]+)['"]\s*\]\s*=[^=]/g;

function discoverFromSource() {
  const names = new Set(DELETED_GLOBALS);
  for (const dir of sourceDirs) {
    for (const file of walk(dir, ['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs'])) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(SOURCE_GLOBAL)) {
        const name = m[1] ?? m[2];
        if (name && !ALLOWED.some((a) => name.startsWith(a))) names.add(name);
      }
    }
  }
  return [...names].sort();
}

const watchlist = discoverFromSource();
const bundleFiles = walk(bundleDir, ['.js', '.mjs']);

if (bundleFiles.length === 0) {
  console.error(
    `[check-bundle-globals] No bundle found under ${relative(repoRoot, bundleDir) || bundleDir}.\n` +
      '  Run `yarn build` first. Refusing to report success on an unbuilt tree —\n' +
      '  a check that passes because it looked at nothing is worse than no check.'
  );
  process.exit(1);
}

const violations = [];
for (const file of bundleFiles) {
  const text = readFileSync(file, 'utf8');
  for (const name of watchlist) {
    // Property names survive minification, so a literal search is sound.
    let index = text.indexOf(name);
    while (index !== -1) {
      violations.push({
        file: relative(repoRoot, file),
        name,
        excerpt: text.slice(Math.max(0, index - 40), index + 60).replace(/\n/g, ' '),
      });
      break; // one report per name per file is enough
    }
  }
}

if (violations.length > 0) {
  console.error('\n[check-bundle-globals] DEBUG GLOBALS FOUND IN THE PRODUCTION BUNDLE\n');
  for (const v of violations) {
    console.error(`  ✗ ${v.name}  in ${v.file}`);
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
  `[check-bundle-globals] OK — ${watchlist.length} debug global(s) checked ` +
    `against ${bundleFiles.length} bundle file(s), none present: ${watchlist.join(', ')}`
);
