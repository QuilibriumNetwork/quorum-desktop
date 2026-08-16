/**
 * Channel.tsx's typing indicator (Phase D row 21) — the last resolver-import
 * call site left in Channel.tsx once rows 1-18 migrated the child
 * components (Message.tsx, MessageComposer.tsx, ThreadPanel.tsx, etc.) that
 * used to account for the rest.
 *
 * Extracted as `ChannelTypingIndicator` because `useNameResolver` needs an
 * ancestor `<IdentityScopeProvider>` — Channel's own function body runs
 * BEFORE the provider it returns exists in the tree, same reasoning as
 * ThreadPanel's `ThreadTypingIndicator` / DirectMessage's
 * `DirectMessageComposerBar`.
 *
 * UNLIKE ThreadPanel's sibling, this one DOES enrich: the main channel view
 * is bounded (a handful of concurrent typists at any moment) and is the
 * highest-traffic surface in the app, so showing the verified `.q` is worth
 * the extra request. `mapSenderToUser` below deliberately is NOT used to
 * resolve the name — proof this renders through the identity module and not
 * a locally-mapped member row.
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

const ADDR = 'QmPeerTEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
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

function renderWith(rosterRow?: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const scope: TypingScope = { kind: 'space-channel', spaceId: SPACE_ID, channelId: 'chan-1' };
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider
        spaceId={SPACE_ID}
        rostersBySpace={rosterRow ? { [SPACE_ID]: { [ADDR]: rosterRow } } : {}}
        selfAddress={null}
      >
        <ChannelTypingIndicator scope={scope} />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('ChannelTypingIndicator — resolves via the identity module, WITH enrich', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getPublicProfile.mockResolvedValue({ data: null });
    typists = [];
  });

  it('renders the roster name (no .q) before enrichment lands', async () => {
    typists = [ADDR];
    renderWith({ display_name: '', global_display_name: 'Alice' });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    expect(screen.queryByText('alice.q')).not.toBeInTheDocument();
  });

  it('renders the QNS name with ".q" once its own enrich request resolves — the load-bearing case', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });
    typists = [ADDR];
    renderWith({ display_name: '', global_display_name: 'Alice' });

    await waitFor(() => {
      expect(screen.getByText('alice.q')).toBeInTheDocument();
    });
    // Proves the enrich request was actually issued by this component.
    expect(getPublicProfile).toHaveBeenCalledWith(ADDR);
  });

  it('a member with a per-space nickname renders the nickname, no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });
    typists = [ADDR];
    renderWith({ display_name: 'Mod Alice', global_display_name: 'Alice' });

    await waitFor(() => {
      expect(screen.getByText('Mod Alice')).toBeInTheDocument();
    });
    expect(screen.queryByText('alice.q')).not.toBeInTheDocument();
  });
});
