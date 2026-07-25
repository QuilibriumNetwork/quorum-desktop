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

  it('refuses an ancient envelope even when rows exist and would not flag it', () => {
    // Rows themselves stale/older than the envelope: relative rules pass, but
    // the envelope is still a zombie.
    expect(isStaleInitEnvelope(NOW2 - 26 * HOUR2, [NOW2 - 40 * HOUR2], undefined, NOW2)).toBe(true);
  });
});
