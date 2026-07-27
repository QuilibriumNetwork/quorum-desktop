// ============================================================================
// Does the MEASURED position-dependent DM decrypt failure reproduce OFFLINE?
//
// THE LIVE MEASUREMENT this script tries to reproduce (desktop<->desktop,
// rig=9, archive findings T/U/V):
//
//     position in sending chain:   0       1       2      3+
//     A->B first-attempt failure:  100%    86%     67%    0%
//     B->A first-attempt failure:  100%    100%    60%    0%
//
//   ...and the failures are TRANSIENT — nearly all decrypt on redelivery.
//
// ANSWER (2026-07-27): NO. It does not reproduce. Six delivery regimes, 1920
// frames across 20 independent runs: ZERO first-attempt failures at every
// position.
//
// ⚠ AND THE REASON IS NOW KNOWN — finding AE, same day, via dr-ablate.mjs: the
// failure needs a `skipped_keys_map` bucket under the receiver's CURRENT
// receiving header key, which only accumulates in an AGED session. Every session
// this script builds is FRESH, so it tests precisely the condition under which
// the bug is known NOT to fire. The negative result is therefore CORROBORATION
// of finding AC (a fresh session does not fail) from an independent synthetic
// direction — not a puzzle.
//
// ⛔ DO NOT quote this as "the crate is clean". That is not what it measures.
//
// THE EXPERIMENT THIS SCRIPT IS NOW POSITIONED TO RUN — archive §2i names it as
// the open test: synthetically AGE a session (drive it forward until the
// skipped-keys map grows) and see whether failure rate tracks `skipped`
// INDEPENDENTLY of elapsed time and epoch count. Captured evidence cannot
// separate those confounds, because failures also create skipped keys. A
// synthetic harness can, because it controls both. UNBUILT — see §2i.
//
// ONE POSITIVE FINDING, in a scenario that cannot occur in the app: if the
// RESPONDER sends before it has ever received anything, its whole first burst
// is permanently undecryptable — never recovers on any number of redeliveries.
// That is fork-shaped, and adjacent to issue #183 item 1. The app cannot reach
// this state (a responder learns the conversation exists by receiving), so it
// is filed as a curiosity, not a cause. See scenario X below.
//
// Run:  node .agents/tools/dm-debug/dr-position-table.mjs
// Needs the SDK repo as a sibling checkout; override with SDK_DIR=...
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

// .agents/tools/dm-debug -> repo -> the sibling SDK checkout, same as dr-ablate.
const SDK_DIR =
  process.env.SDK_DIR ??
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../../quilibrium-js-sdk-channels');
const ch = await import(pathToFileURL(resolve(SDK_DIR, 'src/channel/channelwasm.js')).href);
ch.initSync(readFileSync(resolve(SDK_DIR, 'src/wasm/channelwasm_bg.wasm')));

const b64 = (s) => Buffer.from(s, 'base64');
const bytes = (b) => [...new Uint8Array(b)];
const sk = (v) => (typeof v === 'string' ? bytes(b64(v)) : v);

function newPair() {
  const aIdent = JSON.parse(ch.js_generate_x448());
  const aEph = JSON.parse(ch.js_generate_x448());
  const bIdent = JSON.parse(ch.js_generate_x448());
  const bPre = JSON.parse(ch.js_generate_x448());
  const A = sk(JSON.parse(ch.js_sender_x3dh(JSON.stringify({
    sending_identity_private_key: aIdent.private_key,
    sending_ephemeral_private_key: aEph.private_key,
    receiving_identity_key: bIdent.public_key,
    receiving_signed_pre_key: bPre.public_key, session_key_length: 96,
  }))));
  const B = sk(JSON.parse(ch.js_receiver_x3dh(JSON.stringify({
    sending_identity_private_key: bIdent.private_key,
    sending_signed_private_key: bPre.private_key,
    receiving_identity_key: aIdent.public_key,
    receiving_ephemeral_key: aEph.public_key, session_key_length: 96,
  }))));
  return {
    alice: ch.js_new_double_ratchet(JSON.stringify({
      session_key: A.slice(0, 32), sending_header_key: A.slice(32, 64),
      next_receiving_header_key: A.slice(64, 96), is_sender: true,
      sending_ephemeral_private_key: aEph.private_key, receiving_ephemeral_key: bPre.public_key,
    })),
    bob: ch.js_new_double_ratchet(JSON.stringify({
      session_key: B.slice(0, 32), sending_header_key: B.slice(32, 64),
      next_receiving_header_key: B.slice(64, 96), is_sender: false,
      sending_ephemeral_private_key: bPre.private_key, receiving_ephemeral_key: aEph.public_key,
    })),
  };
}

