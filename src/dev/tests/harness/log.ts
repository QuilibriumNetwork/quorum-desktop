// Structured, both-sides, one-clock run log. Writes newline-delimited JSON to
// logs/<timestamp>-<scenario>.jsonl. This is the artifact the manual rig could
// never produce cleanly: a single ordered transcript of both participants, with
// no console-save skew and no 5k-char truncation.
//
// ⚠️ Entries can embed real message content and (in later slices) key material.
// logs/ is gitignored; keep logs local.
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from './env';

export interface LogEntry {
  t: number; // ms since run start (one clock for all bots)
  bot: string; // which bot emitted this
  kind: string; // 'send' | 'recv' | 'note' | ...
  [k: string]: unknown;
}

export class RunLog {
  private readonly path: string;
  private readonly start: number;
  readonly entries: LogEntry[] = [];

  constructor(scenario: string, startEpochMs: number) {
    this.start = startEpochMs;
    mkdirSync(config.logsDir, { recursive: true });
    const stamp = new Date(startEpochMs).toISOString().replace(/[:.]/g, '-');
    this.path = resolve(config.logsDir, `${stamp}-${scenario}.jsonl`);
    writeFileSync(this.path, '', 'utf-8');
  }

  /** Append one entry. `nowMs` is passed in (scripts avoid Date.now internally). */
  add(nowMs: number, bot: string, kind: string, fields: Record<string, unknown> = {}): void {
    const entry: LogEntry = { t: nowMs - this.start, bot, kind, ...fields };
    this.entries.push(entry);
    appendFileSync(this.path, JSON.stringify(entry) + '\n', 'utf-8');
  }

  get file(): string {
    return this.path;
  }
}
