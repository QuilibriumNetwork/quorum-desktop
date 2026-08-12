/**
 * Task 5b — the operator's ruling on the tension Task 5 measured and reported:
 * profile fetching becomes OPT-IN (`enrich`), and the member sidebar does not
 * opt in. This file used to pin the OLD default (enrich-by-default, 200
 * concurrent fetches on open) — see git history for that version. It now pins
 * the new rule instead, on the same automated-instrument approach: a
 * repeatable test beats a one-off manual dev-console count.
 *
 * Three scenarios, one shared `QueryClient` per test:
 *
 *   1. Sidebar (default, no `enrich`), no self address in view: renders from
 *      the roster maps already in memory, issues ZERO network requests.
 *   2. Sidebar (default), but `selfAddress` is one of the rendered addresses:
 *      the provider's OWN self-address request (unconditional, unrelated to
 *      `enrich` — resolving your own ".q" is one bounded request and the self
 *      tier depends on it) still fires, exactly once, for exactly that
 *      address. Proves the self-request is the only source of fetching here,
 *      not a row somehow slipping through.
 *   3. An enriched surface (`enrich` passed explicitly, the only way to opt
 *      in — never a provider-level flag, so two surfaces inside the same
 *      Space can legitimately differ): fetch count is bounded by DISTINCT
 *      addresses, never a multiple of the row count (proven the same way as
 *      before — more rows than distinct addresses), and revisiting the same
 *      rows adds zero further fetches.
 */
import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getPublicProfile = vi.fn();

vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

import { IdentityScopeProvider } from '@/identity/identityProvider';
import { MemberName } from '@/identity/MemberName';

const SPACE_ID = 'space-sidebar-fetch';
const DISTINCT_COUNT = 200;

// Placeholder addresses, not real ones — see the repo's fixture convention
// (QmPeerA…/QmMeMeMe…/QmThemThem…).
const addressAt = (i: number): string =>
  `QmSidebar${String(i).padStart(4, '0')}${'A'.repeat(30)}`;

const distinctAddresses = Array.from({ length: DISTINCT_COUNT }, (_, i) => addressAt(i));

// 20 of the 200 distinct addresses get a SECOND row — the multi-public-role
// case (Channel.tsx's userSections renders one row per role a member holds).
// Total rows (220) > distinct addresses (200): the gap is what makes the
// "bounded by distinct addresses" assertion in scenario 3 non-trivial.
const DUPLICATED_COUNT = 20;
const rowAddresses = [
  ...distinctAddresses,
  ...distinctAddresses.slice(0, DUPLICATED_COUNT),
];

const rosterRows = distinctAddresses.reduce<Record<string, { display_name: string; global_display_name: string }>>(
  (acc, address, i) => {
    acc[address] = { display_name: '', global_display_name: `Member ${i}` };
    return acc;
  },
  {},
);

/** Resolves after a tick — realistic async shape, and matters for scenario 3
 *  where overlapping in-flight calls need to be observable. */
function fakeGetPublicProfile(address: string) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        data: { display_name: `Profile ${address}`, profile_image: '', bio: '', timestamp: 1, signature: '' },
        status: 200,
      });
    }, 5);
  });
}

/** Give any (incorrect) fetch a couple of ticks to start before sampling —
 *  the request itself is issued synchronously inside a mount effect, but
 *  flushing twice removes any doubt this is a race rather than a true zero. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 10));
  });
}

/** The member sidebar's actual call shape post-Task-5b: default options, no
 *  `enrich`. `selfAddress` is a prop so scenario 2 can exercise the
 *  provider's own unconditional self-request. */
function Sidebar({ addrs, selfAddress = null }: { addrs: string[]; selfAddress?: string | null }) {
  return (
    <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={{ [SPACE_ID]: rosterRows }} selfAddress={selfAddress}>
      {addrs.map((address, i) => (
        <MemberName key={i} address={address} className="text-base font-bold truncate-user-name" />
      ))}
    </IdentityScopeProvider>
  );
}

/** An enriched surface (bookmarks/notifications/message-header shape): every
 *  row passes `enrich` explicitly — the opt-in lives at the call site, never
 *  on the provider. `visibleIndexes` simulates Virtuoso recycling rows. */
