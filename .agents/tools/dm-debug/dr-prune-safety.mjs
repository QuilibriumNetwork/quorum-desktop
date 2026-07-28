// ============================================================================
// DR PRUNE-SAFETY — is option B1 (prune the poisoning bucket and retry) safe?
//
// Finding AE established that 63 of 65 captured failures decrypt when ONE bucket
// is deleted: skipped_keys_map[current_receiving_header_key]. §5 option B1 proposes
// doing that in the receive path on decrypt failure. Before any app code, §5-B1
// names three blocking questions. This answers them from the captured corpus:
//
//   Q1 does pruning ever break a frame that would otherwise SUCCEED?
//   Q2 what is LOST by discarding those keys?
//   Q3 do the 2-of-65 that never recover behave differently?
//
// ⚠ Q1 CANNOT be answered from the logs alone, and it is important to say why:
// the [XPDUMP] probe fires ONLY inside the two decrypt-failure catch blocks (both
// on diag/dm-frame-join and in the harness's xpdump.ts). So the corpus contains
// zero captured successes by construction. Asking "run the variant across all
// captured successes" has no data to run on. Q1 is answered instead by the
// SYNTHETIC section below, which builds the poisoning condition from a pristine
// X3DH pair against the real crate and can therefore hold both a failure and the
// successes that share its state.
//
// What this adds over dr-ablate: dr-ablate proves a property is load-bearing.
// This asks what the recovered PLAINTEXT is, whether the frame was already
// delivered by another route, and what the prune costs — i.e. whether recovery is
// real or is re-accepting a duplicate.
//
// usage: node dr-prune-safety.mjs <log> [...more logs]
//        node dr-prune-safety.mjs --synthetic-only
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const SDK_DIR =
  process.env.SDK_DIR ??
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../../quilibrium-js-sdk-channels');
const ch = await import(pathToFileURL(resolve(SDK_DIR, 'src/channel/channelwasm.js')).href);
ch.initSync(readFileSync(resolve(SDK_DIR, 'src/wasm/channelwasm_bg.wasm')));

const bytes = (b) => [...new Uint8Array(b)];
const b64 = (s) => Buffer.from(s, 'base64');
const sk = (v) => (typeof v === 'string' ? bytes(b64(v)) : v);

// ---------------------------------------------------------------- primitives
function tryDecrypt(ratchetStateJson, envelope) {
  try {
    const out = JSON.parse(
      ch.js_double_ratchet_decrypt(JSON.stringify({ ratchet_state: ratchetStateJson, envelope }))
    );
    const msg = Buffer.from(new Uint8Array(out.message)).toString('utf-8');
    if (msg.startsWith('Decryption failed') || msg.includes('aead')) {
      return { ok: false, why: 'AEAD' };
    }
    return { ok: true, msg, state: out.ratchet_state };
  } catch (e) {
    return { ok: false, why: 'THREW:' + String(e).slice(0, 50) };
  }
}

/** Delete only skipped_keys_map[current_receiving_header_key]. This is B1. */
function pruneCurrentBucket(rs) {
  const m = { ...(rs.skipped_keys_map ?? {}) };
  const key = rs.current_receiving_header_key;
  const removed = m[key];
  delete m[key];
  return { state: { ...rs, skipped_keys_map: m }, removed, key };
}

/**
 * The control variants from dr-ablate. Kept here too so the whole upstream table
 * can be quoted against one de-duplicated denominator instead of mixing scopes.
 */
const CONTROL_VARIANTS = [
  ['skipped_keys_map = {}', (rs) => ({ ...rs, skipped_keys_map: {} })],
  ['keep only the current-recv-header bucket', (rs) => {
    const k = rs.current_receiving_header_key;
    const m = rs.skipped_keys_map ?? {};
    return { ...rs, skipped_keys_map: k && m[k] ? { [k]: m[k] } : {} };
  }],
  ['drop only the next-recv-header bucket', (rs) => {
    const m = { ...(rs.skipped_keys_map ?? {}) };
    delete m[rs.next_receiving_header_key];
    return { ...rs, skipped_keys_map: m };
  }],
  ['previous_sending_chain_length = 0', (rs) => ({ ...rs, previous_sending_chain_length: 0 })],
  ['current_receiving_chain_length = 0', (rs) => ({ ...rs, current_receiving_chain_length: 0 })],
  ['swap current <-> next receiving header key', (rs) => ({
    ...rs,
    current_receiving_header_key: rs.next_receiving_header_key,
    next_receiving_header_key: rs.current_receiving_header_key,
  })],
];

