/**
 * <MemberName> is the only name-rendering API. It owns the ".q" AND the avatar
 * initials, because computing them separately let a member render "gatto.q"
 * beside a circle showing "G" for GattoPardo.
 *
 * Initials must derive from the BARE name: getInitials splits on non-letters,
 * so "gatto.q" would yield two initials from one name.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdentityScopeProvider } from '@/identity/identityProvider';
import { MemberName } from '@/identity/MemberName';

const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

// IdentityScopeProvider calls useQueries, which throws "No QueryClient set"
// without a QueryClientProvider ancestor — the brief's helper omitted it.
const wrap = (ui: React.ReactNode, rosters = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IdentityScopeProvider spaceId="space-1" rostersBySpace={rosters} selfAddress={null}>
        {ui}
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
};

describe('MemberName', () => {
  it('renders the per-space nickname with no .q', () => {
    wrap(<MemberName address={ADDR} />, {
      'space-1': { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
    });
    expect(screen.getByText('Mod Alice')).toBeTruthy();
    expect(screen.queryByText(/\.q/)).toBeNull();
  });

  it('falls back to the EXACT truncated-address shape for an unknown member, never a literal like "Unknown User"', () => {
    // The resolver owns the fallback (`resolveDisplayName.ts`'s `truncate`:
    // first 6 chars + ellipsis + last 4) — a caller-supplied literal such as
    // "Unknown User" is the defect this API exists to make unexpressable.
    // Pinning the EXACT shape (not a loose /Qm/ substring match) is what
    // makes this assertion capable of failing: a regex that only checks for
    // "Qm somewhere in the text" would pass just as happily against the
    // untruncated full address, or any other wrong fallback string.
    wrap(<MemberName address={ADDR} />);
    const truncated = `${ADDR.slice(0, 6)}…${ADDR.slice(-4)}`;
    expect(screen.getByText(truncated)).toBeTruthy();
    expect(screen.queryByText('Unknown User')).toBeNull();
    expect(screen.queryByText(ADDR)).toBeNull();
  });
});

/**
 * The forged-".q" suffix guard, wired through the real production path
 * (`<MemberName>` -> `useResolvedMemberName` -> `identityFromMaps` ->
 * `resolveIdentity`), not re-testing the pure ladder itself.
 *
 * The exhaustive truth table for `resolveIdentity` (every tier, unicode
 * confusable dots, the join-echo rule) lives in quorum-shared's own
 * `resolveIdentity.test.ts` — that is now the ONLY implementation, since
 * desktop's old `resolveSpaceMemberName` (which had its own, buggy copy of
 * this guard — see the deleted `resolveMemberNameQnsGuard.test.ts`) no longer
 * exists. What desktop still owns, and still needs pinned, is the WIRING:
 * that `identityFromMaps` hands the guard real, untransformed roster/profile
 * strings, for both scopes `<MemberName>` is actually asked to render.
 */
describe('MemberName — the forged .q suffix guard survives the wiring (Task 7)', () => {
  it('space scope: drops a forged roster nickname, falls through to the global name', () => {
    wrap(<MemberName address={ADDR} />, {
      'space-1': { [ADDR]: { display_name: 'alice.q', global_display_name: 'Mallory' } },
    });
    expect(screen.getByText('Mallory')).toBeTruthy();
    expect(screen.queryByText('alice.q')).toBeNull();
  });

  it('global scope (no spaceId in context): drops a forged local name', () => {
    wrap(<MemberName address={ADDR} global />, {
      'space-1': { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'mallory.q' } },
    });
    expect(screen.queryByText('mallory.q')).toBeNull();
    // Global scope ignores the per-space tier entirely, and the forged
    // global name is dropped too, so this falls all the way to the address.
    expect(screen.getByText(/Qm/)).toBeTruthy();
  });
});
