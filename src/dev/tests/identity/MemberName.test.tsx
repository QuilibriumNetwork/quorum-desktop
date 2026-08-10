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

  it('falls back to a truncated address for an unknown member', () => {
    wrap(<MemberName address={ADDR} />);
    expect(screen.getByText(/Qm/)).toBeTruthy();
  });

  it('never renders the literal "Unknown User"', () => {
    // The resolver owns the fallback; a caller-supplied literal is the defect
    // this API exists to make unexpressable.
    wrap(<MemberName address={ADDR} />);
    expect(screen.queryByText('Unknown User')).toBeNull();
  });
});
