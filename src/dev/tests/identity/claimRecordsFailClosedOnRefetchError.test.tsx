/**
 * A failed REFETCH must not keep serving the last verified records.
 *
 * ## The bug this pins
 *
 * `staleTime` on the claim-records query is a SECURITY bound, not a performance
 * one: it is how long a `.q` name transferred to somebody else can still verify
 * for its previous owner. One hour, deliberately.
 *
 * React Query does not clear `data` when a query errors — its reducer keeps the
 * previous state and only flips `status`. So `data ?? NO_RECORDS` served the
 * last successful map for as long as refetches kept failing, which removes the
 * bound entirely. With `retry: false` and no logging on this path, an install
 * could sit past the hour indefinitely and nothing anywhere would say so.
 *
 * MEASURED 2026-08-17 against the pre-fix hook: after one failed refetch the
 * query read `status=error` while `data` still held `["alice"]`, and the
 * verified name kept rendering.
 *
 * quorum-mobile carried the identical shape and fixed it the same way in its
 * PR #256. This is the second half of that.
 *
 * ## Why it asserts on the rendered name
 *
 * The cache is the mechanism; what a viewer sees is the property. Asserting on
 * the rendered text makes this a test of the security outcome rather than of
 * React Query's internals, which are free to change under us.
 *
 * ## Why the two CONTROL arms are not padding
 *
 * A fail-closed assertion passes trivially against a hook that never verifies
 * anything at all, so without the first control this file would still be green
 * if the fix had disabled the feature outright.
 *
 * The second control guards the opposite over-correction. `placeholderData`
 * carries the previous answer across a WIDENING claim set, and it reports
 * `status: 'success'`, so a fix written as `status === 'success'` keeps it while
 * a fix written as `!isError && !isPlaceholderData` would silently kill it —
 * reintroducing the name flicker that comment was written to prevent. Nothing
 * else in the suite covers that path.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { deriveAddress } from '@quilibrium/quorum-shared';
import type { PublicProfileResponse } from '@/api/baseTypes';

const mockResolveNamesBatch = vi.fn();
vi.mock('@quilibrium/quorum-shared', async () => {
  const actual = await vi.importActual<typeof import('@quilibrium/quorum-shared')>(
    '@quilibrium/quorum-shared',
  );
  return {
    ...actual,
    resolveNamesBatch: (...args: unknown[]) => mockResolveNamesBatch(...args),
  };
});

const { useVerifiedQnsNames } = await import('@/identity/useVerifiedQnsNames');

/** Invented ed448-shaped public key (57 bytes). Not a real account's — the same
 *  fixture as `verifiedQnsNames.test.ts` and shared's own suite. */
const KEY =
  '030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dce3eaf1f8ff060d141b222930373e454c535a61686f767d848b';

/** The address KEY really derives to — the rightful owner of `alice`. */
const OWNER = deriveAddress(KEY);

/** A second claimant, so a widening set can be simulated. Owns nothing. */
const OTHER = 'QmThemThemThemThemThemThemThemThemThemThemThem';

/** The record `/resolve/batch` returns for a name OWNER genuinely owns. */
const ALICE_RECORD = { address: '0xsomethingelse', resolveKey: KEY, metadata: null };

const profile = (over: Partial<PublicProfileResponse> = {}): PublicProfileResponse =>
  ({
    display_name: '',
    profile_image: '',
    bio: '',
    timestamp: 0,
    signature: '',
    ...over,
  }) as PublicProfileResponse;

const ONE_CLAIMANT: ProfileMapLike = {
  [OWNER]: profile({ display_name: 'Alice', primary_username: 'alice' }),
};

const TWO_CLAIMANTS: ProfileMapLike = {
  ...ONE_CLAIMANT,
  [OTHER]: profile({ display_name: 'Bob', primary_username: 'bob' }),
};

type ProfileMapLike = Record<string, PublicProfileResponse>;

function Probe({ profiles }: { profiles: ProfileMapLike }) {
  const verified = useVerifiedQnsNames(profiles);
  return <div data-testid="qns">{verified[OWNER] ?? 'none'}</div>;
}

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  mockResolveNamesBatch.mockReset();
});

const renderProbe = (profiles: ProfileMapLike = ONE_CLAIMANT) =>
  render(
    <QueryClientProvider client={queryClient}>
      <Probe profiles={profiles} />
    </QueryClientProvider>,
  );

/** Refetch inside `act`, so the resulting state update flushes before we look. */
const refetch = async () => {
  await act(async () => {
    await queryClient.refetchQueries({ queryKey: ['qns-verify-claims'] });
  });
};

