// Drive the REAL mitigation code against REAL degraded production state.
//
// Every other test of the stale-bucket retry uses a session this bench built. This
// one uses genuinely aged sessions from the field: each `[XPDUMP]` record captured
// during a manual rig round contains the complete `EncryptionState` row AND the
// sealed frame that failed against it, so the exact production decrypt can be
// re-run here — against `src/utils/dmStaleBucketRetry.ts` itself, not a
// reimplementation of it. `dr-prune-safety.mjs` does the same mutation, but it
// open-codes it; if the shipped helper and that script ever disagreed, only this
// test would notice.
//
// It needs no export and no device: the logs already on disk are the aged sessions.
//
//   DM_LOG_DIR="D:/path/to/logs/OLD" yarn harness replay-captured
//
// ⚠️ Those logs hold REAL ratchet key material. They live outside the repo, the
// path comes from the environment, and nothing here writes state back. With
// DM_LOG_DIR unset the test skips rather than failing, so CI stays green.
import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { channel_raw } from '@quilibrium/quilibrium-js-sdk-channels';
import { findStaleBucket, restoreStaleBucket } from '../../../utils/dmStaleBucketRetry';
import { RunLog } from './log';

const LOG_DIR = process.env.DM_LOG_DIR;

interface Dump {
  no: string;
  envFp?: string;
  state: string;
  frame: string;
}

/** Reassemble the chunked `[XPDUMP] n/idx/total {json}` records in a console log. */
function dumpsFrom(path: string): Dump[] {
  const parts = new Map<string, { total: number; chunks: Map<number, string> }>();
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const m = line.match(/\[XPDUMP\]\s+(\d+)\/(\d+)\/(\d+)\s(.*)$/);
    if (!m) continue;
    const [, no, idx, total, text] = m;
    if (!parts.has(no)) parts.set(no, { total: Number(total), chunks: new Map() });
    parts.get(no)!.chunks.set(Number(idx), text);
  }
  const out: Dump[] = [];
  for (const [no, { total, chunks }] of parts) {
    if (chunks.size !== total) continue;
    const joined = Array.from({ length: total }, (_, i) => chunks.get(i + 1)).join('');
    try { out.push({ no, ...JSON.parse(joined) }); } catch { /* truncated */ }
  }
  return out;
}

/** Unseal the outer layer exactly as the live receive path does. */
function unseal(row: Record<string, any>, sealed: Record<string, any>): string {
  const raw = JSON.parse(channel_raw.js_decrypt_inbox_message(JSON.stringify({
    inbox_private_key: row.receiving_inbox.inbox_encryption_key.private_key,
    ephemeral_public_key: [...new Uint8Array(Buffer.from(sealed.ephemeral_public_key, 'hex'))],
    ciphertext: JSON.parse(sealed.envelope),
  })));
  let envelope = Buffer.from(new Uint8Array(raw as number[])).toString('utf-8');
  try {
    const maybeInit = JSON.parse(envelope);
    if (maybeInit.user_address) envelope = maybeInit.message;
  } catch { /* plain DR envelope */ }
  return envelope;
}

/** The ratchet decrypt. Mirrors how the app detects failure: via the message text. */
function decrypt(ratchetState: string, envelope: string):
  { ok: true; msg: string; state: string } | { ok: false } {
  try {
    const out = JSON.parse(channel_raw.js_double_ratchet_decrypt(
      JSON.stringify({ ratchet_state: ratchetState, envelope })
    ));
    const msg = Buffer.from(new Uint8Array(out.message)).toString('utf-8');
    if (msg.startsWith('Decryption failed') || msg.includes('aead')) return { ok: false };
    return { ok: true, msg, state: out.ratchet_state };
  } catch {
    return { ok: false };
  }
}

const maybe = LOG_DIR ? test : test.skip;

maybe(
  'replay-captured: the shipped stale-bucket retry recovers real production failures',
  () => {
    const dir = LOG_DIR!;
    const files = readdirSync(dir).filter((f) => f.endsWith('.log'));
    const seen = new Set<string>();

    let total = 0;
    let baselineDecrypted = 0;
    let hadStaleBucket = 0;
    let recovered = 0;
    let unrecovered = 0;
    let bucketPreserved = 0;

    for (const file of files) {
      for (const d of dumpsFrom(resolve(dir, file))) {
        let row: Record<string, any>;
        let sealed: Record<string, any>;
        try {
          row = JSON.parse(d.state);
          sealed = JSON.parse(d.frame);
          JSON.parse(row.ratchet_state);
        } catch { continue; }

        let envelope: string;
        try { envelope = unseal(row, sealed); } catch { continue; }

        // De-duplicate by envelope fingerprint before counting anything: a failed
        // frame is redelivered and re-captured, and raw counts have overstated
        // volume 2-5x throughout this investigation.
        const fp = String(d.envFp ?? '');
        if (fp && seen.has(fp)) continue;
        if (fp) seen.add(fp);
        total += 1;

        // 1. The first attempt, exactly as it happened in production.
        const first = decrypt(row.ratchet_state, envelope);
        if (first.ok) { baselineDecrypted += 1; continue; }

        // 2. What the shipped code does on failure.
        const stale = findStaleBucket(d.state);
        if (!stale) { unrecovered += 1; continue; }
        hadStaleBucket += 1;

        const retry = decrypt(stale.prunedRow.ratchet_state, envelope);
        if (!retry.ok) { unrecovered += 1; continue; }
        recovered += 1;

        // 3. The invariant that makes the mitigation non-destructive: the bucket
        //    must be back in the state that would be persisted, and its keys intact.
        const persisted = restoreStaleBucket(retry.state, stale.headerKey, stale.bucket);
        const back = JSON.parse(persisted).skipped_keys_map?.[stale.headerKey] ?? {};
        const allKeysPresent = Object.keys(stale.bucket).every(
          (k) => back[k] === (stale.bucket as Record<string, unknown>)[k]
        );
        expect(allKeysPresent).toBe(true);
        bucketPreserved += 1;
      }
    }

    const pct = total ? ((recovered / total) * 100).toFixed(0) : '0';
    const summary = [
      `${files.length} logs, ${total} distinct captured failures`,
      `  already decrypted on replay : ${baselineDecrypted}`,
      `  had a stale bucket          : ${hadStaleBucket}`,
      `  RECOVERED by the shipped fix: ${recovered}  (${pct}%)`,
      `  not recovered               : ${unrecovered}`,
      `  bucket preserved after retry: ${bucketPreserved}/${recovered}`,
    ];
    // console.log is swallowed by the harness reporter, so the numbers go to the
    // run log — which is where a bench result belongs anyway.
    const log = new RunLog('replay-captured', Date.now());
    for (const line of summary) log.add(Date.now(), 'harness', 'note', { msg: line });
    log.add(Date.now(), 'harness', 'result', {
      total, baselineDecrypted, hadStaleBucket, recovered, unrecovered, bucketPreserved,
    });
    console.log(summary.map((s) => `[replay-captured] ${s}`).join('\n'));
    console.log(`[replay-captured] log: ${log.file}`);

    // The corpus must actually have been read — an empty run must not read as a pass.
    expect(total).toBeGreaterThan(50);
    // Every recovery must have preserved the discarded keys. This is the property
    // that separates the shipped fix from the naive prune that loses messages.
    expect(bucketPreserved).toBe(recovered);
    // Recovery rate measured at 139/159 (87%) on 2026-07-27. Guard against a
    // regression that silently stops the retry firing.
    expect(recovered / total).toBeGreaterThan(0.8);
  },
  10 * 60 * 1000
);
