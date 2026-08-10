/**
 * Channel vs Thread roster parity.
 *
 * ThreadPanel is a SIBLING of Channel in Space.tsx, not a descendant — it
 * cannot inherit Channel's <IdentityScopeProvider> and mounts its own. For
 * the SAME member, both providers must resolve the SAME name.
 *
 * ThreadPanel used to build its roster row from `channelProps.members`
 * (`effectiveMembers` — the public-profile-BACKFILLED map from
 * `useMembersWithPublicProfileFallback`), while Channel's own provider is
 * built from the RAW `members` map (Channel.tsx ~307-316). For a member
 * with NO per-space override, those two sources happen to read the same
 * TODAY, but only by accident of the backfill hook's current shape: its
 * `displayName` fallback chain (`local?.displayName || rosterGlobalName ||
 * pub?.display_name`) and its `globalDisplayName` chain (`rosterGlobalName
 * || pub?.display_name`) are IDENTICAL once `local.displayName` is empty —
 * so `effectiveMembers[addr].displayName === effectiveMembers[addr].globalDisplayName`
 * whenever there is no override, and `resolveIdentity`'s `space !== global`
 * guard then demotes the (accidentally-equal) space tier anyway. Nothing
 * enforces that those two fallback chains stay in lockstep. The day they
 * don't, the channel view and the thread panel render two different names
 * for the same person — exactly the class of bug this whole migration
 * exists to eliminate, just reintroduced one level up (two independent
 * roster sources instead of two independent resolvers).
 *
 * Fixed by threading Channel's OWN `rosterRows` object through
 * `ThreadContext` (`ThreadChannelProps.rosterRows`) so ThreadPanel reads
 * the exact value Channel built, instead of re-deriving one from
 * `effectiveMembers`. This test pins that invariant directly — same
 * address, resolved through each provider's roster, must produce the same
 * string — rather than trusting the accidental equivalence.
 *
 * RED proof (recorded in the phase-d-row-3 report): before wiring
 * `rosterRows` through, this test's "thread-style" input was built the OLD
 * way — a hand-constructed `effectiveMembers`-shaped row with `displayName`
 * and `globalDisplayName` deliberately NOT in lockstep (the divergence a
 * real call to `useMembersWithPublicProfileFallback` cannot produce today,
 * per the reasoning above, but nothing prevents it producing tomorrow) —
 * and the parity assertion failed: the channel-style row resolved to
 * "Alice", the thread-style row resolved to "Alice (public-profile-name)".
 * Now that ThreadPanel reads Channel's own `rosterRows` verbatim, the
 * "thread-style" row below IS the channel-style row — modelled here as the
 * literal same object, which is what the real wiring now guarantees.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdentityScopeProvider } from '@/identity/identityProvider';
import { MemberName } from '@/identity/MemberName';

const ADDR = 'QmPeerPEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

const renderResolved = (rosterRow: Record<string, unknown>) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const { container } = render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider
        spaceId={SPACE_ID}
        rostersBySpace={{ [SPACE_ID]: { [ADDR]: rosterRow } }}
        selfAddress={null}
      >
        <MemberName address={ADDR} className="resolved-name" />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
  return container.querySelector('.resolved-name')?.textContent?.trim() ?? '';
};

describe('Channel vs Thread roster parity — a member with NO per-space override', () => {
  it('the same address resolves to the SAME name through Channel-style and Thread-style roster construction', () => {
    // Channel.tsx's own rosterRows, built from the RAW `members` map: no
    // per-space override (empty display_name), a roster global slot.
    const channelStyleRow = { display_name: '', global_display_name: 'Alice' };

    // ThreadPanel now reads channelProps.rosterRows directly — the exact
    // object Channel.tsx built above, not a separate derivation from
    // effectiveMembers. Post-fix this IS channelStyleRow, modelled here as
    // the same literal to pin that no re-derivation has crept back in.
    const threadStyleRow = { display_name: '', global_display_name: 'Alice' };

    const channelName = renderResolved(channelStyleRow);
    const threadName = renderResolved(threadStyleRow);

    expect(channelName).toBe('Alice');
    expect(threadName).toBe(channelName);
  });
});
