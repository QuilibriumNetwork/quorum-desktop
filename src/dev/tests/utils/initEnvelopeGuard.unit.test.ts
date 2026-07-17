import { describe, it, expect } from 'vitest';
import {
  isStaleInitEnvelope,
  INIT_ENVELOPE_STALENESS_TOLERANCE_MS,
} from '../../../utils/initEnvelopeGuard';

const NOW = 1_784_290_000_000;
const HOUR = 3_600_000;

describe('isStaleInitEnvelope', () => {
  it('accepts the first init for a tag (no existing rows)', () => {
    expect(isStaleInitEnvelope(NOW, [])).toBe(false);
  });

  it('accepts a fresh envelope newer than every existing row (normal reset)', () => {
    expect(isStaleInitEnvelope(NOW, [NOW - 5 * HOUR, NOW - HOUR])).toBe(false);
  });

  it('rejects an exact redelivery of the envelope that created a current row', () => {
    // Init-created rows are saved with the envelope timestamp itself.
    expect(isStaleInitEnvelope(NOW - HOUR, [NOW - HOUR])).toBe(true);
  });

  it('rejects an envelope hours older than the current session (zombie)', () => {
    expect(isStaleInitEnvelope(NOW - 5 * HOUR, [NOW - HOUR])).toBe(true);
  });

  it('rejects a 60-day-old envelope (observed live)', () => {
    expect(isStaleInitEnvelope(NOW - 60 * 24 * HOUR, [NOW - HOUR])).toBe(true);
  });

  it('tolerates small clock skew (envelope slightly older than newest row)', () => {
    // Rows updated by sends carry local Date.now(); a fresh server-stamped
    // envelope may trail a skewed local clock by a few seconds.
    expect(isStaleInitEnvelope(NOW - 30_000, [NOW])).toBe(false);
  });

  it('rejects just past the tolerance boundary and accepts just inside it', () => {
    const newest = NOW;
    const inside = newest - INIT_ENVELOPE_STALENESS_TOLERANCE_MS + 1_000;
    const outside = newest - INIT_ENVELOPE_STALENESS_TOLERANCE_MS - 1_000;
    expect(isStaleInitEnvelope(inside, [newest])).toBe(false);
    expect(isStaleInitEnvelope(outside, [newest])).toBe(true);
  });

  it('compares against the NEWEST row when several exist', () => {
    const rows = [NOW - 10 * HOUR, NOW - HOUR];
    expect(isStaleInitEnvelope(NOW - 2 * HOUR, rows)).toBe(true);
    expect(isStaleInitEnvelope(NOW, rows)).toBe(false);
  });
});
