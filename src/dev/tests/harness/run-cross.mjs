// Orchestrator for the mobile↔desktop DM measurement.
//
//   yarn harness:cross
//
// Starts TWO processes in TWO repos — mobile's existing `dm-two-bot` jest
// scenario as one role, desktop's `dm-cross` vitest scenario as the other —
// pairs them through a shared run directory, then matches each side's sends
// against the other's arrivals.
//
// The loss verdict lives here rather than in either scenario because neither bot
// can compute it alone: each knows only what it sent and what it received.
//
// ⚠️ quorum-mobile is NOT modified. This drives its existing scenario by env
// var, exactly as its own `run-two-bots.mjs` does.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMobileRepo } from './mobileRepo.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP_REPO = resolve(HERE, '../../../..');
// Via the helper, NOT as a sibling of this checkout: that guess is wrong from
// a linked worktree. See mobileRepo.mjs.
const MOBILE_REPO = resolveMobileRepo(DESKTOP_REPO);
// Must match BOTH rendezvous.ts files. Mobile owns the layout because its
// orchestrator defined it first; desktop's rendezvous.ts points here too.
const RENDEZVOUS_ROOT = resolve(MOBILE_REPO, 'dev/harness/.state/rendezvous');

// Which platform initiates. Role 'a' initiates and 'b' echoes (see either
// scenario for why one-initiator matters), so this decides whether we measure
// mobile→desktop first or the reverse. Default puts MOBILE as the initiator,
// because mobile→desktop is the field's reported bad direction.
const DESKTOP_ROLE = process.env.HARNESS_DESKTOP_ROLE === 'a' ? 'a' : 'b';
const MOBILE_ROLE = DESKTOP_ROLE === 'a' ? 'b' : 'a';

if (!existsSync(MOBILE_REPO)) {
  console.error(
    `[cross] FAIL — quorum-mobile not found at ${MOBILE_REPO}.\n` +
      `        The two repos must be siblings, or set HARNESS_MOBILE_REPO.`
  );
  process.exit(1);
}

const runId = `run-${Date.now()}`;

// Pruned here, not in a scenario: a scenario cannot know whether a sibling
// directory belongs to a live peer or a dead one.
if (existsSync(RENDEZVOUS_ROOT)) {
  for (const entry of readdirSync(RENDEZVOUS_ROOT)) {
    if (entry !== runId) rmSync(resolve(RENDEZVOUS_ROOT, entry), { recursive: true, force: true });
  }
}

// Both sides derive `endAt` from these independently, so they MUST be identical
// on both children. Set once here; the children inherit.
const shared = {
  HARNESS_RUN_ID: runId,
  HARNESS_ROUNDS: process.env.HARNESS_ROUNDS ?? '20',
  HARNESS_SEND_INTERVAL_MS: process.env.HARNESS_SEND_INTERVAL_MS ?? '1500',
  HARNESS_SETTLE_MS: process.env.HARNESS_SETTLE_MS ?? '20000',
  HARNESS_RENDEZVOUS_ROOT: RENDEZVOUS_ROOT,
};

function start(label, cwd, command, args, role) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...shared, HARNESS_ROLE: role },
    shell: true,
  });
  // Both children share a terminal, so tag every line. Without this an
  // interleaved failure is very hard to attribute to a side — and here the two
  // sides are different test runners in different repos.
  const tag = (stream) => {
    let buffered = '';
    stream.on('data', (chunk) => {
      buffered += chunk.toString();
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';
      for (const line of lines) console.log(`[${label}] ${line}`);
    });
  };
  tag(child.stdout);
  tag(child.stderr);
  return new Promise((res) => child.on('close', (code) => res({ label, role, code })));
}

console.log(
  `[cross] run ${runId} — mobile=role ${MOBILE_ROLE}, desktop=role ${DESKTOP_ROLE} ` +
    `(role 'a' initiates, 'b' echoes)`
);
console.log(`[cross] rounds=${shared.HARNESS_ROUNDS} rendezvous=${RENDEZVOUS_ROOT}`);

const outcomes = await Promise.all([
  start('mobile', MOBILE_REPO, 'npx', ['jest', '--config', 'jest.harness.config.js', 'dm-two-bot'], MOBILE_ROLE),
  start('desktop', DESKTOP_REPO, 'npx', ['vitest', '--run', '--config', 'vitest.harness.config.ts', 'dm-cross'], DESKTOP_ROLE),
]);

for (const { label, code } of outcomes) {
  if (code !== 0) console.log(`[cross] ${label} exited ${code}`);
}

const readResult = (role) => {
  const p = resolve(RENDEZVOUS_ROOT, runId, `${role}.result.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
};

const a = readResult('a');
const b = readResult('b');

if (!a || !b) {
  console.error(
    `[cross] FAIL — missing results (a=${!!a} b=${!!b}). A side crashed before ` +
      `publishing; read that side's tagged output above. No loss figure is ` +
      `reported, because a partial run cannot produce an honest one.`
  );
  process.exit(1);
}

// Delivered = the RECEIVER recorded the number. The receiver's set is deduped,
// so relay redelivery cannot inflate it.
function direction(from, to, label) {
  const sent = from.sent.length;
  const got = to.received.filter((n) => from.sent.includes(n)).length;
  const missing = from.sent.filter((n) => !to.received.includes(n));
  const pct = sent === 0 ? 0 : ((sent - got) / sent) * 100;
  console.log(
    `[cross] ${label}: sent=${sent} arrived=${got} loss=${pct.toFixed(1)}%` +
      (missing.length ? `  missing=[${missing.join(',')}]` : '')
  );
  return { sent, missing };
}

const platformOf = (role) => (role === MOBILE_ROLE ? 'mobile' : 'desktop');

console.log('');
console.log(`[cross] run ${runId}`);
const ab = direction(a, b, `${platformOf('a')}→${platformOf('b')}`);
const ba = direction(b, a, `${platformOf('b')}→${platformOf('a')}`);

const lost = ab.missing.length + ba.missing.length;
const total = ab.sent + ba.sent;
console.log(`[cross] total: ${total - lost}/${total} delivered`);

if (total === 0) {
  console.error('[cross] FAIL — nothing was sent; this measured nothing.');
  process.exit(1);
}
if (lost > 0) {
  console.error(`[cross] LOSS DETECTED — ${lost}/${total} messages did not arrive.`);
  process.exit(1);
}
console.log('[cross] no loss.');
