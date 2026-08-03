/**
 * Mitigation for the upstream skipped-key lookup defect (quorum-mobile#183 item
 * 1a; bug doc `transport/2026-07-26-dm-desktop-to-desktop-resurfaced.md` under .agents/issues/ §5-B1).
 *
 * THE UPSTREAM DEFECT, as measured. A receiver files the message keys of frames
 * it had to skip into `skipped_keys_map`, keyed by the header key of the sending
 * chain they belong to. When the sender later opens a NEW sending chain, the
 * receiver takes a DH step — and the crate then matches a skipped key BY INDEX in
 * the bucket filed under the *pre-step* `current_receiving_header_key`, without
 * checking that the bucket belongs to the incoming frame's chain. A new-chain
 * frame whose index COLLIDES with an index in that stale bucket is handed an
 * old-chain message key and fails AEAD. Non-colliding indices decrypt normally,
 * which is why the failure looks like it depends on position in the chain.
 *
 * Evidence: 139 of 159 captured production failures show exactly this signature
 * (frame drove a DH step, index present in the stale bucket) and every one of
 * them decrypts when that one bucket is removed. Reproduced on demand both against
 * the bare crate and through the real client
 * (`yarn harness dm-reorder`: 3 withheld frames -> 3 failures, at exactly the
 * 3 colliding indices).
 *
 * WHAT THIS DOES. On a decrypt failure, retry ONCE against a copy of the ratchet
 * state with that single bucket removed, so the crate falls through to normal
 * derivation.
 *
 * ⚠️ WHY THE BUCKET IS PUT BACK, AND WHY THAT IS NOT OPTIONAL. Those keys are the
 * only way to read genuinely out-of-order frames — they cannot be re-derived, as
 * a receiving chain cannot run backwards. Measured: pruning and persisting the
 * pruned state destroys 3 of 3 delayed frames that decrypt without it, converting
 * recoverable latency into permanent loss. So the pruned state is used ONLY as a
 * decrypt input, and the bucket is re-filed under its own header key in whatever
 * state gets persisted. After the DH step that header key is no longer current, so
 * it cannot poison again, and the delayed frames it serves still decrypt
 * (measured 3/3).
 */

/**
 * Kill switch. This is a workaround for a defect in a dependency we have no source
 * for, so it must be possible to turn off without a rebuild — and the bench needs
 * to measure the same scenario with it on and off in one process.
 */
export const staleBucketRetry = { enabled: true };

/** The skipped-keys map: header key -> message index -> message key. */
type SkippedKeysMap = Record<string, Record<string, unknown>>;

interface RatchetState {
  current_receiving_header_key?: string;
  skipped_keys_map?: SkippedKeysMap;
  [k: string]: unknown;
}

/** The row stored in `EncryptionState.state` — `ratchet_state` is a JSON string. */
interface StateRow {
  ratchet_state: string;
  [k: string]: unknown;
}

export interface StaleBucket {
  /** The header key the bucket is filed under. */
  headerKey: string;
  /** The bucket itself, so it can be re-filed after a successful retry. */
  bucket: Record<string, unknown>;
  /** The row with ONLY that bucket removed — the retry's decrypt input. */
  prunedRow: StateRow;
}

function parseRow(stateJson: string): { row: StateRow; rs: RatchetState } | null {
  try {
    const row = JSON.parse(stateJson) as StateRow;
    if (typeof row?.ratchet_state !== 'string') return null;
    return { row, rs: JSON.parse(row.ratchet_state) as RatchetState };
  } catch {
    return null;
  }
}

/**
 * Is this state carrying a bucket under its CURRENT receiving header key — the
 * only configuration in which the upstream lookup can mis-fire? Returns the
 * pruned row to retry with, or null when there is nothing to try (the common
 * case: a healthy session has no such bucket, so this costs one JSON parse).
 */
export function findStaleBucket(stateJson: string): StaleBucket | null {
  if (!staleBucketRetry.enabled) return null;
  const parsed = parseRow(stateJson);
  if (!parsed) return null;
  const { row, rs } = parsed;
  const headerKey = rs.current_receiving_header_key;
  if (!headerKey) return null;
  const map = rs.skipped_keys_map;
  const bucket = map?.[headerKey];
  if (!bucket || Object.keys(bucket).length === 0) return null;

  const prunedMap: SkippedKeysMap = { ...map };
  delete prunedMap[headerKey];
  return {
    headerKey,
    bucket,
    prunedRow: {
      ...row,
      ratchet_state: JSON.stringify({ ...rs, skipped_keys_map: prunedMap }),
    },
  };
}

/**
 * Re-file a bucket that was pruned for a retry, into the ratchet state the
 * successful retry produced. Never overwrites a bucket the crate itself wrote
 * under the same header key — the crate's own entry is authoritative and newer.
 */
export function restoreStaleBucket(
  ratchetStateJson: string,
  headerKey: string,
  bucket: Record<string, unknown>
): string {
  try {
    const rs = JSON.parse(ratchetStateJson) as RatchetState;
    const map: SkippedKeysMap = { ...(rs.skipped_keys_map ?? {}) };
    map[headerKey] = { ...bucket, ...(map[headerKey] ?? {}) };
    return JSON.stringify({ ...rs, skipped_keys_map: map });
  } catch {
    // A state we cannot parse is a state we must not rewrite.
    return ratchetStateJson;
  }
}
