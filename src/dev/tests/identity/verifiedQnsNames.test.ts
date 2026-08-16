/**
 * The desktop half of claim verification: turn a map of fetched public profiles
 * into a map of names that have actually been PROVEN to belong to the address
 * claiming them.
 *
 * These are the pure functions behind `useVerifiedQnsNames`. The ownership
 * predicate itself lives in `@quilibrium/quorum-shared` and has its own tests;
 * what is pinned here is the part desktop owns — which claims get looked up,
 * which addresses end up in the verified map, and what happens in the states
 * that are neither "verified" nor "rejected".
 *
 * ## The fixture
 *
 * `KEY` is invented — an arithmetic pattern, nobody's real key — and `ADDRESS`
 * is what `deriveAddress(KEY)` produces. Both are shared with quorum-mobile's
 * equivalent test and with shared's `verifyQnsClaim.test.ts`, so a divergence
 * shows up in all three rather than silently in one client.
 *
 * The verify predicate is deliberately NOT mocked in this file. Mocking it
 * would leave the impostor case asserting only that a stub was called, and the
 * impostor case is the entire point of the feature.
 */

import { describe, it, expect } from 'vitest';
import { deriveAddress } from '@quilibrium/quorum-shared';
import {
  claimedNamesIn,
  verifiedNamesFrom,
  profileGlobalNamesFrom,
  QNS_CLAIM_LIMIT,
} from '@/identity/useVerifiedQnsNames';
import type { PublicProfileResponse } from '@/api/baseTypes';

/** Invented ed448-shaped public key (57 bytes). Not a real account's. */
const KEY =
  '030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dce3eaf1f8ff060d141b222930373e454c535a61686f767d848b';

/** The address KEY really derives to — i.e. the rightful owner of `alice`. */
const OWNER = deriveAddress(KEY);

/** Somebody else entirely. Owns nothing. */
const IMPOSTOR = 'QmThemThemThemThemThemThemThemThemThemThemThem';

const profile = (over: Partial<PublicProfileResponse> = {}): PublicProfileResponse =>
  ({
    display_name: '',
    profile_image: '',
    bio: '',
    timestamp: 0,
    signature: '',
    ...over,
  }) as PublicProfileResponse;

/** A resolver answer proving `alice` belongs to OWNER. */
const ALICE_RESOLVES = { alice: { address: '0xwhatever', resolveKey: KEY } };

describe('claimedNamesIn', () => {
  it('collects the distinct names being claimed', () => {
    expect(
      claimedNamesIn({
        [OWNER]: profile({ primary_username: 'alice' }),
        [IMPOSTOR]: profile({ primary_username: 'bob' }),
      }).sort(),
    ).toEqual(['alice', 'bob']);
  });

  it('collapses two accounts claiming the same name into one lookup', () => {
    // Cost property AND security property: both claimants are then judged
    // against the same single answer, so the collision is settled by the very
    // request that verifies whoever genuinely owns it.
    expect(
      claimedNamesIn({
        [OWNER]: profile({ primary_username: 'alice' }),
        [IMPOSTOR]: profile({ primary_username: 'alice' }),
      }),
    ).toEqual(['alice']);
  });

  it('ignores profiles that claim nothing', () => {
    expect(
      claimedNamesIn({
        [OWNER]: profile({ display_name: 'Just A Name' }),
        [IMPOSTOR]: null,
      }),
    ).toEqual([]);
  });

  it('trims, so a padded claim cannot dodge the dedupe', () => {
    expect(
      claimedNamesIn({
        [OWNER]: profile({ primary_username: '  alice  ' }),
        [IMPOSTOR]: profile({ primary_username: 'alice' }),
      }),
    ).toEqual(['alice']);
  });

  it('does not fold case, because the resolver is the authority on matching', () => {
    // Normalising here would mean verifying a name the user never claimed.
    expect(
      claimedNamesIn({
        [OWNER]: profile({ primary_username: 'Alice' }),
        [IMPOSTOR]: profile({ primary_username: 'alice' }),
      }).sort(),
    ).toEqual(['Alice', 'alice']);
  });

  it('caps the set at one batch', () => {
    // Past the cap a claim is simply never looked up, so it stays unverified
    // and renders as the global name. The overflow degrades in the safe
    // direction: it can under-show a real `.q`, never promote a forged one.
    const many: Record<string, PublicProfileResponse> = {};
    for (let i = 0; i < QNS_CLAIM_LIMIT + 25; i++) {
      many[`Qm${i}`] = profile({ primary_username: `name${i}` });
    }
    expect(claimedNamesIn(many)).toHaveLength(QNS_CLAIM_LIMIT);
  });
});