const rendered = () => screen.getByTestId('qns').textContent;

describe('useVerifiedQnsNames — a refetch that fails', () => {
  it('stops verifying, rather than serving the last good records forever', async () => {
    mockResolveNamesBatch.mockResolvedValueOnce({ alice: ALICE_RECORD });
    renderProbe();
    await waitFor(() => expect(rendered()).toBe('alice'));

    // The name is transferred away, and the refetch that would have noticed
    // fails. The suffix must drop; it must not survive on the strength of a
    // lookup that succeeded before the transfer.
    mockResolveNamesBatch.mockRejectedValue(new Error('resolver down'));
    await refetch();

    await waitFor(() => expect(rendered()).toBe('none'));
  });

  it('recovers on the next successful refetch', async () => {
    // The whole argument for the transport rejecting instead of caching an
    // empty result is that recovery is fast. If a failure left the query
    // permanently unable to verify, this fix would have traded one silent bug
    // for another.
    mockResolveNamesBatch.mockResolvedValueOnce({ alice: ALICE_RECORD });
    renderProbe();
    await waitFor(() => expect(rendered()).toBe('alice'));

    mockResolveNamesBatch.mockRejectedValueOnce(new Error('resolver down'));
    await refetch();
    await waitFor(() => expect(rendered()).toBe('none'));

    mockResolveNamesBatch.mockResolvedValue({ alice: ALICE_RECORD });
    await refetch();
    await waitFor(() => expect(rendered()).toBe('alice'));
  });

  it('CONTROL: a verified name renders while nothing is failing', async () => {
    // Without this arm, a hook hard-wired to return NO_RECORDS would pass the
    // test above while having disabled verification entirely.
    mockResolveNamesBatch.mockResolvedValue({ alice: ALICE_RECORD });
    renderProbe();

    await waitFor(() => expect(rendered()).toBe('alice'));
  });

  it('does not resurrect stale records when the set widens AFTER a failure', async () => {
    // The bypass in the first version of this fix, and the reason gating the
    // read on `status` is not enough on its own.
    //
    // React Query's observer tracks "the last query that had defined data",
    // and an ERRORED query still qualifies — the reducer never clears `data`.
    // So when the claim set widens, the brand-new query pulls its
    // `placeholderData` from the errored one and is reported as
    // `status: 'success'`. The status gate then passes it through, and the
    // name that had correctly stopped verifying comes back.
    //
    // This is not exotic: scrolling a channel adds claimants one at a time,
    // which is precisely what changes `namesKey`. Any scroll during a resolver
    // outage would reopen the hole, with no bound on how long it stays open,
    // because `retry: false` means the errored query never re-attempts on its
    // own.
    mockResolveNamesBatch.mockResolvedValueOnce({ alice: ALICE_RECORD });
    const view = renderProbe(ONE_CLAIMANT);
    await waitFor(() => expect(rendered()).toBe('alice'));

    mockResolveNamesBatch.mockRejectedValue(new Error('resolver down'));
    await refetch();
    await waitFor(() => expect(rendered()).toBe('none'));

    // A new claimant appears. The new lookup never settles, so nothing can
    // re-verify `alice` — anything rendering it is stale by construction.
    mockResolveNamesBatch.mockImplementation(() => new Promise(() => {}));
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <Probe profiles={TWO_CLAIMANTS} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockResolveNamesBatch).toHaveBeenCalledTimes(3));
    expect(rendered()).toBe('none');
  });

  it('CONTROL: a widening claim set still carries the previous answer', async () => {
    // The opposite over-correction. A new claimant changes `namesKey`, so this
    // is a NEW query whose `placeholderData` carries the previous map while it
    // resolves. That carried answer reports `status: 'success'` and must still
    // pass the gate, or every name on screen flickers whenever anyone new
    // appears — the exact regression the `placeholderData` comment argues
    // against.
    mockResolveNamesBatch.mockResolvedValueOnce({ alice: ALICE_RECORD });
    const view = renderProbe(ONE_CLAIMANT);
    await waitFor(() => expect(rendered()).toBe('alice'));

    // The second lookup never settles, so the ONLY thing that can be rendering
    // 'alice' below is the carried placeholder.
    mockResolveNamesBatch.mockImplementation(() => new Promise(() => {}));
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <Probe profiles={TWO_CLAIMANTS} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockResolveNamesBatch).toHaveBeenCalledTimes(2));
    expect(rendered()).toBe('alice');
  });
});