// `current_sending_chain_length` BEFORE encrypt == the position this frame takes.
// ⚠ Always pair position with the epoch (root_key) — sLen resets to 0 on every
// DH step, so on its own it proves nothing (bug doc §3 row 7).
const posOf = (s) => JSON.parse(s).current_sending_chain_length;
const epochOf = (s) => String(JSON.parse(s).root_key).slice(0, 6);

const enc = (state, text) => {
  const pos = posOf(state), epoch = epochOf(state);
  const r = JSON.parse(ch.js_double_ratchet_encrypt(JSON.stringify({
    ratchet_state: state, message: bytes(Buffer.from(text, 'utf-8')),
  })));
  return [r.ratchet_state, { env: r.envelope, pos, epoch, text }];
};

// Signal spec: on failure the state mutation is DISCARDED. Mirrors the app
// since PR #235 — never persist a failed decrypt's state.
const dec = (state, envelope) => {
  try {
    const r = JSON.parse(ch.js_double_ratchet_decrypt(JSON.stringify({
      ratchet_state: state, envelope,
    })));
    const msg = Buffer.from(new Uint8Array(r.message)).toString('utf-8');
    if (msg.startsWith('Decryption failed') || msg.includes('aead')) return [state, false];
    return [r.ratchet_state, true];
  } catch { return [state, false]; }
};

// ---------------------------------------------------------------------------
// crossing        — both sides encrypt before either decrypts (real concurrency)
// burst           — frames per turn (a live post drags typing + delivery + read acks)
// reorder         — shuffle delivery order within a turn
// responderOpens  — let the RESPONDER send at round 1 before receiving anything.
//                   IMPOSSIBLE in the app; included only to document scenario X.
// ---------------------------------------------------------------------------
function run({ rounds = 12, burst = 1, crossing = false, reorder = false, responderOpens = false }) {
  let { alice, bob } = newPair();
  const log = [];
  const pending = { A: [], B: [] };
  let recovered = 0;

  const mk = (state, dir, r) => {
    const kinds = ['post', 'typing-start', 'delivery-ack', 'read-ack'];
    const out = [];
    for (let i = 0; i < burst; i++) {
      let f; [state, f] = enc(state, `${dir}-r${r}-${kinds[i % 4]}`);
      f.dir = dir; out.push(f);
    }
    return [state, out];
  };
  const deliver = (state, frames, dir) => {
    const failed = [];
    for (const f of (reorder ? [...frames].reverse() : frames)) {
      let ok; [state, ok] = dec(state, f.env);
      f.firstOk = ok; log.push(f);
      if (!ok) failed.push(f);
    }
    pending[dir].push(...failed);
    return state;
  };
  const retry = (state, dir) => {
    const still = [];
    for (const f of pending[dir]) {
      let ok; [state, ok] = dec(state, f.env);
      if (ok) { recovered++; f.recovered = true; } else still.push(f);
    }
    pending[dir] = still;
    return state;
  };

  for (let r = 1; r <= rounds; r++) {
    // A responder cannot open a conversation. Round 1 is initiator-only unless
    // we are deliberately testing scenario X.
    const cross = crossing && (responderOpens || r > 1);
    let aF, bF;
    if (cross) {
      [alice, aF] = mk(alice, 'A', r);
      [bob, bF] = mk(bob, 'B', r);
      bob = deliver(bob, aF, 'A');
      alice = deliver(alice, bF, 'B');
    } else {
      [alice, aF] = mk(alice, 'A', r);
      bob = deliver(bob, aF, 'A');
      [bob, bF] = mk(bob, 'B', r);
      alice = deliver(alice, bF, 'B');
    }
    bob = retry(bob, 'A'); alice = retry(alice, 'B');
  }
  for (let i = 0; i < 8; i++) { bob = retry(bob, 'A'); alice = retry(alice, 'B'); }

  return { log, recovered, dead: pending.A.length + pending.B.length };
}

