/**
 * useNameResolver — direct unit test of the bulk/imperative resolution API
 * added for Phase D rows 4-6 (mention pills in message bodies and the
 * contentEditable editor). It must:
 *   1. read the SAME ladder `<MemberName>`/`useResolvedMemberName` use
 *      (identityFromMaps + resolveIdentity), so a pill and a header agree;
 *   2. expose `requestNames` as a SET-level enrichment call, deduped against
 *      addresses already requested — never one fetch per resolved address;
 *   3. keep `resolve`'s identity stable across renders that don't change the
 *      provider's data, so a caller can safely depend on it without
 *      rebuilding every pill on every unrelated render.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
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

// Pins WIRING, not QNS ownership. Only the final ownership comparison is
// stubbed, because the address fixtures here are arbitrary and no real ed448
// key derives to them. The claim still travels the whole real path, so this
// still fails if the provider stops populating the verified map. Ownership
// itself is pinned in `identity/verifiedQnsNames.test.ts` and shared's
// `verifyQnsClaim.test.ts`, both mutation-proven.
vi.mock('@quilibrium/quorum-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@quilibrium/quorum-shared')>()),
  claimedNameBelongsTo: () => true,
}));

import { useNameResolver } from '@/identity';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const ADDR_A = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const ADDR_B = 'QmPeerBEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

function wrapperFor(
  rosters: Record<string, Record<string, unknown>>,
  client: QueryClient,
) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
          {children}
        </IdentityScopeProvider>
      </QueryClientProvider>
    );
  };
}

describe('useNameResolver', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('resolve() reads the per-space nickname straight from the roster maps, no network request', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const { result } = renderHook(() => useNameResolver(), {
      wrapper: wrapperFor(
        { [SPACE_ID]: { [ADDR_A]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } },
        client,
      ),
    });

    const resolved = result.current.resolve(ADDR_A);
    expect(resolved).toEqual({ name: 'Mod Alice', isQnsVerified: false });
    expect(getPublicProfile).not.toHaveBeenCalled();
  });

  it('resolve() falls back to a truncated address for a completely unknown member — the resolver owns the fallback', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const { result } = renderHook(() => useNameResolver(), {
      wrapper: wrapperFor({}, client),
    });

    const resolved = result.current.resolve(ADDR_A);
    expect(resolved.isQnsVerified).toBe(false);
    expect(resolved.name).not.toBe('');
    expect(resolved.name).not.toBe(ADDR_A); // truncated, not the raw address
  });

  it('requestNames enriches a whole SET in one call, and a QNS name becomes visible via resolve() once it lands', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const { result } = renderHook(() => useNameResolver(), {
      wrapper: wrapperFor(
        { [SPACE_ID]: { [ADDR_A]: { display_name: '', global_display_name: 'Alice' } } },
        client,
      ),
    });

    expect(result.current.resolve(ADDR_A).isQnsVerified).toBe(false);

    act(() => {
      result.current.requestNames([ADDR_A]);
    });

    await waitFor(() => {
      expect(result.current.resolve(ADDR_A)).toEqual({ name: 'alice', isQnsVerified: true });
    });
  });

  it('requestNames dedupes: calling it twice with overlapping addresses fetches each address only once', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const { result } = renderHook(() => useNameResolver(), {
      wrapper: wrapperFor({}, client),
    });

    act(() => {
      result.current.requestNames([ADDR_A, ADDR_B]);
    });
    act(() => {
      result.current.requestNames([ADDR_A, ADDR_B]);
    });

    await waitFor(() => {
      expect(getPublicProfile).toHaveBeenCalledTimes(2);
    });
    expect(getPublicProfile).toHaveBeenCalledWith(ADDR_A);
    expect(getPublicProfile).toHaveBeenCalledWith(ADDR_B);
  });

  it("resolve's function identity is stable across a render that doesn't change the provider's data", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const rosters = { [SPACE_ID]: { [ADDR_A]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } };
    const { result, rerender } = renderHook(() => useNameResolver(), {
      wrapper: wrapperFor(rosters, client),
    });

    const firstResolve = result.current.resolve;
    rerender();
    expect(result.current.resolve).toBe(firstResolve);
  });
});
