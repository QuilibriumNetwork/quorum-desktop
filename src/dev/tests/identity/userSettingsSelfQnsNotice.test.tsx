/**
 * Your own `.q` notice in Settings must not be the one surface that still
 * trusts an unchecked claim.
 *
 * `UserSettingsModal` used to read `public_profile.primary_username` straight
 * from the fetch and hand it to `General`, which renders
 * `<strong>{primaryUsername}.q</strong>`. That bypassed the identity module
 * entirely. It survived the `rawNameFieldAudit` because both files sit in that
 * audit's "settings form editing YOUR OWN profile" exception — a reason that is
 * true of the edit fields and quietly covered a READ-ONLY render of the trust
 * marker as well. (Both exception reasons have since been corrected to say what
 * is actually allowed.)
 *
 * The practical harm was sharper than the rule it broke. Once verification
 * shipped, an unverified name renders NOWHERE — so this panel would have kept
 * insisting "your QNS name alice.q is shown as your name" while the user's own
 * name in the nav rail showed something else, with no way to tell which was
 * lying.
 *
 * ## What this pins, and what it does not
 *
 * It pins the DECISION the modal now makes: ask the identity module, and treat
 * an unverified self-claim as absent. It deliberately does NOT render `General`
 * — that component owns an image dropzone and a dozen unrelated props, so
 * mounting it would test react-dropzone rather than this. The rendering half is
 * a one-line `{primaryUsername && ...}` guard in `General.tsx`, and the audit
 * above is what keeps the modal from going back to a raw read.
 *
 * ⚠️ Unlike the ~41 wiring tests, this one does NOT stub `claimedNameBelongsTo`.
 * The real verdict is the entire point, so it uses a real ed448-shaped key and
 * the address it genuinely derives to.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { deriveAddress } from '@quilibrium/quorum-shared';

/** Invented ed448-shaped public key (57 bytes). Not a real account's. */
const KEY =
  '030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dce3eaf1f8ff060d141b222930373e454c535a61686f767d848b';

/** The address KEY really derives to — the rightful owner of `alice`. */
const OWNER = deriveAddress(KEY);
/** Owns nothing. */
const IMPOSTOR = 'QmThemThemThemThemThemThemThemThemThemThemThem';

const getPublicProfile = vi.fn();
vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

import { IdentityScopeProvider, useResolvedMemberName } from '@/identity';

/**
 * The exact derivation `UserSettingsModal` performs to decide whether the
 * notice appears. Kept identical to the source, so a change there that this
 * no longer mirrors is a signal to revisit both.
 */
function SelfQnsProbe({ address }: { address: string }) {
  const resolved = useResolvedMemberName(address, { enrich: true, global: true });
  const primaryUsername = resolved.isQnsVerified ? resolved.name : undefined;
  return <div data-testid="notice">{primaryUsername ? `${primaryUsername}.q` : 'NO NOTICE'}</div>;
}

function renderProbe(address: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider rostersBySpace={{}} selfAddress={address}>
        <SelfQnsProbe address={address} />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('UserSettingsModal — your own QNS notice respects verification', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getPublicProfile.mockResolvedValue({
      data: { primary_username: 'alice', display_name: 'A' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        // `alice` really belongs to OWNER, and to nobody else.
        json: async () => ({ records: [{ address: '0xwhatever', resolveKey: KEY }] }),
      })),
    );
  });

  it('shows the notice when the name genuinely belongs to you', async () => {
    renderProbe(OWNER);
    await waitFor(() =>
      expect(screen.getByTestId('notice')).toHaveTextContent('alice.q'),
    );
  });

  it('shows NOTHING when the claim is not yours', async () => {
    // The regression case. Same claim, same resolver answer, different account.
    // Before the fix this panel rendered "alice.q" for the impostor while every
    // other surface in the app correctly withheld it.
    renderProbe(IMPOSTOR);

    // Wait for the profile fetch AND give the verification lookup time to land,
    // so this asserts a SETTLED negative rather than "the render hasn't caught
    // up yet" — which would pass even on a build that never verifies at all.
    await waitFor(() => expect(getPublicProfile).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByTestId('notice')).toHaveTextContent('NO NOTICE');
  });
});
