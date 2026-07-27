// Read the live ratchet state out of a bot's MessageDB and summarise the numbers
// the DM investigation cares about — above all the accumulated skipped-keys count
// (§1: "grew 2 → 20 → 23 → 37 across the day, failure rate rising with it").
//
// EncryptionState.state is a JSON string of { ratchet_state: "<json string>", ... },
// so ratchet_state is double-encoded — same shape dr-ablate parses.
import type { MessageDB } from '../../../db/messages';

export interface RatchetStat {
  conv: string;
  inbox: string;
  /** current_sending_chain_length — resets to 0 on every DH step, read with root. */
  sLen: number;
  rLen: number;
  /** previous_sending_chain_length. */
  pS: number;
  /** total keys across all skipped_keys_map buckets. */
  skipped: number;
  /** number of buckets (distinct header keys holding skipped keys). */
  buckets: number;
}

/** Count keys across the nested skipped_keys_map ({ headerKey: { idx: key } }). */
function countSkipped(map: Record<string, Record<string, unknown>> | undefined): {
  keys: number;
  buckets: number;
} {
  const m = map ?? {};
  const buckets = Object.keys(m).length;
  const keys = Object.values(m).reduce(
    (a, bucket) => a + Object.keys(bucket ?? {}).length,
    0
  );
  return { keys, buckets };
}

export async function ratchetStats(db: MessageDB): Promise<RatchetStat[]> {
  const rows = await db.getAllEncryptionStates();
  const out: RatchetStat[] = [];
  for (const row of rows) {
    let rs: Record<string, unknown>;
    try {
      rs = JSON.parse(JSON.parse(row.state).ratchet_state);
    } catch {
      continue;
    }
    const { keys, buckets } = countSkipped(
      rs.skipped_keys_map as Record<string, Record<string, unknown>> | undefined
    );
    out.push({
      conv: row.conversationId.slice(0, 12),
      inbox: row.inboxId.slice(0, 10),
      sLen: Number(rs.current_sending_chain_length ?? 0),
      rLen: Number(rs.current_receiving_chain_length ?? 0),
      pS: Number(rs.previous_sending_chain_length ?? 0),
      skipped: keys,
      buckets,
    });
  }
  return out;
}

/** Total skipped keys across all of a bot's sessions — the headline aging metric. */
export async function totalSkipped(db: MessageDB): Promise<number> {
  const stats = await ratchetStats(db);
  return stats.reduce((a, s) => a + s.skipped, 0);
}
