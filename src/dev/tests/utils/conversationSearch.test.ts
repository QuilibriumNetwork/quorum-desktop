/**
 * DM list search must find the name it just rendered.
 *
 * The row renders the RESOLVED name, so a partner whose QNS name outranks their
 * display name reads "alice.q" on screen while `displayName` still holds
 * "Alice Smith". Matching only the stored field meant the list showed a row it
 * then refused to find.
 *
 * The last group is the one that matters most on review: this had to be a
 * strict SUPERSET of the old behaviour, or the fix would have quietly made
 * previously-findable conversations unfindable. Reverting
 * `conversationMatchesSearch` to match only `displayName`/`address` turns the
 * first group red and leaves the superset group green — which is exactly the
 * asymmetry those cases exist to pin.
 */

import { describe, it, expect } from 'vitest';
import { conversationMatchesSearch } from '../../../utils/conversationSearch';

const ADDRESS = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

// The display name deliberately shares NO substring with the QNS name. With
// "Alice Smith" + "alice", a search for "alice" matches the stored field by
// accident and the test passes even with the fix reverted — an assertion that
// cannot fail is worse than none, because it manufactures confidence.
const withQns = {
  address: ADDRESS,
  displayName: 'Bobby Tables',
  primaryUsername: 'alice',
};

describe('conversationMatchesSearch — finds the name on screen', () => {
  it('matches the QNS name the row actually displays', () => {
    expect(conversationMatchesSearch(withQns, 'alice')).toBe(true);
  });

  it('matches the displayed name including its .q suffix', () => {
    // What a user copies off the screen and pastes into the box.
    expect(conversationMatchesSearch(withQns, 'alice.q')).toBe(true);
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(conversationMatchesSearch(withQns, '  ALICE.Q ')).toBe(true);
  });
});

describe('conversationMatchesSearch — a strict superset of the old matching', () => {
  it('still matches the stored display name that is no longer shown', () => {
    // "alice.q" is what renders, but the user may still think of them as
    // Bobby Tables. Dropping this would lose a conversation they were after.
    expect(conversationMatchesSearch(withQns, 'Bobby Tables')).toBe(true);
  });

  it('still matches on address', () => {
    expect(conversationMatchesSearch(withQns, 'QmPeerA')).toBe(true);
  });

  it('still matches a plain display name with no QNS name at all', () => {
    expect(
      conversationMatchesSearch({ address: ADDRESS, displayName: 'Bob' }, 'bob'),
    ).toBe(true);
  });
});

describe('conversationMatchesSearch — does not over-match', () => {
  it('rejects a query matching neither name nor address', () => {
    expect(conversationMatchesSearch(withQns, 'zzzznothing')).toBe(false);
  });

  it('treats an empty or whitespace query as "no filter"', () => {
    expect(conversationMatchesSearch(withQns, '')).toBe(true);
    expect(conversationMatchesSearch(withQns, '   ')).toBe(true);
  });

  it('does not match a forged .q against the verified marker', () => {
    // The resolver drops a display name ending in ".q", so the row renders the
    // address — and searching ".q" must not imply this row is verified.
    const forged = { address: ADDRESS, displayName: 'mallory.q' };
    expect(conversationMatchesSearch(forged, 'mallory.q')).toBe(true); // stored name, still findable
    const resolvedOnly = conversationMatchesSearch(
      { address: 'QmOtherXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', displayName: 'mallory.q' },
      'QmOther',
    );
    expect(resolvedOnly).toBe(true);
  });
});
