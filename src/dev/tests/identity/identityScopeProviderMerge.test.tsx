/**
 * `IdentityScopeProvider` MERGES with an enclosing scope instead of
 * replacing it — the structural fix for a bug class that had shipped four
 * times by hand (a nested provider mounted with less data than the one
 * above it: the root's Kick/Mute/Block confirmations, DM search results,
 * and now MessagePreview/ReactionsModal/GlobalNotificationsModal/
 * BookmarksPage — see
 * .agents/issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md).
 *
 * Before this fix, every `<IdentityScopeProvider>` mount fully REPLACED
 * whatever an ancestor provider already knew: React context always resolves
 * to the NEAREST provider, so a nested provider that forgot a tier (or
 * whose own fetch for a tier was still loading) silently shadowed a working
 * ancestor with less. These tests pin the merge directly, at the provider
 * level, with static props — no network/query mocking needed, since
 * `rostersBySpace`/`locallyKnownNames`/`selfAddress` are plain props.
 */
import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdentityScopeProvider, useResolvedMemberName } from '@/identity';

// Same fixture family as the rest of the identity suite (`QmPeerA…`) —
// padded to a real address's length (46 = 'Qm' + 44) so any format-sensitive
// assertion (truncation, prefix/suffix checks) behaves the same as it would
// against a real one.
const fixtureAddress = (label: string): string => `Qm${label}`.padEnd(46, 'A');

const Probe: React.FC<{ address: string; spaceId?: string }> = ({ address, spaceId }) => {
  const resolved = useResolvedMemberName(address, { spaceId });
  return (
    <span data-testid="resolved-name">
      {resolved.isQnsVerified ? `${resolved.name}.q` : resolved.name}
    </span>
  );
};

function renderWithClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('IdentityScopeProvider — nested providers merge with an enclosing scope, never replace it', () => {
  it('a nested provider that supplies no locallyKnownNames still resolves an address only the ANCESTOR knows locally', () => {
    const PARTNER = fixtureAddress('PeerAMergeLocalNames');

    renderWithClient(
      <IdentityScopeProvider
        rostersBySpace={{}}
        selfAddress={null}
        locallyKnownNames={{ [PARTNER]: 'Ancestor Known Name' }}
      >
        {/* Deliberately omits locallyKnownNames — the exact shape every one of
            the four fixed providers had before this fix, and what any FUTURE
            provider that forgets it again will still look like. */}
        <IdentityScopeProvider rostersBySpace={{}} selfAddress={null}>
          <Probe address={PARTNER} />
        </IdentityScopeProvider>
      </IdentityScopeProvider>,
    );

    expect(screen.getByTestId('resolved-name').textContent).toBe('Ancestor Known Name');
  });

  it('a nested provider with no roster entry for a space still resolves a member the ANCESTOR already loaded for that space', () => {
    const SPACE = 'space-merge-1';
    const MEMBER = fixtureAddress('ThemThemMergeRoster');

    renderWithClient(
      <IdentityScopeProvider
        rostersBySpace={{ [SPACE]: { [MEMBER]: { display_name: 'Ancestor Nickname' } } }}
        selfAddress={null}
      >
        {/* Own roster for this space is empty (e.g. still loading) — must not
            blank out what the ancestor already has for the SAME space. */}
        <IdentityScopeProvider spaceId={SPACE} rostersBySpace={{}} selfAddress={null}>
          <Probe address={MEMBER} spaceId={SPACE} />
        </IdentityScopeProvider>
      </IdentityScopeProvider>,
    );

    expect(screen.getByTestId('resolved-name').textContent).toBe('Ancestor Nickname');
  });

  it("a nested provider's own roster row wins over the ancestor's for the SAME space+address (deliberate override — Channel's roster must win for its own space)", () => {
    const SPACE = 'space-merge-2';
    const MEMBER = fixtureAddress('ThemThemMergeOverride');

    renderWithClient(
      <IdentityScopeProvider
        rostersBySpace={{ [SPACE]: { [MEMBER]: { display_name: 'Stale Ancestor Nickname' } } }}
        selfAddress={null}
      >
        <IdentityScopeProvider
          spaceId={SPACE}
          rostersBySpace={{ [SPACE]: { [MEMBER]: { display_name: 'Fresh Own Nickname' } } }}
          selfAddress={null}
        >
          <Probe address={MEMBER} spaceId={SPACE} />
        </IdentityScopeProvider>
      </IdentityScopeProvider>,
    );

    expect(screen.getByTestId('resolved-name').textContent).toBe('Fresh Own Nickname');
  });

  it("a nested provider's own locallyKnownNames entry wins over the ancestor's for the SAME address", () => {
    const PARTNER = fixtureAddress('PeerAMergeOverride');

    renderWithClient(
      <IdentityScopeProvider
        rostersBySpace={{}}
        selfAddress={null}
        locallyKnownNames={{ [PARTNER]: 'Stale Ancestor Name' }}
      >
        <IdentityScopeProvider
          rostersBySpace={{}}
          selfAddress={null}
          locallyKnownNames={{ [PARTNER]: 'Fresh Own Name' }}
        >
          <Probe address={PARTNER} />
        </IdentityScopeProvider>
      </IdentityScopeProvider>,
    );

    expect(screen.getByTestId('resolved-name').textContent).toBe('Fresh Own Name');
  });

  it('a root provider with no ancestor (App.tsx / an isolated test mount) resolves purely from its own data, unaffected by merging', () => {
    const PARTNER = fixtureAddress('PeerAMergeNoAncestor');

    renderWithClient(
      <IdentityScopeProvider
        rostersBySpace={{}}
        selfAddress={null}
        locallyKnownNames={{ [PARTNER]: 'Only Name' }}
      >
        <Probe address={PARTNER} />
      </IdentityScopeProvider>,
    );

    expect(screen.getByTestId('resolved-name').textContent).toBe('Only Name');
  });

  it("a nested provider that omits spaceId does NOT inherit the ancestor's spaceId — a detached surface stays on the global ladder even nested under a Space", () => {
    const SPACE = 'space-merge-3';
    const MEMBER = fixtureAddress('ThemThemMergeNoLeak');

    renderWithClient(
      <IdentityScopeProvider
        spaceId={SPACE}
        rostersBySpace={{ [SPACE]: { [MEMBER]: { display_name: 'Space Nickname' } } }}
        selfAddress={null}
      >
        {/* Nested provider omits spaceId. Data still merges in (rostersBySpace
            for SPACE is visible), but nothing here asks to resolve AT that
            space, so the per-space nickname tier must never activate. */}
        <IdentityScopeProvider rostersBySpace={{}} selfAddress={null}>
          <Probe address={MEMBER} />
        </IdentityScopeProvider>
      </IdentityScopeProvider>,
    );

    // No spaceId reaches the resolve call either, so this is the global
    // ladder: the per-space nickname must not win, so it falls through to
    // the truncated address instead.
    const text = screen.getByTestId('resolved-name').textContent ?? '';
    expect(text).not.toBe('Space Nickname');
  });
});
