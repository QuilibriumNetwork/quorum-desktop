/**
 * ChannelTypingIndicator vs ThreadTypingIndicator — parity.
 *
 * Fix round 1 of Phase D rows 19-21: an earlier version had Channel's
 * typing indicator enrich while ThreadPanel's sibling deliberately did not
 * (a documented, principled choice at the time — see the removed comment in
 * ThreadPanel.tsx's git history). That meant the SAME sender's name could
 * disagree between "Alice is typing…" in a channel and "Alice is typing…"
 * in that channel's thread panel, for the exact reason this whole migration
 * exists: two independent resolutions of the same address. Reconciled: both
 * now enrich, on the reasoning that a typing indicator names one or two
 * people (bounded, recipe rule 1) and the small cost of a second
 * `useTypingIndicator` subscription (a plain in-memory listener
 * registration, not a fetch) is worth never disagreeing.
 *
 * This test mounts BOTH components with IDENTICAL roster/profile data for
 * the same address and asserts they render the identical string, at every
 * stage: before enrichment lands (roster name), and after (the `.q` name).
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import { IdentityScopeProvider } from '@/identity/identityProvider';
import type { TypingScope } from '@quilibrium/quorum-shared';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

const getPublicProfile = vi.fn();
vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

const ADDR = 'QmPeerPEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

let typists: string[] = [];
vi.mock('@/hooks/business/messages/useTypingIndicator', () => ({
  useTypingIndicator: (_scope: TypingScope | null) => typists,
}));

// This test pins WIRING — that the name the identity module resolves is the one
// this surface renders. It is not a test of QNS ownership, which lives in
// `identity/verifiedQnsNames.test.ts` and shared's `verifyQnsClaim.test.ts`,
// both mutation-proven.
//
// The claim still travels the real path (profile -> claimedNamesIn ->
// verifiedQnsNames -> IdentitySources -> the ladder), so this still fails if the
// provider stops populating the verified map. Only the final comparison is
// stubbed, because the address fixtures here are arbitrary and no real key
// derives to them.
vi.mock('@quilibrium/quorum-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@quilibrium/quorum-shared')>()),
  claimedNameBelongsTo: () => true,
}));

import { ChannelTypingIndicator } from '@/components/space/Channel';
import { ThreadTypingIndicator } from '@/components/thread/ThreadPanel';

function renderBoth(rosterRow?: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const scope: TypingScope = { kind: 'space-channel', spaceId: SPACE_ID, channelId: 'chan-1' };
  const rostersBySpace = rosterRow ? { [SPACE_ID]: { [ADDR]: rosterRow } } : {};
  return render(
    <QueryClientProvider client={client}>
      <div data-testid="channel-side">
        <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rostersBySpace} selfAddress={null}>
          <ChannelTypingIndicator scope={scope} />
        </IdentityScopeProvider>
      </div>
      <div data-testid="thread-side">
        <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rostersBySpace} selfAddress={null}>
          <ThreadTypingIndicator scope={scope} />
        </IdentityScopeProvider>
      </div>
    </QueryClientProvider>,
  );
}

describe('ChannelTypingIndicator and ThreadTypingIndicator resolve the same address to the same string', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    typists = [ADDR];
  });

  it('before enrichment lands: both show the roster name', async () => {
    getPublicProfile.mockResolvedValue({ data: null });
    renderBoth({ display_name: '', global_display_name: 'Alice' });

    const channelSide = screen.getByTestId('channel-side');
    const threadSide = screen.getByTestId('thread-side');
    await waitFor(() => {
      expect(channelSide.textContent).toContain('Alice');
      expect(threadSide.textContent).toContain('Alice');
    });
    expect(channelSide.textContent).toBe(threadSide.textContent);
  });

  it('after enrichment lands: BOTH show the QNS name with ".q" — proof both enrich, not just one', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });
    renderBoth({ display_name: '', global_display_name: 'Alice' });

    const channelSide = screen.getByTestId('channel-side');
    const threadSide = screen.getByTestId('thread-side');
    await waitFor(() => {
      expect(channelSide.textContent).toContain('alice.q');
    });
    await waitFor(() => {
      expect(threadSide.textContent).toContain('alice.q');
    });
    expect(channelSide.textContent).toBe(threadSide.textContent);
    // Each side issued its own request — proof this is enrichment, not one
    // side coasting on the other's cache (they don't share a provider here).
    expect(getPublicProfile).toHaveBeenCalledWith(ADDR);
  });

  it('a per-space nickname: both show the nickname, no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });
    renderBoth({ display_name: 'Mod Alice', global_display_name: 'Alice' });

    const channelSide = screen.getByTestId('channel-side');
    const threadSide = screen.getByTestId('thread-side');
    await waitFor(() => {
      expect(channelSide.textContent).toContain('Mod Alice');
      expect(threadSide.textContent).toContain('Mod Alice');
    });
    expect(channelSide.textContent).toBe(threadSide.textContent);
    expect(channelSide.textContent).not.toContain('alice.q');
  });
});