describe('verifiedNamesFrom', () => {
  it('keeps a claim that resolves back to the claiming address', () => {
    const out = verifiedNamesFrom(
      { [OWNER]: profile({ primary_username: 'alice' }) },
      ALICE_RESOLVES,
    );
    expect(out).toEqual({ [OWNER]: 'alice' });
  });

  it('drops the same claim made by somebody else', () => {
    // THE case. `alice` is a real, registered, resolvable name — it just is not
    // theirs. A real user cannot stage this, which is exactly why it needs a
    // test rather than a device check.
    const out = verifiedNamesFrom(
      { [IMPOSTOR]: profile({ primary_username: 'alice' }) },
      ALICE_RESOLVES,
    );
    expect(out).toEqual({});
  });

  it('settles a collision in favour of the real owner only', () => {
    const out = verifiedNamesFrom(
      {
        [OWNER]: profile({ primary_username: 'alice' }),
        [IMPOSTOR]: profile({ primary_username: 'alice' }),
      },
      ALICE_RESOLVES,
    );
    expect(out).toEqual({ [OWNER]: 'alice' });
  });

  it('treats a lookup still in flight as unproven', () => {
    // Unproven includes NOT-YET-KNOWN. A `.q` shown for even the instant before
    // a lookup lands is the whole attack, because a screenshot does not expire.
    const out = verifiedNamesFrom({ [OWNER]: profile({ primary_username: 'alice' }) }, {});
    expect(out).toEqual({});
  });

  it('treats an unregistered name as unproven', () => {
    // A miss arrives as a null slot, not an error.
    const out = verifiedNamesFrom(
      { [OWNER]: profile({ primary_username: 'ghost' }) },
      { ghost: null },
    );
    expect(out).toEqual({});
  });

  it('treats a name with no Quorum binding as unproven', () => {
    // MEASURED: most registered names carry no `resolveKey` at all. They are
    // unverifiable by construction, not broken.
    const out = verifiedNamesFrom(
      { [OWNER]: profile({ primary_username: 'alice' }) },
      { alice: { address: '0xabc' } },
    );
    expect(out).toEqual({});
  });

  it('honours a dev exemption, and only for the exact pair', () => {
    const isExempt = (name: string, address: string) =>
      name === 'qa1234' && address === IMPOSTOR;
    const out = verifiedNamesFrom(
      {
        [IMPOSTOR]: profile({ primary_username: 'qa1234' }),
        [OWNER]: profile({ primary_username: 'qa1234' }),
      },
      {},
      isExempt,
    );
    expect(out).toEqual({ [IMPOSTOR]: 'qa1234' });
  });

  it('returns a stable reference when nothing verifies', () => {
    // These maps feed IdentitySources, which feeds memos down to a virtualised
    // list. A fresh {} per render would invalidate all of them every tick.
    const a = verifiedNamesFrom({ [OWNER]: profile({ primary_username: 'alice' }) }, {});
    const b = verifiedNamesFrom({ [IMPOSTOR]: profile({ primary_username: 'bob' }) }, {});
    expect(a).toBe(b);
  });
});

describe('profileGlobalNamesFrom', () => {
  it('maps addresses to their profile display name', () => {
    expect(
      profileGlobalNamesFrom({
        [OWNER]: profile({ display_name: 'Alice' }),
        [IMPOSTOR]: profile({ display_name: 'Bob' }),
      }),
    ).toEqual({ [OWNER]: 'Alice', [IMPOSTOR]: 'Bob' });
  });

  it('carries no trust claim, so it is never verified', () => {
    // A display name is not a name anyone can own, so it needs no check. This
    // is why the two maps are separate rather than one profile object.
    expect(
      profileGlobalNamesFrom({ [IMPOSTOR]: profile({ display_name: 'Alice' }) }),
    ).toEqual({ [IMPOSTOR]: 'Alice' });
  });

  it('omits blank and missing names, and returns a stable empty reference', () => {
    const a = profileGlobalNamesFrom({ [OWNER]: profile({ display_name: '   ' }) });
    const b = profileGlobalNamesFrom({ [IMPOSTOR]: null });
    expect(a).toEqual({});
    expect(a).toBe(b);
  });
});
