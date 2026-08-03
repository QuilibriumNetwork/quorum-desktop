// A space tag has THREE inbound states and the whole bug was conflating two of
// them.
//
//   absent  → no change.  Most update-profile messages carry no tag at all: a
//             global avatar save, the on-connect identity announce. If absence
//             meant "clear", every one of those would strip every member's tag,
//             and the on-connect announce would do it on every reconnect.
//   null    → clear.      The owner deleted the tag and the sender says so.
//   object  → set it, if it validates. An INVALID tag is rejected, not treated
//             as a clear — a malformed tag must not strip a good one.
//
// History: absence used to mean "clear", which over-cleared (any tagless
// profile push wiped the tag). Then the row merge started dropping explicit
// `undefined`s — correctly, to stop a sync delta erasing the identity slot —
// and absence became "no change", which under-cleared (a deleted tag never went
// away). Neither state is right, because absence cannot carry both meanings.
// Hence the tombstone.
//
// See 2026-08-01-space-tag-can-no-longer-be-cleared-from-a-member-roster.md under .agents/issues/

import { describe, it, expect } from 'vitest';
import { resolveInboundSpaceTag } from '../../../services/MessageService';

// The url must be a base64 PNG/JPEG data URI — remote URLs and SVG are both
// rejected by `isValidSpaceTagUrl` (SVG because it can carry script).
const VALID = {
  letters: 'QUIL',
  url: 'data:image/png;base64,iVBORw0KGgo=',
  spaceId: 's1',
};

describe('resolveInboundSpaceTag', () => {
  it('leaves the tag alone when the message carries none', () => {
    const r = resolveInboundSpaceTag(undefined);
    expect(r.write).toBe(false);
    expect(r.options).toBeUndefined();
  });

  it('clears the tag on an explicit null tombstone', () => {
    const r = resolveInboundSpaceTag(null);
    expect(r.write).toBe(true);
    expect(r.tag).toBeUndefined();
    expect(r.options).toEqual({ clearFields: ['spaceTag'] });
  });

  it('sets a valid tag', () => {
    const r = resolveInboundSpaceTag(VALID);
    expect(r.write).toBe(true);
    expect(r.tag).toEqual(VALID);
    expect(r.options).toBeUndefined();
  });

  // Rejection is not deletion. Letting an invalid tag clear a good one would
  // hand any member a one-message way to blank somebody else's tag.
  it('rejects a tag with bad letters without clearing the stored one', () => {
    const r = resolveInboundSpaceTag({ ...VALID, letters: 'WAY-TOO-LONG' });
    expect(r.write).toBe(false);
    expect(r.options).toBeUndefined();
  });

  it('rejects an SVG data URI without clearing the stored one', () => {
    const r = resolveInboundSpaceTag({
      ...VALID,
      url: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    });
    expect(r.write).toBe(false);
    expect(r.options).toBeUndefined();
  });

  it('rejects a javascript: url', () => {
    const r = resolveInboundSpaceTag({ ...VALID, url: 'javascript:alert(1)' });
    expect(r.write).toBe(false);
  });

  // A remote URL would be a tracking pixel pointed at every member of the
  // space, so only inline data URIs are accepted.
  it('rejects a remote https url', () => {
    const r = resolveInboundSpaceTag({ ...VALID, url: 'https://example.test/t.png' });
    expect(r.write).toBe(false);
  });
});
