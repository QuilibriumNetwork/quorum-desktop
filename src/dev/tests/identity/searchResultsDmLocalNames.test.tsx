/**
 * `SearchResults` mounts ITS OWN `<IdentityScopeProvider>` (see the
 * component's own docstring) — a nested provider always shadows an ancestor's
 * completely, so fixing `useRootIdentityScope` alone cannot reach anything
 * rendered inside `SearchResultsInner`; see `rootScopeDmLocalNames.test.tsx`
 * for that (separate) half of the fix. This test mounts the REAL exported
 * `SearchResults` component to close the loop on the actual reported bug:
 * a DM partner with no public profile and no space roster row (a DM contact,
 * not a space member) rendered as a truncated address in DM search results,
 * even though the app already knows their name locally from
 * `Conversation.displayName`.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import type { SearchResult } from '@/db/messages';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

const SELF = 'QmSelfSearchResultsAAAAAAAAAAAAAAAAAAAAAAAAAA';
const PARTNER = 'QmPeerSearchResultsEgVKpYZKYuFu2J49zHXnA8vZtE';

// `SearchResults.tsx` pulls in the `../../hooks` barrel, which eagerly
// evaluates unrelated modules (e.g. `useRegistration.ts` -> `QuorumApiContext`)
// at import time. Plain `vi.fn()` module-scope consts hit a TDZ error there —
// `vi.mock` factories are hoisted above them by the ESM import graph, not just
// textually. `vi.hoisted` is the documented fix: it runs before any mock
// factory needs the value.
const mocks = vi.hoisted(() => ({
  getPublicProfile: vi.fn(),
  getSpaceMembers: vi.fn(),
  getSpace: vi.fn(),
  getConversations: vi.fn(),
}));

vi.mock('@/api/baseTypes', async () => {
  const actual = await vi.importActual<typeof import('@/api/baseTypes')>('@/api/baseTypes');
  return {
    ...actual,
    QuorumApiClient: class {
      getPublicProfile = mocks.getPublicProfile;
    },
  };
});

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({
    currentPasskeyInfo: { address: SELF, displayName: 'Device Name', pfpUrl: '' },
  }),
}));

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: {
      getSpaceMembers: mocks.getSpaceMembers,
      getSpace: mocks.getSpace,
      getConversations: mocks.getConversations,
    },
  }),
}));

// Real Virtuoso needs layout measurement jsdom doesn't provide — render every
// item directly, matching the pattern already used for other Virtuoso-based
// identity surfaces (see PinnedMessagesPanel.test.tsx).
vi.mock('react-virtuoso', () => ({
  Virtuoso: (props: any) => (
    <>{(props.data ?? []).map((item: unknown, i: number) => (
      <React.Fragment key={i}>{props.itemContent(i, item)}</React.Fragment>
    ))}</>
  ),
}));

import { SearchResults } from '@/components/search/SearchResults';

const dmResult = (id: string, sender: string, dmAddress: string): SearchResult =>
  ({
    score: 1,
    highlights: [],
    message: {
      spaceId: dmAddress,
      channelId: dmAddress,
      messageId: id,
      digestAlgorithm: '',
      nonce: '',
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      lastModifiedHash: '',
      content: { senderId: sender, type: 'post', text: 'hi there' },
      reactions: [],
      mentions: { memberIds: [], roleIds: [], channelIds: [] },
    },
  }) as unknown as SearchResult;

function renderSearchResults(results: SearchResult[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <SearchResults
        results={results}
        isLoading={false}
        isError={false}
        query="hi"
        onNavigate={() => {}}
        highlightTerms={(text: string) => text}
      />
    </QueryClientProvider>,
  );
}

describe('SearchResults — DM sender resolves via useLocalDmNames, not a truncated address', () => {
  beforeEach(() => {
    mocks.getPublicProfile.mockReset();
    mocks.getSpaceMembers.mockReset();
    mocks.getSpace.mockReset();
    mocks.getConversations.mockReset();
    mocks.getPublicProfile.mockResolvedValue({ data: null }); // no public profile
    mocks.getConversations.mockResolvedValue({
      conversations: [{ address: PARTNER, displayName: 'Bob (from conversation)' }],
    });
  });

  it('a DM partner known only from the local conversation record renders their name in the result row', async () => {
    renderSearchResults([dmResult('m1', PARTNER, PARTNER)]);

    await waitFor(() =>
      expect(screen.getByText('Bob (from conversation)')).toBeInTheDocument(),
    );
    expect(screen.queryByText(/^Qm.*…/)).not.toBeInTheDocument();
  });
});
