import { describe, it, expect } from 'vitest';
import {
  isStaleInitEnvelope,
  INIT_ENVELOPE_STALENESS_TOLERANCE_MS,
} from '../../../utils/initEnvelopeGuard';

const NOW = 1_784_290_000_000;
const HOUR = 3_600_000;

describe('isStaleInitEnvelope', () => {
  it('accepts the first init for a tag (no existing rows)', () => {
    expect(isStaleInitEnvelope(NOW, [], undefined, NOW)).toBe(false);
  });

  it('accepts a fresh envelope newer than every existing row (normal reset)', () => {
    expect(isStaleInitEnvelope(NOW, [NOW - 5 * HOUR, NOW - HOUR], undefined, NOW)).toBe(false);
  });

  it('rejects an exact redelivery of the envelope that created a current row', () => {
    // Init-created rows are saved with the envelope timestamp itself.
    expect(isStaleInitEnvelope(NOW - HOUR, [NOW - HOUR], undefined, NOW)).toBe(true);
  });

  it('rejects an envelope hours older than the current session (zombie)', () => {
    expect(isStaleInitEnvelope(NOW - 5 * HOUR, [NOW - HOUR], undefined, NOW)).toBe(true);
  });

  it('rejects a 60-day-old envelope (observed live)', () => {
    expect(isStaleInitEnvelope(NOW - 60 * 24 * HOUR, [NOW - HOUR], undefined, NOW)).toBe(true);
  });

  it('tolerates small clock skew (envelope slightly older than newest row)', () => {
    // Rows updated by sends carry local Date.now(); a fresh server-stamped
    // envelope may trail a skewed local clock by a few seconds.
    expect(isStaleInitEnvelope(NOW - 30_000, [NOW], undefined, NOW)).toBe(false);
  });

  it('rejects just past the tolerance boundary and accepts just inside it', () => {
    const newest = NOW;
    const inside = newest - INIT_ENVELOPE_STALENESS_TOLERANCE_MS + 1_000;
    const outside = newest - INIT_ENVELOPE_STALENESS_TOLERANCE_MS - 1_000;
    expect(isStaleInitEnvelope(inside, [newest], undefined, NOW)).toBe(false);
    expect(isStaleInitEnvelope(outside, [newest], undefined, NOW)).toBe(true);
  });

  it('compares against the NEWEST row when several exist', () => {
    const rows = [NOW - 10 * HOUR, NOW - HOUR];
    expect(isStaleInitEnvelope(NOW - 2 * HOUR, rows, undefined, NOW)).toBe(true);
    expect(isStaleInitEnvelope(NOW, rows, undefined, NOW)).toBe(false);
  });
});

describe('isStaleInitEnvelope — absolute age bound (no rows to compare against)', () => {
  const NOW2 = 1_784_988_800_000;
  const HOUR2 = 3_600_000;

  it('refuses an ancient envelope even when we hold NO rows', () => {
    // The reset hole: a reset deletes every row, so rule 1 ("no rows -> not
    // stale") accepted anything. Observed live replacing a just-reset session
    // with a 26-hour-old redelivered envelope.
    expect(isStaleInitEnvelope(NOW2 - 26 * HOUR2, [], undefined, NOW2)).toBe(true);
  });

  it('still accepts a genuinely fresh envelope when we hold no rows', () => {
    expect(isStaleInitEnvelope(NOW2 - 1_000, [], undefined, NOW2)).toBe(false);
  });

  it('tolerates clock skew well beyond the 2-minute relative tolerance', () => {
    expect(isStaleInitEnvelope(NOW2 - 5 * 60_000, [], undefined, NOW2)).toBe(false);
  });

  it('refuses a 60-day-old envelope when we hold no rows', () => {
    expect(isStaleInitEnvelope(NOW2 - 60 * 24 * HOUR2, [], undefined, NOW2)).toBe(true);
  });
});

describe('isStaleInitEnvelope — an offline receiver must not lose a legitimate re-init', () => {
  const NOW3 = 1_785_138_113_000;
  const MIN = 60_000;

  // The measured regression, reproduced deliberately 2026-07-27: the peer reset
  // and sent while this client was closed, so the envelope was ~17.6 minutes old
  // on arrival. It was NEWER than every row it would replace, and the old
  // unconditional age bound destroyed it anyway — deleting the frame, and the
  // message inside it, server-side.
  it('accepts the real envelope the old bound destroyed', () => {
    const envelope = 1_785_137_056_356; // 1057s old on arrival
    const newestRow = 1_785_136_882_458; // 174s OLDER than the envelope
    expect(isStaleInitEnvelope(envelope, [newestRow], undefined, NOW3)).toBe(false);
  });

  it('accepts a days-old envelope that is still newer than every row we hold', () => {
    // Away for a week; the peer reset three days in. Age alone says "zombie",
    // recency says "this is the session we do not have yet". Recency wins.
    const rows = [NOW3 - 7 * 24 * 60 * MIN];
    expect(isStaleInitEnvelope(NOW3 - 3 * 24 * 60 * MIN, rows, undefined, NOW3)).toBe(false);
  });

  it('still refuses an old envelope that is older than the rows it would replace', () => {
    // The distinction that replaced wall-clock age: zombies are OLDER than what
    // we hold. This must keep working or the 2026-07-25 zombies come back.
    const rows = [NOW3 - 60 * MIN];
    expect(isStaleInitEnvelope(NOW3 - 26 * 60 * MIN, rows, undefined, NOW3)).toBe(true);
  });

  it('still refuses an exact redelivery no matter how the clock looks', () => {
    const envelope = NOW3 - 30 * 24 * 60 * MIN;
    expect(isStaleInitEnvelope(envelope, [envelope], undefined, NOW3)).toBe(true);
  });

  it('refuses an envelope stamped implausibly far in the future', () => {
    // Such a stamp would win every recency comparison and permanently block
    // legitimate re-inits behind it.
    expect(isStaleInitEnvelope(NOW3 + 60 * MIN, [NOW3 - MIN], undefined, NOW3)).toBe(true);
    expect(isStaleInitEnvelope(NOW3 + 60 * MIN, [], undefined, NOW3)).toBe(true);
  });

  it('tolerates a small forward clock skew', () => {
    expect(isStaleInitEnvelope(NOW3 + MIN, [NOW3 - MIN], undefined, NOW3)).toBe(false);
  });
});
