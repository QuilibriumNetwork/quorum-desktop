/**
 * The profile card must resolve YOUR name the same way it resolves anybody's.
 *
 * Reported from the running app with the fake-QNS dev page on: tapping another
 * member's avatar opened a card showing their ".q", and tapping your own opened
 * a card showing your global display name. Same component, same screen.
 *
 * The cause was one clause — the card skipped the public-profile fetch when the
 * profile was your own, on the assumption that we already know who we are. We
 * do not: `currentPasskeyInfo` is the device-local auth record and carries no
 * `primary_username`.
 *
 * The first group below is the regression guard. `profileCardNeedsProfileFetch`
 * returning false for self is the whole bug, so re-adding `&& !isOwnProfile`
 * turns it red — which a test asserting only on resolved names would NOT catch,
 * because the resolver was never the broken part.
 */

import { describe, it, expect } from 'vitest';
import {
  profileCardNeedsProfileFetch,
  resolveProfileCardName,
} from '../../../utils/profileCardIdentity';
import { formatResolvedName } from '../../../utils/resolveMemberName';

const ADDRESS = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

describe('profileCardNeedsProfileFetch — self is not a special case', () => {
  it('fetches for a user whose QNS name is not already known', () => {
    expect(
      profileCardNeedsProfileFetch({ address: ADDRESS, displayName: 'Alice Smith' }),
    ).toBe(true);
  });

  it('fetches for YOUR OWN card just the same', () => {
    // The regression. Nothing in the input distinguishes self, and that is the
    // point: the card cannot know your ".q" without asking, because the only
    // source of primary_username is the public profile.
    expect(
      profileCardNeedsProfileFetch({
        address: ADDRESS,
        displayName: 'GattoPardo Mobile',
      }),
    ).toBe(true);
  });

  it('skips the fetch only when the QNS name is already in hand', () => {
    // Enriched paths (message senders, DM header) already carry it; the card
    // must not re-request on their behalf.
    expect(
      profileCardNeedsProfileFetch({ address: ADDRESS, primaryUsername: 'alice' }),
    ).toBe(false);
  });

  it('still fetches in a space when the GLOBAL name is missing', () => {
    // The QNS name alone decides nothing in a space: the ladder compares the
    // roster name to the global name FIRST and returns the roster name when
    // they differ, so a missing global name buries the ".q" before it is
    // reached. A caller supplying one field and not the other must still top up.
    expect(
      profileCardNeedsProfileFetch(
        { address: ADDRESS, displayName: 'GattoPardo Mobile', primaryUsername: 'gatto' },
        { spaceId: 'space-1' },
      ),
    ).toBe(true);
  });

  it('does not fetch when the caller supplied the whole enriched identity', () => {
    expect(
      profileCardNeedsProfileFetch(
        {
          address: ADDRESS,
          displayName: 'GattoPardo Mobile',
          globalDisplayName: 'GattoPardo Mobile',
          primaryUsername: 'gatto',
        },
        { spaceId: 'space-1' },
      ),
    ).toBe(false);
  });
});

describe('resolveProfileCardName — the case reported from the app', () => {
  it('shows the .q when the caller passes the enriched identity', () => {
    // What the message list already renders as "gatto.q". The card was handed
    // only `displayName` and so rendered "GattoPardo Mobile" beside it.
    const r = resolveProfileCardName(
      {
        address: ADDRESS,
        displayName: 'GattoPardo Mobile',
        globalDisplayName: 'GattoPardo Mobile',
        primaryUsername: 'gatto',
      },
      null,
      { spaceId: 'space-1' },
    );
    expect(formatResolvedName(r)).toBe('gatto.q');
  });

  it('treats an EMPTY fetched global name as absent, not as a difference', () => {
    // The fake-QNS overlay returns `display_name: ''` for a synthesized
    // profile, and a real profile can carry an empty one too. Compared raw,
    // '' !== 'GattoPardo Mobile' reads as a deliberate per-space name.
    const r = resolveProfileCardName(
      {
        address: ADDRESS,
        displayName: 'GattoPardo Mobile',
        globalDisplayName: 'GattoPardo Mobile',
      },
      { primary_username: 'gatto', display_name: '' },
      { spaceId: 'space-1' },
    );
    expect(formatResolvedName(r)).toBe('gatto.q');
  });
});

describe('resolveProfileCardName — one fetch, two fields', () => {
  it('promotes the fetched .q over the roster name in a space', () => {
    // The roster name here is the global name echoed at join, which is the
    // normal state, so the ".q" wins.
    const r = resolveProfileCardName(
      { address: ADDRESS, displayName: 'GattoPardo Mobile' },
      { primary_username: 'gatto', display_name: 'GattoPardo Mobile' },
      { spaceId: 'space-1' },
    );
    expect(formatResolvedName(r)).toBe('gatto.q');
  });

  it('needs the fetched GLOBAL name too, not just the .q', () => {
    // The second, quieter half of the same bug. The space resolver decides
    // "deliberate per-space name or join echo?" by comparing roster to global.
    // With the global name missing, roster !== global holds trivially and the
    // roster name is returned as though it had been deliberately chosen — so
    // the ".q" loses even when it was fetched.
    const withoutGlobal = resolveProfileCardName(
      { address: ADDRESS, displayName: 'GattoPardo Mobile' },
      { primary_username: 'gatto' },
      { spaceId: 'space-1' },
    );
    expect(withoutGlobal.name).toBe('GattoPardo Mobile');

    const withGlobal = resolveProfileCardName(
      { address: ADDRESS, displayName: 'GattoPardo Mobile' },
      { primary_username: 'gatto', display_name: 'GattoPardo Mobile' },
      { spaceId: 'space-1' },
    );
    expect(formatResolvedName(withGlobal)).toBe('gatto.q');
  });

  it('lets a genuinely deliberate per-space name still win', () => {
    // The guard must not cost the override tier its purpose.
    const r = resolveProfileCardName(
      { address: ADDRESS, displayName: 'Mod Gatto' },
      { primary_username: 'gatto', display_name: 'GattoPardo Mobile' },
      { spaceId: 'space-1' },
    );
    expect(r.name).toBe('Mod Gatto');
    expect(r.isQnsVerified).toBe(false);
  });

  it('outside a space, the .q outranks the display name with no comparison', () => {
    const r = resolveProfileCardName(
      { address: ADDRESS, displayName: 'GattoPardo Mobile' },
      { primary_username: 'gatto' },
    );
    expect(formatResolvedName(r)).toBe('gatto.q');
  });

  it('prefers what the caller already passed over what was fetched', () => {
    const r = resolveProfileCardName(
      { address: ADDRESS, primaryUsername: 'fromcaller' },
      { primary_username: 'fromfetch' },
    );
    expect(formatResolvedName(r)).toBe('fromcaller.q');
  });

  it('still drops a forged suffix arriving on the fetched global name', () => {
    const r = resolveProfileCardName(
      { address: ADDRESS },
      { display_name: 'mallory.q' },
      { spaceId: 'space-1' },
    );
    expect(r.name).not.toBe('mallory.q');
  });
});