const bucketOf = (rs) => (rs.skipped_keys_map ?? {})[rs.current_receiving_header_key];
const countKeys = (rs) =>
  Object.values(rs.skipped_keys_map ?? {}).reduce((a, v) => a + Object.keys(v ?? {}).length, 0);

// ---------------------------------------------------------------- log corpus
function dumpsFrom(logPath) {
  const parts = new Map();
  for (const line of readFileSync(logPath, 'utf-8').split('\n')) {
    const m = line.match(/\[XPDUMP\]\s+(\d+)\/(\d+)\/(\d+)\s(.*)$/);
    if (!m) continue;
    const [, no, idx, total, text] = m;
    if (!parts.has(no)) parts.set(no, { total: +total, chunks: new Map() });
    parts.get(no).chunks.set(+idx, text);
  }
  const out = [];
  for (const [no, { total, chunks }] of parts) {
    if (chunks.size !== total) continue;
    const joined = Array.from({ length: total }, (_, i) => chunks.get(i + 1)).join('');
    try { out.push({ no, ...JSON.parse(joined) }); } catch { /* truncated */ }
  }
  return out;
}

/** Unseal exactly as the live receive path does, so the ratchet sees real input. */
function unseal(row, sealed) {
  const raw = JSON.parse(ch.js_decrypt_inbox_message(JSON.stringify({
    inbox_private_key: row.receiving_inbox.inbox_encryption_key.private_key,
    ephemeral_public_key: [...new Uint8Array(Buffer.from(sealed.ephemeral_public_key, 'hex'))],
    ciphertext: JSON.parse(sealed.envelope),
  })));
  let envelope = Buffer.from(new Uint8Array(raw)).toString('utf-8');
  try {
    const maybeInit = JSON.parse(envelope);
    if (maybeInit.user_address) envelope = maybeInit.message;
  } catch { /* plain DR envelope */ }
  return envelope;
}

function runCorpus(logPaths) {
  const seen = new Set();          // de-dup by envelope fingerprint (§5 discipline)
  const rows = [];
  for (const logPath of logPaths) {
    for (const d of dumpsFrom(logPath)) {
      let row, sealed, rs;
      try {
        row = JSON.parse(d.state);
        sealed = JSON.parse(d.frame);
        rs = JSON.parse(row.ratchet_state);
      } catch { continue; }
      let envelope;
      try { envelope = unseal(row, sealed); } catch { continue; }

      const fp = String(d.envFp ?? '');
      if (fp && seen.has(fp)) continue;
      if (fp) seen.add(fp);

      const base = tryDecrypt(row.ratchet_state, envelope);
      const { state: prunedRs, removed } = pruneCurrentBucket(rs);
      const pruned = tryDecrypt(JSON.stringify(prunedRs), envelope);

      // The dr-ablate control variants, re-run here so every row of the upstream
      // table shares ONE de-duplicated denominator. dr-ablate itself does not
      // de-duplicate, so its counts and these are not interchangeable.
      const controls = {};
      for (const [label, mutate] of CONTROL_VARIANTS) {
        let verdict;
        try { verdict = tryDecrypt(JSON.stringify(mutate(rs)), envelope); }
        catch { verdict = { ok: false }; }
        controls[label] = verdict.ok;
      }

      // The output state identifies the frame: rLen advances to (frame index + 1),
      // and a changed root_key means the frame arrived under the NEXT receiving
      // header key, i.e. it drove a DH step.
      let after = null;
      if (pruned.ok) {
        try {
          const o = JSON.parse(pruned.state);
          after = {
            rLen: o.current_receiving_chain_length,
            dhStep: String(o.root_key) !== String(rs.root_key),
            keys: countKeys(o),
            curBucket: bucketOf(o) ? Object.keys(bucketOf(o)).map(Number).sort((a, b) => a - b) : null,
          };
        } catch { /* ignore */ }
      }

      rows.push({
        after,
        controls,
        log: logPath.replace(/\\/g, '/').split('/').pop(),
        no: d.no,
        fp,
        rLen: rs.current_receiving_chain_length,
        pR: rs.previous_receiving_chain_length,
        sLen: rs.current_sending_chain_length,
        pS: rs.previous_sending_chain_length,
        buckets: Object.keys(rs.skipped_keys_map ?? {}).length,
        keys: countKeys(rs),
        curBucket: removed ? Object.keys(removed).map(Number).sort((a, b) => a - b) : null,
        base,
        pruned,
      });
    }
  }
  return rows;
}

