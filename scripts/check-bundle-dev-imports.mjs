#!/usr/bin/env node
/**
 * Fail the build if the production bundle still IMPORTS a module under
 * `src/dev/`.
 *
 * Sibling of `check-bundle-globals.mjs`, and it exists because that check has a
 * blind spot that shipped a blank app.
 *
 * ## The bug this would have caught
 *
 * `web/vite.config.ts` marks everything under `src/dev/` as `external` in a
 * production build. Externalisation is a RESOLUTION-time decision, so it
 * happens long before tree-shaking, and an external module is deliberately
 * preserved as a runtime import rather than inlined.
 *
 * So when `src/identity/qnsClaimExemption.ts` statically imported
 * `../dev/fake-qns/fakeQnsCore`, the result was the worst of both worlds:
 *
 *     import"../src/dev/fake-qns/fakeQnsCore"   // in the bundle
 *     dist/src/dev/fake-qns/fakeQnsCore         // never emitted
 *
 * The browser 404'd it, the module graph failed, and React never mounted. The
 * whole app was a blank page.
 *
 * `check-bundle-globals.mjs` did not catch it, and was not wrong to miss it: it
 * forbids dev IDENTIFIERS (`isFakeClaimFor`, `dev.fakeQns.state`) and those were
 * genuinely absent — precisely BECAUSE the module was external, so none of its
 * code was inlined. It answers "did dev code ship?". This answers the different
 * question "did a reference to dev code survive?".
 *
 * Both failure modes are real and neither implies the other:
 *   - code inlined, no import   -> globals check catches it
 *   - import dangling, no code  -> this check catches it
 *
 * Usage: node scripts/check-bundle-dev-imports.mjs [bundleDir]
 * Runs automatically after `yarn build`.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
// An absolute argument is used as-is. Blindly joining it onto repoRoot produces
// a nonsense path that does not exist, and "directory not found" then reads as
// a clean failure rather than as bad input — which is how the fixture tests for
// this script first came back green for the wrong reason.
const bundleArg = process.argv[2];
const bundleDir = bundleArg
  ? isAbsolute(bundleArg)
    ? bundleArg
    : join(repoRoot, bundleArg)
  : join(repoRoot, 'dist');

const SCANNED_EXTENSIONS = ['.js', '.mjs', '.cjs', '.html'];

/**
 * Matches a module specifier containing a `dev/` path segment in any import
 * form the bundler emits:
 *
 *   import"../src/dev/x"            side-effect only (the form that broke)
 *   import x from"../src/dev/x"     default / named
 *   from"../src/dev/x"              re-export
 *   import("../src/dev/x")          dynamic
 *
 * Deliberately matches the SPECIFIER STRING, which survives minification.
 * Identifier names do not, which is why the sibling check cannot be relied on
 * alone for a minified build.
 */
const DEV_SPECIFIER = /(?:\bimport\s*\(?|\bfrom\s*)["']([^"']*\/dev\/[^"']*)["']/g;

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

if (!existsSync(bundleDir)) {
  console.error(
    `[check-bundle-dev-imports] bundle directory not found: ${bundleDir}`
  );
  process.exit(1);
}

const files = walk(bundleDir);

// Mirrors check-bundle-globals.mjs. A check that passes because it looked at
// nothing is worse than no check: it converts "unbuilt or misconfigured tree"
// into a green tick, which is exactly the shape of failure this script exists
// to catch. `yarn build` chains on `&&`, so exiting 0 here would report success
// on a build that never happened.
if (files.length === 0) {
  console.error(
    `[check-bundle-dev-imports] No bundle found under ${relative(repoRoot, bundleDir) || bundleDir}.\n` +
      '  Run `yarn build` first. Refusing to report success on an unbuilt tree.'
  );
  process.exit(1);
}

const findings = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(DEV_SPECIFIER)) {
    const specifier = match[1];
    // node_modules packages legitimately have `dev` in a path; only our own
    // source tree is the concern.
    if (!/(^|\/)src\/dev\//.test(specifier) && !/^\.{1,2}\/dev\//.test(specifier))
      continue;
    findings.push({ file: relative(repoRoot, file), specifier });
  }
}

if (findings.length > 0) {
  console.error(
    '\n[check-bundle-dev-imports] FAIL — the production bundle imports dev-only modules.\n'
  );
  for (const { file, specifier } of findings) {
    console.error(`  ${file}\n    imports  ${specifier}`);
  }
  console.error(
    [
      '',
      'These modules are excluded from the output by vite.config.ts, so the',
      'import resolves to nothing at runtime: the browser 404s it, the module',
      'graph fails, and the app renders a blank page.',
      '',
      'A static import cannot be made conditional, and a NODE_ENV gate around',
      'the CALL does not help — externalisation happens before tree-shaking.',
      'Invert the dependency instead: let the dev module register itself with',
      'the production module, so production never names src/dev/ at all. See',
      'src/identity/qnsClaimExemption.ts for the worked example.',
      '',
    ].join('\n')
  );
  process.exit(1);
}

console.log(
  `[check-bundle-dev-imports] OK — ${files.length} bundle file(s) scanned, no dev-module imports.`
);