function EnrichedList({
  addrs,
  visibleIndexes,
}: {
  addrs: string[];
  visibleIndexes?: ReadonlySet<number>;
}) {
  return (
    <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={{ [SPACE_ID]: rosterRows }} selfAddress={null}>
      {addrs.map((address, i) =>
        !visibleIndexes || visibleIndexes.has(i) ? <MemberName key={i} address={address} enrich /> : null,
      )}
    </IdentityScopeProvider>
  );
}

describe('member sidebar identity — enrich opt-in (design decision 3)', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getPublicProfile.mockImplementation(fakeGetPublicProfile);
  });

  it('1. sidebar default (no enrich), no self address in view: zero fetches', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <Sidebar addrs={rowAddresses} selfAddress={null} />
      </QueryClientProvider>,
    );
    await settle();

    const fetchCount = getPublicProfile.mock.calls.length;
    // eslint-disable-next-line no-console
    console.log(
      `[identitySidebarFetch] scenario 1 — rows rendered=${rowAddresses.length} fetches=${fetchCount}`,
    );

    // Exact, not a bound: the roster-only default must issue NO request.
    expect(fetchCount).toBe(0);
  });

  it('2. sidebar default, selfAddress in view: exactly one fetch, for the self address', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const selfAddress = distinctAddresses[42];

    render(
      <QueryClientProvider client={queryClient}>
        <Sidebar addrs={rowAddresses} selfAddress={selfAddress} />
      </QueryClientProvider>,
    );
    await settle();

    const calls = getPublicProfile.mock.calls;
    // eslint-disable-next-line no-console
    console.log(
      `[identitySidebarFetch] scenario 2 — rows rendered=${rowAddresses.length} fetches=${calls.length} ` +
        `requested=${calls.map((c) => c[0]).join(',')}`,
    );

    expect(calls.length).toBe(1);
    // WHICH address, not just the count — the self-tier request must target
    // the self address specifically, not merely "some one address".
    expect(calls[0][0]).toBe(selfAddress);
  });

  it('3. enriched surface: fetches bounded by distinct addresses, revisiting adds zero', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const first = new Set(rowAddresses.map((_, i) => i));
    const { rerender, unmount } = render(
      <QueryClientProvider client={queryClient}>
        <EnrichedList addrs={rowAddresses} visibleIndexes={first} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(getPublicProfile.mock.calls.length).toBe(DISTINCT_COUNT));
    const afterFirstMount = getPublicProfile.mock.calls.length;

    // Falsifiable half of "bounded": 220 rows were rendered, only 200
    // addresses are distinct. A per-row (rather than per-address) fetch
    // would land at 220, strictly above DISTINCT_COUNT.
    expect(afterFirstMount).toBe(DISTINCT_COUNT);
    expect(afterFirstMount).toBeLessThan(rowAddresses.length);

    // (i) Scroll simulation: unmount the back half of the rows, remount them
    // — Virtuoso recycling rows, provider stays mounted throughout.
    const backHalf = new Set(rowAddresses.map((_, i) => i).filter((i) => i >= rowAddresses.length / 2));
    rerender(
      <QueryClientProvider client={queryClient}>
        <EnrichedList addrs={rowAddresses} visibleIndexes={new Set([...first].filter((i) => !backHalf.has(i)))} />
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={queryClient}>
        <EnrichedList addrs={rowAddresses} visibleIndexes={first} />
      </QueryClientProvider>,
    );
    await settle();
    const afterScrollSim = getPublicProfile.mock.calls.length;

    // (ii) Channel-switch simulation: unmount the WHOLE provider subtree and
    // remount it fresh (re-render the parent) on the SAME QueryClient — the
    // provider's `requested` Set is gone on a fresh mount, so only the 1h
    // staleTime stands between this and a refetch of all 200.
    unmount();
    render(
      <QueryClientProvider client={queryClient}>
        <EnrichedList addrs={rowAddresses} visibleIndexes={first} />
      </QueryClientProvider>,
    );
    await settle();
    const afterFullRemount = getPublicProfile.mock.calls.length;

    // eslint-disable-next-line no-console
    console.log(
      `[identitySidebarFetch] scenario 3 — distinct=${DISTINCT_COUNT} rows=${rowAddresses.length} ` +
        `after first mount=${afterFirstMount}, after scroll-sim=${afterScrollSim}, ` +
        `after full provider remount=${afterFullRemount}`,
    );

    expect(afterScrollSim).toBe(afterFirstMount);
    expect(afterFullRemount).toBe(afterFirstMount);
  });
});