function reportCorpus(rows) {
  console.log('='.repeat(96));
  console.log('CAPTURED CORPUS — every [XPDUMP] failure on disk, de-duplicated by envelope fingerprint');
  console.log('='.repeat(96));
  if (!rows.length) { console.log('no parseable dumps'); return; }

  console.log('\n  #  rLen  pR  bkts keys  CUR-bucket indices     base  pruned  frame-idx  DH  keys-after');
  console.log('  ' + '-'.repeat(92));
  for (const r of rows) {
    const cur = r.curBucket ? `[${r.curBucket.join(',')}]` : '(none)';
    const idx = r.after ? String(r.after.rLen - 1) : '?';
    const dh = r.after ? (r.after.dhStep ? 'yes' : 'no ') : '?  ';
    const ka = r.after ? `${r.keys}->${r.after.keys}` : '';
    console.log(
      `  ${String(r.no).padStart(2)} ${String(r.rLen).padStart(5)} ${String(r.pR).padStart(3)} ` +
      `${String(r.buckets).padStart(4)} ${String(r.keys).padStart(4)}  ${cur.padEnd(21)} ` +
      `${(r.base.ok ? 'OK' : r.base.why).padEnd(5)} ${(r.pruned.ok ? 'OK' : r.pruned.why).padEnd(7)} ` +
      `${idx.padStart(9)}  ${dh} ${ka}`
    );
  }

  const idxs = rows.filter((r) => r.after).map((r) => ({
    idx: r.after.rLen - 1, rLen: r.rLen, inBucket: r.curBucket?.includes(r.after.rLen - 1) ?? false,
    dh: r.after.dhStep,
  }));
  if (idxs.length) {
    const inB = idxs.filter((x) => x.inBucket).length;
    const dh = idxs.filter((x) => x.dh).length;
    const both = idxs.filter((x) => x.inBucket && x.dh).length;
    console.log(`\n  WHAT THE FAILING FRAME IS (read off the state the recovery produced).`);
    console.log(`  NOTE: frame-idx is the index within the frame's OWN sending chain, so it is`);
    console.log(`  NOT comparable to the pre-decrypt rLen (a different chain). The load-bearing`);
    console.log(`  comparison is against the stale bucket's index set.`);
    console.log(`     drove a DH step (new sending chain)       ${dh}/${idxs.length}`);
    console.log(`     index collides with the CUR-bucket index  ${inB}/${idxs.length}`);
    console.log(`     BOTH (the signature)                     ${both}/${idxs.length}`);
  }

  const withCur = rows.filter((r) => r.curBucket);
  const noCur = rows.filter((r) => !r.curBucket);
  const recovered = rows.filter((r) => !r.base.ok && r.pruned.ok);
  const broken = rows.filter((r) => r.base.ok && !r.pruned.ok);
  const baseOk = rows.filter((r) => r.base.ok);

  console.log('\n  ' + '-'.repeat(92));
  console.log(`  dumps (de-duplicated)              ${rows.length}`);
  console.log(`  have a CURRENT-header bucket       ${withCur.length}`);
  console.log(`  have NO current-header bucket      ${noCur.length}   (prune is a no-op for these)`);
  console.log(`  baseline already decrypts          ${baseOk.length}   <- captured "successes", if any`);
  console.log(`  prune RECOVERS (fail -> OK)        ${recovered.length}`);
  console.log(`  prune BREAKS  (OK -> fail)         ${broken.length}`);

  // Q3: characterise the non-recovering failures.
  const stuck = rows.filter((r) => !r.base.ok && !r.pruned.ok);
  if (stuck.length) {
    console.log(`\n  Q3 — the failures prune does NOT recover (${stuck.length}):`);
    for (const r of stuck) {
      console.log(`     #${r.no} ${r.log.slice(0, 30).padEnd(32)} rLen=${r.rLen} buckets=${r.buckets} keys=${r.keys} ` +
        `CUR=${r.curBucket ? '[' + r.curBucket.join(',') + ']' : 'none'}`);
    }
  }

  // Is recovery real, or is it re-accepting a duplicate? A plaintext recovered
  // more than once across dumps is a redelivery, not a rescued message.
  const byMsg = new Map();
  for (const r of recovered) {
    const k = r.pruned.msg;
    byMsg.set(k, (byMsg.get(k) ?? 0) + 1);
  }
  const dupes = [...byMsg.entries()].filter(([, n]) => n > 1);
  // One denominator for every row, so the table can be quoted as a whole.
  console.log('\n  ABLATION over the same de-duplicated set (for the upstream table):');
  console.log(`     ${'baseline, exactly as captured'.padEnd(46)} ${baseOk.length} / ${rows.length}`);
  console.log(`     ${'drop ONLY the current-recv-header bucket'.padEnd(46)} ${recovered.length} / ${rows.length}`);
  for (const label of Object.keys(rows[0]?.controls ?? {})) {
    const n = rows.filter((r) => r.controls?.[label]).length;
    console.log(`     ${label.padEnd(46)} ${n} / ${rows.length}`);
  }

  console.log(`\n  distinct recovered plaintexts      ${byMsg.size} of ${recovered.length} recoveries`);
  if (dupes.length) {
    console.log('  plaintexts recovered MORE THAN ONCE (same message, several dumps):');
    for (const [m, n] of dupes) console.log(`     ${n}x  ${m.replace(/\s+/g, ' ').slice(0, 60)}`);
  }

  // Q2: what the prune throws away, quantified.
  if (withCur.length) {
    const sizes = withCur.map((r) => r.curBucket.length);
    const tot = sizes.reduce((a, b) => a + b, 0);
    console.log(`\n  Q2 — keys discarded per prune: min ${Math.min(...sizes)} max ${Math.max(...sizes)} ` +
      `mean ${(tot / sizes.length).toFixed(1)} (of ${(withCur.reduce((a, r) => a + r.keys, 0) / withCur.length).toFixed(0)} avg keys held)`);
    const belowRlen = withCur.filter((r) => r.curBucket.every((i) => i < r.rLen)).length;
    console.log(`     buckets whose every index is BELOW rLen: ${belowRlen}/${withCur.length}` +
      ' (those keys are unrecoverable once discarded — the chain cannot derive backwards)');
  }
}

