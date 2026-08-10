/**
 * Task 5 — the member sidebar is the highest-row-count surface in the app,
 * and its now-migrated rows (Channel.tsx's desktop + mobile-drawer member
 * lists) each mount a `<MemberName>`, which calls `request(address)` on
 * mount. This is an AUTOMATED instrument for what that costs, standing in
 * for the brief's manual "add a window counter, scroll the sidebar three
 * times" recipe — a repeatable test beats a one-off manual count.
 *
 * Two properties, matching design constraint 1 and the plan's pass condition:
 *
 *   (a) First mount: total public-profile fetches is BOUNDED BY THE NUMBER OF
 *       DISTINCT ADDRESSES rendered, never a multiple of the row count. Proven
 *       by rendering MORE rows than distinct addresses (some addresses appear
 *       twice, the way a member in two public roles appears in two role
 *       sections of the real sidebar) — a per-row-per-render bug would push
 *       the fetch count above the distinct-address count; the real mechanism
 *       (the provider's `requested` Set + React Query's queryKey dedup) caps
 *       it there.
 *
 *   (b) Revisiting the same rows adds ZERO further fetches. Two ways rows get
 *       revisited are simulated: (i) unmounting/remounting a slice of
 *       `<MemberName>` rows while `<IdentityScopeProvider>` stays mounted
 *       (Virtuoso recycling rows during a scroll) — protected by the
 *       provider's `requested` Set, which never drops an address; and (ii) a
 *       full remount of the provider subtree on the SAME `QueryClient`
 *       (leaving the channel and coming back) — protected by the provider's
 *       1h `staleTime`, since a fresh `requested` Set means fresh query
 *       observers, and only `staleTime` stands between that and a refetch.
 *       (ii) is the one the brief's "1h cache" pass condition is actually
 *       about; (i) is a weaker, always-true-by-construction check included
 *       because the brief asks for it explicitly.
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
// Total rows (220) > distinct addresses (200): the gap between the two is
// what makes assertion (a) capable of failing.
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

/** Resolves after a tick so overlapping in-flight calls are observable —
 *  a synchronous mock would never reveal serialized-vs-concurrent. */
let inFlight = 0;
let maxConcurrent = 0;
function fakeGetPublicProfile(address: string) {
  inFlight += 1;
  maxConcurrent = Math.max(maxConcurrent, inFlight);
  return new Promise((resolve) => {
    setTimeout(() => {
      inFlight -= 1;
      resolve({
        data: { display_name: `Profile ${address}`, profile_image: '', bio: '', timestamp: 1, signature: '' },
        status: 200,
      });
    }, 5);
  });
}

/** One "sidebar": the provider plus a row per address in `addrs`. Visible
 *  rows can be a subset of `addrs` (`visibleIndexes`) to simulate Virtuoso
 *  unmounting/remounting rows on scroll without touching the provider. */
function Sidebar({
  addrs,
  visibleIndexes,
}: {
  addrs: string[];
  visibleIndexes?: ReadonlySet<number>;
}) {
  return (
    <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={{ [SPACE_ID]: rosterRows }} selfAddress={null}>
      {addrs.map((address, i) =>
        !visibleIndexes || visibleIndexes.has(i) ? <MemberName key={i} address={address} /> : null,
      )}
    </IdentityScopeProvider>
  );
}

describe('member sidebar via <MemberName> — fetch count (design constraint 1)', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getPublicProfile.mockImplementation(fakeGetPublicProfile);
    inFlight = 0;
    maxConcurrent = 0;
  });

  it('(a) first mount: fetch count is bounded by distinct addresses, not row count', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <Sidebar addrs={rowAddresses} />
      </QueryClientProvider>,
    );

    // Settle: wait until the call count stops climbing.
    await waitFor(() => expect(getPublicProfile.mock.calls.length).toBe(DISTINCT_COUNT));

    const fetchesAfterFirstMount = getPublicProfile.mock.calls.length;

    // MEASURED, printed for the task report.
    // eslint-disable-next-line no-console
    console.log(
      `[identitySidebarFetch] distinct addresses=${DISTINCT_COUNT} rows rendered=${rowAddresses.length} ` +
        `fetches after first mount=${fetchesAfterFirstMount} max concurrent in-flight=${maxConcurrent}`,
    );

    // The falsifiable part: 220 rows were rendered, only 200 addresses are
    // distinct. A per-row (rather than per-address) fetch would land at 220,
    // strictly above DISTINCT_COUNT — this assertion catches that.
    expect(fetchesAfterFirstMount).toBe(DISTINCT_COUNT);
    expect(fetchesAfterFirstMount).toBeLessThan(rowAddresses.length);
  });

  it('(b) revisiting the same rows adds zero further fetches', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const first = new Set(rowAddresses.map((_, i) => i));
    const { rerender, unmount } = render(
      <QueryClientProvider client={queryClient}>
        <Sidebar addrs={rowAddresses} visibleIndexes={first} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(getPublicProfile.mock.calls.length).toBe(DISTINCT_COUNT));
    const afterFirstMount = getPublicProfile.mock.calls.length;

    // (i) Scroll simulation: unmount the back half of the rows, then remount
    // them — Virtuoso recycling rows, provider stays mounted throughout.
    const backHalf = new Set(rowAddresses.map((_, i) => i).filter((i) => i >= rowAddresses.length / 2));
    rerender(
      <QueryClientProvider client={queryClient}>
        <Sidebar addrs={rowAddresses} visibleIndexes={new Set([...first].filter((i) => !backHalf.has(i)))} />
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={queryClient}>
        <Sidebar addrs={rowAddresses} visibleIndexes={first} />
      </QueryClientProvider>,
    );
    // Give any (incorrect) refetch a tick to start before we sample.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    const afterScrollSim = getPublicProfile.mock.calls.length;

    // (ii) Channel-switch simulation: unmount the WHOLE provider subtree and
    // remount it fresh on the SAME QueryClient — this is what actually
    // exercises the 1h staleTime, since the provider's `requested` Set (which
    // alone would explain (i)) is gone; only the query cache can save it now.
    unmount();
    render(
      <QueryClientProvider client={queryClient}>
        <Sidebar addrs={rowAddresses} visibleIndexes={first} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    const afterFullRemount = getPublicProfile.mock.calls.length;

    // eslint-disable-next-line no-console
    console.log(
      `[identitySidebarFetch] fetches after first mount=${afterFirstMount}, after scroll-sim=${afterScrollSim}, ` +
        `after full provider remount=${afterFullRemount}`,
    );

    expect(afterScrollSim).toBe(afterFirstMount);
    expect(afterFullRemount).toBe(afterFirstMount);
  });
});