function table(log, dir) {
  const b = new Map();
  for (const f of log.filter((x) => x.dir === dir)) {
    const k = f.pos >= 3 ? '3+' : String(f.pos);
    const c = b.get(k) ?? { ok: 0, fail: 0 };
    f.firstOk ? c.ok++ : c.fail++;
    b.set(k, c);
  }
  return ['0', '1', '2', '3+'].map((k) => {
    const c = b.get(k);
    if (!c) return `${k}: —`.padEnd(14);
    return `${k}: ${Math.round((c.fail / (c.ok + c.fail)) * 100)}% (${c.fail}/${c.ok + c.fail})`.padEnd(14);
  }).join('');
}

console.log('First-attempt AEAD failure rate by position in the sender\'s DH chain.');
console.log('This is the same quantity the live rig measured.\n');
console.log('  LIVE TARGET   A->B   0: 100%   1: 86%    2: 67%   3+: 0%');
console.log('                B->A   0: 100%   1: 100%   2: 60%   3+: 0%');
console.log('='.repeat(74));

for (const [name, cfg] of [
  ['S1  strict alternation, 1 frame/turn', { burst: 1 }],
  ['S2  strict alternation, 4-frame burst', { burst: 4 }],
  ['S3  crossing sends, 1 frame/turn', { burst: 1, crossing: true }],
  ['S4  crossing sends, 4-frame burst', { burst: 4, crossing: true }],
  ['S5  crossing + reordered delivery', { burst: 4, crossing: true, reorder: true }],
  ['S6  strict alternation + reordered', { burst: 4, reorder: true }],
]) {
  const { log, recovered, dead } = run({ rounds: 12, ...cfg });
  const failed = log.filter((f) => !f.firstOk).length;
  console.log(`\n${name}`);
  console.log(`  A->B  ${table(log, 'A')}`);
  console.log(`  B->A  ${table(log, 'B')}`);
  console.log(`  ${log.length} frames, ${failed} first-attempt failures` +
    (failed ? `, ${recovered} recovered, ${dead} permanently dead` : ''));
}

console.log('\n' + '='.repeat(74));
console.log('REPEATABILITY — 20 independent runs of the most realistic regime (S4)');
console.log('='.repeat(74));
let frames = 0, dirty = 0, dead = 0;
for (let i = 0; i < 20; i++) {
  const r = run({ rounds: 12, burst: 4, crossing: true });
  frames += r.log.length;
  if (r.log.some((f) => !f.firstOk)) dirty++;
  dead += r.dead;
}
console.log(`  ${frames} frames  |  runs with any failure: ${dirty}/20  |  permanently dead: ${dead}`);

console.log('\n' + '='.repeat(74));
console.log('SCENARIO X — responder sends before ever receiving (CANNOT happen in the app)');
console.log('='.repeat(74));
const x = run({ rounds: 10, burst: 4, crossing: true, responderOpens: true });
const xf = x.log.filter((f) => !f.firstOk).length;
console.log(`  ${x.log.length} frames, ${xf} first-attempt failures, ` +
  `${x.recovered} recovered, ${x.dead} PERMANENTLY dead`);
console.log('  Note the permanence: unlike the live desktop failures, these never');
console.log('  recover. Fork-shaped, adjacent to issue #183 item 1.');
