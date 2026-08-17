// Orchestrator for the desktop→mobile CONFIG measurement.
//
//   yarn harness:config-cross
//
// Runs the two halves in order, in two repos: desktop publishes a user config
// for a shared throwaway account, then mobile pulls it and asserts what arrived.
//
// Unlike run-cross.mjs (the DM measurement) the halves are SEQUENTIAL, not
// concurrent, and that is a property of what is being measured rather than a
// simplification. DMs need both peers live at once because delivery is the
// thing under test. A config is a row on a server: one client writes it, the
// other reads it later, and they never need to be running at the same time.
//
// ⚠️ quorum-mobile is NOT modified. This drives its existing scenario, the same
// way run-cross.mjs does.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP_REPO = resolve(HERE, '../../../..');
const MOBILE_REPO = resolve(DESKTOP_REPO, '..', 'quorum-mobile');

if (!existsSync(MOBILE_REPO)) {
  console.error(`[config-cross] quorum-mobile not found at ${MOBILE_REPO}`);
  console.error('[config-cross] both repos must be checked out side by side.');
  process.exit(1);
}

const run = (label, cmd, args, cwd) =>
  new Promise((resolveRun) => {
    console.log(`\n[config-cross] ── ${label} ──`);
    const child = spawn(cmd, args, { cwd, shell: true, stdio: 'inherit' });
    child.on('exit', (code) => resolveRun(code ?? 1));
  });

const publish = await run(
  'desktop publishes',
  'yarn',
  ['harness', 'config-cross'],
  DESKTOP_REPO
);

// Stop here rather than running mobile against a row that was never written.
// Mobile would fail on a stale handoff, or worse pass against one, and either
// way the verdict would point at the wrong client.
if (publish !== 0) {
  console.error('\n[config-cross] desktop half failed — not running mobile.');
  console.error('[config-cross] nothing was proved about the other client.');
  process.exit(publish);
}

const read = await run(
  'mobile reads it back',
  'yarn',
  ['harness', 'config-cross'],
  MOBILE_REPO
);

console.log('');
if (read === 0) {
  console.log('[config-cross] desktop → mobile: config crossed clients intact.');
} else {
  console.error('[config-cross] desktop → mobile: FAILED. See the mobile half above.');
}
process.exit(read);
