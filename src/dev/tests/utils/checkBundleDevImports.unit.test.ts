import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Fixture tests for `scripts/check-bundle-dev-imports.mjs`.
 *
 * The script guards against a bug that ALREADY SHIPPED: a production bundle
 * carrying `import"../src/dev/fake-qns/fakeQnsCore"` for a file the build had
 * excluded, which 404'd and left the app a blank page. It only runs during
 * `yarn build`, so without these it has no regression protection beyond
 * someone reproducing the original outage.
 *
 * Each case writes a synthetic bundle and runs the real script against it.
 */

const SCRIPT = 'scripts/check-bundle-dev-imports.mjs';

let dir: string;

const runGuard = (): { code: number; output: string } => {
  try {
    const output = execFileSync('node', [SCRIPT, dir], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, output };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
};

const bundle = (contents: string, name = 'index-abc123.js') =>
  writeFileSync(join(dir, name), contents, 'utf8');

describe('check-bundle-dev-imports', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bundle-guard-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('catches the exact import that shipped the blank page', () => {
    bundle('import"../src/dev/fake-qns/fakeQnsCore";const a=1;');
    const { code, output } = runGuard();
    expect(code).toBe(1);
    expect(output).toContain('fakeQnsCore');
  });

  it('catches a named import from a dev module', () => {
    bundle('import{x}from"../src/dev/thing";');
    expect(runGuard().code).toBe(1);
  });

  it('catches a re-export from a dev module', () => {
    bundle('export{y}from"./dev/other";');
    expect(runGuard().code).toBe(1);
  });

  it('catches a dynamic import of a dev module', () => {
    bundle('const p=import("../../src/dev/lazy");');
    expect(runGuard().code).toBe(1);
  });

  it('CONTROL: does not fire on a clean bundle', () => {
    // Without this arm every assertion above could pass because the script
    // fails on everything.
    bundle('import{a}from"./chunk-x.js";const b=2;');
    const { code, output } = runGuard();
    expect(code).toBe(0);
    expect(output).toContain('OK');
  });

  it('CONTROL: does not false-positive on a node_modules path containing /dev/', () => {
    bundle('import{c}from"./node_modules/some-dev-tool/dev/index.js";');
    expect(runGuard().code).toBe(0);
  });

  it('refuses to report success when it scanned nothing', () => {
    // An unbuilt or misconfigured tree must not read as a green tick — that
    // turns the guard into a rubber stamp precisely when it matters.
    const { code, output } = runGuard();
    expect(code).toBe(1);
    expect(output).toContain('Refusing to report success');
  });

  it('scans nested chunk directories, not just the top level', () => {
    mkdirSync(join(dir, 'assets'));
    bundle('const ok=1;');
    writeFileSync(
      join(dir, 'assets', 'chunk-deep.js'),
      'import"../src/dev/buried";',
      'utf8'
    );
    expect(runGuard().code).toBe(1);
  });
});