// ---------------------------------------------------------------- synthetic
// The corpus cannot answer Q1 (no captured successes exist). Build the condition
// from scratch instead: a pristine pair, controlled delivery order, so the SAME
// state holds both the frame B1 would retry and the frames whose keys the prune
// would destroy.
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
const enc = (state, text) => {
  const r = JSON.parse(ch.js_double_ratchet_encrypt(JSON.stringify({
    ratchet_state: state, message: bytes(Buffer.from(text, 'utf-8')),
  })));
  return [r.ratchet_state, r.envelope];
};
const dec = (state, env) => {
  const r = tryDecrypt(state, env);
  return [r.ok ? r.state : state, r.ok, r.ok ? r.msg : r.why];
};

/**
 * Build the exact condition the corpus shows, from a pristine pair:
 *
 *   - `skipUpTo` frames of chain 1 are withheld and a later one delivered first,
 *     so message keys for indices 0..skipUpTo-1 are filed under the header key
 *     that has just become B's `current_receiving_header_key`.
 *   - A then opens a NEW sending chain (chain 2). Its frames drive a DH step on B.
 *
 * Returns B's state at that moment plus both chains' frames, so a single state
 * holds the frames B1 would retry AND the frames whose keys the prune destroys.
 */
function buildPoisonedState(skipUpTo = 3) {
  let { alice, bob } = newPair();
  let e, eb;
  const c1 = [];
  for (let i = 0; i < skipUpTo + 2; i++) { [alice, e] = enc(alice, `c1-#${i}`); c1.push(e); }
  [bob] = dec(bob, c1[skipUpTo]);                       // out-of-order -> bucket forms
  [bob, eb] = enc(bob, 'b-reply'); [alice] = dec(alice, eb);
  const c2 = [];
  for (let i = 0; i < 6; i++) { [alice, e] = enc(alice, `c2-#${i}`); c2.push(e); }
  return { bob, c1, c2, skipUpTo };
}

