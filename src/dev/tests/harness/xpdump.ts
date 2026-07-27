// On a decrypt failure, dump the exact (ratchet state, sealed frame) pair in the
// SAME `[XPDUMP]` format the diag branch emits, so the existing offline analyzers
// run on harness output UNCHANGED:
//
//   node .agents/tools/dm-debug/dr-ablate.mjs   <harness-xpdump-log>
//   node .agents/tools/dm-debug/dr-replay.mjs   <harness-xpdump-log>
//
// The harness has full in-process access, so unlike the browser it writes these
// from the outside — no probe logging inside MessageService, no key material in
// service code, and (because DevTools truncation doesn't apply here) one line per
// dump instead of chunked. dr-ablate reassembles `n/idx/total`, so a single
// `n/1/1` line is a complete record.
//
// ⚠️ These lines contain REAL ratchet key material. logs/ is gitignored; keep local.
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MessageDB } from '../../../db/messages';
import { config } from './env';

function fnv1a(v: unknown): string {
  const s = String(v);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export class XpdumpLog {
  private readonly path: string;
  private n = 0;

  constructor(scenario: string, startEpochMs: number) {
    mkdirSync(config.logsDir, { recursive: true });
    const stamp = new Date(startEpochMs).toISOString().replace(/[:.]/g, '-');
    this.path = resolve(config.logsDir, `${stamp}-${scenario}.xpdump.log`);
    writeFileSync(this.path, '', 'utf-8');
  }

  /**
   * Capture the failing frame. `frame` is the inbound EncryptedMessage; its
   * `encryptedContent` is the sealed message dr-ablate reads as `d.frame`. The
   * matching ratchet state row is the encryption_states entry on the frame's
   * inbox.
   */
  async capture(
    db: MessageDB,
    frame: { inboxAddress?: string; encryptedContent?: string; timestamp?: number },
    nowMs: number
  ): Promise<boolean> {
    const rows = await db.getAllEncryptionStates();
    const row = rows.find((r) => r.inboxId === frame.inboxAddress);
    if (!row || !frame.encryptedContent) return false;

    this.n += 1;
    const record = {
      n: this.n,
      ts: frame.timestamp ?? nowMs,
      envFp: fnv1a(frame.encryptedContent),
      stFp: fnv1a(row.state),
      state: row.state, // JSON string: { ratchet_state, receiving_inbox, ... }
      frame: frame.encryptedContent, // JSON string: { ephemeral_public_key, envelope }
    };
    appendFileSync(this.path, `[XPDUMP] ${this.n}/1/1 ${JSON.stringify(record)}\n`, 'utf-8');
    return true;
  }

  get file(): string {
    return this.path;
  }
}
