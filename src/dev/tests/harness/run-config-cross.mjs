// Orchestrator for the cross-client CONFIG measurement, BOTH directions.
//
//   yarn harness:config-cross                    both directions
//   yarn harness:config-cross --only=to-mobile   desktop publishes, mobile reads
//   yarn harness:config-cross --only=to-desktop  mobile publishes, desktop reads
//
// Each direction is publish-then-read for the same throwaway account: one
// client writes the row, the other pulls it and asserts against a handoff file
// describing what was actually sent.
//
// ─── Why both directions, and not just one ──────────────────────────────────
//
// The two `ConfigService` implementations are independent code sharing only a
// type. Encryption, signing and field ordering are written twice, so "desktop's
// blob decrypts on mobile" is not evidence about the reverse. The known
// merge-asymmetry issue exists because the two drifted apart, which is exactly
// the class of fault a one-directional check cannot see.
//
// ─── Why the halves are SEQUENTIAL, unlike run-cross.mjs ────────────────────
//
// The DM measurement needs both peers live at once because delivery is the
// thing under test. A config is a row on a server: one client writes it, the
// other reads it later, and they never need to be running at the same time.
//
// ⚠️ quorum-mobile is NOT modified. This drives its existing scenarios, the
// same way run-cross.mjs does.
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

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length) : null;
if (only && only !== 'to-mobile' && only !== 'to-desktop') {
  console.error(`[config-cross] unknown --only=${only}; expected to-mobile or to-desktop.`);
  process.exit(1);
}

const run = (label, cmd, args, cwd) =>
  new Promise((resolveRun) => {
    console.log(`\n[config-cross] ── ${label} ──`);
    const child = spawn(cmd, args, { cwd, shell: true, stdio: 'inherit' });
    child.on('exit', (code) => resolveRun(code ?? 1));
  });

/**
 * One direction: the publisher runs, and the reader only runs if it succeeded.
 *
 * Stopping between the halves matters. Running the reader against a row that
 * was never written makes it fail on a missing or stale handoff, or worse pass
 * against an old one — and either way the verdict points at the wrong client.
 */
async function direction({ name, publish, read }) {
  const published = await run(publish.label, publish.cmd, publish.args, publish.cwd);
  if (published !== 0) {
    console.error(`\n[config-cross] ${name}: the publishing half failed — not running the reader.`);
    console.error('[config-cross] nothing was proved about the other client.');
    return published;
  }

  const adopted = await run(read.label, read.cmd, read.args, read.cwd);
  console.log('');
  if (adopted === 0) {
    console.log(`[config-cross] ${name}: config crossed clients intact.`);
  } else {
    console.error(`[config-cross] ${name}: FAILED. See the reading half above.`);
  }
  return adopted;
}

const DIRECTIONS = {
  'to-mobile': {
    name: 'desktop → mobile',
    publish: {
      label: 'desktop publishes',
      cmd: 'yarn',
      args: ['harness', 'config-cross'],
      cwd: DESKTOP_REPO,
    },
    read: {
      label: 'mobile reads it back',
      cmd: 'yarn',
      args: ['harness', 'config-cross'],
      cwd: MOBILE_REPO,
    },
  },
  'to-desktop': {
    name: 'mobile → desktop',
    publish: {
      label: 'mobile publishes',
      cmd: 'yarn',
      args: ['harness:config-to-desktop'],
      cwd: MOBILE_REPO,
    },
    read: {
      label: 'desktop reads it back',
      cmd: 'yarn',
      args: ['harness', 'config-from-mobile'],
      cwd: DESKTOP_REPO,
    },
  },
};

// Both directions write the SAME account's row, so they must not overlap.
// Running them in sequence is what keeps each reader looking at the row its own
// publisher just wrote, rather than at whichever direction finished last.
const order = only ? [only] : ['to-mobile', 'to-desktop'];
const results = [];

for (const key of order) {
  const code = await direction(DIRECTIONS[key]);
  results.push({ name: DIRECTIONS[key].name, code });
  // Carry on to the other direction even after a failure. Knowing whether ONE
  // direction is broken or BOTH are is most of the diagnosis, and the second
  // run costs seconds.
}

console.log('\n[config-cross] ── summary ──');
for (const { name, code } of results) {
  console.log(`  ${code === 0 ? 'ok  ' : 'FAIL'} ${name}`);
}

process.exit(results.some((r) => r.code !== 0) ? 1 : 0);