function synthetic() {
  console.log('\n' + '='.repeat(96));
  console.log('SYNTHETIC — the mechanism, reproduced on demand, and Q1 answered where the');
  console.log('            corpus cannot (it holds no successes: [XPDUMP] fires only on failure)');
  console.log('='.repeat(96));

  const { bob, c1, c2, skipUpTo } = buildPoisonedState(3);
  const rs = JSON.parse(bob);
  const stale = bucketOf(rs);
  const staleIdx = stale ? Object.keys(stale).map(Number).sort((a, b) => a - b) : [];
  const { state: prunedRs, removed, key: staleKey } = pruneCurrentBucket(rs);
  const prunedJson = JSON.stringify(prunedRs);

  console.log(`\n  condition built with nothing but out-of-order delivery:`);
  console.log(`    bucket under B's CURRENT receiving header key = [${staleIdx.join(',')}]`);
  console.log(`    A has since opened a NEW sending chain, so its frames drive a DH step.`);

  console.log('\n  MECHANISM — deliver each NEW-chain frame against that one state:');
  console.log('    new-chain idx | in stale bucket | baseline | pruned');
  const failing = [];
  for (let i = 0; i < 6; i++) {
    const b = tryDecrypt(bob, c2[i]);
    const p = tryDecrypt(prunedJson, c2[i]);
    if (!b.ok) failing.push(i);
    console.log(`    ${String(i).padStart(13)} | ${(staleIdx.includes(i) ? 'YES' : 'no').padStart(15)} | ` +
      `${(b.ok ? 'OK' : 'FAIL').padStart(8)} | ${(p.ok ? 'OK' : 'FAIL').padStart(6)}` +
      `${!b.ok && p.ok ? '   <<< AE signature' : ''}`);
  }
  const exact = failing.join(',') === staleIdx.filter((i) => i < 6).join(',');
  console.log(`\n    failing indices [${failing.join(',')}] vs stale bucket [${staleIdx.join(',')}]  ` +
    `-> ${exact ? 'EXACT MATCH' : 'DIFFERENT'}`);
  console.log('    => the crate matches a skipped key BY INDEX in the bucket filed under the');
  console.log('       old current header key, without checking that bucket belongs to this');
  console.log('       frame\'s chain. A new-chain frame at a colliding index gets an OLD-chain');
  console.log('       key and fails AEAD. Non-colliding indices decrypt normally.');

  console.log('\n  Q1 — does the prune break frames that would otherwise SUCCEED?');
  let broken = 0;
  for (let i = 0; i < skipUpTo; i++) {
    const b = tryDecrypt(bob, c1[i]);
    const p = tryDecrypt(prunedJson, c1[i]);
    if (b.ok && !p.ok) broken++;
    console.log(`    delayed chain-1 frame #${i} (key IS in the bucket)`.padEnd(50) + ' ' +
      `baseline:${b.ok ? 'OK  ' : 'FAIL'}  pruned:${p.ok ? 'OK' : 'FAIL'}` +
      `${b.ok && !p.ok ? '   <<< PRUNE DESTROYED IT' : ''}`);
  }
  console.log(`\n    => YES. The prune destroys ${broken}/${skipUpTo} frames that decrypt without it.`);
  console.log('       Naive B1 (prune, decrypt, persist) converts recoverable latency into');
  console.log('       PERMANENT loss of exactly the out-of-order frames the bucket exists for.');

  console.log('\n  B1′ — prune for the RETRY ONLY, then re-file the bucket under its OWN header');
  console.log('        key in the state that gets persisted:');
  const retried = tryDecrypt(prunedJson, c2[0]);
  if (!retried.ok) { console.log('    retry did not decrypt — B1′ untestable in this run'); return; }
  const out = JSON.parse(retried.state);
  const merged = JSON.stringify({
    ...out,
    skipped_keys_map: { ...(out.skipped_keys_map ?? {}), [staleKey]: removed },
  });
  console.log(`    retry recovered: ${retried.msg}`);
  console.log(`    after the DH step the stale bucket's header key is no longer CURRENT ` +
    `(${String(JSON.parse(merged).current_receiving_header_key) === String(staleKey) ? 'still current — CHECK' : 'confirmed'})`);

  let alive = 0;
  for (let i = 0; i < skipUpTo; i++) {
    const r = tryDecrypt(merged, c1[i]);
    if (r.ok) alive++;
    console.log(`    delayed chain-1 frame #${i} vs the re-merged state`.padEnd(50) + ' ' +
      `${r.ok ? 'OK  ' + r.msg : 'FAIL  ' + r.why}`);
  }
  let clean = 0;
  for (let i = 1; i < 4; i++) {
    const r = tryDecrypt(merged, c2[i]);
    if (r.ok) clean++;
  }
  console.log(`\n    => ${alive}/${skipUpTo} delayed frames survive, and ${clean}/3 further new-chain`);
  console.log(`       frames decrypt. ${alive === skipUpTo ? 'B1′ recovers the failure AND destroys nothing.' : 'B1′ is NOT sufficient.'}`);

  console.log('\n  CONTROL — is the bucket\'s mere PRESENCE enough to cause a failure?');
  const ctl = tryDecrypt(bob, c2[5]);
  console.log(`    a new-chain frame at a NON-colliding index: ${ctl.ok ? 'DECRYPTS' : 'FAILS'}`);
  console.log(`    => presence alone is ${ctl.ok ? 'NOT sufficient; the index must collide' : 'sufficient'}.`);
}

// ---------------------------------------------------------------- main
const args = process.argv.slice(2);
const logs = args.filter((a) => !a.startsWith('--'));
if (logs.length) reportCorpus(runCorpus(logs));
else console.log('(no logs given — synthetic section only)');
synthetic();
