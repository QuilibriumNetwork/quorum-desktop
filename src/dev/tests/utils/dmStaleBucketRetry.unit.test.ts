import { describe, it, expect, afterEach } from 'vitest';
import {
  findStaleBucket,
  restoreStaleBucket,
  staleBucketRetry,
} from '../../../utils/dmStaleBucketRetry';

const CUR = 'currentHeaderKeyBase64';
const NEXT = 'nextHeaderKeyBase64';
const OLD = 'oldHeaderKeyBase64';

/** An EncryptionState.state row — `ratchet_state` is a nested JSON string. */
function row(skipped: Record<string, Record<string, string>>, current = CUR): string {
  return JSON.stringify({
    ratchet_state: JSON.stringify({
      current_receiving_header_key: current,
      next_receiving_header_key: NEXT,
      current_receiving_chain_length: 7,
      root_key: 'rootKey',
      skipped_keys_map: skipped,
    }),
    receiving_inbox: { inbox_encryption_key: { private_key: [1, 2, 3] } },
    sending_inbox: { inbox_public_key: 'pub' },
    tag: { tag: 'x' },
  });
}

afterEach(() => {
  staleBucketRetry.enabled = true;
});

describe('findStaleBucket', () => {
  it('finds a bucket filed under the CURRENT receiving header key', () => {
    const found = findStaleBucket(row({ [CUR]: { 0: 'k0', 1: 'k1' } }));
    expect(found?.headerKey).toBe(CUR);
    expect(Object.keys(found?.bucket ?? {})).toEqual(['0', '1']);
  });

  it('removes ONLY that bucket, leaving every other one intact', () => {
    const found = findStaleBucket(
      row({ [CUR]: { 0: 'k0' }, [OLD]: { 3: 'k3' }, [NEXT]: { 5: 'k5' } })
    );
    const rs = JSON.parse(found!.prunedRow.ratchet_state);
    expect(Object.keys(rs.skipped_keys_map).sort()).toEqual([NEXT, OLD].sort());
    expect(rs.skipped_keys_map[OLD]).toEqual({ 3: 'k3' });
  });

  it('preserves the rest of the row and the rest of the ratchet state', () => {
    const found = findStaleBucket(row({ [CUR]: { 0: 'k0' } }));
    expect(found!.prunedRow.tag).toEqual({ tag: 'x' });
    const rs = JSON.parse(found!.prunedRow.ratchet_state);
    expect(rs.root_key).toBe('rootKey');
    expect(rs.current_receiving_chain_length).toBe(7);
    expect(rs.current_receiving_header_key).toBe(CUR);
  });

  // The mitigation must be inert on a healthy session: no bucket under the current
  // key means the upstream lookup cannot mis-fire, so there is nothing to retry.
  it('returns null when no bucket sits under the current key', () => {
    expect(findStaleBucket(row({ [OLD]: { 1: 'k1' }, [NEXT]: { 2: 'k2' } }))).toBeNull();
  });

  it('returns null for an empty skipped-keys map', () => {
    expect(findStaleBucket(row({}))).toBeNull();
  });

  it('returns null for an empty bucket under the current key', () => {
    expect(findStaleBucket(row({ [CUR]: {} }))).toBeNull();
  });

  it('returns null when there is no current receiving header key', () => {
    const noCurrent = JSON.stringify({
      ratchet_state: JSON.stringify({ skipped_keys_map: { [OLD]: { 1: 'k' } } }),
    });
    expect(findStaleBucket(noCurrent)).toBeNull();
  });

  it('returns null (never throws) on unparseable input', () => {
    expect(findStaleBucket('not json')).toBeNull();
    expect(findStaleBucket('{}')).toBeNull();
    expect(findStaleBucket(JSON.stringify({ ratchet_state: 'not json' }))).toBeNull();
  });

  it('is disabled by the kill switch', () => {
    staleBucketRetry.enabled = false;
    expect(findStaleBucket(row({ [CUR]: { 0: 'k0' } }))).toBeNull();
  });
});

describe('restoreStaleBucket', () => {
  // This is the step that keeps the mitigation non-destructive: those message keys
  // are the only way to read genuinely delayed frames and cannot be re-derived.
  it('re-files the bucket under its own header key', () => {
    const after = JSON.stringify({ skipped_keys_map: {}, root_key: 'newRoot' });
    const merged = JSON.parse(restoreStaleBucket(after, CUR, { 0: 'k0', 1: 'k1' }));
    expect(merged.skipped_keys_map[CUR]).toEqual({ 0: 'k0', 1: 'k1' });
    expect(merged.root_key).toBe('newRoot');
  });

  it('keeps buckets the crate wrote during the successful decrypt', () => {
    const after = JSON.stringify({ skipped_keys_map: { [OLD]: { 9: 'k9' } } });
    const merged = JSON.parse(restoreStaleBucket(after, CUR, { 0: 'k0' }));
    expect(merged.skipped_keys_map[OLD]).toEqual({ 9: 'k9' });
    expect(merged.skipped_keys_map[CUR]).toEqual({ 0: 'k0' });
  });

  // The crate's own entry is newer and authoritative; a restore must not clobber it.
  it('does not overwrite an index the crate just wrote under the same key', () => {
    const after = JSON.stringify({ skipped_keys_map: { [CUR]: { 0: 'fresh' } } });
    const merged = JSON.parse(restoreStaleBucket(after, CUR, { 0: 'stale', 1: 'k1' }));
    expect(merged.skipped_keys_map[CUR]).toEqual({ 0: 'fresh', 1: 'k1' });
  });

  it('returns the input unchanged rather than rewriting a state it cannot parse', () => {
    expect(restoreStaleBucket('not json', CUR, { 0: 'k0' })).toBe('not json');
  });
});

describe('round trip', () => {
  it('prune then restore reproduces the original skipped-keys map', () => {
    const original = { [CUR]: { 0: 'k0', 2: 'k2' }, [OLD]: { 4: 'k4' } };
    const found = findStaleBucket(row(original))!;
    const restored = JSON.parse(
      restoreStaleBucket(found.prunedRow.ratchet_state, found.headerKey, found.bucket)
    );
    expect(restored.skipped_keys_map).toEqual(original);
  });
});
